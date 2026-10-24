/**
 * Vela iOS design tokens. Every color, size and inset in the app comes from
 * here; `nsh.json` holds the palette, this file names its roles.
 *
 * The grid follows the iPhone system metrics (iOS 26, iPhone 17 Pro):
 *   - 16pt screen margins; inset-grouped cells 10pt radius
 *   - 44pt minimum touch target, 52pt standard cell, 64pt service cell
 *   - Dynamic-type-like scale: 34 / 22 / 20 / 17 / 16 / 15 / 13 / 12 / 11
 */

/** Surfaces, each with its own legible foreground. */
export const surface = {
  /** The window and grouped backgrounds. */
  canvas: "bg-canvas dark:bg-dk-canvas",
  /** Chrome bars (top bar, bottom toolbar). */
  bar: "bg-surface dark:bg-dk-surface",
  /** Inset-grouped cells. */
  cell: "bg-cell dark:bg-dk-cell",
  /** Modal sheets. */
  sheet: "bg-sheet dark:bg-dk-sheet",
  /** A recessed fill: search-like fields, avatar placeholders, segmented wells. */
  fill: "bg-fill dark:bg-dk-fill",
  accent: "bg-accent dark:bg-dk-accent",
  accentSoft: "bg-accent-soft dark:bg-dk-accent-soft",
  /** Floating chrome: the tab bar and the browser toolbar. */
  float: "bg-float dark:bg-dk-float",
  /** The dimmed backdrop behind a bottom menu. */
  scrim: "bg-scrim dark:bg-dk-scrim",
  grabber: "bg-grabber dark:bg-dk-grabber",
} as const;

export const ink = {
  primary: "text-canvas-foreground dark:text-dk-canvas-foreground",
  secondary: "text-secondary dark:text-dk-secondary",
  tertiary: "text-tertiary dark:text-dk-tertiary",
  accent: "text-accent dark:text-dk-accent",
  onAccent: "text-accent-foreground dark:text-dk-accent-foreground",
  danger: "text-danger dark:text-dk-danger",
  success: "text-success dark:text-dk-success",
  warning: "text-warning dark:text-dk-warning",
} as const;

/** Raw hex values for native controls (SF Symbols, UISwitch) that take a color, not a class. */
export const nativeColor = {
  accent: { light: "#A8491F", dark: "#E08A5E" },
  secondary: { light: "#6B6761", dark: "#A8A29A" },
  tertiary: { light: "#8E8A83", dark: "#7E7970" },
  primary: { light: "#1F1E1C", dark: "#F2F0EC" },
  danger: { light: "#A63A2E", dark: "#E8796B" },
  success: { light: "#4F6B3F", dark: "#8FB97A" },
  warning: { light: "#7F5B1C", dark: "#D9A857" },
  onAccent: { light: "#FFFFFF", dark: "#1B1A18" },
} as const;

export type NativeColor = keyof typeof nativeColor;

export const line = {
  hairline: "border-separator dark:border-dk-separator",
  bottom: "border-b border-separator dark:border-dk-separator",
  top: "border-t border-separator dark:border-dk-separator",
} as const;

/**
 * Type scale on a 14pt base (ratio 8/7, line heights on a 4pt grid):
 *
 *   display 22/28 · title 18/24 · heading 16/20 · base 14/20 · small 12/16 · micro 11/14
 *
 * Roles pair a size with a weight; components use roles, never sizes.
 */
export const font = {
  /** Page and sheet titles; the Vela wordmark. */
  pageTitle: "text-display font-bold",
  brand: "text-display font-bold tracking-tight",
  /** Empty-state titles, the account name. */
  title: "text-title font-semibold",
  /** Emphasis inside content: monograms, the menu's service name. */
  heading: "text-heading font-semibold",
  /** Row titles, body copy, buttons. */
  body: "text-base",
  bodyStrong: "text-base font-semibold",
  /** Row details, footers, notices' text. */
  detail: "text-small",
  detailStrong: "text-small font-semibold",
  /** Section labels above a group. */
  sectionLabel: "text-small font-semibold",
  /** Chips, the tab bar's labels, timestamps. */
  micro: "text-micro font-medium",
  microStrong: "text-micro font-semibold",
  mono: "font-mono text-small",
} as const;

/**
 * SF Symbol point sizes. Symbols sit optically on the text they accompany:
 * inline with body text at 14, in bar and toolbar buttons at 18.
 */
export const symbol = {
  inline: 12,
  chevron: 12,
  body: 14,
  tile: 14,
  bar: 18,
  tab: 16,
  empty: 36,
  /** Service-page sail mark: equal to the 22/28 page-title line height. */
  brand: 28,
  /** The lock inside the address pill and the collapsed indicator. */
  badge: 10,
  /** The trailing resume arrow and selection checkmark. */
  accessory: 16,
} as const;

/**
 * Insets. A container owns exactly one horizontal inset:
 *   - `screen` (16): page content and section labels
 *   - `cell` (16): text inside an inset-grouped cell, measured from the cell edge
 * Cells are inside `screen`, so cell text sits 32pt from the device edge,
 * which matches iOS inset-grouped tables.
 */
