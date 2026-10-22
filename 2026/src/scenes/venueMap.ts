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
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { paperMaterial, PaperPost, PAPER_CORE, setPaperLite, type PaperKind } from "./paper";
import { ACCESS, type Floor, type Room, type RoomKind, type RouteLeg } from "../data/venueFloors";

export type ViewMode = "all" | "top";

export interface VenueMapController {
  setFloor: (id: string) => void;
  setView: (mode: ViewMode) => void;
  focus: (roomId: string | null) => void;
  /** 選択を解除し、カメラを最初の向きに戻す */
  reset: () => void;
  /** 拡大・縮小（1 より小さいと寄る） */
  zoomBy: (factor: number) => void;
  /** 紙の人形が出入口からその部屋まで歩いて案内する。道順がなければ false */
  guide: (roomId: string) => boolean;
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
/** 床の素材（仕切りのない区画の床・部屋の間・通路） */
const FLOOR_FINISH: Record<"wood" | "carpet", { color: number; kind: PaperKind }> = {
  wood: { color: 0xdcb98a, kind: "kraft" },
  carpet: { color: 0xc4c2bb, kind: "washi" },
};
/** トラックごとの床の紙の色（ラーメンの具になぞらえて） */
const TRACK_COLOR: [string, number][] = [
  ["醤油", 0xd9a86a],
  ["味噌", 0xe8c27a],
  ["塩", 0xeef0e6],
  ["チャーシュー", 0xe6b9a6],
];
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
  /** 起き上がり終わった壁・柱・段・台紙を材質ごとに結合したもの（描画回数を減らす） */
  baked: THREE.Group | null;
  rooms: BuiltRoom[];
  center: THREE.Vector3;
  radius: number;
}

const DOOR = 1.5; // 道順の所に開ける出入口の幅
const OUTLINE_W = 0.35; // 使える範囲の縁取りの幅

/** 点 p が線分 a→b の上にあるか（誤差 eps） */
function onSegment(px: number, py: number, [ax, ay, bx, by]: [number, number, number, number], eps = 0.05) {
  const len = Math.hypot(bx - ax, by - ay);
  const cross = ((bx - ax) * (py - ay) - (by - ay) * (px - ax)) / len;
  const t = ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / (len * len);
  return Math.abs(cross) < eps && t > -eps / len && t < 1 + eps / len;
}

/** 壁 a→b を道順の線分が横切る位置（a からの距離）の一覧 */
function doorCuts(ax: number, ay: number, bx: number, by: number, segs: [number, number, number, number][]) {
  const out: number[] = [];
  const rx = bx - ax;
  const ry = by - ay;
  const len = Math.hypot(rx, ry);
  for (const [px, py, qx, qy] of segs) {
    const sx = qx - px;
    const sy = qy - py;
    const den = rx * sy - ry * sx;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((px - ax) * sy - (py - ay) * sx) / den;
    const u = ((px - ax) * ry - (py - ay) * rx) / den;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) out.push(t * len);
  }
  return out;
}

