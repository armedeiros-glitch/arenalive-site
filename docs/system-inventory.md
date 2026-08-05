# André OS · Inventário do sistema

Baseline: branch `main` após a definição de `/` como entrada oficial.

Este documento é a fonte de referência para manutenção estrutural do André OS. Ele não substitui `docs/vision.md`, que descreve a arquitetura de destino. Aqui está registrado o que entra em execução hoje, qual papel cada grupo exerce, quem deve cuidar dele e qual é sua condição atual.

## 1. Objetivos

- impedir novas correções em camadas sem rastreabilidade;
- separar Estrutura de Arquitetura Visual;
- distinguir código ativo, transitório, legado e candidato à remoção;
- registrar fontes de verdade, dependências e riscos;
- orientar a consolidação gradual sem recriar o sistema em paralelo.

## 2. Fronteira de responsabilidade

### Estrutura

Responsável por:

- entradas, rotas e redirecionamentos;
- autenticação, sessão e segurança;
- APIs, integrações e webhooks;
- persistência, KV, revisões e conflitos;
- serviços de dados, cache e scheduler;
- Runtime, eventos e Context Engine;
- regras de negócio e contratos entre módulos;
- redução de requisições, duplicações e dependências transitórias;
- classificação de branches e PRs antigos.

### Arquitetura Visual

Responsável por:

- hierarquia visual, layout e navegação;
- CSS, tipografia, cores, espaçamento e responsividade;
- sidebar, dock, menus, estados vazios e feedback visual;
- composição visual de desktop e mobile;
- acabamento visual de documentos e do Thinking Assistant;
- consolidação visual de `mobile` e `mobile-polish`.

### Compartilhado

Módulos de interface possuem duas faces:

- Estrutura cuida de dados, estados, eventos, regras e integrações;
- Arquitetura Visual cuida da apresentação e interação visual.

PRs mistos devem ser separados sempre que isso reduzir risco.

## 3. Classificação

| Status | Significado |
| --- | --- |
| `ATIVO` | Parte oficial do sistema atual e sem substituto conhecido. |
| `ATIVO-SUPORTE` | Necessário hoje, mas com responsabilidade estreita que pode ser absorvida no futuro. |
| `TRANSITÓRIO` | Ponte, fallback ou camada temporária necessária durante uma migração. Deve possuir condição de saída. |
| `LEGADO` | Mantido para compatibilidade, referência ou rota antiga. Não recebe evolução normal. |
| `CANDIDATO` | Pode estar sem uso, mas só pode ser removido após medição e teste. |
| `REMOVIDO` | Não integra mais a fonte oficial. |

## 4. Entradas e rotas de interface

| Caminho | Status | Papel | Responsável |
| --- | --- | --- | --- |
| `/index.html` | `ATIVO` | Entrada oficial do André OS. | Estrutura |
| `/_redirects` | `ATIVO` | Redireciona entradas antigas do Planet Hub para `/`. | Estrutura |
| `/planet-hub/index.html` | `REMOVIDO` | Era cópia idêntica da entrada principal. | Estrutura |
| `/planet-hub/assets/` | `ATIVO` | Diretório atual dos assets do André OS. O nome é histórico, mas o conteúdo é usado pela entrada oficial. | Compartilhado |
| `/planet-hub/legacy.html` | `LEGADO` | Interface antiga preservada. Não remover sem verificar acessos e dependências. | Estrutura |
| `/planet-marketing-hub/` | `CANDIDATO` | Aplicação antiga separada. Medir uso antes de decidir remoção. | Estrutura |

### Fluxo oficial de inicialização

```text
/
→ index.html
→ Runtime + Context Engine + shell + autenticação
→ validação de /api/hub/session
→ unified-hub + financeiro + expansão + notificações
→ módulos operacionais
```

## 5. Assets carregados diretamente pelo `index.html`

### CSS

Todos os arquivos CSS são território da Arquitetura Visual. A Estrutura apenas registra dependências e condições de saída.

