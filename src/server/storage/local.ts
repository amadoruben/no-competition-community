import fs from "node:fs/promises";
import path from "node:path";
import type { StorageProvider } from "./types";

/** Files on the local disk. For development and self-hosted servers with a persistent volume. */
export class LocalStorageProvider implements StorageProvider {
  readonly name = "local";
  constructor(private root = path.resolve(/*turbopackIgnore: true*/ process.env.STORAGE_LOCAL_DIR ?? "data/uploads")) {}

  private resolve(key: string) {
    const full = path.resolve(/*turbopackIgnore: true*/ this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new Error("Invalid storage key");
    return full;
  }

  async put(key: string, body: Uint8Array, _contentType?: string) {
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, body);
  }

  async get(key: string) {
    try {
      return { body: new Uint8Array(await fs.readFile(this.resolve(key))) };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }

  async delete(key: string) {
    await fs.rm(this.resolve(key), { force: true });
  }
}
