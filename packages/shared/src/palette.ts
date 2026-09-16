export const AVATAR_COLORS = [
  '#F4EFE6',
  '#7A4A28',
  '#FF6A00',
  '#F5C400',
  '#C6D63C',
  '#34C759',
  '#2BB3C0',
  '#2F80ED',
  '#9B5DE0',
  '#FF5CA8',
  '#8E8E93',
] as const;

export const CHROME_VERSION = '0.53.0';

const FALLBACK = '#FF6A00';

function hexRgb(color: string): [number, number, number] | null {
  const hex = color.replace('#', '').trim();
  if (hex.length === 3) {
    return [
      parseInt(hex[0] + hex[0], 16),
      parseInt(hex[1] + hex[1], 16),
      parseInt(hex[2] + hex[2], 16),
    ];
  }
  if (hex.length < 6) return null;
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

/** Recolle une couleur hors palette sur la pastille officielle la plus proche. */
export function snapAvatarColor(color: string | undefined | null): string {
  if (!color) return FALLBACK;
  const raw = color.trim();
  const exact = AVATAR_COLORS.find((c) => c.toLowerCase() === raw.toLowerCase());
  if (exact) return exact;
  const aliases: Record<string, string> = {
    '#ffffff': '#F4EFE6',
    '#8b5a2b': '#7A4A28',
    '#e53935': '#FF5CA8',
    '#f5a623': '#F5C400',
    '#2ecc71': '#34C759',
    '#1abc9c': '#2BB3C0',
    '#4a90e2': '#2F80ED',
    '#9b59b6': '#9B5DE0',
    '#ff4fa3': '#FF5CA8',
    '#c4b5fd': '#9B5DE0',
    '#f97316': '#FF6A00',
    '#34d399': '#34C759',
    '#22d3ee': '#2BB3C0',
    '#facc15': '#F5C400',
    '#e879f9': '#FF5CA8',
    '#fb923c': '#FF6A00',
    '#94a3b8': '#8E8E93',
    '#818cf8': '#9B5DE0',
    '#f43f5e': '#FF5CA8',
    '#8b5cf6': '#9B5DE0',
  };
  const aliased = aliases[raw.toLowerCase()];
  if (aliased) return aliased;
  const rgb = hexRgb(raw);
  if (!rgb) return FALLBACK;
  let best = FALLBACK;
  let bestD = Infinity;
  for (const c of AVATAR_COLORS) {
    const o = hexRgb(c);
    if (!o) continue;
    const d = (rgb[0] - o[0]) ** 2 + (rgb[1] - o[1]) ** 2 + (rgb[2] - o[2]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}
