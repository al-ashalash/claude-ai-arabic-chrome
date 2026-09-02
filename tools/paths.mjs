// paths.mjs — مسارات نسخة النشر (البنية سطحية: extension/ و dictionaries/ في الجذر)
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
// ROOT مُصدَّر: serve-tests.mjs يستورده جذرًا للخدمة (بلا تصديرٍ كان ينهار)
export const ROOT = path.resolve(HERE, "..");
export const EXT = path.join(ROOT, "extension");
export const DICTS = path.join(ROOT, "dictionaries");
export const GLOSSARY = path.join(ROOT, "glossary");
export const LANGUAGES_JSON = path.join(HERE, "languages.json");
