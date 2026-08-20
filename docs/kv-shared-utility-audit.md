# André OS · Auditoria do utilitário KV compartilhado

Baseline: `main` após o PR #90, em 5 de agosto de 2026.

Esta auditoria é somente estrutural. Nenhuma API, chave KV, payload ou dado existente foi alterado.

## Escopo lido

- `functions/api/hub/inauguracoes.js`
- `functions/api/hub/conteudos.js`
- `functions/api/hub/campanhas.js`
- `functions/api/hub/demandas-internas.js`
- `functions/api/hub/financeiro.js`

## Duplicação confirmada

As quatro APIs de coleção simples repetem o mesmo ciclo:

```text
resolver PLANET_HUB_DATA
→ validar Content-Length
→ interpretar JSON
→ exigir payload.data[]
→ limitar quantidade
→ ler documento KV
→ comparar baseRevision
→ responder 409 com documento atual
→ normalizar itens
→ gerar revision e updatedAt
→ serializar
→ medir bytes normalizados
→ gravar no KV
→ responder storage: shared
```

Também repetem:

- headers JSON com `Cache-Control: no-store`;
- helper de resposta JSON;
- documento vazio com `revision`, `updatedAt` e `data`;
- tratamento de erro 500;
- resposta OPTIONS 204;
- mensagens equivalentes para KV ausente, JSON inválido e payload excessivo.

## O que deve permanecer em cada domínio

O utilitário não deve conhecer campos de inaugurações, conteúdos, campanhas ou demandas.

Cada rota continua responsável por:

- `STORAGE_KEY`;
- `MAX_ITEMS` e `MAX_BODY_BYTES`;
- `normalizeItem`;
- validações específicas;
- mensagens de domínio;
- transformação adicional de timestamps quando necessária.

## Contrato inicial proposto

Criar `functions/_lib/hub-kv-document.js` com funções estreitas:

```text
json(body, status)
getHubStore(env)
readCollectionDocument({ store, key, maxItems, normalizeItem })
parseCollectionRequest({ request, maxBodyBytes, maxItems, itemLabel })
hasRevisionConflict(baseRevision, currentRevision)
createCollectionDocument({ data, normalizeItem, updatedAt })
serializeWithinLimit(document, maxBodyBytes)
writeCollectionDocument({ store, key, document, maxBodyBytes })
optionsResponse()
```

O contrato deve continuar devolvendo o documento atual no conflito `409`. A rota monta a mensagem de erro e a resposta final.

## Ordem segura de migração

1. criar o utilitário com testes unitários, sem conectar nenhuma rota;
2. migrar `campanhas.js`, por possuir menor limite e normalização simples;
3. migrar `conteudos.js`;
4. migrar `demandas-internas.js`;
5. migrar `inauguracoes.js` por último entre as coleções simples;
6. comparar respostas antes/depois para `200`, `400`, `409`, `413`, `500` e `503`;
7. só então avaliar Planet Leads e notificações.

Cada migração deve ocorrer em PR separado ou em commits facilmente reversíveis.

## Financeiro fica fora da primeira migração

`financeiro.js` compartilha partes do envelope, mas possui diferenças relevantes:

- exige senha, KV e chave de criptografia;
- trabalha com `suppliers[]` e `payments[]`, não `data[]`;
- criptografa CPF/CNPJ, Pix e dados bancários antes da gravação;
- descriptografa na leitura;
- valida vínculos entre pagamentos e fornecedores;
- possui limites separados para as duas coleções;
- responde `configured`, não `storage`.

Forçar o Financeiro no primeiro contrato criaria abstração genérica demais. Ele poderá reutilizar apenas helpers realmente universais depois que o utilitário estiver estável.

## Critérios de aceitação

- nenhuma chave KV muda;
- nenhum formato armazenado muda;
- nenhuma normalização muda;
- conflitos continuam retornando a revisão e os dados atuais;
- respostas e códigos HTTP permanecem equivalentes;
- payload medido antes e depois da normalização;
- `Cache-Control: no-store` preservado;
- erros internos não expõem dados armazenados;
- testes cobrem documento vazio, limite, conflito e falha de gravação.

## Decisão

A primeira implementação será uma biblioteca pequena para documentos de coleção `data[]`. Não será um framework genérico de KV e não absorverá lógica de domínio.
