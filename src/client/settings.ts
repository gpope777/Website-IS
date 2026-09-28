/** P7-A: per-device preferences (spec §6), `localStorage['bosque.settings']`. P7-C adds the rest to the same key. */
export type ShakeSetting = 'normal' | 'suave' | 'nada';
export interface Settings { shake: ShakeSetting; vibrate: boolean }

export const SETTINGS_KEY = 'bosque.settings';
export const SHAKE_LABELS: Record<ShakeSetting, string> = { normal: 'Normal', suave: 'Suave', nada: 'Nada' };

export function defaultSettings(touch: boolean): Settings {
  return { shake: touch ? 'suave' : 'normal', vibrate: true };
}

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
