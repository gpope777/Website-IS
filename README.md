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
| B / H / V | Construir casa / atalaya / valla |
| Esc | Pausa |

**Barras:** salud, hambre, sed, energía y calor. Si hambre, sed, calor o energía llegan a cero, pierdes salud.
Con hambre y sed altas la salud se regenera sola.

**Ciclo de día:** un día dura 6 minutos reales. De noche baja la temperatura y salen los lobos.
El fuego (fogata o antorcha) los espanta y te devuelve calor. El refugio reduce el frío y recupera energía.

**Recursos:** árboles (madera; el hacha da el doble), rocas (piedra), arbustos (bayas), setas (alimentan pero restan salud),
hierba alta (fibra) y el lago (agua). Todo se regenera con el tiempo.

**Fibra:** sale de los matojos de hierba alta dorada, más altos y claros que la hierba normal. Ponte encima y pulsa
<kbd>E</kbd> para sacar una fibra; el matojo no se agota. Salen en los claros, nunca en el bosque cerrado, aparecen como
manchas doradas en el mapa del diario (<kbd>J</kbd>) y el más cercano a menos de 24 m se marca en la brújula con 🌾.
También hay tres fibras en la caja de la Cabaña abandonada. La necesitas para el hacha (1), la antorcha (2), el refugio
(4) y la casa (6).

**Construcción:** con madera, piedra y fibra puedes levantar una casa (te protege de la lluvia y el frío), una atalaya
(revela en la brújula los lugares a menos de 120 m) y vallas. El bosque también tiene aldeas abandonadas, ruinas, atalayas
y puentes de tablones repartidos por el mapa.

**Exploración:** hay cinco lugares escondidos en el bosque. Cada descubrimiento suma puntos y algo de energía.

**Mapa:** el diario (<kbd>J</kbd>) dibuja el bosque entero con relieve, el lago, los claros y las manchas de hierba alta.
Los lugares solo aparecen cuando los has descubierto o revelado.

**Semilla:** la URL guarda `?seed=...`. Misma semilla, mismo bosque.

## Stack

- TypeScript (strict) + Vite
- Three.js para el render 3D (terreno por ruido fractal, instancing para la vegetación, sombras suaves, ciclo de luz,
  cúpula de cielo con sol, luna y estrellas, viento en la hierba y oleaje en el lago vía `onBeforeCompile`)
- Vitest para la simulación de supervivencia, que es lógica pura sin DOM

## Jugar en línea

https://gpope777.github.io/Website-IS/

El despliegue usa GitHub Pages. El workflow está en `.github/pages-workflow.yml`; para activarlo, muévelo a
`.github/workflows/pages.yml` (el token de esta sesión no tenía permiso `workflow` para hacerlo).

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
