/*
 * ft4222-scope-reader.c — FT-710 spectrum scope reader for RigControl Web.
 *
 * The Yaesu FT-710 exposes a second USB device (FTDI FT4222, VID:0403 PID:601C)
 * alongside the CP2105 CAT serial port. This binary opens the FT4222 as an SPI
 * master using FTDI's libft4222, reads 4096-byte spectrum frames from the radio
 * DSP, and writes NDJSON to stdout for consumption by server/yaesuScope.ts.
 *
 * stdout protocol:
 *   "OPEN_OK\n"            — startup success; frames follow
 *   "OPEN_ERROR: ...\n"    — startup failure; exits with code 1
 *   per frame (one JSON object per line):
 *     {"spanHz":N,"modeVariant":N,"centerHz":N,"lowHz":N,"highHz":N,"wf1":"<1700 hex chars>"}
 *
 * Requires libft4222 installed on the host:
 *   Linux:   libft4222.so  (from ftdi.com/products/ft4222h)
 *   macOS:   libft4222.dylib
 *   Windows: LibFT4222-64.dll + ftd2xx.dll
 *
 * Build:
 *   Linux:   gcc -O2 -o bin/linux/ft4222-scope-reader ft4222-scope-reader.c -ldl
 *   macOS:   clang -O2 -o bin/mac/ft4222-scope-reader ft4222-scope-reader.c
 *   Windows: cl ft4222-scope-reader.c /Fe:bin\windows\ft4222-scope-reader.exe /O2 /nologo
 */

#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* ---------- Platform-specific dynamic loading ---------- */

#ifdef _WIN32
#  include <windows.h>
typedef HMODULE lib_handle_t;
static lib_handle_t open_lib(const char *name)  { return LoadLibraryA(name); }
static void        close_lib(lib_handle_t h)    { FreeLibrary(h); }
static void       *get_sym(lib_handle_t h, const char *s) {
    FARPROC fp = GetProcAddress(h, s);
    void *p; memcpy(&p, &fp, sizeof(p)); return p;
}
static const char *lib_error(void) { return "see GetLastError()"; }
#else
#  include <dlfcn.h>
#  include <signal.h>
#  include <unistd.h>
typedef void* lib_handle_t;
static lib_handle_t open_lib(const char *name)  { return dlopen(name, RTLD_LAZY); }
static void        close_lib(lib_handle_t h)    { if (h) dlclose(h); }
static void       *get_sym(lib_handle_t h, const char *s) { return dlsym(h, s); }
static const char *lib_error(void) { return dlerror(); }
#endif

/* ---------- FTD2XX / FT4222 type definitions ---------- */

typedef void    *FT_HANDLE;
typedef uint32_t FT_STATUS;

#define FT_OK                  0
#define FT4222_OK              0
#define FT_OPEN_BY_DESCRIPTION 2

/* FT4222_SPIMaster_Init parameters */
#define SPI_IO_SINGLE  1   /* single-bit SPI */
#define CLK_DIV_64     6   /* 24 MHz / 64 = 375 kHz */
#define CLK_IDLE_HIGH  1
#define CLK_LEADING    0
#define SYS_CLK_24     0   /* 24 MHz system clock */

typedef FT_STATUS (*FT_OpenEx_fn)            (void*, uint32_t, FT_HANDLE*);
typedef FT_STATUS (*FT_Close_fn)             (FT_HANDLE);
typedef FT_STATUS (*FT_SetTimeouts_fn)       (FT_HANDLE, uint32_t, uint32_t);
typedef FT_STATUS (*FT_SetLatencyTimer_fn)   (FT_HANDLE, uint8_t);
typedef FT_STATUS (*FT4222_UnInitialize_fn)  (FT_HANDLE);
typedef FT_STATUS (*FT4222_SPIMaster_Init_fn)(FT_HANDLE, int, int, int, int, uint8_t);
typedef FT_STATUS (*FT4222_SPIMaster_SingleRead_fn)(FT_HANDLE, uint8_t*, uint16_t, uint16_t*, int);
typedef FT_STATUS (*FT4222_SetClock_fn)      (FT_HANDLE, int);

