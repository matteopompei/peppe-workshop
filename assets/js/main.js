/*
 * Elettrauto Giuseppe Lelli — main.js
 *
 * Logica applicativa del sito. Espone un'unica IIFE (Immediately
 * Invoked Function Expression) che isola tutto dallo scope globale.
 * Nessuna variabile viene esposta su window tranne gtag (necessario
 * per Google Analytics, vedi initCookieConsent).
 *
 * STRUTTURA
 * Il file è organizzato in moduli indipendenti, avviati in
 * sequenza da boot() alla fine del file. Ogni modulo è una
 * funzione init*() che non ritorna nulla, tranne:
 *   - initNavigation() ritorna un oggetto API (trackSlideView)
 *     perché il tracking GA della slide iniziale deve poter
 *     essere invocato dopo il caricamento condizionale di GA.
 *   - initCookieConsent() ritorna un oggetto API (showBanner, ecc.)
 *     perché i modali devono poter richiedere la riapertura del
 *     banner cookie.
 *
 * CONVENZIONI
 * - Nessuna variabile globale: tutto dentro l'IIFE.
 * - Nessun uso di jQuery o librerie: solo vanilla JS (ES2017+).
 * - Eventi assegnati con addEventListener, mai con onclick inline.
 * - Le classi CSS togglate da JS seguono la convenzione:
 *     .is-*     → stato (es. .is-open, .is-lit, .is-visible)
 *     .has-*    → possesso (es. .has-consent su <html>)
 *     .show     → visibilità modale
 *     .hidden   → nascosto
 *     .disabled → non interagibile
 */

