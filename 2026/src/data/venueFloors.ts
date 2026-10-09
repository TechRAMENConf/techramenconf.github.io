/**
 * 会場（コンシェルジュ フラノ）の模式図データ。単位はメートル、x は東（図面の右）、y は北（図面の上）。
 *
 * 出典:
 *  - 1F: 改修工事図面「1 階平面図」（2018/01/31）。柱は X 方向 8m 間隔、Y1–Y4 = 0 / 6.25 / 15.45 / 24.65
 *  - 2F: フロア案内図（寸法なし）。外形が 1F と同じ縦横比（約 1.95）なので、1F の外形 48 × 24.65m に合わせて換算
 *  - 4F: 「フラノデザイン PLAN」（2022/09/20）（4 階）
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
  /** フロアのボタンに添える中身の説明 */
  sub: string;
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
    sub: "入口・ラウンジ",
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
    id: "2F",
    label: "2F",
    sub: "ホール・ラウンジ",
    note: "ホール A・B（仕切りを外すと大ホール）とラウンジのある階。ほかは団体の事務所です",
    rooms: [
      { id: "hallA", name: "ホール A", use: null, kind: "room", poly: rect(7.25, 15.02, 15.62, 24.65) },
      { id: "hallB", name: "ホール B", use: null, kind: "room", poly: rect(7.25, 10.95, 15.62, 15.02) },
      { id: "lounge", name: "ラウンジ", use: null, kind: "hall", poly: rect(20.29, 17.64, 31.92, 19.9) },
      { id: "kitchen", name: "シェアキッチン", use: null, kind: "room", poly: rect(20.29, 15.47, 31.92, 17.64) },
      { id: "meeting", name: "特別会議室", use: null, kind: "room", poly: rect(31.92, 17.87, 38.04, 24.65) },
      { id: "ev2N", name: "EV・階段", use: null, kind: "stairs", poly: rect(18.11, 20.13, 28.53, 24.65) },
      { id: "stairs2S", name: "階段", use: null, kind: "stairs", poly: rect(26.35, 2.8, 33.74, 6.42) },
      { id: "ev2S", name: "EV", use: null, kind: "stairs", poly: rect(33.96, 2.8, 36.23, 6.42) },
      { id: "wc2", name: "トイレ", use: null, kind: "wc", poly: rect(8.15, 2.8, 16.08, 6.42) },
      { id: "corridor-s", name: "廊下", use: null, kind: "hall", poly: rect(5.89, 6.42, 42.25, 8.82) },
      { id: "corridor-w", name: "廊下", use: null, kind: "hall", poly: rect(15.62, 8.82, 17.8, 20.13) },
      { id: "corridor-m", name: "廊下", use: null, kind: "hall", poly: rect(17.8, 15.47, 20.29, 20.13) },
      { id: "corridor-e", name: "廊下", use: null, kind: "hall", poly: rect(38.04, 8.37, 39.85, 24.65) },
      // 団体・行政の事務所（関係者のみ）
      { id: "office-city", name: "関係者のみ", use: null, kind: "staff", poly: rect(0, 14.02, 5.43, 24.65) },
      { id: "office-kankou", name: "関係者のみ", use: null, kind: "staff", poly: rect(0, 6.42, 5.89, 14.02) },
      { id: "office-jc", name: "関係者のみ", use: null, kind: "staff", poly: rect(8.92, 8.82, 15.62, 10.95) },
      { id: "office-tenants", name: "関係者のみ", use: null, kind: "staff", poly: rect(17.8, 8.82, 35.32, 15.47) },
      {
        id: "office-exec",
        name: "関係者のみ",
        use: null,
        kind: "staff",
        poly: [
          [39.85, 18.09],
          [48.0, 18.09],
          [48.0, 22.6],
          [46.3, 24.65],
          [39.85, 24.65],
        ],
      },
      { id: "office-cci", name: "関係者のみ", use: null, kind: "staff", poly: rect(39.85, 8.37, 48.0, 18.09) },
      { id: "office-consult", name: "関係者のみ", use: null, kind: "staff", poly: rect(42.25, 6.33, 48.0, 8.37) },
    ],
    columns: [],
    // 北側の EV・階段からホールへ
    path: [
      [19.25, 20.6],
      [16.7, 19.4],
      [16.7, 13.1],
      [15.62, 12.7],
    ],
  },
  {
    id: "4F",
    label: "4F",
    sub: "セミナールーム",
    note: "フラノデザインのフロア",
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
