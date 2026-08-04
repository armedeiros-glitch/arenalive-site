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

A fila ativa e a análise do Radar repetem parte da coleta e normalização das mesmas fontes. A próxima refatoração deve criar um único serviço de dados do Radar e fazer os dois módulos consumirem o mesmo resultado, sem alterar a interface ou as regras atuais.
