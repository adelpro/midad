/**
 * midad string dictionary — Arabic-first with English.
 * All user-facing copy lives here; components pull via `useT()`.
 */

export type Language = 'ar' | 'en';

export interface Translation {
  appName: string;
  appNameLatin: string;
  tagline: string;
  common: {
    cancel: string;
    done: string;
    save: string;
    delete: string;
    share: string;
    back: string;
    next: string;
    start: string;
    open: string;
    close: string;
    more: string;
    rename: string;
    duplicate: string;
    lock: string;
    unlock: string;
    loading: string;
    confirm: string;
    undo: string;
  };
  tabs: {
    gallery: string;
    settings: string;
    more: string;
  };
  onboarding: {
    welcome: string;
    sub: string;
    slide1Title: string;
    slide1Body: string;
    slide2Title: string;
    slide2Body: string;
    slide3Title: string;
    slide3Body: string;
    chooseLanguage: string;
    arabic: string;
    english: string;
    continueLabel: string;
    startLabel: string;
    skip: string;
  };
  gallery: {
    title: string;
    emptyTitle: string;
    emptyBody: string;
    newDesign: string;
    untitled: string;
    importDesigns: string;
    importFailed: string;
    copySuffix: string;
    importFailedHint: string;
    /**
     * Row actions. `pin`/`unpin` are also used as screen-reader custom action
     * labels, so they must read as verbs.
     */
    pin: string;
    unpin: string;
    pinned: string;
    rowActions: string;
    /** 5s undo notice after a delete, e.g. "Deleted “Sketch”". */
    deletedNotice: string;
  };
  settings: {
    title: string;
    languageSection: string;
    languageHint: string;
    themeSection: string;
    themeHint: string;
    themeSystem: string;
    themeLight: string;
    themeDark: string;
    defaultsSection: string;
    defaultCanvas: string;
    aboutSection: string;
    aboutBody: string;
    aboutLink: string;
    privacyLink: string;
    version: string;
    credits: string;
    restartNotice: string;
    autoSaveSection: string;
    autoSaveHint: string;
    autoSaveOn: string;
    autoSaveOff: string;
    autoSaveInterval: string;
    autoSaveIntervalHint: string;
    autoSaveEvery10s: string;
    autoSaveEvery30s: string;
    autoSaveEvery1m: string;
    autoSaveEvery5m: string;
    onboardingSection: string;
    onboardingReplay: string;
    onboardingReplayHint: string;
  };
  aboutPage: {
    title: string;
    body: string;
    mission: string;
    versionLabel: string;
    developedBy: string;
  };
  privacyPage: {
    title: string;
    summary: string;
    localData: string;
    analytics: string;
    contact: string;
  };
  editor: {
    newProject: string;
    projectName: string;
    canvasSize: string;
    background: string;
    select: string;
    multiSelect: string;
    text: string;
    glyphs: string;
    shapes: string;
    // The two groups the ornament library splits its tiles into.
    glyphMarks: string;
    glyphLetters: string;
    // Shape names, used as the library's tile labels.
    shapeCircle: string;
    shapeSquare: string;
    shapeLine: string;
    shapeStar: string;
    shapeTriangle: string;
    shapeRing: string;
    shapeDiamond: string;
    shapePentagon: string;
    shapeHexagon: string;
    shapeOctagon: string;
    shapeCrescent: string;
    shapeArch: string;
    colors: string;
    undo: string;
    redo: string;
    zoom: string;
    grid: string;
    export: string;
    saveProject: string;
    backgroundImage: string;
    bgImagePick: string;
    bgImageClear: string;
    transparent: string;
    paper: string;
    enterText: string;
    exportShareImage: string;
    exportSaveToPhotos: string;
    exportSvgAction: string;
    exportProjectFile: string;
    exporting: string;
    exportFailed: string;
    saveToPhotosDenied: string;
    saving: string;
    saved: string;
    saveFailed: string;
    selectedCount: string;
    /**
     * The collection bar's head over a whole collection, e.g. "Group · 3" /
     * "مجموعة · 3".
     *
     * A format rather than a label: the number is the point, and the word only
     * says what is being counted.
     */
    collectionGroup: string;
    // Splitting a word into independently editable parts.
    split: string;
    rejoin: string;
    parts: string;
    splitNeedsTwoParts: string;
    splitWrapped: string;
    splitFailed: string;
    // Style navigator and per-object style sheet.
    style: string;
    fontSize: string;
    lineHeight: string;
    opacity: string;
    align: string;
    alignLeft: string;
    alignCenter: string;
    alignRight: string;
    // Help sheet and learn mode.
    helpTitle: string;
    helpIntro: string;
    learnHint: string;
    helpAllTools: string;
    learnPaused: string;
    // Text preview in the text sheet.
    preview: string;
    previewSample: string;
    hints: {
      back: string;
      undo: string;
      redo: string;
      grid: string;
      save: string;
      export: string;
      scaleUp: string;
      scaleDown: string;
      rotateCcw: string;
      rotateCw: string;
      flipH: string;
      fitText: string;
      duplicate: string;
      bringToFront: string;
      sendToBack: string;
      delete: string;
      multiSelect: string;
      alignLeft: string;
      alignCenterH: string;
      alignRight: string;
      alignTop: string;
      alignMiddleV: string;
      alignBottom: string;
      centerH: string;
      centerV: string;
      split: string;
      rejoin: string;
      group: string;
      ungroup: string;
      stylePrev: string;
      styleNext: string;
      partPrev: string;
      partNext: string;
      partLabel: string;
      /**
       * A member of a plain collection, e.g. "Element 2 of 3". A split word
       * keeps `partLabel`, because "part" is what its members are.
       */
      memberLabel: string;
    };
  };
}

