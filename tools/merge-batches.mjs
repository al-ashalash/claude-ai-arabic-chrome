// merge-batches.mjs — merge the translated _ar_batches/*.json into user/dictionaries/ar.json.
// Existing (hand-curated) entries win on conflict; new entries are added.
// Usage: node merge-batches.mjs
import fs from "node:fs";
import path from "node:path";
import { DICTS, GLOSSARY } from "./paths.mjs";

const batchDir = path.join(GLOSSARY, "_ar_batches");
const files = fs.readdirSync(batchDir).filter((f) => f.endsWith(".json")).sort();

const arPath = path.join(DICTS, "ar.json");
const dict = JSON.parse(fs.readFileSync(arPath, "utf8"));
dict.strings = dict.strings || {};
const before = Object.keys(dict.strings).length;

let seen = 0, added = 0, updated = 0, skipped = 0, bad = 0;
for (const f of files) {
  const isOverride = /override/i.test(f); // files named *override* overwrite existing entries
  let arr;
  try { arr = JSON.parse(fs.readFileSync(path.join(batchDir, f), "utf8")); }
  catch (e) { bad++; console.warn("! unparseable:", f); continue; }
  for (const p of arr) {
    if (!p || typeof p.en !== "string") continue;
    seen++;
    const en = p.en.trim(), ar = (p.ar || "").trim();
    if (!en || !ar || ar === en) { skipped++; continue; }         // skip empty / brand-kept
    const exists = Object.prototype.hasOwnProperty.call(dict.strings, en);
    if (exists && !isOverride) { skipped++; continue; }            // keep curated unless override
    if (exists && dict.strings[en] === ar) { skipped++; continue; }
    dict.strings[en] = ar;
    if (exists) updated++; else added++;
  }
}

// stable alphabetical order for readability
const ordered = {};
for (const k of Object.keys(dict.strings).sort((a, b) => a.localeCompare(b))) ordered[k] = dict.strings[k];
dict.strings = ordered;
if (dict._meta) dict._meta.count = Object.keys(dict.strings).length;

fs.writeFileSync(arPath, JSON.stringify(dict, null, 2) + "\n", "utf8");
console.log(`batches: ${files.length} (bad: ${bad}) | pairs seen: ${seen} | added: ${added} | updated: ${updated} | skipped: ${skipped}`);
console.log(`ar.json strings: ${before} -> ${Object.keys(dict.strings).length}`);
