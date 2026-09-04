// make-release.mjs — يبني نسخة النشر النظيفة في مجلد مستقل، جاهزةً لـGitHub وللمتجر.
//
// لماذا نسخة مستقلة لا رفعٌ للمجلد كما هو؟ لأن مجلد العمل يخلط ثلاثة أنواع لا يجوز
// نشرها: مفتاح التوقيع الخاص، ومادة Anthropic خامًا (نصوصها الإنجليزية مفردةً)، وملفات
// عملٍ داخلية فيها تعليمات موجَّهة إلى مساعدٍ برمجي وسجلُّ مناقشاتٍ جرت. فالقاعدة هنا
// **قائمة سماحٍ لا قائمة منع**: لا يُنسخ إلا ما ذُكر صراحةً، فلا يتسرّب جديدٌ بالسهو.
//
//   node code/toolchain/make-release.mjs [<مجلد الوجهة>]
// الافتراضي: ../claude-ai-arabic-chrome بجوار مجلد المشروع.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "../..");          // …/claude-mutarjim/web
const ROOT = path.resolve(WEB, "..");             // …/claude-mutarjim
const OUT = path.resolve(process.argv[2] || path.join(ROOT, "..", "claude-ai-arabic-chrome"));

// ── قائمة السماح ────────────────────────────────────────────────────────────
// [المصدر (نسبةً إلى جذر المشروع), الوجهة (نسبةً إلى مجلد النشر)]
const FILES = [
  ["LICENSE", "LICENSE"],
  ["README.md", "README.md"],
  [".gitignore", ".gitignore"],
  ["web/PRIVACY.md", "PRIVACY.md"],
  ["web/user/dictionaries/ar.json", "dictionaries/ar.json"],
  ["web/code/languages.json", "tools/languages.json"],
  ["web/code/toolchain/icon-render.html", "tools/icon-render.html"], // مصدر الأيقونة
  // الوثيقة الإنجليزية — ملفًا مفردًا عمدًا: مجلد docs كله فيه مواد داخلية
  // (STORE-LISTING) لا تُنشر، وقائمة السماح تنسخ المذكور وحده
  ["web/code/docs/RTL-UPSTREAM.md", "docs/RTL-UPSTREAM.md"],
  // خطوط CI (المرحلة ٥): تعيش في التطوير وتُنسخ إلى موضعها القياسي في النشر
  ["web/code/ci/ci.yml", ".github/workflows/ci.yml"],
  ["web/code/ci/release.yml", ".github/workflows/release.yml"],
];
const DIRS = [
  ["web/user/extension", "extension"],            // الإضافة نفسها
  ["web/code/toolchain", "tools"],                // أدوات البناء
  ["web/code/test", "test"],                      // الاختبارات
];
// استثناءات داخل المجلدات المسموحة
const SKIP_NAMES = new Set(["extension.pem", "extension.crx"]);
// ملاحظة: `test/assets/` **تُنشر**. محتواها ملفات تجريبية اصطناعية من صنع المشروع
// (نصوصها «Zzq…» مخترعة) تحاكي بنية تجزئة claude.ai لإثبات أن الزحف تعاودي — وليست
// مادةً منقولة من الموقع. وبدونها لا يستطيع المساهم تشغيل `_scantest.html`.
const SKIP_DIRS = new Set(["_old-cycle", "node_modules"]);

let copied = 0, skipped = [];
function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  copied++;
}
function copyDir(src, dest) {
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) { skipped.push(path.join(src, e.name)); continue; }
      copyDir(path.join(src, e.name), path.join(dest, e.name));
    } else {
      if (SKIP_NAMES.has(e.name) || e.name.endsWith(".pem") || e.name.endsWith(".crx")) {
        skipped.push(path.join(src, e.name)); continue;
      }
      copyFile(path.join(src, e.name), path.join(dest, e.name));
    }
  }
}

// نُفرِّغ **محتوى** المجلد لا المجلد نفسه: حذف الجذر يفشل بـEPERM متى كان مفتوحًا في
// مستكشف الملفات أو محرِّر أو خادم — وهو الغالب أثناء العمل. وتفريغ المحتوى يكفي.
// و`.git` مستثنًى: المجلد يصير مستودعًا بعد أول رفع، فحذفُه يمحو تاريخه كله.
// ★ (مراجعة الأمن) الإفراغُ لا يقع إلا على وجهةِ نشرٍ مُثبتة: وسيطٌ خاطئ ("." من web/،
// أو ".."، أو مجلدٌ شخصي) كان يمحو بياناتٍ لا رجعة فيها ثم يفشل النسخ لأن المصدر نفسه
// مُحي. الوجهةُ إمّا غيرُ موجودة/فارغة، أو فيها بصمةُ نشرٍ سابق: extension/manifest.json
// باسم إضافتنا نفسِه. وليست الجذرَ ولا أحدَ أسلافه ولا سلفَ مجلد العمل.
{
  const rootAbs = path.resolve(ROOT), cwdAbs = path.resolve(process.cwd());
  const isAncestorOf = (a, b) => b === a || b.startsWith(a + path.sep);
  if (isAncestorOf(OUT, rootAbs) || isAncestorOf(OUT, cwdAbs) || isAncestorOf(rootAbs, OUT)) {
    console.error("✗ الوجهة ليست مجلد نشرٍ مستقلًّا: " + OUT); process.exit(1);
  }
  if (fs.existsSync(OUT) && fs.readdirSync(OUT).some((e) => e !== ".git")) {
    const prev = path.join(OUT, "extension", "manifest.json");
    let ok = false;
    try { ok = JSON.parse(fs.readFileSync(prev, "utf8")).name === JSON.parse(fs.readFileSync(path.join(ROOT, "web", "user", "extension", "manifest.json"), "utf8")).name; } catch {}
    if (!ok) { console.error("✗ الوجهة غير فارغة وليست فيها بصمة نشرٍ سابق لهذه الإضافة — لن أفرغها: " + OUT); process.exit(1); }
  }
}
if (fs.existsSync(OUT)) {
  for (const e of fs.readdirSync(OUT)) {
    if (e === ".git") continue;
    try { fs.rmSync(path.join(OUT, e), { recursive: true, force: true }); }
    catch (err) { console.warn(`! تعذّر حذف ${e}: ${err.code} — سيُستبدل بالنسخ إن أمكن`); }
  }
} else {
  fs.mkdirSync(OUT, { recursive: true });
}

