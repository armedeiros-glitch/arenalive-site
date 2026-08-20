# Princípios do André OS

## Princípio central

O André OS deve reduzir a quantidade de decisões necessárias para transformar contexto em ação.

## Regras de ouro do Runtime

1. **Módulos não conversam diretamente entre si.** A comunicação entre domínios passa por interfaces públicas do Runtime.
2. **Eventos têm nomes por domínio, não por implementação.** Usar `radar.updated`, não o nome de um arquivo, seletor ou componente.
3. **Todo novo estado global pertence ao Runtime.** Estado local de componente continua local.
4. **O Runtime não conhece regras de negócio dos módulos.** Ele coordena, registra e distribui; o módulo decide.
5. **A interface consome contexto; ela não o produz.** A apresentação não deve se tornar a fonte da regra operacional.
6. **Nenhum módulo cria um novo acesso global sem passar pelo Runtime.** Evitar novos `window.*`, singletons isolados e eventos ad hoc.

## Compatibilidade

A migração do sistema atual deve ser progressiva.

- eventos legados podem ser conectados temporariamente ao Event Bus;
- módulos antigos continuam funcionando durante a transição;
- a ponte de compatibilidade não deve se tornar a arquitetura definitiva;
- cada nova funcionalidade deve nascer usando o Runtime.

## Estado

- estado compartilhado entre módulos deve ter um dono explícito;
- leituras devem acontecer por interfaces públicas;
- alterações devem emitir eventos rastreáveis;
- o Runtime não substitui persistência, APIs ou banco de dados;
- dados remotos continuam pertencendo às suas fontes oficiais.

## Interface

Toda tela deve responder rapidamente:

1. Onde estou?
2. O que precisa da minha atenção agora?
3. Qual é a próxima ação?
4. O que acontece se eu não agir agora?

A interface deve transmitir controle, não volume de trabalho.

## Mudanças técnicas

Antes de criar um novo serviço, evento ou estado global, verificar:

- já existe uma interface pública equivalente?
- o nome descreve o domínio ou apenas a implementação atual?
- o módulo pode ser substituído sem alterar seus consumidores?
- a solução cria dependência direta entre módulos?
- o comportamento pode ser observado e testado?
