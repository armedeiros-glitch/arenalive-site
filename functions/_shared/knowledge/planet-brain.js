export const PLANET_BRAIN_VERSION = '1.0.0';

const sections = {
  company: {
    label: 'Empresa e operação',
    keywords: ['planet', 'empresa', 'rede', 'franquia', 'franqueado', 'unidade', 'operação', 'marketing'],
    content: {
      company: 'Planet Chocolate',
      business: 'Rede de franquias de alimentação e sobremesas.',
      marketing_owner: 'André coordena a operação de marketing no contexto do André OS.',
      operating_model: [
        'O SULTS é a fonte oficial de chamados e interações.',
        'O André OS organiza contexto, prioridade e próximo movimento, sem substituir o SULTS.',
        'A agenda deve ser única e integrada; separações pessoal/profissional são apenas visões.',
      ],
      goals: [
        'Aumentar a capacidade de execução do marketing.',
        'Reduzir retrabalho e demandas sem contexto.',
        'Acelerar inaugurações e materiais das unidades.',
        'Dar visibilidade a bloqueios, responsáveis, prazos e próximos movimentos.',
      ],
    },
  },
  brand: {
    label: 'Marca e comunicação',
    keywords: ['marca', 'manual', 'identidade', 'logo', 'fonte', 'tipografia', 'arte', 'post', 'cardápio', 'visual', 'bandeira', 'pote', 'chama'],
    content: {
      fixed_rules: [
        'Não usar bandeiras de países na identidade ou nas peças.',
        'Os potes devem ser representados como potes de papel quando essa for a embalagem oficial.',
        'Não representar produtos sobre fogo, vela, chama ou réchaud.',
        'Antes de criar ou revisar uma peça, respeitar o manual da marca e os arquivos oficiais disponíveis.',
      ],
      creative_direction: [
        'Priorizar comunicação apetitosa, clara e comercial, sem perder o padrão institucional.',
        'Evitar peças genéricas que poderiam pertencer a qualquer marca.',
        'Em cardápios, equilibrar leitura, hierarquia e apelo visual de produto.',
      ],
      uncertainty_rule: 'Quando fonte, cor, logo, embalagem ou aplicação não estiverem confirmados, pedir o arquivo oficial ou sinalizar a ausência. Não inventar padrão de marca.',
    },
  },
  tickets: {
    label: 'Chamados e SULTS',
    keywords: ['chamado', 'ticket', 'sults', 'responsável', 'prazo', 'interação', 'travando', 'bloqueio', 'cobrar', 'aprovação'],
    content: {
      source_of_truth: 'SULTS',
      interpretation_rules: [
        'Usar os dados ao vivo do chamado como fonte principal quando estiverem disponíveis.',
        'A última interação útil vale mais do que mensagens sociais como “ok”, “obrigado” ou “bom dia”.',
        'Separar trabalho executável de cobrança, espera, aprovação e dependência externa.',
        'Um chamado bloqueado não deve competir como foco de execução. O próximo movimento pode ser cobrar, pedir informação, aguardar ou aprovar.',
        'Nunca concluir que alguém está atrasado sem comparar prazo, status e última interação.',
      ],
      default_analysis: [
        'Identificar o pedido real.',
        'Identificar quem está com a bola.',
        'Verificar prazo e última movimentação relevante.',
        'Explicar o bloqueio, se houver.',
        'Recomendar um próximo movimento concreto.',
      ],
    },
  },
  inaugurations: {
    label: 'Implantações e inaugurações',
    keywords: ['implantação', 'inauguração', 'inaugural', 'abertura', 'nova unidade', 'influenciador', 'praça', 'evento'],
    content: {
      scope: [
        'Inaugurações envolvem planejamento, materiais, divulgação local, influenciadores e alinhamento com a unidade.',
        'Existem ações exclusivas para inauguração e campanhas gerais da rede; não misturar os dois grupos.',
      ],
      influencer_reference: [
        'A referência operacional discutida é trabalhar normalmente com 2 influenciadores por ação.',
        'Algumas praças podem usar 3 influenciadores.',
        'Apresentar também o valor unitário por influenciador quando houver orçamento ou comparação.',
      ],
      pricing_history: {
        previous_charge: 'R$ 4.100 por franqueado foi identificado como insuficiente para cobrir impostos e custos operacionais em vários casos.',
        evaluation_goal: 'Usar a média real das últimas inaugurações e a variação por praça para recomendar novo preço.',
        candidate_prices_discussed: ['R$ 4.700', 'R$ 5.000', 'R$ 5.500'],
        rule: 'Não escolher preço definitivo sem os cálculos consolidados e sem deixar clara a variação entre praças.',
      },
      operational_checks: [
        'Confirmar praça, data, escopo e responsável.',
        'Separar o que é material padrão, ação local e contratação externa.',
        'Verificar dependências e aprovações antes de cobrar produção.',
      ],
    },
  },
  campaigns: {
    label: 'Campanhas e calendário',
    keywords: ['campanha', 'calendário', 'data', 'natal', 'páscoa', 'black friday', 'férias', 'shopping', 'ação local'],
    content: {
      principles: [
        'Diferenciar campanha nacional, ação local e material de inauguração.',
        'Campanhas passadas devem continuar consultáveis, mas visualmente secundárias nas telas.',
        'Antes de recomendar ação, considerar data, praça, público e capacidade operacional da unidade.',
      ],
      examples_known: [
        'Férias na Planet: ação promocional para grupos, usada em Patos de Minas.',
        'Ações voltadas a colaboradores de shopping podem ser usadas em unidades com baixo movimento durante a semana.',
      ],
      data_rule: 'Datas e campanhas específicas devem vir do calendário atual do sistema ou dos documentos oficiais. O Brain não deve inventar calendário vigente.',
    },
  },
  products_and_materials: {
    label: 'Produtos, materiais e pontos de venda',
    keywords: ['produto', 'carrinho', 'quiosque', 'pote', 'fondue', 'sorvete', 'açaí', 'café', 'milkshake', 'barrinha', 'fidelidade'],
    content: {
      known_portfolio: ['Fondue', 'Sorvetes', 'Açaí', 'Cafés'],
      smart_cart: {
        reference_price: 'R$ 48.900',
        reference_configuration: '2 cascatas, pipoqueira e máquina de algodão-doce, com aproximadamente 2 m.',
        caution: 'Preço e configuração devem ser confirmados antes de usar comercialmente, pois podem mudar.',
      },
      loyalty_bar_reference: [
        'Cartão no formato aproximado de 2 × 3,5 polegadas.',
        'Sabores trabalhados: Nutella, Pistache e Confete.',
        'Validade pode usar campos em branco para preenchimento à caneta e reaproveitamento em campanhas.',
      ],
    },
  },
  franchise_management: {
    label: 'Gestão da unidade e franqueados',
    keywords: ['franqueado', 'dre', 'ticket médio', 'ponto de equilíbrio', 'matéria-prima', 'mão de obra', 'documento', 'quinto dia útil'],
    content: {
      monthly_documents: [
        'Metas x Relatório Analítico.',
        'DRE, recomendável.',
        'Contagem do ponto.',
        'Custo médio de produtos após alimentação dos dados.',
      ],
      management_questions: [
        'Qual é o valor do ticket médio esperado?',
        'Qual tamanho de pote possui maior venda na rede?',
        'Qual é o ponto de equilíbrio da unidade?',
        'Qual é o limite percentual de matéria-prima?',
        'Qual é o limite percentual de mão de obra?',
      ],
      service_standard: [
        'Na chegada do cliente: “bom dia”.',
        'Na saída: “volte sempre”.',
      ],
    },
  },
  landing_and_sales: {
    label: 'Landing page, vendas e expansão',
    keywords: ['landing', 'rd station', 'lead', 'franquia', 'expansão', 'depoimento', 'site', 'conversão', 'venda'],
    content: {
      landing_page: [
        'Integração com RD Station é requisito conhecido.',
        'Evitar repetição de mensagem no hero e blocos redundantes.',
        'Priorizar títulos legíveis, fotos bem enquadradas, selos centralizados e mix completo.',
        'Incluir carrinho smart quando fizer parte da oferta atual.',
      ],
      known_assets: [
        'Depoimentos de Carlos Ferreira e Flávia Rodrigues foram citados como materiais disponíveis.',
        'Existe um vídeo institucional citado para uso na página.',
      ],
      caution: 'Links, versões e disponibilidade dos ativos devem ser confirmados nos documentos atuais antes da publicação.',
    },
  },
  decision_rules: {
    label: 'Regras de decisão do André OS',
    keywords: ['prioridade', 'próximo passo', 'o que fazer', 'foco', 'decisão', 'organizar', 'executar'],
    content: {
      rules: [
        'Dar uma recomendação principal, não uma lista infinita de possibilidades.',
        'Não inventar tarefa, prazo, responsável, aprovação ou documento.',
        'Quando faltar dado crítico, apontar exatamente qual dado falta e quem pode fornecê-lo.',
        'Contexto confirmado tem prioridade sobre sugestões automáticas.',
        'Sugestões nunca devem alterar SULTS, tarefa, foco ou prioridade sem confirmação explícita.',
        'Dados atuais da página e integrações prevalecem sobre conhecimento permanente do Brain.',
      ],
      answer_shape: [
        'Situação atual.',
        'O que está travando ou exigindo atenção.',
        'Próximo movimento recomendado.',
        'Informação faltante, somente quando necessária.',
      ],
    },
  },
};

