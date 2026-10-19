import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, it, expect } from "vitest";
let db: PGlite;
const owner = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222";
const brand = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  otherBrand = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  profile = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;insert into auth.users values('${owner}'),('${other}');`,
  );
  await db.exec(
    readFileSync(
      new URL(
        "../supabase/migrations/202610190001_workspace.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    `insert into brands(id,owner_id,name) values('${brand}','${owner}','Mine'),('${otherBrand}','${other}','Other');insert into profiles(id,owner_id,brand_id,platform,handle) values('${profile}','${owner}','${brand}','Instagram','mine');`,
  );
  await db.exec(
    `create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb);alter table storage.objects enable row level security;create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;`,
  );
  await db.exec(
    readFileSync(
      new URL(
        "../supabase/migrations/202610190002_editorial_images.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      new URL(
        "../supabase/migrations/202610190003_premium_media.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
async function asUser(uid: string) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid]);
  await db.exec("set role authenticated");
}
it("shows only owned brands and blocks cross-user reads", async () => {
  await asUser(owner);
  const result = await db.query<{ id: string }>("select id from brands");
  expect(result.rows.map((x) => x.id)).toEqual([brand]);
});
it("rejects spoofed ownership on insert", async () => {
  await asUser(owner);
  await expect(
    db.query("insert into brands(owner_id,name) values($1,$2)", [
      other,
      "Forbidden",
    ]),
  ).rejects.toThrow();
});
it("cannot update or delete another account’s record", async () => {
  await asUser(owner);
  await db.query("update brands set name=$1 where id=$2", [
    "Attack",
    otherBrand,
  ]);
  await db.query("delete from brands where id=$1", [otherBrand]);
  await asUser(other);
  const r = await db.query<{ name: string }>(
    "select name from brands where id=$1",
    [otherBrand],
  );
  expect(r.rows[0].name).toBe("Other");
});
it("rejects cross-user brand associations", async () => {
  await asUser(owner);
  await expect(
    db.query(
      "insert into profiles(brand_id,platform,handle) values($1,$2,$3)",
      [otherBrand, "Instagram", "no"],
    ),
  ).rejects.toThrow();
});
it("rejects profiles associated with a different brand", async () => {
  await asUser(owner);
  const id = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  await db.query("insert into brands(id,name) values($1,$2)", [id, "Second"]);
  await expect(
    db.query(
      "insert into contents(brand_id,profile_id,title,platform) values($1,$2,$3,$4)",
      [id, profile, "Invalid", "Instagram"],
    ),
  ).rejects.toThrow();
});
it("allows real CRUD for own content and prevents deleting linked brands", async () => {
  await asUser(owner);
  const id = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  await db.query(
    "insert into contents(id,brand_id,profile_id,title,platform) values($1,$2,$3,$4,$5)",
    [id, brand, profile, "Test", "Instagram"],
  );
  await db.query("update contents set status=$1 where id=$2", [
    "Programmato",
    id,
  ]);
  const r = await db.query<{ status: string }>(
    "select status from contents where id=$1",
    [id],
  );
  expect(r.rows[0].status).toBe("Programmato");
  await expect(
    db.query("delete from brands where id=$1", [brand]),
  ).rejects.toThrow();
  await db.query("delete from contents where id=$1", [id]);
});
it("rejects anonymous access", async () => {
  await db.exec("reset role;set role anon");
  await expect(db.query("select * from contents")).rejects.toThrow();
});
it("rolls back the whole import if a relation is invalid", async () => {
  await asUser(owner);
  const id = "ffffffff-ffff-4fff-8fff-ffffffffffff";
  await expect(
    db.query("select import_workspace($1::jsonb)", [
      JSON.stringify({
        brands: [{ id, name: "Must rollback" }],
        profiles: [
          {
            id: crypto.randomUUID(),
            brand_id: otherBrand,
            platform: "Instagram",
            handle: "no",
          },
        ],
        contents: [],
      }),
    ]),
  ).rejects.toThrow();
  const result = await db.query("select * from brands where id=$1", [id]);
  expect(result.rows).toHaveLength(0);
});
it("does not expose quota counters to authenticated clients", async () => {
  await asUser(owner);
  await expect(
    db.query("select consume_ai_quota($1)", [owner]),
  ).rejects.toThrow();
});
it("allows private image uploads only into the current user folder", async () => {
  await asUser(owner);
  await db.query("insert into storage.objects(bucket_id,name) values($1,$2)", [
    "editorial-images",
    owner + "/photo.png",
  ]);
  await expect(
    db.query("insert into storage.objects(bucket_id,name) values($1,$2)", [
      "editorial-images",
      other + "/photo.png",
    ]),
  ).rejects.toThrow();
  await asUser(other);
  const images = await db.query("select * from storage.objects");
  expect(images.rows).toHaveLength(0);
});
it("enforces the five-hashtag limit on the database", async () => {
  await asUser(owner);
  const id = crypto.randomUUID();
  await db.query(
    "insert into contents(id,brand_id,title,platform,hashtags) values($1,$2,$3,$4,$5)",
    [
      id,
      brand,
      "Tag test",
      "Instagram",
      ["uno", "due", "tre", "quattro", "cinque"],
    ],
  );
  await expect(
    db.query("update contents set hashtags=$1 where id=$2", [
      ["1", "2", "3", "4", "5", "6"],
      id,
    ]),
  ).rejects.toThrow();
  await db.query("delete from contents where id=$1", [id]);
});
it("prevents changing one’s plan from the browser", async () => {
  await asUser(owner);
  expect(
    (await db.query<{ current_plan: string }>("select current_plan()")).rows[0]
      .current_plan,
  ).toBe("free");
  await expect(
    db.query("insert into account_plans(owner_id,plan) values($1,$2)", [
      owner,
      "premium",
    ]),
  ).rejects.toThrow();
});
it("enforces Premium gallery counts and per-platform dimensions", async () => {
  await db.exec("reset role");
  await db.query("insert into account_plans(owner_id,plan) values($1,$2)", [
    owner,
    "premium",
  ]);
  await asUser(owner);
  const id = crypto.randomUUID();
  const item = {
    path: owner + "/photo.jpg",
    name: "photo.jpg",
    kind: "image",
    width: 1080,
    height: 1080,
    preset: "ig-square",
  };
  const gallery = [item, { ...item, path: owner + "/photo2.jpg" }];
  await db.query(
    "insert into contents(id,brand_id,title,platform,media) values($1,$2,$3,$4,$5::jsonb)",
    [id, brand, "Gallery", "Instagram", JSON.stringify(gallery)],
  );
  await expect(
    db.query("update contents set platform=$1 where id=$2", ["YouTube", id]),
  ).rejects.toThrow();
  await expect(
    db.query("update contents set media=$1::jsonb where id=$2", [
      JSON.stringify([{ ...item, width: 1 }]),
      id,
    ]),
  ).rejects.toThrow();
  await expect(
    db.query("update contents set media=$1::jsonb where id=$2", [
      JSON.stringify([{ ...item, path: other + "/private.jpg" }]),
      id,
    ]),
  ).rejects.toThrow();
  await db.query("delete from contents where id=$1", [id]);
  await db.exec("reset role");
  await db.query("delete from account_plans where owner_id=$1", [owner]);
  await asUser(owner);
  await expect(
    db.query(
      "insert into contents(brand_id,title,platform,media) values($1,$2,$3,$4::jsonb)",
      [brand, "Forbidden", "Instagram", JSON.stringify(gallery)],
    ),
  ).rejects.toThrow();
});
it("saves editorial hook, description and own image, rejects foreign paths", async () => {
  await asUser(owner);
  const id = crypto.randomUUID();
  await db.query(
    "insert into contents(id,brand_id,title,platform,hook,description,image_path) values($1,$2,$3,$4,$5,$6,$7)",
    [
      id,
      brand,
      "Editorial",
      "Instagram",
      "Hook",
      "Description",
      owner + "/photo.png",
    ],
  );
  const r = await db.query<{ hook: string; description: string }>(
    "select hook,description from contents where id=$1",
    [id],
  );
  expect(r.rows[0]).toEqual({ hook: "Hook", description: "Description" });
  await expect(
    db.query("update contents set image_path=$1 where id=$2", [
      other + "/private.png",
      id,
    ]),
  ).rejects.toThrow();
  await db.query("delete from contents where id=$1", [id]);
});
