/**
 * 紙の画風（3D を DOM のちぎり紙にそろえる）
 *
 * - paperMaterial: トゥーン階調 ＋ 紙の繊維ノイズの材質
 * - PaperPost:     墨の輪郭線（線のふるえ付き）と、重ねた切り絵の落ち影を足す後処理
 *
 * 質感は今は手続き的に生成している。スキャンした本物の紙が用意できたら、
 * paperMaterial の繊維ノイズをテクスチャに差し替える。
 */
import * as THREE from "three";

/** 3 段のトゥーン階調（影・中間・日なた）。全材質で共有 */
let rampTex: THREE.DataTexture | null = null;
function toonRamp(): THREE.DataTexture {
  if (rampTex) return rampTex;
  const data = new Uint8Array([150, 205, 255]);
  rampTex = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  rampTex.minFilter = THREE.NearestFilter;
  rampTex.magFilter = THREE.NearestFilter;
  rampTex.generateMipmaps = false;
  rampTex.needsUpdate = true;
  return rampTex;
}

/**
 * 紙の繊維の模様（起動時に 1 回だけ Canvas で描く、繰り返し可能な 1024px のタイル）
 *  R: 和紙の細い繊維  G: 雲竜紙の太く長い繊維  B: クラフト紙の斑点と短い繊維
 * シェーダは毎フレーム繊維を計算せず、このタイルを読むだけ（軽く、遠景でもちらつかない）。
 */
