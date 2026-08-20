# André OS · Auditoria estrutural do Financeiro

Baseline: `main` após o PR #85, em 5 de agosto de 2026.

Este documento registra o funcionamento estrutural atual do Financeiro. Não propõe alteração visual e não autoriza remoção automática de módulos. A aparência do painel e do documento impresso permanece sob responsabilidade da Arquitetura Visual.

## 1. Escopo auditado

### Front-end

- `planet-hub/assets/financeiro-v1.js`
- `planet-hub/assets/payment-request-print-v1.js`
- `planet-hub/assets/payment-quick-flow-v1.js`
- `planet-hub/assets/payment-print-compact-v1.js`
- `planet-hub/assets/payment-print-clean-v1.js`
- `planet-hub/assets/inauguration-workspace-v2.js`
- `planet-hub/assets/unified-hub-v1.js`
- `index.html`
- `planet-hub/assets/hub-access-v1.js`

### Back-end e testes

- `functions/api/hub/financeiro.js`
- `functions/_lib/hub-crypto.js`
- `functions/_lib/hub-auth.js`
- `tests/finance-balance-v1.test.mjs`
- `tests/finance-manual-payment-v1.test.mjs`
- PR #69 e seus testes de estabilidade financeira

## 2. Ordem atual de carregamento

A entrada oficial carrega os módulos financeiros nesta ordem:

```text
payment-print-compact-v1.js
→ payment-request-print-v1.js
→ payment-quick-flow-v1.js
→ payment-print-clean-v1.js
→ autenticação
→ unified-hub-v1.js
→ financeiro-v1.js
```

Os quatro primeiros scripts ficam ativos antes do painel principal ser montado. Eles esperam elementos aparecerem no DOM e registram listeners ou observadores globais.

## 3. Responsabilidade real de cada módulo

| Módulo | Responsabilidade atual | Estado estrutural |
| --- | --- | --- |
| `financeiro-v1.js` | Estado de fornecedores e pagamentos, painel por implantação, CRUD, status, saldo, CSV e integração com `/api/hub/financeiro`. | `ATIVO`, candidato a dono canônico do domínio financeiro. |
| `payment-request-print-v1.js` | Adiciona botão de solicitação nas linhas existentes, recarrega o financeiro e gera documento A4. | `ATIVO-SUPORTE`, duplica gerador e usa observador global. |
| `payment-quick-flow-v1.js` | Formulário combinado de fornecedor + pagamento, salvamento próprio e impressão imediata. | `TRANSITÓRIO`, possui outra política de persistência e outro gerador A4. |
| `payment-print-compact-v1.js` | Intercepta `window.open` e `document.write` para injetar CSS compacto. | `TRANSITÓRIO`, dependente da ordem de carregamento. |
| `payment-print-clean-v1.js` | Intercepta novamente `window.open`; remove blocos do HTML por regex e injeta CSS adicional. | `TRANSITÓRIO`, dependente do texto e da estrutura do template. |
| `functions/api/hub/financeiro.js` | Validação, criptografia, leitura e gravação do documento financeiro no KV. | `ATIVO`, base funcional relativamente coesa. |

## 4. Fluxos existentes

### 4.1 Painel financeiro da implantação

```text
botão financeiro da implantação
→ financeiro-v1.js
→ GET /api/hub/inauguracoes + GET /api/hub/financeiro
→ estado local de suppliers/payments/revision
→ painel, edição e PUT do documento completo
```

O saldo disponível considera o maior valor entre gasto real da implantação e pagamentos ativos cadastrados. Pagamentos recusados são excluídos do cálculo.

### 4.2 Solicitação a partir de pagamento já cadastrado

```text
payment-request-print-v1.js observa o DOM
→ encontra [data-finance-edit-payment]
→ injeta “Gerar solicitação”
→ abre popup
→ busca novamente /api/hub/financeiro
→ gera HTML A4
→ compact e clean alteram o documento durante document.write
```

### 4.3 Fluxo rápido fornecedor + pagamento + impressão

```text
clique em [data-generate-payment]
→ payment-quick-flow-v1.js
→ GET financeiro + inaugurações
→ formulário combinado
→ novo GET financeiro
→ merge local do fornecedor/pagamento
→ PUT documento completo
→ gera outro HTML A4
→ compact e clean alteram o documento
```

A origem ativa de `[data-generate-payment]` não foi encontrada nos módulos oficiais de Inaugurações auditados (`unified-hub-v1.js` e `inauguration-workspace-v2.js`). Isso não prova que o fluxo esteja morto, mas exige validação em runtime antes de mantê-lo ou removê-lo.

## 5. Duplicações confirmadas

