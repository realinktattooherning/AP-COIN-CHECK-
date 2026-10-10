// The opaline jellyfish, shared by the scan stage (stage.js) and the landing page (hub.js).
// Same parametric bell and silk as the membrane on alexporsing.dk (package-orbit.js), on a 2D canvas so it also runs in the extension.
(function (root) {
  "use strict";
  const TAU = Math.PI * 2;
  // opal(): ice → rose → honey, washed to white at grazing angles
  const ice = [87, 194, 240], rose = [235, 128, 204], honey = [255, 204, 135];
  const mix = (a, b, k) => a.map((x, i) => x + (b[i] - x) * k);
  function opal(a, v, t, fres) {
    const turn = a * 0.3 + v * 1.4 + t * 0.1;
    let c = mix(ice, rose, 0.5 + 0.5 * Math.sin(turn));
    c = mix(c, honey, Math.pow(0.5 + 0.5 * Math.sin(turn + 2.2), 5) * 0.76);
    return mix(c, [247, 252, 255], fres * 0.62).map(Math.round).join(",");
  }
  // bell(u, v) and silk(seed, v): the membrane's own equations, in its units (bell radius ≈ 109)
  function bell(u, v, t) {
    const a = u * TAU, tt = t * 0.95, breath = Math.sin(tt), theta = v * 1.69, lip = Math.pow(v, 7);
    let r = 109 * Math.sin(theta) * (1 + breath * 0.065 * (0.45 + v * 0.55));
    r += Math.sin(a * 18 + v * 0.6) * lip * 3.7 + Math.sin(a * 3 + tt * 0.42) * Math.pow(v, 3) * 2.4;
    const y = 78 * Math.cos(theta) + 30 + breath * 6 * (1 - v) + Math.cos(a * 18 + v * 0.6) * lip * 3.8;
    return [Math.cos(a) * r + Math.sin(tt * 0.55) * v * v * 5, y, Math.sin(a) * r * 0.86];
  }
  function silk(seed, v, t) {
    const a = seed * TAU, root = bell(seed, 1, t);
    const len = 97 + ((seed * 61) % 1) * 63, lag = t * 0.85 - v * 4;
    return [root[0] + Math.sin(lag + a * 2) * (5 + v * 25) * v + Math.sin(v * 12 - t * 0.45 + a) * v * 9 + v * v * Math.sin(t * 0.37) * 23,
      root[1] - v * len, root[2] + Math.cos(lag * 0.9 + a * 3) * v * 24];
  }
  // body at canvas point (cx, cy) with scale s (1 = bell radius 109 px) at time t (seconds)
  function drawBody(ctx, cx, cy, s, t) {
    const P = p => [cx + p[0] * s, cy - (p[1] - 60) * s];
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(cx, cy, 10 * s, cx, cy, 190 * s);
    g.addColorStop(0, "rgba(140,190,255,.20)"); g.addColorStop(1, "rgba(140,190,255,0)");
    ctx.fillStyle = g; ctx.fillRect(cx - 200 * s, cy - 200 * s, 400 * s, 400 * s);
    ctx.lineCap = "round";
    for (let k = 0; k < 34; k++) {
      const seed = (k + 0.35) / 34;
      ctx.beginPath();
      for (let j = 0; j <= 28; j++) { const q = P(silk(seed, j / 28, t)); j ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }
      ctx.strokeStyle = `rgba(${opal(seed * TAU, 0.5, t, 0.4)},.22)`; ctx.lineWidth = 1.1 * s; ctx.stroke();
    }
    for (let k = 0; k < 36; k++) {
      const u = k / 36, a = u * TAU, front = (Math.sin(a) + 1) / 2;
      ctx.beginPath();
      for (let j = 0; j <= 16; j++) { const q = P(bell(u, j / 16, t)); j ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }
      ctx.strokeStyle = `rgba(${opal(a, 0.6, t, 1 - front)},${0.10 + 0.22 * front})`; ctx.lineWidth = (1 + front) * s; ctx.stroke();
    }
    ctx.beginPath();
    for (let k = 0; k <= 120; k++) { const q = P(bell(k / 120, 1, t)); k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }
    ctx.closePath();
    const fill = ctx.createLinearGradient(cx, cy - 120 * s, cx, cy + 40 * s);
    fill.addColorStop(0, `rgba(${opal(1, 0.1, t, 0.2)},.16)`); fill.addColorStop(1, `rgba(${opal(3, 0.9, t, 0.6)},.06)`);
    ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = `rgba(${opal(2, 1, t, 0.8)},.45)`; ctx.lineWidth = 1.6 * s; ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  }
  root.DKJelly = { opal, bell, silk, drawBody, TAU };
})(typeof window === "object" ? window : this);
