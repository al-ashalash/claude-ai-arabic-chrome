// serve-tests.mjs — خادم ملفات ثابت لصفحات الاختبار (لا file:// بسبب CORS)
// (وُطّن من مساحة العمل المؤقتة في المرحلة ٠ — 2026-08-29)
// خادم ملفات ثابت لصفحات اختبار claude-mutarjim (بلا تبعيات)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./paths.mjs";
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png" };

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  const fp = path.join(ROOT, url);
  if (!fp.startsWith(path.resolve(ROOT))) { res.writeHead(403); res.end(); return; }
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end("not found"); return; }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(fp)] || "application/octet-stream" });
    res.end(data);
  });
}).listen(8794, "127.0.0.1", () => console.log("serving on http://127.0.0.1:8794"));