static FT_OpenEx_fn             pFT_OpenEx             = NULL;
static FT_Close_fn              pFT_Close              = NULL;
static FT_SetTimeouts_fn        pFT_SetTimeouts        = NULL;
static FT_SetLatencyTimer_fn    pFT_SetLatencyTimer    = NULL;
static FT4222_UnInitialize_fn   pFT4222_UnInitialize   = NULL;
static FT4222_SPIMaster_Init_fn pFT4222_SPIMaster_Init = NULL;
static FT4222_SPIMaster_SingleRead_fn pFT4222_SingleRead = NULL;
static FT4222_SetClock_fn       pFT4222_SetClock       = NULL;

/* ---------- Frame layout ---------- */

#define FRAME_SIZE    4096
#define WF1_OFFSET    0
#define WF1_LENGTH    850

/*
 * data[150] field starts after: wf1(850) + wf2(850) + audio1fft(200) +
 * audio1scope(400) + audio2fft(200) + audio2scope(400) = 2900
 */
#define DATA_OFFSET   2900

/* sync pattern occupies bytes 4092-4095 */
#define SYNC_OFFSET   4092
static const uint8_t SYNC_BYTES[4] = { 0xFF, 0x01, 0xEE, 0x01 };

/* Span index 0-9 → total span in Hz (from FT-710 radio specifications) */
static const uint32_t SPAN_TABLE[10] = {
    1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000
};

/* ---------- Globals ---------- */

static FT_HANDLE       g_device  = NULL;
static lib_handle_t    g_ft4222_lib  = NULL;
static lib_handle_t    g_ftd2xx_lib  = NULL;  /* Windows only */
static volatile int    g_running = 1;
static uint8_t         g_frame[FRAME_SIZE];

/* ---------- Cleanup ---------- */

static void cleanup(void) {
    if (g_device) {
        pFT4222_UnInitialize(g_device);
        pFT_Close(g_device);
        g_device = NULL;
    }
    close_lib(g_ft4222_lib);  g_ft4222_lib = NULL;
    close_lib(g_ftd2xx_lib);  g_ftd2xx_lib = NULL;
}

#ifndef _WIN32
static void sig_handler(int sig) {
    (void)sig;
    g_running = 0;
    cleanup();
    _exit(0);
}
#endif

/* ---------- Library loading ---------- */

