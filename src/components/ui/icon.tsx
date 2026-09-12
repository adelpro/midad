import { type ComponentType, type ReactElement } from "react";

import {
  AlignBottom,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignLeft,
  AlignRight,
  AlignTop,
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowDown,
  ArrowsClockwise,
  ArrowsCounterClockwise,
  ArrowsInLineHorizontal,
  ArrowsInLineVertical,
  ArrowsOutLineHorizontal,
  ArrowsOutLineVertical,
  ArrowUp,
  CaretLeft,
  CaretRight,
  Check,
  Copy,
  DotsThree,
  DownloadSimple,
  Export,
  FlipHorizontal,
  FlipVertical,
  GearSix,
  GlobeSimple,
  GridFour,
  Image,
  LockSimple,
  LockSimpleOpen,
  Minus,
  PaintBrush,
  PencilSimple,
  PenNib,
  Plus,
  Scissors,
  SelectionPlus,
  ShareNetwork,
  Sparkle,
  Square,
  SquaresFour,
  StackSimple,
  TextAa,
  Translate,
  Trash,
  X,
  type IconWeight,
  type IconProps as PhosphorIconProps,
} from "phosphor-react-native";

import { useTheme } from "@/hooks/use-theme";

/**
 * Phosphor is the single icon source for the whole app — one identity across
 * iOS, Android, and web (all rendered via react-native-svg).
 */

export type IconName =
  | "plus"
  | "minus"
  | "grid"
  | "chevronLeft"
  | "chevronRight"
  | "close"
  | "check"
  | "type"
  | "sparkle"
  | "square"
  | "palette"
  | "image"
  | "download"
  | "share"
  | "trash"
  | "duplicate"
  | "undo"
  | "redo"
  | "lock"
  | "unlock"
  | "settings"
  | "globe"
  | "flip"
  | "flipV"
  | "rotateCw"
  | "rotateCcw"
  | "layerUp"
  | "layerDown"
  | "layers"
  | "fitText"
  | "split"
  | "rejoin"
  | "edit"
  | "more"
  | "export"
  | "pen"
  | "language"
  | "gallery"
  | "multiSelect"
  | "alignLeft"
  | "alignCenterH"
  | "alignRight"
  | "alignTop"
  | "alignMiddleV"
  | "alignBottom"
  | "centerH"
  | "centerV";

const ICONS: Record<IconName, ComponentType<PhosphorIconProps>> = {
  plus: Plus,
  minus: Minus,
  grid: GridFour,
  chevronLeft: CaretLeft,
  chevronRight: CaretRight,
  close: X,
  check: Check,
  type: TextAa,
  sparkle: Sparkle,
  square: Square,
  palette: PaintBrush,
  image: Image,
  download: DownloadSimple,
  share: ShareNetwork,
  trash: Trash,
  duplicate: Copy,
  undo: ArrowCounterClockwise,
  redo: ArrowClockwise,
  lock: LockSimple,
  unlock: LockSimpleOpen,
  settings: GearSix,
  globe: GlobeSimple,
  flip: FlipHorizontal,
  flipV: FlipVertical,
  rotateCw: ArrowsClockwise,
  rotateCcw: ArrowsCounterClockwise,
  layerUp: ArrowUp,
  layerDown: ArrowDown,
  layers: StackSimple,
  fitText: ArrowsInLineHorizontal,
  split: Scissors,
  rejoin: ArrowsInLineVertical,
  edit: PencilSimple,
  more: DotsThree,
  export: Export,
  pen: PenNib,
  language: Translate,
  gallery: SquaresFour,
  multiSelect: SelectionPlus,
  alignLeft: AlignLeft,
  alignCenterH: AlignCenterHorizontal,
  alignRight: AlignRight,
  alignTop: AlignTop,
  alignMiddleV: AlignCenterVertical,
  alignBottom: AlignBottom,
  centerH: ArrowsOutLineHorizontal,
  centerV: ArrowsOutLineVertical,
};

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  weight?: IconWeight;
}

/**
 * Phosphor-backed icon. Defaults to the theme's ink color and a `regular`
 * weight; pass `weight="fill"` or `"bold"` for emphasis.
 */
export function Icon({
  name,
  size = 20,
  color,
  weight = "regular",
}: IconProps) {
  const { colors: c } = useTheme();
  const Cmp = ICONS[name];
  return <Cmp size={size} color={color ?? c.ink} weight={weight} />;
}

/** RTL-aware chevron (mirrors with reading direction: right in LTR, left in RTL). */
export function DirectionIcon({
  isRTL,
  color,
  size,
}: {
  isRTL: boolean;
  color?: string;
  size?: number;
}) {
  return (
    <Icon
      name={isRTL ? "chevronLeft" : "chevronRight"}
      color={color}
      size={size}
    />
  );
}

/** Convenience renderer for embedding an icon inline. */
export function renderIcon(
  name: IconName,
  props?: Omit<IconProps, "name">,
): ReactElement {
  return <Icon name={name} {...props} />;
}
