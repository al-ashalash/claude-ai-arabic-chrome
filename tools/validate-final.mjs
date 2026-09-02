// validate-final.mjs — التدقيق الآلي لدفعات الترجمة قبل الدمج
// (وُطّن من مساحة العمل المؤقتة في المرحلة ٠ — 2026-08-29)
// تدقيق آلي للدفعات النهائية قبل الدمج: تغطية، مطابقة en حرفية (بما فيها ’ — …)،
// سلامة المتغيّرات، منع $رقم، وقاعدة القوسين، واتساق المصطلح.
import fs from "node:fs";
import path from "node:path";
import { ROOT, GLOSSARY, DICTS } from "./paths.mjs";

const G = GLOSSARY;
const IN = `${G}/_translate-inbox`;
const ids = process.argv.slice(2);
if (!ids.length) { console.error("usage: node validate-final.mjs p0 p1 v0 …"); process.exit(1); }

const VAR = /\{([A-Za-z_$][\w$]*)\}/g;
const varsOf = (s) => { VAR.lastIndex = 0; const o = []; let m; while ((m = VAR.exec(s))) o.push(m[1]); return o.sort().join(","); };

const TERMS = [
  { en: /\bchats?\b/i, ar: /محادث/, name: "chat→محادثة" },
  { en: /\bprojects?\b/i, ar: /مشروع|مشاريع|Projects/, name: "project→مشروع" },
  { en: /\bartifacts?\b/i, ar: /مُخرَج|مخرج|Artifacts/, name: "artifact→مُخرَج" },
  { en: /\bconnectors?\b/i, ar: /موصّل|موصل|Connectors/, name: "connector→موصّل" },
  { en: /\bskills?\b/i, ar: /مهار|Skills/, name: "skill→مهارة" },
];

let allClean = [], grandBad = 0, grandOk = 0, grandKept = 0, missingFiles = [];
const warn = { paren: [], term: [], dollar: [], quote: [] };

for (const id of ids) {
  const chunkFile = `${IN}/chunk_${id}.txt`;
  if (!fs.existsSync(chunkFile)) continue;
  const src = fs.readFileSync(chunkFile, "utf8").split(/\r?\n/).filter(Boolean);
  const file = fs.existsSync(`${IN}/final_${id}.json`) ? `final_${id}.json`
             : fs.existsSync(`${IN}/draft_${id}.json`) ? `draft_${id}.json` : null;
  if (!file) { missingFiles.push(id); grandBad += src.length; continue; }

  let arr;
  try { arr = JSON.parse(fs.readFileSync(`${IN}/${file}`, "utf8")); }
  catch (e) { console.log(`${id}: BAD JSON (${file}) — ${e.message}`); grandBad += src.length; continue; }

  const byEn = new Map();
  for (const p of arr) if (p && typeof p.en === "string") byEn.set(p.en, p);

  let miss = 0, vmis = 0, empty = 0, kept = 0;
  const good = [];
  for (const s of src) {
    const p = byEn.get(s);
    if (!p) { miss++; continue; }
    const ar = String(p.ar || "").trim();
    if (!ar) { empty++; continue; }
    if (ar === s) { kept++; continue; }
    if (varsOf(s) !== varsOf(ar)) { vmis++; continue; }
    if (/\{/.test(s) && /\$\d/.test(ar)) { warn.dollar.push(`${id}: ${s}`); continue; }
    // المحارف المطبعية: يجب أن تبقى كما هي في en (وهي علّة هذه الدورة كلها)
    if (/[’—…]/.test(s) && !/[’—…]/.test(p.en)) warn.quote.push(`${id}: ${JSON.stringify(s)}`);
    const isTitle = s.split(/\s+/).length <= 4 && !/[.!?:؟]$/.test(s);
    if (!isTitle && /\([A-Za-z]/.test(ar) && !/\([A-Za-z]/.test(s)) warn.paren.push(`${id}: ${JSON.stringify(s).slice(0, 70)}`);
    const bare = s.replace(VAR, " ");
    for (const t of TERMS) if (t.en.test(bare) && !t.ar.test(ar)) warn.term.push(`${id}: [${t.name}] ${JSON.stringify(s).slice(0, 60)}`);
    good.push({ en: s, ar });
  }
  const bad = miss + vmis + empty;
  grandOk += good.length; grandBad += bad; grandKept += kept;
  allClean.push(...good);
  if (bad || miss) console.log(`${id}: مصدر ${src.length} | سليم ${good.length} | إنجليزي ${kept} | ناقص ${miss} | متغيّرات ${vmis} | فارغ ${empty}  (${file})`);
}

if (missingFiles.length) console.log(`\n⚠ دفعات بلا ملف: ${missingFiles.join(" ")}`);
console.log(`\nتحذيرات: قوسان ${warn.paren.length} · مصطلح ${warn.term.length} · $رقم ${warn.dollar.length} · محارف مطبعية ${warn.quote.length}`);
warn.term.slice(0, 6).forEach((x) => console.log("    " + x));
warn.dollar.slice(0, 4).forEach((x) => console.log("    " + x));

const plainOut = allClean.filter((p) => !/\{[A-Za-z_$][\w$]*\}/.test(p.en));
const varOut = allClean.filter((p) => /\{[A-Za-z_$][\w$]*\}/.test(p.en));
fs.writeFileSync(`${G}/_ar_batches/batch_20260828_full.json`, JSON.stringify(plainOut, null, 1), "utf8");
fs.writeFileSync(`${G}/_vars-pairs-20260828.json`, JSON.stringify(varOut, null, 1), "utf8");
console.log(`\nالمجموع: سليم ${grandOk} | مرفوض ${grandBad} | أُبقي إنجليزياً ${grandKept}`);
console.log(`  ثابت ← batch_20260828_full.json: ${plainOut.length}`);
console.log(`  بمتغيّرات ← _vars-pairs-20260828.json: ${varOut.length}`);
