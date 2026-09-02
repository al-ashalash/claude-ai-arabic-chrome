// dict-lib.mjs — convert between the human-editable dictionary JSON
// (user/dictionaries/<lang>.json) and a gettext catalog (po-lib shape).
import { resolveDirection } from "./direction.mjs";

const PLURAL_FORMS = {
  ar: "nplurals=6; plural=(n==0 ? 0 : n==1 ? 1 : n==2 ? 2 : n%100>=3 && n%100<=10 ? 3 : n%100>=11 ? 4 : 5);",
  he: "nplurals=3; plural=(n==1 ? 0 : n==2 ? 1 : 2);",
  fa: "nplurals=2; plural=(n > 1);",
  ur: "nplurals=2; plural=(n != 1);",
  es: "nplurals=2; plural=(n != 1);",
  en: "nplurals=2; plural=(n != 1);",
};
export function pluralFormsFor(lang) { return PLURAL_FORMS[lang] || "nplurals=2; plural=(n != 1);"; }

// dictionary JSON  ->  gettext catalog
export function jsonToCatalog(dict) {
  const m = dict._meta || {};
  const lang = m.language || "";
  const dir = resolveDirection(lang, m.direction);
  const headers = {
    "Project-Id-Version": "claude-mutarjim 1.0",
    "Report-Msgid-Bugs-To": "ashalash@msn.com",
    "PO-Revision-Date": new Date().toISOString().replace("T", " ").slice(0, 16) + "+0000",
    "Last-Translator": m.lastTranslator || "",
    "Language-Team": m.languageNameEnglish || lang,
    "Language": lang,
    "MIME-Version": "1.0",
    "Content-Type": "text/plain; charset=UTF-8",
    "Content-Transfer-Encoding": "8bit",
    "Plural-Forms": m.pluralForms || pluralFormsFor(lang),
    "X-Direction": dir,
    "X-Source-Language": m.sourceLanguage || "en",
    "X-Generator": "claude-mutarjim 1.0",
  };
  const notes = dict.notes || {};
  const items = [];
  for (const [msgid, msgstr] of Object.entries(dict.strings || {})) {
    const note = notes[msgid];
    items.push({
      comments: { translator: [], extracted: note ? [note] : [], reference: [] },
      msgctxt: null, msgid, msgid_plural: null, msgstr: [String(msgstr)],
    });
  }
  for (const [msgid, spec] of Object.entries(dict.plurals || {})) {
    items.push({
      comments: { translator: [], extracted: notes[msgid] ? [notes[msgid]] : [], reference: [] },
      msgctxt: null, msgid, msgid_plural: spec.plural, msgstr: (spec.forms || []).map(String),
    });
  }
  return { headers, items };
}

// gettext catalog  ->  dictionary JSON
export function catalogToJson(cat, opts = {}) {
  const h = cat.headers || {};
  const lang = opts.language || h["Language"] || "";
  const dir = resolveDirection(lang, h["X-Direction"]);
  const strings = {}, plurals = {}, notes = {};
  for (const it of cat.items || []) {
    if (it.msgid == null || it.msgid === "") continue;
    const note = (it.comments?.extracted || []).join(" | ");
    if (it.msgid_plural != null) {
      plurals[it.msgid] = { plural: it.msgid_plural, forms: (it.msgstr || []).map(String) };
    } else {
      const v = it.msgstr?.[0] ?? "";
      if (v !== "") strings[it.msgid] = v;
    }
    if (note) notes[it.msgid] = note;
  }
  const dict = {
    _meta: {
      language: lang,
      direction: dir,
      languageNameEnglish: opts.languageNameEnglish || h["Language-Team"] || lang,
      languageNameNative: opts.languageNameNative || lang,
      sourceLanguage: h["X-Source-Language"] || "en",
      version: "1.0.0",
      pluralForms: h["Plural-Forms"] || pluralFormsFor(lang),
    },
    _guide: {
      ar: "أضِف سطرًا داخل strings: \"النص الإنجليزي\": \"العربية\". ثم شغّل تحديث-الإضافة.",
      en: "Add a line inside strings: \"English\": \"translation\". Then run rebuild.",
    },
    strings, plurals, notes,
  };
  return dict;
}
