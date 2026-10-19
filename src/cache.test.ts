import "fake-indexeddb/auto";
import { it, expect } from "vitest";
import { UserCache } from "./cache";
import { emptyWorkspace } from "./model";
it("isolates two users, clears logout data and rejects old responses", async () => {
  const cache = new UserCache();
  const first = cache.activate("one");
  await cache.write("one", first, emptyWorkspace());
  expect(await cache.read("one", first)).not.toBeNull();
  const second = cache.activate("two");
  expect(await cache.read("one", first)).toBeNull();
  expect(await cache.read("two", second)).toBeNull();
  await cache.write("one", first, { brands: [], profiles: [], contents: [] });
  await cache.clear("one");
  const third = cache.activate("one");
  expect(await cache.read("one", third)).toBeNull();
});
it("cannot resurrect a cleared cache from a queued write", async () => {
  const cache = new UserCache();
  const generation = cache.activate("race");
  const write = cache.write("race", generation, emptyWorkspace());
  cache.activate(null);
  await cache.clear("race");
  await write;
  const next = cache.activate("race");
  expect(await cache.read("race", next)).toBeNull();
});
