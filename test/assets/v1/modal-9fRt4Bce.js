// depth-2 sibling chunk
var e = { defaultMessage: "Zzq modal label", id: "d1" };
var f = { defaultMessage: "Cancel", id: "d2" };
// نصّ فيه متغيّر: يجب أن يُصنَّف في varList لا في list
var g = { defaultMessage: "Zzq delete {count} items now", id: "d3" };
// كتلة ICU: يجب أن تُستبعد تمامًا (تحتاج فئات العربية الست)
var h = { defaultMessage: "Zzq {n, plural, one {# item} other {# items}} left", id: "d4" };
// نصّ فيه وسم: يُستبعد أيضًا
var i2 = { defaultMessage: "Zzq read <link>the docs</link> here", id: "d5" };

// ★★ نصوص مُرمَّزة كما تُخرجها أدوات الحزم — حارسٌ ضد عودة علّة رمي كل نصّ فيه \u.
// كانت الشيفرة ترمي هذه كلها، وهي في الواجهة الحقيقية نحو سُدس النصوص.
var j = { defaultMessage: "Zzq typographic apostrophe: couldn\u2019t load", id: "d6" };
var k = { defaultMessage: "Zzq em dash \u2014 and ellipsis\u2026", id: "d7" };
// ترميز terser بـ\xNN — يجب أن يُفكّ أيضاً
var l = { defaultMessage: "Zzq caf\xe9 and 2\xd7 usage", id: "d8" };
// محرف تحكّم بعد الفكّ ⇒ يجب أن يُستبعد
var n = { defaultMessage: "Zzq control\u0007char here", id: "d9" };
