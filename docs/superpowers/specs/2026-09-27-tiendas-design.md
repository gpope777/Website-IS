# Bosque — Subproyecto #6: Tiendas y economía

> **Decidido por Claude — revisar** (Fase 3 del HANDOFF: lo más simple que respete la visión; co-op que no bloquee al que juega solo; no tocar el balance del Corazón ni de los jefes; móvil primero, rejilla táctil ≤10, Menú / A contextual; voz seca en español; nombres en `names.ts`; servidor autoritativo):
> - **Sin moneda nueva: trueque.** Un precio es "3 bayas → 1 perla". Los materiales ya son lo que los niños entienden y cuentan; una moneda pide fuente, sumidero y balance propios, y con 3 jugadores se estancaría o se inflaría. **[D]**
> - **El Puesto:** una estructura nueva (madera 8, piedra 4). 1 por jugador. **4 estantes**; cada estante = "doy N de X por M de Y". El dueño mete el género **y el género sale de su mochila en ese momento** (queda guardado en el Puesto). Lo que pagan los compradores cae en la **Caja** del Puesto; el dueño la vacía con A.
> - **Funciona con el dueño desconectado sin nada especial:** el mundo solo está despierto si alguien está conectado, y quien compra está conectado. La compra es una operación del servidor sobre datos guardados (estante + Caja), no hace falta el dueño. El Puesto no hace nada mientras el mundo duerme, y no lo necesita.
> - **Robo imposible:** solo el dueño toca estantes y Caja; los Puestos **no reciben daño** (ni asedios, ni jugadores); comprar es atómico (todo o nada) en el único hilo del Durable Object.
> - **Trueque directo** entre dos jugadores a ≤4 m: una ventana, cada uno pone hasta 3 materiales, los dos pulsan "Vale"; cualquier cambio quita los "Vale". Atómico.
> - **El Buhonero:** un NPC fijo junto al Corazón que aparece tras el rescate del Tragón (Invasión 2). **Compra todo, vende solo lo común** (madera, piedra, bayas) a precio malo, con tope diario. Es el sumidero que evita el atasco y la fuente mínima para que nadie se quede sin madera. **No vende** perlas, ámbar, cuarzo ni espinas: el arma y la Capa se siguen ganando explorando.
> - **Lo que no se cambia:** Rango, Savia, Oficios, sombreros, Proezas, poderes, monturas, niveles de arma y Capa **no son objetos**: no se pueden vender ni dar. Solo se comercian los 7 materiales.
> - **Por qué visitar una tienda con 3 jugadores:** cada material vive en un bioma y cada uno juega distinto (el de 10 en la Costa con el pez, el de 12 en la Montaña…). El Puesto lleva **letrero con lo que vende** en el mapa del Menú, y un Puesto construido en un bioma **repone solo 1 unidad al día** de su material local si el dueño lo tiene en un estante (ver §5.4).
> - **Idea de Claude: los Encargos.** El dueño puede convertir un estante en "Busco": "Busco 3 cuarzo, pago 12 piedra". La paga queda apartada en el Puesto; quien trae el cuarzo cobra al momento aunque el dueño esté dormido. Así el de 10 pide ayuda sin tener que coincidir en horario.
> - **Rejilla táctil:** sigue en 10. Todo va por A contextual y el Menú.

