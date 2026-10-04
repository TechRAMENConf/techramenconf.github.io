/**
 * 会場の 3D マップ（厚紙で作ったペーパークラフトの模型）
 *
 * - 床は色紙、壁は白い厚紙（切り口に段ボールの芯）、墨の輪郭線（paper.ts の後処理）
 * - フロアを切り替えるたびに、平らな図面から壁が起き上がる（しかけ絵本）
 * - 部屋を選ぶとカメラが寄り、その部屋だけ色が付く
 * - ラベルは DOM の荷札（labelLayer に置き、3D の位置に合わせて動かす）
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { paperMaterial, PaperPost, PAPER_CORE, setPaperLite, type PaperKind } from "./paper";
import type { Floor, Room, RoomKind } from "../data/venueFloors";

export type ViewMode = "all" | "top";

export interface VenueMapController {
  setFloor: (id: string) => void;
  setView: (mode: ViewMode) => void;
  focus: (roomId: string | null) => void;
  dispose: () => void;
}

const WALL_H = 1.25; // 模型らしく、壁は実寸より低く
const WALL_T = 0.16;
const PLATE_T = 0.35;

/** 部屋の種類ごとの床の紙 */
const FLOOR_PAPER: Record<RoomKind, { color: number; kind: PaperKind }> = {
  room: { color: 0xf1e4c8, kind: "washi" },
  hall: { color: 0xe9dcc0, kind: "washi" },
  entrance: { color: 0xd9e2bf, kind: "washi" },
  stairs: { color: 0xd7e3ea, kind: "stock" },
  wc: { color: 0xe4e0d8, kind: "stock" },
  staff: { color: 0xc9c2b4, kind: "kraft" },
};
/** 選んだ部屋の床（色が付く） */
const FOCUS_COLOR = 0xcf9b3e;

interface BuiltRoom {
  room: Room;
  floorMesh: THREE.Mesh;
  baseColor: THREE.Color;
  center: THREE.Vector3;
  size: number;
  label: HTMLButtonElement;
}

interface BuiltFloor {
  floor: Floor;
  group: THREE.Group;
  walls: THREE.Object3D[];
  rooms: BuiltRoom[];
  center: THREE.Vector3;
  radius: number;
}

function centroid(poly: [number, number][]) {
  let x = 0;
  let y = 0;
  for (const [px, py] of poly) {
    x += px;
    y += py;
  }
  return [x / poly.length, y / poly.length] as const;
}