const normalize = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const scoreSection = (section, haystack, pageId) => {
  let score = 0;
  for (const keyword of section.keywords) {
    if (haystack.includes(normalize(keyword))) score += keyword.length > 8 ? 3 : 2;
  }
  if (/chamados?|tickets?|sults/.test(pageId) && section === sections.tickets) score += 12;
  if (/inaugur|implanta/.test(pageId) && section === sections.inaugurations) score += 12;
  if (/calend|campanh/.test(pageId) && section === sections.campaigns) score += 12;
  if (/conteudo|material|cardapio/.test(pageId) && section === sections.brand) score += 8;
  return score;
};

export const selectPlanetKnowledge = ({ prompt = '', history = [], context = {}, maxSections = 4 } = {}) => {
  const pageId = normalize([context.page_id, context.page_label, context.module_id].filter(Boolean).join(' '));
  const haystack = normalize([
    prompt,
    ...history.slice(-4).map((entry) => entry?.content || ''),
    context.page_id,
    context.page_label,
    context.screen_title,
    context.selected_item?.title,
    context.selected_item?.type,
  ].filter(Boolean).join(' '));

  const mandatory = ['company', 'decision_rules'];
  const ranked = Object.entries(sections)
    .filter(([key]) => !mandatory.includes(key))
    .map(([key, section]) => ({ key, section, score: scoreSection(section, haystack, pageId) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, maxSections - mandatory.length));

  const selectedKeys = [...mandatory, ...ranked.map((entry) => entry.key)];
  const selected = Object.fromEntries(selectedKeys.map((key) => [key, {
    label: sections[key].label,
    content: sections[key].content,
  }]));

  return {
    brain: 'planet',
    version: PLANET_BRAIN_VERSION,
    selected_sections: selectedKeys,
    precedence: [
      'Dados atuais do SULTS, Radar, página e item aberto.',
      'Contexto confirmado pelo usuário.',
      'Planet Brain como conhecimento permanente e referência operacional.',
    ],
    knowledge: selected,
  };
};

export const getPlanetBrainManifest = () => ({
  brain: 'planet',
  version: PLANET_BRAIN_VERSION,
  section_count: Object.keys(sections).length,
  sections: Object.fromEntries(Object.entries(sections).map(([key, section]) => [key, section.label])),
});
