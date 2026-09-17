/**
 * The selection bar's action table — which actions the rail shows, in what
 * order, and where the rest go.
 *
 * Three constraints shape this module:
 *
 * - **One row can never hold them all.** A selection owns up to twenty
 *   controls; a phone rail is ~336dp wide. Letting the row scroll instead
 *   parks the trailing controls off the screen — and in Arabic that is the
 *   *left* edge, where nothing signals they exist. So the rail renders the
 *   highest-priority actions that actually fit and the remainder live in a
 *   sheet behind a permanent `⋯`, which is always reachable.
 * - **The order is the user's to keep.** The rail truncates from its tail, so
 *   the only way to protect an action from being cut is to put it at the front.
 *   `defaultSelectionBar()` is the order a fresh install starts with; a pin
 *   moves an action to the head of that list and an unpin drops it, and the
 *   result *is* what the rail renders. The sheet is the surface that manages
 *   it, because the rail has neither the width nor the room for a second
 *   control per action.
 * - **Copy lives in one place.** Learn mode (`src/editor/help`) already holds a
 *   label, a role, an icon and a shortcut for every one of these actions, so
 *   this table names only *ids*: `sel.<id>` is the help key. A control cannot
 *   end up with two different names, and a new action is a catalog entry plus
 *   one line here.
 *
 * Nothing here reads the editor store: the screen supplies the behaviour, so
 * the mapping from "what the selection is" to "what is available" stays pure —
 * which is also what lets `scripts/check-help.mjs` keep the catalog it borrows
 * its labels from honest.
 */

import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAnimatedStyle } from "react-native-reanimated";

import {
  AnimatedPressable,
  DirectionIcon,
  Icon,
  IconButton,
  type IconName,
} from "@/components/ui";
import {
  HelpCard,
  HelpRow,
  helpEntry,
  helpLabel,
  helpRole,
  type HelpKey,
  type HelpMode,
} from "@/editor/help";
import type { EditorShortcutHints } from "@/editor/shortcuts";
import { usePressFeedback } from "@/hooks/use-press-feedback";
import { useTheme } from "@/hooks/use-theme";
import { useT } from "@/i18n";
import { rowStyle } from "@/i18n/rtl";
import type { Language, Translation } from "@/i18n/strings";
import { fontRoles, radius, spacing, typeScale } from "@/theme";

/** Every action the selection bar can carry. `sel.<id>` is its help key. */
export type SelectionActionId =
  | "styleOpen"
  | "stylePrev"
  | "styleNext"
  | "scaleUp"
  | "scaleDown"
  | "rotateCcw"
  | "rotateCw"
  | "flipH"
  | "fitText"
  | "split"
  | "rejoin"
  | "group"
  | "ungroup"
  | "duplicate"
  | "bringToFront"
  | "sendToBack"
  | "delete"
  | "alignLeft"
  | "alignCenterH"
  | "alignRight"
  | "alignTop"
  | "alignMiddleV"
  | "alignBottom"
  | "centerH"
  | "centerV";

/**
 * The rail also renders the `⋯` control through the same descriptor, so it
 * inherits a label, a role, a chord and an icon like every other button. Its
 * *press* is the one that differs: it is resolved as a disclosure, so learn
 * mode leaves it working while every other press explains instead.
 */
export type SelectionCommandId = SelectionActionId | "more";

/**
 * What the current selection is capable of. Only these four facts decide which
 * actions exist — everything else about an action is static.
 */
export interface SelectionShape {
  /** A text object is selected, so the text-only actions apply. */
  readonly isText: boolean;
  /** The text can be broken into parts. */
  readonly canSplit: boolean;
  /** The selection is one part of an already-split word. */
  readonly canRejoin: boolean;
  /** More than one element is selected, so the align group applies. */
  readonly isMulti: boolean;
  /** Two or more loose elements are selected, so they can become a group. */
  readonly canGroup: boolean;
  /** The selection is exactly one whole group, so it can be dissolved. */
  readonly canUngroup: boolean;
}

