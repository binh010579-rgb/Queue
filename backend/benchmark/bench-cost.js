"use strict";
// Do chi phi giao tiep Backend <-> Engine:
//  (1) Engine thuong truc, gui lenh qua pipe  vs  (2) goi chuong trinh moi cho moi request.
// Chay (trong thu muc backend/): node benchmark/bench-cost.js   (can da bien dich queue_engine truoc, vi du bang chay-thu.bat)
const path = require("path");
const { spawn } = require("child_process");
const { QueueEngineClient } = require("../src/queueEngineClient");

const exe = path.join(__dirname, "..", "..", "queue-engine", process.platform === "win32" ? "queue_engine.exe" : "queue_engine");
const quiet = { log() {}, error() {}, warn() {} };
const ms = (t0) => Number(process.hrtime.bigint() - t0) / 1e6;

function spawnOnce(commands) {
  return new Promise((resolve, reject) => {
    const p = spawn(exe, [], { stdio: ["pipe", "pipe", "inherit"] });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.on("error", reject);
    p.on("close", () => resolve(out));
    p.stdin.end(commands.join("\n") + "\n");
  });
}

(async () => {
  const N = 5000;   // so cap ENQ+DEQ qua tien trinh thuong truc
  const M = 200;    // so lan goi tien trinh moi

  const e = new QueueEngineClient({ enginePath: exe, getPendingIds: async () => [], logger: quiet });
  await e.start();
  for (let i = 1; i <= 200; i++) await e.enqueue(i); // khoi dong nong
  for (let i = 1; i <= 200; i++) await e.dequeue();

  let t = process.hrtime.bigint();
  for (let i = 1; i <= N; i++) { await e.enqueue(i); await e.dequeue(); }
  const tPersist = ms(t);
  await e.stop();

  t = process.hrtime.bigint();
  for (let i = 1; i <= M; i++) await spawnOnce(["ENQ " + i, "DEQ"]);
  const tSpawn = ms(t);

  const perPersist = tPersist / (2 * N);      // ms moi lenh
  const perSpawn = tSpawn / M;                // ms moi request (1 request = 1 tien trinh moi)
  console.log("Tien trinh thuong truc : " + (2 * N) + " lenh trong " + tPersist.toFixed(0) + " ms  -> " + perPersist.toFixed(4) + " ms/lenh");
  console.log("Goi tien trinh moi     : " + M + " request trong " + tSpawn.toFixed(0) + " ms  -> " + perSpawn.toFixed(2) + " ms/request");
  console.log("Ti le (moi request / moi lenh) ~ " + (perSpawn / perPersist).toFixed(0) + " lan");
})().catch((err) => { console.error(err); process.exit(1); });
