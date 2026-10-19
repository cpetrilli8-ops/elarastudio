import { describe, it, expect } from "vitest";
import {
  parseBackup,
  remapBackup,
  contentSchema,
  readHashtags,
  type Workspace,
} from "./model";
const b = "11111111-1111-4111-8111-111111111111",
  p = "22222222-2222-4222-8222-222222222222",
  c = "33333333-3333-4333-8333-333333333333";
const sample: Workspace = {
  brands: [{ id: b, name: "Elara", description: "", tone: "" }],
  profiles: [{ id: p, brand_id: b, platform: "Instagram", handle: "elara" }],
  contents: [
    {
      id: c,
      brand_id: b,
      profile_id: p,
      title: "Idea",
      platform: "Instagram",
      format: "",
      pillar: "",
      status: "Idea",
      scheduled_at: null,
      script: "",
      notes: "",
      hook: "",
      description: "",
      image_path: null,
      hashtags: [],
      media: [],
    },
  ],
};
describe("Backup validation", () => {
  it("accepts five unique hashtags and rejects a sixth or invalid entries", () => {
    expect(
      contentSchema.shape.hashtags.parse([
        "uno",
        "due",
        "tre",
        "quattro",
        "cinque",
      ]),
    ).toHaveLength(5);
    expect(() =>
      contentSchema.shape.hashtags.parse(["1", "2", "3", "4", "5", "6"]),
    ).toThrow();
    expect(() => contentSchema.shape.hashtags.parse(["ciao mondo"])).toThrow();
    expect(() =>
      contentSchema.shape.hashtags.parse(["Elara", "elara"]),
    ).toThrow();
    const form = new FormData();
    form.set("hashtag_0", " #creatività ");
    expect(readHashtags(form)).toEqual(["creatività"]);
  });
  it("accepts complete data and strips untrusted owner IDs", () => {
    const parsed = parseBackup({
      version: 1,
      ...sample,
      brands: [{ ...sample.brands[0], owner_id: "attacker" }],
    });
    expect(parsed.brands[0]).not.toHaveProperty("owner_id");
  });
  it("rejects unsupported versions", () =>
    expect(() => parseBackup({ version: 99, ...sample })).toThrow());
  it("rejects dangling associations", () =>
    expect(() => parseBackup({ version: 1, ...sample, brands: [] })).toThrow());
  it("rejects profiles linked to another brand", () =>
    expect(() =>
      parseBackup({
        version: 1,
        ...sample,
        profiles: [{ ...sample.profiles[0], brand_id: c }],
      }),
    ).toThrow());
  it("rejects duplicates and invalid dates", () => {
    expect(() =>
      parseBackup({
        version: 1,
        ...sample,
        brands: [...sample.brands, ...sample.brands],
      }),
    ).toThrow();
    expect(() =>
      parseBackup({
        version: 1,
        ...sample,
        contents: [{ ...sample.contents[0], scheduled_at: "yesterday" }],
      }),
    ).toThrow();
  });
  it("remaps every ID while preserving relations without mutating the source", () => {
    const result = remapBackup(sample);
    expect(result.brands[0].id).not.toBe(b);
    expect(result.profiles[0].brand_id).toBe(result.brands[0].id);
    expect(result.contents[0].profile_id).toBe(result.profiles[0].id);
    expect(sample.brands[0].id).toBe(b);
    expect(() => parseBackup({ version: 1, ...result })).not.toThrow();
  });
});
