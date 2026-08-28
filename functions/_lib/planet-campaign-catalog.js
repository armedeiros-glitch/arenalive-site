const normalize = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

export const campaignId = (campaign = {}) => `${campaign.start || ''}__${normalize(campaign.name)}`;

const rawCatalog = [
  ['2026-01-01', '2026-01-31', 'Verão Planet', 'apoio', 'Campanha sazonal'],
  ['2026-02-14', '2026-02-14', 'Valentine’s Day', 'apoio', 'Portugal e EUA'],
  ['2026-02-24', '2026-02-24', 'Aniversário Planet', 'principal', 'Data da marca'],
  ['2026-03-01', '2026-03-31', 'Março Azul-Marinho', 'institucional', 'Conscientização sobre o câncer colorretal'],
  ['2026-03-15', '2026-03-15', 'Dia do Consumidor', 'data', 'Conteúdo e relacionamento'],
  ['2026-03-20', '2026-03-20', 'Dia da Felicidade', 'data', 'Conteúdo digital'],
  ['2026-03-28', '2026-03-28', 'Hora do Planeta', 'data', 'Ação às 20h30'],
  ['2026-04-01', '2026-04-30', 'Abril Azul', 'institucional', 'Conscientização sobre o autismo'],
  ['2026-03-16', '2026-04-05', 'Páscoa Planet', 'principal', 'Campanha nacional'],
  ['2026-04-14', '2026-04-14', 'Café · data promocional', 'data', 'Calendário de conteúdo'],
  ['2026-05-01', '2026-05-31', 'Maio Amarelo', 'institucional', 'Segurança no trânsito'],
  ['2026-05-10', '2026-05-10', 'Dia das Mães', 'apoio', '2º domingo de maio'],
  ['2026-06-01', '2026-06-30', 'Arraiá Planet', 'principal', 'Período definido pelo Marketing'],
  ['2026-06-01', '2026-06-30', 'Junho Vermelho', 'institucional', 'Doação de sangue'],
  ['2026-06-12', '2026-06-12', 'Dia dos Namorados', 'apoio', 'Brasil'],
  ['2026-07-01', '2026-07-31', 'Férias Escolares', 'apoio', 'Conforme calendário local'],
  ['2026-07-07', '2026-07-07', 'Dia Mundial do Chocolate', 'apoio', 'Oportunidade de produto'],
  ['2026-07-20', '2026-07-20', 'Dia do Amigo', 'data', 'Conteúdo e relacionamento'],
  ['2026-08-01', '2026-08-31', 'Agosto Lilás', 'institucional', 'Combate à violência contra a mulher'],
  ['2026-08-01', '2026-08-09', 'Mês dos Pais Planet', 'principal', 'Ativação durante agosto'],
  ['2026-08-11', '2026-08-11', 'Dia do Estudante', 'data', 'Conteúdo digital'],
  ['2026-09-01', '2026-09-30', 'Setembro Amarelo', 'institucional', 'Valorização da vida'],
  ['2026-09-15', '2026-09-15', 'Dia do Cliente', 'data', 'Relacionamento'],
  ['2026-09-21', '2026-09-21', 'Dia da Árvore', 'data', 'Conteúdo institucional'],
  ['2026-09-22', '2026-09-22', 'Primavera Planet', 'principal', 'Início da primavera'],
  ['2026-09-23', '2026-09-23', 'Dia do Sorvete', 'apoio', 'Data nacional'],
  ['2026-10-01', '2026-10-31', 'Outubro Rosa', 'institucional', 'Prevenção ao câncer de mama'],
  ['2026-10-01', '2026-10-01', 'Dia Internacional do Café', 'data', 'Conteúdo e PDV'],
  ['2026-10-01', '2026-10-12', 'Semana das Crianças', 'principal', 'Período de campanha'],
  ['2026-10-31', '2026-10-31', 'Halloween Planet', 'principal', 'Data comemorativa'],
  ['2026-11-01', '2026-11-30', 'Novembro Azul', 'institucional', 'Saúde do homem'],
  ['2026-11-27', '2026-11-27', 'Black Planet', 'principal', 'Black Friday 2026'],
  ['2026-12-01', '2026-12-31', 'Dezembro Vermelho', 'institucional', 'Prevenção ao HIV e outras ISTs'],
  ['2026-12-01', '2026-12-25', 'Natal Planet', 'principal', 'Campanha nacional'],
  ['2026-12-01', '2026-12-23', 'Amigo Secreto Planet', 'apoio', 'Confraternizações'],
  ['2026-12-31', '2026-12-31', 'Réveillon', 'data', 'Conteúdo de encerramento'],
];

export const CAMPAIGN_CATALOG_2026 = Object.freeze(rawCatalog.map(([start, end, name, type, note]) => Object.freeze({
  id: campaignId({ start, name }),
  start,
  end,
  name,
  type,
  note,
})));

export const campaignById = (id) => CAMPAIGN_CATALOG_2026.find((campaign) => campaign.id === String(id || '')) || null;