/**
 * The rail, in priority order — one entry per slot, first match wins.
 *
 * `split` and `rejoin` share a slot because they are the same decision seen
 * from two sides: only one of them can ever apply to a given selection. The
 * order is the truncation order too: when only six slots fit on a phone, the
 * six that survive are the first six.
 *
 * `group` and `ungroup` share one for the same reason: a selection is either a
 * set of loose elements (which can be grouped) or one whole group (which can be
 * dissolved), never both at once.
 *
 * `styleOpen` leads on purpose. It is the only route to the style panel, so it
 * has to survive every truncation — and it costs one slot rather than the five
 * a full preset navigator (arrows + name) used to take out of the same row.
 */
const RAIL_SLOTS: readonly (readonly SelectionActionId[])[] = [
  ["styleOpen"],
  ["scaleUp"],
  ["scaleDown"],
  ["fitText"],
  ["split", "rejoin"],
  ["group", "ungroup"],
  ["duplicate"],
  ["bringToFront"],
  ["sendToBack"],
  ["delete"],
];

/**
 * Actions that live only in the `⋯` sheet.
 *
 * Rotation and flip are already gestures on the canvas — the grip above the
 * selection and a two-finger twist — so a rail button for them is a duplicate.
 * Scale keeps its buttons in the rail instead, because pinch-to-zoom is the
 * least discoverable of the gestures. The align group only ever applies to a
 * multi-selection, and the canvas-centre pair is rare next to the rest.
 *
 * The preset arrows land here for a different reason: they are a second route
 * to what the style panel already lists, and at two slots they cost more rail
 * width than the panel's own button. Stepping through presets is a two-tap
 * errand now; picking one from the panel is still one.
 */
const OVERFLOW_ACTIONS: readonly SelectionActionId[] = [
  "rotateCcw",
  "rotateCw",
  "flipH",
  "alignLeft",
  "alignCenterH",
  "alignRight",
  "alignTop",
  "alignMiddleV",
  "alignBottom",
  "centerH",
  "centerV",
  "stylePrev",
  "styleNext",
];

/** Destructive actions wear the danger fill in the sheet. */
const DANGER_ACTIONS: readonly SelectionActionId[] = ["delete"];

/**
 * Which slot each id belongs to, as an index into `RAIL_SLOTS`.
 *
 * A lookup rather than a re-walk of the table, because the rail is built from a
 * flat order of ids: the one-per-slot rule has to survive that flattening, so
 * `split` and `rejoin` cannot both claim a button when a selection can do
 * either.
 */
const SLOT_INDEX_OF = new Map<SelectionActionId, number>();
RAIL_SLOTS.forEach((slot, index) => {
  for (const id of slot) {
    SLOT_INDEX_OF.set(id, index);
  }
});

/**
 * Every id either surface can carry, in the order the sheet lists them: the
 * rail's priorities first — so an action the bar just dropped is near the top
 * of the sheet, where it can be picked straight back up — then the sheet-only
 * ones. The two tables are disjoint by construction, which is what lets this be
 * a plain concatenation.
 */
const SHEET_ORDER: readonly SelectionActionId[] = [
  ...RAIL_SLOTS.flat(),
  ...OVERFLOW_ACTIONS,
];

/**
 * The bar a fresh install opens with: the slot order, flattened.
 *
 * Used both as the rail's order while nothing is stored and as the list a first
 * pin reorders, so a pin can never be taken from an empty bar.
 */
export function defaultSelectionBar(): SelectionActionId[] {
  return RAIL_SLOTS.flat();
}

function isAvailable(id: SelectionActionId, shape: SelectionShape): boolean {
  switch (id) {
    case "styleOpen":
    case "stylePrev":
    case "styleNext":
    case "fitText":
      return shape.isText;
    case "split":
      return shape.canSplit;
    case "rejoin":
      return shape.canRejoin;
    case "group":
      return shape.canGroup;
    case "ungroup":
      return shape.canUngroup;
    case "alignLeft":
    case "alignCenterH":
    case "alignRight":
    case "alignTop":
    case "alignMiddleV":
    case "alignBottom":
      return shape.isMulti;
    default:
      return true;
  }
}

/**
 * The rail's candidate actions, in truncation order: the bar's order with two
 * filters — what the selection cannot use, and the one-per-slot rule (the first
 * survivor of a shared slot wins).
 *
 * The order is *filtered*, never rebuilt, so a pin cannot be lost to whatever
 * happens to be selected: `fitText` stays in the order while a shape is
 * selected (it is simply not rendered) and comes back by itself the moment text
 * is selected again.
 */