### 5.1 Dois geradores completos do mesmo documento

`payment-request-print-v1.js` e `payment-quick-flow-v1.js` mantêm implementações próprias de:

- HTML completo da solicitação;
- CSS A4;
- cabeçalho e identificação do pedido;
- dados de unidade, ação, fornecedor e pagamento;
- formatação de moeda, data, CPF/CNPJ e texto multilinha;
- documento de carregamento;
- documento de erro;
- abertura e preenchimento do popup.

Os templates já apresentam pequenas diferenças de classes e conteúdo. As camadas posteriores precisam reconhecer variantes como `.meta`/`.doc-meta` e `.checks`/`.checkline`.

### 5.2 Helpers duplicados

Os módulos repetem:

- `esc`;
- `money`;
- normalização de CPF/CNPJ;
- formatação de datas;
- `apiJson`;
- leitura de financeiro;
- abertura e escrita de popup;
- mensagens de erro e bloqueio de pop-up.

### 5.3 Duas políticas de conflito

`financeiro-v1.js` e `payment-quick-flow-v1.js` escrevem no mesmo documento KV, mas tratam `409` de maneiras diferentes.

O fluxo rápido recarrega o documento e reaplica o fornecedor e o pagamento alterados antes de tentar novamente.

O painel principal, na versão atual, substitui o estado local pelos dados remotos e chama `saveFinance()` novamente. A intenção local pode ser perdida durante esse processo.

### 5.4 Duas interceptações globais de popup

`payment-print-compact-v1.js` substitui `window.open`.

Depois, `payment-print-clean-v1.js` substitui `window.open` novamente, usando a versão já modificada como “nativa”. O resultado depende da ordem definida no `index.html`.

Essa cadeia afeta qualquer popup de mesma origem criado depois do carregamento, mesmo que o filtro textual tente limitar a transformação a documentos financeiros.

## 6. Riscos estruturais priorizados

### P0 · Testes apontando para entrada removida

Os testes abaixo ainda tentam ler `planet-hub/index.html`:

- `tests/finance-balance-v1.test.mjs`
- `tests/finance-manual-payment-v1.test.mjs`

Esse arquivo foi removido quando `/` virou a entrada oficial. Os testes precisam ser atualizados antes de servirem como barreira de regressão.

### P1 · Perda de edição após conflito 409

No painel principal, o tratamento atual pode descartar a alteração local que provocou o conflito. O PR #69 tentou resolver isso com merge por IDs alterados e limite de tentativas.

O PR #69 não deve ser mesclado inteiro porque está desatualizado e também referencia a entrada removida. A regra de merge pode ser extraída e reimplementada sobre a `main` atual.

### P1 · Fornecedor pode fechar antes da confirmação

O cadastro/edição de fornecedor atualiza o estado local, fecha o modal e só depois aguarda o salvamento. Uma falha pode deixar a experiência sem retorno adequado e com estado local divergente.

### P1 · Mudança de status sem rollback

Ao alterar o status de um pagamento, a interface muda primeiro. Se o PUT falhar, a versão atual exibe `alert`, mas não restaura explicitamente o estado anterior.

### P1 · Template final definido por mutações posteriores

O documento que o usuário vê não é exatamente o HTML gerado pelos dois fluxos. Ele é o resultado de:

```text
template original
+ compactação injetada
- blocos removidos por regex
+ CSS clean
```

Uma mudança de texto, classe ou ordem pode fazer a limpeza parar de funcionar sem erro explícito.

### P2 · Estado e requisições duplicadas

Cada fluxo mantém seu próprio estado, faz novos GETs e implementa seu próprio salvamento. Isso aumenta a chance de telas diferentes trabalharem com revisões diferentes.

### P2 · Exportação contém dados sensíveis

O CSV exportado pelo painel inclui CPF/CNPJ, Pix e dados bancários descriptografados. A ação é explícita e local, mas deve continuar tratada como operação sensível, sem logs, cache ou download automático.

## 7. Avaliação do back-end

`functions/api/hub/financeiro.js` possui pontos positivos:

- exige autenticação configurada;
- exige KV e chave de criptografia;
- criptografa CPF/CNPJ, Pix e dados bancários;
- normaliza fornecedores e pagamentos;
- valida vínculo entre pagamento e fornecedor;
- usa `revision` para detectar conflito;
- limita quantidade e tamanho do documento.

O principal limite é o contrato de documento completo:

```text
PUT suppliers[] + payments[] + baseRevision
```

Esse modelo funciona para o volume atual, mas obriga todos os clientes a implementar merge corretamente. A primeira consolidação deve centralizar essa política sem alterar o formato armazenado.

