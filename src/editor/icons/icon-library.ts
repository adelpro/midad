/**
 * The icon library's stored shape, its recents rule, and the set shown before a
 * search.
 *
 * Pure — only a type-only import, erased at transpile time — so
 * `scripts/check-icons.mjs` can evaluate it standalone, the same rule
 * `icon-geometry.ts` follows.
 */
import type { IconPath } from '@/editor/icons/icon-geometry';

/**
 * An icon resolved to geometry, ready to render or store.
 *
 * This is what the picker passes around once an icon has been fetched: the
 * geometry is the drawing, and the key is provenance. It is deliberately the
 * same data whether the icon came from the network, from the recents list or
 * from `DEFAULT_ICONS`, so one row and one insert path serve all three.
 */
export interface StoredIcon {
  /** `prefix:name` — the Iconify key, kept for attribution. */
  key: string;
  /** The icon's own name, without the prefix. */
  name: string;
  /** The set's display name. */
  setName: string;
  viewBox: { width: number; height: number };
  paths: IconPath[];
}

/** How many searched icons the picker remembers. */
export const ICON_RECENTS_MAX = 24;

/**
 * Insert `icon` at the front of `recents`, newest first: an earlier copy with the
 * same key is dropped, and the list is capped at `max`.
 *
 * Pure, so `check-icons.mjs` pins the dedupe and the cap rather than leaning on an
 * unreadable settings-store diff — the same reason `pushRecent` lives in
 * `theme/color.ts`.
 */
export function pushRecentIcon(
  recents: readonly StoredIcon[],
  icon: StoredIcon,
  max: number,
): StoredIcon[] {
  return [icon, ...recents.filter((r) => r.key !== icon.key)].slice(0, max);
}

/**
 * The icons shown before the user has searched anything, so the picker's Icons
 * block is never blank.
 *
 * The geometry is **shipped, not fetched**: a fresh install with no network must
 * still draw these, and the whole point of the empty state is that it is always
 * there. All of them come from `material-symbols` — filled paths, one per icon —
 * so every renderer draws them faithfully (no stroke-based set, which the
 * fill-only renderers cannot reproduce).
 */
