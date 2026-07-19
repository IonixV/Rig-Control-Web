# Unit Test Plan — Tiers 1–4 (Batch A)

**Status:** Tiers 1–3 and Tier 4 Batch A all implemented. Tier 1/2 committed as `0e08dec`/`c65a463`; Tier 3 committed as `16d25b0`; Tier 4 Batch A landed 2026-07-17, not yet committed — see that section below. `npm run test` is 193/193, `npm run test:fixtures` is 6/6, `npm run test:e2e` is 38/38, `npm run lint` is clean. Both Tier 3 and Tier 4 Batch A each fixed a real bug found while writing their tests — see those sections. The rest of Tier 4 (Solar, Auth/admin, CW decoder, Video/Audio) is deferred — see "Deferred (Tier 4, remaining)" for specifics on why each one.

## Context

Following the pilot test infrastructure (Vitest + Playwright, see `CLAUDE.md`'s Testing section), a full-codebase inventory found the app has ~60+ testable units across `server/` and `src/` with almost none covered — only 2 functions in `server/rigComm.ts` and 1 hook (`useSpectrum`) have direct Vitest tests today. That inventory was sorted into four tiers by effort/value; this plan covers **Tier 1 only**: pure, deterministic functions (input → output, no I/O, no sockets, no native modules) that can be unit-tested with Vitest.

Tiers 2–4 (hook-level stub-socket tests, e2e panel tests via the existing Dummy-rigctld fixture, and e2e tests needing new fixtures for audio/video/CW/WSJTX) are deliberately **out of scope** for this pass — noted at the end for later phasing.

## Convention

Test files are co-located with source, matching the existing pattern (`server/rigComm.test.ts`, `src/hooks/useSpectrum.test.ts`). One test file per source module, covering every Tier-1 function in that module. Server-side test files get a `// @vitest-environment node` docblock.

**Two kinds of items below:**
- **Direct** — the function is already exported and can be tested as-is, zero source changes.
- **Extract** — the logic exists but is private (module-scope, not exported) or embedded inline in a component/hook closure. Requires a small refactor (add `export`, or pull the logic out into a standalone function with explicit parameters replacing whatever it closed over) *before* it's testable. Refactors are scoped to be mechanical — no behavior change, just making the existing logic reachable.

---

## Backend (`server/`)

### `server/rigComm.ts` — extend existing `server/rigComm.test.ts`
| Function | Status | Test cases |
|---|---|---|
| `normalizeVfoName(raw)` | **Extract** — private, line 14 | `"Main"` → `"VFOA"`, `"Sub"` → `"VFOB"`, `"VFOA"`/`"VFOB"`/other strings pass through unchanged, leading/trailing whitespace trimmed |
| `resetRigState(ctx)` | **Direct** — exported, line 655 | Given a `ctx` with non-default rig fields populated, assert every field it touches is reset to its documented default (frequency, mode, ptt, vfo, split, meters, etc.) |

### `server/rigctld.ts` — new `server/rigctld.test.ts`
| Function | Status | Test cases |
|---|---|---|
| `checkVersionSupported(version)` | **Direct** — exported | `null` → false; below `4.7.0` → false; exactly `4.7.0` → true; above → true; one/two-part version strings (`"5"`, `"4.7"`) handled without throwing |

### `server/context.ts` — new `server/context.test.ts`
| Function | Status | Test cases |
|---|---|---|
| `createInitialContext(io, baseDir, dataDir)` | **Direct** — exported | Snapshot/shape assertion on defaults that matter for regressions: `pollRate: 2000`, `spectrumSettings` (enabled: false, source: "hamlib", multicastAddr/Port, ft4222SpanIndex), `spectrumSupported: false`, `lastStatus` shape |

### `server/vlog.ts` — new `server/vlog.test.ts`
| Function | Status | Test cases | Gotcha |
|---|---|---|---|
| `ts()` | **Direct** — exported | Fixed `Date` (via `vi.setSystemTime`) → exact `"HH:MM:SS.mmm"` string | — |
| `setDebugFlag(key, value)` | **Direct** — exported | Mutates the shared `debugFlags` object; assert via a subsequent `vlogX` call | Module-level mutable state — reset between tests (`setDebugFlag` back to false) so tests don't leak into each other |
| `vlogRig`/`vlogAudio`/`vlogVideo`/`vlogCw`/`vlogInfra`/`vlogSpectrum`/`vlogSpots`/`vlogWsjtx` | **Direct** — exported | For 2–3 representative ones (not all 8, they're structurally identical): logs via `console.log` spy when its flag is on, silent when off | This file has an import-time side effect (`--help` in `process.argv` triggers `process.exit(0)`) — import it normally in tests (argv won't contain `--help` under Vitest) but don't blanket-mock `process.argv` without checking this |

### `server/diagnostics.ts` — new `server/diagnostics.test.ts`
| Function | Status | Test cases | Gotcha |
|---|---|---|---|
| `pushDiagnosticsLine(ctx, line)` | **Direct** — exported | Given a fake `ctx` (`{ diagnosticsLog: [], diagnosticsLogTimestamps: [], io: { emit: vi.fn() } }`): timestamp-prefix detection, line appended, old lines pruned once `MAX_AGE_MS`/`MAX_LINES` exceeded, `io.emit` called with the right payload | Pruning depends on `Date.now()` — use `vi.setSystemTime`/`vi.advanceTimersByTime` to control age deterministically |

### `server/tls.ts` — new `server/tls.test.ts`
| Function | Status | Test cases | Gotcha |
|---|---|---|---|
| `getLanIPs()` | **Direct** — exported | Given a mocked `os.networkInterfaces()` return value: filters to non-internal IPv4 only, skips internal/loopback and IPv6 entries | Needs `vi.mock('os', ...)` or `vi.spyOn(os, 'networkInterfaces')` |

### `server/auth.ts` — new `server/auth.test.ts`
| Function | Status | Test cases |
|---|---|---|
| `requireAuth(socket, ctx, handler)` | **Direct** — exported | Stub `socket` (`{ id, emit: vi.fn() }`) + `ctx.authenticatedSockets` Map: entry present → `handler` called; entry absent → `socket.emit("auth:required")` fired, `handler` NOT called |
| `requireAdmin(socket, ctx, handler)` | **Direct** — exported | Same pattern plus role check: `role: "admin"` → `handler` called; `role: "regular"` → rejected, `handler` NOT called |
| `issueToken(callsign, role, ctx)` | **Direct** — exported | Fixed `ctx.jwtSecret` string, no real filesystem needed: decode the returned JWT (`jsonwebtoken.verify`) and assert `sub === callsign`, `role` matches, `exp - iat` ≈ 7 days |

**Subtotal: 7 test files, ~12 functions, 1 small extraction (`normalizeVfoName`).**

---

## Frontend (`src/`)

### `src/utils.ts` — new `src/utils.test.ts`
| Function | Status | Test cases |
|---|---|---|
| `formatStep(s)` | **Direct** — exported | Boundary values: sub-1kHz → Hz, sub-1MHz → kHz, ≥1MHz → MHz, exact powers-of-ten boundaries |
| `splitLocalAudioDevices(devices)` | **Direct** — exported | Given a plain array of `{deviceId, kind, label}`-shaped objects: filters out the synthetic `deviceId: "default"` entry, splits into input/output by `kind` |

### `src/utils/spectrumColors.ts` — new `src/utils/spectrumColors.test.ts`
| Function | Status | Test cases |
|---|---|---|
| `amplitudeToPixel(amplitude, floor, ceiling, colorMap)` | **Direct** — exported | Clamping below floor / above ceiling, normalization midpoint, correct LUT index for a known `colorMap` (test against at least `COLORMAP_CLASSIC`) |

### `src/hooks/useAuth.ts` — new `src/hooks/useAuth.test.ts`
*(pure exported helpers only — the `useAuth` hook's state machine itself is Tier 2, out of scope)*
| Function | Status | Test cases |
|---|---|---|
| `clearUserPreferences(callsign)` | **Direct** — exported | Removes all namespaced `localStorage` keys for that callsign, leaves other callsigns' keys untouched |
| `checkAndClearPreferences(callsign, preferencesClearedAt)` | **Direct** — exported | Server timestamp newer than last-cleared → clears + updates marker; older/equal → no-op |
| `nsKey(callsign, key)` | **Direct** — exported | `nsKey("w1abc", "foo")` → `"W1ABC:foo"` (uppercased prefix) |

### `src/hooks/useConsoleCapture.ts` — new `src/hooks/useConsoleCapture.test.ts`
| Function | Status | Test cases |
|---|---|---|
| `ts()` | **Extract** — private, line 4 | Same as server's `ts()`: fixed `Date` → exact `"HH:MM:SS.mmm"` |
| `formatArg(a)` | **Extract** — private, line 10 | String passthrough, `Error` → message (+ stack if that's the documented behavior), plain object → `JSON.stringify`, circular-reference object → fallback string (doesn't throw) |

### `src/hooks/usePersistedCollapsed.ts` — new `src/hooks/usePersistedCollapsed.test.ts`
| Function | Status | Test cases |
|---|---|---|
| `readCollapsed(ns, key, legacyKey, defaultCollapsed)` | **Extract** — private, line 3 | Namespaced key present → its value; absent but legacy key present → legacy value; neither present → `defaultCollapsed` |

### `src/hooks/useRigctld.ts` — new `src/hooks/useRigctld.test.ts`
| Function | Status | Test cases |
|---|---|---|
| `isSettingsValid` (rename to `isRigctldSettingsValid(settings)`) | **Extract** — inline arrow fn at line 160, closes over `rigctldSettings` from hook scope; parameterize it | All five required fields present → true; any one missing/empty → false |
| Radios-list dedupe (inline at line 64, `Array.from(new Map(list.map(r => [r.id, r])).values())`) | **Extract** — pull into `dedupeRadiosById(list)` | Duplicate `id`s collapse to the last occurrence; order of first-seen unique ids otherwise preserved |

### `src/layouts/CompactLayout.tsx` — new `src/layouts/CompactLayout.test.ts`
| Function | Status | Test cases |
|---|---|---|
| `renumberSegments(segments)` | **Direct** — already a standalone module-level function | Reassigns dense sequential `y` values to a list of grid segments while preserving relative order; empty input; single segment |

### `src/layouts/PhoneLayout.tsx` — new `src/layouts/PhoneLayout.test.ts`
| Function | Status | Test cases |
|---|---|---|
| `movePhonePanel(item, direction, idx)` | **Extract** — inside the component (line 419), closes over `visibleItems` (a `useMemo`) and the `gridCallbacks` prop. Pull the pure part into `computeSwappedPositions(item, direction, idx, visibleItems)` returning the two updated `{i, x, y, w, h}` entries; the component keeps calling `gridCallbacks.updateItemPositions(...)` with that result | Swap-with-adjacent-by-sorted-`y`; boundary: first item can't move up (`idx - 1 < 0`), last item can't move down (`idx + 1 >= visibleItems.length`) — both return without producing a swap |

### `src/panels/SolarPanel.tsx` — new `src/panels/SolarPanel.test.ts`
| Function | Status | Test cases |
|---|---|---|
| `sfiColor(v)`, `aColor(v)`, `kColor(v)`, `geomagColor(s)` | **Extract** — private module-scope, lines 27/33/40/46 | For each: the documented threshold boundaries (values just below/at/above each cutoff) map to the correct Tailwind color class |

### `src/panels/SpectrumAudioPanel.tsx` — new `src/panels/SpectrumAudioPanel.test.ts`
| Function | Status | Test cases |
|---|---|---|
| `computeDisplayBandwidth(bandwidth, mode, maxHz)` | **Extract** — private module-scope, line 42 | `mode === "CW"`/`"CWR"` → capped at 1400 Hz regardless of `bandwidth`; other modes → `bandwidth + 300`, capped to `maxHz` |

### `src/modals/AdminTab.tsx` — new `src/modals/AdminTab.test.ts`
| Function | Status | Test cases |
|---|---|---|
| `formatUptime(ms)` (line 47), `formatDuration(ms)` (line 57) | **Extract** — both private module-scope functions, no closures — just add `export` | Sub-minute, minutes-only, hours+minutes, multi-day if the format supports it; zero |

### `src/modals/DiagnosticsTab.tsx` — new `src/modals/DiagnosticsTab.test.ts`
| Function | Status | Test cases | Gotcha |
|---|---|---|---|
| `buildFilename()` (line 23) | **Extract** — private module-scope, no closures — just add `export` | Fixed `Date` → exact expected filename string | Mock `Date`/`vi.setSystemTime` |
| `buildLogContent()` (line 39) | **Extract** — currently inside the component, closes over `logs` from `useDiagnostics(socket)`. Parameterize as `buildLogContent(logs: string[]): string`; component calls `buildLogContent(logs)` | Header (fixed app name + ISO timestamp + Electron-vs-browser origin string) + joined log lines given a `logs` input | Reads `window.electron`/`navigator.userAgent`/`new Date()` internally — mock all three; test both "running in Electron" and "running in browser" header variants |

### `src/App.tsx` — new `src/App.test.ts` (or extract into a small shared module, e.g. `src/appHelpers.ts`, if that reads cleaner)
| Function | Status | Test cases |
|---|---|---|
| `getPreampLabel`/`getAttenuatorLabel`/`getAgcLabel` | **Extract** — currently `useCallback`s inside the component (lines 456–471), closing over `status`, `isCompact`, `isPhone`, `agcLevels`. Pull out as standalone functions with those as explicit parameters, e.g. `formatPreampLabel(preamp, compact)`, `formatAttenuatorLabel(attenuation, compact)`, `formatAgcLabel(agc, agcLevels)`; call sites in `App.tsx` pass the same values through | `0` → `"P.AMP"`/`"ATT"` (compact/phone) or `"OFF"` (desktop-style); non-zero → `"{n}dB"`; AGC label looked up from the `"value=label"`-encoded `agcLevels` array, falls back to raw value or `"OFF"` |
| Backend-URL resolution (inline in a `useState` initializer, lines 43–59) | **Extract** — pull the decision logic into a pure `resolveBackendUrl(stored, currentOrigin): { url: string; corrected: boolean }`; the component keeps the `localStorage.setItem`/`console.log` side effects, calling this function for the decision | No stored value → current origin; stored matches current origin → unchanged; stored differs only by protocol (http↔https) on the same host/port → corrected to current origin; stored is not a valid URL → falls back to current origin |

**Subtotal: 13 test files, ~18 functions, 8 extractions (2 renames/parameterizations, 6 export-only).**

---

## Grand total for this pass

- **20 test files** (7 backend, 13 frontend), **~30 functions**
- **13 items require a refactor first** — most are one-line `export` additions (`normalizeVfoName`, `ts()`/`formatArg()`, `readCollapsed`, the `SolarPanel` color functions, `computeDisplayBandwidth`, `formatUptime`/`formatDuration`, `buildFilename`); a smaller set need an actual extraction-with-parameters out of a component/hook closure (`isSettingsValid`, the radios-list dedupe, `buildLogContent`, `App.tsx`'s three label helpers and its backend-URL resolution, `PhoneLayout`'s `movePhonePanel`). All are mechanical — no behavior change, just making existing logic reachable from a test.
- Zero new test infrastructure — reuses the existing `vitest.config.ts` (jsdom default, `@vitest-environment node` override) and the co-located `*.test.ts` convention already established

## Verification — done

- `npm run test` passes with all new files included
- `npm run lint` passes (the refactors must not change any call-site behavior)
- Spot-check that extracted/exported functions are actually called from their original call sites unchanged (no accidental behavior drift), by re-running `npm run test:e2e` (the existing VfoPanel/SpectrumHamlibPanel specs exercise several of the modules being touched — `rigComm.ts`, `App.tsx` indirectly — as a regression check)

---

# Tier 2 — Hook-Level Tests via Stub Socket (implemented, `c65a463`)

## Scope

Four hooks with real, non-trivial logic driven by Socket.io events (and in one case a raw `WebSocket`), tested the same way `src/hooks/useSpectrum.test.ts` already does: a minimal `StubSocket` class (`on`/`off`/`emit` only — no real network), `renderHook`/`act` from `@testing-library/react`, drive events in, assert on the hook's returned state. Zero new test infrastructure.

`useAuth.ts` and `useDiagnostics.ts` needed no source changes — every code path was already exercised through the hook's public return value. `useWsjtxBridge.ts` needed one small export (`handleCommand`, was module-private). `usePotaSpots.tsx` was a different shape of problem — see its own section below; the decision it called for was made and implemented (extract-and-test `inferTuneMode` only, leave the three filter pipelines untested).

## `useAuth.ts` — new `src/hooks/useAuth.test.ts` (extends the existing pure-helper test file)

The state machine (`authState`: `unknown`/`authenticated`/`unauthenticated`/`must-change-password`) is fully driven by five socket events plus a `connect` handler, and three callbacks (`login`, `logout`, `onPasswordChanged`). Verified against the current source (`src/hooks/useAuth.ts:27-174`):

| Behavior | Test case |
|---|---|
| Initial state | `authState: 'unknown'`, `currentUser: null`, `mustChangePassword: false`, `loginError: ''`, `retryAfter: 0` |
| `auth:required` | → `authState: 'unauthenticated'`, `currentUser: null` |
| `auth:token-refreshed`, `mustChangePassword: true` | → stores `auth-token` in localStorage, sets `currentUser` (when `callsign`/`role` present), `mustChangePassword: true`, `authState: 'must-change-password'` |
| `auth:token-refreshed`, `mustChangePassword` false/absent | → `authState: 'authenticated'` |
| `auth:token-refreshed` without `callsign`/`role` | → `currentUser` stays `null`, but `authState` still transitions |
| `auth:result` `{ok:true, ...}` with `mustChangePassword` | → same transitions as above, plus clears `loginError`/`retryAfter` to `''`/`0` |
| `auth:result` `{ok:false, error, retryAfter}` | → `loginError` set to `error` (or `'Login failed'` if `error` omitted), `retryAfter` set |
| `auth:kicked` | → removes `auth-token` from localStorage, `authState: 'unauthenticated'`, `currentUser: null`, `mustChangePassword: false` |
| `connect` (first time) | → no state change (guarded by an internal `firstConnect` flag — this is the initial mount's own connect, not a reconnect) |
| `connect` (subsequent — i.e. a reconnect) | → resets `authState: 'unknown'`, `currentUser: null`, *regardless* of what state preceded it. Test: drive to `'authenticated'` via `auth:token-refreshed` first, then emit `connect` again |
| `login(callsign, password)` | → emits `auth:login` with `{callsign, password}`; clears `loginError` first |
| `logout()` | → emits `auth:logout`, removes `auth-token`, resets to `unauthenticated`/`null`/`false` |
| `onPasswordChanged()` | → `mustChangePassword: false`, `authState: 'authenticated'` |

**Not in scope for this pass:** `auth:preferences-cleared` — its handler calls `window.location.reload()`, which jsdom doesn't implement by default (throws unless stubbed). Testable with `Object.defineProperty(window, 'location', { value: { reload: vi.fn() }, writable: true })`, but it's a real navigation side effect rather than state-machine logic — worth a follow-up if this handler's behavior needs to change, not essential to prove the state machine works.

## `useDiagnostics.ts` — new `src/hooks/useDiagnostics.test.ts`

Client-side mirror of `server/diagnostics.ts` (already covered in Tier 1) — same rolling-window prune logic, this time triggered by a `setInterval(pruneOld, 30_000)` rather than on every push. Verified against `src/hooks/useDiagnostics.ts:25-103`.

| Behavior | Test case |
|---|---|
| Initial state | `logs: []`, `flags`: all 8 keys `false` |
| `diagnostics-log` event | → appends lines to `logs`, capped at `MAX_LOGS = 5000` |
| `diagnostics-log-snapshot` event | → *replaces* `logs` entirely (not appended), also capped at 5000 |
| `debug-flags` event | → `flags` set exactly to the received object |
| `requestSnapshot()` | → emits `get-diagnostics-log` |
| `toggleFlag(key)` | → emits `set-debug-flag` with `{ key, value: !flags[key] }` |
| `enableAll()` | → emits `set-debug-flag` with `value: true` for every currently-`false` flag; does **not** re-emit for flags already `true` |
| `clearView()` | → resets `logs` to `[]` |
| 30s-interval pruning | → push a log line, advance fake time past `MAX_AGE_MS` (10 min) *and* at least one 30s interval tick, assert the line is gone. Needs `vi.useFakeTimers()` + `act(() => vi.advanceTimersByTime(...))` since the prune fires inside a `setInterval` callback that calls `setLogs` |

**Gotcha:** `logEndRef.current` stays `null` under `renderHook` (no real DOM attachment), so the `scrollIntoView` effect's null-guard skips harmlessly — no mocking needed there, same as the existing pattern already relies on implicitly.

## `useWsjtxBridge.ts` — new `src/hooks/useWsjtxBridge.test.ts`

**One small export needed:** `handleCommand(ws, socket, msg)` (`src/hooks/useWsjtxBridge.ts:177`) is currently module-private. Add `export` — no behavior change, same class of refactor as Tier 1's `readCollapsed`/`ts()`.

This function is the WSJTX→app command translator; the rest of the hook (WebSocket connect/reconnect lifecycle, `localStorage` persistence) is integration-shaped and not a good unit-test target — `handleCommand` alone is where the real per-command logic lives. Verified against `src/hooks/useWsjtxBridge.ts:177-259`:

| `cmd` | Test case |
|---|---|
| `set-frequency` | emits `set-frequency` with `String(args)`; `sendResult(true)` |
| `set-mode`, valid `{mode, bandwidth}` | emits `set-mode` with `{mode, bandwidth}`; bandwidth defaults to `"-1"` when falsy/omitted |
| `set-mode`, invalid (not an object, or no `mode`) | `sendResult(false, "invalid args")`; no `set-mode` emit |
| `set-ptt` | `args` coerced via `Number(args) > 0` — test `1`→true, `0`→false, `"1"` (string)→true; emits `set-ptt` with the coerced boolean; `sendResult(true)` fires immediately regardless (documented fire-and-forget behavior, see CLAUDE.md's WSJTX known-issues note) |
| `set-vfo` | emits `set-vfo` with `String(args)` |
| `set-split-vfo`, valid `{split, vfo}` | emits `set-split-vfo` with `{split: args.split ? 1 : 0, txVFO: args.vfo \|\| "VFOB"}` — test `vfo` omitted → defaults to `"VFOB"`, `split` truthy/falsy → `1`/`0` |
| `set-split-vfo`, invalid (not an object) | `sendResult(false, "invalid args")` |
| `send-raw` | emits `send-raw` with `String(args)` |
| unknown command | `sendResult(false, "unknown command")`; no socket emit |
| `sendResult`'s own gating | when the fake `ws.readyState !== WebSocket.OPEN`, `ws.send` is **not** called even though `sendResult` still runs |

Fake `ws` is a plain object (`{ readyState: WebSocket.OPEN, send: vi.fn() }`) — confirmed jsdom exposes a real global `WebSocket.OPEN === 1`, so this needs no additional stubbing.

## `usePotaSpots.tsx` — extract and test `inferTuneMode` only

The dedupe/filter/sort/pin pipelines (repeated three times nearly verbatim for POTA/SOTA/WWFF) are **not reachable from the hook's public API** — `potaSpots`/`sotaSpots`/`wwffSpots` are only ever populated by a real `fetch()` inside a `useEffect`, with no exposed setter, and the three copies differ enough in timestamp handling and field names (POTA/WWFF need a `+'Z'`-suffix or `*1000` scaling hack SOTA doesn't) that unifying them would be a real production-code refactor, not a mechanical extraction. **Decision: leave the three filter pipelines untested this pass**, revisited only when one of the three spot panels is touched for other reasons — consistent with adding coverage incrementally rather than force-fitting a bigger refactor into a test-coverage pass.

The one piece that **is** identical across all three and cheap to extract: the tune-to-spot mode inference inside `handleTuneToSpot`/`handleTuneToSotaSpot`/`handleTuneToWwffSpot` (`src/hooks/usePotaSpots.tsx:424-487`) — each does the exact same SSB→USB/LSB, CW→CW/CWR, FT8/FT4→PKTUSB/USB mapping, differing only in how each spot type's frequency field gets converted to MHz beforehand. Extract into:

```ts
export function inferTuneMode(mode: string, freqMhz: number, availableModes: string[]): string {
  if (mode === 'SSB') return freqMhz >= 10 ? 'USB' : 'LSB';
  if (mode === 'CW') return freqMhz >= 10 ? 'CW' : 'CWR';
  if (mode === 'FT8' || mode === 'FT4') return availableModes.includes('PKTUSB') ? 'PKTUSB' : 'USB';
  return mode;
}
```

Each of the three handlers keeps computing its own `freqMhz` (already-correct per-spot-type logic) and calls `inferTuneMode(spot.mode, freqMhz, availableModes)` in place of its inlined `if` chain — no behavior change.

New `src/hooks/usePotaSpots.test.ts`:

| Test case |
|---|
| `SSB` at/above 10 MHz → `USB`; below 10 MHz → `LSB` (boundary: exactly 10 MHz → `USB`) |
| `CW` at/above 10 MHz → `CW`; below 10 MHz → `CWR` |
| `FT8`/`FT4` with `PKTUSB` in `availableModes` → `PKTUSB` |
| `FT8`/`FT4` without `PKTUSB` in `availableModes` → `USB` |
| Any other mode (e.g. already-native `USB`, or `RTTY`) → passed through unchanged |

## Verification (Tier 2) — done

- `npm run test` passes with all new files
- `npm run lint` passes (source changes: the `handleCommand` export in `useWsjtxBridge.ts`, plus the `inferTuneMode` extraction in `usePotaSpots.tsx` and its three call sites)
- `npm run test:e2e` re-run as a regression check (none of the touched files are on the VfoPanel/SpectrumHamlibPanel e2e paths, but cheap to confirm)

---

# Tier 3 — E2E Panel Tests via Dummy rigctld (implemented, 2026-07-17)

## Scope

Five new Playwright specs extending the `vfo-panel.spec.ts` pattern against a real Dummy rigctld: `mode-bw-panel.spec.ts`, `command-console-panel.spec.ts`, `controls-panel.spec.ts`, `rf-levels-panel.spec.ts`, `compact-meter.spec.ts` (25 e2e tests total, all passing). New shared helper `tests/e2e/connect-helper.ts` (`connectToDummy`/`disconnectFromDummy`) extracts the boilerplate all rig-status specs were duplicating. `data-testid` attributes were added to `ControlsPanel.tsx`, `RfLevelsPanel.tsx`, `ModeBwPanel.tsx`, `CommandConsolePanel.tsx`, and `CompactLayout.tsx`'s inline meter block — attribute-only, no behavior change, same convention as Tier 1's extractions.

## A real bug was found and fixed along the way

Writing `command-console-panel.spec.ts` surfaced a genuine production bug, confirmed live against Hamlib's `dummy.c` source and a running Dummy instance: `useRigControl.ts`'s `handleSendRaw` unconditionally prefixed every raw command with `+\` (the long-form marker). Sending any single-letter short-form command — **`f`, `m`, `v`, `t`, exactly the examples in the console's own placeholder text** — produced `+\f` etc., which rigctld silently fails to resolve (logs `Command '' not found!` server-side, never responds over the socket), hanging the client's 10s command timeout and then destroying the whole rig connection. Fixed by extracting `formatRawCommand()` (`src/hooks/useRigControl.ts`), mirroring the already-tested short/long-form logic in `server/rigComm.ts`'s `formatExtendedCommand()`. Covered by 5 new unit tests in `src/hooks/useRigControl.test.ts`.

## Two mid-implementation discoveries that reshaped test scope

- **`TabbedMeterPanel.tsx` is dead code under the default e2e viewport.** It's only mounted by `PhoneLayout`; `CompactLayout.tsx` (what every desktop-viewport e2e spec actually renders) has its own separate, hand-duplicated inline meter block (`case 'smeter':`) with a 4th tab (VDD) that `TabbedMeterPanel.tsx` lacks. `compact-meter.spec.ts` targets the real inline block instead. The duplication itself is unaddressed tech debt, not fixed here.
- **Dummy's `level_gran` table is degenerate for NB and NR.** Hamlib's `dummy.c` only defines a real step for `CWPITCH` — confirmed live via `\dump_caps`: `NB(0.000000..0.000000/0.000000)`, `NR(0.000000..0.000000/0.000000)`. `RfLevelsPanel.tsx` binds its DNR/NB sliders' `min`/`max`/`step` directly to this capability range, so against Dummy specifically both sliders are stuck at 0 (DNR's label even renders "Lvl NaN": `Math.round((0-0)/0)`). This is a Dummy-only simulator artifact — the underlying rig level itself is genuinely settable (confirmed via raw `L NB 0.35`/`l NB` round trip) — not a production bug worth changing, since real radios report real `level_gran`. `rf-levels-panel.spec.ts` asserts presence/enabled state for these two sliders only, not a value round trip.

## Verification (Tier 3) — done

- `npm run lint` — clean
- `npm run test` — 188/188 (183 existing + 5 new for `formatRawCommand`)
- `npm run test:e2e` — 25/25, including `vfo-panel.spec.ts` and `spectrum-hamlib-panel.spec.ts` as a regression check on the `data-testid`-touched files

## Deferred at the time (now further split into Tier 4 batches — see below)

- `TabbedMeterPanel.tsx`/`PhoneLayout`'s meter display — untested (see discovery above); would need a phone-width viewport project, not currently configured
- The CompactLayout/TabbedMeterPanel inline-duplication tech debt itself — deduplicating them is a real refactor, out of scope for a test-coverage pass

---

# Tier 4, Batch A — Spots, MufMap, CW Keyer, WSJTX Bridge (implemented, 2026-07-17)

## Scope

Tier 4's full backlog (from Tier 3's deferred list) spans 8 areas with very different techniques and risk: `SolarPanel`, `SpotsPanel`/`SpotComboPanel`, `MufMapPanel`, `AudioFeedPanel`, `VideoFeedPanel`, auth/admin flows, the CW keyer, the CW decoder, and the WSJTX bridge. Research (3 parallel investigations) found 4 of these had no open technical risk and could reuse existing patterns almost entirely — this batch covers those four. The rest are deferred (see below), each for a specific, now-understood reason rather than just "not gotten to yet."

New specs: `tests/e2e/spot-combo-panel.spec.ts` (5 tests), `tests/e2e/muf-map-panel.spec.ts` (4 tests), `tests/e2e/cw-keyer.spec.ts` (1 test), `tests/e2e/wsjtx-bridge.spec.ts` (3 tests) — 13 new e2e tests, all passing. New unit test `server/cw.test.ts` (5 tests, `cwTick`'s iambic FSM under fake timers). New fixtures: `tests/fixtures/wsjtx-bridge.ts` (spawns the real committed `bin/linux/wsjtx-bridge` binary, mirrors `rigctld-dummy.ts`'s shape, own `wsjtx-bridge.test.ts`) and `tests/fixtures/synthetic-wsjtx-client.ts` (a fake WSJT-X TCP client, mirrors `synthetic-udp.ts`'s role). Zero production source changes were needed for Spots/MufMap/CW-keyer; the WSJTX bridge work is entirely new test infrastructure, no production changes either.

## Four things discovered empirically that don't match a surface reading of the code

- **The app's default VFO A/B display frequencies (14.074/7.074 MHz) are real 20m/40m FT8 calling frequencies, not arbitrary placeholders** — a WWFF spot fixture picked at 7.074 MHz collided with `usePotaSpots.tsx`'s "spot matches current frequency" pinning logic, silently duplicating the row. Not a bug; just needed a fixture frequency that doesn't coincide with either default.
- **`MufMapPanel` is collapsed by default** (`isCompactMufMapCollapsed` defaults to `true`, `usePanelState.ts`) — its `<img>` isn't in the DOM at all until expanded (`PanelChrome` only renders children when `!isCollapsed`), the same class of issue Tier 3 hit with `CommandConsolePanel` not being in the default layout at all.
- **The CW keyer's real PTT state can't be observed via the normal poll while a key is held.** `server/rigComm.ts`'s poll loop checks `ctx.cwIsKeying` and, while true, skips `pollRig()` entirely (rescheduling itself every 200ms without polling) to avoid queue contention with CW's own timing-sensitive commands — `cwIsKeying` stays true for the whole duration a key is down, so `status.ptt` never updates via the normal poll during that window. `cw-keyer.spec.ts` confirms the round trip via a raw console `t` query instead (which isn't gated on `cwIsKeying`), not the `controls-ptt-button`'s CSS class the way `controls-panel.spec.ts`'s user-clicked-PTT test does.
- **`useWsjtxBridge.ts`'s WebSocket side auto-connects on mount and pushes whatever `rigStatus` holds at that instant** — since the bridge's local WS connection completes well before a real `connectToDummy` finishes, its first `rig-status` push carries the app's default display frequency (14.074 MHz), not the real rig state. A later effect (`useWsjtxBridge.ts:137-155`) re-pushes on every `rigStatus` field change, so `wsjtx-bridge.spec.ts`'s GET-round-trip test waits for the real frequency to land in the UI before querying — exactly the sequencing a real WSJT-X session would see once the operator's rig is actually connected.

Also found and fixed a real bug in the *test fixture itself* (not production code): `SyntheticWsjtxClient`'s original line-buffering silently dropped every line after the first one when a multi-line response (e.g. `dump_state`'s ~30 lines) arrived in a single TCP chunk, since there was no buffer for lines that arrive before a matching `readLine()` call claims them. Fixed by queuing unclaimed lines instead of discarding them.

## Verification (Tier 4, Batch A) — done

- `npm run lint` — clean
- `npm run test` — 193/193 (188 existing + 5 new for `cwTick`)
- `npm run test:fixtures` — 6/6 (3 existing + 3 new for `startWsjtxBridge`)
- `npm run test:e2e` — 38/38 (25 existing + 13 new), re-run twice to confirm the WSJTX bridge spec's sequencing fix wasn't a one-off pass

## Deferred (Tier 4, remaining — not in this pass, each for a specific reason)

- **`SolarPanel`** — its fetches (`hamqsl.com`, `prop.kc2g.com/api/essn.json`) happen server-side inside the Node process, not the browser — `page.route()` can't see them at all. Needs a new source-level env-var injection point (`server/solar.ts` has no override today, unlike `RCW_DATA_DIR`/`RCW_PORT`) plus a new fixed-port local stub HTTP server fixture, since the single shared `webServer` process's env is fixed at config-load time (can't point it at a per-spec ephemeral port the way the Dummy-rigctld fixture does).
- **Auth/admin flows** — feasible with no open technical risk, but a large scope of its own: research found 13 genuinely-untested candidate cases (login failure/lockout, voluntary logout, admin user CRUD, the real `auth:kicked` trigger conditions, session-resume-via-stored-token, self-protection guards). Must operate on throwaway regular users, never the shared `ADMIN` fixture every other spec's `storageState` depends on.
- **CW decoder** — feasible (GGMorse's `_ggmorse_*` functions are callable directly via `page.evaluate()`, bypassing the real audio path entirely) but needs a new WASM test harness and has real tuning risk: getting synthesized PCM Morse tone bursts to reliably satisfy GGMorse's pitch/speed auto-detection will likely take real trial-and-error.
- **VideoFeedPanel** — feasible (`page.addInitScript` to stub `window.electron` plus Playwright's fake-video-capture flag gets a genuine `VideoEncoder` run in stock Chromium, no hand-built H.264 needed) but not attempted this pass.
- **AudioFeedPanel** — partial/open. The Opus encode/decode path itself is confirmed hardware-free, but the full `naudiodon`-backed loopback's behavior in a truly hardware-less environment (vs. this real-hardware dev sandbox) is unverified — needs a short spike (ALSA `null` PCM or `snd-aloop`) before committing real time to it.
- `TabbedMeterPanel.tsx`/`PhoneLayout`'s meter display and the CompactLayout/TabbedMeterPanel dedup tech debt — carried over from Tier 3, unchanged.
