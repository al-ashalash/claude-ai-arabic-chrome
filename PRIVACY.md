# سياسة الخصوصية — تعريب كلود (غير رسمي)

**آخر تحديث: 2026-09-18**

## بالعربية

لا تجمع هذه الإضافة أي بيانات شخصية، **ولا تخزّن شيئًا مما يظهر على شاشتك ولا ترسله إلى أي
جهة**. تعمل بالكامل داخل متصفحك. الاستثناء الوحيد: إن فعّلتَ المزامنة الاختيارية (وهي متوقّفة
ما لم تُفعّلها) رُفعت تصحيحاتُك وقواعدُك — دون إعداداتك ودون شيءٍ من محتواك أو محادثاتك — عبر
مزامنة كروم إلى حسابك في جوجل، وتبقى لك أزرار إيقافها ومسح ما رُفع. (التفصيل في قسم
«المزامنة الاختيارية» أدناه.)

### كيف يعمل بالضبط — بلا تهويل ولا تهوين

لتترجم الإضافةُ تسميةً في الواجهة فلا بدّ أن **تطابقها** أولًا. فهي إذن **تقرأ** نصوص
الصفحة أثناء مرورها عليها، وتقارن كل نصّ بقاموسٍ مضمَّن داخل الإضافة نفسها: فإن وجدت له
ترجمةً كتبتها مكانه، وإلّا تركته كما هو ونسيته.

**والفرق الذي يعنيك:** القراءة **عابرة للمطابقة وحدها**. لا شيء مما يُقرأ يُخزَّن، ولا
يُراكَم، ولا يُرسَل — لا إلى تخزين، ولا إلى خادم، ولا إلى أي مكان. والكتابة الدائمة الوحيدة
هي تفضيلاتُك التي تختارها والتصحيحاتُ التي تكتبها بنفسك.

ونقول هذا بدقّة لأن الوعد المتجاوِز أضعفُ من الوعد الدقيق: المشروع مفتوح المصدر، فكلُّ
سطرٍ هنا يمكنك التحقق منه بنفسك.

- **نصّ محادثاتك مستثنًى أصلًا:** الترجمة لا تلمس متن الرسائل إطلاقًا — لا رسائلك ولا ردود
  Claude. (انظر `inChatContent` في `engine.js`.)
- **لا تحتفظ بشيء:** لا عناوين محادثاتك، ولا أسماء مشاريعك، ولا نصوص رسائلك، ولا أي شيء تراه.
- **لا تجمع بيانات ولا تستعين بخدمة خارجية:** كل ملفاتها (القاموس والخطوط) مضمّنة
  محليًّا. والطلبات الشبكية التي تفتحها الإضافة ثلاثة، كلها
  تقصد **ملفات الموقع العامة وحدها** — على أصل الصفحة نفسه، وclaude.ai، وanthropic.com
  (فمن هناك يُقدِّم الموقعُ ملفاته) — **ولا يُرسَل في أيٍّ منها شيءٌ من عندك**، إنما
  تُقرأ ملفات الموقع كما يقرؤها متصفحك. (والمزامنة الاختيارية أدناه لا تفتح لها الإضافة
  اتصالًا أصلًا: المتصفح نفسه ينقلها ضمن مزامنة حسابك.)
- **الإذن الوحيد `storage`:** لحفظ تفضيلاتك (تشغيل/إيقاف، الاتجاه، والكلمات التي تصحّحها)
  محليًّا على جهازك. لا تُشارَك مع أي جهة إلا ما اخترته أنت في «المزامنة الاختيارية» أدناه.
  (وستعرض لك كروم عند التثبيت عبارتها المعيارية «قراءة بياناتك وتغييرها على claude.ai»
  لأن الإضافة تكتب الترجمة داخل صفحات هذا الموقع وحده — ولا تطلب أي موقع آخر.)
- **(١) محرّك الاتجاه يقرأ ملفات التنسيق تلقائيًّا:** المحرّك «الشامل» (الافتراضي) يأخذ
  عناوين ملفات التنسيق (CSS) التي حمّلها متصفحك للصفحة نفسها، ويقرؤها نصًّا عند أول
  تشغيل وعند كل تغيّر في نسخة الموقع، ليبني منها ورقة العكس ويحفظها على جهازك (حتى
  ٢ ميغابايت في `storage`). لا يقرأ صفحتك ولا محتواك، ولا يُرسَل شيء. ويمكنك إيقاف
  هذه القراءة التلقائية باختيار المحرّك «المبسّط» في الإعدادات (ورقةٌ ثابتة مضمّنة).
- **(٢) «فحص الموقع» يجري بضغطة منك وحدك:** ولا يقرأ إلا ملفات البرمجة العامة للموقع (وهي
  نفسها التي ينزّلها متصفحك لعرض الصفحة) نصًّا ليستخرج منها عبارات الواجهة ويعرف ما لم
  يُترجَم بعد — ولا يُنفَّذ منها شيء. **لا يمسّ صفحتك ولا محتواك**، والنتيجة تبقى على جهازك.
