import type { ReactElement } from 'react';
import { StyleSheet, Text } from 'react-native';
import Svg, { Circle, G, Line, Path, Polyline, Rect } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';
import { typeScale } from '@/theme';

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
  | 'layers'
  | 'edit'
  | 'more';

const STROKE = 1.8;

function Glyph({ name, color }: { name: IconName; color: string }): ReactElement {
  const s = { stroke: color, strokeWidth: STROKE, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' as const };
  switch (name) {
    case 'plus':
      return (
        <G {...s}>
          <Line x1="12" y1="6" x2="12" y2="18" />
          <Line x1="6" y1="12" x2="18" y2="12" />
        </G>
      );
    case 'grid':
      return (
        <G {...s}>
          <Rect x="4" y="4" width="7" height="7" />
          <Rect x="13" y="4" width="7" height="7" />
          <Rect x="4" y="13" width="7" height="7" />
          <Rect x="13" y="13" width="7" height="7" />
        </G>
      );
    case 'chevronLeft':
      return (
        <Polyline {...s} points="14.5,6 8.5,12 14.5,18" />
      );
    case 'chevronRight':
      return (
        <Polyline {...s} points="9.5,6 15.5,12 9.5,18" />
      );
    case 'close':
      return (
        <G {...s}>
          <Line x1="6" y1="6" x2="18" y2="18" />
          <Line x1="18" y1="6" x2="6" y2="18" />
        </G>
      );
    case 'check':
      return (
        <Polyline {...s} points="5,12.5 10,17.5 19,7" />
      );
    case 'type':
      return (
        <G {...s}>
          <Line x1="4" y1="6" x2="4" y2="4" />
          <Line x1="20" y1="6" x2="20" y2="4" />
          <Line x1="12" y1="4" x2="12" y2="20" />
          <Line x1="9" y1="20" x2="15" y2="20" />
        </G>
      );
    case 'sparkle':
      return (
        <Path {...s} d="M12 3 L13.8 9.2 L20 11 L13.8 12.8 L12 19 L10.2 12.8 L4 11 L10.2 9.2 Z" />
      );
    case 'square':
      return (
        <Rect {...s} x="5" y="5" width="14" height="14" rx="1" />
      );
    case 'palette':
      return (
        <Path {...s} d="M12 3a9 9 0 0 0 0 18c1.5 0 2-1 2-2 0-.6-.3-1-.3-1.6 0-1 .8-1.9 1.9-1.9H18a3 3 0 0 0 3-3c0-5-4-9.5-9-9.5Z" />
      );
    case 'image':
      return (
        <G {...s}>
          <Rect x="3" y="5" width="18" height="14" rx="2" />
          <Circle cx="8.5" cy="10" r="1.5" />
          <Path d="M4 17 L9 12 L12.5 15.5 L15 13 L20 17" />
        </G>
      );
    case 'download':
      return (
        <G {...s}>
          <Path d="M12 4 v10" />
          <Polyline points="7.5,9.5 12,14 16.5,9.5" />
          <Line x1="5" y1="19" x2="19" y2="19" />
        </G>
      );
    case 'share':
      return (
        <G {...s}>
          <Circle cx="18" cy="6" r="2.5" />
          <Circle cx="6" cy="12" r="2.5" />
          <Circle cx="18" cy="18" r="2.5" />
          <Line x1="8" y1="11" x2="16" y2="7" />
          <Line x1="8" y1="13" x2="16" y2="17" />
        </G>
      );
    case 'trash':
      return (
        <G {...s}>
          <Polyline points="4,7 20,7 18,21 6,21" />
          <Line x1="10" y1="11" x2="10" y2="17" />
          <Line x1="14" y1="11" x2="14" y2="17" />
          <Line x1="3" y1="7" x2="21" y2="7" />
        </G>
      );
    case 'duplicate':
      return (
        <G {...s}>
          <Rect x="9" y="9" width="11" height="11" rx="2" />
          <Path d="M6 15 H5 a2 2 0 0 1 -2 -2 V5 a2 2 0 0 1 2 -2 h8 a2 2 0 0 1 2 2 v1" />
        </G>
      );
    case 'undo':
      return (
        <Path {...s} d="M4 9 h9 a5 5 0 0 1 0 10 H8" />
      );
    case 'redo':
      return (
        <Path {...s} d="M20 9 h-9 a5 5 0 0 0 0 10 h5" />
      );
    case 'lock':
      return (
        <G {...s}>
          <Rect x="5" y="11" width="14" height="9" rx="2" />
          <Path d="M8 11 V8 a4 4 0 0 1 8 0 v3" />
        </G>
      );
    case 'unlock':
      return (
        <G {...s}>
          <Rect x="5" y="11" width="14" height="9" rx="2" />
          <Path d="M8 11 V8 a4 4 0 0 1 7.5 -1.5" />
        </G>
      );
    case 'settings':
      return (
        <G {...s}>
          <Circle cx="12" cy="12" r="3" />
          <Path d="M12 3 v2.5 M12 18.5 V21 M4.2 7.2 l2.2 1.3 M17.6 15.5 l2.2 1.3 M4.2 16.8 l2.2 -1.3 M17.6 8.5 l2.2 -1.3 M3 12 h2.5 M18.5 12 H21" />
        </G>
      );
    case 'globe':
      return (
        <G {...s}>
          <Circle cx="12" cy="12" r="9" />
          <Line x1="3" y1="12" x2="21" y2="12" />
          <Path d="M12 3 a8 8 0 0 1 0 18 a8 8 0 0 1 0 -18" />
        </G>
      );
    case 'flip':
      return (
        <G {...s}>
          <Path d="M12 3 L7 8 h3 v8 h-3 l5 5 V3 Z" />
          <Path d="M16 8 l3 3 l-3 3" />
        </G>
      );
    case 'layers':
      return (
        <G {...s}>
          <Path d="M12 3 L21 8 L12 13 L3 8 Z" />
          <Path d="M3 13 L12 18 L21 13" />
        </G>
      );
    case 'edit':
      return (
        <G {...s}>
          <Path d="M4 20 h4 L19.5 8.5 a2.1 2.1 0 0 0 -3 -3 L5 17 Z" />
          <Line x1="14" y1="7" x2="17" y2="10" />
        </G>
      );
    case 'more':
      return (
        <G {...s}>
          <Circle cx="5" cy="12" r="0.5" fill={color} stroke="none" />
          <Circle cx="12" cy="12" r="0.5" fill={color} stroke="none" />
          <Circle cx="19" cy="12" r="0.5" fill={color} stroke="none" />
        </G>
      );
    default:
      return <Circle cx="12" cy="12" r="2" {...s} />;
  }
}

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

/** Curated stroke icon set — consistent 1.8 stroke, technical/utilitarian. */
export function Icon({ name, size = 20, color }: IconProps) {
  const { colors: c } = useTheme();
  const resolved = color ?? c.ink;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Glyph name={name} color={resolved} />
    </Svg>
  );
}

/** RTL-aware chevron (points left in RTL for "back", right in LTR). */
export function DirectionIcon({ isRTL, color, size }: { isRTL: boolean; color?: string; size?: number }) {
  return <Icon name={isRTL ? 'chevronRight' : 'chevronLeft'} color={color} size={size} />;
}

/** Fallback for tiny labels when an SVG icon isn't wanted. */
export function IconLabel({ label, color }: { label: string; color?: string }) {
  const { colors: c } = useTheme();
  return <Text style={[styles.label, { color: color ?? c.ink }]}>{label}</Text>;
}

const styles = StyleSheet.create({
  label: {
    fontSize: typeScale.caption.size,
    fontWeight: '600',
  },
});