# André OS · Desktop Shell v2

## Objetivo

Iniciar a reorganização estrutural do desktop sem alterar APIs, KV, integrações ou regras de negócio.

A primeira migração separa duas responsabilidades que hoje estavam misturadas na sidebar:

1. escolher o ambiente de trabalho;
2. navegar pelas páginas do ambiente Planet Chocolate.

## Estrutura desta etapa

```text
André OS
├── Início
└── Trabalho
    └── Planet Chocolate
        ├── Visão geral
        ├── Demandas
        ├── Radar
        ├── Campanhas
        ├── Inaugurações
        ├── Chamados
        ├── Expansão
        └── Central
```

`Pessoal` e `Laboratório` aparecem apenas como indicação visual de próximos ambientes. Eles não são botões e não criam rotas ou dados nesta etapa.

## Separação de Início e Planet

A rota existente `#inicio` continua sendo o Hoje do André OS.

A nova rota visual `#planet` reutiliza a renderização já existente da visão geral da Planet. O núcleo atual interpreta hashes desconhecidos como a view inicial, enquanto o módulo de páginas segmentadas não intercepta `#planet`. Isso permite separar os dois destinos sem duplicar dados nem criar outra Home.

## Navegação contextual Planet

No desktop, ao entrar em qualquer rota da Planet, surge uma barra contextual abaixo do cabeçalho.

Destinos:

- `#planet` → Visão geral;
- `#demandas` → Demandas;
- `#radar` → Radar;
- `#calendario` → Campanhas;
- `#inauguracoes` → Inaugurações;
- `#chamados` → Chamados;
- `#expansao` → Expansão;
- `#conteudos` → Central.

A navegação antiga continua no DOM porque vários módulos ainda a usam como contrato interno, porém fica visualmente oculta no desktop enquanto o Shell v2 está ativo. No mobile nada muda.

## O que não muda

- chamadas ao SULTS;
- Cloudflare KV;
- autenticação;
- leads;
- Caça Leads;
- notificações;
- demandas;
- Radar;
- inaugurações;
- campanhas;
- conteúdos;
- funcionamento mobile.

O novo módulo não usa `fetch`, `localStorage`, `sessionStorage` nem `MutationObserver`.

## Próxima etapa

Depois de validar o shell em preview, reorganizar `Planet Chocolate → Visão geral` como primeira página piloto. Só depois migrar as demais gavetas para o novo padrão visual.

`Planet 5 Estrelas` e `Indicadores` entram na navegação quando seus módulos tiverem destinos reais. Eles não são adicionados como botões mortos nesta entrega.
