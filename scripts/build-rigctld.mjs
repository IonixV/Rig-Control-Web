import { execSync } from "child_process";
import { existsSync, copyFileSync, chmodSync, mkdirSync, rmSync } from "fs";
import { platform, cpus } from "os";

const pl = platform();

const BINS = {
  linux: "bin/linux/rigctld",
  darwin: "bin/mac/rigctld",
  win32: "bin/windows/rigctld.exe",
};

const binPath = BINS[pl];

if (!binPath) {
  console.error(`[rigctld] Unsupported platform: ${pl}`);
  process.exit(1);
}

if (existsSync(binPath)) {
  console.log(`[rigctld] Binary already exists at ${binPath} — skipping build.`);
  process.exit(0);
}

if (pl === "win32") {
  console.log("[rigctld] Windows rigctld must be built via MSYS2 in CI. Place the binary at bin/windows/rigctld.exe or run the CI workflow.");
  process.exit(0);
}

const jobs = cpus().length;
const srcDir = "hamlib-src";

try {
  if (pl === "linux") {
    console.log("[rigctld] Installing Linux build dependencies...");
    if (existsSync("/usr/bin/apt-get")) {
      execSync("sudo apt-get update -qq && sudo apt-get install -y build-essential autoconf automake libtool pkg-config libglib2.0-dev", { stdio: "inherit" });
    } else if (existsSync("/usr/bin/dnf")) {
      execSync("sudo dnf install -y gcc gcc-c++ make autoconf automake libtool pkgconf-pkg-config glib2-devel", { stdio: "inherit" });
    } else if (existsSync("/usr/bin/yum")) {
      execSync("sudo yum install -y gcc gcc-c++ make autoconf automake libtool pkgconfig glib2-devel", { stdio: "inherit" });
    } else if (existsSync("/usr/bin/pacman")) {
      execSync("sudo pacman -S --noconfirm base-devel autoconf automake libtool pkg-config glib2", { stdio: "inherit" });
    } else {
      console.warn("[rigctld] Unknown package manager — ensure gcc, make, autoconf, automake, libtool, pkg-config, and glib2 dev headers are installed.");
    }
  } else if (pl === "darwin") {
    console.log("[rigctld] Installing macOS build dependencies via Homebrew...");
    execSync("brew install autoconf automake libtool pkg-config glib", { stdio: "inherit" });
  }

  console.log("[rigctld] Cloning Hamlib source (master)...");
  execSync(`git clone --depth=1 https://github.com/Hamlib/Hamlib.git ${srcDir}`, { stdio: "inherit" });

  console.log("[rigctld] Running autoreconf...");
  execSync("autoreconf -fi", { cwd: srcDir, stdio: "inherit" });

  console.log("[rigctld] Configuring...");
  execSync(
    "./configure --disable-shared --enable-static --without-python --without-lua --without-tcl --without-perl --without-cxx-binding",
    { cwd: srcDir, stdio: "inherit" }
  );

  console.log(`[rigctld] Building with ${jobs} parallel jobs...`);
  execSync(`make -j${jobs}`, { cwd: srcDir, stdio: "inherit" });

  const outDir = pl === "linux" ? "bin/linux" : "bin/mac";
  mkdirSync(outDir, { recursive: true });
  copyFileSync(`${srcDir}/src/rigctld`, binPath);
  chmodSync(binPath, 0o755);

  console.log(`[rigctld] Installed to ${binPath}`);
} catch (err) {
  console.error(`[rigctld] Build failed: ${err.message}`);
  process.exit(1);
} finally {
  if (existsSync(srcDir)) {
    rmSync(srcDir, { recursive: true, force: true });
  }
}
