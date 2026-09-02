// gen-patterns.mjs — توليد القواعد النمطية من أزواج {en,ar} بحرّاس makePattern + فرز التخصيص
// (وُطّن من مساحة العمل المؤقتة في المرحلة ٠ — 2026-08-29)
// توليد القواعد النمطية من أزواج النصوص ذات المتغيرات.
// منطق التوليد منقول حرفياً من makePattern في options.js، مع حارسين خاصين بالشحن الجماعي:
// تعارض المدوّنة، ورمز القالب $رقم. ★ والفرز بالتخصيص على القائمة **كاملة** في النهاية.
import fs from "node:fs";
import path from "node:path";
import { ROOT, GLOSSARY, DICTS } from "./paths.mjs";

const G = GLOSSARY;
const AR = path.join(DICTS, 'ar.json');
const BASE_PATTERNS = process.argv[2];
const INPUTS = [
  `${G}/_vars-pairs-desktop.json`,
  `${G}/_vars-pairs-web-20260814b.json`,
  `${G}/_vars-pairs-20260815.json`,
  `${G}/_vars-pairs-20260828.json`,
];

// النسخة الواحدة من makePattern وفرز التخصيص — من cml-shared.js (سكربت ثنائي الاستخدام)
await import(new URL("../../user/extension/cml-shared.js", import.meta.url).href);
const { makePattern, sortBySpecificity } = globalThis.CMLShared;

const dict = JSON.parse(fs.readFileSync(AR, "utf8"));
const dictKeys = Object.keys(dict.strings || {});
if (BASE_PATTERNS && fs.existsSync(BASE_PATTERNS)) {
  dict.patterns = JSON.parse(fs.readFileSync(BASE_PATTERNS, "utf8")).patterns || [];
  console.log(`base patterns (from backup): ${dict.patterns.length}`);
} else {
  console.log(`base patterns (in place): ${(dict.patterns || []).length}`);
}
const existing = new Set((dict.patterns || []).map((p) => p.re));

let seen = 0, keptEn = 0, guardRej = 0, corpusRej = 0, tmplRej = 0, dup = 0, added = 0;
const newPats = [], rejects = [];
for (const f of INPUTS) {
  if (!fs.existsSync(f)) { console.warn("! غير موجود:", f.split("/").pop()); continue; }
  for (const p of JSON.parse(fs.readFileSync(f, "utf8"))) {
    if (!p || typeof p.en !== "string" || typeof p.ar !== "string") continue;
    seen++;
    const en = p.en.trim(), ar = p.ar.trim();
    if (!ar || ar === en) { keptEn++; continue; }
    if (/\$\d/.test(ar) || /%[MWPC]\d/.test(ar)) { tmplRej++; rejects.push({ why: "template-symbol", en }); continue; }
    const pat = makePattern(en, ar);
    if (!pat) { guardRej++; rejects.push({ why: "guard", en }); continue; }
    if (existing.has(pat.re)) { dup++; continue; }
    const re = new RegExp(pat.re);
    const clash = dictKeys.find((k) => re.test(k));
    if (clash) { corpusRej++; rejects.push({ why: "matches-literal: " + clash, en }); continue; }
    existing.add(pat.re);
    newPats.push(pat);
    added++;
  }
}

// ★ الفرز بالتخصيص — النسخة المشتركة (الترتيب دلالي: الأخص أولاً)
dict.patterns = sortBySpecificity((dict.patterns || []).concat(newPats));

fs.writeFileSync(AR, JSON.stringify(dict, null, 2) + "\n", "utf8");
fs.writeFileSync(`${G}/_patterns-rejected.json`, JSON.stringify(rejects, null, 1), "utf8");
console.log(`أزواج: ${seen} | إنجليزي: ${keptEn} | حارس: ${guardRej} | قالب: ${tmplRej} | تعارض: ${corpusRej} | مكرر: ${dup}`);
console.log(`أُضيف: ${added} ← المجموع ${dict.patterns.length}`);
