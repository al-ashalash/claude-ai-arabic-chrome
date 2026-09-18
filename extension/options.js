/* options.js — settings page for تعريب كلود للويب (Arabic-only).
   Wires the UI to chrome.storage.local. No network of its own — الوجه البعيد الوحيد
   هو chrome.storage.sync لقسم المزامنة الاختيارية (المتصفح ينقلها ضمن حساب المستخدم،
   لا اتصال منا): كتابة علم الموافقة، وعرض الحال، ومسح مفاتيحنا من مساحة المزامنة.
   Keys: cml_enabled, cml_rtl, cml_chatrtl, cml_overrides, cml_user_patterns,
         cml_scan_request, cml_scan_result, cml_scan_cancel, cml_scan_claim,
         cml_rtl_engine, cml_rtldoc_request, cml_rtldoc_result,
         cml_sync_enabled, cml_sync_state (+ في مساحة sync: cml_syncmeta وcml_syncd_*). */
(function () {
  "use strict";

  // ---------- جمعُ المعدود العربي ----------
  // كانت الرسائل تُلصق العددَ بتمييزٍ واحد («N تصحيحًا») وهو لا يصحّ إلا للأعداد 11–99.
  // القاعدة: 0 ← جمع، 1 ← مفرد + واحد/واحدة، 2 ← مثنى، 3–10 ← جمع، 11–99 ← مفرد منصوب،
  // والمئات والألوف الصحيحة (100، 200، 1000…) وما شابه ← مفرد مجرور. تُقاس على آخر رقمين.
  // forms = { s: مفرد، d: مثنى مرفوع، o: مثنى مجرور/منصوب، p: جمع، a: مفرد منصوب، f: مؤنث؟ }
  // g=true حين يقع المعدود بعد حرف جرّ أو مضافًا إليه أو مفعولًا («بعد قراءة ملفين»، «قرأ ملفين»).
  // لا تُلحق المعدودَ صفةٌ في الرسائل («N نصًّا آخر») لأنها تحتاج مطابقةً ثانية؛ أعِد صياغة الجملة بدلها.
  function arCount(n, f, g) {
    n = Number(n) || 0;
    var m = n % 100;
    if (n === 0) return "0 " + f.p;
    if (n === 1) return f.s + (f.f ? " واحدة" : " واحد");
    if (n === 2) return g ? f.o : f.d;
    if (m >= 3 && m <= 10) return n + " " + f.p;
    if (m >= 11 && m <= 99) return n + " " + f.a;
    return n + " " + f.s;
  }
  var N = {
    file:   { s: "ملف", d: "ملفان", o: "ملفين", p: "ملفات", a: "ملفًا" },
    text:   { s: "نصّ", d: "نصّان", o: "نصّين", p: "نصوص", a: "نصًّا" },
    rule:   { s: "قاعدة", d: "قاعدتان", o: "قاعدتين", p: "قواعد", a: "قاعدةً", f: true },
    spot:   { s: "موضع", d: "موضعان", o: "موضعين", p: "مواضع", a: "موضعًا" },
    elem:   { s: "عنصر", d: "عنصران", o: "عنصرين", p: "عناصر", a: "عنصرًا" },
    fix:    { s: "تصحيح", d: "تصحيحان", o: "تصحيحين", p: "تصحيحات", a: "تصحيحًا" },
    line:   { s: "سطر", d: "سطران", o: "سطرين", p: "أسطر", a: "سطرًا" },
    sec:    { s: "ثانية", d: "ثانيتان", o: "ثانيتين", p: "ثوانٍ", a: "ثانيةً", f: true },
    result: { s: "نتيجة", d: "نتيجتان", o: "نتيجتين", p: "نتائج", a: "نتيجةً", f: true },
    sheet:  { s: "ملف تصميم", d: "ملفا تصميم", o: "ملفي تصميم", p: "ملفات تصميم", a: "ملفَّ تصميم" },
  };
  var $ = function (id) { return document.getElementById(id); };
  var LANG = "ar"; // Arabic-only build
  var KEYS = CMLConst.RESET_KEYS;

  // ★ حالة التنسيق العابرة في storage.session (تُمحى بإغلاق المتصفح — لا حجز خالد).
  // هذه الصفحة سياقٌ موثوق، فهي التي تفتح session لسكربتات المحتوى قبل أول طلب فحص.
  // القشرة تسقط إلى local حيث لا session (قشور الاختبار) بسلوك الأمس نفسه.
  var SESS = (chrome.storage && chrome.storage.session) || chrome.storage.local;
  try {
    if (chrome.storage.session && chrome.storage.session.setAccessLevel)
      chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS" });
  } catch (e) {}

  function get(keys, cb) { chrome.storage.local.get(keys, cb); }
  // تمرير خطأ الكتابة إلى النداء: التخزين له سقف، وامتلاؤه يُفشل الكتابة بصمت — فكان
  // المستخدم يرى «تم الاستيراد ✓» ولم يُحفظ شيء. النداء يستقبل الخطأ إن وقع.
  function set(obj, cb) {
    chrome.storage.local.set(obj, function () {
      var e = chrome.runtime && chrome.runtime.lastError;
      (cb || function () {})(e || null);
    });
  }
  // سقوف الاستيراد: ملف واحد لا يجوز أن يجمّد الصفحة ولا أن يملأ التخزين.
  var IMPORT_MAX_BYTES = CMLConst.IMPORT_MAX_BYTES;
  var IMPORT_MAX_TERMS = CMLConst.IMPORT_MAX_TERMS;
  var IMPORT_MAX_RULES = CMLConst.IMPORT_MAX_RULES;
  // flash يضع علمًا أثناء عرض الرسالة، فلا تدهسها إعادةُ رسمٍ متزامنة (renderScan مثلًا)
  // isErr اختياري؛ وبغيابه تُستنتج من صدر الرسالة (صيغُ الإخفاق المعتمدة في الصفحة)
  // — فالخطأ والنجاح كانا لونًا واحدًا لا يميّزهما المستخدم
  function flash(el, msg, isErr) {
    if (!el) return;
    el.textContent = msg;
    var err = isErr !== undefined ? !!isErr : /^(?:تعذّر|خطأ|فشل|لا يمكن|✗|أُخفق)/.test(msg || "");
    if (el.classList) el.classList.toggle("err", err);
    if (!msg) { delete el.dataset.flashing; return; }
    el.dataset.flashing = "1";
    setTimeout(function () {
      if (el.textContent === msg) el.textContent = "";
      delete el.dataset.flashing;
    }, 3000);
  }
  function norm(s) { return String(s || "").toLowerCase(); }

  function download(name, text, type) {
    var url = URL.createObjectURL(new Blob([text], { type: type || "application/json;charset=utf-8" }));
    var a = document.createElement("a"); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  // ---------- About ----------
  function fillAbout() {
    try {
      var m = chrome.runtime.getManifest();
      $("aboutName").textContent = m.short_name || m.name || "تعريب كلود للويب";
      $("aboutVersion").textContent = m.version_name || ("v" + (m.version || "—"));
    } catch (e) {}
  }

  // ---------- Saved terms (overrides) + بحث في القاموس الأساسي ----------
  // كان البحث مقصورًا على تصحيحات المستخدم، فلتصحيح ترجمةٍ رآها في الموقع كان عليه أن
  // يكتب نصّها الإنجليزي حرفيًّا من ذاكرته — وهو متعذّر عمليًّا. صار البحث يشمل القاموس
  // الأساسي (‎CLAUDE_L10N‎ المحمَّل في هذه الصفحة) فيجد المفردة بالعربية أو بالإنجليزية
  // ويعدّلها مباشرة، فيُحفظ تعديله تصحيحًا يحلّ محلّ نصّ القاموس.
  var BASE = (globalThis.CLAUDE_L10N && globalThis.CLAUDE_L10N.dicts &&
              globalThis.CLAUDE_L10N.dicts[LANG] && globalThis.CLAUDE_L10N.dicts[LANG].strings) || {};
  var BASE_KEYS = Object.keys(BASE);
  var SEARCH_CAP = 60; // سقف العرض: القاموس عشرات الآلاف، ورسمُها كلها يجمّد الصفحة

  function termRow(en, value, opts) {
    var row = document.createElement("div"); row.className = "term";
    var src = document.createElement("div"); src.className = "src";
    src.textContent = en;
    if (opts.tag) {
      var tag = document.createElement("span");
      tag.className = "tag" + (opts.mine ? " mine" : "") + (opts.missing ? " miss" : "");
      tag.textContent = opts.tag;
      src.appendChild(tag);
    }
    var inp = document.createElement("input");
    inp.value = value; inp.setAttribute("aria-label", "ترجمة: " + en);
    inp.dataset.en = en;
    // إعادةُ الرسم كانت تُسقط التركيز إلى body بعد الحفظ بلوحة المفاتيح: نعيده إلى السطر نفسه
    if (pendingFocus && pendingFocus.en === en) {
      var pf = pendingFocus; pendingFocus = null;
      setTimeout(function () { try { (pf.btn ? save : inp).focus(); } catch (e) {} }, 0);
    }
    var acts = document.createElement("div"); acts.className = "acts";

    if (opts.missing) inp.placeholder = "اكتب الترجمة…";

    var save = document.createElement("button"); save.textContent = opts.missing ? "ترجمة" : "حفظ";
    save.dataset.en = en;
    save.setAttribute("aria-label", (opts.missing ? "ترجمة: " : "حفظ ترجمة: ") + en); // 44 زرًّا اسمها «حفظ» لا يميّزها قارئ الشاشة
    save.addEventListener("click", function () {
      get(["cml_overrides", "cml_user_patterns", "cml_scan_result"], function (s2) {
        var o = s2.cml_overrides || {}; o[LANG] = o[LANG] || {};
        var v = (inp.value || "").trim();
        if (!v) { flash($("termsStatus"), "اكتب الترجمة أولًا."); return; }
        var patch = { cml_overrides: o };

        if (/\{[A-Za-z_$][\w$]*\}/.test(en)) {
          // نصّ بمتغيّرات: يُحفظ قاعدةً ذكية لا مطابقةً حرفية — الحرفية لن تصادف النص المعروض أبدًا
          var p = makePattern(en, v);
          if (!p) { flash($("termsStatus"), "لا تصلح قاعدةً ذكية: انسخ كل {متغيّر} كما هو وأبقِ نصًّا ثابتًا كافيًا."); return; }
          var pats = Array.isArray(s2.cml_user_patterns) ? s2.cml_user_patterns.slice() : [];
          var idx = -1;
          pats.forEach(function (x, i) { if (x.re === p.re) idx = i; });
          if (idx >= 0) pats[idx] = p; else pats.push(p);
          pats = CMLShared.sortBySpecificity(pats);
          patch.cml_user_patterns = pats;
        } else if (BASE[en] !== undefined && v === BASE[en]) {
          // مطابقة الأصل ⇒ لا داعي لتصحيحٍ يخزَّن ويظهر في قائمتك بلا فائدة
          delete o[LANG][en];
          set(patch, function () { renderTerms(); flash($("termsStatus"), "مطابقة للقاموس — لم تُحفظ كتصحيح."); });
          return;
        } else {
          o[LANG][en] = v;
        }

        // ما تُرجم لم يعد «غير مترجَم» — نظّفه من نتيجة الفحص المعروضة
        var sr = s2.cml_scan_result;
        if (sr && (sr.list || sr.varList)) {
          var rp = (sr.list || []).filter(function (x) { return x !== en; });
          var rv = (sr.varList || []).filter(function (x) { return x !== en; });
          if (rp.length !== (sr.list || []).length || rv.length !== (sr.varList || []).length) {
            patch.cml_scan_result = Object.assign({}, sr, {
              list: rp, varList: rv,
              missing: Math.max(0, (sr.missing || 0) - 1),
              shown: rp.length + rv.length,
            });
          }
        }

        set(patch, function (err) {
          if (err) { flash($("termsStatus"), "تعذّر الحفظ — امتلأت مساحة التخزين."); return; }
          renderTerms();
          flash($("termsStatus"), patch.cml_user_patterns ? "حُفظت قاعدةً ذكية تعمل مع كل القيم ✓" : "تم الحفظ ✓");
        });
      });
    });
    acts.appendChild(save);

    if (opts.mine) {
      var del = document.createElement("button");
      del.className = "btn-danger";
      // إن كانت المفردة في القاموس الأساسي فالحذف «استعادة» لا إزالة: يعود نصّ القاموس
      del.textContent = BASE[en] !== undefined ? "استعادة الأصل" : "حذف";
      del.addEventListener("click", function () {
        get(["cml_overrides"], function (s2) {
          var o = s2.cml_overrides || {}; if (o[LANG]) delete o[LANG][en];
          set({ cml_overrides: o }, function () {
            renderTerms();
            flash($("termsStatus"), BASE[en] !== undefined ? "استُعيد نصّ القاموس." : "حُذف التصحيح.");
          });
        });
      });
      acts.appendChild(del);
    }

    row.appendChild(src); row.appendChild(inp); row.appendChild(acts);
    return row;
  }

  function group(list, text) {
    var g = document.createElement("div"); g.className = "grp"; g.textContent = text;
    list.appendChild(g);
  }

  // ═══ مصير تصحيحات المستخدم بعد تحديث الإضافة ═══════════════════════════════
  // الحقيقة المطمئنة: `chrome.storage.local` **يبقى** عبر التحديثات، فلا شيء يضيع —
  // ولا سطر في هذه الإضافة يمحو تصحيحًا إلا بضغطة صريحة من المستخدم.
  //
  // لكن ثمة خطرًا أدقّ من الضياع: المستخدم يترجم نصوصًا بعد الفحص، ثم يأتي تحديثٌ
  // يترجمها في القاموس نفسه. وتصحيحُه **يحلّ محلّ القاموس دائمًا** — فيبقى مُظلِّلًا له
  // إلى الأبد، ولا يرى تحسينًا لاحقًا في تلك المفردة، وتمتلئ قائمتُه بمدخلاتٍ يظنّها
  // تصحيحاتٍ وهي مطابقة للقاموس حرفًا بحرف. فالمعالجة **مراجعة** لا حذف:
  //   مطابقة  ⇒ لا فائدة منها، ويُعرض حذفها (بضغطة المستخدم وحده).
  //   مختلفة  ⇒ اختيارُه: يُبقيها أو يعود لنصّ القاموس — ولا نقرّر عنه.
  //   منفردة  ⇒ ليست في القاموس أصلًا، فهي ترجمته وحدها ولا تُمسّ.
  function reconcile(ov) {
    var same = [], diff = [], only = [];
    Object.keys(ov).forEach(function (k) {
      if (BASE[k] === undefined) only.push(k);
      else if (BASE[k] === ov[k]) same.push(k);
      else diff.push(k);
    });
    return { same: same, diff: diff, only: only };
  }

  function renderRecon() {
    var box = $("reconBox");
    if (!box) return;
    get(["cml_overrides", "cml_recon_dismissed"], function (s) {
      var ov = (s.cml_overrides || {})[LANG] || {};
      var r = reconcile(ov);
      // لا نُظهر اللوحة إلا متى كان ثمة ما يُراجَع فعلًا، ولم يُغلقها المستخدم لهذه الحصيلة
      var sig = r.same.length + ":" + r.diff.length;
      if ((!r.same.length && !r.diff.length) || s.cml_recon_dismissed === sig) {
        box.classList.add("hidden"); return;
      }
      box.classList.remove("hidden");
      $("reconLines").innerHTML =
        "• ما يطابق نصّ القاموس حرفًا بحرف: <b>" + arCount(r.same.length, N.fix) + "</b> — لا أثر له، وحذفُه ينظّف قائمتك ويجعلك ترى أي تحسين لاحق في القاموس.<br>" +
        "• ما يختلف عن القاموس: <b>" + arCount(r.diff.length, N.fix) + "</b> — <b>هذه ترجمتك أنت وهي الظاهرة</b>. راجعها إن شئت، وأبقِ ما تفضّله.<br>" +
        "• ما ليس في القاموس أصلًا: <b>" + arCount(r.only.length, N.fix) + "</b> — ترجمتك وحدها، ولا يمسّها شيء.";
      $("reconDropSame").disabled = !r.same.length;
      $("reconDropSame").textContent = r.same.length ? "حذف المطابقة (" + r.same.length + ")" : "لا مطابقة";
      $("reconShowDiff").disabled = !r.diff.length;
    });
  }

  function reconDropSame() {
    get(["cml_overrides"], function (s) {
      var o = s.cml_overrides || {}, ov = o[LANG] || {};
      var r = reconcile(ov);
      if (!r.same.length) return;
      if (!confirm("سيُحذف من تصحيحاتك ما يطابق نصّ القاموس حرفًا بحرف (" + arCount(r.same.length, N.fix) + ").\n\n" +
        "لن يتغيّر شيء فيما تراه على الشاشة — القاموس يعطي النصّ نفسه.\n" +
        "والفائدة أن ترى أي تحسين لاحق في هذه النصوص.\n\nأتتابع؟")) return;
      r.same.forEach(function (k) { delete ov[k]; });
      o[LANG] = ov;
      set({ cml_overrides: o }, function (err) {
        if (err) { flash($("termsStatus"), "تعذّر الحفظ."); return; }
        renderTerms(); renderRecon();
        flash($("termsStatus"), "حُذف ما يطابق القاموس (" + arCount(r.same.length, N.fix) + ") ✓ (ما تراه على الشاشة لم يتغيّر)");
      });
    });
  }

  var pendingFocus = null; // {en, btn}: السطر الذي كان مركَّزًا قبل إعادة الرسم
  function renderTerms() {
    var ae = document.activeElement;
    if (ae && ae.dataset && ae.dataset.en) pendingFocus = { en: ae.dataset.en, btn: ae.tagName === "BUTTON" };
    var q = norm($("termSearch") && $("termSearch").value);
    // التصفية بالمصدر: الكل / قاموس الإضافة (المترجَم) / غير المترجَم من الفحص / تصحيحاتك
    var filter = ($("termFilter") && $("termFilter").value) || "all";
    get(["cml_overrides", "cml_scan_result"], function (s) {
      var ov = (s.cml_overrides || {})[LANG] || {};
      var sr = s.cml_scan_result;
      var list = $("termsList"); list.innerHTML = "";
      function more(txt) { var m = document.createElement("div"); m.className = "more"; m.textContent = txt; list.appendChild(m); }
      function empty(txt) { var e = document.createElement("div"); e.className = "empty"; e.textContent = txt; list.appendChild(e); }

      // ١) تصحيحاتك (ميزة التعديل فوق المصدر)
      var mine = [];
      if (filter === "all" || filter === "mine" || filter === "diverged") {
        mine = Object.keys(ov).sort();
        // «المختلفة»: لها مقابلٌ في القاموس ونصُّك يخالفه — وهي وحدها التي تحتاج قرارك
        if (filter === "diverged") mine = mine.filter(function (k) { return BASE[k] !== undefined && BASE[k] !== ov[k]; });
        if (q) mine = mine.filter(function (k) { return norm(k).indexOf(q) >= 0 || norm(ov[k]).indexOf(q) >= 0; });
      }

      // ٢) قاموس الإضافة (المترجَم) — بحرف واحد تكون النتائج بالآلاف، فنطلب حرفين
      var searching = q.length >= 2;
      var hits = [], truncated = 0;
      if ((filter === "all" && searching) || (filter === "dict" && searching)) {
        for (var i = 0; i < BASE_KEYS.length; i++) {
          var k = BASE_KEYS[i];
          if (ov[k] !== undefined) continue;                       // معروضة في «تصحيحاتك»
          if (norm(k).indexOf(q) < 0 && norm(BASE[k]).indexOf(q) < 0) continue;
          if (hits.length < SEARCH_CAP) hits.push(k); else truncated++;
        }
        hits.sort(function (a, b) { return a.length - b.length || a.localeCompare(b); }); // الأقصر أقرب للمطلوب
      }

      // ٣) غير المترجَم — ما جلبه آخر فحص (يُعرض في تصفيته وحدها لئلا يزدحم «الكل»)
      var missing = [], missTotal = 0, missTrunc = 0;
      if (filter === "missing") {
        var pool = ((sr && sr.list) || []).concat((sr && sr.varList) || []);
        // المعروض قد يكون أقل من الحقيقي (قُصّ عند 4000) — نُظهر الحقيقي في العنوان
        missTotal = (sr && sr.missing) || pool.length;
        pool.forEach(function (k) {
          if (q && norm(k).indexOf(q) < 0) return;
          if (missing.length < SEARCH_CAP) missing.push(k); else missTrunc++;
        });
        missing.sort(function (a, b) { return a.length - b.length || a.localeCompare(b); });
        if (sr && sr.capped) missTrunc += Math.max(0, missTotal - pool.length); // المقصوص لا يُعرض أصلاً
      }

      if (!mine.length && !hits.length && !missing.length) {
        if (filter === "missing") {
          empty(sr && sr.status === "done"
            ? (missTotal ? "لا نتائج مطابقة لبحثك في غير المترجَم." : "لا يوجد غير مترجَم — المصدر مطابق لآخر فحص ✓")
            : "لم يُجرَ فحص بعد. شغّله من «تحديث المصدر — فحص الموقع» أعلاه.");
        } else if (filter === "dict") {
          empty(searching ? "لا نتائج مطابقة في قاموس الإضافة." : "اكتب حرفين على الأقل للبحث في قاموس الإضافة.");
        } else if (filter === "mine") {
          empty(q ? "لا تصحيحات مطابقة." : "لا تصحيحات بعد. عدّل أي ترجمة من القاموس فيُحفظ تعديلك هنا.");
        } else {
          empty(q
            ? (searching ? "لا نتائج مطابقة." : "اكتب حرفين على الأقل للبحث في القاموس.")
            : "ابحث أعلاه لتجد أي ترجمة وتعدّلها، أو اختر تصفيةً لتصفّح مصدرًا بعينه.");
        }
        return;
      }

      if (mine.length) {
        group(list, filter === "diverged"
          ? "تصحيحاتك التي تخالف القاموس (" + mine.length + ") — «استعادة الأصل» تُرجعك لنصّ القاموس"
          : (q ? "تصحيحاتك المطابقة للبحث (" + mine.length + ")" : "تصحيحاتك (" + mine.length + ")"));
        mine.forEach(function (k) {
          var row = termRow(k, ov[k], { mine: true, tag: "تصحيحك" });
          // في «المختلفة» نُظهر نصّ القاموس تحت السطر ليقارن المستخدم ويقرّر
          if (filter === "diverged" && BASE[k] !== undefined) {
            var hint = document.createElement("div");
            hint.className = "more";
            hint.style.cssText = "grid-column:1/-1;padding:2px 0 0;margin:0";
            hint.textContent = "نصّ القاموس: " + BASE[k];
            row.appendChild(hint);
          }
          list.appendChild(row);
        });
      }
      if (missing.length) {
        group(list, "غير المترجَم من الفحص (" + missing.length + (missTrunc ? " من " + missTotal : "") + ") — اكتب الترجمة واضغط «ترجم»");
        missing.forEach(function (k) { list.appendChild(termRow(k, "", { mine: false, missing: true, tag: "غير مترجَم" })); });
        if (missTrunc) more("وهناك أيضًا " + arCount(missTrunc, N.text) + " لم تُعرض — ضيّق البحث، أو ترجمها دفعةً بأزرار «تنزيل أمر الترجمة» ثم «استيراد الترجمات» أدناه.");
      }
      if (hits.length) {
        group(list, "قاموس الإضافة (" + hits.length + (truncated ? " من " + (hits.length + truncated) : "") + ")");
        hits.forEach(function (k) { list.appendChild(termRow(k, BASE[k], { mine: false, tag: "القاموس" })); });
        if (truncated) more("وهناك أيضًا " + arCount(truncated, N.result) + " لم تُعرض — ضيّق البحث لتراها.");
      }
      if (filter === "all" && !searching && q.length === 1) {
        more("اكتب حرفين على الأقل للبحث في قاموس الإضافة.");
      }
    });
  }

  function addTerm() {
    var a = ($("newSrc").value || "").trim(), b = ($("newDst").value || "").trim();
    if (!a || !b) { flash($("termsStatus"), "املأ الحقلين."); return; }
    get(["cml_overrides"], function (s) {
      var o = s.cml_overrides || {}; o[LANG] = o[LANG] || {}; o[LANG][a] = b;
      set({ cml_overrides: o }, function (err) {
        if (err) { flash($("termsStatus"), "تعذّر الحفظ — " + err, true); return; } // كان يعلن النجاح والمخزن خالٍ
        $("newSrc").value = ""; $("newDst").value = ""; renderTerms(); flash($("termsStatus"), "أُضيف التصحيح ✓");
      });
    });
  }

  function exportMyTerms() {
    get(["cml_overrides"], function (s) {
      var ov = (s.cml_overrides || {})[LANG] || {};
      var arr = Object.keys(ov).sort().map(function (k) { return { en: k, ar: ov[k] }; });
      if (!arr.length) { flash($("termsStatus"), "لا توجد تصحيحات لتصديرها."); return; }
      download("تعريب-كلود-تصحيحاتي.json", JSON.stringify({ _app: "claude-mutarjim", _kind: "terms", lang: LANG, terms: arr }, null, 2));
      flash($("termsStatus"), "تم التصدير (" + arr.length + ").");
    });
  }

  // ★ تصدير المصدر كاملاً — بصيغتين:
  //   bare=true  : النصوص الإنجليزية وحدها وحقل الترجمة فارغ. لمن أراد ترجمة المصدر من
  //                جديد بأسلوبه أو إلى لغة أخرى، ثم يستورد ناتجه هنا.
  //   bare=false : النصوص مع ترجماتها الحالية (قاموس الإضافة + تصحيحات المستخدم فوقه)،
  //                للمراجعة أو النقل أو الإسهام على المستودع.
  // ويُضمّ إليهما ما جلبه آخر فحص ولم يُترجَم بعد، فيكون الملف صورةَ المصدر كاملةً لا ناقصة.
  function exportSource(bare) {
    get(["cml_overrides", "cml_scan_result"], function (s) {
      var ov = (s.cml_overrides || {})[LANG] || {};
      var sr = s.cml_scan_result;
      var seen = Object.create(null), arr = [];
      function push(en, ar) {
        if (seen[en]) return;
        seen[en] = 1;
        arr.push({ en: en, ar: bare ? "" : (ar || "") });
      }
      BASE_KEYS.forEach(function (k) { push(k, ov[k] !== undefined ? ov[k] : BASE[k]); });
      Object.keys(ov).forEach(function (k) { push(k, ov[k]); });   // تصحيحات لنصوص خارج القاموس
      var untranslated = 0;
      ((sr && sr.list) || []).concat((sr && sr.varList) || []).forEach(function (k) {
        if (!seen[k]) untranslated++;
        push(k, "");                                               // غير مترجَم ⇒ يبقى فارغاً في الحالتين
      });
      arr.sort(function (a, b) { return a.en.localeCompare(b.en); });

      var name = bare ? "تعريب-كلود-المصدر-بلا-ترجمة.json" : "تعريب-كلود-المصدر-مترجَمًا.json";
      download(name, JSON.stringify({
        _app: "claude-mutarjim",
        _kind: bare ? "source-bare" : "source-full",
        _note: bare
          ? "النصوص الإنجليزية وحدها. املأ حقل ar لكل سطر ثم استورد الملف من «استيراد الترجمات»."
          : "النصوص مع ترجماتها الحالية. الأسطر الفارغة هي ما لم يُترجَم بعد.",
        lang: LANG, count: arr.length, terms: arr,
      }, null, 2));

      flash($("termsStatus"), "صُدِّر " + arCount(arr.length, N.text) +
        (untranslated ? " (منها " + untranslated.toLocaleString("en") + " غير مترجَم من الفحص)" : "") + " ✓");
    });
  }

  // parse a terms/translation file into {en:ar} pairs (accepts several shapes)
  // المفتاح يُقصّ ويُسقط الفارغ: المحرّك يقصّ نصّ الصفحة قبل البحث، فمفتاحٌ محفوفٌ ببياض
  // أو فارغ كان يُخزَّن حرفيًّا ولا يطابق شيئًا أبدًا — مدخلٌ ميّت في «تصحيحاتك»
  function putPair(out, k, v) { k = String(k || "").trim(); if (k) out[k] = v; }
  function parsePairs(obj) {
    var out = {};
    var arr = null;
    if (Array.isArray(obj)) arr = obj;
    else if (obj && Array.isArray(obj.terms)) arr = obj.terms;
    // اشتراط النصّية هنا كما في بقية الفروع: بدونه تُكتب كائنات ومصفوفات في القاموس
    // فيحاول المحرّك أن يضعها في الصفحة فتظهر «[object Object]» مكان الترجمة.
    else if (obj && obj.data && obj.data.cml_overrides) { var o = obj.data.cml_overrides[LANG] || obj.data.cml_overrides.ar || {}; Object.keys(o).forEach(function (k) { if (typeof o[k] === "string") putPair(out, k, o[k]); }); return out; }
    else if (obj && typeof obj === "object") { Object.keys(obj).forEach(function (k) { if (typeof obj[k] === "string") putPair(out, k, obj[k]); }); return out; }
    if (arr) arr.forEach(function (p) { if (p && typeof p.en === "string" && typeof p.ar === "string") putPair(out, p.en, p.ar); });
    return out;
  }

  // ---------- توليد القواعد الذكية ----------
  // النسخة الواحدة في cml-shared.js (حُقن قبلنا في options.html) — هنا أسماء محلية فقط.
  // شرح الحُرّاس كاملًا هناك: ReDoS، ورمز القالب، والمرساة، وسقف المتغيرات.
  var VAR_RE = CMLShared.VAR_RE;
  var makePattern = CMLShared.makePattern;

  function importTermsFile(file, statusEl) {
    // سقف الحجم قبل القراءة: ملف بمئات الميغابايتات يجمّد التبويب في FileReader نفسه
    if (file && file.size > IMPORT_MAX_BYTES) {
      flash(statusEl, "الملف أكبر من اللازم (" + Math.round(file.size / 1048576) + " ميغابايت). الحدّ الأقصى 5 ميغابايت.");
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      var obj; try { obj = JSON.parse(reader.result); } catch (e) { flash(statusEl, "ملف غير صالح."); return; }
      var pairs = parsePairs(obj);
      var keys = Object.keys(pairs).filter(function (k) { return typeof pairs[k] === "string" && pairs[k].trim(); });
      if (!keys.length) { flash(statusEl, "لا توجد ترجمات في الملف."); return; }

      // ★ تأكيد صريح قبل الكتابة. الملف يستطيع تغيير نصّ أي زرّ في claude.ai — بما فيه
      // «حذف» و«مشاركة» — فاستيراده من مصدر غير موثوق خطرٌ حقيقي. والمستخدم يستورد
      // ملفًا ردّه عليه نموذجٌ لغوي، فمن حقّه أن يرى ماذا يدخل قبل أن يدخل.
      var sample = keys.slice(0, 5).map(function (k) { return "  " + k + "  ←  " + pairs[k]; }).join("\n");
      var msg = "سيُستورد " + arCount(keys.length, N.line) + ".\n\nأول خمسة:\n" + sample +
        "\n\n⚠ ملف الترجمة يغيّر نصوص أزرار claude.ai وتسمياتها — فلا تستورد إلا من مصدر تثق به.\n\nأتتابع؟";
      if (!confirm(msg)) { flash(statusEl, "أُلغي الاستيراد."); return; }

      get(["cml_overrides", "cml_user_patterns", "cml_scan_result"], function (s) {
        var o = s.cml_overrides || {}; o[LANG] = o[LANG] || {};
        var pats = Array.isArray(s.cml_user_patterns) ? s.cml_user_patterns.slice() : [];
        var byRe = {}; pats.forEach(function (p, i) { byRe[p.re] = i; });
        var nPlain = 0, nPat = 0, nSkip = 0, nCapped = 0;
        var haveTerms = Object.keys(o[LANG]).length;

        keys.forEach(function (k) {
          if (/\{[A-Za-z_$][\w$]*\}/.test(k)) {
            if (pats.length >= IMPORT_MAX_RULES) { nCapped++; return; }
            var p = makePattern(k, String(pairs[k]));
            if (!p) { nSkip++; return; }                  // فشل حارس الأمان — تُتجاهل بأمان
            if (byRe[p.re] !== undefined) pats[byRe[p.re]] = p;
            else { byRe[p.re] = pats.length; pats.push(p); }
            nPat++;
          } else {
            var isNew = o[LANG][k] === undefined;
            if (isNew && haveTerms >= IMPORT_MAX_TERMS) { nCapped++; return; } // السقف على الجديد لا على تحديث الموجود
            if (isNew) haveTerms++;
            o[LANG][k] = pairs[k]; nPlain++;
          }
        });

        // ★ الفرز بالتخصيص: المحرّك يجرّب القواعد بترتيبها، فإن سبق الأعمُّ الأخصَّ ابتلع
        // النصَّ وأخرج ترجمة خاطئة. المعيار طول النصّ الثابت تنازليًّا (فرز JS مستقرّ).
        pats = CMLShared.sortBySpecificity(pats);

        var patch = { cml_overrides: o };
        if (nPat) patch.cml_user_patterns = pats;

        // ما استُورد لم يعد «غير مترجم» — نظّف نتيجة الفحص المعروضة (الدلوين)
        var sr = s.cml_scan_result;
        if (sr && (sr.list || sr.varList)) {
          var imported = {}; keys.forEach(function (k) { imported[k] = 1; });
          var restPlain = (sr.list || []).filter(function (x) { return !imported[x]; });
          var restVars = (sr.varList || []).filter(function (x) { return !imported[x]; });
          var removed = ((sr.list || []).length - restPlain.length) + ((sr.varList || []).length - restVars.length);
          if (removed) {
            // `missing` هو العدد الحقيقي وقد يفوق المعروض (القصّ عند 4000)، فيُنقص بما
            // حُذف فعلاً لا يُعاد حسابه من طول القائمتين — وإلا انهار العدّ إلى المعروض.
            patch.cml_scan_result = Object.assign({}, sr, {
              list: restPlain, varList: restVars,
              missing: Math.max(0, (sr.missing || 0) - removed),
              shown: restPlain.length + restVars.length,
            });
          }
        }

        set(patch, function (err) {
          if (err) { flash(statusEl, "تعذّر الحفظ — امتلأت مساحة التخزين أو مُنعت الكتابة. لم يُحفظ شيء."); return; }
          renderTerms();
          var msg = "تم استيراد " + arCount(nPlain + nPat, N.line, true) + " ✓";
          if (nPat) msg += " (منها قواعد ذكية: " + arCount(nPat, N.rule) + ")";
          if (nSkip) msg += " — وأُهمل ما لا يصلح قاعدةً ذكية (" + arCount(nSkip, N.line) + ")";
          if (nCapped) msg += " — وتجاوز الحدَّ الأقصى فلم يُستورد: " + arCount(nCapped, N.line);
          flash(statusEl, msg);
        });
      });
    };
    reader.readAsText(file);
  }

  // الأمر الكامل (التعليمات + الكلمات) — يُكتب في الملف نفسه لا في الحافظة وحدها،
  // لأن الملف قد يُفتح أو يُرفَق بعد أيام وقد ضاع ما في الحافظة.
  function buildPrompt(keys, varKeys) {
    varKeys = varKeys || [];
    var varSection = varKeys.length
      ? [
          "",
          "### نصوص فيها متغيّرات (" + arCount(varKeys.length, N.line) + ")",
          "هذه تتحول عندي إلى قواعد ذكية تعمل مع كل القيم، فالتزم بها:",
          "- انسخ كل متغيّر بين قوسين معقوفين **كما هو حرفيًّا** ({count}، {name}…) ولا تترجمه ولا تغيّر اسمه.",
          "- ضع المتغيّر في موضعه الطبيعي من الجملة العربية.",
          "- لا تحذف متغيّرًا ولا تخترع متغيّرًا غير موجود في الأصل.",
          "مثال: \"Delete {count} chats?\" ← \"حذف {count} محادثة؟\"",
          "----------------------------------------",
          varKeys.join("\n"),
        ].join("\n")
      : "";
    return [
      "ترجم نصوص واجهة المستخدم التالية (من موقع claude.ai) إلى العربية.",
      "",
      "القواعد:",
      "1) عربية فصحى موجزة بأسلوب واجهات البرامج — لا حشو ولا ترجمة حرفية ركيكة.",
      "2) تبقى إنجليزية كما هي: Claude، Anthropic، Cowork، Opus، Sonnet، Haiku، Fable، Max،",
      "   MCP، API، SDK، CLI، JSON، URL، PDF، CSV، GitHub، Google، Slack، Chrome، Windows،",
      "   macOS، Linux، iOS، Android، وأسماء الملفات والمسارات والتعليمات البرمجية.",
      "3) أسماء الميزات الكبرى: تُكتب «الترجمة (English)» إذا كان النص عنوانًا أو زرًّا مستقلًّا",
      "   — مثل: المشاريع (Projects)، المُخرَجات (Artifacts)، المهارات (Skills)،",
      "   الموصّلات (Connectors)، الذاكرة (Memory)، البرمجة (Code)، العمل المشترك (Cowork).",
      "   أما داخل الجُمل فتُستعمل العربية وحدها بلا قوسين.",
      "   ملاحظة: «Code» تعني «البرمجة» لا «الأكواد».",
      "4) إن كان النص علامة تجارية أو رمزًا برمجيًّا لا يُترجم، اجعل ترجمته مطابقة للأصل.",
      "5) حافظ على الرموز في مواضعها: %d و{...} والنقاط الثلاث … وعلامات مثل ×.",
      "6) وحّد ترجمة المصطلح الواحد في كل النصوص.",
      "",
      "أعد النتيجة **بصيغة JSON فقط** بلا أي شرح قبلها أو بعدها:",
      '[{"en":"النص الإنجليزي كما هو","ar":"الترجمة العربية"}]',
      "",
      "احرص أن يكون حقل en منسوخًا حرفيًّا بلا تغيير في علامات الترقيم أو المسافات،",
      "وأن يكون عدد العناصر مساويًا لمجموع الأسطر أدناه (" + (keys.length + varKeys.length) + ").",
      "",
      "### نصوص ثابتة (" + arCount(keys.length, N.line) + ")",
      "----------------------------------------",
      keys.join("\n"),
      varSection,
    ].join("\n");
  }

  // ---------- فحص تحديثات الموقع ----------
  // الفحص نفسه يجري داخل صفحة claude.ai (في engine.js) لأنه وحده يستطيع قراءة ملفات
  // الموقع. نتخاطب معه عبر مفتاحي تخزين: cml_scan_request طلبًا، وcml_scan_result نتيجةً.
  var scanTimer = null;

  // دائرتا نسبة التغطية في «قاموس التعريب» — تُحدَّثان من نتيجة الفحص المخزّنة.
  // قبل أول فحص لا نعرف حجم الكتالوج فتظهر «؟» مع دعوة لتشغيل الفحص.
  var DONUT_C = 201.06; // محيط الدائرة r=32
  function renderStats(r) {
    var dT = $("donutT"), dU = $("donutU"), pT = $("pctT"), pU = $("pctU"), line = $("statLine");
    if (!dT || !line) return; // صفحة اختبار بلا دوائر
    var dictN = BASE_KEYS.length.toLocaleString("en");
    if (r && r.status === "done" && r.found > 0) {
      var miss = r.missing || 0;
      var pctU = Math.min(100, Math.round(miss / r.found * 100));
      var pctT = 100 - pctU;
      dT.setAttribute("stroke-dasharray", (pctT / 100 * DONUT_C).toFixed(1) + " " + DONUT_C);
      dU.setAttribute("stroke-dasharray", (pctU / 100 * DONUT_C).toFixed(1) + " " + DONUT_C);
      pT.textContent = pctT + "٪"; pU.textContent = pctU + "٪";
      line.innerHTML = "قاموس الإضافة: <b>" + dictN + "</b> ترجمة · آخر فحص وجد <b>" +
        r.found.toLocaleString("en") + "</b> نصًّا في الموقع، غيرُ المترجَم منها <b>" + miss.toLocaleString("en") + "</b>." +
        (miss
          ? " <b>لترجمتها:</b> «تنزيل أمر الترجمة» ثم «استيراد الترجمات» أدناه، أو اختر «غير المترجَم» في التصفية."
          : " المصدر مطابق لآخر فحص ✓");
    } else {
      dT.setAttribute("stroke-dasharray", "0 " + DONUT_C);
      dU.setAttribute("stroke-dasharray", "0 " + DONUT_C);
      pT.textContent = "؟"; pU.textContent = "؟";
      line.innerHTML = "قاموس الإضافة: <b>" + dictN + "</b> ترجمة. لقياس نسبة التغطية وجلب غير المترجَم، شغّل «تحديث المصدر — فحص الموقع» أعلاه.";
    }
    // القواعد الفاسدة تُصرَّح لا تُبتلع: المحرك يعدّها في compile ويكتبها متى تغيّرت
    get([CMLConst.K.BAD_RULES], function (b) {
      var br = b[CMLConst.K.BAD_RULES];
      var n = br ? (br.patterns || 0) + (br.plurals || 0) : 0;
      if (n) line.innerHTML += "<br>⚠ <b>" + n + "</b> من قواعدك المحفوظة تالفةٌ لا تُطبَّق — أعد استيرادها، أو احذفها من «تصحيحاتك».";
    });
  }

  function renderScan(r) {
    var cnt = $("scanCount"), st = $("scanStatus");
    renderStats(r);
    if (!r || !r.status) { cnt.textContent = "لم يُجرَ فحص بعد"; return; }
    if (r.status === "running") {
      // نبض متوقّف ⇒ الزاحف مات (أُغلق تبويب claude.ai مثلًا). بدونه تبقى الصفحة
      // عالقة على «جارٍ الفحص…» أبدًا بلا سبيل استرداد.
      // نتيجة بلا نبض أصلًا = بقايا نسخة أقدم أو فحصٌ مات قبل أول نبضة. عدّها متعثّرة:
      // اشتراطُ وجود النبض كان يترك الزر معطّلًا إلى الأبد فلا يبدأ فحصٌ جديد أبدًا.
      if (!r.at || Date.now() - r.at > CMLConst.HEARTBEAT_STALL_MS) {
        cnt.textContent = "انقطع الفحص";
        st.textContent = "توقّف بعد قراءة " + arCount((r.fetched || 0), N.file, true) + " — غالبًا أُغلق تبويب claude.ai أو أُعيد تحميل الإضافة. افتح claude.ai وحدّث الصفحة ثم أعد الفحص.";
        $("cancelScan").classList.add("hidden");
        $("startScan").disabled = false;
        if (scanTimer) { clearInterval(scanTimer); scanTimer = null; }
        return;
      }
      cnt.textContent = "جارٍ الفحص…";
      var done = r.fetched || 0, left = r.queued || 0;
      var pct = done + left > 0 ? Math.min(99, Math.round((done / (done + left)) * 100)) : 0;
      // لا تدهس رسالةً وامضة (تأكيد استيراد أو خطأ حفظ) — وارفع صنف الخطأ عن سطر التقدّم
      if (!st.dataset.flashing) {
        st.textContent = "التقدّم نحو " + pct + "٪ — قرأ " + arCount(done, N.file, true) + "، ووجد " + arCount((r.found || 0), N.text, true) + "…";
        st.classList.remove("err");
      }
      // صفحة إعدادات فُتحت من جديد أثناء فحصٍ جارٍ كانت تعرض الزر مفعّلًا، فضغطُه يمسح
      // حجز الزاحف النشط ويُطلق زحفًا موازيًا. الفحص جارٍ ⇒ الزر معطَّل والإيقاف ظاهر.
      $("startScan").disabled = true;
      $("cancelScan").classList.remove("hidden");
      if (!scanTimer) scanTimer = setInterval(pollScan, 1000); // استأنف الاستطلاع بعد إعادة الفتح
      return;
    }
    $("cancelScan").classList.add("hidden");
    if (r.status === "error" || r.status === "cancelled") {
      cnt.textContent = r.status === "cancelled" ? "أُوقف الفحص" : "تعذّر الفحص";
      st.textContent = r.status === "cancelled"
        ? "أُوقف بعد قراءة " + arCount((r.fetched || 0), N.file, true) + ". اضغط «بدء الفحص» للإعادة."
        : (r.error || "حدث خطأ.");
      $("startScan").disabled = false;
      if (scanTimer) { clearInterval(scanTimer); scanTimer = null; }
      return;
    }
    // done
    if (scanTimer) { clearInterval(scanTimer); scanTimer = null; }
    $("startScan").disabled = false;
    $("startScan").textContent = "إعادة الفحص";
    var nPlain = (r.list || []).length, nVars = (r.varList || []).length;
    cnt.textContent = r.missing ? ("غير المترجَم: " + arCount(r.missing, N.text)) : "كل شيء مترجَم ✓";
    // لا تدهس رسالة flash نشطة (تأكيد استيراد مثلًا) — الملخص يبقى متاحًا في العدّاد
    if (!st.dataset.flashing) {
      st.classList.remove("err");
      var msg = "فُحص " + arCount((r.fetched || 0), N.file) + " و" + arCount((r.found || 0), N.text) + " في " + arCount((r.seconds || 0), N.sec, true) + ".";
      if (nVars) msg += " منها " + arCount(nVars, N.text) + " بمتغيّرات تصير قواعد ذكية.";
      if (r.capped) msg += " (عُرض أول 4000 نصّ)";
      // إخفاق الجلب يعني نتيجةً ناقصة — والسكوت عنه يجعل «تمّ» يبدو اكتمالًا وليس به
      if (r.failed) msg += " ⚠ تعذّر جلب " + arCount(r.failed, N.file, true) + "، فالنتيجة ناقصة — أعد الفحص.";
      msg += r.missing
        ? " غيرُ المترجَم في «قاموس التعريب» أدناه — النِّسَب والقائمة وأدوات الترجمة."
        : " المصدر مطابق لأحدث نسخة من الموقع ✓";
      st.textContent = msg;
    }
  }

  var scanWaited = 0;
  function pollScan() {
    scanWaited += 1;
    get(["cml_scan_result"], function (s) {
      var r = s.cml_scan_result;
      if (r) { renderScan(r); return; }
      // المحرّك يكتب إشعار استلام فور وصول الطلب. فبلوغُ المهلة بلا أي نتيجة يعني قطعًا
      // أنه **لا سكربت حيّ** في أي تبويب claude.ai — لا أن أحدهم امتنع (فالممتنع يصرّح).
      // والسبب الغالب: أُعيد تحميل الإضافة والتبويب مفتوح، فبقي سكربته القديم منفصلًا.
      if (scanWaited >= 12) {
        clearInterval(scanTimer); scanTimer = null;
        $("startScan").disabled = false;
        $("cancelScan").classList.add("hidden");
        $("scanCount").textContent = "لم يصل الطلب";
        $("scanStatus").innerHTML =
          "لم يستجب أي تبويب. الأرجح أن تبويب claude.ai مفتوح منذ ما قبل تحديث الإضافة، فلم يعد متصلًا بها. " +
          "<b>الحل:</b> افتح تبويب claude.ai واضغط <b>Ctrl+Shift+R</b> (تحديث كامل) وانتظر اكتمال تحميل الصفحة، ثم عُد هنا واضغط «بدء الفحص». " +
          "وإن لم يكن التبويب مفتوحًا أصلًا فافتحه أولًا.";
      }
    });
  }
  // «أيوجد زحف حيّ الآن؟» — يُسأل عامل الخدمة أولًا (المرحلة ٤: حالته هي الحقيقة،
  // والمنحة تتحرر لحظةَ انقطاع منفذ صاحبها فلا حاجة لعتبات تقادم)، ويُسقَط إلى
  // فحص مفتاح الحجز القديم حيث لا عامل يرد (قشور الاختبار، أو عاملٌ متعطل).
  function askBusy(cb) {
    var done = false;
    function legacy() {
      SESS.get(["cml_scan_claim"], function (s) {
        var c = s.cml_scan_claim;
        if (c && c.id && c.at && Date.now() - c.at < CMLConst.CLAIM_STALE_MS) { cb(true); return; }
        // زحفُ وضعِ المحكّم لا يكتب مفتاح الحجز القديم أصلًا — فإن تأخر ردُّ العامل
        // (إقلاعٌ بارد تحت حِمل) دلّنا عليه نبضُ نتيجةٍ «جارٍ» حديث بدل إنكارٍ كاذب
        get([CMLConst.K.SCAN_RESULT, CMLConst.K.RTLDOC_RESULT], function (r) {
          function fresh(x) { return !!(x && x.status === "running" && x.at && Date.now() - x.at < CMLConst.HEARTBEAT_STALL_MS); }
          cb(fresh(r[CMLConst.K.SCAN_RESULT]) || fresh(r[CMLConst.K.RTLDOC_RESULT]));
        });
      });
    }
    var t = setTimeout(function () { if (done) return; done = true; legacy(); }, 300);
    try {
      chrome.runtime.sendMessage({ type: "status" }, function (r) {
        if (done) return;
        done = true;
        try { clearTimeout(t); } catch (e) {}
        if (chrome.runtime.lastError || !r) { legacy(); return; }
        if (!r.busy) { cb(false); return; }
        // العامل يقول «مشغول» — لكن منفذًا حيًّا بعملٍ ميّت (جلبٌ لا يُحسم) كان يقفل الفحص
        // بلا مخرج: فالحكم للنبض (legacy يفحص الحجز ونبضَي «جارٍ»)، لا للمنفذ وحده
        legacy();
      });
    } catch (e) {
      if (!done) { done = true; try { clearTimeout(t); } catch (e2) {} legacy(); }
    }
  }

  function startScan() {
    // لا نمسح حجزًا حيًّا: مسحُه يُسقط زاحفًا يعمل الآن ويسمح بزاحفٍ ثانٍ يوازيه.
    askBusy(function (busy) {
      if (busy) {
        $("scanStatus").textContent = "يوجد فحص جارٍ بالفعل في تبويب آخر — انتظر انتهاءه أو أوقفه.";
        $("cancelScan").classList.remove("hidden");
        if (!scanTimer) { scanWaited = 0; scanTimer = setInterval(pollScan, 1000); }
        return;
      }
      proceedStartScan();
    });
  }
  function proceedStartScan() {
    $("startScan").disabled = true;
    $("cancelScan").classList.remove("hidden");
    $("scanStatus").textContent = "أُرسل الطلب… تأكد أن تبويب claude.ai مفتوح.";
    set({ cml_scan_result: null });
    try { SESS.set({ cml_scan_cancel: null, cml_scan_claim: null, cml_scan_request: Date.now() }); } catch (e) {}
    scanWaited = 0;
    if (scanTimer) clearInterval(scanTimer);
    scanTimer = setInterval(pollScan, 1000);
  }

  function stopScan() {
    try { SESS.set({ cml_scan_cancel: Date.now() }); } catch (e) {}
    $("scanStatus").textContent = "يجري الإيقاف…";
    // مخرج مضمون: لو لم يكن ثمة زاحفٌ حيّ يستجيب (أُغلق تبويبه) بقيت الصفحة عالقة على
    // «يجري الإيقاف…» بلا نهاية. فبعد ثانيتين ننظّف الحالة بأنفسنا ونحرّر الحجز.
    setTimeout(function () {
      get(["cml_scan_result"], function (s) {
        var r = s.cml_scan_result;
        if (r && r.status !== "running") return;      // استجاب الزاحف فعلًا
        set({ cml_scan_result: null }, function () {
          try { SESS.set({ cml_scan_claim: null }); } catch (e) {}
          if (scanTimer) { clearInterval(scanTimer); scanTimer = null; }
          $("startScan").disabled = false;
          $("cancelScan").classList.add("hidden");
          $("scanCount").textContent = "لم يُجرَ فحص بعد";
          $("scanStatus").textContent = "أُوقف الفحص. اضغط «بدء الفحص» متى شئت.";
        });
      });
    }, 2000);
  }

  function exportScan() {
    get(["cml_scan_result"], function (s) {
      var r = s.cml_scan_result;
      var plain = (r && r.list) || [], vars = (r && r.varList) || [];
      if (!plain.length && !vars.length) { flash($("scanStatus"), "لا توجد نصوص غير مترجَمة لتنزيلها."); return; }
      download("أمر-ترجمة-كلود-جديد.txt", buildPrompt(plain, vars), "text/plain;charset=utf-8");
      flash($("scanStatus"), "نُزّل الملف (" + arCount((plain.length + vars.length), N.text) + ") وفيه الأمر كاملًا — ألصقه في claude.ai.");
    });
  }

  // ---------- الاتجاه (RTL): اختيار المحرّك + فحص الاتجاه ----------
  // المحرّك الشامل (v2) هو الافتراضي، فاختيارُه لا يُخزَّن قيمةً بل بمحو المفتاح —
  // على سنّة cml_rtl ونظائره: غيابُ المفتاح افتراضٌ، ووجودُه اختيارٌ صريح للبديل.
  // فلو خزّنّا "v2" صراحةً لتجمّد من اختاره على قيمةٍ قديمة إن بدّلنا الافتراضي يومًا.
  function loadRtlEngine() {
    if (!$("rtlEngineV2")) return; // صفحة اختبار بلا قسم الاتجاه
    get([CMLConst.K.RTL_ENGINE], function (s) {
      var v1 = s[CMLConst.K.RTL_ENGINE] === "v1";
      $("rtlEngineV1").checked = v1;
      $("rtlEngineV2").checked = !v1;
    });
  }
  function setRtlEngine(v) {
    if (v === "v1") {
      var patch = {};
      patch[CMLConst.K.RTL_ENGINE] = "v1";
      set(patch, function (err) {
        if (err) { flash($("rtlEngineStatus"), "تعذّر الحفظ."); return; }
        flash($("rtlEngineStatus"), "اختير المبسّط — يسري فورًا على تبويبات claude.ai المفتوحة.");
      });
    } else {
      chrome.storage.local.remove(CMLConst.K.RTL_ENGINE, function () {
        flash($("rtlEngineStatus"), "عاد الشامل (الموصى به) — يسري فورًا على تبويبات claude.ai المفتوحة.");
      });
    }
  }

  // فحص الاتجاه يجري داخل صفحة claude.ai (runRtlDoc في المحرّك) لأنه وحده يقرأ ملفات
  // تنسيق الموقع. التخاطب كمخاطبة فحص الترجمة سواء بسواء: cml_rtldoc_request طلبًا
  // (على session فيُمحى بإغلاق المتصفح) وcml_rtldoc_result نتيجةً على local.
  // والطبيب يقتسم حجز cml_scan_claim مع فحص الترجمة فلا يجريان معًا ولا طبيبان متوازيان.
  var rtlDocTimer = null, rtlDocWaited = 0;

  // حال المحرّك الحيّ: متى بُنيت الورقة، ومن كم ورقةً، وكم موضعًا قُلب — وزرُّ إعادة بناءٍ
  // يدوي (المسار التلقائي يكفي، لكن رؤية الحال تطمئن ومَن أراد التعجيل فله ذلك)
  function renderRtlLive() {
    var box = $("rtlLiveInfo");
    if (!box) return;
    get([CMLConst.K.RTL_LIVE], function (s) {
      var r = s[CMLConst.K.RTL_LIVE];
      if (!r || !r.css) {
        box.textContent = "لم يُضبط الاتجاه من الموقع بعد — يجري ذلك تلقائيًّا عند أول فتحٍ لـclaude.ai، وحتى ذلك الحين تعمل الإعدادات المضمّنة في الإضافة.";
        return;
      }
      var d = new Date(r.at || 0);
      box.textContent = "الاتجاه مضبوط من الموقع — المعكوس: " + arCount((r.flipped || 0), N.spot) + " من " +
        arCount((r.sources || 0), N.sheet, true) + " (" + Math.round((r.bytes || 0) / 1024) + " كيلوبايت) — آخر ضبطٍ " +
        d.toLocaleDateString("ar-u-nu-latn") + " " + d.toLocaleTimeString("ar-u-nu-latn", { hour: "2-digit", minute: "2-digit" }) + ".";
    });
  }

  function renderRtlDoc(r) {
    var cnt = $("rtlDocCount"), st = $("rtlDocStatus"), box = $("rtlDocBox");
    if (!cnt || !st) return; // صفحة اختبار بلا قسم الاتجاه
    cnt.style.color = "";
    if (!r || !r.status) { cnt.textContent = "لم يُجرَ فحص بعد"; return; }
    if (r.status === "running") {
      // نبض متوقّف ⇒ مات الفاحص (أُغلق تبويب claude.ai مثلًا) — كقاعدة فحص الترجمة:
      // بدون هذا المخرج تبقى الصفحة على «جارٍ الفحص…» أبدًا والزر معطّلًا بلا استرداد.
      if (!r.at || Date.now() - r.at > CMLConst.HEARTBEAT_STALL_MS) {
        cnt.textContent = "انقطع الفحص";
        st.textContent = "توقّف بعد قراءة " + arCount((r.fetched || 0), N.file, true) + " — غالبًا أُغلق تبويب claude.ai أو أُعيد تحميل الإضافة. افتح claude.ai وحدّث الصفحة ثم أعد الفحص.";
        $("startRtlDoc").disabled = false;
        if (rtlDocTimer) { clearInterval(rtlDocTimer); rtlDocTimer = null; }
        return;
      }
      cnt.textContent = "جارٍ الفحص…";
      st.textContent = "قرأ " + arCount(r.fetched || 0, N.sheet, true) + "…";
      // صفحة فُتحت من جديد أثناء فحص جارٍ: الزر معطَّل والاستطلاع مستأنَف — كالفحص أعلاه
      $("startRtlDoc").disabled = true;
      if (!rtlDocTimer) { rtlDocWaited = 0; rtlDocTimer = setInterval(pollRtlDoc, 1000); }
      return;
    }
    if (rtlDocTimer) { clearInterval(rtlDocTimer); rtlDocTimer = null; }
    $("startRtlDoc").disabled = false;
    if (r.status === "error") {
      cnt.textContent = "تعذّر الفحص";
      st.textContent = r.error || "حدث خطأ.";
      if (box) box.classList.add("hidden");
      return;
    }
    // done
    $("startRtlDoc").textContent = "إعادة فحص الاتجاه";
    var unc = r.uncovered || 0;
    var shown = (r.list || []).length;
    if (unc) {
      cnt.textContent = "لم يُعكس بعد: " + arCount(unc, N.rule);
    } else {
      cnt.textContent = "✓ الاتجاه مضبوط بالكامل";
      cnt.style.color = "var(--ok)";
    }
    var msg = "فُحص " + arCount((r.files || 0), N.file) + " وفيها " + arCount((r.rules || 0), N.rule) + "، منها ما يذكر يمينًا أو يسارًا (" +
      arCount((r.physical || 0), N.rule) + "): المُعالَج " + (r.covered || 0) +
      " وغيرُ المغطّى " + unc + (unc && shown < unc ? " (يُعرض أول " + shown + ")" : "") +
      "، في " + arCount((r.seconds || 0), N.sec, true) + ".";
    // الصنفان يفترقان (تشخيص حي): 404 «إشارات وهمية» — أسماءٌ تشبه الملفات داخل نصوص
    // الحزم (عمال بمسارات أخرى، أمثلة رسائل مصرِّف) لا ملفاتُ موقع، وإعادةُ الفحص لن
    // «تصلحها» أبدًا فلا تُعدّ نقصًا ولا تستحق ⚠. أما إخفاق الشبكة الباقي بعد جولة
    // الإعادة الداخلية فهو النقص الحق الذي يستحق التصريح والإعادة.
    if (r.failed) msg += " ⚠ تعذّر جلب " + arCount(r.failed, N.file, true) + " (شبكة) رغم إعادة المحاولة، فالنتيجة ناقصة — أعد الفحص.";
    if (r.ghosts) msg += " وتجاهل " + r.ghosts + " إشارةً وهمية (أسماء تشبه الملفات داخل النصوص لا ملفات حقيقية — أمر طبيعي).";
    // الأنماط السطرية تُذكر ولا تُعدّ نقصًا: تركُها مبدأٌ في المحرّك لا سهوٌ — فالمحرّك
    // يقلب أصناف التنسيق وحدها، والمواضع التي تحسبها سكربتات الموقع بنفسها لا تُمسّ.
    msg += " وفي التنسيقات التي يحسبها الموقع بنفسه فُحص " + arCount((r.inlineChecked || 0), N.elem) + "، وفي " +
      arCount((r.inlinePhysical || 0), N.rule, true) + " منها يمينٌ أو يسار — وهذه لا تمسّها الإضافة عمدًا.";
    // لا تدهس رسالة flash نشطة (تأكيد تنزيل مثلًا) — الملخص يبقى متاحًا في العدّاد
    if (!st.dataset.flashing) st.textContent = msg;
    if (!box) return;
    if (!unc) { box.classList.add("hidden"); return; }
    var listEl = $("rtlDocList");
    listEl.innerHTML = "";
    (r.list || []).forEach(function (x) {
      var d = document.createElement("div");
      d.className = "ditem";
      d.textContent = x.sel + " — " + x.prop;
      listEl.appendChild(d);
    });
    box.classList.remove("hidden");
  }

  function pollRtlDoc() {
    rtlDocWaited += 1;
    get([CMLConst.K.RTLDOC_RESULT], function (s) {
      var r = s[CMLConst.K.RTLDOC_RESULT];
      if (r) { renderRtlDoc(r); return; }
      // المحرّك يكتب {status:"running"} فور استلام الطلب. فبلوغُ المهلة بلا أي نتيجة يعني
      // قطعًا أن لا سكربت حيّ في أي تبويب claude.ai — كقاعدة فحص الترجمة سواء بسواء.
      if (rtlDocWaited >= 20) {
        clearInterval(rtlDocTimer); rtlDocTimer = null;
        $("startRtlDoc").disabled = false;
        $("rtlDocCount").textContent = "لم يصل الطلب";
        $("rtlDocStatus").innerHTML =
          "لم يستجب أي تبويب. الأرجح أن تبويب claude.ai مفتوح منذ ما قبل تحديث الإضافة، فلم يعد متصلًا بها. " +
          "<b>الحل:</b> افتح تبويب claude.ai واضغط <b>Ctrl+Shift+R</b> (تحديث كامل) وانتظر اكتمال تحميل الصفحة، ثم عُد هنا واضغط «بدء فحص الاتجاه». " +
          "وإن لم يكن التبويب مفتوحًا أصلًا فافتحه أولًا.";
      }
    });
  }

  function startRtlDoc() {
    // التحكيم المشترك مع فحص الترجمة: لا نُطلق الطبيب وفحصٌ حيٌّ يعمل الآن — القناة واحدة.
    askBusy(function (busy) {
      if (busy) {
        $("rtlDocStatus").textContent = "يوجد فحص جارٍ الآن (فحص الموقع أو الاتجاه) — انتظر انتهاءه ثم أعد المحاولة.";
        return;
      }
      $("startRtlDoc").disabled = true;
      $("rtlDocStatus").textContent = "أُرسل الطلب… تأكد أن تبويب claude.ai مفتوح.";
      if ($("rtlDocBox")) $("rtlDocBox").classList.add("hidden");
      var patch = {};
      patch[CMLConst.K.RTLDOC_RESULT] = null;
      set(patch);
      var req = {};
      req[CMLConst.K.RTLDOC_REQUEST] = { at: Date.now() };
      try { SESS.set(req); } catch (e) {}
      rtlDocWaited = 0;
      if (rtlDocTimer) clearInterval(rtlDocTimer);
      rtlDocTimer = setInterval(pollRtlDoc, 1000);
    });
  }

  // النتيجة كاملة (بالقيم وغير القابل للقلب) تُنزَّل ملفًا — للإرفاق بمسألة على المستودع
  function exportRtlDoc() {
    get([CMLConst.K.RTLDOC_RESULT], function (s) {
      var r = s[CMLConst.K.RTLDOC_RESULT];
      if (!r || r.status !== "done") { flash($("rtlDocStatus"), "لا نتيجة للتنزيل — شغّل فحص الاتجاه أولًا."); return; }
      download("فحص-الاتجاه-كلود.json", JSON.stringify({ _app: "claude-mutarjim", _kind: "rtl-doctor", result: r }, null, 2));
      flash($("rtlDocStatus"), "نُزّلت النتيجة كاملة ✓");
    });
  }

  // ---------- المزامنة الاختيارية بين الأجهزة (المرحلة ٦) ----------
  // المنطق كله في cml-sync.js يقوده sw.js — لهذه الصفحة ثلاثة أدوار لا غير:
  //   ١) الموافقة الصريحة: لوحة شرح صادقة ثم كتابة علم cml_sync_enabled.
  //   ٢) عرض حال آخر دفعة من cml_sync_state كما هي — بلا تجميل: ok/overflow/error/wiped،
  //      وحالٌ لا نعرفها تُقال باسمها ولا تسقط إلى ادّعاء نجاحٍ لا نعلمه.
  //   ٣) المسح المستقل: حذف مفاتيحنا (الميتا والشرائح) من chrome.storage.sync رأسًا —
  //      مستقلٌّ عن الإيقاف عمدًا، لأن التعطيل لا يمسح ما رُفع. ولذلك زرُّه قسميٌّ
  //      يُرى في الحالين، لا داخل لوحة «مفعّلة» التي تختفي عمّن أوقف المزامنة.
  var SYNC_TOTAL_KB = Math.round(CMLConst.SYNC_TOTAL_BYTES / 1000);

  // مفاتيحنا وحدها في مساحة المزامنة (الميتا والشرائح) — لا نمسّ فيها سواها أبدًا
  function ourSyncKeys(all) {
    var keys = [];
    for (var k in (all || {})) {
      if (!Object.prototype.hasOwnProperty.call(all, k)) continue;
      if (k === CMLConst.K.SYNC_META || k.indexOf(CMLConst.K.SYNC_CHUNK_PREFIX) === 0) keys.push(k);
    }
    return keys;
  }

  // «أفي حسابك شيءٌ مرفوع الآن؟» — تُسأل مساحةُ المزامنة نفسُها لا الحالُ المحلية،
  // لأن المحلية قد تكذب: جهازٌ آخر مسح، أو أُعيد الضبط هنا فمُحيت الحال والمرفوع باقٍ.
  // النداء يستقبل مصفوفة المفاتيح (فارغةً إن خلت المساحة)، أو null متى تعذّر السؤال
  // أصلًا (قشرةٌ بلا chrome.storage.sync، أو خطأ) — وحينها لا ندّعي علمًا لا نملكه.
  function probeSyncArea(cb) {
    try {
      if (!chrome.storage || !chrome.storage.sync) { cb(null, "غير متاحة هنا"); return; }
      chrome.storage.sync.get(null, function (all) {
        var e = chrome.runtime && chrome.runtime.lastError;
        if (e) { cb(null, e.message); return; }
        cb(ourSyncKeys(all));
      });
    } catch (e) { cb(null, String((e && e.message) || e)); }
  }

  // زرُّ المسح: يُرسم في الحالتين، وحالُه من المساحة نفسها لا من علم التفعيل
  function renderWipeBox(enabled) {
    var btn = $("syncWipeBtn"), note = $("syncWipeNote");
    if (!btn) return; // قشور الاختبار بلا هذا القسم
    btn.disabled = true;
    if (note) note.textContent = "جارٍ التحقق من مساحة المزامنة…";
    probeSyncArea(function (keys, err) {
      if (!keys) {
        // لا ندري أفيها شيء أم لا ⇒ زرٌّ معطَّل وتصريحٌ بالسبب، لا زرٌّ يَعِد بما لا يفعل
        btn.disabled = true;
        if (note) note.textContent = "تعذّر التحقق من مساحة المزامنة (" + (err || "خطأ غير معروف") +
          ") — فلا نعرف أفيها من هذه الإضافة شيء أم لا. أعد فتح هذه الصفحة، وإن تكرّر فتحقّق من مزامنة كروم في متصفحك.";
        return;
      }
      if (!keys.length) {
        btn.disabled = true;
        if (note) note.textContent = "لا شيء مرفوع من هذه الإضافة في حسابك الآن — فلا شيء يُمحى، والزرّ معطَّل حتى يُرفع شيء.";
        return;
      }
      btn.disabled = false;
      if (note) note.textContent = enabled
        ? "في حسابك نسخةٌ مرفوعة من تصحيحاتك وقواعدك. ومحوُها لا يوقف المزامنة: ما دامت مفعّلةً هنا رُفعت نسختُك من جديد عند أول تعديل."
        : "المزامنة متوقّفة على هذا الجهاز، ونسختُك المرفوعة سابقًا لا تزال في حسابك — امسحها بالزرّ أعلاه، ولا حاجة إلى إعادة التفعيل.";
    });
  }

  function renderSync() {
    var off = $("syncOff"), on = $("syncOn");
    if (!off && !on && !$("syncWipeBtn")) return; // قشور الاختبار بلا هذا القسم
    get([CMLConst.K.SYNC_ENABLED, CMLConst.K.SYNC_STATE], function (s) {
      var enabled = s[CMLConst.K.SYNC_ENABLED] === true;
      if (off) off.classList.toggle("hidden", enabled);
      if (on) on.classList.toggle("hidden", !enabled);
      renderWipeBox(enabled); // قسميٌّ: يُرسم في الحالين قبل أي خروج مبكر
      if (!enabled) return;
      var st = s[CMLConst.K.SYNC_STATE];
      var line = $("syncStateLine"), fill = $("syncBarFill");
      if (!line) return;
      function pct(b) { return Math.min(100, Math.round((b || 0) / CMLConst.SYNC_TOTAL_BYTES * 100)); }
      if (st && st.status === "ok") {
        var kb = Math.round((st.bytes || 0) / 100) / 10; // بمنزلة عشرية: اللقطات الصغيرة لا تظهر صفرًا
        line.innerHTML = "آخر رفع " + new Date(st.at || 0).toLocaleString("en") + " — <b>" +
          (st.count || 0).toLocaleString("en") + "</b> من تصحيحاتك وقواعدك، <b>" +
          kb.toLocaleString("en") + "</b> كيلوبايت من " + SYNC_TOTAL_KB.toLocaleString("en") + " كيلوبايت.";
        if (fill) { fill.style.width = pct(st.bytes) + "%"; fill.style.background = "var(--brand)"; }
      } else if (st && st.status === "overflow") {
        // صادقة لا مهوِّنة: لم يُرفع شيء من هذه الدفعة، والمحلي كامل لم يُمسّ
        var needKb = Math.ceil((st.need || 0) / 1000);
        line.innerHTML = "⚠ <b>لم يُرفع شيء:</b> تصحيحاتُك أكبر من مساحة المزامنة (تحتاج نحو " +
          needKb.toLocaleString("en") + " كيلوبايت والحدّ الأقصى " + SYNC_TOTAL_KB.toLocaleString("en") +
          "). كلُّها محفوظة محليًّا كما هي — احذف بعض التصحيحات، أو انقلها بين أجهزتك ملفًّا من «تصدير تصحيحاتك فقط».";
        if (fill) { fill.style.width = "100%"; fill.style.background = "var(--danger)"; }
      } else if (st && st.status === "wiped") {
        // بعد المسح: الصدق أن نقول «لا شيء مرفوع» ونُفرغ الشريط — كان يبقى سطرُ «آخر رفع»
        // وشريطُه ممتلئًا لبياناتٍ لم تعد في الحساب أصلًا
        line.innerHTML = "مُحي ما كان مرفوعًا (" + new Date(st.at || 0).toLocaleString("en") +
          ") — <b>لا شيء مرفوع في حسابك الآن</b>. والمزامنة ما زالت مفعّلةً على هذا الجهاز، " +
          "فأول تعديل في تصحيحاتك أو قواعدك يرفعها من جديد.";
        if (fill) { fill.style.width = "0"; fill.style.background = "var(--brand)"; }
      } else if (st && st.status === "error") {
        // صريحة لا مهوّنة: هذه الدفعة لم تُرفع، والمحلي سليم، وسببُ المتصفح كما قاله
        // (وأغلبُه خنقُ كروم لكثرة الكتابات في الدقيقة)، ثم كيف تُستعجل المحاولة
        line.textContent = "⚠ تعذّر الرفع الأخير (" + new Date(st.at || 0).toLocaleString("en") +
          ") — لم تُرفع هذه الدفعة، وتصحيحاتك كلها محفوظة على جهازك كما هي. " +
          "قال المتصفح: " + (st.error || "خطأ غير معروف") + " — وأكثرُه كثرةُ الكتابات في الدقيقة، ويحدّها كروم. " +
          "وتُعاد المحاولة تلقائيًّا عند أول تعديل أو إيقاظ للإضافة؛ ولاستعجالها عدّل تصحيحًا أو أعد تحميل الإضافة.";
        if (fill) { fill.style.width = "0"; fill.style.background = "var(--danger)"; }
      } else if (st && st.status) {
        // حالٌ لا تعرفها هذه الصفحة (كتبتها نسخةٌ أحدث مثلًا): تُقال كما هي ولا تُلبَس
        // ثوب «فُعّلت ✓» — فذاك ادّعاءُ نجاحٍ لا نعلمه
        line.textContent = "حالُ آخر دفعة: «" + st.status + "» — وهي حالٌ لا تعرفها هذه الصفحة، " +
          "فلا نستطيع تأكيد أن الرفع تمّ. وتصحيحاتك محفوظة على جهازك كما هي على كل حال. " +
          "حدّث الإضافة أو أعد فتح هذه الصفحة.";
        if (fill) { fill.style.width = "0"; fill.style.background = "var(--brand)"; }
      } else {
        line.textContent = "فُعّلت المزامنة ✓ — أول رفع يجري خلال ثوانٍ وستظهر حاله هنا.";
        if (fill) { fill.style.width = "0"; fill.style.background = "var(--brand)"; }
      }
    });
  }

  function syncConfirm() {
    get([CMLConst.K.OVERRIDES], function (s) {
      var patch = {};
      patch[CMLConst.K.SYNC_ENABLED] = true;
      // وخزة أول رفع: إعادة كتابة التصحيحات بقيمتها الحالية حدثُ تخزينٍ يلتقطه العامل
      // فيمرّ بمسار handleLocalChange الطبيعي (وحدثُ علم الموافقة نفسه ملتقَط في sw.js
      // احتياطًا) — فأيّهما وصل جرى أول رفعٍ فورًا لا عند أول تعديل لاحق
      patch[CMLConst.K.OVERRIDES] = s[CMLConst.K.OVERRIDES] || {};
      set(patch, function (err) {
        if (err) { flash($("syncStatus"), "تعذّر الحفظ — لم تُفعَّل المزامنة."); return; }
        var c = $("syncConsent"); if (c) c.classList.add("hidden");
        renderSync();
        flash($("syncStatus"), "فُعّلت المزامنة ✓");
      });
    });
  }

  function syncDisable() {
    var patch = {};
    patch[CMLConst.K.SYNC_ENABLED] = false;
    set(patch, function (err) {
      if (err) { flash($("syncStatus"), "تعذّر الحفظ."); return; }
      renderSync();
      // الصدق التزام العقد: الإيقاف محليّ ولا يمسّ الطرف البعيد — ونقولها للمستخدم
      flash($("syncStatus"), "أُوقفت المزامنة على هذا الجهاز — وما رُفع سابقًا باقٍ في حسابك، ومسحُه بزرّ «مسح ما رُفع من حسابك» وهو ظاهرٌ الآن ولا يحتاج إعادة تفعيل.");
    });
  }

  // لبّ المسح البعيد: بلا سؤالٍ ولا رسم — يقتسمه زرُّ المسح و«إعادة الضبط» معًا،
  // فلا يفترق المساران في ماذا يُمحى ولا في ما يُكتب بعده.
  // النداء يستقبل: {empty:true} إن لم يكن ثمة ما يُمحى، أو {ok:true}، أو {error:"…"}.
  function wipeRemote(cb) {
    probeSyncArea(function (keys, err) {
      if (!keys) { cb({ error: err || "مساحة المزامنة غير متاحة" }); return; }
      if (!keys.length) { cb({ empty: true }); return; }
      try {
        chrome.storage.sync.remove(keys, function () {
          var e = chrome.runtime && chrome.runtime.lastError;
          if (e) { cb({ error: e.message }); return; }
          // الحال بعد المسح كانت تكذب: يبقى «آخر رفع … كذا كيلوبايت» وشريطُ السعة ممتلئًا
          // لبياناتٍ لم تعد موجودة. فنكتب حالًا صادقة، ونمحو بصمةَ آخر حالةٍ طابقت السحابة
          // (SYNC_LASTHASH) — وإلا عدّ حارسُ الصدى الحالةَ المحلية «مزامَنةً» فلم يُرفع
          // شيءٌ أبدًا بعد المسح والمزامنةُ مفعّلة.
          get([CMLConst.K.SYNC_STATE], function (s) {
            var prev = s[CMLConst.K.SYNC_STATE] || {};
            chrome.storage.local.remove(CMLConst.K.SYNC_LASTHASH, function () {
              var e2 = chrome.runtime && chrome.runtime.lastError;
              var patch = {};
              // rev يُحمل معه عمدًا: هو أرضيةُ ترقيم الدفعة التالية، وإسقاطُه يعيد العدّ للوراء
              patch[CMLConst.K.SYNC_STATE] = { status: "wiped", at: Date.now(), rev: prev.rev || 0 };
              set(patch, function (e3) {
                // المسح البعيد تمّ يقينًا، لكن الدفتر المحلي قد يتخلّف — يُصرَّح به ولا يُبتلع،
                // فالسطر المعروض حينها لا يزال يصف حالًا انقضت
                var bad = e2 || e3;
                cb({ ok: true, stateErr: bad ? String(bad.message || bad) : null });
              });
            });
          });
        });
      } catch (e2) {
        // بيئة بلا chrome.storage.sync (قشور الاختبار مثلًا) — إخفاق صريح لا صامت
        cb({ error: String((e2 && e2.message) || e2) });
      }
    });
  }

  function syncWipe() {
    if (!confirm("سيُمحى كل ما رفعته هذه الإضافة إلى مساحة مزامنة حسابك.\n\n" +
      "نسخُ أجهزتك المحلية لا تُمسّ. وما دامت المزامنة مفعّلةً على جهازٍ ما فسيُرفع من جديد عند أول تعديل فيه.\n\nأتتابع؟")) return;
    wipeRemote(function (res) {
      renderSync(); // في الأحوال كلها: حالُ الزرّ والسطر تتبع المساحة بعد المحاولة
      if (res.error) { flash($("syncStatus"), "تعذّر المسح: " + res.error); return; }
      if (res.empty) { flash($("syncStatus"), "مساحة المزامنة خالية أصلًا — لا شيء يُمحى."); return; }
      flash($("syncStatus"), "مُحي ما رُفع من حسابك ✓ — نسخ أجهزتك المحلية باقية كما هي." +
        (res.stateErr ? " (لكن تعذّر تحديث الحال المعروضة: " + res.stateErr + " — أعد فتح الصفحة.)" : ""));
    });
  }

  // ---------- فخّ أذون المضيف منذ فايرفوكس 127 ----------
  // فايرفوكس MV3 لا يمنح أذونَ مواقع سكربتات المحتوى عند التثبيت، فتُثبَّت الإضافة
  // وتصمت على claude.ai صمتًا تامًّا — والمستخدم يظنها معطوبة. فنكشف الحال هنا
  // ونعرض زرّ منح بضغطة. الكشف صارم (getBrowserInfo لا يوجد إلا في فايرفوكس)
  // وكلُّ إخفاقٍ يُبتلع فتبقى اللوحة مخفية: الخطأ الآمن «لا لوحة» — لوحةٌ كاذبة
  // في كروم (الذي يمنح الأذون تلقائيًّا) أسوأُ من غيابها في فايرفوكس.
  var FF_ORIGINS = ["https://claude.ai/*", "https://*.claude.ai/*"];
  function isFirefox() {
    try {
      return typeof browser !== "undefined" && browser.runtime &&
        typeof browser.runtime.getBrowserInfo === "function";
    } catch (e) { return false; }
  }
  function initFfPermBox() {
    var box = $("ffPermBox"), btn = $("ffPermGrant"), st = $("ffPermStatus");
    if (!box || !btn) return; // قشور الاختبار بلا هذه اللوحة
    try {
      if (!isFirefox()) return;
      if (!browser.permissions || typeof browser.permissions.contains !== "function") return;
      browser.permissions.contains({ origins: FF_ORIGINS }).then(function (granted) {
        if (!granted) box.classList.remove("hidden");
      }).catch(function () {});
      btn.addEventListener("click", function () {
        // request داخل معالج النقر مباشرةً: فايرفوكس يشترط إيماءةَ مستخدم حية،
        // وأيُّ خطوة غير متزامنة قبله تُفقده الإيماءة فيُرفض الطلب بلا حوار أصلًا
        try {
          browser.permissions.request({ origins: FF_ORIGINS }).then(function () {
            // لا نصدّق قيمة request وحدها بل نعيد السؤال — هي مصدر الحقيقة الواحد
            return browser.permissions.contains({ origins: FF_ORIGINS });
          }).then(function (granted) {
            if (!st) return;
            st.classList.remove("hidden");
            if (granted) {
              box.classList.add("hidden");
              // نصٌّ باقٍ لا وامض: التعليمة التالية (تحديث التبويبات) يجب ألا تختفي
              // قبل أن تُقرأ — فالإذن وحده لا يُحيي سكربتات التبويبات المفتوحة من قبل
              st.textContent = "مُنح الإذن ✓ — حدّث الآن تبويبات claude.ai المفتوحة (Ctrl+Shift+R) لتظهر الواجهة بالعربية.";
            } else {
              flash(st, "لم يُمنح الإذن — اضغط الزر ثم اختر «السماح» في حوار فايرفوكس.");
            }
          }).catch(function () {});
        } catch (e) {}
      });
    } catch (e) {}
  }

  // ---------- reset ----------
  // «إعادة الضبط» محليةٌ بالعقد (RESET_KEYS مفاتيح local لا غير)، وكان نصُّها يَعِد بعودة
  // كل شيء إلى حالته الأولى بلا رجعة — وهو أوسع من فعلها: المرفوع يبقى في حساب جوجل
  // ويعود كاملًا بمجرّد إعادة تفعيل المزامنة. فصار النصّان يقولان ما يقع في كل حال،
  // وصار للمستخدم خيارٌ صريح يوسّعها إلى الطرف البعيد بمسار المسح نفسه.
  function resetAll() {
    var also = !!($("resetWipeSync") && $("resetWipeSync").checked);
    var msg = also
      ? "سيُحذف من هذا الجهاز كل إعداداتك وتصحيحاتك وقواعدك الذكية ونتيجة الفحص،\n" +
        "ويُمحى أيضًا ما رُفع إلى مساحة مزامنة حسابك في جوجل.\n\n" +
        "يُمحى المرفوع أولًا؛ فإن تعذّر لم يُحذف من جهازك شيء.\n" +
        "ونسخُ أجهزتك الأخرى المحلية لا تُمسّ.\n\nلا يمكن التراجع. أتتابع؟"
      : "سيُحذف من هذا الجهاز وحده كل إعداداتك وتصحيحاتك وقواعدك الذكية ونتيجة الفحص.\n\n" +
        "وما رُفع سابقًا إلى مساحة مزامنة حسابك في جوجل يبقى هناك كما هو،\n" +
        "ويعود إلى هذا الجهاز كاملًا متى أعدتَ تفعيل المزامنة.\n" +
        "ولمحوه معه: ألغِ هذه الرسالة، وعلّم «وامسح أيضًا ما رُفع إلى حسابك في جوجل».\n\n" +
        "لا يمكن التراجع. أتتابع؟";
    if (!confirm(msg)) return;
    function local(extra) {
      chrome.storage.local.remove(KEYS, function () {
        flash($("dangerStatus"), "أُعيد الضبط." + (extra || ""));
        loadState();
      });
    }
    if (!also) {
      local(" وما رُفع إلى حسابك باقٍ هناك — امسحه بزرّ «مسح ما رُفع من حسابك» في قسم المزامنة.");
      return;
    }
    // البعيد أولًا: لو حُذف المحلي أوّلًا ثم أخفق المسح، ضاع علمُ المزامنة والدفاتر
    // وبقي المرفوع بلا ما يدلّ عليه — فالإخفاق هنا يوقف كل شيء ولا يحذف من الجهاز شيئًا
    wipeRemote(function (res) {
      if (res.error) {
        flash($("dangerStatus"), "لم تُعَد الضبط ولم يُحذف من جهازك شيء: تعذّر مسح ما رُفع (" +
          res.error + "). أعد المحاولة، أو أزل العلامة لتقتصر على إعادة الضبط المحلية.");
        return;
      }
      local(res.empty ? " ولم يكن في حسابك شيء مرفوع." : " ومُحي ما رُفع إلى حسابك ✓");
    });
  }

  // ---------- load & wire ----------
  function loadState() {
    get(["cml_enabled", "cml_rtl", "cml_chatrtl"], function (s) {
      $("enabled").checked = s.cml_enabled !== false;
      if ($("rtl")) $("rtl").checked = s.cml_rtl !== false;
      if ($("chatrtl")) $("chatrtl").checked = s.cml_chatrtl !== false;
      renderTerms();
    });
    get(["cml_scan_result"], function (s) { renderScan(s.cml_scan_result); });
    get([CMLConst.K.RTLDOC_RESULT], function (s) { renderRtlDoc(s[CMLConst.K.RTLDOC_RESULT]); });
    renderRtlLive();
    if ($("rtlLiveRebuild")) $("rtlLiveRebuild").addEventListener("click", function () {
      // محوُ الورقة المخزَّنة يكفي: أولُ تبويب claude.ai يُعيد بناءها من ملفات الموقع الحاضرة
      var w = {}; w[CMLConst.K.RTL_LIVE] = null;
      chrome.storage.local.remove(CMLConst.K.RTL_LIVE, function () {
        void chrome.runtime.lastError;
        renderRtlLive();
        flash($("rtlEngineStatus"), "سيُعاد ضبط الاتجاه من الموقع عند أول فتحٍ أو تحديثٍ لتبويب claude.ai.");
      });
    });
    loadRtlEngine();
    renderRecon();   // مراجعة ما بعد التحديث: تظهر وحدها متى كان ثمة ما يُراجَع
    renderSync();    // قسم المزامنة الاختيارية: حالته من cml_sync_enabled/cml_sync_state
  }

  function wire() {
    $("enabled").addEventListener("change", function () { set({ cml_enabled: $("enabled").checked }); });
    if ($("rtl")) $("rtl").addEventListener("change", function () { set({ cml_rtl: $("rtl").checked }); });
    if ($("chatrtl")) $("chatrtl").addEventListener("change", function () { set({ cml_chatrtl: $("chatrtl").checked }); });

    $("addTerm").addEventListener("click", addTerm);
    $("termSearch").addEventListener("input", renderTerms);
    $("exportOv").addEventListener("click", exportMyTerms);
    if ($("reconDropSame")) $("reconDropSame").addEventListener("click", reconDropSame);
    if ($("reconShowDiff")) $("reconShowDiff").addEventListener("click", function () {
      $("termFilter").value = "diverged";
      renderTerms();
      $("termsList").scrollIntoView({ block: "nearest" });
    });
    if ($("reconDismiss")) $("reconDismiss").addEventListener("click", function () {
      // نحفظ بصمة الحصيلة لا علمًا مجرّدًا: فإن تغيّرت بعد تحديثٍ لاحق ظهرت اللوحة ثانيةً
      get(["cml_overrides"], function (s) {
        var r = reconcile((s.cml_overrides || {})[LANG] || {});
        set({ cml_recon_dismissed: r.same.length + ":" + r.diff.length }, function () { renderRecon(); });
      });
    });
    if ($("exportSrcBare")) $("exportSrcBare").addEventListener("click", function () { exportSource(true); });
    if ($("exportSrcFull")) $("exportSrcFull").addEventListener("click", function () { exportSource(false); });
    // زرّ استيراد واحد (scanImportBtn أدناه) يقبل ملفات الترجمة والنسخ الاحتياطية معًا —
    // أُزيل الزرّ المكرر بقرار المشروع 2026-08-16
    if ($("termFilter")) $("termFilter").addEventListener("change", renderTerms);
    $("clearAllOv").addEventListener("click", function () {
      if (!confirm("حذف كل تصحيحاتك وقواعدك الذكية؟ لا يمكن التراجع.")) return;
      set({ cml_overrides: {}, cml_user_patterns: [] }, function () { renderTerms(); flash($("termsStatus"), "حُذفت."); });
    });

    $("startScan").addEventListener("click", startScan);
    $("cancelScan").addEventListener("click", stopScan);

    // قسم الاتجاه (RTL): الحُرّاس على سنّة $("rtl") أعلاه — قشور الاختبار بلا هذا القسم
    if ($("rtlEngineV2")) {
      $("rtlEngineV2").addEventListener("change", function () { if ($("rtlEngineV2").checked) setRtlEngine("v2"); });
      $("rtlEngineV1").addEventListener("change", function () { if ($("rtlEngineV1").checked) setRtlEngine("v1"); });
    }
    if ($("startRtlDoc")) $("startRtlDoc").addEventListener("click", startRtlDoc);
    if ($("rtlDocExport")) $("rtlDocExport").addEventListener("click", exportRtlDoc);

    // قسم المزامنة الاختيارية — الحُرّاس كسائر الأقسام: قشور الاختبار بلا هذا القسم
    if ($("syncEnableBtn")) $("syncEnableBtn").addEventListener("click", function () {
      var c = $("syncConsent"); if (c) c.classList.remove("hidden");
    });
    if ($("syncCancel")) $("syncCancel").addEventListener("click", function () {
      var c = $("syncConsent"); if (c) c.classList.add("hidden");
    });
    if ($("syncConfirm")) $("syncConfirm").addEventListener("click", syncConfirm);
    if ($("syncDisableBtn")) $("syncDisableBtn").addEventListener("click", syncDisable);
    if ($("syncWipeBtn")) $("syncWipeBtn").addEventListener("click", syncWipe);

    $("scanExport").addEventListener("click", exportScan);
    $("scanImportBtn").addEventListener("click", function () { $("importTransFile").click(); });
    $("importTransFile").addEventListener("change", function (e) {
      if (e.target.files && e.target.files[0]) importTermsFile(e.target.files[0], $("scanStatus"));
      e.target.value = "";
    });

    // تحديث حي: أي تغيير في التخزين (من المحرك أو النافذة المنبثقة أو تبويب آخر)
    // ينعكس هنا فورًا — فلا ترى قائمة قديمة بعد تنظيف أو استيراد جرى في مكان آخر.
    // حارس التركيز: لا نعيد بناء قائمة والمستخدم يكتب داخلها (إعادة البناء تُفقده ما يكتب) —
    // نؤجل الرسم إلى خروج التركيز من القائمة.
    var pendingRender = {};
    function focusInside(id) {
      var el = document.activeElement;
      return !!(el && el.closest && el.closest("#" + id));
    }
    function renderOrDefer(id, fn) {
      if (focusInside(id)) { pendingRender[id] = fn; return; }
      fn();
    }
    document.addEventListener("focusout", function () {
      setTimeout(function () {
        Object.keys(pendingRender).forEach(function (id) {
          if (!focusInside(id)) { var fn = pendingRender[id]; delete pendingRender[id]; fn(); }
        });
      }, 50); // بعد انتقال التركيز الفعلي
    });
    try {
      chrome.storage.onChanged.addListener(function (ch, area) {
        // مساحةُ المزامنة خاصةٌ بهذه الإضافة وحدها، فكلُّ تغيّر فيها تغيّرٌ في مفاتيحنا:
        // دفعةُ جهازٍ آخر، أو مسحٌ جرى هناك ⇒ يتبعه حالُ زرّ المسح وسطرُه هنا فورًا
        if (area === "sync") { renderSync(); return; }
        if (area !== "local") return;
        if (ch.cml_overrides) renderOrDefer("termsList", renderTerms);
        if (ch.cml_scan_result) renderScan(ch.cml_scan_result.newValue);
        if (ch[CMLConst.K.RTLDOC_RESULT]) renderRtlDoc(ch[CMLConst.K.RTLDOC_RESULT].newValue);
        if (ch[CMLConst.K.RTL_LIVE]) renderRtlLive();
        // بدّلته نافذة منبثقة أو «إعادة الضبط» ⇒ ينعكس اختيار المحرّك هنا فورًا
        if (ch[CMLConst.K.RTL_ENGINE]) loadRtlEngine();
        // المزامنة: علمُ التفعيل أو حالُ الدفعة كتبهما العامل (أو «إعادة الضبط») ⇒ عرض حيّ
        if (ch[CMLConst.K.SYNC_ENABLED] || ch[CMLConst.K.SYNC_STATE]) renderSync();
      });
    } catch (e) {}

    $("resetAll").addEventListener("click", resetAll);
  }

  fillAbout(); wire(); loadState(); initFfPermBox();
})();
