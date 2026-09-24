/**
 * Help content for the editor — the single source of truth behind every
 * tooltip, the learn-mode banner, and the help sheet.
 *
 * Three surfaces read this table and nothing else:
 * - `Tooltip` (via the `hint` prop) shows the short label, plus its chord on
 *   the web where a key can actually be pressed (`src/editor/shortcuts.ts`).
 * - Learn mode shows the `role` — one sentence, in the UI font.
 * - The help sheet lists label + role + chord per group.
 *
 * Labels are *referenced*, not retyped: an entry either points at an existing
 * `t.editor.hints.*` key, an existing `t.editor.*` key, or carries new copy for
 * a control that had no string before (the colour swatches, the sheet buttons,
 * the keyboard-only actions). `scripts/check-help.mjs` enforces that the three
 * forms stay in sync and that nothing is left undocumented.
 *
 * Deliberately free of runtime imports — only `import type` — so the check
 * script can transpile and evaluate this module standalone, exactly like
 * `scripts/check-shortcuts.mjs` does for the binding table.
 */

import type { IconName } from '@/components/ui/icon';
import type { ShortcutId } from '@/editor/shortcuts';
import type { Language, Translation } from '@/i18n/strings';

/** A label already written in the tooltip namespace. */
export type HintsKey = keyof Translation['editor']['hints'];

/** A label already written in the editor namespace, outside `hints`. */
export type EditorKey = Exclude<keyof Translation['editor'], 'hints'>;

/**
 * Where an entry's short label comes from. The union is what keeps the help
 * table from becoming a second copy of the string catalog.
 */
export type HelpLabel =
  | { readonly hint: HintsKey }
  | { readonly editor: EditorKey }
  | { readonly ar: string; readonly en: string };

export type HelpGroup =
  'topBar' | 'tools' | 'selection' | 'canvas' | 'panels' | 'keyboard';

export interface HelpGroupMeta {
  readonly key: HelpGroup;
  readonly labelAr: string;
  readonly labelEn: string;
}

export interface HelpEntry {
  /** Stable identifier, also used as the learn-mode selection key. */
  readonly key: string;
  readonly group: HelpGroup;
  readonly label: HelpLabel;
  /** What the control does, in one sentence. Shown in learn mode. */
  readonly roleAr: string;
  readonly roleEn: string;
  /**
   * Omitted where the icon depends on direction: previous/next controls mirror
   * in Arabic, and a fixed left-pointing glyph would read backwards.
   */
  readonly icon?: IconName;
  readonly shortcutId?: ShortcutId;
}

/** Sheet section order. */
export const HELP_GROUPS: readonly HelpGroupMeta[] = [
  { key: 'topBar', labelAr: 'الشريط العلوي', labelEn: 'Top bar' },
  { key: 'tools', labelAr: 'الأدوات', labelEn: 'Tools' },
  { key: 'selection', labelAr: 'شريط التحديد', labelEn: 'Selection bar' },
  { key: 'canvas', labelAr: 'اللوحة والإيماءات', labelEn: 'Canvas gestures' },
  { key: 'panels', labelAr: 'اللوحات', labelEn: 'Panels' },
  {
    key: 'keyboard',
    labelAr: 'اختصارات لوحة المفاتيح',
    labelEn: 'Keyboard only',
  },
];

