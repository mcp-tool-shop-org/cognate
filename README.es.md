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

Cognate es la capa de gobernanza de la IA construida sobre [Attestia](https://github.com/mcp-tool-shop-org/attestia). Attestia demuestra que algo ocurrió —un evento, una transacción, una transición de estado— y vincula esa prueba a una cadena. Cognate utiliza los mismos principios de certificación para gobernar los sistemas de IA: qué se le permitió hacer a un modelo, qué hizo realmente y quién lo autorizó.

Mientras que Attestia certifica la veracidad financiera, Cognate certifica la veracidad de la IA: el linaje del modelo, las decisiones de política, las capacidades del agente y la integridad del mensaje/resultado. Los mismos árboles de Merkle. El mismo almacén de eventos de solo adición. Un dominio diferente.

---

## Misión

Creemos que, a medida que los sistemas de IA adquieren autonomía, las estructuras que los gobiernan deben volverse más rigurosas. Los contratos inteligentes se ejecutan. Los modelos infieren. Pero nadie *atestigua* lo que se permitió que la IA hiciera, lo que realmente hizo y si un humano lo aprobó.

Cognate es la capa que faltaba: registro de modelos, aplicación de políticas, identidad de agentes y auditoría determinista, todo ello unificado en modelos, organizaciones y cadenas.

### Lo que defendemos

- **La verdad por encima de la velocidad.** Cada inferencia de modelo es de solo agregado, reproducible y conciliable. Si no se puede demostrar, no sucedió.
- **Los humanos aprueban; las máquinas verifican.** La IA asesora, los modelos infieren, pero nada se implementa ni actúa sin una autorización humana explícita. Nunca.
- **Gobernanza estructural, no gobernanza política.** No votamos sobre lo que es válido. Definimos invariantes que se cumplen incondicionalmente: la identidad del modelo es explícita, la línea de descendencia es ininterrumpida y la versión de la política es monótona.
- **La intención no es la ejecución.** Declarar lo que un agente debe hacer y permitirle actuar son actos separados con puertas de enlace separadas. La brecha entre ellos es donde reside la confianza.
- **Los modelos son testigos, no autoridades.** Attestia atestigua. Las cadenas se encargan de la resolución. Pero la autoridad proviene de las reglas estructurales, no de los pesos de ningún modelo.

---

## Arquitectura

Cognate consume los primitivos de Attestia y agrega una capa de dominio nativa de la IA. Los paquetes son funciones puras. Los llamantes proporcionan el estado. Nada aquí abre un socket, escribe un archivo o lee un reloj a menos que le proporcione el valor.

| Paquete | Propósito | Estado |
|---------|---------|--------|
| @cognate/types | Tipos de dominio de gobernanza de IA compartidos (cero dependencias) | Listo |
| @cognate/policy | Motor de evaluación de políticas semánticas | Listo |
| @cognate/model-registry | Ciclo de vida del modelo, versiones, evaluación | Listo |
| @cognate/agent-identity | Identidad del agente, capacidades, permisos | Listo |
| @cognate/prompt-store | Registro de solicitudes/resultados con eventos cifrados | Listo |

### Alineación regulatoria

| Regulación | Cognate cumple con |
|------------|-------------------|
| Artículo 12 de la Ley de IA de la UE | Registro de eventos de solo agregado durante toda la vida útil del sistema |
| Artículo 14(5) de la Ley de IA de la UE | Identificación de personas físicas en la verificación |
| NIST AI RMF | Funciones de gobernanza, mapeo, medición y gestión |
| ISO/IEC 42001 | Requisitos del sistema de gestión de la IA |

---

## Principios

| Principio | Implementación |
|-----------|---------------|
| Registros de solo agregado | Sin ACTUALIZACIÓN, sin ELIMINACIÓN, solo nuevas entradas |
| Fallo seguro | El desacuerdo de la política detiene el sistema, nunca se corrige en silencio |
| Reproducción determinista | Los mismos eventos producen el mismo estado, siempre |
| Puertas de enlace de aprobación humana | Ningún modelo se implementa, ninguna política cambia, ningún permiso se otorga sin una aprobación explícita |
| Solicitudes cifradas | AES-256-GCM con clave de inquilino para la privacidad; hash SHA-256 para la integridad |
| Identidad estructural | Explícita, inmutable, única: para modelos, agentes y políticas |

---

## Comienzo rápido

```bash
pnpm install
pnpm verify        # build + test + typecheck
pnpm test:coverage # full coverage report
```

Evalúe una política. El motor no recupera el estado. Usted proporciona la política y el contexto.

```ts
import { evaluatePolicy } from "@cognate/policy";

const result = evaluatePolicy(policy, context);
if (result.overall === "deny") {
  // block the request
}
```

Registre una versión del modelo y luego haga que recorra el ciclo de vida. Una versión se mueve a `registered → evaluated → approved → deployed`, y puede ser `rejected` o `retired`. La implementación aún requiere una aprobación registrada en la versión.

```ts
import { createRegistry, registerModel, registerVersion, transitionVersion } from "@cognate/model-registry";
```

---

## Docker

La imagen publicada construye los cinco paquetes y sirve un punto final de estado. La API HTTP de gobernanza aún no está en esta imagen. `/health` responde para que se pueda supervisar el contenedor mientras ese servicio aún está en desarrollo.

```bash
docker compose up -d
curl http://localhost:4000/health
docker compose down
```

`/health` devuelve:

```json
{ "status": "ok", "service": "cognate", "mode": "placeholder" }
```

Compose mantiene los datos de solicitud y agente en el volumen `cognate-data`, montado en `/app/data`. La imagen se publica en GHCR cuando se publica una versión de GitHub.

---

## Modelo de amenazas

Cognate asume el siguiente modelo de amenazas:

1. **Punto final de inferencia comprometido.** Un atacante obtiene acceso a la API del modelo. Mitigación: todas las solicitudes y resultados se registran con cargas útiles cifradas y hashes de integridad SHA-256. La reproducción es determinista.
2. **Agente deshonesto con credenciales robadas.** Las claves de un agente se filtran. Mitigación: las capacidades tienen un tiempo limitado, un alcance limitado y son revocables. Cada permiso requiere una aprobación explícita.
3. **Manipulación del modelo de la cadena de suministro.** Los pesos o las configuraciones se intercambian después de la evaluación. Mitigación: el registro de modelos hace un hash de los pesos, la configuración y el manifiesto en el registro. Cualquier desviación invalida la versión.
4. **Omisión de la política mediante la inyección de solicitudes.** Una solicitud adversaria intenta eludir las reglas de contenido. Mitigación: la evaluación de la política es determinista, tiene versiones y se ejecuta antes de la inferencia. Ninguna solicitud se ejecuta sin una verificación de política aprobatoria.
5. **Abuso interno de los registros de auditoría.** Un operador con privilegios manipula los registros. Mitigación: el almacén de eventos es de solo agregado y está respaldado por las pruebas de árbol de Merkle de Attestia. La manipulación rompe la cadena hash.

De forma predeterminada, no se realizan telemetría, análisis ni llamadas de red salientes.

---

## Estado

Desarrollando en un entorno público. Todos los paquetes principales están implementados, probados y en proceso de compilación. Instale el paquete con `npm install @mcptoolshop/cognate`. Los nombres de `@cognate/*` se mantienen en este repositorio.

| Puerta de enlace | Estado |
|------|--------|
| Construir | Pasando |
| Pruebas | 72 aprobadas |
| Cobertura | Más del 90 % en cuanto a la política |
| Verificación de tipos | Limpieza |
| Docker | Se crean imágenes. El punto final de estado es un marcador de posición |
| Verificación de envío | Manual, página de destino y metadatos del repositorio en esta versión |

---

Creado por [MCP Tool Shop](https://mcp-tool-shop.github.io/)
