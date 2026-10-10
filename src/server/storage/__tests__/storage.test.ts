import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { files, projects, users } from "@/db/schema";
import { DomainError } from "../../errors";
import { fileForServing, sniffImage, uploadProjectLogo } from "../../files";
import { createProject } from "../../projects";
import { setStorage } from "../index";
import { LocalStorageProvider } from "../local";
import type { StorageProvider } from "../types";

/** PNG signature and IHDR (1×1): enough for type and size checks; no pixels are decoded. */
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0, 0, 0, 0, 0]);

describe("LocalStorageProvider", () => {
  it("stores, reads and deletes, and refuses path traversal", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ncc-store-"));
    const s = new LocalStorageProvider(root);
    await s.put("a/b.png", PNG, "image/png");
    expect((await s.get("a/b.png"))?.body).toEqual(PNG);
    await s.delete("a/b.png");
    expect(await s.get("a/b.png")).toBeNull();
    await expect(s.put("../escape.png", PNG, "image/png")).rejects.toThrow(/Invalid storage key/);
  });
});

describe("file uploads", () => {
  it("detects real image types from bytes", () => {
    expect(sniffImage(PNG)?.type).toBe("image/png");
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.type).toBe("image/jpeg");
    expect(sniffImage(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });

  it("uploads a project logo with permission and type checks, and replaces the old one", async () => {
    const objects = new Map<string, Uint8Array>();
    const memory: StorageProvider = {
      name: "memory",
      put: async (k, b) => void objects.set(k, b),
      get: async (k) => (objects.has(k) ? { body: objects.get(k)! } : null),
      delete: async (k) => void objects.delete(k),
    };
    setStorage(memory);
    const [owner] = await db.insert(users).values({ email: "logo@t.test", authSubject: "s-logo", name: "Logo", handle: "logo", role: "member" }).returning();
    const [stranger] = await db.insert(users).values({ email: "x@t.test", authSubject: "s-x", name: "X", handle: "x", role: "member" }).returning();
    const p = await createProject(owner, { name: "Logo Co", tagline: "Uma frase de teste longa", category: "Teste", stage: "idea", logoHue: 1, websiteUrl: "", demoUrl: "", repoUrl: "" });

    const blob = new Blob([PNG], { type: "image/png" });
    await expect(uploadProjectLogo(stranger, p.id, blob)).rejects.toBeInstanceOf(DomainError);
    await expect(uploadProjectLogo(owner, p.id, new Blob(["not an image"]))).rejects.toThrow(/Formato/);
    await expect(uploadProjectLogo(owner, p.id, new Blob([new Uint8Array(3 * 1024 * 1024)]))).rejects.toThrow(/2 MB/);

    await uploadProjectLogo(owner, p.id, blob);
    const [first] = await db.select().from(projects).where(eq(projects.id, p.id));
    const firstFile = await fileForServing(first.logoFileId!);
    expect(objects.has(firstFile.storageKey)).toBe(true);
    expect(firstFile.storageKey.startsWith(`projects/${p.id}/`)).toBe(true); // provider-neutral key, not a URL

    await uploadProjectLogo(owner, p.id, blob);
    const [second] = await db.select().from(projects).where(eq(projects.id, p.id));
    expect(second.logoFileId).not.toBe(first.logoFileId);
    expect(objects.has(firstFile.storageKey)).toBe(false); // old object removed
    expect(await db.select().from(files).where(eq(files.id, first.logoFileId!))).toEqual([]);

  });
});
