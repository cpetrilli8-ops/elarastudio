import { createClient } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";
import { parseBackup, type Workspace, type Table } from "./model";
import { checkMediaFile } from "./media";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
// Native builds keep sessions in memory until a reviewed Keychain/Keystore adapter is supplied.
// Tokens are never persisted to unencrypted native preferences or localStorage.
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          flowType: "pkce",
          persistSession: !Capacitor.isNativePlatform(),
          autoRefreshToken: true,
          detectSessionInUrl: !Capacitor.isNativePlatform(),
        },
      })
    : null;
export const appUrl = (
  import.meta.env.VITE_APP_URL || window.location.origin
).replace(/\/$/, "");
export async function loadWorkspace(): Promise<Workspace> {
  if (!supabase) throw Error("Supabase non configurato.");
  const tables = ["brands", "profiles", "contents"] as const;
  const lists = await Promise.all(
    tables.map(async (table) => {
      const rows: unknown[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase!
          .from(table)
          .select("*")
          .order("id")
          .range(offset, offset + 499);
        if (error) throw error;
        rows.push(...data);
        if (data.length < 500) break;
      }
      return rows;
    }),
  );
  return parseBackup({
    version: 1,
    brands: lists[0],
    profiles: lists[1],
    contents: lists[2],
  });
}
export async function saveRecord(
  table: Table,
  user: string,
  record: Record<string, unknown>,
) {
  if (!supabase) throw Error("Supabase non configurato.");
  const { error } = await supabase
    .from(table)
    .upsert({ ...record, owner_id: user });
  if (error) throw error;
}
export async function removeRecord(table: Table, id: string) {
  if (!supabase) throw Error("Supabase non configurato.");
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
}
export function validateImage(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw Error("Usa un’immagine JPG, PNG o WebP.");
  if (file.size > 5 * 1024 * 1024)
    throw Error("L’immagine deve essere inferiore a 5 MB.");
}
export async function uploadContentImage(user: string, file: File) {
  if (!supabase) throw Error("Supabase non configurato.");
  validateImage(file);
  const bitmap = await createImageBitmap(file);
  const pixels = bitmap.width * bitmap.height;
  bitmap.close();
  if (pixels > 25000000)
    throw Error("Immagine troppo grande: massimo 25 megapixel.");
  const ext =
    file.type === "image/jpeg"
      ? "jpg"
      : file.type === "image/png"
        ? "png"
        : "webp";
  const path = `${user}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("editorial-images")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}
export async function deleteContentImage(path: string) {
  if (!supabase) return;
  const { error } = await supabase.storage
    .from("editorial-images")
    .remove([path]);
  if (error) throw error;
}
export async function uploadEditorialMedia(
  user: string,
  file: File,
  plan: string,
) {
  if (!supabase) throw Error("Supabase non configurato.");
  const kind = checkMediaFile(file, plan);
  const ext =
    kind === "video"
      ? "mp4"
      : file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : "jpg";
  if (kind === "video" && file.type !== "video/mp4")
    throw Error("Adatta il video al formato MP4 prima del salvataggio.");
  const path = `${user}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("editorial-media")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}
export async function removeEditorialMedia(paths: string[]) {
  if (!supabase || !paths.length) return;
  const { error } = await supabase.storage
    .from("editorial-media")
    .remove(paths);
  if (error) throw error;
}
