import "server-only";
import type { User } from "@/db/schema";
import { deadlineText, timeAgo } from "@/lib/format";
import { isInvestor } from "@/server/permissions";
import { listStories, weeklyDigest, type DigestItem } from "@/server/stories";
import { fileUrl } from "../ui";
import type { ViewerGroup, ViewerSlide } from "./types";

const CTA: Record<DigestItem["kind"], string> = {
  challenge: "Ver desafio",
  deadline: "Ver desafio",
  results: "Ver resultados",
  announcement: "Ler anúncio",
  video: "Ver",
  members: "Ver membros",
};

function digestSlide(item: DigestItem): ViewerSlide {
  return {
    id: `digest:${item.key}:${+item.at}`,
    kind: "digest",
    ago: item.kind === "deadline" ? deadlineText(item.at) : item.kind === "members" ? "Esta semana" : timeAgo(item.at),
    label: item.label,
    title: item.title,
    detail: item.detail,
    href: item.href,
    cta: item.kind === "video" ? (item.href.split("/").length > 3 ? "Ver vídeo" : "Ver colecção") : CTA[item.kind],
    image: item.thumbnail ?? null,
    cover: item.cover,
    art: item.kind === "members" ? "wave" : item.kind === "announcement" ? "megaphone" : undefined,
  };
}

function personGroup(viewer: User, g: Awaited<ReturnType<typeof listStories>>[number]): ViewerGroup {
  return {
    key: g.author.id,
    name: g.author.name,
    href: `/members/${g.author.handle}`,
    avatar: { kind: "person", hue: g.author.avatarHue, fileId: g.author.avatarFileId },
    official: g.author.role === "investor",
    own: g.own,
    canDelete: g.own || isInvestor(viewer),
    slides: g.stories.map((s) =>
      s.photo
        ? { id: s.id, kind: "photo", ago: timeAgo(s.createdAt), caption: s.caption, photo: { url: fileUrl(s.photo.fileId), width: s.photo.width, height: s.photo.height } }
        : { id: s.id, kind: "text", ago: timeAgo(s.createdAt), caption: s.caption },
    ),
  };
}

/** One person's active stories (for the ring on their profile photo), or null. */
export async function storyGroupOf(viewer: User, userId: string): Promise<ViewerGroup | null> {
  const g = (await listStories(viewer)).find((x) => x.author.id === userId);
  return g ? personGroup(viewer, g) : null;
}

/**
 * The stories bar's content for this viewer, as plain data: the viewer's own
 * stories first, the community's weekly news, then everyone else's.
 */
export async function storiesFor(viewer: User): Promise<ViewerGroup[]> {
  const [groups, digest] = await Promise.all([listStories(viewer), weeklyDigest(viewer)]);
  const people = groups.map((g) => personGroup(viewer, g));
  const news: ViewerGroup[] = digest.length ? [{ key: "digest", name: "Novidades da semana", avatar: { kind: "brand" }, official: true, slides: digest.map(digestSlide) }] : [];
  const own = people.filter((g) => g.own);
  return [...own, ...news, ...people.filter((g) => !g.own)];
}