export const strings: Record<Language, Translation> = {
  ar: {
    appName: 'مداد',
    appNameLatin: 'midad',
    tagline: 'الخط العربي، بلمسة حبرية',
    common: {
      cancel: 'إلغاء',
      done: 'تم',
      save: 'حفظ',
      delete: 'حذف',
      share: 'مشاركة',
      back: 'رجوع',
      next: 'التالي',
      start: 'ابدأ',
      open: 'فتح',
      close: 'إغلاق',
      more: 'المزيد',
      rename: 'إعادة تسمية',
      duplicate: 'تكرار',
      lock: 'قفل',
      unlock: 'فتح القفل',
      loading: 'جارٍ التحميل…',
      confirm: 'تأكيد',
      undo: 'تراجع',
    },
    tabs: {
      gallery: 'لوحتي',
      settings: 'الإعدادات',
      more: 'المزيد',
    },
    onboarding: {
      welcome: 'مرحباً بك في مداد',
      sub: 'استوديو الخط العربي — صمّم لوحاتك بنفسك.',
      slide1Title: 'كوّن لوحتك بنفسك',
      slide1Body:
        'أضِف كلماتك، وحرّك مقاطعها، واربطها بحرّيةٍ لتشكيل لوحةٍ خطّيةٍ فريدة.',
      slide2Title: 'خطوطٌ أصيلة من التراث',
      slide2Body:
        'من النسخ إلى الثلث والكوفي، مجموعةُ خطوطٍ عربيةٍ تليق بإبداعك.',
      slide3Title: 'صدّر لوحتك وشاركها',
      slide3Body: 'احفظ تصميمك بجودةٍ عاليةٍ وشاركه مع العالم في لحظات.',
      chooseLanguage: 'اختر لغة الواجهة',
      arabic: 'العربية',
      english: 'English',
      continueLabel: 'التالي',
      startLabel: 'ابدأ',
      skip: 'تخطَّ',
    },
    gallery: {
      title: 'لوحتي',
      emptyTitle: 'لا توجد تصاميم بعد',
      emptyBody: 'ابدأ رحلتك مع الخط العربي وأنشئ أول لوحة.',
      newDesign: 'تصميم جديد',
      untitled: 'دون عنوان',
      importDesigns: 'استيراد',
      importFailed: 'تعذّر استيراد الملف',
      copySuffix: ' — نسخة',
      importFailedHint: 'تأكد من أن الملف بصيغة ‎.midad صالح.',
      pin: 'تثبيت',
      unpin: 'إلغاء التثبيت',
      pinned: 'مثبّت',
      rowActions: 'خيارات التصميم',
      deletedNotice: 'تم حذف «{name}»',
    },
    settings: {
      title: 'الإعدادات',
      languageSection: 'اللغة',
      languageHint: 'لغة واجهة التطبيق',
      themeSection: 'المظهر',
      themeHint: 'مظهر واجهة التطبيق',
      themeSystem: 'تلقائي',
      themeLight: 'فاتح',
      themeDark: 'داكن',
      defaultsSection: 'الافتراضيات',
      defaultCanvas: 'مقاس اللوحة الافتراضي',
      aboutSection: 'حول',
      aboutBody: 'مداد — استوديو الخط العربي.',
      aboutLink: 'حول التطبيق',
      privacyLink: 'سياسة الخصوصية',
      version: 'الإصدار',
      credits: 'الخطوط مرخّصة بموجب رخصة SIL Open Font License',
      restartNotice: 'أعد تشغيل التطبيق ليُطبَّق اتجاه الواجهة الجديد بالكامل.',
      autoSaveSection: 'الحفظ التلقائي',
      autoSaveHint: 'حفظ التعديلات تلقائيًا أثناء العمل',
      autoSaveOn: 'مفعّل',
      autoSaveOff: 'معطّل',
      autoSaveInterval: 'الفاصل الزمني للحفظ',
      autoSaveIntervalHint: 'يحفظ أيضًا دوريًا أثناء التعديل المستمر',
      autoSaveEvery10s: '10 ثوانٍ',
      autoSaveEvery30s: '30 ثانية',
      autoSaveEvery1m: 'دقيقة',
      autoSaveEvery5m: '5 دقائق',
      onboardingSection: 'الجولة التعريفية',
      onboardingReplay: 'إظهار الجولة مرة أخرى',
      onboardingReplayHint: 'أعِد مشاهدة شاشات التعريف.',
    },
    aboutPage: {
      title: 'حول مداد',
      body: 'مداد هو استوديو عربي للتصميم والخط العربي. يساعدك على تجربة الأحجام، الألوان، الطباعة، والنسخ بأسلوب شخصي وسهل.',
      mission:
        'نهدف إلى جعل الفن العربي أكثر قربًا من كل مستخدم، مع أدوات بسيطة تركز على الإبداع لا على التعقيد.',
      versionLabel: 'الإصدار الحالي',
      developedBy:
        'تم تطوير التطبيق ليخدم كتابة ولوحات الخط العربي في كل مكان.',
    },
    privacyPage: {
      title: 'سياسة الخصوصية',
      summary:
        'نحترم خصوصيتك. لا نبيع أو نشارك بياناتك الشخصية مع أطراف خارجية.',
      localData:
        'يُحفظ محتوى لوحاتك محليًا على جهازك، ويُستخدم فقط لعرض أعمالك داخل التطبيق.',
      analytics:
        'لا نستخدم تحليلات متتبعة أو إعلانات تابعة في التطبيق، ولا نجمع بيانات استخدام مستمرة.',
      contact:
        'إذا كان لديك أي سؤال حول الخصوصية، يمكنك التواصل مباشرة من خلال التطبيق أو مراجعة إعدادات المشروع.',
    },
    editor: {
      newProject: 'لوحة جديدة',
      projectName: 'اسم التصميم',
      canvasSize: 'مقاس اللوحة',
      background: 'الخلفية',
      select: 'تحديد',
      multiSelect: 'تحديد متعدد',
      text: 'نص',
      glyphs: 'زخارف',
      shapes: 'أشكال',
      glyphMarks: 'الحركات',
      glyphLetters: 'أشكال الحروف',
      shapeCircle: 'دائرة',
      shapeSquare: 'مربع',
      shapeLine: 'خط',
      shapeStar: 'نجمة',
      shapeTriangle: 'مثلث',
      shapeRing: 'حلقة',
      shapeDiamond: 'معيّن',
      shapePentagon: 'مخمّس',
      shapeHexagon: 'مسدّس',
      shapeOctagon: 'مثمّن',
      shapeCrescent: 'هلال',
      shapeArch: 'طاق',
      colors: 'الألوان',
      undo: 'تراجع',
      redo: 'إعادة',
      zoom: 'تكبير',
      grid: 'شبكة',
      export: 'تصدير',
      saveProject: 'حفظ',
      backgroundImage: 'صورة خلفية',
      bgImagePick: 'اختيار صورة',
      bgImageClear: 'إزالة الصورة',
      transparent: 'شفاف',
      paper: 'ورق',
      enterText: 'اكتب نصك هنا…',
      exportShareImage: 'مشاركة الصورة',
      exportSaveToPhotos: 'حفظ في الصور',
      exportSvgAction: 'تصدير SVG',
      exportProjectFile: 'تصدير ملف المشروع',
      exporting: 'جارٍ التصدير…',
      exportFailed: 'فشل التصدير',
      saveToPhotosDenied: 'تم رفض الإذن بحفظ الصور.',
      saving: 'جارٍ الحفظ…',
      saved: 'تم الحفظ',
      saveFailed: 'تعذّر الحفظ',
      selectedCount: 'المحدد: {n}',
      collectionGroup: 'مجموعة · {n}',
      split: 'تقسيم',
      rejoin: 'دمج',
      parts: 'الأجزاء',
      splitNeedsTwoParts: 'لا يمكن التقسيم: الحروف كلها متصلة.',
      splitWrapped: 'لا يمكن تقسيم نصّ يتجاوز سطرًا واحدًا.',
      splitFailed: 'تعذّر تقسيم النص.',
      style: 'النمط',
      fontSize: 'حجم الخط',
      lineHeight: 'تباعد الأسطر',
      opacity: 'العتامة',
      align: 'المحاذاة',
      alignLeft: 'يسار',
      alignCenter: 'وسط',
      alignRight: 'يمين',
      helpTitle: 'المساعدة',
      helpIntro: 'المس أي عنصر لتعرف وظيفته.',
      learnHint: 'وضع التعلّم',
      helpAllTools: 'كل الأدوات',
      learnPaused: 'وضع التعلّم متوقف مؤقتًا.',
      preview: 'معاينة',
      previewSample: 'عيّنة',
      hints: {
        back: 'رجوع',
        undo: 'تراجع',
        redo: 'إعادة',
        grid: 'إظهار الشبكة أو إخفاؤها',
        save: 'حفظ التصميم',
        export: 'تصدير التصميم',
        scaleUp: 'تكبير العنصر',
        scaleDown: 'تصغير العنصر',
        rotateCcw: 'تدوير إلى اليسار',
        rotateCw: 'تدوير إلى اليمين',
        flipH: 'قلب أفقي',
        fitText: 'ملاءمة النص لمحتواه',
        duplicate: 'تكرار العنصر',
        bringToFront: 'إحضار إلى الأمام',
        sendToBack: 'إرسال إلى الخلف',
        delete: 'حذف العنصر',
        multiSelect: 'تحديد عدة عناصر',
        alignLeft: 'محاذاة إلى اليسار',
        alignCenterH: 'محاذاة المراكز عموديًا',
        alignRight: 'محاذاة إلى اليمين',
        alignTop: 'محاذاة إلى الأعلى',
        alignMiddleV: 'محاذاة المراكز أفقيًا',
        alignBottom: 'محاذاة إلى الأسفل',
        centerH: 'توسيط أفقيًا في اللوحة',
        centerV: 'توسيط عموديًا في اللوحة',
        split: 'تقسيم النص إلى أجزاء',
        rejoin: 'دمج الأجزاء في نص واحد',
        group: 'تجميع العناصر في عنصر واحد',
        ungroup: 'فكّ تجميع العناصر',
        stylePrev: 'النمط السابق',
        styleNext: 'النمط التالي',
        partPrev: 'العنصر السابق',
        partNext: 'العنصر التالي',
        partLabel: 'الجزء {n} من {total}',
        memberLabel: 'العنصر {n} من {total}',
      },
    },
  },
  en: {
    appName: 'midad',
    appNameLatin: 'midad',
    tagline: 'Arabic calligraphy, in your own ink',
    common: {
      cancel: 'Cancel',
      done: 'Done',
      save: 'Save',
      delete: 'Delete',
      share: 'Share',
      back: 'Back',
      next: 'Next',
      start: 'Start',
      open: 'Open',
      close: 'Close',
      more: 'More',
      rename: 'Rename',
      duplicate: 'Duplicate',
      lock: 'Lock',
      undo: 'Undo',
      unlock: 'Unlock',
      loading: 'Loading…',
      confirm: 'Confirm',
    },
    tabs: {
      gallery: 'Gallery',
      settings: 'Settings',
      more: 'More',
    },
    onboarding: {
      welcome: 'Welcome to midad',
      sub: 'The Arabic calligraphy studio — compose your own artwork.',
      slide1Title: 'Compose your own artwork',
      slide1Body:
        'Add your words, move their segments, and link them freely to shape a unique calligraphic piece.',
      slide2Title: 'Authentic heritage typefaces',
      slide2Body:
        'From Naskh to Thuluth and Kufi — a set of Arabic fonts worthy of your craft.',
      slide3Title: 'Export and share your artwork',
      slide3Body:
        'Save your design in high quality and share it with the world in moments.',
      chooseLanguage: 'Choose interface language',
      arabic: 'العربية',
      english: 'English',
      continueLabel: 'Next',
      startLabel: 'Start',
      skip: 'Skip',
    },
    gallery: {
      title: 'Gallery',
      emptyTitle: 'No designs yet',
      emptyBody:
        'Start your calligraphy journey and create your first artwork.',
      newDesign: 'New design',
      untitled: 'Untitled',
      importDesigns: 'Import',
      importFailed: 'Could not import file',
      copySuffix: ' (copy)',
      importFailedHint: 'Make sure the file is a valid .midad file.',
      pin: 'Pin',
      unpin: 'Unpin',
      pinned: 'Pinned',
      rowActions: 'Design options',
      deletedNotice: 'Deleted “{name}”',
    },
    settings: {
      title: 'Settings',
      languageSection: 'Language',
      languageHint: 'Language used in the app interface',
      themeSection: 'Appearance',
      themeHint: 'App appearance',
      themeSystem: 'System',
      themeLight: 'Light',
      themeDark: 'Dark',
      defaultsSection: 'Defaults',
      defaultCanvas: 'Default canvas size',
      aboutSection: 'About',
      aboutBody: 'midad — the Arabic calligraphy studio.',
      aboutLink: 'About the app',
      privacyLink: 'Privacy policy',
      version: 'Version',
      credits: 'Fonts under the SIL Open Font License',
      restartNotice:
        'Restart the app to fully apply the new interface direction.',
      autoSaveSection: 'Auto-save',
      autoSaveHint: 'Save your edits automatically while you work',
      autoSaveOn: 'On',
      autoSaveOff: 'Off',
      autoSaveInterval: 'Auto-save interval',
      autoSaveIntervalHint:
        'Also flushes periodically during continuous editing',
      autoSaveEvery10s: '10s',
      autoSaveEvery30s: '30s',
      autoSaveEvery1m: '1 min',
      autoSaveEvery5m: '5 min',
      onboardingSection: 'Intro',
      onboardingReplay: 'Show the intro again',
      onboardingReplayHint: 'Replay the introduction screens.',
    },
    aboutPage: {
      title: 'About midad',
      body: 'midad is an Arabic calligraphy studio designed for exploring layouts, lettering, color, and composition in a mindful, approachable way.',
      mission:
        'Our goal is to make Arabic art more accessible to everyone by focusing on creativity, clarity, and a smooth creative flow.',
      versionLabel: 'Current version',
      developedBy:
        'Built to support personal calligraphy practice and custom design work on your device.',
    },
    privacyPage: {
      title: 'Privacy policy',
      summary:
        'We respect your privacy. We do not sell or share your personal data with third parties.',
      localData:
        'Your design content is stored locally on your device and remains available only inside the app for your own work.',
      analytics:
        'The app does not use advertising trackers or persistent analytics services to monitor your activity.',
      contact:
        'If you have any privacy questions, contact the app support or review the project settings for the latest information.',
    },
    editor: {
      newProject: 'New artwork',
      projectName: 'Design name',
      canvasSize: 'Canvas size',
      background: 'Background',
      select: 'Select',
      multiSelect: 'Multi-select',
      text: 'Text',
      glyphs: 'Ornaments',
      shapes: 'Shapes',
      glyphMarks: 'Marks',
      glyphLetters: 'Letter forms',
      shapeCircle: 'Circle',
      shapeSquare: 'Square',
      shapeLine: 'Line',
      shapeStar: 'Star',
      shapeTriangle: 'Triangle',
      shapeRing: 'Ring',
      shapeDiamond: 'Diamond',
      shapePentagon: 'Pentagon',
      shapeHexagon: 'Hexagon',
      shapeOctagon: 'Octagon',
      shapeCrescent: 'Crescent',
      shapeArch: 'Arch',
      colors: 'Colors',
      undo: 'Undo',
      redo: 'Redo',
      zoom: 'Zoom',
      grid: 'Grid',
      export: 'Export',
      saveProject: 'Save',
      backgroundImage: 'Background image',
      bgImagePick: 'Pick image',
      bgImageClear: 'Remove image',
      transparent: 'Transparent',
      paper: 'Paper',
      enterText: 'Type your text…',
      exportShareImage: 'Share image',
      exportSaveToPhotos: 'Save to Photos',
      exportSvgAction: 'Export SVG',
      exportProjectFile: 'Export project file',
      exporting: 'Exporting…',
      exportFailed: 'Export failed',
      saveToPhotosDenied: 'Permission to save to Photos was denied.',
      saving: 'Saving…',
      saved: 'Saved',
      saveFailed: 'Save failed',
      selectedCount: 'Selected: {n}',
      collectionGroup: 'Group · {n}',
      split: 'Split',
      rejoin: 'Rejoin',
      parts: 'Parts',
      splitNeedsTwoParts: 'Can’t split: these letters are all connected.',
      splitWrapped: 'Can’t split text that spans more than one line.',
      splitFailed: 'Couldn’t split the text.',
      style: 'Style',
      fontSize: 'Font size',
      lineHeight: 'Line height',
      opacity: 'Opacity',
      align: 'Alignment',
      alignLeft: 'Left',
      alignCenter: 'Center',
      alignRight: 'Right',
      helpTitle: 'Help',
      helpIntro: 'Tap any control to read what it does.',
      learnHint: 'Learn mode',
      helpAllTools: 'All tools',
      learnPaused: 'Learn mode is paused.',
      preview: 'Preview',
      previewSample: 'Sample',
      hints: {
        back: 'Back',
        undo: 'Undo',
        redo: 'Redo',
        grid: 'Show or hide the grid',
        save: 'Save the design',
        export: 'Export the design',
        scaleUp: 'Scale up',
        scaleDown: 'Scale down',
        rotateCcw: 'Rotate left',
        rotateCw: 'Rotate right',
        flipH: 'Flip horizontally',
        fitText: 'Fit text to its content',
        duplicate: 'Duplicate',
        bringToFront: 'Bring to front',
        sendToBack: 'Send to back',
        delete: 'Delete',
        multiSelect: 'Select multiple objects',
        alignLeft: 'Align left edges',
        alignCenterH: 'Align centers vertically',
        alignRight: 'Align right edges',
        alignTop: 'Align top edges',
        alignMiddleV: 'Align centers horizontally',
        alignBottom: 'Align bottom edges',
        centerH: 'Center horizontally on canvas',
        centerV: 'Center vertically on canvas',
        split: 'Split the text into parts',
        rejoin: 'Rejoin the parts into one text',
        group: 'Group the elements into one',
        ungroup: 'Ungroup the elements',
        stylePrev: 'Previous style',
        styleNext: 'Next style',
        partPrev: 'Previous element',
        partNext: 'Next element',
        partLabel: 'Part {n} of {total}',
        memberLabel: 'Element {n} of {total}',
      },
    },
  },
};