export const HELP_ENTRIES = [
  // ---------------------------------------------------------------------------
  // Top bar
  // ---------------------------------------------------------------------------
  {
    key: 'topBar.back',
    group: 'topBar',
    label: { hint: 'back' },
    roleAr: 'الخروج من المحرّر. التصميم محفوظ تلقائيًا.',
    roleEn: 'Leave the editor. Your design is saved automatically.',
  },
  {
    key: 'topBar.undo',
    group: 'topBar',
    label: { hint: 'undo' },
    roleAr: 'الرجوع خطوة إلى الوراء.',
    roleEn: 'Step back one change.',
    icon: 'undo',
    shortcutId: 'undo',
  },
  {
    key: 'topBar.redo',
    group: 'topBar',
    label: { hint: 'redo' },
    roleAr: 'إعادة تطبيق خطوة تراجعت عنها.',
    roleEn: 'Reapply a change you stepped back from.',
    icon: 'redo',
    shortcutId: 'redo',
  },
  {
    key: 'topBar.grid',
    group: 'topBar',
    label: { hint: 'grid' },
    roleAr: 'إظهار شبكة إرشادية فوق اللوحة.',
    roleEn: 'Show a guide grid over the canvas.',
    icon: 'grid',
    shortcutId: 'toggleGrid',
  },
  {
    key: 'topBar.save',
    group: 'topBar',
    label: { hint: 'save' },
    roleAr: 'حفظ التصميم في المعرض الآن.',
    roleEn: 'Save the design to your gallery now.',
    icon: 'download',
    shortcutId: 'save',
  },
  {
    key: 'topBar.export',
    group: 'topBar',
    label: { hint: 'export' },
    roleAr: 'فتح خيارات التصدير: صورة أو SVG أو ملف المشروع.',
    roleEn: 'Open the export options: image, SVG, or project file.',
    icon: 'export',
  },
  {
    key: 'topBar.learn',
    group: 'topBar',
    label: { ar: 'وضع التعلّم', en: 'Learn mode' },
    roleAr: 'تشغيل وضع التعلّم: المس أي عنصر لتعرف وظيفته.',
    roleEn: 'Turn on Learn mode: tap any control to read what it does.',
    icon: 'sparkle',
    // No shortcutId, deliberately. The chord opens the help sheet, not the
    // mode, so advertising it on this button would promise the wrong thing.
  },
  {
    key: 'topBar.help',
    group: 'topBar',
    label: { editor: 'helpTitle' },
    roleAr: 'فتح هذه القائمة: كل الأدوات والاختصارات.',
    roleEn: 'Open this list: every tool and its shortcut.',
    icon: 'help',
    shortcutId: 'openHelp',
  },

  // ---------------------------------------------------------------------------
  // Tool rail
  // ---------------------------------------------------------------------------
  {
    key: 'tool.select',
    group: 'tools',
    label: { editor: 'select' },
    roleAr: 'تحديد العناصر وتحريكها وتغيير حجمها وتدويرها.',
    roleEn: 'Select, move, resize and rotate objects.',
    icon: 'pen',
    shortcutId: 'toolSelect',
  },
  {
    key: 'tool.multiSelect',
    group: 'tools',
    label: { hint: 'multiSelect' },
    roleAr: 'إضافة العنصر إلى التحديد بدل استبداله.',
    roleEn: 'Add the object to the selection instead of replacing it.',
    icon: 'multiSelect',
    shortcutId: 'toolMultiSelect',
  },
  {
    key: 'tool.text',
    group: 'tools',
    label: { editor: 'text' },
    roleAr: 'إضافة نصّ خطّي. يفتح لوحة النص.',
    roleEn: 'Add calligraphy text. Opens the text panel.',
    icon: 'type',
    shortcutId: 'toolText',
  },
  {
    key: 'tool.colors',
    group: 'tools',
    label: { editor: 'colors' },
    roleAr: 'تلوين النص المحدّد بحبر آخر. المس عنصرًا آخر لتحويل الحبر إليه.',
    roleEn: 'Recolour the selected text. Tap another object to switch to it.',
    icon: 'palette',
  },
  {
    key: 'tool.background',
    group: 'tools',
    label: { editor: 'background' },
    roleAr: 'اختيار لون الورق خلف التصميم، أو صورة من المعرض.',
    roleEn: 'Choose the paper colour behind your design, or an image.',
    icon: 'image',
  },
  {
    key: 'tool.glyphs',
    group: 'tools',
    label: { editor: 'glyphs' },
    roleAr: 'فتح مكتبة الزخارف والأشكال لإضافتها إلى التصميم.',
    roleEn:
      'Open the glyphs and shapes library to add ornaments to your design.',
    icon: 'shapes',
  },

  // ---------------------------------------------------------------------------
  // Selection bar
  // ---------------------------------------------------------------------------
  {
    key: 'sel.scaleUp',
    group: 'selection',
    label: { hint: 'scaleUp' },
    roleAr: 'تكبير التحديد قليلًا.',
    roleEn: 'Make the selection a little larger.',
    icon: 'plus',
  },
  {
    key: 'sel.scaleDown',
    group: 'selection',
    label: { hint: 'scaleDown' },
    roleAr: 'تصغير التحديد قليلًا.',
    roleEn: 'Make the selection a little smaller.',
    icon: 'minus',
  },
  {
    key: 'sel.rotateCcw',
    group: 'selection',
    label: { hint: 'rotateCcw' },
    roleAr: 'تدوير ربع دورة إلى اليسار.',
    roleEn: 'Rotate a quarter turn to the left.',
    icon: 'rotateCcw',
    shortcutId: 'rotateCcw',
  },
  {
    key: 'sel.rotateCw',
    group: 'selection',
    label: { hint: 'rotateCw' },
    roleAr: 'تدوير ربع دورة إلى اليمين.',
    roleEn: 'Rotate a quarter turn to the right.',
    icon: 'rotateCw',
    shortcutId: 'rotateCw',
  },
  {
    key: 'sel.flipH',
    group: 'selection',
    label: { hint: 'flipH' },
    roleAr: 'قلب التحديد أفقيًا.',
    roleEn: 'Mirror the selection left to right.',
    icon: 'flip',
    shortcutId: 'flipH',
  },
  {
    key: 'sel.flipV',
    group: 'selection',
    label: { hint: 'flipV' },
    roleAr: 'قلب التحديد رأسيًا.',
    roleEn: 'Mirror the selection top to bottom.',
    icon: 'flipV',
    shortcutId: 'flipV',
  },
  {
    key: 'sel.fitText',
    group: 'selection',
    label: { hint: 'fitText' },
    roleAr: 'إرجاع صندوق النص إلى عرض محتواه.',
    roleEn: 'Snap the text box back to the width of its content.',
    icon: 'fitText',
  },
  {
    key: 'sel.split',
    group: 'selection',
    label: { hint: 'split' },
    roleAr: 'تقسيم الكلمة إلى حروف يمكن تحريكها منفردة.',
    roleEn: 'Break the word into separate letters you can move one by one.',
    icon: 'split',
  },
  {
    key: 'sel.rejoin',
    group: 'selection',
    label: { hint: 'rejoin' },
    roleAr: 'جمع الأجزاء في كلمة واحدة.',
    roleEn: 'Bring the split letters back together as one word.',
    icon: 'rejoin',
  },
  {
    key: 'sel.group',
    group: 'selection',
    label: { hint: 'group' },
    roleAr: 'جمع التحديد في عنصر واحد يتحرك ويتغيّر معًا.',
    roleEn:
      'Join the selection into one element that moves and restyles as a whole.',
    icon: 'group',
    shortcutId: 'group',
  },
  {
    key: 'sel.ungroup',
    group: 'selection',
    label: { hint: 'ungroup' },
    roleAr: 'فكّ المجموعة إلى عناصر مستقلة يتحرك كل منها منفردًا.',
    roleEn:
      'Take the group apart into separate objects you can move one by one.',
    icon: 'ungroup',
    shortcutId: 'ungroup',
  },
  {
    key: 'sel.duplicate',
    group: 'selection',
    label: { hint: 'duplicate' },
    roleAr: 'نسخ التحديد ووضعه فوق الأصل.',
    roleEn: 'Copy the selection and place it on top.',
    icon: 'duplicate',
    shortcutId: 'duplicate',
  },
  {
    key: 'sel.bringToFront',
    group: 'selection',
    label: { hint: 'bringToFront' },
    roleAr: 'تقديم التحديد أمام كل العناصر.',
    roleEn: 'Move the selection in front of everything else.',
    icon: 'layerUp',
    shortcutId: 'bringToFront',
  },
  {
    key: 'sel.sendToBack',
    group: 'selection',
    label: { hint: 'sendToBack' },
    roleAr: 'إرسال التحديد خلف كل العناصر.',
    roleEn: 'Move the selection behind everything else.',
    icon: 'layerDown',
    shortcutId: 'sendToBack',
  },
  {
    key: 'sel.delete',
    group: 'selection',
    label: { hint: 'delete' },
    roleAr: 'حذف التحديد. التراجع يعيده.',
    roleEn: 'Remove the selection. Undo brings it back.',
    icon: 'trash',
    shortcutId: 'delete',
  },
  {
    key: 'sel.alignLeft',
    group: 'selection',
    label: { hint: 'alignLeft' },
    roleAr: 'محاذاة العناصر المحدّدة من الحافّات اليسرى.',
    roleEn: 'Line the selected objects up on their left edges.',
    icon: 'alignLeft',
  },
  {
    key: 'sel.alignCenterH',
    group: 'selection',
    label: { hint: 'alignCenterH' },
    roleAr: 'محاذاة مراكز العناصر المحدّدة عموديًا.',
    roleEn: 'Line the selected objects up on their vertical centres.',
    icon: 'alignCenterH',
  },
  {
    key: 'sel.alignRight',
    group: 'selection',
    label: { hint: 'alignRight' },
    roleAr: 'محاذاة العناصر المحدّدة من الحافّات اليمنى.',
    roleEn: 'Line the selected objects up on their right edges.',
    icon: 'alignRight',
  },
  {
    key: 'sel.alignTop',
    group: 'selection',
    label: { hint: 'alignTop' },
    roleAr: 'محاذاة العناصر المحدّدة من الحافّات العليا.',
    roleEn: 'Line the selected objects up on their top edges.',
    icon: 'alignTop',
  },
  {
    key: 'sel.alignMiddleV',
    group: 'selection',
    label: { hint: 'alignMiddleV' },
    roleAr: 'محاذاة مراكز العناصر المحدّدة أفقيًا.',
    roleEn: 'Line the selected objects up on their horizontal centres.',
    icon: 'alignMiddleV',
  },
  {
    key: 'sel.alignBottom',
    group: 'selection',
    label: { hint: 'alignBottom' },
    roleAr: 'محاذاة العناصر المحدّدة من الحافّات السفلى.',
    roleEn: 'Line the selected objects up on their bottom edges.',
    icon: 'alignBottom',
  },
  {
    key: 'sel.centerH',
    group: 'selection',
    label: { hint: 'centerH' },
    roleAr: 'توسيط التحديد أفقيًا في اللوحة.',
    roleEn: 'Centre the selection horizontally on the canvas.',
    icon: 'centerH',
  },
  {
    key: 'sel.centerV',
    group: 'selection',
    label: { hint: 'centerV' },
    roleAr: 'توسيط التحديد عموديًا في اللوحة.',
    roleEn: 'Centre the selection vertically on the canvas.',
    icon: 'centerV',
  },
  {
    key: 'sel.more',
    group: 'selection',
    label: { ar: 'المزيد', en: 'More' },
    roleAr: 'عرض بقية إجراءات التحديد التي لا تظهر في الشريط.',
    roleEn: 'Show the rest of the selection actions that do not fit the bar.',
    icon: 'more',
  },
  {
    key: 'sel.stylePrev',
    group: 'selection',
    label: { hint: 'stylePrev' },
    roleAr: 'إلباس النص النمط السابق.',
    roleEn: 'Wear the previous style preset.',
  },
  {
    key: 'sel.styleNext',
    group: 'selection',
    label: { hint: 'styleNext' },
    roleAr: 'إلباس النص النمط التالي.',
    roleEn: 'Wear the next style preset.',
  },
  {
    key: 'sel.styleOpen',
    group: 'selection',
    label: { editor: 'style' },
    roleAr: 'فتح لوحة النمط لضبط النص المحدّد.',
    roleEn: 'Open the style panel to tune the selected text.',
    icon: 'sparkle',
  },
  {
    key: 'sel.glyphStyle',
    group: 'selection',
    label: { hint: 'glyphStyle' },
    roleAr: 'التنقل بين النمط الممتلئ والمفرّغ والرفيع للزخرفة المحددة.',
    roleEn:
      'Cycle the selected ornament between the solid, outline and thin styles.',
    icon: 'sparkle',
  },
  // The bar's own controls. They are not selection *actions* — nothing about the
  // selection makes them apply — but they live in the same sheet, and a control
  // with no entry is a control no surface can explain.
  {
    key: 'sel.pinToBar',
    group: 'selection',
    // Doubles as the sheet's one-line explanation of the pin, which is why the
    // role reads as an instruction rather than as a description of a control.
    label: { ar: 'تثبيت في الشريط', en: 'Pin to the bar' },
    roleAr: 'تثبيت الإجراء في مقدّمة شريط التحديد، حيث لا يقتطعه ضيق الصف.',
    roleEn:
      'Keep this action at the front of the selection bar, where the width of the row can never cut it.',
    icon: 'pin',
  },
  {
    key: 'sel.unpinFromBar',
    group: 'selection',
    label: { ar: 'إلغاء التثبيت', en: 'Unpin from the bar' },
    roleAr:
      'إخراج الإجراء من شريط التحديد وإعادته إلى قائمة المزيد. وفي الشريط، الضغطة المطوّلة تفعل الشيء نفسه.',
    roleEn:
      'Take this action out of the selection bar and back into More. In the bar itself, a long press does the same.',
    icon: 'pin',
  },
  {
    key: 'sel.partPrev',
    group: 'selection',
    label: { hint: 'partPrev' },
    roleAr: 'الانتقال إلى العنصر السابق في المجموعة المحدّدة.',
    roleEn: 'Move to the previous member of the selected collection.',
  },
  {
    key: 'sel.partNext',
    group: 'selection',
    label: { hint: 'partNext' },
    roleAr: 'الانتقال إلى العنصر التالي في المجموعة المحدّدة.',
    roleEn: 'Move to the next member of the selected collection.',
  },
  {
    key: 'sel.memberTile',
    group: 'selection',
    label: { ar: 'عنصر في المجموعة', en: 'Member tile' },
    roleAr: 'الانتقال مباشرة إلى هذا العنصر داخل المجموعة.',
    roleEn: 'Jump straight to this member inside the collection.',
  },
  {
    key: 'sel.collectionBar',
    group: 'selection',
    label: { ar: 'شريط المجموعة', en: 'Collection bar' },
    roleAr:
      'يعرض عدد عناصر التحديد، وعند الدخول إلى المجموعة يعرض العنصر الحالي مع شريحة لكل عنصر للتنقل بينها. لمس العدد يعيدك إلى المجموعة كاملة.',
    roleEn:
      'Shows how many elements the selection holds — or, inside a collection, which member you are on, with a tile per member to move between them. Tapping the count goes back to the whole collection.',
  },
  {
    key: 'sel.swatchInk',
    group: 'selection',
    label: { ar: 'لون النص', en: 'Text colour' },
    roleAr: 'تلوين النص المحدّد بهذا الحبر.',
    roleEn: 'Recolour the selected text with this ink.',
    icon: 'palette',
  },
  {
    key: 'sel.swatchPaper',
    group: 'selection',
    label: { ar: 'لون الورق', en: 'Paper colour' },
    roleAr: 'جعل خلفية اللوحة بهذا اللون.',
    roleEn: 'Set the canvas background to this colour.',
    icon: 'image',
  },
  {
    key: 'sel.empty',
    group: 'selection',
    label: { ar: 'لا يوجد تحديد', en: 'Nothing selected' },
    roleAr:
      'شريط التحديد فارغ لأن شيئًا غير محدّد. المس عنصرًا على اللوحة، أو أضف نصًّا بأداة النص.',
    roleEn:
      'The selection bar is empty because nothing is selected. Tap an object on the canvas, or add text with the Text tool.',
  },

  // ---------------------------------------------------------------------------
  // Canvas gestures — the part no tooltip can carry.
  // ---------------------------------------------------------------------------
  {
    key: 'canvas.tap',
    group: 'canvas',
    label: { ar: 'اللمس', en: 'Tap' },
    roleAr: 'المس عنصرًا لتحديده، في أي أداة.',
    roleEn: 'Tap an object to select it, in any tool.',
    icon: 'edit',
  },
  {
    key: 'canvas.drag',
    group: 'canvas',
    label: { ar: 'السحب', en: 'Drag' },
    roleAr: 'اسحب التحديد لتحريكه.',
    roleEn: 'Drag the selection to move it.',
  },
  {
    key: 'canvas.handles',
    group: 'canvas',
    label: { ar: 'المقابض', en: 'Handles' },
    roleAr: 'اسحب مقبض زاوية لتغيير الحجم، أو مقبض ضلع للتمديد.',
    roleEn: 'Drag a corner handle to resize, or an edge handle to stretch.',
  },
  {
    key: 'canvas.collectionHandles',
    group: 'canvas',
    label: { ar: 'مقابض المجموعة', en: 'Collection handles' },
    roleAr:
      'حين يكون التحديد أكثر من عنصر، تحيط به مقابض واحدة: سحبها يحيط المجموعة كاملة بالطرف المقابل دون تغيير ترتيبها الداخلي.',
    roleEn:
      'With more than one element selected, one set of handles wraps them all: dragging one scales the whole collection about the opposite edge, keeping the arrangement intact.',
  },
  {
    key: 'canvas.collectionEnter',
    group: 'canvas',
    label: { ar: 'الدخول إلى مجموعة', en: 'Enter a collection' },
    roleAr: 'المس عنصرًا داخل مجموعة محدّدة للدخول إليه وتحريره وحده.',
    roleEn:
      'Tap a member of a collection that is already selected to step inside and edit it on its own.',
  },
  {
    key: 'canvas.collectionExit',
    group: 'canvas',
    label: { ar: 'الخروج من مجموعة', en: 'Leave a collection' },
    roleAr: 'المس خارج المجموعة للخروج منها وتحديدها كاملة.',
    roleEn:
      'Tap outside the collection to leave it and select the whole of it.',
  },
  {
    key: 'canvas.rotate',
    group: 'canvas',
    label: { ar: 'مقبض التدوير', en: 'Rotate grip' },
    roleAr: 'اسحب المقبض الدائري فوق التحديد لتدويره.',
    roleEn: 'Drag the round grip above the selection to rotate it.',
  },
  {
    key: 'canvas.wrap',
    group: 'canvas',
    label: { ar: 'مقبض العرض', en: 'Width handle' },
    roleAr: 'اسحب المقبض الجانبي لتوزيع النص على عدّة أسطر.',
    roleEn: 'Drag the side handle to wrap the text over several lines.',
  },
  {
    key: 'canvas.deselect',
    group: 'canvas',
    label: { ar: 'إلغاء التحديد', en: 'Deselect' },
    roleAr: 'المس مكانًا فارغًا لإلغاء التحديد.',
    roleEn: 'Tap empty canvas to clear the selection.',
  },

  // ---------------------------------------------------------------------------
  // Panels
  // ---------------------------------------------------------------------------
  {
    key: 'panel.textInput',
    group: 'panels',
    label: { editor: 'enterText' },
    roleAr: 'اكتب الكلمات التي تريدها على اللوحة.',
    roleEn: 'Type the words you want on the canvas.',
    icon: 'type',
  },
  {
    key: 'panel.font',
    group: 'panels',
    label: { ar: 'الخط', en: 'Typeface' },
    roleAr: 'اختيار الخط الخطّي الذي يُرسم به هذا النص.',
    roleEn: 'Pick the calligraphic face this text is drawn in.',
  },
  {
    key: 'panel.fontSize',
    group: 'panels',
    label: { editor: 'fontSize' },
    roleAr: 'تحديد حجم رسم النص.',
    roleEn: 'Set how large the text is drawn.',
  },
  {
    key: 'panel.fontSizeUp',
    group: 'panels',
    label: { ar: 'خطوة أكبر', en: 'One step larger' },
    roleAr: 'خطوة أكبر.',
    roleEn: 'One step larger.',
    icon: 'plus',
  },
  {
    key: 'panel.fontSizeDown',
    group: 'panels',
    label: { ar: 'خطوة أصغر', en: 'One step smaller' },
    roleAr: 'خطوة أصغر.',
    roleEn: 'One step smaller.',
    icon: 'minus',
  },
  {
    key: 'panel.done',
    group: 'panels',
    label: { ar: 'تم', en: 'Done' },
    roleAr: 'تثبيت التغيير وإغلاق اللوحة.',
    roleEn: 'Commit the change and close the panel.',
    icon: 'check',
  },
  {
    key: 'panel.preset',
    group: 'panels',
    label: { ar: 'نمط جاهز', en: 'Preset' },
    roleAr: 'تطبيق مظهر جاهز على النص المحدّد.',
    roleEn: 'Apply a ready-made look to the selected text.',
    icon: 'sparkle',
  },
  {
    key: 'panel.lineHeight',
    group: 'panels',
    label: { editor: 'lineHeight' },
    roleAr: 'ضبط المسافة بين الأسطر.',
    roleEn: 'Set the space between lines.',
  },
  {
    key: 'panel.opacity',
    group: 'panels',
    label: { editor: 'opacity' },
    roleAr: 'إخفاء التحديد جزئيًا. لا يصبح خفيًا تمامًا أبدًا.',
    roleEn: 'Fade the selection. It never goes fully invisible.',
  },
  {
    key: 'panel.align',
    group: 'panels',
    label: { editor: 'align' },
    roleAr: 'اختيار محاذاة النص متعدّد الأسطر.',
    roleEn: 'Choose how multi-line text lines up.',
    icon: 'alignLeft',
  },
  {
    key: 'export.image',
    group: 'panels',
    label: { editor: 'exportShareImage' },
    roleAr: 'حفظ التصميم صورة PNG بعرض 2048 بكسل أو مشاركته.',
    roleEn: 'Save or share the design as a 2048 px PNG.',
    icon: 'image',
  },
  {
    key: 'export.svg',
    group: 'panels',
    label: { editor: 'exportSvgAction' },
    roleAr: 'تصدير ملف SVG متجهي يمكن تعديله في تطبيق آخر.',
    roleEn: 'Export a vector SVG you can edit in another app.',
    icon: 'export',
  },
  {
    key: 'export.project',
    group: 'panels',
    label: { editor: 'exportProjectFile' },
    roleAr: 'حفظ ملف المشروع القابل للتعديل لنقله إلى جهاز آخر.',
    roleEn: 'Save the editable project file to move it to another device.',
    icon: 'download',
  },

  // ---------------------------------------------------------------------------
  // Keyboard-only actions — reachable from no button, so the sheet is the only
  // place they can be discovered.
  // ---------------------------------------------------------------------------
  {
    key: 'key.selectAll',
    group: 'keyboard',
    label: { ar: 'تحديد الكل', en: 'Select all' },
    roleAr: 'تحديد كل عناصر اللوحة.',
    roleEn: 'Select every object on the canvas.',
    shortcutId: 'selectAll',
  },
  {
    key: 'key.clearSelection',
    group: 'keyboard',
    label: { ar: 'إلغاء التحديد', en: 'Clear selection' },
    roleAr: 'إلغاء التحديد دون حذف أي شيء.',
    roleEn: 'Deselect without deleting anything.',
    shortcutId: 'clearSelection',
  },
  {
    key: 'key.nudgeLeft',
    group: 'keyboard',
    label: { ar: 'إزاحة لليسار', en: 'Nudge left' },
    roleAr: 'تحريك التحديد وحدة واحدة، ومع Shift عشر وحدات.',
    roleEn: 'Move the selection one unit; hold Shift for ten.',
    shortcutId: 'nudgeLeft',
  },
  {
    key: 'key.nudgeRight',
    group: 'keyboard',
    label: { ar: 'إزاحة لليمين', en: 'Nudge right' },
    roleAr: 'تحريك التحديد وحدة واحدة إلى اليمين.',
    roleEn: 'Move the selection one unit to the right.',
    shortcutId: 'nudgeRight',
  },
  {
    key: 'key.nudgeUp',
    group: 'keyboard',
    label: { ar: 'إزاحة للأعلى', en: 'Nudge up' },
    roleAr: 'تحريك التحديد وحدة واحدة إلى الأعلى.',
    roleEn: 'Move the selection one unit up.',
    shortcutId: 'nudgeUp',
  },
  {
    key: 'key.nudgeDown',
    group: 'keyboard',
    label: { ar: 'إزاحة للأسفل', en: 'Nudge down' },
    roleAr: 'تحريك التحديد وحدة واحدة إلى الأسفل.',
    roleEn: 'Move the selection one unit down.',
    shortcutId: 'nudgeDown',
  },
] as const satisfies readonly HelpEntry[];