**Date:** 2026-09-27
**Status:** Draft, decided autonomously (Fase 3). No code or plans yet.
**Builds on:** `2026-09-26-bosque-online-design.md` (visión: "set up shops the others can visit"; roadmap #6; el mundo duerme sin nadie), `2026-09-26-bosque-aventura-design.md` §11 (extra "Rescued NPCs / refugee village"), `2026-09-27-progresion-design.md`, y el código en `aventura/resto` tras P4-D (PROTOCOL_VERSION 58, 1043 tests).
**Rule:** simplest option that respects the vision. Every choice is marked **[D]** with a one-line reason.

---

## 1. Qué hay hoy (inventario del código)

| Pieza | Estado | Dónde |
|---|---|---|
| Materiales | 7: `wood`, `stone`, `berries`, `pearl`, `amber`, `quartz`, `thorn`. `Inventory = Partial<Record<ItemId, number>>`, `addItem`, `hasAll`, `removeAll`. | `src/shared/items.ts` |
| Sumideros | Construir (`BUILD_COST`), cuidar el Corazón (5 bayas), arma 1–6 (`UPGRADE`: perlas → cuarzo → espinas), Capa 1–4 (`CAPA`: ámbar → espinas), olvidar oficios (5 bayas). | `items.ts`, `progression.ts` |
| Estructuras | `Structure { id, kind, x,y,z, rot, owner, hp }`; se guardan en `SavedWorld.structures`; los asedios las atacan. | `protocol.ts`, `sim/world-sim.ts` |
| Tumba | Guarda la mochila al morir (`graves[].inv`): ya hay un "inventario en el mundo" con dueño. | `world-sim.ts` |
| Sala | Un Durable Object por mundo, bucle 10 Hz, **una fila JSON** (`kv.world`) escrita por lotes y al irse el último. Hiberna sin nadie. | `src/server/world-room.ts` |
| UI | Menú HTML (Libro, Oficios, Aspecto), A contextual, rejilla de 10 pastillas. | `src/client/hud.ts`, `*-ui.ts` |
| NPCs | Ninguno comerciante. Aliados blancos junto al Corazón (Antenón, farol, atalaya). El Tragón rescatado en Invasión 2 (`invasion2: 'rescued'`). | `world-sim.ts` |

No hay dar objetos, soltar objetos ni moneda. Todo #6 es nuevo, pero reutiliza `Inventory` y las funciones puras de `items.ts`.

## 2. Pillars

1. **Materiales, no dinero.** Se cambia lo que ya se recoge. Nada que aprender.
2. **El Puesto trabaja solo.** Quien llega compra sin que el dueño esté.
3. **Nadie pierde nada sin querer.** Solo el dueño toca lo suyo; toda transferencia es todo-o-nada; los Puestos no se rompen.
4. **Comerciar ayuda, no salta la historia.** Lo raro (perlas, ámbar, cuarzo, espinas) solo lo pone en circulación quien lo encontró. Rango, oficios, sombreros, Proezas, poderes y monturas no se comercian. El Corazón y los jefes no cambian.
5. **Móvil primero.** Cero pastillas. Una malla pequeña por Puesto.

## 3. El Puesto (tienda de jugador)

### 3.1 Construir
- Nuevo `StructureKind` `'stall'`. Coste `{ wood: 8, stone: 4 }`. Se construye como las demás (Menú → construir). **1 por jugador** (otro se rechaza: "Ya tienes un puesto."). **[D]** Con 3 jugadores, 3 tiendas bastan; menos datos, menos abuso.
- Tiene que estar a ≥15 m de otro Puesto y fuera de mazmorras/torre/arena (mismas zonas donde ya no se construye).
- **HP infinito:** los asedios lo ignoran (no está en la lista de objetivos) y no recibe golpes. **[D]** Si un asedio pudiera romperlo, el dueño perdería el género estando desconectado. No toca el balance: no bloquea ni defiende nada (no es colisionador para lobos; sí para jugadores).
- **Recoger:** el dueño, con A → "Recoger puesto": vuelven a su mochila los 4 estantes, la Caja y el coste completo. Solo si él está al lado.

### 3.2 Estantes
- 4 estantes. Cada uno: `{ give: ItemId, n: 1–20, want: ItemId, m: 1–20, stock: 0–60 }`. `give ≠ want`.
- "Vendo 1 perla por 6 bayas", stock 3 → hay 3 perlas guardadas en el Puesto.
- El dueño, junto al Puesto (≤4 m), A → **panel Puesto** (HTML): por estante, dos selectores (material de la lista de 7 con icono) y dos números (− / +), "Reponer +N" (mueve de la mochila al estante), "Quitar" (vuelve todo a la mochila). **Cambiar el precio es gratis**. **[D]** Ningún límite de precio: los niños fijan precios absurdos y aprenden solos que nadie compra.
- Tope por estante 60 unidades, total del Puesto 120. **[D]** Acota lo que queda "congelado" y el tamaño del guardado.

### 3.3 Comprar
- Cualquiera (no el dueño) a ≤4 m, A → **panel Puesto** en modo compra: "Tienda de Ana". Cada estante: "1 perla por 6 bayas · quedan 3" y botón **Comprar** (una tanda). Gris si no te llega o no queda.
- Servidor, en un solo paso del bucle: comprueba distancia, stock ≥ n, `hasAll(comprador, {want: m})`, sitio en la Caja; entonces `removeAll` al comprador, `addItem` n al comprador, stock −n, Caja +m. Si algo falla, **no cambia nada** y responde con el motivo ("No te llegan las bayas.").
- Límite: **1 compra cada 0,5 s por jugador** (el resto se ignora). Sin límite diario: el stock ya es el límite.
- Toast al comprador; si el dueño está conectado, toast "Bea compró 1 perla en tu puesto." Si no, lo verá en el **registro** (§3.4).

### 3.4 Caja y registro
- **Caja:** `Inventory` del Puesto, tope 200 unidades. Si está llena, los estantes salen "Caja llena" y no venden. **[D]** Evita que un Puesto olvidado acumule todo el mundo.
- El dueño, A → "Vaciar caja" → todo a su mochila (la mochila no tiene tope).
- **Registro:** las 10 últimas ventas ("Bea · 1 perla · 6 bayas · día 14"). Se ve en el panel y, resumido, en el Libro: "Tu puesto vendió 4 veces desde que te fuiste." al conectar.

### 3.5 Offline y el mundo dormido
- Mundo dormido = nadie conectado = nadie puede comprar. No hay nada que simular.
- Mundo despierto con el dueño fuera: el Puesto está en `SavedWorld`, cargado en la sim como cualquier estructura; la compra solo toca datos del mundo y la mochila del comprador (conectado). El dueño no necesita estar en `live`.
- Nada ocurre "con el tiempo" salvo la reposición de §5.4, que se calcula por **día de juego** al amanecer (el reloj solo corre despierto).

## 4. Trueque directo

- A a ≤4 m de otro jugador → botón contextual **"Cambiar"** (sustituye a la A solo si no hay nada más prioritario cerca: levantar, montar y cosechar ganan). El otro recibe "Ana quiere cambiar. [Ver] [No]".
- Ventana de dos columnas. Cada uno pone **hasta 3 líneas** (material + cantidad) de su mochila. Botón **Vale**. Cualquier cambio de cualquiera quita los dos Vale. Con los dos Vale, el servidor comprueba que los dos siguen teniendo todo y están a ≤6 m, y aplica las cuatro operaciones **en el mismo tick**; si no, cancela sin tocar nada.
- Se cancela solo si alguien se aleja >6 m, muere, se desconecta, entra en mazmorra o pasan 60 s.
- Regalar = poner algo solo en un lado. **[D]** No hace falta un "dar" aparte.
- Un trueque abierto por jugador. Pedir trueque: 1 cada 5 s; tras 3 "No" seguidos al mismo, 60 s de espera. **[D]** Evita que el de 12 le spamee al de 10.

## 5. El Buhonero (NPC) y cómo no se atasca

### 5.1 Quién y dónde
- Aparece junto al Corazón el amanecer después de `invasion2 === 'rescued'` (el Tragón vuelve con un "refugiado"). Es la versión más barata del extra "Rescued NPCs / refugee village": **un** NPC, sin misiones, usando el modelo de papel de un defensor blanco con otro tinte. **[D]** El pueblo entero no cabe en #6; esto lo deja sembrado.
- Mundos que aún no llegaron ahí: sin Buhonero. **[D]** Aparece hacia la mitad de la historia; antes la economía es tan pequeña que no hace falta. El solo tampoco lo necesita para avanzar: nada de la historia exige comerciar.
- Nombre placeholder `NAMES.merchant = 'Buhonero'`.

### 5.2 Reglas (tabla fija, por jugador, `MERCHANT`)
| Él **compra** (tú das → recibes bayas) | Él **vende** (tú das → recibes) |
|---|---|
| 5 madera → 1 baya | 6 bayas → 5 madera |
| 5 piedra → 1 baya | 6 bayas → 5 piedra |
| 1 perla → 4 bayas | 10 piedra → 5 bayas |
| 1 ámbar → 4 bayas | — |
| 1 cuarzo → 5 bayas | — |
| 1 espina negra → 6 bayas | — |

- Paga siempre en **bayas** (lo que cura el Corazón y olvida oficios): así el excedente vuelve a la defensa. Vende solo lo común.
- **Tope: 20 tratos por jugador y día de juego.** Sin stock (infinito dentro del tope).
- **Sumidero neto:** todo cambio con él pierde valor frente al trueque entre jugadores. Es la salida de lo que sobra y la red de seguridad del que se quedó sin madera; no es una tienda mejor que la de un amigo.
- **No vende perlas, ámbar, cuarzo ni espinas, nunca.** **[D]** Esas son el ritmo del arma y la Capa (pillar 4).

### 5.3 Por qué no se atasca con 3 jugadores
Hay siempre alguien a quien vender (el Buhonero) y siempre algo común que comprar; los Puestos solo añaden mejores precios entre amigos. Si nadie visita un Puesto, el dueño no pierde nada: recoge y el género vuelve.

### 5.4 Especialidad por bioma (lo que hace que valga la pena ir)
- Cada bioma tiene su material: Costa → perla, Pantano → ámbar, Montaña → cuarzo, Ceniza → espina; Bosque → bayas.
- Un Puesto **dentro** de un bioma con un estante que venda ese material recibe **+1 de ese material al amanecer** (tope: el estante no pasa de 10 por reposición). **[D]** Premia montar la tienda "en tu sitio" y da una razón para cruzar el mapa; +1/día es menos que lo que da recoger (no rompe el ritmo del arma: 6 perlas tardan 6 días de juego).
- Solo materiales raros que el dueño **ya haya recogido alguna vez** (flag por jugador `found`). Nadie puede fabricar espinas sin haber ido a la Ceniza.
- **Mapa del Menú:** cada Puesto sale como un punto con el icono de lo que vende y el nombre del dueño.

## 6. Idea de Claude: los Encargos

- Un estante puede ser **Busco** en vez de **Vendo**: "Busco 3 cuarzo, pago 12 piedra", hasta `stock` veces.
- La **paga** (12 piedra × veces) sale de la mochila del dueño al crear el encargo y queda apartada en el estante. Quien trae el material pulsa **Entregar**: le entra la paga, el material va a la Caja. Atómico, igual que comprar.
- Máx. 2 de los 4 estantes pueden ser Busco. **[D]** El Puesto sigue siendo sobre todo una tienda.
- Por qué: los tres no coinciden en horario. El de 10 pone "Busco 1 espina, pago 20 madera" antes de dormir; Gabriel lo entrega por la noche; por la mañana el sobrino tiene su espina. Co-op asíncrono sin bloquear a nadie.

## 7. Anti-abuso

- **Autoridad:** todo en `WorldSim`; el cliente solo manda intenciones (`stallSet`, `buy`, `tradeOffer`…). Cantidades enteras 1–20, materiales validados contra `ITEMS`.
- **Atómico:** el DO procesa mensajes en un solo hilo y el sim aplica cada operación completa en una llamada; ninguna transferencia cruza un `await`. Cada operación = comprobar todo → aplicar todo.
- **Sin duplicar:** tests de conservación: la suma de cada material en mochilas + tumbas + Puestos (estantes, pagas apartadas, Caja) es igual antes y después de cada compra, entrega, trueque, recoger y vaciar, incluidas las rutas de error. Solo cambian las cuentas en los puntos conocidos (recoger del mundo, construir, mejorar, Buhonero, reposición).
- **Guardado:** las transferencias se guardan en el siguiente lote normal; un cierre a mitad pierde como mucho los últimos segundos **de forma coherente** porque se guarda la fila entera (mochilas y Puestos juntos). Tras un trueque, `persist()` inmediato. **[D]** Es el único cambio que implica a dos personas.
- **Robo offline:** imposible por construcción: sin daño a Puestos, sin acceso a estantes/Caja de otro, el dueño es el único que recoge.
- **Ritmo:** compra/entrega 1 cada 0,5 s; Buhonero 20 al día; trueque 1 petición cada 5 s.
- **Nombre del dueño:** `owner` ya es el nombre de jugador autenticado (`auth.ts`); nadie puede hacerse pasar por otro.
- **Lo intransferible:** los mensajes nuevos solo aceptan `ItemId`. No hay camino para Rango, oficios, sombreros, Proezas, poderes, monturas ni niveles.

## 8. Out of scope (#6)

- Moneda, banco, subastas, impuestos, precios dinámicos.
- Comercio entre mundos.
- Vender o dar equipo, sombreros, monturas, poderes, niveles.
- Pueblo de refugiados completo, misiones de NPC, más de un comerciante (quedan para #7 o un extra).
- Decorar el Puesto (letrero dibujado por los sobrinos: posible en #2 como papel espíritu).
- Cocina y recetas nuevas.

## 9. Names (placeholders, `src/shared/names.ts`)

`stall: 'Puesto'`, `till: 'Caja'`, `merchant: 'Buhonero'`, `order: 'Encargo'`, `trade: 'Cambiar'`. Los sobrinos los cambian.

## 10. Technical

### 10.1 Reglas puras (`src/shared/shop.ts`)
`STALL` (coste, estantes 4, tope estante 60, total 120, Caja 200, máx. Busco 2, distancia 4, separación 15), `MERCHANT` (tabla, tope 20), `BIOME_ITEM`, y funciones puras que devuelven `{ ok, buyer, stall } | { ok: false, why }` sin mutar: `buy(stall, i, inv)`, `deliver(stall, i, inv)`, `restock(stall, i, inv, n)`, `setShelf(...)`, `collectTill(...)`, `pickUp(...)`, `trade(a, b, offerA, offerB)`, `merchantDeal(inv, dealId, used)`. Así la conservación se prueba sin servidor.

### 10.2 Protocolo y guardado (58 → 59+, uno por plan)
- `SavedWorld.stalls?: SavedStall[]` con `{ id, owner, x, y, z, rot, shelves: Shelf[4], till: Inventory, log: Sale[] }`; `Shelf = { mode: 'sell'|'want', give, n, want, m, stock, escrow? }`. El Puesto **no** va en `structures` (no es objetivo de asedio y no tiene hp) pero se envía con ellas en `welcome` y en eventos `stall`.
- `SavedPlayer.found?: ItemId[]`, `merchant?: { day, used }`, `soldSince?: number`.
- Mensajes cliente: `stallSet`, `stallStock`, `stallTake`, `stallTill`, `stallPick`, `buy {stall, shelf}`, `deliver {stall, shelf}`, `tradeAsk {to}`, `tradeAnswer`, `tradeOffer {lines}`, `tradeOk`, `tradeCancel`, `deal {id}`.
- Mensajes servidor: `stall {s}` (cambió un Puesto; a quien está a ≤60 m o lo tiene abierto), `trade {...}` (estado a los dos), `shopFail {why}`.
- Partidas viejas: sin campos → sin Puestos, `found` se infiere del inventario y de los niveles de arma/Capa (quien tiene arma 4 encontró cuarzo).

### 10.3 Consistencia del DO
Un DO por mundo, un hilo: los mensajes de dos compradores sobre el mismo estante se serializan; el segundo ve el stock ya restado. Nada de `await` entre comprobar y aplicar. El guardado sigue siendo una fila JSON (tamaño extra acotado: 3 Puestos × ~1 KB).

### 10.4 Rendimiento en móvil
Puesto = 1 malla fusionada (mostrador + toldo), 1 material, 1 draw call; icono del estante 1 como sprite. Buhonero = un actor de papel más, visible solo cerca del Corazón. Paneles en HTML.

### 10.5 Riesgos
- **Dupe por ruta rara** (tumba, morir con el panel abierto, desconectar a mitad de trueque): tests de conservación para cada ruta; el trueque se cancela en `leave`/`die` antes de cualquier otra cosa.
- **Reposición de bioma demasiado generosa:** constante; si el arma sube demasiado rápido, pasar a +1 cada 2 días.
- **El Buhonero como granja de bayas** (las bayas curan el Corazón): 20 tratos/día ≈ ≤20 bayas extra; medir en asedio.
- **A contextual saturada** cerca del Corazón (Corazón, Buhonero, Puesto, jugador): prioridad fija (levantar > Corazón > Puesto > Buhonero > Cambiar) y lista si hay más de uno a ≤4 m.
- **Precios absurdos de niños:** es parte del juego; el Buhonero da la referencia.

## 11. Plan map (sized like slice plans)

- **T6-A — Reglas y el Puesto:** `shop.ts` con tests de conservación, `stall` en guardado, construir/recoger, estantes Vendo y reponer, panel del dueño, malla. (v59)
- **T6-B — Comprar, Caja y registro:** `buy`, Caja, vaciar, registro y aviso al conectar, panel de compra, puntos en el mapa, límites de ritmo. (v60)
- **T6-C — Trueque directo:** ask/offer/ok/cancel, cancelaciones por distancia/muerte/salida, `persist` tras trueque, ventana de dos columnas. (v61)
- **T6-D — Buhonero, biomas y Encargos:** NPC tras el rescate, `MERCHANT` con tope, `found` y reposición por bioma, estantes Busco con paga apartada y `deliver`, nombres en `names.ts`, HANDOFF. (v62)
