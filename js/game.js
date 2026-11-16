// מהלך המשחק: שאלות, בחירה, "תשובה סופית?", סולם, נכון/שגוי
(function () {
  const D = window.GAME_DATA;
  const $ = (id) => document.getElementById(id);
  const LETTERS = ["א", "ב", "ג", "ד"];
  const REVEAL_DELAY = { easy: 2500, medium: 3500, hard: 5000 };  // זמן מתח לפני חשיפה (יעודן בשלב העיצוב)
  const NEXT_DELAY = 2500;     // זמן אחרי תשובה נכונה לפני השאלה הבאה
  const WRONG_DELAY = 3000;    // זמן אזעקה/אדום לפני ניסיון חוזר

  let current = 0;     // אינדקס שאלה
  let selected = -1;
  let removed = [];    // תשובות שנמחקו ב-50:50 בשאלה הנוכחית
  let used = {};       // גלגלי הצלה שכבר נוצלו
  let phoneTimer = null;
  const SECS = D.questionSeconds || 30;
  let qLeft = 0, qTimer = null, qPaused = false; // שעון השאלה
  let roundId = 0;    // מבטל טיימרים ישנים של חשיפת תשובות
  let locked = false;  // חוסם לחיצות בזמן חשיפה

  const fmt = (n) => n.toLocaleString("he-IL") + " ₪";

  function buildLadder(ol) {
    ol = ol || $("ladder");
    ol.innerHTML = "";
    // מהגבוה לנמוך
    for (let i = D.ladder.length - 1; i >= 0; i--) {
      const li = document.createElement("li");
      li.dataset.level = i;
      if (D.safeLevels.includes(i + 1)) li.classList.add("safe");
      if (i === D.ladder.length - 1) li.classList.add("top");
      li.innerHTML = `<span class="n">${i + 1}</span><span class="v">${fmt(D.ladder[i])}</span>`;
      ol.appendChild(li);
    }
  }

  function updateLadder() {
    document.querySelectorAll("#ladder li").forEach((li) => {
      const lvl = +li.dataset.level;
      li.classList.toggle("current", lvl === current);
      li.classList.toggle("done", lvl < current);
    });
  }

  function difficultyOf(i) {
    const n = i + 1;
    if (n <= D.difficulty.easyUntil) return "easy";
    if (n <= D.difficulty.mediumUntil) return "medium";
    return "hard";
  }

  function showQuestion(isRetry) {
    const q = D.questions[current];
    selected = -1;
    if (!isRetry) removed = [];
    stopQTimer();
    renderQTimer(SECS);
    locked = true; //נפתח אחרי שכל התשובות נחשפו
    $("confirm").classList.add("hidden");
    $("q-meta").textContent = `שאלה ${current + 1} מתוך ${D.questions.length} · ${fmt(D.ladder[current])}`;
    $("m-progress").firstElementChild.style.width = ((current + 1) / D.questions.length * 100) + "%";
    $("question").textContent = q.q;
    document.body.dataset.difficulty = difficultyOf(current);

    const box = $("answers");
    box.innerHTML = "";
    q.a.forEach((text, i) => {
      const b = document.createElement("button");
      b.className = "answer";
      b.dataset.i = i;
      b.innerHTML = `<b>${LETTERS[i]}.</b> <span>${text}</span>`;
      b.onclick = () => choose(i);
      b.classList.add("hidden-a");
      if (removed.includes(i)) b.classList.add("removed");
      box.appendChild(b);
    });
    updateLadder();
    window.Sfx.music(difficultyOf(current)); // מתגברת לפי שלב הקושי

    //הופעת השאלה, ואז התשובות אחת אחת
    const qEl = $("question");
    if (!isRetry) {
      qEl.classList.remove("enter");
      void qEl.offsetWidth;
      qEl.classList.add("enter");
    }
    const first = isRetry ? 200 : 1200;
    const step = isRetry ? 150 : 750;
    const round = ++roundId;
    q.a.forEach((_, i) => {
      setTimeout(() => {
        if (round !== roundId) return;
        answerEl(i).classList.remove("hidden-a");
        if (i === q.a.length - 1) { locked = false; startQTimer(); }
      }, first + i * step);
    });
  }

  function answerEl(i) { return document.querySelector(`.answer[data-i="${i}"]`); }

  function choose(i) {
    if (locked) return;
    document.querySelectorAll(".answer").forEach((b) => b.classList.remove("selected"));
    selected = i;
    answerEl(i).classList.add("selected");
    $("confirm").classList.remove("hidden");
  }

  function cancel() {
    if (locked) return;
    selected = -1;
    document.querySelectorAll(".answer").forEach((b) => b.classList.remove("selected"));
    $("confirm").classList.add("hidden");
  }

  function finalAnswer() {
    if (locked || selected < 0) return;
    locked = true;
    $("confirm").classList.add("hidden");
    // הבהוב מתח - ארוך יותר בשלבים הקשים
    stopQTimer();
    document.body.classList.add("suspense");
    answerEl(selected).classList.add("suspense");
    window.Sfx.play("final");
    setTimeout(reveal, REVEAL_DELAY[difficultyOf(current)]);
  }

  function reveal() {
    const q = D.questions[current];
    document.body.classList.remove("suspense");
    answerEl(selected).classList.remove("suspense");
    window.Sfx.music(null);
    window.Sfx.play(selected === q.correct ? "correct" : "wrong");
    if (selected === q.correct) {
      answerEl(selected).classList.remove("selected");
      answerEl(selected).classList.add("correct");
      document.body.classList.add("win");
      setTimeout(() => {
        document.body.classList.remove("win");
        if (current >= D.questions.length - 1) {
          window.showPrize();
        } else {
          showRoute(() => { current++; showQuestion(); });
        }
      }, NEXT_DELAY);
    } else {
      answerEl(selected).classList.add("wrong");
      document.body.classList.add("alarm");
      setTimeout(() => {
        document.body.classList.remove("alarm");
        showQuestion(true); //לא מפסידים: אותה שאלה, ניסיון חוזר
      }, WRONG_DELAY);
    }
  }

  // ===== גלגלי הצלה =====
  // ===== שעון השאלה =====
  function renderQTimer(v) {
    const el = $("q-timer");
    el.textContent = v;
    el.style.setProperty("--p", v / SECS * 100); // הטבעת שמתרוקנת
    el.classList.toggle("urgent", v <= 5);
  }

  function stopQTimer() { clearInterval(qTimer); qTimer = null; }

  function startQTimer() {
    stopQTimer();
    qLeft = SECS;
    renderQTimer(qLeft);
    qTimer = setInterval(() => {
      if (qPaused) return;
      qLeft--;
      if (qLeft <= 0) {            // הזמן נגמר: לא מפסידים, מתחילים מחדש
        window.Sfx.play("timeup");
        qLeft = SECS;
      } else if (qLeft <= 5) {
        window.Sfx.play("tick");
      }
      renderQTimer(qLeft);
    }, 1000);
  }

  // ===== מסך המסלול בין שאלה לשאלה =====
  function showRoute(done) {
    const ol = $("route-ladder");
    buildLadder(ol);
    const mark = (cur) => ol.querySelectorAll("li").forEach((li) => {
      const lvl = +li.dataset.level;
      li.classList.toggle("done", lvl < cur);
      li.classList.toggle("current", lvl === cur);
    });
    mark(current); // השלב שנכבש עכשיו
    const safe = D.safeLevels.includes(current + 1);
    $("route-msg").textContent = "יש לכם " + fmt(D.ladder[current]) + (safe ? " · נקודת ביטחון!" : "");
    $("route").classList.remove("hidden");
    $("route").classList.toggle("safe", safe);
    if (safe) { window.Sfx.play("safe"); window.confettiBurst(3800); } else window.Sfx.play("step");
    setTimeout(() => { mark(current + 1); window.Sfx.play("step"); }, 1700); // עוברים לשלב הבא
    setTimeout(() => { $("route").classList.add("hidden"); done(); }, safe ? 5200 : 3800);
  }

  function useLifeline(name) {
    if (locked || used[name]) return false;
    used[name] = true;
    $("ll-" + name).classList.add("used");
    return true;
  }

  function openModal(title, bodyHtml) {
    $("modal-title").textContent = title;
    $("modal-body").innerHTML = bodyHtml;
    $("modal").classList.remove("hidden");
    qPaused = true; // השעון עוצר בזמן גלגל הצלה
  }

  function closeModal() {
    clearInterval(phoneTimer);
    qPaused = false;
    $("modal").classList.add("hidden");
  }

  function fiftyFifty() {
    if (!useLifeline("fifty")) return;
    const q = D.questions[current];
    const wrong = q.a.map((_, i) => i).filter((i) => i !== q.correct);
    wrong.splice(Math.floor(Math.random() * wrong.length), 1); // משאירים שגויה אחת
    removed = wrong;
    removed.forEach((i) => answerEl(i).classList.add("removed"));
    if (removed.includes(selected)) cancel();
  }

  function phoneKids() {
    if (!useLifeline("phone")) return;
    openModal("טלפון לילדים",
      '<div id="timer" class="timer">30</div>' +
      '<button id="timer-start" class="big-btn">התקשרתם? מפעילים טיימר</button>');
    $("timer-start").onclick = () => {
      $("timer-start").remove();
      let left = 30;
      const t = $("timer");
      phoneTimer = setInterval(() => {
        left--;
        t.textContent = left;
        if (left > 0) window.Sfx.play("tick");
        if (left <= 5) t.classList.add("urgent");
        if (left <= 0) {
          clearInterval(phoneTimer);
          t.textContent = "הזמן נגמר!";
        }
      }, 1000);
    };
  }

  function askAudience() {
    if (!useLifeline("audience")) return;
    const q = D.questions[current];
    const active = q.a.map((_, i) => i).filter((i) => !removed.includes(i));
    const others = active.filter((i) => i !== q.correct);
    const pct = [0, 0, 0, 0];
    // הקהל נוטה לתשובה הנכונה
    pct[q.correct] = Math.round((others.length === 1 ? 62 : 46) + Math.random() * 22);
    let rest = 100 - pct[q.correct];
    const weights = others.map(() => 0.3 + Math.random());
    const wSum = weights.reduce((a, b) => a + b, 0);
    others.forEach((i, k) => {
      const v = k === others.length - 1 ? rest : Math.round((100 - pct[q.correct]) * weights[k] / wSum);
      pct[i] = Math.min(v, rest);
      rest -= pct[i];
    });

    const cols = q.a.map((_, i) =>
      `<div class="poll-col"><span class="poll-pct">${pct[i]}%</span>` +
      `<div class="poll-track"><div class="poll-bar" data-h="${pct[i]}"></div></div>` +
      `<b>${LETTERS[i]}</b></div>`).join("");
    openModal("עזרת הקהל", `<div class="poll">${cols}</div>`);
    setTimeout(() => {
      document.querySelectorAll(".poll-bar").forEach((b) => { b.style.height = b.dataset.h + "%"; });
    }, 100);
  }

  // אנימציית סיבוב קצרה לפני שהגלגל נפתח
  function withSpin(name, fn) {
    if (locked || used[name]) return;
    const ic = $("ll-" + name).firstElementChild;
    ic.classList.remove("spin");
    void ic.offsetWidth;
    ic.classList.add("spin");
    window.Sfx.play("step");
    locked = true;
    setTimeout(() => { locked = false; fn(); }, 650);
  }
  $("ll-fifty").onclick = () => withSpin("fifty", fiftyFifty);
  $("ll-phone").onclick = () => withSpin("phone", phoneKids);
  $("ll-audience").onclick = () => withSpin("audience", askAudience);
  $("modal-close").onclick = closeModal;

  window.startGame = function () {
    current = 0;
    used = {};
    removed = [];
    closeModal();
    document.querySelectorAll(".lifeline").forEach((b) => b.classList.remove("used"));
    buildLadder();
    showQuestion();
  };

  $("btn-final").onclick = finalAnswer;
  $("btn-cancel").onclick = cancel;
})();
