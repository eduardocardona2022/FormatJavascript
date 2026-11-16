# FormatJavascript

Aplicación web local para cargar, formatear y exportar código JavaScript, TypeScript, JSX/TSX, JSON, CSS, HTML y Markdown con [Prettier](https://prettier.io/).

La interfaz sigue el lenguaje visual de **shadcn/ui** y el backend aplica **Clean Architecture**, principios SOLID y separación estricta de responsabilidades.

---

## Características

- Carga de archivos `.js`, `.jsx`, `.ts`, `.tsx`, `.json`, `.css`, `.html` y `.md`.
- También permite pegar código y elegir el lenguaje manualmente.
- Formateo con Prettier en el backend, aislado en un pool de workers.
- Opciones configurables: ancho de línea, indentación, comillas, punto y coma, comas finales, tabs, fin de línea y ajuste de prosa.
- Resultado con resaltado de sintaxis, copia al portapapeles y descarga con el nombre original (`app.ts` → `app.formatted.ts`).
- Errores de sintaxis con línea y columna cuando el parser las proporciona.
- Tema claro/oscuro, diseño responsive y atajos de teclado (`Ctrl/Cmd + Enter`).
- Validación en cliente y servidor, límite de 1 MB, rate limiting y timeout de formateo.
- Sin base de datos, sin autenticación y sin persistencia de código.

---

## Stack

| Capa         | Tecnología                                              |
| ------------ | ------------------------------------------------------- |
| Frontend     | React 19, TypeScript, Vite 8, Tailwind CSS 4, shadcn/ui |
| Editor       | CodeMirror 6 (carga diferida por lenguaje)              |
| Backend      | Node.js 22, TypeScript, Fastify 5                       |
| Formateador  | Prettier 3 en `worker_threads` con Piscina              |
| Contratos    | Zod 4 + paquete compartido `@formatjs/shared`           |
| Pruebas      | Vitest 5, Testing Library, `fastify.inject`             |
| Calidad      | ESLint 10, TypeScript `strict`, Prettier                |
| Persistencia | No aplica                                               |

---

## Arquitectura

La regla de dependencias apunta siempre hacia el dominio. El dominio no conoce Fastify, Prettier ni React.

```text
┌──────────────────────────── Navegador ────────────────────────────┐
│ React + shadcn/ui + CodeMirror                                    │
│  presentation → application (useFormatter) → domain (tipos)       │
│                         │                                         │
│               api-client (fetch tipado + Zod)                     │
└─────────────────────────┼─────────────────────────────────────────┘
                          │ POST /api/format (JSON)
┌─────────────────────────▼─────────────────────────────────────────┐
│ Node.js + Fastify                                                 │
│  interfaces/http → application/FormatSourceUseCase → domain       │
│                              │                                    │
│                     CodeFormatterPort ◄── PrettierFormatter        │
│                                            (Piscina / workers)     │
└───────────────────────────────────────────────────────────────────┘
```

### Capas del backend

| Capa             | Responsabilidad                                                         |
| ---------------- | ----------------------------------------------------------------------- |
| `domain`         | Entidades, value objects, errores y puertos. Sin dependencias externas. |
| `application`    | Caso de uso `FormatSourceUseCase`: valida, resuelve opciones y delega.  |
| `infrastructure` | Prettier, workers, configuración de entorno.                            |
| `interfaces`     | Fastify, rutas, validación HTTP, manejo de errores y estáticos.         |
| `main`           | Composition root: construye dependencias y arranca el servidor.         |

### Principios SOLID aplicados

- **SRP:** validar, formatear, transportar HTTP y configurar el servidor son responsabilidades separadas.
- **OCP:** un nuevo motor de formato se añade como nuevo adaptador de `CodeFormatterPort`.
- **LSP:** el caso de uso funciona con Prettier o con un fake de pruebas indistintamente.
- **ISP:** el puerto del formateador expone solo lo necesario.
- **DIP:** `FormatSourceUseCase` depende de una interfaz del dominio, no de Prettier.

### Estructura del proyecto

```text
FormatJavascript/
├─ apps/
│  ├─ api/
│  │  ├─ src/
│  │  │  ├─ domain/
│  │  │  │  ├─ entities/source-file.ts
│  │  │  │  ├─ value-objects/format-options.ts
│  │  │  │  ├─ ports/code-formatter.port.ts
│  │  │  │  └─ errors.ts
│  │  │  ├─ application/use-cases/format-source.use-case.ts
│  │  │  ├─ infrastructure/
│  │  │  │  ├─ config/env.ts
│  │  │  │  └─ formatter/{prettier.formatter.ts,formatter.worker.mjs}
│  │  │  ├─ interfaces/http/{build-server.ts,error-handler.ts,routes/*}
│  │  │  └─ main/server.ts
│  │  └─ test/
│  └─ web/
│     └─ src/
│        ├─ app/{app.tsx,theme-provider.tsx}
│        ├─ components/ui/          # componentes shadcn
│        ├─ features/formatter/
│        │  ├─ application/use-formatter.ts
│        │  ├─ domain/types.ts
│        │  └─ presentation/*.tsx
│        ├─ lib/{api-client.ts,clipboard.ts,format.ts,utils.ts}
│        └─ test/
├─ packages/shared/
│  └─ src/{languages.ts,schemas.ts}
├─ scripts/{dev.mjs,start-prod.mjs,wait-ready.mjs,stop.mjs,clean.mjs}
├─ samples/
├─ init.bat
├─ clean.bat
├─ vulnerabilidad.md
└─ README.md
```

---

## Requisitos

- **Node.js 22.12 o superior** (recomendado Node 22 LTS).
- **npm 10 o superior**.
- Windows para ejecutar `init.bat` y `clean.bat`. En otros sistemas se pueden usar los comandos `npm` equivalentes.

Comprueba la versión:

```bash
node -v
npm -v
```

---

## Inicio rápido

### Windows

```bat
init.bat
```

El script comprueba Node/npm, instala dependencias, arranca API y frontend, espera a que respondan y abre el navegador en `http://127.0.0.1:5173`.

Modo producción:

```bat
init.bat --prod
```

Compila el frontend y el backend, arranca el servidor de producción y abre `http://127.0.0.1:3000`.

### Manual

```bash
npm install
npm run dev
```

- Frontend: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:3000`
- Health: `http://127.0.0.1:3000/api/health`

Vite redirige `/api` al backend, por lo que no se necesita CORS.

---

## Scripts

| Comando                 | Descripción                                                     |
| ----------------------- | --------------------------------------------------------------- |
| `npm run dev`           | Arranca API y frontend, y gestiona ambos procesos.              |
| `npm run dev:api`       | Solo backend con `tsx watch`.                                   |
| `npm run dev:web`       | Solo frontend con Vite.                                         |
| `npm run build`         | Compila API (`tsup`) y frontend (`vite build`).                 |
| `npm start`             | Servidor de producción en `127.0.0.1:3000` (sirve el frontend). |
| `npm test`              | Ejecuta las pruebas de shared, API y web.                       |
| `npm run test:coverage` | Pruebas con cobertura y umbrales.                               |
| `npm run typecheck`     | TypeScript `strict` en todos los paquetes.                      |
| `npm run lint`          | ESLint sobre todo el monorepo.                                  |
| `npm run format`        | Formatea el repositorio con Prettier.                           |
| `npm run audit`         | `npm audit` con nivel mínimo `high`.                            |
| `npm run clean`         | Limpieza multiplataforma (detiene la app y elimina generados).  |
| `clean.bat`             | Limpieza en Windows con confirmación.                           |
| `clean.bat --dry-run`   | Muestra qué se eliminaría sin borrar nada.                      |
| `clean.bat --force`     | Limpia sin pedir confirmación.                                  |

> `clean.bat` interpreta el typo `clean.bar` del enunciado; el archivo correcto es `clean.bat`.

---

## Uso

1. Arrastra un archivo, selecciónalo o pega código en el editor.
2. Ajusta el lenguaje (solo en modo texto pegado) y las opciones de formato.
3. Pulsa **Formatear** o `Ctrl/Cmd + Enter`.
4. Revisa el resultado, cópialo o descárgalo.

El lenguaje de un archivo cargado se deduce de su extensión y queda bloqueado para evitar ambigüedades. En modo pegado puedes seleccionarlo manualmente.

Hay archivos de ejemplo en [`samples/`](./samples) para probar los ocho formatos.

---

## Lenguajes y opciones

| Extensión | Lenguaje         | Parser Prettier |
| --------- | ---------------- | --------------- |
| `.js`     | JavaScript       | `babel`         |
| `.jsx`    | JavaScript (JSX) | `babel`         |
| `.ts`     | TypeScript       | `typescript`    |
| `.tsx`    | TypeScript (TSX) | `typescript`    |
| `.json`   | JSON             | `json`          |
| `.css`    | CSS              | `css`           |
| `.html`   | HTML             | `html`          |
| `.md`     | Markdown         | `markdown`      |

Opciones expuestas:

| Opción           | Valores                       | Default    | Aplica a      |
| ---------------- | ----------------------------- | ---------- | ------------- |
| `printWidth`     | 40–160                        | 80         | Todos         |
| `tabWidth`       | 1–8                           | 2          | Todos         |
| `useTabs`        | booleano                      | `false`    | Todos         |
| `endOfLine`      | `lf`, `crlf`, `auto`          | `lf`       | Todos         |
| `semi`           | booleano                      | `true`     | JS/JSX/TS/TSX |
| `singleQuote`    | booleano                      | `false`    | JS/JSX/TS/TSX |
| `trailingComma`  | `none`, `es5`, `all`          | `all`      | JS/JSX/TS/TSX |
| `bracketSpacing` | booleano                      | `true`     | JS/JSX/TS/TSX |
| `arrowParens`    | `always`, `avoid`             | `always`   | JS/JSX/TS/TSX |
| `proseWrap`      | `always`, `never`, `preserve` | `preserve` | Markdown      |

El backend vuelve a filtrar las opciones según el lenguaje. Las opciones no aplicables se ignoran; las opciones desconocidas se rechazan con `400`.

---

## API

### `POST /api/format`

```json
{
  "fileName": "ejemplo.ts",
  "source": "const saludo:string='hola';console.log(saludo)",
  "options": {
    "printWidth": 100,
    "semi": true,
    "singleQuote": true
  }
}
```

```json
{
  "formatted": "const saludo: string = 'hola';\nconsole.log(saludo);\n",
  "language": "typescript",
  "stats": {
    "inputLines": 1,
    "outputLines": 2,
    "durationMs": 18.4
  }
}
```

El `fileName` es obligatorio y determina el lenguaje. No se escribe en disco; solo se usa como metadato y para seleccionar el parser.

### Errores

| HTTP | Código                   | Caso                                        |
| ---- | ------------------------ | ------------------------------------------- |
| 400  | `VALIDATION_ERROR`       | JSON, campos u opciones inválidas           |
| 400  | `BAD_REQUEST`            | Cuerpo malformado o petición no válida      |
| 413  | `PAYLOAD_TOO_LARGE`      | Contenido superior a 1 MiB                  |
| 415  | `UNSUPPORTED_LANGUAGE`   | Extensión no soportada                      |
| 415  | `UNSUPPORTED_MEDIA_TYPE` | Content-Type distinto de `application/json` |
| 422  | `SYNTAX_ERROR`           | Error de sintaxis, con línea/columna        |
| 429  | `RATE_LIMITED`           | Demasiadas peticiones                       |
| 503  | `FORMATTER_UNAVAILABLE`  | Worker no disponible                        |
| 504  | `FORMAT_TIMEOUT`         | Formateo supera el timeout                  |
| 500  | `INTERNAL_ERROR`         | Error inesperado, sin detalles internos     |

### `GET /api/health`

```json
{ "status": "ok", "uptime": 12.34 }
```

---

## Seguridad

Resumen de controles:

- Validación estricta con Zod y rechazo de campos desconocidos.
- Límite de 1 MiB, `bodyLimit` de Fastify y rate limiting por IP.
- Prettier no ejecuta el código; se ejecuta en workers con timeout.
- Sin escritura en disco y sin registrar el código fuente en logs.
- Nombres de archivo saneados; el servidor rechaza rutas.
- React escapa el contenido y Markdown se muestra como código, nunca como HTML.
- Helmet con CSP, `nosniff`, `frame-ancestors 'none'` y `base-uri 'none'`.
- Servidor enlazado a `127.0.0.1` por defecto.
- `npm audit` sin vulnerabilidades conocidas en la fecha de entrega.

El detalle completo, hallazgos, mitigaciones y riesgos residuales está en [`vulnerabilidad.md`](./vulnerabilidad.md).

> Si despliegas la app en un servidor público, añade autenticación, TLS y un proxy inverso. La aplicación no incluye autenticación por diseño.

---

## Pruebas

```bash
npm test
npm run test:coverage
```

Cobertura actual:

| Paquete   | Pruebas | Statements | Branches | Functions | Lines  |
| --------- | ------- | ---------- | -------- | --------- | ------ |
| `shared`  | 26      | 98.0 %     | 93.8 %   | 91.7 %    | 98.0 % |
| `api`     | 68      | 93.7 %     | 90.5 %   | 95.2 %    | 94.1 % |
| `web`     | 47      | 79.3 %     | 66.8 %   | 74.4 %    | 79.2 % |
| **Total** | **141** | -          | -        | -         | -      |

Los umbrales están configurados en cada `vitest.config.ts` y el comando falla si no se cumplen.

Las pruebas incluyen:

- Dominio y value objects (`SourceFile`, `ResolvedFormatOptions`).
- Caso de uso con formateador fake.
- Integración real con Prettier para los ocho lenguajes, errores de sintaxis, timeout y worker roto.
- Rutas HTTP con `fastify.inject`: éxito, 400, 413, 415, 422, 429, 503, 504 y 500.
- Servidor de producción: CSP, caché de assets, fallback SPA y 404 de API.
- Frontend: cliente API, portapapeles, hook `useFormatter`, dropzone, opciones, editor y página completa.

---

## Configuración

Copia `.env.example` a `.env` en la raíz si necesitas cambiar los valores:

| Variable                | Default       | Descripción                                                    |
| ----------------------- | ------------- | -------------------------------------------------------------- |
| `NODE_ENV`              | `development` | `development`, `test` o `production`.                          |
| `HOST`                  | `127.0.0.1`   | Interfaz de escucha. Usa `0.0.0.0` solo si sabes lo que haces. |
| `PORT`                  | `3000`        | Puerto de la API.                                              |
| `MAX_SOURCE_BYTES`      | `1048576`     | Límite de entrada en bytes (1 MiB).                            |
| `RATE_LIMIT_MAX`        | `120`         | Peticiones por ventana.                                        |
| `RATE_LIMIT_WINDOW`     | `1 minute`    | Ventana de rate limiting.                                      |
| `FORMAT_TIMEOUT_MS`     | `5000`        | Timeout por formateo.                                          |
| `FORMATTER_MAX_THREADS` | `2`           | Hilos del pool de Prettier.                                    |
| `LOG_LEVEL`             | `info`        | Nivel de logs de Fastify/Pino.                                 |
| `TRUST_PROXY`           | `false`       | Confiar en `X-Forwarded-*` detrás de un proxy.                 |
| `WEB_DIST_PATH`         | —             | Ruta explícita al build del frontend.                          |

---

## Despliegue sin Docker

```bash
npm ci
npm run build
npm start
```

`npm start`:

1. Establece `NODE_ENV=production`.
2. Arranca la API compilada.
3. Sirve el frontend desde `apps/web/dist` en `http://127.0.0.1:3000`.

Para un servidor:

- Configura `HOST=0.0.0.0` y `PORT` según tu infraestructura.
- Coloca Nginx/Caddy delante para TLS y autenticación.
- Define `TRUST_PROXY=true` si el proxy añade cabeceras de reenvío.
- Mantén `WEB_DIST_PATH` sin definir si usas la estructura del repositorio.
- La app no incluye Docker por decisión del alcance.

---

## Solución de problemas

**Los puertos 3000/5173 están ocupados**

Ejecuta `clean.bat` o `node scripts/stop.mjs`. El script solo detiene procesos del proyecto.

**`init.bat` no abre el navegador**

Ejecuta `npm run dev` en una terminal y abre `http://127.0.0.1:5173`. El script de espera imprime el error si la API no responde.

**Error de versión de Node**

Instala Node 22.12 o superior. Vite 8 y las versiones actuales de las dependencias lo requieren.

**Windows bloquea la instalación de esbuild**

El `package.json` incluye `allowScripts` para `esbuild`. Si usas otra versión de npm, ejecuta:

```bash
npm install-scripts approve esbuild
```

**El formateo tarda en la primera petición**

El pool de Piscina arranca un worker bajo demanda. Las peticiones posteriores son más rápidas.

**CSP bloquea algún recurso**

La CSP permite `style-src 'unsafe-inline'` porque CodeMirror inyecta estilos. No se permiten scripts inline; `theme-init.js` se sirve como archivo propio.

---

## Decisiones de diseño

- **Backend para Prettier:** cumple el stack solicitado y evita cargar el parser completo en el navegador.
- **Workers:** Prettier es CPU-bound; aislarlo protege el event loop de Fastify.
- **Contratos compartidos:** el mismo esquema Zod valida la entrada y la respuesta.
- **Sin base de datos:** no hay estado que persistir; el código vive en memoria del navegador y del worker.
- **CodeMirror diferido:** el editor pesado se carga en un chunk separado y los lenguajes se importan bajo demanda.
- **Mismo origen en producción:** Fastify sirve el build del frontend y evita CORS.
- **Sin vista previa de Markdown:** se muestra como código para no introducir XSS por HTML generado.

---

## Licencia

Proyecto de ejemplo con fines educativos y de portafolio.
