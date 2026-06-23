import { execSync } from "child_process";
import { platform } from "os";

const pl = platform();

if (pl === "linux") {
  console.log("Building wsjtx-bridge for Linux...");
  execSync("gcc -O2 -o bin/linux/wsjtx-bridge wsjtx-bridge.c", { stdio: "inherit" });
  execSync("chmod +x bin/linux/wsjtx-bridge", { stdio: "inherit" });
} else if (pl === "darwin") {
  console.log("Building wsjtx-bridge for macOS...");
  execSync("clang -O2 -o bin/mac/wsjtx-bridge wsjtx-bridge.c", { stdio: "inherit" });
  execSync("chmod +x bin/mac/wsjtx-bridge", { stdio: "inherit" });
} else if (pl === "win32") {
  console.log("Building wsjtx-bridge for Windows...");
  execSync("cl wsjtx-bridge.c /Fe:bin\\windows\\wsjtx-bridge.exe /O2 /nologo ws2_32.lib advapi32.lib", { stdio: "inherit" });
} else {
  console.error(`Unsupported platform: ${pl}`);
  process.exit(1);
}

console.log("Done.");
