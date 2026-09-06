# Bosque — juego de exploración y supervivencia

Juego en primera persona para navegador. Te despiertas en un bosque generado proceduralmente y tienes que explorar,
recolectar recursos, mantenerte caliente y sobrevivir tantos días como puedas.

## Cómo jugar

| Tecla | Acción |
| --- | --- |
| WASD / flechas | Moverse |
| Ratón | Mirar |
| Shift | Correr (gasta energía) |
| Espacio | Saltar |
| E | Interactuar: talar, recoger, beber |
| C | Menú de creación |
| 1 / 2 / 3 | Comer bayas / comer seta / beber agua |
| T | Encender antorcha |
| F / R | Colocar fogata / refugio |
| Esc | Pausa |

**Barras:** salud, hambre, sed, energía y calor. Si hambre, sed, calor o energía llegan a cero, pierdes salud.
Con hambre y sed altas la salud se regenera sola.

**Ciclo de día:** un día dura 6 minutos reales. De noche baja la temperatura y salen los lobos.
El fuego (fogata o antorcha) los espanta y te devuelve calor. El refugio reduce el frío y recupera energía.

**Recursos:** árboles (madera; el hacha da el doble), rocas (piedra), arbustos (bayas), setas (alimentan pero restan salud),
hierba alta (fibra) y el lago (agua). Todo se regenera con el tiempo.

**Exploración:** hay cinco lugares escondidos en el bosque. Cada descubrimiento suma puntos y algo de energía.

**Semilla:** la URL guarda `?seed=...`. Misma semilla, mismo bosque.

## Stack

- TypeScript (strict) + Vite
- Three.js para el render 3D (terreno por ruido fractal, instancing para la vegetación, sombras, ciclo de luz)
- Vitest para la simulación de supervivencia, que es lógica pura sin DOM

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # tests de la simulación
npm run check      # tsc
npm run build      # dist/
```

## Estructura

```
src/
├── main.ts            # arranque, semilla, reinicio
├── game/
│   ├── survival.ts    # estadísticas, inventario, recetas, consumibles (puro, testeado)
│   ├── world.ts       # terreno, bosque, agua, hitos, objetos colocados, iluminación
│   ├── player.ts      # controlador en primera persona y colisiones
│   ├── wolves.ts      # depredador nocturno
│   ├── game.ts        # bucle principal, input, interacción, HUD
│   ├── noise.ts       # ruido 2D fractal
│   └── rng.ts         # PRNG determinista
└── ui/
    ├── hud.ts         # HUD y overlays (inicio, pausa, crafteo, muerte)
    └── style.css
```