static int load_libraries(void) {
#ifdef _WIN32
    /* Windows: ftd2xx.dll holds FT_ functions; LibFT4222-64.dll holds FT4222_ */
    g_ftd2xx_lib = open_lib("ftd2xx");
    if (!g_ftd2xx_lib) {
        fprintf(stdout, "OPEN_ERROR: ftd2xx.dll not found — install FTDI D2XX drivers\n");
        return 0;
    }
    g_ft4222_lib = open_lib("LibFT4222-64");
    if (!g_ft4222_lib) {
        g_ft4222_lib = open_lib("LibFT4222");
        if (!g_ft4222_lib) {
            fprintf(stdout, "OPEN_ERROR: LibFT4222.dll not found — install libft4222 from ftdi.com\n");
            return 0;
        }
    }
    pFT_OpenEx          = (FT_OpenEx_fn)           get_sym(g_ftd2xx_lib, "FT_OpenEx");
    pFT_Close           = (FT_Close_fn)            get_sym(g_ftd2xx_lib, "FT_Close");
    pFT_SetTimeouts     = (FT_SetTimeouts_fn)      get_sym(g_ftd2xx_lib, "FT_SetTimeouts");
    pFT_SetLatencyTimer = (FT_SetLatencyTimer_fn)  get_sym(g_ftd2xx_lib, "FT_SetLatencyTimer");
    pFT4222_UnInitialize   = (FT4222_UnInitialize_fn)   get_sym(g_ft4222_lib, "FT4222_UnInitialize");
    pFT4222_SPIMaster_Init = (FT4222_SPIMaster_Init_fn) get_sym(g_ft4222_lib, "FT4222_SPIMaster_Init");
    pFT4222_SingleRead     = (FT4222_SPIMaster_SingleRead_fn) get_sym(g_ft4222_lib, "FT4222_SPIMaster_SingleRead");
    pFT4222_SetClock       = (FT4222_SetClock_fn)       get_sym(g_ft4222_lib, "FT4222_SetClock");
#else
    /* Linux/macOS: libft4222 bundles both FTD2XX and FT4222 symbols */
    g_ft4222_lib = open_lib("libft4222.so.1.4.4.44");
    if (!g_ft4222_lib) g_ft4222_lib = open_lib("libft4222.so");
    if (!g_ft4222_lib) g_ft4222_lib = open_lib("libft4222");
    if (!g_ft4222_lib) {
        fprintf(stdout,
            "OPEN_ERROR: libft4222 not found — install from ftdi.com/products/ft4222h "
            "and run 'sudo ldconfig'; error: %s\n", lib_error());
        return 0;
    }
    pFT_OpenEx          = (FT_OpenEx_fn)           get_sym(g_ft4222_lib, "FT_OpenEx");
    pFT_Close           = (FT_Close_fn)            get_sym(g_ft4222_lib, "FT_Close");
    pFT_SetTimeouts     = (FT_SetTimeouts_fn)      get_sym(g_ft4222_lib, "FT_SetTimeouts");
    pFT_SetLatencyTimer = (FT_SetLatencyTimer_fn)  get_sym(g_ft4222_lib, "FT_SetLatencyTimer");
    pFT4222_UnInitialize   = (FT4222_UnInitialize_fn)   get_sym(g_ft4222_lib, "FT4222_UnInitialize");
    pFT4222_SPIMaster_Init = (FT4222_SPIMaster_Init_fn) get_sym(g_ft4222_lib, "FT4222_SPIMaster_Init");
    pFT4222_SingleRead     = (FT4222_SPIMaster_SingleRead_fn) get_sym(g_ft4222_lib, "FT4222_SPIMaster_SingleRead");
    pFT4222_SetClock       = (FT4222_SetClock_fn)       get_sym(g_ft4222_lib, "FT4222_SetClock");
#endif

    if (!pFT_OpenEx || !pFT_Close || !pFT_SetTimeouts || !pFT_SetLatencyTimer ||
        !pFT4222_UnInitialize || !pFT4222_SPIMaster_Init ||
        !pFT4222_SingleRead || !pFT4222_SetClock) {
        fprintf(stdout, "OPEN_ERROR: failed to resolve required symbols from libft4222\n");
        return 0;
    }
    return 1;
}

/* ---------- Device setup ---------- */

static int setup_device(void) {
    if (g_device) {
        pFT4222_UnInitialize(g_device);
        pFT_Close(g_device);
        g_device = NULL;
    }

    FT_STATUS st = pFT_OpenEx((void *)"FT4222 A", FT_OPEN_BY_DESCRIPTION, &g_device);
    if (st != FT_OK) {
        fprintf(stdout,
            "OPEN_ERROR: FT4222 device not found (status %u) — "
            "check udev rules and that the FT-710 is connected via USB\n",
            (unsigned)st);
        g_device = NULL;
        return 0;
    }

    st = pFT_SetTimeouts(g_device, 100, 100);
    if (st != FT_OK) {
        fprintf(stdout, "OPEN_ERROR: FT_SetTimeouts failed (status %u)\n", (unsigned)st);
        goto fail;
    }

    st = pFT_SetLatencyTimer(g_device, 2);
    if (st != FT_OK) {
        fprintf(stdout, "OPEN_ERROR: FT_SetLatencyTimer failed (status %u)\n", (unsigned)st);
        goto fail;
    }

    st = pFT4222_SPIMaster_Init(g_device, SPI_IO_SINGLE, CLK_DIV_64,
                                CLK_IDLE_HIGH, CLK_LEADING, 0x01);
    if (st != FT4222_OK) {
        fprintf(stdout, "OPEN_ERROR: FT4222_SPIMaster_Init failed (status %u)\n", (unsigned)st);
        goto fail;
    }

    st = pFT4222_SetClock(g_device, SYS_CLK_24);
    if (st != FT4222_OK) {
        fprintf(stdout, "OPEN_ERROR: FT4222_SetClock failed (status %u)\n", (unsigned)st);
        goto fail;
    }

    return 1;

fail:
    pFT4222_UnInitialize(g_device);
    pFT_Close(g_device);
    g_device = NULL;
    return 0;
}

