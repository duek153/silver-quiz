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
      const wrap = document.createElement("div");
      wrap.className = "slide" + (i === 0 ? " on" : "");
      wrap.style.setProperty("--img", "url('" + new URL(src, document.baseURI).href + "')"); // כתובת מלאה, כי משתנה CSS נקרא יחסית לקובץ ה-CSS
      const img = document.createElement("img");
      img.src = src;
      wrap.appendChild(img);
      box.appendChild(wrap);
      return wrap;
    });
    box.classList.add("show");
    let cur = 0;
    slideTimer = setInterval(() => {
      imgs[cur].classList.remove("on");
      cur = (cur + 1) % imgs.length;
      imgs[cur].classList.add("on");
    }, 3500);
  }

  // ===== קונפטי: פיצוץ מהצדדים ואז גשם עדין =====
  const cv = $("confetti");
  const c2 = cv.getContext("2d");
  const COLORS = ["#b57bff", "#ead9ff", "#d9dee8", "#ffffff", "#5b8cff", "#8e97aa"];
  let parts = [], raf = null, rainOn = true;
  const scale = () => Math.max(1, cv.width / 1400);

  function base(s) {
    return {
      w: (6 + Math.random() * 9) * s,
      h: (10 + Math.random() * 12) * s,
      rot: Math.random() * 6.28,
      vr: (Math.random() - 0.5) * 0.3,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]
    };
  }
  function rainPart(anywhere) {
    const s = scale();
    return Object.assign(base(s), {
      x: Math.random() * cv.width,
      y: anywhere ? Math.random() * -cv.height : -20,
      vx: (Math.random() - 0.5) * 2 * s,
      vy: (1.4 + Math.random() * 2.2) * s
    });
  }
  function burstPart(fromLeft) {
    const s = scale();
    const sp = (9 + Math.random() * 15) * s, ang = (Math.random() * 35 + 40) * Math.PI / 180;
    return Object.assign(base(s), {
      burst: true,
      x: fromLeft ? 0 : cv.width,
      y: cv.height * 0.95,
      vx: (fromLeft ? 1 : -1) * Math.cos(ang) * sp,
      vy: -Math.sin(ang) * sp
    });
  }

  function confettiLoop() {
    const s = scale();
    c2.clearRect(0, 0, cv.width, cv.height);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      if (p.burst) { p.vy += 0.32 * s; p.vx *= 0.99; }
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      if (p.y > cv.height + 30) {
        if (rainOn) parts[i] = rainPart(false); // אחרי הפיצוץ: ממשיכים כגשם
        else parts.splice(i, 1);
        continue;
      }
      c2.save();
      c2.translate(p.x, p.y);
      c2.rotate(p.rot);
      c2.fillStyle = p.color;
      c2.fillRect(-p.w / 2, -p.h / 2 * Math.cos(p.rot * 2), p.w, p.h * Math.cos(p.rot * 2));
      c2.restore();
    }
    raf = requestAnimationFrame(confettiLoop);
  }

  // rain=false: רק פיצוץ חד פעמי (לנקודות ביטחון)
  function startConfetti(rain) {
    rainOn = rain !== false;
    cv.width = cv.clientWidth;
    cv.height = cv.clientHeight;
    const area = cv.width * cv.height;
    const nBurst = Math.min(110, Math.round(area / 16000)), nRain = Math.min(70, Math.round(area / 30000));
    parts = [];
    for (let i = 0; i < nBurst; i++) { parts.push(burstPart(true)); parts.push(burstPart(false)); }
    if (rainOn) for (let i = 0; i < nRain; i++) parts.push(rainPart(true));
    if (!raf) confettiLoop();
  }

  function stopConfetti() {
    cancelAnimationFrame(raf);
    raf = null;
    c2.clearRect(0, 0, cv.width, cv.height);
  }
  window.confettiBurst = function (ms) { startConfetti(false); setTimeout(stopConfetti, ms || 3500); };

  // ===== מסך הפרס =====
  window.showPrize = function () {
    $("t-passengers").textContent = D.ticket.passengers;
    $("t-destination").textContent = D.ticket.destination;
    $("t-dates").textContent = D.ticket.dates;
    $("t-hotel").textContent = D.ticket.hotel;
    $("t-hotel-note").textContent = D.ticket.hotelNote;
    showScreen("prize");
    const s = $("screen-prize");
    s.classList.remove("reveal");
    void s.offsetWidth; // מפעיל את האנימציה מחדש
    s.classList.add("reveal");
    // ספירה לאחור בחשכה, ואז הכרטיס נחשף (תואם ל---d ב-CSS)
    [200, 1200, 2200].forEach((t) => setTimeout(() => window.Sfx.play("step"), t));
    setTimeout(() => window.Sfx.play("prize"), 3400);
    setTimeout(() => startConfetti(true), 4600);
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
  $("btn-prize-next").onclick = D.showGreeting ? showGreeting : restart;
  if (!D.showGreeting) $("btn-prize-next").textContent = "משחק חדש";
  $("btn-restart").onclick = restart;
})();
