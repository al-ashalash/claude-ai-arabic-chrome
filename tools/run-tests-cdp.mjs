// run-tests-cdp.mjs — مشغّل الاختبارات المتصفحية بلا واجهة وبلا npm (المرحلة ٥).
//
// يشغّل كروم Headless عبر بروتوكول DevTools (CDP) مباشرةً: خادمُ ملفاتٍ مدمجٌ على
// منفذٍ عشوائي، ثم فتحُ كل صفحة اختبار وقراءةُ عنوانها — والعقدُ الواحد في كل
// الصفحات: العنوان «اسم N/N» ولا ينجح إلا بتساوي الطرفين. لا تبعيات: WebSocket
// مدمجة في Node منذ 22 (نفحصها ونصرّح إن غابت).
//
//   node run-tests-cdp.mjs [--filter=swtest] [--chrome="مسار كروم"]
// متغيرات البيئة: CHROME (مسار المتصفح)، CI (يضيف --no-sandbox لعدّائي CI).
// رمز الخروج: 0 كله ناجح، 1 إخفاق أو تعذّر تشغيل.
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { ROOT } from "./paths.mjs";

if (typeof WebSocket === "undefined") {
  console.error("! يلزم Node 22+ (فيه WebSocket مدمجة) — الحالي: " + process.version);
  process.exit(1);
}

// ---- صفحات الاختبار: الاسم في العنوان هو العقد؛ الأعداد تُقرأ لا تُثبَّت ----
const PAGES = [
  { file: "_selftest.html", name: "selftest" },
  { file: "_ruletest.html", name: "ruletest" },
  { file: "_dirtest.html", name: "dirtest" },
  { file: "_termstest.html", name: "terms" },
  { file: "_scantest.html", name: "scan" },
  { file: "_scanlocktest.html", name: "scanlock" },
  { file: "_swtest.html", name: "swtest" },
  { file: "_rtltest.html", name: "rtltest" },
  { file: "_synctest.html", name: "synctest" },
  { file: "_thumbtest.html", name: "thumbtest" },
];
const filterArg = process.argv.find((a) => a.startsWith("--filter="));
const FILTER = filterArg ? filterArg.split("=")[1] : null;
const chromeArg = process.argv.find((a) => a.startsWith("--chrome="));
const RUN_PAGES = FILTER ? PAGES.filter((p) => p.name.includes(FILTER) || p.file.includes(FILTER)) : PAGES;
if (!RUN_PAGES.length) { console.error("! لا صفحة تطابق المرشِّح: " + FILTER); process.exit(1); }

// جذر الخدمة يصمد في البنيتين: مجلد العمل (web/code/test) والنشر (test/)
const TESTDIR = fs.existsSync(path.join(ROOT, "code", "test")) ? "code/test" : "test";

// ---- 1) اعثر على كروم ----
function findChrome() {
  // مسارٌ صريح (--chrome أو CHROME) غيرُ موجود = خطأٌ صريح — كان يسقط بصمت إلى
  // متصفح النظام فتجري الاختبارات على غير ما طُلب وتوهم النتيجة
  const explicit = (chromeArg && chromeArg.split("=").slice(1).join("=")) || process.env.CHROME;
  if (explicit) {
    if (fs.existsSync(explicit)) return explicit;
    console.error("! المسار الصريح للمتصفح غير موجود: " + explicit);
    process.exit(1);
  }
  const candidates = [
    // ويندوز
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    (process.env.LOCALAPPDATA || "") + "/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    // لينكس (عدّاؤو CI) وماك
    "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium-browser", "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c; } catch {}
  }
  return null;
}

