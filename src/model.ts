import { z } from "zod";
export const statuses = [
  "Idea",
  "In lavorazione",
  "Da approvare",
  "Programmato",
  "Pubblicato",
] as const;
export const platforms = [
  "Instagram",
  "TikTok",
  "YouTube",
  "Pinterest",
  "Facebook",
  "LinkedIn",
  "Blog",
] as const;
const uid = z.string().uuid();
const text = (n: number) => z.string().max(n);
const base = { id: uid };
export const brandSchema = z.object({
  ...base,
  name: text(120).min(1),
  description: text(4000),
  tone: text(2000),
});
export const profileSchema = z.object({
  ...base,
  brand_id: uid,
  platform: z.enum(platforms),
  handle: text(120).min(1),
});
export const contentSchema = z.object({
  ...base,
  brand_id: uid,
  profile_id: uid.nullable(),
  title: text(240).min(1),
  platform: z.enum(platforms),
  format: text(80),
  pillar: text(120),
  status: z.enum(statuses),
  scheduled_at: z.string().datetime({ offset: true }).nullable(),
  script: text(20000),
  notes: text(10000),
  hook: text(1000).default(""),
  description: text(10000).default(""),
  image_path: text(500).nullable().default(null),
  media: z
    .array(
      z.object({
        path: text(500),
        name: text(240),
        kind: z.enum(["image", "video"]),
        width: z.number().int().positive().max(7680),
        height: z.number().int().positive().max(7680),
        preset: text(80),
      }),
    )
    .max(10)
    .default([]),
  hashtags: z
    .array(
      z
        .string()
        .min(1)
        .max(80)
        .regex(
          /^[\p{L}\p{M}\p{N}_]+$/u,
          "Usa solo lettere, numeri e underscore negli hashtag.",
        ),
    )
    .max(5)
    .refine(
      (tags) => new Set(tags.map((t) => t.toLowerCase())).size === tags.length,
      "Gli hashtag devono essere diversi.",
    )
    .default([]),
});
export type Brand = z.infer<typeof brandSchema>;
export function readHashtags(form: FormData) {
  return Array.from({ length: 5 }, (_, i) =>
    String(form.get(`hashtag_${i}`) || "")
      .trim()
      .replace(/^#+/, ""),
  ).filter(Boolean);
}
export type Social = z.infer<typeof profileSchema>;
export type Content = z.infer<typeof contentSchema>;
export type Workspace = {
  brands: Brand[];
  profiles: Social[];
  contents: Content[];
};
export type Table = "brands" | "profiles" | "contents";
export const emptyWorkspace = (): Workspace => ({
  brands: [],
  profiles: [],
  contents: [],
});
export const backupSchema = z
  .object({
    version: z.literal(1),
    brands: z.array(brandSchema).max(500),
    profiles: z.array(profileSchema).max(2000),
    contents: z.array(contentSchema).max(10000),
  })
  .superRefine((w, ctx) => {
    for (const list of [w.brands, w.profiles, w.contents])
      if (new Set(list.map((x) => x.id)).size !== list.length)
        ctx.addIssue({
          code: "custom",
          message: "Identificativi duplicati nel backup.",
        });
    const brands = new Set(w.brands.map((x) => x.id));
    const profiles = new Map(w.profiles.map((x) => [x.id, x]));
    for (const p of w.profiles)
      if (!brands.has(p.brand_id))
        ctx.addIssue({
          code: "custom",
          message: "Profilo senza brand valido.",
        });
    for (const c of w.contents)
      if (
        !brands.has(c.brand_id) ||
        (c.profile_id && profiles.get(c.profile_id)?.brand_id !== c.brand_id)
      )
        ctx.addIssue({
          code: "custom",
          message: "Contenuto con associazioni non valide.",
        });
  });
export function parseBackup(value: unknown): Workspace {
  const w = backupSchema.parse(value);
  return { brands: w.brands, profiles: w.profiles, contents: w.contents };
}
export function remapBackup(
  w: Workspace,
  makeId = () => crypto.randomUUID(),
): Workspace {
  const brands = new Map(w.brands.map((b) => [b.id, makeId()]));
  const profiles = new Map(w.profiles.map((p) => [p.id, makeId()]));
  return {
    brands: w.brands.map((b) => ({ ...b, id: brands.get(b.id)! })),
    profiles: w.profiles.map((p) => ({
      ...p,
      id: profiles.get(p.id)!,
      brand_id: brands.get(p.brand_id)!,
    })),
    contents: w.contents.map((c) => ({
      ...c,
      image_path: null,
      media: [],
      id: makeId(),
      brand_id: brands.get(c.brand_id)!,
      profile_id: c.profile_id ? profiles.get(c.profile_id)! : null,
    })),
  };
}
