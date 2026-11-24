const { spawnSync } = require("node:child_process");
const path = require("node:path");
const mode = process.argv[2];
const projects =
  mode === "build"
    ? ["oxu-web"]
    : ["oxu-server", "oxu-web", "oxu-mobile", "oxu-bot"];
if (!["test", "install", "build"].includes(mode))
  throw new Error("Use install, test or build");
for (const project of projects) {
  console.log(`\n[${project}] ${mode}`);
  const args = mode === "build" ? ["run", "build"] : [mode];
  const result = spawnSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    args,
    {
      cwd: path.resolve(__dirname, "..", project),
      stdio: "inherit",
      shell: process.platform === "win32",
    },
  );
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status || 1);
}
