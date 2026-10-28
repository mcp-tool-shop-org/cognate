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

**Versión 1.1.0.** La versión 1.1.0 añade la selección de planes antes de que un agente actúe y hace que los tipos del paquete npm funcionen para los usuarios de TypeScript. No cambia nada en la API HTTP, el formato de solicitud firmada o el formato de eventos y atestación, por lo que un cliente de la versión 1.0.0 seguirá funcionando. Las versiones siguen la versión semántica: un cambio que rompa alguna de estas características vendrá con una nueva versión principal. Consulte [Qué hay de nuevo en la 1.1.0](#qué-hay-de-nuevo-en-la-110).

Cognate es la capa de gobernanza de la IA construida sobre [Attestia](https://github.com/mcp-tool-shop-org/attestia). Attestia demuestra que algo ocurrió: un evento, una transacción, una transición de estado, y vincula esa prueba a una cadena. Cognate utiliza los mismos primitivos de atestación para gobernar los sistemas de IA: qué se le permitió hacer a un modelo, qué hizo realmente y quién lo autorizó.

Cognate atestigua la verdad de la IA: linaje del modelo, decisiones de política, capacidades del agente e integridad de las indicaciones y los resultados. Las mismas pruebas de Merkle. El mismo almacén de eventos de solo anexión. Un dominio diferente.

Attestia, Cognate y RepoMesh son tres productos. Attestia implementa el dominio financiero (bóveda personal, tesorería de la organización, registro) sobre esos primitivos. RepoMesh es la red de lanzamiento: eventos firmados, manifiestos de nodos y un reloj de confianza anclado en XRPL, en su propio libro mayor RFC 6962. No utiliza el árbol de Merkle de Attestia. Cognate llama a Attestia cuando necesita una prueba y a RepoMesh cuando necesita que se verifique un lanzamiento. `@cognate/repomesh-bridge` es esa verificación.

---

## Qué hay de nuevo en la 1.1.0

- **Selección de plan, antes de que un agente actúe.** `@cognate/civility-kernel` (de npm, `@mcptoolshop/cognate/civility-kernel`) toma los planes candidatos de un agente, elimina los que infringen una restricción estricta, califica el resto según las ponderaciones de preferencia de la política y devuelve uno de tres resultados: `EXECUTE` (con el plan elegido), `ASK_USER` o `NO_VALID_PLAN`, con un registro del porqué. Es el primero de [dos pasos](#dos-etapas-elegir-un-plan-y-luego-controlar-cada-evento): el núcleo elige el plan y `@cognate/policy` sigue controlando cada evento mientras se ejecuta el plan.
- **Decisiones que se pueden registrar y probar.** `computeDecisionDigests` calcula el hash de una decisión en la forma en que se realiza un preregistro de ejecución (`planSha256`, `decisionSha256`), y `attestDecision` añade `cognate.policy.decided` al flujo de políticas del arrendatario, que `GET /events/:eventId` ya prueba. El evento contiene el resultado y las reglas que infringió cada plan rechazado, nunca los pasos del plan. Con un `decisionId` y un `timestamp`, las mismas entradas dan un registro idéntico byte a byte.
- **Tres correcciones hechas al núcleo al incorporarlo a Cognate.** Su caché de compilación se basa únicamente en la versión de la política, por lo que dos políticas con una versión, pero con ponderaciones diferentes, obtuvieron las mismas reglas (la caché ha desaparecido). Ahora se puede reproducir una decisión. Y un plan fallido obtiene una puntuación de `null` en lugar de menos infinito, por lo que un registro sobrevive a un ciclo de JSON.
- **Tipos que se resuelven desde npm.** Las declaraciones de tipo del paquete 1.0.0 apuntaban a paquetes de espacio de trabajo que no están en npm, por lo que un proyecto TypeScript obtuvo tipos no resueltos en cada subruta. La versión 1.1.0 incluye esas declaraciones dentro del paquete, y CI instala el paquete en un proyecto vacío y realiza una verificación de tipos en una importación de cada entrada.

La lista completa está en [CHANGELOG.md](CHANGELOG.md).

### Qué se incluyó en la 1.0.0

- **Registros de ejecución.** `@cognate/model-registry` preregistra una ejecución antes de lanzarla y registra su resultado en el flujo `cognate-<tenant>-runs`. Los identificadores de nomenclatura de cuentas se almacenan solo como resúmenes SHA-256, y una ejecución registra su propio costo, nunca el saldo de una cuenta.
- **Evaluaciones.** Una versión del modelo contiene cualquier número de evaluaciones (una ejecución, su replicación, un resultado agrupado), y una transición cita las evaluaciones en las que se basa. `requireEvaluationCitations` establece qué transiciones deben citar. Se puede rechazar una versión aprobada antes de que se implemente.
- **Ámbito del arrendatario.** Cada ruta en `@cognate/node` actúa en el ámbito del arrendatario que realiza la llamada. Se rechaza un registro que nombra a otro arrendatario, y la identificación de otro arrendatario obtiene la misma respuesta que una identificación faltante. Ahora, una identificación faltante es 404, no 400.
- **Solicitudes firmadas (cambio importante).** Cada escritura y cada `GET /events/:eventId` deben estar firmadas con la clave Ed25519 del llamador (`cognate-request-v1`), con una ventana de marca de tiempo y protección contra reproducción. El actor en cada ruta es el firmante verificado. El registro de agentes y la aprobación de subvenciones requieren una capacidad `delegate`, y una clave raíz de arrendatario proporcionada por el operador inicia el primer delegado de cada arrendatario. Consulte [Guía de autenticación y migración](#guía-de-autenticación-y-migración).
- **Los poderes de la clave raíz, en palabras sencillas.** La documentación enumera todo lo que la raíz del arrendatario aún puede hacer después del inicio, y dice que una raíz derivada de una semilla de prueba nunca debe configurarse en producción.
- **Herramientas de prueba.** vitest 4.1.12 y vite 8.3.5; se eliminan los avisos de alta y crítica en el árbol de desarrollo en la raíz, sin ignorar ni anular.

---

## Misión

Creemos que, a medida que los sistemas de IA adquieren autonomía, las estructuras que los gobiernan deben adquirir rigor. Los contratos inteligentes se ejecutan. Los modelos infieren. Pero nadie *atestigua* lo que se le permitió hacer a la IA, lo que realmente hizo y si un humano lo aprobó.

Cognate es la capa que falta: registro de modelos, aplicación de políticas, identidad de agentes y auditoría determinista, todo ello unificado en modelos, organizaciones y cadenas.

### Nuestros principios

- **La verdad por encima de la velocidad.** Cada inferencia del modelo es de solo anexión, reproducible y conciliable. Si no se puede probar, no sucedió.
- **Los humanos aprueban; las máquinas verifican.** La IA asesora, los modelos infieren, pero nada se implementa ni actúa sin la autorización explícita de un humano. Nunca.
- **Gobernanza estructural, no gobernanza política.** No votamos sobre lo que es válido. Definimos invariantes que se mantienen incondicionalmente: la identidad del modelo es explícita, el linaje es ininterrumpido y la versión de la política es monótona.
- **La intención no es la ejecución.** Declarar lo que debe hacer un agente y permitirle actuar son actos separados con puertas de enlace separadas. La brecha entre ellos es donde reside la confianza.
- **Los modelos son testigos, no autoridades.** Attestia atestigua. Las cadenas resuelven. Pero la autoridad fluye de las reglas estructurales, no de los pesos de ningún modelo.

---

## Arquitectura

Cognate consume primitivas de Attestia y añade una capa de dominio nativa de IA. Los paquetes son funciones puras. Los llamantes proporcionan el estado. Nada aquí abre un socket, escribe un archivo o lee un reloj a menos que se le proporcione el valor.

| Paquete | Propósito | Estado |
|---------|---------|--------|
| @cognate/types | Tipos de dominio de gobernanza de IA compartidos (sin dependencias) | Listo |
| @cognate/policy | Motor de evaluación de políticas semánticas | Listo |
| @cognate/civility-kernel | Selección de plan: filtrar planes candidatos por restricciones estrictas, calificarlos por pesos de preferencia y luego ejecutar o preguntar | Listo (nuevo en la versión 1.1.0) |
| @cognate/model-registry | Ciclo de vida del modelo, control de versiones, evaluación | Listo |
| @cognate/agent-identity | Identidad del agente, capacidades, permisos | Listo |
| @cognate/prompt-store | Registro de indicaciones/salidas con eventos cifrados | Listo |
| @cognate/repomesh-bridge | Verificación de la versión RepoMesh (`verifyRelease`) antes de un despliegue | Listo |
| @cognate/node | Servidor de API HTTP en el puerto 4000, con solicitudes firmadas y alcance del inquilino | Listo |

`@mcptoolshop/cognate` en npm agrupa las bibliotecas, con sus declaraciones de tipo en su interior. `@cognate/node` se ejecuta en la imagen de Docker.

### Dos etapas: elegir un plan y luego controlar cada evento

Cognate gobierna a un agente en dos puntos.

1. **Antes de que actúe, `@cognate/civility-kernel` elige entre los planes.** El agente propone planes candidatos. Las restricciones estrictas eliminan los que infringen una regla (un cambio irreversible, un gasto que supera un límite). Los que sobreviven se califican según los pesos de preferencia de la política. El mejor plan se ejecuta, a menos que su incertidumbre supere el umbral de la política: entonces el agente pregunta. Si ningún plan sobrevive, el agente le pide a la persona que relaje una restricción u ofrezca otra opción.
2. **Mientras actúa, `@cognate/policy` controla cada evento.** Cada indicación, salida o gasto se verifica con las reglas del inquilino (filtros de contenido, límites de frecuencia y gasto, capacidades), y, de las reglas que coinciden, prevalece la más estricta.

Se puede registrar y generar un hash de una decisión. `attestDecision` añade `cognate.policy.decided` al flujo de políticas del inquilino,
llevando resúmenes y el esquema de la decisión, nunca los pasos del plan. `computeDecisionDigests` proporciona el `planSha256` y
`decisionSha256` que una preinscripción de ejecución (`preRegisterRun`) solicita. Pasar `decisionId` y `timestamp` y los mismos
entradas producen un registro idéntico.

```js
import { createKernel, computeDecisionDigests } from "@mcptoolshop/cognate/civility-kernel";

const kernel = createKernel({
  policy: {
    version: "1.0",
    weights: { efficiency: 0.3, low_risk: 0.7 },
    constraints: ["no_irreversible_changes"],
    contextRules: [],
    uncertaintyThreshold: 0.4,
    memory: {},
    calibration: { riskTolerance: 0.3, verbosity: 0.5, initiative: 0.5 },
  },
});

const plans = [
  { id: "drop-and-reload", summary: "Drop the table and reload it", steps: [], meta: { reversibility: 0, estimatedTimeSec: 30 } },
  { id: "migrate-with-backup", summary: "Back up, then migrate", steps: [], meta: { reversibility: 1, estimatedTimeSec: 300, stake: 0.2 } },
];

const trace = kernel.decide("deploy:db", plans, { decisionId: "dec-1", timestamp: "2026-10-28T12:00:00.000Z" });
console.log(trace.outcome, trace.chosenPlanId); // "EXECUTE migrate-with-backup"

const { planSha256, decisionSha256 } = computeDecisionDigests(trace, plans[1]);
console.log(planSha256.length, decisionSha256.length); // 64 64
```

Los cambios en las políticas se realizan a través del propio ciclo del kernel, con un humano que aprueba cada paso: `proposePolicyUpdates` a partir de
la retroalimentación, luego `diffPolicy`, `lintPolicy` y `explainPolicy` antes de que se aplique el cambio.

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
| Registros de solo adición | Sin ACTUALIZACIÓN, sin ELIMINAR: solo nuevas entradas |
| Fallo seguro | El desacuerdo de la política detiene el sistema, nunca se corrige en silencio |
| Reproducción determinista | Los mismos eventos producen el mismo estado, siempre |
| Controles de aprobación humana | Ningún modelo se implementa, ningún cambio de política, ningún permiso de capacidad sin una aprobación explícita |
| Indicaciones cifradas | AES-256-GCM con clave de inquilino para la privacidad; hash SHA-256 para la integridad |
| Identidad estructural | Explícita, inmutable, única: para modelos, agentes y políticas |

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

Cada biblioteca es una subruta del paquete: `@mcptoolshop/cognate/policy`, `/civility-kernel`, `/model-registry`, `/agent-identity`, `/prompt-store`, `/repomesh-bridge` y `/types`. Los ejemplos siguientes utilizan los nombres de los espacios de trabajo (`@cognate/policy` y así sucesivamente), que son el mismo código.

### Ejecute el servidor HTTP desde este repositorio

`@cognate/node` no está en npm. Ejecútelo desde un clon (Node 22 o posterior, pnpm 10.28.2):

```bash
pnpm install
pnpm -r build
node scripts/make-tenant-root.mjs my-tenant
COGNATE_TENANT_ROOTS_PATH="$PWD/tenant-roots.json" node packages/node/dist/index.js
```

Luego, desde otra terminal, `curl http://127.0.0.1:4000/health` responde a `"status": "ok"`. `make-tenant-root.mjs` crea una nueva clave raíz aleatoria para el inquilino: `tenant-roots.json` contiene la clave pública que lee el servidor, y `tenant-root.secret.json` contiene la semilla privada con la que firma el primer delegado del inquilino. Ambos nombres están en `.gitignore`. Mantenga `tenant-root.secret.json` fuera del repositorio y fuera de cualquier imagen: el servidor solo necesita `tenant-roots.json`. El script hace que el archivo secreto sea legible solo por su propietario donde la plataforma lo admita (en Windows, manténgalo en una carpeta a la que solo usted pueda acceder). La forma completa es `node scripts/make-tenant-root.mjs <tenantId> [outDir] [--force]`. El script se niega a reemplazar un `tenant-roots.json` o `tenant-root.secret.json` existente: no escribe nada y sale con el código `exists`. Pase `--force` solo para reemplazar ambos a propósito, porque la semilla privada antigua no se puede recuperar. La firma de las solicitudes se trata en la [guía de migración](#guía-de-autenticación-y-migración).

### Desarrollo

```bash
pnpm install
pnpm verify        # build + test + typecheck
pnpm test:coverage # full coverage report
```

Registre una versión del modelo y luego ejecútela a través del ciclo de vida. Una versión se mueve `registered → evaluated → approved → deployed` y puede ser `rejected` o `retired`. `transitionVersion` mueve una instantánea que el llamante tiene. En el servidor HTTP, `approved → deployed` llama a `verifyRelease` en el `repo` y `release` registrados cuando se registró la versión. Una versión que no pasa no se implementa, y tampoco lo hace una solicitud que nombra una versión diferente. El rechazo se registra.

Las evaluaciones se adjuntan a una versión, tantas como tenga: una ejecución, su replicación, un resultado combinado. **Registre una evaluación y, a continuación, realice una transición citándola.** `recordEvaluation` (o `attestEvaluation`, que también agrega `cognate.evaluation.recorded`) nunca modifica la versión en sí, por lo que cada llamada es una adición. El `evaluationIds` de una transición indica las evaluaciones en las que se basa la decisión. Cada una debe registrarse en esa versión, y los ID se vinculan al hash de la línea de tiempo de la transición. Una versión aprobada aún puede rechazarse antes de su implementación. Si las transiciones deben citar es una configuración: `requireEvaluationCitations`: `false` (el valor predeterminado), `"decisions"` (la aprobación y el rechazo deben citar) o `"all"`. El servidor HTTP lo lee de `COGNATE_REQUIRE_EVALUATION_CITATIONS` y se niega a iniciarse con cualquier otro valor.

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

La imagen ejecuta `@cognate/node` y proporciona la API de gobernanza.

**El servidor necesita un archivo de raíces de inquilino antes de iniciarse.** En el modo `enforce` predeterminado, se niega a iniciarse sin él, y no se incluye ninguna clave raíz en la imagen. Cree uno con `node scripts/make-tenant-root.mjs my-tenant` (consulte [Guía de inicio rápido](#ejecute-el-servidor-http-desde-este-repositorio)), o escriba su propio JSON con el formato `{ "version": 1, "roots": [{ "tenantId", "actorId", "publicKey", "kid" }] }`. El `docker-compose.yml` incluido establece `COGNATE_TENANT_ROOTS_PATH` en `/run/cognate/tenant-roots.json` y muestra el montaje como una línea de volumen comentada. Descomente esa línea con la ruta del host de su archivo, o agregue un `docker-compose.override.yml` junto a ella:

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

El volumen `cognate-data` se monta en `/app/data`. El registro de eventos es `/app/data/events.jsonl`. Las instantáneas son `/app/data/cognate/registry.json`, `/app/data/cognate/agents.json` y `/app/data/cognate/prompts.json`. `GET /events/:eventId` lee ese registro y devuelve el evento registrado con una prueba de inclusión de Attestia y la raíz. El llamante envía los mismos encabezados firmados `cognate-request-v1` que en una escritura. Un ID que no está en el registro de este inquilino es un error, y el cuerpo no tiene ninguna prueba. El texto de la solicitud y la salida no se incluyen en el evento. La ruta no llama a RepoMesh. La composición de Attestia utiliza la misma variable de registro de eventos en su propio volumen. Cada archivo tiene un escritor. La imagen de RepoMesh no monta este registro. `REPOMESH_FAIL_ON` tiene como valor predeterminado `unverified`: solo se implementa un PASS. Establézcalo en `fail` para permitir una versión NO VERIFICADA. La imagen no establece una URL de libro mayor. La imagen se crea mediante el flujo de trabajo de lanzamiento a partir de una etiqueta `v*`, después de que se publica el paquete npm y se envía a `ghcr.io/mcp-tool-shop-org/cognate` como `X.Y.Z`, `X.Y` y `sha-*`. `latest` solo se mueve con una etiqueta `v*`.

---

## Guía de autenticación y migración

### Lo que se aplica en 1.1.0 (sin cambios desde 1.0.0)

- **Firma de la solicitud Ed25519 (`cognate-request-v1`).** De forma predeterminada (`signedRequests: "enforce"`), cada solicitud `POST` y `GET /events/:eventId` debe incluir `X-Agent-Id`, `X-Timestamp`, `X-Nonce`, `X-Key-Id` y `X-Signature` en la cadena de solicitud canónica de 8 líneas (`cognate-request-v1\n<METHOD>\n<PATH>\n<BODY_SHA256>\n<X-Timestamp>\n<X-Nonce>\n<X-Agent-Id>\n<X-Key-Id>`). Los cuerpos `POST` deben ser JCS canónicos RFC 8785 UTF-8 (`400 auth.body-not-canonical` en caso contrario). `kid` es el resumen hexadecimal en minúsculas de 64 caracteres SHA-256 de la clave pública de 32 bytes sin procesar Ed25519.
- **Protección contra reproducción ordenada y 401 uniforme.** `X-Timestamp` debe estar dentro de ±300 s del tiempo del servidor (`GET /health` expone `serverTime`). El almacén de reproducción en memoria comprueba `(agentId, nonce)` en modo de solo lectura antes de la verificación de la firma, lo registra solo después de que la firma se verifica y lo conserva durante todo el período de validez de 600 s. Cada error de autenticación anterior a la firma devuelve un `401` idéntico con `code: "auth.unauthenticated"`.
- **Vinculación de actores (`403 auth.actor-mismatch`).** El actor en cada ruta (`transition.actorId`, `evaluation.evaluator`, `grant.requestedBy`, `grant.capability.grantedBy`, `approverId`, `agent.owner`, `prompt.agentId`, `model.owner`, `context.actorId`, `context.agentId` y `context.agentCapabilities`) se vincula al firmante verificado antes de RepoMesh o cualquier adición de evento.
- **Protecciones contra la escalada de privilegios y el arranque de la clave raíz.** El registro de agentes (`POST /identity/agents`) y la aprobación de concesiones (`POST /identity/grants/:id/approve`) requieren una capacidad `delegate` activa. Se rechaza la autoaprobación (`403 auth.self-approval-forbidden`). Se rechazan los `agent.capabilities` pre-poblados, excepto cuando la clave pública raíz suministrada por el operador del inquilino (`tenantRootsPath` o `COGNATE_TENANT_ROOTS_PATH`) inicia la primera `delegate` del inquilino. La raíz crea o aprueba una `delegate` directamente solo durante el arranque, mientras que el inquilino no tiene ninguna `delegate` activa; por diseño, la raíz del inquilino conserva sus poderes de recuperación después del arranque (rota la clave de un principal humano o agente, revoca cualquier principal y aprueba las concesiones no delegadas, y la recuperación de una raíz comprometida implica reemplazarla en la configuración revisada y volver a firmar los agentes delegados del inquilino). La rotación de una clave transfiere la autoridad de ese principal a quien posea la nueva clave, y la raíz elige la nueva clave. Por lo tanto, después de que la raíz rota la clave de un delegado humano, la raíz posee la autoridad de ese delegado, incluida la creación de nuevos delegados (registro de agentes y aprobación de `delegate` concesiones). Y si la raíz revoca todas las `delegate` activas, el inquilino vuelve a no tener ninguna `delegate` activa, por lo que la raíz puede volver a crear una directamente. Una raíz derivada de una semilla de prueba nunca debe configurarse en producción. El servidor rechaza las propias claves raíz de prueba del repositorio al inicio (`auth.test-only-root-key-forbidden`) a menos que un conjunto de pruebas establezca `allowTestOnlyRoots: true`, pero no puede reconocer una raíz derivada de cualquier otra semilla conocida fuera del despliegue. Ninguna clave raíz de inquilino se incluye en el repositorio o en la imagen de Docker, y el servidor se niega a iniciarse en modo `enforce` sin las raíces suministradas por el operador (`auth.missing-tenant-roots`). Un principal de agente (`principal: "agent"`) no puede registrar un principal humano (`principal: "human"`) ni conceder `delegate`, y un `owner` no puede rotar la clave de un principal humano. La rotación de claves (`POST /identity/agents/:id/key`) y la revocación (`POST /identity/agents/:id/revoke`) invalidan inmediatamente las `kid` antiguas.

### Todavía no, y límites actuales

- **Almacén de reproducción de una sola instancia.** El almacén de reproducción `(agentId, nonce)` se encuentra en la memoria de un único `@cognate/node` proceso; las implementaciones de múltiples instancias no comparten el estado de reproducción.
- **Se planean aprobaciones independientes, flujo de identidad y verificación fuera de línea para una versión posterior.** Hoy en día, cualquier acción sujeta a aprobación debe ser firmada directamente por el responsable de la autorización. Las aprobaciones `cognate-approval-v1` independientes (que permiten a un agente enviar una transición que contenga una firma humana separada), el consumo duradero `approvalId`, el flujo de eventos autenticado `cognate-<tenant>-identity`, los campos de eventos `submittedBy` / `authorizedBy`, el verificador independiente fuera de línea y el anclaje de la clave raíz RepoMesh no están incluidos en la versión 1.1.0.
- **Los ID son globales para todos los inquilinos.** Registrar un ID que ya esté en uso por otro inquilino se rechaza como duplicado.

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

1. **Punto final de inferencia comprometido.** Un atacante obtiene acceso a la API del modelo. Mitigación: todas las indicaciones y salidas se registran con cargas útiles cifradas y hashes de integridad SHA-256. La reproducción es determinista.
2. **Agente malicioso o identidad de llamante falsificada.** Mitigación: cada escritura HTTP y lectura `/events/:eventId` se autentica con una firma Ed25519 (`cognate-request-v1`), comprobación de marca de tiempo de ±300 s y almacén de reproducción de 600 s; las capacidades tienen una duración limitada, un alcance limitado y son revocables (`POST /identity/agents/:id/revoke`, `POST /identity/agents/:id/key`), y cada ruta vincula sus campos de actor del cuerpo al firmante verificado (`403 auth.actor-mismatch`). Limitación: el almacén de reproducción se encuentra en la memoria por proceso, y las aprobaciones independientes de múltiples partes (`cognate-approval-v1`) y la verificación de la firma del flujo de eventos fuera de línea no están incluidas en la versión 1.1.0.
3. **Manipulación del modelo de la cadena de suministro.** Los pesos o las configuraciones se intercambian después de la evaluación. Mitigación: el registro del modelo calcula los hashes de los pesos, la configuración y el manifiesto en el registro, y `ModelVersion.repo` se almacena como `sha256:<hex>`. Cualquier desviación invalida la versión.
4. **Omisión de la política mediante la inyección de indicaciones.** Una indicación adversaria intenta eludir las reglas de contenido. Mitigación: la evaluación de la política es determinista, tiene versiones y se ejecuta antes de la inferencia. Ninguna indicación se ejecuta sin una comprobación de política aprobatoria.
5. **Abuso interno de los registros de auditoría.** Un operador con privilegios manipula los registros. Mitigación: el almacén de eventos solo permite anexos y está respaldado por las pruebas de árbol de Merkle de Attestia. La manipulación rompe la cadena de hash.
6. **Acceso entre inquilinos en el servidor HTTP.** Un agente de un inquilino accede a los registros de otro inquilino. Mitigación: cada ruta actúa en el inquilino del firmante autenticado. Se rechaza un registro que haga referencia a otro inquilino, y se responde que el ID de otro inquilino no está disponible.
7. **Uso indebido o configuración incorrecta de la clave raíz del inquilino.** La clave raíz inicializa un inquilino y conserva los poderes de recuperación posteriormente. Mitigación: ninguna clave raíz se incluye en el repositorio o en la imagen, el servidor se niega a iniciarse en modo `enforce` sin las raíces proporcionadas por el operador, y se niega las propias claves raíz de prueba del repositorio. Limitación: los poderes de la raíz son amplios por diseño (consulte lo anterior), por lo que el operador debe guardar la clave raíz con el mismo cuidado que el propio inquilino, y la recuperación de una raíz comprometida implica reemplazarla en la configuración revisada.

No hay telemetría ni análisis. Una implementación en el servidor HTTP pregunta a RepoMesh si la versión especificada pasa. La salud y las otras rutas permanecen en este proceso. Los informes de seguridad se envían a través de [SECURITY.md](SECURITY.md).

---

## Estado

Versión 1.1.0, en construcción para el público. Todos los paquetes están implementados, probados y en construcción. Instale el paquete con `npm install @mcptoolshop/cognate`. Los `@cognate/*` nombres permanecen en este repositorio.

| Puerta de enlace | Estado |
|------|--------|
| Construcción | Aprobación |
| Pruebas | 490 aprobadas (civility-kernel 164, node 157, model-registry 58, policy 47, agent-identity 29, prompt-store 24, repomesh-bridge 9, cognate 2) |
| Cobertura | Líneas: 91,9 % en civility-kernel, 94,3 % en node, 93,4 % en policy, 99,6 % en model-registry, y 100 % en agent-identity, prompt-store y repomesh-bridge, con un umbral de líneas de vitest de 90 o superior en cada uno de esos siete paquetes |
| Verificación de tipos | Limpio, y el paquete empaquetado verifica los tipos en un proyecto vacío bajo la resolución `bundler` y `node16` |
| Docker | La imagen sirve la API de gobernanza. El volumen contiene el registro de eventos y las tres instantáneas |
| Comprobación de envío | Todas las puertas obligatorias pasan (16/16 comprobado) |

---

Construido por [mcp-tool-shop](https://mcp-tool-shop.github.io/)