| Arquivo | Status | Papel principal |
| --- | --- | --- |
| `andre-os-foundation-v1.css` | `ATIVO` | Fundação visual e tokens gerais. |
| `andre-os-dashboard-v1.css` | `ATIVO` | Dashboard e Home. |
| `andre-os-operations-v1.css` | `ATIVO` | Áreas operacionais. |
| `inauguration-workspace-v2.css` | `ATIVO` | Workspace de inaugurações. |
| `andre-os-runtime-v1.css` | `ATIVO` | Superfícies ligadas ao Runtime. |
| `ticket-command-v1.css` | `ATIVO` | Central de chamados. |
| `calendar-operations-v1.css` | `ATIVO` | Calendário e campanhas. |
| `content-library-v1.css` | `ATIVO` | Biblioteca de conteúdos. |
| `internal-demands-v1.css` | `ATIVO` | Demandas internas. |
| `home-ai-compact-v1.css` | `ATIVO-SUPORTE` | Composição compacta da Home. |
| `active-workstream-v1.css` | `ATIVO` | Foco e trabalho ativo. |
| `radar-analysis-v1.css` | `ATIVO` | Análise do Radar. |
| `decision-cockpit-v1.css` | `ATIVO` | Cockpit de decisão. |
| `attention-now-v1.css` | `ATIVO-SUPORTE` | Alertas e atenção imediata. |
| `radar-context-suggestions-v1.css` | `ATIVO-SUPORTE` | Sugestões contextuais. |
| `ticket-readings-v1.css` | `ATIVO-SUPORTE` | Leituras e estados dos chamados. |
| `radar-reliability-v1.css` | `ATIVO-SUPORTE` | Estados de confiabilidade do Radar. |
| `thinking-assistant-v1.css` | `TRANSITÓRIO` | Estilo da base antiga do assistente. |
| `thinking-assistant-live-v1.css` | `TRANSITÓRIO` | Camada visual nova sobre o assistente antigo. |
| `andre-os-mobile-v1.css` | `ATIVO` | Base visual mobile. |
| `andre-os-mobile-polish-v1.css` | `TRANSITÓRIO` | Correções finais sobre a base mobile. Saída depende da consolidação visual. |

### JavaScript carregado antes da autenticação e durante o bootstrap

| Arquivo | Status | Papel | Responsável |
| --- | --- | --- | --- |
| `andre-os-runtime-core-v1.js` | `ATIVO` | Barramento de eventos, estado e contratos públicos do Runtime. | Estrutura |
| `andre-os-context-engine-v1.js` | `ATIVO` | Contexto oficial compartilhado entre módulos. | Estrutura |
| `andre-os-mobile-shell-v2.js` | `ATIVO` | Shell e navegação mobile. | Arquitetura Visual |
| `hub-access-v1.js` | `ATIVO` | Sessão, login, bootstrap e sequência pós-autenticação. | Estrutura |
| `payment-print-compact-v1.js` | `TRANSITÓRIO` | Ajusta a impressão gerada por outra camada. | Compartilhado |
| `payment-request-print-v1.js` | `ATIVO-SUPORTE` | Geração de solicitação de pagamento. | Compartilhado |
| `payment-quick-flow-v1.js` | `TRANSITÓRIO` | Fluxo rápido sobre o financeiro existente. | Compartilhado |
| `payment-print-clean-v1.js` | `TRANSITÓRIO` | Limpa e altera a impressão gerada. | Compartilhado |
| `ticket-ignore-instant-v1.js` | `ATIVO-SUPORTE` | Ação rápida para ignorar chamados. Revisar absorção no módulo principal. | Estrutura |
| `ticket-details-v1.js` | `ATIVO` | Detalhes de chamados. | Compartilhado |
| `sults-open-fallback-v1.js` | `TRANSITÓRIO` | Fallback de abertura do SULTS. | Estrutura |
| `ignored-tickets-v1.js` | `ATIVO-SUPORTE` | Estado dos chamados ignorados. | Estrutura |
| `ticket-command-v1.js` | `ATIVO` | Central funcional de chamados. | Compartilhado |
| `calendar-operations-v1.js` | `ATIVO` | Operação de calendário e campanhas. | Compartilhado |
| `inauguration-workspace-v2.js` | `ATIVO` | Implantação, checklist e vínculo financeiro. | Compartilhado |
| `content-library-v1.js` | `ATIVO` | Biblioteca de conteúdos. | Compartilhado |
| `content-library-stability-v1.js` | `TRANSITÓRIO` | Estabilização sobre a biblioteca. Revisar absorção na fonte. | Estrutura |
| `internal-demands-v1.js` | `ATIVO` | Demandas internas. | Compartilhado |
| `radar-data-v1.js` | `ATIVO` | Agregador de dados usado pelo Radar. | Estrutura |
| `ticket-readings-v1.js` | `ATIVO-SUPORTE` | Leituras complementares de chamados. | Estrutura |
| `radar-live-v1.js` | `ATIVO` | Atualização e renderização viva do Radar. | Compartilhado |
| `radar-context-v1.js` | `ATIVO` | Contextualização do Radar. | Estrutura |
| `active-workstream-v1.js` | `ATIVO` | Foco e fluxo de trabalho ativo. | Compartilhado |
| `decision-cockpit-v1.js` | `ATIVO` | Priorização e decisão na Home. | Compartilhado |
| `direct-task-open-v1.js` | `ATIVO-SUPORTE` | Abertura direta de itens. | Estrutura |
| `radar-reliability-v1.js` | `ATIVO-SUPORTE` | Sinais de confiabilidade e degradação. | Estrutura |
| `radar-analysis-v1.js` | `ATIVO` | Análise assistida do Radar. | Compartilhado |
| `thinking-assistant-v1.js` | `TRANSITÓRIO` | Núcleo antigo ainda necessário do Pensar comigo. | Estrutura |
| `thinking-assistant-context-adapter-v1.js` | `TRANSITÓRIO` | Converte Context Engine para o contrato antigo. | Estrutura |
| `thinking-assistant-live-v1.js` | `TRANSITÓRIO` | Interface viva sobre o núcleo antigo. | Compartilhado |

