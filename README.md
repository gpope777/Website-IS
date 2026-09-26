# Bosque Online — supervivencia cooperativa

Juego de supervivencia en tercera persona para navegador, ahora en línea: hasta varios jugadores comparten el
mismo bosque generado proceduralmente, ven a los demás en tiempo real y su progreso se guarda en el servidor.

## Cómo jugar

| Tecla / gesto | Acción |
| --- | --- |
| WASD / flechas / stick (móvil) | Moverse |
| Ratón (clic para capturar) / arrastrar (móvil) | Mirar |
| Shift | Correr |
| Espacio / botón B (móvil) | Saltar |
| E / F o clic / botón A (móvil) | Acción (recolectar, golpear) |
| 1 | Comer bayas |
| B | Fogata (5 madera + 3 piedra) |
| V | Muro (4 madera) |
| C | Cambiar cámara (3ª / 1ª persona) |
| Esc | Menú |

En móvil: stick de movimiento, arrastrar para mirar, botones A (acción) y B (saltar), píldoras de estado y MENÚ
en la esquina superior izquierda.

## Arquitectura

- `src/shared` — reglas del juego y simulación (lógica pura, sin DOM)
- `src/server` — Cloudflare Worker (`index.ts`), Durable Object por mundo (`world-room.ts`), autenticación (`auth.ts`)
- `src/client` — juego en Three.js

Detalles de diseño: `docs/superpowers/specs/2026-09-26-bosque-online-design.md`. Créditos de modelos 3D:
[`public/models/CREDITS.md`](public/models/CREDITS.md).

## Desarrollo

```bash
npm install
npm run dev:server   # build + Worker + juego en http://localhost:8787 (recomendado)
npm run dev          # http://localhost:5173, con recarga en caliente (proxy /ws hacia :8787)
npm run check        # tsc (cliente, servidor, tests de Workers)
npm test             # simulación y lógica compartida
npm run test:workers # tests contra el runtime de Cloudflare Workers
```

Antes de `npm run dev:server`, define el token de admin local:

```bash
echo ADMIN_TOKEN=dev-admin > .dev.vars
```

Para crear un mundo local (usa ese mismo token):

```bash
curl -X POST http://localhost:8787/admin/test/create -H "Authorization: Bearer dev-admin"
```

Luego entra con `http://localhost:8787/?mundo=test`.

## Despliegue

Antes del primer despliegue, configura el token de admin en producción:

```bash
npx wrangler secret put ADMIN_TOKEN
```

Cada push a `main` corre pruebas y despliega automáticamente (`.github/workflows/deploy.yml`), que necesita los secretos del repo de GitHub
`CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`. Para desplegar a mano:

```bash
npm run deploy
```

Rollback (cliente y servidor juntos):

```bash
npx wrangler rollback
```

## Administración de mundos (producción)

Todas las rutas requieren `Authorization: Bearer $ADMIN_TOKEN`.

```bash
# crear un mundo (opcionalmente con seed)
curl -X POST https://bosque.<subdominio>.workers.dev/admin/<mundo>/create \
  -H "Authorization: Bearer $ADMIN_TOKEN" -d '{"seed": 4242}'

# exportar backup
curl https://bosque.<subdominio>.workers.dev/admin/<mundo>/export \
  -H "Authorization: Bearer $ADMIN_TOKEN" > backups/<mundo>-$(date +%F).json

# importar backup
curl -X POST https://bosque.<subdominio>.workers.dev/admin/<mundo>/import \
  -H "Authorization: Bearer $ADMIN_TOKEN" --data-binary @backups/<mundo>-2026-09-26.json
```
