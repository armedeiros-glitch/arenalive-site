# André OS · navegação mobile v3

## Objetivo

Reorganizar o mobile pela mesma lógica mental já consolidada no André OS: primeiro o ambiente, depois as gavetas. O celular deixa de expor Operação da rede, Marketing e Expansão no mesmo nível da Home.

## Estrutura

### Raiz

- Início
- Trabalho → Planet Chocolate
- Laboratório
- Vida pessoal

### Planet Chocolate

- Visão Geral
- Marketing
- Campanhas
- Inaugurações
- Chamados
- Aquisição
- Expansão
- Planet 5 Estrelas
- Central Planet

## Implementação

- `andre-os-mobile-shell-v2.js` passa a montar a hierarquia mobile;
- `andre-os-mobile-navigation-v2.css` vira o único dono visual da navegação mobile;
- `andre-os-mobile-gavetas-v1.css` fica restrito à responsividade das páginas;
- a navegação antiga continua no DOM para compatibilidade com os módulos existentes, mas é ocultada somente em `html.aos-mobile`;
- as rotas atuais são reutilizadas, sem criar outra fonte de navegação ou regra de negócio.

## Preservado

- desktop;
- APIs e KV;
- Radar/Todoist;
- SULTS;
- RD Station;
- módulos de Campanhas, Chamados, Inaugurações, Aquisição, Expansão, Planet 5 Estrelas e Central;
- swipe lateral, backdrop, foco e acessibilidade do menu mobile.

## Validação

- abrir menu na Home mostra somente Início e os três ambientes;
- tocar em Planet Chocolate abre o segundo nível sem fechar a sidebar;
- voltar retorna aos ambientes;
- tocar em uma gaveta navega e fecha a sidebar;
- abrir o menu dentro de uma página Planet volta direto ao nível Planet;
- Laboratório e Pessoal continuam abrindo suas rotas;
- nenhum item antigo de Operação/Marketing/Expansão aparece no primeiro nível;
- desktop permanece visualmente idêntico.
