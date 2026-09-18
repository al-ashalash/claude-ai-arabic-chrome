// gen-promo.mjs — يلتقط صورة العرض الصغيرة لمتجر Chrome (440×280) من
// code/docs/store-assets/promo-440x280.html بكروم بلا واجهة على المقاس نفسه بالضبط.
//   node gen-promo.mjs [--chrome=<مسار>]     → code/docs/store-assets/promo-440x280.png
// مجلد store-assets خاصٌّ (لا يُنشر): مادة المتجر لا مادة المستودع.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { CODE } from "./paths.mjs";

const chromeArg = process.argv.find((a) => a.startsWith("--chrome="));
const explicit = (chromeArg && chromeArg.slice(9)) || process.env.CHROME;
const CANDIDATES = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  (process.env.LOCALAPPDATA || "") + "/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
];
const chrome = explicit || CANDIDATES.find((p) => fs.existsSync(p));
if (!chrome || !fs.existsSync(chrome)) { console.error("! لم أجد كروم. مرّر --chrome=… أو CHROME."); process.exit(1); }

const dir = path.join(CODE, "docs", "store-assets");
const html = path.join(dir, "promo-440x280.html");
const out = path.join(dir, "promo-440x280.png");
const udd = fs.mkdtempSync(path.join(process.env.TEMP || "/tmp", "cml-promo-"));
execFileSync(chrome, [
  "--headless=new", `--user-data-dir=${udd}`, "--no-first-run", "--hide-scrollbars",
  "--force-device-scale-factor=1", "--window-size=440,280", `--screenshot=${out}`,
  "file:///" + html.split(path.sep).join("/"),
], { stdio: "ignore", timeout: 60000 });
fs.rmSync(udd, { recursive: true, force: true });
const b = fs.readFileSync(out);
const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
if (w !== 440 || h !== 280) { console.error(`✗ الأبعاد ${w}×${h} لا 440×280`); process.exit(1); }
console.log(`✓ ${path.relative(CODE, out)} — 440×280، ${(b.length / 1024).toFixed(0)} KB`);
