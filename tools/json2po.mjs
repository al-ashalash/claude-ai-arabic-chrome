// json2po.mjs — EXPORT a dictionary JSON to a gettext .po file.
// Usage: node json2po.mjs <langCode> [output.po]
import fs from "node:fs";
import path from "node:path";
import { serializePO } from "./po-lib.mjs";
import { jsonToCatalog } from "./dict-lib.mjs";
import { DICTS, GLOSSARY } from "./paths.mjs";

const lang = process.argv[2];
if (!lang) { console.error("Usage: node json2po.mjs <langCode> [output.po]"); process.exit(1); }
const inPath = path.join(DICTS, `${lang}.json`);
const dict = JSON.parse(fs.readFileSync(inPath, "utf8"));
const cat = jsonToCatalog(dict);
const outPath = process.argv[3] || path.join(GLOSSARY, `${lang}.po`);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, serializePO(cat), "utf8");
console.log(`Exported ${cat.items.length} entr(ies) -> ${outPath}`);