## 8. Fronteira com a Arquitetura Visual

### Estrutura é responsável por

- fonte canônica de suppliers/payments/revision;
- conflito, retry e rollback;
- contrato do documento de pagamento;
- transformação de dados em um modelo pronto para renderização;
- abertura, erro e ciclo de vida do popup;
- testes de comportamento;
- remoção de interceptações globais;
- segurança de dados e exportação.

### Arquitetura Visual é responsável por

- composição do formulário e do painel;
- layout, tipografia, cores e espaçamento;
- aparência final do A4;
- decisão visual sobre declaração, assinaturas, protocolo e rodapé;
- comportamento visual mobile/desktop.

A consolidação estrutural deve preservar o HTML visual final até que a Arquitetura aprove qualquer mudança de aparência.

## 9. Arquitetura de destino

### 9.1 Repositório financeiro único

Criar uma única camada responsável por:

```text
load()
saveChanges({ suppliers, payments, changedSupplierIds, changedPaymentIds })
getSupplier(id)
getPayment(id)
getPaymentsByInauguration(id)
```

Ela deve manter a revisão atual, aplicar merge por IDs em `409`, limitar tentativas e devolver erro sem destruir a edição local.

### 9.2 Contrato único de documento

Separar três responsabilidades:

```text
payment + supplier
→ modelo normalizado do documento
→ template visual único
→ abertura/impressão explícita
```

Os dois fluxos devem chamar a mesma função. Nenhum módulo deve interceptar `window.open` ou `Document.prototype.write` globalmente.

### 9.3 Controlador financeiro canônico

`financeiro-v1.js` deve permanecer como dono do domínio ou ser substituído por um módulo canônico equivalente. O objetivo final é retirar responsabilidades financeiras espalhadas, não adicionar uma sexta camada corretiva.

## 10. Migração segura aprovada

### Etapa 0 · Corrigir a barreira de testes

- remover referências ao `planet-hub/index.html` dos testes;
- atualizar asserts de cache/versionamento para a entrada oficial;
- executar a suíte existente sem mudança de runtime.

### Etapa 1 · Centralizar persistência e conflitos

- extrair a política de leitura, merge, retry e rollback;
- conectar primeiro o painel principal;
- conectar depois o fluxo rápido;
- adicionar testes de duas edições concorrentes;
- manter o formato KV atual.

### Etapa 2 · Criar um único modelo de documento

- centralizar formatação e preparação dos dados;
- manter o template visual atual byte a byte quando possível;
- fazer os dois fluxos consumirem o mesmo gerador;
- validar fornecedor inexistente, popup bloqueado e erro da API.

### Etapa 3 · Absorver compact e clean no template final

- comparar o HTML original com o resultado após as duas mutações;
- incorporar o resultado final ao template oficial;
- obter validação visual da Arquitetura;
- remover `payment-print-compact-v1.js` e `payment-print-clean-v1.js` juntos;
- remover as duas referências do `index.html` no mesmo PR.

### Etapa 4 · Decidir o fluxo rápido

- localizar e validar em runtime a origem de `[data-generate-payment]`;
- se ativo, conectá-lo ao repositório e documento únicos;
- se órfão, remover o módulo e sua referência após teste de regressão.

### Etapa 5 · Consolidar o dono do domínio

- absorver decoração e listeners restantes no controlador financeiro;
- remover `MutationObserver` financeiro quando houver evento oficial de renderização;
- deixar um único ponto de entrada para ações financeiras.

## 11. Testes de aceitação obrigatórios

- cadastrar fornecedor novo;
- editar fornecedor existente;
- criar pagamento manual;
- criar pagamento ligado a uma ação inaugural;
- alterar status e simular falha de rede;
- simular `409` com edição concorrente em fornecedor diferente;
- simular `409` no mesmo pagamento;
- verificar saldo com pagamento recusado;
- gerar solicitação de pagamento já cadastrada;
- salvar e imprimir pelo fluxo rápido, caso continue ativo;
- bloquear popup e receber mensagem utilizável;
- imprimir em uma página A4 conforme aprovação visual;
- exportar CSV somente por ação explícita;
- confirmar que nenhum dado financeiro aparece em logs.

## 12. Decisões desta auditoria

- não refazer o Financeiro do zero;
- não alterar a aparência nesta fase;
- não mesclar o PR #69 inteiro;
- não remover módulos somente pelo nome;
- corrigir testes antes da refatoração;
- estabilizar persistência antes de consolidar impressão;
- retirar interceptações globais apenas quando o template final estiver validado;
- não criar um novo arquivo `fix`, `clean`, `compact` ou `stability` para contornar o desenho atual.
