# سياسة الخصوصية — تعريب كلود (غير رسمي)

**آخر تحديث: 2026-09-03**

## بالعربية

لا يجمع هذا الامتداد أي بيانات شخصية، **ولا يخزّن شيئًا مما يظهر على شاشتك ولا يرسله إلى أي
جهة**. يعمل بالكامل داخل متصفحك. الاستثناء الوحيد: إن فعّلتَ المزامنة الاختيارية (وهي مطفأة
افتراضيًّا) رُفعت تصحيحاتُك وقواعدُك — دون إعداداتك ودون شيءٍ من محتواك أو محادثاتك — عبر
مزامنة كروم إلى حسابك في جوجل، وتبقى لك أزرار إيقافها ومسح ما رُفع. (التفصيل في قسم
«المزامنة الاختيارية» أدناه.)

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
- **لا خادم لنا ولا خدمة خارجية:** لا تحليلات ولا تتبّع ولا طرف ثالث، وكل ملفاته
  (القاموس والخطوط) مضمّنة محليًّا. والطلبات الشبكية الوحيدة التي يفتحها الامتداد
  تقع **بضغطةٍ منك** وتقصد ملفات claude.ai العامة وحدها: «فحص الموقع» و«طبيب
  الاتجاه» (الموصوفان أدناه) — لا يُرسَل فيهما شيءٌ من عندك. (والمزامنة الاختيارية
  أدناه لا يفتح لها الامتداد اتصالًا أصلًا: المتصفح نفسه ينقلها ضمن مزامنة حسابك.)
- **الصلاحية الوحيدة `storage`:** لحفظ تفضيلاتك (تشغيل/إيقاف، الاتجاه، والكلمات التي تصحّحها)
  محليًّا على جهازك. لا تُشارَك مع أي جهة إلا ما اخترته أنت في «المزامنة الاختيارية» أدناه.
- **«فحص الموقع» يجري بضغطة منك وحدك:** ولا يقرأ إلا ملفات البرمجة العامة للموقع (وهي نفسها
  التي ينزّلها متصفحك لعرض الصفحة) ليستخرج منها نصوص الواجهة ويعرف ما لم يُترجَم بعد.
  **لا يمسّ صفحتك ولا محتواك**، والنتيجة تبقى على جهازك.

- **«طبيب الاتجاه» كذلك يجري بضغطة منك وحدك:** يقرأ ملفات التنسيق (CSS) العامة للموقع
  ليكشف ما استجدّ منها ولا يقلبه محرّك الاتجاه بعد. ونطاق ما يطلبه الفحصان: أصلُ الصفحة
  نفسه، وclaude.ai، وanthropic.com (فمن هناك يُقدِّم الموقعُ ملفاته) — **ولا يُرسَل في
  أيٍّ منهما شيءٌ من عندك**، إنما تُقرأ ملفات الموقع كما يقرؤها متصفحك.

- **عند الإزالة:** يمحو المتصفح تلقائيًّا كل ما حُفظ محليًّا؛ لا يبقى شيء ولا يُرسَل شيء.
  (ما في مساحة المزامنة — إن كنت فعّلتها — يتبع حسابك لا جهازك؛ انظر القسم التالي.)

### المزامنة الاختيارية بين أجهزتك

الاستثناء الوحيد للقاعدة أعلاه: إن فعّلتَ المزامنة الاختيارية (وهي مطفأة افتراضيًّا) رُفعت
تصحيحاتُك وقواعدُك — دون إعداداتك ودون شيءٍ من محتواك أو محادثاتك — عبر مزامنة كروم إلى
حسابك في جوجل، وتبقى لك أزرار إيقافها ومسح ما رُفع. وتفصيل ذلك:

- **مطفأة افتراضيًّا**، ولا تُفعَّل إلا بموافقة صريحة من صفحة الإعدادات، بعد لوحةٍ تعرض
  عليك كلَّ ما يلي قبل الكتابة.
- **ما الذي يُرفع:** تصحيحاتُك التي كتبتها بنفسك وقواعدُك الذكية — لا غير.
- **إلى أين:** بنية مزامنة كروم (`chrome.storage.sync`) المرتبطة بحسابك في جوجل. الامتداد
  نفسه لا يفتح أي اتصال شبكي؛ المتصفح هو من ينقل هذه البيانات ضمن مزامنة حسابك.
  **وجوجل قد تطّلع عليها ما لم تفعّل عبارة مرور المزامنة في كروم نفسه.**