/** Pluralized gallery subtitle: "3 designs" / "ثلاثة تصاميم". */
const COUNT_TEMPLATES: Record<Language, Record<Intl.LDMLPluralRule, string>> = {
  en: {
    one: '{n} design',
    two: '',
    few: '',
    many: '',
    zero: '',
    other: '{n} designs',
  },
  ar: {
    zero: 'لا توجد تصاميم',
    one: 'تصميم واحد',
    two: 'تصميمان',
    few: '{n} تصاميم',
    many: '{n} تصميمًا',
    other: '{n} تصميم',
  },
};

/**
 * CLDR plural category, computed locally.
 *
 * Hermes ships `Intl.Collator` / `Intl.DateTimeFormat` / `Intl.NumberFormat`
 * but **not** `Intl.PluralRules`, so `new Intl.PluralRules(...)` throws
 * `undefined cannot be used as a constructor` on Android. The app only ships
 * `ar` and `en`, so their CLDR rules are applied directly — same output as
 * `Intl.PluralRules`, no engine dependency.
 */
function pluralCategory(n: number, language: Language): Intl.LDMLPluralRule {
  if (language !== 'ar') {
    return n === 1 ? 'one' : 'other';
  }
  if (n === 0) {
    return 'zero';
  }
  if (n === 1) {
    return 'one';
  }
  if (n === 2) {
    return 'two';
  }
  const mod100 = n % 100;
  if (mod100 >= 3 && mod100 <= 10) {
    return 'few';
  }
  if (mod100 >= 11 && mod100 <= 99) {
    return 'many';
  }
  return 'other';
}

