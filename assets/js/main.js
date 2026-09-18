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
})();
