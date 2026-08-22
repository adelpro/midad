import { type ComponentType, type ReactElement } from 'react';

import {
  ArrowClockwise,
  ArrowCounterClockwise,
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
  PaintBrush,
  PencilSimple,
  PenNib,
  Plus,
  ShareNetwork,
  Sparkle,
  Square,
  SquaresFour,
  StackSimple,
  TextAa,
  Translate,
  Trash,
  UploadSimple,
  X,
  type IconProps as PhosphorIconProps,
  type IconWeight,
} from 'phosphor-react-native';

import { useTheme } from '@/hooks/use-theme';

/**
 * Phosphor is the single icon source for the whole app — one identity across
 * iOS, Android, and web (all rendered via react-native-svg).
 */

export type IconName =
  | 'plus'
  | 'grid'
  | 'chevronLeft'
  | 'chevronRight'
  | 'close'
  | 'check'
  | 'type'
  | 'sparkle'
  | 'square'
  | 'palette'
  | 'image'
  | 'download'
  | 'share'
  | 'trash'
  | 'duplicate'
  | 'undo'
  | 'redo'
  | 'lock'
  | 'unlock'
  | 'settings'
  | 'globe'
  | 'flip'
  | 'flipV'
  | 'layers'
  | 'edit'
  | 'more'
  | 'export'
  | 'pen'
  | 'language'
  | 'gallery';

const ICONS: Record<IconName, ComponentType<PhosphorIconProps>> = {
  plus: Plus,
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
  layers: StackSimple,
  edit: PencilSimple,
  more: DotsThree,
  export: Export,
  pen: PenNib,
  language: Translate,
  gallery: SquaresFour,
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
export function Icon({ name, size = 20, color, weight = 'regular' }: IconProps) {
  const { colors: c } = useTheme();
  const Cmp = ICONS[name];
  return <Cmp size={size} color={color ?? c.ink} weight={weight} />;
}

/** RTL-aware chevron (points left in RTL for "back", right in LTR). */
export function DirectionIcon({ isRTL, color, size }: { isRTL: boolean; color?: string; size?: number }) {
  return <Icon name={isRTL ? 'chevronRight' : 'chevronLeft'} color={color} size={size} />;
}

/** Convenience renderer for embedding an icon inline. */
export function renderIcon(name: IconName, props?: Omit<IconProps, 'name'>): ReactElement {
  return <Icon name={name} {...props} />;
}