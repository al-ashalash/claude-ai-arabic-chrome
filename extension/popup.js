/* popup.js — the extension menu. Reads languages.json, wires the controls to
   chrome.storage.local; the content script (engine.js) reacts live. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var langSel = $("lang"), dirBadge = $("dirBadge"), enabled = $("enabled");
  var src = $("src"), dst = $("dst"), saveBtn = $("save"), status = $("status");
  var rtlToggle = $("rtl");
  var chatrtlToggle = $("chatrtl");
  var LANGS = [], current = "ar";

  function dirOf(code) {
    var l = LANGS.filter(function (x) { return x.code === code; })[0];
    return (l && l.direction) || "ltr";
  }
  function setBadge() { dirBadge.textContent = dirOf(current).toUpperCase(); }

  function load() {
    fetch(chrome.runtime.getURL("languages.json"))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        LANGS = data.languages || [];
        chrome.storage.local.get(["cml_lang", "cml_enabled", "cml_rtl", "cml_chatrtl"], function (s) {
          current = s.cml_lang || data.default || (LANGS[0] && LANGS[0].code) || "ar";
          enabled.checked = s.cml_enabled !== false;
          if (rtlToggle) rtlToggle.checked = s.cml_rtl !== false;
          if (chatrtlToggle) chatrtlToggle.checked = s.cml_chatrtl !== false;
          langSel.innerHTML = "";
          LANGS.forEach(function (l) {
            var o = document.createElement("option");
            o.value = l.code;
            o.textContent = l.endonym + " — " + l.englishName + " (" + (l.direction || "ltr").toUpperCase() + ")";
            if (l.code === current) o.selected = true;
            langSel.appendChild(o);
          });
          setBadge();
        });
      })
      .catch(function () { status.textContent = "تعذّر تحميل قائمة اللغات / could not load languages"; });
  }

  langSel.addEventListener("change", function () {
    current = langSel.value;
    setBadge();
    chrome.storage.local.set({ cml_lang: current });
  });
  enabled.addEventListener("change", function () {
    chrome.storage.local.set({ cml_enabled: enabled.checked });
  });
  if (rtlToggle) rtlToggle.addEventListener("change", function () {
    chrome.storage.local.set({ cml_rtl: rtlToggle.checked });
  });
  if (chatrtlToggle) chatrtlToggle.addEventListener("change", function () {
    chrome.storage.local.set({ cml_chatrtl: chatrtlToggle.checked });
  });
  saveBtn.addEventListener("click", function () {
    var a = (src.value || "").trim(), b = (dst.value || "").trim();
    if (!a || !b) { status.textContent = "اكتب الكلمتين / fill both fields"; return; }
    chrome.storage.local.get(["cml_overrides"], function (s) {
      var ov = s.cml_overrides || {};
      ov[current] = ov[current] || {};
      ov[current][a] = b;
      chrome.storage.local.set({ cml_overrides: ov }, function () {
        status.textContent = "تم الحفظ ✓ / saved";
        src.value = ""; dst.value = "";
        setTimeout(function () { status.textContent = ""; }, 2500);
      });
    });
  });

  var openOpt = document.getElementById("openOptions");
  if (openOpt) openOpt.addEventListener("click", function (e) {
    e.preventDefault();
    if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
    else window.open(chrome.runtime.getURL("options.html"));
  });

  load();
})();