// ---- 2) خادم الملفات المدمج (منفذ عشوائي — لا يزاحم خادم التطوير 8794) ----
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png" };
function startServer() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      // ترميزٌ مشوّه كان يرمي URIError غير ملتقطة فيقتل المشغّل كله بلا تنظيف
      let url;
      try { url = decodeURIComponent(req.url.split("?")[0]); }
      catch { res.writeHead(400); res.end(); return; }
      const fp = path.join(ROOT, url);
      const base = path.resolve(ROOT);
      // حدُّ المسار بفاصلٍ لاحق: startsWith وحدها كانت تُخرج مجلدًا شقيقًا يشارك البادئة
      if (fp !== base && !fp.startsWith(base + path.sep)) { res.writeHead(403); res.end(); return; }
      fs.readFile(fp, (err, data) => {
        if (err) { res.writeHead(404); res.end("not found"); return; }
        res.writeHead(200, { "Content-Type": TYPES[path.extname(fp)] || "application/octet-stream" });
        res.end(data);
      });
    });
    srv.listen(0, "127.0.0.1", () => resolve(srv));
  });
}

// ---- 3) عميل CDP خام فوق WebSocket المدمجة ----
function connectCdp(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let nextId = 1, dead = false;
    const pending = new Map();
    // موتُ كروم أو سقوطُ القناة وسط التشغيل كان يترك وعود send معلقةً إلى الأبد —
    // حتى سقفُ الصفحة (60ث) عالقٌ على await نفسِه. الإغلاق يرفض المعلّق كله فورًا.
    function die(msg) {
      if (dead) return;
      dead = true;
      for (const { rej } of pending.values()) rej(new Error(msg));
      pending.clear();
    }
    ws.onopen = () => resolve({ send, close: () => { try { ws.close(); } catch {} } });
    ws.onerror = (e) => { reject(new Error("تعذّر الاتصال بـCDP: " + (e && e.message))); die("سقطت قناة CDP"); };
    ws.onclose = () => die("أُغلقت قناة CDP (مات المتصفح؟)");
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.id && pending.has(m.id)) {
        const { res, rej } = pending.get(m.id);
        pending.delete(m.id);
        m.error ? rej(new Error(m.error.message || JSON.stringify(m.error))) : res(m.result);
      }
      // الأحداث لا تعنينا: نستطلع العنوان استطلاعًا — أبسط وأصلب من انتظار أحداث التحميل
    };
    function send(method, params, sessionId) {
      return new Promise((res, rej) => {
        if (dead) return rej(new Error("قناة CDP ميتة"));
        const id = nextId++;
        pending.set(id, { res, rej });
        ws.send(JSON.stringify(sessionId ? { id, method, params: params || {}, sessionId } : { id, method, params: params || {} }));
      });
    }
  });
}

// ---- 4) التشغيل ----
const chrome = findChrome();
if (!chrome) {
  console.error("! لم أجد كروم/كروميوم. مرّر المسار: --chrome=... أو متغير البيئة CHROME.");
  process.exit(1);
}
const server = await startServer();
const port = server.address().port;
const udd = fs.mkdtempSync(path.join(os.tmpdir(), "cml-cdp-"));
const args = [
  "--headless=new", "--remote-debugging-port=0", `--user-data-dir=${udd}`,
  "--no-first-run", "--no-default-browser-check", "--disable-gpu",
  "--disable-extensions", "--mute-audio",
];
if (process.env.CI) args.push("--no-sandbox", "--disable-dev-shm-usage");
const proc = spawn(chrome, args, { stdio: ["ignore", "ignore", "pipe"] });
let stderrBuf = "";
proc.stderr.on("data", (d) => { stderrBuf += d; });

function cleanup(code) {
  try { server.close(); } catch {}
  // انتظر خروج كروم فعلًا (لا مهلة عمياء): على ويندوز تبقى أقفال ملفاته بعد kill
  // لعشرات المللي ثانية فكان مجلد الملف الشخصي المؤقت يتسرب حتى في الخروج السليم —
  // ثم أعِد المحاولة بتراجعٍ لأن التحرير قد يتأخر عن حدث الخروج نفسه.
  const exited = new Promise((r) => {
    if (proc.exitCode !== null) return r();
    proc.once("exit", r);
    setTimeout(r, 5000); // سقف — لا ننتظر معلَّقًا إلى الأبد
    try { proc.kill(); } catch {}
  });
  exited.then(async () => {
    for (let i = 0; i < 5; i++) {
      try { fs.rmSync(udd, { recursive: true, force: true }); break; }
      catch { await new Promise((r) => setTimeout(r, 200 * (i + 1))); }
    }
    process.exit(code);
  });
}
process.on("SIGINT", () => cleanup(1));

