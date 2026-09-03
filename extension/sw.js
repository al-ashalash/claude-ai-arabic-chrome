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
// طابعًا تُرك أكثر من مهلة SYNC_WAKE_GRACE_MS فيدفع فورًا: موتُ العامل بين الطابع
// والمؤقّت لا يُضيع شيئًا.
var syncTimer = null;
var syncAccum = null; // فروق cml_overrides المتراكمة: أقدمُ oldValue وأحدثُ newValue
                      // — كي لا يفوت شاهدُ حذفٍ وقع في أول كتابةٍ من سلسلة مجمّعة
// ★ علم الموافقة مخبوءًا: كان الطابع يُكتب مع كل حفظ تصحيحٍ ولو لم تُفعَّل المزامنة
// قطّ — كتابةٌ في كل حفظ بلا معنى. يُقرأ عند الإيقاظ ويُحدَّث من onChanged نفسه،
// وقبل أول قراءة (null) لا نمنع شيئًا: localCore يقرأ الموافقة طازجةً ويصفّر الطابع.
var syncEnabled = null;

function syncQueue(changes) {
  if (syncEnabled === false) return; // بلا موافقة لا طابع ولا مؤقّت ولا كتابة
  if (syncEnabled === null) {
    // نافذةُ إقلاعٍ لم يُقرأ فيها العلم بعد: نقرؤه ثم نُعاود — الكتابةُ على الشك
    // كانت تُبقي ما أزالته المعالجةُ الثامنة (طابعٌ في كل حفظٍ بلا مزامنةٍ أصلًا)
    chrome.storage.local.get([CMLConst.K.SYNC_ENABLED], function (r) {
      void chrome.runtime.lastError;
      syncEnabled = !!(r && r[CMLConst.K.SYNC_ENABLED] === true);
      if (syncEnabled) syncQueue(changes);
    });
    return;
  }
  var K = CMLConst.K;
  var watched = [K.OVERRIDES, K.USER_PATTERNS];
  for (var i = 0; i < watched.length; i++) {
    var k = watched[i];
    if (!changes[k]) continue;
    if (!syncAccum) syncAccum = {};
    if (!syncAccum[k]) syncAccum[k] = { oldValue: changes[k].oldValue, newValue: changes[k].newValue };
    else syncAccum[k].newValue = changes[k].newValue;
  }

  // ★ شواهدُ الحذف تُحسب هنا وتُكتب دائمةً **مع الطابع في كتابةٍ واحدة**: كانت
  // تُشتقّ من المُراكم في الذاكرة عند انطلاق المؤقّت، فموتُ العامل بين الطابع
  // والمؤقّت يُبخّر الشاهد — ثم يُحيي الدمجُ التالي التصحيحَ المحذوف. الفرقُ لا
  // يُستخرج إلا من هذا الحدث نفسِه (oldValue لا أثر له بعده في أي مكان).
  var removed = [];
  if (changes[K.OVERRIDES]) {
    removed = CMLSync.diffRemovedKeys(changes[K.OVERRIDES].oldValue, changes[K.OVERRIDES].newValue);
  }
  if (changes[K.USER_PATTERNS]) {
    removed = removed.concat(
      CMLSync.diffRemovedRules(changes[K.USER_PATTERNS].oldValue, changes[K.USER_PATTERNS].newValue));
  }
  var stamp = Date.now();
  if (removed.length) {
    chrome.storage.local.get([K.SYNC_TOMBS], function (r) {
      void chrome.runtime.lastError;
      var tombs = (r && r[K.SYNC_TOMBS]) || {};
      for (var j = 0; j < removed.length; j++) tombs[removed[j]] = stamp;
      var o = {};
      o[K.SYNC_TOMBS] = CMLSync.pruneTombs(tombs, stamp);
      o[K.SYNC_PENDING] = stamp;
      chrome.storage.local.set(o, function () { void chrome.runtime.lastError; });
    });
  } else {
    var o2 = {}; o2[K.SYNC_PENDING] = stamp;
    chrome.storage.local.set(o2, function () { void chrome.runtime.lastError; });
  }

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
    // العلم المخبوء يُحدَّث أولًا: لحظةُ الموافقة نفسها تمرّ من هنا قبل syncQueue
    if (changes[CMLConst.K.SYNC_ENABLED]) {
      syncEnabled = changes[CMLConst.K.SYNC_ENABLED].newValue === true;
    }
    if (changes[CMLConst.K.OVERRIDES] || changes[CMLConst.K.USER_PATTERNS]) {
      syncQueue(changes);
    } else if (changes[CMLConst.K.SYNC_PENDING] && changes[CMLConst.K.SYNC_PENDING].newValue) {
      // طابعٌ كتبه المحرّك نفسُه (إصلاحُ سحابةٍ ممزّقة مثلًا): سلّح له مؤقّتًا وإلا
      // نام إلى الإقلاع التالي — والإصلاح بلا دفعةٍ ليس إصلاحًا
      if (syncEnabled !== false && !syncTimer) {
        syncTimer = setTimeout(function () {
          syncTimer = null;
          CMLSync.handleLocalChange(syncEnv, null).catch(function () {});
        }, CMLConst.SYNC_PUSH_DEBOUNCE_MS);
      }
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

// فحص الإيقاظ (دالةٌ مسمّاة كي تختبرها _synctest بحالات تخزينٍ مزروعة):
//   ١) علامةُ cml_sync_dirty: حدثُ سحابةٍ أُجّل لانشغال القفل ثم مات العامل — لا
//      أثر له في pending (ذاك لدفعاتنا نحن)، فلولا العلامة ما دُمجت اللقطة أبدًا.
//   ٢) طابعٌ معلّق أقدمُ من المهلة: مؤقّتٌ مات مع عامله ⇒ دفعٌ فوري.
//   ★ والأحدثُ منها كان يُترك بلا شيء — والمؤقّتُ الذي يُعوَّل عليه مات مع العامل،
//      فلا يُدفع حتى تعديلٍ جديد. فيُعاد تسليحُ مؤقّتٍ لبقيّة المهلة (ولا نزاحم
//      مؤقّتًا حيًّا سلّحه حدثٌ أيقظ العامل قبل قليل).
function syncWakeCheck() {
  var K = CMLConst.K;
  chrome.storage.local.get([K.SYNC_ENABLED, K.SYNC_PENDING, K.SYNC_DIRTY], function (r) {
    void chrome.runtime.lastError;
    syncEnabled = !!(r && r[K.SYNC_ENABLED] === true);
    if (!syncEnabled) return;
    if (r && r[K.SYNC_DIRTY]) {
      var synth = {}; synth[K.SYNC_META] = {}; // القارئ يقرأ اللقطة الحاضرة لا الحدث
      CMLSync.handleSyncChange(syncEnv, synth)
        .then(function () { return CMLSync.clearDirty(syncEnv); })
        .catch(function () {});
    }
    var t = r && r[K.SYNC_PENDING];
    if (!t) return;
    var waited = Date.now() - t;
    if (waited > CMLConst.SYNC_WAKE_GRACE_MS) {
      CMLSync.handleLocalChange(syncEnv, null).catch(function () {});
    } else if (!syncTimer) {
      syncTimer = setTimeout(function () {
        syncTimer = null;
        CMLSync.handleLocalChange(syncEnv, null).catch(function () {});
      }, CMLConst.SYNC_WAKE_GRACE_MS - waited);
    }
  });
}
syncWakeCheck();
