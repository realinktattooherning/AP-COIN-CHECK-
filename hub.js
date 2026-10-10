// Landing page: the jellyfish in the hero, the turning four-way menu (hub) and the live paper trades.
// The hub works like the show-package orbit on alexporsing.dk: the section pins while you scroll, the four cards turn
// around the jellyfish, and the card in front decides which panel shows underneath. Tap a card to jump to it.
(() => {
  "use strict";
  if (!window.DKJelly) return;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const t0 = performance.now();
  const sizeCanvas = cv => {
    const r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    if (cv.width !== Math.round(r.width * dpr) || cv.height !== Math.round(r.height * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
    const ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: r.width, h: r.height };
  };
  const onScreen = el => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; };

  // ---------- hero jellyfish ----------
  const hero = document.getElementById("hero-jelly");
  function drawHero(now) {
    const { ctx, w, h } = sizeCanvas(hero);
    ctx.clearRect(0, 0, w, h);
    DKJelly.drawBody(ctx, w / 2, h * 0.36, Math.min(w, h) / 380, (now - t0) / 1000);
  }

  // ---------- hub ----------
  const hub = document.getElementById("hub");
  const pin = hub && hub.querySelector(".hub-pin"), cv = hub && hub.querySelector(".hub-jelly");
  const cards = hub ? [...hub.querySelectorAll(".hub-card")] : [];
  const panels = hub ? [...hub.querySelectorAll(".hub-panel")] : [];
  const tabs = hub ? [...hub.querySelectorAll(".hub-tabs a")] : [];
  const n = cards.length;
  let active = -1, phase = 0, jumping = false;

  function show(i) {
    if (i === active || i < 0 || i >= n) return;
    active = i;
    const key = cards[i].dataset.panel;
    panels.forEach(p => { p.hidden = p.dataset.panel !== key; });
    cards.forEach((c, j) => c.classList.toggle("is-front", j === i));
    tabs.forEach(a => a.classList.toggle("is-on", a.dataset.panel === key));
  }
  // scroll progress through the pinned part: 0 = first card in front, 1 = last card in front
  function progress() {
    const r = pin.getBoundingClientRect(), travel = Math.max(1, pin.offsetHeight - innerHeight);
    return Math.min(1, Math.max(0, -r.top / travel));
  }
  function layoutCards() {
    const r = hub.querySelector(".hub-sticky").getBoundingClientRect();
    const narrow = r.width < 720, rx = narrow ? r.width * 0.30 : Math.min(420, r.width * 0.34), cy = narrow ? r.height * 0.66 : r.height * 0.6;
    cards.forEach((c, i) => {
      const a = (i - phase * (n - 1)) / n * Math.PI * 2;
      const z = Math.cos(a), x = Math.sin(a) * rx, k = (z + 1) / 2;
      c.style.transform = `translate(-50%, -50%) translate(${x}px, ${cy - r.height / 2 + z * 26}px) scale(${0.62 + 0.38 * k})`;
      c.style.opacity = (0.25 + 0.75 * k).toFixed(3);
      c.style.zIndex = String(Math.round(100 + z * 100));
      c.style.filter = k < 0.6 ? `blur(${((0.6 - k) * 3).toFixed(1)}px)` : "none";
    });
  }
  function drawHub(now) {
    const { ctx, w, h } = sizeCanvas(cv);
    ctx.clearRect(0, 0, w, h);
    const narrow = w < 720, cx = w / 2, cy = narrow ? h * 0.3 : h * 0.34, s = Math.min(w, h) / (narrow ? 520 : 600), t = (now - t0) / 1000;
    DKJelly.drawBody(ctx, cx, cy, s, t);
    // one arm reaches for the card in front
    const front = cards[active];
    if (!front) return;
    const br = cv.getBoundingClientRect(), fr = front.getBoundingClientRect();
    const tx = fr.left - br.left + fr.width / 2, ty = fr.top - br.top + 6;
    const root = DKJelly.bell(0.25, 0.95, t), rx0 = cx + root[0] * s * 0.2, ry0 = cy - (root[1] - 60) * s;
    ctx.globalCompositeOperation = "lighter";
    ctx.beginPath();
    for (let j = 0; j <= 30; j++) {
      const v = j / 30, wob = Math.sin(v * 8 - t * 2.4) * 14 * s * Math.sin(v * Math.PI);
      const x = rx0 + (tx - rx0) * v + wob, y = ry0 + (ty - ry0) * v;
      j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.strokeStyle = `rgba(${DKJelly.opal(t, 0.7, t, 0.5)},.55)`; ctx.lineWidth = 2.2 * s; ctx.lineCap = "round"; ctx.stroke();
    const g = ctx.createRadialGradient(tx, ty, 0, tx, ty, 14 * s);
    g.addColorStop(0, "rgba(255,255,255,.9)"); g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g; ctx.fillRect(tx - 14 * s, ty - 14 * s, 28 * s, 28 * s);
    ctx.globalCompositeOperation = "source-over";
  }
  // jump: scroll the pin so card i turns to the front, then show its panel
  function goTo(i, toPanel) {
    if (!pin) return;
    const travel = Math.max(1, pin.offsetHeight - innerHeight);
    const y = scrollY + pin.getBoundingClientRect().top + travel * (n > 1 ? i / (n - 1) : 0);
    show(i);
    jumping = true;
    const behavior = reduced.matches ? "auto" : "smooth";
    if (toPanel) document.getElementById("p-" + cards[i].dataset.panel).scrollIntoView({ behavior, block: "start" });
    else scrollTo({ top: y, behavior });
    setTimeout(() => { jumping = false; }, 900);
  }
  if (hub) {
    cards.forEach((c, i) => c.addEventListener("click", () => (i === active ? goTo(i, true) : goTo(i, false))));
    tabs.forEach(a => a.addEventListener("click", e => { e.preventDefault(); goTo(cards.findIndex(c => c.dataset.panel === a.dataset.panel), true); }));
    // old links (#checks, #videos, #extension …) and the top nav open the panel that holds them
    const openHash = () => {
      const id = decodeURIComponent(location.hash.slice(1));
      const el = id && document.getElementById(id);
      const panel = el && el.closest(".hub-panel");
      if (!panel) return;
      show(cards.findIndex(c => c.dataset.panel === panel.dataset.panel));
      requestAnimationFrame(() => el.scrollIntoView({ block: "start" }));
    };
    addEventListener("hashchange", openHash);
    // any in-page link to something inside a panel (e.g. "Beginner? Start safely") opens that panel first
    document.addEventListener("click", e => {
      const a = e.target.closest('a[href^="#"]');
      if (!a || a.getAttribute("href").startsWith("#p-")) return;
      const el = document.getElementById(decodeURIComponent(a.getAttribute("href").slice(1)));
      const panel = el && el.closest(".hub-panel");
      if (!panel) return;
      e.preventDefault();
      show(cards.findIndex(c => c.dataset.panel === panel.dataset.panel));
      jumping = true; setTimeout(() => { jumping = false; }, 1200);
      requestAnimationFrame(() => el.scrollIntoView({ behavior: reduced.matches ? "auto" : "smooth", block: "start" }));
      history.replaceState(null, "", "#" + el.id);
    });
    document.querySelectorAll('a[href^="#p-"]').forEach(a => a.addEventListener("click", e => {
      const i = cards.findIndex(c => "#p-" + c.dataset.panel === a.getAttribute("href"));
      if (i >= 0) { e.preventDefault(); goTo(i, true); }
    }));
    show(0);
    openHash();
  }

  function frame(now) {
    if (hero && onScreen(hero)) drawHero(now);
    if (hub) {
      phase = progress();
      layoutCards();
      // only the pinned stage picks the panel; below it, a tab or card choice stays put
      const pr = pin.getBoundingClientRect();
      if (!jumping && pr.top <= 1 && pr.bottom >= innerHeight - 1) show(Math.round(phase * (n - 1)));
      if (onScreen(cv)) drawHub(now);
    }
    if (!reduced.matches) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  if (reduced.matches) { addEventListener("scroll", () => requestAnimationFrame(frame), { passive: true }); addEventListener("resize", () => requestAnimationFrame(frame)); }

  // ---------- live paper trades (written by the GitHub Actions bot to the paper-data branch) ----------
  const PAPER = "https://raw.githubusercontent.com/realinktattooherning/AP-COIN-CHECK-/paper-data/state.json";
  const box = document.getElementById("paper-stats");
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const usd = n => n == null ? "?" : Math.abs(n) >= 1e6 ? "$" + (n / 1e6).toFixed(1) + "M" : Math.abs(n) >= 1e3 ? "$" + (n / 1e3).toFixed(1) + "K" : "$" + Number(n).toFixed(2);
  const pct = r => (r >= 0 ? "+" : "") + (r * 100).toFixed(1) + "%";
  const ago = iso => { const m = Math.round((Date.now() - Date.parse(iso)) / 60e3); return m < 1 ? "just now" : m < 60 ? m + " min ago" : Math.floor(m / 60) + " h " + (m % 60) + " min ago"; };
  async function paper() {
    if (!box) return;
    let st;
    try { const r = await fetch(PAPER + "?t=" + Math.floor(Date.now() / 60e3), { cache: "no-store" }); if (!r.ok) throw 0; st = await r.json(); }
    catch { box.innerHTML = `<div class="stat"><p>The paper bot has not published yet. It runs about every 30 minutes.</p></div>`; return; }
    const s = st.summary || {}, total = (s.realized || 0) + (s.unrealized || 0);
    box.innerHTML = [
      [s.open ?? 0, "open paper positions"],
      [`${s.wins ?? 0}/${s.closed ?? 0}`, "closed trades in profit (after 2% costs)"],
      [usd(s.realized || 0), "realized result on $100 per trade", (s.realized || 0) >= 0 ? "" : " red"],
      [usd(total), "including open positions at current quotes", total >= 0 ? "" : " red"],
    ].map(([v, t, c = ""]) => `<div class="stat"><span class="num${c}">${esc(v)}</span><p>${esc(t)}</p></div>`).join("");
    const row = (p, closed) => {
      const r = closed ? p.net : p.ret, tone = r > 0 ? "go" : r < 0 ? "stop" : "hold";
      return `<li class="radar-hit paper-row">
        <span class="verdict-tag v-${tone}">${closed ? pct(p.net) : p.status === "UNKNOWN" ? "unknown" : pct(p.ret)}</span>
        <b>$${esc(p.sym)}</b>
        <span class="mono muted">score ${esc(p.score)}/10 · in at ${usd(p.entryMc)} MC${closed ? "" : p.mc ? " · now " + usd(p.mc) : ""}</span>
        <span class="radar-age">${closed ? esc(p.exitWhy) + " · " + ago(p.exitAt) : "opened " + ago(p.openedAt)}</span>
        <code class="radar-ca">${esc(p.mint)}</code>
        ${p.note ? `<span class="radar-why muted">${esc(p.note)}</span>` : ""}
        <span class="radar-act">${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">Chart</a>` : ""}<a href="https://pump.fun/coin/${encodeURIComponent(p.mint)}" target="_blank" rel="noopener">pump.fun ↗</a><a href="?a=${encodeURIComponent(p.mint)}">Scan now</a></span>
      </li>`;
    };
    document.getElementById("paper-open").innerHTML = (st.open || []).map(p => row(p, false)).join("") || `<li class="muted">No open positions right now. A coin needs 6/10 or more.</li>`;
    document.getElementById("paper-closed").innerHTML = (st.closed || []).slice(0, 15).map(p => row(p, true)).join("") || `<li class="muted">No closed trades yet.</li>`;
    const lr = st.lastRun || {};
    document.getElementById("paper-updated").textContent = `Last bot run ${ago(st.updated)}: ${lr.found ?? "?"} new coins found, ${lr.passedScreener ?? "?"} passed the screener, ${lr.scanned ?? "?"} scanned, ${lr.entered ?? 0} opened. Running since ${new Date(st.started).toLocaleDateString()}.`;
  }
  paper();
  setInterval(paper, 60e3);

  // ---------- wallets the finder bot published (wallets.json on paper-data) ----------
  const WALLETS = "https://raw.githubusercontent.com/realinktattooherning/AP-COIN-CHECK-/paper-data/wallets.json";
  const wbox = document.getElementById("wallet-list");
  async function wallets() {
    if (!wbox) return;
    let d;
    try { const r = await fetch(WALLETS + "?t=" + Math.floor(Date.now() / 60e3), { cache: "no-store" }); if (!r.ok) throw 0; d = await r.json(); }
    catch { wbox.innerHTML = `<li class="muted">The wallet finder has not published yet. It runs 4 times a day.</li>`; return; }
    const short = a => a.slice(0, 4) + "…" + a.slice(-4);
    wbox.innerHTML = (d.wallets || []).slice(0, 20).map(w => `
      <li class="radar-hit wallet-row">
        <span class="verdict-tag v-${w.hits >= 2 ? "go" : "hold"}">${w.hits >= 2 ? "early in " + w.hits : "early in 1"}</span>
        <b class="mono">${esc(short(w.addr))}</b>
        <span class="mono muted">${esc(w.runners.map(x => "$" + x).join(", "))}</span>
        <span class="radar-age">active ${w.lastActiveDays < 1 ? "today" : Math.round(w.lastActiveDays) + " d ago"}</span>
        <code class="radar-ca">${esc(w.addr)}</code>
        <span class="radar-act"><button class="btn btn-ghost" type="button" data-follow="${esc(w.addr)}">Follow</button><a href="https://pump.fun/profile/${encodeURIComponent(w.addr)}" target="_blank" rel="noopener">pump.fun ↗</a><a href="https://gmgn.ai/sol/address/${encodeURIComponent(w.addr)}" target="_blank" rel="noopener">GMGN ↗</a><a href="https://solscan.io/account/${encodeURIComponent(w.addr)}" target="_blank" rel="noopener">Solscan ↗</a></span>
      </li>`).join("") || `<li class="muted">No wallets passed the filter in the last run.</li>`;
    document.getElementById("wallet-updated").textContent = `Last run ${ago(d.updated)} · runners checked: ${(d.runners || []).map(r => "$" + r.sym).join(", ")}.`;
  }
  if (wbox) {
    wbox.addEventListener("click", e => {
      const b = e.target.closest("[data-follow]");
      if (!b || typeof watchLoad !== "function") return;
      const st = watchLoad();
      if (!st.wallets.some(w => w.addr === b.dataset.follow)) { st.wallets.push({ addr: b.dataset.follow, label: "found by DK Rug Scan" }); watchSave(st); }
      if (typeof watchDraw === "function") watchDraw();
      b.textContent = "Following ✓"; b.disabled = true;
    });
    wallets();
    setInterval(wallets, 10 * 60e3);
  }
})();
