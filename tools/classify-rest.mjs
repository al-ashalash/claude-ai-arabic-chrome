// classify-rest.mjs — تصنيف غير المترجَم: قابل للترجمة أم مرفوض بنيويًا
// (وُطّن من مساحة العمل المؤقتة في المرحلة ٠ — 2026-08-29)
// تصنيف المتبقّي: ما يُترجَم فعلاً، وما رُفض بنيوياً كقاعدة (لا تُصلحه ترجمة أخرى)
import fs from "node:fs";
import path from "node:path";
import { ROOT, GLOSSARY, DICTS } from "./paths.mjs";
const G = GLOSSARY;
const VAR_RE = /\{([A-Za-z_$][\w$]*)\}/g;

function whyRejected(s) {
  VAR_RE.lastIndex = 0;
  const names = []; let m;
  while ((m = VAR_RE.exec(s))) names.push(m[1]);
  if (names.length > 3) return "أكثر من ٣ متغيّرات";
  if (/\}[\s ]*\{/.test(s)) return "متغيّران متلاصقان (خطر ReDoS)";
  const lit = s.replace(VAR_RE, "").trim();
  if (lit.length < 6) return "الثابت أقصر من ٦ محارف";
  if (!/[A-Za-z]{3}/.test(lit)) return "الثابت بلا كلمة لاتينية";
  const t = s.trim();
  if (/^\{[A-Za-z_$][\w$]*\}/.test(t) && /\{[A-Za-z_$][\w$]*\}$/.test(t)) return "متغيّر في الطرفين بلا مرساة";
  return null;
}

const plain = fs.readFileSync(`${G}/_missing-plain.txt`, "utf8").split(/\r?\n/).filter(Boolean);
const vars = fs.readFileSync(`${G}/_missing-vars.txt`, "utf8").split(/\r?\n/).filter(Boolean);

const ok = [], rejected = {};
for (const s of vars) {
  const why = whyRejected(s);
  if (why) { (rejected[why] = rejected[why] || []).push(s); continue; }
  ok.push(s);
}
console.log(`نصوص ثابتة تحتاج ترجمة: ${plain.length}`);
console.log(`نصوص بمتغيّرات تصلح قواعد: ${ok.length}`);
console.log(`نصوص بمتغيّرات مرفوضة بنيوياً: ${vars.length - ok.length}`);
for (const [why, list] of Object.entries(rejected).sort((a, b) => b[1].length - a[1].length))
  console.log(`   - ${why}: ${list.length}`);
console.log(`\nالمجموع القابل للترجمة: ${plain.length + ok.length}`);
fs.writeFileSync(`${G}/_missing-vars-translatable.txt`, ok.join("\n"), "utf8");
fs.writeFileSync(`${G}/_vars-structurally-rejected.json`, JSON.stringify(rejected, null, 1), "utf8");
