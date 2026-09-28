# Bosque Online — guía para Claude

Juego co-op en navegador (Three.js + Cloudflare Workers/Durable Objects) para Gabriel y sus sobrinos (12 y 10), sobre todo en **móvil**. En vivo: https://bosque.juegodk.workers.dev (merge a `main` = deploy automático por GitHub Actions).

## Lee primero
1. `docs/superpowers/HANDOFF-aventura.md` → sección **"ESTADO DEL PROYECTO — leer primero"**: estado, qué probar en teléfono, checklist de playtest, drop-ins de assets, rollback. Debajo, la historia completa con un "resumen" por fase y cada decisión marcada **"Decidido por Claude — revisar"**.
2. Specs (diseño): `docs/superpowers/specs/` — visión y roadmap en `2026-09-26-bosque-online-design.md`; Aventura en `2026-09-26-bosque-aventura-design.md` + un spec por slice/subproyecto.
3. Planes ejecutados (uno por plan, con tasks TDD): `docs/superpowers/plans/`.

## Estado (2026-09-28)
Roadmap completo y en `main` (PR #2 y #3 mergeados): Aventura Slices 1–5 (Bosque, Costa, Pantano, Montañas, Tierras Corruptas, final y post-juego), #4 Progresión, #6 Tiendas, #2 Visuales, #7 Pulido + tutorial. `PROTOCOL_VERSION` 65. Tests: `npm test` ~1415, `npm run test:workers` 12.
**Casi nada se ha probado en un teléfono real ni jugado de punta a punta**; el balance son valores iniciales. Lo siguiente es el playtest de Gabriel y ajustar según lo que reporte.

## Arquitectura
- `src/shared` — reglas y simulación puras (sin DOM), autoritativas en el servidor. `sim/world-sim.ts` es el núcleo. `protocol.ts`: todo mensaje del cliente pasa por `decodeClient`.
- `src/server` — Worker + un Durable Object por mundo (`world-room.ts`).
- `src/client` — Three.js; `game.ts` orquesta; `*-ui.ts` / `*-model.ts` con lógica pura testeada.
- `src/shared/names.ts` — todos los nombres propios (provisionales; los sobrinos los cambian). Un test prohíbe escribirlos a mano.

## Comandos
```bash
npm test && npm run test:workers && npm run check && npm run build   # antes de cada commit, todo en verde
npm run dev:server        # juego + Worker en :8787 (crear .dev.vars con ADMIN_TOKEN=dev-admin, gitignored)
npm run perf -- --tier low   # arnés de rendimiento headless (Chromium en /opt/pw-browsers); no es parte de npm test
```

## Reglas del proyecto
- Texto del jugador en **español**, voz seca y breve.
- **Móvil primero**: toda acción con tecla y control táctil; rejilla táctil ≤ 10 pastillas (preferir la A contextual y el Menú). Respetar los presupuestos por calidad del spec de Visuales §3.
- Servidor autoritativo: validar rango, coste, estado. Cambio de protocolo → subir `PROTOCOL_VERSION`; campos guardados nuevos **opcionales** (las partidas viejas deben cargar).
- Ids de enemigos especiales únicos (hay test). Las transferencias de materiales conservan totales (tests de propiedades).
- Dibujos de los sobrinos (`public/enemies/*.png`) se usan como "papel espíritu" (recorte animado).
- Nunca: borrar/saltar/debilitar tests para que pasen, force-push, tocar secretos. **Merge a `main` solo con OK explícito de Gabriel** (despliega a producción).
- Commits con TDD, uno por task; actualizar el HANDOFF al terminar cada plan.

## Cómo quiere trabajar Gabriel
- Mínimo input: decidir lo más simple que respete el spec, anotarlo como "Decidido por Claude — revisar" y seguir.
- Co-op nunca bloquea al que juega solo (salvo cuando es el gancho, p. ej. la ballena). No tocar el balance del Corazón salvo justificado.
- Respuestas basadas en datos, sin adornos. Responder en español.
