// צלילים ומוזיקה: הכל מסונתז בקוד (Web Audio).
// כדי להחליף צליל: שמים בתיקייה sounds קובץ mp3 בשם המתאים (ראו sounds/README.txt).
(function () {
  const NAMES = ["click", "final", "correct", "wrong", "tick", "timeup", "step", "safe", "select", "whoosh", "introhit", "prize",
                 "music-easy", "music-medium", "music-hard", "music-intro", "question", "lets-play", "commercial-break", "phone", "music-party"];
  const files = {};        // צלילים שהוחלפו בקובץ
  let ctx = null, master = null, noiseBuf = null;
  let muted = false;
  let musicMode = null, musicTimer = null, musicGain = null, musicFile = null, partyTimeout = null;

  // בדיקה אילו קבצים קיימים בתיקיית sounds
  NAMES.forEach((n) => {
    const a = new Audio();
    a.preload = "auto";
    a.addEventListener("canplaythrough", () => { files[n] = a; }, { once: true });
    a.addEventListener("error", () => {});
    a.src = "sounds/" + n + ".mp3";
  });

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.9;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp);
      comp.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") ctx.resume();
  }

  // תו בודד
  function tone(freq, t, dur, o) {
    o = o || {};
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type || "sine";
    osc.frequency.setValueAtTime(freq, t);
    if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.vol || 0.2, t + (o.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (o.cutoff) {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = o.cutoff;
      osc.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(o.dest || master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function chord(freqs, t, dur, o) { freqs.forEach((f) => tone(f, t, dur, o)); }

  function noise(t, dur, vol, hp, dest) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = hp || 3000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest || master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  // סחיפת רעש (וווש): תדר מרכזי שעובר מ-f0 ל-f1
  function sweep(t, dur, f0, f1, vol, dest) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest || master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  // ===== אפקטים =====
  const C = [261.63, 329.63, 392.0], F = [349.23, 440.0, 523.25], G = [392.0, 493.88, 587.33];
  const brass = (freqs, t, dur) => chord(freqs, t, dur, { type: "sawtooth", vol: 0.12, cutoff: 2200, attack: 0.03 });

  const synth = {
    click(t) { tone(900, t, 0.07, { type: "triangle", vol: 0.3, slideTo: 500 }); },
    timeup(t) {
      tone(660, t, 0.25, { type: "square", vol: 0.2, cutoff: 1500 });
      tone(440, t + 0.25, 0.5, { type: "square", vol: 0.2, cutoff: 1500 });
    },
    step(t) {
      tone(523.25, t, 0.12, { type: "triangle", vol: 0.25 });
      tone(783.99, t + 0.1, 0.3, { type: "triangle", vol: 0.25 });
    },
    safe(t) {
      brass(C, t, 0.25); brass(F, t + 0.3, 0.25);
      brass([523.25, 659.25, 783.99, 1046.5], t + 0.6, 1.8);
      tone(130.81, t + 0.6, 1.6, { type: "sine", vol: 0.45 });
      [1046.5, 1318.5, 1568, 2093].forEach((f, i) => tone(f, t + 0.7 + i * 0.12, 0.5, { type: "triangle", vol: 0.14 }));
      noise(t + 0.6, 1.2, 0.1, 6000);
    },
    select(t) {
      // צליל קצר בבחירת תשובה (לפני "תשובה סופית")
      tone(520, t, 0.09, { type: "triangle", vol: 0.28, slideTo: 760 });
      tone(1040, t + 0.04, 0.1, { type: "sine", vol: 0.1 });
      noise(t, 0.03, 0.08, 4000);
    },
    tick(t) { tone(1200, t, 0.04, { type: "square", vol: 0.1 }); },
    final(t) {
      // פגיעה עמוקה + סחיפה עולה
      tone(95, t, 1.3, { type: "sine", vol: 0.75, slideTo: 38 });
      tone(55, t, 1.9, { type: "sine", vol: 0.5 });
      tone(220, t, 0.9, { type: "sawtooth", vol: 0.08, cutoff: 900, slideTo: 880 });
      noise(t, 0.5, 0.25, 300);
      sweep(t, 0.9, 180, 2600, 0.14);
    },
    whoosh(t) { sweep(t, 0.7, 220, 3600, 0.24); },
    introhit(t) {
      // נפח עולה ואז פגיעה תזמורתית גדולה (בשנייה 1.5)
      sweep(t, 1.5, 120, 2800, 0.2);
      tone(110, t, 1.5, { type: "sawtooth", vol: 0.1, cutoff: 700, slideTo: 440, attack: 1.2 });
      tone(55, t, 1.5, { type: "sine", vol: 0.3, slideTo: 110, attack: 1.2 });
      const h = t + 1.5;
      tone(75, h, 2.2, { type: "sine", vol: 0.8, slideTo: 38 });
      chord([110, 130.81, 164.81, 220], h, 1.7, { type: "sawtooth", vol: 0.12, cutoff: 2200, attack: 0.02 });
      chord([440, 523.25, 659.25], h, 1.4, { type: "sawtooth", vol: 0.07, cutoff: 2800, attack: 0.02 });
      noise(h, 1.2, 0.28, 500);
    },
    correct(t) {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        tone(f, t + i * 0.11, 0.35, { type: "triangle", vol: 0.3 }));
      chord([523.25, 659.25, 783.99, 1046.5], t + 0.5, 1.6, { type: "sawtooth", vol: 0.1, cutoff: 2500, attack: 0.02 });
      tone(130.81, t + 0.5, 1.4, { type: "sine", vol: 0.4 });
      noise(t + 0.5, 0.9, 0.08, 7000);
    },
    wrong(t) {
      for (let i = 0; i < 12; i++) {
        tone(i % 2 ? 587.33 : 440, t + i * 0.25, 0.25, { type: "square", vol: 0.2, cutoff: 1800 });
      }
      tone(98, t, 3, { type: "sawtooth", vol: 0.2, cutoff: 400 });
    },
    prize(t) {
      brass(C, t, 0.2); brass(C, t + 0.25, 0.2); brass(C, t + 0.5, 0.2);
      brass(F, t + 0.75, 0.95); brass(G, t + 1.75, 0.95);
      brass([523.25, 659.25, 783.99, 1046.5], t + 2.75, 2.8);
      [130.81, 130.81, 130.81, 87.31, 98.0, 65.41].forEach((f, i) =>
        tone(f, t + [0, 0.25, 0.5, 0.75, 1.75, 2.75][i], [0.2, 0.2, 0.2, 0.9, 0.9, 2.6][i], { type: "sine", vol: 0.45 }));
      noise(t + 2.75, 2.2, 0.15, 6000);
      [1046.5, 1318.5, 1568, 2093].forEach((f, i) =>
        tone(f, t + 2.9 + i * 0.12, 0.5, { type: "triangle", vol: 0.14 }));
      partyTimeout = setTimeout(() => music("party"), 5000);
    }
  };

  function play(name) {
    ensure();
    if (name === "prize") stopMusic();
    const a = files[name];
    if (a) {
      a.currentTime = 0;
      a.muted = muted;
      a.play().catch(() => {});
      return;
    }
    if (synth[name]) synth[name](ctx.currentTime + 0.02);
  }

  // ===== מוזיקה =====
  const BPM = { easy: 92, medium: 112, hard: 132, party: 128, intro: 112 };
  const ROOTS = [110.0, 87.31, 73.42, 82.41];   // לה מינור, פה, רה מינור, מי
  const THIRDS = [1.189, 1.26, 1.189, 1.26];
  const MELODY = [[659.25, 523.25], [698.46, 440.0], [587.33, 698.46], [659.25, 830.61]];
  const PARTY_PROG = [1, 4 / 3, 3 / 2, 1];
  const PARTY_ARP = [1, 1.26, 1.498, 2, 1.498, 1.26, 1.498, 2];

  function scheduleStep(mode, s, t, d, out) {
    const p = s % 8;
    if (mode === "intro") {
      // מוזיקת פתיחה: פעימה דוחפת, בס, פגיעות פליז וסנר (לה מינור, פה, סול)
      const bar = Math.floor(s / 8) % 4;
      const root = [110.0, 110.0, 87.31, 98.0][bar];
      const m3 = [1.189, 1.189, 1.26, 1.26][bar];
      if (p === 0 || p === 4 || (p === 6 && bar % 2 === 1)) tone(135, t, 0.24, { type: "sine", vol: 0.6, slideTo: 45, dest: out });
      tone(p % 2 ? root * 2 : root, t, d * 0.85, { type: "sawtooth", vol: p % 2 ? 0.1 : 0.2, cutoff: 340, dest: out });
      if (p === 2 || p === 6) noise(t, 0.12, 0.17, 1800, out);
      if (p % 2 === 1) noise(t, 0.03, 0.05, 7000, out);
      if (p === 0) chord([root * 2, root * 2 * m3, root * 2 * 1.498, root * 4], t, d * 2.2, { type: "sawtooth", vol: 0.1, cutoff: 2000, attack: 0.02, dest: out });
      if (p === 4 && bar % 2 === 1) chord([root * 2, root * 2 * m3, root * 2 * 1.498], t, d * 1.2, { type: "sawtooth", vol: 0.08, cutoff: 1800, attack: 0.02, dest: out });
      if (p === 7) tone(root * 8 * m3, t, d * 1.5, { type: "sine", vol: 0.05, dest: out });
      return;
    }
    if (mode === "party") {
      const base = 130.81 * PARTY_PROG[Math.floor(s / 8) % 4];
      tone(base * 2 * PARTY_ARP[p], t, d * 1.1, { type: "triangle", vol: 0.14, dest: out });
      if (p % 2 === 0) tone(base / 2, t, d * 1.6, { type: "sine", vol: 0.4, dest: out });
      if (p % 4 === 2) noise(t, 0.08, 0.12, 3000, out);
      if (p === 0) chord([base, base * 1.26, base * 1.498], t, d * 8, { type: "sawtooth", vol: 0.05, cutoff: 1800, attack: 0.05, dest: out });
      return;
    }
    // מוזיקת מתח: דופק בס (לאב-דאב), דרון לא נוח, צלילים גבוהים בודדים; בכל רמה נוספות שכבות
    const bar = Math.floor(s / 8) % 4;
    const r = [110.0, 103.83, 98.0, 92.5][bar];   // יורד בהדרגה: לה, סול דיאז, סול, פה דיאז
    const lvl = mode === "easy" ? 0 : mode === "medium" ? 1 : 2;
    const beat = (v, f) => tone(r * f, t, 0.32, { type: "sine", vol: v, slideTo: r * f * 0.55, dest: out });
    if (p === 0) beat(0.7, 1);
    if (p === 2) beat(0.45, 1.2);
    if (lvl === 2 && p === 4) beat(0.6, 1);
    if (lvl === 2 && p === 6) beat(0.4, 1.2);
    if (lvl > 0) tone(r, t, d * 0.8, { type: "sawtooth", vol: 0.13, cutoff: 240 + lvl * 80, dest: out });
    if (p === 0) chord(lvl === 2 ? [r * 2, r * 2 * 1.414, r * 4] : [r * 2, r * 2 * 1.0595], t, d * 8, { type: "sawtooth", vol: 0.05, cutoff: 700, attack: 0.5, dest: out });
    const plink = [1.189, 1.414, 1.26, 1.5][bar];
    if (p === 5 && (lvl > 0 || bar % 2 === 0)) tone(r * 8 * plink, t, d * 2, { type: "sine", vol: 0.07, dest: out });
    if (lvl > 0 && p === 1) tone(r * 12 * plink, t, d * 1.5, { type: "sine", vol: 0.04, dest: out });
    if (lvl === 2) {
      if (p % 2 === 1) noise(t, 0.025, 0.06, 6000, out);
      if (p === 0 && bar % 2 === 1) tone(r * 4 * 1.414, t, d * 1.2, { type: "square", vol: 0.05, cutoff: 1800, dest: out });
    }
  }

  function stopMusic() {
    clearInterval(musicTimer);
    clearTimeout(partyTimeout);
    musicTimer = null;
    musicMode = null;
    if (musicGain) {
      const g = musicGain;
      g.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
      setTimeout(() => g.disconnect(), 600);
      musicGain = null;
    }
    if (musicFile) { musicFile.pause(); musicFile = null; }
  }

  // mode: "easy" / "medium" / "hard" / "party" / null (עצירה)
  function music(mode) {
    if (mode === musicMode) return;
    stopMusic();
    if (!mode) return;
    ensure();
    musicMode = mode;
    const a = files["music-" + mode];
    if (a) {
      a.loop = true; a.currentTime = 0; a.muted = muted;
      a.play().catch(() => {});
      musicFile = a;
      return;
    }
    const out = ctx.createGain();
    out.gain.value = 0.8;
    out.connect(master);
    musicGain = out;
    const d = 60 / BPM[mode] / 2; // שמינית
    let step = 0, next = ctx.currentTime + 0.06;
    musicTimer = setInterval(() => {
      while (next < ctx.currentTime + 0.3) {
        scheduleStep(mode, step, next, d, out);
        next += d;
        step++;
      }
    }, 60);
  }

  function toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.9;
    Object.values(files).forEach((a) => { a.muted = muted; });
    document.getElementById("btn-mute").textContent = muted ? "🔇" : "🔊";
  }

  // צליל לחיצה לכל כפתור (חוץ מ"תשובה סופית" שיש לו צליל משלו)
  document.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.id === "btn-mute") { toggleMute(); return; }
    if (b.id !== "btn-final" && !b.classList.contains("answer")) play("click"); // לתשובות יש צליל משלהן
  });

  window.Sfx = { play, music, has: (n) => !!files[n], stop: (n) => { const x = files[n]; if (x) x.pause(); }, playing: () => !!(musicFile && !musicFile.paused) };
})();
