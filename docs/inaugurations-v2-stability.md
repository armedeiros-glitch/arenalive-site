# Inaugurações V2 - contrato de estabilidade

## Objetivo

Cada implantação possui um único centro operacional:

1. selecionar a unidade;
2. acompanhar o Checklist;
3. abrir o Financeiro como ferramenta de apoio da mesma implantação.

Não existe uma segunda tela operacional de Ações Inaugurais.

## Fontes de verdade

### Implantação e Checklist

- Endpoint: `/api/hub/inauguracoes`
- Armazenamento compartilhado: `PLANET_HUB_DATA`
- Chave: `planet-hub:inauguracoes:v1`
- Fallback local: `planet-hub-inaugurations-v2`

O Checklist mantém ordem, responsável, antecedência, status e progresso.

O texto `Separar brindes/cupons` permanece no dado histórico e aparece na interface como `50 potes P para degustação`. Essa troca é somente visual para preservar o item, o índice e a conclusão já registrada.

### Financeiro

- Endpoint: `/api/hub/financeiro`
- Armazenamento compartilhado: `PLANET_HUB_DATA`
- Chave: `planet-hub:financeiro:v1`
- Dados sensíveis de fornecedores: criptografados antes de entrar no KV

Fornecedores são reutilizáveis pela operação. Pagamentos são vinculados à implantação por `inaugurationId`.

Pagamentos manuais recebem um `actionId` técnico estável, sem alterar IDs antigos.

## Cálculos

### Valor solicitado

Soma dos pagamentos da implantação, exceto registros com status `rejected`.

### Saldo disponível

```text
verba do pacote - maior valor entre gasto consolidado e pagamentos ativos
```

A regra evita contar duas vezes um gasto já representado nos pagamentos e reserva os valores ainda pendentes.

### Status

- `draft`: rascunho
- `docs_pending`: documentação pendente
- `awaiting_approval`: aguardando aprovação
- `sent_finance`: enviado ao financeiro
- `paid`: pago
- `rejected`: recusado e fora do saldo comprometido

## Persistência e conflitos

Implantações usam revisão otimista e reconciliação por implantação.

O Financeiro usa revisão otimista e reconciliação pelo registro alterado:

- ao editar um fornecedor, somente aquele fornecedor local vence o conflito;
- ao editar um pagamento ou status, somente aquele pagamento local vence;
- os demais registros são atualizados pela versão remota;
- após duas novas colisões consecutivas, o sistema interrompe o salvamento e pede para reabrir o painel.

Formulários de fornecedor e pagamento só fecham depois da confirmação da API. Em falha, a alteração local é desfeita e o erro permanece visível.

## Suíte automatizada

Executar:

```bash
node tests/inaugurations-v2-suite.mjs
```

Cobertura:

- workspace único e remoção da navegação paralela;
- troca visual do item do Checklist;
- persistência, ordem e status do Checklist;
- conflito de revisão das implantações;
- vínculo técnico de pagamentos manuais;
- saldo, pagamentos recusados e atualização de verba;
- isolamento de pagamentos por implantação;
- exportação limitada à implantação aberta;
- conflito financeiro sem perda silenciosa;
- rollback de fornecedor, pagamento e status;
- consistência das duas entradas e versões de cache.

## Checklist manual no site publicado

### Checklist

- [ ] Abrir uma implantação e confirmar que somente o Checklist aparece.
- [ ] Marcar e desmarcar uma etapa.
- [ ] Recarregar a página e confirmar a persistência.
- [ ] Confirmar `50 potes P para degustação` na posição histórica do item.
- [ ] Confirmar que progresso e quantidade concluída não mudaram indevidamente.

### Financeiro

- [ ] Abrir o Financeiro pelo botão compacto da implantação.
- [ ] Cadastrar e editar um fornecedor.
- [ ] Criar e editar um pagamento.
- [ ] Confirmar que o pagamento aparece somente na implantação correta.
- [ ] Alterar os status até `paid` e `rejected`.
- [ ] Confirmar o recálculo imediato dos indicadores e do saldo.
- [ ] Alterar a verba e confirmar o novo saldo.
- [ ] Exportar e conferir que o CSV contém somente a implantação aberta.
- [ ] Fechar, reabrir e recarregar para confirmar a persistência.

### Regressão

- [ ] Validar o fluxo no desktop.
- [ ] Validar abertura, rolagem e formulários no mobile.
- [ ] Confirmar Home, Radar, Chamados e dados do SULTS funcionando normalmente.
- [ ] Confirmar ausência de erros novos no console e na aba Network.

## Critério de congelamento

O módulo pode ser considerado estável quando:

1. a suíte automatizada passar;
2. o checklist manual for concluído no ambiente publicado;
3. não houver perda de dados, mistura entre unidades ou erro de cálculo;
4. não houver regressão no desktop, mobile ou módulos externos.

Depois disso, mudanças em Inaugurações devem ser tratadas como nova evolução de produto, não como continuação desta estabilização.
