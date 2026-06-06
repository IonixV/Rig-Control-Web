import { execSync } from "child_process";
import { platform } from "os";

const pl = platform();

if (pl === "linux") {
  console.log("Building ft4222-scope-reader for Linux...");
  execSync("gcc -O2 -o bin/linux/ft4222-scope-reader ft4222-scope-reader.c -ldl", { stdio: "inherit" });
  execSync("chmod +x bin/linux/ft4222-scope-reader", { stdio: "inherit" });
} else if (pl === "darwin") {
  console.log("Building ft4222-scope-reader for macOS...");
  execSync("clang -O2 -o bin/mac/ft4222-scope-reader ft4222-scope-reader.c", { stdio: "inherit" });
  execSync("chmod +x bin/mac/ft4222-scope-reader", { stdio: "inherit" });
} else if (pl === "win32") {
  console.log("Building ft4222-scope-reader for Windows...");
  execSync("cl ft4222-scope-reader.c /Fe:bin\\windows\\ft4222-scope-reader.exe /O2 /nologo", { stdio: "inherit" });
} else {
  console.error(`Unsupported platform: ${pl}`);
  process.exit(1);
}

console.log("Done.");
