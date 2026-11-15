// ניהול מסכים: פתיחה, מצגת, כרטיס טיסה, קונפטי, ברכה
(function () {
  const D = window.GAME_DATA;
  const $ = (id) => document.getElementById(id);

  function showScreen(name) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
    $("screen-" + name).classList.add("active");
  }
  window.showScreen = showScreen;

  function placeholders(box, n) {
    for (let i = 0; i < n; i++) {
      const d = document.createElement("div");
      d.className = "empty";
      d.textContent = "מקום לתמונה";
      box.appendChild(d);
    }
  }

  // ===== מצגת פתיחה: תמונה אחת בכל פעם, מתחלפת לבד =====
  let slideTimer = null;
  function startSlideshow() {
    const box = $("slides");
    box.innerHTML = "";
    clearInterval(slideTimer);
    if (!D.introPhotos.length) { placeholders(box, 3); return; }
    const imgs = D.introPhotos.map((src, i) => {
      const img = document.createElement("img");
      img.src = src;
      img.className = "slide" + (i === 0 ? " on" : "");
      box.appendChild(img);
      return img;
    });
    box.classList.add("show");
    let cur = 0;
    slideTimer = setInterval(() => {
      imgs[cur].classList.remove("on");
      cur = (cur + 1) % imgs.length;
      imgs[cur].classList.add("on");
    }, 3500);
  }

  // ===== קונפטי =====
  const cv = $("confetti");
  const c2 = cv.getContext("2d");
  const COLORS = ["#b57bff", "#ead9ff", "#d9dee8", "#ffffff", "#5b8cff", "#8e97aa"];
  let parts = [], raf = null;

  function newPart(anywhere) {
    const s = Math.max(1, cv.width / 1400);
    return {
      x: Math.random() * cv.width,
      y: anywhere ? Math.random() * -cv.height : -20,
      w: (6 + Math.random() * 9) * s,
      h: (10 + Math.random() * 12) * s,
      vx: (Math.random() - 0.5) * 3 * s,
      vy: (2 + Math.random() * 4) * s,
      rot: Math.random() * 6.28,
      vr: (Math.random() - 0.5) * 0.3,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]
    };
  }

  function confettiLoop() {
    c2.clearRect(0, 0, cv.width, cv.height);
    parts.forEach((p, i) => {
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      if (p.y > cv.height + 30) parts[i] = newPart(false);
      c2.save();
      c2.translate(p.x, p.y);
      c2.rotate(p.rot);
      c2.fillStyle = p.color;
      c2.fillRect(-p.w / 2, -p.h / 2 * Math.cos(p.rot * 2), p.w, p.h * Math.cos(p.rot * 2));
      c2.restore();
    });
    raf = requestAnimationFrame(confettiLoop);
  }

  function startConfetti() {
    cv.width = cv.clientWidth;
    cv.height = cv.clientHeight;
    const count = Math.min(180, Math.round(cv.width * cv.height / 11000)); // פחות קונפטי במסך קטן
    parts = Array.from({ length: count }, () => newPart(true));
    if (!raf) confettiLoop();
  }

  function stopConfetti() {
    cancelAnimationFrame(raf);
    raf = null;
    c2.clearRect(0, 0, cv.width, cv.height);
  }

  // ===== מסך הפרס =====
  window.showPrize = function () {
    $("t-passengers").textContent = D.ticket.passengers;
    $("t-destination").textContent = D.ticket.destination;
    $("t-dates").textContent = D.ticket.dates;
    showScreen("prize");
    const s = $("screen-prize");
    s.classList.remove("reveal");
    void s.offsetWidth; // מפעיל את האנימציה מחדש
    s.classList.add("reveal");
    window.Sfx.play("prize");
    setTimeout(startConfetti, 1200);
  };

  function showGreeting() {
    $("greeting-text").textContent = D.greeting.text;
    const box = $("greeting-photos");
    box.innerHTML = "";
    if (D.greeting.photos.length) {
      D.greeting.photos.forEach((src) => {
        const img = document.createElement("img");
        img.src = src;
        box.appendChild(img);
      });
    } else {
      placeholders(box, 3);
    }
    showScreen("greeting");
  }

  function restart() {
    window.Sfx.music(null);
    stopConfetti();
    clearInterval(slideTimer);
    showScreen("intro");
  }

  $("title").textContent = D.title;
  $("subtitle").textContent = D.subtitle;

  $("btn-start").onclick = () => { showScreen("slideshow"); startSlideshow(); };
  $("btn-slides-next").onclick = () => { clearInterval(slideTimer); showScreen("game"); window.startGame(); };
  $("btn-prize-next").onclick = showGreeting;
  $("btn-restart").onclick = restart;
})();
