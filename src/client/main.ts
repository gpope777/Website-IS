import './style.css';
import { Game } from './game';
import { joinScreen } from './join';

const app = document.getElementById('app')!;
let game: Game | null = null;

function start(): void {
  joinScreen(app, (j) => {
    game = new Game(app, j, () => {
      game?.dispose();
      game = null;
      start();
    });
  });
}

start();
