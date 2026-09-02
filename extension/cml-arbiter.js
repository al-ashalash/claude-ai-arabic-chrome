/* cml-arbiter.js — محكّم الزحف: النسخة الواحدة من منطق «منحة واحدة لا غير»
 * (المرحلة ٤ من خطة الإطلاق — الفحص 2.0).
 *
 * لماذا: كان التنافس بين تبويبات claude.ai على الزحف يُحسم بمفتاح حجز في التخزين —
 * «اكتب هويتك ثم اقرأ» ليست ذرّية، فاحتاجت مهلةً عشوائية ضد الفوز المزدوج، وطابعَ
 * تقادم (90ث) ضد الحجز اليتيم، وتجديدًا دوريًّا، وفحصَ ملكيةٍ كل عشر دفعات — أربع
 * رقاعٍ فوق سباقٍ بنيوي. عاملُ الخدمة يعالج رسائله **واحدةً واحدة في خيط واحد**،
 * فأول «طلب منحة» يصل يفوز والباقي يُرفض — لا سباق أصلًا، ولا طوابع، ولا تقادم:
 * حياةُ المنحة هي حياةُ منفذها (أُغلق التبويب ⇒ انقطع المنفذ ⇒ حُرِّرت المنحة فورًا
 * — لا انتظار 90 ثانية). والحجز القديم باقٍ طبقةَ سقوطٍ حيث لا عامل خدمة
 * (قشور الاختبار، سياقٌ أبطله تحديث الإضافة) — وتحرسه اختبارات القفل القائمة.
 *
 * العقد (رسائل المنفذ cml-crawl):
 *   ← {type:"claim", kind:"scan"|"rtl"}   طلب المنحة (إعادة الطلب من صاحبها تجديد)
 *   → {type:"grant"} | {type:"deny", kind} الحكم — والرفض يحمل نوعَ الشاغل
 *   ← {type:"release"}                     تسليم طوعي (نهاية الزحف أو إجهاضه)
 *   ← {type:"beat"}                        نبضة أثناء الزحف (تُحدّث at وتُبقي العامل حيًّا)
 *   واستعلام الحالة رسالة runtime مفردة: {type:"status"} → {busy, kind, at}
 *
 * ثنائي الاستخدام: لا import/export — يستهلكه sw.js عبر importScripts
 * و_swtest.html سكربتًا عاديًّا (بمنافذ مقلَّدة تعيد تمثيل سيناريوهات التبويبات).
 */
(function (g) {
  "use strict";

  function createArbiter(now) {
    now = now || function () { return Date.now(); };
    var grant = null; // {port, kind, at} — الذاكرة هي الحقيقة؛ لا مرآة تخزين تتقادم

    function attach(port) {
      port.onMessage.addListener(function (msg) {
        if (!msg || typeof msg !== "object") return;
        if (msg.type === "claim") {
          if (grant && grant.port !== port) {
            try { port.postMessage({ type: "deny", kind: grant.kind }); } catch (e) {}
            return;
          }
          // منحة جديدة — أو تجديدٌ من صاحبها نفسه (استئناف بعد موت عامل الخدمة).
          // التجديدُ يحفظ نوعَ المنحة الأصلي: تغييرُه كان يجعل deny.kind وstatus()
          // يكذبان على البقية عن هوية الشاغل (دحض مؤكد)
          var kd = (grant && grant.port === port) ? grant.kind : (msg.kind === "rtl" ? "rtl" : "scan");
          grant = { port: port, kind: kd, at: now() };
          try { port.postMessage({ type: "grant" }); } catch (e) {}
        } else if (msg.type === "release") {
          if (grant && grant.port === port) grant = null;
        } else if (msg.type === "beat") {
          if (grant && grant.port === port) grant.at = now();
        }
      });
      port.onDisconnect.addListener(function () {
        // أُغلق التبويب أو مات سكربته: المنحة تتحرر فورًا — هذا جوهر إلغاء التقادم
        if (grant && grant.port === port) grant = null;
      });
    }

    function status() {
      return grant ? { busy: true, kind: grant.kind, at: grant.at } : { busy: false };
    }

    return { attach: attach, status: status };
  }

  g.CMLArbiter = { createArbiter: createArbiter };
})(typeof globalThis !== "undefined" ? globalThis : this);
