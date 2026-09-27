/**
 * V2-E: the spec §9 "suelta y listo" models. Drop `public/models/<name>.glb` and it is used; absent → the
 * procedural creature or the fox. Heights are the size the procedural one has today (so seats still fit).
 */
export type DropIn = 'deer' | 'fish' | 'frog' | 'whale' | 'wolf' | 'brute';
export const DROP_INS: Record<DropIn, { height: number; clips: { idle: string; walk: string; run: string } }> = {
  deer: { height: 2.2, clips: { idle: 'Idle', walk: 'Walk', run: 'Gallop' } },
  fish: { height: 1.3, clips: { idle: 'Swim', walk: 'Swim', run: 'Swim' } },
  frog: { height: 1.2, clips: { idle: 'Idle', walk: 'Jump', run: 'Jump' } },
  whale: { height: 3.2, clips: { idle: 'Swim', walk: 'Swim', run: 'Swim' } },
  wolf: { height: 0.75, clips: { idle: 'Idle', walk: 'Walk', run: 'Run' } },
  brute: { height: 0.75, clips: { idle: 'Idle', walk: 'Walk', run: 'Run' } },
};

/** A real model answer: dev servers and Workers answer a missing file with the app's HTML (200). */
export function isModelResponse(ok: boolean, contentType: string | null): boolean {
  if (!ok) return false;
  const t = (contentType ?? '').toLowerCase();
  return !t.includes('text/html');
}

/** The clip to play for an animation name, falling back to the first clip the file has. */
export function dropInClip(names: readonly string[], want: string): string | null {
  return names.find((n) => n.toLowerCase() === want.toLowerCase()) ?? names.find((n) => n.toLowerCase().includes(want.toLowerCase())) ?? names[0] ?? null;
}
