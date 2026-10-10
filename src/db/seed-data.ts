/**
 * DEMONSTRATION DATA — fictional people, projects and organisations.
 * Any resemblance to real entities is coincidental. Dates are relative to the
 * moment the seed runs so the demo always looks current.
 */

export const DEMO_PASSWORD = "demo1234";

export const people = [
  { key: "helena", name: "Helena Vasconcelos", email: "investidor@demo.ncc", role: "investor", hue: 28, headline: "Investidora · Fundadora da No Competition Community", location: "Lisboa", bio: "Invisto em equipas que constroem algo tão bom que deixa de haver concorrência. Lanço desafios para encontrar essas equipas cedo.", skills: ["Investimento pré-seed", "Estratégia", "Go-to-market"] },
  { key: "marta", name: "Marta Quintela", email: "avaliador@demo.ncc", role: "evaluator", hue: 300, headline: "Avaliadora · Produto e crescimento", location: "Porto", bio: "15 anos a construir produtos digitais. Avalio clareza do problema e qualidade da execução.", skills: ["Produto", "Growth", "UX"] },
  { key: "tiago", name: "Tiago Brandão", email: "tiago@demo.ncc", role: "evaluator", hue: 190, headline: "Avaliador · Engenharia e dados", location: "Braga", bio: "CTO em duas startups. Olho para arquitectura, viabilidade técnica e capacidade de execução.", skills: ["Engenharia", "Dados", "Cloud"] },
  { key: "ana", name: "Ana Ribeiro", email: "membro@demo.ncc", role: "member", hue: 150, headline: "Fundadora da Voltaica · Engenheira de energia", location: "Lisboa", bio: "Engenheira electrotécnica. Trabalhei 6 anos em auditorias energéticas e vi as PME pagar demasiado por não terem dados.", skills: ["Energia", "Python", "Vendas B2B"] },
  { key: "bruno", name: "Bruno Costa", email: "bruno@demo.ncc", role: "member", hue: 210, headline: "Full-stack · Co-fundador da Voltaica", location: "Lisboa", bio: "Construo produtos web desde 2014. Gosto de entregar depressa e medir.", skills: ["TypeScript", "IoT", "Postgres"] },
  { key: "carolina", name: "Carolina Mendes", email: "carolina@demo.ncc", role: "member", hue: 340, headline: "Designer de produto · Balcão", location: "Coimbra", bio: "Design para negócios que não têm tempo para software complicado.", skills: ["Product design", "Pesquisa", "Figma"] },
  { key: "diogo", name: "Diogo Ferraz", email: "diogo@demo.ncc", role: "member", hue: 20, headline: "ML engineer · Balcão", location: "Coimbra", bio: "Modelos de linguagem aplicados a operações reais.", skills: ["ML", "LLMs", "Python"] },
  { key: "ines", name: "Inês Carvalho", email: "ines@demo.ncc", role: "member", hue: 265, headline: "Fundadora da Recibo Verde+ · Ex-contabilista", location: "Porto", bio: "Ajudei 300 independentes com impostos. Agora quero que não precisem de mim.", skills: ["Fiscalidade", "Fintech", "Operações"] },
  { key: "joao", name: "João Pires", email: "joao@demo.ncc", role: "member", hue: 100, headline: "Backend · Recibo Verde+", location: "Porto", bio: "APIs, integrações bancárias e testes automáticos.", skills: ["Go", "Open banking", "Segurança"] },
  { key: "leonor", name: "Leonor Santos", email: "leonor@demo.ncc", role: "member", hue: 5, headline: "Fundadora da Rota Curta", location: "Setúbal", bio: "Gestora de operações logísticas durante 8 anos.", skills: ["Logística", "Operações", "Excel avançado"] },
  { key: "miguel", name: "Miguel Almeida", email: "miguel@demo.ncc", role: "member", hue: 45, headline: "Engenheiro de software · Rota Curta", location: "Setúbal", bio: "Algoritmos de rotas e apps móveis.", skills: ["Kotlin", "Optimização", "Mapas"] },
  { key: "rita", name: "Rita Moura", email: "rita@demo.ncc", role: "member", hue: 320, headline: "Fundadora da Cuidar.app · Enfermeira", location: "Évora", bio: "Enfermeira em cuidados domiciliários. Construo o que me faltava no terreno.", skills: ["Saúde", "Cuidados", "No-code"] },
  { key: "sofia", name: "Sofia Lopes", email: "sofia@demo.ncc", role: "member", hue: 230, headline: "Data analyst · Freelancer", location: "Faro", bio: "Dados para decisões simples.", skills: ["SQL", "Power BI", "Fintech"] },
  { key: "tomas", name: "Tomás Neves", email: "tomas@demo.ncc", role: "member", hue: 125, headline: "Fundador da Lote Zero", location: "Aveiro", bio: "Economia circular para o comércio alimentar.", skills: ["Retalho", "Supply chain", "Parcerias"] },
  { key: "beatriz", name: "Beatriz Faria", email: "beatriz@demo.ncc", role: "member", hue: 280, headline: "Fundadora da Pagaflow", location: "Lisboa", bio: "Ex-analista de risco num banco. Pagamentos simples para independentes.", skills: ["Risco", "Pagamentos", "Produto"] },
  { key: "goncalo", name: "Gonçalo Reis", email: "goncalo@demo.ncc", role: "member", hue: 170, headline: "Fundador da Entrega Verde", location: "Lisboa", bio: "Bicicletas de carga e software de despacho.", skills: ["Mobilidade", "Operações", "Node.js"] },
] as const;

