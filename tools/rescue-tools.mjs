// rescue-tools.mjs — أداة المرحلة صفر: توطين أدوات المساحة المؤقتة في code/toolchain
// باستبدال مساراتها المطلقة باستيراد paths.mjs — فلا يتسرب مسار جهازٍ شخصي إلى المستودع.
// تُشغَّل مرة واحدة ثم تبقى شاهدًا على أصل الأدوات.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = process.argv[2];
if (!SRC) { console.error("usage: node rescue-tools.mjs <scratchpad-dir>"); process.exit(1); }

// [الملف في السكراتشباد, الاسم الدائم, سطر التوثيق]
const TOOLS = [
  ["diff-engine.mjs", "diff-engine.mjs", "قياس التغطية بسلسلة المحرك نفسها (قاموس ← جموع ← قواعد)"],
  ["gen-patterns.mjs", "gen-patterns.mjs", "توليد القواعد النمطية من أزواج {en,ar} بحرّاس makePattern + فرز التخصيص"],
  ["validate-final.mjs", "validate-final.mjs", "التدقيق الآلي لدفعات الترجمة قبل الدمج"],
  ["purge-shadowed-batches.mjs", "purge-shadowed-batches.mjs", "حذف الحرفيات المحجوبة بقاعدة من القاموس ومن ملفات الدفعات معًا"],
  ["classify-rest.mjs", "classify-rest.mjs", "تصنيف غير المترجَم: قابل للترجمة أم مرفوض بنيويًا"],
  ["serve-web.mjs", "serve-tests.mjs", "خادم ملفات ثابت لصفحات الاختبار (لا file:// بسبب CORS)"],
];

// المسارات المطلقة التي كتبتها جلسات العمل — تُستبدل بثوابت paths.mjs
const REWRITES = [
  [/["']C:\/Users\/ashalash\/Developer\/claude-mutarjim\/web\/code\/glossary["']/g, "GLOSSARY"],
  [/["']C:\/Users\/ashalash\/Developer\/claude-mutarjim\/web\/user\/dictionaries\/ar\.json["']/g, "path.join(DICTS, 'ar.json')"],
  [/["']C:\/Users\/ashalash\/Developer\/claude-mutarjim\/web\/user\/dictionaries["']/g, "DICTS"],
  [/["']C:\/Users\/ashalash\/Developer\/claude-mutarjim\/web["']/g, "ROOT"],
  [/["']C:\/Users\/ashalash\/Developer\/claude-mutarjim\/desktop\/code\/locale\/claude-ai["']/g, "path.join(ROOT, '..', 'desktop', 'code', 'locale', 'claude-ai')"],
];

let ok = 0;
for (const [src, dest, doc] of TOOLS) {
  const sp = path.join(SRC, src);
  if (!fs.existsSync(sp)) { console.warn(`! مفقود في السكراتشباد: ${src} — يلزم إعادة بناؤه يدويًا`); continue; }
  let t = fs.readFileSync(sp, "utf8");
  let touched = false;
  for (const [re, repl] of REWRITES) if (re.test(t)) { t = t.replace(re, repl); touched = true; }
  if (touched && !/from "\.\/paths\.mjs"/.test(t)) {
    // أدرج الاستيراد بعد أول سطر استيراد موجود
    t = t.replace(/(import [^\n]+node:fs[^\n]+\n)/, `$1import path from "node:path";\nimport { ROOT, GLOSSARY, DICTS } from "./paths.mjs";\n`);
  }
  t = `// ${dest} — ${doc}\n// (وُطّن من مساحة العمل المؤقتة في المرحلة ٠ — 2026-08-29)\n` + t;
  fs.writeFileSync(path.join(HERE, dest), t, "utf8");
  console.log(`+ ${dest}`);
  ok++;
}
console.log(`\nوُطّن ${ok}/${TOOLS.length}`);
