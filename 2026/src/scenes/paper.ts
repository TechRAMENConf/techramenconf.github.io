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

/** 繊維ノイズ（GLSL）。値ノイズを 3 種重ねる: 細かい粒・中くらいのムラ・一方向の繊維 */
const PAPER_NOISE = /* glsl */ `
varying vec3 vPaperPos;
uniform float uGrain;
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
`;

export interface PaperOptions {
  /** 繊維の細かさ（大きいほど細かい） */
  grain?: number;
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
  const grain = opts.grain ?? 1;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uGrain = { value: grain };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vPaperPos;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvPaperPos = (modelMatrix * vec4(position, 1.0)).xyz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\n" + PAPER_NOISE)
      .replace(
        "#include <color_fragment>",
        /* glsl */ `#include <color_fragment>
        {
          vec2 pp = vPaperPos.xy + vPaperPos.z * 0.37;
          float g = paperNoise(pp * 90.0 * uGrain) * 0.5
                  + paperNoise(pp * 21.0 * uGrain) * 0.33
                  + paperNoise(vec2(pp.x * 6.0, pp.y * 150.0) * uGrain) * 0.17;
          diffuseColor.rgb *= 0.9 + 0.14 * g;
        }`,
      );
  };
  // 繊維の細かさは uniform なので、シェーダは 1 本を使い回せる
  mat.customProgramCacheKey = () => "paper";
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