export type PersonKey = (typeof people)[number]["key"];

const stdCriteria = (overrides?: Partial<Record<number, { name: string; description: string; weight: number }>>) =>
  [
    { name: "Problema e oportunidade", description: "O problema é real, relevante e com mercado claro?", weight: 3 },
    { name: "Qualidade da solução", description: "A solução resolve o problema de forma clara, diferenciada e utilizável?", weight: 3 },
    { name: "Execução e tracção", description: "O que já foi construído e validado com utilizadores reais?", weight: 2 },
    { name: "Equipa", description: "A equipa tem as competências e o compromisso para executar?", weight: 2 },
  ].map((c, i) => overrides?.[i] ?? c);

export const challengeSeeds = [
  {
    key: "energia",
    title: "Energia acessível para PME",
    tagline: "Ferramentas que reduzam pelo menos 15% da factura energética de pequenas e médias empresas.",
    category: "Energia e clima",
    status: "published",
    start: -18, deadline: 12, results: 26, hue: 85,
    description:
      "As PME portuguesas gastam uma parte desproporcionada da sua margem em energia e raramente têm dados para agir. Procuramos produtos que tornem visível o consumo, recomendem acções concretas e provem a poupança.\n\nInteressam-nos soluções que uma PME consiga adoptar em menos de uma semana, sem consultoria pesada.",
    objectives: ["Reduzir a factura energética de PME em pelo menos 15%", "Tornar o consumo visível em tempo útil", "Ser adoptável sem consultoria externa", "Medir e provar a poupança obtida"],
    rules: ["Equipas de 1 a 4 pessoas", "Projecto original, desenvolvido pela equipa", "Pelo menos um protótipo funcional na data de submissão", "Uma submissão por projecto", "Dados de clientes reais só com consentimento"],
    instructions: "Submeta um link para a demonstração funcional (ou vídeo de até 3 minutos), um resumo do problema e da solução e os resultados de validação que já tenha.",
    maxTeam: 4,
    points: [300, 200, 100],
    criteria: stdCriteria({ 2: { name: "Impacto mensurável", description: "A poupança é medida de forma credível?", weight: 3 } }),
    prizes: [
      { rank: 1, title: "1.º lugar", value: "€15.000", kind: "prize", description: "Prémio monetário e sessão de trabalho com a investidora." },
      { rank: 2, title: "2.º lugar", value: "€5.000", kind: "prize", description: "Prémio monetário." },
      { rank: null, title: "Oportunidade de investimento", value: "Até €150.000 pré-seed", kind: "investment", description: "Conversa de investimento com as equipas finalistas. Sujeita a due diligence; não é automática." },
    ],
  },
  {
    key: "ia",
    title: "IA para o pequeno comércio",
    tagline: "Assistentes que poupem 5 horas por semana a quem gere uma loja de bairro.",
    category: "Inteligência artificial",
    status: "published",
    start: -6, deadline: 25, results: 40, hue: 260,
    description:
      "O pequeno comércio perde horas em encomendas, stock, respostas a clientes e burocracia. Queremos ver assistentes de IA que façam trabalho real — não demonstrações — e que o lojista confie para usar todos os dias.",
    objectives: ["Poupar pelo menos 5 horas semanais ao lojista", "Funcionar com as ferramentas que a loja já usa", "Ser fiável: erros visíveis e reversíveis"],
    rules: ["Equipas de 1 a 5 pessoas", "Uso de modelos de terceiros permitido, com custos declarados", "Testes com pelo menos 3 lojas reais valorizados"],
    instructions: "Partilhe a demonstração, um vídeo curto do assistente a executar uma tarefa real e os custos estimados por loja/mês.",
    maxTeam: 5,
    points: [300, 200, 100],
    criteria: stdCriteria(),
    prizes: [
      { rank: 1, title: "1.º lugar", value: "€10.000", kind: "prize", description: "Prémio monetário." },
      { rank: null, title: "Programa piloto", value: "20 lojas parceiras", kind: "recognition", description: "Piloto pago com lojas da rede da comunidade." },
    ],
  },
  {
    key: "fintech",
    title: "Finanças simples para independentes",
    tagline: "Produtos que acabem com a ansiedade fiscal de quem passa recibos verdes.",
    category: "Fintech",
    status: "closed",
    start: -45, deadline: -4, results: 6, hue: 200,
    description:
      "Mais de um milhão de trabalhadores independentes gere impostos, Segurança Social e facturação sozinho. Procuramos produtos que automatizem o essencial e dêem previsibilidade.",
    objectives: ["Prever impostos e contribuições com antecedência", "Automatizar facturação e reconciliação", "Reduzir erros e coimas"],
    rules: ["Equipas de 1 a 4 pessoas", "Conformidade com RGPD demonstrada", "Sem recolha de credenciais bancárias fora de canais PSD2"],
    instructions: "Submeta a demonstração, o modelo de negócio e evidência de validação (entrevistas, lista de espera, utilizadores activos).",
    maxTeam: 4,
    points: [300, 200, 100],
    criteria: stdCriteria(),
    prizes: [
      { rank: 1, title: "1.º lugar", value: "€12.000", kind: "prize", description: "Prémio monetário." },
      { rank: 2, title: "2.º lugar", value: "€4.000", kind: "prize", description: "Prémio monetário." },
      { rank: null, title: "Oportunidade de investimento", value: "Até €100.000 pré-seed", kind: "investment", description: "Sujeita a due diligence." },
    ],
  },
  {
    key: "logistica",
    title: "Logística de última milha nas cidades médias",
    tagline: "Entregas mais baratas e limpas fora de Lisboa e do Porto.",
    category: "Mobilidade e logística",
    status: "results_published",
    start: -80, deadline: -35, results: -21, hue: 20,
    description: "Cidades médias têm volumes que não justificam as soluções das grandes metrópoles. Procurámos modelos de entrega que fossem rentáveis com baixa densidade.",
    objectives: ["Reduzir o custo por entrega", "Reduzir emissões", "Funcionar com baixa densidade de encomendas"],
    rules: ["Equipas de 1 a 5 pessoas", "Piloto real em pelo menos uma cidade"],
    instructions: "Submeta os resultados do piloto, a demonstração e o modelo de custos.",
    maxTeam: 5,
    points: [300, 200, 100],
    criteria: stdCriteria(),
    prizes: [
      { rank: 1, title: "1.º lugar", value: "€15.000", kind: "prize", description: "Prémio monetário." },
      { rank: 2, title: "2.º lugar", value: "€5.000", kind: "prize", description: "Prémio monetário." },
      { rank: 3, title: "3.º lugar", value: "Mentoria 3 meses", kind: "recognition", description: "Mentoria com a equipa da investidora." },
    ],
  },
  {
    key: "saude",
    title: "Saúde digital para seniores",
    tagline: "Tecnologia que um avô de 80 anos use sem pedir ajuda.",
    category: "Saúde",
    status: "published",
    start: 6, deadline: 40, results: 55, hue: 330,
    description: "Portugal é um dos países mais envelhecidos da Europa. Procuramos soluções de acompanhamento, medicação e companhia desenhadas de raiz para seniores e cuidadores.",
    objectives: ["Adopção autónoma por pessoas com mais de 75 anos", "Reduzir a carga dos cuidadores", "Privacidade por defeito"],
    rules: ["Equipas de 1 a 4 pessoas", "Testes com utilizadores seniores documentados", "Sem diagnóstico médico automatizado"],
    instructions: "Submeta a demonstração e um vídeo de um utilizador sénior a usar o produto (com consentimento).",
    maxTeam: 4,
    points: [300, 200, 100],
    criteria: stdCriteria(),
    prizes: [
      { rank: 1, title: "1.º lugar", value: "€10.000", kind: "prize", description: "Prémio monetário." },
      { rank: null, title: "Oportunidade de investimento", value: "A definir", kind: "investment", description: "Sujeita a due diligence." },
    ],
  },
  {
    key: "turismo",
    title: "Turismo sustentável no interior",
    tagline: "Levar visitantes ao interior sem o descaracterizar.",
    category: "Turismo",
    status: "draft",
    start: 30, deadline: 75, results: 90, hue: 140,
    description: "Rascunho em preparação: desafio para plataformas que distribuam o turismo para fora dos grandes centros.",
    objectives: ["Aumentar estadias no interior", "Benefício directo para a economia local"],
    rules: ["Equipas de 1 a 5 pessoas"],
    instructions: "A definir.",
    maxTeam: 5,
    points: [300, 200, 100],
    criteria: stdCriteria(),
    prizes: [{ rank: 1, title: "1.º lugar", value: "€8.000", kind: "prize", description: "" }],
  },
] as const;

