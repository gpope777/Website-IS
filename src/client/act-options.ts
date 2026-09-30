export type ActOption =
  | { k: 'revive'; name: string } | { k: 'shrine'; id: number; part: number } | { k: 'dungeon'; act: number }
  | { k: 'chest'; id: number } | { k: 'amber'; id: number } | { k: 'quartz'; id: number } | { k: 'fogata'; id: number }
  | { k: 'travel' } | { k: 'rescue' } | { k: 'pillar'; id: number } | { k: 'guardian' } | { k: 'mount'; act: number }
  | { k: 'tend' } | { k: 'upgrade' } | { k: 'capa' } | { k: 'stall' };

export interface ActProbe {
  fallen: string | null;
  shrinePart: { id: number; part: number } | null;
  dungeon: { act: number } | null;
  coast: { t: 'chest'; id: number } | { t: 'upgrade' } | null;
  swamp: { t: 'amber'; id: number } | { t: 'capa' } | null;
  quartz: { id: number } | null;
  fogata: { t: 'fogata'; id: number } | { t: 'travel' } | { t: 'hint'; label: string } | null;
  rescue: boolean;
  pillar: { id: number } | null;
  guardian: boolean;
  mount: { act: number } | null;
  tend: boolean;
  upgrade: boolean;
  capa: boolean;
  stall: boolean;
}

/** Applicable context actions in the established A-button priority order. */
export function actOptions(p: ActProbe): ActOption[] {
  const out: ActOption[] = [];
  if (p.fallen) out.push({ k: 'revive', name: p.fallen });
  if (p.shrinePart) out.push({ k: 'shrine', ...p.shrinePart });
  if (p.dungeon) out.push({ k: 'dungeon', act: p.dungeon.act });
  if (p.coast?.t === 'chest') out.push({ k: 'chest', id: p.coast.id });
  if (p.swamp?.t === 'amber') out.push({ k: 'amber', id: p.swamp.id });
  if (p.quartz) out.push({ k: 'quartz', id: p.quartz.id });
  if (p.fogata?.t === 'fogata') out.push({ k: 'fogata', id: p.fogata.id });
  if (p.fogata?.t === 'travel') out.push({ k: 'travel' });
  if (p.rescue) out.push({ k: 'rescue' });
  if (p.pillar) out.push({ k: 'pillar', id: p.pillar.id });
  if (p.guardian) out.push({ k: 'guardian' });
  if (p.mount) out.push({ k: 'mount', act: p.mount.act });
  if (p.tend) out.push({ k: 'tend' });
  if (p.upgrade || p.coast?.t === 'upgrade') out.push({ k: 'upgrade' });
  if (p.capa || p.swamp?.t === 'capa') out.push({ k: 'capa' });
  if (p.stall) out.push({ k: 'stall' });
  return out;
}

export const OPTION_LABEL: Record<ActOption['k'], { icon: string; text: string }> = {
  revive: { icon: '✚', text: 'Levantar' }, shrine: { icon: '✦', text: 'Tocar' }, dungeon: { icon: '🚪', text: 'Abrir' },
  chest: { icon: '🧰', text: 'Cofre' }, amber: { icon: '🟠', text: 'Ámbar' }, quartz: { icon: '💎', text: 'Cuarzo' },
  fogata: { icon: '🔥', text: 'Encender' }, travel: { icon: '↗', text: 'Viajar' }, rescue: { icon: '✂', text: 'Rescatar' },
  pillar: { icon: '🌱', text: 'Pilar' }, guardian: { icon: '💬', text: 'Hablar' }, mount: { icon: '🐾', text: 'Montar' },
  tend: { icon: '❤', text: 'Cuidar' }, upgrade: { icon: '⚔', text: 'Mejorar arma' }, capa: { icon: '🧥', text: 'Capa' }, stall: { icon: '🏕', text: 'Puesto' },
};
