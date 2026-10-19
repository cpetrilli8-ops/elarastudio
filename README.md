# Elara Studio

App React/TypeScript per organizzare brand, profili social e calendario editoriale. Codice privato; nessuna licenza open source concessa. Le dipendenze mantengono le proprie licenze.

## Stato reale

- Implementati: registrazione, login, conferma email tramite Supabase, recupero password, sessione web, logout, CRUD brand/profili/contenuti, ricerca/filtri, tabella/bacheca/calendario, riepilogo, contesto brand, import/export JSON e cache IndexedDB separata per account.
- Database: migrazione con RLS e vincoli tra proprietario/brand/profilo; importazione atomica; test PostgreSQL embedded con due account e accesso anonimo.
- Assistente: Edge Function protetta, provider OpenAI configurabile, timeout e quota tecnica server di 20 richieste/giorno/account. Nessuna chiamata AI effettuata durante lo sviluppo.
- Prezzi: Gratuito €0 (3 profili), Base €4/mese, Pro €8/mese consigliato, Premium €15/mese. Quote e funzionalità nella pagina prezzi sono **proposte per il lancio**, non diritti attualmente applicati. Non ci sono checkout, abbonamenti, blocchi per piano o quote AI commerciali mensili. La quota tecnica giornaliera non implementa il sistema commerciale.
- Anteprima esplicita `/?preview=1`: campioni visivi isolati, nessun account simulato e nessun salvataggio. `/?preview=1&page=pricing` apre i prezzi. Nessun dato campione viene inserito nei veri account.
- La versione Base44 non era disponibile durante il confronto: questa interfaccia segue la palette e le sezioni concordate, ma non è stata verificata come copia grafica esatta. Occorrono screenshot per il confronto.

## Avvio locale (Node 22.12+)

