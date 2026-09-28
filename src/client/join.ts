import { NAME_RE, PIN_RE, WORLD_RE } from '../shared/protocol';

export interface JoinInfo {
  world: string;
  name: string;
  pin: string;
}

const KEY = 'bosque.join';

export function joinScreen(parent: HTMLElement, onJoin: (j: JoinInfo) => void): void {
  let saved: Partial<JoinInfo> = {};
  try {
    saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<JoinInfo>;
  } catch {
    // ignore
  }
  const world = new URLSearchParams(location.search).get('mundo') ?? saved.world ?? '';
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <form class="panel">
      <h1>Bosque</h1>
      <p>Entra al mundo de tu familia. Tu progreso se guarda en el servidor.</p>
      <p>Bosque. Juego cooperativo. Con auriculares se oye mejor.</p>
      <label for="j-world">Código del mundo</label>
      <input id="j-world" autocapitalize="off" autocomplete="off" spellcheck="false" />
      <label for="j-name">Tu nombre</label>
      <input id="j-name" maxlength="16" autocomplete="nickname" />
      <label for="j-pin">PIN (4 números)</label>
      <input id="j-pin" inputmode="numeric" maxlength="4" type="password" autocomplete="off" />
      <div class="err"></div>
      <button type="submit">Entrar</button>
    </form>`;
  const $ = (id: string) => overlay.querySelector<HTMLInputElement>(id)!;
  $('#j-world').value = world;
  $('#j-name').value = saved.name ?? '';
  $('#j-pin').value = saved.pin ?? '';
  overlay.querySelector('form')!.addEventListener('submit', (e) => {
    e.preventDefault();
    const j: JoinInfo = { world: $('#j-world').value.trim().toLowerCase(), name: $('#j-name').value.trim(), pin: $('#j-pin').value.trim() };
    const err = overlay.querySelector('.err')!;
    if (!WORLD_RE.test(j.world)) return void (err.textContent = 'El código del mundo usa letras, números y guiones.');
    if (!NAME_RE.test(j.name)) return void (err.textContent = 'El nombre tiene de 1 a 16 letras o números.');
    if (!PIN_RE.test(j.pin)) return void (err.textContent = 'El PIN son 4 números.');
    try {
      // ponytail: PIN remembered on this device for the kids' convenience; it only guards a family game.
      localStorage.setItem(KEY, JSON.stringify(j));
    } catch {
      // ignore
    }
    overlay.remove();
    onJoin(j);
  });
  parent.appendChild(overlay);
}
