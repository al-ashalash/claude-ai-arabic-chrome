// po2json.mjs — IMPORT a .po file into a dictionary JSON.
// Usage: node po2json.mjs <input.po> [langCode]
import fs from "node:fs";
import path from "node:path";
import { parsePO } from "./po-lib.mjs";
import { catalogToJson } from "./dict-lib.mjs";
import { DICTS } from "./paths.mjs";

const inPath = process.argv[2];
if (!inPath) { console.error("Usage: node po2json.mjs <input.po> [langCode]"); process.exit(1); }
const cat = parsePO(fs.readFileSync(inPath, "utf8"));
const lang = process.argv[3] || cat.headers["Language"] || path.basename(inPath).replace(/\.po$/i, "");
const dict = catalogToJson(cat, { language: lang });
const outPath = path.join(DICTS, `${lang}.json`);
fs.mkdirSync(DICTS, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(dict, null, 2) + "\n", "utf8");
console.log(`Imported ${Object.keys(dict.strings).length} strings + ${Object.keys(dict.plurals).length} plural(s) -> ${outPath}`);
