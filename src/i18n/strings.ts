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
  };
  tabs: {
    gallery: string;
    settings: string;
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
    deleteTitle: string;
    deleteBody: string;
    copySuffix: string;
    importFailedHint: string;
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
    version: string;
    credits: string;
    restartNotice: string;
  };
editor: {
      newProject: string;
      projectName: string;
      canvasSize: string;
      background: string;
      select: string;
      text: string;
      glyphs: string;
      shapes: string;
      colors: string;
      undo: string;
      redo: string;
      zoom: string;
      grid: string;
      export: string;
      saveProject: string;
      backgroundImage: string;
      transparent: string;
      paper: string;
      enterText: string;
      exportShareImage: string;
      exportSvgAction: string;
      exportProjectFile: string;
      exporting: string;
      exportFailed: string;
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
    },
    tabs: {
      gallery: 'لوحتي',
      settings: 'الإعدادات',
    },
    onboarding: {
      welcome: 'مرحباً بك في مداد',
      sub: 'استوديو الخط العربي — صمّم لوحاتك بنفسك.',
      slide1Title: 'كوّن لوحتك بنفسك',
      slide1Body: 'أضِف كلماتك، وحرّك مقاطعها، واربطها بحرّيةٍ لتشكيل لوحةٍ خطّيةٍ فريدة.',
      slide2Title: 'خطوطٌ أصيلة من التراث',
      slide2Body: 'من النسخ إلى الثلث والكوفي، مجموعةُ خطوطٍ عربيةٍ تليق بإبداعك.',
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
      untitled: 'بدون عنوان',
      importDesigns: 'استيراد',
      importFailed: 'تعذّر استيراد الملف',
      deleteTitle: 'حذف التصميم؟',
      deleteBody: 'سيُحذف التصميم وصورته المصغّرة نهائيًا ولا يمكن التراجع.',
      copySuffix: ' — نسخة',
      importFailedHint: 'تأكد من أن الملف بصيغة ‎.midad أو JSON صالح.',
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
      version: 'الإصدار',
      credits: 'الخطوط مرخّصة بموجب رخصة SIL Open Font License',
      restartNotice: 'أعد تشغيل التطبيق ليُطبَّق اتجاه الواجهة الجديد بالكامل.',
    },
    editor: {
      newProject: 'لوحة جديدة',
      projectName: 'اسم التصميم',
      canvasSize: 'مقاس اللوحة',
      background: 'الخلفية',
      select: 'تحديد',
      text: 'نص',
      glyphs: 'زخارف',
      shapes: 'أشكال',
      colors: 'الألوان',
      undo: 'تراجع',
      redo: 'إعادة',
      zoom: 'تكبير',
      grid: 'شبكة',
      export: 'تصدير',
      saveProject: 'حفظ',
      backgroundImage: 'صورة خلفية',
      transparent: 'شفاف',
      paper: 'ورق',
      enterText: 'اكتب نصك هنا…',
      exportShareImage: 'مشاركة الصورة',
      exportSvgAction: 'تصدير SVG',
      exportProjectFile: 'تصدير ملف المشروع',
      exporting: 'جارٍ التصدير…',
      exportFailed: 'فشل التصدير',
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
      unlock: 'Unlock',
      loading: 'Loading…',
      confirm: 'Confirm',
    },
    tabs: {
      gallery: 'Gallery',
      settings: 'Settings',
    },
    onboarding: {
      welcome: 'Welcome to midad',
      sub: 'The Arabic calligraphy studio — compose your own artwork.',
      slide1Title: 'Compose your own artwork',
      slide1Body: 'Add your words, move their segments, and link them freely to shape a unique calligraphic piece.',
      slide2Title: 'Authentic heritage typefaces',
      slide2Body: 'From Naskh to Thuluth and Kufi — a set of Arabic fonts worthy of your craft.',
      slide3Title: 'Export and share your artwork',
      slide3Body: 'Save your design in high quality and share it with the world in moments.',
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
      emptyBody: 'Start your calligraphy journey and create your first artwork.',
      newDesign: 'New design',
      untitled: 'Untitled',
      importDesigns: 'Import',
      importFailed: 'Could not import file',
      deleteTitle: 'Delete this design?',
      deleteBody: 'The design and its thumbnail will be permanently removed. This cannot be undone.',
      copySuffix: ' (copy)',
      importFailedHint: 'Make sure the file is a valid .midad or JSON file.',
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
      version: 'Version',
      credits: 'Fonts under the SIL Open Font License',
      restartNotice: 'Restart the app to fully apply the new interface direction.',
    },
    editor: {
      newProject: 'New artwork',
      projectName: 'Design name',
      canvasSize: 'Canvas size',
      background: 'Background',
      select: 'Select',
      text: 'Text',
      glyphs: 'Ornaments',
      shapes: 'Shapes',
      colors: 'Colors',
      undo: 'Undo',
      redo: 'Redo',
      zoom: 'Zoom',
      grid: 'Grid',
      export: 'Export',
      saveProject: 'Save',
      backgroundImage: 'Background image',
      transparent: 'Transparent',
      paper: 'Paper',
      enterText: 'Type your text…',
      exportShareImage: 'Share image',
      exportSvgAction: 'Export SVG',
      exportProjectFile: 'Export project file',
      exporting: 'Exporting…',
      exportFailed: 'Export failed',
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
 * Latin (Western) digits everywhere by default — Arabic text keeps its
 * plural grammar but numerals stay `2026`-style unless the user opts in.
 */
export function formatGalleryCount(n: number, language: Language): string {
  const category = new Intl.PluralRules(language === 'ar' ? 'ar' : 'en').select(n);
  const template = COUNT_TEMPLATES[language][category];
  const digits = n.toLocaleString('en-US');
  return template.replace('{n}', digits);
}