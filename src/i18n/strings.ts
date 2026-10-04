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
    lastUpdated: string;
    intro: string;
    sections: readonly { title: string; body: string }[];
    contactTitle: string;
    contactBody: string;
    hostedLabel: string;
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
    // The ornament paint styles the library can insert and the selection can
    // cycle through.
    glyphSolid: string;
    glyphOutline: string;
    glyphThin: string;
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
    /** Rail label for the Insert tool, whose sheet now holds three tabs. */
    insert: string;
    /** Tab label for the sheet's placed-asset section. */
    media: string;
    /** Button that opens the photo library to place an image on the canvas. */
    insertImageFromGallery: string;
    /** Section title over the icon search in the Media tab. */
    icons: string;
    /** Placeholder for the icon search field. */
    searchIcons: string;
    /** Shown when the icon catalogue could not be reached. */
    iconSearchFailed: string;
    /** Row reason: the icon set bakes its own colours and cannot be inked. */
    iconPaletteUnsupported: string;
    /** Row reason: the icon uses elements that cannot be stored as paths. */
    iconShapeUnsupported: string;
    /** Shown when a picked photo could not be written to the design's store. */
    imageInsertFailed: string;
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
    splitLatinScript: string;
    arabicFonts: string;
    latinFonts: string;
    /** Label of the picker's "show every script" filter item. */
    allFonts: string;
    // Style navigator and per-object style sheet.
    style: string;
    fontSize: string;
    /** Grouping label above the family grid in the text sheet. */
    fontFamily: string;
    /** Grouping label above the variant chips. */
    variant: string;
    /** Opens the full-height font picker. */
    chooseFont: string;
    /** Placeholder for the picker's search field. */
    searchFont: string;
    /** Shown when a search matches no family. */
    noFontResults: string;
    // Runtime-downloaded Google Fonts (the picker's "Google Fonts" section).
    /** Section title for the on-demand Google Fonts listings. */
    googleFonts: string;
    /** License + on-demand caption under the section title. */
    googleFontsHint: string;
    /** Title of the picker's pinned-fonts section. */
    pinnedFonts: string;
    /** Header action: hide the pinned rows. */
    collapsePinned: string;
    /** Header action: show the pinned rows. */
    expandPinned: string;
    /** Badge on a family whose subsets include Arabic. */
    supportsArabic: string;
    /** Badge on a family with no Arabic subset. */
    noArabicSupport: string;
    /** Weight-chip / banner action: fetch and install a face. */
    downloadFont: string;
    /** Weight-chip progress label while a face downloads. */
    downloadingFont: string;
    /** Weight chip after a failed download — tap to try again. */
    retryDownload: string;
    /** Badge on a weight chip whose face is already installed. */
    installedFont: string;
    /** Shown when the Google Fonts catalog cannot be reached. */
    fontCatalogFailed: string;
    // Missing remote faces on document open.
    /** Banner title: a design uses faces this device does not have yet. */
    missingFontsTitle: string;
    /** Banner body, explaining what the download is for. */
    missingFontsBody: string;
    // Weight-chip labels: remote faces name weights the way bundled variants do.
    /** Chip label for weight 400. */
    fontWeightRegular: string;
    /** Chip label for weight 700. */
    fontWeightBold: string;
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
    /** Title of the color picker sheet. */
    pickColor: string;
    /** Label above the custom color input. */
    customColor: string;
    /** Label above the recently used custom colors. */
    recentColors: string;
    /** Hint under the custom input, showing the accepted forms. */
    colorFormatHint: string;
    /** Shown in place of the hint when the input is not a color. */
    invalidColor: string;
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
      flipV: string;
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
      glyphStyle: string;
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
      developedBy: 'طُوِّر تطبيق مداد بواسطة adelpro (com.adelpro.midad).',
    },
    privacyPage: {
      title: 'سياسة الخصوصية',
      lastUpdated: 'آخر تحديث: 23 سبتمبر 2026',
      intro:
        'تشرح هذه السياسة كيف يجمع تطبيق مداد بياناتك ويستخدمها ويشاركها، ومن المسؤول عن التطبيق.',
      sections: [
        {
          title: 'من نحن',
          body: 'تخصّ سياسة الخصوصية هذه تطبيق مداد (Midad) للخط العربي، ورقمه التعريفي com.adelpro.midad، والمطوّر adelpro. تسري على استخدامك للتطبيق على أندرويد وiOS والويب.',
        },
        {
          title: 'بياناتك وتصميماتك',
          body: 'تُحفظ لوحاتك وإعداداتك محليًا على جهازك فقط، ولا تُرفع إلى أي خادم نملكه. حذف التصميم من داخل التطبيق أو إزالة التطبيق يزيل هذه البيانات نهائيًا.',
        },
        {
          title: 'الصور التي تختارها',
          body: 'عند اختيار صورة خلفية من مكتبة الصور، يُقرأ الملف الذي تختاره فقط ويُستخدم كخلفية للتصميم، ثم يُحفظ محليًا مع عملك. لا نصل إلى بقية مكتبة صورك.',
        },
        {
          title: 'الإعلانات',
          body: 'قد يعرض التطبيق مستقبلًا إعلانات عبر شبكات إعلان خارجية مثل Google AdMob. قد تجمع هذه الشبكات مُعرّف الإعلان ومعلومات تقنية عن الجهاز وموقعًا تقريبيًا مستخلصًا من عنوان IP وبيانات تفاعلك مع الإعلان، لعرض الإعلانات وقياس أدائها. نحن لا نبيع بياناتك الشخصية.',
        },
        {
          title: 'الموافقة والاختيار',
          body: 'نطلب موافقتك حيث يفرض القانون ذلك (مثل الاتحاد الأوروبي والمملكة المتحدة)، ويمكنك التحكم في الإعلانات المخصّصة من إعدادات جهازك، مثل إعادة تعيين مُعرّف الإعلان أو حذفه في إعدادات أندرويد. راجع أيضًا سياسات خصوصية شركاء الإعلان.',
        },
        {
          title: 'التحليلات',
          body: 'لا نستخدم حاليًا أي تحليلات سلوكية أو تتبّع يتجاوز الإعلانات المذكورة أعلاه. وإذا أضفنا تحليلات لاحقًا فسنحدّث هذه السياسة.',
        },
        {
          title: 'مشاركة البيانات',
          body: 'لا نشارك بياناتك إلا بالقدر اللازم مع شركاء الإعلان المذكورين أعلاه أو عندما يقتضي القانون ذلك. نحن لا نبيع بياناتك الشخصية.',
        },
        {
          title: 'خصوصية الأطفال',
          body: 'التطبيق غير موجّه للأطفال دون سن 13 عامًا، ولا نجمع بياناتهم عن قصد. إذا اعتقدت أن طفلًا قدّم بيانات، فتواصل معنا لنحذفها.',
        },
        {
          title: 'الأمان والاحتفاظ',
          body: 'تبقى بيانات تصميماتك على جهازك، وتعتمد سلامتها على حماية جهازك. أما بيانات الإعلانات فيتبع الاحتفاظ بها سياسات شركاء الإعلان.',
        },
        {
          title: 'حقوقك',
          body: 'يمكنك حذف تصميماتك في أي وقت من داخل التطبيق أو بإزالة التطبيق. ولأي طلب يخصّ بياناتك، تواصل معنا عبر البريد الإلكتروني أدناه.',
        },
        {
          title: 'تحديثات هذه السياسة',
          body: 'قد نحدّث هذه السياسة من وقت لآخر. سنغيّر تاريخ آخر تحديث أدناه، ونشعرك داخل التطبيق عند إجراء تغييرات جوهرية. استمرارك في الاستخدام يعني موافقتك على النسخة المحدّثة.',
        },
      ],
      contactTitle: 'اتصل بنا',
      contactBody:
        'لأي سؤال حول الخصوصية أو بياناتك، راسلنا على البريد التالي:',
      hostedLabel: 'النسخة الكاملة من السياسة على الويب',
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
      glyphSolid: 'ممتلئ',
      glyphOutline: 'مفرّغ',
      glyphThin: 'رفيع',
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
      insert: 'إدراج',
      media: 'وسائط',
      insertImageFromGallery: 'إدراج صورة من المعرض',
      icons: 'أيقونات',
      searchIcons: 'ابحث عن أيقونة',
      iconSearchFailed: 'تعذّر الوصول إلى مكتبة الأيقونات.',
      iconPaletteUnsupported: 'أيقونة ملوّنة: لا يمكن صبغها بالحبر.',
      iconShapeUnsupported: 'شكل غير مدعوم.',
      imageInsertFailed: 'تعذّر إدراج الصورة.',
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
      splitLatinScript:
        'لا يمكن التقسيم: هذا خط لاتيني، وحروفه مرتبطة بخطوط الاتصال.',
      arabicFonts: 'الخطوط العربية',
      latinFonts: 'الخطوط اللاتينية',
      allFonts: 'كل الخطوط',
      style: 'النمط',
      fontSize: 'حجم الخط',
      fontFamily: 'الخط',
      variant: 'النمط',
      chooseFont: 'اختيار الخط',
      searchFont: 'ابحث عن خط',
      noFontResults: 'لا توجد نتائج',
      googleFonts: 'خطوط Google',
      googleFontsHint: 'من مكتبة Google Fonts — تُحمَّل عند الطلب (OFL-1.1)',
      pinnedFonts: 'المثبّتة',
      collapsePinned: 'طيّ المثبّتة',
      expandPinned: 'توسيع المثبّتة',
      supportsArabic: 'يدعم العربية',
      noArabicSupport: 'بدون عربي',
      downloadFont: 'تحميل',
      downloadingFont: 'جارٍ التحميل…',
      retryDownload: 'إعادة المحاولة',
      installedFont: 'مثبَّت',
      fontCatalogFailed: 'تعذّر الوصول إلى مكتبة خطوط Google.',
      missingFontsTitle: 'خطوط غير محمّلة',
      missingFontsBody:
        'هذه اللوحة تستخدم خطوط Google ليست على هذا الجهاز بعد. حمّلها الآن ليظهر النص بخطوطه الأصلية.',
      fontWeightRegular: 'عادي',
      fontWeightBold: 'عريض',
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
      pickColor: 'اختيار لون',
      customColor: 'لون مخصّص',
      recentColors: 'ألوان أخيرة',
      colorFormatHint: 'مثال: ‎#7A1F1F أو rgb(122, 31, 31)',
      invalidColor: 'صيغة اللون غير صحيحة.',
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
        flipV: 'قلب رأسي',
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
        glyphStyle: 'تبديل نمط الزخرفة',
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
      developedBy: 'The Midad app is developed by adelpro (com.adelpro.midad).',
    },
    privacyPage: {
      title: 'Privacy policy',
      lastUpdated: 'Last updated: September 23, 2026',
      intro:
        'This policy explains how the Midad app collects, uses and shares your data, and who is responsible for the app.',
      sections: [
        {
          title: 'Who we are',
          body: 'This policy covers the Midad app (مداد) for Arabic calligraphy, package name com.adelpro.midad, developed and operated by adelpro. It applies to your use of the app on Android, iOS and the web.',
        },
        {
          title: 'Your work and data',
          body: 'Your designs and settings are stored locally on your device only and are not uploaded to any server we control. Deleting a design in the app, or uninstalling the app, removes that data.',
        },
        {
          title: 'Photos you choose',
          body: 'When you pick a background image from your photo library, only the file you select is read and used as the design background, then stored locally with your work. We do not access the rest of your library.',
        },
        {
          title: 'Advertising',
          body: 'The app may in future display ads served by third-party ad networks such as Google AdMob. Those networks may collect your advertising identifier, technical device information, an approximate location derived from your IP address, and your interactions with ads, in order to serve and measure ads. We do not sell your personal data.',
        },
        {
          title: 'Consent and your choices',
          body: 'We ask for your consent where the law requires it (for example in the EEA and the UK), and you can control personalised advertising through your device settings, such as resetting or deleting the advertising ID in Android settings. See also the ad partners’ privacy policies.',
        },
        {
          title: 'Analytics',
          body: 'We currently use no behavioural analytics or tracking beyond the advertising described above. If we add analytics later, we will update this policy.',
        },
        {
          title: 'Sharing',
          body: 'We share your data only as needed with the advertising partners described above, or where the law requires it. We do not sell your personal data.',
        },
        {
          title: 'Children’s privacy',
          body: 'The app is not directed to children under 13, and we do not knowingly collect their data. If you believe a child has provided data, contact us and we will remove it.',
        },
        {
          title: 'Security and retention',
          body: 'Your design data stays on your device, and its safety depends on your device’s protection. Advertising data is retained by our ad partners under their own policies.',
        },
        {
          title: 'Your rights',
          body: 'You can delete your designs at any time in the app, or by uninstalling it. For any request about your data, contact us using the email below.',
        },
        {
          title: 'Changes to this policy',
          body: 'We may update this policy from time to time. We will change the “last updated” date below and notify you in the app about material changes. Continued use means you accept the updated version.',
        },
      ],
      contactTitle: 'Contact us',
      contactBody: 'For any privacy or data question, email us at:',
      hostedLabel: 'Full policy on the web',
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
      glyphSolid: 'Solid',
      glyphOutline: 'Outline',
      glyphThin: 'Thin',
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
      insert: 'Insert',
      media: 'Media',
      insertImageFromGallery: 'Add image from gallery',
      icons: 'Icons',
      searchIcons: 'Search icons',
      iconSearchFailed: 'Couldn’t reach the icon library.',
      iconPaletteUnsupported: 'Colour icon — cannot be inked.',
      iconShapeUnsupported: 'Unsupported shape.',
      imageInsertFailed: 'Couldn’t add the image.',
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
      splitLatinScript:
        'Can’t split: this is a Latin face, and its letters are joined by connecting strokes.',
      arabicFonts: 'Arabic fonts',
      latinFonts: 'Latin fonts',
      allFonts: 'All fonts',
      style: 'Style',
      fontSize: 'Font size',
      fontFamily: 'Font',
      variant: 'Style',
      chooseFont: 'Choose font',
      searchFont: 'Search fonts',
      noFontResults: 'No fonts found',
      googleFonts: 'Google Fonts',
      googleFontsHint:
        'From the Google Fonts library — downloaded on demand (OFL-1.1)',
      pinnedFonts: 'Pinned',
      collapsePinned: 'Collapse pinned',
      expandPinned: 'Expand pinned',
      supportsArabic: 'Arabic support',
      noArabicSupport: 'No Arabic',
      downloadFont: 'Download',
      downloadingFont: 'Downloading…',
      retryDownload: 'Retry',
      installedFont: 'Installed',
      fontCatalogFailed: 'Couldn’t reach the Google Fonts catalog.',
      missingFontsTitle: 'Missing fonts',
      missingFontsBody:
        'This design uses Google Fonts that aren’t on this device yet. Download them now so the text renders in its own typefaces.',
      fontWeightRegular: 'Regular',
      fontWeightBold: 'Bold',
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
      pickColor: 'Pick a color',
      customColor: 'Custom color',
      recentColors: 'Recent colors',
      colorFormatHint: 'e.g. #7A1F1F or rgb(122, 31, 31)',
      invalidColor: 'Not a valid color.',
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
        flipV: 'Flip vertically',
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
        glyphStyle: 'Cycle ornament style',
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
