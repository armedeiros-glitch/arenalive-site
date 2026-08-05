# André OS · Contrato compartilhado do documento de pagamento

Baseline: `main` após o PR #90, em 5 de agosto de 2026.

## Fonte canônica

`planet-hub/assets/payment-document-v1.js` é o dono estrutural do documento A4 de solicitação de pagamento.

Ele centraliza:

- escape de HTML;
- formatação de moeda, datas e CPF/CNPJ;
- texto multilinha;
- número da solicitação;
- documento de carregamento;
- documento de erro;
- HTML A4;
- escrita e ciclo de vida do popup.

## Consumidores

- `payment-request-print-v1.js` usa o modo `registered` para pagamentos já cadastrados;
- `payment-quick-flow-v1.js` usa o modo `quick` para salvar e imprimir pelo fluxo rápido.

Os consumidores não devem voltar a manter templates A4 próprios.

## Fronteira visual

As diferenças atuais entre os modos foram preservadas. O acabamento visual continua sob responsabilidade da Arquitetura Visual.

As camadas abaixo continuam transitórias e não foram absorvidas pelo contrato nesta fase:

- `payment-print-compact-v1.js`;
- `payment-print-clean-v1.js`.

Elas só devem ser removidas depois que a Arquitetura validar o resultado visual incorporado diretamente ao template canônico.

## Condição de evolução

Qualquer alteração futura no conteúdo ou na estrutura do A4 deve ocorrer primeiro em `payment-document-v1.js` e ser protegida por `tests/payment-document-shared-v1.test.mjs`.