/**
 * Latin (Western) digits everywhere by default — Arabic text keeps its
 * plural grammar but numerals stay `2026`-style unless the user opts in.
 */
export function formatGalleryCount(n: number, language: Language): string {
  const template = COUNT_TEMPLATES[language][pluralCategory(n, language)];
  const digits = n.toLocaleString('en-US');
  return template.replace('{n}', digits);
}

/** Selected-objects copy, e.g. "Selected: 3" / "المحدد: 3". */
export function formatSelectedCount(n: number, language: Language): string {
  return strings[language].editor.selectedCount.replace(
    '{n}',
    n.toLocaleString('en-US'),
  );
}

/**
 * The collection bar's head over a whole collection, e.g. "Group · 3" /
 * "مجموعة · 3".
 */
export function formatCollectionGroup(n: number, language: Language): string {
  return strings[language].editor.collectionGroup.replace(
    '{n}',
    n.toLocaleString('en-US'),
  );
}

/**
 * Member badge copy for a plain collection, e.g. "Element 2 of 3".
 *
 * A split word uses `formatPartLabel` instead: its members are letters, and
 * "part" is what the split feature calls them.
 */
export function formatMemberLabel(
  index: number,
  total: number,
  language: Language,
): string {
  return strings[language].editor.hints.memberLabel
    .replace('{n}', (index + 1).toLocaleString('en-US'))
    .replace('{total}', total.toLocaleString('en-US'));
}

/** Part badge copy in the parts strip, e.g. "Part 2 of 3" / "الجزء 2 من 3". */
export function formatPartLabel(
  index: number,
  total: number,
  language: Language,
): string {
  return strings[language].editor.hints.partLabel
    .replace('{n}', (index + 1).toLocaleString('en-US'))
    .replace('{total}', total.toLocaleString('en-US'));
}

/**
 * Undo-snackbar copy after deleting a design, e.g. "Deleted “Sketch”" /
 * "تم حذف «رسمة»". Falls back to the localized "Untitled" so an unnamed design
 * never renders as an empty pair of quotes.
 */
export function formatDeletedNotice(name: string, language: Language): string {
  const display = name.trim() || strings[language].gallery.untitled;
  return strings[language].gallery.deletedNotice.replace('{name}', display);
}
