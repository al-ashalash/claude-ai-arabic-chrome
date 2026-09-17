// siwar-diff.mjs — مقابلةُ القاموس كلِّه وقاعدةِ المصطلحات على معجم سوار (الإصدار الثالث).
// يُعيد التجميع من الذاكرة المحلية (_siwar-cache) بلا تنزيل، ويُخرج:
//   code/glossary/terms-siwar.json   الأزواج (en/ar/fr/es/id) نظيفةً
//   code/glossary/_siwar-diff.json   الفروق: كل مصطلحٍ في المعجم له أثرٌ في قاموسنا،
//                                    مع ترجمتنا الحالية وعدد النصوص المتأثرة وحكمٍ أوليّ.
import fs from "node:fs";
import path from "node:path";
import { GLOSSARY, DICTS } from "./paths.mjs";

const LEX = "4cd164a7-7160-4de8-af5c-34382f5da657";
const BASE = "https://siwar.ksaa.gov.sa";
const CACHE = path.join(GLOSSARY, "_siwar-cache", LEX);
// علّةٌ في بيانات المنصة: «Engineering» تظهر «eng-English      ineering» في بعض المداخل
const fixLemma = (s) => String(s || "").replace(/eng-English\s+ineering/g, "Engineering").replace(/\s+/g, " ").trim();

const all = fs.readdirSync(CACHE).map((f) => JSON.parse(fs.readFileSync(path.join(CACHE, f), "utf8")));
const ar = all.filter((e) => e.lang === "ar");
const terms = [];
for (const e of ar) {
  const en = (e.rel || []).find((r) => r.lang === "eng");
  if (!en || !en.lemma) continue;
  const fr = (e.rel || []).find((r) => r.lang === "frn"), es = (e.rel || []).find((r) => r.lang === "esp");
  terms.push({ en: fixLemma(en.lemma), ar: fixLemma(e.lemma), fr: fr ? fixLemma(fr.lemma) : undefined, es: es ? fixLemma(es.lemma) : undefined, id: e.id, url: `${BASE}/public-dict-information/${LEX}` });
}
fs.writeFileSync(path.join(GLOSSARY, "terms-siwar.json"), JSON.stringify({
  _meta: { lexicon: "معجم البيانات والذكاء الاصطناعي (الإصدار الثالث)", lexiconId: LEX, publishers: ["الهيئة السعودية للبيانات والذكاء الاصطناعي (سدايا)", "مجمع الملك سلمان العالمي للغة العربية"], concepts: ar.length, pairsEnAr: terms.length, harvested: "2026-09-17", note: "مقابلاتٌ مصطلحية فقط (لا تعريفات) — قُرئت من الواجهة العامة للمنصة وقت البناء، وتُسنَد بمعرّف المدخل" },
  terms,
}, null, 1), "utf8");
console.log(`المفاهيم العربية: ${ar.length} | أزواج en→ar: ${terms.length} | fr: ${terms.filter((t) => t.fr).length} | es: ${terms.filter((t) => t.es).length}`);

// ---- المقابلة على القاموس ----
const dict = JSON.parse(fs.readFileSync(path.join(DICTS, "ar.json"), "utf8"));
const S = dict.strings;
const keys = Object.keys(S);
const lowerKey = new Map(keys.map((k) => [k.toLowerCase(), k]));
const base = JSON.parse(fs.readFileSync(path.join(GLOSSARY, "terms-base.json"), "utf8"));
const baseBy = new Map(base.terms.map((t) => [t.en.toLowerCase(), t]));
const strip = (s) => String(s).replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/\s*\([^)]*\)\s*$/, "").replace(/^ال/, "").trim();
const norm = (s) => s.toLowerCase().replace(/\s*\([^)]*\)\s*$/, "").trim();

const rows = [];
for (const t of terms) {
  const en = norm(t.en);
  if (en.length < 3) continue;
  const re = new RegExp("(^|[^A-Za-z])" + en.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?:s|es)?(?=[^A-Za-z]|$)", "i");
  const exactKey = lowerKey.get(en) || lowerKey.get(en + "s");
  let inside = 0; for (const k of keys) if (re.test(k)) inside++;
  if (!exactKey && !inside) continue; // لا أثر له عندنا
  const ours = exactKey ? S[exactKey] : null;
  const b = baseBy.get(en);
  const agree = ours ? strip(ours) === strip(t.ar) : null;
  rows.push({ en: t.en, siwar: t.ar, ours, inBase: b ? b.ar : null, baseDecision: b ? b.decision : null, agree, inside, id: t.id });
}
rows.sort((a, b) => (b.inside + (b.ours ? 5 : 0)) - (a.inside + (a.ours ? 5 : 0)));
fs.writeFileSync(path.join(GLOSSARY, "_siwar-diff.json"), JSON.stringify(rows, null, 1), "utf8");
const withEntry = rows.filter((r) => r.ours);
console.log(`مصطلحاتٌ لها أثرٌ في قاموسنا: ${rows.length} | لها مدخلٌ مستقل: ${withEntry.length} (متطابق ${withEntry.filter((r) => r.agree).length} · مختلف ${withEntry.filter((r) => !r.agree).length}) | في قاعدتنا: ${rows.filter((r) => r.inBase).length}`);
console.log("\nالاختلافات في المداخل المستقلة (الأكثر أثرًا أولًا):");
for (const r of withEntry.filter((r) => !r.agree).slice(0, 40)) console.log(`  ${r.en}: «${r.ours}» ↔ سوار «${r.siwar}»${r.inBase ? " [قاعدتنا: " + r.inBase + "/" + r.baseDecision + "]" : ""} — يرد داخل ${r.inside} نصًّا`);
console.log("\nمصطلحات القاعدة التي يخالفها سوار:");
for (const b of base.terms) { const t = terms.find((x) => norm(x.en) === b.en.toLowerCase()); if (t && strip(t.ar) !== strip(b.ar)) console.log(`  ${b.en}: قاعدتنا «${b.ar}» (${b.decision}) ↔ سوار «${t.ar}»`); else if (!t) console.log(`  ${b.en}: — لا مدخل في الإصدار الثالث (قاعدتنا «${b.ar}»)`); }
