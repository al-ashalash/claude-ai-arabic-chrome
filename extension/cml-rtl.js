/* cml-rtl.js — محرّك الاتجاه الجذري: النسخة الواحدة من تحليل CSS وقلبه منطقيًّا
 * (المرحلة ٣ من خطة الإطلاق).
 *
 * يستهلكه ثلاثة: مولّد rtl-overrides.css في Node (code/toolchain/gen-rtl.mjs)،
 * و«طبيب الاتجاه» في المتصفح (engine.js — يكشف ما استجدّ في CSS الموقع ولا تغطيه
 * ملفاتنا)، وصفحة الاختبار _rtltest.html. تعريف «الفيزيائي» وكيف يُقلب يجب أن يكون
 * واحدًا عند الثلاثة وإلا أبلغ الطبيبُ هراءً — فهو هنا مرة واحدة (درس cml-shared).
 *
 * المبدأ (قرار الخطة): نقلب **الأصناف لا المحسوب**. المواضع التي تحسبها جافاسكربت
 * تُكتب أنماطًا سطرية (inline) فلا تُمسّ إطلاقًا — لا !important فوقها ولا قراءة لها.
 *
 * طريقة القلب: **الخصائص المنطقية** لا القلب الفيزيائي الأعمى. `margin-left` تصير
 * `margin-inline-start` — فتنقلب في RTL من تلقاء نفسها، وتبقى في مكانها داخل جزر
 * LTR (pre/code/[data-cml-noflip] التي نضبط direction:ltr عليها) وداخل فقرات
 * dir=auto الإنجليزية: الصواب يَنبثق من حوسبة المتصفح نفسها لا من حالات خاصة عندنا.
 *
 * سلّم التخصيص الموحّد (جوهر صحة التعاقب — صيغته الثانية بعد دحضٍ تجريبي لصيغة
 * «القسمين بالترتيب» الأولى): محدِّد الموقع يُلفّ في ‎:where()‎ فيصفر تخصيصه، ثم
 * يُبنى تخصيصنا سلّمًا بمعرّفات داخل ‎:not()‎ — المصفِّرات (2,1,1) دون المنطقيات
 * والمطابقات (3,1,1) دون معزَّزات قصد المؤلف (4,1,1). فعنصر عليه ‎.ml-2 و.mr-4
 * معًا: مصفِّر كلٍّ يخسر أمام منطقيِّ الآخر بالتخصيص لا بالترتيب — قانونًا بنيويًّا
 * يصمد مهما تفاوت تخصيص محدِّدات الموقع (كان التفاوت يكسر صيغة الترتيب: 130
 * مصفِّرًا حقيقيًّا فوق مستوى الأداة، حتى (0,9,1) في dframe).
 *
 * طبقات التعاقب (@layer): الموقع على Tailwind v4 بطبقات مسماة، والطبقة المتأخرة
 * تغلب المتقدمة بصرف النظر عن التخصيص. مخرجاتنا العادية **بلا طبقات** (فتغلب طبقات
 * الموقع كلها — مطلوب)، والترتيب داخل مستوى السلّم الواحد = (رتبة طبقة الموقع، ثم
 * موضع القاعدة) — ومع توحيد التخصيص صار هذا الترتيب قانونَ الطبقات نفسَه لا
 * تقريبًا له. أما إعلانات ‎!important‎ فقانون الطبقات فيها منقلب (المبكر يغلب)،
 * فتُبثّ في ‎@layer cml-imp‎ تُعلَن أولَ الورقة فتغلب مهمّاتِ الموقع كلَّها —
 * وطبقة ‎cml-point‎ تُعلن قبلها ليبقى لإصلاحات base.css النقطية الكلمةُ الأخيرة.
 *
 * النسخ المطابقة: إعلانات الموقع المتناظرة/المنطقية في العائلات المتنازَعة الخانات
 * تُعاد كما هي في مستوى المنطقيات بمواضعها — وإلا محاها مصفِّرُ قاعدةٍ مجاورة.
 *
 * متغيّرات الإزاحة السينية (‎--tw-translate-x ونحوها): تُقلب **عند التصريح لا عند
 * الاستعمال** بحيلة calc(القيمة * -1) الصالحة لكل طول — ولو قلبنا الموضعين معًا
 * لتعادلا قلبًا مزدوجًا فيعود الأصل. استعمالات translateX بقيم حرفية مباشرة
 * (لا متغيّر فيها) تُقلب في موضعها.
 *
 * ثنائي الاستخدام: لا import/export — سكربت كلاسيكي في المتصفح ووحدة ESM صالحة في
 * Node (التعيين على globalThis يعمل في كليهما).
 */
