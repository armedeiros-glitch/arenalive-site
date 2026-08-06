# Caça Leads automático v1

## Objetivo

Descobrir empresas públicas com potencial de aderência à Planet Chocolate sem depender de CSV ou cadastro manual.

O motor apenas cria candidatos para revisão. Aprovação e promoção para o funil oficial continuam humanas e explícitas.

## Praça piloto

- Joinville / SC;
- centro aproximado: latitude `-26.3045`, longitude `-48.8487`;
- raio inicial: 24 km.

## Segmentos iniciais

- cafeteria;
- sorveteria;
- açaí;
- chocolateria;
- confeitaria;
- alimentação em shopping.

## Fluxo

1. Worker executa diariamente às 08:00 no horário de Brasília;
2. uma consulta Overpass busca os segmentos configurados ao redor da praça;
3. elementos do OpenStreetMap são normalizados para `Candidate`;
4. resultados repetidos são eliminados por `type/id` do OpenStreetMap;
5. o domínio existente elimina duplicados contra candidatos e leads;
6. candidatos novos entram com `reviewStatus: pending`;
7. André revisa, aprova ou descarta;
8. somente candidatos aprovados podem ser promovidos manualmente para Leads.

## Dados utilizados

Somente dados empresariais públicos disponíveis no OpenStreetMap:

- nome comercial;
- telefone comercial público, quando informado;
- e-mail comercial público, quando informado;
- site público, quando informado;
- cidade e estado;
- endereço;
- categoria;
- URL do elemento no OpenStreetMap.

Cada informação relevante é armazenada como evidência com fonte e confiança.

## Licença e atribuição

Os candidatos mantêm:

- origem `openstreetmap`;
- identificador público `type/id`;
- URL do elemento;
- atribuição `© OpenStreetMap contributors`;
- evidência ligada à página oficial de copyright e licença.

A atribuição precisa continuar visível caso esses dados sejam exibidos fora do André OS. Antes de distribuir publicamente uma base derivada, as obrigações da ODbL devem ser avaliadas para esse uso específico.

## Controles operacionais

- máximo de quatro praças por execução;
- uma requisição Overpass por praça;
- máximo de 100 resultados por praça;
- padrão inicial de 40 resultados por praça;
- execução sequencial, sem rajada paralela;
- timeout de 25 segundos por consulta;
- uma execução em andamento bloqueia outra por 20 minutos;
- falha em uma praça não elimina candidatos válidos das demais.

## Componentes

### Núcleo

`functions/_lib/planet-lead-hunt.js`

Responsável por configuração, histórico, trava, deduplicação entre consultas e importação no domínio existente.

### Provedor

`functions/_lib/planet-lead-hunt-openstreetmap.js`

Responsável pela consulta Overpass, atribuição e transformação dos estabelecimentos em candidatos auditáveis.

### Endpoint autenticado

`/api/hub/planet/expansion/hunt`

- `GET`: retorna configuração e última execução;
- `POST`: executa uma busca manual usando a sessão atual do André OS.

### Worker agendado

`workers/planet-caca-leads/index.js`

Executa pelo Cron Trigger e pode ser acionado manualmente com token próprio.

## Configuração Cloudflare

### Pages

Variáveis opcionais:

- `PLANET_LEAD_HUNT_LOCATIONS=Joinville|SC|-26.3045|-48.8487|24000`
- `PLANET_LEAD_HUNT_SEGMENTS=cafeteria,sorveteria,açaí,chocolateria,confeitaria,alimentação em shopping`
- `PLANET_LEAD_HUNT_MAX_RESULTS=40`
- `OVERPASS_API_URL=https://overpass-api.de/api/interpreter`

Sem variáveis, o núcleo usa Joinville como praça padrão.

### Worker

- vincular `PLANET_HUB_DATA` ao mesmo namespace KV usado pelo André OS;
- adicionar `CACA_LEADS_RUN_TOKEN` como secret para a rota manual do Worker;
- publicar o Worker da pasta `workers/planet-caca-leads`.

Não existe chave externa obrigatória para o provedor OpenStreetMap/Overpass.

## Segurança

- nenhuma coleta de dado privado;
- nenhuma promoção automática;
- nenhum banco paralelo;
- nenhuma alteração no RD Station;
- nenhuma alteração no funil de Leads;
- cada candidato mantém origem e evidências;
- histórico registra encontrados, criados, duplicados, inválidos e falhas.

## Escala futura

A instância pública do Overpass é adequada apenas para o piloto de baixa frequência. Ao aumentar o número de cidades ou execuções, usar uma instância dedicada ou um provedor com capacidade contratada.
