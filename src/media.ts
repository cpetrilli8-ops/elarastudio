export const mediaFormats = [
  {
    id: "ig-square",
    platform: "Instagram",
    label: "Post quadrato",
    width: 1080,
    height: 1080,
  },
  {
    id: "ig-portrait",
    platform: "Instagram",
    label: "Post verticale",
    width: 1080,
    height: 1350,
  },
  {
    id: "ig-story",
    platform: "Instagram",
    label: "Storia / Reel",
    width: 1080,
    height: 1920,
  },
  {
    id: "tt-vertical",
    platform: "TikTok",
    label: "Verticale TikTok",
    width: 1080,
    height: 1920,
  },
  {
    id: "yt-landscape",
    platform: "YouTube",
    label: "Video orizzontale",
    width: 1920,
    height: 1080,
  },
  {
    id: "yt-short",
    platform: "YouTube",
    label: "Short verticale",
    width: 1080,
    height: 1920,
  },
] as const;
export type MediaFormat = (typeof mediaFormats)[number];
export type SavedMedia = {
  path: string;
  name: string;
  kind: "image" | "video";
  width: number;
  height: number;
  preset: string;
};
export type DraftMedia = SavedMedia & {
  id: string;
  file?: File;
  url: string;
  ready: boolean;
};
export function maxMedia(plan: string, platform: string) {
  return plan === "premium" && ["Instagram", "TikTok"].includes(platform)
    ? 10
    : 1;
}
export function drawBox(
  sw: number,
  sh: number,
  dw: number,
  dh: number,
  fit: "contain" | "cover",
) {
  const scale =
    fit === "cover" ? Math.max(dw / sw, dh / sh) : Math.min(dw / sw, dh / sh);
  const width = sw * scale,
    height = sh * scale;
  return { x: (dw - width) / 2, y: (dh - height) / 2, width, height };
}
export function checkMediaFile(file: File, plan: string) {
  const image = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
  const video = ["video/mp4", "video/webm", "video/quicktime"].includes(
    file.type,
  );
  if (!image && !video) throw Error("Scegli JPG, PNG, WebP, MP4, WebM o MOV.");
  if (video && plan !== "premium")
    throw Error("Gli allegati video sono previsti nel piano Premium.");
  if (file.size > (video ? 50 : 5) * 1024 * 1024)
    throw Error(
      video
        ? "Video troppo grande: massimo 50 MB."
        : "Immagine troppo grande: massimo 5 MB.",
    );
  return image ? ("image" as const) : ("video" as const);
}
export async function dimensions(file: File, kind: "image" | "video") {
  if (kind === "image") {
    const b = await createImageBitmap(file);
    const size = { width: b.width, height: b.height, duration: 0 };
    b.close();
    if (size.width * size.height > 25000000)
      throw Error("Immagine troppo grande: massimo 25 megapixel.");
    return size;
  }
  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  v.preload = "metadata";
  v.src = url;
  try {
    return await new Promise<{
      width: number;
      height: number;
      duration: number;
    }>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(Error("Impossibile leggere il video.")),
        12000,
      );
      v.onloadedmetadata = () => {
        clearTimeout(timer);
        if (!Number.isFinite(v.duration) || v.duration > 60) {
          reject(
            Error("Per la conversione locale usa clip di massimo 60 secondi."),
          );
          return;
        }
        resolve({
          width: v.videoWidth,
          height: v.videoHeight,
          duration: v.duration,
        });
      };
      v.onerror = () => {
        clearTimeout(timer);
        reject(Error("Video non leggibile da questo browser. Prova un MP4."));
      };
    });
  } finally {
    v.removeAttribute("src");
    v.load();
    URL.revokeObjectURL(url);
  }
}
export async function formatImage(
  file: File,
  format: MediaFormat,
  fit: "contain" | "cover",
) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = format.width;
  canvas.height = format.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw Error("Questo browser non supporta l’editor immagini.");
  }
  ctx.fillStyle = "#faf3ec";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const r = drawBox(
    bitmap.width,
    bitmap.height,
    canvas.width,
    canvas.height,
    fit,
  );
  ctx.drawImage(bitmap, r.x, r.y, r.width, r.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(Error("Conversione non riuscita."))),
      "image/jpeg",
      0.91,
    ),
  );
  return new File(
    [blob],
    file.name.replace(/\.[^.]+$/, "") +
      "-" +
      format.width +
      "x" +
      format.height +
      ".jpg",
    { type: "image/jpeg" },
  );
}
export async function formatVideo(
  file: File,
  format: MediaFormat,
  fit: "contain" | "cover",
  signal: AbortSignal,
  progress: (n: number) => void,
) {
  const mime = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4"].find(
    (m) =>
      typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m),
  );
  if (!mime)
    throw Error(
      "Questo browser non può esportare MP4. Usa un browser compatibile oppure carica un MP4 già nelle dimensioni scelte.",
    );
  const url = URL.createObjectURL(file),
    v = document.createElement("video"),
    canvas = document.createElement("canvas");
  v.src = url;
  v.playsInline = true;
  v.preload = "auto";
  canvas.width = format.width;
  canvas.height = format.height;
  const ctx = canvas.getContext("2d");
  if (!ctx || !canvas.captureStream) {
    URL.revokeObjectURL(url);
    throw Error("Conversione video non supportata su questo dispositivo.");
  }
  const audio = new AudioContext();
  await audio.resume();
  const source = audio.createMediaElementSource(v),
    dest = audio.createMediaStreamDestination();
  source.connect(dest);
  const stream = canvas.captureStream(30);
  dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  let raf = 0;
  let recorder: MediaRecorder | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(Error("Video non leggibile.")),
        12000,
      );
      v.onloadeddata = () => {
        clearTimeout(timer);
        resolve();
      };
      v.onerror = () => {
        clearTimeout(timer);
        reject(Error("Video non leggibile."));
      };
      v.load();
    });
    if (signal.aborted) throw Error("Conversione annullata.");
    if (!Number.isFinite(v.duration) || v.duration > 60)
      throw Error("Massimo 60 secondi per la conversione nel browser.");
    const chunks: Blob[] = [];
    recorder = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: 6000000,
      audioBitsPerSecond: 128000,
    });
    const result = await new Promise<File>((resolve, reject) => {
      const timeout = setTimeout(
        () => {
          recorder?.stop();
          reject(Error("Conversione interrotta: tempo massimo superato."));
        },
        Math.max(30000, (v.duration + 20) * 1000),
      );
      const cancel = () => {
        clearTimeout(timeout);
        if (recorder?.state !== "inactive") recorder?.stop();
        v.pause();
        reject(Error("Conversione annullata."));
      };
      signal.addEventListener("abort", cancel, { once: true });
      recorder!.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      recorder!.onerror = () => {
        clearTimeout(timeout);
        signal.removeEventListener("abort", cancel);
        reject(Error("Errore durante l’esportazione MP4."));
      };
      recorder!.onstop = () => {
        clearTimeout(timeout);
        signal.removeEventListener("abort", cancel);
        const blob = new Blob(chunks, { type: "video/mp4" });
        if (signal.aborted || blob.size === 0) {
          reject(Error("Conversione annullata o vuota."));
          return;
        }
        resolve(
          new File(
            [blob],
            file.name.replace(/\.[^.]+$/, "") +
              "-" +
              format.width +
              "x" +
              format.height +
              ".mp4",
            { type: "video/mp4" },
          ),
        );
      };
      const draw = () => {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const r = drawBox(
          v.videoWidth,
          v.videoHeight,
          canvas.width,
          canvas.height,
          fit,
        );
        ctx.drawImage(v, r.x, r.y, r.width, r.height);
        progress(Math.min(99, Math.round((v.currentTime / v.duration) * 100)));
        raf = requestAnimationFrame(draw);
      };
      v.onended = () => {
        cancelAnimationFrame(raf);
        if (recorder?.state !== "inactive") recorder?.stop();
      };
      recorder!.start(250);
      v.play()
        .then(draw)
        .catch(() => {
          cancel();
        });
    });
    if (result.size > 50 * 1024 * 1024)
      throw Error("Il video esportato supera 50 MB. Usa una clip più breve.");
    progress(100);
    return result;
  } finally {
    cancelAnimationFrame(raf);
    v.pause();
    if (recorder && recorder.state !== "inactive") recorder.stop();
    stream.getTracks().forEach((t) => t.stop());
    source.disconnect();
    await audio.close();
    v.removeAttribute("src");
    v.load();
    URL.revokeObjectURL(url);
  }
}