export const projectSeeds = [
  {
    key: "voltaica", owner: "ana", team: [["bruno", "CTO"]], name: "Voltaica", category: "Energia e clima", stage: "mvp", hue: 85,
    tagline: "Gestão de energia para PME: ver, cortar e provar a poupança.",
    problem: "As PME pagam energia sem saber onde, quando e porquê consomem. As auditorias são caras, pontuais e acabam numa gaveta.",
    solution: "Um sensor de pinça instalado em 20 minutos e uma app que mostra o consumo por equipamento, recomenda acções semanais e calcula a poupança verificada.",
    description: "A Voltaica liga-se ao quadro eléctrico e aprende o padrão de consumo de cada negócio. Em 3 pilotos (padaria, oficina, ginásio) a poupança média foi de 18% em 8 semanas.",
    website: "https://voltaica.example.com", demo: "https://demo.voltaica.example.com", repo: null,
    challenges: [["energia", true]],
    updates: [
      [-16, "Terceiro piloto instalado", "Instalámos o sensor num ginásio em Almada. Primeiro dado curioso: as máquinas de climatização ficam ligadas 4h depois do fecho."],
      [-9, "Poupança verificada: 18%", "Fechámos 8 semanas nos três pilotos. Poupança média de 18%, com o maior ganho na padaria (fornos em vazio)."],
      [-2, "Relatório automático para o contabilista", "Agora cada cliente recebe um PDF mensal com a poupança, pronto para enviar ao contabilista."],
    ],
  },
  {
    key: "balcao", owner: "carolina", team: [["diogo", "ML lead"]], name: "Balcão", category: "Inteligência artificial", stage: "prototype", hue: 260,
    tagline: "O assistente que trata das encomendas e do stock da sua loja pelo WhatsApp.",
    problem: "O lojista passa as noites a fazer encomendas a fornecedores e a responder a clientes, em papel e no telemóvel.",
    solution: "Um assistente no WhatsApp que lê as vendas do terminal de pagamento, sugere encomendas e responde a perguntas frequentes — sempre com confirmação do lojista.",
    description: "Em teste com 4 lojas em Coimbra. Tempo médio poupado reportado: 6h/semana.",
    website: "https://balcao.example.com", demo: null, repo: "https://github.com/example/balcao",
    challenges: [["ia", false]],
    updates: [[-5, "4 lojas em teste", "Uma mercearia, uma papelaria, uma drogaria e uma loja de bricolage. A papelaria já usa o assistente todos os dias."]],
  },
  {
    key: "reciboverde", owner: "ines", team: [["joao", "CTO"]], name: "Recibo Verde+", category: "Fintech", stage: "traction", hue: 200,
    tagline: "Impostos e Segurança Social previstos ao cêntimo, todos os meses.",
    problem: "Os independentes descobrem o valor a pagar quando já é tarde e não têm reservas para isso.",
    solution: "Liga-se à conta bancária via PSD2, classifica rendimentos e despesas e reserva automaticamente o valor de impostos e contribuições.",
    description: "1.200 utilizadores na lista de espera, 310 activos em beta, NPS 61.",
    website: "https://reciboverdemais.example.com", demo: "https://app.reciboverdemais.example.com", repo: null,
    challenges: [["fintech", true]],
    updates: [[-30, "Beta aberto", "Abrimos o beta a 300 pessoas da lista de espera."], [-12, "310 activos, NPS 61", "Retenção a 4 semanas de 72%."]],
  },
  {
    key: "pagaflow", owner: "beatriz", team: [["sofia", "Dados"]], name: "Pagaflow", category: "Fintech", stage: "mvp", hue: 280,
    tagline: "Cobranças automáticas e lembretes para quem factura sozinho.",
    problem: "30% das facturas de independentes são pagas com atraso e cobrar é desconfortável.",
    solution: "Links de pagamento, lembretes automáticos e previsão de tesouraria num só ecrã.",
    description: "MVP com 45 utilizadores pagantes.",
    website: "https://pagaflow.example.com", demo: null, repo: null,
    challenges: [["fintech", true]],
    updates: [[-20, "Primeiros 45 pagantes", "Plano de €9/mês. Churn de 3% no primeiro mês."]],
  },
  {
    key: "contafacil", owner: "sofia", team: [], name: "Conta Fácil", category: "Fintech", stage: "prototype", hue: 230,
    tagline: "Painel de tesouraria para independentes com dados do e-fatura.",
    problem: "Os independentes não sabem quanto podem realmente gastar.",
    solution: "Importa dados do e-fatura e mostra o rendimento disponível depois de impostos.",
    description: "Protótipo funcional testado com 12 pessoas.",
    website: null, demo: "https://contafacil.example.com", repo: "https://github.com/example/conta-facil",
    challenges: [["fintech", true]],
    updates: [],
  },
  {
    key: "fiscalbot", owner: "joao", team: [], name: "FiscalBot", category: "Fintech", stage: "idea", hue: 120,
    tagline: "Respostas fiscais imediatas, com fonte legal citada.",
    problem: "As dúvidas fiscais dos independentes ficam sem resposta ou com respostas erradas de fóruns.",
    solution: "Um assistente que responde com base no Código do IRS e cita o artigo.",
    description: "Ideia com protótipo inicial.",
    website: null, demo: "https://fiscalbot.example.com", repo: null,
    challenges: [["fintech", true]],
    updates: [],
  },
  {
    key: "rotacurta", owner: "leonor", team: [["miguel", "CTO"]], name: "Rota Curta", category: "Mobilidade e logística", stage: "traction", hue: 20,
    tagline: "Entregas partilhadas entre lojas de cidades médias.",
    problem: "Em cidades médias cada loja faz as suas entregas, com carrinhas meio vazias.",
    solution: "Uma rede de entregas partilhadas com rotas optimizadas e pontos de recolha no comércio local.",
    description: "Opera em Setúbal e Évora. Custo por entrega 41% abaixo da média das lojas aderentes.",
    website: "https://rotacurta.example.com", demo: "https://app.rotacurta.example.com", repo: null,
    challenges: [["logistica", true]],
    updates: [[-50, "Évora em operação", "Segunda cidade com 22 lojas aderentes."], [-25, "Vencemos o desafio de logística", "Obrigado à comunidade. Próximo passo: Leiria."]],
  },
  {
    key: "entregaverde", owner: "goncalo", team: [], name: "Entrega Verde", category: "Mobilidade e logística", stage: "mvp", hue: 160,
    tagline: "Bicicletas de carga com despacho inteligente.",
    problem: "As carrinhas a diesel dominam o centro das cidades.",
    solution: "Frota de bicicletas de carga com software de despacho e micro-armazéns.",
    description: "Piloto em Aveiro com 3 bicicletas.",
    website: "https://entregaverde.example.com", demo: null, repo: null,
    challenges: [["logistica", true]],
    updates: [],
  },
  {
    key: "lotezero", owner: "tomas", team: [], name: "Lote Zero", category: "Retalho", stage: "mvp", hue: 125,
    tagline: "Excedentes alimentares do retalho vendidos antes de serem desperdício.",
    problem: "Supermercados de bairro deitam fora produtos ainda bons.",
    solution: "Marketplace com recolha local e preços dinâmicos.",
    description: "Activo em Aveiro com 9 lojas.",
    website: "https://lotezero.example.com", demo: null, repo: null,
    challenges: [["logistica", true], ["ia", false]],
    updates: [[-3, "Preços dinâmicos ligados", "Preço baixa automaticamente à medida que a validade se aproxima."]],
  },
  {
    key: "cuidar", owner: "rita", team: [], name: "Cuidar.app", category: "Saúde", stage: "prototype", hue: 330,
    tagline: "Coordenação simples entre cuidadores e famílias.",
    problem: "Famílias e cuidadores coordenam medicação e visitas por mensagens dispersas.",
    solution: "Um diário partilhado com alertas e um tablet simplificado para o sénior.",
    description: "Protótipo testado com 6 famílias em Évora.",
    website: null, demo: "https://cuidar.example.com", repo: null,
    challenges: [["saude", false]],
    updates: [[-1, "Teste com 6 famílias", "O tablet com dois botões grandes foi o que mais funcionou."]],
  },
] as const;

