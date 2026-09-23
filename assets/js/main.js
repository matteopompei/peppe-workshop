(function () {
	"use strict";

	/* ============================================================
	   COSTANTI E HELPER
	   ============================================================ */

	// TODO: sostituire con l'ID reale di Google Analytics prima del deploy
	const GA_MEASUREMENT_ID = "G-XXXXXXXXXX";

	const COOKIE_KEY = "cookie_consent";
	const COOKIE_DURATION_DAYS = 180;

	const DAY_NAMES = [
		"domenica",
		"lunedì",
		"martedì",
		"mercoledì",
		"giovedì",
		"venerdì",
		"sabato",
	];

	// Orari in minuti dalla mezzanotte: 510=8:30, 750=12:30, 900=15:00, 1170=19:30
	const SCHEDULE = {
		0: [], // domenica
		1: [
			[510, 750],
			[900, 1170],
		], // lunedì
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
		6: [[510, 750]], // sabato
	};
	const CLOSING_SOON_MINUTES = 30;

	function getRomeNow() {
		try {
			const s = new Date().toLocaleString("en-US", { timeZone: "Europe/Rome" });
			return new Date(s);
		} catch (e) {
			return new Date();
		}
	}

	function fmtTime(minutes) {
		const h = Math.floor(minutes / 60);
		const m = minutes % 60;
		return h + ":" + String(m).padStart(2, "0");
	}

	function getDayOfYear(date) {
		const start = new Date(date.getFullYear(), 0, 0);
		return Math.floor((date - start) / 86400000);
	}

	/* ============================================================
	   NAVIGAZIONE SLIDE
	   ============================================================ */

	const deck = document.querySelector(".deck");
	if (!deck) return;

	const slides = Array.from(deck.querySelectorAll(".slide"));
	const dots = Array.from(document.querySelectorAll(".dot"));
	const prevBtn = document.getElementById("prevBtn");
	const nextBtn = document.getElementById("nextBtn");
	const swipeHint = document.getElementById("swipeHint");
	const liveRegion = document.getElementById("liveRegion");

	if (!slides.length || !prevBtn || !nextBtn) return;

	const slideTitles = [
		"Benvenuto",
		"La nostra storia",
		"Servizi offerti",
		"Dove e quando trovarci",
		"Guida Picena",
		"Note legali e credits",
	];
	const total = slides.length;

	let currentIndex = 0;
	let isProgrammaticScroll = false;
	let programmaticScrollTimer = null;
	let scrollDebounceTimer = null;

	function getSlideWidth() {
		return deck.clientWidth || 1;
	}

	function updateUI() {
		// Dot: classe attiva + roving tabindex + aria-current
		dots.forEach((dot, i) => {
			const isActive = i === currentIndex;
			dot.classList.toggle("active", isActive);
			dot.tabIndex = isActive ? 0 : -1;
			if (isActive) dot.setAttribute("aria-current", "true");
			else dot.removeAttribute("aria-current");
		});

		// Nav buttons
		const atStart = currentIndex === 0;
		const atEnd = currentIndex === total - 1;

		prevBtn.classList.toggle("disabled", atStart);
		prevBtn.setAttribute("aria-disabled", atStart ? "true" : "false");
		prevBtn.disabled = atStart;

		nextBtn.classList.toggle("disabled", atEnd);
		nextBtn.setAttribute("aria-disabled", atEnd ? "true" : "false");
		nextBtn.disabled = atEnd;

		// Slide: solo quella attiva è raggiungibile da tab/focus
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

		// Annuncio screen reader
		if (liveRegion) {
			liveRegion.textContent =
				"Slide " +
				(currentIndex + 1) +
				" di " +
				total +
				": " +
				slideTitles[currentIndex];
		}

		// Nascondi hint swipe dopo il primo movimento
		if (currentIndex > 0 && swipeHint) {
			swipeHint.classList.add("hidden");
		}
	}

	function releaseProgrammaticScroll() {
		isProgrammaticScroll = false;
		clearTimeout(programmaticScrollTimer);
		programmaticScrollTimer = null;
	}

	function goTo(index) {
		if (index < 0 || index >= total) return;
		if (index === currentIndex && !isProgrammaticScroll) return;

		currentIndex = index;
		isProgrammaticScroll = true;
		updateUI();

		clearTimeout(programmaticScrollTimer);
		// Safety net: se gli eventi scroll non arrivano, sblocca dopo 800ms
		programmaticScrollTimer = setTimeout(releaseProgrammaticScroll, 800);

		deck.scrollTo({ left: index * getSlideWidth(), behavior: "smooth" });
	}

	// Elementi con [data-goto] (accetta indice numerico o selettore "#slide-N")
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

	// Dot: click + navigazione da tastiera (roving tabindex)
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

	// Nav buttons
	prevBtn.addEventListener("click", () => goTo(currentIndex - 1));
	nextBtn.addEventListener("click", () => goTo(currentIndex + 1));

	// Frecce tastiera globali (fuori dai dot e dai modali)
	document.addEventListener("keydown", (e) => {
		if (e.target.closest && e.target.closest(".dots")) return;

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

	// Unico listener di scroll: gestisce sia scroll programmatico sia manuale
	deck.addEventListener(
		"scroll",
		() => {
			// Se stiamo animando, prova a sbloccare quando arriviamo al target
			if (isProgrammaticScroll) {
				const ratio = deck.scrollLeft / getSlideWidth();
				if (Math.abs(ratio - currentIndex) < 0.02) {
					releaseProgrammaticScroll();
				}
			}

			// Sincronizzazione debounced
			clearTimeout(scrollDebounceTimer);
			scrollDebounceTimer = setTimeout(() => {
				if (isProgrammaticScroll) return; // ancora in animazione
				const newIndex = Math.round(deck.scrollLeft / getSlideWidth());
				if (newIndex >= 0 && newIndex < total && newIndex !== currentIndex) {
					currentIndex = newIndex;
					updateUI();
				}
			}, 100);
		},
		{ passive: true },
	);

	/* --- Drag col mouse (solo desktop) --- */
	let isDragging = false;
	let wasDragged = false;
	let dragStartX = 0;
	let dragStartScrollLeft = 0;

	deck.addEventListener("mousedown", (e) => {
		// Solo tasto sinistro, ignora se stiamo già animando
		if (e.button !== 0) return;
		if (isProgrammaticScroll) releaseProgrammaticScroll();
		isDragging = true;
		wasDragged = false;
		dragStartX = e.pageX;
		dragStartScrollLeft = deck.scrollLeft;
	});

	deck.addEventListener("mousemove", (e) => {
		if (!isDragging) return;
		const dx = e.pageX - dragStartX;
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
			// Se l'utente ha trascinato, forza un sync dopo che lo snap si è assestato
			if (wasDragged) {
				setTimeout(() => {
					const newIndex = Math.round(deck.scrollLeft / getSlideWidth());
					if (newIndex >= 0 && newIndex < total && newIndex !== currentIndex) {
						currentIndex = newIndex;
						updateUI();
					}
				}, 200);
			}
		});
	});

	// Blocca click accidentali dopo un drag
	deck.addEventListener(
		"click",
		(e) => {
			if (wasDragged) {
				e.preventDefault();
				e.stopPropagation();
				wasDragged = false;
			}
		},
		true, // ← capture: true, essenziale
	);

	// Previeni il dragstart nativo delle immagini
	deck.addEventListener("dragstart", (e) => e.preventDefault());

	updateUI();

	/* ============================================================
	   COOKIE CONSENT
	   ============================================================ */

	const banner = document.getElementById("cookieBanner");

	function getConsent() {
		try {
			const raw = localStorage.getItem(COOKIE_KEY);
			if (!raw) return null;
			const data = JSON.parse(raw);
			if (
				data.ts &&
				Date.now() - data.ts > COOKIE_DURATION_DAYS * 24 * 3600 * 1000
			) {
				localStorage.removeItem(COOKIE_KEY);
				return null;
			}
			return data;
		} catch (e) {
			return null;
		}
	}

	function setConsent(analytics) {
		localStorage.setItem(
			COOKIE_KEY,
			JSON.stringify({ analytics: analytics, ts: Date.now() }),
		);
	}

	function loadGoogleAnalytics() {
		if (document.getElementById("ga-script")) return;
		const script = document.createElement("script");
		script.id = "ga-script";
		script.async = true;
		script.src =
			"https://www.googletagmanager.com/gtag/js?id=" + GA_MEASUREMENT_ID;
		document.head.appendChild(script);

		window.dataLayer = window.dataLayer || [];
		function gtag() {
			dataLayer.push(arguments);
		}
		window.gtag = gtag;
		gtag("js", new Date());
		gtag("config", GA_MEASUREMENT_ID, {
			anonymize_ip: true,
			cookie_flags: "SameSite=Lax;Secure",
		});
	}

	function unloadGoogleAnalytics() {
		const s = document.getElementById("ga-script");
		if (s) s.remove();
		const names = ["_ga", "_gid", "_ga_" + GA_MEASUREMENT_ID.replace("G-", "")];
		names.forEach((name) => {
			document.cookie = name + "=; Max-Age=0; path=/;";
			document.cookie =
				name + "=; Max-Age=0; path=/; domain=" + location.hostname + ";";
		});
	}

	function updateMapForConsent(analytics) {
		const iframe = document.querySelector(".map-wrap iframe");
		const mapOverlay = document.getElementById("mapOverlay");
		const activateMapLabel = document.getElementById("activateMapLabel");
		const activateMapBtn = document.getElementById("activateMap");
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
			if (iframe.src) {
				iframe.removeAttribute("src");
			}
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

	function applyConsent(analytics) {
		if (analytics) loadGoogleAnalytics();
		else unloadGoogleAnalytics();
		updateMapForConsent(analytics);
		if (banner) banner.classList.add("hidden");
	}

	const existingConsent = getConsent();
	if (existingConsent) {
		applyConsent(existingConsent.analytics);
	} else {
		updateMapForConsent(false);
	}

	document.getElementById("acceptCookies")?.addEventListener("click", () => {
		setConsent(true);
		applyConsent(true);
	});

	document.getElementById("rejectCookies")?.addEventListener("click", () => {
		setConsent(false);
		applyConsent(false);
	});

	// Bottone "Accetta i cookie per vedere la mappa"
	const activateMapBtn = document.getElementById("activateMap");
	if (activateMapBtn) {
		activateMapBtn.addEventListener("click", () => {
			const consent = getConsent();
			if (consent && consent.analytics) {
				updateMapForConsent(true);
			} else {
				banner?.classList.remove("hidden");
				document.getElementById("rejectCookies")?.focus();
			}
		});
	}

	/* ============================================================
	   MODALI (focus trap tramite inert su .app)
	   ============================================================ */

	const appEl = document.querySelector(".app");
	let lastFocused = null;

	function openModal(modal) {
		if (!modal) return;
		lastFocused = document.activeElement;
		modal.classList.add("show");
		if (appEl) appEl.setAttribute("inert", "");
		const focusable = modal.querySelector(".modal-close, .modal-dismiss, .btn");
		if (focusable) focusable.focus();
	}

	function closeModal(modal) {
		if (!modal) return;
		modal.classList.remove("show");
		if (appEl) appEl.removeAttribute("inert");
		if (lastFocused && typeof lastFocused.focus === "function") {
			lastFocused.focus();
		}
	}

	const policyModal = document.getElementById("policyModal");
	const policyClose = document.getElementById("policyClose");
	const openPrivacyLink = document.getElementById("openPrivacyLink");
	const reopenCookieSettings = document.getElementById("reopenCookieSettings");
	const policyLinkFromBanner = document.getElementById("openPolicyFromBanner");

	const reviewModal = document.getElementById("reviewModal");
	const ratingTrigger = document.getElementById("ratingTrigger");
	const reviewDismiss = document.getElementById("reviewDismiss");

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

	policyLinkFromBanner?.addEventListener("click", (e) => {
		e.preventDefault();
		openPolicy();
	});

	openPrivacyLink?.addEventListener("click", (e) => {
		e.preventDefault();
		openPolicy();
	});

	policyClose?.addEventListener("click", closePolicy);

	policyModal?.addEventListener("click", (e) => {
		if (e.target === policyModal) closePolicy();
	});

	if (ratingTrigger) {
		ratingTrigger.addEventListener("click", openReview);
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

	// Escape chiude il modale aperto
	document.addEventListener("keydown", (e) => {
		if (e.key !== "Escape") return;
		if (policyModal?.classList.contains("show")) closePolicy();
		if (reviewModal?.classList.contains("show")) closeReview();
	});

	// Modifica preferenze cookie
	reopenCookieSettings?.addEventListener("click", (e) => {
		e.preventDefault();
		localStorage.removeItem(COOKIE_KEY);
		closePolicy();
		banner?.classList.remove("hidden");
	});

	/* ============================================================
	   STATO APERTURA (ora di Roma)
	   ============================================================ */

	function getOpenStatus() {
		const now = getRomeNow();
		const day = now.getDay();
		const minutes = now.getHours() * 60 + now.getMinutes();
		const todayRanges = SCHEDULE[day] || [];

		// Aperto adesso?
		for (let i = 0; i < todayRanges.length; i++) {
			const open = todayRanges[i][0];
			const close = todayRanges[i][1];
			if (minutes >= open && minutes < close) {
				const remaining = close - minutes;
				if (remaining <= CLOSING_SOON_MINUTES) {
					return {
						state: "closing-soon",
						short: "CHIUDE " + fmtTime(close),
						full: "Aperto · chiude alle " + fmtTime(close),
					};
				}
				return { state: "open", short: "APERTO", full: "Aperto ora" };
			}
		}

		// Chiuso: prossima apertura oggi?
		for (let i = 0; i < todayRanges.length; i++) {
			const open = todayRanges[i][0];
			if (open > minutes) {
				// Se c'è già stata un'apertura prima → è pausa pranzo
				const isLunchBreak = i > 0;
				return {
					state: isLunchBreak ? "lunch-break" : "closed",
					short: "RIAPRE " + fmtTime(open),
					full: "Chiuso · riapre alle " + fmtTime(open),
				};
			}
		}

		// Chiuso per oggi: prossima apertura nei giorni successivi
		for (let i = 1; i <= 7; i++) {
			const nextDay = (day + i) % 7;
			const nextRanges = SCHEDULE[nextDay] || [];
			if (nextRanges.length > 0) {
				const open = nextRanges[0][0];
				const dayLabel = i === 1 ? "domani" : DAY_NAMES[nextDay];
				return {
					state: "closed",
					short: "RIAPRE " + dayLabel.toUpperCase(),
					full: "Chiuso · riapre " + dayLabel + " alle " + fmtTime(open),
				};
			}
		}

		return { state: "closed", short: "CHIUSO", full: "Chiuso" };
	}

	const locationDot = document.getElementById("locationDot");
	const heroLocation = document.getElementById("heroLocation");
	const openStatusBadge = document.getElementById("openStatusBadge");
	const openStatusText = document.getElementById("openStatusText");

	function updateStatus() {
		const status = getOpenStatus();

		if (locationDot) {
			locationDot.classList.remove("is-open", "is-closing-soon", "is-closed");
			locationDot.classList.add("is-" + status.state);
		}

		// heroLocation è un div informativo: usa il tooltip nativo
		if (heroLocation) {
			heroLocation.setAttribute(
				"title",
				"Bivio Offida, Via Salaria, Castorano. " + status.full + ".",
			);
		}

		if (openStatusBadge && openStatusText) {
			openStatusBadge.classList.remove(
				"is-open",
				"is-closing-soon",
				"is-closed",
			);
			openStatusBadge.classList.add("is-" + status.state);
			openStatusText.textContent = status.short;
			openStatusBadge.setAttribute("aria-label", status.full);
		}
	}

	function highlightToday() {
		const today = getRomeNow().getDay();
		const list = document.getElementById("scheduleList");
		if (!list) return;

		// Pulisci lo stato precedente
		list.querySelectorAll("li").forEach((li) => {
			li.classList.remove("is-today");
			const tag = li.querySelector(".today-tag");
			if (tag) tag.remove();
		});

		// Trova la riga corrispondente al giorno
		const target = Array.from(list.querySelectorAll("li")).find((li) => {
			const days = (li.dataset.days || "").split(",").map(Number);
			return days.indexOf(today) !== -1;
		});
		if (!target) return;

		target.classList.add("is-today");

		// Aggiungi la targhetta "oggi" accanto al nome del giorno
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

	updateAll();
	setInterval(updateAll, 60000);

	/* ============================================================
	   INSEGNA — Accensione al crepuscolo (ora di Roma)
	   ============================================================ */

	const appHeader = document.getElementById("appHeader");

	// Finestra di buio: dal tramonto+crepuscolo civile (~30 min)
	// all'alba-crepuscolo civile (~30 min). Approssimazione sinusoidale
	// tarata sull'Italia centrale.
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
		if (!appHeader) return;
		if (isDark()) appHeader.classList.add("is-lit");
		else appHeader.classList.remove("is-lit");
	}

	updateSignage();
	setInterval(updateSignage, 60000);
})();
