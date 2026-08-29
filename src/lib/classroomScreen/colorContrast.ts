function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.trim().replace(/^#/, "");
  if (normalized.length === 3) {
    return {
      r: parseInt(normalized[0]! + normalized[0], 16),
      g: parseInt(normalized[1]! + normalized[1], 16),
      b: parseInt(normalized[2]! + normalized[2], 16),
    };
  }
  if (normalized.length === 6) {
    return {
      r: parseInt(normalized.slice(0, 2), 16),
      g: parseInt(normalized.slice(2, 4), 16),
      b: parseInt(normalized.slice(4, 6), 16),
    };
  }
  return null;
}

function channelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

const LIGHT_TEXT = "#ffffff";
const DARK_TEXT = "#0a0a0a";
const LUMINANCE_THRESHOLD = 0.179;

export function getContrastTextColor(hex: string): string {
  const rgb = parseHex(hex);
  if (!rgb) return DARK_TEXT;
  return relativeLuminance(rgb.r, rgb.g, rgb.b) > LUMINANCE_THRESHOLD ? DARK_TEXT : LIGHT_TEXT;
}

export function getOvertimeTextColor(bgHex: string): string {
  return getContrastTextColor(bgHex) === LIGHT_TEXT ? "#fca5a5" : "#dc2626";
}