(function () {
	"use strict";

	/* ============================================================
	   1. CONFIGURAZIONE
	   Ogni valore che potrebbe essere modificato in futuro è qui.
	   Modificare un valore qui aggiorna il comportamento del sito
	   in modo coerente in tutti i moduli.
	   ============================================================ */

	const CONFIG = {
		// ID proprietà Google Analytics 4. Sostituire per cambiare
		// account. Se lasciato invariato, il tracking punta al
		// profilo esistente.
		gaMeasurementId: "G-ME2G5VJ8BB",

		// Chiave localStorage per il consenso cookie.
		// ATTENZIONE: questo valore è duplicato in index.html
		// nello script inline di FOUC prevention. Se lo cambi qui,
		// aggiornalo anche lì.
		cookieKey: "cookie_consent",

		// Durata del consenso cookie in giorni. Dopo questo periodo
		// il consenso scade e il banner riappare. Duplicato anche
		// in index.html (vedi nota sopra).
		cookieDurationDays: 180,

		// Orari di apertura officina.
		// Chiave = giorno della settimana (0=domenica, 6=sabato).
		// Valore = array di fasce [apertura, chiusura] in minuti
		// dalla mezzanotte (es. 510 = 8:30, 750 = 12:30,
		// 900 = 15:00, 1170 = 19:30).
		//
		// ATTENZIONE: questi valori sono la fonte di verità per il
		// calcolo dello stato "aperto/chiuso". La tabella visibile
		// nell'HTML (#scheduleList) è solo testo: se cambi gli orari
		// qui, aggiornali anche nell'HTML per mantenerli coerenti.
		schedule: {
			0: [], // domenica (nessuna fascia = chiuso)
			1: [
				[510, 750],
				[900, 1170],
			], // lunedì (8:30–12:30, 15:00–19:30)
			2: [
				[510, 750],
				[900, 1170],
			], // martedì
			3: [
				[510, 750],
				[900, 1170],
			], // mercoledì
			4: [
				[510, 750],
				[900, 1170],
			], // giovedì
			5: [
				[510, 750],
				[900, 1170],
			], // venerdì
			6: [[510, 750]], // sabato (solo mattina)
		},

		// Quanti minuti prima della chiusura il badge deve passare
		// allo stato "closing-soon" (CHIUDE alle HH:MM).
		closingSoonMinutes: 30,

		// Nomi dei giorni in italiano, indicizzati come Date.getDay()
		// (0=domenica). Usati per costruire il testo "riapre lunedì".
		dayNames: [
			"domenica",
			"lunedì",
			"martedì",
			"mercoledì",
			"giovedì",
			"venerdì",
			"sabato",
		],

		// Durata di ogni foto nello slideshow decennale, in ms.
		// Su dispositivi con prefers-reduced-motion attivo la durata
		// viene raddoppiata per ridurre lo stress visivo.
		decadeSlideshowDuration: 1500,
	};

	/* ============================================================
	   2. UTILS — funzioni pure condivise tra i moduli
	   ============================================================ */

	/*
	 * Formatter per l'ora di Roma. Viene creato una sola volta
	 * all'avvio perché Intl.DateTimeFormat è costoso da inizializzare.
	 * Restituisce componenti numerici (formatToParts) invece di una
	 * stringa: più affidabile tra browser diversi, non dipende dal
	 * parsing di una data localizzata.
	 */
	const romeFormatter = new Intl.DateTimeFormat("en-GB", {
		timeZone: "Europe/Rome",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	});

	/*
	 * Restituisce un oggetto Date che rappresenta l'ora corrente
	 * a Roma, indipendentemente dal fuso orario del dispositivo.
	 * Il risultato è un Date "locale" ma con i valori di Roma:
	 * viene usato solo per leggere .getHours() / .getDay() / ecc.,
	 * non per confronti temporali assoluti.
	 *
	 * Se il browser non supporta Intl.DateTimeFormat (raro),
	 * fallback all'ora locale del dispositivo: meglio di un crash.
	 */
	function getRomeNow() {
		try {
			const parts = romeFormatter.formatToParts(new Date());
			const o = {};
			for (let i = 0; i < parts.length; i++) {
				if (parts[i].type !== "literal") o[parts[i].type] = parts[i].value;
			}
			return new Date(
				Number(o.year),
				Number(o.month) - 1, // JS: mesi 0-indexed
				Number(o.day),
				Number(o.hour),
				Number(o.minute),
				Number(o.second),
			);
		} catch (e) {
			return new Date();
		}
	}

	/*
	 * Converte un numero di minuti dalla mezzanotte in stringa
	 * "HH:MM" a 2 cifre. Es. 510 → "8:30", 1170 → "19:30".
	 */
	function fmtTime(minutes) {
		const h = Math.floor(minutes / 60);
		const m = minutes % 60;
		return h + ":" + String(m).padStart(2, "0");
	}

	/*
	 * Giorno dell'anno (1-366) a partire da un oggetto Date.
	 * Usato dal modulo insegna per calcolare tramonto/alba in
	 * base al periodo dell'anno.
	 */
	function getDayOfYear(date) {
		const start = new Date(date.getFullYear(), 0, 0);
		return Math.floor((date - start) / 86400000);
	}

	/* ============================================================
	   3. MODULO: NAVIGAZIONE SLIDE
	   Gestisce il carosello orizzontale:
	   - scroll nativo + scroll-snap
	   - frecce prev/next
	   - pallini di navigazione
	   - drag col mouse
	   - deep linking via hash URL (#sezione)
	   - back/forward del browser (popstate)
	   - sincronizzazione tra scroll e dot
	   - live region per screen reader
	   - tracking GA degli eventi slide_view
	   ============================================================ */

	function initNavigation() {
		const deck = document.querySelector(".deck");
		if (!deck) return null;

		const slides = Array.from(deck.querySelectorAll(".slide"));
		const dots = Array.from(document.querySelectorAll(".dot"));
		const prevBtn = document.getElementById("prevBtn");
		const nextBtn = document.getElementById("nextBtn");
		const swipeHint = document.getElementById("swipeHint");
		const liveRegion = document.getElementById("liveRegion");

		// Se mancano gli elementi essenziali, non inizializzare nulla.
		// Il sito non è rotto: le slide restano scrollabili
		// orizzontalmente in modo nativo, ma senza controlli.
		if (!slides.length || !prevBtn || !nextBtn) return null;

		const total = slides.length;

		// I titoli delle slide sono derivati dagli aria-label dei dot.
		// Formato atteso: "Vai alla sezione: <Titolo>".
		// Questo evita di duplicare i titoli in CONFIG e nell'HTML:
		// la fonte di verità resta l'HTML.
		const titles = dots.map((dot) => {
			const label = dot.getAttribute("aria-label") || "";
			return label.replace(/^Vai alla sezione:\s*/, "").trim();
		});

		// Se ci sono più slide che dot (refactor incompleto),
		// riempi i titoli mancanti con un placeholder leggibile.
		while (titles.length < total) {
			titles.push("Sezione " + (titles.length + 1));
		}

		let currentIndex = 0;
		let isProgrammaticScroll = false;
		let programmaticScrollTimer = null;
		let scrollDebounceTimer = null;
		let scrollRafPending = false;

		// Larghezza di una slide: coincide con la larghezza del deck
		// perché ogni slide è flex: 0 0 100%. Il fallback "|| 1"
		// evita divisioni per zero al primo avvio, quando clientWidth
		// può essere 0 se il CSS non è ancora applicato.
		const getSlideWidth = () => deck.clientWidth || 1;

		/*
		 * Aggiornamento LEGGERO: aggiorna solo la classe .active
		 * dei dot e la loro tabindex. Viene chiamato ad ogni frame
		 * durante lo scroll manuale. Non tocca il DOM pesante.
		 */
		function updateDots() {
			dots.forEach((dot, i) => {
				const isActive = i === currentIndex;
				dot.classList.toggle("active", isActive);
				// Solo il dot attivo è tabbabile. Gli altri sono
				// raggiungibili con le frecce (vedi keydown sotto).
				dot.tabIndex = isActive ? 0 : -1;
				if (isActive) dot.setAttribute("aria-current", "true");
				else dot.removeAttribute("aria-current");
			});
		}

		/*
		 * Aggiornamento PESANTE: aggiorna dot, frecce prev/next,
		 * attributi inert/aria-hidden sulle slide, live region
		 * per screen reader. Viene chiamato solo quando lo scroll
		 * si è fermato (o dopo un cambio slide programmatico).
		 */
		function updateUI() {
			updateDots();

			const atStart = currentIndex === 0;
			const atEnd = currentIndex === total - 1;

			prevBtn.classList.toggle("disabled", atStart);
			prevBtn.setAttribute("aria-disabled", atStart ? "true" : "false");
			prevBtn.disabled = atStart;

			nextBtn.classList.toggle("disabled", atEnd);
			nextBtn.setAttribute("aria-disabled", atEnd ? "true" : "false");
			nextBtn.disabled = atEnd;

			// Le slide non attive vengono marcate inert:
			// non ricevono focus, non sono cliccabili, non sono
			// lette dagli screen reader. aria-hidden è ridondante
			// con inert ma serve ai browser più vecchi che non
			// supportano inert.
			slides.forEach((slide, i) => {
				const isActive = i === currentIndex;
				if (isActive) {
					slide.removeAttribute("inert");
					slide.setAttribute("aria-hidden", "false");
				} else {
					slide.setAttribute("inert", "");
					slide.setAttribute("aria-hidden", "true");
				}
			});

			// Annuncio screen reader del cambio slide.
			if (liveRegion) {
				liveRegion.textContent =
					"Slide " +
					(currentIndex + 1) +
					" di " +
					total +
					": " +
					titles[currentIndex];
			}

			// L'hint di swipe viene nascosto dopo il primo cambio slide.
			if (currentIndex > 0 && swipeHint) {
				swipeHint.classList.add("hidden");
			}
		}

		function releaseProgrammaticScroll() {
			isProgrammaticScroll = false;
			clearTimeout(programmaticScrollTimer);
			programmaticScrollTimer = null;
		}

		/*
		 * Traccia l'evento slide_view in GA se disponibile.
		 * Definito dentro initNavigation perché deve accedere
		 * a slides/titles/total. Esposto nell'API di ritorno
		 * per essere invocato anche da initCookieConsent quando
		 * GA diventa disponibile dopo il consenso.
		 */
		function trackSlideView(index) {
			if (typeof window.gtag !== "function") return;
			if (index < 0 || index >= total) return;
			window.gtag("event", "slide_view", {
				slide_id: slides[index].id,
				slide_index: index + 1,
				slide_title: titles[index],
			});
		}

		/*
		 * Naviga alla slide target. Se options.push è false,
		 * sostituisce l'entry corrente della history invece di
		 * aggiungerne una nuova (usato per popstate e deep linking).
		 */
		function goTo(index, options) {
			const opts = options || {};
			const push = opts.push !== false;

			if (index < 0 || index >= total) return;
			// Se siamo già sulla slide target e non c'è uno scroll
			// programmatico in corso, evita un loop di chiamate.
			if (index === currentIndex && !isProgrammaticScroll) return;

			trackSlideView(index);

			currentIndex = index;
			isProgrammaticScroll = true;
			updateUI();

			const slideId = slides[index].id;
			if (push) {
				// pushState aggiunge sempre una nuova entry:
				// anche se l'hash è identico va aggiunta (comportamento
				// del tasto back).
				history.pushState({ slide: index }, "", "#" + slideId);
			} else if (location.hash !== "#" + slideId) {
				// replaceState solo se l'hash è cambiato davvero.
				// Evita chiamate no-op quando popstate ha già
				// aggiornato l'URL prima di chiamare goTo.
				history.replaceState({ slide: index }, "", "#" + slideId);
			}

			// Fallback di sicurezza: se l'arrivo non viene rilevato
			// dallo scroll handler (browser che interrompe l'animazione,
			// evento perso, tab in background), rilascia il flag dopo
			// un tempo generoso. Il meccanismo primario resta il check
			// "Math.abs(rawRatio - currentIndex) < 0.02" nello scroll
			// handler. 1800ms copre i casi peggiori (Safari iOS,
			// dispositivi lenti) senza mai entrare in gioco nei casi
			// normali.
			clearTimeout(programmaticScrollTimer);
			programmaticScrollTimer = setTimeout(releaseProgrammaticScroll, 1800);

			deck.scrollTo({ left: index * getSlideWidth(), behavior: "smooth" });
		}

		/*
		 * Converte location.hash in un indice di slide.
		 * Restituisce 0 se l'hash è vuoto o non corrisponde
		 * a nessuna slide esistente.
		 */
		function indexFromHash() {
			const hash = location.hash.slice(1);
			if (!hash) return 0;
			const target = document.getElementById(hash);
			if (!target) return 0;
			const idx = slides.indexOf(target);
			return idx >= 0 ? idx : 0;
		}

		/* --- Eventi: elementi con data-goto ---
		   Qualsiasi elemento con attributo data-goto="#sezione"
		   o data-goto="N" naviga alla slide corrispondente. */
		document.querySelectorAll("[data-goto]").forEach((el) => {
			el.addEventListener("click", (e) => {
				e.preventDefault();
				const raw = el.getAttribute("data-goto");
				let index = -1;

				if (raw.startsWith("#")) {
					const target = document.querySelector(raw);
					if (target) index = slides.indexOf(target);
				} else {
					index = parseInt(raw, 10);
				}

				if (index >= 0 && index < total) goTo(index);
			});
		});

		/* --- Eventi: dot ---
		   Click: naviga. Tastiera: frecce per spostarsi tra i dot,
		   Home/End per primo/ultimo. Il comportamento è quello
		   standard di un "tablist" WAI-ARIA. */
		dots.forEach((dot, i) => {
			dot.addEventListener("click", () => goTo(i));

			dot.addEventListener("keydown", (e) => {
				let target = null;
				if (e.key === "ArrowRight" || e.key === "ArrowDown") {
					target = (i + 1) % dots.length;
				} else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
					target = (i - 1 + dots.length) % dots.length;
				} else if (e.key === "Home") {
					target = 0;
				} else if (e.key === "End") {
					target = dots.length - 1;
				}
				if (target === null) return;
				e.preventDefault();
				e.stopPropagation();
				goTo(target);
				dots[target].focus();
			});
		});

		/* --- Eventi: frecce prev/next --- */
		prevBtn.addEventListener("click", () => goTo(currentIndex - 1));
		nextBtn.addEventListener("click", () => goTo(currentIndex + 1));

		/* --- Eventi: tastiera globale ---
		   Le frecce sinistra/destra cambiano slide SOLO quando il
		   focus è "neutro" (body, titoli, paragrafi). Se il focus è
		   su un elemento interattivo (link, bottone, role=button),
		   le frecce restano al browser: l'utente potrebbe voler
		   navigare dentro un controllo o scorrere il testo. */
		document.addEventListener("keydown", (e) => {
			// I dot hanno la loro gestione dedicata (vedi sopra)
			if (e.target.closest && e.target.closest(".dots")) return;

			// Non interferire con elementi interattivi
			if (
				e.target.closest &&
				e.target.closest(
					'a, button, input, textarea, select, [contenteditable], [role="button"]',
				)
			) {
				return;
			}

			// Non cambiare slide se un modale è aperto
			const policyOpen = document
				.getElementById("policyModal")
				?.classList.contains("show");
			const reviewOpen = document
				.getElementById("reviewModal")
				?.classList.contains("show");
			if (policyOpen || reviewOpen) return;

			if (e.key === "ArrowLeft") goTo(currentIndex - 1);
			if (e.key === "ArrowRight") goTo(currentIndex + 1);
		});

		/* --- Interruzione utente dello scroll programmatico ---
		   Se l'utente tocca lo schermo o usa la rotella mentre
		   un goTo è in corso, consideriamo lo scroll programmatico
		   interrotto: il flag viene rilasciato così lo scroll
		   handler torna a comportarsi come scroll manuale. */
		function cancelOnUserInput() {
			if (isProgrammaticScroll) releaseProgrammaticScroll();
		}
		deck.addEventListener("touchstart", cancelOnUserInput, { passive: true });
		deck.addEventListener("wheel", cancelOnUserInput, { passive: true });

		/* --- Eventi: scroll ---
		   Throttle con requestAnimationFrame (max 1 update per frame).

		   Durante scroll programmatico: rilascia il flag solo quando
		   siamo arrivati vicini alla slide di destinazione.

		   Durante scroll manuale: aggiorna i dot con isteresi
		   (per evitare flip-flop dell'indice attorno al punto medio),
		   poi al termine dello scroll chiama updateUI() completo e
		   sincronizza l'hash URL. */
		deck.addEventListener(
			"scroll",
			() => {
				if (scrollRafPending) return;
				scrollRafPending = true;

				requestAnimationFrame(() => {
					scrollRafPending = false;

					const rawRatio = deck.scrollLeft / getSlideWidth();

					if (isProgrammaticScroll) {
						if (Math.abs(rawRatio - currentIndex) < 0.02) {
							releaseProgrammaticScroll();
						}
						return;
					}

					// Isteresi: aggiorna currentIndex solo se lo scroll
					// ha superato una soglia oltre il punto medio.
					const delta = rawRatio - currentIndex;
					let newIndex = currentIndex;
					if (delta > 0.55) {
						newIndex = Math.floor(rawRatio + 0.45);
					} else if (delta < -0.55) {
						newIndex = Math.ceil(rawRatio - 0.45);
					}

					if (newIndex !== currentIndex && newIndex >= 0 && newIndex < total) {
						currentIndex = newIndex;
						updateDots();
					}

					// UpdateUI pesante a scroll fermo (debounce 120ms).
					clearTimeout(scrollDebounceTimer);
					scrollDebounceTimer = setTimeout(() => {
						if (isProgrammaticScroll) return;

						const settledIndex = Math.round(deck.scrollLeft / getSlideWidth());
						if (
							settledIndex >= 0 &&
							settledIndex < total &&
							settledIndex !== currentIndex
						) {
							currentIndex = settledIndex;
						}

						updateUI();

						// Sincronizza l'hash con la slide a cui lo scroll
						// si è agganciato. replaceState evita di riempire
						// la history ad ogni micro-scroll.
						const slideId = slides[currentIndex].id;
						if (location.hash !== "#" + slideId) {
							history.replaceState({ slide: currentIndex }, "", "#" + slideId);
						}
					}, 120);
				});
			},
			{ passive: true },
		);

		/* --- Drag col mouse ---
		   Il drag parte SOLO dove il cursore CSS è "grab", cioè
		   nelle aree non testuali. Sul testo selezionabile il
		   cursore è "text" (vedi CSS), quindi il mousedown non
		   innesca il drag e l'utente può selezionare normalmente.
		   Questo rende il cursore la fonte di verità: quello che
		   l'utente vede è quello che ottiene. */
		let isDragging = false;
		let wasDragged = false;
		let dragStartX = 0;
		let dragStartScrollLeft = 0;

		deck.addEventListener("mousedown", (e) => {
			if (e.button !== 0) return;

			if (window.getComputedStyle(e.target).cursor !== "grab") return;

			if (isProgrammaticScroll) releaseProgrammaticScroll();
			isDragging = true;
			wasDragged = false;
			dragStartX = e.pageX;
			dragStartScrollLeft = deck.scrollLeft;
		});

		deck.addEventListener("mousemove", (e) => {
			if (!isDragging) return;
			const dx = e.pageX - dragStartX;
			// Soglia di 5px per distinguere drag da click.
			if (Math.abs(dx) > 5) {
				wasDragged = true;
				deck.classList.add("dragging");
				e.preventDefault();
				deck.scrollLeft = dragStartScrollLeft - dx;
			}
		});

		["mouseup", "mouseleave"].forEach((evt) => {
			deck.addEventListener(evt, () => {
				if (!isDragging) return;
				isDragging = false;
				deck.classList.remove("dragging");
				if (wasDragged) {
					// Attende la fine dello snap CSS prima di
					// aggiornare l'indice e la history.
					setTimeout(() => {
						const newIndex = Math.round(deck.scrollLeft / getSlideWidth());
						if (
							newIndex >= 0 &&
							newIndex < total &&
							newIndex !== currentIndex
						) {
							currentIndex = newIndex;
							updateUI();
							const slideId = slides[currentIndex].id;
							if (location.hash !== "#" + slideId) {
								history.replaceState(
									{ slide: currentIndex },
									"",
									"#" + slideId,
								);
							}
						}
					}, 200);
				}
			});
		});

		// Blocca i click "fantasma" dopo un drag: in capture,
		// prima che i click raggiungano i figli interattivi.
		deck.addEventListener(
			"click",
			(e) => {
				if (wasDragged) {
					e.preventDefault();
					e.stopPropagation();
					wasDragged = false;
				}
			},
			true,
		);

		deck.addEventListener("dragstart", (e) => e.preventDefault());

		/* --- Deep linking: hash all'avvio ---
		   Se l'URL contiene un hash (#servizi), apri direttamente
		   quella slide. push: false perché l'entry è già nella
		   history del browser. */
		const initialIndex = indexFromHash();
		updateUI();
		if (initialIndex > 0) {
			goTo(initialIndex, { push: false });
		}

		/* --- Back/forward del browser --- */
		window.addEventListener("popstate", () => {
			const idx = indexFromHash();
			if (idx !== currentIndex) goTo(idx, { push: false });
		});

		// Espone l'API per initCookieConsent: serve a inviare
		// l'evento slide_view iniziale quando GA diventa pronto.
		return {
			trackSlideView: trackSlideView,
			getCurrentIndex: function () {
				return currentIndex;
			},
		};
	}

	/* ============================================================
	   4. MODULO: SLIDESHOW DECENNI
	   Cicla automaticamente le foto storiche dell'officina
	   ogni CONFIG.decadeSlideshowDuration ms. Aggiorna anche il
	   badge sovrapposto con l'anno (attributo data-decade di
	   ogni img).

	   Compatibilità screen reader: solo l'immagine visibile ha
	   aria-hidden="false"; le altre sono nascoste all'AT anche
	   se presenti nel DOM (servono per la transizione CSS).
	   ============================================================ */

	function initDecadeSlideshow() {
		const container = document.querySelector(".office-slideshow");
		if (!container) return;

		const photos = Array.from(
			container.querySelectorAll(".slideshow-track img"),
		);
		const decadeValue = container.querySelector(".decade-value");
		if (!photos.length) return;

		const reducedMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;

		// Con reduced-motion attivo: durata doppia per ridurre
		// la frequenza dei cambi visivi.
		const DURATION = reducedMotion
			? CONFIG.decadeSlideshowDuration * 2
			: CONFIG.decadeSlideshowDuration;
		let idx = 0;

		function show(index) {
			photos.forEach((p, i) => {
				const isVisible = i === index;
				p.classList.toggle("is-visible", isVisible);
				p.setAttribute("aria-hidden", isVisible ? "false" : "true");
			});
			if (decadeValue) {
				decadeValue.textContent = photos[index].dataset.decade || "";
			}
		}

		function loop() {
			idx = (idx + 1) % photos.length;
			show(idx);
			setTimeout(loop, DURATION);
		}

		show(0);
		setTimeout(loop, DURATION);
	}

	/* ============================================================
	   5. MODULO: COOKIE CONSENT + MAPPA
	   Gestisce:
	   - lettura/scrittura del consenso in localStorage
	   - caricamento condizionale di Google Analytics
	   - blocco/sblocco dell'iframe Google Maps
	   - banner di richiesta consenso

	   Riceve come parametro l'API di initNavigation per poter
	   tracciare la slide_view iniziale quando GA diventa pronto.

	   Espone un'API pubblica usata da initModals:
	   - showBanner(): riapre il banner (chiamata da "Modifica
	     preferenze cookie")
	   ============================================================ */

	function initCookieConsent(navApi) {
		const banner = document.getElementById("cookieBanner");
		const iframe = document.querySelector(".map-wrap iframe");
		const mapOverlay = document.getElementById("mapOverlay");
		const activateMapBtn = document.getElementById("activateMap");
		const activateMapLabel = document.getElementById("activateMapLabel");

		const api = {
			getConsent: getConsent,
			setConsent: setConsent,
			showBanner: showBanner,
			updateMap: updateMap,
		};

		/*
		 * Legge il consenso da localStorage. Restituisce null
		 * se non presente o scaduto (oltre cookieDurationDays).
		 * Il try/catch protegge da localStorage disabilitato
		 * (private mode in alcuni browser).
		 */
		function getConsent() {
			try {
				const raw = localStorage.getItem(CONFIG.cookieKey);
				if (!raw) return null;
				const data = JSON.parse(raw);
				if (
					data.ts &&
					Date.now() - data.ts > CONFIG.cookieDurationDays * 24 * 3600 * 1000
				) {
					localStorage.removeItem(CONFIG.cookieKey);
					return null;
				}
				return data;
			} catch (e) {
				return null;
			}
		}

		function setConsent(analytics) {
			localStorage.setItem(
				CONFIG.cookieKey,
				JSON.stringify({ analytics: analytics, ts: Date.now() }),
			);
		}

		/*
		 * Carica Google Analytics 4 in modo conforme al GDPR:
		 * 1. Inizializza dataLayer/gtag
		 * 2. Consenso default DENIED (GA non traccia)
		 * 3. Inserisce lo script di GA
		 * 4. Configura la proprietà
		 * 5. Aggiorna il consenso a GRANTED
		 * 6. Traccia la slide_view iniziale
		 *
		 * Il check su #ga-script evita doppi caricamenti.
		 */
		function loadGoogleAnalytics() {
			if (document.getElementById("ga-script")) return;

			window.dataLayer = window.dataLayer || [];
			function gtag() {
				dataLayer.push(arguments);
			}
			window.gtag = gtag;

			gtag("consent", "default", {
				analytics_storage: "denied",
				ad_storage: "denied",
				ad_user_data: "denied",
				ad_personalization: "denied",
				wait_for_update: 500,
			});

			const script = document.createElement("script");
			script.id = "ga-script";
			script.async = true;
			script.src =
				"https://www.googletagmanager.com/gtag/js?id=" + CONFIG.gaMeasurementId;
			document.head.appendChild(script);

			gtag("js", new Date());

			// Il flag "Secure" impone cookie solo via HTTPS.
			// In sviluppo (http://127.0.0.1) rompe il tracciamento GA
			// in silenzio. Lo attiviamo solo quando il protocollo
			// è davvero HTTPS.
			const isHttps = location.protocol === "https:";
			gtag("config", CONFIG.gaMeasurementId, {
				cookie_flags: isHttps ? "SameSite=Lax;Secure" : "SameSite=Lax",
			});

			gtag("consent", "update", {
				analytics_storage: "granted",
			});

			// Ora GA è pronto: traccia la slide corrente.
			// Copre due casi: utente con consenso pregresso che
			// atterra direttamente su una slide, e utente che
			// clicca "Accetta" mentre è su una slide qualsiasi.
			if (navApi) {
				navApi.trackSlideView(navApi.getCurrentIndex());
			}
		}

		/*
		 * Scarica GA e cancella i cookie _ga. Chiamato quando
		 * l'utente revoca il consenso. Cancella anche i cookie
		 * con domain=location.hostname per coprire il caso in cui
		 * GA li abbia impostati a livello di dominio.
		 */
		function unloadGoogleAnalytics() {
			const s = document.getElementById("ga-script");
			if (s) s.remove();
			const names = [
				"_ga",
				"_gid",
				"_ga_" + CONFIG.gaMeasurementId.replace("G-", ""),
			];
			names.forEach((name) => {
				document.cookie = name + "=; Max-Age=0; path=/;";
				document.cookie =
					name + "=; Max-Age=0; path=/; domain=" + location.hostname + ";";
			});
		}

		/*
		 * Blocca o sblocca la mappa in base al consenso.
		 * Senza consenso: rimuove src dall'iframe (nessuna
		 * richiesta a Google), mostra l'overlay con il CTA.
		 * Con consenso: copia data-src in src, nasconde l'overlay.
		 */
		function updateMap(analytics) {
			if (!iframe || !mapOverlay) return;

			if (analytics) {
				if (iframe.dataset.src && !iframe.src) {
					iframe.src = iframe.dataset.src;
				}
				mapOverlay.classList.add("hidden");
				if (activateMapLabel) {
					activateMapLabel.textContent = "Tocca per attivare la mappa";
				}
				if (activateMapBtn) {
					activateMapBtn.setAttribute(
						"aria-label",
						"Attiva la mappa interattiva",
					);
				}
			} else {
				if (iframe.src) iframe.removeAttribute("src");
				mapOverlay.classList.remove("hidden");
				if (activateMapLabel) {
					activateMapLabel.textContent = "Accetta i cookie per vedere la mappa";
				}
				if (activateMapBtn) {
					activateMapBtn.setAttribute(
						"aria-label",
						"Accetta i cookie per vedere la mappa",
					);
				}
			}
		}

		/*
		 * Applica il consenso: carica/scarica GA, blocca/sblocca
		 * la mappa, nasconde il banner. Aggiunge la classe
		 * .cookie-chosen su <html> per nascondere il banner
		 * anche via CSS (utile in combinazione con lo script di
		 * FOUC prevention in index.html).
		 */
		function applyConsent(analytics) {
			if (analytics) loadGoogleAnalytics();
			else unloadGoogleAnalytics();
			updateMap(analytics);
			document.documentElement.classList.add("cookie-chosen");
		}

		/*
		 * Riapre il banner cookie: rimuove la classe .cookie-chosen
		 * e dà focus al bottone "Rifiuta" per accessibilità.
		 * Non revoca il consenso: lo fa l'utente scegliendo
		 * esplicitamente "Accetta" o "Rifiuta" nel banner.
		 */
		function showBanner() {
			document.documentElement.classList.remove("cookie-chosen");
			const rejectBtn = document.getElementById("rejectCookies");
			if (rejectBtn) rejectBtn.focus();
		}

		/* --- Stato iniziale ---
		   Applica il consenso pregresso se esiste, altrimenti
		   blocca la mappa in attesa della scelta dell'utente. */
		const existing = getConsent();
		if (existing) {
			applyConsent(existing.analytics);
		} else {
			updateMap(false);
		}

		/* --- Eventi: bottoni cookie --- */
		document.getElementById("acceptCookies")?.addEventListener("click", () => {
			setConsent(true);
			applyConsent(true);
		});

		document.getElementById("rejectCookies")?.addEventListener("click", () => {
			setConsent(false);
			applyConsent(false);
		});

		/* --- Eventi: bottone "attiva mappa" ---
		   Se l'utente ha già acconsentito ma la mappa è bloccata
		   per qualche motivo, sbloccala. Altrimenti mostra il
		   banner per chiedere il consenso. */
		if (activateMapBtn) {
			activateMapBtn.addEventListener("click", () => {
				const consent = getConsent();
				if (consent && consent.analytics) {
					updateMap(true);
				} else {
					showBanner();
				}
			});
		}

		return api;
	}

	/* ============================================================
	   6. MODULO: MODALI (policy + recensione)
	   Gestisce apertura/chiusura dei due modali, il focus trap
	   (Tab resta dentro il modale), la restituzione del focus
	   all'elemento di partenza, e la chiusura con Escape o
	   click sul backdrop.

	   Riceve l'API di initCookieConsent per gestire il pulsante
	   "Modifica preferenze cookie" che riapre il banner.
	   ============================================================ */

	function initModals(cookieApi) {
		const appEl = document.querySelector(".app");
		const policyModal = document.getElementById("policyModal");
		const policyClose = document.getElementById("policyClose");
		const openPrivacyLink = document.getElementById("openPrivacyLink");
		const reopenCookieSettings = document.getElementById(
			"reopenCookieSettings",
		);
		const policyLinkFromBanner = document.getElementById(
			"openPolicyFromBanner",
		);

		const reviewModal = document.getElementById("reviewModal");
		const ratingTrigger = document.getElementById("ratingTrigger");
		const reviewDismiss = document.getElementById("reviewDismiss");

		let lastFocused = null;

		// Elementi che possono ricevere focus in un modale.
		// Esclude tabindex="-1" (focus programmatico) e controlli
		// disabilitati.
		const FOCUSABLE_SELECTOR = [
			"a[href]",
			"button:not([disabled])",
			"input:not([disabled])",
			"textarea:not([disabled])",
			"select:not([disabled])",
			'[tabindex]:not([tabindex="-1"])',
		].join(",");

		/*
		 * Filtra i focusabili per escludere quelli non visibili.
		 * Necessario perché elementi nascosti via CSS (display:none,
		 * visibility:hidden) sono comunque nel DOM e matchano
		 * il selettore, ma non devono ricevere focus.
		 */
		function getFocusableElements(container) {
			const all = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR));
			return all.filter((el) => {
				if (el.hasAttribute("hidden")) return false;
				const style = window.getComputedStyle(el);
				if (style.display === "none" || style.visibility === "hidden") {
					return false;
				}
				return true;
			});
		}

		/*
		 * Focus trap: intercetta Tab e Shift+Tab quando il focus
		 * è agli estremi del modale, riportandolo all'altro estremo.
		 * Se il focus è fuori dal modale (edge case: click su
		 * DevTools, extension), lo riporta dentro.
		 */
		function trapFocus(modal, e) {
			if (e.key !== "Tab") return;

			const focusable = getFocusableElements(modal);
			if (focusable.length === 0) {
				e.preventDefault();
				return;
			}

			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			const active = document.activeElement;

			if (e.shiftKey && active === first) {
				e.preventDefault();
				last.focus();
				return;
			}

			if (!e.shiftKey && active === last) {
				e.preventDefault();
				first.focus();
				return;
			}

			if (!modal.contains(active)) {
				e.preventDefault();
				first.focus();
			}
		}

		/*
		 * Apre il modale: salva il focus corrente, mostra il
		 * modale, rende inert l'app sottostante, sposta il focus
		 * sul primo elemento del modale.
		 * setTimeout 50ms: la transizione CSS di apertura deve
		 * completarsi prima che gli elementi diventino visibili
		 * e focusabili (getFocusableElements controlla visibility).
		 */
		function openModal(modal) {
			if (!modal) return;
			lastFocused = document.activeElement;
			modal.classList.add("show");
			if (appEl) appEl.setAttribute("inert", "");

			setTimeout(() => {
				const focusable = getFocusableElements(modal);
				if (focusable.length > 0) focusable[0].focus();
			}, 50);
		}

		function closeModal(modal) {
			if (!modal) return;
			modal.classList.remove("show");
			if (appEl) appEl.removeAttribute("inert");
			if (lastFocused && typeof lastFocused.focus === "function") {
				lastFocused.focus();
			}
		}

		/* --- Focus trap sui due modali --- */
		policyModal?.addEventListener("keydown", (e) => trapFocus(policyModal, e));
		reviewModal?.addEventListener("keydown", (e) => trapFocus(reviewModal, e));

		function openPolicy() {
			openModal(policyModal);
		}
		function closePolicy() {
			closeModal(policyModal);
		}
		function openReview() {
			openModal(reviewModal);
		}
		function closeReview() {
			closeModal(reviewModal);
		}

		/* --- Eventi: policy --- */
		policyLinkFromBanner?.addEventListener("click", (e) => {
			e.preventDefault();
			openPolicy();
		});

		openPrivacyLink?.addEventListener("click", (e) => {
			e.preventDefault();
			openPolicy();
		});

		policyClose?.addEventListener("click", closePolicy);

		// Click sul backdrop (fuori dal box) chiude il modale.
		policyModal?.addEventListener("click", (e) => {
			if (e.target === policyModal) closePolicy();
		});

		/* --- Eventi: recensione --- */
		if (ratingTrigger) {
			ratingTrigger.addEventListener("click", openReview);
			// role="button" richiede anche Enter e Spazio.
			ratingTrigger.addEventListener("keydown", (e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					openReview();
				}
			});
		}

		reviewDismiss?.addEventListener("click", closeReview);

		reviewModal?.addEventListener("click", (e) => {
			if (e.target === reviewModal) closeReview();
		});

		/* --- Escape chiude il modale aperto --- */
		document.addEventListener("keydown", (e) => {
			if (e.key !== "Escape") return;
			if (policyModal?.classList.contains("show")) closePolicy();
			if (reviewModal?.classList.contains("show")) closeReview();
		});

		/* --- Modifica preferenze cookie ---
		   Chiude la policy e riapre il banner cookie.
		   Non revoca automaticamente il consenso: è l'utente
		   che sceglie esplicitamente nel banner se accettare
		   o rifiutare. Il tracking continua nel frattempo
		   (l'utente non ha ancora comunicato la revoca). */
		reopenCookieSettings?.addEventListener("click", (e) => {
			e.preventDefault();
			closePolicy();
			if (cookieApi) cookieApi.showBanner();
		});
	}

	/* ============================================================
	   7. MODULO: STATO APERTURA OFFICINA
	   Calcola lo stato (aperto/chiuso/in chiusura/pausa pranzo)
	   in base all'ora di Roma e a CONFIG.schedule. Aggiorna:
	   - il dot nell'hero (#locationDot)
	   - il title di #heroLocation (tooltip al mouse)
	   - #heroStatusText (testo per screen reader)
	   - il badge #openStatusBadge nella slide contatti
	   - evidenzia la riga del giorno corrente nella tabella orari
	   ============================================================ */

	function initOpeningStatus() {
		const heroLocation = document.getElementById("heroLocation");
		const heroStatusText = document.getElementById("heroStatusText");
		const openStatusBadge = document.getElementById("openStatusBadge");
		const openStatusText = document.getElementById("openStatusText");

		/*
		 * Logica di calcolo dello stato. Restituisce un oggetto
		 * { state, short, full }:
		 * - state: chiave usata come suffisso della classe CSS .is-*
		 * - short: testo compatto per il badge
		 * - full: testo esteso per il title e lo screen reader
		 */
		function getOpenStatus() {
			const now = getRomeNow();
			const day = now.getDay();
			const minutes = now.getHours() * 60 + now.getMinutes();
			const todayRanges = CONFIG.schedule[day] || [];

			// Caso 1: aperto adesso (dentro una fascia).
			for (let i = 0; i < todayRanges.length; i++) {
				const open = todayRanges[i][0];
				const close = todayRanges[i][1];
				if (minutes >= open && minutes < close) {
					const remaining = close - minutes;
					if (remaining <= CONFIG.closingSoonMinutes) {
						return {
							state: "closing-soon",
							short: "CHIUDE " + fmtTime(close),
							full: "Aperto · chiude alle " + fmtTime(close),
						};
					}
					return { state: "open", short: "APERTO", full: "Aperto ora" };
				}
			}

			// Caso 2: chiuso, ma c'è un'altra fascia oggi.
			// Se la fascia è la seconda (i > 0), siamo in pausa pranzo.
			for (let i = 0; i < todayRanges.length; i++) {
				const open = todayRanges[i][0];
				if (open > minutes) {
					const isLunchBreak = i > 0;
					return {
						state: isLunchBreak ? "lunch-break" : "closed",
						short: "RIAPRE " + fmtTime(open),
						full: "Chiuso · riapre alle " + fmtTime(open),
					};
				}
			}

			// Caso 3: chiuso, cerca la prossima apertura nei
			// giorni successivi (max 7 giorni avanti).
			for (let i = 1; i <= 7; i++) {
				const nextDay = (day + i) % 7;
				const nextRanges = CONFIG.schedule[nextDay] || [];
				if (nextRanges.length > 0) {
					const open = nextRanges[0][0];
					const dayLabel = i === 1 ? "domani" : CONFIG.dayNames[nextDay];
					return {
						state: "closed",
						short: "RIAPRE " + dayLabel.toUpperCase(),
						full: "Chiuso · riapre " + dayLabel + " alle " + fmtTime(open),
					};
				}
			}

			return { state: "closed", short: "CHIUSO", full: "Chiuso" };
		}

		/*
		 * Applica lo stato calcolato a tutti gli elementi che lo
		 * mostrano: dot colorato, title tooltip, testo screen
		 * reader, badge con classi .is-*.
		 */
		function updateStatus() {
			const status = getOpenStatus();

			if (heroLocation) {
				heroLocation.setAttribute(
					"title",
					"Bivio Offida, Via Salaria, Castorano. " + status.full + ".",
				);
			}

			if (heroStatusText) {
				heroStatusText.textContent = status.full;
			}

			if (openStatusBadge && openStatusText) {
				openStatusBadge.classList.remove(
					"is-open",
					"is-closing-soon",
					"is-lunch-break",
					"is-closed",
				);
				openStatusBadge.classList.add("is-" + status.state);
				openStatusText.textContent = status.short;
				openStatusBadge.setAttribute("aria-label", status.full);
			}
		}

		/*
		 * Evidenzia la riga del giorno corrente nella tabella
		 * orari. Il giorno è letto dall'attributo data-days di
		 * ogni <li> (es. data-days="1,2,3,4,5" per lun-ven).
		 * Aggiunge la classe .is-today e un tag "oggi".
		 */
		function highlightToday() {
			const today = getRomeNow().getDay();
			const list = document.getElementById("scheduleList");
			if (!list) return;

			// Pulisci lo stato precedente.
			list.querySelectorAll("li").forEach((li) => {
				li.classList.remove("is-today");
				const tag = li.querySelector(".today-tag");
				if (tag) tag.remove();
			});

			// Trova la riga il cui data-days contiene il giorno corrente.
			const target = Array.from(list.querySelectorAll("li")).find((li) => {
				const days = (li.dataset.days || "").split(",").map(Number);
				return days.indexOf(today) !== -1;
			});
			if (!target) return;

			target.classList.add("is-today");

			const dayEl = target.querySelector(".day");
			if (dayEl && !dayEl.querySelector(".today-tag")) {
				const tag = document.createElement("span");
				tag.className = "today-tag";
				tag.textContent = "oggi";
				dayEl.appendChild(tag);
			}
		}

		function updateAll() {
			updateStatus();
			highlightToday();
		}

		// Aggiorna subito e poi ogni minuto. 60s è sufficiente
		// perché lo stato cambia solo ai minuti di apertura/chiusura.
		updateAll();
		setInterval(updateAll, 60000);
	}

	/* ============================================================
	   8. MODULO: INSEGNA
	   Accende l'insegna dell'officina (header) di notte.
	   La finestra di buio è calcolata con un'approssimazione
	   sinusoidale tarata sull'Italia centrale, sufficiente per
	   lo scopo: non è un calendario astronomico preciso, ma
	   copre l'errore di ±30 minuti.
	   ============================================================ */

	function initSignage() {
		const appHeader = document.getElementById("appHeader");
		if (!appHeader) return;

		/*
		 * Calcola la finestra di buio per il giorno dell'anno
		 * specificato. Restituisce due orari decimali (es. 18.5
		 * = 18:30):
		 * - darkStart: quando inizia il buio (dopo il tramonto)
		 * - darkEnd: quando finisce il buio (prima dell'alba)
		 * Il coseno introduce l'oscillazione stagionale.
		 */
		function getDarknessWindow(dayOfYear) {
			const phase = ((dayOfYear - 172) * 2 * Math.PI) / 365;
			const darkStart = 18.85 + 2.15 * Math.cos(phase) + 0.5;
			const darkEnd = 6.5 - 1.0 * Math.cos(phase) - 0.5;
			return { darkStart: darkStart, darkEnd: darkEnd };
		}

		function isDark() {
			const now = getRomeNow();
			const nowHours = now.getHours() + now.getMinutes() / 60;
			const w = getDarknessWindow(getDayOfYear(now));
			return nowHours < w.darkEnd || nowHours >= w.darkStart;
		}

		function updateSignage() {
			if (isDark()) appHeader.classList.add("is-lit");
			else appHeader.classList.remove("is-lit");
		}

		// Pausa l'animazione del neon quando la tab va in background.
		// I browser lo fanno già in modo non uniforme; pausare
		// esplicitamente garantisce risparmio anche su Chrome, dove
		// le animazioni su filter a volte continuano.
		document.addEventListener("visibilitychange", () => {
			appHeader.classList.toggle("is-paused", document.hidden);
		});

		updateSignage();
		setInterval(updateSignage, 60000);
	}

	/* ============================================================
	   9. MODULO: HOT ZONE NAV
	   Su desktop con mouse/trackpad, la bottom nav è nascosta
	   di default e appare quando il cursore si avvicina al fondo
	   dello schermo. Mostra la nav per INTRO_DURATION ms
	   all'avvio, così l'utente la scopre anche se non muove
	   subito il mouse.

	   Su dispositivi touch (o schermi stretti) il modulo esce
	   subito e la nav resta sempre visibile: lo swipe non ha
	   senso con mouse, e su mobile la nav serve sempre.
	   ============================================================ */

	function initNavHotZone() {
		if (
			!window.matchMedia(
				"(min-width: 541px) and (hover: hover) and (pointer: fine)",
			).matches
		) {
			return;
		}

		const nav = document.querySelector(".bottom-nav");
		if (!nav) return;

		const HOT_ZONE_HEIGHT = 120; // px dal fondo in cui si attiva la nav
		const HIDE_DELAY = 400; // ms di permanenza dopo l'uscita
		const INTRO_DURATION = 5000; // ms di visibilità all'avvio

		let hideTimer = null;
		let introTimer = null;
		let introActive = true;

		function showNav() {
			clearTimeout(hideTimer);
			hideTimer = null;
			nav.classList.add("is-visible");
		}

		function hideNavDelayed() {
			if (hideTimer) return;
			hideTimer = setTimeout(() => {
				// Non nascondere se il focus è su un controllo della
				// nav da tastiera: l'utente sta navigando attivamente.
				const focusIsKeyboard =
					nav.contains(document.activeElement) &&
					document.activeElement.matches(":focus-visible");
				if (focusIsKeyboard) return;
				nav.classList.remove("is-visible");
				hideTimer = null;
			}, HIDE_DELAY);
		}

		function endIntro() {
			if (!introActive) return;
			introActive = false;
			clearTimeout(introTimer);
			introTimer = null;
		}

		function isPointerInNav(e) {
			const rect = nav.getBoundingClientRect();
			return (
				e.clientX >= rect.left &&
				e.clientX <= rect.right &&
				e.clientY >= rect.top &&
				e.clientY <= rect.bottom
			);
		}

		/* --- Intro ---
		   La nav è visibile all'avvio per INTRO_DURATION.
		   Se l'utente si avvicina alla hot zone durante l'intro,
		   l'intro termina subito: ha già capito che la nav esiste. */
		nav.classList.add("is-visible");
		introTimer = setTimeout(endIntro, INTRO_DURATION);

		document.addEventListener("mousemove", (e) => {
			const fromBottom = window.innerHeight - e.clientY;
			const inHotZone = fromBottom <= HOT_ZONE_HEIGHT;

			if (introActive && inHotZone) {
				endIntro();
			}

			// Durante l'intro, ignora il resto: la nav resta visibile.
			if (introActive) return;

			if (inHotZone || isPointerInNav(e)) {
				showNav();
			} else {
				hideNavDelayed();
			}
		});

		document.addEventListener("mouseleave", () => {
			if (!introActive) hideNavDelayed();
		});

		// Focus da tastiera: mostra la nav e termina l'intro.
		nav.addEventListener("focusin", () => {
			endIntro();
			showNav();
		});

		nav.addEventListener("focusout", () => {
			setTimeout(() => {
				if (!nav.contains(document.activeElement)) hideNavDelayed();
			}, 0);
		});
	}

	/* ============================================================
	   10. MODULO: TRACKING CONTATTI
	   Invia un evento GA quando l'utente clicca su un link
	   tel: o wa.me. Il tracking è attivo solo se l'utente ha
	   acconsentito (window.gtag è definito solo dopo il consenso).
	   ============================================================ */

	function initContactTracking() {
		const links = document.querySelectorAll(
			'a[href^="tel:"], a[href*="wa.me"]',
		);

		links.forEach((link) => {
			link.addEventListener("click", () => {
				// Se GA non è caricato (consenso negato o non ancora
				// dato), salta silenziosamente.
				if (typeof window.gtag !== "function") return;

				const isTel = link.href.startsWith("tel:");
				const isWa = link.href.includes("wa.me");
				if (!isTel && !isWa) return;

				// Contesto dell'evento: data-ga-context se presente,
				// altrimenti l'id della sezione contenitrice,
				// altrimenti "global".
				let context = link.dataset.gaContext;
				if (!context) {
					const section = link.closest("section[id]");
					context = section ? section.id : "global";
				}

				window.gtag("event", isTel ? "click_phone" : "click_whatsapp", {
					event_category: "contacts",
					event_label: context,
				});
			});
		});
	}

	/* ============================================================
	   11. BOOT
	   Avvia i moduli nell'ordine corretto. L'ordine è importante:
	   - initNavigation deve girare per primo: ritorna l'API
	     navApi che serve a initCookieConsent per il tracking
	     della slide iniziale.
	   - initCookieConsent deve girare PRIMA di initModals:
	     initModals riceve cookieApi per il pulsante "Modifica
	     preferenze cookie".
	   ============================================================ */

	function boot() {
		const navApi = initNavigation();
		initDecadeSlideshow();
		initNavHotZone();
		initContactTracking();

		const cookieApi = initCookieConsent(navApi);
		initModals(cookieApi);

		initOpeningStatus();
		initSignage();
	}

	// Il file viene caricato con defer, quindi il DOM è quasi
	// sempre pronto. Il check readyState copre il caso limite
	// in cui lo script venga incluso senza defer.
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", boot);
	} else {
		boot();
	}
})();
