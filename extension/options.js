/* options.js — settings page for تعريب كلود للويب (Arabic-only).
   Wires the UI to chrome.storage.local. No network.
   Keys: cml_enabled, cml_rtl, cml_chatrtl, cml_overrides, cml_user_patterns,
         cml_scan_request, cml_scan_result, cml_scan_cancel, cml_scan_claim. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var LANG = "ar"; // Arabic-only build
  var KEYS = CMLConst.RESET_KEYS;

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
  function flash(el, msg) {
    if (!el) return;
    el.textContent = msg;
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
    var acts = document.createElement("div"); acts.className = "acts";

    if (opts.missing) inp.placeholder = "اكتب الترجمة…";

    var save = document.createElement("button"); save.textContent = opts.missing ? "ترجم" : "حفظ";
    save.addEventListener("click", function () {
      get(["cml_overrides", "cml_user_patterns", "cml_scan_result"], function (s2) {
        var o = s2.cml_overrides || {}; o[LANG] = o[LANG] || {};
        var v = (inp.value || "").trim();
        if (!v) { flash($("termsStatus"), "اكتب الترجمة أولًا."); return; }
        var patch = { cml_overrides: o };

        if (/\{[A-Za-z_$][\w$]*\}/.test(en)) {
          // نصّ بمتغيّرات: يُحفظ قاعدةً ذكية لا مطابقةً حرفية — الحرفية لن تصادف النص المعروض أبدًا
          var p = makePattern(en, v);
          if (!p) { flash($("termsStatus"), "لا تصلح قاعدةً آمنة: انسخ كل {متغيّر} كما هو وأبقِ نصًّا ثابتًا كافيًا."); return; }
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
            flash($("termsStatus"), BASE[en] !== undefined ? "استُعيد نصّ القاموس." : "حُذفت");
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
        "• <b>" + r.same.length + "</b> مطابقة لنصّ القاموس حرفًا بحرف — لا أثر لها، وحذفُها ينظّف قائمتك ويجعلك ترى أي تحسين لاحق في القاموس.<br>" +
        "• <b>" + r.diff.length + "</b> تختلف عن القاموس — <b>هذه ترجمتك أنت وهي الظاهرة</b>. راجعها إن شئت، وأبقِ ما تفضّله.<br>" +
        "• <b>" + r.only.length + "</b> ليست في القاموس أصلًا — ترجمتك وحدها، ولا يمسّها شيء.";
      $("reconDropSame").disabled = !r.same.length;
      $("reconDropSame").textContent = r.same.length ? "احذف المطابقة (" + r.same.length + ")" : "لا مطابقة";
      $("reconShowDiff").disabled = !r.diff.length;
    });
  }

  function reconDropSame() {
    get(["cml_overrides"], function (s) {
      var o = s.cml_overrides || {}, ov = o[LANG] || {};
      var r = reconcile(ov);
      if (!r.same.length) return;
      if (!confirm("سيُحذف " + r.same.length + " تصحيحًا **مطابقًا** لنصّ القاموس حرفًا بحرف.\n\n" +
        "لن يتغيّر شيء فيما تراه على الشاشة — القاموس يعطي النصّ نفسه.\n" +
        "والفائدة أن ترى أي تحسين لاحق في هذه المفردات.\n\nأتتابع؟")) return;
      r.same.forEach(function (k) { delete ov[k]; });
      o[LANG] = ov;
      set({ cml_overrides: o }, function (err) {
        if (err) { flash($("termsStatus"), "تعذّر الحفظ."); return; }
        renderTerms(); renderRecon();
        flash($("termsStatus"), "حُذف " + r.same.length + " تصحيحًا مطابقًا ✓ (ما تراه على الشاشة لم يتغيّر)");
      });
    });
  }

  function renderTerms() {
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
            : "لم يُجرَ فحص بعد. شغّله من «تحديث المصدر — فحص الموقع» أدناه.");
        } else if (filter === "dict") {
          empty(searching ? "لا نتائج مطابقة في قاموس الإضافة." : "اكتب حرفين على الأقل للبحث في قاموس الإضافة.");
        } else if (filter === "mine") {
          empty(q ? "لا تصحيحات مطابقة." : "لا تصحيحات بعد. عدّل أي ترجمة من القاموس فيُحفظ تعديلك هنا.");
        } else {
          empty(q
            ? (searching ? "لا نتائج مطابقة." : "اكتب حرفين على الأقل للبحث في القاموس.")
            : "ابحث أعلاه لتجد أي مفردة وتعدّلها، أو اختر تصفيةً لتصفّح مصدرًا بعينه.");
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
        if (missTrunc) more("وهناك " + missTrunc + " نصًّا آخر — ضيّق البحث، أو ترجمها دفعةً بأزرار «تنزيل أمر الترجمة» ثم «استيراد الترجمات» أدناه.");
      }
      if (hits.length) {
        group(list, "قاموس الإضافة (" + hits.length + (truncated ? " من " + (hits.length + truncated) : "") + ")");
        hits.forEach(function (k) { list.appendChild(termRow(k, BASE[k], { mine: false, tag: "القاموس" })); });
        if (truncated) more("وهناك " + truncated + " نتيجة أخرى — ضيّق البحث لتراها.");
      }
      if (filter === "all" && !searching && q.length === 1) {
        more("اكتب حرفين على الأقل للبحث في قاموس الإضافة.");
      }
    });
  }

  function addTerm() {
    var a = ($("newSrc").value || "").trim(), b = ($("newDst").value || "").trim();
    if (!a || !b) { flash($("termsStatus"), "اكتب الكلمتين."); return; }
    get(["cml_overrides"], function (s) {
      var o = s.cml_overrides || {}; o[LANG] = o[LANG] || {}; o[LANG][a] = b;
      set({ cml_overrides: o }, function () { $("newSrc").value = ""; $("newDst").value = ""; renderTerms(); flash($("termsStatus"), "أُضيفت ✓"); });
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

      flash($("termsStatus"), "صُدِّر " + arr.length.toLocaleString("ar") + " نصًّا" +
        (untranslated ? " (منها " + untranslated.toLocaleString("ar") + " غير مترجَم من الفحص)" : "") + " ✓");
    });
  }

  // parse a terms/translation file into {en:ar} pairs (accepts several shapes)
  function parsePairs(obj) {
    var out = {};
    var arr = null;
    if (Array.isArray(obj)) arr = obj;
    else if (obj && Array.isArray(obj.terms)) arr = obj.terms;
    // اشتراط النصّية هنا كما في بقية الفروع: بدونه تُكتب كائنات ومصفوفات في القاموس
    // فيحاول المحرّك أن يضعها في الصفحة فتظهر «[object Object]» مكان الترجمة.
    else if (obj && obj.data && obj.data.cml_overrides) { var o = obj.data.cml_overrides[LANG] || obj.data.cml_overrides.ar || {}; Object.keys(o).forEach(function (k) { if (typeof o[k] === "string") out[k] = o[k]; }); return out; }
    else if (obj && typeof obj === "object") { Object.keys(obj).forEach(function (k) { if (typeof obj[k] === "string") out[k] = obj[k]; }); return out; }
    if (arr) arr.forEach(function (p) { if (p && typeof p.en === "string" && typeof p.ar === "string") out[p.en] = p.ar; });
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
      flash(statusEl, "الملف أكبر من اللازم (" + Math.round(file.size / 1048576) + " ميغابايت). الحدّ 5 ميغابايت.");
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
      var msg = "سيُستورد " + keys.length + " سطرًا.\n\nأول خمسة:\n" + sample +
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
            if (haveTerms >= IMPORT_MAX_TERMS) { nCapped++; return; }
            if (o[LANG][k] === undefined) haveTerms++;
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
          var msg = "تم استيراد " + (nPlain + nPat) + " ✓";
          if (nPat) msg += " (منها " + nPat + " قاعدة ذكية)";
          if (nSkip) msg += " — تُجووزت " + nSkip + " لعدم صلاحيتها كقاعدة";
          if (nCapped) msg += " — و" + nCapped + " تجاوزت الحدّ الأقصى فلم تُستورد";
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
          "### نصوص فيها متغيّرات (" + varKeys.length + " سطرًا)",
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
      "   macOS، Linux، iOS، Android، وأسماء الملفات والمسارات والأكواد.",
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
      "### نصوص ثابتة (" + keys.length + " سطرًا)",
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
    var dictN = BASE_KEYS.length.toLocaleString("ar");
    if (r && r.status === "done" && r.found > 0) {
      var miss = r.missing || 0;
      var pctU = Math.min(100, Math.round(miss / r.found * 100));
      var pctT = 100 - pctU;
      dT.setAttribute("stroke-dasharray", (pctT / 100 * DONUT_C).toFixed(1) + " " + DONUT_C);
      dU.setAttribute("stroke-dasharray", (pctU / 100 * DONUT_C).toFixed(1) + " " + DONUT_C);
      pT.textContent = pctT + "٪"; pU.textContent = pctU + "٪";
      line.innerHTML = "قاموس الإضافة: <b>" + dictN + "</b> ترجمة · آخر فحص وجد <b>" +
        r.found.toLocaleString("ar") + "</b> نصًّا في الموقع، غيرُ المترجَم منها <b>" + miss.toLocaleString("ar") + "</b>." +
        (miss
          ? " <b>لترجمتها:</b> «تنزيل أمر الترجمة» ثم «استيراد الترجمات» أدناه، أو اختر «غير المترجَم» في التصفية."
          : " المصدر مطابق لآخر فحص ✓");
    } else {
      dT.setAttribute("stroke-dasharray", "0 " + DONUT_C);
      dU.setAttribute("stroke-dasharray", "0 " + DONUT_C);
      pT.textContent = "؟"; pU.textContent = "؟";
      line.innerHTML = "قاموس الإضافة: <b>" + dictN + "</b> ترجمة. لقياس نسبة التغطية وجلب غير المترجَم، شغّل «تحديث المصدر — فحص الموقع» أدناه.";
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
        st.textContent = "توقّف بعد قراءة " + (r.fetched || 0) + " ملفًا — غالبًا أُغلق تبويب claude.ai أو أُعيد تحميل الإضافة. افتح claude.ai وحدّث الصفحة ثم أعد الفحص.";
        $("cancelScan").classList.add("hidden");
        $("startScan").disabled = false;
        if (scanTimer) { clearInterval(scanTimer); scanTimer = null; }
        return;
      }
      cnt.textContent = "جارٍ الفحص…";
      var done = r.fetched || 0, left = r.queued || 0;
      var pct = done + left > 0 ? Math.min(99, Math.round((done / (done + left)) * 100)) : 0;
      st.textContent = "التقدّم نحو " + pct + "٪ — قرأ " + done + " ملفًا، ووجد " + (r.found || 0) + " نصًّا…";
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
        ? "أُوقف بعد قراءة " + (r.fetched || 0) + " ملفًا. اضغط «ابدأ الفحص» للإعادة."
        : (r.error || "حدث خطأ.");
      $("startScan").disabled = false;
      if (scanTimer) { clearInterval(scanTimer); scanTimer = null; }
      return;
    }
    // done
    if (scanTimer) { clearInterval(scanTimer); scanTimer = null; }
    $("startScan").disabled = false;
    $("startScan").textContent = "أعد الفحص";
    var nPlain = (r.list || []).length, nVars = (r.varList || []).length;
    cnt.textContent = r.missing ? (r.missing + " نصًّا غير مترجم") : "كل شيء مترجَم ✓";
    // لا تدهس رسالة flash نشطة (تأكيد استيراد مثلًا) — الملخص يبقى متاحًا في العدّاد
    if (!st.dataset.flashing) {
      var msg = "فُحص " + (r.fetched || 0) + " ملفًا و" + (r.found || 0) + " نصًّا في " + (r.seconds || 0) + " ثانية.";
      if (nVars) msg += " منها " + nVars + " نصًّا متغيّرًا يصير قواعد ذكية.";
      if (r.capped) msg += " (عُرض أول 4000 نصّ)";
      // إخفاق الجلب يعني نتيجةً ناقصة — والسكوت عنه يجعل «تمّ» يبدو اكتمالًا وليس به
      if (r.failed) msg += " ⚠ تعذّر جلب " + r.failed + " ملفًا، فالنتيجة ناقصة — أعد الفحص.";
      msg += r.missing
        ? " غيرُ المترجَم في «قاموس التعريب» أعلاه — النِّسَب والقائمة وأدوات الترجمة."
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
          "لم يستجب أي تبويب. الأرجح أن تبويب claude.ai مفتوح منذ ما قبل تحديث الإضافة، فسكربتها فيه منفصل. " +
          "<b>الحل:</b> افتح تبويب claude.ai واضغط <b>Ctrl+Shift+R</b> (تحديث كامل) وانتظر اكتمال تحميل الصفحة، ثم عُد هنا واضغط «ابدأ الفحص». " +
          "وإن لم يكن التبويب مفتوحًا أصلًا فافتحه أولًا.";
      }
    });
  }
  function startScan() {
    // لا نمسح حجزًا حيًّا: مسحُه يُسقط زاحفًا يعمل الآن ويسمح بزاحفٍ ثانٍ يوازيه.
    // الحجز الأقدم من 90 ثانية متروك (نفس عتبة claimScan في المحرّك) فيُمسح.
    get(["cml_scan_claim"], function (s) {
      var c = s.cml_scan_claim;
      if (c && c.id && c.at && Date.now() - c.at < CMLConst.CLAIM_STALE_MS) {
        $("scanStatus").textContent = "يوجد فحص جارٍ بالفعل في تبويب آخر — انتظر انتهاءه أو أوقفه.";
        $("cancelScan").classList.remove("hidden");
        if (!scanTimer) { scanWaited = 0; scanTimer = setInterval(pollScan, 1000); }
        return;
      }
      $("startScan").disabled = true;
      $("cancelScan").classList.remove("hidden");
      $("scanStatus").textContent = "أُرسل الطلب… تأكد أن تبويب claude.ai مفتوح.";
      set({ cml_scan_result: null, cml_scan_cancel: null, cml_scan_claim: null, cml_scan_request: Date.now() });
      scanWaited = 0;
      if (scanTimer) clearInterval(scanTimer);
      scanTimer = setInterval(pollScan, 1000);
    });
  }

  function stopScan() {
    set({ cml_scan_cancel: Date.now() });
    $("scanStatus").textContent = "يجري الإيقاف…";
    // مخرج مضمون: لو لم يكن ثمة زاحفٌ حيّ يستجيب (أُغلق تبويبه) بقيت الصفحة عالقة على
    // «يجري الإيقاف…» بلا نهاية. فبعد ثانيتين ننظّف الحالة بأنفسنا ونحرّر الحجز.
    setTimeout(function () {
      get(["cml_scan_result"], function (s) {
        var r = s.cml_scan_result;
        if (r && r.status !== "running") return;      // استجاب الزاحف فعلًا
        set({ cml_scan_result: null, cml_scan_claim: null }, function () {
          if (scanTimer) { clearInterval(scanTimer); scanTimer = null; }
          $("startScan").disabled = false;
          $("cancelScan").classList.add("hidden");
          $("scanCount").textContent = "لم يُجرَ فحص بعد";
          $("scanStatus").textContent = "أُوقف الفحص. اضغط «ابدأ الفحص» متى شئت.";
        });
      });
    }, 2000);
  }

  function exportScan() {
    get(["cml_scan_result"], function (s) {
      var r = s.cml_scan_result;
      var plain = (r && r.list) || [], vars = (r && r.varList) || [];
      if (!plain.length && !vars.length) { flash($("scanStatus"), "لا توجد نصوص للتصدير."); return; }
      download("أمر-ترجمة-كلود-جديد.txt", buildPrompt(plain, vars), "text/plain;charset=utf-8");
      flash($("scanStatus"), "نُزّل الملف (" + (plain.length + vars.length) + " نصًّا) وفيه الأمر كاملًا — الصقه في claude.ai.");
    });
  }

  // ---------- reset ----------
  function resetAll() {
    if (!confirm("إعادة ضبط كل الإعدادات وحذف كلماتك المحفوظة؟ لا يمكن التراجع.")) return;
    chrome.storage.local.remove(KEYS, function () { flash($("dangerStatus"), "أُعيد الضبط."); loadState(); });
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
    renderRecon();   // مراجعة ما بعد التحديث: تظهر وحدها متى كان ثمة ما يُراجَع
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
    // أُزيل الزرّ المكرر بقرار المالك 2026-08-16
    if ($("termFilter")) $("termFilter").addEventListener("change", renderTerms);
    $("clearAllOv").addEventListener("click", function () {
      if (!confirm("حذف كل كلماتك المحفوظة (والقواعد الذكية المستوردة)؟")) return;
      set({ cml_overrides: {}, cml_user_patterns: [] }, function () { renderTerms(); flash($("termsStatus"), "حُذفت."); });
    });

    $("startScan").addEventListener("click", startScan);
    $("cancelScan").addEventListener("click", stopScan);
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
        if (area !== "local") return;
        if (ch.cml_overrides) renderOrDefer("termsList", renderTerms);
        if (ch.cml_scan_result) renderScan(ch.cml_scan_result.newValue);
      });
    } catch (e) {}

    $("resetAll").addEventListener("click", resetAll);
  }

  fillAbout(); wire(); loadState();
})();
