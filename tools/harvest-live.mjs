// harvest-live.mjs — حصادٌ حيٌّ من حزم claude.ai العامة بمنطق فحص الإضافة نفسِه،
// ثم فرزُ ما لم يُترجَم بعدُ إلى دفعاتٍ جاهزة للترجمة.
//
// لماذا هنا لا في المتصفح: الفحص في الإضافة يخدم المستخدم (قائمة يراها)، وهذا يخدم
// المشرف (ملفاتُ عملٍ للترجمة). والمنطق واحدٌ عمدًا — فكِّ الحرفيات من cml-shared،
// وعتبات النص من cml-const، والمرشِّحات نفسها — كي لا يترجم أحدُهما ما يرفضه الآخر.
//
//   node harvest-live.mjs [--entry=<اسم ملف الدخول>] [--batch=650]
// المخرجات في code/glossary/: ‎_live-catalog.txt وليس في النشر (مادة الموقع خام).
import fs from "node:fs";
import path from "node:path";
import { GLOSSARY, DICTS, EXT } from "./paths.mjs";

await import(new URL("file:///" + path.join(EXT, "cml-const.js").split(path.sep).join("/")).href);
await import(new URL("file:///" + path.join(EXT, "cml-shared.js").split(path.sep).join("/")).href);
const CONST = globalThis.CMLConst, SHARED = globalThis.CMLShared;

const BASE = "https://assets-proxy.anthropic.com/claude-ai/v2/assets/v1/";
const entryArg = process.argv.find((a) => a.startsWith("--entry="));
const batchArg = process.argv.find((a) => a.startsWith("--batch="));
const BATCH = batchArg ? parseInt(batchArg.split("=")[1], 10) : 650;

// ملف الدخول: يُمرَّر، أو يُكتشف من صفحة الدخول العامة
let seed = entryArg ? entryArg.split("=")[1] : null;
if (!seed) {
  const html = await fetch("https://claude.ai/login", {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129.0.0.0 Safari/537.36" },
  }).then((r) => (r.ok ? r.text() : "")).catch(() => "");
  const m = html.match(/assets\/v1\/(index-[A-Za-z0-9_-]+\.js)/);
  if (m) seed = m[1];
}
if (!seed) { console.error("! تعذّر اكتشاف ملف الدخول — مرّره: --entry=index-XXXX.js"); process.exit(1); }
console.log("ملف الدخول:", seed);

// ---- الزحف (كما في المحرك: معبّر الإشارات نفسه، وتوازٍ محدود) ----
const REF = /[A-Za-z0-9_]+-[A-Za-z0-9_-]{6,}\.js/g;
const DM = /(?:"?defaultMessage"?):\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/g;
const CTRL_RE = new RegExp("[\\u0000-\\u001f\\u007f]");
const seen = new Set([seed]), queue = [seed], msgs = new Set();
let ok = 0, ghosts = 0, failed = 0;
// ★ المنشأ: أي حزمةٍ حملت كل نصّ (لحزمة «النصوص بمواضعها» المُعدَّة لفريق الموقع)، وأسماءُ
// ملفات CSS المُشار إليها في الحزم (لتجديد لقطة sitecss عند تغيّر أسمائها المُجزّأة)
const PROV = process.argv.includes("--prov");
const prov = new Map(), cssRefs = new Set();
const CSS_REF = /[A-Za-z0-9_]+-[A-Za-z0-9_-]{6,}\.css/g;

