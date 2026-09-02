// cross-check-patterns.mjs — الفحص العرضي للقواعد على المدوّنة الحيّة (حارسان):
//   ١) صفر مفاتيح قاموس يظللها نمط (تكرار لحارس build.mjs على الحصاد الحي).
//   ٢) ★ في كل تعدّد تطابق، الفائز (أول نمط) هو الأخصّ — أطول نص ثابت.
//      كان الترتيب الأبجدي يجعل الأعم يبتلع الأخص فيُخرج ترجمة خاطئة (39 حالة قيست).
// (أُعيد بناؤه في المرحلة ٠ بعد ضياعه من المساحة المؤقتة — 2026-08-29)
import fs from "node:fs";
import path from "node:path";
import { GLOSSARY, DICTS } from "./paths.mjs";

const dict = JSON.parse(fs.readFileSync(path.join(DICTS, "ar.json"), "utf8"));
const strings = dict.strings || {};
const pats = (dict.patterns || [])
  .map((p) => { try { return { re: new RegExp(p.re), en: p.en, ar: p.ar }; } catch { return null; } })
  .filter(Boolean);

const catPath = path.join(GLOSSARY, "claude-ALL-strings.txt");
const cat = fs.existsSync(catPath)
  ? [...new Set(fs.readFileSync(catPath, "utf8").split(/\r?\n/).map((s) => s.trim()).filter(Boolean))]
  : [];

let bad = 0;

// ١) لا نمط يظلّل مفتاح قاموس
let shadow = 0;
for (const k of Object.keys(strings)) {
  const p = pats.find((x) => x.re.test(k));
  if (p) { shadow++; if (shadow <= 5) console.log(`  تظليل: ${JSON.stringify(k)} ← ${JSON.stringify(p.en)}`); }
}
console.log(`مفاتيح يظللها نمط: ${shadow}  (يجب 0)`);
if (shadow) bad++;

// ٢) الفائز الأخصّ في كل تعدّد تطابق
const litLen = (en) => String(en).replace(/\{[^{}]*\}/g, "").length;
let multi = 0, wrongWinner = 0;
const wrongEx = [];
for (const s of cat) {
  if (strings[s] !== undefined) continue;
  const hits = pats.filter((x) => x.re.test(s));
  if (hits.length < 2) continue;
  multi++;
  const best = hits.reduce((a, b) => (litLen(b.en) > litLen(a.en) ? b : a));
  if (hits[0] !== best) {
    wrongWinner++;
    if (wrongEx.length < 5) wrongEx.push({ s, won: hits[0].en, should: best.en });
  }
}
console.log(`نصوص يغطيها أكثر من نمط: ${multi} من ${cat.length}`);
console.log(`★ حالات يفوز فيها الأعمّ على الأخصّ: ${wrongWinner}  (يجب 0)`);
wrongEx.forEach((e) => console.log(`  «${e.s}»\n     فاز: ${JSON.stringify(e.won)}\n     الأولى: ${JSON.stringify(e.should)}`));
if (wrongWinner) bad++;
if (!cat.length) console.log("⚠ لا ملف حصاد — الحارس الثاني لم يجرِ فعليًا.");

process.exit(bad ? 1 : 0);
