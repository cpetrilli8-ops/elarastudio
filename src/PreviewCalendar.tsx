import { useState, useRef, useEffect, type FormEvent } from "react";
import HashtagFields from "./HashtagFields";
import MediaComposer from "./MediaComposer";
import { maxMedia, type DraftMedia } from "./media";
import { readHashtags, contentSchema } from "./model";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  X,
  Pencil,
  Trash2,
} from "lucide-react";
type Entry = {
  id: string;
  title: string;
  hook: string;
  date: string;
  description: string;
  image: string;
  hashtags: string[];
  platform: string;
  media: DraftMedia[];
};
function localDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export default function PreviewCalendar() {
  const [month, setMonth] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [entries, setEntries] = useState<Entry[]>([]);
  const [editing, setEditing] = useState<Partial<Entry> | null>(null);
  const [platform, setPlatform] = useState("Instagram");
  const [plan, setPlan] = useState("premium");
  const [media, setMedia] = useState<DraftMedia[]>([]);
  const [mediaBusy, setMediaBusy] = useState(false);
  const allUrls = useRef(new Set<string>());
  useEffect(
    () => () => {
      allUrls.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (editing) dialog.current?.showModal();
    else dialog.current?.close();
  }, [editing]);
  function open(entry: Partial<Entry>) {
    setPlatform(entry.platform || "Instagram");
    setMedia(entry.media || []);
    setEditing(entry);
    setError("");
  }
  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (mediaBusy || media.some((m) => !m.ready)) {
      setError("Attendi e adatta tutti gli allegati al formato scelto.");
      return;
    }
    if (
      media.length > maxMedia(plan, platform) ||
      (plan !== "premium" && media.some((m) => m.kind === "video"))
    ) {
      setError(
        "Gli allegati selezionati richiedono Premium su Instagram o TikTok.",
      );
      return;
    }
    const validation = contentSchema.shape.hashtags.safeParse(readHashtags(f));
    if (!validation.success) {
      setError(validation.error.issues[0].message);
      return;
    }
    const entry: Entry = {
      id: editing?.id || crypto.randomUUID(),
      title: String(f.get("title") || "").trim(),
      hook: String(f.get("hook") || "").trim(),
      description: String(f.get("description") || "").trim(),
      date: String(f.get("date") || ""),
      image: media.find((m) => m.kind === "image")?.url || "",
      platform,
      media,
      hashtags: validation.data,
    };
    setEntries((old) =>
      [...old.filter((x) => x.id !== entry.id), entry].sort((a, b) =>
        a.date.localeCompare(b.date),
      ),
    );
    const [year, mon] = entry.date.split("-").map(Number);
    setMonth(new Date(year, mon - 1, 1));
    setEditing(null);
  }
  const visible = entries.filter((e) =>
    e.date.startsWith(
      `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`,
    ),
  );
  return (
    <>
      <section className="panel editorial-calendar">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">LE TUE IDEE, GIORNO DOPO GIORNO</span>
            <h2>Calendario editoriale</h2>
          </div>
          <button
            className="primary"
            onClick={() => open({ date: localDate(new Date()) })}
          >
            <Plus size={16} />
            Aggiungi contenuto
          </button>
        </div>
        <p className="muted">
          Aggiungi un’immagine, scrivi il tuo hook e scegli quando dare vita
          all’idea.
        </p>
        <div className="calendar-monthbar">
          <div className="actions">
            <button
              className="icon-btn"
              aria-label="Mese precedente"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
              }
            >
              <ChevronLeft />
            </button>
            <h3>
              {month.toLocaleDateString("it-IT", {
                month: "long",
                year: "numeric",
              })}
            </h3>
            <button
              className="icon-btn"
              aria-label="Mese successivo"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
              }
            >
              <ChevronRight />
            </button>
          </div>
          <button
            className="secondary"
            onClick={() =>
              setMonth(
                new Date(new Date().getFullYear(), new Date().getMonth(), 1),
              )
            }
          >
            Oggi
          </button>
        </div>
        <div className="calendar">
          {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((day) => (
            <div key={day} className="weekday">
              {day}
            </div>
          ))}
          {Array.from({ length: (month.getDay() + 6) % 7 }, (_, i) => (
            <div className="calendar-day blank" key={"blank" + i} />
          ))}
          {Array.from(
            {
              length: new Date(
                month.getFullYear(),
                month.getMonth() + 1,
                0,
              ).getDate(),
            },
            (_, i) => {
              const date = localDate(
                new Date(month.getFullYear(), month.getMonth(), i + 1),
              );
              return (
                <div
                  key={date}
                  className={
                    "calendar-day " +
                    (date === localDate(new Date()) ? "today" : "")
                  }
                >
                  <button
                    className="calendar-add"
                    aria-label={"Aggiungi contenuto il " + date}
                    onClick={() => open({ date })}
                  >
                    {i + 1}
                    <Plus size={11} />
                  </button>
                  {visible
                    .filter((e) => e.date === date)
                    .map((e) => (
                      <button
                        className="editorial-chip"
                        key={e.id}
                        onClick={() => open(e)}
                      >
                        {e.image && <img src={e.image} alt="" />}
                        <strong>{e.title}</strong>
                        <small>{e.hook}</small>
                      </button>
                    ))}
                </div>
              );
            },
          )}
        </div>
        <p className="preview-draft-note">
          Prova la funzione: i contenuti aggiunti qui restano soltanto in questa
          anteprima aperta e scompaiono ricaricando la pagina. Per il
          salvataggio online servirà l’account Supabase.
        </p>
      </section>
      <section className="panel" style={{ marginTop: 20 }}>
        <div className="panel-heading">
          <h2>I contenuti del mese</h2>
          <span className="badge">{visible.length} contenuti</span>
        </div>
        {visible.length ? (
          <div className="editorial-agenda">
            {visible.map((entry) => (
              <article className="editorial-entry" key={entry.id}>
                {entry.image ? (
                  <img
                    className="content-image"
                    src={entry.image}
                    alt={entry.title}
                  />
                ) : (
                  <span className="content-image image-placeholder">
                    <ImageIcon size={26} />
                  </span>
                )}
                <div className="editorial-entry-text">
                  <small>
                    {new Date(entry.date + "T12:00:00").toLocaleDateString(
                      "it-IT",
                      { day: "numeric", month: "long" },
                    )}
                  </small>
                  <h3>{entry.title}</h3>
                  {entry.hook && <b>{entry.hook}</b>}
                  <p>
                    {entry.platform} · {entry.description}
                  </p>
                  {entry.media.length > 0 && (
                    <div className="entry-media-strip">
                      {entry.media.map((m) =>
                        m.kind === "image" ? (
                          <img key={m.id} src={m.url} alt={m.name} />
                        ) : (
                          <video
                            key={m.id}
                            src={m.url}
                            controls
                            playsInline
                            preload="metadata"
                          />
                        ),
                      )}
                    </div>
                  )}
                  <div className="hashtag-tags">
                    {entry.hashtags.map((tag) => (
                      <span key={tag}>#{tag}</span>
                    ))}
                  </div>
                </div>
                <div className="actions">
                  <button
                    className="icon-btn"
                    aria-label={"Modifica " + entry.title}
                    onClick={() => open(entry)}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    className="icon-btn"
                    aria-label={"Rimuovi bozza " + entry.title}
                    onClick={() =>
                      setEntries((old) => old.filter((e) => e.id !== entry.id))
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty">
            <ImageIcon size={35} strokeWidth={1} />
            <p>
              Il tuo prossimo contenuto inizia qui.
              <br />
              Scegli un giorno e aggiungi la tua prima idea.
            </p>
            <button
              className="secondary"
              onClick={() => open({ date: localDate(new Date()) })}
            >
              <Plus size={15} />
              Crea il primo contenuto
            </button>
          </div>
        )}
      </section>
      <dialog
        ref={dialog}
        onCancel={(e) => {
          e.preventDefault();
          setEditing(null);
        }}
      >
        <div className="modal-header">
          <h2>
            {editing?.id ? "Modifica contenuto" : "Pianifica una nuova idea"}
          </h2>
          <button
            className="icon-btn"
            aria-label="Chiudi"
            onClick={() => setEditing(null)}
          >
            <X />
          </button>
        </div>
        {editing && (
          <form onSubmit={save}>
            <label>
              Titolo
              <input
                autoFocus
                name="title"
                required
                maxLength={240}
                defaultValue={editing.title || ""}
                placeholder="Dai un nome alla tua idea"
              />
            </label>
            <label>
              Data
              <input
                name="date"
                type="date"
                required
                defaultValue={editing.date || ""}
              />
            </label>
            <label>
              Piattaforma
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                disabled={mediaBusy}
              >
                <option>Instagram</option>
                <option>TikTok</option>
                <option>YouTube</option>
              </select>
            </label>
            <label>
              Piano da provare nell’anteprima
              <select
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                disabled={mediaBusy}
              >
                <option value="free">
                  Gratuito · allegato immagine singolo
                </option>
                <option value="base">Base · allegato immagine singolo</option>
                <option value="pro">Pro · allegato immagine singolo</option>
                <option value="premium">
                  Premium · immagini e video multipli su Instagram/TikTok
                </option>
              </select>
              <small>
                Questa selezione serve soltanto a provare l’interfaccia. Non
                attiva abbonamenti.
              </small>
            </label>
            <MediaComposer
              key={editing.id || "new"}
              platform={platform}
              plan={plan}
              initial={editing.media || []}
              retainPreviewURLs
              onChange={(items) => {
                setMedia(items);
                items.forEach((m) => {
                  if (m.url.startsWith("blob:")) allUrls.current.add(m.url);
                });
              }}
              onBusy={setMediaBusy}
            />
            <label>
              Hook
              <input
                name="hook"
                maxLength={1000}
                defaultValue={editing.hook || ""}
                placeholder="La prima frase che cattura l’attenzione…"
              />
            </label>
            <label>
              Descrizione
              <textarea
                name="description"
                rows={5}
                maxLength={10000}
                defaultValue={editing.description || ""}
                placeholder="Cosa vuoi raccontare con questo contenuto?"
              />
            </label>
            <HashtagFields values={editing.hashtags} />
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="notice">
              Modalità anteprima: questa bozza non viene inviata online.
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="secondary"
                onClick={() => setEditing(null)}
              >
                Annulla
              </button>
              <button className="primary" disabled={mediaBusy}>
                {editing.id ? "Aggiorna bozza" : "Aggiungi all’anteprima"}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