/** Every key in the table. Derived, so a new entry widens it automatically. */
export type HelpKey = (typeof HELP_ENTRIES)[number]['key'];

const BY_KEY = new Map<string, HelpEntry>();
for (const entry of HELP_ENTRIES) {
  BY_KEY.set(entry.key, entry);
}

/** Throws on an unknown key: a typo should fail loudly, not render blank. */
export function helpEntry(key: HelpKey): HelpEntry {
  const entry = BY_KEY.get(key);
  if (!entry) {
    throw new Error(`Unknown help key: ${key}`);
  }
  return entry;
}

/** The section heading metadata for a group. */
export function helpGroup(group: HelpGroup): HelpGroupMeta {
  const meta = HELP_GROUPS.find((candidate) => candidate.key === group);
  if (!meta) {
    throw new Error(`Unknown help group: ${group}`);
  }
  return meta;
}

/** The short label, resolved from wherever it already lives. */
export function helpLabel(
  label: HelpLabel,
  t: Translation,
  language: Language,
): string {
  if ('hint' in label) {
    return t.editor.hints[label.hint];
  }
  if ('editor' in label) {
    return t.editor[label.editor];
  }
  return language === 'ar' ? label.ar : label.en;
}

/** The one-sentence role that explain mode reads out. */
export function helpRole(entry: HelpEntry, language: Language): string {
  return language === 'ar' ? entry.roleAr : entry.roleEn;
}

/** The section heading. */
export function helpGroupLabel(
  group: HelpGroupMeta,
  language: Language,
): string {
  return language === 'ar' ? group.labelAr : group.labelEn;
}

/** Entries of one group, in table order. */
export function helpGroupEntries(group: HelpGroup): readonly HelpEntry[] {
  return HELP_ENTRIES.filter((entry) => entry.group === group);
}
