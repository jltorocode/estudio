// Genera las texturas topográficas decorativas (public/topo-*.svg).
import fs from "fs";
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const W = 1600, H = 1000;
const peaks = [
  { x: 1180, y: 260, n: 14, step: 34 },
  { x: 380, y: 760, n: 11, step: 36 },
  { x: 1450, y: 900, n: 7, step: 40 },
  { x: 120, y: 120, n: 6, step: 42 }
];
function closedPath(pts) {
  // Catmull-Rom → Bézier cerrada
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length; i++) {
    const p0 = pts[(i - 1 + pts.length) % pts.length], p1 = pts[i], p2 = pts[(i + 1) % pts.length], p3 = pts[(i + 2) % pts.length];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d + "Z";
}
const paths = [];
for (const pk of peaks) {
  const ph = [rnd() * 6, rnd() * 6, rnd() * 6];
  for (let k = 1; k <= pk.n; k++) {
    const r = k * pk.step + rnd() * 6;
    const pts = [];
    const N = 36;
    for (let i = 0; i < N; i++) {
      const t = (i / N) * Math.PI * 2;
      const w = 1 + 0.16 * Math.sin(3 * t + ph[0] + k * 0.08) + 0.09 * Math.sin(5 * t + ph[1] - k * 0.05) + 0.05 * Math.sin(8 * t + ph[2]);
      pts.push([pk.x + Math.cos(t) * r * w * 1.25, pk.y + Math.sin(t) * r * w]);
    }
    paths.push({ d: closedPath(pts), index: k % 5 === 0 });
  }
}
for (const [name, c] of [["light", "#9FB2A6"], ["dark", "#2A3D35"]]) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><g fill="none" stroke="${c}">${paths.map((p) => `<path d="${p.d}" stroke-width="${p.index ? 1.6 : 0.8}"/>`).join("")}</g></svg>`;
  fs.writeFileSync(`public/topo-${name}.svg`, svg);
  console.log(name, (svg.length / 1024).toFixed(1) + " KB");
}