(function (g) {
  "use strict";

  var GATE = 'html[data-cml-rtl="v2"]';
  var PH = String.fromCharCode(1); // نائب داخلي — لا يرد في CSS سليم

  // ---------- 1) محلّل CSS متدرّج ----------
  // يتحمل: التعليقات، السلاسل بمحارفها المهرَّبة، url() غير المقتبس، أقواس التداخل،
  // @media/@supports/@container (تُحفظ سياقًا)، @layer (يُنزَل فيه وتُحفظ رتبته)،
  // والتداخل الحديث (& يُستبدل بالأب). @keyframes/@font-face/@page/@property/
  // @counter-style تُتخطى كتلًا كاملة — الحركات أرضُ «المحسوب» فلا نمسّها.
  function parseCss(text) {
    var rules = [];        // {sel, decls:[{prop,value,important}], ctx:[..], layer, idx}
    var imports = [];      // روابط @import — يتبعها الطبيب مستوى واحدًا
    var layerOrder = [];   // أسماء الطبقات بترتيب أول ظهور/تصريح
    var layerSeen = {};
    var stats = { parseErrors: 0, skippedAt: 0, animatedPhysical: 0 };
    var i = 0, n = text.length;

    function noteLayer(name) {
      if (name && !layerSeen[name]) { layerSeen[name] = 1; layerOrder.push(name); }
    }
    // يقفز فوق تعليق أو سلسلة أو محرف مهرَّب بدءًا من j؛ يرجع الموضع الجديد أو j نفسه
    function skipOpaque(j) {
      var c = text[j];
      if (c === "/" && text[j + 1] === "*") {
        var e = text.indexOf("*/", j + 2);
        return e === -1 ? n : e + 2;
      }
      if (c === '"' || c === "'") {
        for (var k = j + 1; k < n; k++) {
          if (text[k] === "\\") { k++; continue; }
          if (text[k] === c) return k + 1;
        }
        return n;
      }
      if (c === "\\") return j + 2;
      return j;
    }
    // يجمع نصًّا حتى أول محرف فاصل في عمق أقواس صفر؛ يرجع {chunk, stop, next}.
    // التعليقات تُسقَط إسقاطًا (لا تُلحق) — وإلا التصقت بالمحدِّد الذي يليها.
    function readUntil(j, stopChars) {
      var depth = 0, out = "";
      while (j < n) {
        if (text[j] === "/" && text[j + 1] === "*") {
          var ce = text.indexOf("*/", j + 2);
          j = ce === -1 ? n : ce + 2;
          continue;
        }
        var j2 = skipOpaque(j);
        if (j2 !== j) { out += text.slice(j, j2); j = j2; continue; }
        var c = text[j];
        // قوس إغلاق كتلة داخل عمق أقواس مفتوح = قيمة مكسورة (قوس دائري لم يُغلق).
        // بلا هذا التصفير كان قوسٌ واحد غير متوازن يبتلع بقية الورقة كلها بصمت —
        // فيعمى الطبيب عمًى لا يُبلَّغ عنه. (الفاصلة المنقوطة لا تُصفِّر: شرعية داخل
        // url(data:...;base64) غير المقتبسة.)
        if (c === "}" && depth > 0) { depth = 0; stats.parseErrors++; }
        if (c === "(" || c === "[") depth++;
        else if (c === ")" || c === "]") { if (depth > 0) depth--; }
        else if (depth === 0 && stopChars.indexOf(c) !== -1) return { chunk: out, stop: c, next: j + 1 };
        out += c; j++;
      }
      return { chunk: out, stop: "", next: n };
    }
    // يتخطى كتلة { ... } كاملة (القوس الفاتح استُهلك قبل النداء)
    function skipBlock(j) {
      var depth = 1;
      while (j < n && depth > 0) {
        var j2 = skipOpaque(j);
        if (j2 !== j) { j = j2; continue; }
        if (text[j] === "{") depth++;
        else if (text[j] === "}") depth--;
        j++;
      }
      return j;
    }
    function splitTop(s, sep) {
      var parts = [], depth = 0, cur = "";
      for (var j = 0; j < s.length; j++) {
        var c = s[j];
        if (c === "\\") { cur += c + (s[j + 1] || ""); j++; continue; }
        if (c === '"' || c === "'") {
          var e = j + 1;
          while (e < s.length && s[e] !== c) { if (s[e] === "\\") e++; e++; }
          cur += s.slice(j, e + 1); j = e; continue;
        }
        if (c === "(" || c === "[") depth++;
        else if (c === ")" || c === "]") depth--;
        if (c === sep && depth === 0) { parts.push(cur); cur = ""; }
        else cur += c;
      }
      parts.push(cur);
      return parts;
    }
    function pushDecls(sel, body, ctx, layer) {
      var decls = [];
      var parts = splitTop(body, ";");
      for (var d = 0; d < parts.length; d++) {
        var t = parts[d].trim();
        if (!t) continue;
        var colon = -1, depth = 0;
        for (var j = 0; j < t.length; j++) {
          var c = t[j];
          if (c === "(" || c === "[") depth++;
          else if (c === ")" || c === "]") depth--;
          else if (c === ":" && depth === 0) { colon = j; break; }
        }
        if (colon === -1) { stats.parseErrors++; continue; }
        var prop = t.slice(0, colon).trim();
        var value = t.slice(colon + 1).trim();
        var important = false;
        var im = /!\s*important\s*$/i;
        if (im.test(value)) { important = true; value = value.replace(im, "").trim(); }
        // «متغيّرات التبديل» (‎--x: ;‎ بقيمة فارغة) CSS صالحٌ محايد اتجاهيًّا — تُهمل بصمت
        if (!value && prop.slice(0, 2) === "--") continue;
        if (!prop || !value) { stats.parseErrors++; continue; }
        decls.push({ prop: prop.charAt(0) === "-" ? prop : prop.toLowerCase(), value: value, important: important });
      }
      if (decls.length) {
        rules.push({ sel: sel.replace(/\s+/g, " ").trim(), decls: decls, ctx: ctx, layer: layer, idx: rules.length });
      }
    }
    // محدِّد التداخل: يركَّب على الأب (استبدال & إن وُجد وإلا سليل)
    function nestSel(parentSel, childSel) {
      var parents = splitTop(parentSel, ",");
      var children = splitTop(childSel, ",");
      var out = [];
      for (var p = 0; p < parents.length; p++) {
        for (var c = 0; c < children.length; c++) {
          var ch = children[c].trim(), pa = parents[p].trim();
          out.push(ch.indexOf("&") !== -1 ? ch.split("&").join(pa) : pa + " " + ch);
        }
      }
      return out.join(", ");
    }
    // بادئة @: يرجع {kind:"cond",ctx} أو {kind:"layer",name} أو null (تخطٍّ)
    function classifyAt(prelude) {
      if (/^@(media|supports|container)\b/i.test(prelude)) return { kind: "cond", cond: prelude.replace(/\s+/g, " ") };
      var ml = /^@layer\b\s*([^{]*)$/i.exec(prelude);
      if (ml) return { kind: "layer", name: (ml[1] || "").trim() || "(anonymous)" };
      return null;
    }
    // كتلة قاعدة: خليط إعلانات وقواعد متداخلة. depth: سقف تداخل وقائي — تداخل
    // بآلاف المستويات (مدخل عدائي) كان يفجّر مكدس الاستدعاء؛ فوق السقف تُتخطى الكتلة.
    function parseRuleBody(j, sel, ctx, layer, depth) {
      if (depth > 100) { stats.parseErrors++; return skipBlock(j); }
      var declText = "";
      while (j < n) {
        var r = readUntil(j, "{;}");
        if (r.stop === "{") {
          var prelude = r.chunk.trim();
          // قيمة كتلية لخاصية مخصصة (--x: {...}) — CSS صالح؛ كانت تُقرأ قاعدةً
          // متداخلة وهمية بمحدِّد هراء فيبلغ الطبيب عنها كذبًا. تُتخطى قيمتها كلها.
          if (/^--/.test(prelude)) { j = skipBlock(r.next); continue; }
          if (prelude.charAt(0) === "@") {
            var at = classifyAt(prelude);
            if (at && at.kind === "cond") j = parseRuleBody(r.next, sel, ctx.concat([at.cond]), layer, depth + 1);
            else if (at && at.kind === "layer") { noteLayer(at.name); j = parseRuleBody(r.next, sel, ctx, at.name, depth + 1);
            } else { j = skipAtBlock(prelude, r.next); }
          } else {
            j = parseRuleBody(r.next, nestSel(sel, prelude), ctx, layer, depth + 1);
          }
        } else if (r.stop === ";") {
          declText += r.chunk + ";";
          j = r.next;
        } else { // "}" أو نهاية النص
          declText += r.chunk;
          j = r.next;
          break;
        }
      }
      pushDecls(sel, declText, ctx, layer);
      return j;
    }
    // تخطي كتلة @ غير مدعومة، مع إحصاء الحركات الاتجاهية: @keyframes فيها إزاحات
    // سينية لا نقلبها بقرار (أرض المحسوب) — لكن الصمت عنها يكسر عقد «كل فيزيائيٍّ
    // إمّا مقلوب وإمّا مُصرَّحٌ بعجزه»، فتُعدّ ويُبلّغ الطبيب عددها.
    function skipAtBlock(prelude, j) {
      var start = j;
      var end = skipBlock(j);
      stats.skippedAt++;
      if (/^@(-webkit-)?keyframes/i.test(prelude) &&
          /translatex\s*\(|translate3d\s*\(|translate\s*\(|[^-\w](left|right)\s*:/i.test(text.slice(start, end))) {
        stats.animatedPhysical++;
      }
      return end;
    }
    function parseGroup(j, ctx, layer, depth) {
      // يستهلك محتوى كتلة (أو المستوى الأعلى) حتى قوس إغلاقها
      if (depth > 100) { stats.parseErrors++; return skipBlock(j); }
      while (j < n) {
        var r = readUntil(j, "{;}");
        if (r.stop === "{") {
          var prelude = r.chunk.trim();
          if (!prelude) { j = skipBlock(r.next); continue; }
          if (prelude.charAt(0) === "@") {
            var at = classifyAt(prelude);
            if (at && at.kind === "cond") j = parseGroup(r.next, ctx.concat([at.cond]), layer, depth + 1);
            else if (at && at.kind === "layer") { noteLayer(at.name); j = parseGroup(r.next, ctx, at.name, depth + 1);
            } else { j = skipAtBlock(prelude, r.next); }
          } else {
            j = parseRuleBody(r.next, prelude, ctx, layer, depth + 1);
          }
        } else if (r.stop === ";") {
          var st = r.chunk.trim();
          var mi = /^@import\s+(?:url\(\s*)?["']?([^"')\s]+)/i.exec(st);
          if (mi) imports.push(mi[1]);
          var ls = /^@layer\b\s+([^;{]+)$/i.exec(st);
          if (ls) {
            var names = ls[1].split(",");
            for (var q = 0; q < names.length; q++) noteLayer(names[q].trim());
          }
          j = r.next;
        } else if (r.stop === "}") {
          return r.next; // نهاية الكتلة — ارجع للأب
        } else {
          return n;
        }
      }
      return j;
    }
    var pos = 0;
    while (pos < n) {
      var before = pos;
      pos = parseGroup(pos, [], null, 0); // قوس إغلاق شارد بالمستوى الأعلى يعيدنا هنا فنكمل
      if (pos <= before) break;           // وقاية من الدوران
    }
    return { rules: rules, imports: imports, layerOrder: layerOrder, stats: stats };
  }

  // ---------- 2) جداول القلب ----------
  var SIDE_LOGICAL = {
    "margin-left": "margin-inline-start", "margin-right": "margin-inline-end",
    "padding-left": "padding-inline-start", "padding-right": "padding-inline-end",
    "left": "inset-inline-start", "right": "inset-inline-end",
    "border-left": "border-inline-start", "border-right": "border-inline-end",
    "border-left-width": "border-inline-start-width", "border-right-width": "border-inline-end-width",
    "border-left-style": "border-inline-start-style", "border-right-style": "border-inline-end-style",
    "border-left-color": "border-inline-start-color", "border-right-color": "border-inline-end-color",
    "border-top-left-radius": "border-start-start-radius",
    "border-top-right-radius": "border-start-end-radius",
    "border-bottom-left-radius": "border-end-start-radius",
    "border-bottom-right-radius": "border-end-end-radius",
    "scroll-margin-left": "scroll-margin-inline-start", "scroll-margin-right": "scroll-margin-inline-end",
    "scroll-padding-left": "scroll-padding-inline-start", "scroll-padding-right": "scroll-padding-inline-end",
  };
  // الزوايا لا يكفي فيها المنطقي وحده: الإعلان الفيزيائي الأصلي يبقى فعّالًا على
  // زاويته فتستدير الزاويتان معًا — فلها مُصفِّر كبقية الجوانب (unset = القيمة البدئية).
  var SHORTHAND4 = {
    "margin": ["margin-top", "margin-inline-end", "margin-bottom", "margin-inline-start"],
    "padding": ["padding-top", "padding-inline-end", "padding-bottom", "padding-inline-start"],
    "inset": ["inset-block-start", "inset-inline-end", "inset-block-end", "inset-inline-start"],
    "border-width": ["border-top-width", "border-inline-end-width", "border-bottom-width", "border-inline-start-width"],
    "border-style": ["border-top-style", "border-inline-end-style", "border-bottom-style", "border-inline-start-style"],
    "border-color": ["border-top-color", "border-inline-end-color", "border-bottom-color", "border-inline-start-color"],
    "scroll-margin": ["scroll-margin-top", "scroll-margin-inline-end", "scroll-margin-bottom", "scroll-margin-inline-start"],
    "scroll-padding": ["scroll-padding-top", "scroll-padding-inline-end", "scroll-padding-bottom", "scroll-padding-inline-start"],
  };
  var ALREADY_LOGICAL = /^(margin|padding|inset|border|scroll-margin|scroll-padding)-(inline|block)|^border-(start|end)-(start|end)-radius/;

  function splitVals(v) {
    // قيم مفصولة بمسافات في العمق صفر (calc(...) قطعة واحدة)
    var parts = [], depth = 0, cur = "";
    for (var j = 0; j < v.length; j++) {
      var c = v[j];
      if (c === "(") depth++;
      else if (c === ")") depth--;
      if (depth === 0 && (c === " " || c === "\t")) { if (cur) { parts.push(cur); cur = ""; } }
      else cur += c;
    }
    if (cur) parts.push(cur);
    return parts;
  }
  function expand4(parts) {
    if (parts.length === 1) return [parts[0], parts[0], parts[0], parts[0]];
    if (parts.length === 2) return [parts[0], parts[1], parts[0], parts[1]];
    if (parts.length === 3) return [parts[0], parts[1], parts[2], parts[1]];
    if (parts.length === 4) return parts;
    return null;
  }
  var ZERO_RE = /^-?0(\.0+)?([a-z%]+)?$/i;
  var SIMPLE_LEN_RE = /^-?(\d*\.)?\d+([a-z%]+)?$/i;
  function isZero(v) { return v === "0" || ZERO_RE.test(v); }
  // قلب قيمة سينية: البسيطة بقلب الإشارة، والحسابية بلفّها في calc(v * -1).
  // var() العارية تُستثنى عمدًا: قد تكون «متغيّر تبديل» قيمتُه مسافة (كما في
  // ‎--_prose-noscope بموقعنا) — وcalc(مسافة * -1) يُبطل الإعلان كله عند الحوسبة.
  // استثناء الاستثناء: var(--spacing) وحدة تايلويند v4 المسجّلة طولًا حكمًا —
  // بياضُها مستحيل، فلفُّها آمن (بدونها بقيت ‎.translate-x-1‎ وحدها بلا قلب).
  function flipX(v) {
    if (isZero(v)) return v;
    if (SIMPLE_LEN_RE.test(v)) return v.charAt(0) === "-" ? v.slice(1) : "-" + v;
    if (/^(calc|min|max|clamp)\(/i.test(v) || /^var\(--spacing\)$/i.test(v)) return "calc(" + v + " * -1)";
    return null; // var() عارية أو كلمة مفتاحية أو ما لا نفهمه — لا قلب أعمى
  }
  var XVAR_RE = /translate-x/i; // متغيّرات الإزاحة السينية (تايلويند وأشباهه)
  function flipTransform(value) {
    // يقلب المعامل السيني لـ translateX/translate/translate3d باستخراج أقواس متوازن.
    // معاملٌ يمرّر متغيّر إزاحة سينية يُترك — قلبُ تصريح المتغيّر يغطيه (لا قلب مزدوج).
    var out = "", j = 0, changed = true, touched = false;
    var re = /(translateX|translate3d|translate)\(/gi;
    var m;
    while ((m = re.exec(value))) {
      var start = m.index, open = re.lastIndex; // بعد القوس الفاتح
      var depth = 1, k = open;
      while (k < value.length && depth > 0) {
        if (value[k] === "(") depth++;
        else if (value[k] === ")") depth--;
        k++;
      }
      if (depth !== 0) return null; // أقواس مكسورة
      var inner = value.slice(open, k - 1);
      var args = splitTop2(inner, ",");
      var x = args[0].trim();
      var fx;
      if (XVAR_RE.test(x)) fx = x;          // متغيّر إزاحة — قلبه عند تصريحه
      else {
        fx = flipX(x);
        if (fx === null) return null;       // معامل لا نفهمه ⇒ لا نمسّ التحويل كله
        if (fx !== x) touched = true;
      }
      args[0] = fx;
      out += value.slice(j, start) + m[1] + "(" + args.join(",") + ")";
      j = k;
      re.lastIndex = k;
    }
    if (j === 0) return null;   // لا translate فيه
    out += value.slice(j);
    // قلبُ الإزاحة وحدها في سلسلة فيها دوران/إمالة يعطي شكلًا ليس الأصلَ ولا مرآتَه
    // (الدوران غير التبديلي) — حالة sheet-card-under الحقيقية. نمتنع فيُصرّح الطبيب.
    if (touched && /rotate|skew/i.test(value)) return null;
    return touched ? out : PH;  // PH = فيه translate لكن عبر متغيّرات فقط (مغطًّى)
    function splitTop2(s, sep) {
      var parts = [], depth = 0, cur = "";
      for (var q = 0; q < s.length; q++) {
        var c = s[q];
        if (c === "(") depth++;
        else if (c === ")") depth--;
        if (c === sep && depth === 0) { parts.push(cur); cur = ""; }
        else cur += c;
      }
      parts.push(cur);
      return parts;
    }
  }
  function splitTopComma(v) {
    // فصل على الفواصل في العمق صفر (فواصل rgba() وvar() محمية)
    var parts = [], depth = 0, cur = "";
    for (var j = 0; j < v.length; j++) {
      var c = v[j];
      if (c === "(") depth++;
      else if (c === ")") depth--;
      if (c === "," && depth === 0) { parts.push(cur); cur = ""; }
      else cur += c;
    }
    parts.push(cur);
    return parts;
  }
  function maskCalls(value, name, store) {
    // يحجب نداءات دالة (بأقواس متوازنة — فواصل var() الاحتياطية قد تحوي أقواسًا)
    var out = "", j = 0;
    var re = new RegExp(name + "\\(", "gi");
    var m;
    while ((m = re.exec(value))) {
      var k = re.lastIndex, depth = 1;
      while (k < value.length && depth > 0) {
        if (value[k] === "(") depth++;
        else if (value[k] === ")") depth--;
        k++;
      }
      store.push(value.slice(m.index, k));
      out += value.slice(j, m.index) + PH + (store.length - 1) + PH;
      j = k;
      re.lastIndex = k;
    }
    return out + value.slice(j);
  }
  function swapWords(value) {
    // left↔right ككلمات كاملة — للخلفيات والتدرجات ومواضع الأصل. url() وvar()
    // تُحجبان أولًا: كلمة left داخل اسم متغيّر (var(--edge-left)) ليست اتجاهًا،
    // وقلبُها ينتج مرجعًا لمتغيّر لا وجود له فيُبطل الإعلان كله.
    var masked = [];
    var t = maskCalls(maskCalls(value, "url", masked), "var", masked);
    var swapped = t.replace(/\bleft\b|\bright\b/gi, function (w) {
      return w.toLowerCase() === "left" ? "right" : "left";
    });
    if (swapped === t) return null;
    return swapped.replace(new RegExp(PH + "(\\d+)" + PH, "g"), function (_, k) { return masked[+k]; });
  }
  function shadowHasX(value) {
    // ظلّ بإزاحة أفقية غير صفرية؟ لكل ظلّ (فواصل العمق صفر): أول طولٍ هو x
    var shadows = splitTopComma(value);
    for (var s = 0; s < shadows.length; s++) {
      var toks = splitVals(shadows[s].trim());
      for (var t = 0; t < toks.length; t++) {
        if (SIMPLE_LEN_RE.test(toks[t])) {
          if (!isZero(toks[t])) return true;
          break; // x صفر — انتقل للظل التالي
        }
      }
    }
    return false;
  }

  /* تحليل إعلان واحد. يرجع أحد:
   *  {kind:"flip", flips:[{prop,value}...], neutral:[{prop,value}...]}  — يُقلب
   *  {kind:"physical-unflippable", reason}  — فيزيائي لكن لا نقلبه (يُصرّح به الطبيب)
   *  {kind:"logical"}   — منطقي/واعٍ بالاتجاه أصلًا (يُحصى بِشارةَ صحةٍ للموقع)
   *  null               — لا علاقة له بالاتجاه
   * تعريف «الفيزيائي» عند الطبيب = kind يبدأ بـ flip أو physical. */
  function analyzeDecl(prop, value) {
    var v = value;
    if (prop.charAt(0) === "-" && prop.charAt(1) === "-") {
      // خصائص مخصصة: لا نقلب إلا متغيّر الإزاحة السينية (تايلويند يمرّر كل إزاحات
      // translate عبره — قلبُ التصريح يقلبها جميعًا، والسطريّ المحسوب لا يمرّ به أصلًا)
      if (XVAR_RE.test(prop)) {
        var fx = flipX(v);
        if (fx !== null && fx !== v) return { kind: "flip", flips: [{ prop: prop, value: fx }], neutral: [] };
        if (fx === null) return { kind: "physical-unflippable", reason: "var-translate-keyword" };
      }
      return null;
    }
    if (ALREADY_LOGICAL.test(prop)) return { kind: "logical" };

    var side = SIDE_LOGICAL[prop];
    if (side) {
      return { kind: "flip", flips: [{ prop: side, value: v }], neutral: [{ prop: prop, value: "unset" }] };
    }
    if (SHORTHAND4[prop] !== undefined) {
      var parts = splitVals(v);
      var e4 = expand4(parts);
      if (!e4) return { kind: "physical-unflippable", reason: "shorthand-odd" };
      // «متغيّر تبديل» بين القيم (var عارية قد تكون بياضًا) يجعل عدّ الأجزاء نفسه
      // كاذبًا — فالتفكيك إلى خانات يُنتج زوايا/جوانب خاطئة (حالة prose الحقيقية)
      if (parts.some(function (x) { return /^var\(/i.test(x); })) {
        return e4[1] === e4[3] && parts.length < 2 ? null : { kind: "physical-unflippable", reason: "shorthand-var-toggle" };
      }
      if (e4[1] === e4[3]) return null; // متناظر — لا شأن للاتجاه به
      var slots = SHORTHAND4[prop];
      return { kind: "flip", flips: [
        { prop: slots[0], value: e4[0] }, { prop: slots[1], value: e4[1] },
        { prop: slots[2], value: e4[2] }, { prop: slots[3], value: e4[3] },
      ], neutral: [] }; // الخانات الأربع كلها مغطاة — لا حاجة لمصفِّر
    }
    if (prop === "border-radius") {
      // الفاصل البيضاوي «/» يُعتدّ به في العمق صفر فقط — القسمة داخل calc() ليست
      // بيضاوية (ست قواعد حقيقية بالموقع صُنّفت متعذّرة كذبًا قبل هذا التمييز)
      var sd = 0, ell = false;
      for (var si = 0; si < v.length; si++) {
        if (v[si] === "(") sd++;
        else if (v[si] === ")") sd--;
        else if (v[si] === "/" && sd === 0) { ell = true; break; }
      }
      if (ell) return { kind: "physical-unflippable", reason: "radius-elliptical" };
      var rparts = splitVals(v);
      var rp = expand4(rparts);
      if (!rp) return { kind: "physical-unflippable", reason: "radius-odd" };
      if (rparts.length > 1 && rparts.some(function (x) { return /^var\(/i.test(x); })) {
        return { kind: "physical-unflippable", reason: "shorthand-var-toggle" }; // متغيّر تبديل يكذّب العدّ
      }
      if (rp[0] === rp[1] && rp[2] === rp[3]) return null; // متناظر أفقيًّا
      return { kind: "flip", flips: [
        { prop: "border-start-start-radius", value: rp[0] },
        { prop: "border-start-end-radius", value: rp[1] },
        { prop: "border-end-end-radius", value: rp[2] },
        { prop: "border-end-start-radius", value: rp[3] },
      ], neutral: [] };
    }
    if (prop === "text-align") {
      // start/end لا left/right: داخل جزر LTR وفقرات dir=auto تعود للأصل من تلقائها
      if (/^left$/i.test(v)) return { kind: "flip", flips: [{ prop: "text-align", value: "start" }], neutral: [] };
      if (/^right$/i.test(v)) return { kind: "flip", flips: [{ prop: "text-align", value: "end" }], neutral: [] };
      return null;
    }
    if (prop === "float" || prop === "clear") {
      // القيمة المنطقية (كروم 118+) تحترم الجزر؛ الفيزيائية قبلها احتياط لكروم 102–117
      if (/^left$/i.test(v)) return { kind: "flip", flips: [{ prop: prop, value: "right" }, { prop: prop, value: "inline-start" }], neutral: [] };
      if (/^right$/i.test(v)) return { kind: "flip", flips: [{ prop: prop, value: "left" }, { prop: prop, value: "inline-end" }], neutral: [] };
      return null;
    }
    if (prop === "transform") {
      var ft = flipTransform(v);
      if (ft === PH) return null;         // إزاحاته عبر متغيّرات — تصريحاتها تغطيه
      if (ft !== null) return { kind: "flip", flips: [{ prop: "transform", value: ft }], neutral: [] };
      if (/translate/i.test(v)) return { kind: "physical-unflippable", reason: "transform-complex" };
      return null;
    }
    if (prop === "translate") {
      // خاصية translate المستقلة: أول قيمة هي السينية
      var tv = splitVals(v);
      if (!tv.length || /^none$/i.test(v)) return null;
      var x0 = tv[0];
      if (XVAR_RE.test(x0)) return null;  // متغيّر إزاحة — تصريحه يغطيه
      var fx2 = flipX(x0);
      if (fx2 === null) return { kind: "physical-unflippable", reason: "translate-keyword" };
      if (fx2 === x0) return null;        // صفر — محايد
      tv[0] = fx2;
      return { kind: "flip", flips: [{ prop: "translate", value: tv.join(" ") }], neutral: [] };
    }
    if (prop === "background" || prop === "background-image") {
      var swb = swapWords(v);
      if (swb !== null) return { kind: "flip", flips: [{ prop: prop, value: swb }], neutral: [] };
      return null;
    }
    // ★ transform-origin وperspective-origin **لا تُقلبان** (قرارٌ بعد دحضٍ حيّ): هما
    // منشأُ التحويلات — أي أرضُ «المحسوب بجافاسكربت» التي تعهّدنا ألّا نمسّها؛ ولا
    // أثر لهما في موضع التخطيط أصلًا، فمرآتُهما لا تكسب المستخدم شيئًا. وقد كسر
    // قلبُهما مكوّنًا حقيقيًّا: مؤشر «محادثة/العمل المشترك» منشؤه origin-left فقُلب
    // إلى 100% مع مرساته، والموقعُ يحسب إزاحته من اليسار — فوقع على القرص الخطأ.
    if (prop === "transform-origin" || prop === "perspective-origin") return null;
    if (prop === "background-position" || prop === "object-position") {
      var sw = swapWords(v);
      if (sw !== null) return { kind: "flip", flips: [{ prop: prop, value: sw }], neutral: [] };
      // المُصغِّر يحوّل الكلمات إلى أرقام (left → 0، right → 100%) فالاتجاه يُعبَّر
      // عدديًّا: أول قيمةٍ هي السينية — النسبةُ تُعكس حول المئة، والطولُ المطلق لا
      // يُعكس بأمان (لا نعرف عرض المرجع) فيُصرَّح به عجزًا بدل الصمت.
      var ptoks = splitVals(v);
      if (ptoks.length >= 1 && ptoks.length <= 2 && !/var\(|calc\(/i.test(v)) {
        var px = ptoks[0];
        var pm = /^(\d*\.?\d+)%$/.exec(px);
        if (pm || px === "0") {
          var pn = pm ? parseFloat(pm[1]) : 0;
          if (pn === 50) return null; // المنتصف محايد
          ptoks[0] = (100 - pn) + "%";
          return { kind: "flip", flips: [{ prop: prop, value: ptoks.join(" ") }], neutral: [] };
        }
        if (SIMPLE_LEN_RE.test(px) && !isZero(px)) {
          return { kind: "physical-unflippable", reason: "position-numeric" };
        }
      }
      return null;
    }
    if (prop === "box-shadow" || prop === "text-shadow") {
      // قرار موثَّق: الظلال لا تمسّ التخطيط ولا الاستعمال — لا تُقلب، وتُحصى للطبيب
      if (shadowHasX(v)) return { kind: "physical-unflippable", reason: "shadow" };
      return null;
    }
    if (prop === "direction" || prop === "unicode-bidi") return { kind: "logical" };
    return null;
  }

  // ---------- 3) البادئة والفرز والتسلسل ----------
  function prefixSelector(sel) {
    var parts = splitTopComma(sel);
    var out = [];
    for (var j = 0; j < parts.length; j++) {
      var s = parts[j].trim();
      if (!s) continue;
      var m = /^(html|:root)(?![-\w])/.exec(s);
      if (m) out.push(GATE + s.slice(m[0].length));
      else out.push(GATE + " " + s);
    }
    return out.join(",");
    function splitTopComma(str) {
      var ps = [], depth = 0, cur = "";
      for (var q = 0; q < str.length; q++) {
        var c = str[q];
        if (c === "\\") { cur += c + (str[q + 1] || ""); q++; continue; }
        if (c === "(" || c === "[") depth++;
        else if (c === ")" || c === "]") depth--;
        if (c === "," && depth === 0) { ps.push(cur); cur = ""; }
        else cur += c;
      }
      ps.push(cur);
      return ps;
    }
  }
  /* سلّم التخصيص الموحّد (درس الدحض التجريبي): دعوى «المنطقي يغلب المصفِّر دومًا»
   * بطلت متى تفاوت تخصيص محدِّدات الموقع (130 مصفِّرًا فوق مستوى الأداة في الملف
   * المولّد، حتى (0,9,1) في dframe) — فالتخصيص يُحسم قبل الترتيب. الحل: يُصفَّر
   * تخصيص محدِّد الموقع بلفّه في ‎:where()‎، ويُبنى تخصيصُنا نحن سلّمًا بمعرّفات
   * داخل ‎:not()‎ (تخصيص :not = أخصُّ وسائطها):
   *   المستوى ٢ للمصفِّرات (2,1,1) < ٣ للمنطقيات والمطابقات (3,1,1) < ٤ للمعزَّزات (4,1,1)
   * فكلُّ منطقيٍّ يغلب كلَّ مصفِّر بنيويًّا، والترتيب داخل المستوى الواحد (رتبة
   * الطبقة ثم الموضع) يُطابق تعاقب الموقع مطابقةً تامة — وبهذا يُستعاد قانون
   * الطبقات نفسُه الذي كان الفرزُ وحده عاجزًا عن استعادته لما اختلف التخصيص. */
  function prefixTier(sel, tier) {
    var ids = "";
    for (var k = 0; k < tier; k++) ids += "#cml" + k;
    var head = GATE + ":not(" + ids + ")";
    var parts = splitList(sel);
    var out = [];
    for (var j = 0; j < parts.length; j++) {
      var s = parts[j].trim();
      if (!s) continue;
      // العناصر الزائفة (::before وأخواتها والقديمة :before/:after) **لا تصح داخل
      // :where()** — والقائمة المتسامحة تُسقط ما فيها فتموت القاعدة كلها بصمت
      // (حالة حقيقية: قلب placeholder محرر ProseMirror على :before). تُفصل خارج اللف.
      // (?<!\\) — نقطتا أصناف تايلويند المهرَّبتان (‎.hover\:after\:x‎) ليستا زائفًا
      var pm2 = /(?<!\\)(?:::|:(?:before|after|first-line|first-letter)(?![\w-]))/.exec(s);
      var pi = pm2 ? pm2.index : -1;
      var core = pi === -1 ? s : s.slice(0, pi);
      var pseudo = pi === -1 ? "" : s.slice(pi);
      var m = /^(html|:root)(?![-\w])/.exec(core);
      if (m) {
        // متجذّر في html: مركّبُه يلتصق بالرأس داخل :where، وذيلُه (إن وجد) يُلفّ بعده
        var rest = core.slice(m[0].length);
        var cm = /^[^\s>+~]*/.exec(rest)[0];
        var tail = rest.slice(cm.length).trim();
        var comb = "";
        if (/^[>+~]/.test(tail)) { comb = tail.charAt(0) + " "; tail = tail.slice(1).trim(); }
        out.push(head + (cm ? ":where(" + cm + ")" : "") + (tail ? " " + comb + ":where(" + tail + ")" : "") + pseudo);
      } else if (/^[>+~]/.test(core)) {
        out.push(head + " " + s); // بقايا تداخل نادرة — بلا لفّ (تخصيصها يبقى كما هو)
      } else if (!core.trim()) {
        out.push(head + " *" + pseudo); // زائفٌ عارٍ (::selection مثلًا)
      } else if (pseudo && /[\s>+~]$/.test(core)) {
        // الزائف لسليلٍ ضمني (".a ::before") — العنصر الكوني يحفظ الدلالة بعد اللف
        var tc = /[>+~]\s*$/.exec(core);
        out.push(head + " :where(" + core.replace(/[\s>+~]+$/, "") + ") " + (tc ? tc[0].trim() + " " : "") + "*" + pseudo);
      } else {
        out.push(head + " :where(" + core.trim() + ")" + pseudo);
      }
    }
    return out.join(",");
    function splitList(str) {
      var ps = [], depth = 0, cur = "";
      for (var q = 0; q < str.length; q++) {
        var c = str[q];
        if (c === "\\") { cur += c + (str[q + 1] || ""); q++; continue; }
        if (c === "(" || c === "[") depth++;
        else if (c === ")" || c === "]") depth--;
        if (c === "," && depth === 0) { ps.push(cur); cur = ""; }
        else cur += c;
      }
      ps.push(cur);
      return ps;
    }
  }
  // «النسخ المطابقة»: إعلانُ موقعٍ متناظرٌ أو منطقيٌّ أصلًا قد يتقاسم خاناتِه
  // الفيزيائية مع مصفِّراتنا ومنطقياتنا — وبقاؤه في طبقات الموقع (سلّمنا يعلوها
  // كلَّها) يعني أن مصفِّرًا من قاعدةٍ أخرى على العنصر نفسه يمحوه (دحضٌ مؤكد:
  // unset يمحو نصفَ قطرٍ متناظرٍ مجاور). النسخة المطابقة تُعيده في مستوى
  // المنطقيات بموضعه من تعاقب الموقع. وقصًّا للحجم لا تُبثّ إلا لما تتقاطع
  // خاناتُه فعلًا مع خاناتٍ بثثناها (slotsOf أدناه) — لا لكل العائلات جزافًا.
  function slotsOf(prop) {
    if (/translate-x$/.test(prop)) return ["tx"];
    if (prop.charAt(0) === "-") return null;
    var m;
    if ((m = /^(margin|padding|scroll-margin|scroll-padding)(-(.+))?$/.exec(prop))) {
      var fam = { margin: "m", padding: "p", "scroll-margin": "sm", "scroll-padding": "sp" }[m[1]];
      var side = m[3];
      if (!side) return [fam + "-l", fam + "-r", fam + "-t", fam + "-b"];
      if (side === "left") return [fam + "-l"];
      if (side === "right") return [fam + "-r"];
      if (side === "top") return [fam + "-t"];
      if (side === "bottom") return [fam + "-b"];
      if (/^inline/.test(side)) return [fam + "-l", fam + "-r"];
      if (/^block/.test(side)) return [fam + "-t", fam + "-b"];
      return null;
    }
    if (prop === "inset") return ["i-l", "i-r", "i-t", "i-b"];
    if (prop === "left") return ["i-l"];
    if (prop === "right") return ["i-r"];
    if (prop === "top") return ["i-t"];
    if (prop === "bottom") return ["i-b"];
    if (/^inset-inline/.test(prop)) return ["i-l", "i-r"];
    if (/^inset-block/.test(prop)) return ["i-t", "i-b"];
    if (/radius$/.test(prop)) {
      if (prop === "border-radius") return ["r-tl", "r-tr", "r-br", "r-bl"];
      if (/top-left/.test(prop)) return ["r-tl"];
      if (/top-right/.test(prop)) return ["r-tr"];
      if (/bottom-left/.test(prop)) return ["r-bl"];
      if (/bottom-right/.test(prop)) return ["r-br"];
      return ["r-tl", "r-tr", "r-br", "r-bl"]; // المنطقية start-start وأخواتها — زوج بحسب الاتجاه؛ نعمّم
    }
    if ((m = /^border(-(left|right|top|bottom|inline-start|inline-end|inline|block-start|block-end|block))?(-(width|style|color))?$/.exec(prop))) {
      var sides = !m[2] ? ["l", "r", "t", "b"]
        : m[2] === "left" ? ["l"] : m[2] === "right" ? ["r"] : m[2] === "top" ? ["t"] : m[2] === "bottom" ? ["b"]
        : /^inline/.test(m[2]) ? ["l", "r"] : ["t", "b"];
      var chans = m[4] ? [m[4].charAt(0)] : ["w", "s", "c"];
      var outSl = [];
      for (var a1 = 0; a1 < sides.length; a1++) for (var b1 = 0; b1 < chans.length; b1++) outSl.push("b" + chans[b1] + "-" + sides[a1]);
      return outSl;
    }
    if (prop === "text-align") return ["ta"];
    if (prop === "float") return ["fl"];
    if (prop === "clear") return ["cl"];
    if (prop === "transform") return ["tf"];
    if (prop === "translate") return ["tx"];
    if (prop === "transform-origin") return ["to"];
    if (prop === "perspective-origin") return ["po"];
    if (prop === "background-position") return ["bp"];
    if (prop === "object-position") return ["op"];
    return null;
  }

  function ctxKey(ctx) { return ctx.join("|"); }
  function fnv1a(str) {
    var h = 0x811c9dc5;
    for (var j = 0; j < str.length; j++) {
      h ^= str.charCodeAt(j);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return ("0000000" + h.toString(16)).slice(-8);
  }
  // مفتاح التغطية عمدًا بلا طبقة: أسماء الطبقات قد تتبدل بين نشرات الموقع
  // والمقصود «هل هذا (السياق، المحدِّد، الخاصية) مغطًّى؟»
  function coverageKey(ctx, sel, prop) {
    return fnv1a(ctxKey(ctx) + "{" + sel.replace(/\s+/g, " ").trim() + "}" + prop);
  }

  /* يقلب قائمة قواعد (من parseCss واحد أو أكثر). opts.layerOrder يعيد ترتيب البثّ
   * بحسب رتبة الطبقة (الطبقة المتأخرة تغلب، وغير المطبَّق يغلب الكل فيُبثّ أخيرًا).
   * يرجع { neutral: [rule], logical: [rule], coverage: [hash..], stats }. */
  function flipSheet(rules, opts) {
    var layerOrder = (opts && opts.layerOrder) || [];
    function rank(layer) {
      if (layer === null || layer === undefined) return layerOrder.length + 1; // غير مطبَّق — يغلب الكل
      var r = layerOrder.indexOf(layer);
      return r === -1 ? layerOrder.length : r;
    }
    var sorted = rules.slice().sort(function (a, b) {
      var ra = rank(a.layer), rb = rank(b.layer);
      return ra !== rb ? ra - rb : a.idx - b.idx; // فرز مستقر بالموضع الأصلي
    });
    var neutral = [], neutralImp = [], logical = [], logicalImp = [];
    var dirBoost = [], dirBoostImp = [], coverage = [], covSeen = {};
    var seen = {}; // إزالة تكرار (سياق+محدِّد+خاصية+قيمة) — الملفات تكرر قواعد
    var stats = { flipped: 0, neutralized: 0, identity: 0, unflippable: {}, logicalAlready: 0, dirAware: 0, dirBoosted: 0, gateSkipped: 0, rules: rules.length };
    // قواعد الموقع المشروطة بـRTL (أدوات ‎rtl:‎ و‎:dir(rtl)‎) هي **قصد المؤلف** في RTL،
    // وتخصيصها واطئ (:where) فقلبُنا المعزَّز للأداة الأساس كان سيدهسها على العناصر
    // الجامعة للصنفين. الحل: تُبثّ نسخة منها معزَّزةً بالبوابة في قسمٍ ثالثٍ **بعد**
    // المنطقيات — فتفوز حيث وُجدت، ويبقى قلب الأساس حيث لا توجد. المشروطة بـLTR
    // (‏:dir(ltr)) تُترك كما هي: جزرُنا تعمل بخاصية direction لا بسمة dir فلا تلمسها.
    var RTL_COND_RE = new RegExp(":dir\\(\\s*rtl\\s*\\)|\\[dir\\s*=\\s*\"?rtl\"?\\]", "i");
    // التمرير الأول: أي الخانات الفيزيائية سنبثّ فيها فعلًا؟ (مصفِّرات + منطقيات)
    // النسخ المطابقة في التمرير الثاني تُشرَط بتقاطع خاناتها مع هذه — قصًّا للحجم
    var contested = {};
    function markSlots(prop) {
      var sl = slotsOf(prop);
      if (sl) for (var z = 0; z < sl.length; z++) contested[sl[z]] = 1;
    }
    for (var r0 = 0; r0 < sorted.length; r0++) {
      var rule0 = sorted[r0];
      if (rule0.sel.indexOf("data-cml") !== -1 || /\[dir\s*[=\]]|:dir\(/.test(rule0.sel)) continue;
      for (var d0 = 0; d0 < rule0.decls.length; d0++) {
        var a0 = analyzeDecl(rule0.decls[d0].prop, rule0.decls[d0].value);
        if (!a0 || a0.kind !== "flip") continue;
        for (var f0 = 0; f0 < a0.flips.length; f0++) markSlots(a0.flips[f0].prop);
        for (var q0 = 0; q0 < a0.neutral.length; q0++) markSlots(a0.neutral[q0].prop);
      }
    }
    function identityNeeded(prop) {
      var sl = slotsOf(prop);
      if (!sl) return false;
      for (var z = 0; z < sl.length; z++) if (contested[sl[z]]) return true;
      return false;
    }
    for (var r = 0; r < sorted.length; r++) {
      var rule = sorted[r];
      if (rule.sel.indexOf("data-cml") !== -1) { stats.gateSkipped++; continue; } // مخرجاتنا نحن
      if (/\[dir\s*[=\]]|:dir\(/.test(rule.sel)) {
        stats.dirAware++;
        if (RTL_COND_RE.test(rule.sel)) {
          var bn = [], bi = [];
          for (var bx = 0; bx < rule.decls.length; bx++) (rule.decls[bx].important ? bi : bn).push(rule.decls[bx]);
          if (bn.length) dirBoost.push({ sel: prefixTier(rule.sel, 4), decls: bn, ctx: rule.ctx });
          if (bi.length) dirBoostImp.push({ sel: prefixTier(rule.sel, 4), decls: bi, ctx: rule.ctx });
          stats.dirBoosted++;
        }
        continue;
      }
      var flips = [], neut = [];
      for (var d = 0; d < rule.decls.length; d++) {
        var dec = rule.decls[d];
        var a = analyzeDecl(dec.prop, dec.value);
        if (!a || a.kind === "logical") {
          if (a) stats.logicalAlready++;
          // النسخة المطابقة: محايدٌ أو منطقيٌّ خاناتُه متنازَعةٌ فعلًا يُعاد بثُّه
          // كما هو في مستوى المنطقيات — وإلا محاه مصفِّرُ قاعدةٍ مجاورة
          if (identityNeeded(dec.prop)) {
            flips.push({ prop: dec.prop, value: dec.value, important: dec.important });
            stats.identity++;
          }
          continue;
        }
        if (a.kind === "physical-unflippable") {
          stats.unflippable[a.reason] = (stats.unflippable[a.reason] || 0) + 1;
          continue;
        }
        var ck = coverageKey(rule.ctx, rule.sel, dec.prop);
        if (seen[ck + "!" + dec.value]) continue;
        seen[ck + "!" + dec.value] = 1;
        if (!covSeen[ck]) { covSeen[ck] = 1; coverage.push(ck); }
        for (var f = 0; f < a.flips.length; f++) flips.push({ prop: a.flips[f].prop, value: a.flips[f].value, important: dec.important });
        for (var q = 0; q < a.neutral.length; q++) neut.push({ prop: a.neutral[q].prop, value: a.neutral[q].value, important: dec.important });
        stats.flipped++;
      }
      // فرز المهمّات: !important داخل طبقات الموقع يقلب قانون الطبقات (المهمّ المبكر
      // يغلب المتأخر) فيهزم مهمّاتُ الموقع المطبَّقةُ مهمّاتِنا غيرَ المطبَّقة — لذا
      // تُفصل الإعلانات الحاملة له لتُبثّ داخل ‎@layer cml-imp‎ المعلَنة أولَ الورقة.
      pushSplit(neutral, neutralImp, prefixTier(rule.sel, 2), neut, rule.ctx);
      pushSplit(logical, logicalImp, prefixTier(rule.sel, 3), flips, rule.ctx);
      stats.neutralized += neut.length;
    }
    return {
      neutral: neutral, neutralImp: neutralImp,
      logical: logical, logicalImp: logicalImp,
      dirBoost: dirBoost, dirBoostImp: dirBoostImp,
      coverage: coverage, stats: stats,
    };
    function pushSplit(normalList, impList, sel, decls, ctx) {
      if (!decls.length) return;
      var nd = [], id = [];
      for (var x = 0; x < decls.length; x++) (decls[x].important ? id : nd).push(decls[x]);
      if (nd.length) normalList.push({ sel: sel, decls: nd, ctx: ctx });
      if (id.length) impList.push({ sel: sel, decls: id, ctx: ctx });
    }
  }

  function serializeRules(list) {
    // تجميع القواعد المتتالية ذات السياق الواحد تحت غلاف شرطي واحد، بترتيبها
    var out = [], open = null;
    for (var r = 0; r < list.length; r++) {
      var rule = list[r];
      var key = ctxKey(rule.ctx);
      if (key !== open) {
        if (open) out.push(closeOf(open));
        for (var c = 0; c < rule.ctx.length; c++) out.push(rule.ctx[c] + "{");
        open = key || null;
      }
      var decls = [];
      for (var d = 0; d < rule.decls.length; d++) {
        var dec = rule.decls[d];
        decls.push(dec.prop + ":" + dec.value + (dec.important ? " !important" : ""));
      }
      out.push(rule.sel + "{" + decls.join(";") + "}");
    }
    if (open) out.push(closeOf(open));
    return out.join("\n");
    function closeOf(key) { return "}".repeat(key.split("|").length); }
  }

  // جزر LTR: داخلها تبقى الخصائص المنطقية على يسارها لأن direction:ltr يحسمها،
  // وdir=auto في المحادثة يحسم كل فقرة بلغتها — الصواب انبثاقي لا حالات خاصة.
  var ISLANDS_CSS =
    GATE + " pre," + GATE + " code," + GATE + " kbd," + GATE + " samp," +
    GATE + " [data-cml-noflip]{direction:ltr;}\n" +
    GATE + " pre," + GATE + " code{text-align:start;unicode-bidi:isolate;}\n";
  // ملحوظة على الجزيرة أعلاه: [data-cml-noflip] تخدم أيضًا **المواضع المحسوبة** —
  // عنصرٌ مطلقٌ يحرّكه الموقع بـtransform (مؤشر شرائح منزلق مثلًا) مرساتُه الفيزيائية
  // جزءٌ من عقد حسابه، وdirection:ltr عليه يُرجع inset-inline-start إلى معنى left
  // فتصحّ إزاحتُه بلا أن نمسّ نمطَه السطري. والمحرّك يضع السمة وقت التشغيل لأن
  // توقيع الحالة موزَّعٌ على أصنافٍ عدة (absolute + origin-* + انتقال transform)
  // فلا يُلتقط من قاعدة CSS واحدة.

  g.CMLRtl = {
    GATE: GATE,
    parseCss: parseCss,
    analyzeDecl: analyzeDecl,
    flipSheet: flipSheet,
    serializeRules: serializeRules,
    prefixSelector: prefixSelector,
    coverageKey: coverageKey,
    fnv1a: fnv1a,
    ISLANDS_CSS: ISLANDS_CSS,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