export function railActionIds(
  shape: SelectionShape,
  order: readonly SelectionActionId[],
): SelectionActionId[] {
  const ids: SelectionActionId[] = [];
  const filledSlots = new Set<number>();
  for (const id of order) {
    if (!isAvailable(id, shape)) {
      continue;
    }
    const slot = SLOT_INDEX_OF.get(id);
    if (slot !== undefined) {
      if (filledSlots.has(slot)) {
        continue;
      }
      filledSlots.add(slot);
    }
    ids.push(id);
  }
  return ids;
}

/**
 * Everything the selection can do that the rail is not showing — the sheet's
 * contents.
 *
 * The rule is "in the bar, or in here": an action is reachable from exactly one
 * of the two surfaces. An action the user took out of the bar is therefore
 * listed here, which is also how it gets back in; the caller passes the rail's
 * *visible* head, so whatever the width budget cut is listed here too.
 */
export function overflowActionIds(
  shape: SelectionShape,
  railIds: readonly SelectionActionId[],
): SelectionActionId[] {
  const inRail = new Set(railIds);
  return SHEET_ORDER.filter((id) => isAvailable(id, shape) && !inRail.has(id));
}

/** An action with its copy resolved, ready to render. */
export interface SelectionAction {
  /** The action's id — for the few call sites that need more than its copy. */
  readonly id: SelectionCommandId;
  readonly key: HelpKey;
  readonly label: string;
  /** Tooltip text: the label, plus its chord where the platform has one. */
  readonly hint: string;
  /**
   * The bare chord, e.g. `"⇧T"`, or `""` where the platform has no keyboard.
   * The reference list prints this beside the label the way the help sheet
   * does; `hint` is the same pair already joined for a tooltip, which is why
   * both exist rather than one derived from the other.
   */
  readonly chord: string;
  /** The one-sentence role, used by screen readers and learn mode. */
  readonly role: string;
  /**
   * `undefined` only if the catalog entry omits one, which every selection
   * entry currently provides — the omission is what marks a control whose glyph
   * depends on direction.
   */
  readonly icon: IconName | undefined;
  readonly danger: boolean;
  readonly onPress: () => void;
  /**
   * The pin state and its toggle — absent on the `⋯` control itself, which is
   * not an action and can never be taken out of the bar, because it is the way
   * everything else gets back in.
   */
  readonly pin?: SelectionPin;
}

/** What the sheet's pin control reads and does. */
export interface SelectionPin {
  /** True while the action is in the bar. */
  readonly pinned: boolean;
  /** The control's name: it says what a press *will do*, not what is shown. */
  readonly label: string;
  readonly toggle: () => void;
}

export interface SelectionActionSources {
  readonly t: Translation;
  readonly language: Language;
  /** Learn-mode binder: while it is on, a press explains instead of acting. */
  readonly press: HelpMode["press"];
  /** Blank chords on native, real ones on web (`EditorShortcutHints`). */
  readonly shortcuts: EditorShortcutHints;
  /** What each id does. A `Record`, so a new id cannot be left unhandled. */
  readonly run: Readonly<Record<SelectionCommandId, () => void>>;
  /** The bar's order, so an action can report whether it is currently in it. */
  readonly bar: readonly SelectionActionId[];
  /** Moves an action to the head of the bar, or takes it out again. */
  readonly togglePin: (id: SelectionActionId) => void;
  /**
   * Marks a control whose press *reveals* other annotated controls rather than
   * changing the design — the rail's `⋯`.
   *
   * It is the one press learn mode does not replace. `⋯` is the only route to
   * the actions the rail had no room for, so swallowing it would leave those
   * controls with no explanation on any surface. Off-mode it changes nothing:
   * the same handler runs either way.
   */
  readonly disclosure?: boolean;
  /**
   * Runs after the action itself, for a surface that has to get out of the way:
   * the overflow sheet closes on press so the canvas it just changed is visible
   * again. Learn mode never reaches it, because it replaces the action.
   */
  readonly afterRun?: () => void;
}

