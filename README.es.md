<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.md">English</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/mcp-tool-shop-org/brand/main/logos/cognate/readme.png" alt="Cognate" width="400">
</p>

<p align="center">
  <a href="https://github.com/mcp-tool-shop-org/cognate/actions/workflows/ci.yml"><img src="https://github.com/mcp-tool-shop-org/cognate/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://mcp-tool-shop-org.github.io/cognate/"><img src="https://img.shields.io/badge/Landing_Page-live-blue" alt="Landing Page"></a>
  <a href="https://opensource.org/license/mit/"><img src="https://img.shields.io/badge/License-MIT-yellow" alt="MIT License"></a>
</p>

<p align="center"><strong>Gobernanza estructural para la inteligencia autónoma.</strong></p>

**Versión 1.0.0.** La versión anterior fue 0.1.8. Las versiones 0.2.0 y 0.3.0 nunca se publicaron por separado, y sus cambios se incluyen en la 1.0.0. La versión 1.0.0 modifica la API HTTP: el servidor ahora rechaza las solicitudes no firmadas. A partir de la versión 1.0, las versiones siguen el versionado semántico: un cambio que interrumpa la API HTTP, el formato de solicitud firmada o el formato de evento y atestación se acompañará de una nueva versión principal. Consulte [Qué hay de nuevo en la 1.0.0](#qué-hay-de-nuevo-en-la-100).

Cognate es la capa de gobernanza de IA construida sobre [Attestia](https://github.com/mcp-tool-shop-org/attestia). Attestia demuestra que algo ocurrió: un evento, una transacción, una transición de estado, y vincula esa prueba a una cadena. Cognate utiliza los mismos primitivos de atestación para gobernar los sistemas de IA: qué se le permitió hacer a un modelo, qué hizo realmente y quién lo autorizó.

Cognate atestigua la verdad de la IA: linaje del modelo, decisiones de política, capacidades del agente e integridad del prompt y la salida. Las mismas pruebas de Merkle. El mismo almacén de eventos de solo adición. Un dominio diferente.

Attestia, Cognate y RepoMesh son tres productos. Attestia implementa el dominio financiero (bóveda personal, tesorería de la organización, registro) sobre esos primitivos. RepoMesh es la red de lanzamiento: eventos firmados, manifiestos de nodos y un reloj de confianza anclado en XRPL, en su propio libro mayor RFC 6962. No utiliza el árbol de Merkle de Attestia. Cognate llama a Attestia cuando necesita una prueba, y a RepoMesh cuando necesita que se verifique un lanzamiento. `@cognate/repomesh-bridge` es esa verificación.

---

## Qué hay de nuevo en la 1.0.0

- **Registros de ejecución.** `@cognate/model-registry` pre-registra una ejecución antes de lanzarla y registra su resultado en el flujo `cognate-<tenant>-runs`. Los identificadores de nomenclatura de cuentas se almacenan solo como resúmenes SHA-256, y una ejecución registra su propio costo, nunca el saldo de una cuenta.
- **Evaluaciones.** Una versión del modelo contiene cualquier número de evaluaciones (una ejecución, su replicación, un resultado agrupado), y una transición cita las evaluaciones en las que se basa. `requireEvaluationCitations` establece qué transiciones deben citar. Se puede rechazar una versión aprobada antes de su implementación.
- **Ámbito de inquilino.** Cada ruta en `@cognate/node` actúa en el ámbito del inquilino del llamante. Se rechaza un registro que haga referencia a otro inquilino, y el ID de otro inquilino obtiene la misma respuesta que uno que falta. Un ID que falta ahora es 404, no 400.
- **Solicitudes firmadas (cambio importante).** Cada escritura y cada `GET /events/:eventId` deben estar firmadas con la clave Ed25519 del llamante (`cognate-request-v1`), con una ventana de marca de tiempo y protección contra reproducción. El actor en cada ruta es el firmante verificado. El registro de agentes y la aprobación de permisos requieren una capacidad `delegate`, y una clave raíz de inquilino proporcionada por el operador inicia el primer delegado de cada inquilino. Consulte [Guía de autenticación y migración](#guía-de-autenticación-y-migración).
- **Los poderes de la clave raíz, en palabras sencillas.** La documentación enumera todo lo que la raíz del inquilino aún puede hacer después del inicio, y dice que una raíz derivada de una semilla de prueba nunca debe configurarse en producción.
- **Conjunto de herramientas de prueba.** vitest 4.1.12 y vite 8.3.5; se eliminan los avisos de alta y crítica en el árbol de desarrollo en la raíz, sin ignorar ni anular.

La lista completa está en [CHANGELOG.md](CHANGELOG.md).

---

## Misión

Creemos que, a medida que los sistemas de IA adquieren autonomía, las estructuras que los gobiernan deben adquirir rigor. Los contratos inteligentes se ejecutan. Los modelos infieren. Pero nadie *atestigua* qué se le permitió hacer a la IA, qué hizo realmente y si un humano lo aprobó.

Cognate es la capa que falta: registro de modelos, aplicación de políticas, identidad de agentes y auditoría determinista, todo ello unificado en modelos, organizaciones y cadenas.

### Lo que defendemos

- **La verdad por encima de la velocidad.** Cada inferencia de modelo es de solo adición, reproducible y conciliable. Si no se puede demostrar, no sucedió.
- **Los humanos aprueban; las máquinas verifican.** La IA asesora, los modelos infieren, pero nada se implementa ni actúa sin la autorización explícita de un humano. Nunca.
- **Gobernanza estructural, no gobernanza política.** No votamos sobre lo que es válido. Definimos invariantes que se cumplen incondicionalmente: la identidad del modelo es explícita, el linaje es ininterrumpido, la versión de la política es monótona.
- **La intención no es la ejecución.** Declarar lo que debe hacer un agente y permitir que actúe son actos separados con puertas de enlace separadas. La brecha entre ellos es donde reside la confianza.
- **Los modelos son testigos, no autoridades.** Attestia atestigua. Las cadenas liquidan. Pero la autoridad fluye de las reglas estructurales, no de los pesos de ningún modelo.

---

## Arquitectura

Cognate consume los primitivos de Attestia y agrega una capa de dominio nativa de la IA. Los paquetes son funciones puras. Los llamantes proporcionan el estado. Nada aquí abre un socket, escribe un archivo o lee un reloj a menos que le proporcione el valor.

| Paquete | Propósito | Estado |
|---------|---------|--------|
| @cognate/types | Tipos de dominio de gobernanza de IA compartidos (cero dependencias) | Listo |
| @cognate/policy | Motor de evaluación de políticas semánticas | Listo |
| @cognate/model-registry | Ciclo de vida del modelo, versiones, evaluación | Listo |
| @cognate/agent-identity | Identidad del agente, capacidades, permisos | Listo |
| @cognate/prompt-store | Registro de prompts/salidas con eventos cifrados | Listo |
| @cognate/repomesh-bridge | Verificación de lanzamiento RepoMesh (`verifyRelease`) antes de la implementación | Listo |
| @cognate/node | Servidor de API HTTP en el puerto 4000, con solicitudes firmadas y ámbito de inquilino | Listo |

`@mcptoolshop/cognate` en npm agrupa las bibliotecas. `@cognate/node` se ejecuta en la imagen de Docker.

### Alineación regulatoria

| Regulación | Cognate cumple con |
|------------|-------------------|
| Artículo 12 de la Ley de IA de la UE | Registro de eventos de solo adición durante toda la vida útil del sistema |
| Artículo 14(5) de la Ley de IA de la UE | Identificación de personas físicas en la verificación |
| NIST AI RMF | Funciones de gobernanza, mapeo, medición y gestión |
| ISO/IEC 42001 | Requisitos del sistema de gestión de la IA |

---

## Principios

| Principio | Implementación |
|-----------|---------------|
| Registros de solo adición | Sin UPDATE, sin DELETE: solo nuevas entradas |
| Falla de forma segura | El desacuerdo en las políticas detiene el sistema, nunca se resuelve silenciosamente. |
| Reproducción determinista. | Los mismos eventos producen el mismo estado, siempre. |
| Validaciones de aprobación humana. | Ningún modelo se implementa, ninguna política cambia, ni se otorgan capacidades sin una aprobación explícita. |
| Solicitudes cifradas. | AES-256-GCM con clave de inquilino para la privacidad; hash SHA-256 para la integridad. |
| Identidad estructural. | Explícita, inmutable, única: para modelos, agentes y políticas. |

---

## Guía de inicio rápido

### Utilice las bibliotecas de npm

```bash
npm install @mcptoolshop/cognate
```

Evalúe una política. El motor no recupera el estado ni lee el reloj. Usted proporciona la política y el contexto. Guarde esto como `quickstart.mjs` y ejecute `node quickstart.mjs`; imprime `deny`.

```js
import { evaluatePolicy } from "@mcptoolshop/cognate/policy";

const policy = {
  id: "policy-1",
  tenantId: "tenant-1",
  name: "No secrets in prompts",
  version: 1,
  status: "active",
  approvedBy: null,
  createdAt: "2026-10-25T00:00:00.000Z",
  rules: [
    {
      id: "rule-1",
      type: "content-filter",
      target: { kind: "global" },
      condition: { kind: "keyword", words: ["password", "secret"] },
      action: "deny",
      severity: "block",
    },
  ],
};

const context = {
  tenantId: "tenant-1",
  actorId: "agent-1",
  modelVersionId: "model-v1",
  agentId: "agent-1",
  timestamp: "2026-10-25T12:00:00.000Z",
  promptText: "Please print the admin password.",
  outputText: null,
  metadata: { tokensIn: null, tokensOut: null, latencyMs: null, confidence: null, finishReason: null, tags: [] },
  agentCapabilities: [],
  counters: { callsInWindow: 0, windowSeconds: 60, spendInWindow: 0, spendCurrency: "USD" },
};

console.log(evaluatePolicy(policy, context).overall); // "deny"
```

Cada biblioteca es una subruta del paquete: `@mcptoolshop/cognate/policy`, `/model-registry`, `/agent-identity`, `/prompt-store`, `/repomesh-bridge` y `/types`. Los ejemplos siguientes utilizan los nombres de los espacios de trabajo (`@cognate/policy` y siguientes), que son el mismo código.

### Ejecute el servidor HTTP desde este repositorio

`@cognate/node` no está en npm. Ejecútelo desde una copia (Node 22 o posterior, pnpm 10.28.2):

```bash
pnpm install
pnpm -r build
node scripts/make-tenant-root.mjs my-tenant
COGNATE_TENANT_ROOTS_PATH="$PWD/tenant-roots.json" node packages/node/dist/index.js
```

Luego, desde otra terminal, `curl http://127.0.0.1:4000/health` responde a `"status": "ok"`. `make-tenant-root.mjs` genera una nueva clave raíz aleatoria para el cliente: `tenant-roots.json` contiene la clave pública que lee el servidor, y `tenant-root.secret.json` contiene la semilla privada con la que se firma el primer delegado del cliente. Ambos nombres se encuentran en `.gitignore`. Mantenga `tenant-root.secret.json` fuera del repositorio y de cualquier imagen: el servidor solo necesita `tenant-roots.json`. El script hace que el archivo secreto sea legible solo para su propietario, en los casos en que la plataforma lo permita (en Windows, manténgalo en una carpeta a la que solo usted pueda acceder). La forma completa es `node scripts/make-tenant-root.mjs <tenantId> [outDir] [--force]`. El script se niega a reemplazar un `tenant-roots.json` o `tenant-root.secret.json` existente: no escribe nada y sale con el código `exists`. Pase `--force` solo para reemplazar ambos a propósito, ya que la semilla privada antigua no se puede recuperar. La firma de las solicitudes se explica en la [guía de migración](#guía-de-autenticación-y-migración).

### Desarrollo

```bash
pnpm install
pnpm verify        # build + test + typecheck
pnpm test:coverage # full coverage report
```

Registre una versión del modelo y luego ejecútela a través de su ciclo de vida. Una versión se mueve `registered → evaluated → approved → deployed` y puede ser `rejected` o `retired`. `transitionVersion` mueve una instantánea que posee el llamador. En el servidor HTTP, `approved → deployed` llama a `verifyRelease` en el `repo` y `release` registrados cuando se registró la versión. Una versión que no pasa no se implementa, y tampoco lo hace una solicitud que especifica una versión diferente. El rechazo se registra.

Las evaluaciones se adjuntan a una versión, tantas como tenga: una ejecución, su replicación, un resultado agrupado. **Registre una evaluación y luego realice la transición citándola.** `recordEvaluation` (o `attestEvaluation`, que también adjunta `cognate.evaluation.recorded`) nunca mueve la versión en sí, por lo que cada llamada es una adición. El `evaluationIds` de una transición especifica las evaluaciones en las que se basa la decisión. Cada una debe registrarse en esa versión, y los ID se vinculan al hash de la línea de tiempo de la transición. Una versión aprobada aún puede ser rechazada antes de su implementación. Si las transiciones deben citar es una configuración, `requireEvaluationCitations`: `false` (el valor predeterminado), `"decisions"` (la aprobación y el rechazo deben citar) o `"all"`. El servidor HTTP lo lee de `COGNATE_REQUIRE_EVALUATION_CITATIONS` y se niega a iniciarse con cualquier otro valor.

Pre-registre una ejecución antes de que se inicie y registre su resultado en el flujo `cognate-<tenant>-runs`. Los identificadores de nombres de cuenta (`ggufRepoSha256`, `hostedRepoSha256`, `repoSha256`, `ggufSourceSha256`, `hfRepoSha256`, `githubOwnerSha256`, `emailSha256`, `homePathSha256`) se almacenan solo como resúmenes hexadecimales en minúsculas de 64 caracteres SHA-256, y una ejecución registra su propio `cost` (`unitsSpent`, `rate`, `basis`) en lugar de los saldos de la cuenta.

```ts
import {
  createRegistry,
  registerModel,
  registerVersion,
  recordEvaluation,
  transitionVersion,
  preRegisterRun,
  recordRunOutcome,
  attestRunPreRegistered,
  attestRunCompleted,
} from "@cognate/model-registry";
```

---

## Docker

La imagen ejecuta `@cognate/node` y sirve la API de gobernanza.

**El servidor necesita un archivo de raíces de inquilino antes de iniciarse.** En el modo `enforce` predeterminado, se niega a iniciarse sin uno, y ninguna clave raíz se incluye en la imagen. Cree uno con `node scripts/make-tenant-root.mjs my-tenant` (vea [Guía de inicio rápido](#ejecute-el-servidor-http-desde-este-repositorio)), o escriba su propio JSON del formato `{ "version": 1, "roots": [{ "tenantId", "actorId", "publicKey", "kid" }] }`. El `docker-compose.yml` incluido establece `COGNATE_TENANT_ROOTS_PATH` en `/run/cognate/tenant-roots.json` y muestra el montaje como una línea de volumen comentada. Descomente esa línea con la ruta del host de su archivo, o agregue un `docker-compose.override.yml` junto a ella:

```yaml
services:
  cognate-node:
    volumes:
      - ./tenant-roots.json:/run/cognate/tenant-roots.json:ro
```

Sin el archivo, el servidor imprime una línea de error JSON en el formato de error de la API (`auth.missing-tenant-roots`, con una pista) y sale con el código 1. Establezca `COGNATE_DEBUG=1` para agregar la pila.

Una vez que se está ejecutando, `/health` devuelve:

```json
{ "status": "ok", "service": "cognate", "mode": "api", "serverTime": "2026-10-24T12:00:00.000Z" }
```

```bash
docker compose up -d
curl http://localhost:4000/health
docker compose down
```

El volumen `cognate-data` se monta en `/app/data`. El registro de eventos es `/app/data/events.jsonl`. Las instantáneas son `/app/data/cognate/registry.json`, `/app/data/cognate/agents.json` y `/app/data/cognate/prompts.json`. `GET /events/:eventId` lee ese registro y devuelve el evento registrado con una prueba de inclusión de Attestia y la raíz. El llamador envía los mismos encabezados firmados `cognate-request-v1` como una escritura. Un ID que no está en el registro de este inquilino es un error, y el cuerpo no tiene prueba. El texto de la solicitud y la salida permanecen fuera del evento. La ruta no llama a RepoMesh. La composición de Attestia utiliza la misma variable de registro de eventos en su propio volumen. Cada archivo tiene un escritor. La imagen de RepoMesh no monta este registro. `REPOMESH_FAIL_ON` tiene como valor predeterminado `unverified`: solo una versión PASS se implementa. Establézcalo en `fail` para permitir que se implemente una versión NO VERIFICADA. La imagen no establece una URL de libro mayor. La imagen se crea mediante el flujo de trabajo de lanzamiento a partir de una etiqueta `v*`, después de que el paquete npm se publica y se envía a `ghcr.io/mcp-tool-shop-org/cognate` como `X.Y.Z`, `X.Y` y `sha-*`. `latest` se mueve solo en una etiqueta `v*`.

---

## Guía de autenticación y migración

### Qué se aplica en la versión 1.0.0

- **Firma de solicitud Ed25519 (`cognate-request-v1`).** De forma predeterminada (`signedRequests: "enforce"`), cada `POST` y `GET /events/:eventId` debe incluir `X-Agent-Id`, `X-Timestamp`, `X-Nonce`, `X-Key-Id` y `X-Signature` en la cadena de solicitud canónica de 8 líneas (`cognate-request-v1\n<METHOD>\n<PATH>\n<BODY_SHA256>\n<X-Timestamp>\n<X-Nonce>\n<X-Agent-Id>\n<X-Key-Id>`). Los cuerpos `POST` deben ser JCS canónicos RFC 8785 UTF-8 (`400 auth.body-not-canonical` en caso contrario). `kid` es el SHA-256 hexadecimal en minúsculas de 64 caracteres de la clave pública Ed25519 de 32 bytes.
- **Protección contra la reproducción ordenada y autenticación uniforme 401.** `X-Timestamp` debe estar dentro de ±300 s del tiempo del servidor (`GET /health` expone `serverTime`). El almacén de reproducción en memoria comprueba `(agentId, nonce)` en modo de solo lectura antes de la verificación de la firma, lo registra solo después de que la firma se verifique y lo conserva durante todo el período de validez de 600 s. Cada fallo de autenticación previo a la firma devuelve un `401` idéntico con `code: "auth.unauthenticated"`.
- **Vinculación del agente (`403 auth.actor-mismatch`).** El agente en cada ruta (`transition.actorId`, `evaluation.evaluator`, `grant.requestedBy`, `grant.capability.grantedBy`, `approverId`, `agent.owner`, `prompt.agentId`, `model.owner`, `context.actorId`, `context.agentId` y `context.agentCapabilities`) está vinculado al firmante verificado antes de RepoMesh o cualquier evento adjunto.
- **Protecciones contra la escalada de privilegios y el arranque de la clave raíz.** El registro del agente (`POST /identity/agents`) y la aprobación de la concesión (`POST /identity/grants/:id/approve`) requieren una capacidad `delegate` activa. Se rechaza la autoaprobación (`403 auth.self-approval-forbidden`). Se rechazan los `agent.capabilities` preconfigurados, excepto cuando la clave pública raíz proporcionada por el operador del arrendatario (`tenantRootsPath` o `COGNATE_TENANT_ROOTS_PATH`) inicia el primer `delegate` del arrendatario. La raíz crea o aprueba un `delegate` directamente solo durante el arranque, mientras que el arrendatario no tiene ninguna `delegate` activa; por diseño, la raíz del arrendatario conserva sus capacidades de recuperación después del arranque (rota la clave de un principal humano o de agente, revoca cualquier principal, aprueba las concesiones no delegadas y la recuperación de una raíz comprometida implica reemplazarla en la configuración revisada y volver a firmar los agentes delegados del arrendatario). Rotar una clave transfiere la autoridad de ese principal a quien posea la nueva clave, y la raíz elige la nueva clave. Por lo tanto, después de que la raíz rote la clave de un delegado humano, la raíz tiene la autoridad de ese delegado, incluida la creación de nuevos delegados (registro de agentes y aprobación de `delegate` concesiones). Y si la raíz revoca todas las `delegate` activas, el arrendatario vuelve a no tener ninguna `delegate` activa, por lo que la raíz puede volver a crear una directamente. Una raíz derivada de una semilla de prueba nunca debe configurarse en producción. El servidor rechaza las propias claves raíz de prueba del repositorio al inicio (`auth.test-only-root-key-forbidden`), a menos que un conjunto de pruebas establezca `allowTestOnlyRoots: true`, pero no puede reconocer una raíz derivada de ninguna otra semilla conocida fuera del entorno de implementación. Ninguna clave raíz del arrendatario se incluye en el repositorio o en la imagen de Docker, y el servidor se niega a iniciarse en modo `enforce` sin las raíces proporcionadas por el operador (`auth.missing-tenant-roots`). Un principal de agente (`principal: "agent"`) no puede registrar un principal humano (`principal: "human"`) ni conceder `delegate`, y un `owner` no puede rotar la clave de un principal humano. La rotación de claves (`POST /identity/agents/:id/key`) y la revocación (`POST /identity/agents/:id/revoke`) invalidan inmediatamente las antiguas `kid`.

### Aún no, y límites actuales

- **Almacén de reproducción de una sola instancia.** El almacén de reproducción `(agentId, nonce)` se encuentra en la memoria de un único `@cognate/node` proceso; las implementaciones de múltiples instancias no comparten el estado de reproducción.
- **Las aprobaciones independientes, el flujo de identidad y la verificación sin conexión están planificadas para una versión posterior.** Hoy en día, cualquier acción que requiera una aprobación debe ser firmada directamente por el principal autorizador. Las aprobaciones `cognate-approval-v1` independientes (que permiten a un agente enviar una transición que contenga una firma humana separada), el consumo duradero `approvalId`, el flujo de eventos `cognate-<tenant>-identity` atestiguado, los campos de eventos `submittedBy` / `authorizedBy`, el verificador independiente sin conexión y el anclaje de la clave raíz RepoMesh no están incluidos en la versión 1.0.0.
- **Los ID son globales en todos los arrendatarios.** Registrar un ID que otro arrendatario ya tenga se rechaza como duplicado.

### Migración de agentes existentes a claves Ed25519

1. **Genere un par de claves Ed25519** utilizando `generateEd25519KeyPair()` desde `@cognate/node` (en este repositorio; `@cognate/node` no está en npm):
```ts
import { generateEd25519KeyPair, createSignedClient } from "@cognate/node";

const keyPair = generateEd25519KeyPair();
// keyPair.publicKey (clave bruta de 32 bytes de 43 caracteres base64url), keyPair.kid (hexadecimal de 64 caracteres sha256), keyPair.seedHex
```
2. **Configure las claves públicas raíz del arrendatario del operador e inicie el primer delegado del arrendatario** proporcionando un archivo de clave raíz JSON a través de `COGNATE_TENANT_ROOTS_PATH` (o `ServerContext.tenantRootsPath` / `ServerContext.tenantRoots`) y firmando `POST /identity/agents` con esa clave raíz del arrendatario mientras el arrendatario no tiene ninguna `delegate` activa (o inicialice el agente con `publicKey` y `kid` en `agents.json` antes del inicio). Las claves de prueba solo para pruebas que se encuentran en `packages/node/tests/fixtures/` se rechazan al inicio, a menos que `allowTestOnlyRoots: true` se establezca explícitamente.
3. **Firme las solicitudes con `createSignedClient` o `signHttpRequest`**:
```ts
const client = createSignedClient({
baseUrl: "http://127.0.0.1:4000",
agentId: "my-agent-id",
seedHex: keyPair.seedHex,
});
const res = await client.request("/registry/models", {
method: "POST",
body: { model },
});
```
`createSignedClient` estandariza los cuerpos JSON con JCS RFC 8785, firma cada solicitud y sincroniza automáticamente el desfase del reloj desde el `GET /health` `serverTime` y reintenta una vez si un reloj sesgado provoca un `401`.
4. **Ventana de migración opcional (`signedRequests: "log"`):** Para aceptar temporalmente solicitudes no `/identity/*` sin firmar mientras los llamantes migran, establezca `COGNATE_SIGNED_REQUESTS=log` y `COGNATE_SIGNED_REQUESTS_LOG_UNTIL=<RFC3339 UTC timestamp <= 14 days ahead>`. Los eventos registrados a partir de solicitudes sin firmar en modo `log` llevan `unsigned: true`.

---

## Modelo de amenazas

Cognate asume el siguiente modelo de amenazas:

1. **Punto final de inferencia comprometido.** Un atacante obtiene acceso a la API del modelo. Mitigación: todas las indicaciones y los resultados se registran con cargas útiles cifradas y valores hash de integridad SHA-256. La repetición es determinista.
2. **Agente malicioso o suplantación de la identidad del llamante.** Medidas de mitigación: cada operación de escritura HTTP y cada lectura de `/events/:eventId` se autentica mediante una firma Ed25519 (`cognate-request-v1`), una comprobación de la marca de tiempo (±300 segundos) y un almacenamiento de valores únicos (nonce) con una duración de 600 segundos; las capacidades tienen un plazo de validez, un ámbito limitado y pueden ser revocadas (`POST /identity/agents/:id/revoke`, `POST /identity/agents/:id/key`), y cada ruta vincula los campos del actor en su cuerpo a la entidad firmante verificada (`403 auth.actor-mismatch`). Límite: el almacenamiento de repeticiones se realiza en memoria para cada proceso, y las aprobaciones multipartidistas independientes (`cognate-approval-v1`) y la verificación de firmas de flujos de eventos fuera de línea no están incluidas en la versión 1.0.0.
3. **Manipulación del modelo de la cadena de suministro.** Los pesos o las configuraciones se intercambian después de la evaluación. Mitigación: el registro del modelo calcula los valores hash de los pesos, la configuración y el manifiesto en el momento del registro, y `ModelVersion.repo` se almacena como `sha256:<hex>`. Cualquier desviación invalida la versión.
4. **Elusión de la política mediante la inyección de indicaciones.** Una indicación maliciosa intenta sortear las reglas de contenido. Mitigación: la evaluación de la política es determinista, se basa en versiones y se ejecuta antes de la inferencia. Ninguna indicación se ejecuta sin pasar primero la comprobación de la política.
5. **Uso indebido de los registros de auditoría por parte de un usuario interno.** Un operador con privilegios manipula los registros. Mitigación: el almacén de eventos solo permite añadir datos y está respaldado por las pruebas de árbol de Merkle de Attestia. La manipulación rompe la cadena de hash.
6. **Acceso entre diferentes inquilinos en el servidor HTTP.** Un agente de un inquilino accede a los registros de otro inquilino. Solución: cada ruta actúa dentro del ámbito del inquilino del firmante autenticado. Se rechaza cualquier registro que haga referencia a otro inquilino, y el ID de otro inquilino se responde como inexistente.
7. **Una clave raíz de inquilino utilizada o configurada incorrectamente.** La clave raíz inicializa un inquilino y conserva las capacidades de recuperación. Solución: no se incluye ninguna clave raíz en el repositorio o la imagen; el servidor se niega a iniciarse en modo `enforce` sin las claves raíz proporcionadas por el operador, y rechaza las propias claves raíz de prueba del repositorio. Limitación: las capacidades de la clave raíz son amplias por diseño (véase arriba), por lo que el operador debe custodiar la clave raíz con el mismo cuidado que al propio inquilino, y la recuperación de una clave raíz comprometida implica reemplazarla en la configuración revisada.

No hay telemetría ni análisis. Al implementar en el servidor HTTP, se pregunta RepoMesh si la versión especificada es válida. La salud y las otras rutas permanecen en este proceso. Los informes de seguridad se envían a través de [SECURITY.md](SECURITY.md).

---

## Estado

Versión 1.0.0, en construcción y disponible públicamente. Todos los paquetes están implementados, probados y en construcción. Instale el paquete con `npm install @mcptoolshop/cognate`. Los nombres `@cognate/*` permanecen en este repositorio.

| Puerta de enlace | Estado |
|------|--------|
| Construcción | Superado |
| Pruebas | 316 pruebas superadas (nodo 147, registro de modelos 58, política 47, identidad de agente 29, almacén de indicaciones 24, puente repomesh 9, cognate 2) |
| Cobertura | Líneas: 94,3% en el nodo, 93,4% en la política, 99,6% en el registro de modelos y 100% en la identidad de agente, el almacén de indicaciones y el puente repomesh, con umbrales de cobertura de vitest en esos seis paquetes. |
| Verificación de tipos | Limpieza |
| Docker. | La imagen sirve la API de gobernanza. El volumen contiene el registro de eventos y las tres instantáneas. |
| Comprobación de envío | Manual, página de destino y metadatos del repositorio en esta versión. |

---

Creado por [mcp-tool-shop](https://mcp-tool-shop.github.io/)
