(function () {
	"use strict";

	/* ============================================================
	   NAVIGAZIONE SLIDE
	   ============================================================ */
	const deck = document.querySelector(".deck");
	if (!deck) return;

	const slides = Array.from(deck.querySelectorAll(".slide"));
	const dots = Array.from(document.querySelectorAll(".dot"));

	dots.forEach((dot, i) => {
		dot.addEventListener("click", (e) => {
			e.preventDefault();
			goTo(i);
		});
	});

	const prevBtn = document.getElementById("prevBtn");
	const nextBtn = document.getElementById("nextBtn");
	const swipeHint = document.getElementById("swipeHint");

	if (!slides.length || !prevBtn || !nextBtn) return;

	let currentIndex = 0;

	function updateUI() {
		dots.forEach((dot, i) => {
			dot.classList.toggle("active", i === currentIndex);
		});

		const atStart = currentIndex === 0;
		const atEnd = currentIndex === slides.length - 1;

		prevBtn.classList.toggle("disabled", atStart);
		prevBtn.setAttribute("aria-disabled", atStart ? "true" : "false");

		nextBtn.classList.toggle("disabled", atEnd);
		nextBtn.setAttribute("aria-disabled", atEnd ? "true" : "false");

		if (currentIndex > 0 && swipeHint) {
			swipeHint.classList.add("hidden");
		}
	}

	function goTo(index) {
		if (index < 0 || index >= slides.length) return;
		currentIndex = index;
		deck.scrollTo({ left: index * deck.clientWidth });
		updateUI();
	}

	prevBtn.addEventListener("click", (e) => {
		e.preventDefault();
		if (currentIndex === 0) return;
		goTo(currentIndex - 1);
	});

	nextBtn.addEventListener("click", (e) => {
		e.preventDefault();
		if (currentIndex === slides.length - 1) return;
		goTo(currentIndex + 1);
	});

	let scrollTimeout;
	deck.addEventListener(
		"scroll",
		() => {
			clearTimeout(scrollTimeout);
			scrollTimeout = setTimeout(() => {
				const newIndex = Math.round(deck.scrollLeft / deck.clientWidth);
				if (
					newIndex !== currentIndex &&
					newIndex >= 0 &&
					newIndex < slides.length
				) {
					currentIndex = newIndex;
					updateUI();
				}
			}, 100);
		},
		{ passive: true },
	);

	updateUI();

	/* ============================================================
	   COOKIE CONSENT
	   ============================================================ */
	const COOKIE_KEY = "cookie_consent";
	const COOKIE_DURATION_DAYS = 180;
	const GA_MEASUREMENT_ID =
		"G-XXXXXXXXXX"; /* placeholder: sostituire al deploy */

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
			JSON.stringify({
				analytics: analytics,
				ts: Date.now(),
			}),
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
		names.forEach(function (name) {
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
		banner.classList.add("hidden");
	}

	const existingConsent = getConsent();
	if (existingConsent) {
		applyConsent(existingConsent.analytics);
	} else {
		updateMapForConsent(false);
	}

	document.getElementById("acceptCookies").addEventListener("click", () => {
		setConsent(true);
		applyConsent(true);
	});

	document.getElementById("rejectCookies").addEventListener("click", () => {
		setConsent(false);
		applyConsent(false);
	});

	/* Bottone "Accetta i cookie per vedere la mappa" */
	const activateMapBtn = document.getElementById("activateMap");
	if (activateMapBtn) {
		activateMapBtn.addEventListener("click", () => {
			const consent = getConsent();
			if (consent && consent.analytics) {
				/* Consenso già dato: carica la mappa */
				updateMapForConsent(true);
			} else {
				/* Nessun consenso: riapri il banner cookie */
				banner.classList.remove("hidden");
				const rejectBtn = document.getElementById("rejectCookies");
				if (rejectBtn) rejectBtn.focus();
			}
		});
	}

	/* ============================================================
	   MODALI (focus trap + inert)
	   ============================================================ */
	const appEl = document.querySelector(".app");
	let lastFocused = null;

	function openModal(modal) {
		lastFocused = document.activeElement;
		modal.classList.add("show");
		if (appEl) appEl.setAttribute("inert", "");
		const focusable = modal.querySelector(".modal-close, .modal-dismiss, .btn");
		if (focusable) focusable.focus();
	}

	function closeModal(modal) {
		modal.classList.remove("show");
		if (appEl) appEl.removeAttribute("inert");
		if (lastFocused && typeof lastFocused.focus === "function") {
			lastFocused.focus();
		}
	}

	/* --- Modale privacy --- */
	const policyModal = document.getElementById("policyModal");
	const policyClose = document.getElementById("policyClose");
	const openPrivacyLink = document.getElementById("openPrivacyLink");
	const reopenCookieSettings = document.getElementById("reopenCookieSettings");
	const policyLinkFromBanner = document.getElementById("openPolicyFromBanner");

	function openPolicy() {
		openModal(policyModal);
	}
	function closePolicy() {
		closeModal(policyModal);
	}

	if (policyLinkFromBanner) {
		policyLinkFromBanner.addEventListener("click", (e) => {
			e.preventDefault();
			openPolicy();
		});
	}

	if (openPrivacyLink) {
		openPrivacyLink.addEventListener("click", (e) => {
			e.preventDefault();
			openPolicy();
		});
	}

	if (policyClose) {
		policyClose.addEventListener("click", closePolicy);
	}

	policyModal.addEventListener("click", (e) => {
		if (e.target === policyModal) closePolicy();
	});

	/* --- Modale recensione --- */
	const ratingTrigger = document.getElementById("ratingTrigger");
	const reviewModal = document.getElementById("reviewModal");
	const reviewDismiss = document.getElementById("reviewDismiss");

	function openReview() {
		openModal(reviewModal);
	}
	function closeReview() {
		closeModal(reviewModal);
	}

	if (ratingTrigger) {
		ratingTrigger.addEventListener("click", openReview);
		ratingTrigger.addEventListener("keydown", (e) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				openReview();
			}
		});
	}

	if (reviewDismiss) {
		reviewDismiss.addEventListener("click", closeReview);
	}

	reviewModal.addEventListener("click", (e) => {
		if (e.target === reviewModal) closeReview();
	});

	/* --- Escape chiude il modale aperto --- */
	document.addEventListener("keydown", (e) => {
		if (e.key !== "Escape") return;
		if (policyModal.classList.contains("show")) closePolicy();
		if (reviewModal.classList.contains("show")) closeReview();
	});

	/* --- Modifica preferenze cookie --- */
	if (reopenCookieSettings) {
		reopenCookieSettings.addEventListener("click", (e) => {
			e.preventDefault();
			localStorage.removeItem(COOKIE_KEY);
			closePolicy();
			banner.classList.remove("hidden");
		});
	}

	/* ============================================================
	   STATO APERTURA (ora di Roma)
	   ============================================================ */
	/* Orari in minuti dalla mezzanotte:
	   510 = 8:30, 750 = 12:30, 900 = 15:00, 1170 = 19:30 */
	const SCHEDULE = {
		0: [] /* domenica */,
		1: [
			[510, 750],
			[900, 1170],
		] /* lunedì */,
		2: [
			[510, 750],
			[900, 1170],
		] /* martedì */,
		3: [
			[510, 750],
			[900, 1170],
		] /* mercoledì */,
		4: [
			[510, 750],
			[900, 1170],
		] /* giovedì */,
		5: [
			[510, 750],
			[900, 1170],
		] /* venerdì */,
		6: [[510, 750]] /* sabato */,
	};

	const DAY_NAMES = [
		"domenica",
		"lunedì",
		"martedì",
		"mercoledì",
		"giovedì",
		"venerdì",
		"sabato",
	];

	const CLOSING_SOON_MINUTES = 30;

	function getRomeNow() {
		try {
			const s = new Date().toLocaleString("en-US", {
				timeZone: "Europe/Rome",
			});
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

	function getOpenStatus() {
		const now = getRomeNow();
		const day = now.getDay();
		const minutes = now.getHours() * 60 + now.getMinutes();
		const todayRanges = SCHEDULE[day] || [];

		/* Aperto adesso? */
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

		/* Chiuso: prossima apertura oggi? */
		for (let i = 0; i < todayRanges.length; i++) {
			const open = todayRanges[i][0];
			if (open > minutes) {
				return {
					state: "closed",
					short: "CHIUSO",
					full: "Chiuso · riapre alle " + fmtTime(open),
				};
			}
		}

		/* Chiuso: prossima apertura nei giorni successivi */
		for (let i = 1; i <= 7; i++) {
			const nextDay = (day + i) % 7;
			const nextRanges = SCHEDULE[nextDay] || [];
			if (nextRanges.length > 0) {
				const open = nextRanges[0][0];
				const dayLabel = i === 1 ? "domani" : DAY_NAMES[nextDay];
				return {
					state: "closed",
					short: "CHIUSO",
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

		if (heroLocation) {
			heroLocation.setAttribute(
				"aria-label",
				"Bivio Offida, Via Salaria, Castorano. " +
					status.full +
					". Clicca per vedere orari e contatti.",
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

	updateStatus();
	setInterval(updateStatus, 60000);

	/* ============================================================
	   INSEGNA — Accensione al crepuscolo (ora di Roma)
	   ============================================================ */
	const appHeader = document.getElementById("appHeader");

	/* Se `getRomeNow` è già definito più sopra nel file,
	   salta questa funzione per evitare conflitti. */
	function getRomeNowForSignage() {
		try {
			const s = new Date().toLocaleString("en-US", {
				timeZone: "Europe/Rome",
			});
			return new Date(s);
		} catch (e) {
			return new Date();
		}
	}

	function getDayOfYear(date) {
		const start = new Date(date.getFullYear(), 0, 0);
		const diff = date - start;
		return Math.floor(diff / 86400000);
	}

	/* Finestra di buio: dal tramonto+crepuscolo civile (~30 min)
	   all'alba-crepuscolo civile (~30 min). Approssimazione sinusoidale
	   tarata sull'Italia centrale. */
	function getDarknessWindow(dayOfYear) {
		const phase = ((dayOfYear - 172) * 2 * Math.PI) / 365;
		const darkStart = 18.85 + 2.15 * Math.cos(phase) + 0.5;
		const darkEnd = 6.5 - 1.0 * Math.cos(phase) - 0.5;
		return { darkStart, darkEnd };
	}

	function isDark() {
		const now = getRomeNowForSignage();
		const nowHours = now.getHours() + now.getMinutes() / 60;
		const w = getDarknessWindow(getDayOfYear(now));
		return nowHours < w.darkEnd || nowHours >= w.darkStart;
	}

	function updateSignage() {
		if (!appHeader) return;
		if (isDark()) {
			appHeader.classList.add("is-lit");
		} else {
			appHeader.classList.remove("is-lit");
		}
	}

	updateSignage();
	setInterval(updateSignage, 60000);
})();