```powershell
npm ci
Copy-Item .env.example .env.local
# Impostare VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

Senza variabili Supabase la pagina di accesso spiega che il servizio non è configurato; l’anteprima visiva funziona comunque. Non condividere `.env.local`. URL e publishable/anon key sono pubblici; i permessi reali vengono verificati da PostgreSQL tramite RLS.

## Configurazione Supabase

1. Usare un progetto dedicato. Eseguire `supabase/migrations/202610190001_workspace.sql` tramite SQL Editor oppure CLI Supabase. È una migrazione iniziale, da eseguire una volta; non applicarla sopra tabelle omonime già presenti senza analisi/migrazione.
2. In Authentication abilitare email/password e conferma email, configurare SMTP per invii reali e impostare Site URL sul dominio HTTPS definitivo.
3. Consentire come redirect l’origine locale e il dominio definitivo, compreso `/?recovery=1`. Impostare `VITE_APP_URL` sulla stessa origine, senza slash finale.
4. Pubblicare la funzione `ai-assistant` con CLI Supabase o dashboard. In produzione verificare la compatibilità della verifica JWT del gateway con le chiavi del progetto; la funzione verifica anche la sessione mediante `auth.getUser`.
5. Configurare i segreti `OPENAI_API_KEY`, `OPENAI_MODEL` e `ALLOWED_ORIGINS` (origini esatte separate da virgole). URL e chiavi Supabase del server sono quelle fornite dall’ambiente Edge Functions: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Non copiarle nel frontend.
6. Non configurare OpenAI durante i test: l’AI è opzionale. Le richieste reali possono avere costi esterni. La funzione invia a OpenAI soltanto il contenuto scelto e il contesto del suo brand, con `store:false`.

Il proprietario del progetto Supabase può amministrare utenti e dati dal pannello del fornitore; questa app non contiene un pannello per leggere dati di altri account. Le password sono gestite da Supabase Auth.

## Cache e offline

IndexedDB conserva una copia dei record per utente sul dispositivo. Cambio account e logout annullano l’accesso alla cache e ne eliminano i record, proteggendo anche dalle richieste tardive. La cache non è cifrata: usare dispositivi personali e terminare la sessione sui dispositivi condivisi. Se l’archiviazione locale è bloccata o piena viene mostrato un messaggio e l’app continua online.

Consultazione offline della copia già caricata nell’app aperta; modifiche e login richiedono rete. Nessuna coda di scritture offline e nessun salvataggio finto. Il service worker conserva solo asset statici compilati: avviare da zero l’app senza rete non è garantito. I dati privati e le API non passano nella cache del service worker.

La sincronizzazione aggiorna i dati al ritorno sulla finestra, al ripristino della rete e dopo un salvataggio. Non implementa collaborazione in tempo reale o risoluzione di modifiche simultanee; l’ultimo salvataggio sul server prevale.

## Pubblicazione web

Configurare hosting con `npm ci`, `npm run build`, directory `dist` e variabili `VITE_*` di produzione. È incluso `vercel.json` con fallback delle rotte. Non usare `vite dev` come server di produzione. Dopo il deploy configurare URL e redirect Supabase. La cartella `dist` non contiene chiavi server.

La PWA contiene un manifest e un service worker limitato agli asset; icone raster per tutte le piattaforme, schermate di avvio e test d’installazione restano da finalizzare prima della distribuzione.

## Android e iOS

Capacitor e i relativi pacchetti sono inclusi. Generare i progetti nativi:

```powershell
npm run build
npm run android:add
npm run ios:add
npm run mobile:sync
npx cap open android
# Su macOS con Xcode:
npx cap open ios
```

App ID provvisorio: `it.elarastudio.app`. Personalizzarlo prima di registrare l’app negli store. I progetti nativi generati sono esclusi dal repository di questa prima versione; non sono state prodotte build firmate.

**Preparazione mobile, non release store:** layout responsive pronto, ma test dispositivi, deep/universal link di conferma e recupero, firme, icone native, policy privacy e acquisti in-app non sono ancora completati. Nei build nativi i token rimangono solo in memoria: dopo la chiusura occorre accedere nuovamente. Prima di introdurre persistenza nativa serve un adattatore verificato Keychain/Keystore. Il flusso email nativo va completato e testato prima della pubblicazione negli store. Non usare questa versione come release mobile di produzione.

## Verifiche

```powershell
npm run typecheck
npm run lint
npm test
npm run build
# Con Deno installato:
deno check --config supabase/functions/ai-assistant/deno.json supabase/functions/ai-assistant/index.ts
```

I test usano fake-indexeddb e PostgreSQL embedded PGlite; non accedono ai dati Supabase di produzione. Le migrazioni sono testate in un database vuoto con ruoli equivalenti per RLS, non nell’istanza Supabase dell’utente. Test end-to-end email/login e build iOS/Android richiedono servizi e dispositivi configurati e non sono stati eseguiti.

L’esportazione JSON contiene dati personali; l’importazione accetta lo schema Elara di questa versione, aggiunge nuovi ID e non sovrascrive. Importare lo stesso file più volte genera copie. La migrazione di dati Base44 necessita un convertitore dedicato, non incluso.

## Calendario editoriale e immagini

Il modulo contenuti include immagine privata (JPG/PNG/WebP fino a 5 MB), hook, data/ora, descrizione e fino a 5 hashtag unici. Applicare anche `supabase/migrations/202610190002_editorial_images.sql`, dopo la migrazione iniziale. Questa crea il bucket privato `editorial-images`, le policy di accesso e i campi aggiuntivi.

Le immagini usano URL firmati temporanei e non vengono incluse nei file JSON né salvate nella cache offline. Un backup ripristina i testi e gli hashtag, ma le immagini vanno ricaricate. Non sono presenti editor immagini, ridimensionamento automatico o pubblicazione social automatica.

L’anteprima `/?preview=1&page=calendar` permette di provare creazione, modifica, immagini locali e cinque hashtag in memoria; ricaricando o uscendo dalla sezione le bozze di anteprima scompaiono. Questo non riguarda i dati degli account reali.

## Verifica di questa consegna

TypeScript, ESLint, 21 test automatici e build web eseguiti con successo. Verificata nel browser la creazione di una bozza del calendario con data, hook e descrizione e la presenza dei cinque campi hashtag. Le policy degli oggetti privati sono testate nel database embedded con lo schema Storage minimo; upload/download reali e email richiedono il progetto Supabase configurato. Nessun dato di produzione è stato modificato.

L’audit delle dipendenze runtime non segnala vulnerabilità; rimangono advisory moderati nella catena di sviluppo `@capacitor/cli → xcode → uuid`, da rivalutare prima della release mobile. La compatibilità effettiva con gli store non è ancora verificata.

## Allegati Premium e formati social

Applicare, dopo le prime due migrazioni, `202610190003_premium_media.sql`. I piani vengono letti da `account_plans` e non sono modificabili dal browser. Senza assegnazione server l’account è Gratuito. Non c’è ancora un sistema di pagamento che assegni automaticamente il piano; un amministratore autorizzato deve assegnare Premium da Supabase per i test degli account reali.

Nel calendario si sceglie Instagram, TikTok o YouTube. Premium consente fino a 10 allegati per contenuto su Instagram/TikTok e uno su YouTube, immagini o video. Gli altri piani consentono una singola immagine. Il bucket `editorial-media` è privato, con policy per cartella utente e controlli di piano sul database. Il selettore piano presente nell’anteprima è esclusivamente dimostrativo e non cambia il piano degli account reali.

Formati di destinazione: Instagram quadrato 1080×1080, post verticale 1080×1350, Storia/Reel 1080×1920; TikTok 1080×1920; YouTube orizzontale 1920×1080 o Short 1080×1920. Sono preset di esportazione, non un elenco esaustivo delle specifiche consentite dalle piattaforme. Si può mantenere tutto il contenuto aggiungendo bordi o applicare un ritaglio centrale.

Le immagini vengono adattate tramite Canvas ed esportate JPG. I video sono riprodotti e registrati localmente in tempo reale tramite Canvas/MediaRecorder, con audio, quando il browser supporta l’esportazione MP4. Limiti dell’elaborazione locale: 50 MB e 60 secondi per clip. Su browser senza supporto MP4 occorre caricare un MP4 già nelle dimensioni corrette. Non è un transcodificatore professionale; verificare qualità e sincronizzazione audio prima di pubblicare. Nessun media viene inviato a un servizio di conversione esterno.

Il comando “Adatta” crea il file effettivo; la sola cornice di anteprima non lo converte. Il modulo impedisce il salvataggio di allegati non pronti. I file pronti sono scaricabili, ordinabili e rimovibili. I controlli SQL verificano piano, numero, proprietario dei percorsi e metadati di dimensione; non decodificano i file binari. L’importazione JSON non ripristina gli allegati e li lascia vuoti.

Verifiche aggiornate: 27 test automatici, incluso isolamento Premium e preset di dimensione. Test di upload tramite automazione Chrome bloccato dall’estensione senza accesso ai file locali: caricamento e conversione multimediale richiedono ancora una prova manuale sui browser/dispositivi di destinazione. Nessun file multimediale personale è stato caricato su Supabase.
