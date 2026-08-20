# André OS · Hoje, Demandas e Radar

## Objetivo

Separar três trabalhos que estavam empilhados na mesma Home:

```text
Hoje
Demandas
Radar
```

A mudança é de arquitetura de informação e shell visual. Não altera APIs, KV, regras de negócio, tarefas ou integrações.

## Antes

A rota `#inicio` montava simultaneamente:

- cockpit de decisão;
- cadastro de demanda interna;
- Radar operacional completo;
- métricas;
- atalhos.

Isso fazia a página crescer conforme novas funções eram adicionadas e transformava a Home em um fluxo vertical sem limite claro.

## Depois

### Hoje

Responsabilidade única:

- mostrar o foco principal;
- mostrar até três pontos complementares;
- abrir rapidamente Demandas ou Radar.

Não contém o formulário de demanda nem a lista completa do Radar.

### Demandas

Responsabilidade única:

- registrar uma demanda;
- organizar com IA;
- revisar a prévia;
- editar, concluir, reabrir ou excluir demandas.

Reutiliza o módulo e o armazenamento existentes de demandas internas.

### Radar

Responsabilidade única:

- mostrar toda a fila operacional;
- aplicar filtros;
- exibir prazo, dependência, contexto e responsável;
- abrir os itens nas áreas de origem.

Reutiliza o módulo e a coleta de dados existentes do Radar.

## Navegação

As novas páginas entram na gaveta `Operação da rede`:

```text
Operação da rede
├── Demandas
├── Radar
├── Chamados
└── Inaugurações
```

`Hoje` permanece fora das gavetas por ser a porta inicial de decisão.

## Rotas

```text
#inicio
#demandas
#radar
```

O shell antigo ainda interpreta rotas desconhecidas como `inicio`. O módulo `andre-os-home-pages-v1.js` funciona como camada de segmentação: após o shell montar a superfície, ele escolhe a página correta pelo hash e remonta somente o workspace necessário.

Essa estratégia evita reescrever o núcleo de navegação neste PR.

## Altura e rolagem

No desktop, as três páginas usam a altura disponível do monitor:

```text
100dvh
├── cabeçalho
└── workspace
```

A rolagem geral do documento fica bloqueada somente nessas três páginas.

Quando o conteúdo ultrapassa a altura disponível, a rolagem acontece dentro de:

- cockpit;
- área de Demandas;
- lista do Radar.

No mobile, o comportamento atual de página é preservado nesta etapa para não quebrar teclado, formulários ou a gaveta lateral.

## Compatibilidade

Preservado:

- módulos existentes de Demandas, Radar e cockpit;
- armazenamento local e compartilhado;
- SULTS;
- notificações;
- atalhos para tarefas;
- desktop claro;
- mobile escuro;
- sidebar mobile existente.

## Validação manual

### Hoje

- abrir `#inicio`;
- confirmar que não existe formulário de demanda;
- confirmar que não existe a lista completa do Radar;
- confirmar foco principal e pontos complementares;
- abrir Demandas e Radar pelos atalhos.

### Demandas

- abrir `#demandas`;
- criar prévia manual;
- organizar uma demanda com IA ou fallback;
- salvar;
- editar;
- concluir e reabrir;
- confirmar rolagem somente dentro do workspace no desktop.

### Radar

- abrir `#radar`;
- confirmar filtros e itens ativos;
- abrir uma tarefa de cada origem disponível;
- confirmar contexto e dependências;
- confirmar rolagem somente dentro da lista no desktop.

### Navegação

- abrir a gaveta Operação da rede;
- confirmar Demandas, Radar, Chamados e Inaugurações;
- navegar entre as quatro páginas;
- confirmar que somente o destino atual fica ativo;
- validar o fechamento automático da sidebar no mobile.

## Próxima etapa

Depois da validação visual e funcional:

1. revisar Chamados para transformar o kanban horizontal em workspace fechado;
2. revisar Inaugurações e separar visão geral de detalhe;
3. decidir se Calendário e Conteúdos precisam de subdivisões internas;
4. somente depois consolidar um contrato global de páginas sem rolagem do documento.
