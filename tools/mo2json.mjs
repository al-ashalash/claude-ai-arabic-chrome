// mo2json.mjs — IMPORT a compiled .mo file into a dictionary JSON.
// Usage: node mo2json.mjs <input.mo> [langCode]
import fs from "node:fs";
import path from "node:path";
import { readMO } from "./po-lib.mjs";
import { catalogToJson } from "./dict-lib.mjs";
import { DICTS } from "./paths.mjs";

const inPath = process.argv[2];
if (!inPath) { console.error("Usage: node mo2json.mjs <input.mo> [langCode]"); process.exit(1); }
const cat = readMO(fs.readFileSync(inPath));
const lang = process.argv[3] || cat.headers["Language"] || path.basename(inPath).replace(/\.mo$/i, "");
const dict = catalogToJson(cat, { language: lang });
const outPath = path.join(DICTS, `${lang}.json`);
fs.mkdirSync(DICTS, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(dict, null, 2) + "\n", "utf8");
console.log(`Imported ${Object.keys(dict.strings).length} strings + ${Object.keys(dict.plurals).length} plural(s) from MO -> ${outPath}`);
