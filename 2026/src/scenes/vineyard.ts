/**
 * TechRAMEN 2026 — ペーパークラフトの富良野（晩秋〜初雪）
 *
 * 切り絵レイヤーの丘 + 具と箸つきの湯気立つラーメン丼
 * + 漂う気球 + 初雪。装飾レイヤー（情報はDOM側が担保）。
 * ※ ぶどう畑は「畑に見えない」ため一旦削除（復活させる場合は要再設計）。
 *
 * 公開API: createVineyard(canvas) -> { start, stop, dispose }
 * - 遅延初期化前提（呼び出し側が IntersectionObserver で start/stop を制御）
 * - prefers-reduced-motion 時は1フレームだけ描画してアニメ停止
 */
import * as THREE from "three";

export interface VineyardController {
  start: () => void;
  stop: () => void;
  dispose: () => void;
  /** スクロール進捗 0..1 を渡すとカメラが富良野を巡る */
  setProgress: (p: number) => void;
}

const COLORS = {
  sky: 0x000000, // 透明（CSS側の空を使う）
  grape: 0x6a2f56,
  grapeDark: 0x4a2440,
  leaf: 0x7a934a,
  gold: 0xcf9b3e,
  wheat: 0xddb867,
  snow: 0xf3ece0,
  soil: 0x8a6b4f,
  bowl: 0xf6efe2,
  bowlRim: 0x7b2c3a,
  broth: 0xb5733a,
  noodle: 0xf0d9a0,
  chashu: 0x9a5a30,
  naruto: 0xe6929a,
  egg: 0xf4ecdc,
  yolk: 0xe2a93e,
  negi: 0x7a934a,
  chopstick: 0xc7a36a,
  balloon: 0x7b2c3a,
  balloonAlt: 0xcf9b3e,
  basket: 0x8a6b4f,
};

/** 上辺が波打つ「ちぎり紙の丘」レイヤーを作る */
function makeHillLayer(
  width: number,
  height: number,
  topAmplitude: number,
  seed: number,
  color: number,
  depth: number,
): THREE.Mesh {
  const shape = new THREE.Shape();
  const segments = 26;
  shape.moveTo(-width / 2, -height);
  shape.lineTo(-width / 2, 0);
  // 波打つ上辺
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = -width / 2 + t * width;
    const wobble =
      Math.sin(t * Math.PI * 2.2 + seed) * topAmplitude * 0.6 +
      Math.sin(t * Math.PI * 5.7 + seed * 1.7) * topAmplitude * 0.4;
    shape.lineTo(x, wobble);
  }
  shape.lineTo(width / 2, -height);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.05,
    bevelSegments: 1,
  });
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.95,
    metalness: 0,
    flatShading: true,
  });
  return new THREE.Mesh(geo, mat);
}

