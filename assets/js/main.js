(function () {
	"use strict";

	const deck = document.querySelector(".deck");
	if (!deck) return;

	const slides = Array.from(deck.querySelectorAll(".slide"));
	const dots = Array.from(document.querySelectorAll(".dot"));
	const prevBtn = document.getElementById("prevBtn");
	const nextBtn = document.getElementById("nextBtn");

	if (!slides.length || !prevBtn || !nextBtn) return;

	let currentIndex = 0;

	/* Aggiorna dots e stato delle frecce in base alla slide corrente */
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
	}

	/* Vai alla slide n */
	function goTo(index) {
		if (index < 0 || index >= slides.length) return;
		currentIndex = index;
		deck.scrollTo({ left: index * deck.clientWidth });
		updateUI();
	}

	/* Frecce */
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

	/* Sincronizza stato quando l'utente scorre con swipe o trackpad */
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

	/* Stato iniziale */
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

	function applyConsent(analytics) {
		if (analytics) loadGoogleAnalytics();
		else unloadGoogleAnalytics();
		/* Il caricamento della mappa verrà agganciato qui nel commit dedicato */
		banner.classList.add("hidden");
	}

	/* Stato iniziale */
	const existingConsent = getConsent();
	if (existingConsent) {
		applyConsent(existingConsent.analytics);
	}

	/* Bottoni */
	document.getElementById("acceptCookies").addEventListener("click", () => {
		setConsent(true);
		applyConsent(true);
	});

	document.getElementById("rejectCookies").addEventListener("click", () => {
		setConsent(false);
		applyConsent(false);
	});

	/* ============================================================
	   MODALE PRIVACY
	   ============================================================ */
	const policyModal = document.getElementById("policyModal");
	const policyClose = document.getElementById("policyClose");
	const openPrivacyLink = document.getElementById("openPrivacyLink");
	const reopenCookieSettings = document.getElementById("reopenCookieSettings");
	const policyLinkFromBanner = document.getElementById("openPolicyFromBanner");

	function openPolicy() {
		policyModal.classList.add("show");
	}

	function closePolicy() {
		policyModal.classList.remove("show");
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

	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape" && policyModal.classList.contains("show")) {
			closePolicy();
		}
	});

	/* Modifica preferenze cookie: rimuove la scelta e riapre il banner */
	if (reopenCookieSettings) {
		reopenCookieSettings.addEventListener("click", (e) => {
			e.preventDefault();
			localStorage.removeItem(COOKIE_KEY);
			closePolicy();
			banner.classList.remove("hidden");
		});
	}

	/* ============================================================
	   MODALE RECENSIONE
	   ============================================================ */
	const ratingTrigger = document.getElementById("ratingTrigger");
	const reviewModal = document.getElementById("reviewModal");
	const reviewDismiss = document.getElementById("reviewDismiss");

	function openReview() {
		reviewModal.classList.add("show");
	}

	function closeReview() {
		reviewModal.classList.remove("show");
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

	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape" && reviewModal.classList.contains("show")) {
			closeReview();
		}
	});
})();