/** Turns ids into renderable actions, reading all copy from the help table. */
export function resolveSelectionActions(
  ids: readonly SelectionCommandId[],
  sources: SelectionActionSources,
): SelectionAction[] {
  const {
    t,
    language,
    press,
    shortcuts,
    run,
    bar,
    togglePin,
    afterRun,
    disclosure,
  } = sources;
  const inBar = new Set<SelectionActionId>(bar);
  return ids.map((id) => {
    const key = `sel.${id}` as HelpKey;
    const entry = helpEntry(key);
    const label = helpLabel(entry.label, t, language);
    const action = run[id];
    const bound = afterRun
      ? () => {
          action();
          afterRun();
        }
      : action;
    // `⋯` is a command, not an action: it never enters `bar`, so it has no pin
    // to read — which is also what keeps `bar` a list of actions.
    const pinnable = id !== "more";
    const pinned = inBar.has(id as SelectionActionId);
    return {
      id,
      key,
      label,
      hint: entry.shortcutId ? shortcuts.hint(label, entry.shortcutId) : label,
      chord: entry.shortcutId ? shortcuts.chord(entry.shortcutId) : "",
      role: helpRole(entry, language),
      icon: entry.icon,
      danger: DANGER_ACTIONS.includes(id as SelectionActionId),
      onPress: disclosure ? bound : press(key, bound),
      pin: pinnable
        ? {
            pinned,
            // The name is the *other* state's, so a press reads as what it will
            // do: an action in the bar offers to take itself out.
            label: helpLabel(
              helpEntry(pinned ? "sel.unpinFromBar" : "sel.pinToBar").label,
              t,
              language,
            ),
            toggle: () => togglePin(id as SelectionActionId),
          }
        : undefined,
    };
  });
}

/**
 * The rail's geometry. Declared once, because the components below and the
 * width maths have to agree: a button that grows without the maths knowing
 * would push the row past the width the count was computed from.
 */
const RAIL_BUTTON_SIZE = 40;
const RAIL_GAP = spacing.xs;
/** The rail's inner padding, per side. */
const RAIL_PADDING = spacing.md;

/**
 * The most of the row the context zone may be *charged*.
 *
 * The zone keeps a scroller, so its content can always ask for more width than
 * the rail has. Measuring it from that content (rather than from its laid-out
 * box, which would be circular — the box is whatever the actions leave) handed
 * it an unbounded claim against their budget. Four parts of a split word were
 * enough to claim the entire row: the bar then rendered nothing but `⋯`, so the
 * parts strip had *replaced* the selection bar instead of sitting beside it.
 * That is the opposite of what this table is for (DESIGN.md §5 — the actions
 * rank and truncate, the context zone scrolls).
 *
 * The zone is therefore charged at most this share of the usable width, and the
 * actions keep the rest. The strip scrolls harder instead; parts and swatches
 * are content, so that is the honest degradation.
 */
const CONTEXT_ZONE_MAX_SHARE = 0.4;

/**
 * The fewest buttons the cluster keeps room for: the head action that leads the
 * bar, plus `⋯`.
 *
 * `⋯` is the only route to every action the budget cut, so it can never be the
 * thing that gets cut — and it is useless without at least one action to have
 * been cut in the first place. Below this the zone is charged less than its
 * share rather than the bar emptying itself into the sheet.
 */
const RAIL_MIN_BUTTONS = 2;

/** The width `RAIL_MIN_BUTTONS` buttons and the gap between them need. */
const RAIL_MIN_CLUSTER =
  RAIL_MIN_BUTTONS * RAIL_BUTTON_SIZE + (RAIL_MIN_BUTTONS - 1) * RAIL_GAP;

/**
 * How many actions fit beside everything else in the row.
 *
 * Both siblings are measured from their *content* rather than from their
 * laid-out box, because each is sized to whatever is left over and measuring
 * the box would be circular. A width of `0` means the sibling is not rendered
 * at all, so it is charged nothing — including no gap.
 */
export function visibleActionCount(args: {
  railWidth: number;
  /** The context zone's intrinsic width, or `0` when there is no zone. */
  contextWidth: number;
  available: number;
}): number {
  const { railWidth, contextWidth, available } = args;
  if (railWidth <= 0 || available <= 0) {
    // Unmeasured: assume everything fits, and let the next layout pass correct
    // the row. One frame of spill beats a rail that renders empty first.
    return available;
  }
  const usable = railWidth - 2 * RAIL_PADDING;
  // What the zone may claim: at most its share, and never so much that the
  // cluster loses its head, its `⋯`, or the gap that separates the two.
  const zoneCeiling = Math.max(
    0,
    Math.min(
      usable * CONTEXT_ZONE_MAX_SHARE,
      usable - RAIL_MIN_CLUSTER - RAIL_GAP,
    ),
  );
  const zoneCharge =
    contextWidth > 0 ? Math.min(contextWidth, zoneCeiling) + RAIL_GAP : 0;
  const room = usable - zoneCharge;
  // The visible actions *and* the `⋯` have to fit:
  //   (visible + 1) * button + visible * gap <= room
  const fit = Math.floor(
    (room - RAIL_BUTTON_SIZE) / (RAIL_BUTTON_SIZE + RAIL_GAP),
  );
  return Math.max(0, Math.min(available, fit));
}

