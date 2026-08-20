# André OS · arquitetura de gavetas v1

## Objetivo

Transformar o André OS de uma sequência plana de páginas e blocos acumulados em uma aplicação organizada por contextos de trabalho.

A metáfora operacional é:

```text
André OS = ambiente
Planet Chocolate = contexto
Gaveteiro = área de trabalho
Gaveta = página com uma responsabilidade
Divisória = filtro, aba ou etapa
Item = chamado, demanda, lead, candidato ou inauguração
```

## Diagnóstico da main em 06/08/2026

### Navegação

A navegação principal está plana. Início, Chamados, Inaugurações, Calendário, Conteúdos e Expansão disputam o mesmo nível, mesmo representando tipos diferentes de trabalho.

### Home

A página atualmente chamada Painel de Marketing reúne no mesmo fluxo vertical:

- cockpit de decisão;
- captura e edição de demandas internas;
- Radar operacional completo;
- métricas;
- atalhos.

Ela funciona como painel, formulário e fila operacional simultaneamente. O crescimento vertical é consequência dessa mistura.

### Expansão

Leads recebidos e Caça Lead possuem entidades e fluxos diferentes:

- Leads recebidos são contatos oficiais do funil;
- Caça Lead trabalha candidatos ainda em revisão;
- o candidato só entra no funil após promoção explícita.

Apesar disso, ambos aparecem como abas dentro da mesma página genérica Expansão. A separação de dados está correta, mas a navegação não expressa essa diferença.

### Rolagem

O shell atual utiliza página em fluxo normal, topbar sticky e conteúdo com altura variável. A rolagem acontece no documento inteiro. Para atingir a experiência de aplicativo, cada página precisará futuramente ocupar a altura útil do monitor e delegar a rolagem apenas para listas, quadros e históricos internos.

## Mapa v1

```text
Hoje

Operação da rede
├── Chamados
└── Inaugurações

Marketing
├── Calendário
└── Conteúdos

Expansão
├── Leads recebidos
└── Caça Leads
```

Financeiro permanece dentro de Inaugurações nesta fase porque o módulo atual é contextual à unidade e não constitui uma página autônoma.

## Regras

1. Uma página deve representar um trabalho principal.
2. Gavetas agrupam páginas, não escondem blocos aleatórios.
3. Filtros e etapas pertencem ao conteúdo da página, não à navegação principal.
4. Detalhes devem abrir lateralmente ou em diálogo quando a pessoa precisa permanecer na fila.
5. Desktop e mobile reutilizam os mesmos destinos, preservando apresentações próprias.
6. Não criar novo CRM, novo funil ou outra entidade de lead.
7. Não alterar API, KV ou regras de negócio durante a reorganização visual.
8. Não bloquear a rolagem global antes de cada página possuir uma área interna segura para rolagem.

## Ordem de evolução

### PR 1 · fundação das gavetas

- agrupar a navegação existente;
- transformar Início em Hoje;
- separar Leads recebidos e Caça Leads na navegação;
- preservar hashes, APIs e módulos existentes.

### PR 2 · desmontagem da Home

Criar páginas independentes:

```text
Hoje
Demandas
Radar
```

Hoje mantém somente foco principal, pontos complementares e entradas rápidas.

Demandas recebe captura, edição, concluídas e organização por IA.

Radar recebe a fila operacional, filtros, dependências e ações.

### PR 3 · shell de aplicativo

- ocupar `100dvh` no desktop;
- manter topbar e navegação fixas;
- remover rolagem geral somente após as páginas estarem preparadas;
- permitir rolagem interna em listas, kanbans, tabelas e históricos;
- preservar comportamento mobile independente.

### PR 4 · páginas operacionais

Revisar uma por vez:

- Chamados;
- Inaugurações;
- Leads recebidos;
- Caça Leads;
- Calendário;
- Conteúdos.

Cada página deve receber cabeçalho compacto, comandos próprios, área principal de trabalho e detalhe contextual quando necessário.

## Fora do escopo deste PR

- mudanças de API ou banco;
- novas entidades;
- reorganização de dados;
- alteração no funil de Expansão;
- refatoração do Caça Lead;
- remoção imediata da rolagem geral;
- redesign completo das páginas;
- merge sem validação visual em desktop e mobile.
