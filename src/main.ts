import { Game } from './game/game';
import { startOverlay } from './ui/hud';
import { lastSavedSeed } from './game/save';

const app = document.getElementById('app')!;
let game: Game | null = null;

function defaultSeed(): string {
  const params = new URLSearchParams(location.search);
  return params.get('seed') ?? Math.random().toString(36).slice(2, 8);
}

function boot(seed: string, resume: boolean): void {
  game?.dispose();
  try {
    const url = new URL(location.href);
    url.searchParams.set('seed', seed);
    history.replaceState(null, '', url);
  } catch {
    // Some embedded hosts disallow history changes; the seed still shows on the start screen.
  }
  game = new Game(app, seed, () => {
    game?.dispose();
    showStart();
  }, resume);
}

function showStart(): void {
  startOverlay(app, defaultSeed(), boot, lastSavedSeed());
}

showStart();