export interface SelectionRailActionsProps {
  /** Rail candidates in truncation order, `railActionIds` resolved. */
  actions: readonly SelectionAction[];
  /** How many of them fit; the rest are behind `more`. */
  visibleCount: number;
  /** The permanent `⋯` control. */
  more: SelectionAction;
  isRTL: boolean;
}

/** The rail cluster: the actions that fit, then `⋯`. */
export function SelectionRailActions({
  actions,
  visibleCount,
  more,
  isRTL,
}: SelectionRailActionsProps) {
  const { colors: c } = useTheme();
  return (
    <View style={[styles.rail, rowStyle(isRTL)]}>
      {actions.slice(0, visibleCount).map((action) => (
        <IconButton
          key={action.key}
          onPress={action.onPress}
          // The rail's long-press is the pin, so the button never opens its own
          // hint bubble (`ui/icon-button.tsx`): one gesture, one meaning. The
          // rail's labels are a learn-mode tap away instead.
          onLongPress={action.pin?.toggle}
          accessibilityLabel={action.label}
          accessibilityHint={action.role}
          hint={action.hint}
        >
          {action.icon ? (
            <Icon
              name={action.icon}
              size={16}
              color={action.danger ? c.danger : c.ink}
            />
          ) : null}
        </IconButton>
      ))}
      <IconButton
        onPress={more.onPress}
        accessibilityLabel={more.label}
        accessibilityHint={more.role}
        hint={more.hint}
      >
        <Icon name={more.icon ?? "more"} size={16} />
      </IconButton>
    </View>
  );
}

/** How far the pin's box has to reach past its glyph to clear the 44pt floor. */
const PIN_HIT_SLOP = { top: 9, bottom: 9, left: 9, right: 9 };

/**
 * Which way the two entries the catalog leaves iconless point.
 *
 * `stylePrev`/`styleNext` carry no `icon` there because a fixed arrow would read
 * backwards in Arabic — the mirroring belongs to the renderer, not to the table.
 * The tile supplies it, pointing the same way the parts strip's own
 * previous/next buttons do.
 */
const STEP_DIRECTION: Partial<Record<SelectionActionId, "prev" | "next">> = {
  stylePrev: "prev",
  styleNext: "next",
};

/**
 * One action in the `⋯` sheet: a square tile with its glyph, its name and its
 * pin.
 *
 * Glyphs *and* labels, because that is the division of labour between the two
 * surfaces: the rail is the fast path for someone who already knows the glyphs,
 * and this sheet is where an ambiguous one gets named. The tile is sized from
 * the sheet's width rather than from its own text, and `aspectRatio` keeps it
 * square — a grid of differently shaped tiles is a list wearing a grid's
 * clothes.
 *
 * The pin is a control of its own rather than a long-press on the tile: this is
 * the discoverable half of the mechanism, and the tile's press is already spent
 * on the action itself. Pressing it never closes the sheet — the sheet is the
 * tool that just changed, so closing it would hide the reordering.
 */
