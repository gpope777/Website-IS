/** P7-A: per-device preferences (spec §6), `localStorage['bosque.settings']`. P7-C adds the rest to the same key. */
export type ShakeSetting = 'normal' | 'suave' | 'nada';
/** P7-B: volumes 0–100 (General, Efectos, Ambiente, Música) and Silencio. */
/** P7-C: text size, shape marks, camera sensitivity (0.5–2) and the Menú's last tab. */
export type TextSize = 'normal' | 'grande';
export interface Settings { shake: ShakeSetting; vibrate: boolean; master: number; sfx: number; amb: number; music: number; mute: boolean; text: TextSize; marks: boolean; sens: number; tab: string }
export const SENS = { min: 0.5, max: 2, step: 0.25 } as const;
export const TEXT_LABELS: Record<TextSize, string> = { normal: 'Normal', grande: 'Grande' };
/** Grande scales the HUD and the panels ×1.25. */
export const textScale = (t: TextSize): number => (t === 'grande' ? 1.25 : 1);
export const VOLUME_DEFAULTS = { master: 80, sfx: 80, amb: 60, music: 60 } as const;
export type VolumeKey = keyof typeof VOLUME_DEFAULTS;

export const SETTINGS_KEY = 'bosque.settings';
export const SHAKE_LABELS: Record<ShakeSetting, string> = { normal: 'Normal', suave: 'Suave', nada: 'Nada' };

export function defaultSettings(touch: boolean): Settings {
  return { shake: touch ? 'suave' : 'normal', vibrate: true, ...VOLUME_DEFAULTS, mute: false, text: 'normal', marks: true, sens: 1, tab: 'jugar' };
}

const vol = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.min(100, Math.max(0, v))) : d);

/** Bad JSON or bad values fall back to the defaults, field by field. */
export function parseSettings(raw: string | null, touch: boolean): Settings {
  const d = defaultSettings(touch);
  let o: Record<string, unknown> = {};
  try {
    const v: unknown = raw ? JSON.parse(raw) : {};
    if (v && typeof v === 'object' && !Array.isArray(v)) o = v as Record<string, unknown>;
  } catch {
    return d;
  }
  return {
    ...o,
    shake: o.shake === 'normal' || o.shake === 'suave' || o.shake === 'nada' ? o.shake : d.shake,
    vibrate: typeof o.vibrate === 'boolean' ? o.vibrate : d.vibrate,
    master: vol(o.master, d.master),
    sfx: vol(o.sfx, d.sfx),
    amb: vol(o.amb, d.amb),
    music: vol(o.music, d.music),
    mute: typeof o.mute === 'boolean' ? o.mute : d.mute,
    text: o.text === 'normal' || o.text === 'grande' ? o.text : d.text,
    marks: typeof o.marks === 'boolean' ? o.marks : d.marks,
    sens: typeof o.sens === 'number' && Number.isFinite(o.sens) ? Math.min(SENS.max, Math.max(SENS.min, Math.round(o.sens / SENS.step) * SENS.step)) : d.sens,
    tab: typeof o.tab === 'string' ? o.tab : d.tab,
  } as Settings;
}

export function loadSettings(touch: boolean): Settings {
  try {
    return parseSettings(localStorage.getItem(SETTINGS_KEY), touch);
  } catch {
    return defaultSettings(touch);
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* private window: keep it for this session only */
  }
}
