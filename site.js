// Landing page only (the scanner itself is checker.js). Edit the two lists below; no other code needs to change.

// Official contract address of $DKRUGSCAN. Leave empty until launch.
const TOKEN_CA = "";

// "Beginner? Start safely" and "How to join the project": fill these in and the links appear. Leave empty to hide them.
const FACEBOOK = "";                 // e.g. "https://www.facebook.com/dkrugscan"
const JOIN_PDF = "";                 // e.g. "assets/join-the-project.pdf"

// Reels shown under "Watch it work": vertical MP4s in assets/reels/ with a poster frame each.
const REELS = [
  { src: "assets/reels/reel-1.mp4", poster: "assets/reels/reel-1.jpg", coin: "PUTER", verdict: "1/10 · Don't buy", tone: "stop", why: "18 of the top 19 holders are farmed wallets" },
  { src: "assets/reels/reel-2.mp4", poster: "assets/reels/reel-2.jpg", coin: "INU", verdict: "1/10 · Don't buy", tone: "stop", why: "Fake volume, top 10 own 53%, launch bundle" },
  { src: "assets/reels/reel-3.mp4", poster: "assets/reels/reel-3.jpg", coin: "GARY", verdict: "2/10 · Don't buy", tone: "stop", why: "Already up 2,661% in a day, fees near zero" },
];

(() => {
  const el = id => document.getElementById(id);
  if (el("year")) el("year").textContent = new Date().getFullYear();

  if (FACEBOOK && el("fb-link")) { el("fb-link").href = FACEBOOK; el("fb-link").hidden = false; }
  if (JOIN_PDF && el("join-pdf")) { el("join-pdf").href = JOIN_PDF; el("join-pdf").hidden = false; }

  if (TOKEN_CA && el("ca")) {
    el("ca").textContent = TOKEN_CA;
    el("ca-copy").hidden = false;
    el("ca-copy").onclick = () => navigator.clipboard.writeText(TOKEN_CA).then(() => { el("ca-copy").textContent = "Copied"; });
  }

  const box = el("reels");
  if (!box) return;
  const reels = REELS.filter(r => r.coin);
  if (!reels.length) { el("videos").hidden = true; return; }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  box.innerHTML = reels.map(r => `
    <figure class="reel">
      <div class="phone"><video src="${esc(r.src)}" poster="${esc(r.poster)}" controls playsinline preload="none"></video></div>
      <figcaption><b>$${esc(r.coin)}</b><span class="verdict-tag v-${esc(r.tone)}">${esc(r.verdict)}</span></figcaption>
      ${r.why ? `<p class="reel-why">${esc(r.why)}</p>` : ""}
    </figure>`).join("");
  // one video at a time
  box.addEventListener("play", e => box.querySelectorAll("video").forEach(v => { if (v !== e.target) v.pause(); }), true);
})();