function chew(tx, name) {
  for (const m of tx.match(REF) || []) if (!seen.has(m)) { seen.add(m); queue.push(m); }
  for (const c of tx.match(CSS_REF) || []) cssRefs.add(c);
  let m;
  DM.lastIndex = 0;
  while ((m = DM.exec(tx))) {
    let s = SHARED.unescapeLiteral(m[1] != null ? m[1] : m[2], m[1] == null);
    if (s === null) continue;
    s = s.replace(/\s+/g, " ").trim();
    if (!s || s.length < 2 || s.length > CONST.TEXT_MAX) continue;
    if (!/[A-Za-z]/.test(s)) continue;
    if (CTRL_RE.test(s)) continue;
    if (/^[#\/]|^\d|https?:|www\.|[@\\^~`|=]/.test(s) || /^[a-z]+([A-Z][a-z]+)+$/.test(s) || (/_/.test(s) && !/ /.test(s))) continue;
    if (/\{[^{}]*,\s*(plural|select|selectordinal)\s*,/.test(s)) continue;
    if (/<\/?[A-Za-z][^>]*>/.test(s)) continue;
    if (/\{/.test(s) && !/^[^{}]*(\{[A-Za-z_$][\w$]*\}[^{}]*)+$/.test(s)) continue;
    msgs.add(s);
    if (PROV) { const a = prov.get(s); if (a) { if (a.length < 4 && !a.includes(name)) a.push(name); } else prov.set(s, [name]); }
  }
}
while (queue.length) {
  const batch = queue.splice(0, 12);
  const texts = await Promise.all(batch.map((n) =>
    fetch(BASE + n).then((r) => (r.ok ? r.text() : (r.status === 404 ? null : undefined))).catch(() => undefined)));
  for (const [i, t] of texts.entries()) {
    if (t === null) ghosts++;
    else if (t === undefined) failed++;
    else { ok++; chew(t, batch[i]); }
  }
  if (ok % 300 < 12) process.stdout.write(`\rملفات: ${ok} | طابور: ${queue.length} | نصوص: ${msgs.size}   `);
}
console.log(`\nحُصد: ${ok} ملفًا (${ghosts} إشارة وهمية، ${failed} إخفاق) | نصوص الواجهة: ${msgs.size}`);

// ---- الفرز: ما لم يُترجَم بعدُ ولا يغطيه نمطٌ ولا جمع ----
const d = JSON.parse(fs.readFileSync(path.join(DICTS, "ar.json"), "utf8"));
const strings = d.strings || {};
const pats = (d.patterns || []).map((p) => { try { return new RegExp(p.re); } catch { return null; } }).filter(Boolean);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const plurRes = [];
for (const [en, spec] of Object.entries(d.plurals || {}))
  for (const pat of [en, spec.plural]) if (pat) plurRes.push(new RegExp("^" + esc(pat).replace("%d", "(\\d+)") + "$"));

const missing = [...msgs].filter((s) =>
  strings[s] === undefined && !pats.some((re) => re.test(s)) && !plurRes.some((re) => re.test(s))).sort();

fs.mkdirSync(GLOSSARY, { recursive: true });
fs.writeFileSync(path.join(GLOSSARY, "_live-catalog.txt"), [...msgs].sort().join("\n") + "\n", "utf8");
fs.writeFileSync(path.join(GLOSSARY, "_live-missing.txt"), missing.join("\n") + "\n", "utf8");
if (PROV) {
  fs.writeFileSync(path.join(GLOSSARY, "_live-provenance.json"), JSON.stringify({
    entry: seed, base: BASE, harvested: ok, css: [...cssRefs].sort(),
    strings: Object.fromEntries([...prov.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
  }), "utf8");
  console.log(`المنشأ: ${prov.size} نصًّا بحزمها، و${cssRefs.size} ملف CSS مُشارًا إليه → _live-provenance.json`);
}

// دفعات مرقّمة: نصوصٌ ثابتة ونصوصٌ بمتغيّرات مفصولة (لكلٍّ عقدُ ترجمةٍ مختلف)
const plain = missing.filter((s) => !/\{[A-Za-z_$][\w$]*\}/.test(s));
const vars = missing.filter((s) => /\{[A-Za-z_$][\w$]*\}/.test(s));
const outDir = path.join(GLOSSARY, "_live_batches");
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
let n = 0;
for (const [kind, list] of [["plain", plain], ["vars", vars]]) {
  for (let i = 0; i < list.length; i += BATCH) {
    const slice = list.slice(i, i + BATCH);
    fs.writeFileSync(path.join(outDir, `${kind}_${String(n).padStart(2, "0")}.txt`), slice.join("\n") + "\n", "utf8");
    n++;
  }
}
console.log(`غير مترجَم: ${missing.length} (ثابت ${plain.length} · بمتغيّرات ${vars.length}) → ${n} دفعة في code/glossary/_live_batches/`);
