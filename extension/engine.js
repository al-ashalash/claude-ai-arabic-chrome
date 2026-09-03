/* engine.js — claude-mutarjim live translator (isolated content-script world).
 * Reads globalThis.CLAUDE_L10N (from dictionary.js), applies direction + font,
 * translates UI text nodes + attributes, and re-runs on dynamic DOM changes.
 *
 * PRIVACY — stated precisely, because a claim that overreaches is worse than none:
 * To translate a label the engine must MATCH it, so it does read text nodes as it walks
 * the DOM. What it never does is KEEP any of that: nothing read from the page is stored,
 * accumulated, or transmitted — not to storage, not to a server, not anywhere. Reads are
 * transient and match-only; the sole persistent writes are the user's own settings and
 * the corrections they type themselves.
 * Conversation content is excluded outright (see inChatContent), so message prose is
 * never even matched. Discovering untranslated strings is done exclusively by «site
 * scan», which fetches claude.ai's own public asset files — never the rendered page.
 * No page-script injection: works within the page CSP.  */
(function () {
  "use strict";
  var L10N = (typeof globalThis !== "undefined" && globalThis.CLAUDE_L10N) || null;
  if (!L10N || !L10N.dicts) return;
  // الثوابت والمنطق المشترك يُحقنان قبلنا (ترتيب المانيفست) — غيابهما عطل تركيب صريح
  var CONST = globalThis.CMLConst, SHARED = globalThis.CMLShared;
  if (!CONST || !SHARED) { console.error("[تعريب كلود] cml-const/cml-shared لم يُحمَّلا — راجع ترتيب المانيفست"); return; }

  // ★ حالة التنسيق العابرة (طلب/إلغاء/حجز الفحص) في storage.session: تُمحى بإغلاق
  // المتصفح، فيستحيل بنيويًا «حجزٌ خالد» أو «إلغاء عالق» يسبق صاحبه إلى الأبد —
  // وهو صنف العلل الذي طاردناه رقعةً رقعة في §7ب. النتيجة النهائية تبقى في local
  // (المستخدم يتوقع بقاءها بعد إعادة التشغيل، وتعافي «جارٍ» المتقادمة قائم بالنبض).
  // القشرة تسقط إلى local حيث لا session (قشور الاختبار، ومتصفح أقدم) بسلوك الأمس نفسه.
  var SESS = (chrome.storage && chrome.storage.session) || chrome.storage.local;

  var state = {
    enabled: true,
    lang: L10N.default || (L10N.langs && L10N.langs[0] && L10N.langs[0].code),
    overrides: {},
    userPatterns: [], // أنماط وَلّدها الاستيراد من النصوص ذات المتغيّرات
    rtl: true, // full page dir=rtl ON by default for RTL languages; user can turn it off if a screen misbehaves
    chatrtl: true, // fix direction of conversation text (dir=auto) — ON by default for Arabic
    // محرّك الاتجاه (المرحلة ٣): "v2" الجذري افتراضيًا — سمة data-cml-rtl تفعّل
    // rtl-overrides.css المولَّد (قلب منطقي شامل لأصناف الموقع). "v1" يبقيه خاملًا
    // فتعمل الإصلاحات النقطية في base.css وحدها (مخرج توافقٍ إن ساءت شاشة).
    rtlEngine: "v2",
  };
  var active = null;
  var pluralRes = null;

  function compile() {
    var base = L10N.dicts[state.lang];
    if (!base) { active = null; return; }
    var ov = (state.overrides && state.overrides[state.lang]) || {};
    active = {
      dir: base.dir || "ltr",
      font: base.font || "",
      // ★ لا نسخة ثانية: Object.assign على 22 ألف مدخلة كان يضاعف ذاكرة كل تبويب
      // (~10MB) في كل compile — والبحث يفحص التصحيحات ثم القاموس تتابعًا بلا دمج.
      strings: base.strings,
      overrides: ov,
      plurals: base.plurals || {},
      // أنماط المستخدم أولًا: تصحيحه يسبق النمط المدمج عند التعارض
      patterns: (state.userPatterns || []).concat(base.patterns || []),
    };
    buildPlurals();
    buildPatterns();
    lookupCache = new Map(); // النتائج المخزّنة تعتمد على القاموس والقواعد — أبطِلها مع كل إعادة تركيب
    reportBadRules();
  }

  function reportBadRules() {
    var total = badPatterns + badPlurals;
    if (total === lastBadReport) return;
    lastBadReport = total;
    try {
      if (total) chrome.storage.local.set({ cml_bad_rules: { patterns: badPatterns, plurals: badPlurals } });
      else chrome.storage.local.remove(CONST.K.BAD_RULES);
    } catch (e) {}
  }

  // قيم الموقع الأصلية تُحفظ مرة واحدة: كان الإطفاء يمحو lang وdir محوًا مطلقًا،
  // فتفقد الصفحة سمة lang التي وضعها الموقع (يعتمد عليها قارئ الشاشة والتدقيق الإملائي)
  // ولا تعود إليها إلا بإعادة تحميل.
  var origLang = null, origDir = null, origSaved = false;
  function saveOriginals(html) {
    if (origSaved) return;
    origSaved = true;
    origLang = html.getAttribute("lang");
    origDir = html.getAttribute("dir");
  }
  function restoreAttr(html, name, val) {
    if (val === null) html.removeAttribute(name); else html.setAttribute(name, val);
  }
  function applyChrome() {
    var html = document.documentElement;
    if (!html) return;
    saveOriginals(html);
    if (state.enabled && active) {
      html.setAttribute("data-cml", "on");
      if (active.font) html.style.setProperty("--cml-font", active.font);
      if (state.rtl) {
        html.setAttribute("dir", active.dir);
        html.setAttribute("lang", state.lang);
        // بوابة محرّك v2: rtl-overrides.css كله خلف هذه السمة — بلاها خاملٌ حرفيًّا
        if (active.dir === "rtl" && state.rtlEngine !== "v1") html.setAttribute("data-cml-rtl", "v2");
        else html.removeAttribute("data-cml-rtl");
      } else {
        restoreAttr(html, "dir", origDir);
        restoreAttr(html, "lang", origLang);
        html.removeAttribute("data-cml-rtl");
      }
    } else {
      html.removeAttribute("data-cml");
      html.removeAttribute("data-cml-rtl");
      restoreAttr(html, "dir", origDir);
      restoreAttr(html, "lang", origLang);
      html.style.removeProperty("--cml-font");
    }
  }

  // ---------- plurals ----------
  // Intl.PluralRules (منصة Baseline منذ 2019) بدل الصيغ اليدوية: تُحمَل قواعد CLDR
  // محدَّثةً لكل لغة، فإضافة لغةٍ جديدة لا تستلزم كتابة قواعد جمعها في المحرك —
  // والمشروع مفتوح ليضيف آخرون لغات. الخريطة أدناه **صريحة** لأن ترتيبها هو عقدُ
  // مصفوفات forms في القاموس — لغةٌ تُضاف مستقبلًا يُضاف سطرُ ترتيبها هنا، وفئةٌ
  // غير مذكورة في السطر تسقط إلى «other» (سلوك اللغات ناقصة الصيغ نفسه الذي كان قبلُ).
  var PLURAL_FORMS = {
    ar: ["zero", "one", "two", "few", "many", "other"],
    default: ["one", "other"],
  };
  var prCache = {};
  function pluralIndex(lang, n) {
    var order = PLURAL_FORMS[lang] || PLURAL_FORMS.default;
    var cat;
    try {
      var pr = prCache[lang] || (prCache[lang] = new Intl.PluralRules(lang));
      cat = pr.select(n);
    } catch (e) { cat = n === 1 ? "one" : "other"; } // لغة لا يعرفها المتصفح
    var i = order.indexOf(cat);
    if (i < 0) i = order.indexOf("other");
    return i < 0 ? order.length - 1 : i;
  }
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function buildPlurals() {
    pluralRes = []; badPlurals = 0;
    if (!active) return;
    for (var eng in active.plurals) {
      var spec = active.plurals[eng];
      var forms = spec.forms || [];
      [eng, spec.plural].forEach(function (pat) {
        if (!pat) return;
        try { pluralRes.push({ re: new RegExp("^" + esc(pat).replace("%d", "(\\d+)") + "$"), forms: forms }); } catch (e) { badPlurals++; }
      });
    }
  }
  function tryPlural(text) {
    if (!pluralRes) return null;
    for (var i = 0; i < pluralRes.length; i++) {
      var m = text.match(pluralRes[i].re);
      if (m) {
        var n = +m[1];
        var f = pluralRes[i].forms[pluralIndex(state.lang, n)];
        if (f === undefined) f = pluralRes[i].forms[pluralRes[i].forms.length - 1] || "";
        return f.replace("%d", n);
      }
    }
    return null;
  }

  // ---------- dynamic patterns (dates, "%d days ago" composites, greeting-with-name…) ----------
  // dictionary "patterns": [{re, ar}] — ar may use $1..$9 (captured group),
  // %M<n> (group n is an English month name → Arabic), %W<n> (weekday), %P<n> (AM/PM),
  // and %C<n> (place name → Arabic *if known*, otherwise kept verbatim — never fails
  // the pattern, so an unknown city still gets the rest of the line translated).
  var MONTHS = { Jan: "يناير", January: "يناير", Feb: "فبراير", February: "فبراير", Mar: "مارس", March: "مارس", Apr: "أبريل", April: "أبريل", May: "مايو", Jun: "يونيو", June: "يونيو", Jul: "يوليو", July: "يوليو", Aug: "أغسطس", August: "أغسطس", Sep: "سبتمبر", Sept: "سبتمبر", September: "سبتمبر", Oct: "أكتوبر", October: "أكتوبر", Nov: "نوفمبر", November: "نوفمبر", Dec: "ديسمبر", December: "ديسمبر" };
  var WDAYS = { Mon: "الاثنين", Monday: "الاثنين", Tue: "الثلاثاء", Tuesday: "الثلاثاء", Wed: "الأربعاء", Wednesday: "الأربعاء", Thu: "الخميس", Thursday: "الخميس", Fri: "الجمعة", Friday: "الجمعة", Sat: "السبت", Saturday: "السبت", Sun: "الأحد", Sunday: "الأحد" };
  var PERIODS = { AM: "صباحًا", PM: "مساءً" };
  // أماكن شائعة (مدن ومناطق) — غير الموجود يبقى كما ورد
  var PLACES = {
    Riyadh: "الرياض", Jeddah: "جدة", Jiddah: "جدة", Mecca: "مكة المكرمة", Makkah: "مكة المكرمة",
    Medina: "المدينة المنورة", Madinah: "المدينة المنورة", Dammam: "الدمام", Khobar: "الخبر",
    Dhahran: "الظهران", Buraydah: "بريدة", Buraidah: "بريدة", Unaizah: "عنيزة", Tabuk: "تبوك",
    Abha: "أبها", "Khamis Mushait": "خميس مشيط", Taif: "الطائف", "Ta'if": "الطائف",
    Hail: "حائل", "Ha'il": "حائل", Najran: "نجران", Jazan: "جازان", Yanbu: "ينبع",
    Jubail: "الجبيل", Qatif: "القطيف", Hofuf: "الهفوف", Sakaka: "سكاكا", Arar: "عرعر",
    "Al-Qassim": "القصيم", Qassim: "القصيم", "'Asir": "عسير", Asir: "عسير",
    "Al-Bahah": "الباحة", Bahah: "الباحة", "Al-Jawf": "الجوف", Jawf: "الجوف",
    "Eastern Province": "المنطقة الشرقية", "Northern Borders": "الحدود الشمالية",
  };
  var patRes = null;
  // القاعدة الفاسدة تُعدّ وتُصرَّح — الابتلاع الصامت يجعل المستخدم يرى قاعدته محفوظةً
  // في الإعدادات والمحرك لا يطبّقها أبدًا فيظن الإضافة معطلة (قاعدة §7ج: الصمت يُقرأ عطلًا آخر)
  var badPatterns = 0, badPlurals = 0, lastBadReport = -1;
  function buildPatterns() {
    patRes = []; badPatterns = 0;
    if (!active || !active.patterns) return;
    for (var i = 0; i < active.patterns.length; i++) {
      var p = active.patterns[i];
      if (!p || !p.re || !p.ar) continue;
      try { patRes.push({ re: new RegExp(p.re), ar: p.ar }); } catch (e) { badPatterns++; }
    }
  }
  function tryPatterns(text) {
    if (!patRes || !patRes.length || !/[A-Za-z]/.test(text)) return null;
    for (var i = 0; i < patRes.length; i++) {
      var m = text.match(patRes[i].re);
      if (!m) continue;
      var bad = false;
      var out = patRes[i].ar
        .replace(/%M(\d)/g, function (t, g) { var v = MONTHS[m[+g]]; if (v === undefined) { bad = true; return t; } return v; })
        .replace(/%W(\d)/g, function (t, g) { var v = WDAYS[m[+g]]; if (v === undefined) { bad = true; return t; } return v; })
        .replace(/%P(\d)/g, function (t, g) { var v = PERIODS[m[+g]]; if (v === undefined) { bad = true; return t; } return v; })
        .replace(/%C(\d)/g, function (t, g) { var raw = m[+g]; if (raw === undefined) return ""; var v = PLACES[raw]; return v === undefined ? raw : v; })
        .replace(/\$(\d)/g, function (t, g) { return m[+g] !== undefined ? m[+g] : ""; });
      if (!bad) return out; // an unmapped %M/%W/%P means the pattern didn't really fit — try the next one
    }
    return null;
  }

  // ---------- text + attributes ----------
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, CODE: 1, PRE: 1, KBD: 1, SAMP: 1 };
  // ★ الحاجز بالأب المباشر وحده لا يكفي: كتلة شيفرة بنية <pre><code><span>…</span></code></pre>
  // — وهي بنية إبراز الصياغة المعتادة — أبو عقدتها النصية <span> لا <code>، فيمرّ نصّ
  // الشيفرة فيُترجَم. `closest` يصعد إلى الجذر بلا سقف فيسدّها. (مسار walk كان محميًّا
  // بالتقليم من مستوى العنصر، أما مسار الطفرات فينفذ إلى translateText مباشرة.)
  var SKIP_ANCESTOR = "script, style, noscript, textarea, code, pre, kbd, samp";
  function inSkipped(el) {
    if (el && el.nodeType !== 1) el = el.parentNode;
    if (!el || el.nodeType !== 1 || !el.closest) return false;
    try { return !!el.closest(SKIP_ANCESTOR); } catch (e) { return false; }
  }
  var ATTRS = ["placeholder", "aria-label", "title", "alt"];

  // سجلّ ما تُرجم: عقدة → {raw الأصل الإنجليزي, key, lastWritten آخر ما كتبناه}.
  // بدونه يضيع الأصل بعد الترجمة، فلا يمكن تطبيق تصحيحات «كلماتك المحفوظة» على عقدة
  // مترجمة إلا بإعادة تحميل الصفحة — وهو ما كان يجعل الميزة تبدو معطلة.
  var appliedText = new WeakMap();
  var appliedAttr = new WeakMap();

  // ★ ذاكرة نتائج البحث (تشمل الإخفاق). بعد توسّع القواعد إلى ما يقارب الألف صار كل نصٍّ
  // غير مترجَم يكلّف مسحًا كاملًا للأنماط (~0.35 مللي ثانية للنص الواحد قياسًا)، وواجهة
  // claude.ai تعيد عرض العقد نفسها مئات المرات أثناء البث والتمرير — فبلا تخزين تتكرر
  // الكلفة نفسها بلا فائدة. المفتاح ← الناتج (أو null). تُمسح في compile() لأن تعديل
  // «كلماتك المحفوظة» أو القواعد المستوردة يغيّر النتائج.
  var lookupCache = null;
  var LOOKUP_CACHE_MAX = CONST.LOOKUP_CACHE_MAX;

  // سلسلة البحث الموحّدة: القاموس ← الجموع ← الأنماط. null = لا ترجمة.
  function lookup(key) {
    if (lookupCache) {
      var hit = lookupCache.get(key);
      if (hit !== undefined) return hit;
    }
    var v = active.overrides[key];
    if (v === undefined) v = active.strings[key];
    if (v === undefined) { var pl = tryPlural(key); if (pl !== null) v = pl; }
    if (v === undefined) { var pt = tryPatterns(key); if (pt !== null) v = pt; }
    var out = v === undefined ? null : v;
    if (lookupCache) {
      if (lookupCache.size >= LOOKUP_CACHE_MAX) lookupCache.clear(); // سقف يحمي الذاكرة
      lookupCache.set(key, out);
    }
    return out;
  }

  // Never touch the CONTENT of a conversation (user/Claude message prose):
  // the engine only relabels UI chrome, never reads/rewrites message text.
  // كان الصعود يدويًّا بسقف عشرة مستويات، فرسالةٌ عميقة التداخل (قائمة داخل اقتباس داخل
  // جدول) تتجاوز السقف فيُعامَل نصّها معاملة الواجهة ويُعاد كتابته — وهو ما يحرّم على
  // الإضافة أن تفعله. closest يصعد إلى الجذر بلا سقف وهو مبنيّ في المتصفح فأسرع.
  var CHAT_ANCESTOR = ".prose, .font-claude-message, [data-testid*='user-message'], [data-testid*='message-content']";
  function inChatContent(el) {
    if (el && el.nodeType !== 1) el = el.parentNode;
    if (!el || el.nodeType !== 1 || !el.closest) return false;
    try { return !!el.closest(CHAT_ANCESTOR); } catch (e) { return false; }
  }
  function translable(node) {
    var p = node.parentNode;
    if (!p) return false;
    if (inSkipped(p)) return false;   // بالسلف لا بالأب المباشر (شيفرة ملفوفة في <span>)
    if (p.isContentEditable) return false;
    if (inChatContent(p)) return false;
    return true;
  }
  // ---------- الحل الجذري لاختلاط الاتجاهين (لقطة «العمل المشترك (Cowork)») ----------
  // ١) عزل اتجاهي: ترجمةٌ تخلط حروفًا عربية ولاتينية داخل حاويةٍ أيًّا كان اتجاهُها
  //    كانت تتبعثر بصريًّا بجوار الأرقام والأقواس. FSI/PDI (U+2068/U+2069) هما حلُّ
  //    المنصة القياسي: القطعة تُرتَّب داخليًّا بأول حرفٍ قويٍّ فيها وتُعامَل خارجيًّا
  //    وحدةً واحدة — لا رقعة CSS لكل موضع. النقية (عربية فقط) تُترك بلا لفّ.
  //    lastWritten يخزّن الملفوف فتبقى مقارنات «كما تركناها» صادقة، والاستعادة بالأصل.
  var FSI = "\u2068", PDI = "\u2069";
  var HAS_RTL_CH = new RegExp("[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]");
  var HAS_LTR_CH = /[A-Za-z]/;
  function bidiWrap(s) {
    return HAS_RTL_CH.test(s) && HAS_LTR_CH.test(s) ? FSI + s + PDI : s;
  }
  // ٢) نبضة إعادة قياس: مكوناتُ الموقع تقيس عروضَ نصوصها عند الإقلاع (مؤشرُ شرائح
  //    «محادثة/العمل المشترك» المنزلق) ثم نبدّل النص بالعربية الأطول فيبقى القياسُ
  //    القديم قصًّا وانزياحًا — وهذه أرضُ «المحسوب» التي لا تلمسها CSS بمبدئنا.
  //    أخفُّ علاجٍ جذريٍّ عام: نبضةُ resize واحدة مدمجةٌ بعد كل دفعة تعريب، فتعيد
  //    المكوناتُ قياسَها بمساراتها هي. لا حلقةَ هنا: الدفعة التالية بلا كتابةٍ فلا نبضة.
  var relayoutTimer = null;
  function scheduleRelayoutNudge() {
    if (relayoutTimer) return;
    relayoutTimer = setTimeout(function () {
      relayoutTimer = null;
      try { window.dispatchEvent(new Event("resize")); } catch (e) {}
    }, 250);
  }

  function translateText(node) {
    if (!active || !translable(node)) return;
    var prev = appliedText.get(node);
    if (prev) {
      if (node.nodeValue === prev.lastWritten) {
        // العقدة كما تركناها: أعد اشتقاق الترجمة من الأصل (يلتقط تصحيحًا جديدًا أو حذفه)
        var nv = lookup(prev.key);
        var want = nv === null ? prev.raw : prev.raw.replace(prev.key, function () { return bidiWrap(nv); });
        if (node.nodeValue !== want) { node.nodeValue = want; prev.lastWritten = want; scheduleRelayoutNudge(); }
        if (nv === null) appliedText.delete(node); // عاد للأصل — عقدة عادية من جديد
        return;
      }
      // الموقع نفسه غيّر النص (عدّاد مثلًا) — انسَ القديم وترجم الجديد ترجمة عادية
      appliedText.delete(node);
    }
    var raw = node.nodeValue;
    if (!raw) return;
    var key = raw.trim();
    if (!key || key.length > CONST.TEXT_MAX) return; // الأوصاف الطويلة مسموحة (نص المحادثة مستثنى أصلاً)
    var v = lookup(key);
    if (v !== null && v !== key) {
      var out = raw.replace(key, function () { return bidiWrap(v); });
      appliedText.set(node, { raw: raw, key: key, lastWritten: out });
      node.nodeValue = out;
      scheduleRelayoutNudge();
      return;
    }
    // لا يُسجَّل شيء هنا: النصّ قُرئ للمطابقة فحسب، ولم يُطابق، فيُترك ويُنسى. لا يُخزَّن
    // ولا يُراكَم ولا يُرسَل. (وهذا موضع الفرق: القراءة عابرة، والتخزين معدوم.)
    // اكتشاف النصوص غير المترجمة يجري عبر «فحص الموقع» الذي يقرأ ملفات claude.ai العامة.
  }
  function translateAttrs(el) {
    if (!active || el.nodeType !== 1 || !el.getAttribute) return;
    if (inChatContent(el)) return;
    var rec = appliedAttr.get(el);
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i], val = el.getAttribute(a);
      if (!val) continue;
      var prev = rec && rec[a];
      if (prev) {
        if (val === prev.lastWritten) {
          var nv = lookup(prev.key);
          var want = nv === null ? prev.raw : prev.raw.replace(prev.key, function () { return bidiWrap(nv); });
          if (val !== want) { el.setAttribute(a, want); prev.lastWritten = want; scheduleRelayoutNudge(); }
          if (nv === null) delete rec[a];
          continue;
        }
        delete rec[a]; // الموقع بدّل السمة — ترجمة عادية من جديد
      }
      var key = val.trim();
      if (!key || key.length > CONST.TEXT_MAX) continue; // السقف نفسه المطبَّق على عقد النص
      var t = lookup(key);
      if (t !== null && t !== key) {
        var out = val.replace(key, function () { return bidiWrap(t); });
        if (!rec) { rec = {}; appliedAttr.set(el, rec); }
        rec[a] = { raw: val, key: key, lastWritten: out };
        el.setAttribute(a, out);
        scheduleRelayoutNudge();
      }
    }
  }
  // إيقاف الترجمة يجب أن يُرجع النص الإنجليزي فورًا، لا أن يترك ما تُرجم مترجمًا.
  // سجلّ الأصول يجعل ذلك ممكنًا بلا تحديث الصفحة.
  function restoreAll(root) {
    var scope = root || document.body || document.documentElement;
    if (!scope) return;
    var tw = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, null);
    var n, list = [];
    while ((n = tw.nextNode())) list.push(n);
    for (var i = 0; i < list.length; i++) {
      var rec = appliedText.get(list[i]);
      if (rec && list[i].nodeValue === rec.lastWritten) { list[i].nodeValue = rec.raw; appliedText.delete(list[i]); }
    }
    if (scope.querySelectorAll) {
      var els = scope.querySelectorAll("[placeholder],[aria-label],[title],[alt]");
      for (var j = 0; j < els.length; j++) {
        var ar = appliedAttr.get(els[j]);
        if (!ar) continue;
        for (var a in ar) {
          if (els[j].getAttribute(a) === ar[a].lastWritten) els[j].setAttribute(a, ar[a].raw);
        }
        appliedAttr.delete(els[j]);
      }
    }
    scheduleRelayoutNudge(); // الاستعادةُ تغييرُ أطوالٍ كذلك — القياسات القديمة بطلت
  }

  function walk(root) {
    if (!active || !state.enabled || !root) return;
    // تقليم من مستوى العنصر: صعودٌ واحد بدل صعودٍ لكل عقدة نصية داخل الفرع.
    if (root.nodeType === 1 && inChatContent(root)) return;
    if (root.nodeType === 1) {
      translateAttrs(root);
      var els = root.querySelectorAll("[placeholder],[aria-label],[title],[alt]");
      for (var i = 0; i < els.length; i++) translateAttrs(els[i]);
    }
    // نمشي على العناصر والنصوص معًا: عنصرُ محادثةٍ يُرفض فيُقلَّم فرعه كله بفحص واحد،
    // بدل استدعاء inChatContent لكل عقدة نصية داخل ردٍّ طويل (مئات العقد).
    var tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (n.nodeType === 1) {
          if (SKIP[n.nodeName] || n.isContentEditable) return NodeFilter.FILTER_REJECT;
          try { if (n.matches && n.matches(CHAT_ANCESTOR)) return NodeFilter.FILTER_REJECT; } catch (e) {}
          return NodeFilter.FILTER_SKIP; // تجاوز العنصر نفسه واستمر في أبنائه
        }
        var p = n.parentNode;
        if (!p || SKIP[p.nodeName] || p.isContentEditable) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    var batch = [], n;
    while ((n = tw.nextNode())) batch.push(n);
    for (var j = 0; j < batch.length; j++) translateText(batch[j]);
  }

  // ---------- observe dynamic UI ----------
  // لا نحتفظ بسجلات الطفرات كما هي: السجل يمسك addedNodes وremovedNodes (قوائم عقد حيّة)
  // فتبقى شجرةٌ أُزيلت محتجزةً في الذاكرة، وتبويبٌ خلفي يبثّ دقائق يراكم عشرات الآلاف من
  // السجلات لأن requestIdleCallback لا يكاد يعمل وهو مخفيّ. نستخرج الأهداف فورًا في
  // مجموعات (إزالة تكرار مجانية) بسقفٍ يمنع التضخم غير المحدود.
  var queued = false;
  var pendAdded = [], pendText = new Set(), pendAttr = new Set();
  var pendOverflow = false;
  var PEND_MAX = CONST.PEND_MAX;
  var ric = window.requestIdleCallback ? window.requestIdleCallback.bind(window) : null;
  var schedule = ric ? function (cb) { return ric(cb, { timeout: 500 }); } : function (cb) { return setTimeout(cb, 200); };
  function clearPending() { pendAdded = []; pendText.clear(); pendAttr.clear(); }
  var obs = new MutationObserver(function (list) {
    if (!state.enabled || !active) return;
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (pendAdded.length + pendText.size + pendAttr.size > PEND_MAX) {
        // تجاوزنا السقف: انسَ التفاصيل واكتفِ بمرور كامل لاحق — أرخص وأضمن من طابور متضخم
        pendOverflow = true; clearPending(); break;
      }
      if (m.type === "childList") {
        for (var k = 0; k < m.addedNodes.length; k++) {
          var nd = m.addedNodes[k];
          if (nd.nodeType === 1 || nd.nodeType === 3) pendAdded.push(nd);
        }
      } else if (m.type === "characterData") pendText.add(m.target);
      else if (m.type === "attributes") pendAttr.add(m.target);
    }
    if (queued) return; queued = true;
    schedule(function () {
      queued = false;
      // الحالة قد تكون تبدّلت بين جدولة الدفعة وتنفيذها (حتى نصف ثانية). بلا هذا الفحص
      // تُنفَّذ دفعة قديمة بعد أن أوقف المستخدم الترجمة فتعيد ترجمة عقد أرجعها restoreAll
      // إلى الإنجليزية — فتبقى عبارات عربية عالقة في صفحة «موقفة» حتى إعادة التحميل.
      if (!state.enabled || !active) { clearPending(); pendOverflow = false; return; }
      if (pendOverflow) { pendOverflow = false; clearPending(); fullPass(); return; }
      var added = pendAdded, texts = pendText, attrs = pendAttr;
      pendAdded = []; pendText = new Set(); pendAttr = new Set();
      for (var i = 0; i < added.length; i++) {
        var nd = added[i];
        if (!nd.isConnected) continue; // عقدة أُزيلت قبل أن نصل إليها
        if (nd.nodeType === 1) { walk(nd); applyChatDir(nd); }
        else translateText(nd);
      }
      texts.forEach(function (n) { if (n.isConnected) translateText(n); });
      attrs.forEach(function (n) { if (n.isConnected) translateAttrs(n); });
    });
  });

  // ---------- conversation direction (optional; دير=auto lets the browser flow Arabic RTL and keep code/English LTR) ----------
  var CHATSEL = ".prose, .font-claude-message, [data-testid='user-message'], [data-testid='message-content']";
  function applyChatDir(root) {
    if (!root) return;
    var scope = root.nodeType === 1 ? root : (document.body || document.documentElement);
    if (!scope || !scope.querySelectorAll) return;
    var list = [];
    if (scope.matches && scope.matches(CHATSEL)) list.push(scope);
    var found = scope.querySelectorAll(CHATSEL);
    for (var i = 0; i < found.length; i++) list.push(found[i]);
    var on = state.enabled && state.chatrtl;
    for (var j = 0; j < list.length; j++) {
      var el = list[j];
      if (on) {
        el.setAttribute("dir", "auto");
        el.setAttribute("data-cml-dir", "1");
        // ★ dir=auto على الحاوية وحدها يحسم الاتجاه بأول حرف قويّ في الرسالة كلها،
        // فردٌّ يبدأ بالإنجليزية ثم يسترسل بالعربية يُعرض كله LTR وفقراته العربية
        // بمحاذاة يسارية. الحسم لكل فقرة على حدة هو ما يجعل النص المختلط سليمًا.
        var kids = el.querySelectorAll("p, li, h1, h2, h3, h4, h5, h6, blockquote, td, th, dd, dt, figcaption");
        for (var q = 0; q < kids.length; q++) {
          if (kids[q].closest("pre, code")) continue; // الشيفرة تبقى LTR
          kids[q].setAttribute("dir", "auto");
          kids[q].setAttribute("data-cml-dir", "1");
        }
      } else if (el.getAttribute("data-cml-dir")) {
        el.removeAttribute("dir"); el.removeAttribute("data-cml-dir");
      }
    }
    // تنظيف الأبناء عند الإطفاء (السلكتور أعلاه لا يلتقطهم لأنهم ليسوا حاويات رسائل)
    if (!on && scope.querySelectorAll) {
      var marked = scope.querySelectorAll("[data-cml-dir]");
      for (var z = 0; z < marked.length; z++) { marked[z].removeAttribute("dir"); marked[z].removeAttribute("data-cml-dir"); }
    }
  }

  // ---------- فحص تحديثات الموقع (يُطلب من صفحة الإعدادات عبر مفتاح تخزين) ----------
  // claude.ai مقسّم إلى مئات الملفات تُحمَّل بتسلسل عميق، فالزحف التكراري هو السبيل
  // الوحيد لرؤية كل النصوص. يعمل هنا لأننا داخل الصفحة (نفس الأصل) — بلا صلاحيات إضافية.
  // فكُّ الحرفيّات صار في cml-shared.js — نسخة واحدة للمحرك وأدوات التوليد (درس §7و)
  var CTRL_RE = new RegExp("[\\u0000-\\u001f\\u007f]");
  var unescapeLiteral = SHARED.unescapeLiteral;

  var scanning = false;
  var cancelScan = false;
  var SCAN_ID = String(Math.random()).slice(2) + "-" + Date.now(); // هوية هذا الإطار
  function setScan(o) { try { chrome.storage.local.set({ cml_scan_result: o }); } catch (e) {} }

  // طلب الفحص يُذاع إلى **كل** تبويبات وإطارات claude.ai. بلا تنسيق يزحف كلٌّ منها
  // زحفًا كاملًا (مئات الطلبات × عدد التبويبات) وتتضارب عدّاداتها في صفحة الإعدادات.
  // الحل: حجز بمفتاح مشترك — أول من يكتب هويته يفوز، والبقية تنسحب بصمت.
  function claimScan(cb) {
    if (window.top !== window) return cb(false); // الإطارات الداخلية لا تزحف أصلًا
    try {
      SESS.get(["cml_scan_claim"], function (s) {
        var c = s.cml_scan_claim;
        // حجز قديم (>90 ثانية) يُعدّ متروكًا — تبويب أُغلق في منتصف فحصه
        if (c && c.id && c.at && Date.now() - c.at < CONST.CLAIM_STALE_MS) return cb(false);
        SESS.set({ cml_scan_claim: { id: SCAN_ID, at: Date.now() } }, function () {
          // تأخير عشوائي قصير قبل التحقق: «اكتب ثم اقرأ» ليست عملية ذرّية، وتبويبان
          // أيقظهما البثّ نفسه قد تتداخل كتاباتهما فيرى كلٌّ هويته ويفوزان معًا. المهلة
          // تجعل آخر كاتب هو الفائز الوحيد، ويكمّلها فحص الملكية الدوري في step().
          setTimeout(function () {
            SESS.get(["cml_scan_claim"], function (s2) {
              cb(!!(s2.cml_scan_claim && s2.cml_scan_claim.id === SCAN_ID));
            });
          }, 120 + Math.floor(Math.random() * 180));
        });
      });
    } catch (e) { cb(false); } // تعطّل التخزين ⇒ لا حجز ⇒ لا زحف يتيم بلا تنسيق
  }
  function releaseScan() { try { SESS.set({ cml_scan_claim: null }); } catch (e) {} }
  // تجديد طابع الحجز أثناء الزحف: عتبة «المتروك» تسعون ثانية، والزحف الكامل يتجاوزها
  // بكثير — فبلا تجديد يصير الزاحفُ الحيّ متروكًا في نظر بقية التبويبات وصفحة الإعدادات.
  function touchClaim() { try { SESS.set({ cml_scan_claim: { id: SCAN_ID, at: Date.now() } }); } catch (e) {} }
  // ---------- تحكيم عامل الخدمة (المرحلة ٤ — الفحص 2.0) ----------
  // رسالة «طلب منحة» إلى معالجٍ أحاديِّ الخيط: أول طالبٍ يفوز والباقي يُرفض — لا
  // سباق بنيويًّا، ولا طوابع تقادم: المنحة حياتُها حياةُ منفذها (أُغلق التبويب ⇒
  // تحررت فورًا، لا انتظار 90ث). حجزُ التخزين القديم يبقى **طبقة سقوط** كاملةً حيث
  // لا عامل (قشور الاختبار — وبها تبقى اختبارات القفل الثمانية حارسةً لهذا المسار،
  // أو سياقٌ أبطله تحديث الإضافة، أو عاملٌ متعطل تجاوز مهلته).
  //
  // ★ «مقبضٌ» لكل منحة لا حالةٌ مشتركة (درس دحضٍ مؤكد): كان swPort/swMode مفردين
  // على مستوى الوحدة، فسقوطُ مهلةِ طلبٍ للطبيب يقلب swMode تحت زحف ترجمةٍ حيّ،
  // وتحريرُ الطبيب يقطع منفذَ الزحف فيُجهضه. الآن يرجع swClaim مقبضًا يملكه طالبُه
  // وحده — beat/alive/release كلها عليه، ومقبضُ الطبقة القديمة يوحّد الواجهة
  // (نبضُه هو تجديد الطابع وحياتُه هي مطابقة الهوية) فتختفي كل أوامر «إن كان الوضع».
  function swClaim(kind, cb, onLost) {
    var settled = false, timer = null, port = null;
    function legacyGrant() {
      return {
        legacy: true,
        beat: function () { touchClaim(); },
        alive: function (acb) {
          try {
            SESS.get(["cml_scan_claim"], function (s) {
              acb(!!(s.cml_scan_claim && s.cml_scan_claim.id === SCAN_ID));
            });
          } catch (e) { acb(true); }
        },
        release: function () { releaseScan(); },
      };
    }
    function fallback() {
      if (settled) return;
      settled = true;
      try { clearTimeout(timer); } catch (e) {}
      // اقطع المنفذ إن فُتح: منحةٌ متأخرة على منفذٍ شبح كانت ستحجب بقية التبويبات
      // حتى يُغلق تبويبُنا — والقطعُ يحرّرها في المحكّم فورًا.
      if (port) { try { port.disconnect(); } catch (e) {} port = null; }
      claimScan(function (won) { cb(won, won ? legacyGrant() : null); });
    }
    try {
      if (!chrome.runtime || typeof chrome.runtime.connect !== "function") return fallback();
      port = chrome.runtime.connect({ name: CONST.PORT_CRAWL });
      timer = setTimeout(fallback, 700); // عاملٌ لا يرد = معطّل ⇒ الطبقة القديمة
      var handle = null;
      port.onMessage.addListener(function (m) {
        if (settled || !m) return;
        if (m.type === "grant") {
          settled = true;
          try { clearTimeout(timer); } catch (e) {}
          handle = {
            legacy: false,
            dead: false,
            beat: function () { if (!handle.dead) { try { port.postMessage({ type: "beat" }); } catch (e) {} } },
            alive: function (acb) { acb(!handle.dead); },
            release: function () {
              if (handle.dead) return;
              handle.dead = true;
              try { port.postMessage({ type: "release" }); } catch (e) {}
              try { port.disconnect(); } catch (e) {}
            },
          };
          cb(true, handle);
        } else if (m.type === "deny") {
          settled = true;
          try { clearTimeout(timer); } catch (e) {}
          try { port.disconnect(); } catch (e) {}
          cb(false, null);
        }
      });
      port.onDisconnect.addListener(function () {
        if (!settled) { fallback(); return; } // العامل غير متاح أصلًا
        if (handle && !handle.dead) {
          // مات العامل أثناء المنحة (نادر): المقبض ميت — صاحبه يقرر الاسترداد
          handle.dead = true;
          if (onLost) onLost();
        }
      });
      port.postMessage({ type: "claim", kind: kind });
    } catch (e) { fallback(); }
  }
  // منحتا المسارين — كلٌّ يملك خانته وحده ولا يمسّ الأخرى
  var scanGrant = null;
  var rtlGrant = null;
  function dropScanGrant() { if (scanGrant) { scanGrant.release(); scanGrant = null; } }
  function dropRtlGrant() { if (rtlGrant) { rtlGrant.release(); rtlGrant = null; } }
  // استردادُ منحة الزحف بعد موت العامل — مُعاد التسليح ذاتيًّا (موتٌ ثانٍ كان يُيتم
  // الزحف بصمت)، ومع حارسي «ما زلنا نزحف؟» كي لا تُحتجز منحةٌ يتيمة بعد الانسحاب
  function lostScan() {
    if (!scanning) return;
    swClaim("scan", function (won, h) {
      if (!won) { cancelScan = true; return; }
      if (!scanning) { h.release(); return; }
      scanGrant = h;
    }, lostScan);
  }
  function lostRtl() {
    if (!rtlDocRunning) return;
    swClaim("rtl", function (won, h) {
      if (!won) return; // فقدناها لغيرنا: الطبيب قراءةٌ قصيرة — يكملها بلا منحة
      if (!rtlDocRunning) { h.release(); return; }
      rtlGrant = h;
    }, lostRtl);
  }

  // ★ الردّ الفوري (إشعار استلام). كان المحرّك يصمت في كل مسارات الرفض — إن كان مشغولًا،
  // أو خسر الحجز، أو تعطّل التخزين — فتنتظر صفحة الإعدادات عشرين ثانية ثم تقول «لم يستجب
  // أي تبويب». وهي رسالة كاذبة: التبويب استجاب لكنه امتنع بصمت، فيضيع الفرق بين
  // «لا سكربت حيّ» و«سكربت حيّ امتنع» — وهو الفرق الذي يحدّد ما يفعله المستخدم.
  // فالآن: كل إطار عُلويٍّ يستلم الطلب يكتب إشعار استلام فورًا قبل أي شيء.
  function ackScan() {
    setScan({ status: "running", fetched: 0, found: 0, queued: 0, missing: 0, at: Date.now() });
  }
  function runScan() {
    if (window.top !== window) return;          // الإطارات الداخلية لا تفحص ولا تُشعِر
    if (!active) return;                        // لا قاموس ⇒ لا معنى للفحص
    if (scanning) { ackScan(); return; }        // نفحص فعلًا: طمئنها بدل الصمت
    ackScan();
    swClaim("scan", function (won, h) {
      if (won) { scanGrant = h; return doScan(); }
      // خسرنا الحجز: إمّا فحصٌ حيّ في تبويب آخر (وسيكتب نتيجته ويدهس إشعارنا)، وإمّا
      // حجزٌ عالق. ننتظر قليلًا، فإن لم يظهر تقدّمٌ من غيرنا صرّحنا بالسبب بدل تركه غامضًا.
      setTimeout(function () {
        try {
          chrome.storage.local.get(["cml_scan_result"], function (s) {
            var r = s.cml_scan_result;
            if (r && r.status === "running" && r.fetched > 0) return; // غيرُنا يعمل فعلًا
            if (r && r.status !== "running") return;                  // غيرُنا أنهى أو أخطأ
            setScan({ status: "error", error:
              "يبدو أن فحصًا آخر ما زال محجوزًا. إن لم يكن ثمة تبويب claude.ai آخر يفحص الآن، فاضغط «إيقاف» ثم «ابدأ الفحص» من جديد." });
          });
        } catch (e) {}
      }, 3000);
    }, lostScan);
  }
  function doScan() {
    if (scanning) return;
    scanning = true;
    // طلب الإلغاء يُذاع لكل التبويبات، لكن التصفير لا يقع إلا داخل abort/finish — أي في
    // التبويب الفاحص وحده. فتبويب لم يكن يفحص يحتفظ بالعلم مرفوعًا ويُجهض أول فحص يفوز به.
    cancelScan = false;
    var t0 = Date.now();
    // ★ النبض `at` لازم في **كل** تحديث «جارٍ» بلا استثناء. كان أول تحديث بلا نبض،
    // فإن مات الفحص بعده مباشرة (أُغلق التبويب، أُعيد تحميل الإضافة) بقيت في التخزين
    // نتيجةُ «running» بلا نبض إلى الأبد — وصفحة الإعدادات تعطّل زر البدء في هذه الحالة
    // ولا تعرض مخرجًا إلا بنبضٍ متقادم، فيصير الفحص مقفلًا لا يبدأ أبدًا.
    setScan({ status: "running", fetched: 0, found: 0, missing: 0, at: Date.now() });
    (function () {
      var scripts = [];
      var els = document.querySelectorAll("script[src]");
      for (var i = 0; i < els.length; i++) scripts.push(els[i].src);
      // بعض البنى تعلن ملفاتها بروابط تحميل مسبق لا بوسم script، فلا تُرى بدون هذا
      var links = document.querySelectorAll("link[rel='modulepreload'][href], link[rel='preload'][as='script'][href]");
      for (var i2 = 0; i2 < links.length; i2++) scripts.push(links[i2].href);

      // ★ اختيار ملف الدخول على مراحل. الاشتراط الصارم (مسار ‎/assets/v1/‎ حرفيًّا **و**
      // أصل الصفحة نفسه) كان يُفشل الفحص كليًّا متى غيّر الموقع مسار أصوله أو قدّمها من
      // نطاق فرعي — ورسالة «افتح صفحة claude.ai» تُوهم أن العلة عند المستخدم لا عندنا.
      // نتدرّج: أصلُنا ومسارٌ معروف ← عائلة claude.ai ← أي ملف حزمة مُبصَّم من أصلنا.
      // ويبقى الوعد محفوظًا: لا نقبل أصلًا خارج نطاق الموقع مهما كان مسار السكربت.
      function urlOf(u) { try { return new URL(u, location.href); } catch (e) { return null; } }
      function ours(h) { return h === location.hostname || /(^|\.)claude\.ai$/.test(h) || /(^|\.)anthropic\.com$/.test(h); }
      var HASHED = /\/[A-Za-z0-9_.]+-[A-Za-z0-9_-]{6,}\.[cm]?js(\?|$)/;
      function pickBy(test) {
        for (var pass = 0; pass < 2; pass++) {          // 0: أصل الصفحة  1: عائلة claude.ai
          for (var j = 0; j < scripts.length; j++) {
            var u = urlOf(scripts[j]);
            if (!u) continue;
            if (pass === 0 ? u.origin !== location.origin : !ours(u.hostname)) continue;
            if (test(u)) return u;
          }
        }
        return null;
      }
      var pick = pickBy(function (u) { return /\/assets\/v\d+\//.test(u.pathname); })
              || pickBy(function (u) { return HASHED.test(u.pathname); });
      if (!pick) {
        var origins = {};
        for (var q = 0; q < scripts.length; q++) { var uq = urlOf(scripts[q]); if (uq) origins[uq.origin] = 1; }
        scanning = false; dropScanGrant();
        setScan({ status: "error", error:
          "لم أعثر على ملفات الموقع في هذه الصفحة. تأكد أنك في تبويب claude.ai وأن الصفحة اكتمل تحميلها، ثم حدّثها (Ctrl+F5) وأعد الفحص." +
          " [تشخيص: عدد الملفات " + scripts.length + " · الأصول: " + (Object.keys(origins).join("، ") || "لا شيء") + " · الصفحة: " + location.origin + "]" });
        return;
      }
      var base = pick.href.slice(0, pick.href.lastIndexOf("/") + 1);
      var REF = /[A-Za-z0-9_]+-[A-Za-z0-9_-]{6,}\.js/g;
      var DM = /(?:"?defaultMessage"?):\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/g;
      var seen = {}, queue = [], msgs = {}, fetched = 0, found = 0, failed = 0;
      var GHOST = {};              // علامة 404: إشارة وهمية لا ملف — تُحصى ولا تُعدّ نقصًا
      var ghosts = 0, retryNames = [], retried = false;
      // ابذر الطابور بكل ملف يقع تحت القاعدة المكتشفة (لا تحت مسارٍ ثابتٍ مفترض)
      for (var k = 0; k < scripts.length; k++) {
        var uk = urlOf(scripts[k]);
        if (!uk || uk.href.indexOf(base) !== 0) continue;
        var f = uk.href.slice(base.length);
        if (f && !seen[f]) { seen[f] = 1; queue.push(f); }
      }
      // معالجة ملف واحد ثم إفساح المجال للصفحة. الملفات قد تبلغ ميغابايتات، ومعالجة
      // ثلاثين منها في مهمة واحدة تجمّد الواجهة مئات المللي ثانية في كل دفعة —
      // والمستخدم قد يكون يقرأ ردّ كلود في التبويب نفسه. التوازي 6 لا 30 لئلا يزاحم
      // الفحصُ تدفّقَ المحادثة على الاتصال نفسه.
      var PARALLEL = CONST.SCAN_PARALLEL;
      function scanOne(tx) {
        fetched++;
        var refs = tx.match(REF) || [];
        for (var b = 0; b < refs.length; b++) if (!seen[refs[b]]) { seen[refs[b]] = 1; queue.push(refs[b]); }
        var m;
        DM.lastIndex = 0;
        while ((m = DM.exec(tx))) {
          // ★★ فكُّ ترميزٍ حقيقي. كان الفكّ لا يعالج إلا \" و\' ثم **يرمي** كل نصّ بقي
          // فيه \u أو \x. وأدوات الحزم ترمّز كل محرف غير ASCII هكذا — فكان الفحص أعمى
          // عن **فئة محارف كاملة**: كل نصّ فيه فاصلة عليا مطبعية (’) أو شرطة طويلة (—)
          // أو نقاط حذف (…) يُرمى برمّته. وقياسًا على كتالوج الموقع: 16% من نصوص الواجهة.
          // وهذا هو السبب الجذري لِما يراه المستخدم على الشاشة غير مترجَم ولا يظهر في
          // نتيجة الفحص أبدًا. (العلة نفسها كانت في harvest-all-strings.js فحُرم القاموس
          // منها منذ البداية — وما تُرجم منها إنما جاء من حزمة سطح المكتب.)
          var s = unescapeLiteral(m[1] != null ? m[1] : m[2], m[1] == null);
          if (s === null) continue;                       // تعذّر الفكّ ⇒ تجاهُل، لا نصّ مشوّه
          s = s.replace(/\s+/g, " ").trim();
          if (!s || s.length < 2 || s.length > CONST.TEXT_MAX) continue;
          if (!/[A-Za-z]/.test(s)) continue;
          if (CTRL_RE.test(s)) continue;                  // محارف تحكّم: صار الفكّ يقبلها
          if (/^[#\/]|^\d|https?:|www\.|[@\\^~`|=]/.test(s) || /^[a-z]+([A-Z][a-z]+)+$/.test(s) || (/_/.test(s) && !/ /.test(s))) continue;
          // كتل ICU (جمع/اختيار) خارج نطاق التوليد التلقائي — تحتاج فئات العربية الست
          if (/\{[^{}]*,\s*(plural|select|selectordinal)\s*,/.test(s)) continue;
          if (/<\/?[A-Za-z][^>]*>/.test(s)) continue; // وسوم HTML داخل النص
          // نقبل الآن النصوص ذات المتغيّرات {name} — تُحوَّل إلى أنماط عند الاستيراد
          if (/\{/.test(s) && !/^[^{}]*(\{[A-Za-z_$][\w$]*\}[^{}]*)+$/.test(s)) continue;
          if (!msgs[s]) { msgs[s] = 1; found++; }
        }
      }
      // ★ التنازل بين الملفات. المشكلة: الفحص يجري في تبويب claude.ai بينما المستخدم في
      // تبويب الإعدادات — أي في تبويب **مخفيّ**. و`requestIdleCallback` لا تُنفَّذ أصلًا
      // ما دامت الصفحة مخفية (لا وقت خمول يُحتسب لها)، و`setTimeout` يُخنق إلى مرّة كل
      // ثانية. فالزحف كان يزحف زحفًا أو يقف. ورسائل المُرحِّل (MessageChannel) مهامٌّ
      // لا تخضع لخنق المؤقّتات، فهي السبيل الصحيح للتنازل في تبويب مخفيّ.
      // ولا نستعمل المهام الصغرى (Promise) هنا: سلسلةٌ منها لا تُفرَّغ فتَحرِم الشبكةَ
      // من فرصة تسليم ردودها فيتجمّد الزحف.
      var mcQueue = [], mc = null;
      try {
        mc = new MessageChannel();
        mc.port1.onmessage = function () { var f = mcQueue.shift(); if (f) f(); };
      } catch (e) { mc = null; }
      var yieldTo = function (fn) {
        // scheduler.yield (كروم 129+): مهامه لا تُخنق في التبويب المخفي — كالحيلة أدناه
        // تماماً بحسب وثيقة مجدول Blink، لكنه ليس Baseline (لا Safari) والسلوك موثَّق لا
        // مضمونٌ بمواصفة — فمسار MessageChannel يبقى احتياطاً شرطاً لا ترفاً.
        if (typeof scheduler !== "undefined" && typeof scheduler.yield === "function") {
          scheduler.yield().then(fn, function () { setTimeout(fn, 0); });
          return;
        }
        if (document.hidden && mc) { mcQueue.push(fn); mc.port2.postMessage(0); return; }
        if (window.requestIdleCallback) { window.requestIdleCallback(fn, { timeout: 200 }); return; }
        setTimeout(fn, 0);
      };
      var ownCheck = 0;
      function step() {
        if (cancelScan) return abort();
        if (!queue.length) {
          // جولة إعادة واحدة لإخفاقات الشبكة الحقيقية قبل الحكم بالنقص
          if (retryNames.length && !retried) {
            retried = true;
            queue = retryNames;
            retryNames = [];
            return stepNow();
          }
          failed = retryNames.length;
          return finish();
        }
        // تحقّق من ملكية الحجز كل عشر دفعات: إن مسحه بدءُ فحصٍ جديد أو فاز به تبويب آخر
        // فانسحب بدل مواصلة زحفٍ موازٍ تتداخل كتاباته مع الزاحف الفائز.
        if (++ownCheck % 10 === 0) {
          var g = scanGrant;
          return (g ? function (f) { g.alive(f); } : function (f) { f(true); })(function (ours) {
            if (!ours) {
              // فقدنا الملكية (سحبها بدءُ فحصٍ جديد أو خسرنا الاسترداد): انسحب بصمت —
              // فمن أخذها يكتب النتائج — لكن نظّف الموارد (الانسحاب القديم كان يسرّبها)
              scanning = false; cancelScan = false; releaseResources();
              return;
            }
            stepNow();
          });
        }
        stepNow();
      }
      function stepNow() {
        var batch = queue.splice(0, PARALLEL);
        Promise.all(batch.map(function (n) {
          // ★ `fetch` لا ترفض عند 404 ولا 500 — فكان جسمُ صفحة الخطأ يُمرَّر إلى scanOne
          // فيُحسب «ملفًا مفحوصًا» بلا نصوص. ثم فُصل الإخفاق صنفين (تشخيص حي 2026-09-04
          // على 2133 ملفًا: «المتعذرات» الـ32 كلها 404 دائمة):
          //  - 404 = «إشارة وهمية»: المعبّرُ يلتقط من نصوص الحزم أسماءً تشبه الملفات
          //    (أسماء عمال بمسارات أخرى، وأسماء ملفات أمثلة داخل رسائل مصرِّف مضمّنة،
          //    وملفات خارجية) — ليست ملفات موقع أصلًا، وإعادةُ الفحص لن «تصلحها» أبدًا،
          //    فعدُّها نقصًا كان إنذارًا كاذبًا بنيويًّا يوهم المستخدم أن النتيجة معيبة.
          //  - غيرُ 404 (شبكة/5xx): إخفاق حقيقي قابل للشفاء — يدخل جولةَ إعادةٍ واحدة،
          //    وما بقي بعدها هو «الناقص» المصرَّح به بحق.
          return fetch(base + n)
            .then(function (r) { return r.ok ? r.text() : (r.status === 404 ? GHOST : null); })
            .catch(function () { return null; });
        })).then(function (texts) {
          var a = 0;
          (function chew() {
            if (cancelScan) return abort();
            if (a >= texts.length) {
              // التقدّم = المعالَج ÷ (المعالَج + المتبقي)؛ الطابور ينمو أثناء الزحف فهو تقديري
              // at = نبض: صفحة الإعدادات تستدلّ به على تعثّر الفحص (تبويب أُغلق مثلًا)
              setScan({ status: "running", fetched: fetched, found: found, queued: queue.length, missing: 0, at: Date.now() });
              if (scanGrant) scanGrant.beat(); // الزحف الكامل يتجاوز 200 ثانية، وحجزٌ بطابعٍ قديم يُعدّ متروكًا
              return yieldTo(step);
            }
            if (texts[a] === null) retryNames.push(batch[a]);
            else if (texts[a] === GHOST) ghosts++;
            else scanOne(texts[a]);
            texts[a] = null; // حرّر النص فورًا بدل احتجاز الدفعة كلها
            a++;
            yieldTo(chew); // ملف واحد لكل مهمة
          })();
        });
      }
      // تحرير موارد الزحف. مُرحِّل الرسائل (MessageChannel) يبقى حيًّا ما بقيت الصفحة إن
      // لم يُغلق، ومعه طابور المهام وخريطة الملفات المرئية — فكل فحص يترك أثره في الذاكرة
      // إلى الأبد. والصفحة هنا تبقى مفتوحة ساعاتٍ، وقد يُعاد الفحص مرارًا.
      function releaseResources() {
        if (mc) {
          try { mc.port1.onmessage = null; mc.port1.close(); mc.port2.close(); } catch (e) {}
          mc = null;
        }
        mcQueue.length = 0;
        queue.length = 0;
        seen = null;
      }
      function abort() {
        scanning = false; cancelScan = false; dropScanGrant(); releaseResources();
        setScan({ status: "cancelled", fetched: fetched, found: found });
      }
      function finish() {
        // تصنيف ذكي: نص ثابت (مطابقة حرفية) مقابل نص فيه متغيّرات (يصير نمطًا)
        var plain = [], vars = [];
        for (var s in msgs) {
          if (active.strings[s] !== undefined || active.overrides[s] !== undefined) continue;
          if (tryPlural(s) !== null) continue;
          if (tryPatterns(s) !== null) continue;
          if (/\{[A-Za-z_$][\w$]*\}/.test(s)) vars.push(s); else plain.push(s);
        }
        plain.sort(); vars.sort();
        // ★ العدد الحقيقي **قبل** القصّ: نسبة التغطية في صفحة الإعدادات تُحسب من `missing`،
        // فلو حُسبت من المقصوص كذبت متى تجاوز غيرُ المترجَم السقف — تقول «4000 غير مترجَم»
        // وهي في الحقيقة أكثر، فتظهر التغطية أفضل مما هي. القائمتان تُقصّان (حمايةً للتخزين)
        // أما العدّ فيبقى صادقاً.
        var missingTotal = plain.length + vars.length;
        var capped = false;
        var CAP = CONST.SCAN_CAP;
        if (missingTotal > CAP) {
          capped = true;
          vars = vars.slice(0, Math.min(vars.length, Math.floor(CAP / 2)));
          plain = plain.slice(0, CAP - vars.length);
        }
        scanning = false;
        cancelScan = false;
        dropScanGrant();
        releaseResources();
        setScan({
          status: "done", fetched: fetched, found: found, capped: capped,
          failed: failed,                   // إخفاق شبكي حقيقي بقي بعد جولة الإعادة — نقصٌ بحق
          ghosts: ghosts,                   // إشارات وهمية (404): ليست ملفات موقع — لا نقص فيها
          missing: missingTotal,            // الحقيقي (قد يفوق المعروض عند القصّ)
          shown: plain.length + vars.length, // المعروض في القائمتين
          list: plain, varList: vars,
          at: Date.now(), seconds: Math.round((Date.now() - t0) / 1000),
        });
      }
      step();
    })();
  }

  // ---------- «طبيب الاتجاه» (المرحلة ٣) — شقيق فحص الترجمة ----------
  // يجلب CSS الموقع الحيّ من داخل الصفحة (نفس أصل الفحص وقيوده)، يحلّله بالنسخة
  // الواحدة CMLRtl، ويقارن كل إعلان فيزيائي ببصمات التغطية المشحونة — فيكشف ما
  // استجدّ في نشرة الموقع ولا يقلبه rtl-overrides.css، تمامًا كما يكشف فحصُ
  // الترجمة النصوصَ غير المترجمة. يتشارك الحجز مع الفحص فلا يجريان معًا.
  var rtlDocRunning = false;
  function setRtlDoc(o) { try { chrome.storage.local.set({ cml_rtldoc_result: o }); } catch (e) {} }
  function runRtlDoc() {
    if (window.top !== window) return;
    var RTL = globalThis.CMLRtl, COV = globalThis.CMLRtlCoverage;
    if (!RTL || !COV || !COV.keys) {
      setRtlDoc({ status: "error", error: "ملفات محرّك الاتجاه غير محمّلة — أعد تحميل التبويب بعد تحديث الإضافة." });
      return;
    }
    if (rtlDocRunning) { setRtlDoc({ status: "running", fetched: 0, at: Date.now() }); return; }
    setRtlDoc({ status: "running", fetched: 0, at: Date.now() }); // إشعار استلام فوري — كالفحص
    swClaim("rtl", function (won, h) {
      if (won) { rtlGrant = h; return doRtlDoc(RTL, COV); }
      // خاسر الحجز لا يكتب الخطأ فورًا: الطلب يُذاع لكل التبويبات، والكتابة العمياء
      // كانت تدهس إشعارَ الفائز فتظهر «فحص آخر يعمل» طوالَ فحصٍ يعمل فعلًا (دُحض
      // تجريبيًّا بتبويبين). ننتظر ثم لا نكتب إلا إن لم يظهر أثرٌ حيّ من غيرنا.
      setTimeout(function () {
        try {
          chrome.storage.local.get(["cml_rtldoc_result"], function (s) {
            var r = s.cml_rtldoc_result;
            if (r && r.status === "running" && r.at && Date.now() - r.at < 20000) return; // فائز حيّ
            if (r && r.status !== "running") return; // أنهى أو أخطأ — نتيجته أولى
            setRtlDoc({ status: "error", error: "يبدو أن فحصًا آخر محجوز (الترجمة أو الاتجاه). إن لم يكن ثمة فحص يعمل فعلًا فأعد المحاولة بعد لحظات." });
          });
        } catch (e) {}
      }, 3000);
    }, lostRtl);
  }
  function doRtlDoc(RTL, COV) {
    rtlDocRunning = true;
    var t0 = Date.now();
    var covSet = {};
    for (var c = 0; c < COV.keys.length; c++) covSet[COV.keys[c]] = 1;

    function urlOk(u) {
      try {
        var p = new URL(u, location.href);
        if (p.protocol !== "https:" && p.protocol !== "http:") return null; // أوراقنا chrome-extension تُستبعد هنا
        var h = p.hostname;
        if (h === location.hostname || /(^|\.)claude\.ai$/.test(h) || /(^|\.)anthropic\.com$/.test(h)) return p.href;
      } catch (e) {}
      return null;
    }
    var urls = [];
    var links = document.querySelectorAll("link[rel='stylesheet'][href]");
    for (var i = 0; i < links.length; i++) {
      var ok = urlOk(links[i].href);
      if (ok && urls.indexOf(ok) === -1) urls.push(ok);
    }
    function fetchCss(u) {
      return Promise.race([
        fetch(u).then(function (r) { return r.ok ? r.text() : null; }).catch(function () { return null; }),
        new Promise(function (res) { setTimeout(function () { res(null); }, 15000); }),
      ]);
    }
    Promise.all(urls.map(fetchCss)).then(function (texts) {
      // نبض بعد جولة الجلب الأولى + تجديد الحجز: أسوأ حالات الجلب (مهلتان ×15ث)
      // تقارب عتبة التعثر 45ث — وبلا نبضٍ يظهر الفحصُ الحيُّ متعثرًا لصفحة الإعدادات
      setRtlDoc({ status: "running", fetched: urls.length, at: Date.now() });
      if (rtlGrant) rtlGrant.beat();
      // مستوى واحد من @import (نادر لكنه موجود في أنظمة التصميم)
      var extra = [];
      for (var t = 0; t < texts.length; t++) {
        if (texts[t] === null) continue;
        var im = RTL.parseCss(texts[t]).imports;
        for (var m = 0; m < im.length; m++) {
          var r2 = urlOk(new URL(im[m], urls[t]).href);
          if (r2 && urls.indexOf(r2) === -1 && extra.indexOf(r2) === -1) extra.push(r2);
        }
      }
      return Promise.all(extra.map(fetchCss)).then(function (more) { return texts.concat(more); });
    }).then(function (texts) {
      setRtlDoc({ status: "running", fetched: texts.length, at: Date.now() }); // نبض قبل التحليل
      if (rtlGrant) rtlGrant.beat();
      // أوراق <style> الحرجة المضمّنة في الصفحة تُحلَّل مجانًا (بلا جلب)
      var styles = document.querySelectorAll("style:not([data-cml])");
      var inlineTexts = [];
      for (var s = 0; s < styles.length; s++) inlineTexts.push(styles[s].textContent || "");
      var failed = 0, rulesN = 0, physical = 0, covered = 0, animatedPhysical = 0;
      var uncovered = [], unflippable = [], localSeen = {};
      function chewSheet(tx) {
        if (tx === null) { failed++; return; }
        var p = RTL.parseCss(tx);
        animatedPhysical += p.stats.animatedPhysical || 0;
        for (var r = 0; r < p.rules.length; r++) {
          var rule = p.rules[r];
          rulesN++;
          if (rule.sel.indexOf("data-cml") !== -1) continue;               // مخرجاتنا
          if (/\[dir\s*[=\]]|:dir\(/.test(rule.sel)) continue;             // واعٍ بالاتجاه
          for (var d = 0; d < rule.decls.length; d++) {
            var a = RTL.analyzeDecl(rule.decls[d].prop, rule.decls[d].value);
            if (!a || a.kind === "logical") continue;
            physical++;
            if (a.kind === "physical-unflippable") {
              if (unflippable.length < 50) unflippable.push({ sel: rule.sel.slice(0, 120), prop: rule.decls[d].prop, reason: a.reason });
              continue;
            }
            var key = RTL.coverageKey(rule.ctx, rule.sel, rule.decls[d].prop);
            if (localSeen[key]) continue;
            localSeen[key] = 1;
            if (covSet[key]) { covered++; continue; }
            if (uncovered.length < CONST.RTLDOC_CAP) {
              uncovered.push({ sel: rule.sel.slice(0, 120), prop: rule.decls[d].prop, value: rule.decls[d].value.slice(0, 80) });
            }
          }
        }
      }
      for (var x = 0; x < texts.length; x++) chewSheet(texts[x]);
      for (var y = 0; y < inlineTexts.length; y++) chewSheet(inlineTexts[y]);
      // جولة على الأنماط السطرية — عدٌّ للتصريح فقط، فمبدؤنا ألّا تُمسّ
      var INLINE_RE = /(?:^|;)\s*(left|right|margin-left|margin-right|padding-left|padding-right|float|clear)\s*:/;
      var inlinePhysical = 0;
      var styled = document.querySelectorAll("[style]");
      var lim = Math.min(styled.length, 4000);
      for (var e = 0; e < lim; e++) {
        var sv = styled[e].getAttribute("style");
        if (sv && INLINE_RE.test(sv)) inlinePhysical++;
      }
      dropRtlGrant();
      rtlDocRunning = false;
      setRtlDoc({
        status: "done",
        files: urls.length, failed: failed, rules: rulesN,
        physical: physical, covered: covered,
        // العدّ الحقيقي قبل القصّ (عقد الفحص نفسه: القائمة تُقصّ والعدّ يصدق)
        uncovered: Object.keys(localSeen).length - covered,
        shown: uncovered.length,
        list: uncovered, unflippable: unflippable,
        animatedPhysical: animatedPhysical, // حركات اتجاهية — تُبلَّغ ولا تُقلب (قرار)
        inlinePhysical: inlinePhysical, inlineChecked: lim,
        shipped: COV.keys.length,
        at: Date.now(), seconds: Math.round((Date.now() - t0) / 1000),
      });
    }).catch(function (e) {
      dropRtlGrant();
      rtlDocRunning = false;
      setRtlDoc({ status: "error", error: "تعذّر فحص الاتجاه: " + (e && e.message ? e.message : e) });
    });
  }

  // ---------- جزيرة المواضع المحسوبة (بعد دحضٍ على الموقع الحيّ) ----------
  // مؤشرُ الشرائح المنزلق في claude.ai عنصرٌ `absolute left-0 origin-left` يحرّكه
  // الموقع بـtransform يحسبه من **اليسار**. وقلبُنا مرساتَه (left → inset-inline-start
  // = يمين في RTL) يجعل حسابَه يقذفه إلى القرص الخطأ — وهو بعينه ما رآه المالك.
  // العلاج بمبدئنا نفسه: ما يُموضِعه الموقعُ بحسابه لا نمسّ مرساته. والتوقيع موزَّع
  // على أصناف عدة فلا يُلتقط من CSS، فيوسَم وقت التشغيل: مطلقٌ + ينتقل/يتغيّر
  // تحويلُه. مرشَّحون قلائل بمحدِّدٍ رخيص، وبسقفٍ يمنع أي كلفة على صفحاتٍ ضخمة.
  var COMPUTED_SEL = '[class*="origin-"],[class*="translate-x"],[style*="translate"]';
  function markComputedSurfaces(root) {
    if (!state.enabled || !state.rtl || state.rtlEngine === "v1") return;
    var scope = (root && root.querySelectorAll) ? root : document;
    var list;
    try { list = scope.querySelectorAll(COMPUTED_SEL); } catch (e) { return; }
    var lim = Math.min(list.length, 300);
    for (var i = 0; i < lim; i++) {
      var el = list[i];
      if (el.hasAttribute("data-cml-noflip")) continue;
      var cs;
      try { cs = getComputedStyle(el); } catch (e) { continue; }
      if (cs.position !== "absolute" && cs.position !== "fixed") continue;
      var tp = cs.transitionProperty || "";
      var wc = cs.willChange || "";
      if (tp.indexOf("transform") === -1 && tp.indexOf("all") === -1 && wc.indexOf("transform") === -1) continue;
      el.setAttribute("data-cml-noflip", "computed");
    }
  }
  // إيقافُ الترجمة أو المحرّك يرفع الوسم كما يرفع سائر أثرنا
  function unmarkComputedSurfaces() {
    var m = document.querySelectorAll('[data-cml-noflip="computed"]');
    for (var i = 0; i < m.length; i++) m[i].removeAttribute("data-cml-noflip");
  }

  function fullPass() {
    applyChrome();
    if (state.enabled && active) walk(document.body || document.documentElement);
    else if (!state.enabled) restoreAll(); // أُوقفت الترجمة: أرجِع ما ترجمناه فورًا
    // الإيقاف يجب أن يرفع أثر الإضافة كاملًا: كان dir="auto" وdata-cml-dir يبقيان على
    // رسائل المحادثة بعد الإيقاف بلا سبيل لإزالتهما إلا بإعادة تحميل الصفحة.
    applyChatDir(document.body || document.documentElement);
    if (state.enabled && state.rtl && state.rtlEngine !== "v1") markComputedSurfaces(document);
    else unmarkComputedSurfaces();
  }

  function start() {
    compile(); applyChrome();
    if (document.body) fullPass();
    else document.addEventListener("DOMContentLoaded", fullPass, { once: true });
    try {
      obs.observe(document.documentElement, {
        childList: true, subtree: true, characterData: true,
        attributes: true, attributeFilter: ATTRS,
      });
    } catch (e) {}
  }

  // ---------- settings (chrome.storage) ----------
  // مفاتيح من بناءات ما قبل النشر لم تعد الإضافة تكتبها ولا تقرؤها. تُحذف مرّةً واحدة
  // من أجهزة من جرّب تلك البناءات، فلا يبقى في تخزينه ما لا تستعمله الإضافة.
  var UNUSED_KEYS = ["cml_collect", "cml_collected"];
  function purgeUnusedKeys() {
    try {
      chrome.storage.local.get(UNUSED_KEYS, function (r) {
        var found = UNUSED_KEYS.filter(function (k) { return r[k] !== undefined; });
        if (found.length) chrome.storage.local.remove(found);
      });
    } catch (e) {}
  }

  function loadSettings(cb) {
    try {
      chrome.storage.local.get(["cml_lang", "cml_enabled", "cml_overrides", "cml_user_patterns", "cml_rtl", "cml_chatrtl", "cml_rtl_engine"], function (r) {
        if (r.cml_lang) state.lang = r.cml_lang;
        if (typeof r.cml_enabled === "boolean") state.enabled = r.cml_enabled;
        if (r.cml_overrides) state.overrides = r.cml_overrides;
        if (Array.isArray(r.cml_user_patterns)) state.userPatterns = r.cml_user_patterns;
        if (typeof r.cml_rtl === "boolean") state.rtl = r.cml_rtl;
        if (typeof r.cml_chatrtl === "boolean") state.chatrtl = r.cml_chatrtl;
        if (r.cml_rtl_engine === "v1") state.rtlEngine = "v1"; // كل ما عداها = v2 الافتراضي
        purgeUnusedKeys();
        cb();
      });
    } catch (e) { cb(); }
  }
  try {
    chrome.storage.onChanged.addListener(function (ch, area) {
      // مفاتيح التنسيق (طلب/إلغاء الفحص) تصل على مساحة session — أو على local حيث
      // تسقط القشرة إليها. الإعدادات الدائمة على local وحدها.
      var scanArea = (SESS === chrome.storage.local) ? "local" : "session";
      if (area === scanArea) {
        if (ch.cml_scan_request && ch.cml_scan_request.newValue) runScan(); // طلب فحص من صفحة الإعدادات
        if (ch.cml_scan_cancel && ch.cml_scan_cancel.newValue) cancelScan = true;
        if (ch.cml_rtldoc_request && ch.cml_rtldoc_request.newValue) runRtlDoc(); // طبيب الاتجاه
      }
      if (area !== "local") return;
      var relevant = false;
      if (ch.cml_lang) { state.lang = ch.cml_lang.newValue || L10N.default; relevant = true; }
      if (ch.cml_enabled) { state.enabled = ch.cml_enabled.newValue !== false; relevant = true; }
      if (ch.cml_overrides) { state.overrides = ch.cml_overrides.newValue || {}; relevant = true; }
      if (ch.cml_user_patterns) { state.userPatterns = ch.cml_user_patterns.newValue || []; relevant = true; }
      // ملاحظة: «إعادة الضبط» تحذف المفاتيح فتصل هنا newValue=undefined. الافتراض الصحيح
      // للـRTL هو التفعيل (كما في loadState وصفحة الإعدادات)، فلا يصح `=== true` هنا وإلا
      // انقلبت الصفحة المفتوحة إلى LTR بينما الإعدادات تعرضها مفعّلة.
      if (ch.cml_rtl) { state.rtl = ch.cml_rtl.newValue !== false; relevant = true; }
      if (ch.cml_chatrtl) { state.chatrtl = ch.cml_chatrtl.newValue !== false; relevant = true; }
      // كالـRTL تمامًا: الحذف (إعادة الضبط) يصل newValue=undefined والافتراض v2
      if (ch.cml_rtl_engine) { state.rtlEngine = ch.cml_rtl_engine.newValue === "v1" ? "v1" : "v2"; relevant = true; }
      if (relevant) { compile(); fullPass(); }
    });
  } catch (e) {}

  // immediate default (reduce RTL flash), then refine from storage
  compile(); applyChrome();
  loadSettings(start);
})();
