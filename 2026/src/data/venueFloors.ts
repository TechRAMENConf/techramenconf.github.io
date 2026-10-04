/**
 * 会場（コンシェルジュ フラノ）の模式図データ。単位はメートル、x は東（図面の右）、y は北（図面の上）。
 *
 * 出典:
 *  - 1F: 改修工事図面「1 階平面図」（2018/01/31）。柱は X 方向 8m 間隔、Y1–Y4 = 0 / 6.25 / 15.45 / 24.65
 *  - 4F: 「フラノデザイン PLAN」（2022/09/20）。階は建物情報からの推定
 * 図面からの読み取りなので寸法は概略。裏方（守衛室・荷解場・機械室など）は「関係者のみ」にまとめている。
 *
 * use: 当日の用途（トラック・ハンズオン・受付など）。決まったらここに書くと、ラベルと色が変わる。
 */
export type RoomKind = "room" | "hall" | "entrance" | "stairs" | "wc" | "staff";

export interface Room {
  id: string;
  /** 施設での名前 */
  name: string;
  /** 当日の用途（未定なら null） */
  use: string | null;
  kind: RoomKind;
  /** 外形（反時計回りでも時計回りでもよい） */
  poly: [number, number][];
}

export interface Floor {
  id: string;
  label: string;
  note?: string;
  rooms: Room[];
  /** 柱（中心） */
  columns: [number, number][];
  /** 足あとの道順（出入口から EV・階段まで） */
  path?: [number, number][];
}

const rect = (x0: number, y0: number, x1: number, y1: number): [number, number][] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

const Y2 = 6.25;
const Y3 = 15.45;
const Y4 = 24.65;

export const FLOORS: Floor[] = [
  {
    id: "1F",
    label: "1F",
    note: "駅側の出入口から。上の階へは EV・階段で",
    rooms: [
      { id: "restaurant", name: "レストラン", use: null, kind: "room", poly: rect(0, 11.2, 11.7, Y4) },
      { id: "kitchen", name: "キッチン", use: null, kind: "staff", poly: rect(0, 7.4, 11.7, 11.2) },
      { id: "vestibule2", name: "北の出入口", use: null, kind: "entrance", poly: rect(11.9, 20.2, 15.8, Y4) },
      { id: "shop", name: "ショップ・ラウンジ", use: null, kind: "hall", poly: rect(15.8, 7.6, 32.2, 18.0) },
      { id: "ev2", name: "EV・階段", use: null, kind: "stairs", poly: rect(17.5, 18.0, 28.0, Y4) },
      { id: "east", name: "東ホール", use: null, kind: "hall", poly: rect(32.2, Y2, 40.2, 17.0) },
      {
        id: "vestibule1",
        name: "東の出入口",
        use: null,
        kind: "entrance",
        // 角を斜めに落とした風除室
        poly: [
          [37.0, 17.0],
          [46.5, 17.0],
          [48.0, 19.0],
          [48.0, Y4],
          [40.2, Y4],
          [37.0, 21.0],
        ],
      },
      { id: "wc", name: "トイレ", use: null, kind: "wc", poly: rect(7.7, 0, 15.0, 6.6) },
      { id: "stairsC", name: "階段", use: null, kind: "stairs", poly: rect(0, 0, 7.7, 6.6) },
      { id: "staffS", name: "関係者のみ", use: null, kind: "staff", poly: rect(15.0, 0, 28.6, 7.6) },
      { id: "stairsB", name: "EV・階段", use: null, kind: "stairs", poly: rect(28.6, 0, 33.4, Y2) },
      { id: "staffE", name: "関係者のみ", use: null, kind: "staff", poly: rect(33.4, 0, 40.2, Y2) },
      { id: "stairsA", name: "階段", use: null, kind: "stairs", poly: rect(40.2, 0, 48.0, Y2) },
    ],
    columns: [
      [16, Y3],
      [24, Y3],
      [32, Y3],
      [16, Y4],
      [24, Y4],
      [32, Y4],
      [40, Y3],
      [0, Y3],
      [8, Y3],
    ],
    path: [
      [44.5, 21.5],
      [38.5, 15.0],
      [33.0, 9.5],
      [31.0, 5.0],
    ],
  },
  {
    id: "4F",
    label: "4F",
    note: "フラノデザインのフロア（4 階と推定）",
    rooms: [
      { id: "seminar", name: "セミナールーム", use: null, kind: "room", poly: rect(0, 2.2, 11.8, 9.2) },
      { id: "studio", name: "スタジオ", use: null, kind: "room", poly: rect(11.98, 2.2, 15.78, 9.2) },
      { id: "office", name: "オフィス", use: null, kind: "staff", poly: rect(17.96, 0, 23.81, 9.34) },
      { id: "corridor", name: "廊下", use: null, kind: "hall", poly: rect(-1.6, 0.6, 17.96, 2.2) },
      { id: "stairs4", name: "階段", use: null, kind: "stairs", poly: rect(-1.6, 2.2, 0, 4.0) },
      { id: "back", name: "関係者のみ", use: null, kind: "staff", poly: rect(-1.6, -1.8, 17.96, 0.6) },
      { id: "backE", name: "関係者のみ", use: null, kind: "staff", poly: rect(16.6, -3.0, 23.81, 0) },
    ],
    columns: [],
    path: [
      [-0.8, 3.2],
      [-0.8, 1.4],
      [4.0, 1.4],
      [4.0, 2.6],
    ],
  },
];