/** 紙の人形（切り抜き）。名札付き。足元が原点 */
function makeDoll(): THREE.Group {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  // 胴と脚（台形のワンピース形）
  s.moveTo(-0.32, 0);
  s.lineTo(-0.1, 0);
  s.lineTo(-0.06, 0.32);
  s.lineTo(0.06, 0.32);
  s.lineTo(0.1, 0);
  s.lineTo(0.32, 0);
  s.lineTo(0.2, 0.95);
  s.lineTo(0.12, 1.08);
  s.lineTo(-0.12, 1.08);
  s.lineTo(-0.2, 0.95);
  s.closePath();
  const body = new THREE.Mesh(
    new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: false }),
    [paperMaterial(0x7b2c3a, { kind: "stock", seed: 31 }), paperMaterial(PAPER_CORE, { kind: "cardboard", thick: 0.06 })],
  );
  body.position.z = -0.03;
  const head = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.24, 0.06, 18),
    paperMaterial(0xf3d9bd, { kind: "washi", seed: 32 }),
  );
  head.rotation.x = Math.PI / 2;
  head.position.y = 1.36;
  const tag = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.07), paperMaterial(0xfbf6ea));
  tag.position.set(0, 0.72, 0.01);
  // 足元の影（丸い紙）
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.4, 16).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x2e2826, transparent: true, opacity: 0.18, depthWrite: false }),
  );
  shadow.position.y = 0.02;
  const fig = new THREE.Group();
  fig.add(body, head, tag);
  fig.name = "fig";
  g.add(fig, shadow);
  g.scale.setScalar(1.6);
  g.visible = false;
  return g;
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
  routes: Record<string, RouteLeg[]>,
  onSelect: (roomId: string | null) => void,
  hooks: {
    /** カメラの向き（ラジアン、北が 0）が変わったとき。方角の印を回すのに使う */
    onAzimuth?: (rad: number) => void;
    /** 1 本指で触った／ctrl なしでホイールを回したとき（操作方法の案内を出す） */
    onHint?: (kind: "touch" | "wheel") => void;
    /** 案内の途中で階が変わったとき（フロアのボタンを合わせる） */
    onFloor?: (id: string) => void;
    /** 案内が終わったとき */
    onGuideEnd?: (roomId: string) => void;
  } = {},
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
  // ページのスクロールを邪魔しない:
  //  - タッチは 1 本指＝ページのスクロール、2 本指＝回転と拡大
  //  - ホイールはページのスクロール。拡大は ctrl（⌘）＋ホイール（トラックパッドのピンチも同じ）とボタン
  controls.enableZoom = false;
  controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE };
  canvas.style.touchAction = "pan-y";
  canvas.addEventListener(
    "touchmove",
    (e) => {
      if (e.touches.length >= 2) e.preventDefault(); // 2 本指のときだけページを動かさない
      else hooks.onHint?.("touch");
    },
    { passive: false },
  );
  canvas.addEventListener(
    "wheel",
    (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        zoomBy(Math.exp(e.deltaY * 0.0025));
      } else hooks.onHint?.("wheel");
    },
    { passive: false },
  );
  const _off = new THREE.Vector3();
  function zoomBy(factor: number) {
    _off.copy(camera.position).sub(controls.target);
    const d = THREE.MathUtils.clamp(_off.length() * factor, controls.minDistance, controls.maxDistance);
    camera.position.copy(controls.target).add(_off.setLength(d));
    camGoal.active = false;
    kick();
  }

  const coreMat = paperMaterial(PAPER_CORE, { kind: "cardboard", thick: WALL_H });
  const wallMat = paperMaterial(0xfbf6ea, { kind: "stock", seed: 4 });
  const columnMat = paperMaterial(0xe7d8bf, { kind: "kraft", seed: 8 });
  const stepMat = paperMaterial(0xf6efe2, { kind: "stock", seed: 12 });
  // ガラス: 薄く透ける水色の板（深度を書かないので墨の輪郭線は出ない）
  const glassMat = paperMaterial(0xa9cfdd, { kind: "stock", seed: 16 });
  glassMat.transparent = true;
  glassMat.opacity = 0.6;
  glassMat.depthWrite = false;
  const doorAutoMat = paperMaterial(0x9ccbe0, { kind: "stock", seed: 18 });
  const doorManualMat = paperMaterial(0xb98a5a, { kind: "kraft", seed: 19 });
  const outlineMats = new Map<string, THREE.Material>();
  const DOOR_MAT = { auto: doorAutoMat, manual: doorManualMat, locked: paperMaterial(0xc8423a, { kind: "stock", seed: 20 }) };

  // --- フロアを組み立てる ---
  const built: BuiltFloor[] = floors.map((floor, fi) => {
    const group = new THREE.Group();
    group.visible = false;
    scene.add(group);

    // 外形（全部屋の範囲）＋余白の台紙
    const xs = floor.rooms.flatMap((r) => r.poly.map((p) => p[0]));
    const ys = floor.rooms.flatMap((r) => r.poly.map((p) => p[1]));
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const minX = x0 - 1.2;
    const maxX = x1 + 1.2;
    const minY = y0 - 1.2;
    const maxY = y1 + 1.2;
    // 建物の外まわりの辺か（仕切りのない区画は、ここにだけ壁を立てる）
    const near = (a: number, b: number) => Math.abs(a - b) < 0.05;
    const isOuter = (ax: number, ay: number, bx: number, by: number) =>
      (near(ax, x0) && near(bx, x0)) ||
      (near(ax, x1) && near(bx, x1)) ||
      (near(ay, y0) && near(by, y0)) ||
      (near(ay, y1) && near(by, y1));
    const isGlass = (ax: number, ay: number, bx: number, by: number) =>
      (floor.glass ?? []).some((g) => onSegment(ax, ay, g) && onSegment(bx, by, g));
    // 台紙の上面: 部屋の間の床（無ければクラフト紙）
    const base = floor.baseFloor ? FLOOR_FINISH[floor.baseFloor] : { color: 0xe7d8bf, kind: "kraft" as PaperKind };
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(maxX - minX, PLATE_T, maxY - minY),
      [coreMat, coreMat, paperMaterial(base.color, { kind: base.kind, seed: fi * 5 }), coreMat, coreMat, coreMat],
    );
    // 図面の y（北）を three の -z に
    plate.position.set((minX + maxX) / 2, -PLATE_T / 2, -(minY + maxY) / 2);
    group.add(plate);

    const walls: THREE.Object3D[] = [];
    // この階で人形が通る線分（壁に出入口を開けるのに使う）
    const routeSegs: [number, number, number, number][] = [];
    for (const legs of Object.values(routes)) {
      for (const leg of legs) {
        if (leg.floor !== floor.id) continue;
        for (let k = 1; k < leg.points.length; k++) {
          const [p1, p2] = [leg.points[k - 1], leg.points[k]];
          routeSegs.push([p1[0], p1[1], p2[0], p2[1]]);
        }
      }
    }
    /** 壁 a→b の上にあるドアの位置（a からの距離） */
    const doorsOn = (ax: number, ay: number, bx: number, by: number) =>
      (floor.doors ?? [])
        .filter((dr) => dr.kind !== "locked" && onSegment(dr.x, dr.y, [ax, ay, bx, by], 0.1))
        .map((dr) => Math.hypot(dr.x - ax, dr.y - ay));
    /** 壁 a→b を、道順とドアの所だけ開けて立てる */
    const addWallWithDoors = (ax: number, ay: number, bx: number, by: number, h: number, glass: boolean) => {
      const len = Math.hypot(bx - ax, by - ay);
      const cuts = [...doorCuts(ax, ay, bx, by, routeSegs), ...doorsOn(ax, ay, bx, by)].sort((p, q) => p - q);
      let from = 0;
      const pieces: [number, number][] = [];
      for (const c of cuts) {
        if (c - DOOR / 2 > from + 0.05) pieces.push([from, c - DOOR / 2]);
        from = Math.max(from, c + DOOR / 2);
      }
      if (len - from > 0.05) pieces.push([from, len]);
      const ux = (bx - ax) / len;
      const uy = (by - ay) / len;
      for (const [t0, t1] of pieces) addWall(ax + ux * t0, ay + uy * t0, ax + ux * t1, ay + uy * t1, h, glass);
    };
    /** a→b に壁の板を 1 枚立てる（起き上がる導入のため、下端を軸にしたグループに入れる） */
    const addWall = (ax: number, ay: number, bx: number, by: number, h: number, glass: boolean) => {
      const pl = Math.hypot(bx - ax, by - ay);
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(pl + WALL_T, h, WALL_T),
        glass ? glassMat : [coreMat, coreMat, wallMat, coreMat, wallMat, wallMat],
      );
      const hinge = new THREE.Group();
      hinge.position.set((ax + bx) / 2, 0, -(ay + by) / 2);
      hinge.rotation.y = Math.atan2(by - ay, bx - ax);
      wall.position.y = h / 2;
      hinge.add(wall);
      hinge.userData.order = Math.hypot((ax + bx) / 2, (ay + by) / 2);
      group.add(hinge);
      walls.push(hinge);
    };

    /** 多角形の内側に沿って幅 OUTLINE_W の帯を敷く（辺ごとの細長い紙。角は重なってよい） */
    const addOutline = (poly: [number, number][], color: string) => {
      let area = 0;
      for (let k = 0; k < poly.length; k++) {
        const [ax, ay] = poly[k];
        const [bx, by] = poly[(k + 1) % poly.length];
        area += ax * by - bx * ay;
      }
      const sign = area > 0 ? 1 : -1; // 反時計回りなら左が内側
      const mat = outlineMats.get(color) ?? paperMaterial(new THREE.Color(color).getHex(), { kind: "stock", seed: 40 });
      outlineMats.set(color, mat);
      for (let k = 0; k < poly.length; k++) {
        const [ax, ay] = poly[k];
        const [bx, by] = poly[(k + 1) % poly.length];
        const len = Math.hypot(bx - ax, by - ay);
        const nx = (-(by - ay) / len) * sign * OUTLINE_W;
        const ny = ((bx - ax) / len) * sign * OUTLINE_W;
        const shape = new THREE.Shape([
          new THREE.Vector2(ax, ay),
          new THREE.Vector2(bx, by),
          new THREE.Vector2(bx + nx, by + ny),
          new THREE.Vector2(ax + nx, ay + ny),
        ]);
        const geo = new THREE.ShapeGeometry(shape);
        geo.rotateX(-Math.PI / 2);
        const strip = new THREE.Mesh(geo, mat);
        strip.position.y = 0.03;
        group.add(strip);
      }
    };

    const rooms: BuiltRoom[] = floor.rooms.map((room, ri) => {
      // 用途が決まった部屋は、トラック（醤油・味噌・塩・チャーシュー）の色の紙にして目立たせる
      const track = room.use ? TRACK_COLOR.find(([k]) => room.use!.startsWith(k)) : undefined;
      const paper = track
        ? { color: track[1], kind: "washi" as PaperKind }
        : room.floor
          ? FLOOR_FINISH[room.floor]
          : FLOOR_PAPER[room.kind];
      const shape = new THREE.Shape(room.poly.map(([x, y]) => new THREE.Vector2(x, y)));
      const geo = new THREE.ShapeGeometry(shape);
      geo.rotateX(-Math.PI / 2); // XY → XZ（y がそのまま -z になる）
      const floorMat = paperMaterial(paper.color, { kind: paper.kind, seed: fi * 20 + ri });
      const floorMesh = new THREE.Mesh(geo, floorMat);
      floorMesh.position.y = 0.01;
      floorMesh.userData.roomId = room.id;
      group.add(floorMesh);

      // 壁: 外形の各辺に厚紙の板を立てる（関係者のみは低い塊にする）
      // ドアを書いた階の出入口は、四方を壁で囲んだ部屋（風除室）として高い壁にする
      const h = room.open
        ? WALL_H
        : room.kind === "staff"
          ? 0.6
          : room.kind === "entrance" && !floor.doors
            ? WALL_H * 0.6
            : WALL_H;
      // 廊下は複数の長方形をつないでいるので壁を立てない（つなぎ目をふさがないように）
      const isCorridor = room.id.startsWith("corridor");
      for (let i = 0; i < (isCorridor ? 0 : room.poly.length); i++) {
        const [ax, ay] = room.poly[i];
        const [bx, by] = room.poly[(i + 1) % room.poly.length];
        // 出入口の外側の辺は開けておく（入れる感じに）。ドアを書いた階は、ドアの所だけ開ける
        if (room.kind === "entrance" && !room.open && !floor.doors && i === 0) continue;
        // 仕切りのない区画は、建物の外まわりの辺だけ（ほかの部屋との境目は閉じた部屋の側が壁を立てる）
        const glass = isGlass(ax, ay, bx, by);
        if (room.open && !glass && !isOuter(ax, ay, bx, by)) continue;
        addWallWithDoors(ax, ay, bx, by, h, glass);
      }

      // 使える範囲: 床の縁を範囲の色の帯で縁取る
      if (room.access) addOutline(room.poly, ACCESS[room.access].color);

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
        ? // 「醤油｜トーク」を、短い札（醤油）と詳しい札で出し分ける（狭い画面は短い方）
          `<span class="vm-tag__use"><span class="vm-tag__short">${room.use.split("｜")[0]}</span><span class="vm-tag__long">${room.use}</span></span><small>${room.name}</small>`
        : `<span>${room.name}</span>`;
      label.hidden = true;
      label.dataset.room = room.id;
      if (room.kind === "staff" || isCorridor) label.dataset.skip = "1";
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

    // 部屋の辺のほかに立てる壁
    for (const [ax, ay, bx, by] of floor.partitions ?? []) addWallWithDoors(ax, ay, bx, by, WALL_H, false);

    // ドアの印（床に置く細い紙。自動ドアは水色、手動ドアは木の色、鍵の掛かるドアは赤）
    for (const dr of floor.doors ?? []) {
      if (dr.kind === "opening") continue;
      // ドアが乗っている壁の向き（部屋の辺か仕切りから探す）
      const edges: [number, number, number, number][] = [
        ...floor.rooms.flatMap((r) =>
          r.poly.map((p, k) => [...p, ...r.poly[(k + 1) % r.poly.length]] as [number, number, number, number]),
        ),
        ...(floor.partitions ?? []),
      ];
      const e = edges.find((g) => onSegment(dr.x, dr.y, g, 0.1));
      const ang = e ? Math.atan2(e[3] - e[1], e[2] - e[0]) : 0;
      const mark = new THREE.Mesh(new THREE.BoxGeometry(DOOR * 0.9, 0.05, 0.42), DOOR_MAT[dr.kind]);
      mark.position.set(dr.x, 0.04, -dr.y);
      mark.rotation.y = ang;
      group.add(mark);
    }

    // カウンター（低い木の台）
    for (const [ax, ay, bx, by] of floor.counters ?? []) {
      const len = Math.hypot(bx - ax, by - ay);
      const counter = new THREE.Mesh(new THREE.BoxGeometry(len, 0.55, 0.45), [columnMat, columnMat, doorManualMat, columnMat, columnMat, columnMat]);
      counter.position.set((ax + bx) / 2, 0.275, -(ay + by) / 2);
      counter.rotation.y = Math.atan2(by - ay, bx - ax);
      group.add(counter);
      walls.push(counter);
    }

    // フローリングの通路（床だけの帯。部屋の床の上に重ねる）
    if (floor.walkway) {
      const geo = new THREE.ShapeGeometry(new THREE.Shape(floor.walkway.map(([x, y]) => new THREE.Vector2(x, y))));
      geo.rotateX(-Math.PI / 2);
      const way = new THREE.Mesh(geo, paperMaterial(FLOOR_FINISH.wood.color, { kind: FLOOR_FINISH.wood.kind, seed: fi * 7 }));
      way.position.y = 0.02;
      group.add(way);
    }

    // 柱（丸柱は直径 1.1m ほど）
    const colGeo = floor.roundColumns
      ? new THREE.CylinderGeometry(0.55, 0.55, WALL_H * 1.05, 20)
      : new THREE.BoxGeometry(0.8, WALL_H * 1.05, 0.8);
    for (const [x, y] of floor.columns) {
      const col = new THREE.Mesh(colGeo, columnMat);
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
    return {
      floor,
      group,
      walls,
      rooms,
      center,
      radius: Math.hypot(maxX - minX, maxY - minY) / 2,
      baked: null,
    };
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
    const r = fitDistance(f.radius) * (camera.aspect < 1 ? 0.84 : 0.47);
    camGoal.target.copy(f.center);
    // 真上: 少しだけ南に寄せて、北（図面の上）が画面の上に来る向きに固定する
    if (view === "top") camGoal.pos.set(f.center.x, r * 1.6, f.center.z + r * 0.03);
    else {
      // 斜めから見ると手前が大きく見えて模型が下に寄るので、注視点を少し手前（南）にずらして中央に
      camGoal.target.z += f.radius * (camera.aspect < 1 ? 0.28 : 0.12);
      camGoal.pos.set(camGoal.target.x - r * 0.35, r * 0.95, camGoal.target.z + r * 0.95);
    }
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

  /**
   * 静的な部品（壁・柱・階段・台紙）を、今の姿勢のまま材質ごとに 1 つのメッシュへ結合する。
   * 壁は 1 枚ごとに 6 面×別材質のため、そのままだとフロアあたり数百回の描画になり、
   * ドラッグで回すと遅い端末では 10fps 程度まで落ちていた
   */
  function bake(f: BuiltFloor) {
    if (f.baked) return;
    f.group.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(f.group.matrixWorld).invert();
    const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
    const sources: THREE.Mesh[] = [];
    const roomFloors = new Set(f.rooms.map((r) => r.floorMesh));
    f.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh || roomFloors.has(m)) return;
      sources.push(m);
    });
    const local = new THREE.Matrix4();
    for (const m of sources) {
      local.multiplyMatrices(inv, m.matrixWorld);
      const src = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      const keep = ["position", "normal", "uv"];
      for (const name of Object.keys(src.attributes)) if (!keep.includes(name)) src.deleteAttribute(name);
      src.applyMatrix4(local);
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      const groups = m.geometry.groups.length ? m.geometry.groups : [{ start: 0, count: Infinity, materialIndex: 0 }];
      // toNonIndexed 後は index の範囲がそのまま頂点の範囲になる
      for (const g of groups) {
        // 材質が 1 つのメッシュでも BoxGeometry は 6 面のグループを持つので、配列でなければ常にその材質
        const mat = Array.isArray(m.material) ? mats[g.materialIndex ?? 0] : m.material;
        if (!mat) continue;
        const start = g.start;
        const count = Math.min(g.count, src.attributes.position.count - start);
        const part = new THREE.BufferGeometry();
        for (const name of keep) {
          const a = src.getAttribute(name) as THREE.BufferAttribute | undefined;
          if (!a) continue;
          part.setAttribute(
            name,
            new THREE.BufferAttribute(
              (a.array as Float32Array).slice(start * a.itemSize, (start + count) * a.itemSize),
              a.itemSize,
            ),
          );
        }
        if (!part.getAttribute("uv") || !part.getAttribute("normal")) continue;
        (byMat.get(mat) ?? byMat.set(mat, []).get(mat)!).push(part);
      }
      src.dispose();
    }
    const baked = new THREE.Group();
    for (const [mat, geos] of byMat) {
      const merged = mergeGeometries(geos);
      geos.forEach((g) => g.dispose());
      if (merged) baked.add(new THREE.Mesh(merged, mat));
    }
    for (const m of sources) m.visible = false;
    f.group.add(baked);
    f.baked = baked;
  }
  /** 導入をやり直すときは、結合版を外して元の部品に戻す */
  function unbake(f: BuiltFloor) {
    if (!f.baked) return;
    f.group.remove(f.baked);
    f.baked.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    f.baked = null;
    f.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.visible = true;
    });
  }

  // --- 紙の人形の案内 ---
  const doll = makeDoll();
  scene.add(doll);
  const WALK_SPEED = 8; // m/秒（模型なので速め）
  let walk: {
    roomId: string;
    legs: RouteLeg[];
    leg: number;
    dist: number;
    lens: number[];
    /** 階の切り替え後、この時刻（秒）まで待つ */
    resumeAt: number;
    /** 最後に進めたコマ番号（12fps） */
    lastFrame: number;
  } | null = null;

  function legLengths(leg: RouteLeg) {
    const out = [0];
    for (let k = 1; k < leg.points.length; k++) {
      const [a, b] = [leg.points[k - 1], leg.points[k]];
      out.push(out[k - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
    }
    return out;
  }
  /** 道順上の位置 d に人形を置き、進む向きに回す */
  function placeDoll(leg: RouteLeg, lens: number[], d: number, step: number) {
    let k = 1;
    while (k < lens.length - 1 && d > lens[k]) k++;
    const [a, b] = [leg.points[k - 1], leg.points[k]];
    const segLen = lens[k] - lens[k - 1] || 1;
    const u = Math.min(1, Math.max(0, (d - lens[k - 1]) / segLen));
    const x = a[0] + (b[0] - a[0]) * u;
    const y = a[1] + (b[1] - a[1]) * u;
    doll.position.set(x, 0, -y);
    // 紙の切り抜きなので、真横から見て線にならないよう常にカメラの方を向ける（向きは loop で更新）
    doll.rotation.y = controls.getAzimuthalAngle();
    // コマ撮りの歩き: 一歩ごとに少し跳ねて左右に傾く
    const fig = doll.getObjectByName("fig")!;
    fig.position.y = step % 2 ? 0.08 : 0;
    fig.rotation.z = step % 2 ? 0.06 : -0.06;
  }

  function guide(roomId: string) {
    const legs = routes[roomId];
    if (!legs?.length) return false;
    walk = { roomId, legs, leg: 0, dist: 0, lens: legLengths(legs[0]), resumeAt: 0, lastFrame: -1 };
    focused = null;
    if (current?.floor.id !== legs[0].floor) {
      setFloor(legs[0].floor);
      hooks.onFloor?.(legs[0].floor);
    }
    paintFocus();
    view = "all";
    retarget();
    // 出入口に立たせてから歩き出す（初期位置のまま一瞬見えないように）
    placeDoll(legs[0], walk.lens, 0, 0);
    doll.visible = true;
    if (reduced) {
      // 動きを減らす設定: 目的の階・部屋に人形を置くだけ
      const last = legs[legs.length - 1];
      if (current?.floor.id !== last.floor) {
        setFloor(last.floor);
        hooks.onFloor?.(last.floor);
      }
      const lens = legLengths(last);
      placeDoll(last, lens, lens[lens.length - 1], 0);
      walk = null;
      focus(roomId);
      hooks.onGuideEnd?.(roomId);
    }
    kick();
    return true;
  }

  /** 1 コマ進める。動いていれば true */
  function stepWalk(now: number) {
    if (!walk) return false;
    if (now < walk.resumeAt || introT0 >= 0) return true; // 階が起き上がるのを待つ
    const leg = walk.legs[walk.leg];
    const total = walk.lens[walk.lens.length - 1];
    // 12fps のコマ送りで進む
    const frame = Math.floor(now * 12);
    if (frame === walk.lastFrame) return true;
    walk.lastFrame = frame;
    walk.dist = Math.min(total, walk.dist + WALK_SPEED / 12);
    placeDoll(leg, walk.lens, walk.dist, frame);
    if (walk.dist >= total) {
      if (walk.leg < walk.legs.length - 1) {
        // EV で上の階へ: 人形を一度消し、次の階を起き上がらせてから続ける
        walk.leg++;
        const next = walk.legs[walk.leg];
        walk.lens = legLengths(next);
        walk.dist = 0;
        setFloor(next.floor);
        hooks.onFloor?.(next.floor);
        retarget();
        placeDoll(next, walk.lens, 0, 0);
        walk.resumeAt = now + 0.3;
      } else {
        const id = walk.roomId;
        walk = null;
        focus(id);
        hooks.onGuideEnd?.(id);
      }
    }
    return true;
  }

  function setFloor(id: string) {
    const next = built.find((b) => b.floor.id === id) ?? built[0];
    for (const b of built) {
      b.group.visible = b === next;
      for (const r of b.rooms) r.label.hidden = b !== next || !!r.label.dataset.skip;
    }
    current = next;
    focused = null;
    if (!walk) doll.visible = false;
    for (const r of next.rooms) {
      delete r.label.dataset.w;
      delete r.label.dataset.h;
    }
    paintFocus();
    if (reduced) {
      applyIntro(next, 99);
      bake(next);
    } else {
      unbake(next);
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
  // 札の優先度（重なったら低いものから隠す）
  const PRIORITY: Record<RoomKind, number> = { room: 3, hall: 3, entrance: 2, stairs: 1, wc: 1, staff: 0 };
  function placeLabels(w: number, h: number) {
    if (!current) return;
    const placed: { x0: number; y0: number; x1: number; y1: number }[] = [];
    const items = current.rooms
      .filter((r) => !r.label.hidden)
      .map((r) => {
        _v.copy(r.center).setY(WALL_H + 0.4).project(camera);
        const x = ((_v.x + 1) / 2) * w;
        const y = ((1 - _v.y) / 2) * h;
        const onScreen = _v.z < 1 && Math.abs(_v.x) < 1.1 && Math.abs(_v.y) < 1.1;
        // 選んだ部屋の札は必ず出す
        // 選んだ部屋 > 用途が決まった部屋 > そのほか
        const pri = r === focused ? 9 : r.room.use ? 5 : PRIORITY[r.room.kind];
        return { r, x, y, onScreen, pri };
      })
      .sort((a, b) => b.pri - a.pri);
    for (const it of items) {
      const el = it.r.label;
      // 札の大きさはフロア表示中は変わらないので初回だけ測る
      const lw = (el.dataset.w ??= String(el.offsetWidth || 80));
      const lh = (el.dataset.h ??= String(el.offsetHeight || 24));
      const box = { x0: it.x - +lw / 2 - 3, y0: it.y - +lh - 3, x1: it.x + +lw / 2 + 3, y1: it.y + 3 };
      const hit = placed.some((p) => box.x0 < p.x1 && p.x0 < box.x1 && box.y0 < p.y1 && p.y0 < box.y1);
      const show = it.onScreen && !hit;
      if (show) placed.push(box);
      el.style.visibility = show ? "visible" : "hidden";
      el.style.transform = `translate(-50%, -100%) translate(${it.x}px, ${it.y}px)`;
    }
  }

  // --- サイズ・描画ループ（動きがあるときだけ描く） ---
  let w = 1;
  let h = 1;
  function resize() {
    w = canvas.clientWidth || 1;
    h = canvas.clientHeight || 1;
    // 後処理は全画面 2 パスなので、画素密度は 1.5 倍までにする（見た目の差は小さい）
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
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
  let lastAz = NaN;
  let inLoop = false;
  // ループは常に 1 本だけ。描画中にカメラの change 等から kick されても、二重に予約しない
  // （以前は 1 フレームに何本もループが走り、ドラッグ中に同じ絵を何度も描いていた）
  function kick() {
    idleFrames = 0;
    if (!raf && !inLoop) raf = requestAnimationFrame(loop);
  }
  function loop(now: number) {
    raf = 0;
    inLoop = true;
    const t = now / 1000;
    let moving = false;
    if (current && introT0 >= 0) {
      // 24fps のコマ送りで起き上がる
      const sec = Math.floor((t - introT0) * 24) / 24;
      applyIntro(current, sec);
      if (sec > 1.6) {
        introT0 = -1;
        applyIntro(current, 99);
        bake(current);
      }
      moving = true;
    }
    if (stepWalk(t)) moving = true;
    if (camGoal.active) {
      camera.position.lerp(camGoal.pos, 0.09);
      controls.target.lerp(camGoal.target, 0.09);
      if (camera.position.distanceTo(camGoal.pos) < 0.05) camGoal.active = false;
      moving = true;
    }
    if (controls.update()) moving = true;
    const az = controls.getAzimuthalAngle();
    if (!(Math.abs(az - lastAz) <= 1e-4)) {
      lastAz = az;
      doll.rotation.y = az;
      hooks.onAzimuth?.(az);
    }
    post.render(renderer, scene, camera, t);
    placeLabels(w, h);
    // 線のふるえ（8fps）があるので、止まっても少しの間は描き続けてから休む
    if (moving) idleFrames = 0;
    else idleFrames++;
    inLoop = false;
    if (idleFrames < 90 && !raf) raf = requestAnimationFrame(loop);
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

  function reset() {
    walk = null;
    doll.visible = false;
    focused = null;
    paintFocus();
    retarget();
  }

  return { setFloor, setView, focus, reset, zoomBy, guide, dispose };
}
