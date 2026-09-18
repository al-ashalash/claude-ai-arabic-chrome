// ui-text.mjs — استخراجُ نصوص واجهة الإضافة نفسِها (صفحة الخيارات والنافذة المنبثقة ورسائل
// الحالة) ليُراجَع أسلوبُها ومصطلحُها على قاعدة المصطلحات — لا تُترجم، فهي عربيةٌ أصلًا.
import fs from "node:fs";
import path from "node:path";
import { EXT, GLOSSARY } from "./paths.mjs";

const strip = (html) => html
  .replace(/<style[\s\S]*?<\/style>/g, "").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<!--[\s\S]*?-->/g, "")
  .replace(/<[^>]+>/g, "\n").split("\n").map((s) => s.replace(/\s+/g, " ").trim()).filter((s) => s && /[؀-ۿ]/.test(s));
const options = strip(fs.readFileSync(path.join(EXT, "options.html"), "utf8"));
const popup = strip(fs.readFileSync(path.join(EXT, "popup.html"), "utf8"));
const js = fs.readFileSync(path.join(EXT, "options.js"), "utf8") + "\n" + fs.readFileSync(path.join(EXT, "popup.js"), "utf8");
const re = /"((?:[^"\\]|\\.)*[؀-ۿ](?:[^"\\]|\\.)*)"/g;
const jsMessages = [...new Set([...js.matchAll(re)].map((m) => m[1]).filter((s) => s.length > 8))];
const out = path.join(GLOSSARY, "_ui-review");
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "ui-text.json"), JSON.stringify({ options, popup, jsMessages }, null, 1), "utf8");
console.log(`options.html: ${options.length} سطرًا (${options.join(" ").length} حرفًا) | popup: ${popup.length} | رسائل JS: ${jsMessages.length}`);
