# Planet Brain v1

## Objetivo

Dar ao `Pensar comigo` conhecimento permanente sobre a operação da Planet Chocolate sem transformar cada requisição em um prompt gigante.

## Arquitetura

O Brain é um pacote versionado em:

`functions/_shared/knowledge/planet-brain.js`

Ele contém blocos independentes:

- empresa e operação;
- marca e comunicação;
- chamados e SULTS;
- implantações e inaugurações;
- campanhas e calendário;
- produtos e materiais;
- gestão da unidade e franqueados;
- landing page, vendas e expansão;
- regras de decisão do André OS.

## Seleção de contexto

A função `selectPlanetKnowledge()` escolhe no máximo quatro blocos por pergunta.

Sempre entram:

1. empresa e operação;
2. regras de decisão.

Os outros blocos são escolhidos por:

- página atual;
- item aberto;
- pergunta;
- últimas mensagens da conversa.

Isso reduz custo e ruído.

## Ordem de confiança

1. Dados ao vivo do SULTS, Radar, página e item aberto.
2. Contexto confirmado pelo usuário.
3. Planet Brain como referência permanente.

O Brain nunca deve transformar informação histórica em fato atual sem confirmação.

## Uso de IA

A IA continua em modo manual. Nenhuma requisição é feita em segundo plano. O Brain só é anexado quando o usuário envia uma pergunta no `Pensar comigo`.

## Diagnóstico

`GET /api/hub/planet-brain`

Retorna:

- versão;
- quantidade de seções;
- nomes dos blocos;
- modo de seleção;
- ordem de precedência.

## Atualização

Mudanças no conhecimento devem:

1. preservar a fonte oficial dos dados vivos;
2. separar referências históricas de regras confirmadas;
3. atualizar `PLANET_BRAIN_VERSION`;
4. passar por revisão antes de entrar na `main`.
