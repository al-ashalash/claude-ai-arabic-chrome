// po2mo.mjs — compile a .po file to a binary .mo file (pure JS, no gettext).
// Usage: node po2mo.mjs <input.po> [output.mo]
import fs from "node:fs";
import path from "node:path";
import { parsePO, writeMO } from "./po-lib.mjs";

const inPath = process.argv[2];
if (!inPath) { console.error("Usage: node po2mo.mjs <input.po> [output.mo]"); process.exit(1); }
const cat = parsePO(fs.readFileSync(inPath, "utf8"));
const outPath = process.argv[3] || inPath.replace(/\.po$/i, ".mo");
fs.writeFileSync(outPath, writeMO(cat));
console.log(`Compiled ${cat.items.length} entr(ies) -> ${outPath}`);
