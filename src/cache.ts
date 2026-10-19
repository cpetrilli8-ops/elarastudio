import { openDB } from "idb";
import { parseBackup, type Workspace } from "./model";
const db = () =>
  openDB("elara-cache-v1", 1, {
    upgrade(d) {
      d.createObjectStore("workspaces");
    },
  });
// A generation prevents late requests from writing after logout/account changes.
export class UserCache {
  private user: string | null = null;
  private generation = 0;
  private writes: Promise<unknown> = Promise.resolve();
  activate(user: string | null) {
    this.user = user;
    this.generation++;
    return this.generation;
  }
  current(user: string, generation: number) {
    return this.user === user && this.generation === generation;
  }
  async read(
    user: string,
    generation: number,
  ): Promise<{ data: Workspace; saved: number } | null> {
    const d = await db();
    try {
      const entry = await d.get("workspaces", user);
      if (!entry || !this.current(user, generation)) return null;
      return {
        data: parseBackup({ version: 1, ...entry.data }),
        saved: entry.saved,
      };
    } catch {
      await d.delete("workspaces", user);
      return null;
    } finally {
      d.close();
    }
  }
  write(user: string, generation: number, data: Workspace) {
    const operation = this.writes
      .catch(() => {})
      .then(async () => {
        if (!this.current(user, generation)) return;
        const d = await db();
        try {
          if (this.current(user, generation))
            await d.put("workspaces", { data, saved: Date.now() }, user);
        } finally {
          d.close();
        }
      });
    this.writes = operation;
    return operation;
  }
  async clear(user: string) {
    await this.writes.catch(() => {});
    const d = await db();
    try {
      await d.delete("workspaces", user);
    } finally {
      d.close();
    }
  }
}
export const cache = new UserCache();
