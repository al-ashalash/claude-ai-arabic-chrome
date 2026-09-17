// harvest-siwar.mjs — حصادُ مقابلات المصطلحات من معجمٍ عام على منصة «سوار» (مجمع الملك سلمان).
//
// يقرأ ما يقرؤه أيُّ زائرٍ للمنصة عبر واجهتها العامة نفسِها (لا مفتاح، لا تسجيل)، **وقت
// البناء على جهاز المطوّر فقط** — لا شأن للإضافة بهذا (عهد الخصوصية). ويأخذ **المقابلَ
// المصطلحي وحده** (اللِّمّة العربية ومقابلاتها الإنجليزية/الفرنسية/الإسبانية ومعرّفَ
// المدخل للإسناد) — **لا التعريفات**، فهي محتوًى محميٌّ لأصحابه.
//
//   node harvest-siwar.mjs [--lexicon=<id>] [--out=<ملف>]
// الافتراضي: معجم البيانات والذكاء الاصطناعي (سدايا + المجمع، الإصدار الثالث).
// مهذّب: 4 طلبات متزامنة، وتأخيرٌ صغير، وقابلٌ للاستئناف (يتخطى ما نُزّل).
import fs from "node:fs";
import path from "node:path";
import { GLOSSARY } from "./paths.mjs";

const BASE = "https://siwar.ksaa.gov.sa";
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith("--" + k + "=")); return a ? a.split("=").slice(1).join("=") : d; };
const LEX = arg("lexicon", "4cd164a7-7160-4de8-af5c-34382f5da657");
const OUT = arg("out", path.join(GLOSSARY, "terms-siwar.json"));
const CACHE = path.join(GLOSSARY, "_siwar-cache", LEX);
fs.mkdirSync(CACHE, { recursive: true });
const UA = { "User-Agent": "claude-mutarjim/1.0 (open-source Arabic UI; term-equivalents only, build-time)", "Accept": "application/json" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function screen(first, rows) {
  const res = await fetch(`${BASE}/api/screens/public/get-lexicon-search-screen-data/${LEX}?languageCode=ar`, {
    method: "POST", headers: { ...UA, "Content-Type": "application/json" },
    body: JSON.stringify({ preferences: { filters: {}, first, rows, multisortmeta: [] } }),
  });
  if (!res.ok) throw new Error("screen " + res.status);
  return res.json();
}

// ---- 1) قائمة المداخل ----
const first = await screen(0, 100);
const meta = first.lexicon || {};
const total = first.paginated.totalCount;
console.log(`المعجم: ${meta.name} | المؤلف: ${(meta.authors || []).map((a) => a.name).join("، ")} | المداخل: ${total}`);
let ids = new Map();
for (const w of first.paginated.words) ids.set(w.lexicalEntryId, w.word);
for (let f = 100; f < total; f += 100) {
  const pg = await screen(f, 100);
  for (const w of pg.paginated.words) ids.set(w.lexicalEntryId, w.word);
  process.stdout.write(`\rالقائمة: ${ids.size}/${total}   `);
  await sleep(120);
}
console.log(`\nمعرّفات فريدة: ${ids.size}`);

// ---- 2) المداخل واحدًا واحدًا (بتزامنٍ محدود وذاكرةٍ على القرص) ----
const list = [...ids.keys()];
let done = 0, failed = 0;
async function one(id) {
  const fp = path.join(CACHE, id + ".json");
  if (fs.existsSync(fp)) { done++; return; }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${BASE}/api/search/get-public-entry/${id}`, { headers: UA });
      if (!res.ok) throw new Error(String(res.status));
      const o = await res.json();
      // نحفظ الحقول المصطلحية وحدها — لا senses (التعريفات)
      const slim = {
        id, lemma: o.lemma, lemmaType: o.lemmaType, lang: o.lemmaLanguage && o.lemmaLanguage.code,
        rel: (o.entryRelations || []).filter((r) => r.type === "TRANSLATION" && r.data)
          .map((r) => ({ lang: r.data.languageCode, lemma: r.data.nonDiacriticsLemma || r.data.lemma, id: r.relatedLexicalEntryId })),
        domains: ((o.senses || [])[0] || {}).domains || [],
      };
      fs.writeFileSync(fp, JSON.stringify(slim), "utf8");
      done++; return;
    } catch (e) { await sleep(600 * (attempt + 1)); }
  }
  failed++;
}
let cursor = 0;
async function worker() {
  while (cursor < list.length) {
    const id = list[cursor++];
    await one(id);
    if ((done + failed) % 50 === 0) process.stdout.write(`\rالمداخل: ${done} تمّ · ${failed} أخفق / ${list.length}   `);
    await sleep(80);
  }
}
await Promise.all([worker(), worker(), worker(), worker()]);
console.log(`\nتمّ: ${done} | أخفق: ${failed}`);

// ---- 3) التجميع: أزواج (en → ar) مع fr/es والمعرّف للإسناد ----
const terms = [];
for (const id of list) {
  const fp = path.join(CACHE, id + ".json");
  if (!fs.existsSync(fp)) continue;
  const o = JSON.parse(fs.readFileSync(fp, "utf8"));
  if (o.lang !== "ar") continue; // القائمة قد تحوي مداخل اللغات الأخرى؛ نريد الرأس العربي
  const en = (o.rel || []).find((r) => r.lang === "eng"), fr = (o.rel || []).find((r) => r.lang === "fra"), es = (o.rel || []).find((r) => r.lang === "spa");
  if (!en || !en.lemma) continue;
  terms.push({ en: en.lemma, ar: o.lemma, fr: fr ? fr.lemma : undefined, es: es ? es.lemma : undefined, id, url: `${BASE}/public-dict-information/${LEX}?entry=${id}` });
}
fs.writeFileSync(OUT, JSON.stringify({ _meta: { lexicon: meta.name, lexiconId: LEX, authors: (meta.authors || []).map((a) => a.name), sponsors: (meta.sponsors || []).map((s) => s.name), totalEntries: total, harvested: new Date().toISOString().slice(0, 10), note: "مقابلاتٌ مصطلحية فقط — لا تعريفات؛ قُرئت من الواجهة العامة للمنصة وقت البناء" }, terms }, null, 1), "utf8");
console.log(`أزواج (en→ar): ${terms.length} → ${OUT}`);