export const inset = {
  screen: "px-4",
  cell: "px-4",
  /** 10pt above and below a row's text: 20pt line + 20 = 40, inside a 44pt row. */
  cellY: "py-2.5",
  sectionTop: "pt-5",
  sectionLabel: "px-4 pb-1.5",
  sectionFooter: "px-4 pt-1.5",
  pageBottom: "pb-8",
  bar: "px-2",
  stack: "gap-2",
  tight: "gap-0.5",
  row: "gap-3",
  chip: "px-2 py-0.5",
  banner: "px-3 py-2.5",
  empty: "px-8 pt-20",
  emptyAction: "pt-3",
  sheetHeader: "mt-2",
  grabber: "pt-2 pb-2",
  menuBody: "pb-2 gap-2",
  menuHeader: "pb-2",
  headerLeft: "pl-4",
  headerRight: "pr-2",
  floatX: "px-4",
  tabBar: "p-1 gap-1",
  tab: "py-1 gap-0.5",
  toolbar: "px-2 gap-1",
  address: "px-3 gap-2",
  indicator: "px-3 gap-1.5",
  resume: "px-3 py-2.5",
} as const;

export const size = {
  touch: "min-h-11 min-w-11",
  bar: "h-11",
  /** A one-line row; two-line rows grow from it. */
  cell: "min-h-11",
  /** A service row: 32pt monogram + 2 lines. */
  serviceCell: "min-h-14",
  tile: "h-8 w-8",
  iconTile: "h-7 w-7",
  avatar: "h-8 w-8",
  avatarLarge: "h-16 w-16",
  button: "h-11",
  progress: "h-0.5",
  field: "h-11",
  barSide: "w-24",
  symbolSpacer: "h-5 w-5",
  menuRow: "h-12",
  tabBar: "h-14",
  toolbar: "h-[52px]",
  address: "h-10",
  indicator: "h-7",
  /** The floating tab bar's height plus its gap, kept clear at the end of a tab page. */
  tabClearance: "h-20",
  /** The fixed header of every tab page and sheet. */
  pageHeader: "h-[52px]",
  grabber: "h-[5px] w-9",
  dot: "h-2 w-2",
} as const;

export const radius = {
  cell: "rounded-cell",
  tile: "rounded-tile",
  control: "rounded-control",
  full: "rounded-full",
  sheetTop: "rounded-t-sheet",
  float: "rounded-float",
} as const;

/** Status vocabulary: one tone per meaning, shared by dots, chips and banners. */
export const tone = {
  success: { dot: "bg-success dark:bg-dk-success", soft: "bg-success-soft dark:bg-dk-success-soft", ink: ink.success },
  warning: { dot: "bg-warning dark:bg-dk-warning", soft: "bg-warning-soft dark:bg-dk-warning-soft", ink: ink.warning },
  danger: { dot: "bg-danger dark:bg-dk-danger", soft: "bg-danger-soft dark:bg-dk-danger-soft", ink: ink.danger },
  offline: { dot: "bg-offline dark:bg-dk-offline", soft: "bg-offline-soft dark:bg-dk-offline-soft", ink: ink.secondary },
  accent: { dot: "bg-accent dark:bg-dk-accent", soft: "bg-accent-soft dark:bg-dk-accent-soft", ink: ink.accent },
} as const;

export type Tone = keyof typeof tone;

/**
 * Service monograms. A device's identity color is stable (hashed from its
 * private name), so the same Mac reads the same everywhere.
 */
export const hue = [
  { tile: "bg-hue1-soft dark:bg-dk-hue1-soft", ink: "text-hue1 dark:text-dk-hue1" },
  { tile: "bg-hue2-soft dark:bg-dk-hue2-soft", ink: "text-hue2 dark:text-dk-hue2" },
  { tile: "bg-hue3-soft dark:bg-dk-hue3-soft", ink: "text-hue3 dark:text-dk-hue3" },
  { tile: "bg-hue4-soft dark:bg-dk-hue4-soft", ink: "text-hue4 dark:text-dk-hue4" },
  { tile: "bg-hue5-soft dark:bg-dk-hue5-soft", ink: "text-hue5 dark:text-dk-hue5" },
] as const;

/** Elevation for floating chrome. */
export const elevation = {
  float: "shadow-lg border border-separator dark:border-dk-separator",
} as const;

/**
 * Floating chrome geometry in points, for content that must clear it: the bar
 * height plus its bottom gap, above the safe area.
 */
/** Space kept clear for floating chrome: the bar and the 20pt it floats above the bottom edge. */
export const floatClearance = {
  tabBar: 56 + 20,
  toolbar: 52 + 20,
  indicator: 28 + 20,
} as const;

/**
 * The status bar's visual band. On Dynamic Island phones the safe area is
 * taller than the clock, so insetting page content by the whole safe area
 * leaves a gap that reads as a mistake.
 */
export const statusBarBand = 63;

/**
 * The browser's real viewport clears the expanded toolbar plus a small visual
 * gap, so the floating bar has background padding above as well as below.
 */
export const browserViewportBottom = floatClearance.toolbar + 12;

export const motion = {
  bar: "transition-all duration-200",
} as const;

export const state = {
  press: "active:opacity-60",
  cellPress: "active:bg-fill dark:active:bg-dk-fill",
  disabled: "disabled:opacity-40",
} as const;
