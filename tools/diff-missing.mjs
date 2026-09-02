// diff-missing.mjs — given a catalog .txt, list strings NOT yet translated in ar.json.
// Usage: node diff-missing.mjs <catalog.txt> <out-missing.txt>
import fs from "node:fs";
import path from "node:path";
import { GLOSSARY, DICTS } from "./paths.mjs";

const inName = process.argv[2] || "_settings-catalog.txt";
const outName = process.argv[3] || "_settings-missing.txt";
const catPath = path.isAbsolute(inName) ? inName : path.join(GLOSSARY, inName);
const outPath = path.isAbsolute(outName) ? outName : path.join(GLOSSARY, outName);

const cat = [...new Set(fs.readFileSync(catPath, "utf8").split(/\r?\n/).map((s) => s.trim()).filter(Boolean))];
const dict = JSON.parse(fs.readFileSync(path.join(DICTS, "ar.json"), "utf8"));
const have = dict.strings || {};

const missing = cat.filter((s) => have[s] === undefined);
fs.writeFileSync(outPath, missing.join("\n"), "utf8");
console.log(`catalog: ${cat.length} | already translated: ${cat.length - missing.length} | MISSING: ${missing.length}`);
console.log("--- first 30 missing ---");
console.log(missing.slice(0, 30).join("\n"));
