<div dir="rtl">

# تعريب كلود للويب

**إضافة متصفح تعرض واجهة [claude.ai](https://claude.ai) بالعربية، بالاتجاه من اليمين إلى اليسار.**

مشروع مستقل غير رسمي · محليّ بالكامل · إذن واحد (`storage`) · مفتوح المصدر

---

## لماذا؟

واجهة claude.ai تدعم إحدى عشرة لغة رسميًّا، وليست العربية منها. ودعمُ الاتجاه من اليمين
إلى اليسار ناقص، فالنصّ العربي يُحاذى يسارًا، ويختلّ ترتيبُه إذا خالطته إنجليزيةٌ أو أرقام أو
تعليمات برمجية. هذه الإضافة تسدّ الأمرين معًا: **تترجم الواجهة، وتعكس اتجاهها**.

## ما تفعله

| | |
|---|---|
| **ترجمة الواجهة** | قاموس فيه أكثر من **27,900** مفردة، يغطي نحو **96%** من نصوص الموقع (والباقي أسماءُ علاماتٍ ومعرِّفاتٌ تقنية لا تُترجَم) |
| **قواعد ذكية** | أكثر من **3,200** قاعدة للنصوص المتغيّرة (التواريخ، «قبل 3 أيام»، «الرسالة 1 من 2»…) |
| **صيغ الجمع العربية** | الفئات الست (`zero/one/two/few/many/other`) — لا «3 محادثة» ولا «11 محادثات» |
| **الاتجاه من اليمين إلى اليسار** | عكسُ التخطيط بورقةٍ تُبنى من ملفات تصميم الموقع نفسها وتُعاد كلما تغيّرت، واتجاهٌ مستقلٌّ لكل فقرة في المحادثة، والتعليمات البرمجية تبقى من اليسار |
| **تصحيح شخصي** | ابحث في القاموس كله وعدّل أي ترجمة لنفسك |
| **فحص الموقع وفحص الاتجاه** | بضغطة منك: يقرآن ملفات claude.ai العامة ليجدا ما استُجدّ ولم يُترجَم، وتنسيقاتٍ لم تُعكس بعد |

## الخصوصية — بدقّة

لتترجم الإضافةُ تسميةً فلا بدّ أن **يطابقها**، فهو إذن يقرأ نصوص الصفحة أثناء مروره عليها
ويقارنها بقاموسٍ مضمَّن داخله. **والفرق الذي يعنيك أن هذه القراءة عابرة للمطابقة وحدها:**

- **لا يُخزَّن شيء مما يُقرأ، ولا يُراكَم، ولا يُرسَل** — لا إلى تخزين، ولا إلى خادم، ولا إلى
  أي مكان. والكتابة الدائمة الوحيدة تفضيلاتُك وتصحيحاتُك التي تكتبها بنفسك.
- **نصّ المحادثات مستثنًى أصلًا** فلا تلمسه الترجمة — لا رسائلك ولا ردود Claude.
- **لا خادم لنا ولا خدمة خارجية.** لا تحليلات ولا تتبّع. والطلبات الشبكية التي تفتحها
  الإضافة ثلاثة، كلها تقصد **ملفات الموقع العامة وحدها** (على claude.ai وanthropic.com
  حيث يقدّم الموقع ملفاته) ولا يُرسَل فيها شيءٌ من عندك: (١) **محرّك الاتجاه** يقرأ تلقائيًّا
  ملفات التنسيق (CSS) التي حمّلها متصفحك للصفحة نفسها — عند أول تشغيل وعند كل تغيّر في
  نسخة الموقع — ليبني منها ورقة العكس ويحفظها على جهازك (ويمكنك إيقاف ذلك باختيار المحرّك
  «المبسّط» في الإعدادات)؛ (٢) «فحص الموقع» (ليجد ما استُجدّ ولم يُترجَم) و(٣) «فحص
  الاتجاه» (ليُظهر ما لم يُعكس بعد) يجريان **بضغطةٍ منك وحدك**.
- **الاستثناء الوحيد لمغادرة بياناتك جهازك:** إن فعّلتَ المزامنة الاختيارية (وهي متوقّفة
  ما لم تُفعّلها) حمل **كرومُ نفسُه** تصحيحاتِك وقواعدَك — دون إعداداتك ودون شيءٍ من محتواك
  أو محادثاتك — إلى حسابك في جوجل بمزامنته المعتادة، لا باتصالٍ تفتحه الإضافة.
  **وجوجل قد تطّلع عليها ما لم تفعّل عبارة مرور المزامنة في كروم نفسه.** وتبقى لك
  أزرار إيقافها ومسح ما رُفع.
- **لا تطلب الوصول إلى أي موقع غير claude.ai.** وستعرض لك كروم عند التثبيت عبارتها
  المعيارية «قراءة بياناتك وتغييرها على claude.ai» — وهي الصيغة التي تصف بها كلَّ إضافة
  تعمل داخل صفحة، ومعناها هنا أن الإضافة تكتب الترجمة داخل الصفحة. والإذن الوحيد الذي
  تطلبه سوى ذلك `storage` لحفظ تفضيلاتك على جهازك.

نقولها بهذه الدقّة لأن الوعد المتجاوِز أضعفُ من الوعد الدقيق: المشروع مفتوح المصدر،
فكلُّ سطرٍ من هذا يمكنك التحقق منه بنفسك. التفصيل في [سياسة الخصوصية](PRIVACY.md).

## التثبيت

**من متجر Chrome:** *(قريبًا)* — وما الجديد والقيود المعروفة في [سجلّ الإصدارات](CHANGELOG.md).

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
> الإرشادية وحدها متى كان الإذن ناقصًا — واضغط «منح الإذن لموقع claude.ai»، ثم حدّث
> تبويبات claude.ai المفتوحة.

---

## كيف أُنجزت الترجمة — إفصاح

بُني هذا القاموس **بمعونة [Claude Code](https://claude.com/claude-code)** (أداة Anthropic
للبرمجة بالذكاء الاصطناعي)، على قواعد مصطلحية ثابتة وضعها صاحب المشروع:

- ما يبقى إنجليزيًّا (العلامات التجارية والمصطلحات التقنية) وما يُترجَم.
- مصطلحاتُ الذكاء الاصطناعي مُسنَدةٌ إلى **معجم البيانات والذكاء الاصطناعي** (مجمع الملك سلمان العالمي للغة العربية وسدايا، الإصدار الثالث على منصة سوار) حيث وافق مقابلُ المعجم سياقَ الواجهة، وإلا فالمعروفُ في واجهات الأجهزة مع تسجيل مقابل المعجم بديلًا.
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
| `_rtltest.html` | محرّك الاتجاه: العكس المنطقي وجزر LTR والناتج المولَّد |
| `_termstest.html` | البحث في القاموس والتصحيح الشخصي |
| `_synctest.html` | المزامنة الاختيارية: التعقيم والدمج والتمزّق والإصلاح |
| `_thumbtest.html` | المؤشر المنزلق والأسطح التي يحسبها الموقع بنفسه |

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
extension requests no host permissions — only `storage` (Chrome's install screen shows its standard
"read and change your data on claude.ai" line because the extension writes translations into that
one site's pages; it asks for no other site). There is no server of ours and no third-party
service. The extension makes three kinds of network request, all for the site's own public asset
files (served from claude.ai and anthropic.com), and nothing of yours is sent in any of them:
(1) the RTL engine automatically reads the stylesheets your browser already loaded for the page — on
first run and whenever the site ships a new version — to build its mirroring sheet, which it caches
locally (choose the "simplified" engine in the options to turn this off); (2) the site scan (to find
newly added untranslated strings) and (3) the direction check (to find styles not yet mirrored)
run **only when you press a button**. The one exception to data leaving your device: if you enable the optional
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
