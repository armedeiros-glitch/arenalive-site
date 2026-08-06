# Caça Leads automático v1

## Objetivo

Descobrir empresas públicas com potencial de aderência à Planet Chocolate sem depender de CSV ou cadastro manual.

O motor apenas cria candidatos para revisão. Aprovação e promoção para o funil oficial continuam humanas e explícitas.

## Praça piloto

- Joinville / SC

## Segmentos iniciais

- cafeteria;
- sorveteria;
- açaí;
- chocolateria;
- confeitaria;
- alimentação em shopping.

## Fluxo

1. Worker executa diariamente às 08:00 no horário de Brasília;
2. Google Places Text Search consulta os segmentos configurados;
3. os resultados são normalizados para `Candidate`;
4. resultados repetidos entre consultas são eliminados pelo `place.id`;
5. o domínio existente elimina duplicados contra candidatos e leads;
6. candidatos novos entram com `reviewStatus: pending`;
7. André revisa, aprova ou descarta;
8. somente candidatos aprovados podem ser promovidos manualmente para Leads.

## Dados coletados

Somente dados empresariais públicos retornados pelo Google Places:

- nome comercial;
- telefone comercial público;
- site público;
- cidade e estado;
- endereço;
- categoria;
- avaliação e quantidade de avaliações;
- URL pública no Google Maps.

Cada informação relevante é armazenada como evidência com fonte e confiança.

## Controles de custo

- máximo de 12 consultas por execução;
- máximo de 20 resultados por consulta;
- padrão inicial de 8 resultados por consulta;
- apenas a primeira página de cada pesquisa é utilizada;
- máscara de campos explícita, sem wildcard;
- duas consultas simultâneas no máximo;
- uma execução em andamento bloqueia outra por 20 minutos.

## Componentes

### Núcleo

`functions/_lib/planet-lead-hunt.js`

Responsável por configuração, agenda lógica, histórico, trava, deduplicação entre consultas e importação no domínio existente.

### Provedor

`functions/_lib/planet-lead-hunt-google-places.js`

Responsável pela chamada à Places API e transformação dos estabelecimentos em candidatos auditáveis.

### Endpoint autenticado

`/api/hub/planet/expansion/hunt`

- `GET`: retorna configuração e última execução;
- `POST`: executa uma busca manual usando a sessão atual do André OS.

### Worker agendado

`workers/planet-caca-leads/index.js`

Executa pelo Cron Trigger e pode ser acionado manualmente com token próprio.

## Configuração Cloudflare

### Pages

Adicionar o secret:

- `GOOGLE_PLACES_API_KEY`

Variáveis opcionais:

- `PLANET_LEAD_HUNT_CITIES=Joinville|SC`
- `PLANET_LEAD_HUNT_SEGMENTS=cafeteria,sorveteria,açaí,chocolateria,confeitaria,alimentação em shopping`
- `PLANET_LEAD_HUNT_MAX_RESULTS=8`

### Worker

- vincular `PLANET_HUB_DATA` ao mesmo namespace KV usado pelo André OS;
- adicionar `GOOGLE_PLACES_API_KEY` como secret;
- adicionar `CACA_LEADS_RUN_TOKEN` como secret;
- publicar o Worker da pasta `workers/planet-caca-leads`.

## Segurança

- nenhuma coleta de dado privado;
- nenhuma promoção automática;
- nenhum banco paralelo;
- nenhuma alteração no RD Station;
- nenhuma alteração no funil de Leads;
- falha em uma consulta não invalida resultados válidos de outras consultas;
- histórico registra consultas, encontrados, criados, duplicados, inválidos e falhas.
