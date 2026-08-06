# Consolidação do shell André OS v1

## Objetivo

Remover adaptações temporizadas e contratos visuais de emergência antes de conectar coleta automática ao Caça Leads.

## Consolidado

- a navegação passa a criar seus destinos de forma idempotente em um único módulo;
- Demandas e Radar deixam de criar botões de navegação por conta própria;
- as gavetas respondem apenas a eventos reais do sistema e `requestAnimationFrame`;
- removidos temporizadores de montagem de 250 ms e 900 ms;
- removido `insertAdjacentElement` das gavetas e da Expansão;
- o CSS das páginas Hoje, Demandas e Radar passa a ser carregado estaticamente pelo `index.html`;
- o CSS estrutural de Expansão sai do JavaScript e vira folha oficial do componente;
- a antiga folha corretiva de exclusividade é removida;
- o atributo `hidden` volta a ser a fonte de verdade entre Leads e Caça Leads;
- Expansão deixa de reescrever os rótulos organizados pelas gavetas e atualiza somente seu badge;
- a troca de rota da Expansão usa um único frame, sem `setTimeout(activate, 0)`;
- os contratos consolidados não usam `!important`;
- testes recentes de gavetas, páginas, mobile e Expansão entram no CI do Caça Leads.

## Preservado

- layout aprovado no desktop;
- layout aprovado no mobile;
- tema claro no desktop;
- tema escuro no mobile;
- dados, APIs, KV e autenticação;
- integração RD Station;
- candidatos, score, revisão, deduplicação e promoção;
- notificações e funil oficial de Leads;
- o contrato `view: inicio` usado pelos módulos existentes de Demandas e Radar.

## Validação manual antes do merge

- abrir e fechar cada gaveta no desktop;
- repetir a navegação no mobile;
- abrir Hoje, Demandas e Radar sem conteúdo duplicado;
- alternar Leads e Caça Leads várias vezes;
- confirmar que somente a seção ativa ocupa o workspace;
- recarregar a página em `#demandas`, `#radar` e `#expansao`;
- confirmar que os badges e rótulos da gaveta Expansão permanecem corretos após atualizar dados;
- confirmar que nenhuma aparência aprovada mudou.

## Próxima etapa

Conectar um coletor agendado ao domínio existente de candidatos. O coletor deve apenas criar e enriquecer candidatos. Aprovação e promoção para Leads continuam humanas e explícitas.
