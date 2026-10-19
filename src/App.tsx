import {
  useState,
  useEffect,
  useRef,
  type FormEvent,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Files,
  CalendarDays,
  Layers,
  AtSign,
  Sparkles,
  Settings,
  LogOut,
  Plus,
  Search,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  X,
  Download,
  Upload,
  Menu,
  Check,
  Trash2,
  Pencil,
  LayoutGrid,
  List,
  Briefcase,
  CloudOff,
  Crown,
} from "lucide-react";
import Pricing from "./Pricing";
import Auth from "./Auth";
import ContentMedia from "./ContentMedia";
import ImageField from "./ImageField";
import HashtagFields from "./HashtagFields";
import MediaComposer from "./MediaComposer";
import { maxMedia, type DraftMedia } from "./media";
import {
  supabase,
  loadWorkspace,
  saveRecord,
  removeRecord,
  uploadContentImage,
  deleteContentImage,
  uploadEditorialMedia,
  removeEditorialMedia,
} from "./backend";
import { cache } from "./cache";
import {
  statuses,
  platforms,
  emptyWorkspace,
  parseBackup,
  remapBackup,
  brandSchema,
  profileSchema,
  contentSchema,
  readHashtags,
  type Brand,
  type Social,
  type Content,
  type Workspace,
  type Table,
} from "./model";
const sections = [
  ["Panoramica", LayoutDashboard],
  ["Contenuti", Files],
  ["Calendario", CalendarDays],
  ["Pagine e brand", Layers],
  ["Profili social", AtSign],
  ["Social Media Manager", Briefcase],
  ["Assistente AI", Sparkles],
  ["Piani e prezzi", Crown],
  ["Impostazioni", Settings],
] as const;
type Editor = {
  table: Table;
  record?: Brand | Social | Content;
  date?: string;
};
function errorText(e: unknown) {
  return e instanceof Error
    ? e.message
    : typeof e === "object" && e && "message" in e
      ? String(e.message)
      : "Operazione non riuscita. Controlla la connessione e riprova.";
}
function dateText(value: string | null) {
  return value
    ? new Date(value).toLocaleDateString("it-IT", {
        day: "numeric",
        month: "short",
      })
    : "Da pianificare";
}
function localDatetime(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
function download(data: Workspace) {
  const blob = new Blob([JSON.stringify({ version: 1, ...data }, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `elara-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <div className="modal-header">
        <h2>{title}</h2>
        <button aria-label="Chiudi" className="icon-btn" onClick={close}>
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);
  const [authError, setAuthError] = useState("");
  const [recovery, setRecovery] = useState(
    new URLSearchParams(location.search).has("recovery"),
  );
  const [epoch, setEpoch] = useState(0);
  const [cached, setCached] = useState<Workspace | null>(null);
  const [cacheWarning, setCacheWarning] = useState("");
  const [section, setSection] = useState("Panoramica");
  const [sidebar, setSidebar] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [view, setView] = useState("table");
  const [month, setMonth] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [editor, setEditor] = useState<Editor | null>(null);
  const [mediaDraft, setMediaDraft] = useState<DraftMedia[]>([]);
  const [mediaBusy, setMediaBusy] = useState(false);
  useEffect(() => {
    setMediaDraft(
      ((editor?.record as Content | undefined)?.media || []).map((m) => ({
        ...m,
        id: m.path,
        url: "",
        ready: true,
      })),
    );
    setMediaBusy(false);
  }, [editor]);
  const [deleting, setDeleting] = useState<{
    table: Table;
    id: string;
    name: string;
  } | null>(null);
  const [pendingImport, setPendingImport] = useState<Workspace | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");
  const [aiText, setAiText] = useState("");
  const [aiContent, setAiContent] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const currentUser = useRef<string | null>(null);
  const qc = useQueryClient();
  const user = session?.user.id;
  useEffect(() => {
    const s = supabase;
    if (!s) return;
    let mounted = true;
    const {
      data: { subscription },
    } = s.auth.onAuthStateChange((event, next) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      setSession(next);
      setAuthReady(true);
    });
    s.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) setAuthError(error.message);
        setSession(data.session);
        setAuthReady(true);
      })
      .catch((e) => {
        if (mounted) {
          setAuthError(errorText(e));
          setAuthReady(true);
        }
      });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    const previous = currentUser.current;
    currentUser.current = user || null;
    setCached(null);
    setAiText("");
    setBusy(false);
    setProblem("");
    setEditor(null);
    setDeleting(null);
    setPendingImport(null);
    setAiContent("");
    setAiPrompt("");
    setBrandFilter("");
    setSearch("");
    setStatusFilter("");
    setMessage("");
    setCacheWarning("");
    void qc.cancelQueries();
    qc.clear();
    const gen = cache.activate(user || null);
    setEpoch(gen);
    if (previous && previous !== user)
      void cache
        .clear(previous)
        .catch(() =>
          setCacheWarning(
            "Non è stato possibile pulire la cache locale. Cancella i dati del sito su questo dispositivo.",
          ),
        );
    if (user)
      void cache
        .read(user, gen)
        .then((r) => {
          if (r && cache.current(user, gen)) setCached(r.data);
        })
        .catch(() =>
          setCacheWarning(
            "Cache locale non disponibile: i dati online restano accessibili.",
          ),
        );
  }, [user, qc]);
  useEffect(() => {
    const yes = () => setOnline(true),
      no = () => setOnline(false);
    window.addEventListener("online", yes);
    window.addEventListener("offline", no);
    return () => {
      window.removeEventListener("online", yes);
      window.removeEventListener("offline", no);
    };
  }, []);
  const query = useQuery({
    queryKey: ["workspace", user, epoch],
    enabled: !!user && epoch > 0 && online,
    queryFn: async () => {
      const w = await loadWorkspace();
      if (!user || !cache.current(user, epoch))
        throw Error("Sessione cambiata.");
      await cache.write(user, epoch, w).catch(() => {
        if (cache.current(user, epoch))
          setCacheWarning(
            "Dati aggiornati online; impossibile aggiornare la cache locale.",
          );
      });
      return w;
    },
  });
  const data = query.data || cached || emptyWorkspace();
  const planQuery = useQuery({
    queryKey: ["plan", user],
    enabled: !!user && online,
    queryFn: async () => {
      const { data, error } = await supabase!.rpc("current_plan");
      if (error) throw error;
      return ["free", "base", "pro", "premium"].includes(data)
        ? String(data)
        : "free";
    },
  });
  const plan = planQuery.data || "free";
  const active = user === currentUser.current;
  async function perform(action: () => Promise<unknown>, success: string) {
    if (!user || !online) {
      setProblem("Connettiti a Internet per salvare le modifiche.");
      return false;
    }
    const owner = user;
    setBusy(true);
    setProblem("");
    setMessage("");
    try {
      await action();
      if (currentUser.current !== owner) return false;
      await qc.invalidateQueries({ queryKey: ["workspace", owner] });
      setMessage(success);
      return true;
    } catch (e) {
      if (currentUser.current === owner) setProblem(errorText(e));
      return false;
    } finally {
      if (currentUser.current === owner) setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    setProblem("");
    const id = user;
    const { error } = await supabase!.auth.signOut({ scope: "local" });
    if (error) {
      setProblem(error.message);
      setBusy(false);
      return;
    }
    cache.activate(null);
    qc.clear();
    setCached(null);
    if (id)
      await cache
        .clear(id)
        .catch(() =>
          setAuthError(
            "Sessione terminata. Cancella i dati del sito per rimuovere la cache locale non eliminabile.",
          ),
        );
    setBusy(false);
  }
  const contents = data.contents
    .filter(
      (c) =>
        (!brandFilter || c.brand_id === brandFilter) &&
        (!statusFilter || c.status === statusFilter) &&
        `${c.title} ${c.script} ${c.notes} ${c.pillar}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      (a.scheduled_at || "9999").localeCompare(b.scheduled_at || "9999"),
    );
  const brandName = (id: string) =>
    data.brands.find((b) => b.id === id)?.name || "Brand";
  function newContent() {
    if (!data.brands.length) {
      setMessage(
        "Crea prima una pagina o un brand per organizzare i tuoi contenuti.",
      );
      setSection("Pagine e brand");
      setEditor({ table: "brands" });
    } else setEditor({ table: "contents" });
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editor || !user) return;
    if (mediaBusy) {
      setProblem("Attendi la preparazione degli allegati.");
      return;
    }
    const f = Object.fromEntries(new FormData(e.currentTarget));
    const hashtags = readHashtags(new FormData(e.currentTarget));
    let record: Brand | Social | Content;
    try {
      const id = editor.record?.id || crypto.randomUUID();
      if (editor.table === "brands") record = brandSchema.parse({ id, ...f });
      else if (editor.table === "profiles")
        record = profileSchema.parse({ id, ...f });
      else {
        const content = contentSchema.parse({
          id,
          ...f,
          hashtags,
          media: mediaDraft.map(
            ({ path, name, kind, width, height, preset }) => ({
              path,
              name,
              kind,
              width,
              height,
              preset,
            }),
          ),
          image_path: f.remove_image
            ? null
            : (editor.record as Content | undefined)?.image_path || null,
          profile_id: f.profile_id || null,
          scheduled_at: f.scheduled_at
            ? new Date(String(f.scheduled_at)).toISOString()
            : null,
        });
        if (
          content.profile_id &&
          data.profiles.find((p) => p.id === content.profile_id)?.brand_id !==
            content.brand_id
        )
          throw Error(
            "Il profilo selezionato deve appartenere allo stesso brand.",
          );
        record = content;
        if (mediaDraft.some((m) => !m.ready))
          throw Error(
            "Adatta gli allegati al formato scelto prima di salvare.",
          );
        if (mediaDraft.length > maxMedia(plan, content.platform))
          throw Error(
            "Questo numero di allegati richiede Premium su Instagram o TikTok.",
          );
        if (plan !== "premium" && mediaDraft.some((m) => m.kind === "video"))
          throw Error("I video richiedono il piano Premium.");
      }
    } catch (e) {
      setProblem(errorText(e));
      return;
    }
    const ok = await perform(async () => {
      const file = f.image;
      const uploadedMedia: string[] = [];
      if (editor.table === "contents")
        try {
          const prepared = [];
          for (const item of mediaDraft) {
            const path = item.file
              ? await uploadEditorialMedia(user, item.file, plan)
              : item.path;
            if (item.file) uploadedMedia.push(path);
            prepared.push({
              path,
              name: item.name,
              kind: item.kind,
              width: item.width,
              height: item.height,
              preset: item.preset,
            });
          }
          (record as Content).media = prepared;
        } catch (error) {
          await removeEditorialMedia(uploadedMedia).catch(() => {});
          throw error;
        }
      const oldPath = (editor.record as Content | undefined)?.image_path;
      let uploaded: string | null = null;
      try {
        if (editor.table === "contents" && file instanceof File && file.size) {
          uploaded = await uploadContentImage(user, file);
          (record as Content).image_path = uploaded;
        }
        await saveRecord(editor.table, user, record);
      } catch (error) {
        if (uploaded) await deleteContentImage(uploaded).catch(() => {});
        await removeEditorialMedia(uploadedMedia).catch(() => {});
        throw error;
      }
      if (editor.table === "contents") {
        const keep = new Set((record as Content).media.map((m) => m.path));
        const removed = ((editor.record as Content | undefined)?.media || [])
          .map((m) => m.path)
          .filter((p) => !keep.has(p));
        await removeEditorialMedia(removed).catch(() =>
          setCacheWarning(
            "Contenuto salvato; alcuni vecchi allegati non sono stati rimossi.",
          ),
        );
      }
      if (oldPath && oldPath !== (record as Content).image_path)
        await deleteContentImage(oldPath).catch(() =>
          setCacheWarning(
            "Contenuto salvato; la vecchia immagine non è stata rimossa dallo storage.",
          ),
        );
    }, "Salvato online.");
    if (ok) setEditor(null);
  }
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw Error("Il file supera 10 MB.");
      setPendingImport(parseBackup(JSON.parse(await file.text())));
      setProblem("");
    } catch (e) {
      setProblem("Backup non valido: " + errorText(e));
    }
  }
  async function doImport() {
    if (!pendingImport || !supabase) return;
    const w = remapBackup(pendingImport);
    const ok = await perform(async () => {
      const { error } = await supabase!.rpc("import_workspace", { payload: w });
      if (error) throw error;
    }, "Backup importato. I dati precedenti sono stati conservati.");
    if (ok) setPendingImport(null);
  }
  async function askAi(e: FormEvent) {
    e.preventDefault();
    if (!supabase || !aiContent) return;
    const requestOwner = user;
    await perform(async () => {
      const { data: result, error } = await supabase!.functions.invoke(
        "ai-assistant",
        { body: { content_id: aiContent, instruction: aiPrompt } },
      );
      if (error)
        throw Error(
          "Assistente non disponibile. Verifica che la funzione e i segreti siano configurati.",
        );
      if (typeof result?.text !== "string")
        throw Error("Risposta AI non valida.");
      if (currentUser.current === requestOwner) setAiText(result.text);
    }, "Risposta ricevuta. Puoi modificarla o copiarla: il contenuto originale è invariato.");
  }
  if (!authReady) return <div className="loading">Apro il tuo studio…</div>;
  if (!session || recovery)
    return (
      <>
        {authError && (
          <p role="alert" className="error">
            {authError}
          </p>
        )}
        <Auth
          recovery={recovery}
          onDone={() => {
            setRecovery(false);
            history.replaceState({}, "", location.pathname);
          }}
        />
      </>
    );
  const upcoming = data.contents
    .filter(
      (c) =>
        c.scheduled_at &&
        new Date(c.scheduled_at) >= new Date() &&
        c.status !== "Pubblicato",
    )
    .sort((a, b) => a.scheduled_at!.localeCompare(b.scheduled_at!))
    .slice(0, 5);
  const go = (name: string) => {
    setSection(name);
    setSidebar(false);
    setProblem("");
    setMessage("");
  };
  const tiles = [
    [
      "Idee da coltivare",
      data.contents.filter((c) => c.status === "Idea").length,
      "Ogni grande progetto inizia qui",
    ],
    [
      "In lavorazione",
      data.contents.filter((c) => c.status === "In lavorazione").length,
      "Un passo alla volta",
    ],
    [
      "In programma",
      data.contents.filter((c) => c.status === "Programmato").length,
      "Pronte a incontrare il mondo",
    ],
    ["I tuoi brand", data.brands.length, "Universi creativi da raccontare"],
  ];
  return (
    <div className="app-shell">
      <aside className={sidebar ? "sidebar open" : "sidebar"}>
        <a
          className="wordmark"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go("Panoramica");
          }}
        >
          elara<span>STUDIO</span>
        </a>
        <p className="sidebar-caption">IL TUO SPAZIO CREATIVO</p>
        <nav aria-label="Navigazione principale">
          {sections.map(([name, Icon]) => (
            <button
              key={name}
              className={section === name ? "nav-item selected" : "nav-item"}
              onClick={() => go(name)}
            >
              <Icon size={18} />
              {name}
              {section === name && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="little-note">
            <Sparkles size={18} />
            <p>
              Le idee belle meritano
              <br />
              un posto tutto loro.
            </p>
          </div>
          <div className="account">
            <span className="avatar">
              {(session.user.user_metadata.first_name ||
                session.user.email ||
                "E")[0].toUpperCase()}
            </span>
            <span>
              <strong>
                {session.user.user_metadata.first_name || "Il tuo account"}
              </strong>
              <small>Il tuo studio personale</small>
            </span>
            <button
              aria-label="Esci"
              title="Esci"
              disabled={busy}
              onClick={logout}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      {sidebar && (
        <button
          className="scrim"
          aria-label="Chiudi navigazione"
          onClick={() => setSidebar(false)}
        />
      )}
      <main className="main">
        <header className="topbar">
          <div>
            <button
              className="mobile-menu icon-btn"
              aria-label="Apri navigazione"
              onClick={() => setSidebar(true)}
            >
              <Menu />
            </button>
            <span className="breadcrumb">
              Il tuo studio <span>/</span> <strong>{section}</strong>
            </span>
          </div>
          <span className="top-note">
            <span className={online ? "online-dot" : "offline-dot"} />
            {online ? "Uno spazio per le tue idee" : "Consultazione offline"}
          </span>
        </header>
        <div className="page">
          <div className="page-heading">
            <div>
              <span className="eyebrow">ELARA STUDIO</span>
              <h1>
                {section === "Panoramica"
                  ? `Ciao${session.user.user_metadata.first_name ? ", " + session.user.user_metadata.first_name : ""} ✧`
                  : section}
              </h1>
              <p className="muted">
                {section === "Panoramica"
                  ? "Qui prendono forma le tue idee."
                  : "Dai spazio alla tua creatività, un dettaglio alla volta."}
              </p>
            </div>
            {["Panoramica", "Contenuti", "Calendario"].includes(section) && (
              <button
                className="primary"
                disabled={!online || busy}
                onClick={newContent}
              >
                <Plus size={17} /> Nuovo contenuto
              </button>
            )}
          </div>
          {!online && (
            <div className="notice">
              <CloudOff size={16} /> Stai consultando l’ultima copia
              disponibile. Le modifiche richiedono una connessione.
            </div>
          )}
          {cacheWarning && <div className="notice">{cacheWarning}</div>}
          {(problem || query.error) && (
            <div role="alert" className="error">
              {problem || errorText(query.error)}{" "}
              <button onClick={() => void query.refetch()}>Riprova</button>
            </div>
          )}
          {message && (
            <div role="status" className="notice">
              <Check size={16} />
              {message}
            </div>
          )}
          {query.isPending && !cached && online && (
            <div role="status" className="notice">
              Caricamento dei tuoi dati…
            </div>
          )}
          {active && section === "Panoramica" && (
            <>
              <section className="welcome-banner">
                <div>
                  <span className="eyebrow">PICCOLI PASSI, GRANDI IDEE</span>
                  <h2>
                    Fai spazio alla
                    <br />
                    <em>tua prossima ispirazione.</em>
                  </h2>
                  <p>
                    Un’idea appuntata oggi può diventare qualcosa di speciale
                    domani.
                  </p>
                  <button className="text-link" onClick={() => go("Contenuti")}>
                    Apri il tuo piano editoriale <ArrowUpRight size={17} />
                  </button>
                </div>
                <div className="banner-art" aria-hidden="true">
                  <span className="orbit" />
                  <span className="moon">☾</span>
                  <span className="art-star">✧</span>
                  <span className="art-caption">create a little magic</span>
                </div>
              </section>
              <div className="stats">
                {tiles.map(([label, num, note]) => (
                  <article key={label} className="stat">
                    <span>{label}</span>
                    <strong>{num}</strong>
                    <small>{note}</small>
                  </article>
                ))}
              </div>
              <div className="dashboard-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <h2>In arrivo nel tuo calendario</h2>
                    <button
                      onClick={() => go("Calendario")}
                      className="text-link"
                    >
                      Vedi tutto <ArrowUpRight size={16} />
                    </button>
                  </div>
                  {upcoming.length ? (
                    upcoming.map((c) => (
                      <button
                        key={c.id}
                        className="upcoming-row"
                        onClick={() =>
                          setEditor({ table: "contents", record: c })
                        }
                      >
                        <span className="date-square">
                          {dateText(c.scheduled_at)}
                        </span>
                        <span>
                          <strong>{c.title}</strong>
                          <small>
                            {brandName(c.brand_id)} · {c.platform}
                          </small>
                        </span>
                        <span className="badge">{c.status}</span>
                      </button>
                    ))
                  ) : (
                    <Empty
                      text="Nessun contenuto in arrivo. Scegli una data per la tua prossima idea."
                      action={newContent}
                    />
                  )}
                </section>
                <section className="panel inspiration">
                  <Sparkles size={24} />
                  <span className="eyebrow">UN PICCOLO PROMEMORIA</span>
                  <h2>
                    Non serve avere
                    <br />
                    tutto chiaro.
                    <br />
                    <em>Comincia da un’idea.</em>
                  </h2>
                  <button className="secondary" onClick={newContent}>
                    Appunta un’idea <Plus size={15} />
                  </button>
                </section>
              </div>
            </>
          )}
          {active && ["Contenuti", "Calendario"].includes(section) && (
            <>
              <div className="toolbar">
                <label className="search">
                  <Search size={17} />
                  <input
                    aria-label="Cerca contenuti"
                    placeholder="Cerca tra le tue idee…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <select
                  aria-label="Filtra per brand"
                  value={brandFilter}
                  onChange={(e) => setBrandFilter(e.target.value)}
                >
                  <option value="">Tutti i brand</option>
                  {data.brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filtra per stato"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">Tutti gli stati</option>
                  {statuses.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                {section === "Contenuti" && (
                  <div className="view-switch">
                    <button
                      aria-label="Vista tabella"
                      aria-pressed={view === "table"}
                      onClick={() => setView("table")}
                    >
                      <List size={19} />
                    </button>
                    <button
                      aria-label="Vista bacheca"
                      aria-pressed={view === "board"}
                      onClick={() => setView("board")}
                    >
                      <LayoutGrid size={19} />
                    </button>
                  </div>
                )}
              </div>
              {section === "Calendario" ? (
                <section className="panel">
                  <div className="panel-heading">
                    <h2>
                      {month.toLocaleDateString("it-IT", {
                        month: "long",
                        year: "numeric",
                      })}
                    </h2>
                    <div className="actions">
                      <button
                        aria-label="Mese precedente"
                        onClick={() =>
                          setMonth(
                            new Date(
                              month.getFullYear(),
                              month.getMonth() - 1,
                              1,
                            ),
                          )
                        }
                      >
                        <ChevronLeft />
                      </button>
                      <button
                        onClick={() =>
                          setMonth(
                            new Date(
                              new Date().getFullYear(),
                              new Date().getMonth(),
                              1,
                            ),
                          )
                        }
                      >
                        Oggi
                      </button>
                      <button
                        aria-label="Mese successivo"
                        onClick={() =>
                          setMonth(
                            new Date(
                              month.getFullYear(),
                              month.getMonth() + 1,
                              1,
                            ),
                          )
                        }
                      >
                        <ChevronRight />
                      </button>
                    </div>
                  </div>
                  <div className="calendar">
                    {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map(
                      (d) => (
                        <div key={d} className="weekday">
                          {d}
                        </div>
                      ),
                    )}
                    {Array.from(
                      {
                        length:
                          (new Date(
                            month.getFullYear(),
                            month.getMonth(),
                            1,
                          ).getDay() +
                            6) %
                          7,
                      },
                      (_, i) => (
                        <div key={"blank" + i} className="calendar-day blank" />
                      ),
                    )}
                    {Array.from(
                      {
                        length: new Date(
                          month.getFullYear(),
                          month.getMonth() + 1,
                          0,
                        ).getDate(),
                      },
                      (_, i) => {
                        const d = new Date(
                          month.getFullYear(),
                          month.getMonth(),
                          i + 1,
                        );
                        return (
                          <div
                            key={i}
                            className={
                              "calendar-day " +
                              (d.toDateString() === new Date().toDateString()
                                ? "today"
                                : "")
                            }
                          >
                            <button
                              type="button"
                              className="calendar-add"
                              aria-label={`Aggiungi contenuto il ${d.toLocaleDateString("it-IT")}`}
                              onClick={() => {
                                if (data.brands.length)
                                  setEditor({
                                    table: "contents",
                                    date: d.toISOString(),
                                  });
                                else newContent();
                              }}
                            >
                              {i + 1}
                              <Plus size={11} />
                            </button>
                            {contents
                              .filter(
                                (c) =>
                                  c.scheduled_at &&
                                  new Date(c.scheduled_at).toDateString() ===
                                    d.toDateString(),
                              )
                              .map((c) => (
                                <button
                                  key={c.id}
                                  onClick={() =>
                                    setEditor({ table: "contents", record: c })
                                  }
                                >
                                  {(c.image_path || c.media.length > 0) && (
                                    <ContentMedia
                                      media={c.media}
                                      fallback={c.image_path}
                                    />
                                  )}
                                  <strong>{c.title}</strong>
                                  {c.hook && (
                                    <small>{c.hook.slice(0, 55)}</small>
                                  )}
                                </button>
                              ))}
                          </div>
                        );
                      },
                    )}
                  </div>
                  <p className="muted">
                    {contents.filter((c) => !c.scheduled_at).length} contenuti
                    senza data: pianificali dalla sezione Contenuti. Tocca un
                    giorno per aggiungere un contenuto.
                  </p>
                  <div className="editorial-agenda">
                    {contents
                      .filter(
                        (c) =>
                          c.scheduled_at &&
                          new Date(c.scheduled_at).getMonth() ===
                            month.getMonth() &&
                          new Date(c.scheduled_at).getFullYear() ===
                            month.getFullYear(),
                      )
                      .map((c) => (
                        <button
                          className="editorial-entry"
                          key={c.id}
                          onClick={() =>
                            setEditor({ table: "contents", record: c })
                          }
                        >
                          <ContentMedia
                            media={c.media}
                            fallback={c.image_path}
                          />
                          <span>
                            <small>
                              {dateText(c.scheduled_at)} · {c.platform}
                            </small>
                            <strong>{c.title}</strong>
                            {c.hook && <b>{c.hook}</b>}
                            <span>
                              {c.description ||
                                c.notes ||
                                "Aggiungi una descrizione"}
                            </span>
                          </span>
                          <Pencil size={16} />
                        </button>
                      ))}
                  </div>
                </section>
              ) : view === "board" ? (
                <div className="board">
                  {statuses.map((s) => (
                    <section key={s} className="board-column">
                      <h3>
                        {s}{" "}
                        <span>
                          {contents.filter((c) => c.status === s).length}
                        </span>
                      </h3>
                      {contents
                        .filter((c) => c.status === s)
                        .map((c) => (
                          <button
                            key={c.id}
                            className="board-card"
                            onClick={() =>
                              setEditor({ table: "contents", record: c })
                            }
                          >
                            <small>
                              {c.platform} · {brandName(c.brand_id)}
                            </small>
                            <strong>{c.title}</strong>
                            <p>{c.notes.slice(0, 100)}</p>
                            <span>{dateText(c.scheduled_at)}</span>
                          </button>
                        ))}
                    </section>
                  ))}
                </div>
              ) : (
                <section className="panel table-wrap">
                  {contents.length ? (
                    <table>
                      <thead>
                        <tr>
                          <th>Contenuto</th>
                          <th>Brand</th>
                          <th>Piattaforma</th>
                          <th>Stato</th>
                          <th>Data</th>
                          <th>Azioni</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contents.map((c) => (
                          <tr key={c.id}>
                            <td>
                              <button
                                className="title-button"
                                onClick={() =>
                                  setEditor({ table: "contents", record: c })
                                }
                              >
                                {c.title}
                              </button>
                              <small>
                                {c.format} {c.pillar && "· " + c.pillar}
                              </small>
                            </td>
                            <td>{brandName(c.brand_id)}</td>
                            <td>{c.platform}</td>
                            <td>
                              <span className="badge">{c.status}</span>
                            </td>
                            <td>{dateText(c.scheduled_at)}</td>
                            <td>
                              <RowActions
                                edit={() =>
                                  setEditor({ table: "contents", record: c })
                                }
                                remove={() =>
                                  setDeleting({
                                    table: "contents",
                                    id: c.id,
                                    name: c.title,
                                  })
                                }
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <Empty
                      text={
                        data.contents.length
                          ? "Nessun risultato per questi filtri."
                          : "Il tuo piano editoriale comincia da una prima idea."
                      }
                      action={newContent}
                    />
                  )}
                </section>
              )}
            </>
          )}
          {active &&
            ["Pagine e brand", "Social Media Manager"].includes(section) && (
              <>
                <div className="section-actions">
                  <p className="muted">
                    I tuoi universi creativi, ciascuno con la propria voce.
                  </p>
                  <button
                    className="primary"
                    disabled={!online || busy}
                    onClick={() => setEditor({ table: "brands" })}
                  >
                    <Plus size={17} />
                    Nuovo brand
                  </button>
                </div>
                <div className="cards-grid">
                  {data.brands.map((b) => (
                    <article className="panel brand-card" key={b.id}>
                      <span className="brand-initial">{b.name[0]}</span>
                      <h2>{b.name}</h2>
                      <p>
                        {b.description ||
                          "Aggiungi una descrizione per raccontare questo brand."}
                      </p>
                      <small>VOCE DEL BRAND</small>
                      <p>{b.tone || "Da definire"}</p>
                      <div className="brand-counts">
                        <span>
                          {
                            data.contents.filter((c) => c.brand_id === b.id)
                              .length
                          }{" "}
                          contenuti
                        </span>
                        <span>
                          {
                            data.profiles.filter((p) => p.brand_id === b.id)
                              .length
                          }{" "}
                          profili
                        </span>
                      </div>
                      <RowActions
                        edit={() => setEditor({ table: "brands", record: b })}
                        remove={() =>
                          setDeleting({
                            table: "brands",
                            id: b.id,
                            name: b.name,
                          })
                        }
                      />
                      <button
                        className="text-link"
                        onClick={() => {
                          go("Contenuti");
                          setBrandFilter(b.id);
                        }}
                      >
                        Apri contenuti <ArrowUpRight size={15} />
                      </button>
                    </article>
                  ))}
                </div>
                {!data.brands.length && (
                  <Empty
                    text="Aggiungi il tuo primo brand: nome, storia e tono di voce."
                    action={() => setEditor({ table: "brands" })}
                  />
                )}
              </>
            )}
          {active && section === "Profili social" && (
            <>
              <div className="section-actions">
                <p className="muted">
                  Organizza i tuoi canali. L’inserimento è manuale.
                </p>
                <button
                  className="primary"
                  disabled={!online || busy || !data.brands.length}
                  onClick={() => setEditor({ table: "profiles" })}
                >
                  <Plus size={17} />
                  Nuovo profilo
                </button>
              </div>
              {!data.brands.length && (
                <div className="notice">
                  Crea prima un brand nella sezione Pagine e brand.
                </div>
              )}
              <div className="cards-grid">
                {data.profiles.map((p) => (
                  <article key={p.id} className="panel">
                    <AtSign size={24} />
                    <h2>{p.handle}</h2>
                    <p>
                      {p.platform} · {brandName(p.brand_id)}
                    </p>
                    <RowActions
                      edit={() => setEditor({ table: "profiles", record: p })}
                      remove={() =>
                        setDeleting({
                          table: "profiles",
                          id: p.id,
                          name: p.handle,
                        })
                      }
                    />
                  </article>
                ))}
              </div>
              {!data.profiles.length && (
                <Empty text="I tuoi profili social appariranno qui." />
              )}
            </>
          )}
          {section === "Assistente AI" && (
            <section className="panel ai-panel">
              <Sparkles size={28} />
              <h2>Una scintilla per le tue idee</h2>
              <p className="muted">
                Scegli un contenuto: l’assistente userà anche il tono di voce
                del suo brand. La risposta non modifica il tuo lavoro.
              </p>
              <form onSubmit={askAi}>
                <label>
                  Contenuto
                  <select
                    required
                    value={aiContent}
                    onChange={(e) => setAiContent(e.target.value)}
                  >
                    <option value="">Scegli un contenuto</option>
                    {data.contents.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Di cosa hai bisogno?
                  <textarea
                    required
                    minLength={3}
                    maxLength={2000}
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Ad esempio: proponi tre aperture per questo contenuto…"
                  />
                </label>
                <button
                  className="primary"
                  disabled={busy || !online || !aiContent}
                >
                  <Sparkles size={16} />
                  {busy ? "Sto elaborando…" : "Genera una proposta"}
                </button>
              </form>
              {aiText && (
                <label className="ai-result">
                  La tua proposta, liberamente modificabile
                  <textarea
                    value={aiText}
                    onChange={(e) => setAiText(e.target.value)}
                    rows={12}
                  />
                </label>
              )}
              <small className="muted">
                Richiede la funzione Supabase e il provider AI configurati. Le
                generazioni possono avere un costo.
              </small>
            </section>
          )}
          {section === "Impostazioni" && (
            <div className="settings-grid">
              <section className="panel">
                <h2>Il tuo account</h2>
                <p>
                  {session.user.user_metadata.first_name}{" "}
                  {session.user.user_metadata.last_name}
                </p>
                <p>{session.user.email}</p>
                <p className="muted">
                  Il proprietario del progetto Supabase può amministrare account
                  e database. Non esiste una sezione pubblica per consultare i
                  tuoi dati.
                </p>
                <button className="secondary" disabled={busy} onClick={logout}>
                  <LogOut size={16} />
                  Esci da questo dispositivo
                </button>
              </section>
              <section className="panel">
                <h2>Una copia delle tue idee</h2>
                <p className="muted">
                  Esporta i dati del tuo account. Il backup contiene
                  informazioni personali: conservalo in un luogo sicuro.
                </p>
                <button
                  className="secondary"
                  onClick={() => download(data)}
                  disabled={!query.data && !cached}
                >
                  <Download size={16} />
                  Esporta backup JSON
                </button>
                <hr />
                <h3>Importa un backup Elara</h3>
                <p className="muted">
                  Anteprima prima dell’importazione. I dati vengono aggiunti con
                  nuovi identificativi, senza sovrascritture.
                </p>
                <label className="file-input">
                  <Upload size={17} />
                  Scegli file JSON
                  <input
                    type="file"
                    accept=".json,application/json"
                    disabled={!online || busy}
                    onChange={(e) => {
                      void importFile(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
              </section>
            </div>
          )}
          {section === "Piani e prezzi" && <Pricing />}
          <footer className="page-footer">
            elara studio <span>✧</span> uno spazio per creare, al tuo ritmo.
          </footer>
        </div>
      </main>
      {editor && (
        <Modal
          title={
            editor.record
              ? "Modifica " +
                (editor.table === "brands"
                  ? "brand"
                  : editor.table === "profiles"
                    ? "profilo"
                    : "contenuto")
              : editor.table === "brands"
                ? "Un nuovo universo creativo"
                : editor.table === "profiles"
                  ? "Collega un profilo"
                  : "Una nuova idea"
          }
          close={() => {
            if (!busy) setEditor(null);
          }}
        >
          <form onSubmit={save}>
            <RecordFields
              editor={editor}
              data={data}
              plan={plan}
              onMediaChange={setMediaDraft}
              onMediaBusy={setMediaBusy}
            />
            {problem && (
              <p role="alert" className="error">
                {problem}
              </p>
            )}
            <div className="modal-footer">
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => setEditor(null)}
              >
                Annulla
              </button>
              <button
                className="primary"
                disabled={busy || mediaBusy || !online}
              >
                {busy ? "Salvataggio…" : "Salva online"}
              </button>
            </div>
            {!online && (
              <p className="notice">
                Connessione necessaria. Il modulo resta aperto.
              </p>
            )}
          </form>
        </Modal>
      )}
      {deleting && (
        <Modal
          title="Eliminare questo elemento?"
          close={() => {
            if (!busy) setDeleting(null);
          }}
        >
          <p>
            Vuoi eliminare “{deleting.name}”? Questa operazione non si può
            annullare.
          </p>
          {deleting.table !== "contents" && (
            <p className="muted">
              L’eliminazione è impedita se esistono elementi collegati.
              Riassegnali o eliminali prima.
            </p>
          )}
          {problem && (
            <p className="error" role="alert">
              {problem}
            </p>
          )}
          <div className="modal-footer">
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              Annulla
            </button>
            <button
              className="danger"
              disabled={busy || !online}
              onClick={async () => {
                const ok = await perform(async () => {
                  await removeRecord(deleting.table, deleting.id);
                  if (deleting.table === "contents") {
                    const old = data.contents.find(
                      (c) => c.id === deleting.id,
                    )?.image_path;
                    if (old)
                      await deleteContentImage(old).catch(() =>
                        setCacheWarning(
                          "Contenuto eliminato; la relativa immagine non è stata rimossa dallo storage.",
                        ),
                      );
                    const paths =
                      data.contents
                        .find((c) => c.id === deleting.id)
                        ?.media.map((m) => m.path) || [];
                    await removeEditorialMedia(paths).catch(() =>
                      setCacheWarning(
                        "Contenuto eliminato; alcuni allegati non sono stati rimossi.",
                      ),
                    );
                  }
                }, "Elemento eliminato.");
                if (ok) setDeleting(null);
              }}
            >
              Elimina
            </button>
          </div>
        </Modal>
      )}
      {pendingImport && (
        <Modal
          title="Controlla il tuo backup"
          close={() => {
            if (!busy) setPendingImport(null);
          }}
        >
          <p>
            Verranno aggiunti {pendingImport.brands.length} brand,{" "}
            {pendingImport.profiles.length} profili e{" "}
            {pendingImport.contents.length} contenuti.
          </p>
          <p>
            Importare più volte lo stesso file crea copie. Non verranno
            eliminati i dati attuali.
          </p>
          {problem && (
            <p className="error" role="alert">
              {problem}
            </p>
          )}
          <div className="modal-footer">
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setPendingImport(null)}
            >
              Annulla
            </button>
            <button
              className="primary"
              disabled={busy || !online}
              onClick={doImport}
            >
              {busy ? "Importazione…" : "Conferma importazione"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function RowActions({
  edit,
  remove,
}: {
  edit: () => void;
  remove: () => void;
}) {
  return (
    <div className="actions">
      <button className="icon-btn" aria-label="Modifica" onClick={edit}>
        <Pencil size={16} />
      </button>
      <button className="icon-btn" aria-label="Elimina" onClick={remove}>
        <Trash2 size={16} />
      </button>
    </div>
  );
}
function Empty({ text, action }: { text: string; action?: () => void }) {
  return (
    <div className="empty">
      <Sparkles size={30} strokeWidth={1} />
      <p>{text}</p>
      {action && (
        <button className="secondary" onClick={action}>
          <Plus size={16} />
          Comincia da qui
        </button>
      )}
    </div>
  );
}
function RecordFields({
  editor,
  data,
  plan,
  onMediaChange,
  onMediaBusy,
}: {
  editor: Editor;
  data: Workspace;
  plan: string;
  onMediaChange: (items: DraftMedia[]) => void;
  onMediaBusy: (busy: boolean) => void;
}) {
  const r = editor.record as Content | undefined;
  const [platform, setPlatform] = useState(r?.platform || "Instagram");
  const [brand, setBrand] = useState(r?.brand_id || data.brands[0]?.id || "");
  if (editor.table === "brands") {
    const b = editor.record as Brand | undefined;
    return (
      <>
        <label>
          Nome del brand
          <input
            name="name"
            defaultValue={b?.name}
            maxLength={120}
            required
            autoFocus
          />
        </label>
        <label>
          La sua storia
          <textarea
            name="description"
            defaultValue={b?.description}
            maxLength={4000}
          />
        </label>
        <label>
          Tono di voce
          <textarea
            name="tone"
            defaultValue={b?.tone}
            maxLength={2000}
            placeholder="Valori, pubblico, parole e stile del brand…"
          />
        </label>
      </>
    );
  }
  const profile = editor.record as Social | undefined;
  return (
    <>
      <label>
        Brand
        <select
          name="brand_id"
          required
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
        >
          {data.brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      {editor.table === "profiles" ? (
        <>
          <label>
            Piattaforma
            <select
              name="platform"
              defaultValue={profile?.platform || "Instagram"}
            >
              {platforms.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label>
            Nome / handle
            <input
              name="handle"
              required
              maxLength={120}
              defaultValue={profile?.handle}
              autoFocus
            />
          </label>
        </>
      ) : (
        <>
          <label>
            Titolo
            <input
              name="title"
              defaultValue={r?.title}
              required
              maxLength={240}
              autoFocus
            />
          </label>
          <div className="form-grid">
            <label>
              Piattaforma
              <select
                name="platform"
                value={platform}
                onChange={(e) =>
                  setPlatform(e.target.value as Content["platform"])
                }
              >
                {platforms.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label>
              Profilo
              <select
                key={brand}
                name="profile_id"
                defaultValue={
                  data.profiles.some(
                    (p) => p.id === r?.profile_id && p.brand_id === brand,
                  )
                    ? r?.profile_id || ""
                    : ""
                }
              >
                <option value="">Nessun profilo</option>
                {data.profiles
                  .filter((p) => p.brand_id === brand)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.platform} · {p.handle}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Formato
              <input
                name="format"
                maxLength={80}
                defaultValue={r?.format || ""}
                placeholder="Reel, carosello, articolo…"
              />
            </label>
            <label>
              Pilastro editoriale
              <input
                name="pillar"
                maxLength={120}
                defaultValue={r?.pillar || ""}
              />
            </label>
            <label>
              Stato
              <select name="status" defaultValue={r?.status || "Idea"}>
                {statuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Data e ora locale
              <input
                type="datetime-local"
                name="scheduled_at"
                defaultValue={localDatetime(
                  r?.scheduled_at || editor.date || null,
                )}
              />
            </label>
          </div>
          {["Instagram", "TikTok", "YouTube"].includes(platform) ? (
            <>
              <MediaComposer
                platform={platform}
                plan={plan}
                initial={r?.media || []}
                onChange={onMediaChange}
                onBusy={onMediaBusy}
              />
              {r?.image_path && <ImageField path={r.image_path} />}
            </>
          ) : (
            <ImageField path={r?.image_path || null} />
          )}
          <HashtagFields values={r?.hashtags} />
          <label>
            Hook
            <input
              name="hook"
              maxLength={1000}
              defaultValue={r?.hook || ""}
              placeholder="La frase che cattura l’attenzione…"
            />
          </label>
          <label>
            Descrizione
            <textarea
              name="description"
              rows={4}
              maxLength={10000}
              defaultValue={r?.description || ""}
              placeholder="Racconta l’idea, il messaggio e cosa vuoi pubblicare…"
            />
          </label>
          <label>
            Script / testo
            <textarea
              name="script"
              defaultValue={r?.script || ""}
              rows={6}
              maxLength={20000}
            />
          </label>
          <label>
            Appunti
            <textarea
              name="notes"
              defaultValue={r?.notes || ""}
              maxLength={10000}
            />
          </label>
        </>
      )}
    </>
  );
}
