// gen-icons.mjs — يكتب أيقونات الإضافة (16/32/48/128) من ناتج `icon-render.html`.
//
// ★ الأيقونة حرفُ «ع» على طينيّ كلود (#D97757).
//   - **اللون** يدلّ على أن الإضافة **لكلود** — قرار صاحب المشروع.
//   - **التمييز محمولٌ على الحرف لا اللون**: «ع» علامةٌ عربية لا تشبه نجمة كلود
//     الشعاعية في شيء، واسم الإضافة يحمل «(غير رسمي)» صراحةً، والوصف يصرّح بالاستقلال.
//     فلا إيهام بالانتساب، وهو ما تمنعه سياسة المتجر.
//
// ★ لماذا لا يُرسم الحرف هنا حسابيًّا؟ رسم حرفٍ عربي بمنحنياتٍ مُقدَّرة يُخرج شكلًا
//   مشوَّهًا. فالرسم يجري في `icon-render.html` بخطٍّ حقيقي في المتصفح، وهذا الملف
//   يكتب ناتجه ملفاتِ PNG. الخطوات:
//
//     1) شغّل خادم ملفات ثابت على جذر `web/`.
//     2) افتح `/code/toolchain/icon-render.html` وعايِن الأحجام الأربعة.
//     3) في وحدة التحكم:  copy(JSON.stringify(window.__icons))
//     4) الصقه في ملف، ثم:  node code/toolchain/gen-icons.mjs <الملف>
//
//   وإن لم يُمرَّر ملف، يُطبع الشرح ويخرج — لأن الكتابة بلا مصدرٍ تمحو أيقونات سليمة.

import fs from "node:fs";
import path from "node:path";
import { EXT } from "./paths.mjs";

const SIZES = [16, 32, 48, 128];
const src = process.argv[2];

if (!src) {
  console.log(`
الاستعمال:  node code/toolchain/gen-icons.mjs <ملف-json>

الملف يحوي ناتج window.__icons من code/toolchain/icon-render.html:
  {"16":"<base64>","32":"…","48":"…","128":"…"}

افتح icon-render.html عبر خادم ملفات ثابت، عايِن الأحجام، ثم:
  copy(JSON.stringify(window.__icons))
`);
  process.exit(0);
}

let payload;
try { payload = JSON.parse(fs.readFileSync(src, "utf8")); }
catch (e) { console.error(`! تعذّرت قراءة ${src}: ${e.message}`); process.exit(1); }

const missing = SIZES.filter((s) => !payload[s]);
if (missing.length) { console.error(`! أحجام ناقصة: ${missing.join(", ")} — لم يُكتب شيء.`); process.exit(1); }

const dir = path.join(EXT, "icons");
fs.mkdirSync(dir, { recursive: true });
for (const s of SIZES) {
  const buf = Buffer.from(payload[s], "base64");
  // فحص توقيع PNG قبل الكتابة: بياناتٌ تالفة تكتب ملفًا يرفضه المتجر بلا رسالة مفهومة
  if (!(buf[0] === 137 && buf[1] === 80 && buf[2] === 78 && buf[3] === 71)) {
    console.error(`! الحجم ${s}: ليس PNG صالحًا — لم يُكتب شيء.`); process.exit(1);
  }
  fs.writeFileSync(path.join(dir, `icon${s}.png`), buf);
  console.log(`+ icon${s}.png (${buf.length} بايت)`);
}
console.log("الأيقونات كُتبت في", dir);
