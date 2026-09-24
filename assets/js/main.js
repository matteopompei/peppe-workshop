(function () {
	"use strict";

	/* ============================================================
	   CONFIGURAZIONE
	   ============================================================ */

	const CONFIG = {
		gaMeasurementId: "G-ME2G5VJ8BB",

		cookieKey: "cookie_consent",
		cookieDurationDays: 180,

		// Orari in minuti dalla mezzanotte: 510=8:30, 750=12:30, 900=15:00, 1170=19:30
		schedule: {
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
		},
		closingSoonMinutes: 30,

		dayNames: [
			"domenica",
			"lunedì",
			"martedì",
			"mercoledì",
			"giovedì",
			"venerdì",
			"sabato",
		],

		slideTitles: [
			"Benvenuto",
			"La nostra storia",
			"Servizi offerti",
			"Dove e quando trovarci",
			"Guida Picena",
			"Note legali e credits",
		],

		decadeSlideshowDuration: 1500, // ms per foto
	};

	/* ============================================================
	   UTILS — funzioni pure condivise
	   ============================================================ */

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
	   MODULO: NAVIGAZIONE SLIDE
	   Deck orizzontale, dot, drag mouse, deep linking, popstate
	   ============================================================ */

	function initNavigation() {
		const deck = document.querySelector(".deck");
		if (!deck) return;

		const slides = Array.from(deck.querySelectorAll(".slide"));
		const dots = Array.from(document.querySelectorAll(".dot"));
		const prevBtn = document.getElementById("prevBtn");
		const nextBtn = document.getElementById("nextBtn");
		const swipeHint = document.getElementById("swipeHint");
		const liveRegion = document.getElementById("liveRegion");

		if (!slides.length || !prevBtn || !nextBtn) return;

		const total = slides.length;
		const titles = CONFIG.slideTitles;

		let currentIndex = 0;
		let isProgrammaticScroll = false;
		let programmaticScrollTimer = null;
		let scrollDebounceTimer = null;

		const getSlideWidth = () => deck.clientWidth || 1;

		function updateUI() {
			dots.forEach((dot, i) => {
				const isActive = i === currentIndex;
				dot.classList.toggle("active", isActive);
				dot.tabIndex = isActive ? 0 : -1;
				if (isActive) dot.setAttribute("aria-current", "true");
				else dot.removeAttribute("aria-current");
			});

			const atStart = currentIndex === 0;
			const atEnd = currentIndex === total - 1;

			prevBtn.classList.toggle("disabled", atStart);
			prevBtn.setAttribute("aria-disabled", atStart ? "true" : "false");
			prevBtn.disabled = atStart;

			nextBtn.classList.toggle("disabled", atEnd);
			nextBtn.setAttribute("aria-disabled", atEnd ? "true" : "false");
			nextBtn.disabled = atEnd;

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

			if (liveRegion) {
				liveRegion.textContent =
					"Slide " +
					(currentIndex + 1) +
					" di " +
					total +
					": " +
					titles[currentIndex];
			}

			if (currentIndex > 0 && swipeHint) {
				swipeHint.classList.add("hidden");
			}
		}

		function releaseProgrammaticScroll() {
			isProgrammaticScroll = false;
			clearTimeout(programmaticScrollTimer);
			programmaticScrollTimer = null;
		}

		function goTo(index, options) {
			const opts = options || {};
			const push = opts.push !== false;

			if (index < 0 || index >= total) return;
			if (index === currentIndex && !isProgrammaticScroll) return;

			currentIndex = index;
			isProgrammaticScroll = true;
			updateUI();

			const slideId = slides[index].id;
			if (push) {
				history.pushState({ slide: index }, "", "#" + slideId);
			} else {
				history.replaceState({ slide: index }, "", "#" + slideId);
			}

			clearTimeout(programmaticScrollTimer);
			programmaticScrollTimer = setTimeout(releaseProgrammaticScroll, 800);

			deck.scrollTo({ left: index * getSlideWidth(), behavior: "smooth" });
		}

		function indexFromHash() {
			const hash = location.hash.slice(1);
			if (!hash) return 0;
			const target = document.getElementById(hash);
			if (!target) return 0;
			const idx = slides.indexOf(target);
			return idx >= 0 ? idx : 0;
		}

		/* --- Eventi: data-goto --- */
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

		/* --- Eventi: dot --- */
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

		/* --- Eventi: nav buttons --- */
		prevBtn.addEventListener("click", () => goTo(currentIndex - 1));
		nextBtn.addEventListener("click", () => goTo(currentIndex + 1));

		/* --- Eventi: tastiera globale --- */
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

		/* --- Eventi: scroll --- */
		deck.addEventListener(
			"scroll",
			() => {
				if (isProgrammaticScroll) {
					const ratio = deck.scrollLeft / getSlideWidth();
					if (Math.abs(ratio - currentIndex) < 0.02) {
						releaseProgrammaticScroll();
					}
				}

				clearTimeout(scrollDebounceTimer);
				scrollDebounceTimer = setTimeout(() => {
					if (isProgrammaticScroll) return;
					const newIndex = Math.round(deck.scrollLeft / getSlideWidth());
					if (newIndex >= 0 && newIndex < total && newIndex !== currentIndex) {
						currentIndex = newIndex;
						updateUI();
						// Aggiorna l'URL senza creare una nuova voce nella cronologia
						const slideId = slides[currentIndex].id;
						history.replaceState({ slide: currentIndex }, "", "#" + slideId);
					}
				}, 100);
			},
			{ passive: true },
		);

		/* --- Drag col mouse --- */
		let isDragging = false;
		let wasDragged = false;
		let dragStartX = 0;
		let dragStartScrollLeft = 0;

		deck.addEventListener("mousedown", (e) => {
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
				if (wasDragged) {
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
							history.replaceState({ slide: currentIndex }, "", "#" + slideId);
						}
					}, 200);
				}
			});
		});

		// Blocca click accidentali dopo un drag (in capture, prima dei bottoni figli)
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

		/* --- Deep linking: hash all'avvio --- */
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
	}

	/* ============================================================
	   MODULO: SLIDESHOW DECENNI — foto officina
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

		// Con reduced-motion: durata più lunga, nessuna transizione visiva
		const DURATION = reducedMotion
			? CONFIG.decadeSlideshowDuration * 2
			: CONFIG.decadeSlideshowDuration;
		let idx = 0;

		function show(index) {
			photos.forEach((p, i) => p.classList.toggle("is-visible", i === index));
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
	   MODULO: COOKIE CONSENT + MAPPA
	   Espone API per essere usato da altri moduli (modali, ecc.)
	   ============================================================ */

	function initCookieConsent() {
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

		function loadGoogleAnalytics() {
			if (document.getElementById("ga-script")) return;
			const script = document.createElement("script");
			script.id = "ga-script";
			script.async = true;
			script.src =
				"https://www.googletagmanager.com/gtag/js?id=" + CONFIG.gaMeasurementId;
			document.head.appendChild(script);

			window.dataLayer = window.dataLayer || [];
			function gtag() {
				dataLayer.push(arguments);
			}
			window.gtag = gtag;
			gtag("js", new Date());
			gtag("config", CONFIG.gaMeasurementId, {
				anonymize_ip: true,
				cookie_flags: "SameSite=Lax;Secure",
			});
		}

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

		function applyConsent(analytics) {
			if (analytics) loadGoogleAnalytics();
			else unloadGoogleAnalytics();
			updateMap(analytics);
			if (banner) banner.classList.add("hidden");
		}

		function showBanner() {
			if (banner) banner.classList.remove("hidden");
			const rejectBtn = document.getElementById("rejectCookies");
			if (rejectBtn) rejectBtn.focus();
		}

		/* --- Stato iniziale --- */
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

		/* --- Eventi: bottone "attiva mappa" --- */
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
	   MODULO: MODALI (policy + recensione)
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

		function openModal(modal) {
			if (!modal) return;
			lastFocused = document.activeElement;
			modal.classList.add("show");
			if (appEl) appEl.setAttribute("inert", "");
			const focusable = modal.querySelector(
				".modal-close, .modal-dismiss, .btn",
			);
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

		policyModal?.addEventListener("click", (e) => {
			if (e.target === policyModal) closePolicy();
		});

		/* --- Eventi: recensione --- */
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

		/* --- Escape chiude il modale aperto --- */
		document.addEventListener("keydown", (e) => {
			if (e.key !== "Escape") return;
			if (policyModal?.classList.contains("show")) closePolicy();
			if (reviewModal?.classList.contains("show")) closeReview();
		});

		/* --- Modifica preferenze cookie --- */
		reopenCookieSettings?.addEventListener("click", (e) => {
			e.preventDefault();
			localStorage.removeItem(CONFIG.cookieKey);
			closePolicy();
			if (cookieApi) cookieApi.showBanner();
		});
	}

	/* ============================================================
	   MODULO: STATO APERTURA + "oggi" nella tabella orari
	   ============================================================ */

	function initOpeningStatus() {
		const locationDot = document.getElementById("locationDot");
		const heroLocation = document.getElementById("heroLocation");
		const openStatusBadge = document.getElementById("openStatusBadge");
		const openStatusText = document.getElementById("openStatusText");

		function getOpenStatus() {
			const now = getRomeNow();
			const day = now.getDay();
			const minutes = now.getHours() * 60 + now.getMinutes();
			const todayRanges = CONFIG.schedule[day] || [];

			// Aperto adesso?
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

			// Chiuso: prossima apertura oggi?
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

			// Chiuso: prossima apertura nei giorni successivi
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

		function updateStatus() {
			const status = getOpenStatus();

			if (locationDot) {
				locationDot.classList.remove(
					"is-open",
					"is-closing-soon",
					"is-lunch-break",
					"is-closed",
				);
				locationDot.classList.add("is-" + status.state);
			}

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
					"is-lunch-break",
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

			list.querySelectorAll("li").forEach((li) => {
				li.classList.remove("is-today");
				const tag = li.querySelector(".today-tag");
				if (tag) tag.remove();
			});

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

		updateAll();
		setInterval(updateAll, 60000);
	}

	/* ============================================================
	   MODULO: INSEGNA — accensione al crepuscolo (ora di Roma)
	   ============================================================ */

	function initSignage() {
		const appHeader = document.getElementById("appHeader");
		if (!appHeader) return;

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
			if (isDark()) appHeader.classList.add("is-lit");
			else appHeader.classList.remove("is-lit");
		}

		updateSignage();
		setInterval(updateSignage, 60000);
	}

	/* ============================================================
   MODULO: HOT ZONE NAV — mostra la nav solo avvicinandosi col mouse
   ============================================================ */

	function initNavHotZone() {
		// Solo su desktop con mouse (non su touch)
		if (
			!window.matchMedia(
				"(min-width: 541px) and (hover: hover) and (pointer: fine)",
			).matches
		) {
			return;
		}

		const nav = document.querySelector(".bottom-nav");
		if (!nav) return;

		const HOT_ZONE_HEIGHT = 120; // px dal bordo inferiore
		const HIDE_DELAY = 400; // ms prima di nascondere

		let hideTimer = null;

		function showNav() {
			clearTimeout(hideTimer);
			hideTimer = null;
			nav.classList.add("is-visible");
		}

		function hideNavDelayed() {
			if (hideTimer) return;
			hideTimer = setTimeout(() => {
				// Non nascondere se il focus è dentro la nav (tastiera)
				if (nav.contains(document.activeElement)) return;
				nav.classList.remove("is-visible");
				hideTimer = null;
			}, HIDE_DELAY);
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

		document.addEventListener("mousemove", (e) => {
			const fromBottom = window.innerHeight - e.clientY;

			if (fromBottom <= HOT_ZONE_HEIGHT) {
				showNav();
				return;
			}

			// Fuori dalla hot zone: nascondi solo se non sopra la nav
			if (!isPointerInNav(e)) {
				hideNavDelayed();
			} else {
				showNav();
			}
		});

		// Quando il mouse esce dalla finestra, nascondi
		document.addEventListener("mouseleave", hideNavDelayed);

		// Tastiera: se la nav riceve focus, resta visibile
		nav.addEventListener("focusin", showNav);
		nav.addEventListener("focusout", () => {
			// Nascondi solo se il nuovo elemento attivo è fuori
			setTimeout(() => {
				if (!nav.contains(document.activeElement)) hideNavDelayed();
			}, 0);
		});
	}

	/* ============================================================
	   BOOT — avvia i moduli nell'ordine corretto
	   ============================================================ */

	function boot() {
		initNavigation();
		initDecadeSlideshow();
		initNavHotZone();

		// Cookie e modali sono legati: modali riceve l'API di cookie
		const cookieApi = initCookieConsent();
		initModals(cookieApi);

		initOpeningStatus();
		initSignage();
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", boot);
	} else {
		boot();
	}
})();
