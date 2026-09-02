// purge-shadowed-batches.mjs — حذف الحرفيات المحجوبة بقاعدة من القاموس ومن ملفات الدفعات معًا
// (وُطّن من مساحة العمل المؤقتة في المرحلة ٠ — 2026-08-29)
// حذف المدخلات المحجوبة بقاعدة من القاموس **ومن ملفات الدفعات** — وإلا عادت مع كل دمج
// فأوقفت البناء في كل دورة (وقع ذلك مرتين).
import fs from "node:fs";
import path from "node:path";
import { ROOT, GLOSSARY, DICTS } from "./paths.mjs";
const W = ROOT;
const AR = `${W}/user/dictionaries/ar.json`;
const BATCH_DIR = `${W}/code/glossary/_ar_batches`;

const d = JSON.parse(fs.readFileSync(AR, "utf8"));
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const res = [];
for (const p of d.patterns || []) { try { res.push({ re: new RegExp(p.re), src: `pattern «${p.en}»` }); } catch {} }
for (const [en, spec] of Object.entries(d.plurals || {}))
  for (const pat of [en, spec.plural])
    if (pat) res.push({ re: new RegExp("^" + esc(pat).replace("%d", "(\\d+)") + "$"), src: `plural «${en}»` });
const shadowed = (k) => res.find((r) => r.re.test(k));

const droppedDict = [];
for (const k of Object.keys(d.strings)) {
  const hit = shadowed(k);
  if (hit) { droppedDict.push(`${k}  ← ${hit.src}`); delete d.strings[k]; }
}
fs.writeFileSync(AR, JSON.stringify(d, null, 2) + "\n", "utf8");

let droppedBatch = 0, touched = 0;
for (const f of fs.readdirSync(BATCH_DIR).filter((x) => x.endsWith(".json"))) {
  const p = `${BATCH_DIR}/${f}`;
  let arr;
  try { arr = JSON.parse(fs.readFileSync(p, "utf8")); } catch { continue; }
  if (!Array.isArray(arr)) continue;
  const kept = arr.filter((x) => !(x && typeof x.en === "string" && shadowed(x.en.trim())));
  if (kept.length !== arr.length) {
    droppedBatch += arr.length - kept.length; touched++;
    fs.writeFileSync(p, JSON.stringify(kept, null, 1), "utf8");
  }
}
console.log(`من القاموس: ${droppedDict.length}`);
droppedDict.slice(0, 15).forEach((x) => console.log("  " + x));
console.log(`من الدفعات: ${droppedBatch} في ${touched} ملف | strings: ${Object.keys(d.strings).length}`);
