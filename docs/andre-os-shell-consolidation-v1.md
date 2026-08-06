# Consolidação do shell André OS v1

## Objetivo

Remover adaptações temporizadas e contratos visuais de emergência antes de conectar coleta automática ao Caça Leads.

## Consolidado

- a navegação passa a criar seus destinos de forma idempotente em um único módulo;
- Demandas e Radar deixam de criar botões de navegação por conta própria;
- as gavetas respondem apenas a eventos reais do sistema e `requestAnimationFrame`;
- removidos temporizadores de montagem de 250 ms e 900 ms;
- removido `insertAdjacentElement` da camada de gavetas;
- o CSS das páginas Hoje, Demandas e Radar passa a ser carregado estaticamente pelo `index.html`;
- o atributo `hidden` volta a ser a fonte de verdade entre Leads e Caça Leads;
- o contrato de exclusividade da Expansão não usa `!important`;
- testes recentes de gavetas, páginas, mobile e Expansão entram no CI do Caça Leads.

## Preservado

- layout aprovado no desktop;
- layout aprovado no mobile;
- tema claro no desktop;
- tema escuro no mobile;
- dados, APIs, KV e autenticação;
- integração RD Station;
- candidatos, score, revisão, deduplicação e promoção;
- notificações e funil oficial de Leads.

## Próxima etapa

Conectar um coletor agendado ao domínio existente de candidatos. O coletor deve apenas criar e enriquecer candidatos. Aprovação e promoção para Leads continuam humanas e explícitas.
