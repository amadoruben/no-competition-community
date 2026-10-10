import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { users, type User } from "@/db/schema";
import { DomainError } from "../errors";
import { addVideo, createCollection, deleteVideo, getCourse, getLesson, latestVideos, listCourses, setCollectionAccess, setLessonComplete } from "../learning";
import { setAccessTier } from "../people";

const mk = async (handle: string, role: User["role"] = "member") =>
  (await db.insert(users).values({ email: `${handle}@v.test`, authSubject: `s-${handle}`, name: handle, handle, role }).returning())[0];
const code = (p: Promise<unknown>) => p.then(() => "ok", (e) => (e instanceof DomainError ? e.code : `raw:${e}`));
const YT = "https://youtu.be/dQw4w9WgXcQ";

describe("video library", () => {
  it("admin publishes a collection and members watch free videos", async () => {
    const admin = await mk("v-admin", "investor");
    const m = await mk("v-mem");
    const c = await createCollection(admin, { title: "Bastidores", description: "Por trás das câmaras.", accessTier: "free" });
    const v = await addVideo(admin, { courseId: c.id, title: "Episódio 1", videoUrl: YT, content: "Notas", durationMin: "12" });
    const again = await addVideo(admin, { courseId: c.id, title: "Episódio 1", videoUrl: YT, durationMin: 3 });
    expect(again.slug).not.toBe(v.slug);
    const d = await getLesson(m, c.slug, v.slug);
    expect(d.lesson.videoUrl).toBe(YT);
    expect(d.next?.slug).toBe(again.slug);
    const listed = (await listCourses(m)).find((x) => x.id === c.id)!;
    expect(listed).toMatchObject({ locked: false, videoCount: 2, thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" });
    await setLessonComplete(m, v.id, true);
    expect((await getCourse(m, c.slug)).completed).toBe(1);
  });

  it("restricted collections reveal nothing to members without full access", async () => {
    const admin = await mk("v-admin2", "investor");
    const m = await mk("v-mem2");
    const c = await createCollection(admin, { title: "Masterclass", description: "Exclusivo.", accessTier: "full" });
    const v = await addVideo(admin, { courseId: c.id, title: "Aula secreta", videoUrl: YT, content: "Segredo", durationMin: 20 });
    const d = await getCourse(m, c.slug);
    expect(d.locked).toBe(true);
    expect(d.flat.every((l) => l.videoUrl === null && l.content === "")).toBe(true);
    expect((await listCourses(m)).find((x) => x.id === c.id)!.thumbnail).toBeNull();
    expect((await latestVideos(m, 50)).some((x) => x.id === v.id)).toBe(false);
    expect(await code(getLesson(m, c.slug, v.slug))).toBe("forbidden");
    expect(await code(setLessonComplete(m, v.id, true))).toBe("forbidden");

    await setAccessTier(admin, m.id, "full");
    const granted = { ...m, accessTier: "full" as const };
    expect((await getLesson(granted, c.slug, v.slug)).lesson.content).toBe("Segredo");

    await setCollectionAccess(admin, c.id, "free");
    expect((await getCourse(m, c.slug)).locked).toBe(false);
  });

  it("only the admin manages the library and links are validated", async () => {
    const admin = await mk("v-admin3", "investor");
    const m = await mk("v-mem3");
    expect(await code(createCollection(m, { title: "X colecção", description: "abc", accessTier: "free" }))).toBe("forbidden");
    const c = await createCollection(admin, { title: "Ensinamentos", description: "Lições.", accessTier: "free" });
    expect(await code(addVideo(admin, { courseId: c.id, title: "Mau link", videoUrl: "https://evil.test/x", durationMin: 5 }))).toBe("invalid");
    const v = await addVideo(admin, { courseId: c.id, title: "Bom link", videoUrl: "https://vimeo.com/76979871", durationMin: 5 });
    expect(await code(deleteVideo(m, v.id))).toBe("forbidden");
    expect(await code(setAccessTier(m, m.id, "full"))).toBe("forbidden");
    await deleteVideo(admin, v.id);
    expect((await getCourse(admin, c.slug)).flat).toHaveLength(0);
  });
});
