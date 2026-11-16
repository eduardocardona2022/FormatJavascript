# Análisis de vulnerabilidades — FormatJavascript

**Fecha:** 2026-11-16  
**Alcance:** aplicación web local FormatJavascript (frontend React, API Fastify, pool de Prettier).  
**Versión auditada:** 1.0.0.

---

## 1. Resumen ejecutivo

| Métrica                              | Resultado            |
| ------------------------------------ | -------------------- |
| Vulnerabilidades críticas            | 0                    |
| Vulnerabilidades altas               | 0                    |
| Vulnerabilidades moderadas           | 0 tras la corrección |
| Vulnerabilidades bajas               | 0                    |
| Dependencias de producción auditadas | 177                  |
| Dependencias totales auditadas       | 555                  |
| Pruebas automatizadas                | 141                  |

`npm audit` y `npm audit --omit=dev` finalizan sin vulnerabilidades conocidas en la fecha indicada.

Antes de la corrección se detectaron **7 vulnerabilidades moderadas**, todas en dependencias de desarrollo y encadenadas al mismo paquete (`minimatch`). No había vulnerabilidades críticas ni altas. Se corrigió la cadena mediante un `override` de npm y se volvieron a ejecutar lint, typecheck, pruebas y build.

---

## 2. Metodología

1. Revisión del modelo de amenazas: app local, sin autenticación, sin base de datos y sin escritura en disco.
2. `npm audit` y `npm audit --omit=dev`.
3. Revisión de OWASP Top 10 (2021) aplicada al alcance.
4. Revisión manual de los puntos de entrada:
   - Carga de archivos en el navegador.
   - Contrato HTTP `POST /api/format`.
   - Validación de nombre, extensión, tamaño y contenido.
   - Selección de parser y ejecución de Prettier.
   - Servido de estáticos y cabeceras de seguridad.
   - Manejo y serialización de errores.
   - Descarga y portapapeles en el cliente.
5. Verificación posterior a la corrección:
   - `npm run lint`
   - `npm run typecheck`
   - `npm test`
   - `npm run build`
   - `npm audit`
   - `npm audit --omit=dev`

---

## 3. Hallazgos

### VULN-01 — Denial of Service en `minimatch` (moderada, corregida)

| Campo      | Detalle                                                              |
| ---------- | -------------------------------------------------------------------- |
| Severidad  | Moderada                                                             |
| Afectación | Solo desarrollo (`eslint` / `typescript-eslint`), no runtime         |
| Paquete    | `minimatch` 10.2.6 anidado en `@typescript-eslint/typescript-estree` |
| Advisory   | GHSA-g3hv-75wg-m249 — amplificación de `globparts`                   |
| Vector     | Procesamiento de patrones glob no confiables                         |
| Estado     | **Corregido**                                                        |

**Análisis:** la versión 10.2.6 de `minimatch` queda dentro del rango afectado (`>=7.0.0 <11.0.1`). La dependencia se usa en herramientas de linting, no en el servidor ni en el navegador. El impacto real era bajo para esta app (patrones controlados por el desarrollador), pero se corrigió para dejar el árbol limpio.

**Remediación aplicada:** override global en `package.json`:

```json
"overrides": {
  "minimatch": "^11.0.8"
}
```

**Verificación:** tras reinstalar, `npm ls minimatch` muestra 11.0.8 en todas las ramas y `npm audit` devuelve 0 vulnerabilidades. Se comprobó que ESLint, TypeScript, Vitest y el build siguen funcionando con la versión forzada.

**Nota de mantenimiento:** `@typescript-eslint/typescript-estree@8.72.2` declara `minimatch: ^10.2.2`; el override queda fuera de ese rango declarado. Cuando el proyecto upstream publique una versión con `minimatch >=11.0.1`, se debe retirar el override y actualizar la dependencia.

### VULN-02 — Ausencia de autenticación (aceptada, por diseño)

| Campo     | Detalle                                                  |
| --------- | -------------------------------------------------------- |
| Severidad | Baja en el alcance local; alta si se expone públicamente |
| Estado    | **Aceptada / documentada**                               |

La aplicación no tiene login ni autorización. Está pensada para ejecutarse en `127.0.0.1`. El servidor escucha en localhost por defecto y no guarda código. Si se publica en una red, cualquier cliente podría formatear código y consumir CPU.

**Mitigación:** mantener `HOST=127.0.0.1`; para exposición pública, añadir autenticación, TLS y proxy inverso con límites de red.

