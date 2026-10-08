// Landing page only (the scanner itself is checker.js). Edit the two lists below; no other code needs to change.

// Official contract address of $DKRUGSCAN. Leave empty until launch.
const TOKEN_CA = "";

// Reels shown under "Watch it work": vertical MP4s in assets/reels/ with a poster frame each.
const REELS = [
  { src: "assets/reels/reel-1.mp4", poster: "assets/reels/reel-1.jpg", coin: "", verdict: "", tone: "stop" },
  { src: "assets/reels/reel-2.mp4", poster: "assets/reels/reel-2.jpg", coin: "", verdict: "", tone: "stop" },
  { src: "assets/reels/reel-3.mp4", poster: "assets/reels/reel-3.jpg", coin: "", verdict: "", tone: "hold" },
];

(() => {
  const el = id => document.getElementById(id);
  if (el("year")) el("year").textContent = new Date().getFullYear();

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
    </figure>`).join("");
  // one video at a time
  box.addEventListener("play", e => box.querySelectorAll("video").forEach(v => { if (v !== e.target) v.pause(); }), true);
})();
