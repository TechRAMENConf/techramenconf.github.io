/**
 * TechRAMEN 2026 — ペーパークラフトの富良野（晩秋〜初雪）
 *
 * 切り絵レイヤーの丘 + 具と箸つきの湯気立つラーメン丼
 * + 漂う気球 + 初雪。装飾レイヤー（情報はDOM側が担保）。
 * ※ ぶどう畑は「畑に見えない」ため一旦削除（復活させる場合は要再設計）。
 *
 * 公開API: createVineyard(canvas) -> { start, stop, dispose, setProgress, setBeats }
 * - 遅延初期化前提（呼び出し側が IntersectionObserver で start/stop を制御）
 * - prefers-reduced-motion 時は1フレームだけ描画してアニメ停止
 */
import * as THREE from "three";
import { paperMaterial, PaperPost, PAPER_CORE } from "./paper";
import { buildRamen } from "./ramen";

export type BeatName = "hero" | "dates" | "access" | "travel" | "roadmap" | "past";

export interface VineyardController {
  start: () => void;
  stop: () => void;
  dispose: () => void;
  /** スクロール進捗 0..1 を渡すとカメラが富良野を巡る */
  setProgress: (p: number) => void;
  /** 各ビート（セクション）がスクロール進捗のどこにあるか（0..1）を渡す */
  setBeats: (beats: Partial<Record<BeatName, number>>) => void;
  /** 画面座標を突く。丼なら湯気が増え、気球なら浮き上がる。何かに当たったら true */
  poke: (clientX: number, clientY: number) => boolean;
  /** 画面座標の下に突ける物があるか（カーソル表示用） */
  canPoke: (clientX: number, clientY: number) => boolean;
}

const COLORS = {
  sky: 0x000000, // 透明（CSS側の空を使う）
  grape: 0x6a2f56,
  leaf: 0x7a934a,
  gold: 0xcf9b3e,
  wheat: 0xddb867,
  snow: 0xf3ece0,
  balloon: 0x7b2c3a,
  balloonAlt: 0xcf9b3e,
  basket: 0x8a6b4f,
};

/** シード付き PRNG（mulberry32）。読み込みごとに盛り付けが変わらないよう固定 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 上辺が波打ち、細かくちぎれた「厚紙の丘」レイヤーを作る（表＝色紙、切り口＝紙の芯の白） */
function makeHillLayer(
  width: number,
  height: number,
  topAmplitude: number,
  seed: number,
  color: number,
  depth: number,
  rand: () => number,
  coreMat: THREE.Material,
): THREE.Mesh {
  const shape = new THREE.Shape();
  const segments = 150;
  shape.moveTo(-width / 2, -height);
  shape.lineTo(-width / 2, 0);
  // 大きなうねり＋手でちぎった細かいギザギザ（不揃いに）
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = -width / 2 + t * width;
    const wobble =
      Math.sin(t * Math.PI * 2.2 + seed) * topAmplitude * 0.6 +
      Math.sin(t * Math.PI * 5.7 + seed * 1.7) * topAmplitude * 0.4;
    const torn = (rand() - 0.5) * 0.07 + Math.sin(t * 97 + seed * 5) * 0.012;
    shape.lineTo(x, wobble + torn);
  }
  shape.lineTo(width / 2, -height);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 });
  // ExtrudeGeometry のグループ: 0 = 表裏の面、1 = 側面（切り口）
  return new THREE.Mesh(geo, [paperMaterial(color), coreMat]);
}