for (const [s, d] of FILES) {
  const src = path.join(ROOT, s);
  if (!fs.existsSync(src)) { console.warn(`! مفقود: ${s}`); continue; }
  copyFile(src, path.join(OUT, d));
}
for (const [s, d] of DIRS) {
  const src = path.join(ROOT, s);
  if (!fs.existsSync(src)) { console.warn(`! مفقود: ${s}`); continue; }
  copyDir(src, path.join(OUT, d));
}

// ── تصحيح المسارات في نسخة النشر ────────────────────────────────────────────
// البنية سطحية هنا (extension/ و tools/ و test/ في الجذر) لا web/user/… — فأي مسار
// في README مكتوبٍ على بنية مجلد العمل يصير كاذبًا في المستودع. نصلحه هنا لا هناك.
const readme = path.join(OUT, "README.md");
if (fs.existsSync(readme)) {
  let t = fs.readFileSync(readme, "utf8");
  t = t.replace(/web\/user\/extension/g, "extension")
       .replace(/web\/user\/dictionaries/g, "dictionaries")
       .replace(/web\/code\/toolchain/g, "tools")
       .replace(/web\/code\/test/g, "test")
       // رابط الخادم في تعليمة الاختبارات: جذر النشر يخدم test/ مباشرة لا code/test/
       .replace(/8794\/code\/test/g, "8794/test")
       .replace(/web\/PRIVACY\.md/g, "PRIVACY.md")
       // شجرة البنية في README تصف مجلد العمل — تُستبدل بشجرة المستودع
       .replace(/```\nweb\/\n[\s\S]*?\n```/, "```\nextension/      الإضافة الجاهزة (حمّلها غير محزومة)\ndictionaries/   ★ القاموس المصدر — المصدر الوحيد للحقيقة\ntools/          أدوات البناء (Node خالص، بلا npm)\ntest/           الاختبارات\n```");
  fs.writeFileSync(readme, t, "utf8");
}
// أدوات البناء تشير إلى ../../user/… — نضيف ملف مسارات موافقًا للبنية السطحية
const paths = path.join(OUT, "tools", "paths.mjs");
if (fs.existsSync(paths)) {
  fs.writeFileSync(paths,
    `// paths.mjs — مسارات نسخة النشر (البنية سطحية: extension/ و dictionaries/ في الجذر)\n` +
    `import path from "node:path";\nimport { fileURLToPath } from "node:url";\n` +
    `const HERE = path.dirname(fileURLToPath(import.meta.url));\n` +
    `// ROOT مُصدَّر: serve-tests.mjs يستورده جذرًا للخدمة (بلا تصديرٍ كان ينهار)\n` +
    `export const ROOT = path.resolve(HERE, "..");\n` +
    `export const EXT = path.join(ROOT, "extension");\n` +
    `export const DICTS = path.join(ROOT, "dictionaries");\n` +
    `export const GLOSSARY = path.join(ROOT, "glossary");\n` +
    `export const LANGUAGES_JSON = path.join(HERE, "languages.json");\n`, "utf8");
}
// الاختبارات تستورد ../../user/extension/* — تصير ../extension/*
for (const f of fs.existsSync(path.join(OUT, "test")) ? fs.readdirSync(path.join(OUT, "test")) : []) {
  if (!f.endsWith(".html")) continue;
  const p = path.join(OUT, "test", f);
  fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace(/\.\.\/\.\.\/user\/extension\//g, "../extension/"), "utf8");
}

// ── تحقّق نهائي: لا يتسرّب ممنوع ────────────────────────────────────────────
const FORBIDDEN = [/\.pem$/i, /\.crx$/i, /HANDOFF/i, /claude-ALL-strings/i, /en-US\.json$/i, /STORE-LISTING/i, /_خاص/];
const leaks = [];
(function scan(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { scan(p); continue; }
    if (FORBIDDEN.some((re) => re.test(e.name))) leaks.push(path.relative(OUT, p));
  }
})(OUT);

console.log(`\nنسخة النشر: ${OUT}`);
console.log(`نُسخ ${copied} ملفًا · استُثني ${skipped.length}`);
skipped.forEach((s) => console.log(`  ⊘ ${path.relative(ROOT, s)}`));
if (leaks.length) {
  console.error(`\n✗ تسرّب ${leaks.length} ملفًا ممنوعًا:`);
  leaks.forEach((l) => console.error(`   ${l}`));
  process.exit(1);
}
console.log(`✓ لا ملفات ممنوعة — لا مفتاح توقيع، ولا مادة Anthropic خامًا، ولا ملفات عمل داخلية.`);
