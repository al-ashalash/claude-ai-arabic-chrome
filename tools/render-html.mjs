// render-html.mjs — يصيّر صفحة HTML محلية إلى PNG بمقاسٍ محدد بكروم بلا واجهة (لمواد الإعلان
// والمتجر: بطاقات التواصل الاجتماعي وغيرها). لا علاقة له بالإضافة نفسها.
//   node render-html.mjs --in=<page.html> --out=<out.png> --size=1640x2048 [--scale=1] [--chrome=…]
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const arg = (k) => { const a = process.argv.find((x) => x.startsWith("--" + k + "=")); return a ? a.slice(k.length + 3) : ""; };
const input = arg("in"), out = arg("out"), size = arg("size") || "1640x2048", scale = Number(arg("scale")) || 1;
if (!input || !out) { console.error("الاستعمال: node render-html.mjs --in=page.html --out=out.png --size=WxH"); process.exit(2); }
const [W, H] = size.split("x").map(Number);
const src = path.resolve(input);
if (!fs.existsSync(src)) { console.error("✗ لا صفحة في " + src); process.exit(1); }

const explicit = arg("chrome") || process.env.CHROME;
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

const outAbs = path.resolve(out);
fs.mkdirSync(path.dirname(outAbs), { recursive: true });
const udd = fs.mkdtempSync(path.join(process.env.TEMP || "/tmp", "cml-render-"));
execFileSync(chrome, [
  "--headless=new", `--user-data-dir=${udd}`, "--no-first-run", "--hide-scrollbars", "--allow-file-access-from-files",
  `--force-device-scale-factor=${scale}`, `--window-size=${W},${H}`, "--virtual-time-budget=5000", `--screenshot=${outAbs}`,
  "file:///" + src.split(path.sep).join("/"),
], { stdio: "ignore", timeout: 120000 });
fs.rmSync(udd, { recursive: true, force: true });
const b = fs.readFileSync(outAbs);
const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
if (w !== W * scale || h !== H * scale) { console.error(`✗ الأبعاد ${w}×${h} لا ${W * scale}×${H * scale}`); process.exit(1); }
console.log(`✓ ${out} — ${w}×${h}، ${(b.length / 1024).toFixed(0)} KB`);
