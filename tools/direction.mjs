// direction.mjs — resolve text direction (rtl/ltr) for any BCP-47 language code.
// Uses the engine's own CLDR data via Intl.Locale when available, with a
// self-contained script/language table fallback. Pure, dependency-free.

const RTL_SCRIPTS = new Set(["Arab", "Aran", "Hebr", "Syrc", "Thaa", "Nkoo", "Adlm", "Rohg", "Mand", "Samr", "Mend", "Yezi", "Sogd", "Phlp", "Phnx", "Armi"]);
const RTL_LANGS = new Set(["ar", "he", "fa", "ur", "ps", "syr", "dv", "ckb", "sd", "ug", "yi", "nqo", "ks", "prs", "arc", "rhg", "az-arab"]);

export function parseSubtags(code) {
  const p = String(code || "").replace(/_/g, "-").split("-");
  const lang = (p[0] || "").toLowerCase();
  let script = "";
  for (let i = 1; i < p.length; i++) {
    if (/^[A-Za-z]{4}$/.test(p[i])) { script = p[i][0].toUpperCase() + p[i].slice(1).toLowerCase(); break; }
  }
  return { lang, script };
}
function fromIntl(code) {
  try {
    const l = new Intl.Locale(code);
    const t = typeof l.getTextInfo === "function" ? l.getTextInfo() : l.textInfo;
    if (t && (t.direction === "rtl" || t.direction === "ltr")) return t.direction;
  } catch (_) { /* ignore */ }
  return null;
}
export function fromTable(code) {
  const { lang, script } = parseSubtags(code);
  if (script) return RTL_SCRIPTS.has(script) ? "rtl" : "ltr";
  return RTL_LANGS.has(lang) ? "rtl" : "ltr";
}
export function resolveDirection(code, declared) {
  if (declared === "rtl" || declared === "ltr") return declared;
  return fromIntl(code) || fromTable(code);
}