/** Evaluation marks (0–10) per criterion order, by evaluator. */
export const evaluationSeeds: Record<string, Partial<Record<"helena" | "marta" | "tiago", [number, number, number, number, string]>>> = {
  "fintech:reciboverde": {
    helena: [9, 8, 9, 8, "Tracção muito forte para a fase. Quero perceber o custo de aquisição."],
    marta: [9, 9, 8, 8, "Produto claro, onboarding excelente. A previsão mensal é o momento 'uau'."],
    tiago: [8, 8, 9, 9, "Integração PSD2 bem feita; atenção à reconciliação de despesas mistas."],
  },
  "fintech:pagaflow": {
    helena: [8, 7, 7, 8, "Mercado real, mas diferenciação face a bancos ainda pouco clara."],
    marta: [8, 8, 7, 7, "Boa experiência de cobrança. Falta prova de redução de atrasos."],
  },
  "fintech:contafacil": {
    marta: [7, 7, 5, 6, "Ideia útil, ainda com validação limitada."],
    tiago: [7, 6, 5, 6, "Dependência de dados do e-fatura é um risco técnico."],
  },
  "fintech:fiscalbot": {
    helena: [6, 6, 3, 6, "Muito cedo. Volte quando tiver utilizadores."],
    marta: [7, 6, 3, 5, "Interessante; risco de responsabilidade nas respostas."],
  },
  "logistica:rotacurta": {
    helena: [9, 9, 9, 9, "Execução exemplar e unit economics provados."],
    marta: [9, 8, 9, 8, "Modelo replicável."],
    tiago: [8, 9, 9, 9, "Optimização de rotas sólida."],
  },
  "logistica:entregaverde": {
    helena: [8, 7, 6, 7, "Bom impacto ambiental; escala ainda por provar."],
    marta: [7, 8, 6, 7, "Operação bem pensada."],
    tiago: [7, 7, 6, 8, "Software de despacho simples mas eficaz."],
  },
  "logistica:lotezero": {
    helena: [7, 7, 6, 6, "Ligação ao tema de logística é indirecta."],
    marta: [8, 7, 6, 6, "Proposta de valor clara para lojas."],
    tiago: [6, 7, 6, 7, ""],
  },
};

