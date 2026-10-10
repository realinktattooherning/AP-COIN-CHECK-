// The scan stage (landing page only): the coin's live chart behind, an opaline jellyfish in front whose arms
// reach out to each bot while it checks and pull its finding in when it is done.
// The bell and silk follow the same parametric shapes and colours as the membrane on alexporsing.dk (package-orbit.js),
// drawn on a 2D canvas so it also runs inside the Chrome extension (no remote scripts).
(() => {
  const el = document.getElementById("stage");
  if (!el) return;
  const cv = el.querySelector("canvas"), ctx = cv.getContext("2d");
  const cardsBox = el.querySelector(".stage-cards"), cap = el.querySelector(".stage-cap"), frame = el.querySelector(".stage-chart");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const TAU = Math.PI * 2;
  const COL = { GRN: "47,209,129", YEL: "246,181,61", RED: "255,74,94", NA: "102,119,139", SKIP: "59,72,89", BUSY: "111,168,255" };
  let crew = [], arms = [], w = 0, h = 0, dpr = 1, raf = 0, t0 = performance.now(), lastAddr = "";

  const { opal, bell } = DKJelly;

  function layout() {
    const r = el.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = r.width; h = r.height;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // cards: on a ring around the jellyfish when wide, two rows under it on a phone
    const narrow = w < 720, n = crew.length;
    [...cardsBox.children].forEach((c, i) => {
      let x, y;
      if (narrow) { x = (i % 2 ? 0.75 : 0.25) * w; y = h * 0.58 + Math.floor(i / 2) * (h * 0.14); }
      else { const ang = -Math.PI / 2 + (i + 0.5) / n * TAU; x = w / 2 + Math.cos(ang) * w * 0.37; y = h * 0.5 + Math.sin(ang) * h * 0.36; }
      c.style.left = x + "px"; c.style.top = y + "px";
    });
  }

  function center() { return w < 720 ? [w / 2, h * 0.2] : [w / 2, h * 0.42]; }
  function scale() { return w < 720 ? Math.min(w, h) / 560 : Math.min(w, h) / 520; }

  function draw(now) {
    raf = 0;
    const t = (now - t0) / 1000;
    ctx.clearRect(0, 0, w, h);
    const [cx, cy] = center(), s = scale();
    const P = p => [cx + p[0] * s, cy - (p[1] - 60) * s];
    ctx.globalCompositeOperation = "lighter";
    DKJelly.drawBody(ctx, cx, cy, s, t);
    ctx.globalCompositeOperation = "lighter";

    // arms: one per bot, reaching to its card while it checks, pulling back with a pulse when it is done
    const boxR = el.getBoundingClientRect();
    [...cardsBox.children].forEach((card, i) => {
      const arm = arms[i]; if (!arm) return;
      const target = arm.busy ? 1 : 0.18;
      arm.reach += (target - arm.reach) * (arm.busy ? 0.035 : 0.06);
      const cr = card.getBoundingClientRect();
      const tx = cr.left - boxR.left + cr.width / 2, ty = cr.top - boxR.top + cr.height / 2;
      const ang = Math.atan2(ty - cy, tx - cx);
      const root = P(bell((ang / TAU + 1) % 1, 0.95, t));
      const ex = root[0] + (tx - root[0]) * arm.reach, ey = root[1] + (ty - root[1]) * arm.reach;
      const nx = -(ey - root[1]), ny = ex - root[0], nl = Math.hypot(nx, ny) || 1;
      const col = COL[arm.st] || COL.SKIP;
      ctx.beginPath();
      for (let j = 0; j <= 24; j++) {
        const v = j / 24, wob = Math.sin(v * 7 - t * 3 + i) * (10 + 18 * v) * s * (arm.busy ? 1 : 0.4) * Math.sin(v * Math.PI);
        const x = root[0] + (ex - root[0]) * v + nx / nl * wob, y = root[1] + (ey - root[1]) * v + ny / nl * wob;
        j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.strokeStyle = `rgba(${arm.busy ? opal(i, 0.7, t, 0.5) : col},${arm.busy ? 0.55 : 0.35})`;
      ctx.lineWidth = 2.2 * s; ctx.stroke();
      // the finding travels up the arm into the bell
      const since = (now - arm.doneAt) / 900;
      if (!arm.busy && since < 1) {
        const v = 1 - since, x = root[0] + (tx - root[0]) * v, y = root[1] + (ty - root[1]) * v;
        const pg = ctx.createRadialGradient(x, y, 0, x, y, 16 * s);
        pg.addColorStop(0, `rgba(${col},.95)`); pg.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = pg; ctx.fillRect(x - 16 * s, y - 16 * s, 32 * s, 32 * s);
      }
      if (arm.busy) {
        const gp = ctx.createRadialGradient(ex, ey, 0, ex, ey, 10 * s);
        gp.addColorStop(0, `rgba(${COL.BUSY},.9)`); gp.addColorStop(1, `rgba(${COL.BUSY},0)`);
        ctx.fillStyle = gp; ctx.fillRect(ex - 10 * s, ey - 10 * s, 20 * s, 20 * s);
      }
    });
    ctx.globalCompositeOperation = "source-over";
    const animating = arms.some(a => a.busy || performance.now() - a.doneAt < 1500);
    if (!el.hidden && !document.hidden && (!reduced.matches || animating) && isOnScreen()) raf = requestAnimationFrame(draw);
  }
  const isOnScreen = () => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; };
  const kick = () => { if (!raf && !el.hidden) raf = requestAnimationFrame(draw); };

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  window.stageUpdate = (addr, name, pair, state, pending, buy, label, tone) => {
    el.hidden = false;
    if (addr !== lastAddr) {
      lastAddr = addr; arms = [];
      frame.innerHTML = "";
    }
    // the coin's own chart: DexScreener's embed for the pair the scan is reading
    if (!frame.firstChild && pair && pair.pairAddress && pair.chainId) {
      frame.innerHTML = `<iframe title="Live chart on DexScreener" loading="lazy" referrerpolicy="no-referrer"
        src="https://dexscreener.com/${encodeURIComponent(pair.chainId)}/${encodeURIComponent(pair.pairAddress)}?embed=1&theme=dark&chartTheme=dark&trades=0&info=0&interval=15"></iframe>`;
    }
    crew = state;
    if (cardsBox.children.length !== state.length) cardsBox.innerHTML = state.map(() => `<div class="sc"></div>`).join("");
    state.forEach((c, i) => {
      const prev = arms[i];
      arms[i] = { reach: prev ? prev.reach : 0, busy: c.busy, st: c.st, doneAt: prev && prev.busy && !c.busy ? performance.now() : prev ? prev.doneAt : -1e9 };
      const card = cardsBox.children[i];
      card.className = `sc b-${c.st}`;
      card.innerHTML = `<b>${esc(c.name)}</b><span>${esc(c.line)}</span><i class="sc-ticks">${c.ticks.map(k => `<i class="tick s-${k.s}"></i>`).join("")}</i>`;
    });
    const busy = state.filter(c => c.busy).map(c => c.name.replace(" bot", ""));
    cap.innerHTML = busy.length
      ? `<span class="spinner" aria-hidden="true"></span> Checking ${esc(busy.join(", ").toLowerCase())} on <b>${esc(String(name).startsWith("$") ? name : "$" + name)}</b>`
      : `<span class="verdict-tag v-${esc(tone === "na" ? "hold" : tone)}">${esc(label)}</span> <b>${esc(String(name).startsWith("$") ? name : "$" + name)}</b> · ${state.filter(c => c.st === "RED").length} bots found red flags`;
    layout(); kick();
  };
  addEventListener("resize", () => { if (!el.hidden) { layout(); kick(); } });
  addEventListener("scroll", kick, { passive: true });
  document.addEventListener("visibilitychange", kick);
})();