- **ما لا يُرفع أبدًا:** إعداداتك (تبقى لكل جهاز على حدة)، ونتائج الفحص، وأي شيء يُقرأ
  من الصفحات.
- **التعطيل لا يمسح ما رُفع:** إيقاف المزامنة يوقف الرفع من جهازك ولا يمسّ ما في حسابك —
  ولذلك في صفحة الإعدادات زرٌّ مستقل «امسح ما رُفع من حسابك» يمحو بيانات الامتداد وحدها
  من مساحة المزامنة.
- **عند إزالة الامتداد:** ما في مساحة المزامنة قد يبقى في حسابك ويعود عند إعادة التثبيت —
  فإن أردت محوه يقينًا فاضغط «امسح ما رُفع من حسابك» قبل الإزالة.

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
sends nothing anywhere**. It runs entirely inside your browser. The one exception: if you enable
the optional cross-device sync (off by default), the corrections and smart rules you wrote
yourself — never your settings, and never any of your content or conversations — are carried by Chrome's own
sync to your Google account, and buttons to stop it and to wipe what was uploaded remain yours.
(Details in the "Optional sync" section below.)

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
- **No server of ours, and no third-party service:** no analytics, no tracking; all files
  (dictionary and fonts) are bundled locally. The only network requests the extension ever opens
  happen **when you press a button** and fetch claude.ai's own public files: the site scan and the
  direction doctor (both below) — nothing of yours is sent in either. (The optional sync below
  opens no connection at all from the extension: the browser itself carries that data as part of
  your account's sync.)
- **The only permission, `storage`,** saves your preferences (on/off, direction, and terms you
  fix) locally on your device. Nothing is shared beyond what you yourself opt into under
  "Optional sync" below.
- **"Site scan" runs only when you press the button,** and reads only the site's public JavaScript
  bundles — the same files your browser already downloads to render the page — to extract
  interface strings and find those not translated yet. **It does not touch your page or your
  content**, and the result stays on your device.

- **"Direction doctor" likewise runs only when you press it:** it reads the site's public CSS to
  find newly shipped rules the direction engine does not mirror yet. Both features request only
  the page's own origin, claude.ai, and anthropic.com (where the site serves its assets from) —
  and **neither sends anything of yours**; they read the site's files as your browser does.

- **On uninstall,** the browser automatically erases everything stored locally. (Data in the
  sync area — if you ever enabled sync — follows your account, not your device; see the next
  section.)

### Optional sync between your devices

The one exception to the rule above: if you enable the optional sync (off by default), the
corrections and smart rules you wrote yourself — never your settings, and never any of your
content or conversations — are carried by Chrome's own sync to your Google account, **which
Google may be able to read unless you set a sync passphrase in Chrome itself**; buttons to stop
it and to wipe what was uploaded remain yours. In detail:

- **Off by default.** It activates only after an explicit consent panel in the options page
  that states everything below before anything is written.
- **What is uploaded:** the corrections you typed yourself and your smart rules — nothing else.
- **Where to:** Chrome's sync infrastructure (`chrome.storage.sync`), tied to your Google
  account. The extension itself opens no network connection; the browser carries this data as
  part of your account's sync. **Google may be able to read it unless you set a sync passphrase
  in Chrome itself.**
- **What is never uploaded:** your settings (they stay per device), scan results, and anything
  read from pages.
- **Turning sync off does not erase what was uploaded:** it only stops uploads from that
  device and leaves your account untouched — which is why a separate "wipe what was uploaded"
  button exists in the options page; it removes this extension's data alone from the sync area.
- **On uninstall,** data in the sync area may remain in your account and reappear on
  reinstall — press the wipe button first if you want it gone for certain.

### How the translation was made

The dictionary was built with the help of **Claude Code** (Anthropic's AI coding tool), following
a fixed terminology rulebook set by the project's author, with automated validation and review of
every string. We state this plainly because you deserve to know how what you read was made.

Errors nonetheless remain. **That is precisely why "saved terms" exists**: fix anything that reads
wrong for yourself in seconds, or propose it for everyone on the project's repository — the project
is open source and the entire dictionary is there to read and audit.

This is an independent, unofficial extension, not created by or affiliated with Anthropic.
"Claude" and "Claude.ai" are trademarks of their owner.
