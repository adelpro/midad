import { type ComponentType } from 'react';

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
  GearSix,
  GridFour,
  Image,
  Minus,
  PaintBrush,
  PencilSimple,
  PenNib,
  Plus,
  PushPin,
  Question,
  Scissors,
  Selection,
  SelectionPlus,
  SelectionSlash,
  Shapes,
  Sparkle,
  TextAa,
  Trash,
  X,
  type IconWeight,
  type IconProps as PhosphorIconProps,
} from 'phosphor-react-native';

import { useTheme } from '@/hooks/use-theme';

/**
 * Phosphor is the single icon source for the whole app — one identity across
 * iOS, Android, and web (all rendered via react-native-svg).
 */

export type IconName =
  | 'plus'
  | 'minus'
  | 'grid'
  | 'chevronLeft'
  | 'chevronRight'
  | 'close'
  | 'check'
  | 'type'
  | 'sparkle'
  | 'shapes'
  | 'palette'
  | 'image'
  | 'download'
  | 'trash'
  | 'duplicate'
  | 'undo'
  | 'redo'
  | 'settings'
  | 'flip'
  | 'rotateCw'
  | 'rotateCcw'
  | 'layerUp'
  | 'layerDown'
  | 'fitText'
  | 'split'
  | 'rejoin'
  | 'edit'
  | 'more'
  | 'export'
  | 'pen'
  | 'pin'
  | 'help'
  | 'multiSelect'
  | 'group'
  | 'ungroup'
  | 'alignLeft'
  | 'alignCenterH'
  | 'alignRight'
  | 'alignTop'
  | 'alignMiddleV'
  | 'alignBottom'
  | 'centerH'
  | 'centerV';

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
  shapes: Shapes,
  palette: PaintBrush,
  image: Image,
  download: DownloadSimple,
  trash: Trash,
  duplicate: Copy,
  undo: ArrowCounterClockwise,
  redo: ArrowClockwise,
  settings: GearSix,
  flip: FlipHorizontal,
  rotateCw: ArrowsClockwise,
  rotateCcw: ArrowsCounterClockwise,
  layerUp: ArrowUp,
  layerDown: ArrowDown,
  fitText: ArrowsInLineHorizontal,
  split: Scissors,
  rejoin: ArrowsInLineVertical,
  edit: PencilSimple,
  more: DotsThree,
  export: Export,
  pen: PenNib,
  pin: PushPin,
  help: Question,
  multiSelect: SelectionPlus,
  group: Selection,
  ungroup: SelectionSlash,
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
  weight = 'regular',
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
      name={isRTL ? 'chevronLeft' : 'chevronRight'}
      color={color}
      size={size}
    />
  );
}
