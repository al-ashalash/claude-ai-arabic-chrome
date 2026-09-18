// make-store-zip.mjs — حزمةُ متجر Chrome: ملفُ ZIP لمحتويات user/extension **نفسها** (لا للمجلد
// الحاوي — المتجر يطلب manifest.json في جذر الأرشيف)، بعد بوابة verify-package وبتسمية الإصدار.
//   node make-store-zip.mjs            → web/dist/claude-arabic-<version>.zip
// لا يُنشر شيءٌ من هنا؛ الرفع إلى لوحة المطوّرين يدويٌّ بقرار المالك.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT, EXT } from "./paths.mjs";

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
execFileSync(process.execPath, [path.join(here, "verify-package.mjs")], { stdio: "inherit" });

const manifest = JSON.parse(fs.readFileSync(path.join(EXT, "manifest.json"), "utf8"));
const FORBIDDEN = [/\.pem$/i, /\.crx$/i, /\.map$/i, /^\./, /HANDOFF/i, /_خاص/, /test/i];
const bad = fs.readdirSync(EXT).filter((f) => FORBIDDEN.some((re) => re.test(f)));
if (bad.length) { console.error("✗ ملفات لا تُحزَم في مجلد الإضافة:", bad.join(", ")); process.exit(1); }

const dist = path.join(ROOT, "dist");
fs.mkdirSync(dist, { recursive: true });
const out = path.join(dist, `claude-arabic-${manifest.version}.zip`);
fs.rmSync(out, { force: true });
// bsdtar (مضمَّن في ويندوز 10+ وmacOS وأغلب لينكس) يكتب ZIP بامتداد الاسم عبر ‎-a‎؛
// والمسار ‎-C EXT .‎ يجعل manifest.json في الجذر لا داخل مجلد. على ويندوز يُسمّى بمساره
// الكامل لأن tar الذي في PATH قد يكون tar جِت (GNU) فيقرأ ‎C:‎ اسمَ مضيف
const TAR = process.platform === "win32" ? path.join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe") : "tar";
// الأسماء صريحةً لا «.» — كي تخلو مداخلُ الأرشيف من سابقة ‎./‎
execFileSync(TAR, ["-a", "-cf", out, "-C", EXT, ...fs.readdirSync(EXT)], { stdio: "inherit" });
const listing = execFileSync(TAR, ["-tf", out], { encoding: "utf8" }).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
if (!listing.includes("manifest.json")) { console.error("✗ manifest.json ليس في جذر الأرشيف"); process.exit(1); }
const size = fs.statSync(out).size;
console.log(`✓ ${path.relative(ROOT, out)} — ${(size / 1024).toFixed(0)} KB، ${listing.filter((s) => !s.endsWith("/")).length} ملفًا، الإصدار ${manifest.version}`);
