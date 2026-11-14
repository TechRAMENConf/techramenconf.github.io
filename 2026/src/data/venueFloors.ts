/**
 * 会場（コンシェルジュ フラノ）の模式図データ。単位はメートル。
 * x は図面の右、y は図面の上。図面の右がだいたい北（上が西）。
 *
 * 出典:
 *  - 1F: 改修工事図面「1 階平面図」（2018/01/31）。柱は X 方向 8m 間隔、Y1–Y4 = 0 / 6.25 / 15.45 / 24.65
 *  - 2F: フロア案内図（寸法なし）。外形が 1F と同じ縦横比（約 1.95）なので、1F の外形 48 × 24.65m に合わせて換算
 *    階段・EV・トイレは 2F の避難経路図（写真、2025/11）で確かめた
 * 図面からの読み取りなので寸法は概略。
 * 参加者が使う所と、その位置関係だけを載せる（立ち入り禁止の部屋・事務所は描かない。運営の書き込み 2026-11-13）。
 *
 * use: 当日の用途（トラック・ハンズオン・受付など）。決まったらここに書くと、ラベルと色が変わる。
 */
/** 使える範囲 */
export type Access = "ticket" | "event" | "shared" | "guests";
export const ACCESS: Record<Access, { label: string; color: string }> = {
  ticket: { label: "チケットが要ります", color: "#7b2c3a" },
  event: { label: "一般の方も入れます", color: "#d9a520" },
  shared: { label: "一般のお客さんと共有（占有せず、ゆずりあって使ってください）", color: "#6f9a3a" },
  guests: { label: "宿泊の方専用（立ち入り禁止）", color: "#e07fc0" },
};

export type RoomKind = "room" | "hall" | "entrance" | "stairs" | "wc";

