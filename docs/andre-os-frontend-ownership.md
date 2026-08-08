# André OS · Front-end ownership map

Este documento define quem é dono de cada camada visual e comportamental do André OS. O objetivo é impedir que correções temporárias virem camadas permanentes e que múltiplos arquivos disputem a mesma superfície.

## Princípios

1. Cada superfície visual deve ter um dono principal.
2. JS controla comportamento e estado. CSS controla apresentação.
3. CSS injetado em runtime deve ser exceção e nunca a fonte principal de tema/layout.
4. Arquivos `fix`, `polish`, `final`, `override` ou equivalentes são temporários. Quando estabilizados, devem ser absorvidos pelo arquivo dono.
5. Mobile não é desktop espremido. Regras mobile devem estar protegidas por `html.aos-mobile` e/ou breakpoint dedicado.
6. Desktop é superfície protegida durante a consolidação mobile.
7. `!important` é permitido apenas quando necessário para isolamento de legado; novas regras devem preferir especificidade e ordem de camadas previsíveis.

## Ordem de carregamento desejada

1. Fundação e tokens
2. Sistema visual compartilhado
3. Módulos funcionais
4. Shell / navegação desktop
5. Shell / navegação mobile
6. Tema / paleta mobile
7. Regras de páginas mobile
8. Ajustes específicos de módulo estritamente necessários

## Donos atuais

### Fundação
- `andre-os-foundation-v1.css`
- `andre-os-visual-system-v1.css`

Responsabilidade: tokens, tipografia, superfícies e primitivas compartilhadas.

### Desktop shell
- `andre-os-desktop-shell-v2.css`
- `andre-os-navigation-drawers-v1.css`

Responsabilidade: sidebar, hierarquia desktop, gavetas e navegação desktop.

### Mobile shell e navegação
- `andre-os-mobile-shell-v2.js`
- `andre-os-mobile-navigation-v2.css`

Responsabilidade: montagem da navegação mobile, menu por ambientes/gavetas, acessibilidade e interação do shell.

### Mobile layout base
- `andre-os-mobile-v1.css`

Responsabilidade alvo: shell visual mobile compartilhado e componentes genéricos. Não deve carregar uma interface clara para depois ser repintada por múltiplos overrides.

### Mobile refinamentos transitórios
- `andre-os-mobile-polish-v1.css`

Status: candidato à absorção em `andre-os-mobile-v1.css` e módulos donos. Não adicionar novas responsabilidades aqui.

### Tema escuro mobile
- `andre-os-dark-theme-v1.css`

Responsabilidade alvo: tokens e tema escuro compartilhado.

### Cobertura de superfícies escuras
- `andre-os-dark-surfaces-v2.css`

Status: candidato à absorção pelos módulos donos e pelo tema base. Não deve continuar crescendo.

### Paleta escura
- `andre-os-dark-palette-polish-v1.css`

Responsabilidade atual: tokens finais de cor e superfícies prioritárias. Deve ser consolidado com `andre-os-dark-theme-v1.css` quando a migração estiver segura.

### Páginas mobile
- `andre-os-mobile-gavetas-v1.css`

Responsabilidade atual: densidade e responsividade das páginas mobile.

Status: grande demais. Deve ser dividido gradualmente entre sistema mobile compartilhado e módulos específicos, sem criar novos arquivos de remendo.

### Chamados
- `ticket-command-v1.css/js`: central operacional e lista de chamados.
- `ticket-details-v1.js`: carregamento e comportamento do drawer de detalhe.
- `ticket-context-compact-v1.css/js`: contexto operacional complementar.
- `ticket-readings-v1.css/js`: leitura da última interação.

Regra: SULTS continua sendo fonte de verdade. Contexto e leitura complementam, não alteram o status oficial.

`ticket-details-v1.js` ainda injeta CSS em runtime. Isso é dívida técnica mapeada e deve ser migrada para CSS estático do módulo.

### Campanhas
- `calendar-operations-v1.css/js`

### Inaugurações
- `inauguration-workspace-v2.css/js`
- `inauguration-project-close-v1.css/js`

### Expansão
- `planet-expansion-v1.css`
- `planet-lead-hunter-v1.css`

### Planet 5 Estrelas
- `planet-five-stars-v1.css`
- `planet-five-stars-data-v1.css`
- `planet-five-stars-import-v1.css`
- `planet-five-stars-actions-v1.css`

### Central Planet
- `content-library-v1.css/js`

### Demandas / Radar / Home
- `internal-demands-v1.css/js`
- `active-workstream-v1.css/js`
- `decision-cockpit-v1.css/js`
- `attention-now-v1.css`
- `radar-*`

## Dívidas técnicas confirmadas

1. Mobile base claro + repintura dark posterior.
2. `andre-os-mobile-polish-v1.css` sobrepondo o mobile base.
3. `andre-os-dark-theme-v1.css`, `andre-os-dark-surfaces-v2.css` e `andre-os-dark-palette-polish-v1.css` com sobreposição de responsabilidades.
4. `andre-os-mobile-gavetas-v1.css` acumulando regras de muitos módulos.
5. `ticket-details-v1.js` injetando grande bloco de CSS em runtime.
6. `index.html` com muitos assets e ordem difícil de auditar.
7. Testes atuais validam presença de seletores, mas ainda não detectam conflito de cascata.

## Plano de consolidação

### Fase 1 · estabilização
- congelar novas mudanças visuais enquanto a base é consolidada;
- remover layers claramente redundantes;
- documentar propriedade;
- adicionar contratos contra regressão arquitetural.

### Fase 2 · tema mobile
- tornar o mobile base coerente com a paleta atual;
- absorver `mobile-polish` onde fizer sentido;
- consolidar `dark-theme`, `dark-surfaces` e `dark-palette`.

### Fase 3 · módulos
- mover regras específicas de páginas para seus donos;
- começar por Chamados, Home/Planet e Marketing;
- remover CSS injetado em runtime do drawer de Chamados.

### Fase 4 · index e testes
- reorganizar `index.html` por camadas claras;
- eliminar assets mortos;
- adicionar testes de ordem, duplicação e superfície proprietária.

## Regra para novas mudanças

Antes de criar um novo arquivo CSS, responder:

1. Qual superfície ele controla?
2. Já existe um dono dessa superfície?
3. Por que a mudança não pode morar no dono atual?
4. Esse arquivo será permanente ou transitório?

Se a resposta 2 for “sim”, a mudança deve preferencialmente ir para o dono existente.
