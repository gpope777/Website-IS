// ── Word-cycling animation ──────────────────────────────────────────────
// Any <em data-words="w1|w2|w3"> on the page will rotate through words.
// Uses an inline-grid stack so the container width stays stable (widest word).
// Respects prefers-reduced-motion.

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

(document.querySelectorAll("em[data-words]") as NodeListOf<HTMLElement>).forEach((em) => {
  const words = (em.dataset.words ?? "").split("|").filter(Boolean);
  if (words.length < 2) return;

  const wrap = document.createElement("span");
  wrap.className = "word-rotate";
  wrap.setAttribute("aria-live", "polite");

  words.forEach((word, i) => {
    const span = document.createElement("span");
    span.className = "wri" + (i === 0 ? " wri-active" : "");
    span.textContent = word;
    if (i === 0) span.setAttribute("aria-current", "true");
    wrap.appendChild(span);
  });

  em.textContent = "";
  em.appendChild(wrap);

  if (reduced) return;

  let current = 0;
  const INTERVAL = 2200;

  setInterval(() => {
    const items = wrap.querySelectorAll<HTMLElement>(".wri");

    items[current].classList.remove("wri-active");
    items[current].classList.add("wri-exit");
    items[current].removeAttribute("aria-current");
    const exitIdx = current;
    setTimeout(() => items[exitIdx].classList.remove("wri-exit"), 500);

    current = (current + 1) % words.length;

    items[current].classList.add("wri-active");
    items[current].setAttribute("aria-current", "true");
  }, INTERVAL);
});
