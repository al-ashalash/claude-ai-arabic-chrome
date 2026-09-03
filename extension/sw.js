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
// إليها: مانيفست فايرفوكس يسرد cml-const وcml-arbiter وcml-sync قبل هذا الملف في
// background.scripts بالترتيب نفسه، فالكائنات حاضرة قبل أن نصل هنا.
if (typeof importScripts === "function") importScripts("cml-const.js", "cml-arbiter.js", "cml-sync.js");

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

// ── المزامنة الاختيارية (المرحلة ٦): غراءُ كروم حول CMLSync — المنطق والعقد كله
// في cml-sync.js. دور هذا الملف: بيئة فوق chrome.storage، وترشيح الأحداث، والتجميع.

// بيئة CMLSync فوق واجهات كروم الحقيقية — أخطاء الكتابة تُمرَّر (lastError غير
// المقروء يصيح في سجل العامل، وقارئه هنا هو معالج الأخطاء الفعلي في CMLSync)
var syncEnv = {
  getLocal: function (keys, cb) {
    chrome.storage.local.get(keys, function (r) { void chrome.runtime.lastError; cb(r || {}); });
  },
  setLocal: function (obj, cb) {
    chrome.storage.local.set(obj, function () {
      cb(chrome.runtime.lastError ? chrome.runtime.lastError.message : null);
    });
  },
  getSyncAll: function (cb) {
    chrome.storage.sync.get(null, function (r) { void chrome.runtime.lastError; cb(r || {}); });
  },
  setSync: function (obj, cb) {
    chrome.storage.sync.set(obj, function () {
      cb(chrome.runtime.lastError ? chrome.runtime.lastError.message : null);
    });
  },
  removeSync: function (keys, cb) {
    chrome.storage.sync.remove(keys, function () {
      cb(chrome.runtime.lastError ? chrome.runtime.lastError.message : null);
    });
  },
  now: function () { return Date.now(); },
};

// تجميع الدفع: التعديلات المتتابعة (استيراد قاموس، حذف متتالٍ) دفعةٌ واحدة بعد
// مهلة SYNC_PUSH_DEBOUNCE_MS. المؤقّت وحده لا يُؤتمن — العامل قد يُقتل قبل أن
// يطلق — فيُكتب طابع cml_sync_pending قبل المؤقّت، وفحصُ الإيقاظ أدناه يلتقط
// طابعًا تُرك أكثر من ١٠ ثوانٍ فيدفع فورًا: موتُ العامل بين الطابع والمؤقّت لا يُضيع شيئًا.
var syncTimer = null;
var syncAccum = null; // فروق cml_overrides المتراكمة: أقدمُ oldValue وأحدثُ newValue
                      // — كي لا يفوت شاهدُ حذفٍ وقع في أول كتابةٍ من سلسلة مجمّعة

function syncQueue(changes) {
  var watched = [CMLConst.K.OVERRIDES, CMLConst.K.USER_PATTERNS];
  for (var i = 0; i < watched.length; i++) {
    var k = watched[i];
    if (!changes[k]) continue;
    if (!syncAccum) syncAccum = {};
    if (!syncAccum[k]) syncAccum[k] = { oldValue: changes[k].oldValue, newValue: changes[k].newValue };
    else syncAccum[k].newValue = changes[k].newValue;
  }
  chrome.storage.local.set((function () {
    var o = {}; o[CMLConst.K.SYNC_PENDING] = Date.now(); return o;
  })());
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(function () {
    syncTimer = null;
    var acc = syncAccum;
    syncAccum = null;
    CMLSync.handleLocalChange(syncEnv, acc).catch(function () {});
  }, CMLConst.SYNC_PUSH_DEBOUNCE_MS);
}

chrome.storage.onChanged.addListener(function (changes, area) {
  if (area === "local") {
    if (changes[CMLConst.K.OVERRIDES] || changes[CMLConst.K.USER_PATTERNS]) {
      syncQueue(changes);
    } else if (changes[CMLConst.K.SYNC_ENABLED] &&
               changes[CMLConst.K.SYNC_ENABLED].newValue === true) {
      // لحظة الموافقة: مزامنة أولى فورية (سحبُ ما في السحابة ودمجُه ثم دفعُ الاتحاد)
      // — دون هذا لبقيت المزامنة نائمةً حتى أول تعديل بعد التفعيل
      syncQueue({});
    }
  } else if (area === "sync") {
    var ours = changes[CMLConst.K.SYNC_META];
    if (!ours) {
      for (var k in changes) {
        if (k.indexOf(CMLConst.K.SYNC_CHUNK_PREFIX) === 0) { ours = true; break; }
      }
    }
    if (ours) CMLSync.handleSyncChange(syncEnv, changes).catch(function () {});
  }
});

// فحص الإيقاظ: دفعة معلّقة مات العامل قبل إتمامها (الطابع أقدم من ١٠ ثوانٍ —
// الأحدث منها لمؤقّتٍ حي أو لحدثٍ سيُعيد العامل للحياة بنفسه لاحقًا)
chrome.storage.local.get([CMLConst.K.SYNC_PENDING], function (r) {
  void chrome.runtime.lastError;
  var t = r && r[CMLConst.K.SYNC_PENDING];
  if (t && Date.now() - t > 10000) {
    CMLSync.handleLocalChange(syncEnv, null).catch(function () {});
  }
});