export function createVenueMap(
  canvas: HTMLCanvasElement,
  labelLayer: HTMLElement,
  floors: Floor[],
  onSelect: (roomId: string | null) => void,
): VenueMapController {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isSmall = Math.min(innerWidth, innerHeight) < 640;
  setPaperLite(isSmall);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isSmall, alpha: true });
  renderer.setClearColor(0x000000, 0);
  const post = new PaperPost();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.5, 400);

  scene.add(new THREE.HemisphereLight(0xfff3e0, 0x6a5746, 1.1));
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.1);
  sun.position.set(-20, 40, 25);
  scene.add(sun);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minPolarAngle = 0;
  controls.maxPolarAngle = Math.PI * 0.42; // 横から覗き込みすぎない
  controls.screenSpacePanning = true;
  controls.minDistance = 8;
  controls.maxDistance = 200;

  const coreMat = paperMaterial(PAPER_CORE, { kind: "cardboard", thick: WALL_H });
  const wallMat = paperMaterial(0xfbf6ea, { kind: "stock", seed: 4 });
  const columnMat = paperMaterial(0xe7d8bf, { kind: "kraft", seed: 8 });
  const stepMat = paperMaterial(0xf6efe2, { kind: "stock", seed: 12 });

  // --- フロアを組み立てる ---
  const built: BuiltFloor[] = floors.map((floor, fi) => {
    const group = new THREE.Group();
    group.visible = false;
    scene.add(group);

    // 外形（全部屋の範囲）＋余白の台紙
    const xs = floor.rooms.flatMap((r) => r.poly.map((p) => p[0]));
    const ys = floor.rooms.flatMap((r) => r.poly.map((p) => p[1]));
    const minX = Math.min(...xs) - 1.2;
    const maxX = Math.max(...xs) + 1.2;
    const minY = Math.min(...ys) - 1.2;
    const maxY = Math.max(...ys) + 1.2;
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(maxX - minX, PLATE_T, maxY - minY),
      [coreMat, coreMat, paperMaterial(0xe7d8bf, { kind: "kraft", seed: fi * 5 }), coreMat, coreMat, coreMat],
    );
    // 図面の y（北）を three の -z に
    plate.position.set((minX + maxX) / 2, -PLATE_T / 2, -(minY + maxY) / 2);
    group.add(plate);

    const walls: THREE.Object3D[] = [];
    const rooms: BuiltRoom[] = floor.rooms.map((room, ri) => {
      const paper = FLOOR_PAPER[room.kind];
      const shape = new THREE.Shape(room.poly.map(([x, y]) => new THREE.Vector2(x, y)));
      const geo = new THREE.ShapeGeometry(shape);
      geo.rotateX(-Math.PI / 2); // XY → XZ（y がそのまま -z になる）
      const floorMat = paperMaterial(paper.color, { kind: paper.kind, seed: fi * 20 + ri });
      const floorMesh = new THREE.Mesh(geo, floorMat);
      floorMesh.position.y = 0.01;
      floorMesh.userData.roomId = room.id;
      group.add(floorMesh);

      // 壁: 外形の各辺に厚紙の板を立てる（関係者のみは低い塊にする）
      const h = room.kind === "staff" ? 0.6 : room.kind === "entrance" ? WALL_H * 0.6 : WALL_H;
      for (let i = 0; i < room.poly.length; i++) {
        const [ax, ay] = room.poly[i];
        const [bx, by] = room.poly[(i + 1) % room.poly.length];
        const len = Math.hypot(bx - ax, by - ay);
        // 出入口の外側の辺は開けておく（入れる感じに）
        if (room.kind === "entrance" && i === 0) continue;
        const wall = new THREE.Mesh(new THREE.BoxGeometry(len + WALL_T, h, WALL_T), [
          coreMat,
          coreMat,
          wallMat,
          coreMat,
          wallMat,
          wallMat,
        ]);
        // 起き上がる導入のため、壁は下端を軸にしたグループに入れる
        const hinge = new THREE.Group();
        hinge.position.set((ax + bx) / 2, 0, -(ay + by) / 2);
        hinge.rotation.y = Math.atan2(by - ay, bx - ax);
        wall.position.y = h / 2;
        hinge.add(wall);
        hinge.userData.order = Math.hypot((ax + bx) / 2, (ay + by) / 2);
        group.add(hinge);
        walls.push(hinge);
      }

      // 階段: 段々の紙
      if (room.kind === "stairs") {
        const [cx, cy] = centroid(room.poly);
        for (let s = 0; s < 6; s++) {
          const step = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.14 * (s + 1), 0.45), stepMat);
          step.position.set(cx - 0.9, 0.07 * (s + 1), -(cy - 1.2 + s * 0.45));
          group.add(step);
        }
      }

      const [cx, cy] = centroid(room.poly);
      const w = Math.max(...room.poly.map((p) => p[0])) - Math.min(...room.poly.map((p) => p[0]));
      const d = Math.max(...room.poly.map((p) => p[1])) - Math.min(...room.poly.map((p) => p[1]));

      // ラベル（荷札）。関係者のみは出さない
      const label = document.createElement("button");
      label.type = "button";
      label.className = `vm-tag vm-tag--${room.kind}`;
      label.innerHTML = room.use
        ? `<span class="vm-tag__use">${room.use}</span><small>${room.name}</small>`
        : `<span>${room.name}</span>`;
      label.hidden = true;
      label.dataset.room = room.id;
      if (room.kind === "staff") label.dataset.skip = "1";
      label.addEventListener("click", () => onSelect(room.id));
      labelLayer.append(label);

      return {
        room,
        floorMesh,
        baseColor: new THREE.Color(paper.color),
        center: new THREE.Vector3(cx, 0, -cy),
        size: Math.max(w, d),
        label,
      };
    });

    // 柱
    for (const [x, y] of floor.columns) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.8, WALL_H * 1.05, 0.8), columnMat);
      col.position.set(x, (WALL_H * 1.05) / 2, -y);
      group.add(col);
      walls.push(col);
    }

    // 足あと（出入口から EV・階段へ）
    if (floor.path && floor.path.length > 1) {
      const pts = floor.path.map(([x, y]) => new THREE.Vector3(x, 0.03, -y));
      const curve = new THREE.CatmullRomCurve3(pts);
      const n = Math.ceil(curve.getLength() / 0.9);
      const stepGeo = new THREE.CircleGeometry(0.16, 8);
      stepGeo.rotateX(-Math.PI / 2);
      const steps = new THREE.InstancedMesh(stepGeo, paperMaterial(0x7b2c3a), n * 2);
      const m = new THREE.Object3D();
      for (let i = 0; i < n; i++) {
        const t = i / n;
        const p = curve.getPointAt(t);
        const tan = curve.getTangentAt(t);
        const side = new THREE.Vector3(-tan.z, 0, tan.x).multiplyScalar(i % 2 ? 0.18 : -0.18);
        m.position.copy(p).add(side);
        m.scale.set(0.8, 1, 1.25);
        m.rotation.y = Math.atan2(tan.x, tan.z);
        m.updateMatrix();
        steps.setMatrixAt(i, m.matrix);
      }
      steps.count = n;
      group.add(steps);
    }

    const center = new THREE.Vector3((minX + maxX) / 2, 0, -(minY + maxY) / 2);
    walls.sort((a, b) => (a.userData.order ?? 0) - (b.userData.order ?? 0));
    return { floor, group, walls, rooms, center, radius: Math.hypot(maxX - minX, maxY - minY) / 2 };
  });

  // --- カメラの行き先（滑らかに移る） ---
  const camGoal = { pos: new THREE.Vector3(), target: new THREE.Vector3(), active: false };
  let current: BuiltFloor | null = null;
  let view: ViewMode = "all";
  let focused: BuiltRoom | null = null;

  /** 半径 radius の範囲が画面の縦横どちらにも収まるカメラ距離 */
  function fitDistance(radius: number) {
    const vHalf = THREE.MathUtils.degToRad(camera.fov / 2);
    const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
    return radius / Math.sin(Math.min(vHalf, hHalf));
  }
  function aimAll(f: BuiltFloor) {
    // 縦長は斜め視点で横幅が広がって見えるので少し引く
    const r = fitDistance(f.radius) * (camera.aspect < 1 ? 0.76 : 0.55);
    camGoal.target.copy(f.center);
    // 真上: 少しだけ南に寄せて、北（図面の上）が画面の上に来る向きに固定する
    if (view === "top") camGoal.pos.set(f.center.x, r * 1.6, f.center.z + r * 0.03);
    else camGoal.pos.set(f.center.x - r * 0.35, r * 0.95, f.center.z + r * 0.95);
  }
  function aimRoom(br: BuiltRoom) {
    const r = Math.max(6, fitDistance(br.size * 0.75) * 0.62);
    camGoal.target.copy(br.center);
    if (view === "top") camGoal.pos.set(br.center.x, r * 1.4, br.center.z + r * 0.03);
    else camGoal.pos.set(br.center.x - r * 0.3, r * 0.9, br.center.z + r * 0.85);
  }
  function retarget(instant = false) {
    if (!current) return;
    if (focused) aimRoom(focused);
    else aimAll(current);
    if (instant || reduced) {
      camera.position.copy(camGoal.pos);
      controls.target.copy(camGoal.target);
      camGoal.active = false;
    } else camGoal.active = true;
    kick();
  }
  // ユーザーが触ったらカメラの自動移動はやめる
  controls.addEventListener("start", () => {
    camGoal.active = false;
  });
  controls.addEventListener("change", () => kick());

  // --- 起き上がる導入 ---
  let introT0 = -1;
  function applyIntro(f: BuiltFloor, sec: number) {
    const n = f.walls.length;
    f.walls.forEach((w, i) => {
      const k = Math.min(1, Math.max(0, (sec - (i / n) * 0.9) / 0.45));
      const e = 1 + 2.5 * Math.pow(k - 1, 3) + 1.5 * Math.pow(k - 1, 2); // 少し行き過ぎて止まる
      if (w instanceof THREE.Group) w.rotation.x = -(Math.PI / 2) * (1 - e);
      else w.scale.y = Math.max(0.001, e);
    });
  }

  function setFloor(id: string) {
    const next = built.find((b) => b.floor.id === id) ?? built[0];
    for (const b of built) {
      b.group.visible = b === next;
      for (const r of b.rooms) r.label.hidden = b !== next || !!r.label.dataset.skip;
    }
    current = next;
    focused = null;
    paintFocus();
    if (reduced) applyIntro(next, 99);
    else {
      applyIntro(next, 0);
      introT0 = performance.now() / 1000;
    }
    retarget(true);
  }

  function setView(mode: ViewMode) {
    view = mode;
    retarget();
  }

  function paintFocus() {
    if (!current) return;
    for (const r of current.rooms) {
      const mat = r.floorMesh.material as THREE.MeshToonMaterial;
      const on = !focused || r === focused;
      mat.color.copy(r === focused ? new THREE.Color(FOCUS_COLOR) : r.baseColor);
      // 選んでいない部屋は少し褪せさせる
      if (!on) mat.color.lerp(new THREE.Color(0xd8d2c6), 0.5);
      r.label.classList.toggle("is-active", r === focused);
      r.label.classList.toggle("is-dim", !!focused && r !== focused);
    }
  }

  function focus(roomId: string | null) {
    focused = current?.rooms.find((r) => r.room.id === roomId) ?? null;
    paintFocus();
    retarget();
  }

  // 床をクリックしても選べる
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let downAt = { x: 0, y: 0 };
  canvas.addEventListener("pointerdown", (e) => (downAt = { x: e.clientX, y: e.clientY }));
  canvas.addEventListener("pointerup", (e) => {
    if (!current || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) return; // ドラッグは除外
    const rect = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(current.rooms.map((r) => r.floorMesh))[0];
    const id = hit?.object.userData.roomId as string | undefined;
    const room = current.rooms.find((r) => r.room.id === id);
    onSelect(room && room.room.kind !== "staff" ? room.room.id : null);
  });

  // --- ラベルを 3D の位置に合わせる ---
  const _v = new THREE.Vector3();
  function placeLabels(w: number, h: number) {
    if (!current) return;
    for (const r of current.rooms) {
      if (r.label.hidden) continue;
      _v.copy(r.center).setY(WALL_H + 0.4).project(camera);
      const visible = _v.z < 1 && Math.abs(_v.x) < 1.1 && Math.abs(_v.y) < 1.1;
      r.label.style.visibility = visible ? "visible" : "hidden";
      r.label.style.transform = `translate(-50%, -100%) translate(${((_v.x + 1) / 2) * w}px, ${((1 - _v.y) / 2) * h}px)`;
    }
  }

  // --- サイズ・描画ループ（動きがあるときだけ描く） ---
  let w = 1;
  let h = 1;
  function resize() {
    w = canvas.clientWidth || 1;
    h = canvas.clientHeight || 1;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    post.setSize(w, h, dpr);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    retarget(true);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  let raf = 0;
  let idleFrames = 0;
  function kick() {
    idleFrames = 0;
    if (!raf) raf = requestAnimationFrame(loop);
  }
  function loop(now: number) {
    raf = 0;
    const t = now / 1000;
    let moving = false;
    if (current && introT0 >= 0) {
      // 24fps のコマ送りで起き上がる
      const sec = Math.floor((t - introT0) * 24) / 24;
      applyIntro(current, sec);
      if (sec > 1.6) introT0 = -1;
      moving = true;
    }
    if (camGoal.active) {
      camera.position.lerp(camGoal.pos, 0.09);
      controls.target.lerp(camGoal.target, 0.09);
      if (camera.position.distanceTo(camGoal.pos) < 0.05) camGoal.active = false;
      moving = true;
    }
    if (controls.update()) moving = true;
    post.render(renderer, scene, camera, t);
    placeLabels(w, h);
    // 線のふるえ（8fps）があるので、止まっても少しの間は描き続けてから休む
    if (moving) idleFrames = 0;
    else idleFrames++;
    if (idleFrames < 90) raf = requestAnimationFrame(loop);
  }

  resize();
  setFloor(floors[0].id);
  // シェーダを裏で並列にコンパイルしておく（全フロアの材質を含む）
  for (const b of built) b.group.visible = true;
  renderer
    .compileAsync(scene, camera)
    .catch(() => undefined)
    .finally(() => {
      for (const b of built) b.group.visible = b === current;
      kick();
    });
  for (const b of built) b.group.visible = b === current;

  function dispose() {
    cancelAnimationFrame(raf);
    ro.disconnect();
    controls.dispose();
    post.dispose();
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else (mat as THREE.Material | undefined)?.dispose();
    });
    renderer.dispose();
    labelLayer.replaceChildren();
  }

  return { setFloor, setView, focus, dispose };
}
