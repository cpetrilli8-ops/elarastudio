import { Check, Sparkles, Heart, Feather, Crown } from "lucide-react";
export const plans = [
  {
    name: "Gratuito",
    price: 0,
    icon: Heart,
    subtitle: "Il primo spazio per le tue idee.",
    featured: false,
    features: [
      "1 brand personale",
      "Fino a 30 contenuti salvati",
      "Fino a 3 profili social",
      "Calendario con immagine, hook e descrizione",
      "Ricerca e filtri",
      "Sincronizzazione tra dispositivi",
    ],
    description: "Per iniziare, senza fretta.",
  },
  {
    name: "Base",
    price: 4,
    icon: Feather,
    subtitle: "Un piccolo passo per crescere.",
    featured: false,
    features: [
      "Fino a 3 brand",
      "Fino a 300 contenuti salvati",
      "6 profili social",
      "Tabella, calendario e bacheca",
      "Tono di voce per ogni brand",
      "Sincronizzazione tra dispositivi",
    ],
    description: "Per chi crea con costanza.",
  },
  {
    name: "Pro",
    price: 8,
    icon: Sparkles,
    subtitle: "Più spazio alla tua creatività.",
    featured: true,
    features: [
      "Fino a 10 brand",
      "Fino a 1.000 contenuti salvati",
      "20 profili social",
      "Tutte le viste e i filtri",
      "20 generazioni AI al mese",
      "Organizzazione Social Media Manager",
      "Sincronizzazione tra dispositivi",
    ],
    description: "Per creator e professionisti in crescita.",
  },
  {
    name: "Premium",
    price: 15,
    icon: Crown,
    subtitle: "Per i tuoi universi creativi.",
    featured: false,
    features: [
      "Fino a 30 brand",
      "Fino a 5.000 contenuti salvati",
      "60 profili social",
      "Tutte le viste e i filtri",
      "60 generazioni AI al mese",
      "Fino a 10 immagini/video per Instagram e TikTok",
      "Adattamento immagini e video ai formati social",
      "Organizzazione Social Media Manager",
      "Sincronizzazione tra dispositivi",
    ],
    description: "Per chi segue più brand e progetti.",
  },
];
export default function Pricing() {
  return (
    <>
      <section className="pricing-intro">
        <span className="eyebrow">UNO SPAZIO CHE CRESCE CON TE</span>
        <h2>
          Le tue idee meritano
          <br />
          <em>il piano giusto.</em>
        </h2>
        <p>
          Dal primo appunto ai tuoi progetti più grandi.
          <br />
          Trova il ritmo che fa per te.
        </p>
      </section>
      <div className="pricing-grid">
        {plans.map(
          ({
            name,
            price,
            icon: Icon,
            subtitle,
            featured,
            features,
            description,
          }) => (
            <article
              className={"pricing-card " + (featured ? "featured" : "")}
              key={name}
            >
              {featured && <span className="plan-ribbon">CONSIGLIATO</span>}
              <Icon size={25} strokeWidth={1.2} />
              <h2>{name}</h2>
              <p className="plan-subtitle">{subtitle}</p>
              <div className="plan-price">
                €{price}
                <small>{price === 0 ? "gratuito" : "al mese"}</small>
              </div>
              <p className="plan-description">{description}</p>
              <ul>
                {features.map((f) => (
                  <li key={f}>
                    <Check size={15} />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                className={featured ? "primary full" : "secondary full"}
                disabled
              >
                Disponibile prossimamente
              </button>
            </article>
          ),
        )}
      </div>
      <div className="pricing-note">
        <Sparkles size={17} />
        <p>
          Funzionalità e quote previste al lancio dei piani. Abbonamenti,
          pagamenti e limiti commerciali non ancora attivi. Le generazioni AI
          richiedono il servizio configurato; le quote mensili non si
          accumulano. Nessun importo viene addebitato.
        </p>
      </div>
      <section className="panel pricing-common">
        <h2>Il tuo spazio è al sicuro, in ogni piano.</h2>
        <p className="muted">
          Accesso personale, dati separati per account, sincronizzazione tra
          dispositivi, esportazione e consultazione dei dati già memorizzati
          senza connessione sono previsti per tutti. I profili social sono
          inseriti manualmente: i piani non includono pubblicazione automatica o
          accessi per collaboratori.
        </p>
      </section>
    </>
  );
}
