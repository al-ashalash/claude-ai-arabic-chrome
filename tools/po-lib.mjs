// po-lib.mjs — dependency-free gettext PO parser/serializer + MO reader/writer.
// لا يحتاج أي أدوات gettext على النظام. Pure JavaScript, Node only.

const EOT = String.fromCharCode(4); // gettext context separator: msgctxt <EOT> msgid
const NUL = String.fromCharCode(0); // gettext plural / form separator

// ---------- string escaping ----------
export function unescapePo(s) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\" && i + 1 < s.length) {
      const n = s[++i];
      out += n === "n" ? "\n" : n === "t" ? "\t" : n === "r" ? "\r"
        : n === '"' ? '"' : n === "\\" ? "\\" : n;
    } else out += c;
  }
  return out;
}
export function escapePo(s) {
  return String(s)
    .replace(/\\/g, "\\\\").replace(/"/g, '\\"')
    .replace(/\n/g, "\\n").replace(/\t/g, "\\t").replace(/\r/g, "\\r");
}
function quoted(line) {
  const a = line.indexOf('"'), b = line.lastIndexOf('"');
  if (a < 0 || b <= a) return "";
  return unescapePo(line.slice(a + 1, b));
}

// ---------- headers ----------
export function parseHeaders(block) {
  const headers = {};
  for (const line of String(block || "").split("\n")) {
    const m = line.match(/^([^:]+):\s?(.*)$/);
    if (m) headers[m[1].trim()] = m[2];
  }
  return headers;
}
export function serializeHeaders(headers) {
  const order = [
    "Project-Id-Version", "Report-Msgid-Bugs-To", "POT-Creation-Date",
    "PO-Revision-Date", "Last-Translator", "Language-Team", "Language",
    "MIME-Version", "Content-Type", "Content-Transfer-Encoding",
    "Plural-Forms", "X-Direction", "X-Source-Language", "X-Generator",
  ];
  const seen = new Set();
  const lines = [];
  for (const k of order) if (k in headers) { lines.push(`${k}: ${headers[k]}`); seen.add(k); }
  for (const k of Object.keys(headers)) if (!seen.has(k)) lines.push(`${k}: ${headers[k]}`);
  return lines.join("\n") + "\n";
}

// ---------- PO parse ----------
export function parsePO(text) {
  const lines = String(text).replace(/^﻿/, "").split(/\r?\n/);
  const items = [];
  let cur = null, field = null;
  const push = () => { if (cur) { items.push(cur); cur = null; field = null; } };
  const fresh = () => ({ comments: { translator: [], extracted: [], reference: [] }, msgctxt: null, msgid: null, msgid_plural: null, msgstr: [] });

  for (const line of lines) {
    if (line.trim() === "") { push(); continue; }
    if (line.startsWith("#")) {
      if (!cur) cur = fresh();
      if (line.startsWith("#.")) cur.comments.extracted.push(line.slice(2).trim());
      else if (line.startsWith("#:")) cur.comments.reference.push(line.slice(2).trim());
      else cur.comments.translator.push(line.slice(1).trim());
      continue;
    }
    if (!cur) cur = fresh();
    if (line.startsWith("msgctxt ")) { cur.msgctxt = quoted(line); field = "ctxt"; }
    else if (line.startsWith("msgid_plural ")) { cur.msgid_plural = quoted(line); field = "plural"; }
    else if (line.startsWith("msgid ")) { cur.msgid = quoted(line); field = "id"; }
    else if (line.startsWith("msgstr[")) {
      const m = line.match(/^msgstr\[(\d+)\]\s/); const idx = +m[1];
      cur.msgstr[idx] = quoted(line); field = "str" + idx;
    }
    else if (line.startsWith("msgstr ")) { cur.msgstr[0] = quoted(line); field = "str0"; }
    else if (line.startsWith('"')) {
      const v = quoted(line);
      if (field === "ctxt") cur.msgctxt += v;
      else if (field === "plural") cur.msgid_plural += v;
      else if (field === "id") cur.msgid += v;
      else if (field && field.startsWith("str")) { const k = +field.slice(3); cur.msgstr[k] = (cur.msgstr[k] || "") + v; }
    }
  }
  push();

  let headers = {}, headerIdx = -1;
  items.forEach((it, i) => { if (it.msgid === "") { headers = parseHeaders(it.msgstr[0] || ""); headerIdx = i; } });
  const body = items.filter((_, i) => i !== headerIdx);
  return { headers, items: body };
}

// ---------- PO serialize ----------
function emitString(kw, value) {
  const parts = String(value).split("\n");
  if (parts.length <= 1) return `${kw} "${escapePo(value)}"\n`;
  let out = `${kw} ""\n`;
  parts.forEach((p, i) => {
    const nl = i < parts.length - 1 ? "\\n" : "";
    out += `"${escapePo(p)}${nl}"\n`;
  });
  return out;
}
export function serializePO({ headers, items }) {
  let out = 'msgid ""\n' + emitString("msgstr", serializeHeaders(headers)) + "\n";
  for (const it of items) {
    for (const c of it.comments?.extracted || []) out += `#. ${c}\n`;
    for (const c of it.comments?.reference || []) out += `#: ${c}\n`;
    if (it.msgctxt != null) out += emitString("msgctxt", it.msgctxt);
    out += emitString("msgid", it.msgid ?? "");
    if (it.msgid_plural != null) {
      out += emitString("msgid_plural", it.msgid_plural);
      (it.msgstr.length ? it.msgstr : [""]).forEach((s, i) => { out += emitString(`msgstr[${i}]`, s ?? ""); });
    } else {
      out += emitString("msgstr", it.msgstr[0] ?? "");
    }
    out += "\n";
  }
  return out;
}

// ---------- MO read ----------
export function readMO(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  const magic = b.readUInt32LE(0);
  let le;
  if (magic === 0x950412de) le = true;
  else if (magic === 0xde120495) le = false;
  else throw new Error("Not a valid MO file (bad magic)");
  const u32 = (o) => (le ? b.readUInt32LE(o) : b.readUInt32BE(o));
  const n = u32(8), origOff = u32(12), transOff = u32(16);
  const entries = [];
  let headers = {};
  for (let i = 0; i < n; i++) {
    const oLen = u32(origOff + i * 8), oPtr = u32(origOff + i * 8 + 4);
    const tLen = u32(transOff + i * 8), tPtr = u32(transOff + i * 8 + 4);
    const key = b.toString("utf8", oPtr, oPtr + oLen);
    const val = b.toString("utf8", tPtr, tPtr + tLen);
    if (key === "") { headers = parseHeaders(val); continue; }
    let msgctxt = null, rest = key;
    const ci = key.indexOf(EOT);
    if (ci >= 0) { msgctxt = key.slice(0, ci); rest = key.slice(ci + 1); }
    const pi = rest.indexOf(NUL);
    const msgid = pi >= 0 ? rest.slice(0, pi) : rest;
    const msgid_plural = pi >= 0 ? rest.slice(pi + 1) : null;
    const msgstr = val.split(NUL);
    entries.push({ comments: { translator: [], extracted: [], reference: [] }, msgctxt, msgid, msgid_plural, msgstr });
  }
  return { headers, items: entries };
}

// ---------- MO write (little-endian; mirrors the proven compile-po.ps1) ----------
export function writeMO({ headers, items }) {
  const pairs = [{ key: "", val: serializeHeaders(headers) }];
  for (const it of items) {
    if (it.msgid == null) continue;
    let key = it.msgid;
    if (it.msgid_plural != null) key = it.msgid + NUL + it.msgid_plural;
    if (it.msgctxt != null) key = it.msgctxt + EOT + key;
    const val = it.msgid_plural != null
      ? (it.msgstr.length ? it.msgstr : [""]).join(NUL)
      : (it.msgstr[0] ?? "");
    const first = it.msgid_plural != null ? (it.msgstr[0] ?? "") : val;
    if (it.msgid !== "" && !first) continue; // skip untranslated
    pairs.push({ key, val });
  }
  pairs.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  const N = pairs.length;
  const keyB = pairs.map((p) => Buffer.from(p.key, "utf8"));
  const valB = pairs.map((p) => Buffer.from(p.val, "utf8"));
  const dataStart = 28 + 16 * N;
  let off = dataStart;
  const oOff = [], tOff = [];
  for (let i = 0; i < N; i++) { oOff[i] = off; off += keyB[i].length + 1; }
  for (let i = 0; i < N; i++) { tOff[i] = off; off += valB[i].length + 1; }

  const out = Buffer.alloc(off);
  out.writeUInt32LE(0x950412de, 0);   // magic
  out.writeUInt32LE(0, 4);            // revision
  out.writeUInt32LE(N, 8);            // number of strings
  out.writeUInt32LE(28, 12);          // originals table offset
  out.writeUInt32LE(28 + 8 * N, 16);  // translations table offset
  out.writeUInt32LE(0, 20);           // hash size
  out.writeUInt32LE(dataStart, 24);   // hash offset (unused)
  let p = 28;
  for (let i = 0; i < N; i++) { out.writeUInt32LE(keyB[i].length, p); out.writeUInt32LE(oOff[i], p + 4); p += 8; }
  for (let i = 0; i < N; i++) { out.writeUInt32LE(valB[i].length, p); out.writeUInt32LE(tOff[i], p + 4); p += 8; }
  for (let i = 0; i < N; i++) { keyB[i].copy(out, oOff[i]); out[oOff[i] + keyB[i].length] = 0; }
  for (let i = 0; i < N; i++) { valB[i].copy(out, tOff[i]); out[tOff[i] + valB[i].length] = 0; }
  return out;
}
