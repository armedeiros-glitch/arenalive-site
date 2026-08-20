# André OS · Base técnica

## Objetivo atual

O Planet Marketing Hub é o primeiro módulo operacional do André OS. A prioridade é organizar o trabalho antes de expandir para a vida pessoal.

O sistema deve centralizar contexto e execução sem tentar substituir todas as ferramentas externas. Integrações só entram quando economizam trabalho de verdade. Quando um link ou botão resolve, não criar uma integração pesada.

## Fonte de verdade

- Demandas operacionais: APIs internas do Hub e SULTS.
- Tarefas pessoais do Radar: Todoist.
- Dados compartilhados do Hub: binding `PLANET_HUB_DATA`.
- Arquivos: R2 quando o binding `ANDRE_OS_FILES` ou `FILES` estiver conectado.
- Cache local: apenas contingência e experiência de uso, nunca fonte principal silenciosa.

## Política de IA e custo

Meta financeira: manter o custo recorrente dentro do plano Workers Paid de US$ 5 enquanto o sistema tiver um único usuário.

Regras:

1. Usar IA somente por ação explícita do usuário, nunca ao abrir uma tela.
2. Manter fallback local por regras para funções essenciais.
3. Modelo padrão de melhor custo-benefício: `@cf/zai-org/glm-4.7-flash`.
4. Modelos menores podem continuar em tarefas simples e curtas quando já entregam o resultado necessário.
5. Não adicionar chamadas automáticas recorrentes de IA sem necessidade comprovada.
6. Limitar payload, frequência e tamanho das respostas.
7. Nunca chamar IA para tarefas determinísticas que o código pode resolver.

## Pensar comigo

`ThinkingAssistant` é o componente global de conversa contextual do André OS. Ele não deve ser tratado como um chat genérico colocado sobre cada tela.

Responsabilidades atuais:

- existir uma única vez no sistema;
- identificar automaticamente a página e o módulo atuais;
- reconhecer o item aberto quando houver chamado, campanha, conteúdo, demanda ou implantação selecionada;
- apresentar ao usuário qual contexto será usado;
- manter um rascunho separado para cada página ou item;
- montar um payload estável para a futura API;
- não chamar IA até que um `transport` seja conectado explicitamente.

Cada tela recebe um `page_id` único e pode pertencer a um `module_id` maior. Exemplo:

```js
ThinkingAssistant.registerPage({
  pageId: 'planet_marketing.inauguracoes',
  moduleId: 'planet_marketing',
  label: 'Inaugurações',
  moduleLabel: 'Planet Marketing Hub',
  contextPath: ['Planet Marketing Hub', 'Implantações e inaugurações'],
  match: () => location.hash === '#inauguracoes',
});
```

Novas fontes de contexto entram por providers reutilizáveis:

```js
ThinkingAssistant.registerContextProvider('documents', () => ({
  selected: [],
  related: [],
}));
```

A conexão futura com a IA deve ser feita em um único ponto:

```js
ThinkingAssistant.setTransport(async (payload) => {
  return fetch('/api/andre-os/pensar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then((response) => response.json());
});
```

Nenhuma página deve criar seu próprio chat, drawer ou chamada direta para IA. Páginas novas registram apenas identidade e providers de contexto.

## Atualização do Radar

- Não usar cron para vigiar o Marketing Hub nesta fase.
- Atualizar imediatamente quando o usuário abre ou retorna para a aba.
- Enquanto a aba estiver visível e online, atualizar no máximo uma vez por minuto.
- Pausar completamente quando a aba estiver oculta, o aparelho estiver bloqueado ou não houver conexão.
- A atualização automática usa somente regras e leitura das fontes; ela nunca chama IA.

## Segurança mínima

- Todas as rotas `/api/hub/*`, exceto a própria sessão, exigem sessão autenticada.
- Todas as rotas `/api/sults/*` exigem a mesma sessão.
- As rotas de IA têm limite gratuito em memória para conter chamadas repetidas ou abuso.
- O login limita tentativas repetidas.
- Tokens, senhas e chaves ficam apenas nos bindings e secrets da Cloudflare.

## Regra de arquitetura

Não criar novos arquivos para corrigir visualmente um módulo antigo sem antes verificar se a correção pertence ao arquivo original.

Para cada melhoria:

1. Reutilizar componentes e normalizadores existentes.
2. Evitar duas funções diferentes transformando a mesma fonte de dados.
3. Separar dados, regras, apresentação e integrações.
4. Fazer mudanças estruturais em branch própria.
5. Preservar comportamento existente durante refatorações.
6. Remover o código substituído depois de validar o novo fluxo.

## Diagnóstico

A rota autenticada `/api/hub/health` informa apenas se as conexões principais estão disponíveis:

- acesso;
- Workers AI;
- dados compartilhados;
- SULTS;
- R2.

Ela não exibe valores de secrets ou tokens.

## Próxima consolidação técnica

A fila ativa e a análise do Radar usam uma única coleta e normalização das fontes. O próximo passo é evoluir o contexto operacional e o cockpit de decisão sem voltar a duplicar regras entre módulos.
