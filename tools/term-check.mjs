// term-check.mjs — مسحُ القاموس كلِّه على قاعدة المصطلحات المُسنَدة (code/glossary/terms-base.json).
//
// لماذا: قاعدةُ المصطلحات تحكم الجُمل الكثيرة، ومصطلحٌ واحد يرد في مئات النصوص.
// الحارس يلتقط النصوص التي يظهر فيها المصطلح الإنجليزي ولا يظهر في ترجمتها جذرُ
// المقابل المعتمد — مرشَّحاتٌ للمراجعة لا أحكامًا (التصريف والسياق قد يبرّران الفرق).
//
//   node term-check.mjs            → تقريرٌ موجز + ملف code/glossary/_term-flags.json
//   node term-check.mjs --strict   → رمز خروج 1 إن وُجدت مخالفات لمصطلحاتٍ decision=adopt
import fs from "node:fs";
import path from "node:path";
import { GLOSSARY, DICTS } from "./paths.mjs";

const base = JSON.parse(fs.readFileSync(path.join(GLOSSARY, "terms-base.json"), "utf8"));
const dict = JSON.parse(fs.readFileSync(path.join(DICTS, "ar.json"), "utf8"));
const strict = process.argv.includes("--strict");

// جذرٌ عربي مبسّط للمطابقة: يُسقط التشكيل والتطويل وأداة التعريف والسوابق (و/ف/ب/ل/ك)
// والضمائر اللاحقة الشائعة، ويوحّد الألفات — كافٍ لالتقاط الحضور لا للتحليل الصرفي
function stem(s) {
  return s.normalize("NFC")
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه").replace(/ى/g, "ي"); // في كل كلمة لا في آخر النصّ فقط
}
function arHasTerm(ar, term) {
  const t = stem(term).split(/\s+/);
  const a = stem(ar);
  // كل كلمةٍ من المقابل يجب أن تظهر (بعد نزع أداة التعريف والسابقة) في الترجمة
  return t.every((w) => {
    const core = w.replace(/^ال/, "");
    if (core.length < 3) return a.includes(w);
    // السوابق الملتصقة: و/ف/ب/ك/ل/ال/لل/بال… — حتى ثلاثة حروف من هذه المجموعة قبل الجذر
    return new RegExp("(^|[^\\u0600-\\u06FF])[وفبكلا]{0,3}" + core.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[\\u0600-\\u06FF]{0,4}(?=[^\\u0600-\\u06FF]|$)").test(a);
  });
}
const flags = [];
let checked = 0;
for (const t of base.terms) {
  if (t.decision === "context" || t.decision === "fix") continue; // تُحسم بشريًّا في المراجعة
  const en = t.en.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp("(^|[^A-Za-z])" + en + "(?:s|es)?(?=[^A-Za-z]|$)", "i");
  for (const [key, ar] of Object.entries(dict.strings)) {
    if (!re.test(key)) continue;
    // المصطلح جزءٌ من اسم منتجٍ يبقى إنجليزيًّا (Claude Security، Claude Code…) — ليس مخالفة
    if (new RegExp("Claude " + en, "i").test(key) && !new RegExp("(^|[^A-Za-z])" + en + "(?:s|es)?(?=[^A-Za-z]|$)", "i").test(key.replace(new RegExp("Claude " + en, "gi"), ""))) continue;
    checked++;
    // المفتاح الذي يُترك بالإنجليزية عمدًا (علامة/رمز) لا يُعدّ مخالفة
    if (/^[A-Za-z0-9 .\-_/()]+$/.test(ar)) continue;
    // إبقاءُ المصطلح إنجليزيًّا في الترجمة إبقاءٌ متعمَّد (ترويسة Authorization، اسم منتج) — ليس مخالفة
    if (new RegExp("(^|[^A-Za-z])" + en + "(?:s|es)?(?=[^A-Za-z]|$)", "i").test(ar)) continue;
    const forms = (t.forms || [t.ar]).concat(t.ksaa ? [t.ksaa] : []);
    if (!forms.some((f) => arHasTerm(ar, f))) {
      flags.push({ term: t.en, expect: t.ar, decision: t.decision, en: key, ar });
    }
  }
}
const byTerm = {};
for (const f of flags) byTerm[f.term] = (byTerm[f.term] || 0) + 1;
fs.writeFileSync(path.join(GLOSSARY, "_term-flags.json"), JSON.stringify(flags, null, 1), "utf8");
console.log(`قاعدة المصطلحات: ${base.terms.length} | نصوص فُحصت: ${checked} | مرشَّحات للمراجعة: ${flags.length}`);
for (const [k, v] of Object.entries(byTerm).sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`  ${k}: ${v}`);
const hard = flags.filter((f) => f.decision === "adopt");
if (strict && hard.length) { console.error(`✗ ${hard.length} مخالفة لمصطلحاتٍ معتمدة`); process.exit(1); }
