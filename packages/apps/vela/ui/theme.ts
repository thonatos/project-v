export const spacing = {
  half: 4,
  x1: 8,
  compact: 12,
  x2: 16,
  x3: 24,
  section: 28,
  x4: 32,
} as const;

export const layout = {
  toolbar: 48,
  navigation: 56,
  row: 56,
  dialogSmall: 480,
  dialogMedium: 560,
  dialogLarge: 640,
} as const;

export const typography = {
  display: { fontFamily: ".AppleSystemUIFont", fontWeight: "600" as const },
  body: { fontFamily: ".AppleSystemUIFont", fontWeight: "400" as const },
  utility: { fontFamily: "monospace", fontWeight: "400" as const },
} as const;

/**
 * Vela is a small forwarding utility, so its surfaces stay warm and quiet: a
 * paper-white canvas, warm grey text, hairline borders, and a single rust
 * accent that marks a live link. Every surface token is paired with the
 * foreground that is legible on it, so views never hardcode a hex value or
 * lean on translucent overlays.
 *
 * The navigation shares the canvas family rather than inverting it. An
 * inverted rail forces the AppKit controls inside it away from the system
 * appearance, which leaves untinted icons unreadable.
 *
 * Contrast is verified in `tests/theme.test.mjs`: foregrounds reach 4.5:1 on
 * their own surface, and the rail stays a perceptible layer.
 */
export const palettes = {
  light: {
    canvas: "#F5F4F0",
    canvasForeground: "#1F1E1C",
    surface: "#FFFFFF",
    surfaceForeground: "#1F1E1C",
    sidebar: "#EFEDE7",
    sidebarForeground: "#1F1E1C",
    sidebarSubtle: "#6B6761",
    subtle: "#E8E5DD",
    subtleForeground: "#6B6761",
    hover: "#E8E5DD",
    border: "#DDD9D0",
    focus: "#A8491F",
    text: "#1F1E1C",
    muted: "#6B6761",
    accent: "#A8491F",
    accentForeground: "#FFFFFF",
    success: "#4F6B3F",
    successForeground: "#FFFFFF",
    warning: "#8A6420",
    warningForeground: "#FFFFFF",
    danger: "#A63A2E",
    dangerForeground: "#FFFFFF",
    offline: "#6F6A62",
    track: "#DDD9D0",
    disabled: "#E8E5DD",
    disabledForeground: "#5F5B55",
    infoSurface: "#F0EBE4",
    infoForeground: "#7A4A28",
    successSurface: "#E9EFE6",
    successSurfaceForeground: "#3C5430",
    warningSurface: "#F5EDDC",
    warningSurfaceForeground: "#6E4F19",
    dangerSurface: "#F7E7E4",
    dangerSurfaceForeground: "#8C2E24",
  },
  dark: {
    canvas: "#1B1A18",
    canvasForeground: "#F2F0EC",
    surface: "#242321",
    surfaceForeground: "#F2F0EC",
    sidebar: "#201F1D",
    sidebarForeground: "#F2F0EC",
    sidebarSubtle: "#A8A29A",
    subtle: "#2E2C29",
    subtleForeground: "#A8A29A",
    hover: "#2E2C29",
    border: "#393631",
    focus: "#E08A5E",
    text: "#F2F0EC",
    muted: "#A8A29A",
    accent: "#E08A5E",
    accentForeground: "#1B1A18",
    success: "#8FB97A",
    successForeground: "#1B1A18",
    warning: "#D9A857",
    warningForeground: "#1B1A18",
    danger: "#E8796B",
    dangerForeground: "#1B1A18",
    offline: "#9A948B",
    track: "#393631",
    disabled: "#2E2C29",
    disabledForeground: "#A8A29A",
    infoSurface: "#2A2621",
    infoForeground: "#E8A87C",
    successSurface: "#242B22",
    successSurfaceForeground: "#A5CC90",
    warningSurface: "#2E2819",
    warningSurfaceForeground: "#E8BE78",
    dangerSurface: "#2E2220",
    dangerSurfaceForeground: "#F0998D",
  },
} as const;

export type Palette = (typeof palettes)[keyof typeof palettes];
