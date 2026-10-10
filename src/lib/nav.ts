import { BriefcaseBusiness, Clapperboard, ClipboardCheck, Gauge, House, Medal, Share2, SquarePlay, Trophy, UserCog, UserRound, Users, type LucideIcon } from "lucide-react";
import type { Role } from "@/db/schema";

/** Navigation model shared by the server layout and the client navigation components. */
export type Item = { href: string; label: string; icon: LucideIcon; match: (path: string) => boolean };

export const under = (...prefixes: string[]) => (p: string) => prefixes.some((x) => p === x || p.startsWith(x + "/"));

/** The five areas every member sees, in this order. The profile owns /members/<own handle>. */
export function mainItems(handle: string): Item[] {
  const own = under("/profile", "/settings", `/members/${handle}`);
  return [
    { href: "/dashboard", label: "Início", icon: House, match: under("/dashboard", "/community") },
    { href: "/videos", label: "Vídeos", icon: SquarePlay, match: under("/videos", "/learn") },
    { href: "/challenges", label: "Desafios", icon: Trophy, match: under("/challenges") },
    { href: "/members", label: "Membros", icon: Users, match: (p) => !own(p) && under("/members", "/leaderboard", "/projects")(p) },
    { href: "/profile", label: "Perfil", icon: UserRound, match: own },
  ];
}

/**
 * Desktop: the community's sections as text tabs under the header, Skool-style.
 * The profile lives in the account menu (the photo at the top right).
 */
export function sectionTabs(): Item[] {
  return [
    { href: "/dashboard", label: "Comunidade", icon: House, match: under("/dashboard", "/community") },
    { href: "/videos", label: "Vídeos", icon: SquarePlay, match: under("/videos", "/learn") },
    { href: "/challenges", label: "Desafios", icon: Trophy, match: under("/challenges") },
    { href: "/members", label: "Membros", icon: Users, match: under("/members", "/projects") },
    { href: "/leaderboard", label: "Classificação", icon: Medal, match: under("/leaderboard") },
  ];
}

/** Management tools, by role. Members have none; they never appear in the member navigation. */
export function toolsFor(role: Role): Item[] {
  if (role === "investor")
    return [
      { href: "/admin", label: "Painel e desafios", icon: Gauge, match: (p) => p === "/admin" || under("/admin/challenges")(p) },
      { href: "/admin/videos", label: "Gerir vídeos", icon: Clapperboard, match: under("/admin/videos") },
      { href: "/admin/social", label: "Conteúdos sociais", icon: Share2, match: under("/admin/social") },
      { href: "/admin/people", label: "Membros e acessos", icon: UserCog, match: under("/admin/people") },
      { href: "/admin/opportunities", label: "Pipeline de investimento", icon: BriefcaseBusiness, match: under("/admin/opportunities") },
    ];
  if (role === "evaluator") return [{ href: "/review", label: "Avaliações", icon: ClipboardCheck, match: under("/review", "/evaluate") }];
  return [];
}

