/* cml-sync.js — قلب المزامنة الاختيارية (المرحلة ٦): المنطق كله هنا، والغراء في sw.js.
 *
 * هذا الملف هو المصدر الواحد لعقد المزامنة. ما يُزامَن: تصحيحات المستخدم
 * (cml_overrides) وقواعده الذكية (cml_user_patterns) فقط — الإعدادات محلية لكل جهاز.
 *
 * صيغة اللقطة في chrome.storage.sync:
 *   - الحمولة تُحوَّل نصَّ JSON قانونيًّا (مفاتيح اللغات ثم مفاتيح التصحيحات مرتّبةً؛
 *     القواعد مصفوفةً كما هي) ثم تُشرَّح تحت cml_syncd_0..N بحيث لا يتجاوز
 *     (المفتاح + قيمة JSON) بايتاتِ SYNC_ITEM_BYTES للشريحة، والمجموعُ SYNC_TOTAL_BYTES.
 *   - cml_syncmeta: {v:1, rev, at, device, count, hash, chunks}.
 *
 * قاعدة الكتابة الممزّقة: الميتا تُكتب **آخِرًا** (الشرائح ثم الميتا ثم حذفُ الفائض).
 *   القارئ لا يثق إلا بلقطة ميتاها متّسقة: شريحة مفقودة أو بصمة أو عدّ لا يطابقان
 *   ⇒ ليست لقطةً أصلًا (unpack تعيد null بصمت) — فالكتابة الجزئية لا تُفسد أحدًا،
 *   والدفعة التالية تصلحها.
 *
 * التعارض على مستوى المجموعة (حدٌّ مقبول موثّق): لا نحفظ وقتًا لكل تصحيح، بل
 *   للمجموعة كلها — من كان طابعُه (at) أحدثَ فقيمتُه تفوز عند اختلاف قيمتَي مفتاحٍ
 *   واحد، ومصفوفةُ القواعد تُؤخذ كلًّا من الطرف الأحدث. ثمن ذلك: تعديلان متزامنان
 *   حقًّا (في نافذة انتشار السحابة) قد يَغلب أحدُهما الآخرَ جملةً — نادرٌ ومقبول.
 *
 * شواهد الحذف (tombs) دفترٌ محلي فقط — لا تُرفع للسحابة: {"<لغة>|<مفتاح>": وقتُ الحذف}.
 *   الحذف ينتشر بالغياب: الجهاز الحاذف يدفع لقطةً أحدثَ بلا المفتاح، والمستقبِل
 *   يُسقط ما عنده مما غاب عنها (إن كانت أحدثَ من آخر تعديل محلي). والشاهد يحمي
 *   الحذفَ المحلي من لقطةٍ بعيدة أقدمَ تعيد المفتاح: شاهدٌ أحدثُ من at اللقطة
 *   ⇒ يبقى محذوفًا. يُشذَّب الدفتر بعمر SYNC_TOMB_TTL_MS وسقف SYNC_TOMB_MAX.
 *
 * حارسا الصدى (كي لا تدور الدفعات على نفسها):
 *   ١) cml_sync_lasthash (محلي): بصمةُ آخر حالة طابقت السحابة — تغيّرٌ محلي بصمته
 *      هي هي ⇒ صدى دمجٍ كتبناه نحن، فلا دفع.
 *   ٢) cml_sync_device (محلي): هوية الجهاز — حدثُ sync ميتاه بهويتنا ⇒ صدى دفعتنا.
 *
 * رقم الدفعة: rev = max(rev البعيد, rev آخر دفعةٍ لنا) + 1. وقبل كل دفعٍ يُدمَج
 *   البعيدُ غيرُ المدموج أولًا — فالدفع لا يدهس بيانات جهازٍ آخر أبدًا.
 *
 * تجاوز الحصة: fits:false من pack ⇒ لا كتابة للسحابة، وتُكتب الحال محليًّا
 *   {status:"overflow", need, at} في cml_sync_state لتعرضها صفحة الإعدادات
 *   (وعند النجاح {status:"ok", bytes, count, at, rev}، وعند فشل كتابة السحابة
 *   {status:"error", error, at} مع بقاء cml_sync_pending فيُعاد الدفع عند الإيقاظ).
 *
 * نقاء: لا chrome.* هنا إطلاقًا — الدالتان handleLocalChange/handleSyncChange
 *   تأخذان بيئةً env = {getLocal(keys,cb), setLocal(obj,cb), getSyncAll(cb),
 *   setSync(obj,cb), removeSync(keys,cb), now()} — أخطاء الكتابة تصل cb أولَ وسيط
 *   (null = نجاح). فتختبرها الصفحات بقشرة مقلّدة كما تستهلكها sw.js ببيئة حقيقية.
 *
 * ثنائي الاستخدام: لا import/export — يفترض تحميل cml-const.js قبله (كترتيب
 *   importScripts في sw.js ومانيفست فايرفوكس سواء).
 */
