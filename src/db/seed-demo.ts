/**
 * DEMONSTRATION data loader. Wipes the application tables and inserts the
 * fictional dataset in src/db/seed-data.ts. Identities are provisioned through
 * the configured auth provider so the same seed works with local auth and with
 * Supabase Auth.
 */
import { sql } from "drizzle-orm";
import { aggregateSubmission } from "../lib/scoring";
import { provisionIdentity } from "../server/auth/provision";
import type { DB } from "./index";
import * as s from "./schema";
import { challengeSeeds, courseSeeds, DEMO_PASSWORD, evaluationSeeds, people, projectSeeds, type PersonKey } from "./seed-data";

/** Application tables (auth provider tables are left to the provider). */
export const APP_TABLES = [
  "follows", "saved_posts", "post_media", "lesson_progress", "lessons", "modules", "courses", "reactions", "comments", "posts", "decision_log",
  "opportunities", "results", "evaluations", "evaluator_assignments", "submissions", "participations",
  "project_updates", "project_members", "projects", "prizes", "criteria", "challenges", "files", "users",
] as const;

export async function seedDemo(db: DB) {
  const NOW = Date.now();
  const day = (n: number, hour = 10) => {
    const d = new Date(NOW + n * 864e5);
    d.setHours(hour, (n * 37) % 60, 0, 0);
    return d;
  };

  // Identities first (may call an external provider; not part of the DB transaction).
  const subjects = {} as Record<PersonKey, string>;
  for (const p of people) subjects[p.key] = (await provisionIdentity(p.email, DEMO_PASSWORD)).subject;

  await db.transaction(async (tx) => {
  await tx.execute(sql.raw(`TRUNCATE ${APP_TABLES.map((t) => `"${t}"`).join(", ")} CASCADE`));

  // People ------------------------------------------------------------------
  const U = {} as Record<PersonKey, string>;
  for (const [i, p] of people.entries()) {
    U[p.key] = await tx
      .insert(s.users)
      .values({
        email: p.email, authSubject: subjects[p.key], name: p.name, handle: p.key, role: p.role, headline: p.headline,
        bio: p.bio, location: p.location, skills: [...p.skills], avatarHue: p.hue, isDemo: true,
        createdAt: day(-90 + i),
      })
      .returning({ id: s.users.id })
      .then((r) => r[0].id);
  }

  // Challenges ----------------------------------------------------------------
  const C: Record<string, { id: string; criteria: { id: string; weight: number }[]; prizes: { id: string; rank: number | null }[] }> = {};
  const log = (challenge: string | null, actor: PersonKey, action: string, summary: string, at: Date) =>
    tx.insert(s.decisionLog).values({ challengeId: challenge ? C[challenge].id : null, actorId: U[actor], action, summary, createdAt: at });

  for (const c of challengeSeeds) {
    const status = c.status as s.ChallengeStatus;
    const row = await tx
      .insert(s.challenges)
      .values({
        slug: c.key === "energia" ? "energia-acessivel-pme" : c.key === "ia" ? "ia-pequeno-comercio" : c.key === "fintech" ? "financas-independentes" : c.key === "logistica" ? "logistica-ultima-milha" : c.key === "saude" ? "saude-digital-seniores" : "turismo-sustentavel-interior",
        title: c.title, tagline: c.tagline, description: c.description, category: c.category,
        objectives: [...c.objectives], rules: [...c.rules], submissionInstructions: c.instructions, status,
        startsAt: day(c.start, 9), submissionDeadline: day(c.deadline, 23), resultsDate: day(c.results, 18),
        maxTeamSize: c.maxTeam, placementPoints: [...c.points], coverHue: c.hue, createdById: U.helena,
        publishedAt: status === "draft" ? null : day(Math.min(c.start - 7, -1)),
        resultsPublishedAt: status === "results_published" ? day(c.results, 18) : null,
        createdAt: day(Math.min(c.start - 10, -2)),
      })
      .returning({ id: s.challenges.id }).then((r) => r[0]);
    const crit: { id: string; weight: number }[] = [];
    for (const [i, cr] of c.criteria.entries()) crit.push(
      await tx.insert(s.criteria).values({ challengeId: row.id, name: cr.name, description: cr.description, weight: cr.weight, position: i }).returning({ id: s.criteria.id, weight: s.criteria.weight }).then((r) => r[0]),
    );
    const prz: { id: string; rank: number | null }[] = [];
    for (const [i, p] of c.prizes.entries()) prz.push(
      await tx.insert(s.prizes).values({ challengeId: row.id, rank: p.rank, title: p.title, value: p.value, kind: p.kind, description: p.description, position: i }).returning({ id: s.prizes.id, rank: s.prizes.rank }).then((r) => r[0]),
    );
    C[c.key] = { id: row.id, criteria: crit, prizes: prz };
    await log(c.key, "helena", "created", `Desafio “${c.title}” criado como rascunho.`, day(Math.min(c.start - 10, -2)));
    if (status !== "draft") await log(c.key, "helena", "status:published", `Desafio “${c.title}” publicado.`, day(Math.min(c.start - 7, -1)));
  }

  const assign: Record<string, PersonKey[]> = {
    energia: ["helena", "marta"], ia: ["helena", "tiago"], fintech: ["helena", "marta", "tiago"],
    logistica: ["helena", "marta", "tiago"], saude: ["helena"], turismo: ["helena"],
  };
  for (const [ck, evs] of Object.entries(assign))
    for (const e of evs) await tx.insert(s.evaluatorAssignments).values({ challengeId: C[ck].id, evaluatorId: U[e] });
  await log("energia", "helena", "evaluator:add", "Marta Quintela atribuída como avaliadora.", day(-17));
  await log("fintech", "helena", "evaluator:add", "Tiago Brandão atribuído como avaliador.", day(-40));

  // Projects, participation and submissions -----------------------------------
  const P: Record<string, string> = {};
  const S: Record<string, string> = {};
  const startOf = (ck: string) => challengeSeeds.find((c) => c.key === ck)!;
  for (const [i, p] of projectSeeds.entries()) {
    const created = day(-70 + i * 3);
    const id = await tx
      .insert(s.projects)
      .values({
        slug: p.key, ownerId: U[p.owner], name: p.name, tagline: p.tagline, description: p.description, problem: p.problem,
        solution: p.solution, category: p.category, stage: p.stage, logoHue: p.hue, websiteUrl: p.website, demoUrl: p.demo,
        repoUrl: p.repo, createdAt: created, updatedAt: p.updates.length ? day(p.updates[p.updates.length - 1][0]) : created,
      })
      .returning({ id: s.projects.id }).then((r) => r[0].id);
    P[p.key] = id;
    const team: [PersonKey, string][] = [[p.owner, "Fundador(a)"], ...(p.team as unknown as [PersonKey, string][])];
    for (const [k, title] of team) await tx.insert(s.projectMembers).values({ projectId: id, userId: U[k], title });

    for (const [ck, submitted] of p.challenges) {
      const c = startOf(ck);
      const enrolledAt = day(Math.max(c.start + 1 + (i % 4), -80));
      for (const [k] of team)
        await tx.insert(s.participations).values({ challengeId: C[ck].id, userId: U[k], projectId: id, createdAt: enrolledAt }).onConflictDoNothing();
      if (submitted) {
        const at = day(Math.min(c.deadline - 2 - (i % 5), -1));
        S[`${ck}:${p.key}`] = await tx
          .insert(s.submissions)
          .values({
            challengeId: C[ck].id, projectId: id, submittedById: U[p.owner], summary: p.tagline + " " + p.solution,
            details: `${p.problem}\n\n${p.description}`, deliverableUrl: p.demo ?? p.website ?? "https://example.com/demo",
            videoUrl: "https://video.example.com/" + p.key, submittedAt: at, updatedAt: at,
            status: ck === "fintech" && p.key === "reciboverde" ? "shortlisted" : "submitted",
          })
          .returning({ id: s.submissions.id }).then((r) => r[0].id);
      }
    }

    for (const [j, [d, title, body]] of p.updates.entries()) {
      const author = j % 2 === 0 ? p.owner : (team[1]?.[0] ?? p.owner);
      await tx.insert(s.projectUpdates).values({ projectId: id, authorId: U[author], title, body, createdAt: day(d, 11) });
      await tx.insert(s.posts).values({ authorId: U[author], kind: "progress", title, body, projectId: id, createdAt: day(d, 11) });
    }
  }

  // Members enrolled without a project yet.
  const extra: [string, PersonKey, number][] = [["energia", "tomas", -10], ["energia", "goncalo", -8], ["energia", "sofia", -1], ["ia", "rita", -2], ["ia", "leonor", -4], ["ia", "beatriz", 0], ["ia", "ana", -1], ["saude", "carolina", -1]];
  for (const [ck, k, d] of extra) await tx.insert(s.participations).values({ challengeId: C[ck].id, userId: U[k], createdAt: day(d, 15) }).onConflictDoNothing();

  // Evaluations, results --------------------------------------------------------
  for (const [key, byEvaluator] of Object.entries(evaluationSeeds)) {
    const [ck] = key.split(":");
    for (const [ev, marks] of Object.entries(byEvaluator)) {
      if (!marks) continue;
      const scores = Object.fromEntries(C[ck].criteria.map((c, i) => [c.id, marks[i] as number]));
      const at = ck === "fintech" ? day(-3 + (ev.length % 3)) : day(-30);
      await tx.insert(s.evaluations).values({ submissionId: S[key], evaluatorId: U[ev as PersonKey], scores, feedback: marks[4], createdAt: at, updatedAt: at });
    }
  }
  await log("fintech", "helena", "status:closed", "Desafio “Finanças simples para independentes” encerrado para submissões.", day(-4, 23));
  await log("fintech", "helena", "submission:shortlisted", "“Recibo Verde+” seleccionada para a shortlist.", day(-2));

  const logi = challengeSeeds.find((c) => c.key === "logistica")!;
  const podium = ["rotacurta", "entregaverde", "lotezero"];
  for (const [i, pk] of podium.entries()) {
    const key = `logistica:${pk}`;
    const evs = Object.values(evaluationSeeds[key]).map((m) => ({ scores: Object.fromEntries(C.logistica.criteria.map((c, j) => [c.id, m![j] as number])) }));
    const agg = aggregateSubmission(S[key], evs, C.logistica.criteria);
    await tx.insert(s.results)
      .values({ challengeId: C.logistica.id, submissionId: S[key], rank: i + 1, finalScore: agg.score, prizeId: C.logistica.prizes.find((p) => p.rank === i + 1)?.id ?? null, decidedById: U.helena, createdAt: day(logi.results - 1) })
      ;
  }
  await log("logistica", "helena", "status:closed", "Desafio “Logística de última milha nas cidades médias” encerrado para submissões.", day(logi.deadline, 23));
  await log("logistica", "helena", "results:confirmed", "Resultados confirmados: 1.º Rota Curta, 2.º Entrega Verde, 3.º Lote Zero.", day(logi.results - 1));
  await log("logistica", "helena", "results:published", "Resultados publicados e anunciados à comunidade.", day(logi.results, 18));

  // Investment pipeline (independent from results) ------------------------------
  const opp = async (pk: string, ck: string | null, status: s.OpportunityStatus, amount: string, note: string, d: number) => {
    await tx.insert(s.opportunities).values({ projectId: P[pk], challengeId: ck ? C[ck].id : null, status, amount, note, createdById: U.helena, createdAt: day(d), updatedAt: day(d + 2) });
  };
  await opp("rotacurta", "logistica", "due_diligence", "€120.000", "Due diligence em curso: contratos com lojas e métricas de Évora.", -18);
  await opp("entregaverde", "logistica", "interest", "€50.000", "2.º lugar, mas forte alinhamento com a tese de mobilidade limpa.", -15);
  await opp("reciboverde", "fintech", "interest", "A definir", "Acompanhar após resultados.", -2);
  await log("logistica", "helena", "opportunity:created", "Oportunidade de investimento registada para “Rota Curta” (Due diligence).", day(-18));
  await log("logistica", "helena", "opportunity:created", "Oportunidade de investimento registada para “Entrega Verde” (Interesse).", day(-15));

  // Community -----------------------------------------------------------------------
  const post = async (author: PersonKey, kind: s.PostKind, title: string, body: string, d: number, extraVals: Partial<typeof s.posts.$inferInsert> = {}) =>
    tx.insert(s.posts).values({ authorId: U[author], kind, title, body, createdAt: day(d, 9 + (Math.abs(d) % 8)), ...extraVals }).returning({ id: s.posts.id }).then((r) => r[0].id);

  const welcome = await post("helena", "announcement", "Bem-vindos à No Competition Community",
    "Esta comunidade existe para encontrar e apoiar equipas que constroem produtos tão bons que deixam de ter concorrência.\n\nComo funciona: lanço desafios com critérios e prémios públicos; vocês inscrevem-se, constroem e submetem; avaliadores independentes dão nota e feedback; os resultados e o histórico de decisões ficam visíveis.\n\nGanhar um desafio dá direito ao prémio. Investimento é uma conversa separada — e pode acontecer com qualquer equipa que mostre execução.", -60, { pinned: true });
  const launch = await post("helena", "announcement", "Novo desafio: IA para o pequeno comércio",
    "Está aberto o desafio IA para o pequeno comércio. Queremos assistentes que poupem pelo menos 5 horas por semana a um lojista — com testes em lojas reais.\n\nPrazo de submissão e critérios na página do desafio.", -6, { challengeId: C.ia.id, pinned: true });
  await post("helena", "announcement", "Resultados: Logística de última milha nas cidades médias",
    "Os resultados do desafio estão publicados.\n\n1.º lugar — Rota Curta (€15.000)\n2.º lugar — Entrega Verde (€5.000)\n3.º lugar — Lote Zero (mentoria de 3 meses)\n\nObrigado a todas as equipas.", logi.results, { challengeId: C.logistica.id });
  const q1 = await post("ana", "question", "Como devemos demonstrar a poupança no desafio de energia?",
    "Temos dados de 3 pilotos com 8 semanas. Chega comparar com o mesmo período do ano anterior ou devemos normalizar pela temperatura?", -7, { challengeId: C.energia.id });
  const q2 = await post("carolina", "question", "Alguém já integrou com terminais de pagamento?",
    "Precisamos das vendas por produto para sugerir encomendas. Que terminais têm API utilizável?", -4, { challengeId: C.ia.id });
  const d1 = await post("rita", "discussion", "Procuro co-fundador(a) técnico(a) para saúde sénior",
    "Tenho um protótipo testado com 6 famílias e preciso de alguém com experiência em apps móveis e acessibilidade. Interessados?", -2);
  const d2 = await post("leonor", "discussion", "O que aprendemos depois de ganhar o desafio de logística",
    "Três lições: 1) o piloto pago valeu mais do que qualquer slide; 2) o feedback dos avaliadores apontou exactamente a nossa fragilidade (dependência de 2 lojas âncora); 3) ganhar não é investimento — a due diligence é outro campeonato.", -12);

  const comment = (p: string, a: PersonKey, body: string, d: number) =>
    tx.insert(s.comments).values({ postId: p, authorId: U[a], body, createdAt: day(d, 17) });
  await comment(q1, "marta", "Normalizem pela temperatura (graus-dia) e mostrem a baseline. Os avaliadores vão olhar para o método, não só para o número.", -7);
  await comment(q1, "bruno", "Obrigado! Vamos incluir a metodologia num anexo.", -6);
  await comment(q2, "diogo", "Testámos com dois fornecedores; um tem API REST decente, o outro só exporta CSV. Posso partilhar o que fizemos.", -4);
  await comment(q2, "joao", "Cuidado com a autenticação: alguns exigem certificado por loja.", -3);
  await comment(d1, "miguel", "Não tenho disponibilidade, mas conheço alguém em Évora. Envio-te mensagem.", -1);
  await comment(d2, "goncalo", "Ponto 3 é muito importante. Obrigado pela partilha.", -11);
  await comment(d2, "helena", "Excelente resumo. O feedback existe exactamente para isso.", -11);
  await comment(welcome, "ana", "Obrigada! Muito claro o processo.", -58);

  const reactors: [string, PersonKey[]][] = [
    [welcome, ["ana", "bruno", "carolina", "ines", "leonor", "rita", "tomas"]],
    [launch, ["carolina", "diogo", "tomas"]],
    [q1, ["bruno", "goncalo"]],
    [d2, ["ana", "miguel", "goncalo", "ines", "beatriz"]],
    [d1, ["carolina"]],
  ];
  for (const [p, ks] of reactors) for (const k of ks) await tx.insert(s.reactions).values({ postId: p, userId: U[k] });

  // Members who confirmed following the host on the networks, and the team's stories (demonstration only: text, no photos).
  const follow: [PersonKey, PersonKey[]][] = [
    ["ana", ["helena", "leonor", "rita"]],
    ["bruno", ["helena", "ana"]],
    ["carolina", ["helena", "diogo"]],
    ["leonor", ["helena", "ana", "goncalo"]],
    ["rita", ["helena"]],
    ["goncalo", ["leonor"]],
  ];
  for (const [who, list] of follow) for (const k of list) await tx.insert(s.follows).values({ followerId: U[who], followeeId: U[k], createdAt: day(-20) });
  const story = (author: PersonKey, body: string, hoursAgo: number) =>
    tx.insert(s.posts).values({ authorId: U[author], kind: "story", title: "", body, createdAt: new Date(NOW - hoursAgo * 36e5) });
  await story("helena", "Esta semana: o desafio de IA para o pequeno comércio está aberto. Leiam os critérios antes de submeter.", 30);
  await story("helena", "Amanhã publico um vídeo novo nos Bastidores.", 5);

  // Learning --------------------------------------------------------------------
  const lessonIds: Record<string, string> = {};
  for (const [ci, c] of courseSeeds.entries()) {
    const course = await tx.insert(s.courses).values({ slug: c.slug, title: c.title, description: c.description, level: c.level, coverHue: c.hue, position: ci }).returning({ id: s.courses.id }).then((r) => r[0]);
    for (const [mi, m] of c.modules.entries()) {
      const mod = await tx.insert(s.modules).values({ courseId: course.id, title: m.title, position: mi }).returning({ id: s.modules.id }).then((r) => r[0]);
      for (const [li, [slug, title, dur, content]] of m.lessons.entries())
        lessonIds[slug] = await tx
          .insert(s.lessons)
          .values({ moduleId: mod.id, slug, title, durationMin: dur, content, position: li, createdAt: day(Math.min(-1, -40 + ci * 15 + mi * 3 + li)) })
          .returning({ id: s.lessons.id })
          .then((r) => r[0].id);
    }
  }
  const progress: [PersonKey, string[], number][] = [
    ["ana", ["entrevistas-que-funcionam", "dimensionar-o-mercado", "o-mvp-certo", "criterios-e-pesos"], -20],
    ["bruno", ["o-mvp-certo", "medir-o-que-importa"], -15],
    ["rita", ["entrevistas-que-funcionam"], -3],
    ["sofia", ["entrevistas-que-funcionam", "dimensionar-o-mercado"], -2],
  ];
  for (const [k, ls, d] of progress) ls.forEach((l, i) => tx.insert(s.lessonProgress).values({ userId: U[k], lessonId: lessonIds[l], completedAt: day(d + i) }));
  });
}
