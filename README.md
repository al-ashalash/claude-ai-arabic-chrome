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
| **ترجمة الواجهة** | قاموس فيه أكثر من **27,300** مفردة، يغطي **96%** من نصوص الموقع (والباقي أسماءُ علاماتٍ ومعرِّفاتٌ تقنية لا تُترجَم) |
| **قواعد ذكية** | أكثر من **3,100** قاعدة للنصوص المتغيّرة (التواريخ، «قبل ٣ أيام»، «الرسالة ١ من ٢»…) |
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
- **لا تتصل الإضافة بأي خادم من تلقاء نفسها.** لا تحليلات، ولا تتبّع، ولا خدمة خارجية،
  ولا خادم لنا أصلًا. والاتصالان الوحيدان يقعان **بضغطةٍ منك** ويقصدان ملفات claude.ai
  العامة وحدها: «فحص الموقع» (ليجد ما استُجدّ ولم يُترجَم) و«طبيب الاتجاه» (ليقرأ
  ملفات التنسيق) — لا يُرسَل فيهما شيءٌ من عندك، إنما تُقرأ ملفات الموقع.
- **الاستثناء الوحيد لمغادرة بياناتك جهازك:** إن فعّلتَ المزامنة الاختيارية (وهي مطفأة
  افتراضيًّا) حمل **كرومُ نفسُه** تصحيحاتِك وقواعدَك — دون إعداداتك ودون شيءٍ من محتواك
  أو محادثاتك — إلى حسابك في جوجل بمزامنته المعتادة، لا باتصالٍ تفتحه الإضافة.
  **وجوجل قد تطّلع عليها ما لم تفعّل عبارة مرور المزامنة في كروم نفسه.** وتبقى لك
  أزرار إيقافها ومسح ما رُفع.
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

### فايرفوكس وإيدج

**إيدج:** حزمة كروم نفسها تعمل كما هي — الخطوات أعلاه سواءً بسواء من `edge://extensions`.
(الرفع إلى متجر إيدج خطوة يدوية لاحقة.)

**فايرفوكس:** ابنِ نسخته أولًا (فايرفوكس MV3 يريد مانيفستًا مختلفًا قليلًا):

```bash
node tools/build-firefox.mjs
```

ثم افتح `about:debugging#/runtime/this-firefox` واضغط **تحميل إضافة مؤقتة** واختر ملف
`manifest.json` من المجلد المولَّد `extension-firefox`.

> **مهم في فايرفوكس:** منذ الإصدار 127 لا يمنح فايرفوكس الإضافةَ إذنَ الوصول إلى claude.ai
> عند التثبيت، فتبقى صامتة حتى تمنحه أنت. افتح **صفحة خيارات الإضافة** — تظهر لك الشاشة
> الإرشادية وحدها متى كان الإذن ناقصًا — واضغط «امنح الإذن لموقع claude.ai»، ثم حدّث
> تبويبات claude.ai المفتوحة.

---

## كيف أُنجزت الترجمة — إفصاح

بُني هذا القاموس **بمعونة [Claude Code](https://claude.com/claude-code)** (أداة Anthropic
للبرمجة بالذكاء الاصطناعي)، على قواعد مصطلحية ثابتة وضعها صاحب المشروع:

- ما يبقى إنجليزيًّا (العلامات التجارية والمصطلحات التقنية) وما يُترجَم.
- نمط «الترجمة (English)» للعناوين المستقلة، والعربيةُ وحدها داخل الجُمل.
- توحيد المصطلح الواحد عبر سبعةٍ وعشرين ألف نصّ.

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

شغّل خادم الاختبارات ثم افتح الصفحات منه، واقرأ النتيجة من **عنوان التبويب** (`اسم N/N` = كله ناجح):

```bash
node tools/serve-tests.mjs
```

ثم افتح `http://localhost:8794/test/<الصفحة>`. فتحُ الصفحات بالنقر المزدوج (`file://`)
لا يصلح للفحص الكامل: المتصفح يمنع `fetch` هناك، فالصفحات التي تحتاجها تتخطى ذلك الجزء
بصفّ إرشادٍ ظاهر بدل إخفاقات كاذبة.

| الملف | ما يختبره |
|---|---|
| `_selftest.html` | المحرّك: الترجمة، والأنماط، والجموع، والتطبيق الحيّ |
| `_ruletest.html` | توليد القواعد الذكية وحرّاسُ الأمان |
| `_scantest.html` | الزحف التعاودي على ملفات الموقع |
| `_dirtest.html` | اتجاه نصّ المحادثة |
| `_scanlocktest.html` | حجز الفحص ونبضه (طبقة السقوط) |
| `_swtest.html` | تحكيم عامل الخدمة — سيناريوهات التبويبات المتعددة |
| `_rtltest.html` | محرّك الاتجاه: القلب المنطقي وجزر LTR والناتج المولَّد |
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

**What it does:** a 27,300-entry dictionary covering 96% of the site's strings; 3,100+ smart
rules for variable text (dates, relative times, counters); all six Arabic plural categories;
full RTL layout with per-paragraph direction in conversations; personal corrections searchable
across the whole dictionary; and a site scan that reads claude.ai's public bundles to find newly
added untranslated strings.

**Privacy, stated precisely:** to translate a label the extension must first match it, so it does
read page text as it walks the DOM, comparing it against a dictionary bundled inside the
extension. Those reads are transient and match-only: **nothing read is stored, accumulated, or
transmitted** — not to storage, not to a server, not anywhere. The only persistent writes are
your own settings and the corrections you type. Conversation prose is excluded outright, and the
extension requests no host permissions — only `storage`. The extension never contacts a server of
its own — there is no server of ours; the only network requests it ever makes happen **when you
press a button**, and they fetch claude.ai's own public files: the site scan (to find newly added
untranslated strings) and the direction doctor (to read the site's stylesheets). Nothing of yours
is sent in either. The one exception to data leaving your device: if you enable the optional
cross-device sync (off by default), the corrections and smart rules you wrote yourself — never
your settings, and never any of your content or conversations — are carried by Chrome's own sync
to your Google account, **which Google may be able to read unless you set a sync passphrase in
Chrome itself**; buttons to stop it and to wipe what was uploaded remain yours. We say
it this precisely because an overreaching claim is weaker than an exact one, and this is open
source: verify it yourself. See the [privacy policy](PRIVACY.md).

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
