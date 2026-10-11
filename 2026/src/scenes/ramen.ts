/**
 * 紙で作った料理模型の「旭川ラーメン」（醤油・表面にラードの膜）
 *
 * - 丼: 外側に雷紋の帯、縁は朱
 * - スープ: 醤油色＋金色の脂の玉（模様と立体の両方）
 * - 麺: 縮れ麺の束を波打つ山に盛る
 * - 具: 巻きチャーシュー 2 枚、なると（渦巻き・ギザギザの縁）、半割りの味玉、
 *       海苔、メンマ、小口切りのねぎ、割り箸
 *
 * 模様はすべて Canvas で生成（スキャン素材は使わない）。
 * 座標は ramen グループのローカル（丼の底が y=0、縁が y=0.46）。
 */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { paperMaterial } from "./paper";

export const RIM_Y = 0.46;
const BROTH_Y = 0.4;

const C = {
  bowl: 0xf6efe2,
  raimon: "#b8352e", // 朱
  rim: 0xb8352e,
  noodle: 0xf2d58a,
  menma: 0xa86a28,
  nori: 0x2f3b29,
  negi: 0x8db35a,
  negiDark: 0x5f8a3a,
  chashuSide: 0x7a4424,
  naruto: 0xfbf6ee,
  eggOuter: 0xc98a4a,
  chopstick: 0xdcc08a,
  fat: 0xf0c060,
};

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** 丼の外側: 生成りの地に、縁近くの雷紋の帯（LatheGeometry の UV: u=周、v=断面の下→上） */
function bowlTexture() {
  return canvasTex(1024, 512, (g) => {
    g.fillStyle = "#f6efe2";
    g.fillRect(0, 0, 1024, 512);
    // 帯は v=0.78〜0.94（キャンバスの y は上が v=1）
    const top = (1 - 0.95) * 512;
    const bottom = (1 - 0.77) * 512;
    g.strokeStyle = C.raimon;
    g.lineWidth = 4;
    for (const y of [top, bottom]) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(1024, y);
      g.stroke();
    }
    // 雷紋（四角い渦）を周に 16 個
    const units = 16;
    const uw = 1024 / units;
    const pad = 9;
    const h = bottom - top - pad * 2;
    g.lineWidth = 5;
    g.lineJoin = "miter";
    for (let i = 0; i < units; i++) {
      const x0 = i * uw + 4;
      const y0 = top + pad;
      const w = uw - 8;
      g.beginPath();
      g.moveTo(x0, y0 + h);
      g.lineTo(x0, y0);
      g.lineTo(x0 + w, y0);
      g.lineTo(x0 + w, y0 + h);
      g.lineTo(x0 + w * 0.25, y0 + h);
      g.lineTo(x0 + w * 0.25, y0 + h * 0.3);
      g.lineTo(x0 + w * 0.72, y0 + h * 0.3);
      g.lineTo(x0 + w * 0.72, y0 + h * 0.72);
      g.lineTo(x0 + w * 0.48, y0 + h * 0.72);
      g.lineTo(x0 + w * 0.48, y0 + h * 0.52);
      g.stroke();
    }
    // 高台の近くに細い線
    g.lineWidth = 3;
    const foot = (1 - 0.45) * 512;
    g.beginPath();
    g.moveTo(0, foot);
    g.lineTo(1024, foot);
    g.stroke();
  });
}

