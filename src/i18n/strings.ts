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
  };
  gallery: {
    title: string;
    emptyTitle: string;
    emptyBody: string;
    newDesign: string;
    designCard: string;
    untitled: string;
  };
  settings: {
    title: string;
    languageSection: string;
    languageHint: string;
    defaultsSection: string;
    defaultCanvas: string;
    aboutSection: string;
    aboutBody: string;
    version: string;
    credits: string;
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
      sub: 'صمّم لوحات الخط العربي بأسلوبك الخاص.',
      slide1Title: 'تكوينات باهرة',
      slide1Body: 'أضف كلماتك وحرّك مقاطعها وربطها بحرية لتكوين تركيبات معقدة.',
      slide2Title: 'خطوط عربية أصيلة',
      slide2Body: 'نسخ، ثلث، رقعة، كوفي — مجموعة خطوط عربية تليق بإبداعك.',
      slide3Title: 'احفظ وشارك',
      slide3Body: 'صدّر تصميمك كصورة واحفظه في أي وقت وشاركه مع العالم.',
      chooseLanguage: 'اختر لغة الواجهة',
      arabic: 'العربية',
      english: 'English',
    },
    gallery: {
      title: 'لوحتي',
      emptyTitle: 'لا توجد تصاميم بعد',
      emptyBody: 'ابدأ رحلتك مع الخط العربي وأنشئ أول لوحة.',
      newDesign: 'تصميم جديد',
      designCard: 'تصميم بدون عنوان',
      untitled: 'بدون عنوان',
    },
    settings: {
      title: 'الإعدادات',
      languageSection: 'اللغة',
      languageHint: 'اللغة المستخدمة في واجهة التطبيق',
      defaultsSection: 'الافتراضيات',
      defaultCanvas: 'مقاس اللوحة الافتراضي',
      aboutSection: 'حول',
      aboutBody: 'مداد — استوديو الخط العربي.',
      version: 'الإصدار',
      credits: 'الخطوط بترخيص SIL Open Font License',
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
      sub: 'Create Arabic calligraphy artwork your way.',
      slide1Title: 'Striking compositions',
      slide1Body: 'Add your words, then move, nest and link segments freely to build complex designs.',
      slide2Title: 'Authentic Arabic fonts',
      slide2Body: 'Naskh, Thuluth, Ruqaa, Kufi — a set of Arabic typefaces worthy of your craft.',
      slide3Title: 'Save and share',
      slide3Body: 'Export your design as an image, save it anytime, and share it with the world.',
      chooseLanguage: 'Choose interface language',
      arabic: 'العربية',
      english: 'English',
    },
    gallery: {
      title: 'Gallery',
      emptyTitle: 'No designs yet',
      emptyBody: 'Start your calligraphy journey and create your first artwork.',
      newDesign: 'New design',
      designCard: 'Untitled design',
      untitled: 'Untitled',
    },
    settings: {
      title: 'Settings',
      languageSection: 'Language',
      languageHint: 'Language used in the app interface',
      defaultsSection: 'Defaults',
      defaultCanvas: 'Default canvas size',
      aboutSection: 'About',
      aboutBody: 'midad — the Arabic calligraphy studio.',
      version: 'Version',
      credits: 'Fonts under the SIL Open Font License',
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
    },
  },
};