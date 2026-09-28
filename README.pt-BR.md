<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.md">English</a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/mcp-tool-shop-org/brand/main/logos/cognate/readme.png" alt="Cognate" width="400">
</p>

<p align="center">
  <a href="https://github.com/mcp-tool-shop-org/cognate/actions/workflows/ci.yml"><img src="https://github.com/mcp-tool-shop-org/cognate/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://mcp-tool-shop-org.github.io/cognate/"><img src="https://img.shields.io/badge/Landing_Page-live-blue" alt="Landing Page"></a>
  <a href="https://opensource.org/license/mit/"><img src="https://img.shields.io/badge/License-MIT-yellow" alt="MIT License"></a>
</p>

<p align="center"><strong>Governança estrutural para inteligência autônoma.</strong></p>

Cognate é a camada de governança de IA construída sobre os primitivos de atestação do [Attestia](https://github.com/mcp-tool-shop-org/attestia). Onde o Attestia comprova a veracidade financeira, o Cognate comprova a veracidade da IA: cada versão do modelo, cada prompt, cada saída, cada decisão de política — tudo atestado, imutável e governado por humanos.

---

## Missão

Acreditamos que, à medida que os sistemas de IA ganham autonomia, as estruturas que os governam devem ganhar rigor. Os contratos inteligentes são executados. Os modelos fazem inferências. Mas ninguém *atesta* o que a IA foi autorizada a fazer, o que ela realmente fez e se um humano aprovou.

Cognate é a camada que faltava: registro de modelos, aplicação de políticas, identidade de agentes e auditoria determinística — tudo unificado em modelos, organizações e cadeias.

### O que defendemos

- **Verdade acima da velocidade.** Cada inferência de modelo é apenas anexada, reproduzível e reconciliável. Se não puder ser comprovado, não aconteceu.
- **Humanos aprovam; máquinas verificam.** A IA aconselha, os modelos fazem inferências, mas nada é implementado ou age sem autorização humana explícita. Nunca.
- **Governança estrutural, não governança política.** Não votamos sobre o que é válido. Definimos invariantes que se mantêm incondicionalmente — a identidade do modelo é explícita, a linhagem é ininterrupta, a versão da política é monotônica.
- **A intenção não é a execução.** Declarar o que um agente deve fazer e permitir que ele aja são atos separados com portões separados. A lacuna entre eles é onde a confiança reside.
- **Os modelos são testemunhas, não autoridades.** O Attestia atesta. As cadeias validam. Mas a autoridade emana de regras estruturais, não dos pesos de nenhum modelo.

---

## Arquitetura

Cognate utiliza os primitivos do Attestia e adiciona uma camada de domínio nativa de IA. Os pacotes são funções puras. Os chamadores fornecem o estado. Nada aqui abre um socket, grava um arquivo ou lê um relógio, a menos que você forneça o valor.

| Pacote | Propósito | Status |
|---------|---------|--------|
| @cognate/types | Tipos de domínio de governança de IA compartilhados (zero dependências) | Pronto |
| @cognate/policy | Mecanismo de avaliação de políticas semânticas | Pronto |
| @cognate/model-registry | Ciclo de vida do modelo, versionamento, avaliação | Pronto |
| @cognate/agent-identity | Identidade do agente, capacidades, permissões | Pronto |
| @cognate/prompt-store | Registro de prompts/saídas com eventos criptografados | Pronto |

### Alinhamento regulatório

| Regulamentação | Cognate atende |
|------------|-------------------|
| Artigo 12 da Lei de IA da UE | Registro de eventos apenas anexado durante todo o ciclo de vida do sistema |
| Artigo 14(5) da Lei de IA da UE | Identificação de pessoas físicas na verificação |
| NIST AI RMF | Funções de governança, mapeamento, medição e gerenciamento |
| ISO/IEC 42001 | Requisitos do sistema de gerenciamento de IA |

---

## Princípios

| Princípio | Implementação |
|-----------|---------------|
| Registros apenas anexados | Sem ATUALIZAÇÃO, sem EXCLUSÃO — apenas novas entradas |
| Falha segura | A divergência de políticas interrompe o sistema, nunca se corrige silenciosamente |
| Reprodução determinística | Os mesmos eventos produzem o mesmo estado, sempre |
| Portões de aprovação humana | Nenhum modelo é implementado, nenhuma política é alterada, nenhuma capacidade é concedida sem aprovação explícita |
| Prompts criptografados | AES-256-GCM com chave do locatário para privacidade; hash SHA-256 para integridade |
| Identidade estrutural | Explícita, imutável, única — para modelos, agentes e políticas |

---

## Guia rápido

```bash
pnpm install
pnpm verify        # build + test + typecheck
pnpm test:coverage # full coverage report
```

Avalie uma política. O mecanismo não busca o estado. Você passa a política e o contexto.

```ts
import { evaluatePolicy } from "@cognate/policy";

const result = evaluatePolicy(policy, context);
if (result.overall === "deny") {
  // block the request
}
```

Registre uma versão do modelo e, em seguida, execute-a durante o ciclo de vida. Uma versão se move para `registered → evaluated → approved → deployed` e pode ser `rejected` ou `retired`. A implementação ainda requer uma aprovação registrada na versão.

```ts
import { createRegistry, registerModel, registerVersion, transitionVersion } from "@cognate/model-registry";
```

---

## Docker

A imagem publicada cria os cinco pacotes e serve um endpoint de integridade. A API HTTP de governança ainda não está nesta imagem. `/health` responde para que o contêiner possa ser supervisionado enquanto esse serviço ainda está em desenvolvimento.

```bash
docker compose up -d
curl http://localhost:4000/health
docker compose down
```

`/health` retorna:

```json
{ "status": "ok", "service": "cognate", "mode": "placeholder" }
```

O Compose mantém os dados de prompt e agente no volume `cognate-data`, montado em `/app/data`. A imagem é publicada no GHCR quando um lançamento do GitHub é publicado.

---

## Modelo de ameaças

Cognate assume o seguinte modelo de ameaças:

1. **Endpoint de inferência comprometido.** Um invasor obtém acesso à API do modelo. Mitigação: todos os prompts e saídas são registrados com cargas úteis criptografadas e hashes de integridade SHA-256. A reprodução é determinística.
2. **Agente desonesto com credenciais roubadas.** As chaves de um agente são exfiltradas. Mitigação: as capacidades são limitadas no tempo, limitadas no escopo e revogáveis. Cada concessão requer aprovação explícita.
3. **Adulteração do modelo na cadeia de suprimentos.** Pesos ou configurações são trocados após a avaliação. Mitigação: o registro de modelos faz hash dos pesos, da configuração e do manifesto no registro. Qualquer desvio invalida a versão.
4. **Desvio da política por meio de injeção de prompt.** Um prompt adversário tenta contornar as regras de conteúdo. Mitigação: a avaliação da política é determinística, versionada e ocorre antes da inferência. Nenhum prompt é executado sem uma verificação de política aprovada.
5. **Abuso interno dos logs de auditoria.** Um operador privilegiado adultera os logs. Mitigação: o armazenamento de eventos é apenas anexado e apoiado pelas provas de árvore de Merkle do Attestia. A adulteração quebra o hash da cadeia.

Por padrão, nenhuma telemetria, análise ou chamadas de rede de saída são feitas.

---

## Status

Construindo em público. Todos os pacotes principais são implementados, testados e estão em construção. A v0.1.0 é a primeira versão publicada. Os pacotes são bibliotecas. Eles ainda não estão no npm.

| Portão | Status |
|------|--------|
| Construção | Passando |
| Testes | 72 aprovados |
| Cobertura | Mais de 90% da política |
| Verificação de tipo | Limpo |
| Docker | Criação de imagens. O ponto de extremidade de saúde é um espaço reservado |
| Verificação de envio | Manual, página de destino e metadados do repositório nesta versão |

---

Criado por [MCP Tool Shop](https://mcp-tool-shop.github.io/)