/** スープ: 醤油色のグラデーション＋ラードの膜のムラ＋金色の脂の玉 */
function soupTexture(rand: () => number) {
  return canvasTex(512, 512, (g) => {
    const grd = g.createRadialGradient(256, 256, 20, 256, 256, 256);
    grd.addColorStop(0, "#7a3d1a");
    grd.addColorStop(0.75, "#94522a");
    grd.addColorStop(1, "#b0703c");
    g.fillStyle = grd;
    g.fillRect(0, 0, 512, 512);
    // ラードの膜（薄い明るいムラ）
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(230, 170, 90, ${0.05 + rand() * 0.07})`;
      g.beginPath();
      g.ellipse(rand() * 512, rand() * 512, 20 + rand() * 50, 10 + rand() * 30, rand() * 3, 0, 7);
      g.fill();
    }
    // 脂の玉（大小）
    for (let i = 0; i < 140; i++) {
      const x = rand() * 512;
      const y = rand() * 512;
      const r = 1.5 + Math.pow(rand(), 2.5) * 11;
      g.fillStyle = "rgba(244, 196, 96, 0.85)";
      g.beginPath();
      g.arc(x, y, r, 0, 7);
      g.fill();
      if (r > 4) {
        g.fillStyle = "rgba(255, 246, 220, 0.9)";
        g.beginPath();
        g.arc(x - r * 0.35, y - r * 0.35, r * 0.28, 0, 7);
        g.fill();
      }
    }
  });
}

/** チャーシューの断面（巻かないバラ肉）: 焼き色の縁、赤身に脂の層と霜降り。
 *  ExtrudeGeometry の面 UV は形の座標そのものなので、repeat/offset で合わせる */
function chashuTexture(rand: () => number, w: number, h: number) {
  const t = canvasTex(256, 160, (g) => {
    g.fillStyle = "#6b3a1e";
    g.fillRect(0, 0, 256, 160);
    // 赤身
    const m = g.createLinearGradient(0, 0, 0, 160);
    m.addColorStop(0, "#b8664c");
    m.addColorStop(1, "#c97d62");
    g.fillStyle = m;
    g.beginPath();
    g.roundRect(14, 12, 228, 136, 26);
    g.fill();
    // 脂の層（波打つ横縞を 3 本）
    g.fillStyle = "#efd8b8";
    for (const [y0, th] of [
      [38, 13],
      [82, 17],
      [122, 11],
    ]) {
      g.beginPath();
      g.moveTo(14, y0);
      for (let x = 14; x <= 242; x += 8) g.lineTo(x, y0 + Math.sin(x * 0.05 + y0) * 5);
      for (let x = 242; x >= 14; x -= 8) g.lineTo(x, y0 + th + Math.sin(x * 0.045 + y0 * 1.3) * 4);
      g.closePath();
      g.fill();
    }
    // 霜降り
    for (let i = 0; i < 30; i++) {
      g.fillStyle = "rgba(240, 214, 184, 0.65)";
      g.beginPath();
      g.ellipse(20 + rand() * 216, 18 + rand() * 124, 2 + rand() * 5, 1 + rand() * 1.6, 0, 0, 7);
      g.fill();
    }
    // 焼き色の縁を少しぼかす
    g.strokeStyle = "rgba(90, 46, 22, 0.55)";
    g.lineWidth = 6;
    g.beginPath();
    g.roundRect(14, 12, 228, 136, 26);
    g.stroke();
  });
  t.repeat.set(1 / w, 1 / h);
  t.offset.set(0.5, 0.5);
  return t;
}

/** なるとの断面: 白地にピンクの渦（ExtrudeGeometry の面 UV は形の座標そのものなので、repeat/offset で合わせる） */
function narutoTexture(radius: number) {
  const t = canvasTex(256, 256, (g) => {
    g.fillStyle = "#fbf6ee";
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = "#e6798a";
    g.lineWidth = 15;
    g.lineCap = "round";
    g.beginPath();
    for (let a = 0; a < Math.PI * 6; a += 0.06) {
      const r = 4 + a * 5.6;
      const x = 128 + Math.cos(a) * r;
      const y = 128 + Math.sin(a) * r;
      if (a === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  });
  t.repeat.set(1 / (2 * radius), 1 / (2 * radius));
  t.offset.set(0.5, 0.5);
  return t;
}

/** 味玉の断面: 醤油色の縁 → 白身 → とろっとした橙の黄身（中心ほど濃く、照り） */
function eggTexture() {
  return canvasTex(256, 256, (g) => {
    const c = 128;
    g.fillStyle = "#c98a4a";
    g.beginPath();
    g.arc(c, c, 128, 0, 7);
    g.fill();
    g.fillStyle = "#fbf6ec";
    g.beginPath();
    g.arc(c, c, 118, 0, 7);
    g.fill();
    const y = g.createRadialGradient(c, c + 6, 6, c, c, 70);
    y.addColorStop(0, "#e2780e");
    y.addColorStop(0.6, "#f09a22");
    y.addColorStop(1, "#f4b445");
    g.fillStyle = y;
    g.beginPath();
    g.arc(c, c + 4, 70, 0, 7);
    g.fill();
    g.fillStyle = "rgba(255, 240, 200, 0.75)";
    g.beginPath();
    g.ellipse(c - 22, c - 18, 14, 7, -0.6, 0, 7);
    g.fill();
  });
}

/** 縮れ麺 1 本の曲線: 丼を横切り、中央で山に盛り上がり、両端はスープに沈む */
function noodleCurve(angle: number, lateral: number, phase: number, rand: () => number) {
  const pts: THREE.Vector3[] = [];
  const L = 0.4;
  const dir = new THREE.Vector2(Math.cos(angle), Math.sin(angle));
  const nrm = new THREE.Vector2(-dir.y, dir.x);
  const n = 40;
  const jitter = rand() * 0.02;
  for (let i = 0; i <= n; i++) {
    const s = -L + (i / n) * L * 2;
    const k = s / L; // -1..1
    const mound = 0.1 * Math.pow(Math.cos((k * Math.PI) / 2), 2) - 0.012; // 山＋端は沈む
    const crimp = Math.sin(s * 34 + phase) * 0.013; // 縮れ（横）
    const bob = Math.sin(s * 21 + phase * 1.7) * 0.006; // 縮れ（縦）
    const x = dir.x * s + nrm.x * (lateral + crimp);
    const z = dir.y * s + nrm.y * (lateral + crimp);
    pts.push(new THREE.Vector3(x, mound + bob + jitter * Math.max(0, 1 - Math.abs(k)), z));
  }
  return new THREE.CatmullRomCurve3(pts);
}

/** 麺の山の表面の高さ（スープ面からの高さ）。具を麺の上に載せるのに使う */
const NOODLE_CENTER = new THREE.Vector2(-0.02, -0.02);
function moundY(x: number, z: number) {
  const r = Math.hypot(x - NOODLE_CENTER.x, z - NOODLE_CENTER.y);
  const k = Math.min(1, r / 0.4);
  return Math.max(0.004, 0.1 * Math.pow(Math.cos((k * Math.PI) / 2), 2) - 0.012) + 0.019;
}

export function buildRamen(rand: () => number): THREE.Group {
  const g = new THREE.Group();

  // --- 丼（雷紋）---
  const profile = new THREE.SplineCurve([
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.22, 0.0),
    new THREE.Vector2(0.32, 0.05),
    new THREE.Vector2(0.42, 0.16),
    new THREE.Vector2(0.51, 0.31),
    new THREE.Vector2(0.58, RIM_Y),
  ]).getPoints(16);
  const bowl = new THREE.Mesh(
    new THREE.LatheGeometry(profile, 32),
    paperMaterial(0xffffff, { map: bowlTexture(), doubleSide: true }),
  );
  g.add(bowl);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.575, 0.022, 6, 40), paperMaterial(C.rim));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = RIM_Y;
  g.add(rim);

  // --- スープ＋立体の脂の玉 ---
  const soup = new THREE.Mesh(
    new THREE.CircleGeometry(0.545, 40),
    paperMaterial(0xffffff, { map: soupTexture(rand) }),
  );
  soup.rotation.x = -Math.PI / 2;
  soup.position.y = BROTH_Y;
  g.add(soup);
  const fatCount = 16;
  const fat = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 10, 6),
    paperMaterial(C.fat),
    fatCount,
  );
  const d = new THREE.Object3D();
  for (let i = 0; i < fatCount; i++) {
    // 麺の山を避け、スープの見える外周寄りに
    const a = rand() * Math.PI * 2;
    const r = 0.36 + rand() * 0.15;
    const s = 0.012 + rand() * 0.02;
    d.position.set(Math.cos(a) * r, BROTH_Y + 0.002, Math.sin(a) * r);
    d.scale.set(s, s * 0.25, s);
    d.rotation.set(0, 0, 0);
    d.updateMatrix();
    fat.setMatrixAt(i, d.matrix);
  }
  g.add(fat);

  // --- 縮れ麺: 5 束 × 6 本を波打つ山に（1 メッシュに結合）---
  const noodleGeos: THREE.BufferGeometry[] = [];
  const bundles = 5;
  for (let b = 0; b < bundles; b++) {
    const angle = (b / bundles) * Math.PI + (rand() - 0.5) * 0.35;
    const center = (rand() - 0.5) * 0.12;
    for (let k = 0; k < 6; k++) {
      const lateral = center + (k - 2.5) * 0.034;
      const curve = noodleCurve(angle, lateral, rand() * 6.28, rand);
      noodleGeos.push(new THREE.TubeGeometry(curve, 60, 0.019, 5, false));
    }
  }
  const noodles = new THREE.Mesh(mergeGeometries(noodleGeos), paperMaterial(C.noodle));
  for (const ng of noodleGeos) ng.dispose();
  noodles.position.set(-0.02, BROTH_Y, -0.02);
  g.add(noodles);

  // --- 海苔: 奥の左に 2 枚、少し反らせて立てる ---
  const noriGeo = new THREE.BoxGeometry(0.2, 0.25, 0.004, 8, 1, 1);
  const np = noriGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < np.count; i++) {
    const x = np.getX(i);
    np.setZ(i, np.getZ(i) - (x * x) * 0.9); // 横方向に反る
  }
  noriGeo.computeVertexNormals();
  const noriMat = paperMaterial(C.nori, { grain: 2.2 });
  [
    { x: -0.26, z: -0.34, yaw: 0.6, tilt: -0.32 },
    { x: -0.11, z: -0.41, yaw: 0.25, tilt: -0.38 },
  ].forEach((p) => {
    const m = new THREE.Mesh(noriGeo, noriMat);
    m.position.set(p.x, BROTH_Y + 0.09, p.z);
    m.rotation.set(p.tilt, p.yaw, 0);
    g.add(m);
  });

  // --- チャーシュー 2 枚（巻かないバラ肉）: 麺の山の奥右に、少し重ねて寝かせる ---
  const cw = 0.27;
  const ch = 0.16;
  const chashuSide = paperMaterial(C.chashuSide);
  const chashuCap = paperMaterial(0xffffff, { map: chashuTexture(rand, cw, ch) });
  const makeSlice = () => {
    // 角の丸い、少しいびつな四角（手で切った肉の形）
    const shape = new THREE.Shape();
    const n = 28;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      // 超楕円で角丸の四角に近づけ、縁を不揃いに
      const px = Math.sign(c) * Math.pow(Math.abs(c), 0.55) * (cw / 2) * (0.94 + rand() * 0.06);
      const py = Math.sign(sn) * Math.pow(Math.abs(sn), 0.55) * (ch / 2) * (0.92 + rand() * 0.08);
      if (i === 0) shape.moveTo(px, py);
      else shape.lineTo(px, py);
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false });
    return new THREE.Mesh(geo, [chashuCap, chashuSide]);
  };
  [
    { x: 0.17, z: -0.2, yaw: 0.35, tilt: 0.5 },
    { x: 0.28, z: -0.05, yaw: -0.25, tilt: 0.42 },
  ].forEach((p, i) => {
    const m = makeSlice();
    // 形は XY 平面（面が +Z 向き）→ 上向きに寝かせ、手前へ少し起こす
    m.rotation.set(-Math.PI / 2 + p.tilt, 0, 0);
    const holder = new THREE.Group();
    holder.add(m);
    holder.rotation.y = p.yaw;
    holder.position.set(p.x, BROTH_Y + moundY(p.x, p.z) + 0.035 + i * 0.012, p.z);
    g.add(holder);
  });

  // --- なると: ギザギザの縁の断面、左に立てかける ---
  const nr = 0.075;
  const narutoShape = new THREE.Shape();
  const teeth = 18;
  for (let i = 0; i <= teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? nr : nr * 0.9;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) narutoShape.moveTo(x, y);
    else narutoShape.lineTo(x, y);
  }
  const narutoGeo = new THREE.ExtrudeGeometry(narutoShape, { depth: 0.022, bevelEnabled: false });
  narutoGeo.center();
  const naruto = new THREE.Mesh(narutoGeo, [
    paperMaterial(0xffffff, { map: narutoTexture(nr) }),
    paperMaterial(C.naruto),
  ]);
  naruto.position.set(-0.28, BROTH_Y + 0.08, 0.02);
  naruto.rotation.set(-0.95, 0.35, 0.1);
  g.add(naruto);

  // --- 味玉（半割り）: 醤油色の殻側＋断面。手前右 ---
  const egg = new THREE.Group();
  const eggShell = new THREE.Mesh(
    new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    paperMaterial(C.eggOuter),
  );
  eggShell.rotation.x = Math.PI; // 丸い側を下に
  const eggFace = new THREE.Mesh(
    new THREE.CircleGeometry(1, 28),
    paperMaterial(0xffffff, { map: eggTexture() }),
  );
  eggFace.rotation.x = -Math.PI / 2;
  eggFace.position.y = 0.001;
  egg.add(eggShell, eggFace);
  egg.scale.set(0.075, 0.07, 0.105);
  egg.position.set(0.19, BROTH_Y + 0.07, 0.24);
  egg.rotation.set(0.55, -0.4, 0); // 断面をこちらに向ける
  g.add(egg);

  // --- メンマ: 短冊を 5 本、麺の山の左奥に立てかけて並べる ---
  // （丼の手前の縁は低い視点から具を隠すので、見える奥寄り・高めに置く）
  const menmaGeos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const x = -0.25 + i * 0.03 + (rand() - 0.5) * 0.008;
    const z = -0.1 + i * 0.012 + (rand() - 0.5) * 0.01;
    const m = new THREE.BoxGeometry(0.03, 0.016, 0.13);
    m.rotateX(-0.75 + (rand() - 0.5) * 0.15); // 奥を持ち上げ、こちらへ断面を見せる
    m.rotateY(-0.35 + (rand() - 0.5) * 0.2);
    m.rotateZ((rand() - 0.5) * 0.2);
    m.translate(x, moundY(x, z) + 0.045, z);
    menmaGeos.push(m);
  }
  const menma = new THREE.Mesh(mergeGeometries(menmaGeos), paperMaterial(C.menma));
  for (const m of menmaGeos) m.dispose();
  menma.position.y = BROTH_Y;
  g.add(menma);

  // --- 小口切りのねぎ: 麺の山の頂上にこんもり＋周りに少し散らす。輪は寝かせる ---
  const negiCount = 34;
  const negi = new THREE.InstancedMesh(
    new THREE.TorusGeometry(0.016, 0.0055, 4, 10),
    paperMaterial(0xffffff),
    negiCount,
  );
  const light = new THREE.Color(C.negi);
  const dark = new THREE.Color(C.negiDark);
  for (let i = 0; i < negiCount; i++) {
    const heap = i < 24;
    const a = rand() * Math.PI * 2;
    const r = heap ? Math.sqrt(rand()) * 0.09 : 0.1 + rand() * 0.14;
    const x = -0.03 + Math.cos(a) * r;
    const z = 0.04 + Math.sin(a) * r;
    // 山の中心ほど重なって高くなる
    const pile = heap ? (1 - r / 0.09) * 0.025 + rand() * 0.008 : 0;
    d.position.set(x, BROTH_Y + moundY(x, z) + 0.004 + pile, z);
    d.rotation.set(Math.PI / 2 + (rand() - 0.5) * 0.7, (rand() - 0.5) * 0.5, rand() * Math.PI);
    d.scale.setScalar(0.85 + rand() * 0.4);
    d.updateMatrix();
    negi.setMatrixAt(i, d.matrix);
    negi.setColorAt(i, rand() < 0.5 ? light : dark);
  }
  g.add(negi);

  // --- 割り箸: 右側の縁に、奥から手前へ渡す（付け根がつながった形）---
  const chopGeos: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const c = new THREE.CylinderGeometry(0.009, 0.015, 1.15, 4);
    c.rotateY(Math.PI / 4); // 角を立てた四角い断面
    c.rotateX(Math.PI / 2); // 長さ方向を z に
    // 先端（手前）ほど 2 本が開く
    c.rotateY(side * 0.025);
    c.translate(side * 0.014, 0, 0);
    chopGeos.push(c);
  }
  const chop = new THREE.Mesh(mergeGeometries(chopGeos), paperMaterial(C.chopstick));
  for (const c of chopGeos) c.dispose();
  chop.position.set(0.43, RIM_Y + 0.04, -0.02);
  chop.rotation.y = -0.18;
  g.add(chop);

  return g;
}
