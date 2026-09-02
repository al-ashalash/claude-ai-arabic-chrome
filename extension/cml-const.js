/* cml-const.js — المصدر الواحد للثوابت ومفاتيح التخزين (المرحلة ١ من خطة الإطلاق).
 *
 * لماذا: كانت عتبة الحجز 90000 مكتوبة مرتين بعقد «نفس عتبة claimScan» اليدوي، وسقف
 * الـ300 حرف في ثلاثة مواضع، ومفاتيح التخزين الـ13 موزعة على أربع قوائم تُصان يدويًا —
 * والانحراف وقع فعلًا (resetAll). القيمة تُكتب هنا مرة واحدة ويستهلكها الجميع.
 *
 * ثنائي الاستخدام: لا import/export — يُحقن سكربتًا كلاسيكيًا في المتصفح (المانيفست
 * وoptions.html) ويستورده Node كوحدة ESM صالحة (التعيين على globalThis يعمل في كليهما).
 */
(function (g) {
  "use strict";
  var C = {
    // ---- مفاتيح chrome.storage.local — كل مفتاح باسمه الواحد ----
    K: {
      LANG: "cml_lang",
      ENABLED: "cml_enabled",
      RTL: "cml_rtl",
      CHATRTL: "cml_chatrtl",
      OVERRIDES: "cml_overrides",
      USER_PATTERNS: "cml_user_patterns",
      SCAN_REQUEST: "cml_scan_request",
      SCAN_RESULT: "cml_scan_result",
      SCAN_CANCEL: "cml_scan_cancel",
      SCAN_CLAIM: "cml_scan_claim",
      RECON_DISMISSED: "cml_recon_dismissed",
      BAD_RULES: "cml_bad_rules",
      // مفاتيح بناءات ما قبل النشر — تُحذف عند الإقلاع ولا تُستعمل
      LEGACY_COLLECT: "cml_collect",
      LEGACY_COLLECTED: "cml_collected",
    },

    // القائمة التي تحذفها «إعادة الضبط» — تُشتق من الأسماء أعلاه فلا تنحرف عنها
    RESET_KEYS: [
      "cml_enabled", "cml_rtl", "cml_chatrtl", "cml_overrides", "cml_user_patterns",
      "cml_scan_request", "cml_scan_result", "cml_scan_cancel", "cml_scan_claim",
      "cml_recon_dismissed", "cml_bad_rules",
    ],
    UNUSED_KEYS: ["cml_collect", "cml_collected"],

    // ---- عتبات المحرك ----
    TEXT_MAX: 300,          // أقصى طول نص يُترجم (عقد النص والسمات وسكربت الفحص سواء)
    PEND_MAX: 2000,         // سقف طابور الطفرات قبل التحول لمرور كامل
    LOOKUP_CACHE_MAX: 5000, // سقف ذاكرة نتائج البحث

    // ---- عتبات الفحص ----
    CLAIM_STALE_MS: 90000,  // حجز أقدم من هذا متروك (يطابقه startScan وclaimScan حكمًا)
    SCAN_CAP: 4000,         // أقصى ما يُخزَّن من غير المترجَم (القائمتان تُقصان، العدّ يصدق)
    SCAN_PARALLEL: 6,       // توازي الجلب — لا يزاحم بث المحادثة على الاتصال نفسه
    HEARTBEAT_STALL_MS: 45000, // نبض أقدم من هذا في «جارٍ» = فحص متعثر

    // ---- سقوف الاستيراد ----
    IMPORT_MAX_BYTES: 5 * 1024 * 1024,
    IMPORT_MAX_TERMS: 20000,
    IMPORT_MAX_RULES: 2000,
  };
  g.CMLConst = C;
})(typeof globalThis !== "undefined" ? globalThis : this);