// عنوان CDP يُقرأ من ملف DevToolsActivePort داخل مجلد الملف الشخصي المؤقت
async function browserWsUrl() {
  const f = path.join(udd, "DevToolsActivePort");
  for (let i = 0; i < 100; i++) {
    if (proc.exitCode !== null) throw new Error("كروم خرج مبكرًا (" + proc.exitCode + "): " + stderrBuf.slice(-400));
    try {
      const [p, wsPath] = fs.readFileSync(f, "utf8").split("\n");
      if (p && wsPath) return `ws://127.0.0.1:${p.trim()}${wsPath.trim()}`;
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("لم يكتب كروم DevToolsActivePort خلال 15 ثانية. " + stderrBuf.slice(-400));
}

let failures = 0;
try {
  const cdp = await connectCdp(await browserWsUrl());
  const pages = RUN_PAGES;
  console.log(`المتصفح: ${path.basename(chrome)} | الخادم: 127.0.0.1:${port}/${TESTDIR} | صفحات: ${pages.length}\n`);

  for (const pg of pages) {
    const url = `http://127.0.0.1:${port}/${TESTDIR}/${pg.file}?cdp`;
    const t0 = Date.now();
    const { targetId } = await cdp.send("Target.createTarget", { url });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    let title = "", verdict = "مهلة", stable = 0, last = "";
    const RE = new RegExp("^" + pg.name + " (\\d+)/(\\d+)$"); // مرساة $: الوسطية تحمل «…» فلا تطابق
    for (let i = 0; i < 240; i++) { // 240 × 250ms = 60ث سقفًا للصفحة
      await new Promise((r) => setTimeout(r, 250));
      try {
        const ev = await cdp.send("Runtime.evaluate", { expression: "document.title", returnByValue: true }, sessionId);
        title = (ev && ev.result && ev.result.value) || "";
      } catch { continue; }
      const m = RE.exec(title);
      if (!m) { stable = 0; last = ""; continue; }
      // العقد: العنوان الختامي وحده «اسم N/N» حرفًا بحرف — والوسطيةُ تُلحق «…»
      // فتُقصيها مرساةُ $ بنيويًّا (كانت «27/27» الوسطية المتساوية تخدع النافذة).
      // نافذة ثبات قصيرة تبقى دفاعًا عن أي كتابة متزامنة مع القراءة.
      if (title === last) { stable++; } else { stable = 0; last = title; }
      if (stable >= 4) { verdict = m[1] === m[2] && +m[2] > 0 ? "نجح" : "أخفق"; break; }
    }
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    const ok = verdict === "نجح";
    if (!ok) failures++;
    console.log(`${ok ? "✓" : "✗"} ${pg.file.padEnd(20)} ${title || "(بلا عنوان)"} — ${verdict} (${secs}ث)`);
    // ‎--dump: نص الصفحة للتشخيص (يُطبع دومًا عند الإخفاق أيضًا — عدّاء CI لا شاشة له)
    if (process.argv.includes("--dump") || !ok) {
      try {
        const bt = await cdp.send("Runtime.evaluate", { expression: "document.body.innerText.slice(-1500)", returnByValue: true }, sessionId);
        console.log("---- نص الصفحة ----\n" + ((bt.result && bt.result.value) || "") + "\n-------------------");
      } catch {}
    }
    try { await cdp.send("Target.closeTarget", { targetId }); } catch {}
  }
  console.log(failures ? `\n✗ أخفقت ${failures} صفحة` : "\n✓ الصفحات كلها خضراء");
  try { await cdp.send("Browser.close"); } catch {}
} catch (e) {
  console.error("✗ " + (e && e.message ? e.message : e));
  failures = failures || 1;
}
cleanup(failures ? 1 : 0);
