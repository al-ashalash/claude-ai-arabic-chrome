# سياسة الخصوصية — تعريب كلود (غير رسمي)

**آخر تحديث: 2026-08-01**

## بالعربية

لا يجمع هذا الامتداد أي بيانات شخصية، **ولا يخزّن شيئًا مما يظهر على شاشتك ولا يرسله إلى أي
جهة**. يعمل بالكامل داخل متصفحك.

### كيف يعمل بالضبط — بلا تهويل ولا تهوين

ليترجم الامتداد تسميةً في الواجهة فلا بدّ أن **يطابقها** أولًا. فهو إذن **يقرأ** نصوص
الصفحة أثناء مروره عليها، ويقارن كل نصّ بقاموسٍ مضمَّن داخل الامتداد نفسه: فإن وجد له
ترجمةً كتبها مكانه، وإلّا تركه كما هو ونسيه.

**والفرق الذي يعنيك:** القراءة **عابرة للمطابقة وحدها**. لا شيء مما يُقرأ يُخزَّن، ولا
يُراكَم، ولا يُرسَل — لا إلى تخزين، ولا إلى خادم، ولا إلى أي مكان. والكتابة الدائمة الوحيدة
هي تفضيلاتُك التي تختارها والتصحيحاتُ التي تكتبها بنفسك.

ونقول هذا بدقّة لأن الوعد المتجاوِز أضعفُ من الوعد الدقيق: المشروع مفتوح المصدر، فكلُّ
سطرٍ هنا يمكنك التحقق منه بنفسك.

- **نصّ محادثاتك مستثنًى أصلًا:** الترجمة لا تلمس متن الرسائل إطلاقًا — لا رسائلك ولا ردود
  Claude. (انظر `inChatContent` في `engine.js`.)
- **لا يحتفظ بشيء:** لا عناوين محادثاتك، ولا أسماء مشاريعك، ولا نصوص رسائلك، ولا أي شيء تراه.
- **لا اتصال بأي خادم للامتداد:** لا يستخدم أي خدمة خارجية أو طرف ثالث، وكل ملفاته
  (القاموس والخطوط) مضمّنة محليًّا.
- **الصلاحية الوحيدة `storage`:** لحفظ تفضيلاتك (تشغيل/إيقاف، الاتجاه، والكلمات التي تصحّحها)
  محليًّا على جهازك. لا تُشارَك مع أي جهة.
- **«فحص الموقع» يجري بضغطة منك وحدك:** ولا يقرأ إلا ملفات البرمجة العامة للموقع (وهي نفسها
  التي ينزّلها متصفحك لعرض الصفحة) ليستخرج منها نصوص الواجهة ويعرف ما لم يُترجَم بعد.
  **لا يمسّ صفحتك ولا محتواك**، ولا يتصل بغير موقع claude.ai، والنتيجة تبقى على جهازك.

- **عند الإزالة:** يمحو المتصفح تلقائيًّا كل ما حُفظ محليًّا؛ لا يبقى شيء ولا يُرسَل شيء.

### كيف أُنجزت الترجمة

بُني القاموس بمعونة **Claude Code** (أداة Anthropic للبرمجة بالذكاء الاصطناعي)، على قواعد
مصطلحية ثابتة وضعها صاحب المشروع، ومرّ كل نصّ بتدقيق آلي ومراجعة. ونحن نصرّح بهذا لأن
المستخدم من حقه أن يعرف كيف صُنع ما يقرؤه.

ومع ذلك تبقى في الترجمة أخطاء ولا بدّ. **ولهذا صُنعت «الكلمات المحفوظة»**: ما استُشكل عليك
صحّحه لنفسك في ثانية، أو اقترحه للجميع على مستودع المشروع — فالمشروع مفتوح المصدر، والقاموس
كله متاح للقراءة والتدقيق.

الامتداد مستقل وغير رسمي، وليس من إنتاج شركة Anthropic ولا تابعًا لها. «Claude» و«Claude.ai»
علامتان تجاريتان لمالكهما.

---

## In English

This extension collects no personal data, **stores nothing of what appears on your screen, and
sends nothing anywhere**. It runs entirely inside your browser.

### Exactly how it works — stated precisely

To translate an interface label, the extension must first **match** it. So yes: it reads text on
the page as it walks the DOM, comparing each string against a dictionary bundled inside the
extension itself. If a translation exists, it writes it in place; if not, it leaves the text
alone and forgets it.

**The distinction that matters to you:** those reads are **transient and match-only**. Nothing
read from the page is stored, accumulated, or transmitted — not to storage, not to a server, not
anywhere. The only persistent writes are the preferences you choose and the corrections you type
yourself.

We state it this precisely because a claim that overreaches is weaker than an exact one: the
project is open source, so every line of this is yours to verify.

- **Conversation content is excluded outright:** translation never touches message prose — neither
  yours nor Claude's. (See `inChatContent` in `engine.js`.)
- **It keeps nothing:** no chat titles, project names, message text, or anything else you see.
- **No network calls of its own:** no external service or third party; all files (dictionary and
  fonts) are bundled locally.
- **The only permission, `storage`,** saves your preferences (on/off, direction, and terms you
  fix) locally on your device. Nothing is shared.
- **"Site scan" runs only when you press the button,** and reads only the site's public JavaScript
  bundles — the same files your browser already downloads to render the page — to extract
  interface strings and find those not translated yet. **It does not touch your page or your
  content**, contacts no origin other than claude.ai, and the result stays on your device.

- **On uninstall,** the browser automatically erases everything stored locally.

### How the translation was made

The dictionary was built with the help of **Claude Code** (Anthropic's AI coding tool), following
a fixed terminology rulebook set by the project's author, with automated validation and review of
every string. We state this plainly because you deserve to know how what you read was made.

Errors nonetheless remain. **That is precisely why "saved terms" exists**: fix anything that reads
wrong for yourself in seconds, or propose it for everyone on the project's repository — the project
is open source and the entire dictionary is there to read and audit.

This is an independent, unofficial extension, not created by or affiliated with Anthropic.
"Claude" and "Claude.ai" are trademarks of their owner.