### VULN-03 — `style-src 'unsafe-inline'` en la CSP (aceptada)

| Campo     | Detalle      |
| --------- | ------------ |
| Severidad | Baja         |
| Estado    | **Aceptada** |

CodeMirror inyecta estilos en tiempo de ejecución. La CSP permite estilos inline, pero mantiene `script-src 'self'` y `script-src-attr 'none'`, por lo que no se permite JavaScript inline ni `eval`.

**Mitigación futura:** sustituir CodeMirror por un editor compatible con nonces/hashes o generar una CSP basada en hashes si el requisito de seguridad lo exige.

### VULN-04 — El código fuente transita por la API local (aceptada)

| Campo     | Detalle      |
| --------- | ------------ |
| Severidad | Informativa  |
| Estado    | **Aceptada** |

El texto se envía desde el navegador a la API en `127.0.0.1` para ejecutar Prettier en el backend. No se persiste en disco ni se registra en logs. Un proceso local con acceso al equipo podría inspeccionar el tráfico loopback; es un riesgo asumido del modelo local.

**Mitigación:** no registrar cuerpos de petición; limitar el acceso al equipo; para máxima privacidad, se podría migrar el formateo al navegador en el futuro.

### VULN-05 — Denegación de servicio por entradas grandes o repetidas (mitigada)

| Campo     | Detalle      |
| --------- | ------------ |
| Severidad | Media        |
| Estado    | **Mitigada** |

Controles:

- `MAX_SOURCE_BYTES = 1 MiB` validado en dominio y en el cliente.
- `bodyLimit` de Fastify de 2 MiB.
- Rate limiting de 120 peticiones por minuto por IP (configurable).
- Prettier aislado en Piscina con timeout de 5 s y cola limitada.
- Respuesta 413/429 normalizada.

**Riesgo residual:** el rate limit es en memoria y por proceso; en varios nodos haría falta un almacén compartido (Redis) o un límite en el proxy.

### VULN-06 — Contaminación de prototipos / opciones arbitrarias (mitigada)

| Campo     | Detalle      |
| --------- | ------------ |
| Severidad | Media        |
| Estado    | **Mitigada** |

- Zod valida objetos estrictos y rechaza claves desconocidas.
- El backend no hace `spread` del objeto de opciones recibido.
- Se construye un objeto explícito con las claves permitidas por lenguaje.
- El parser se deriva de la extensión en el servidor; el cliente no puede elegir un parser arbitrario.

### VULN-07 — Path traversal en nombres de archivo (mitigada)

| Campo     | Detalle      |
| --------- | ------------ |
| Severidad | Media        |
| Estado    | **Mitigada** |

- El servidor rechaza rutas y nombres con `..`, separadores o caracteres no permitidos.
- No se escribe ningún archivo en disco.
- La descarga se genera en el cliente con un nombre saneado y una extensión conservada.

### VULN-08 — XSS por contenido del usuario (mitigada)

| Campo     | Detalle                            |
| --------- | ---------------------------------- |
| Severidad | Alta si existiera renderizado HTML |
| Estado    | **Mitigada**                       |

- React escapa el texto y no se usa `dangerouslySetInnerHTML`.
- El resultado se muestra como texto en CodeMirror, no como HTML.
- Markdown no tiene vista previa HTML; se muestra como código.
- La CSP limita scripts a `'self'` y bloquea scripts inline.
- No se ejecuta código del usuario: Prettier solo analiza sintaxis.

### VULN-09 — Fugas de información en errores (mitigada)

| Campo     | Detalle      |
| --------- | ------------ |
| Severidad | Media        |
| Estado    | **Mitigada** |

- Los errores inesperados devuelven `INTERNAL_ERROR` sin stack ni mensaje interno.
- Los errores de sintaxis devuelven solo el primer renglón del mensaje, con línea/columna cuando existe.
- Los logs de Fastify no incluyen el cuerpo del código.
- Se registran errores 5xx con el objeto de error en el servidor, no en la respuesta.

### VULN-10 — CSRF (no aplica)

No hay cookies de sesión, autenticación ni acciones con estado. La API es same-origin en producción y usa el proxy de Vite en desarrollo. No se implementan tokens CSRF porque no hay superficie que proteger.

### VULN-11 — SSRF (no aplica)

La API no realiza peticiones salientes a URLs proporcionadas por el usuario. Prettier es local y no accede a la red.

---

## 4. Revisión OWASP Top 10 (2021)