- **(٣) «فحص الاتجاه» كذلك يجري بضغطة منك وحدك:** يقرأ ملفات التنسيق العامة نفسها ليكشف
  ما استجدّ منها ولا يعكسه محرّك الاتجاه بعد. والنتيجة تبقى على جهازك.

- **عند الإزالة:** يمحو المتصفح تلقائيًّا كل ما حُفظ محليًّا؛ لا يبقى شيء ولا يُرسَل شيء.
  (ما في مساحة المزامنة — إن كنت فعّلتها — يتبع حسابك لا جهازك؛ انظر القسم التالي.)

### المزامنة الاختيارية بين أجهزتك

الاستثناء الوحيد للقاعدة أعلاه: إن فعّلتَ المزامنة الاختيارية (وهي متوقّفة ما لم تُفعّلها) رُفعت
تصحيحاتُك وقواعدُك — دون إعداداتك ودون شيءٍ من محتواك أو محادثاتك — عبر مزامنة كروم إلى
حسابك في جوجل، وتبقى لك أزرار إيقافها ومسح ما رُفع. وتفصيل ذلك:

- **متوقّفة ما لم تُفعّلها**، ولا تُفعَّل إلا بموافقة صريحة من صفحة الإعدادات، بعد لوحةٍ تعرض
  عليك كلَّ ما يلي قبل الكتابة.
- **ما الذي يُرفع:** تصحيحاتُك التي كتبتها بنفسك وقواعدُك الذكية — لا غير.
- **إلى أين:** بنية مزامنة كروم (`chrome.storage.sync`) المرتبطة بحسابك في جوجل. الإضافة
  نفسها لا تفتح أي اتصال شبكي؛ المتصفح هو من ينقل هذه البيانات ضمن مزامنة حسابك.
  **وجوجل قد تطّلع عليها ما لم تفعّل عبارة مرور المزامنة في كروم نفسه.**
- **ما لا يُرفع أبدًا:** إعداداتك (تبقى لكل جهاز على حدة)، ونتائج الفحص، وأي شيء يُقرأ
  من الصفحات.
- **التعطيل لا يمسح ما رُفع:** إيقاف المزامنة يوقف الرفع من جهازك ولا يمسّ ما في حسابك —
  ولذلك في صفحة الإعدادات زرٌّ مستقل «مسح ما رُفع من حسابك» يمحو بيانات الإضافة وحدها
  من مساحة المزامنة.
- **عند إزالة الإضافة:** ما في مساحة المزامنة قد يبقى في حسابك ويعود عند إعادة التثبيت —
  فإن أردت محوه يقينًا فاضغط «مسح ما رُفع من حسابك» قبل الإزالة.

### كيف أُنجزت الترجمة

بُني القاموس بمعونة **Claude Code** (أداة Anthropic للبرمجة بالذكاء الاصطناعي)، على قواعد
مصطلحية ثابتة وضعها صاحب المشروع، ومرّ كل نصّ بتدقيق آلي ومراجعة. ونحن نصرّح بهذا لأن
المستخدم من حقه أن يعرف كيف صُنع ما يقرؤه.

ومع ذلك تبقى في الترجمة أخطاء ولا بدّ. **ولهذا صُنعت «الكلمات المحفوظة»**: ما استُشكل عليك
صحّحه لنفسك في أي وقت، أو اقترحه للجميع على مستودع المشروع — فالمشروع مفتوح المصدر، والقاموس
كله متاح للقراءة والتدقيق.

الإضافة مستقلة وغير رسمية، وليست من إنتاج شركة Anthropic ولا تابعة لها. «Claude» و«Claude.ai»
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
- **Collects no data and uses no external service:** all files (dictionary and fonts) are
  bundled locally. The extension opens three kinds of network request,
  all of them for **the site's own public asset files only** — on the page's own origin, claude.ai,
  and anthropic.com (where the site serves its assets from) — and **nothing of yours is sent in any
  of them**; they read the site's files as your browser does. (The optional sync below opens no
  connection at all from the extension: the browser itself carries that data as part of your
  account's sync.)
- **The only permission, `storage`,** saves your preferences (on/off, direction, and terms you
  fix) locally on your device. Nothing is shared beyond what you yourself opt into under
  "Optional sync" below. (Chrome's install screen shows its standard "read and change your data on
  claude.ai" line because the extension writes translations into that one site's pages; it asks
  for no other site.)
- **(1) The direction engine reads the site's stylesheets automatically:** the "comprehensive"
  engine (the default) takes the URLs of the CSS files your browser already loaded for the page and
  fetches them as text — on first run and whenever the site ships a new version — to build its
  mirroring sheet, which it caches on your device (up to 2 MB in `storage`). It reads neither your
  page nor your content, and sends nothing. Choosing the "simplified" engine in the options turns
  this automatic read off (a fixed bundled sheet is used instead).
- **(2) "Site scan" runs only when you press the button,** and reads only the site's public
  JavaScript bundles — the same files your browser already downloads to render the page — as text,
  to extract interface strings and find those not translated yet; nothing fetched is ever executed.
  **It does not touch your page or your content**, and the result stays on your device.
- **(3) "Direction check" likewise runs only when you press it:** it reads the same public CSS to
  find newly shipped rules the direction engine does not mirror yet. The result stays on your device.

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
