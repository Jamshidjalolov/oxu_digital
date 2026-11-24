const path = require("node:path");
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const { createRequire } = require("node:module");
const net = require("node:net");
const root = path.resolve(__dirname, "..");
const serverRequire = createRequire(path.join(root, "oxu-server/package.json"));
const args = new Set(process.argv.slice(2));
const children = [];
let mongo;
let stopping = false;

function launch(label, project, entry, extra = [], env = {}) {
  const child = spawn(process.execPath, [entry, ...extra], {
    cwd: path.join(root, project),
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  children.push(child);
  for (const stream of [child.stdout, child.stderr])
    stream.on("data", (chunk) => process.stdout.write(`[${label}] ${chunk}`));
  child.on("error", (err) => {
    console.error(`[${label}] ${err.message}`);
    shutdown(1);
  });
  child.on("exit", (code) => {
    if (!stopping) {
      console.error(`[${label}] stopped (${code}).`);
      shutdown(code || 1);
    }
  });
  return child;
}

async function assertPortFree(port) {
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", () =>
      reject(
        new Error(`Port ${port} band. Shu portdagi eski serverni to‘xtating.`),
      ),
    );
    probe.listen(port, "0.0.0.0", () => probe.close(resolve));
  });
}

async function waitForApi() {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline && !stopping) {
    try {
      const response = await fetch("http://127.0.0.1:5000/api/health", {
        signal: AbortSignal.timeout(1500),
      });
      if (response.ok && (await response.json()).service === "oxu-server")
        return;
    } catch {
      /* Wait for the database and API. */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    "API tayyor bo‘lmadi. MongoDB sozlamalarini tekshiring yoki npm run demo ishlating.",
  );
}

async function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  await Promise.all(
    children.map((child) =>
      child.exitCode !== null
        ? Promise.resolve()
        : new Promise((resolve) => {
            child.once("exit", resolve);
            setTimeout(() => {
              child.kill("SIGKILL");
              resolve();
            }, 4000).unref();
          }),
    ),
  );
  if (mongo) await mongo.stop();
  process.exit(code);
}
process.once("SIGINT", () => shutdown());
process.once("SIGTERM", () => shutdown());

async function main() {
  for (const project of [
    "oxu-server",
    "oxu-web",
    ...(args.has("--mobile") ? ["oxu-mobile"] : []),
    ...(args.has("--bot") ? ["oxu-bot"] : []),
  ]) {
    if (!fs.existsSync(path.join(root, project, "node_modules")))
      throw new Error(`${project}: dependencies missing. Run npm run setup.`);
  }
  await assertPortFree(5000);
  await assertPortFree(5173);
  if (args.has("--mobile")) await assertPortFree(8081);
  const env = { PORT: "5000" };
  env.ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || ['http://localhost:5173','http://localhost:8081',...Object.values(require('node:os').networkInterfaces()).flat().filter(a=>a&&a.family==='IPv4'&&!a.internal).flatMap(a=>[`http://${a.address}:5173`,`http://${a.address}:8081`])].join(',');
  if (args.has("--demo")) {
    const dbPath = path.join(root, ".local-data", "mongo");
    fs.mkdirSync(dbPath, { recursive: true });
    const { MongoMemoryServer } = serverRequire("mongodb-memory-server");
    const downloadDir = path.join(
      root,
      "oxu-server/node_modules/.cache/mongodb-memory-server",
    );
    mongo = await MongoMemoryServer.create({
      binary: { downloadDir },
      instance: { dbPath, storageEngine: "wiredTiger", dbName: "oxu_demo" },
    });
    env.MONGO_URI = mongo.getUri("oxu_demo");
    env.NODE_ENV = "development";
    env.JWT_SECRET = require("node:crypto")
      .createHash("sha256")
      .update(`oxu-local-demo:${root}`)
      .digest("hex");
    const dotenv = serverRequire('dotenv');
    const readEnv = project => { const file = path.join(root, project, '.env'); return fs.existsSync(file) ? dotenv.parse(fs.readFileSync(file)) : {}; };
    const botConfig = readEnv('oxu-bot');
    const serverConfig = readEnv('oxu-server');
    const secretsPath = path.join(root, '.local-data', 'notification-secrets.json');
    let secrets;
    if (fs.existsSync(secretsPath)) secrets = JSON.parse(fs.readFileSync(secretsPath, 'utf8'));
    else { secrets = { ...serverRequire('web-push').generateVAPIDKeys(), botSecret: require('node:crypto').randomBytes(32).toString('hex') }; fs.writeFileSync(secretsPath, JSON.stringify(secrets)); }
    Object.assign(env, {
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || botConfig.BOT_TOKEN || serverConfig.TELEGRAM_BOT_TOKEN || '',
      BOT_LINK_SECRET: process.env.BOT_LINK_SECRET || botConfig.BOT_LINK_SECRET || serverConfig.BOT_LINK_SECRET || secrets.botSecret,
      VAPID_PUBLIC_KEY: serverConfig.VAPID_PUBLIC_KEY || secrets.publicKey,
      VAPID_PRIVATE_KEY: serverConfig.VAPID_PRIVATE_KEY || secrets.privateKey,
      VAPID_SUBJECT: serverConfig.VAPID_SUBJECT || 'mailto:admin@oxu.uz',
      DISABLE_EXTERNAL_DELIVERY: '0',
    });
    process.env.BOT_LINK_SECRET = env.BOT_LINK_SECRET;
    console.log("Demo MongoDB ready. Data is stored in .local-data/mongo.");
  }
  launch("API", "oxu-server", "src/index.js", [], env);
  await waitForApi();
  if (stopping) return;
  launch("WEB", "oxu-web", "node_modules/vite/bin/vite.js", [
    "--host",
    "0.0.0.0",
    "--strictPort",
  ]);
  if (args.has("--mobile"))
    launch(
      "MOBILE",
      "oxu-mobile",
      "node_modules/expo/bin/cli",
      ["start", "--web", "--offline", "--port", "8081", ...(args.has('--clear') ? ['--clear'] : [])],
      {
        BROWSER: "none",
        CI: "false",
        EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL || `http://${process.env.OXU_LAN_HOST || Object.values(require('node:os').networkInterfaces()).flat().find(a => a && a.family === 'IPv4' && !a.internal && /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address))?.address || 'localhost'}:5000/api`,
      },
    );
  if (args.has("--bot")) {
    const botEnvPath = path.join(root, "oxu-bot", ".env");
    const botEnv = fs.existsSync(botEnvPath)
      ? serverRequire("dotenv").parse(fs.readFileSync(botEnvPath))
      : {};
    if (process.env.BOT_TOKEN || botEnv.BOT_TOKEN)
      launch("BOT", "oxu-bot", "src/index.js", [], {
        API_URL: "http://127.0.0.1:5000/api",
      });
    else
      console.log(
        "[BOT] BOT_TOKEN is empty. Add your token to oxu-bot/.env to enable Telegram.",
      );
  }
  console.log("\nWeb: http://localhost:5173");
  if (args.has("--mobile")) console.log("Mobile web: http://localhost:8081");
  console.log("API: http://localhost:5000/api/health");
  if (args.has("--demo"))
    console.log(
      "Demo logins: admin 900000000 | teacher 901000001 | student 931000001 | password 123456 (fresh database).",
    );
  console.log("Ctrl+C stops all services.");
}
main().catch((err) => {
  console.error(err.message);
  shutdown(1);
});
