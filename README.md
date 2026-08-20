# André OS

Este repositório começou como o site da Arena Live e hoje hospeda o André OS na raiz do projeto.

## Entrada oficial

- `/` é a entrada oficial da aplicação;
- `/planet-hub/` redireciona para `/`;
- `/planet-hub/assets/` continua sendo o diretório ativo dos assets;
- rotas antigas permanecem classificadas até a confirmação de uso.

## Documentação

- [Visão e arquitetura de destino](docs/vision.md)
- [Inventário, responsabilidades e regras de manutenção](docs/system-inventory.md)
- [Auditoria estrutural do Financeiro](docs/finance-structural-audit.md)

## Fronteira de trabalho

- Estrutura: APIs, dados, integrações, Runtime, cache, persistência e segurança.
- Arquitetura Visual: layout, CSS, navegação, desktop, mobile e acabamento visual.

Nenhuma migração deve recriar o sistema em paralelo ou interromper módulos estáveis.
