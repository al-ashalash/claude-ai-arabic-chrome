// gen-shot.mjs — يركّب لقطةً (بأي مقاس) على لوحة متجر Chrome 1280×800 مع سطرٍ عربي كبير
// يشرحها، بكروم بلا واجهة — فالمتجر يرفض أي لقطةٍ لا تكون 1280×800 أو 640×400 بالضبط.
//   node gen-shot.mjs --in=<لقطة.png> --caption="الواجهة معرَّبة" [--out=<اسم.png>] [--sub="سطر أصغر"]
//   [--bare]   → اللقطة وحدها ممدودة على اللوحة كلها بلا شريط عنوان (للقطاتٍ ملتقطة أصلًا 1280×800)
//   [--zoom=2] → تكبير اللقطات الصغيرة (نافذة الإضافة مثلًا) حتى تملأ الإطار؛ الافتراضي 1
// المخرج في code/docs/store-assets/ (خاص، لا يُنشر).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { CODE } from "./paths.mjs";

const arg = (k) => { const a = process.argv.find((x) => x.startsWith("--" + k + "=")); return a ? a.slice(k.length + 3) : ""; };
const input = arg("in"), caption = arg("caption"), sub = arg("sub"), bare = process.argv.includes("--bare");
const zoom = Math.max(1, Math.min(4, Number(arg("zoom")) || 1));
if (!input || (!caption && !bare)) { console.error("الاستعمال: node gen-shot.mjs --in=<png> --caption=\"…\" [--sub=\"…\"] [--out=…] [--bare]"); process.exit(2); }
const src = path.resolve(input);
if (!fs.existsSync(src)) { console.error("✗ لا لقطة في " + src); process.exit(1); }

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

const dir = path.join(CODE, "docs", "store-assets");
fs.mkdirSync(dir, { recursive: true });
const out = path.resolve(arg("out") || path.join(dir, path.basename(src, path.extname(src)) + "-1280x800.png"));
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
// الصورة تُضمَّن كـdata: كي لا يمنعها كروم بلا واجهة عبر file:// من داخل ملف مؤقّت
const dataUrl = "data:image/" + (path.extname(src).slice(1) === "jpg" ? "jpeg" : path.extname(src).slice(1)) + ";base64," + fs.readFileSync(src).toString("base64");
const html = bare ? `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:1280px;height:800px;overflow:hidden;background:#D97757}
img{width:1280px;height:800px;object-fit:cover;display:block}</style><img src="${dataUrl}">`
: `<!doctype html><html lang="ar"><meta charset="utf-8"><style>
html,body{margin:0;width:1280px;height:800px;overflow:hidden}
body{background:#D97757;font-family:"Dubai","Segoe UI","Tahoma","Noto Naskh Arabic",sans-serif;color:#fff;position:relative}
.cap{position:absolute;top:0;left:0;width:1280px;height:118px;display:flex;flex-direction:column;justify-content:center;align-items:center;direction:rtl;text-align:center}
.cap h1{margin:0;font-size:44px;font-weight:700;line-height:1.2}
.cap p{margin:6px 0 0;font-size:20px;opacity:.92}
.frame{position:absolute;top:118px;left:0;width:1280px;height:682px;display:flex;align-items:flex-start;justify-content:center}
.frame img{max-width:1200px;max-height:660px;border-radius:14px 14px 0 0;box-shadow:0 10px 30px rgba(0,0,0,.25);display:block}
</style><body><div class="cap"><h1>${esc(caption)}</h1>${sub ? "<p>" + esc(sub) + "</p>" : ""}</div><div class="frame"><img id="s" src="${dataUrl}"></div>
<script>const i=document.getElementById("s");i.onload=()=>{i.style.width=Math.min(1200,i.naturalWidth*${zoom})+"px";i.style.height="auto";};</script></body></html>`;
const tmpDir = fs.mkdtempSync(path.join(process.env.TEMP || "/tmp", "cml-shot-"));
const page = path.join(tmpDir, "shot.html");
fs.writeFileSync(page, html, "utf8");
execFileSync(chrome, [
  "--headless=new", `--user-data-dir=${path.join(tmpDir, "udd")}`, "--no-first-run", "--hide-scrollbars",
  "--force-device-scale-factor=1", "--window-size=1280,800", `--screenshot=${out}`,
  "file:///" + page.split(path.sep).join("/"),
], { stdio: "ignore", timeout: 90000 });
fs.rmSync(tmpDir, { recursive: true, force: true });
const b = fs.readFileSync(out);
const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
if (w !== 1280 || h !== 800) { console.error(`✗ الأبعاد ${w}×${h} لا 1280×800`); process.exit(1); }
console.log(`✓ ${path.relative(CODE, out)} — 1280×800، ${(b.length / 1024).toFixed(0)} KB`);
