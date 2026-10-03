// DOM の紙を不揃いにする（3D の paper.ts と同じ考え方）。
// - ちぎれ: 種と細かさの違う SVG フィルタを複数作り、要素ごとに別のものを割り当てる
//   （今までは 2 種類の使い回しで、破れ方が均一だった）
// - 地紙: 和紙の繊維を Canvas で一度だけ描き、CSS 変数 --paper-grain に入れる
// 失敗しても CSS 側の既定（従来のフィルタと地模様）のまま表示される。

const SVG_NS = "http://www.w3.org/2000/svg";
const VARIANTS_SMALL = 8; // ボタン・札・しおり・短冊
const VARIANTS_SHEET = 4; // 紙のシート

function addFilters() {
  const defs = document.querySelector("svg defs");
  if (!defs) return false;
  const make = (id: string, freq: number, seed: number, scale: number, pad: number) => {
    const f = document.createElementNS(SVG_NS, "filter");
    f.id = id;
    f.setAttribute("x", `-${pad}%`);
    f.setAttribute("y", `-${pad * 2}%`);
    f.setAttribute("width", `${100 + pad * 2}%`);
    f.setAttribute("height", `${100 + pad * 4}%`);
    const t = document.createElementNS(SVG_NS, "feTurbulence");
    t.setAttribute("type", "fractalNoise");
    t.setAttribute("baseFrequency", `${freq.toFixed(3)} ${(freq * 1.4).toFixed(3)}`);
    t.setAttribute("numOctaves", "3");
    t.setAttribute("seed", String(seed));
    t.setAttribute("result", "n");
    const d = document.createElementNS(SVG_NS, "feDisplacementMap");
    d.setAttribute("in", "SourceGraphic");
    d.setAttribute("in2", "n");
    d.setAttribute("scale", scale.toFixed(1));
    f.append(t, d);
    defs.append(f);
  };
  for (let i = 0; i < VARIANTS_SMALL; i++) {
    make(`torn-v${i}`, 0.045 + (i % 4) * 0.009, 31 + i * 17, 4.2 + (i % 3) * 0.9, 5);
  }
  for (let i = 0; i < VARIANTS_SHEET; i++) {
    make(`torn-l${i}`, 0.013 + i * 0.002, 101 + i * 29, 11 + i * 1.5, 2);
  }
  return true;
}

function assign() {
  // 小さい紙片: 隣り合う要素で同じ破れ方にならないよう、通し番号を少し飛ばして割り当てる
  const small = document.querySelectorAll<HTMLElement>(".torn, .btn");
  small.forEach((el, i) => {
    el.style.setProperty("--torn-filter", `url(#torn-v${(i * 3) % VARIANTS_SMALL})`);
  });
  document.querySelectorAll<HTMLElement>(".sheet").forEach((el, i) => {
    el.style.setProperty("--sheet-filter", `url(#torn-l${i % VARIANTS_SHEET})`);
  });
}

/** 和紙の地紙（256px の繰り返し）: 細い繊維＋粒。白黒の濃淡だけを描き、乗算で重ねる */
function grain() {
  const S = 256;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d");
  if (!g) return;
  let s = 11;
  const rnd = () => ((s = (s * 16807) % 2147483647), s / 2147483647);
  g.clearRect(0, 0, S, S);
  // 粒
  const img = g.createImageData(S, S);
  for (let i = 0; i < S * S; i++) {
    const v = rnd() < 0.5 ? 0 : 255;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = Math.floor(rnd() * 14);
  }
  g.putImageData(img, 0, 0);
  // 繊維（端にかかる線は 4 方向にずらして描き、継ぎ目を消す）
  g.lineCap = "round";
  for (let i = 0; i < 90; i++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const a = rnd() * Math.PI * 2;
    const L = 14 + rnd() * 40;
    const bend = (rnd() - 0.5) * L * 0.6;
    const light = rnd() < 0.6;
    g.strokeStyle = light ? "rgba(255,255,255,0.5)" : "rgba(90,70,40,0.16)";
    g.lineWidth = 0.6 + rnd() * 0.8;
    for (const dx of [-S, 0, S]) {
      for (const dy of [-S, 0, S]) {
        g.beginPath();
        g.moveTo(x + dx, y + dy);
        g.quadraticCurveTo(
          x + dx + Math.cos(a) * L * 0.5 - Math.sin(a) * bend,
          y + dy + Math.sin(a) * L * 0.5 + Math.cos(a) * bend,
          x + dx + Math.cos(a) * L,
          y + dy + Math.sin(a) * L,
        );
        g.stroke();
      }
    }
  }
  document.documentElement.style.setProperty("--paper-grain", `url(${c.toDataURL("image/png")})`);
}

try {
  if (addFilters()) assign();
  grain();
} catch {
  /* 既定の見た目のまま */
}
