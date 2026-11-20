"use strict";
// Engine GIA dung cho test (chay bang: node fake-engine.js hang|garbage)
// Khi co file co (trong thu muc tam), no se im lang (hang) hoac tra phan hoi la (garbage) o lenh SIZE.
const readline = require("readline");
const fs = require("fs");
const path = require("path");
const os = require("os");

const mode = process.argv[2];
const flag = path.join(os.tmpdir(), `${mode}_flag`);

console.log("READY");
readline.createInterface({ input: process.stdin }).on("line", (raw) => {
  const line = raw.trim();
  if (line === "SIZE" && fs.existsSync(flag)) {
    if (mode === "garbage") console.log("XYZ");
    return; // hang: khong tra loi
  }
  if (line === "CLEAR" || line.startsWith("ENQ")) console.log("OK");
  else if (line === "SIZE") console.log("SIZE 0");
  else console.log("ERR BAD_COMMAND");
});
