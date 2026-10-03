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
  menma: 0xc8913e,
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

/** 巻きチャーシューの断面: 焼き目 → 脂の輪 → 赤身、巻いた脂の渦と霜降り */
function chashuTexture(rand: () => number) {
  return canvasTex(256, 256, (g) => {
    const c = 128;
    g.fillStyle = "#6b3a1e";
    g.beginPath();
    g.arc(c, c, 128, 0, 7);
    g.fill();
    g.fillStyle = "#f1dfc2";
    g.beginPath();
    g.arc(c, c, 112, 0, 7);
    g.fill();
    g.fillStyle = "#c8765e";
    g.beginPath();
    g.arc(c, c, 100, 0, 7);
    g.fill();
    // 巻いた脂の渦
    g.strokeStyle = "#ecd3b4";
    g.lineWidth = 7;
    g.beginPath();
    for (let a = 0; a < Math.PI * 5; a += 0.08) {
      const r = 8 + a * 5.6;
      const x = c + Math.cos(a) * r;
      const y = c + Math.sin(a) * r;
      if (a === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
    // 霜降り
    for (let i = 0; i < 26; i++) {
      const a = rand() * 7;
      const r = rand() * 90;
      g.fillStyle = "rgba(240, 215, 185, 0.7)";
      g.beginPath();
      g.ellipse(c + Math.cos(a) * r, c + Math.sin(a) * r, 2 + rand() * 4, 1 + rand() * 2, a, 0, 7);
      g.fill();
    }
  });
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

  // --- 巻きチャーシュー 2 枚: 麺の山の奥右に立てかける ---
  const chashuTex = chashuTexture(rand);
  const chashuCap = paperMaterial(0xffffff, { map: chashuTex });
  const chashuSide = paperMaterial(C.chashuSide);
  const chashuGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.026, 28);
  [
    { x: 0.19, y: 0.1, z: -0.19, rx: 0.72, rz: -0.25 },
    { x: 0.3, y: 0.085, z: -0.05, rx: 0.8, rz: -0.5 },
  ].forEach((p) => {
    const m = new THREE.Mesh(chashuGeo, [chashuSide, chashuCap, chashuCap]);
    m.position.set(p.x, BROTH_Y + p.y, p.z);
    m.rotation.set(p.rx, 0, p.rz);
    g.add(m);
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

  // --- メンマ: 短冊を束ねて手前左 ---
  const menmaGeos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const m = new THREE.BoxGeometry(0.1, 0.012, 0.024);
    m.rotateY(0.25 + (rand() - 0.5) * 0.3);
    m.rotateZ((rand() - 0.5) * 0.25);
    m.translate(-0.15 + (rand() - 0.5) * 0.03, 0.065 + i * 0.009, 0.27 + (i - 2) * 0.022);
    menmaGeos.push(m);
  }
  const menma = new THREE.Mesh(mergeGeometries(menmaGeos), paperMaterial(C.menma));
  for (const m of menmaGeos) m.dispose();
  menma.position.y = BROTH_Y;
  g.add(menma);

  // --- 小口切りのねぎ: 小さな輪を散らす（色に濃淡）---
  const negiCount = 26;
  const negi = new THREE.InstancedMesh(
    new THREE.TorusGeometry(0.016, 0.0055, 4, 10),
    paperMaterial(0xffffff),
    negiCount,
  );
  const light = new THREE.Color(C.negi);
  const dark = new THREE.Color(C.negiDark);
  for (let i = 0; i < negiCount; i++) {
    const a = rand() * Math.PI * 2;
    const r = 0.04 + rand() * 0.24;
    d.position.set(Math.cos(a) * r, BROTH_Y + 0.085 + rand() * 0.03, Math.sin(a) * r + 0.04);
    d.rotation.set(Math.PI / 2 + (rand() - 0.5) * 0.8, 0, rand() * Math.PI);
    d.scale.setScalar(0.8 + rand() * 0.5);
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
