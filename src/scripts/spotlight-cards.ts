// ── Spotlight card effect ──────────────────────────────────────────────
// Any element with [data-spotlight] gets a radial gradient that follows
// the pointer, creating a "spotlight" glow inside the card.
// Respects prefers-reduced-motion.

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (!reduced) {
  document.addEventListener("pointermove", (e: PointerEvent) => {
    (document.querySelectorAll("[data-spotlight]") as NodeListOf<HTMLElement>).forEach((card) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--spot-x", `${e.clientX - rect.left}px`);
      card.style.setProperty("--spot-y", `${e.clientY - rect.top}px`);
    });
  });
}
