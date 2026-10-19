import { useState, useEffect, useRef } from "react";
import {
  Upload,
  Image as ImageIcon,
  Film,
  Trash2,
  Download,
  Check,
  MoveUp,
  MoveDown,
} from "lucide-react";
import {
  mediaFormats,
  maxMedia,
  checkMediaFile,
  dimensions,
  formatImage,
  formatVideo,
  type DraftMedia,
  type SavedMedia,
} from "./media";
import { supabase } from "./backend";
export default function MediaComposer({
  platform,
  plan,
  initial = [],
  onChange,
  onBusy,
  retainPreviewURLs = false,
}: {
  platform: string;
  plan: string;
  initial?: Array<SavedMedia & { id?: string; url?: string; file?: File }>;
  onChange: (items: DraftMedia[]) => void;
  onBusy?: (busy: boolean) => void;
  retainPreviewURLs?: boolean;
}) {
  const formats = mediaFormats.filter((f) => f.platform === platform);
  const [preset, setPreset] = useState(
    initial[0]?.preset || formats[0]?.id || "ig-square",
  );
  const [fit, setFit] = useState<"contain" | "cover">("contain");
  const [kind, setKind] = useState("image");
  const [items, setItems] = useState<DraftMedia[]>(
    initial.map((m) => ({
      ...m,
      id: m.id || m.path,
      file: m.file,
      url: m.url || "",
      ready: true,
    })),
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [percent, setPercent] = useState(0);
  const [loading, setLoading] = useState(false);
  const abort = useRef<AbortController | null>(null),
    urls = useRef<string[]>([]),
    lastPlatform = useRef(platform);
  const callback = useRef(onChange),
    busyCallback = useRef(onBusy);
  callback.current = onChange;
  busyCallback.current = onBusy;
  const format =
    formats.find((f) => f.id === preset) || formats[0] || mediaFormats[0];
  const limit = maxMedia(plan, platform);
  useEffect(() => {
    callback.current(items);
  }, [items]);
  useEffect(() => {
    busyCallback.current?.(!!busy || loading);
  }, [busy, loading]);
  useEffect(() => {
    if (lastPlatform.current !== platform) {
      lastPlatform.current = platform;
      setPreset(
        mediaFormats.find((f) => f.platform === platform)?.id || "ig-square",
      );
      setItems((old) => old.map((m) => ({ ...m, ready: false })));
    }
  }, [platform]);
  useEffect(() => {
    let active = true;
    Promise.all(
      initial.map(async (m) => {
        if (!supabase || !m.path || m.url) return "";
        const { data } = await supabase.storage
          .from("editorial-media")
          .createSignedUrl(m.path, 600);
        return data?.signedUrl || "";
      }),
    ).then((signed) => {
      if (active)
        setItems((old) =>
          old.map((m, i) => ({ ...m, url: m.url || signed[i] || "" })),
        );
    });
    return () => {
      active = false;
      abort.current?.abort();
      if (!retainPreviewURLs)
        for (const u of urls.current) URL.revokeObjectURL(u);
    };
  }, []);
  function localUrl(file: File) {
    const u = URL.createObjectURL(file);
    urls.current.push(u);
    return u;
  }
  async function add(files: FileList | null) {
    if (!files) return;
    if (items.length + files.length > limit) {
      setError(
        `Per ${platform}, questo piano consente fino a ${limit} allegati per contenuto.`,
      );
      return;
    }
    setLoading(true);
    setError("");
    try {
      const next: DraftMedia[] = [];
      for (const file of Array.from(files)) {
        const fileKind = checkMediaFile(file, plan);
        const size = await dimensions(file, fileKind);
        next.push({
          id: crypto.randomUUID(),
          path: "",
          file,
          url: localUrl(file),
          kind: fileKind,
          name: file.name,
          width: size.width,
          height: size.height,
          preset: format.id,
          ready:
            size.width === format.width &&
            size.height === format.height &&
            (fileKind === "image" || file.type === "video/mp4"),
        });
      }
      setItems((old) => [...old, ...next]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "File non leggibile.");
    } finally {
      setLoading(false);
    }
  }
  async function prepare(item: DraftMedia) {
    if (!item.file) {
      setError(
        "Per cambiare formato a un allegato già salvato, scaricalo e caricalo nuovamente.",
      );
      return;
    }
    setBusy(item.id);
    setPercent(0);
    setError("");
    const controller = new AbortController();
    abort.current = controller;
    try {
      const file =
        item.kind === "image"
          ? await formatImage(item.file, format, fit)
          : await formatVideo(
              item.file,
              format,
              fit,
              controller.signal,
              setPercent,
            );
      setItems((old) =>
        old.map((m) =>
          m.id === item.id
            ? {
                ...m,
                file,
                url: localUrl(file),
                name: file.name,
                width: format.width,
                height: format.height,
                preset: format.id,
                ready: true,
              }
            : m,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Conversione non riuscita.");
    } finally {
      setBusy("");
      abort.current = null;
    }
  }
  function reorder(index: number, delta: number) {
    setItems((old) => {
      const next = [...old];
      [next[index], next[index + delta]] = [next[index + delta], next[index]];
      return next;
    });
  }
  return (
    <section className="media-composer">
      <div className="media-heading">
        <h3>Allegati e formato</h3>
        <span className="badge">
          {plan === "premium" ? "Premium" : "Allegato singolo"} · {items.length}
          /{limit}
        </span>
      </div>
      <div className="form-grid">
        <label>
          Tipo file
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            disabled={!!busy || loading}
          >
            <option value="image">Immagine</option>
            <option value="video" disabled={plan !== "premium"}>
              Video {plan !== "premium" ? "· Premium" : ""}
            </option>
          </select>
        </label>
        <label>
          Formato {platform}
          <select
            value={format.id}
            disabled={!!busy || loading}
            onChange={(e) => {
              setPreset(e.target.value);
              setItems((old) =>
                old.map((m) => ({ ...m, ready: m.preset === e.target.value })),
              );
            }}
          >
            {formats.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label} · {f.width} × {f.height}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Come adattare il contenuto
        <select
          value={fit}
          disabled={!!busy || loading}
          onChange={(e) => {
            setFit(e.target.value as "contain" | "cover");
            setItems((old) => old.map((m) => ({ ...m, ready: false })));
          }}
        >
          <option value="contain">
            Mantieni tutto · aggiungi bordi se necessario
          </option>
          <option value="cover">Riempi il formato · ritaglio centrale</option>
        </select>
      </label>
      <label className="media-upload">
        <Upload size={19} />
        <span>
          {loading
            ? "Lettura dei file…"
            : limit > 1
              ? "Scegli uno o più file"
              : "Scegli un file"}
        </span>
        <input
          type="file"
          multiple={limit > 1}
          accept={
            kind === "image"
              ? "image/jpeg,image/png,image/webp"
              : "video/mp4,video/webm,video/quicktime"
          }
          disabled={!!busy || loading || items.length >= limit}
          onChange={(e) => {
            void add(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      <small className="muted">
        Immagini fino a 5 MB; video Premium fino a 50 MB e 60 secondi per
        l’elaborazione locale. Più allegati: Premium su Instagram e TikTok.
      </small>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="media-grid">
        {items.map((item, index) => (
          <article className="media-item" key={item.id}>
            <div
              className="media-preview"
              style={{ aspectRatio: `${format.width}/${format.height}` }}
            >
              {item.url ? (
                item.kind === "image" ? (
                  <img
                    src={item.url}
                    alt={item.name}
                    style={{ objectFit: fit }}
                  />
                ) : (
                  <video
                    src={item.url}
                    controls
                    playsInline
                    preload="metadata"
                    style={{ objectFit: fit }}
                  />
                )
              ) : item.kind === "image" ? (
                <ImageIcon />
              ) : (
                <Film />
              )}
            </div>
            <span className="media-kind">
              {item.kind === "image" ? (
                <ImageIcon size={12} />
              ) : (
                <Film size={12} />
              )}{" "}
              {index + 1} · {item.width} × {item.height}
            </span>
            <strong title={item.name}>{item.name}</strong>
            {item.ready ? (
              <span className="media-ready">
                <Check size={12} />
                Pronto nel formato scelto
              </span>
            ) : (
              <button
                type="button"
                className="secondary"
                disabled={!!busy || loading}
                onClick={() => void prepare(item)}
              >
                {busy === item.id
                  ? `Preparazione… ${percent}%`
                  : `Adatta a ${format.width} × ${format.height}`}
              </button>
            )}
            <div className="actions">
              {item.url && (
                <a
                  href={item.url}
                  download={item.name}
                  className="icon-btn"
                  aria-label={"Scarica " + item.name}
                >
                  <Download size={15} />
                </a>
              )}
              <button
                type="button"
                aria-label="Sposta prima"
                className="icon-btn"
                disabled={index === 0 || !!busy}
                onClick={() => reorder(index, -1)}
              >
                <MoveUp size={15} />
              </button>
              <button
                type="button"
                aria-label="Sposta dopo"
                className="icon-btn"
                disabled={index === items.length - 1 || !!busy}
                onClick={() => reorder(index, 1)}
              >
                <MoveDown size={15} />
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={"Rimuovi " + item.name}
                disabled={!!busy}
                onClick={() =>
                  setItems((old) => old.filter((m) => m.id !== item.id))
                }
              >
                <Trash2 size={15} />
              </button>
            </div>
          </article>
        ))}
      </div>
      {busy && (
        <button
          type="button"
          className="secondary"
          onClick={() => abort.current?.abort()}
        >
          Annulla elaborazione
        </button>
      )}
      <p className="media-help">
        La cornice mostra il formato di destinazione. Premi “Adatta” per creare
        davvero il file nelle dimensioni indicate. I video vengono esportati in
        MP4 se il browser lo supporta, in tempo reale; controlla sempre il
        risultato prima della pubblicazione. Nessun caricamento automatico sui
        social.
      </p>
    </section>
  );
}
