// verify-package.mjs — بوابة CI الخامسة: سلامة الحزمة قبل أي تسليم.
// تفحص: المانيفست (بنيته، صلاحياته المقتصرة على storage، وجود كل ملف يشير إليه)،
// ومصنوعات محرّك الاتجاه، وألّا يتسرب ملفٌ ممنوع إلى مجلد الإضافة.
import fs from "node:fs";
import path from "node:path";
import { EXT } from "./paths.mjs";

const errs = [];
function need(cond, msg) { if (!cond) errs.push(msg); }
function exists(rel) { return fs.existsSync(path.join(EXT, rel)); }

// ---- المانيفست ----
const mf = JSON.parse(fs.readFileSync(path.join(EXT, "manifest.json"), "utf8"));
need(mf.manifest_version === 3, "manifest_version يجب أن يكون 3");
need(/^\d+\.\d+\.\d+$/.test(mf.version || ""), "version ليس بصيغة x.y.z: " + mf.version);
need(Array.isArray(mf.permissions) && mf.permissions.length === 1 && mf.permissions[0] === "storage",
  "الصلاحيات يجب أن تبقى [storage] وحدها — وجدت: " + JSON.stringify(mf.permissions));
need(!mf.host_permissions, "لا host_permissions في هذه الإضافة");
// ★ (مراجعة الأمن) الصلاحيات وحدها لا تحدّ المدى: مانيفستٌ يوسَّع بأي طريقٍ أخرى كان
// يمرّ من هنا ثم يُحزَم ويُنشر. فكلُّ سطحٍ يوسّع المدى ممنوعٌ صراحةً، ونطاقاتُ المطابقة
// محصورةٌ في claude.ai — تغييرُ أيٍّ منها قرارٌ يُتَّخذ هنا بالتصريح لا بالمرور الصامت.
for (const k of ["optional_permissions", "optional_host_permissions", "externally_connectable",
                 "web_accessible_resources", "content_security_policy", "declarative_net_request"]) {
  need(!(k in mf), "المفتاح " + k + " يوسّع مدى الإضافة وليس في عقدها");
}
const ALLOWED_MATCH = new RegExp("^https://(?:(?:[a-z0-9-]+|\\*)\\.)?claude\\.ai/\\*$");
for (const cs of mf.content_scripts || []) {
  need(Array.isArray(cs.matches) && cs.matches.length > 0, "content_scripts بلا matches");
  for (const m of cs.matches) need(ALLOWED_MATCH.test(m), "نطاق مطابقة خارج claude.ai: " + m);
  need(!cs.match_about_blank && !cs.match_origin_as_fallback, "content_scripts تمتدّ إلى أُطرٍ خارج النطاق");
}
need(!mf.permissions.some((p) => /^(?:https?|file|ftp):|^\*|^<all_urls>$/.test(p)), "نطاق مضيف مدسوس في permissions");
need(mf.background && mf.background.service_worker === "sw.js", "background.service_worker يجب أن يكون sw.js");

// ---- حدود المتجر (فحص الإطلاق 2026-09-18، G16): رفضٌ صامت يُكتشف هنا لا في لوحة المطوّرين ----
need(typeof mf.name === "string" && mf.name.length <= 75, "name يتجاوز 75 حرفًا: " + (mf.name || "").length);
need(typeof mf.short_name === "string" && mf.short_name.length <= 16, "short_name يتجاوز 16 حرفًا");
need(typeof mf.description === "string" && mf.description.length <= 132, "description يتجاوز 132 حرفًا: " + (mf.description || "").length);
need(/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(mf.homepage_url || ""), "homepage_url مفقود أو ليس رابط المستودع");
for (const [size, file] of Object.entries(mf.icons || {})) {
  const fp = path.join(EXT, file);
  if (!fs.existsSync(fp)) continue; // يُبلَّغ عنه في فحص المراجع أدناه
  const b = fs.readFileSync(fp);
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
  need(String(w) === size && String(h) === size, "أبعاد الأيقونة " + file + " هي " + w + "×" + h + " لا " + size + "×" + size);
}

// كل ملف يشير إليه المانيفست موجود فعلًا
const refs = [];
for (const cs of mf.content_scripts || []) {
  for (const f of cs.js || []) refs.push(f);
  for (const f of cs.css || []) refs.push(f);
}
refs.push(mf.background.service_worker);
for (const k in mf.icons || {}) refs.push(mf.icons[k]);
if (mf.action) {
  if (mf.action.default_popup) refs.push(mf.action.default_popup);
  for (const k in mf.action.default_icon || {}) refs.push(mf.action.default_icon[k]);
}
if (mf.options_ui && mf.options_ui.page) refs.push(mf.options_ui.page);
for (const w of mf.web_accessible_resources || []) {
  for (const r of w.resources || []) if (!r.includes("*")) refs.push(r);
}
for (const r of refs) need(exists(r), "ملف يشير إليه المانيفست مفقود: " + r);

// وما يستورده عامل الخدمة (importScripts لا يمر بالمانيفست) — بعد إسقاط التعليقات:
// سطرٌ معلَّق فيه importScripts كان يُفشل البوابة على ملفٍ لا يُستورد أصلًا
const sw = fs.readFileSync(path.join(EXT, "sw.js"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
for (const m of sw.matchAll(/importScripts\(([^)]*)\)/g)) {
  for (const raw of m[1].split(",")) {
    const s = raw.trim();
    const q = /^["']([^"']+)["']$/.exec(s); // الحرفية المقتبسة وحدها تُفحص وجودًا
    if (q) need(exists(q[1]), "ملف يستورده عامل الخدمة مفقود: " + q[1]);
  }
}

// ---- مصنوعات محرّك الاتجاه ----
need(exists("rtl-overrides.css") && fs.statSync(path.join(EXT, "rtl-overrides.css")).size > 50000,
  "rtl-overrides.css مفقود أو هزيل");
try {
  await import(new URL("file:///" + path.join(EXT, "rtl-coverage.js").replace(/\\/g, "/")).href);
  need(globalThis.CMLRtlCoverage && globalThis.CMLRtlCoverage.keys.length > 500,
    "بصمات التغطية أقل من المتوقع: " + (globalThis.CMLRtlCoverage ? globalThis.CMLRtlCoverage.keys.length : 0));
} catch (e) { errs.push("rtl-coverage.js لا يُحمَّل: " + e.message); }

// ---- لا ممنوعات داخل مجلد الإضافة (قاعدة قائمة السماح تحرس النشر — وهذه تحرس CI) ----
// المشي **تعاودي**: مسحُ المستوى الأعلى وحده كان يُمرِّر pem مدسوسًا في icons/ (جُرِّب)
const FORBIDDEN = [/\.pem$/i, /\.crx$/i, /HANDOFF/i, /claude-ALL-strings/i, /en-US\.json$/i, /STORE-LISTING/i];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const fp = path.join(d, e.name);
    if (e.isDirectory()) { walk(fp); continue; }
    need(!FORBIDDEN.some((re) => re.test(e.name)), "ملف ممنوع داخل الإضافة: " + path.relative(EXT, fp));
  }
})(EXT);

if (errs.length) {
  console.error("✗ بوابة الحزمة أخفقت:");
  for (const e of errs) console.error("  - " + e);
  process.exit(1);
}
console.log(`✓ الحزمة سليمة: الإصدار ${mf.version} | صلاحيات [storage] | ${refs.length} ملفًا مُشارًا إليه كلها موجودة`);
