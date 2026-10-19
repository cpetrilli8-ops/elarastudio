import { useState, type FormEvent } from "react";
import { supabase, appUrl } from "./backend";
import { Sparkles, ArrowLeft } from "lucide-react";
export default function Auth({
  recovery,
  onDone,
}: {
  recovery: boolean;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError("");
    setMessage("");
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") || "").trim();
    const password = String(f.get("password") || "");
    try {
      if (recovery) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        onDone();
      } else if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: String(f.get("first_name") || "").trim(),
              last_name: String(f.get("last_name") || "").trim(),
            },
            emailRedirectTo: appUrl,
          },
        });
        if (error) throw error;
        setMessage(
          data.session
            ? "Account creato."
            : "Controlla la tua email per confermare l’account, poi accedi.",
        );
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: appUrl + "/?recovery=1",
        });
        if (error) throw error;
        setMessage(
          "Se l’indirizzo è registrato, riceverai un link per reimpostare la password.",
        );
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Operazione non riuscita. Riprova.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <section className="auth-story">
        <a href="/" className="wordmark">
          elara<span>STUDIO</span>
        </a>
        <span className="eyebrow">IL TUO SPAZIO CREATIVO</span>
        <h1>
          Le tue idee,
          <br />
          <em>un posto speciale.</em>
        </h1>
        <p>
          Organizza, immagina e dai forma al tuo prossimo contenuto. Tutto
          comincia da qui.
        </p>
        <Sparkles size={70} strokeWidth={0.7} />
        <small>Qui prendono forma le tue idee.</small>
      </section>
      <main className="auth-main">
        <div className="auth-card">
          <span className="eyebrow">BENVENUTA NEL TUO STUDIO</span>
          <h2>
            {recovery
              ? "Una nuova password"
              : mode === "register"
                ? "Cominciamo da te"
                : mode === "forgot"
                  ? "Ritrova il tuo accesso"
                  : "Bentornata in Elara"}
          </h2>
          <p className="muted">
            {mode === "login" && !recovery
              ? "Accedi per ritrovare idee, progetti e ispirazioni."
              : "Il tuo spazio, accessibile dai tuoi dispositivi."}
          </p>
          {!supabase ? (
            <div className="notice">
              Il progetto è pronto per il collegamento a Supabase. Configura le
              variabili in <code>.env.local</code> come indicato nel README. Non
              è ancora possibile registrarsi.
            </div>
          ) : (
            <form onSubmit={submit}>
              {mode === "register" && !recovery && (
                <div className="form-grid">
                  <label>
                    Nome
                    <input
                      name="first_name"
                      autoComplete="given-name"
                      required
                      maxLength={80}
                    />
                  </label>
                  <label>
                    Cognome
                    <input
                      name="last_name"
                      autoComplete="family-name"
                      required
                      maxLength={80}
                    />
                  </label>
                </div>
              )}
              {!recovery && (
                <label>
                  Email
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                  />
                </label>
              )}
              {(mode !== "forgot" || recovery) && (
                <label>
                  Password
                  <input
                    name="password"
                    type="password"
                    minLength={10}
                    maxLength={128}
                    autoComplete={
                      recovery || mode === "register"
                        ? "new-password"
                        : "current-password"
                    }
                    required
                  />
                  {(mode === "register" || recovery) && (
                    <small>Almeno 10 caratteri.</small>
                  )}
                </label>
              )}
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
              {message && (
                <p role="status" className="notice">
                  {message}
                </p>
              )}
              <button className="primary full" disabled={busy}>
                {busy
                  ? "Un momento…"
                  : recovery
                    ? "Salva password"
                    : mode === "register"
                      ? "Crea il tuo account"
                      : mode === "forgot"
                        ? "Invia link di recupero"
                        : "Entra nel tuo studio"}
              </button>
            </form>
          )}
          {!recovery && (
            <div className="auth-links">
              {mode === "login" ? (
                <>
                  <button
                    onClick={() => {
                      setMode("forgot");
                      setError("");
                      setMessage("");
                    }}
                  >
                    Password dimenticata?
                  </button>
                  <p>
                    Non hai un account?{" "}
                    <button
                      onClick={() => {
                        setMode("register");
                        setError("");
                        setMessage("");
                      }}
                    >
                      Registrati
                    </button>
                  </p>
                </>
              ) : (
                <button
                  onClick={() => {
                    setMode("login");
                    setError("");
                    setMessage("");
                  }}
                >
                  <ArrowLeft size={14} /> Torna all’accesso
                </button>
              )}
            </div>
          )}
          <small className="muted">
            Ogni account accede soltanto ai propri dati.
          </small>
        </div>
      </main>
    </div>
  );
}
