# سجلّ الإصدارات — Changelog

## 1.0.0 — الإصدار الأول

### ما تفعله الإضافة
- **ترجمة واجهة claude.ai** بقاموس فيه أكثر من 28,300 مفردة يغطي نحو 96% من نصوص الموقع،
  وأكثر من 3,300 قاعدة ذكية للنصوص المتغيّرة، وصيغ الجمع العربية الست. المصطلحات مُسنَدة إلى
  معجم البيانات والذكاء الاصطناعي (مجمع الملك سلمان العالمي للغة العربية وسدايا، الإصدار الثالث).
- **الاتجاه من اليمين إلى اليسار** بمحرّكين: «الشامل» (الافتراضي) يبني ورقة العكس من ملفات تصميم
  الموقع نفسها ويعيد بناءها كلما تغيّرت نسخته، و«المبسّط» ورقة ثابتة مضمّنة للطوارئ. اتجاه مستقل
  لكل فقرة في المحادثة، والتعليمات البرمجية تبقى من اليسار.
- **تصحيحاتك الشخصية** تعلو على القاموس وتُطبَّق فورًا، مع بحث في القاموس كله وتصدير واستيراد.
- **فحص الموقع** و**فحص الاتجاه** بضغطة منك: يُظهران ما استُجدّ في الموقع ولم يُترجَم أو لم يُعكس بعد.
- **مزامنة اختيارية** بين أجهزتك عبر مزامنة كروم نفسها — متوقّفة ما لم تُفعّلها.

### القيود المعروفة
- نحو 4% من نصوص الموقع لا تُترجَم عمدًا أو تعذّر تعميمها: أسماء منتجات ومعرّفات وقيم متغيّرة
  وحدها، ونصوص متغيّرة قصيرة جدًّا لا تصلح قاعدةً آمنة.
- الترجمة الآلية المدقَّقة ليست معصومة — وُجد «التصحيح الشخصي» لهذا، والمسائل على GitHub مرحّب بها.
- **فايرفوكس 127+** لا يمنح الإذن عند التثبيت؛ يُمنح من صفحة الإعدادات (انظر README).
- نصّ محادثاتك مستثنًى من الترجمة أصلًا؛ ولا تترجم الإضافة محتوى المُخرَجات (Artifacts).

### التثبيت اليدوي
`chrome://extensions` ← وضع المطوّر ← تحميل غير محزومة ← المجلد `extension/`.

---

## 1.0.0 — First release

### What it does
- **Translates the claude.ai interface** with a dictionary of 28,300+ strings covering about 96% of
  the site's text, 3,300+ smart rules for variable strings, and the six Arabic plural forms. AI
  terminology is anchored to the Data & AI Glossary (King Salman Global Academy for Arabic Language
  and SDAIA, 3rd edition).
- **Right-to-left layout** with two engines: "comprehensive" (default) builds its mirroring sheet
  from the site's own stylesheets and rebuilds it whenever the site ships a new version;
  "simplified" is a fixed bundled sheet for emergencies. Per-paragraph direction inside chats; code
  stays left-to-right.
- **Personal corrections** override the dictionary and apply immediately, with full-dictionary
  search, export and import.
- **Site scan** and **direction check**, on your click: show what the site added that is not yet
  translated or mirrored.
- **Optional sync** across your devices through Chrome's own sync — off unless you turn it on.

### Known limitations
- About 4% of the site's strings are deliberately untranslated or could not be generalized: product
  names, identifiers, bare variable values, and very short variable strings that would not make a
  safe rule.
- Reviewed machine translation is not infallible — that is what personal corrections are for, and
  issues on GitHub are welcome.
- **Firefox 127+** does not grant the site permission on install; grant it from the options page
  (see README).
- Conversation text is excluded from translation by design; the extension does not translate the
  content of Artifacts.

### Manual install
`chrome://extensions` → Developer mode → Load unpacked → the `extension/` folder.