function SelectionActionTile({ action }: { action: SelectionAction }) {
  const { colors: c } = useTheme();
  const { language, isRTL } = useT();
  const fonts = fontRoles[language];
  const press = usePressFeedback();
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.scale.value }],
  }));
  const ink = action.danger ? c.danger : c.ink;
  const step = STEP_DIRECTION[action.id as SelectionActionId];
  const pin = action.pin;
  return (
    <View style={styles.tileWrap}>
      <AnimatedPressable
        onPress={action.onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
        accessibilityLabel={action.label}
        accessibilityHint={action.role}
        style={[
          styles.tile,
          { borderColor: c.border, backgroundColor: c.surfaceAlt },
          animStyle,
        ]}
      >
        {action.icon || !step ? (
          <Icon name={action.icon ?? "more"} size={20} color={ink} />
        ) : (
          <DirectionIcon
            isRTL={step === "prev" ? !isRTL : isRTL}
            size={20}
            color={ink}
          />
        )}
        <Text
          numberOfLines={2}
          style={[styles.tileLabel, { color: ink, fontFamily: fonts.ui }]}
        >
          {action.label}
        </Text>
      </AnimatedPressable>
      {pin && (
        <Pressable
          onPress={pin.toggle}
          hitSlop={PIN_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={pin.label}
          accessibilityState={{ checked: pin.pinned }}
          style={[styles.pin, isRTL ? styles.pinLeft : styles.pinRight]}
        >
          <Icon
            name="pin"
            size={13}
            weight={pin.pinned ? "fill" : "regular"}
            color={pin.pinned ? c.accentText : c.faint}
          />
        </Pressable>
      )}
    </View>
  );
}

export interface SelectionOverflowActionsProps {
  actions: readonly SelectionAction[];
  isRTL: boolean;
  /**
   * Learn mode. The sheet stops being a control surface and becomes the
   * reference for these controls: the same actions in the same order, read
   * rather than pressed. The rows are plain by construction, so there is
   * nothing for learn mode to intercept — which is the point, because a sheet
   * of buttons that all explained themselves would never name any of them.
   */
  learn?: boolean;
}

/**
 * The `⋯` sheet's body.
 *
 * Off learn mode: the actions the bar is not showing, as a grid of square tiles
 * — glyph, name, pin. The note above the grid is the pin control's own role,
 * taken from the catalog rather than written again here: it is the half of the
 * mechanism no gesture can explain for itself (the rail's long-press has no
 * room to), and one sentence in one place is enough for both surfaces.
 *
 * In learn mode: one reference row per control (`HelpRow`), the same shape the
 * help sheet lists them in, so the section can be read in place instead of
 * being the only part of the bar with no explanation of its own. Neither the
 * pins nor the note belong there: a reference list changes nothing, so it has
 * nothing to choose between.
 */
export function SelectionOverflowActions({
  actions,
  isRTL,
  learn = false,
}: SelectionOverflowActionsProps) {
  const { colors: c } = useTheme();
  const { language } = useT();
  if (learn) {
    return (
      <HelpCard>
        {actions.map((action, index) => (
          <HelpRow
            key={action.key}
            label={action.label}
            role={action.role}
            icon={action.icon}
            keys={action.chord}
            divided={index > 0}
          />
        ))}
      </HelpCard>
    );
  }
  return (
    <View style={styles.sheet}>
      <Text
        style={[
          styles.sheetNote,
          { color: c.muted, fontFamily: fontRoles[language].ui },
        ]}
      >
        {helpRole(helpEntry("sel.pinToBar"), language)}
      </Text>
      <View style={[styles.grid, rowStyle(isRTL)]}>
        {actions.map((action) => (
          <SelectionActionTile key={action.key} action={action} />
        ))}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  // No `flexDirection` here on purpose: direction is the caller's to decide
  // through `rowStyle`, so the row can never be hardcoded one way.
  rail: {
    alignItems: "center",
    gap: RAIL_GAP,
  },
  sheet: { gap: spacing.sm },
  sheetNote: {
    fontSize: typeScale.caption.size,
    lineHeight: typeScale.caption.lineHeight,
  },
  grid: {
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  /**
   * A quarter of the sheet's width, kept square by `aspectRatio`: four tiles to
   * a phone row, and no tile taller than its neighbours because one label
   * needed a second line. `relative` explicitly, because the pin is positioned
   * against it and react-native-web does not make every box a containing block.
   */
  tileWrap: { flexBasis: "22%", aspectRatio: 1, position: "relative" },
  tile: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xxs,
    paddingHorizontal: spacing.xs,
  },
  tileLabel: {
    fontSize: typeScale.micro.size,
    lineHeight: typeScale.micro.lineHeight,
    textAlign: "center",
  },
  /**
   * The pin sits in the tile's trailing corner — the one place the centred glyph
   * and (at most) two lines of label never reach — and mirrors with direction
   * like every other trailing affordance.
   */
  pin: {
    position: "absolute",
    top: spacing.xxs,
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  pinLeft: { left: spacing.xxs },
  pinRight: { right: spacing.xxs },
});