export const DEFAULT_ICONS: readonly StoredIcon[] = [
  {
    key: 'material-symbols:home',
    name: 'home',
    setName: 'Material Symbols',
    viewBox: { width: 24, height: 24 },
    paths: [{ d: 'M4 21V9l8-6l8 6v12h-6v-7h-4v7z', fillRule: 'nonzero' }],
  },
  {
    key: 'material-symbols:search',
    name: 'search',
    setName: 'Material Symbols',
    viewBox: { width: 24, height: 24 },
    paths: [
      {
        d: 'm19.6 21l-6.3-6.3q-.75.6-1.725.95T9.5 16q-2.725 0-4.612-1.888T3 9.5t1.888-4.612T9.5 3t4.613 1.888T16 9.5q0 1.1-.35 2.075T14.7 13.3l6.3 6.3zM9.5 14q1.875 0 3.188-1.312T14 9.5t-1.312-3.187T9.5 5T6.313 6.313T5 9.5t1.313 3.188T9.5 14',
        fillRule: 'nonzero',
      },
    ],
  },
  {
    key: 'material-symbols:star',
    name: 'star',
    setName: 'Material Symbols',
    viewBox: { width: 24, height: 24 },
    paths: [
      {
        d: 'm5.825 21l1.625-7.025L2 9.25l7.2-.625L12 2l2.8 6.625l7.2.625l-5.45 4.725L18.175 21L12 17.275z',
        fillRule: 'nonzero',
      },
    ],
  },
  {
    key: 'material-symbols:favorite',
    name: 'favorite',
    setName: 'Material Symbols',
    viewBox: { width: 24, height: 24 },
    paths: [
      {
        d: 'm12 21l-1.45-1.3q-2.525-2.275-4.175-3.925T3.75 12.812T2.388 10.4T2 8.15Q2 5.8 3.575 4.225T7.5 2.65q1.3 0 2.475.55T12 4.75q.85-1 2.025-1.55t2.475-.55q2.35 0 3.925 1.575T22 8.15q0 1.15-.387 2.25t-1.363 2.412t-2.625 2.963T13.45 19.7z',
        fillRule: 'nonzero',
      },
    ],
  },
  {
    key: 'material-symbols:person',
    name: 'person',
    setName: 'Material Symbols',
    viewBox: { width: 24, height: 24 },
    paths: [
      {
        d: 'M9.175 10.825Q8 9.65 8 8t1.175-2.825T12 4t2.825 1.175T16 8t-1.175 2.825T12 12t-2.825-1.175M4 20v-2.8q0-.85.438-1.562T5.6 14.55q1.55-.775 3.15-1.162T12 13t3.25.388t3.15 1.162q.725.375 1.163 1.088T20 17.2V20z',
        fillRule: 'nonzero',
      },
    ],
  },
  {
    key: 'material-symbols:settings',
    name: 'settings',
    setName: 'Material Symbols',
    viewBox: { width: 24, height: 24 },
    paths: [
      {
        d: 'm9.25 22l-.4-3.2q-.325-.125-.612-.3t-.563-.375L4.7 19.375l-2.75-4.75l2.575-1.95Q4.5 12.5 4.5 12.338v-.675q0-.163.025-.338L1.95 9.375l2.75-4.75l2.975 1.25q.275-.2.575-.375t.6-.3l.4-3.2h5.5l.4 3.2q.325.125.613.3t.562.375l2.975-1.25l2.75 4.75l-2.575 1.95q.025.175.025.338v.674q0 .163-.05.338l2.575 1.95l-2.75 4.75l-2.95-1.25q-.275.2-.575.375t-.6.3l-.4 3.2zm2.8-6.5q1.45 0 2.475-1.025T15.55 12t-1.025-2.475T12.05 8.5q-1.475 0-2.488 1.025T8.55 12t1.013 2.475T12.05 15.5',
        fillRule: 'nonzero',
      },
    ],
  },
  {
    key: 'material-symbols:mail',
    name: 'mail',
    setName: 'Material Symbols',
    viewBox: { width: 24, height: 24 },
    paths: [
      {
        d: 'M4 20q-.825 0-1.412-.587T2 18V6q0-.825.588-1.412T4 4h16q.825 0 1.413.588T22 6v12q0 .825-.587 1.413T20 20zm8-7l8-5V6l-8 5l-8-5v2z',
        fillRule: 'nonzero',
      },
    ],
  },
  {
    key: 'material-symbols:photo-camera',
    name: 'photo-camera',
    setName: 'Material Symbols',
    viewBox: { width: 24, height: 24 },
    paths: [
      {
        d: 'M12 17.5q1.875 0 3.188-1.312T16.5 13t-1.312-3.187T12 8.5T8.813 9.813T7.5 13t1.313 3.188T12 17.5m0-2q-1.05 0-1.775-.725T9.5 13t.725-1.775T12 10.5t1.775.725T14.5 13t-.725 1.775T12 15.5M4 21q-.825 0-1.412-.587T2 19V7q0-.825.588-1.412T4 5h3.15L9 3h6l1.85 2H20q.825 0 1.413.588T22 7v12q0 .825-.587 1.413T20 21z',
        fillRule: 'nonzero',
      },
    ],
  },
  {
    key: 'material-symbols:music-note',
    name: 'music-note',
    setName: 'Material Symbols',
    viewBox: { width: 24, height: 24 },
    paths: [
      {
        d: 'M7.175 19.825Q6 18.65 6 17t1.175-2.825T10 13q.575 0 1.063.138t.937.412V3h6v4h-4v10q0 1.65-1.175 2.825T10 21t-2.825-1.175',
        fillRule: 'nonzero',
      },
    ],
  },
  {
    key: 'material-symbols:light-mode',
    name: 'light-mode',
    setName: 'Material Symbols',
    viewBox: { width: 24, height: 24 },
    paths: [
      {
        d: 'M8.463 15.538Q7 14.075 7 12t1.463-3.537T12 7t3.538 1.463T17 12t-1.463 3.538T12 17t-3.537-1.463M5 13H1v-2h4zm18 0h-4v-2h4zM11 5V1h2v4zm0 18v-4h2v4zM6.4 7.75L3.875 5.325L5.3 3.85l2.4 2.5zm12.3 12.4l-2.425-2.525L17.6 16.25l2.525 2.425zM16.25 6.4l2.425-2.525L20.15 5.3l-2.5 2.4zM3.85 18.7l2.525-2.425L7.75 17.6l-2.425 2.525z',
        fillRule: 'nonzero',
      },
    ],
  },
  {
    key: 'material-symbols:dark-mode',
    name: 'dark-mode',
    setName: 'Material Symbols',
    viewBox: { width: 24, height: 24 },
    paths: [
      {
        d: 'M12 21q-3.75 0-6.375-2.625T3 12t2.625-6.375T12 3q.35 0 .688.025t.662.075q-1.025.725-1.638 1.888T11.1 7.5q0 2.25 1.575 3.825T16.5 12.9q1.375 0 2.525-.613T20.9 10.65q.05.325.075.662T21 12q0 3.75-2.625 6.375T12 21',
        fillRule: 'nonzero',
      },
    ],
  },
  {
    key: 'material-symbols:bookmark',
    name: 'bookmark',
    setName: 'Material Symbols',
    viewBox: { width: 24, height: 24 },
    paths: [
      {
        d: 'M5 21V5q0-.825.588-1.412T7 3h10q.825 0 1.413.588T19 5v16l-7-3z',
        fillRule: 'nonzero',
      },
    ],
  },
];
