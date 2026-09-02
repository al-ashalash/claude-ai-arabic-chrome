<div dir="rtl">

# تعريب كلود للويب

**إضافة متصفح تعرّض واجهة [claude.ai](https://claude.ai) بالعربية، مع الاتجاه من اليمين لليسار.**

مشروع مستقل غير رسمي · محليّ بالكامل · صلاحية واحدة (`storage`) · مفتوح المصدر

---

## لماذا؟

واجهة claude.ai تدعم إحدى عشرة لغة رسميًّا، وليست العربية منها. ودعمُ الاتجاه من اليمين
لليسار ناقص، فالنصّ العربي يُحاذى يسارًا، ويختلّ ترتيبُه إذا خالطته إنجليزيةٌ أو أرقام أو
شيفرة. هذه الإضافة تسدّ الأمرين معًا: **تترجم الواجهة، وتقلب اتجاهها**.

## ما تفعله

| | |
|---|---|
| **ترجمة الواجهة** | قاموس فيه أكثر من **18,000** مفردة، يغطي **95.9%** من نصوص الموقع |
| **قواعد ذكية** | أكثر من **1,100** قاعدة للنصوص المتغيّرة (التواريخ، «قبل ٣ أيام»، «الرسالة ١ من ٢»…) |
| **صيغ الجمع العربية** | الفئات الست (`zero/one/two/few/many/other`) — لا «٣ محادثة» ولا «١١ محادثات» |
| **الاتجاه من اليمين لليسار** | قلبُ التخطيط، واتجاهٌ مستقلٌّ لكل فقرة في المحادثة، والشيفرة تبقى من اليسار |
| **تصحيح شخصي** | ابحث في القاموس كله وعدّل أي ترجمة لنفسك |
| **فحص الموقع** | يقرأ ملفات claude.ai العامة ليجد ما استُجدّ ولم يُترجَم بعد |

## الخصوصية — بدقّة

ليترجم الامتداد تسميةً فلا بدّ أن **يطابقها**، فهو إذن يقرأ نصوص الصفحة أثناء مروره عليها
ويقارنها بقاموسٍ مضمَّن داخله. **والفرق الذي يعنيك أن هذه القراءة عابرة للمطابقة وحدها:**

- **لا يُخزَّن شيء مما يُقرأ، ولا يُراكَم، ولا يُرسَل** — لا إلى تخزين، ولا إلى خادم، ولا إلى
  أي مكان. والكتابة الدائمة الوحيدة تفضيلاتُك وتصحيحاتُك التي تكتبها بنفسك.
- **نصّ المحادثات مستثنًى أصلًا** فلا تلمسه الترجمة — لا رسائلك ولا ردود Claude.
- **لا اتصال بأي خادم.** لا تحليلات، ولا تتبّع، ولا خدمة خارجية.
- **لا تطلب صلاحية قراءة بياناتك في المواقع.** الصلاحية الوحيدة `storage` لحفظ تفضيلاتك
  على جهازك.

نقولها بهذه الدقّة لأن الوعد المتجاوِز أضعفُ من الوعد الدقيق: المشروع مفتوح المصدر،
فكلُّ سطرٍ من هذا يمكنك التحقق منه بنفسك. التفصيل في [سياسة الخصوصية](PRIVACY.md).

## التثبيت

**من متجر Chrome:** *(قريبًا)*

**يدويًّا (نسخة التطوير):**

1. نزّل المستودع أو انسخه.
2. افتح `chrome://extensions` وفعّل **وضع المطوّر**.
3. اضغط **تحميل غير محزومة** واختر المجلد `extension`.
4. افتح [claude.ai](https://claude.ai) — تظهر الواجهة بالعربية.

> بعد أي تحديث للإضافة: اضغط **↻** على بطاقتها في `chrome://extensions`، ثم **Ctrl+Shift+R**
> على تبويب claude.ai. إعادة تحميل الإضافة لا تُحدِّث سكربتها في التبويبات المفتوحة من قبلُ.

---

## كيف أُنجزت الترجمة — إفصاح

بُني هذا القاموس **بمعونة [Claude Code](https://claude.com/claude-code)** (أداة Anthropic
للبرمجة بالذكاء الاصطناعي)، على قواعد مصطلحية ثابتة وضعها صاحب المشروع:

- ما يبقى إنجليزيًّا (العلامات التجارية والمصطلحات التقنية) وما يُترجَم.
- نمط «الترجمة (English)» للعناوين المستقلة، والعربيةُ وحدها داخل الجُمل.
- توحيد المصطلح الواحد عبر ثمانية عشر ألف نصّ.

ومرّ كل نصّ بتدقيق آلي (تغطية، وسلامة المتغيّرات، واتساق المصطلح) ثم مراجعة.

**ونصرّح بهذا لأن من حقّك أن تعرف كيف صُنع ما تقرؤه.** ومع ذلك تبقى فيه أخطاء ولا بدّ —
ولهذا صُنعت «الكلمات المحفوظة»: صحّح ما استُشكل عليك لنفسك في ثانية، أو
[افتح مسألة](https://github.com/al-ashalash/claude-ai-arabic-chrome/issues) لتصحيحه للجميع.

---

## للمساهمين

### تصحيح ترجمة

أسهل طريق: **افتح [مسألة](https://github.com/al-ashalash/claude-ai-arabic-chrome/issues)** واذكر النصّ
الإنجليزي كما هو، والترجمة الحالية، والترجمة التي تقترحها، وسببها.

أو عدّل `dictionaries/ar.json` مباشرة وأرسل طلب سحب. ثم:

```bash
node tools/build.mjs
```

### إضافة لغة

```bash
node tools/addlang.mjs <code> <endonym> <EnglishName>
```

ثم ترجم `dictionaries/<code>.json` وأعد البناء. الاتجاه يُكتشف تلقائيًّا.

### الاختبارات

افتح ملفات `test/*.html` عبر خادم ملفات ثابت (لا `file://` — يمنعه CORS)،
واقرأ النتيجة من عنوان الصفحة:

| الملف | ما يختبره |
|---|---|
| `_selftest.html` | المحرّك: الترجمة، والأنماط، والجموع، والتطبيق الحيّ |
| `_ruletest.html` | توليد القواعد الذكية وحرّاسُ الأمان |
| `_scantest.html` | الزحف التعاودي على ملفات الموقع |
| `_dirtest.html` | اتجاه نصّ المحادثة |
| `_scanlocktest.html` | حجز الفحص ونبضه |
| `_termstest.html` | البحث في القاموس والتصحيح الشخصي |

### بنية المشروع

```
extension/      الإضافة الجاهزة (حمّلها غير محزومة)
dictionaries/   ★ القاموس المصدر — المصدر الوحيد للحقيقة
tools/          أدوات البناء (Node خالص، بلا npm)
test/           الاختبارات
```

`dictionary.js` **مُولّد** — لا تعدّله يدويًّا؛ عدّل `ar.json` ثم أعد البناء.

---

## الترخيص

[MIT](LICENSE) — الترجمة العربية عملُ هذا المشروع.

النصوص الإنجليزية مفاتيحُ القاموس، وهي مملوكة لـ Anthropic PBC، ولا تُدرَج إلا بالقدر
اللازم لمطابقة الواجهة وتعريبها.

«Claude» و«Claude.ai» و«Anthropic» علامات تجارية لمالكها. هذا المشروع مستقل غير رسمي،
ليس من إنتاج Anthropic ولا تابعًا لها.

</div>

---

<div dir="ltr">

# Claude Web — Arabic Localization

A browser extension that renders the [claude.ai](https://claude.ai) interface in Arabic, with
proper right-to-left layout.

Independent and unofficial · fully local · one permission (`storage`) · open source

**Why:** claude.ai's interface officially supports eleven languages; Arabic is not among them.
RTL support is also incomplete — Arabic text is left-aligned, and its order breaks when mixed
with English, numbers, or code. This extension addresses both: it translates the interface and
flips its direction.

**What it does:** an 18,000-entry dictionary covering 95.9% of the site's strings; 1,100+ smart
rules for variable text (dates, relative times, counters); all six Arabic plural categories;
full RTL layout with per-paragraph direction in conversations; personal corrections searchable
across the whole dictionary; and a site scan that reads claude.ai's public bundles to find newly
added untranslated strings.

**Privacy, stated precisely:** to translate a label the extension must first match it, so it does
read page text as it walks the DOM, comparing it against a dictionary bundled inside the
extension. Those reads are transient and match-only: **nothing read is stored, accumulated, or
transmitted** — not to storage, not to a server, not anywhere. The only persistent writes are
your own settings and the corrections you type. Conversation prose is excluded outright, and the
extension requests no host permissions — only `storage`. We say it this precisely because an
overreaching claim is weaker than an exact one, and this is open source: verify it yourself. See
the [privacy policy](PRIVACY.md).

**Disclosure:** the dictionary was built with the help of
[Claude Code](https://claude.com/claude-code), following a fixed terminology rulebook set by the
project's author, with automated validation and review of every string. We state this plainly
because you deserve to know how what you read was made. Errors nonetheless remain — which is why
personal corrections exist, and why
[issues](https://github.com/al-ashalash/claude-ai-arabic-chrome/issues) are welcome.

**License:** [MIT](LICENSE) for the Arabic translation and code. The English source strings are
dictionary keys owned by Anthropic PBC, included only as far as necessary for interoperability.
"Claude", "Claude.ai", and "Anthropic" are trademarks of their owner; this project is independent
and unofficial.

</div>