let paperTex: THREE.Texture | null = null;
function paperDetailTexture(): THREE.Texture {
  if (paperTex) return paperTex;
  const S = 1024;
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  // タイルの継ぎ目で途切れないよう、端にかかる線は上下左右にずらして 9 回描く
  const strokeWrapped = (g: CanvasRenderingContext2D, draw: () => void) => {
    for (const dx of [-S, 0, S]) {
      for (const dy of [-S, 0, S]) {
        g.save();
        g.translate(dx, dy);
        draw();
        g.restore();
      }
    }
  };
  const layer = (paint: (g: CanvasRenderingContext2D) => void) => {
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d")!;
    g.fillStyle = "#000";
    g.fillRect(0, 0, S, S);
    g.strokeStyle = "#fff";
    g.fillStyle = "#fff";
    g.lineCap = "round";
    paint(g);
    return g.getImageData(0, 0, S, S).data;
  };
  const fiber = (g: CanvasRenderingContext2D, len: number, width: number, alpha: number) => {
    const x = rnd() * S;
    const y = rnd() * S;
    const a = rnd() * Math.PI * 2;
    const L = len * (0.5 + rnd());
    const bend = (rnd() - 0.5) * L * 0.6;
    const ex = x + Math.cos(a) * L;
    const ey = y + Math.sin(a) * L;
    const mx = (x + ex) / 2 - Math.sin(a) * bend;
    const my = (y + ey) / 2 + Math.cos(a) * bend;
    g.globalAlpha = alpha * (0.4 + rnd() * 0.6);
    g.lineWidth = width * (0.6 + rnd() * 0.8);
    strokeWrapped(g, () => {
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(mx, my, ex, ey);
      g.stroke();
    });
  };
  const r = layer((g) => {
    for (let i = 0; i < 1400; i++) fiber(g, 60, 1.1, 0.7);
  });
  const gch = layer((g) => {
    for (let i = 0; i < 70; i++) fiber(g, 260, 3.2, 0.9);
  });
  const b = layer((g) => {
    for (let i = 0; i < 900; i++) {
      const x = rnd() * S;
      const y = rnd() * S;
      const rad = 0.6 + Math.pow(rnd(), 3) * 3;
      g.globalAlpha = 0.5 + rnd() * 0.5;
      strokeWrapped(g, () => {
        g.beginPath();
        g.arc(x, y, rad, 0, 7);
        g.fill();
      });
    }
    for (let i = 0; i < 500; i++) fiber(g, 22, 1.2, 0.6);
  });
  const out = new Uint8Array(S * S * 4);
  for (let i = 0; i < S * S; i++) {
    out[i * 4] = r[i * 4];
    out[i * 4 + 1] = gch[i * 4];
    out[i * 4 + 2] = b[i * 4];
    out[i * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(out, S, S, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.needsUpdate = true;
  paperTex = t;
  return t;
}

/** 紙の模様（GLSL）: 値ノイズ（ムラ・粒）＋繊維タイルの読み出し */
const PAPER_NOISE = /* glsl */ `
varying vec3 vPaperPos;
varying vec3 vPaperObj;
uniform float uGrain;
uniform float uSeed;
uniform float uThick;
uniform sampler2D uPaperTex;
float paperHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float paperNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(paperHash(i), paperHash(i + vec2(1.0, 0.0)), u.x),
    mix(paperHash(i + vec2(0.0, 1.0)), paperHash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}
// 繊維タイルを、面ごとに回転・ずらして読む（同じ模様が並ばないように）
vec4 paperTile(vec2 p) {
  float a = uSeed * 2.399;
  mat2 rot = mat2(cos(a), -sin(a), sin(a), cos(a));
  return texture2D(uPaperTex, rot * p + vec2(uSeed * 0.37, uSeed * 0.71));
}
`;

/** 紙の種類ごとの色の揺らし方（diffuseColor.rgb を書き換える） */
const PAPER_APPLY = /* glsl */ `
{
  vec2 pp = vPaperPos.xy + vPaperPos.z * 0.37;
  float grain = paperNoise(pp * 90.0 * uGrain + uSeed);
  float mottle = paperNoise(pp * 2.6 + uSeed) * 0.6 + paperNoise(pp * 7.0 + uSeed) * 0.4; // 厚い所・薄い所
  vec3 col = diffuseColor.rgb;
#if defined(PAPER_WASHI) || defined(PAPER_UNRYU)
  vec4 t = paperTile(pp * 0.33 * uGrain);
  // 和紙: 明暗のムラが強く、細い繊維がわずかに明るく浮く
  col *= 0.88 + 0.16 * mottle + 0.04 * grain;
  col = mix(col, col * 1.06 + 0.012, t.r * 0.55);
  #ifdef PAPER_UNRYU
  // 雲竜紙: 地色より明るい太めの繊維がまばらに入る
  col = mix(col, mix(col, vec3(0.96, 0.94, 0.86), 0.45), t.g * 0.8);
  #endif
#elif defined(PAPER_KRAFT)
  vec4 t = paperTile(pp * 0.33 * uGrain);
  // クラフト紙: 粗い粒、濃い斑点（再生紙の混ざりもの）、短く濃い繊維
  col *= 0.88 + 0.1 * mottle + 0.1 * paperNoise(pp * 160.0 * uGrain + uSeed);
  col *= 1.0 - t.b * 0.32;
  col *= 1.0 - t.r * 0.05;
#elif defined(PAPER_CARDBOARD)
  // 段ボールの切り口: 表裏のライナーの間に、波形の芯（明暗の縞）
  float z = clamp(vPaperObj.z / max(uThick, 0.0001), 0.0, 1.0);
  float liner = step(z, 0.16) + step(0.84, z);
  float s = vPaperObj.x * 70.0;
  float wave = abs(fract(s) - 0.5) * 2.0;
  float flute = smoothstep(0.08, 0.0, abs((z - 0.5) - (wave - 0.5) * 0.55));
  float cavity = 0.9 + 0.1 * smoothstep(0.0, 0.5, abs(fract(s + 0.5) - 0.5));
  col *= mix(cavity, 1.0, liner);
  col = mix(col, col * 0.78, flute * (1.0 - liner));
  col *= 0.95 + 0.06 * grain;
#else
  // 色上質紙: 細かく均一な粒、ムラは弱い
  col *= 0.94 + 0.05 * mottle + 0.06 * grain;
#endif
  diffuseColor.rgb = col;
}
`;

export type PaperKind = "washi" | "unryu" | "kraft" | "stock" | "cardboard";

let lite = false;
/** スマホなど負荷を抑えたい端末では true（繊維の層を減らす）。材質を作る前に呼ぶ */
export function setPaperLite(v: boolean) {
  lite = v;
}

export interface PaperOptions {
  /** 紙の種類（既定は色上質紙） */
  kind?: PaperKind;
  /** 模様の種。面ごとに変えると同じ模様が繰り返さない */
  seed?: number;
  /** 繊維の細かさ（大きいほど細かい） */
  grain?: number;
  /** 厚み（段ボールの切り口の縞を合わせる。オブジェクト座標の z の範囲） */
  thick?: number;
  /** 印刷・描き込みの模様（Canvas で作った柄など）。地色は color と掛け合わせ */
  map?: THREE.Texture;
  /** 両面を描く（丼の内側など） */
  doubleSide?: boolean;
}

/** 色紙の材質 */
export function paperMaterial(color: THREE.ColorRepresentation, opts: PaperOptions = {}) {
  const mat = new THREE.MeshToonMaterial({
    color,
    gradientMap: toonRamp(),
    map: opts.map ?? null,
    side: opts.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
  });
  const kind = opts.kind ?? "stock";
  const isLite = lite;
  const uniforms = {
    uGrain: { value: opts.grain ?? 1 },
    uSeed: { value: opts.seed ?? 0 },
    uThick: { value: opts.thick ?? 1 },
    uPaperTex: { value: paperDetailTexture() },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    const defines =
      `#define PAPER_${kind.toUpperCase()}\n` + (isLite ? "#define PAPER_LITE\n" : "");
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vPaperPos;\nvarying vec3 vPaperObj;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvPaperPos = (modelMatrix * vec4(position, 1.0)).xyz;\nvPaperObj = position;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\n" + defines + PAPER_NOISE)
      .replace("#include <color_fragment>", "#include <color_fragment>\n" + PAPER_APPLY);
  };
  // 種類と品質ごとにシェーダを 1 本ずつ（種・細かさ・厚みは uniform なので使い回せる）
  mat.customProgramCacheKey = () => `paper-${kind}${isLite ? "-lite" : ""}`;
  return mat;
}

/** 厚紙の芯（切り口の白） */
export const PAPER_CORE = 0xfbf6ea;

/**
 * 後処理: シーンを深度付きで描き、全画面の合成で
 *  1. 深度の段差に墨の輪郭線（8fps でふるえる）
 *  2. 光の方向にある手前の紙から、奥の紙へ落ち影
 * を足す。背景は透過のまま（CSS の空を使う）。
 */
export class PaperPost {
  private rt: THREE.WebGLRenderTarget;
  private scene = new THREE.Scene();
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private mat: THREE.ShaderMaterial;

  constructor() {
    this.rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    this.rt.depthTexture = new THREE.DepthTexture(1, 1);
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: this.rt.texture },
        tDepth: { value: this.rt.depthTexture },
        uTexel: { value: new THREE.Vector2(1, 1) },
        uDpr: { value: 1 },
        uNear: { value: 0.1 },
        uFar: { value: 100 },
        uTime: { value: 0 },
        uInk: { value: new THREE.Color(0x2e2826) },
        uLine: { value: 1 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        #include <packing>
        uniform sampler2D tColor;
        uniform sampler2D tDepth;
        uniform vec2 uTexel;
        uniform float uDpr;
        uniform float uNear;
        uniform float uFar;
        uniform float uTime;
        uniform vec3 uInk;
        uniform float uLine;
        varying vec2 vUv;

        float dist(vec2 uv) {
          return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uNear, uFar);
        }
        float h21(vec2 p) {
          return fract(sin(dot(p, vec2(41.3, 289.1))) * 23758.5453);
        }
        float vnoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), u.x),
                     mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), u.x), u.y);
        }

        void main() {
          // 線のふるえ: 8fps で切り替わるノイズでサンプル位置を 1〜2px ずらす
          vec2 jitter = (vec2(vnoise(vUv * 38.0 + uTime * 3.1),
                              vnoise(vUv * 38.0 - uTime * 2.7 + 7.0)) - 0.5) * uTexel * 2.6 * uDpr;
          vec2 suv = vUv + jitter;

          // 輪郭線: 上下左右との深度差（相対値）。遠い紙ほど許容を広げる
          float w = 1.15 * uDpr;
          float zc = dist(suv);
          float z1 = dist(suv + vec2(uTexel.x * w, 0.0));
          float z2 = dist(suv - vec2(uTexel.x * w, 0.0));
          float z3 = dist(suv + vec2(0.0, uTexel.y * w));
          float z4 = dist(suv - vec2(0.0, uTexel.y * w));
          float zmin = min(min(min(z1, z2), min(z3, z4)), zc);
          float zmax = max(max(max(z1, z2), max(z3, z4)), zc);
          float line = smoothstep(0.03, 0.08, (zmax - zmin) / zmin) * 0.86 * uLine;

          // 落ち影: 左上（光の来る側）に手前の紙があれば、その下は影になる
          float shade = 0.0;
          for (int i = 1; i <= 3; i++) {
            vec2 o = vec2(-0.55, 0.85) * uTexel * uDpr * (5.0 * float(i));
            float zs = dist(vUv + o);
            shade += smoothstep(0.04, 0.12, (zc - zs) / zc);
          }
          shade = shade / 3.0 * 0.3;

          vec4 c = texture2D(tColor, vUv);        // 乗算済みアルファ
          vec3 pm = c.rgb * (1.0 - shade);
          float a = c.a;
          vec3 outPm = pm * (1.0 - line) + uInk * line;
          float outA = a * (1.0 - line) + line;
          vec3 straight = outA > 0.0001 ? outPm / outA : vec3(0.0);
          vec3 enc = linearToOutputTexel(vec4(straight, 1.0)).rgb;
          gl_FragColor = vec4(enc * outA, outA);
        }
      `,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    quad.frustumCulled = false;
    this.scene.add(quad);
  }

  setSize(w: number, h: number, dpr: number) {
    const pw = Math.max(1, Math.round(w * dpr));
    const ph = Math.max(1, Math.round(h * dpr));
    this.rt.setSize(pw, ph);
    this.mat.uniforms.uTexel.value.set(1 / pw, 1 / ph);
    this.mat.uniforms.uDpr.value = dpr;
  }

  /** time: 秒。線のふるえは 8fps に量子化する */
  render(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    time: number,
  ) {
    const u = this.mat.uniforms;
    u.uNear.value = camera.near;
    u.uFar.value = camera.far;
    u.uTime.value = Math.floor(time * 8) / 8;
    renderer.setRenderTarget(this.rt);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(this.scene, this.cam);
  }

  dispose() {
    this.rt.depthTexture?.dispose();
    this.rt.dispose();
    this.mat.dispose();
    (this.scene.children[0] as THREE.Mesh).geometry.dispose();
  }
}

export interface FringeOptions {
  /** 縁の外へはみ出す毛羽の長さ（和紙は長く、色上質紙は短く） */
  out: number;
  /** 縁の内側の白い繊維の帯の幅 */
  inner?: number;
  seed?: number;
  color?: THREE.ColorRepresentation;
}

/**
 * ちぎった縁の毛羽: 上辺の点列に沿った細い帯。シェーダで
 *  - 内側: 破れ目に沿って紙の芯の白い繊維が見える帯（幅は場所ごとに揺らぐ）
 *  - 外側: 縁からはみ出す細い毛羽
 * を描き、残りは捨てる（深度は書かないので輪郭線の後処理とは干渉しない）。
 * 点列は XY 平面上、帯は z の位置に置く。
 */
export function makeTornFringe(points: THREE.Vector2[], z: number, opts: FringeOptions) {
  const inner = opts.inner ?? 0.03;
  const out = opts.out;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let arc = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(points.length - 1, i + 1)];
    const tx = b.x - a.x;
    const ty = b.y - a.y;
    const len = Math.hypot(tx, ty) || 1;
    let nx = -ty / len;
    let ny = tx / len;
    if (ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    if (i > 0) arc += p.distanceTo(points[i - 1]);
    pos.push(p.x - nx * inner, p.y - ny * inner, z, p.x + nx * out, p.y + ny * out, z);
    uv.push(arc, 0, arc, 1);
    if (i > 0) {
      const k = i * 2;
      idx.push(k - 2, k - 1, k, k - 1, k + 1, k);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(opts.color ?? PAPER_CORE) },
      uEdge: { value: inner / (inner + out) },
      uOutLen: { value: out },
      uSeed: { value: opts.seed ?? 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uEdge;
      uniform float uOutLen;
      uniform float uSeed;
      varying vec2 vUv;
      float h1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n1(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(h1(i), h1(i + vec2(1.0, 0.0)), u.x), mix(h1(i + vec2(0.0, 1.0)), h1(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      void main() {
        float x = vUv.x + uSeed * 7.3;
        float v = vUv.y;
        float a = 0.0;
        if (v <= uEdge) {
          // 内側の白い帯: 破れ目から内へ、場所ごとに太さが変わる
          float w = 0.25 + 0.75 * n1(vec2(x * 9.0, 1.0));
          float t = (uEdge - v) / uEdge;           // 0 = 縁, 1 = 内側の端
          a = step(t, w * (0.75 + 0.25 * n1(vec2(x * 80.0, t * 6.0))));
        } else {
          // 外側の毛羽: 縁から外へ伸びる細い繊維（長さ・向きは不揃い）
          float t = (v - uEdge) / (1.0 - uEdge);   // 0 = 縁, 1 = 外の端
          float col = floor(x * 260.0);
          float len = pow(h1(vec2(col, 3.0 + uSeed)), 3.0);   // 長い毛羽はまれ
          float lean = (h1(vec2(col, 7.0)) - 0.5) * 0.6;
          float cx = fract(x * 260.0 + lean * t * 6.0) - 0.5;
          float hair = step(abs(cx), 0.18) * step(t, len);
          // 根元は細かい毛羽で密に
          float fuzz = step(0.55, n1(vec2(x * 420.0, t * 4.0))) * step(t, 0.18 + 0.2 * n1(vec2(x * 30.0, 2.0)));
          a = max(hair, fuzz);
        }
        if (a < 0.5) discard;
        gl_FragColor = vec4(uColor, 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 1;
  return mesh;
}
