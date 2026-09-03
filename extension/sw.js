/* sw.js — عامل الخدمة (المرحلة ٤): غراءُ كروم حول المحكّم — المنطق كله في
 * cml-arbiter.js (النسخة الواحدة التي تختبرها _swtest.html بسيناريوهات التبويبات).
 *
 * عاملُ MV3 عابرٌ (يُقتل بعد خمول ~30ث) وهذا كافٍ هنا: طلبُ الاتصال يوقظه،
 * ومنفذُ الزاحف المفتوح ونبضاتُه تبقيانه حيًّا طوالَ الزحف، وموتُه بين الفحوص
 * لا يفقد شيئًا (لا حالة تستحق البقاء — المنحة حياتُها حياةُ منفذها أصلًا،
 * وإن مات أثناء زحفٍ نادرًا فمنفذ الزاحف ينقطع فيعيد طلبَ المنحة فورًا).
 */
// الملف الواحد يخدم بيئتين: عاملَ خدمة في كروم، وصفحةَ أحداث في فايرفوكس MV3
// (الذي لا يشغّل عمال خدمة أصلًا). في الصفحة لا وجود لـimportScripts، ولا حاجة
// إليها: مانيفست فايرفوكس يسرد cml-const وcml-arbiter قبل هذا الملف في
// background.scripts بالترتيب نفسه، فالكائنات حاضرة قبل أن نصل هنا.
if (typeof importScripts === "function") importScripts("cml-const.js", "cml-arbiter.js");

var arbiter = CMLArbiter.createArbiter();

chrome.runtime.onConnect.addListener(function (port) {
  if (port.name === CMLConst.PORT_CRAWL) arbiter.attach(port);
});

// استعلام الحالة (صفحة الإعدادات قبل بدء فحص): ردٌّ متزامن — لا true فلا قناة تُترك معلقة
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (msg && msg.type === "status") sendResponse(arbiter.status());
  return false;
});

// فتحُ مساحة session لسكربتات المحتوى كان رهينَ فتحِ صفحة الإعدادات (هي من يضبطه) —
// ضبطُه هنا أيضًا عند كل إيقاظ يفكّ ذلك الاعتماد الترتيبي (رخيصٌ وآمن التكرار).
try {
  var p = chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS" });
  if (p && typeof p.catch === "function") p.catch(function () {}); // الرفض غير المعالَج يلوّث سجل العامل
} catch (e) {}
