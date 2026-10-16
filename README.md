# Peppe Workshop

Il sito di un elettrauto che lavora a Castorano, nelle Marche, da oltre cinquant'anni.

**Sito online:** https://elettrautogiuseppelelli.pages.dev

## Il progetto

Peppe è un elettrauto vecchio stampo: lavora, risolve problemi e si affida soprattutto al passaparola. Mi sembrava un peccato che non avesse un punto di riferimento online semplice da consultare, così ho deciso di realizzarlo.

Il risultato è un piccolo sito che racconta la storia dell'officina, presenta i servizi e raccoglie le informazioni utili per chi deve mettersi in contatto con lui.

Non è il sito ufficiale dell'attività, ma un progetto informativo indipendente, nato per dare una mano... Soprattutto ai clienti che non hanno informazioni.

## Com'è fatto

Il sito è una piccola esperienza a schermate orizzontali, progettata pensando soprattutto all'utilizzo da smartphone.

Tra le funzionalità:

- Navigazione tra le sezioni con animazioni e controlli dedicati.
- Stato di apertura aggiornato in base agli orari dell'attività.
- Contatti diretti tramite telefono e WhatsApp.
- Mappa e analytics caricati solo dopo il consenso dell'utente.
- Font ospitati direttamente nel progetto, senza richieste a Google Fonts.
- Un'insegna che si illumina virtualmente dopo il tramonto.

## Tecnologie

Niente framework e niente strumenti di compilazione: solo HTML, CSS e JavaScript.

Il progetto è composto da file statici, ospitati su Cloudflare Pages e pubblicati direttamente dal repository GitHub.

## Avviare il sito in locale

Clona il repository:

```bash
git clone https://github.com/matteopompei/peppe-workshop.git
cd peppe-workshop
```

Avvia un server HTTP locale, ad esempio con Python:

```bash
python -m http.server 8000
```

Apri quindi http://localhost:8000 nel browser.

Non servono installazioni di dipendenze né una procedura di build.

## Struttura

```text
.
├── index.html
├── 404.html
├── robots.txt
├── sitemap.xml
├── _headers
├── assets/
│   ├── css/
│   ├── js/
│   ├── fonts/
│   └── img/
├── LICENSE
└── README.md
```

Gli stili sono raccolti in `assets/css/`, la logica JavaScript in `assets/js/` e le immagini, le icone e i font in `assets/`.

## Privacy e accessibilità

Il sito integra Google Analytics e Google Maps, caricati secondo le preferenze espresse dall'utente attraverso il banner dei cookie.

Sono inoltre previste funzionalità di navigazione da tastiera e accorgimenti per l'accessibilità e la gestione delle animazioni.