export const courseSeeds = [
  {
    slug: "do-problema-ao-pitch", title: "Do problema ao pitch", level: "Essencial", hue: 85,
    description: "O percurso que recomendamos antes de submeter a qualquer desafio: validar, construir o mínimo e apresentar.",
    modules: [
      { title: "Validar o problema", lessons: [
        ["entrevistas-que-funcionam", "Entrevistas que funcionam", 8, "Fale com pelo menos 10 potenciais clientes antes de escrever código.\n\nPergunte pelo passado, não pelo futuro: \"Da última vez que isto aconteceu, o que fez?\" vale mais do que \"Usaria uma app que…?\".\n\nRegiste citações literais. São o material mais forte da sua submissão."],
        ["dimensionar-o-mercado", "Dimensionar o mercado sem folhas mágicas", 6, "Comece de baixo para cima: quantos clientes consegue identificar pelo nome, quanto pagariam e com que frequência.\n\nUm mercado pequeno e bem definido é mais convincente do que um número de mil milhões sem fonte."],
      ] },
      { title: "Construir o mínimo", lessons: [
        ["o-mvp-certo", "O MVP certo", 7, "O MVP não é a versão pobre do produto final: é a experiência mais pequena que prova a hipótese mais arriscada.\n\nEscolha a hipótese que, se estiver errada, mata o projecto — e teste-a primeiro."],
        ["medir-o-que-importa", "Medir o que importa", 6, "Defina uma métrica de activação e uma de retenção antes do lançamento. Tudo o resto é ruído na fase inicial."],
      ] },
      { title: "Preparar a submissão", lessons: [
        ["a-submissao-perfeita", "A submissão que os avaliadores querem ler", 5, "Os avaliadores lêem dezenas de submissões. Seja directo: problema, solução, prova, equipa.\n\nUma demonstração funcional de 2 minutos vale mais do que 20 slides."],
      ] },
    ],
  },
  {
    slug: "como-somos-avaliados", title: "Como somos avaliados", level: "Transparência", hue: 200,
    description: "Critérios, pesos, pontos e a diferença entre ganhar um desafio e receber investimento.",
    modules: [
      { title: "Avaliação e resultados", lessons: [
        ["criterios-e-pesos", "Critérios e pesos", 4, "Cada desafio publica os seus critérios e pesos. Cada avaliador atribui uma nota de 0 a 10 por critério.\n\nA nota de uma avaliação é a média ponderada, numa escala de 0 a 100. A nota final é a média das avaliações completas.\n\nA investidora confirma os resultados finais e pode justificar decisões que se afastem da ordem das notas — essa justificação fica registada no histórico."],
        ["pontos-e-classificacoes", "Pontos e classificações", 4, "Há dois tipos de pontos:\n\nParticipação: inscrições (10), submissões (40), actualizações de projecto (5, uma por dia), publicações (3) e comentários (1), com um limite diário de 10 pontos de comunidade, e aulas concluídas (2).\n\nMérito: só nasce de resultados publicados — a nota final (1 ponto por ponto de nota) e os pontos de classificação definidos por cada desafio.\n\nReacções não dão pontos: popularidade não é qualidade."],
        ["vencer-nao-e-investimento", "Vencer não é investimento", 3, "Ganhar um desafio dá direito ao prémio publicado. Uma oportunidade de investimento é um processo separado, com due diligence própria, e pode envolver equipas que não ficaram em primeiro lugar."],
      ] },
    ],
  },
  {
    slug: "preparar-investimento", title: "Preparar uma ronda pré-seed", level: "Avançado", hue: 28,
    description: "O que um investidor procura depois de um desafio: métricas, data room e term sheet.",
    modules: [
      { title: "Antes da conversa", lessons: [
        ["metricas-pre-seed", "Métricas que contam no pré-seed", 6, "Velocidade de aprendizagem, retenção dos primeiros clientes e evidência de que a equipa executa.\n\nReceita ajuda, mas não é obrigatória nesta fase."],
        ["data-room-minimo", "Data room mínimo", 5, "Pacto social, cap table, contas, contratos relevantes e um resumo de métricas mensais. Simples e actualizado."],
      ] },
    ],
  },
] as const;