export interface Room {
  id: string;
  /** 施設での名前 */
  name: string;
  /** 当日の用途（未定なら null） */
  use: string | null;
  /** 定員・注意などの補足（地図の説明札に出る） */
  detail?: string;
  kind: RoomKind;
  /** 外形（反時計回りでも時計回りでもよい） */
  poly: [number, number][];
  /**
   * 仕切りのない区画（床の素材が変わるだけで壁がない）。
   * 壁は、ほかの区画と接していない辺（描かない所に面した辺）にだけ立てる
   */
  open?: boolean;
  /** 建物の外（壁を立てず、床だけ置く） */
  outdoor?: boolean;
  /** 床の素材（用途が決まった部屋はトラックの色が優先） */
  floor?: "wood" | "carpet";
  /** 使える範囲（地図では床の縁取りの色、説明札では文字） */
  access?: Access;
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
  /** 外まわりのうちガラス張りの辺（x0, y0, x1, y1）。仕切りのない区画の外壁をガラスにする */
  glass?: [number, number, number, number][];
  /** 丸柱（無ければ角柱） */
  roundColumns?: boolean;
  /** ドア（壁に開ける。auto = 自動ドア、manual = 手動ドア、opening = 印のない出入口、閉じたまま描く） */
  doors?: { x: number; y: number; kind: "auto" | "manual" | "opening" }[];
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
    sub: "ハンズオン・展示・もくもく会",
    note: "西の出入口（玄関フード）から。2F へは西の EV・階段で",
    rooms: [
      {
        id: "restaurant",
        name: "カフェラウンジ EVELSA",
        use: "塩｜もくもく会・本と真摯に向き合う会",
        detail: "ランチ会場・50 席",
        kind: "room",
        poly: rect(0, 11.2, 11.7, Y4),
        open: true,
        floor: "wood",
        access: "event",
      },
      // 玄関フード: 1F・2F への出入りはここから（2F は宿泊の方も通る）
      {
        id: "vestibule2",
        name: "西の出入口（玄関フード）",
        use: null,
        kind: "entrance",
        poly: rect(11.7, 18.0, 17.5, Y4),
        floor: "wood",
        access: "shared",
      },
      { id: "corridor-1w", name: "通路", use: null, kind: "hall", poly: rect(11.7, 7.4, 15.8, 18.0), open: true, floor: "wood", access: "shared" },
      { id: "corridor-1n", name: "通路", use: null, kind: "hall", poly: rect(15.8, 16.2, 28.0, 18.0), open: true, floor: "wood", access: "shared" },
      {
        id: "shop",
        name: "中央広間",
        use: "味噌｜ハンズオン",
        detail: "講師 1 名＋受講 4 名 × 6 卓",
        kind: "hall",
        poly: rect(15.8, 7.4, 32.2, 16.2),
        open: true,
        floor: "carpet",
        access: "ticket",
      },
      { id: "ev2", name: "西の EV・階段", use: null, kind: "stairs", poly: rect(17.5, 18.0, 28.0, Y4), access: "shared" },
      // 西の EV の北から北の出入口の手前までと、中央広間の北（借りているが、一般のお客さんと共有）。
      // 北東の角（図面の右下寄り）は BARISTART COFFEE の専用エリアなので切り欠く
      {
        id: "east",
        name: "北ホール",
        use: null,
        kind: "hall",
        poly: [
          [32.2, 7.4],
          [40.2, 7.4],
          [40.2, Y4],
          [28.0, Y4],
          [28.0, 16.2],
          [32.2, 16.2],
          [32.2, 12.2],
          [38.7, 12.2],
          [38.7, 8.6],
          [32.2, 8.6],
        ],
        open: true,
        floor: "carpet",
        access: "shared",
      },
      {
        id: "barista",
        name: "BARISTART COFFEE",
        use: null,
        detail: "お店のお客さん専用",
        kind: "room",
        poly: rect(32.2, 8.6, 38.7, 12.2),
        open: true,
        floor: "wood",
      },
      // 北の窓際。東の細い帯（もとは BARISTART COFFEE の場所）まで含める
      {
        id: "entrance-hall",
        name: "北側広間",
        use: "チャーシュー｜ものづくり展示",
        kind: "hall",
        poly: rect(40.2, Y2, 48.0, 17.0),
        open: true,
        floor: "carpet",
        access: "event",
      },
      // 風除室: 角が斜めの自動ドア。中からは北ホールと北側広間へ自動ドア
      {
        id: "vestibule1",
        name: "北の出入口",
        use: null,
        kind: "entrance",
        poly: [
          [40.2, 17.0],
          [48.0, 17.0],
          [48.0, 22.6],
          [46.3, Y4],
          [40.2, Y4],
        ],
        floor: "wood",
        access: "shared",
      },
      { id: "wc", name: "トイレ", use: null, kind: "wc", poly: rect(7.7, 0, 15.0, 7.4), access: "shared" },
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
    // 写真（2026-10）: 真ん中は仕切りのない一間で、床（フローリング／カーペット）だけで分かれている
    roundColumns: true,
    glass: [
      [48.0, Y2, 48.0, 22.6], // 窓際（展示）と北の出入口
      [48.0, 22.6, 46.3, Y4], // 角の斜めの自動ドア
      [11.7, Y4, 17.5, Y4], // 西の出入口
    ],
    doors: [
      { x: 14.6, y: Y4, kind: "auto" }, // 西の出入口（外）
      { x: 14.6, y: 18.0, kind: "auto" }, // 西の出入口 → 通路
      { x: 17.5, y: 21.5, kind: "auto" }, // 西の出入口 → 西の EV
      { x: 47.15, y: 23.625, kind: "auto" }, // 北の出入口（外、斜め）
      { x: 40.2, y: 19.7, kind: "auto" }, // 北の出入口 → 北ホール
      { x: 43.0, y: 17.0, kind: "auto" }, // 北の出入口 → 展示
      { x: 12.6, y: 7.4, kind: "opening" }, // 通路 → トイレ
    ],
    // 足あと: 西の出入口から、2F（トーク）へ上がる西の EV まで（人形の案内と同じ道）
    path: [
      [14.6, 23.6],
      [14.6, 21.5],
      [17.5, 21.5],
      [23.0, 21.6],
    ],
  },
  {
    id: "2F",
    label: "2F",
    sub: "トーク",
    note: "西の EV で上がって、廊下から大ホールの後ろの扉へ",
    rooms: [
      // ホール A・B の仕切りを外した大ホールとして使う
      {
        id: "hall",
        name: "大ホール",
        use: "醤油｜トーク",
        detail: "90 名",
        kind: "room",
        poly: rect(7.25, 10.95, 15.62, 24.65),
        access: "ticket",
      },
      {
        id: "lounge",
        name: "ラウンジ・シェアキッチン",
        use: null,
        kind: "hall",
        poly: rect(20.29, 15.47, 31.92, 19.9),
        access: "guests",
      },
      { id: "ev2N", name: "西の EV・階段", use: null, kind: "stairs", poly: rect(18.11, 20.13, 28.53, 24.65), access: "shared" },
      // 建物の外。運営の書き込み（2026-11-13）の位置から概略
      {
        id: "smoking",
        name: "喫煙スペース",
        use: null,
        detail: "建物の外",
        kind: "room",
        poly: rect(16.4, Y4, 27.8, 26.65),
        outdoor: true,
      },
      { id: "corridor-w", name: "廊下", use: null, kind: "hall", poly: rect(15.62, 10.95, 17.8, 20.13), open: true },
      // EV とラウンジの間の廊下。自販機は使ってよい
      {
        id: "vending",
        name: "自販機",
        use: null,
        detail: "使えます",
        kind: "hall",
        poly: rect(17.8, 15.47, 20.29, 20.13),
        open: true,
      },
    ],
    // 参加者は西の EV から廊下を通って、大ホールの後ろ（廊下側）の扉へ
    doors: [
      { x: 19.2, y: 20.13, kind: "opening" }, // 西の EV → 廊下（自販機）
      { x: 15.62, y: 13.3, kind: "manual" }, // 大ホールの後ろの扉
    ],
    columns: [],
    // 西の EV・階段からホールへ
    path: [
      [19.2, 20.6],
      [19.2, 18.4],
      [16.7, 17.6],
      [16.7, 13.1],
      [15.62, 12.7],
    ],
  },
];

