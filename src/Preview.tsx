import { useState } from "react";
import {
  LayoutDashboard,
  Files,
  CalendarDays,
  Layers,
  AtSign,
  Sparkles,
  Settings,
  Briefcase,
  Plus,
  ArrowUpRight,
  Menu,
  X,
  Crown,
} from "lucide-react";
import Pricing from "./Pricing";
import PreviewCalendar from "./PreviewCalendar";
const navigation = [
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
const samples = [
  {
    title: "Una piccola routine, un nuovo inizio",
    format: "Reel",
    platform: "Instagram",
    status: "In lavorazione",
    date: "24 ott",
    brand: "Il mio brand",
  },
  {
    title: "Le cose belle di questo autunno",
    format: "Carosello",
    platform: "Instagram",
    status: "Idea",
    date: "26 ott",
    brand: "Il mio brand",
  },
  {
    title: "Dietro le quinte del mio studio",
    format: "Video",
    platform: "TikTok",
    status: "Programmato",
    date: "28 ott",
    brand: "Il mio brand",
  },
];
export default function Preview() {
  const [section, setSection] = useState(
    new URLSearchParams(location.search).get("page") === "pricing"
      ? "Piani e prezzi"
      : new URLSearchParams(location.search).get("page") === "calendar"
        ? "Calendario"
        : "Panoramica",
  );
  const [menu, setMenu] = useState(false);
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState("");
  const explain = () =>
    setNote(
      "Questa è un’anteprima visiva con dati di esempio. Per salvare dati reali occorre configurare Supabase e accedere dalla schermata di login.",
    );
  return (
    <div className="app-shell">
      <aside className={"sidebar " + (menu ? "open" : "")}>
        <a className="wordmark" href="/">
          elara<span>STUDIO</span>
        </a>
        <p className="sidebar-caption">IL TUO SPAZIO CREATIVO</p>
        <nav aria-label="Navigazione anteprima">
          {navigation.map(([name, Icon]) => (
            <button
              key={name}
              className={"nav-item " + (section === name ? "selected" : "")}
              onClick={() => {
                setSection(name);
                setMenu(false);
                setNote("");
              }}
            >
              <Icon size={18} />
              {name}
              {name === section && <span className="nav-dot" />}
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
            <span className="avatar">E</span>
            <span>
              <strong>Il tuo studio</strong>
              <small>Anteprima con dati di esempio</small>
            </span>
          </div>
        </div>
      </aside>
      {menu && (
        <button
          className="scrim"
          aria-label="Chiudi navigazione"
          onClick={() => setMenu(false)}
        />
      )}
      <main className="main">
        <header className="topbar">
          <div>
            <button
              className="mobile-menu icon-btn"
              aria-label="Apri navigazione"
              onClick={() => setMenu(true)}
            >
              <Menu />
            </button>
            <span className="breadcrumb">
              Il tuo studio <span>/</span>
              <strong>{section}</strong>
            </span>
          </div>
          <span className="top-note">✧ Anteprima visiva · dati di esempio</span>
        </header>
        <div className="page">
          <div className="page-heading">
            <div>
              <span className="eyebrow">ELARA STUDIO</span>
              <h1>
                {section === "Panoramica"
                  ? "Il tuo spazio creativo ✧"
                  : section}
              </h1>
              <p className="muted">Qui prendono forma le tue idee.</p>
            </div>
            <button className="primary" onClick={explain}>
              <Plus size={17} />
              Nuovo contenuto
            </button>
          </div>
          <div className="notice">
            Anteprima visiva con dati di esempio. Nessun account o salvataggio
            viene simulato. <a href="/">Vai all’accesso</a>
          </div>
          {note && (
            <div role="status" className="notice">
              {note}
              <button aria-label="Chiudi messaggio" onClick={() => setNote("")}>
                <X size={15} />
              </button>
            </div>
          )}
          {section === "Panoramica" ? (
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
                  <button
                    className="text-link"
                    onClick={() => setSection("Contenuti")}
                  >
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
                {[
                  ["Idee da coltivare", "1", "Ogni grande progetto inizia qui"],
                  ["In lavorazione", "1", "Un passo alla volta"],
                  ["In programma", "1", "Pronte a incontrare il mondo"],
                  ["I tuoi brand", "1", "Universi creativi da raccontare"],
                ].map(([title, n, note]) => (
                  <article className="stat" key={title}>
                    <span>{title}</span>
                    <strong>{n}</strong>
                    <small>{note}</small>
                  </article>
                ))}
              </div>
              <div className="dashboard-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <h2>In arrivo nel tuo calendario</h2>
                    <button
                      className="text-link"
                      onClick={() => setSection("Calendario")}
                    >
                      Vedi tutto <ArrowUpRight size={15} />
                    </button>
                  </div>
                  {samples.map((c) => (
                    <button
                      className="upcoming-row"
                      key={c.title}
                      onClick={() => {
                        setSelected(c.title);
                        setSection("Contenuti");
                      }}
                    >
                      <span className="date-square">{c.date}</span>
                      <span>
                        <strong>{c.title}</strong>
                        <small>
                          {c.platform} · {c.format}
                        </small>
                      </span>
                      <span className="badge">{c.status}</span>
                    </button>
                  ))}
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
                  <button className="secondary" onClick={explain}>
                    Appunta un’idea <Plus size={15} />
                  </button>
                </section>
              </div>
            </>
          ) : section === "Contenuti" ? (
            <section className="panel table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Contenuto</th>
                    <th>Brand</th>
                    <th>Piattaforma</th>
                    <th>Stato</th>
                    <th>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {samples.map((c) => (
                    <tr
                      key={c.title}
                      style={
                        selected === c.title
                          ? { background: "#f3e5de" }
                          : undefined
                      }
                    >
                      <td>
                        <button className="title-button" onClick={explain}>
                          {c.title}
                        </button>
                        <small>{c.format}</small>
                      </td>
                      <td>{c.brand}</td>
                      <td>{c.platform}</td>
                      <td>
                        <span className="badge">{c.status}</span>
                      </td>
                      <td>{c.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : section === "Calendario" ? (
            <PreviewCalendar />
          ) : ["Pagine e brand", "Social Media Manager"].includes(section) ? (
            <div className="cards-grid">
              <article className="panel brand-card">
                <span className="brand-initial">E</span>
                <h2>Il mio brand</h2>
                <p>
                  Uno spazio per raccontare la tua storia, con autenticità e un
                  pizzico di magia.
                </p>
                <small>VOCE DEL BRAND</small>
                <p>Calda, creativa, personale.</p>
                <div className="brand-counts">
                  <span>3 contenuti di esempio</span>
                  <span>2 profili di esempio</span>
                </div>
                <button
                  className="text-link"
                  onClick={() => setSection("Contenuti")}
                >
                  Apri contenuti <ArrowUpRight size={15} />
                </button>
              </article>
            </div>
          ) : section === "Profili social" ? (
            <div className="cards-grid">
              {["Instagram", "TikTok"].map((p) => (
                <article className="panel" key={p}>
                  <AtSign size={25} />
                  <h2>Il tuo profilo</h2>
                  <p>{p} · Il mio brand</p>
                  <span className="badge">Esempio visivo</span>
                </article>
              ))}
            </div>
          ) : section === "Assistente AI" ? (
            <section className="panel ai-panel">
              <Sparkles size={28} />
              <h2>Una scintilla per le tue idee</h2>
              <p className="muted">
                L’assistente userà il tuo contenuto e la voce del tuo brand. Le
                proposte resteranno modificabili.
              </p>
              <label>
                Contenuto
                <select>
                  <option>Una piccola routine, un nuovo inizio</option>
                </select>
              </label>
              <label>
                Di cosa hai bisogno?
                <textarea placeholder="Proponi tre aperture per questo contenuto…" />
              </label>
              <button className="primary" onClick={explain}>
                Genera una proposta
              </button>
              <p className="notice" style={{ marginTop: 20 }}>
                Assistente non ancora configurato. Nessuna chiamata AI
                nell’anteprima.
              </p>
            </section>
          ) : section === "Piani e prezzi" ? (
            <Pricing />
          ) : (
            <div className="settings-grid">
              <section className="panel">
                <h2>Il tuo account</h2>
                <p className="muted">
                  Dopo l’accesso ritroverai qui le tue informazioni personali.
                </p>
                <a className="secondary" href="/">
                  Vai all’accesso
                </a>
              </section>
              <section className="panel">
                <h2>Una copia delle tue idee</h2>
                <p className="muted">
                  Il backup JSON e l’importazione sono disponibili nell’app
                  collegata al tuo account.
                </p>
                <button className="secondary" onClick={explain}>
                  Esporta backup
                </button>
              </section>
            </div>
          )}
          <footer className="page-footer">
            elara studio <span>✧</span> uno spazio per creare, al tuo ritmo.
          </footer>
        </div>
      </main>
    </div>
  );
}
