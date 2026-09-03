/* _chrome-mock.js — قشرة chrome واحدة لصفحات الاختبار كلها (سكربت كلاسيكي، لا وحدات).
 *
 * لماذا: كانت كل صفحة اختبار تكتب قشرتها بيدها، فتباعدت النسخ في سلوك get وبثّ
 * onChanged ومساحة session — والتباعد أنجب عللًا حقيقية طاردناها واحدةً واحدة.
 * هذه القشرة تجمع السلوك الأعلى الذي تحتاجه الصفحات كلها، وما يخصّ صفحةً بعينها
 * (كأزواج منافذ المحكّم في _swtest أو المانيفست في _termstest) يبقى في صفحته.
 *
 * العقد: makeChromeMock(opts) حيث opts اختياري:
 *   opts.session === false ⇒ لا مساحة session أصلًا، فيسقط المحرّك وصفحة الإعدادات
 *                            إلى local (سلوك القشور القديمة الذي بُنيت عليه الاختبارات).
 *   opts.runtimeConnect    ⇒ دالة تصير chrome.runtime.connect (توصلها الصفحة بمحكّمها)؛
 *                            بغيابها يوجد chrome.runtime لكن بلا connect، فيسلك المحرّك
 *                            مسار الحجز القديم فورًا — وهو المطلوب في أكثر الصفحات.
 *   opts.sendMessage       ⇒ دالة تصير chrome.runtime.sendMessage؛ بغيابها غائبة تمامًا
 *                            (فيسقط askBusy في صفحة الإعدادات إلى الفحص المركّب القديم).
 *
 * يعيد: { chrome, localStore, sessStore, localWrites, sessWrites, localRemoved,
 *         sessRemoved, fireChanged(changes, area), hooks }
 *   المخازن والسجلات مراجع حيّة: الصفحة تزرع قيمها الأولية بـ Object.assign على
 *   localStore وتفحص الكتابات بعديًّا من المصفوفات نفسها. حيث session معطّلة تكون
 *   sessStore/sessWrites/sessRemoved قيمة null صريحة لا مصفوفات فارغة — كي يَفضح
 *   الاستعمالُ الخاطئ نفسَه بدل أن يمرّ صامتًا.
 *   hooks.onLocalWrite: خطاف تملؤه الصفحة (اختبار ١٣ في _swtest: موت العامل في منتصف
 *   الزحف) — يُستدعى بعد ردّ كل كتابة local بالكائن المكتوب نفسه.
 */
(function (g) {
  "use strict";

  // نسخة معزولة من القيمة: إرجاع المرجع نفسه كان يجعل تعديلات الصفحة تسري خلسة إلى
  // المخزن (قشرة _termstest القديمة تنسخ عميقًا لهذا السبب) — وchrome الحقيقي يعيد
  // نسخًا دائمًا لأن القيم تعبر حدود العملية.
  function clone(v) {
    if (v === undefined) return undefined;
    try { return JSON.parse(JSON.stringify(v)); } catch (e) { return v; }
  }

  g.makeChromeMock = function (opts) {
    opts = opts || {};

    // قائمة مستمعين واحدة موسومة بالمساحة — كما في chrome حيث onChanged على storage
    // نفسه ويصل كل تغيير بحرف مساحته، والمستمع هو من يغربل.
    var listeners = [];
    var hooks = { onLocalWrite: null };

    function fireChanged(changes, area) {
      // نسخة من القائمة قبل الدوران: مستمع يسجّل مستمعًا أثناء البث لا يعبث بالدورة
      listeners.slice().forEach(function (fn) { try { fn(changes, area || "local"); } catch (e) {} });
    }

    function makeArea(store, writes, removed, areaName) {
      return {
        // كل صيغ chrome الحقيقي: null/undefined = المخزن كله، مفتاح مفرد، قائمة،
        // أو كائن قيمٍ افتراضية — لأن الصفحات تستضيف engine.js وoptions.js معًا.
        get: function (keys, cb) {
          var out = {}, k;
          if (keys === null || keys === undefined) {
            for (k in store) { if (store[k] !== undefined) out[k] = clone(store[k]); }
          } else if (typeof keys === "string" || Array.isArray(keys)) {
            (Array.isArray(keys) ? keys : [keys]).forEach(function (k2) {
              if (store[k2] !== undefined) out[k2] = clone(store[k2]);
            });
          } else {
            for (k in keys) { out[k] = store[k] !== undefined ? clone(store[k]) : clone(keys[k]); }
          }
          cb(out);
        },
        set: function (obj, cb) {
          // المخزونُ وسجلُّ التغيير نسختان عميقتان (دحض مؤكد): كروم الحقيقي يفصل
          // الكتابةَ عن الكائن، وبالمرجع كان تعديلُ المستدعي بعد set يتسرّب إلى
          // المخزون وإلى ما رآه مستمعو onChanged
          var ch = {}, k;
          for (k in obj) { store[k] = clone(obj[k]); ch[k] = { newValue: clone(obj[k]) }; }
          // السجل نسخة عميقة: الفحص البعدي يقرأ ما كُتب لحظتَها لا ما صار إليه الكائن
          writes.push(clone(obj));
          fireChanged(ch, areaName);
          if (cb) cb();
          // الخطاف بعد ردّ الكتابة عمدًا: _swtest يقتل «العامل» من داخله، ويجب ألا
          // يسبق القتلُ اكتمالَ الكتابة التي أشعلته — كما في قشرته الأصلية حرفًا.
          if (areaName === "local" && hooks.onLocalWrite) { try { hooks.onLocalWrite(obj); } catch (e) {} }
        },
        remove: function (keys, cb) {
          (Array.isArray(keys) ? keys : [keys]).forEach(function (k2) { removed.push(k2); delete store[k2]; });
          if (cb) cb();
          // لا بثّ onChanged هنا عمدًا: القشور القديمة كلها صمتت عند الحذف،
          // والاختبارات القائمة مبنية على ذلك الصمت — لا نغيّر العقد في التوحيد.
        },
      };
    }

    var localStore = {}, localWrites = [], localRemoved = [];
    var chromeObj = {
      storage: {
        local: makeArea(localStore, localWrites, localRemoved, "local"),
        onChanged: { addListener: function (fn) { listeners.push(fn); } },
      },
      // runtime حاضر دائمًا وlastError فيه undefined: options.js يقرؤه بعد كل كتابة،
      // وغيابُ runtime كله كان يصحّ صدفةً لا عقدًا — الحضور بلا connect هو العقد.
      runtime: { lastError: undefined },
    };

    var sessStore = null, sessWrites = null, sessRemoved = null;
    if (opts.session !== false) {
      sessStore = {}; sessWrites = []; sessRemoved = [];
      var sess = makeArea(sessStore, sessWrites, sessRemoved, "session");
      // صفحة الإعدادات تفتح session لسكربتات المحتوى — لا مفهوم للثقة في قشرة اختبار
      sess.setAccessLevel = function (o, cb) { if (cb) cb(); };
      chromeObj.storage.session = sess;
    }

    if (typeof opts.runtimeConnect === "function") chromeObj.runtime.connect = opts.runtimeConnect;
    if (typeof opts.sendMessage === "function") chromeObj.runtime.sendMessage = opts.sendMessage;

    return {
      chrome: chromeObj,
      localStore: localStore, sessStore: sessStore,
      localWrites: localWrites, sessWrites: sessWrites,
      localRemoved: localRemoved, sessRemoved: sessRemoved,
      fireChanged: fireChanged,
      hooks: hooks,
    };
  };
})(globalThis);