### Scripts carregados após autenticação

| Arquivo | Status | Papel | Responsável |
| --- | --- | --- | --- |
| `unified-hub-v1.js` | `ATIVO` | Shell funcional e renderização principal do Hub. | Compartilhado |
| `financeiro-v1.js` | `ATIVO` | Regras e operação financeira. | Compartilhado |
| `planet-expansion-v1.js` | `ATIVO` | Leads e expansão Planet. | Compartilhado |
| `planet-notifications-v1.js` | `ATIVO` | Notificações internas de expansão. | Compartilhado |

## 6. Back-end e integrações confirmados

### Segurança e sessão

| Arquivo | Status | Papel |
| --- | --- | --- |
| `functions/api/_middleware.js` | `ATIVO` | Proteção geral de `/api/*` e exceção controlada do webhook público. |
| `functions/api/hub/_middleware.js` | `ATIVO` | Proteção específica do Hub, rate limit da IA e guarda da resposta final. |
| `functions/api/hub/session.js` | `ATIVO` | Login, leitura e encerramento de sessão. |
| `functions/_lib/hub-auth.js` | `ATIVO` | Cookie assinado, HMAC e validação de sessão. |

A autenticação ocorre hoje em duas camadas para rotas `/api/hub/*`. Isso permanece ativo, mas deve ser revisado futuramente para deixar a divisão explícita: autenticação geral no middleware global e proteções específicas de IA no middleware do Hub.

### Persistência KV

| Arquivo | Status | Fonte de dados |
| --- | --- | --- |
| `functions/api/hub/inauguracoes.js` | `ATIVO` | `planet-hub:inauguracoes:v1` |
| `functions/api/hub/conteudos.js` | `ATIVO` | Conteúdos compartilhados. |
| `functions/api/hub/campanhas.js` | `ATIVO` | Campanhas e calendário. |
| `functions/api/hub/demandas-internas.js` | `ATIVO` | Demandas internas. |
| `functions/api/hub/financeiro.js` | `ATIVO` | Financeiro, fornecedores e pagamentos. |
| `functions/api/hub/planet/leads.js` | `ATIVO` | `planet-hub:planet-expansion-leads:v1` |
| `functions/api/hub/planet/notifications.js` | `ATIVO` | `planet-hub:planet-notifications:v1` |

Essas APIs repetem infraestrutura de documento KV, incluindo leitura, revisão, normalização, conflito, serialização, limites e gravação. A normalização de domínio deve continuar local. A infraestrutura comum é candidata a biblioteca compartilhada.

### RD Station

| Arquivo | Status | Papel |
| --- | --- | --- |
| `functions/api/integrations/planet/rd/webhook/[secret].js` | `ATIVO` | Entrada pública única do webhook com segredo no caminho. |
| `functions/_lib/planet-rd-webhook.js` | `ATIVO` | Autenticação, extração do payload, deduplicação, leads e notificações. |

A rota antiga `/events` e os diagnósticos temporários foram removidos. A rota pública atual é liberada de forma específica pelo middleware geral e mantém autenticação própria.

### IA

O middleware do Hub confirma três contratos ativos:

- `/api/hub/analisar-radar`;
- `/api/hub/organizar-demanda`;
- `/api/hub/pensar-comigo`.

A camada específica do Hub também aplica limite, proteção contra payload excessivo, guarda de saída e fallback determinístico.