/**
 * 紙の人形が歩いて案内する道順（行き先の部屋 id → 階ごとの通過点）。
 * 西の出入口（玄関フード）から入る。階をまたぐときは西の EV で上がる（1F と 2F で位置がそろっている）。
 */
export interface RouteLeg {
  floor: string;
  points: [number, number][];
}

const ENTRY: [number, number][] = [
  [14.6, 23.6],
  [14.6, 16.8],
];

export const ROUTES: Record<string, RouteLeg[]> = {
  // チャーシュー｜ものづくり展示（通路から北ホールを抜けて、北側広間へ）
  "entrance-hall": [{ floor: "1F", points: [...ENTRY, [20.0, 17.1], [29.5, 17.1], [36.0, 13.0], [44.0, 12.5]] }],
  // 味噌｜ハンズオン（中央広間）
  shop: [{ floor: "1F", points: [...ENTRY, [17.5, 14.5], [24.0, 12.0]] }],
  // 塩｜もくもく会・本と真摯に向き合う会（カフェ）
  restaurant: [{ floor: "1F", points: [...ENTRY, [10.0, 15.5], [6.0, 17.0]] }],
  // 醤油｜トーク（西の EV で 2F へ → 大ホール）
  hall: [
    {
      floor: "1F",
      points: [
        [14.6, 23.6],
        [14.6, 21.5],
        [17.5, 21.5],
        [23.0, 21.6],
      ],
    },
    {
      floor: "2F",
      points: [
        [23.0, 21.6],
        [19.2, 20.8],
        [19.2, 18.2],
        [16.7, 17.6],
        [16.7, 13.3],
        [12.5, 13.3],
      ],
    },
  ],
};
