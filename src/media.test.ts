import { it, expect } from "vitest";
import { drawBox, maxMedia, mediaFormats, checkMediaFile } from "./media";
it("keeps all pixels when fitting and crops centrally when filling", () => {
  expect(drawBox(1920, 1080, 1080, 1920, "contain")).toEqual({
    x: 0,
    y: 656.25,
    width: 1080,
    height: 607.5,
  });
  const cropped = drawBox(1920, 1080, 1080, 1920, "cover");
  expect(cropped.height).toBe(1920);
  expect(cropped.x).toBeLessThan(0);
  expect(cropped.y).toBe(0);
});
it("allows multiple media only for Premium on Instagram or TikTok", () => {
  expect(maxMedia("premium", "Instagram")).toBe(10);
  expect(maxMedia("premium", "TikTok")).toBe(10);
  expect(maxMedia("premium", "YouTube")).toBe(1);
  expect(maxMedia("pro", "Instagram")).toBe(1);
});
it("rejects unsupported types and videos on other plans", () => {
  expect(() =>
    checkMediaFile(new File(["x"], "clip.mp4", { type: "video/mp4" }), "free"),
  ).toThrow();
  expect(
    checkMediaFile(
      new File(["x"], "clip.mp4", { type: "video/mp4" }),
      "premium",
    ),
  ).toBe("video");
  expect(() =>
    checkMediaFile(
      new File(["x"], "x.svg", { type: "image/svg+xml" }),
      "premium",
    ),
  ).toThrow();
});
it("provides positive even target sizes and specific platform presets", () => {
  expect(
    mediaFormats.every(
      (f) =>
        f.width > 0 && f.height > 0 && f.width % 2 === 0 && f.height % 2 === 0,
    ),
  ).toBe(true);
  expect(mediaFormats.find((f) => f.id === "tt-vertical")).toMatchObject({
    width: 1080,
    height: 1920,
  });
});