| Categoría                                      | Evaluación                                                                            | Estado                   |
| ---------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------ |
| A01 Broken Access Control                      | App local sin auth; binding a `127.0.0.1`; sin operaciones sensibles                  | Aceptado con condiciones |
| A02 Cryptographic Failures                     | Sin secretos ni datos en reposo; TLS debe terminar en el proxy si se publica          | N/A / recomendación      |
| A03 Injection                                  | Zod estricto, sin `eval`, sin shell desde input, Prettier parse-only                  | Mitigado                 |
| A04 Insecure Design                            | Límites de tamaño, rate limit, timeout, workers, sin persistencia                     | Mitigado                 |
| A05 Security Misconfiguration                  | Helmet, CSP, `nosniff`, `frame-ancestors`, dotfiles deny, errores genéricos           | Mitigado                 |
| A06 Vulnerable and Outdated Components         | `npm audit` 0, lockfile, override de `minimatch`                                      | Mitigado                 |
| A07 Identification and Authentication Failures | No hay autenticación por alcance local                                                | Aceptado                 |
| A08 Software and Data Integrity Failures       | Lockfile, dependencias con versiones fijadas, sin código remoto                       | Mitigado                 |
| A09 Security Logging and Monitoring Failures   | Pino/Fastify, request IDs, sin código fuente en logs; sin monitorización centralizada | Parcial                  |
| A10 Server-Side Request Forgery                | Sin peticiones salientes                                                              | N/A                      |

---

## 5. Controles de seguridad implementados

- Validación de entrada en cliente y servidor con Zod.
- Lista blanca de extensiones y parsers.
- Límite de 1 MiB y `bodyLimit`.
- Rate limiting y timeout de formateo.
- Prettier en `worker_threads` (Piscina).
- Sin escritura en disco ni persistencia.
- Sanitización de nombres y rechazo de rutas.
- Helmet con CSP.
- Caché de assets con hash y `no-cache` para `index.html`.
- Fallback SPA limitado a navegación HTML; assets inexistentes devuelven 404.
- `dotfiles: 'deny'` y servido únicamente de `apps/web/dist`.
- Errores normalizados y sin detalles internos.
- Logs sin cuerpo de código.
- Dependencias auditadas y lockfile.
- Pruebas de seguridad funcional en rutas, límites y errores.

---

## 6. Riesgos residuales

1. **Autenticación:** no existe. No exponer la app a Internet sin protegerla.
2. **CSP:** `style-src 'unsafe-inline'` por CodeMirror. Los scripts siguen restringidos a `'self'`.
3. **Rate limit en memoria:** suficiente para una instancia local; no para un clúster.
4. **Código en tránsito loopback:** riesgo aceptado del modelo backend.
5. **Cadena de suministro:** aunque `npm audit` esté limpio, nuevas vulnerabilidades pueden aparecer; revisar periódicamente y actualizar.
6. **Override de `minimatch`:** debe retirarse cuando `typescript-eslint` actualice su dependencia.
7. **Sin TLS integrado:** usar un proxy inverso para HTTPS.
8. **Monitorización:** no hay alertas centralizadas; los logs son locales.

---

## 7. Recomendaciones para producción pública

1. Colocar Nginx/Caddy delante con TLS, autenticación y límites de tasa.
2. Configurar `HOST=0.0.0.0` solo detrás del proxy y `TRUST_PROXY=true`.
3. Añadir autenticación (OIDC, básica o mTLS) y autorización.
4. Revisar la CSP y eliminar `unsafe-inline` si se sustituye CodeMirror o se usan nonces.
5. Ejecutar `npm ci` y `npm audit` en CI; bloquear builds con vulnerabilidades altas/críticas.
6. Añadir monitorización y alertas para 5xx, 429 y tiempos de formateo.
7. Revisar periódicamente las dependencias y retirar overrides temporales.
8. Considerar un límite de concurrencia y una cola distribuida si se escala horizontalmente.

---

## 8. Evidencia de verificación

```text
npm audit
found 0 vulnerabilities

npm audit --omit=dev
found 0 vulnerabilities

npm run lint      → OK
npm run typecheck → OK
npm test          → 141 pruebas superadas
npm run build     → OK
```

Los informes de cobertura se generan en `coverage/` dentro de cada workspace al ejecutar `npm run test:coverage`.

---

## 9. Conclusión

No se identificaron vulnerabilidades críticas ni altas. La única cadena moderada detectable afectaba exclusivamente a herramientas de desarrollo y fue corregida mediante un override verificado. Los riesgos restantes son propios de una aplicación local sin autenticación y están documentados con acciones concretas para un despliegue público.