/** 湯気用のふわっとした円形グラデーション */
function makeSoftDiscTexture(): THREE.CanvasTexture {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.45, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createVineyard(canvas: HTMLCanvasElement): VineyardController {
  const reducedMotion =
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isSmall = Math.min(window.innerWidth, window.innerHeight) < 640;
  const rand = mulberry32(2026);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !isSmall,
    alpha: true,
    powerPreference: "low-power",
  });
  renderer.setClearColor(0x000000, 0);
  // 紙の画風の後処理（墨の輪郭線・落ち影）
  const post = new PaperPost();

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);

  // --- カメラの旅: ビート（セクション）ごとのキーフレーム ---
  // t は呼び出し側が実際のセクション位置から setBeats で渡す（未受信時は既定値）。
  // *P は縦長(モバイル)用。省略時は横長の値を使う。縦長では更に自動で引く。
  type Vec3 = [number, number, number];
  type CamKey = { beat: BeatName; t: number; pos: Vec3; look: Vec3; posP?: Vec3; lookP?: Vec3 };
  const JOURNEY: CamKey[] = [
    // ヒーロー: 広く。縦長は丼が画面に入るよう右へ振る
    { beat: "hero", t: 0.0, pos: [0, 2.4, 9.2], look: [0, 0.9, 0], posP: [1.3, 2.2, 9.0], lookP: [1.5, 0.3, 0] },
    // 日程: 丘の連なりへ
    { beat: "dates", t: 0.2, pos: [-0.9, 1.9, 6.4], look: [0, 0.95, -1.4] },
    // アクセス: 丘を横移動
    { beat: "access", t: 0.45, pos: [2.4, 2.3, 5.9], look: [1.3, 0.6, 0.6] },
    // 観光: 気球と丘を見上げる（「もう一日」）
    { beat: "travel", t: 0.68, pos: [-1.6, 1.3, 6.2], look: [-2.4, 2.4, -1.5], posP: [-0.4, 1.3, 6.4], lookP: [-0.6, 2.5, -1.5] },
    // ロードマップ: ラーメンに寄る（寄りすぎず丼が画面の1/3程度）
    { beat: "roadmap", t: 0.8, pos: [3.7, 1.75, 5.3], look: [2.55, 0.55, 1.1], posP: [2.7, 1.9, 5.8], lookP: [2.7, -0.4, 1.1] },
    // 締め: 空へ引く
    { beat: "past", t: 1.0, pos: [0, 3.9, 9.9], look: [0, 1.8, -1.3] },
  ];
  const _camPos = new THREE.Vector3();
  const _camLook = new THREE.Vector3();
  const _a = new THREE.Vector3();
  const _b = new THREE.Vector3();
  const _tmp = new THREE.Vector3();
  const smooth = (x: number) => x * x * (3 - 2 * x);

  let aspect = 1;
  /** 縦長度合い 0(横長)..1(縦長) */
  let portrait = 0;

  /** キーフレームの位置/注視点（縦長度合いでブレンド） */
  function keyVec(out: THREE.Vector3, land: Vec3, port: Vec3 | undefined) {
    out.set(land[0], land[1], land[2]);
    if (port && portrait > 0) out.lerp(_tmp.set(port[0], port[1], port[2]), portrait);
    return out;
  }

  function evalJourney(p: number) {
    p = Math.min(1, Math.max(0, p));
    let i = 0;
    while (i < JOURNEY.length - 1 && p > JOURNEY[i + 1].t) i++;
    const a = JOURNEY[i];
    const b = JOURNEY[Math.min(i + 1, JOURNEY.length - 1)];
    const span = b.t - a.t;
    const k = span > 0 ? smooth(Math.min(1, Math.max(0, (p - a.t) / span))) : 0;
    _camPos.copy(keyVec(_a, a.pos, a.posP)).lerp(keyVec(_b, b.pos, b.posP), k);
    _camLook.copy(keyVec(_a, a.look, a.lookP)).lerp(keyVec(_b, b.look, b.lookP), k);
  }

  function applyCamera(p: number) {
    evalJourney(p);
    // 縦長は引き＋画角拡大で全体を映す
    if (portrait > 0) {
      camera.fov = 40 + portrait * 16;
      _tmp.copy(_camPos).sub(_camLook).normalize().multiplyScalar(portrait * 2.6);
      camera.position.copy(_camPos).add(_tmp);
      _camLook.y += portrait * 0.5;
    } else {
      camera.fov = 40;
      camera.position.copy(_camPos);
    }
    camera.lookAt(_camLook);
    camera.updateProjectionMatrix();
  }

  let targetProgress = 0;
  let currentProgress = 0;

  // 全体をまとめるグループ（パララックス用）
  const world = new THREE.Group();
  scene.add(world);

  // --- ライト（やわらかいトゥーン寄り） ---
  const hemi = new THREE.HemisphereLight(0xfff3e0, 0x6a5746, 1.15);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xfff1dc, 1.1);
  dir.position.set(-4, 6, 5);
  scene.add(dir);

  // --- 丘（ちぎり紙レイヤーを奥から手前へ） ---
  const hillDefs = [
    { w: 26, h: 8, amp: 0.7, seed: 0.3, color: COLORS.snow, z: -7, y: 1.7, depth: 0.3 },
    { w: 24, h: 8, amp: 0.9, seed: 1.9, color: COLORS.leaf, z: -4.5, y: 0.9, depth: 0.35 },
    { w: 22, h: 8, amp: 1.0, seed: 3.4, color: COLORS.wheat, z: -2.4, y: 0.2, depth: 0.4 },
    { w: 22, h: 8, amp: 0.8, seed: 5.1, color: COLORS.grape, z: -0.4, y: -0.5, depth: 0.45 },
  ];
  const coreMat = paperMaterial(PAPER_CORE, { grain: 1.6 });
  // 起き上がる導入のため、各丘は下端（ページの折り目）を軸にしたグループに入れる
  const HINGE_Y = -1.6;
  const hillPivots: THREE.Group[] = [];
  for (const d of hillDefs) {
    const hill = makeHillLayer(d.w, d.h, d.amp, d.seed, d.color, d.depth, rand, coreMat);
    hill.position.set(0, d.y - HINGE_Y, 0);
    const pivot = new THREE.Group();
    pivot.position.set(0, HINGE_Y, d.z);
    pivot.add(hill);
    world.add(pivot);
    hillPivots.push(pivot);
  }

  // --- ラーメン丼 + 具 + 湯気（主役。温泉に見えないよう箸と具を載せる） ---
  const ramen = new THREE.Group();
  ramen.position.set(2.7, 0.15, 1.1);
  ramen.scale.setScalar(1.3);
  world.add(ramen);

  // 丼・スープ・麺・具は ramen.ts（紙で作った料理模型の旭川ラーメン）
  ramen.add(buildRamen(rand));

  // 湯気: やわらかいスプライト（常にカメラを向く）を上昇させる
  const steam = new THREE.Group();
  steam.position.copy(ramen.position);
  steam.position.y += 0.78; // 丼の縁の高さに合わせる
  world.add(steam);
  const softTex = makeSoftDiscTexture(); // 湯気と雪で共有
  let steamBurst = 0; // 丼を突いた直後の湯気の増量（1 → 0 へ減衰）
  const steamPuffs: THREE.Sprite[] = [];
  const steamCount = isSmall ? 4 : 6;
  for (let i = 0; i < steamCount; i++) {
    const puff = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: softTex, transparent: true, opacity: 0, depthWrite: false }),
    );
    puff.position.set((rand() - 0.5) * 0.25, 0, 0);
    puff.userData.phase = (i + 0.5) / steamCount;
    puff.userData.baseX = puff.position.x;
    steam.add(puff);
    steamPuffs.push(puff);
  }

  function updateSteam(t: number) {
    for (const puff of steamPuffs) {
      const ph = puff.userData.phase as number;
      puff.position.y = ph * 1.4;
      puff.position.x = (puff.userData.baseX as number) + Math.sin(t * 1.5 + ph * 6) * 0.06 * ph;
      // 突かれた直後（steamBurst）は濃く・大きく
      puff.material.opacity = Math.sin(ph * Math.PI) * (0.45 + steamBurst * 0.4);
      puff.scale.setScalar((0.35 + ph * 0.55) * (1 + steamBurst * 0.6));
    }
  }

  // --- 気球（漂う） ---
  function makeBalloon(color: number, radius: number): THREE.Group {
    const g = new THREE.Group();
    const env = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 12, 12),
      paperMaterial(color),
    );
    env.scale.y = 1.25;
    g.add(env);
    const basket = new THREE.Mesh(
      new THREE.BoxGeometry(radius * 0.3, radius * 0.3, radius * 0.3),
      paperMaterial(COLORS.basket),
    );
    basket.position.y = -radius * 1.7;
    g.add(basket);
    return g;
  }

  const balloon = makeBalloon(COLORS.balloon, 0.55);
  world.add(balloon);
  // 2つ目の気球（小さめ・金色）。空の余白を埋める（特にモバイル縦長）
  const balloon2 = makeBalloon(COLORS.balloonAlt, 0.36);
  world.add(balloon2);

  // 気球の基準位置（横長 / 縦長でブレンド）
  const balloonBase = { x1: -3.0, y1: 3.0, x2: 2.6, y2: 4.3 };
  // コマ撮りのブレ（コマごとに置き直したときの微小なずれ）と、導入で丘の後ろから昇る量
  const jit = { x1: 0, y1: 0, r1: 0, x2: 0, y2: 0, r2: 0 };
  let introRise = 0;
  // 突かれたときの浮き上がり（減衰ばね）
  const lift1 = { y: 0, v: 0 };
  const lift2 = { y: 0, v: 0 };
  function layoutBalloons() {
    const k = portrait;
    balloonBase.x1 = THREE.MathUtils.lerp(-3.0, -0.9, k);
    balloonBase.y1 = THREE.MathUtils.lerp(3.0, 3.5, k);
    balloonBase.x2 = THREE.MathUtils.lerp(2.6, 2.0, k);
    balloonBase.y2 = THREE.MathUtils.lerp(4.3, 5.0, k);
  }
  function updateBalloons(t: number) {
    balloon.position.set(
      balloonBase.x1 + Math.sin(t * 0.18) * 0.7 + jit.x1,
      balloonBase.y1 + Math.sin(t * 0.5) * 0.12 + lift1.y + jit.y1 + introRise,
      -1.5,
    );
    balloon.rotation.z = Math.sin(t * 0.4) * 0.05 + jit.r1;
    balloon2.position.set(
      balloonBase.x2 + Math.sin(t * 0.13 + 2) * 1.0 + jit.x2,
      balloonBase.y2 + Math.sin(t * 0.42 + 1) * 0.14 + lift2.y + jit.y2 + introRise * 1.2,
      -3.2,
    );
    balloon2.rotation.z = Math.sin(t * 0.33 + 1) * 0.06 + jit.r2;
  }

  // --- 初雪（Points） ---
  const snowCount = reducedMotion ? 0 : isSmall ? 100 : 130;
  let snow: THREE.Points | null = null;
  const snowVel: number[] = [];
  if (snowCount > 0) {
    const pos = new Float32Array(snowCount * 3);
    for (let i = 0; i < snowCount; i++) {
      pos[i * 3] = (rand() - 0.5) * 20;
      pos[i * 3 + 1] = rand() * 10;
      pos[i * 3 + 2] = (rand() - 0.5) * 8 - 1;
      snowVel.push(0.004 + rand() * 0.008);
    }
    const snowGeo = new THREE.BufferGeometry();
    snowGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    snow = new THREE.Points(
      snowGeo,
      new THREE.PointsMaterial({
        color: 0xffffff,
        map: softTex, // 丸い雪片（近くで四角く見えないように）
        size: 0.13,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      }),
    );
    world.add(snow);
  }

  // --- パララックス ---
  const pointer = { x: 0, y: 0 };
  const target = { x: 0, y: 0 };
  function onPointerMove(e: PointerEvent) {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  }
  if (!reducedMotion) {
    window.addEventListener("pointermove", onPointerMove, { passive: true });
  }

  // --- ループ ---
  let running = false;
  let raf = 0;
  let lastTime = 0;
  const STEP = 1 / 12; // コマ撮りの間隔
  let stepAcc = STEP;
  // 60fps 時の「毎フレーム係数」と同じ見た目になる指数追従の速さ
  const FOLLOW_PROGRESS = -Math.log(1 - 0.07) * 60;
  const FOLLOW_POINTER = -Math.log(1 - 0.04) * 60;

  // --- 描画（紙の後処理を通す） ---
  function renderFrame(time: number) {
    post.render(renderer, scene, camera, time);
  }

  // --- 起き上がる導入（しかけ絵本が開く） ---
  // 丘が奥から順にページから起き上がり、丼が弾んで現れ、気球が丘の後ろから昇る
  const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
  const easeOutBack = (x: number) => {
    const c1 = 1.5;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  };
  const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
  const INTRO_SEC = 2.0;
  let introStart = -1;
  let introDone = reducedMotion;
  function applyIntro(sec: number) {
    hillPivots.forEach((p, i) => {
      const k = clamp01((sec - i * 0.16) / 0.8);
      p.rotation.x = -1.45 * (1 - easeOutBack(k));
    });
    const kb = clamp01((sec - 0.6) / 0.6);
    ramen.scale.setScalar(Math.max(0.0001, 1.3 * easeOutBack(kb)));
    steam.visible = kb >= 1;
    const kl = clamp01((sec - 0.8) / 1.1);
    introRise = -4.5 * (1 - easeOutCubic(kl));
    // 昇り始める前は隠す（丘が平らな間に、下に控えた気球が覗かないように）
    balloon.visible = balloon2.visible = sec >= 0.8;
  }
  if (!reducedMotion) applyIntro(0);

  // --- サイズ調整 ---
  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    post.setSize(w, h, dpr);
    aspect = w / h;
    portrait = aspect < 1 ? Math.min(1, (1 - aspect) * 1.6) : 0;
    camera.aspect = aspect;
    layoutBalloons();
    applyCamera(reducedMotion ? 0 : currentProgress);
    // setSize はキャンバスをクリアする。ループ停止中（reduced-motion 等）は描き直す
    if (!running) {
      updateBalloons(0);
      renderFrame(0);
    }
  }

  updateSteam(0); // 初期姿勢（静止フレーム用）

  const ro = new ResizeObserver(() => resize());
  ro.observe(canvas);
  resize();

  function render(now: number) {
    const t = now / 1000;
    // タブ復帰などの大きな飛びは抑える
    const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;

    // スクロール進捗を滑らかに追従してカメラを移動
    currentProgress += (targetProgress - currentProgress) * (1 - Math.exp(-FOLLOW_PROGRESS * dt));
    applyCamera(currentProgress);

    // ごく軽いポインタ視差（旅の邪魔をしない程度）
    const kp = 1 - Math.exp(-FOLLOW_POINTER * dt);
    target.x += (pointer.x * 0.2 - target.x) * kp;
    target.y += (pointer.y * 0.12 - target.y) * kp;
    world.rotation.y = target.x * 0.1;
    world.rotation.x = target.y * 0.05;

    // 導入（24fps のコマ送り）
    if (!introDone) {
      if (introStart < 0) introStart = t + 0.2; // 最初の数コマは平らなページのまま見せる
      const sec = Math.max(0, Math.floor((t - introStart) * 24) / 24);
      applyIntro(sec);
      if (sec >= INTRO_SEC) introDone = true;
    }

    // 突かれた反応の減衰（湯気は指数減衰、気球は減衰ばね）
    steamBurst *= Math.exp(-1.6 * dt);
    for (const l of [lift1, lift2]) {
      l.v += (-l.y * 9 - l.v * 2.2) * dt;
      l.y += l.v * dt;
    }

    // コマ撮り: 湯気・気球・雪は 12fps でだけ動かす（カメラは滑らかなまま）
    stepAcc += dt;
    if (stepAcc >= STEP) {
      const sf = stepAcc * 60; // このコマまでに経過した 60fps 換算のフレーム数
      stepAcc = 0;
      for (const puff of steamPuffs) {
        let ph = (puff.userData.phase as number) + 0.0035 * sf * (1 + steamBurst * 2.5);
        if (ph > 1) ph -= 1;
        puff.userData.phase = ph;
      }
      updateSteam(t);
      // 置き直したときの微小なブレ
      jit.x1 = (Math.random() - 0.5) * 0.012;
      jit.y1 = (Math.random() - 0.5) * 0.012;
      jit.r1 = (Math.random() - 0.5) * 0.012;
      jit.x2 = (Math.random() - 0.5) * 0.012;
      jit.y2 = (Math.random() - 0.5) * 0.012;
      jit.r2 = (Math.random() - 0.5) * 0.012;
      updateBalloons(t);
      if (snow) {
        const attr = snow.geometry.getAttribute("position") as THREE.BufferAttribute;
        const arr = attr.array as Float32Array;
        for (let i = 0; i < snowCount; i++) {
          arr[i * 3 + 1] -= snowVel[i] * sf;
          arr[i * 3] += Math.sin(t + i) * 0.002 * sf;
          if (arr[i * 3 + 1] < -1) arr[i * 3 + 1] = 9 + Math.random();
        }
        attr.needsUpdate = true;
      }
    }

    renderFrame(t);
    if (running) raf = requestAnimationFrame(render);
  }

  function start() {
    if (running || reducedMotion) {
      if (reducedMotion) renderFrame(0); // 静止1フレーム
      return;
    }
    running = true;
    lastTime = performance.now();
    raf = requestAnimationFrame(render);
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function dispose() {
    stop();
    window.removeEventListener("pointermove", onPointerMove);
    ro.disconnect();
    softTex.dispose();
    post.dispose();
    scene.traverse((obj) => {
      // Sprite のジオメトリは three 内部で共有されているので触らない
      if ((obj as THREE.Sprite).isSprite) {
        (obj as THREE.Sprite).material.dispose();
        return;
      }
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material;
      if (Array.isArray(mat)) mat.forEach((mm) => mm.dispose());
      else if (mat) (mat as THREE.Material).dispose();
    });
    renderer.dispose();
  }

  function setProgress(p: number) {
    targetProgress = Math.min(1, Math.max(0, p));
    if (reducedMotion) {
      // 旅はオフ。静止構図のまま（モーションを増やさない）
      return;
    }
    if (!running) {
      // 停止中でもスクロールに追従して1フレーム更新
      currentProgress = targetProgress;
      applyCamera(currentProgress);
      renderFrame(performance.now() / 1000);
    }
  }

  function setBeats(beats: Partial<Record<BeatName, number>>) {
    let prev = 0;
    for (const key of JOURNEY) {
      const v = key.beat === "hero" ? 0 : beats[key.beat];
      // 単調増加を保証（セクション順が崩れてもカメラが逆走しない）
      if (typeof v === "number" && Number.isFinite(v)) key.t = Math.max(prev, Math.min(1, v));
      else key.t = Math.max(prev, key.t);
      prev = key.t;
    }
    if (!running && !reducedMotion) {
      applyCamera(currentProgress);
      renderFrame(performance.now() / 1000);
    }
  }

  // --- 突く（隠し要素） ---
  const raycaster = new THREE.Raycaster();
  const _ndc = new THREE.Vector2();
  const pokeTargets = [ramen, balloon, balloon2];
  function hitAt(clientX: number, clientY: number): THREE.Object3D | null {
    const rect = canvas.getBoundingClientRect();
    _ndc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(_ndc, camera);
    const hit = raycaster.intersectObjects(pokeTargets, true)[0];
    if (!hit) return null;
    // 当たったメッシュから、丼／気球のグループまで遡る
    let o: THREE.Object3D | null = hit.object;
    while (o && !pokeTargets.includes(o as THREE.Group)) o = o.parent;
    return o;
  }
  function poke(clientX: number, clientY: number): boolean {
    if (reducedMotion) return false;
    const target = hitAt(clientX, clientY);
    if (!target) return false;
    if (target === ramen) steamBurst = 1;
    else if (target === balloon) lift1.v += 2.6;
    else if (target === balloon2) lift2.v += 2.6;
    return true;
  }
  function canPoke(clientX: number, clientY: number): boolean {
    return !reducedMotion && hitAt(clientX, clientY) !== null;
  }

  return { start, stop, dispose, setProgress, setBeats, poke, canPoke };
}
