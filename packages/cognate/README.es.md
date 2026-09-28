<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.md">English</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/mcp-tool-shop-org/brand/main/logos/cognate/readme.png" alt="Cognate" width="400">
</p>

<p align="center"><strong>Gobernanza estructural para la inteligencia autónoma.</strong></p>

Cognate es la capa de gobernanza de la IA construida sobre [Attestia](https://github.com/mcp-tool-shop-org/attestia). Attestia demuestra que algo ocurrió: un evento, una transacción, una transición de estado, y vincula esa prueba a una cadena. Cognate utiliza los mismos principios de atestación para gobernar los sistemas de IA: qué se le permitió hacer a un modelo, qué hizo realmente y quién lo autorizó.

Donde Attestia atestigua la veracidad financiera, Cognate atestigua la veracidad de la IA: el linaje del modelo, las decisiones de política, las capacidades del agente y la integridad del mensaje/salida. Los mismos árboles de Merkle. El mismo almacén de eventos de solo anexión. Un dominio diferente.

## Instalación

```bash
npm install @mcptoolshop/cognate
```

Node 22 o posterior. Las cinco bibliotecas están en este paquete. Los nombres internos `@cognate/*` no se publican.

```ts
import { policy } from "@mcptoolshop/cognate";
import { evaluatePolicy } from "@mcptoolshop/cognate/policy";

const result = evaluatePolicy(policyDocument, context);
if (result.overall === "deny") {
  // do not call the model
}
```

| Importación | Qué es |
|--------|------------|
| `@mcptoolshop/cognate` | Espacios de nombres: `types`, `policy`, `modelRegistry`, `agentIdentity`, `promptStore` |
| `@mcptoolshop/cognate/policy` | `evaluatePolicy` |
| `@mcptoolshop/cognate/model-registry` | Versiones del modelo y la puerta de aprobación antes del despliegue |
| `@mcptoolshop/cognate/agent-identity` | Concesión de capacidades, aprobaciones, revocaciones |
| `@mcptoolshop/cognate/prompt-store` | Registro encriptado de mensajes y salidas de solo anexión |
| `@mcptoolshop/cognate/types` | Los sustantivos compartidos |

Estas son funciones puras. Se pasa el reloj, la clave del arrendatario y el almacén. Este paquete no abre un socket.

Manual: <https://mcp-tool-shop-org.github.io/cognate/handbook/>