/* ---------- Main ---------- */

int main(void) {
#ifndef _WIN32
    signal(SIGTERM, sig_handler);
    signal(SIGINT,  sig_handler);
    signal(SIGHUP,  sig_handler);
    signal(SIGPIPE, sig_handler);
#endif

    if (!load_libraries()) {
        fflush(stdout);
        return 1;
    }

    if (!setup_device()) {
        fflush(stdout);
        cleanup();
        return 1;
    }

    fprintf(stdout, "OPEN_OK\n");
    fflush(stdout);

    int sync_fails = 0;

    while (g_running) {
        uint16_t bytes_read = 0;
        FT_STATUS st = pFT4222_SingleRead(g_device, g_frame, FRAME_SIZE, &bytes_read, 0);

        if (st != FT_OK || bytes_read != FRAME_SIZE) {
            fprintf(stderr, "[FT4222] Read error: status=%u bytes=%u\n",
                    (unsigned)st, (unsigned)bytes_read);
            if (++sync_fails >= 5) {
                fprintf(stderr, "[FT4222] Re-initializing device after repeated read failures\n");
                if (!setup_device()) {
                    fprintf(stderr, "[FT4222] Re-init failed, exiting\n");
                    break;
                }
                sync_fails = 0;
            }
            continue;
        }

        /* Validate sync bytes at end of frame */
        if (memcmp(g_frame + SYNC_OFFSET, SYNC_BYTES, 4) != 0) {
            if (++sync_fails >= 5) {
                fprintf(stderr, "[FT4222] Re-initializing device after repeated sync failures\n");
                if (!setup_device()) {
                    fprintf(stderr, "[FT4222] Re-init failed, exiting\n");
                    break;
                }
                sync_fails = 0;
            }
            continue;
        }
        sync_fails = 0;

        /* Parse metadata from data[150] section */
        uint8_t span_idx     = g_frame[DATA_OFFSET + 32];
        uint8_t mode_variant = g_frame[DATA_OFFSET + 52];

        if (span_idx > 9) span_idx = 5;  /* default 50 kHz if out of range */

        uint32_t center_hz =
            ((uint32_t)g_frame[DATA_OFFSET + 132] << 24) |
            ((uint32_t)g_frame[DATA_OFFSET + 133] << 16) |
            ((uint32_t)g_frame[DATA_OFFSET + 134] << 8)  |
             (uint32_t)g_frame[DATA_OFFSET + 135];

        uint32_t fixed_start_hz =
            ((uint32_t)g_frame[DATA_OFFSET + 144] << 24) |
            ((uint32_t)g_frame[DATA_OFFSET + 145] << 16) |
            ((uint32_t)g_frame[DATA_OFFSET + 146] << 8)  |
             (uint32_t)g_frame[DATA_OFFSET + 147];

        uint32_t span_hz = SPAN_TABLE[span_idx];
        uint32_t low_hz, high_hz;

        if (mode_variant == 2) {   /* fixed mode: start freq + span */
            low_hz  = fixed_start_hz;
            high_hz = fixed_start_hz + span_hz;
        } else {                   /* center or cursor: VFO ± span/2 */
            low_hz  = (center_hz > span_hz / 2) ? center_hz - span_hz / 2 : 0;
            high_hz = center_hz + span_hz / 2;
        }

        /* Emit NDJSON: wf1 bytes are bitwise-inverted by the radio hardware;
         * ~byte gives the display-correct amplitude (higher = stronger signal). */
        fprintf(stdout,
            "{\"spanHz\":%lu,\"modeVariant\":%u,"
            "\"centerHz\":%lu,\"lowHz\":%lu,\"highHz\":%lu,\"wf1\":\"",
            (unsigned long)span_hz, (unsigned)mode_variant,
            (unsigned long)center_hz,
            (unsigned long)low_hz, (unsigned long)high_hz);

        for (int i = 0; i < WF1_LENGTH; i++) {
            fprintf(stdout, "%02x", (uint8_t)~g_frame[WF1_OFFSET + i]);
        }

        fprintf(stdout, "\"}\n");
        fflush(stdout);
    }

    cleanup();
    return 0;
}