export function createVineyard(canvas: HTMLCanvasElement): VineyardController {
  const reducedMotion =
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isSmall = Math.min(window.innerWidth, window.innerHeight) < 640;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !isSmall,
    alpha: true,
    powerPreference: "low-power",
  });
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);

  // --- カメラの旅: スクロール進捗(0..1)で富良野を巡るキーフレーム ---
  type CamKey = { t: number; pos: [number, number, number]; look: [number, number, number] };
  const JOURNEY: CamKey[] = [
    { t: 0.0, pos: [0, 2.4, 9.2], look: [0, 0.9, 0] }, // ヒーロー: 広く
    { t: 0.28, pos: [-0.9, 1.9, 6.4], look: [0, 0.95, -1.4] }, // 日程: 丘の連なりへ
    { t: 0.52, pos: [2.4, 2.3, 5.9], look: [1.3, 0.6, 0.6] }, // アクセス: 丘を横移動
    { t: 0.74, pos: [2.75, 1.05, 3.1], look: [2.7, 0.45, 1.1] }, // ロードマップ: ラーメンに寄る
    { t: 1.0, pos: [0, 3.9, 9.9], look: [0, 1.8, -1.3] }, // 締め: 空へ引く
  ];
  const _camPos = new THREE.Vector3();
  const _camLook = new THREE.Vector3();
  const _tmp = new THREE.Vector3();
  const smooth = (x: number) => x * x * (3 - 2 * x);

  function evalJourney(p: number) {
    p = Math.min(1, Math.max(0, p));
    let i = 0;
    while (i < JOURNEY.length - 1 && p > JOURNEY[i + 1].t) i++;
    const a = JOURNEY[i];
    const b = JOURNEY[Math.min(i + 1, JOURNEY.length - 1)];
    const span = b.t - a.t || 1;
    const k = smooth((p - a.t) / span);
    _camPos.set(a.pos[0], a.pos[1], a.pos[2]).lerp(_tmp.set(b.pos[0], b.pos[1], b.pos[2]), k);
    _camLook.set(a.look[0], a.look[1], a.look[2]).lerp(_tmp.set(b.look[0], b.look[1], b.look[2]), k);
  }

  let aspect = 1;
  function applyCamera(p: number) {
    evalJourney(p);
    // 縦長(モバイル)は引き＋画角拡大で全体を映す
    if (aspect < 1) {
      const k = Math.min(1, (1 - aspect) * 1.6);
      camera.fov = 40 + k * 16;
      _tmp.copy(_camPos).sub(_camLook).normalize().multiplyScalar(k * 2.6);
      camera.position.copy(_camPos).add(_tmp);
      _camLook.y += k * 0.5;
    } else {
      camera.fov = 40;
      camera.position.copy(_camPos);
    }
    camera.lookAt(_camLook);
    camera.updateProjectionMatrix();
  }

  let targetProgress = 0;
  let currentProgress = 0;
  applyCamera(0);

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
  for (const d of hillDefs) {
    const hill = makeHillLayer(d.w, d.h, d.amp, d.seed, d.color, d.depth);
    hill.position.set(0, d.y, d.z);
    world.add(hill);
  }

  // --- ラーメン丼 + 具 + 湯気（主役。温泉に見えないよう箸と具を載せる） ---
  const ramen = new THREE.Group();
  ramen.position.set(2.7, 0.15, 1.1);
  ramen.scale.setScalar(1.3);
  world.add(ramen);

  // 丼: 丸い「どんぶり」形（尖らないよう、平らな底＋丸く広がる縁）
  const bowlPts: THREE.Vector2[] = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.22, 0.0),
    new THREE.Vector2(0.32, 0.05),
    new THREE.Vector2(0.42, 0.16),
    new THREE.Vector2(0.51, 0.31),
    new THREE.Vector2(0.58, 0.46),
  ];
  const bowl = new THREE.Mesh(
    new THREE.LatheGeometry(bowlPts, 22),
    new THREE.MeshStandardMaterial({ color: COLORS.bowl, roughness: 0.8, flatShading: true }),
  );
  ramen.add(bowl);

  const rimY = 0.46;
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.56, 0.03, 8, 22),
    new THREE.MeshStandardMaterial({ color: COLORS.bowlRim, roughness: 0.7, flatShading: true }),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = rimY;
  ramen.add(rim);

  // スープ（醤油色・縁より少し下。温泉の透明な湯に見えないよう濃いめ）
  const brothY = 0.4;
  const soup = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 22),
    new THREE.MeshStandardMaterial({ color: COLORS.broth, roughness: 0.7 }),
  );
  soup.rotation.x = -Math.PI / 2;
  soup.position.y = brothY;
  ramen.add(soup);

  // 麺: 細いストランドを重ねた「麺の束」（1本の太い輪ではなく束ねる）
  const noodleMat = new THREE.MeshStandardMaterial({
    color: COLORS.noodle,
    roughness: 0.85,
    flatShading: true,
  });
  // 長くうねった麺のストランド（絡まった本物の麺に近づけ、丼全体に広く盛る）
  const noodleNest = new THREE.Group();
  noodleNest.position.set(-0.02, brothY + 0.02, 0.0);
  const strandCount = 22;
  for (let i = 0; i < strandCount; i++) {
    const pts: THREE.Vector3[] = [];
    const segs = 7;
    const baseA = Math.random() * Math.PI * 2;
    // ストランドごとに中心をずらして、丼全体に広く散らす
    const cx = (Math.random() - 0.5) * 0.28;
    const cz = (Math.random() - 0.5) * 0.28;
    const baseR = 0.08 + Math.random() * 0.22;
    const sweep = Math.PI * (1.0 + Math.random() * 1.7); // 部分的に巻く
    for (let s = 0; s <= segs; s++) {
      const a = baseA + (s / segs) * sweep;
      const r = baseR + Math.sin(s * 1.7 + i) * 0.05 + (Math.random() - 0.5) * 0.03;
      pts.push(
        new THREE.Vector3(cx + Math.cos(a) * r, Math.random() * 0.07, cz + Math.sin(a) * r),
      );
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.TubeGeometry(curve, 20, 0.014, 5, false);
    noodleNest.add(new THREE.Mesh(tube, noodleMat));
  }
  ramen.add(noodleNest);

  // 具: チャーシュー / なると / 味玉 / ねぎ（麺の山の上に載せる）
  const toppingY = brothY + 0.12; // 麺の盛り(～+0.10)の上
  const chashu = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.15, 0.045, 14),
    new THREE.MeshStandardMaterial({ color: COLORS.chashu, roughness: 0.8, flatShading: true }),
  );
  chashu.position.set(0.2, toppingY, -0.04);
  chashu.rotation.x = -0.12;
  ramen.add(chashu);

  const naruto = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 0.045, 14),
    new THREE.MeshStandardMaterial({ color: COLORS.naruto, roughness: 0.8, flatShading: true }),
  );
  naruto.position.set(-0.26, toppingY, -0.1);
  naruto.rotation.x = -0.1;
  ramen.add(naruto);

  // 味玉（半割り）: 小さめに。白いドーム＋黄身の断面
  const egg = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: COLORS.egg, roughness: 0.7, flatShading: true }),
  );
  egg.position.set(0.0, toppingY - 0.02, 0.28);
  ramen.add(egg);
  const yolk = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 10, 8),
    new THREE.MeshStandardMaterial({ color: COLORS.yolk, roughness: 0.6, flatShading: true }),
  );
  yolk.position.set(0.0, toppingY + 0.02, 0.28);
  ramen.add(yolk);

  const negiMat = new THREE.MeshStandardMaterial({
    color: COLORS.negi,
    roughness: 0.9,
    flatShading: true,
  });
  const negiGeo = new THREE.BoxGeometry(0.05, 0.04, 0.05);
  for (let i = 0; i < 8; i++) {
    const negi = new THREE.Mesh(negiGeo, negiMat);
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 0.38;
    negi.position.set(Math.cos(a) * r, brothY + 0.13, Math.sin(a) * r);
    negi.rotation.y = Math.random() * Math.PI;
    ramen.add(negi);
  }

  // 箸: 縁より上を斜めに横切らせる（器を貫通させない）
  const chopMat = new THREE.MeshStandardMaterial({
    color: COLORS.chopstick,
    roughness: 0.85,
    flatShading: true,
  });
  const chopGeo = new THREE.BoxGeometry(0.028, 0.028, 1.0);
  for (let i = 0; i < 2; i++) {
    const chop = new THREE.Mesh(chopGeo, chopMat);
    chop.position.set(0.02 + i * 0.07, 0.76, 0.02);
    chop.rotation.set(0.44, -0.32, 0.03);
    ramen.add(chop);
  }

  // 湯気（小さな板を上昇させる）
  const steam = new THREE.Group();
  steam.position.copy(ramen.position);
  steam.position.y += 0.78; // 新しい丼の縁の高さに合わせる
  world.add(steam);
  const steamMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
  });
  const steamPuffs: THREE.Mesh[] = [];
  const steamCount = isSmall ? 3 : 5;
  for (let i = 0; i < steamCount; i++) {
    const puff = new THREE.Mesh(new THREE.CircleGeometry(0.16, 8), steamMat.clone());
    puff.position.set((Math.random() - 0.5) * 0.25, Math.random() * 1.2, 0);
    puff.userData.phase = Math.random();
    steam.add(puff);
    steamPuffs.push(puff);
  }

  // --- 気球（漂う） ---
  function makeBalloon(color: number, radius: number): THREE.Group {
    const g = new THREE.Group();
    const env = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 12, 12),
      new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true }),
    );
    env.scale.y = 1.25;
    g.add(env);
    const basket = new THREE.Mesh(
      new THREE.BoxGeometry(radius * 0.3, radius * 0.3, radius * 0.3),
      new THREE.MeshStandardMaterial({ color: COLORS.basket, roughness: 1, flatShading: true }),
    );
    basket.position.y = -radius * 1.7;
    g.add(basket);
    return g;
  }

  const balloon = makeBalloon(COLORS.balloon, 0.55);
  balloon.position.set(-3.0, 3.0, -1.5);
  world.add(balloon);

  // 2つ目の気球（小さめ・金色）。空の余白を埋める（特にモバイル縦長） ---
  const balloon2 = makeBalloon(COLORS.balloonAlt, 0.36);
  balloon2.position.set(2.6, 4.3, -3.2);
  world.add(balloon2);

  // --- 初雪（Points） ---
  const snowCount = reducedMotion ? 0 : isSmall ? 100 : 130;
  let snow: THREE.Points | null = null;
  const snowVel: number[] = [];
  if (snowCount > 0) {
    const pos = new Float32Array(snowCount * 3);
    for (let i = 0; i < snowCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 1] = Math.random() * 10;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 8 - 1;
      snowVel.push(0.004 + Math.random() * 0.008);
    }
    const snowGeo = new THREE.BufferGeometry();
    snowGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    snow = new THREE.Points(
      snowGeo,
      new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.09,
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

  // --- サイズ調整 ---
  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    aspect = w / h;
    camera.aspect = aspect;
    applyCamera(reducedMotion ? 0 : currentProgress);
  }
  const ro = new ResizeObserver(() => resize());
  ro.observe(canvas);
  resize();

  // --- ループ ---
  let running = false;
  let raf = 0;

  function render() {
    const t = performance.now() / 1000;

    // スクロール進捗を滑らかに追従してカメラを移動
    currentProgress += (targetProgress - currentProgress) * 0.07;
    applyCamera(currentProgress);

    // ごく軽いポインタ視差（旅の邪魔をしない程度）
    target.x += (pointer.x * 0.2 - target.x) * 0.04;
    target.y += (pointer.y * 0.12 - target.y) * 0.04;
    world.rotation.y = target.x * 0.1;
    world.rotation.x = target.y * 0.05;

    if (!reducedMotion) {
      // 湯気
      for (const puff of steamPuffs) {
        puff.userData.phase += 0.0035;
        if (puff.userData.phase > 1) puff.userData.phase -= 1;
        const ph = puff.userData.phase as number;
        puff.position.y = ph * 1.4;
        puff.position.x += Math.sin(t * 1.5 + ph * 6) * 0.0015;
        const mat = puff.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.sin(ph * Math.PI) * 0.5;
        puff.scale.setScalar(0.6 + ph * 0.9);
      }
      // 気球
      balloon.position.x = -3.0 + Math.sin(t * 0.18) * 0.7;
      balloon.position.y = 3.0 + Math.sin(t * 0.5) * 0.12;
      balloon.rotation.z = Math.sin(t * 0.4) * 0.05;
      balloon2.position.x = 2.6 + Math.sin(t * 0.13 + 2) * 1.0;
      balloon2.position.y = 4.3 + Math.sin(t * 0.42 + 1) * 0.14;
      balloon2.rotation.z = Math.sin(t * 0.33 + 1) * 0.06;
      // 雪
      if (snow) {
        const arr = (snow.geometry.getAttribute("position") as THREE.BufferAttribute)
          .array as Float32Array;
        for (let i = 0; i < snowCount; i++) {
          arr[i * 3 + 1] -= snowVel[i];
          arr[i * 3] += Math.sin(t + i) * 0.002;
          if (arr[i * 3 + 1] < -1) arr[i * 3 + 1] = 9 + Math.random();
        }
        snow.geometry.getAttribute("position").needsUpdate = true;
      }
    }

    renderer.render(scene, camera);
    if (running) raf = requestAnimationFrame(render);
  }

  function start() {
    if (running || reducedMotion) {
      if (reducedMotion) renderer.render(scene, camera); // 静止1フレーム
      return;
    }
    running = true;
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
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = (mesh as THREE.Mesh).material;
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
      renderer.render(scene, camera);
    }
  }

  // reduced-motion でも初期構図を一度描画
  if (reducedMotion) {
    applyCamera(0);
    renderer.render(scene, camera);
  }

  return { start, stop, dispose, setProgress };
}