(function (g) {
  "use strict";
  var C = g.CMLConst;
  var K = C.K;

  // ---- أدوات صغيرة ----------------------------------------------------------

  // طول النص بايتاتِ UTF-8 — حصص كروم بالبايت لا بالحرف (والعربية حرفها بايتان)
  function byteLen(s) {
    if (typeof TextEncoder === "function") return new TextEncoder().encode(s).length;
    // بديل البيئات العتيقة: encodeURIComponent يفكّ الحرف لبايتاته المئوية
    return unescape(encodeURIComponent(s)).length;
  }

  // FNV-1a (32 بت) على وحدات الترميز — نسخة محلية عمدًا: لا اعتماد على CMLRtl
  function fnv1a(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      // الضرب في 0x01000193 بجمع إزاحات — يبقى في حساب 32 بت الصحيح فلا يفقد دقة
      h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
    }
    return ("0000000" + h.toString(16)).slice(-8);
  }

  // النص القانوني للحمولة: {"o":{لغات مرتبة:{مفاتيح مرتبة}},"p":[القواعد كما هي]}
  // — الترتيب يجعل البصمة والتشريح مستقرَّين مهما اختلف ترتيب المفاتيح في الذاكرة
  function canon(payload) {
    var o = (payload && payload.overrides) || {};
    var p = (payload && payload.patterns) || [];
    var langs = Object.keys(o).sort();
    var parts = [];
    for (var i = 0; i < langs.length; i++) {
      var m = o[langs[i]] || {};
      var keys = Object.keys(m).sort();
      if (!keys.length) continue; // لغة فارغة ضجيج تمثيلي — إسقاطها يوحّد الشكلين
      var kv = [];
      for (var j = 0; j < keys.length; j++) {
        kv.push(JSON.stringify(keys[j]) + ":" + JSON.stringify(m[keys[j]]));
      }
      parts.push(JSON.stringify(langs[i]) + ":{" + kv.join(",") + "}");
    }
    return '{"o":{' + parts.join(",") + '},"p":' + JSON.stringify(p) + "}";
  }

  function hashPayload(payload) { return fnv1a(canon(payload)); }

  // عدّ العناصر (تصحيحات كل اللغات + القواعد) — يدخل الميتا ويُفحص عند القراءة
  function countPayload(payload) {
    var o = (payload && payload.overrides) || {};
    var n = ((payload && payload.patterns) || []).length;
    for (var lang in o) {
      if (Object.prototype.hasOwnProperty.call(o, lang)) n += Object.keys(o[lang] || {}).length;
    }
    return n;
  }

  // ---- التغليف والفك --------------------------------------------------------

  // أكبر عدد أحرف من json بدءًا من pos تبقى شريحتُه (مفتاحًا + قيمة JSON) تحت السقف.
  // بحث ثنائي: البايتات رتيبة مع الطول، وhi مقصوص بالسقف (البايتات ≥ الأحرف دائمًا)
  function sliceLen(json, pos, keyBytes) {
    var lo = 1, hi = Math.min(json.length - pos, C.SYNC_ITEM_BYTES), best = 1;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      var b = keyBytes + byteLen(JSON.stringify(json.substr(pos, mid)));
      if (b <= C.SYNC_ITEM_BYTES) { best = mid; lo = mid + 1; } else { hi = mid - 1; }
    }
    return best;
  }

  // pack(payload, opt {rev, device, now, prevChunks}) → {sets, removes, bytes, fits, need, meta}
  // sets تضم الميتا لكن العقدَ على الكاتب: الشرائح أولًا ثم الميتا (انظر رأس الملف)
  function pack(payload, opt) {
    opt = opt || {};
    var json = canon(payload);
    var sets = {};
    var total = 0;
    var i = 0, pos = 0;
    while (pos < json.length) {
      var key = K.SYNC_CHUNK_PREFIX + i;
      var kb = byteLen(key);
      var n = sliceLen(json, pos, kb);
      var slice = json.substr(pos, n);
      sets[key] = slice;
      total += kb + byteLen(JSON.stringify(slice));
      pos += n;
      i++;
    }
    var meta = {
      v: 1,
      rev: opt.rev || 1,
      at: opt.now || 0,
      device: opt.device || "",
      count: countPayload(payload),
      hash: fnv1a(json),
      chunks: i,
    };
    sets[K.SYNC_META] = meta;
    total += byteLen(K.SYNC_META) + byteLen(JSON.stringify(meta));
    // الشرائح الفائضة من لقطة أطول سابقة — القارئ يتجاهلها (الميتا لا تعدّها)
    // لكن تركها يأكل الحصة المشتركة
    var removes = [];
    var prev = opt.prevChunks || 0;
    for (var r = i; r < prev; r++) removes.push(K.SYNC_CHUNK_PREFIX + r);
    var fits = total <= C.SYNC_TOTAL_BYTES;
    return { sets: sets, removes: removes, bytes: total, fits: fits, need: total, meta: meta };
  }

  // unpack(لقطة sync كاملة) → {payload, meta} أو null — الممزّق والناقص «لا لقطة» بصمت
  function unpack(snap) {
    if (!snap) return null;
    var meta = snap[K.SYNC_META];
    if (!meta || meta.v !== 1 || typeof meta.chunks !== "number" || meta.chunks < 0) return null;
    var json = "";
    for (var i = 0; i < meta.chunks; i++) {
      var c = snap[K.SYNC_CHUNK_PREFIX + i];
      if (typeof c !== "string") return null; // شريحة مفقودة = كتابة لم تكتمل
      json += c;
    }
    var parsed;
    try { parsed = JSON.parse(json); } catch (e) { return null; }
    if (!parsed || typeof parsed !== "object") return null;
    var payload = { overrides: parsed.o || {}, patterns: parsed.p || [] };
    if (typeof payload.overrides !== "object" || !Array.isArray(payload.patterns)) return null;
    if (hashPayload(payload) !== meta.hash) return null;  // ميتا قديمة فوق شرائح جديدة أو العكس
    if (countPayload(payload) !== meta.count) return null;
    return { payload: payload, meta: meta };
  }

  // ---- الدمج ----------------------------------------------------------------

  // شذّب الشواهد: أسقط ما جاوز العمر، وعند تجاوز السقف أسقط الأقدم أولًا
  function pruneTombs(tombs, nowMs) {
    var out = {};
    var keys = [];
    for (var k in tombs) {
      if (!Object.prototype.hasOwnProperty.call(tombs, k)) continue;
      var t = tombs[k];
      if (typeof t !== "number" || nowMs - t > C.SYNC_TOMB_TTL_MS) continue;
      out[k] = t;
      keys.push(k);
    }
    if (keys.length > C.SYNC_TOMB_MAX) {
      keys.sort(function (a, b) { return out[a] - out[b]; });
      for (var i = 0; i < keys.length - C.SYNC_TOMB_MAX; i++) delete out[keys[i]];
    }
    return out;
  }

  // مفاتيح اختفت بين كتابتَي cml_overrides — ليسجّلها العامل شواهدَ حذف
  function diffRemovedKeys(oldOv, newOv) {
    oldOv = oldOv || {};
    newOv = newOv || {};
    var removed = [];
    for (var lang in oldOv) {
      if (!Object.prototype.hasOwnProperty.call(oldOv, lang)) continue;
      var om = oldOv[lang] || {};
      var nm = newOv[lang] || {};
      for (var k in om) {
        if (Object.prototype.hasOwnProperty.call(om, k) &&
            !Object.prototype.hasOwnProperty.call(nm, k)) {
          removed.push(lang + "|" + k);
        }
      }
    }
    return removed;
  }

  // mergeIn(المحلي {overrides, patterns, tombs, at?, everSynced?}, البعيد {payload, meta}, الآن)
  //   → {overrides, patterns, tombs, changedLocal}
  // at المحلي: آخر تعديل/دفع محلي (يُشتق في handleSyncChange من state.at وpending).
  // everSynced: هل سبق لهذا الجهاز أن طابق السحابة (lasthash موجود)؟ قبل أول مطابقة
  //   لا معنى لانتشار الحذف بالغياب — فالدمج الأول اتحادٌ صِرف لا يُسقط شيئًا محليًّا.
  function mergeIn(local, remote, nowMs) {
    var lo = (local && local.overrides) || {};
    var lp = (local && local.patterns) || [];
    var tombs = pruneTombs((local && local.tombs) || {}, nowMs);
    var lAt = (local && local.at) || 0;
    var ever = !!(local && local.everSynced);
    var ro = (remote && remote.payload && remote.payload.overrides) || {};
    var rp = (remote && remote.payload && remote.payload.patterns) || [];
    var rAt = (remote && remote.meta && remote.meta.at) || 0;
    var localWins = lAt > rAt; // مستوى المجموعة — الحد المقبول الموثّق في الرأس
    // ★ حارس انحراف الساعة (دحضٌ مؤكد): لقطةٌ طابعُها في المستقبل بعيدًا تعني ساعةَ
    // جهازٍ منحرفة — وحينها يصير «الحذف بالغياب» صادقًا أبدًا فتُمحى تصحيحاتُ الجهاز
    // السليم في كل دمج بلا رجعة. فلا نأتمن حداثةَ لقطةٍ كهذه على **الحذف** (يبقى
    // الاتحاد فلا يضيع شيء)، ونُبقي حسمَها لتعارض القيم كما هو — إذ عكسُه يكسر
    // التقارب (كلا الطرفين يرى نفسه فائزًا فيتقاذفان بلا نهاية).
    var trustRecency = rAt <= nowMs + C.SYNC_SKEW_TOLERANCE_MS;

    var out = {};
    var seen = {};
    var lang;
    for (lang in lo) { if (Object.prototype.hasOwnProperty.call(lo, lang)) seen[lang] = 1; }
    for (lang in ro) { if (Object.prototype.hasOwnProperty.call(ro, lang)) seen[lang] = 1; }
    for (lang in seen) {
      var lm = lo[lang] || {};
      var rm = ro[lang] || {};
      var om = {};
      var k;
      for (k in lm) {
        if (!Object.prototype.hasOwnProperty.call(lm, k)) continue;
        if (Object.prototype.hasOwnProperty.call(rm, k)) {
          // موجود في الطرفين: قيمتان مختلفتان يحسمهما طابع المجموعة الأحدث
          om[k] = localWins ? lm[k] : rm[k];
        } else if (!ever || localWins || !trustRecency) {
          // محليٌّ فقط: إضافة لم تُدفع بعد (أو جهاز لم يزامن قط، أو لقطةٌ لا نأتمن
          // حداثتَها لانحراف ساعتها) — تبقى
          om[k] = lm[k];
        }
        // وإلا: اللقطة البعيدة أحدث وقد غاب عنها — حُذف على جهاز آخر فيسقط هنا
        // (العامل سيسجّل له شاهدًا من فرق الكتابة المحلية — توثيقٌ صحيح لا ضرر منه)
      }
      for (k in rm) {
        if (!Object.prototype.hasOwnProperty.call(rm, k)) continue;
        if (Object.prototype.hasOwnProperty.call(lm, k)) continue;
        var tk = lang + "|" + k;
        if (tombs[tk] && tombs[tk] > rAt) continue; // حذفناه بعد أن صُنعت هذه اللقطة — يبقى محذوفًا
        if (tombs[tk]) delete tombs[tk]; // اللقطة أحدث من الشاهد: المفتاح عاد عن قصد فالشاهد لغا
        om[k] = rm[k];
      }
      if (Object.keys(om).length) out[lang] = om;
    }

    // القواعد: مصفوفة بلا مفاتيح — كلٌّ من الطرف الأحدث (حد المجموعة نفسه)،
    // إلا الدمج الأول فاتحادٌ بالتمثيل النصي كي لا تُمحى قواعدُ جهازٍ لم يدفع قط
    var outP;
    if (JSON.stringify(lp) === JSON.stringify(rp)) {
      outP = lp;
    } else if (!ever) {
      outP = lp.slice();
      var have = {};
      for (var i = 0; i < lp.length; i++) have[JSON.stringify(lp[i])] = 1;
      for (var j = 0; j < rp.length; j++) {
        if (!have[JSON.stringify(rp[j])]) outP.push(rp[j]);
      }
    } else {
      outP = localWins ? lp : rp;
    }

    var changedLocal =
      hashPayload({ overrides: out, patterns: outP }) !== hashPayload({ overrides: lo, patterns: lp });
    return { overrides: out, patterns: outP, tombs: tombs, changedLocal: changedLocal };
  }

  // ---- التوصيل (منطق كامل فوق env — بلا chrome) ------------------------------

  // مغلّفات وعود فوق نداءات cb — الأخطاء تصل رفضًا
  function pGetLocal(env, keys) {
    return new Promise(function (res) { env.getLocal(keys, function (r) { res(r || {}); }); });
  }
  function pSetLocal(env, obj) {
    return new Promise(function (res, rej) {
      env.setLocal(obj, function (err) { if (err) rej(new Error(err)); else res(); });
    });
  }
  function pGetSyncAll(env) {
    return new Promise(function (res) { env.getSyncAll(function (r) { res(r || {}); }); });
  }
  function pSetSync(env, obj) {
    return new Promise(function (res, rej) {
      env.setSync(obj, function (err) { if (err) rej(new Error(err)); else res(); });
    });
  }
  function pRemoveSync(env, keys) {
    return new Promise(function (res, rej) {
      env.removeSync(keys, function (err) { if (err) rej(new Error(err)); else res(); });
    });
  }

  // هوية الجهاز: تُنشأ مرة وتبقى — العشوائية تكفي (التصادم بين جهازَي مستخدمٍ واحد وهْم)
  function ensureDevice(env, have) {
    if (have && typeof have === "string") return Promise.resolve(have);
    var id = "d" + env.now().toString(36) + "-" + Math.floor(Math.random() * 0xffffffff).toString(36);
    return pSetLocal(env, keyed(K.SYNC_DEVICE, id)).then(function () { return id; });
  }

  function keyed(k, v) { var o = {}; o[k] = v; return o; }

  // كم شريحة قائمة في اللقطة فعلًا (لحساب الفائض الواجب حذفه) — أقصى فهرس + ١،
  // لا عدّ الميتا: ميتا ممزّقة لا يُركن إليها
  function chunkCountIn(snap) {
    var max = -1;
    for (var k in snap) {
      if (!Object.prototype.hasOwnProperty.call(snap, k)) continue;
      if (k.indexOf(K.SYNC_CHUNK_PREFIX) !== 0) continue;
      var n = parseInt(k.slice(K.SYNC_CHUNK_PREFIX.length), 10);
      if (!isNaN(n) && n > max) max = n;
    }
    return max + 1;
  }

  // قفل انشغال على مستوى الوحدة: العامل خيطٌ واحد لكن سلاسل الوعود تتشابك —
  // دفعتان متداخلتان تكرّران rev. المتزاحم يُهمل بأمان: cml_sync_pending باقٍ
  // فيلتقطه فحصُ الإيقاظ أو الحدث التالي
  var busy = false;
  function guarded(fn) {
    return function (env, changes) {
      if (busy) return Promise.resolve({ done: "busy" });
      busy = true;
      return fn(env, changes).then(
        function (r) { busy = false; return r; },
        function (e) { busy = false; throw e; }
      );
    };
  }

  // اللبّ المحلي: يُستدعى بعد مهلة التجميع في العامل، وبـchanges=null عند الإيقاظ
  // (دفعة معلّقة مات العامل قبلها) وفي ذيل دمجِ syncCore
  function localCore(env, changes) {
    var L = [K.SYNC_ENABLED, K.OVERRIDES, K.USER_PATTERNS, K.SYNC_TOMBS,
             K.SYNC_LASTHASH, K.SYNC_STATE, K.SYNC_DEVICE, K.SYNC_PENDING];
    return pGetLocal(env, L).then(function (r) {
      // الموافقة تُقرأ طازجةً في كل مرة: «إعادة الضبط» تطفئ العلم والتصحيحات معًا
      // في كتابة واحدة — القراءة الطازجة هي ما يجعلها محليةً فعلًا فلا تُدفع للسحابة
      if (r[K.SYNC_ENABLED] !== true) {
        if (r[K.SYNC_PENDING]) return pSetLocal(env, keyed(K.SYNC_PENDING, 0)).then(function () {
          return { done: "disabled" };
        });
        return { done: "disabled" };
      }

      var now = env.now();
      var tombs = pruneTombs(r[K.SYNC_TOMBS] || {}, now);
      var tombsDirty = false;

      // تسجيل شواهد الحذف من فرق الكتابة (oldValue→newValue) قبل أي شيء —
      // بعد هذه اللحظة لا أثر للمفاتيح المحذوفة في أي مكان آخر
      if (changes && changes[K.OVERRIDES]) {
        var removed = diffRemovedKeys(changes[K.OVERRIDES].oldValue, changes[K.OVERRIDES].newValue);
        for (var i = 0; i < removed.length; i++) { tombs[removed[i]] = now; tombsDirty = true; }
        if (tombsDirty) tombs = pruneTombs(tombs, now);
      }

      var overrides = r[K.OVERRIDES] || {};
      var patterns = r[K.USER_PATTERNS] || [];
      var lasthash = r[K.SYNC_LASTHASH];
      var state = r[K.SYNC_STATE] || {};
      var curHash = hashPayload({ overrides: overrides, patterns: patterns });

      var pre = tombsDirty ? pSetLocal(env, keyed(K.SYNC_TOMBS, tombs)) : Promise.resolve();
      return pre.then(function () {
        // حارس الصدى ١: الحالة المحلية تطابق آخر ما زامنّاه — هذا صدى دمجٍ كتبناه
        if (curHash === lasthash) {
          if (r[K.SYNC_PENDING]) return pSetLocal(env, keyed(K.SYNC_PENDING, 0)).then(function () {
            return { done: "echo" };
          });
          return { done: "echo" };
        }
        return ensureDevice(env, r[K.SYNC_DEVICE]).then(function (device) {
          return pGetSyncAll(env).then(function (snap) {
            var remote = unpack(snap);
            var payload = { overrides: overrides, patterns: patterns };

            // البعيد فيه ما لم نره: الدمج قبل الدفع — الدفع الأعمى يدهس أجهزة أخرى
            var adopt = Promise.resolve(null);
            if (remote && remote.meta.device !== device && hashPayload(remote.payload) !== lasthash) {
              var localAt = Math.max(state.at || 0, r[K.SYNC_PENDING] || 0);
              var m = mergeIn(
                { overrides: overrides, patterns: patterns, tombs: tombs,
                  at: localAt, everSynced: !!lasthash },
                remote, now
              );
              payload = { overrides: m.overrides, patterns: m.patterns };
              var mergedHash = hashPayload(payload);
              var w = {};
              w[K.SYNC_TOMBS] = m.tombs;
              if (m.changedLocal) { w[K.OVERRIDES] = m.overrides; w[K.USER_PATTERNS] = m.patterns; }
              if (mergedHash === hashPayload(remote.payload)) {
                // الدمج طابق البعيدَ تمامًا — تبنٍّ بلا دفع (دفعُ المِثل ضجيج rev)
                w[K.SYNC_LASTHASH] = mergedHash;
                w[K.SYNC_PENDING] = 0;
                return pSetLocal(env, w).then(function () { return { done: "adopted" }; });
              }
              // عندنا زيادة على البعيد: تبنَّ الدمج ثم ادفعه (lasthash بعد نجاح الدفع
              // لا قبله — لو كُتب الآن ومات العامل قبل الدفع لظنّ الإيقاظُ الحالةَ صدًى)
              adopt = pSetLocal(env, w);
            }

            return adopt.then(function () {
              var rev = Math.max(remote ? remote.meta.rev || 0 : 0, state.rev || 0) + 1;
              var packed = pack(payload, {
                rev: rev, device: device, now: now, prevChunks: chunkCountIn(snap),
              });
              if (!packed.fits) {
                var st = { status: "overflow", need: packed.need, at: now };
                var wOver = {};
                wOver[K.SYNC_STATE] = st;
                wOver[K.SYNC_PENDING] = 0; // الإصرار على دفعٍ لا يسع لن يصلحه الإيقاظ
                return pSetLocal(env, wOver).then(function () { return { done: "overflow" }; });
              }
              // الترتيب عقدُ الكتابة الممزّقة: الشرائح، فالميتا وحدها، فحذف الفائض
              var chunkSets = {};
              for (var kk in packed.sets) {
                if (Object.prototype.hasOwnProperty.call(packed.sets, kk) && kk !== K.SYNC_META) {
                  chunkSets[kk] = packed.sets[kk];
                }
              }
              return pSetSync(env, chunkSets)
                .then(function () { return pSetSync(env, keyed(K.SYNC_META, packed.meta)); })
                .then(function () {
                  return packed.removes.length ? pRemoveSync(env, packed.removes) : null;
                })
                .then(function () {
                  var wOk = {};
                  wOk[K.SYNC_LASTHASH] = hashPayload(payload);
                  wOk[K.SYNC_STATE] = {
                    status: "ok", bytes: packed.bytes, count: packed.meta.count, at: now, rev: rev,
                  };
                  wOk[K.SYNC_PENDING] = 0;
                  return pSetLocal(env, wOk).then(function () { return { done: "pushed", rev: rev }; });
                })
                .catch(function (e) {
                  // فشلت كتابة السحابة (حصة/خنق): تُسجَّل الحال وpending يبقى —
                  // فحص الإيقاظ أو الحدث التالي يعيد المحاولة
                  var wErr = {};
                  wErr[K.SYNC_STATE] = { status: "error", error: String(e && e.message || e), at: now };
                  return pSetLocal(env, wErr).then(function () { return { done: "error" }; });
                });
            });
          });
        });
      });
    });
  }

  // لبّ حدث السحابة: لقطة جديدة من جهاز آخر — فكّها، ادمجها، وادفع الزيادة إن وُجدت
  function syncCore(env, changes) {
    // هل الحدث لمفاتيحنا أصلًا؟ (دفاع رخيص — العامل يرشّح قبل النداء أيضًا)
    var ours = false;
    for (var ck in changes || {}) {
      if (!Object.prototype.hasOwnProperty.call(changes, ck)) continue;
      if (ck === K.SYNC_META || ck.indexOf(K.SYNC_CHUNK_PREFIX) === 0) { ours = true; break; }
    }
    if (!ours) return Promise.resolve({ done: "ignored" });

    var L = [K.SYNC_ENABLED, K.OVERRIDES, K.USER_PATTERNS, K.SYNC_TOMBS,
             K.SYNC_LASTHASH, K.SYNC_STATE, K.SYNC_DEVICE, K.SYNC_PENDING];
    return pGetLocal(env, L).then(function (r) {
      if (r[K.SYNC_ENABLED] !== true) return { done: "disabled" };
      var device = r[K.SYNC_DEVICE];

      // حارس الصدى ٢ (مبكرًا وبلا جلب اللقطة): ميتا الحدث بهويتنا = صدى دفعتنا
      var mc = changes[K.SYNC_META];
      if (mc && mc.newValue && device && mc.newValue.device === device) return { done: "self" };

      return pGetSyncAll(env).then(function (snap) {
        var remote = unpack(snap);
        if (!remote) return { done: "torn" }; // كتابة ممزّقة — دفعةُ صاحبها التالية تتمّها
        if (device && remote.meta.device === device) return { done: "self" };

        var remoteHash = hashPayload(remote.payload);
        var lasthash = r[K.SYNC_LASTHASH];
        if (remoteHash === lasthash) return { done: "seen" };

        var state = r[K.SYNC_STATE] || {};
        var now = env.now();
        var m = mergeIn(
          {
            overrides: r[K.OVERRIDES] || {},
            patterns: r[K.USER_PATTERNS] || [],
            tombs: r[K.SYNC_TOMBS] || {},
            at: Math.max(state.at || 0, r[K.SYNC_PENDING] || 0),
            everSynced: !!lasthash,
          },
          remote, now
        );
        var mergedHash = hashPayload({ overrides: m.overrides, patterns: m.patterns });

        // lasthash = بصمة البعيد (لا الدمج): إن ساوى الدمجُ البعيدَ خمد الصدى هنا،
        // وإن زاد عليه بقيت البصمتان مختلفتين فيدفع localCore الزيادةَ فورًا بعدنا
        var w = {};
        w[K.SYNC_TOMBS] = m.tombs;
        w[K.SYNC_LASTHASH] = remoteHash;
        if (m.changedLocal) { w[K.OVERRIDES] = m.overrides; w[K.USER_PATTERNS] = m.patterns; }
        return pSetLocal(env, w).then(function () {
          if (mergedHash === remoteHash) return { done: "merged" };
          return localCore(env, null).then(function (pr) {
            return { done: "merged+push", push: pr && pr.done };
          });
        });
      });
    });
  }

  g.CMLSync = {
    byteLen: byteLen,
    hashPayload: hashPayload,
    countPayload: countPayload,
    pack: pack,
    unpack: unpack,
    mergeIn: mergeIn,
    diffRemovedKeys: diffRemovedKeys,
    pruneTombs: pruneTombs,
    handleLocalChange: guarded(localCore),
    handleSyncChange: guarded(syncCore),
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