## 7. Grupos de risco e condição de saída

### Pagamentos

Grupo atual:

```text
financeiro-v1.js
→ payment-request-print-v1.js
→ payment-quick-flow-v1.js
→ payment-print-compact-v1.js
→ payment-print-clean-v1.js
```

Risco: lógica e geração de documento distribuídas, com alterações posteriores da janela de impressão.

Condição de saída: uma fonte funcional para dados e geração do documento, mantendo o acabamento visual sob responsabilidade da Arquitetura Visual.

### Thinking Assistant

Grupo atual:

```text
Context Engine
→ thinking-assistant-context-adapter-v1.js
→ thinking-assistant-v1.js
→ thinking-assistant-live-v1.js
```

Risco: contrato novo convertido para contrato antigo, com duas gerações de interface ativas.

Condição de saída: o Thinking Assistant consumir diretamente o Context Engine. Depois disso, retirar o adapter e o núcleo antigo somente com testes de contexto, histórico, seleção e transporte.

### SULTS e chamados

Grupo atual:

```text
unified-hub
+ ticket-command
+ radar-data
+ helpers de detalhes, ignorados, leitura e fallback
```

Risco: múltiplos consumidores e estados para a mesma fonte externa.

Condição de saída: serviço compartilhado de dados/cache para chamados, sem alterar a experiência visual.

### Radar

Grupo atual:

```text
radar-data
→ radar-live
→ radar-context
→ active-workstream
→ decision-cockpit
→ reliability
→ analysis
```

Risco: responsabilidades distribuídas e ciclos próprios de atualização.

Condição de saída: fonte de dados compartilhada, scheduler central e eventos oficiais do Runtime.

### Mobile

Grupo atual:

```text
andre-os-mobile-v1.css
→ andre-os-mobile-polish-v1.css
→ andre-os-mobile-shell-v2.js
```

A consolidação visual pertence à Arquitetura Visual. A Estrutura apenas garante que eventos, rotas e contratos não sejam duplicados durante a mudança.

## 8. Congelamento de novos arquivos-corretivo

Durante a limpeza estrutural, não criar um novo arquivo com função principal de remendar outro módulo sem registrar:

1. problema na fonte;
2. motivo técnico para não corrigir a fonte agora;
3. módulo e responsável;
4. dependências;
5. condição objetiva de remoção;
6. teste que protege a retirada futura.

Nomes que exigem atenção especial:

```text
fix
clean
stability
polish
fallback
adapter
instant
reliability
```

Isso não proíbe esses nomes. Proíbe camadas sem dono e sem saída.

## 9. Regras para PRs

- alteração visual: Arquitetura Visual;
- alteração de API, dados, integração, cache, Runtime ou regra: Estrutura;
- alteração mista: dividir em PRs quando possível;
- novo asset carregado pelo `index.html` ou `hub-access-v1.js`: atualizar este inventário;
- nova rota: atualizar a seção de back-end;
- nova camada transitória: registrar condição de saída;
- arquivo legado: não receber evolução normal;
- remoção: exigir busca de dependências e teste de regressão;
- PR antigo baseado em arquitetura superada: extrair a ideia e recriar sobre a `main`, sem merge direto.

## 10. Ordem estrutural aprovada

1. consolidar a lógica de pagamentos e impressão;
2. criar utilitário KV compartilhado;
3. classificar PRs e limpar branches concluídas;
4. criar serviço único de dados/cache;
5. criar scheduler central de atualização;
6. substituir observadores globais por eventos oficiais;
7. migrar módulos para interfaces públicas do Runtime;
8. conectar o Thinking Assistant diretamente ao Context Engine;
9. retirar adapters e eventos legados somente após eliminar dependências;
10. medir e decidir o destino das rotas antigas.

A consolidação visual de desktop, mobile, navegação, CSS e acabamento continua fora desta fila e sob responsabilidade da Arquitetura Visual.

## 11. Pontos ainda a confirmar

- métricas reais de acesso a `/planet-hub/legacy.html` e `/planet-marketing-hub/`;
- bindings e diferenças entre ambientes Preview e Production da Cloudflare;
- inventário completo de branches já mergeadas que podem ser apagadas;
- PRs antigos que contêm lógica útil ainda não incorporada;
- dependências de arquivos não carregados pela entrada oficial, como testes, documentos e ferramentas auxiliares.

Esses pontos não bloqueiam o congelamento. Eles bloqueiam apenas remoções definitivas.
