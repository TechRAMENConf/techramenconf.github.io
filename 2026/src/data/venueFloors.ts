/**
 * 会場（コンシェルジュ フラノ）の模式図データ。単位はメートル、x は東（図面の右）、y は北（図面の上）。
 *
 * 出典:
 *  - 1F: 改修工事図面「1 階平面図」（2018/01/31）。柱は X 方向 8m 間隔、Y1–Y4 = 0 / 6.25 / 15.45 / 24.65
 *  - 2F: フロア案内図（寸法なし）。外形が 1F と同じ縦横比（約 1.95）なので、1F の外形 48 × 24.65m に合わせて換算
 *    階段・EV・トイレは 2F の避難経路図（写真、2025/11）で確かめた
 * 図面からの読み取りなので寸法は概略。裏方（守衛室・荷解場・機械室など）は「関係者のみ」にまとめている。
 *
 * use: 当日の用途（トラック・ハンズオン・受付など）。決まったらここに書くと、ラベルと色が変わる。
 */
/** 使える範囲 */
export type Access = "ticket" | "event" | "shared" | "guests" | "staff" | "closed";
export const ACCESS: Record<Access, { label: string; color: string }> = {
  ticket: { label: "チケットが要ります", color: "#7b2c3a" },
  event: { label: "一般の方も入れます", color: "#d9a520" },
  shared: { label: "共有（一般の方・宿泊の方も通ります）", color: "#6f9a3a" },
  guests: { label: "宿泊の方専用（立ち入り禁止）", color: "#e07fc0" },
  staff: { label: "スタッフのみ", color: "#3f78b0" },
  closed: { label: "立ち入り禁止", color: "#c8423a" },
};

export type RoomKind = "room" | "hall" | "entrance" | "stairs" | "wc" | "staff";

export interface Room {
  id: string;
  /** 施設での名前 */
  name: string;
  /** 当日の用途（未定なら null） */
  use: string | null;
  /** 定員・注意などの補足（地図の説明札と一覧に出る） */
  detail?: string;
  kind: RoomKind;
  /** 外形（反時計回りでも時計回りでもよい） */
  poly: [number, number][];
  /**
   * 仕切りのない区画（床の素材が変わるだけで壁がない）。
   * 壁は建物の外まわりの辺だけに立てる（ほかの部屋との境目は、閉じた部屋の側の壁になる）
   */
  open?: boolean;
  /** 床の素材（用途が決まった部屋はトラックの色が優先） */
  floor?: "wood" | "carpet";
  /** 使える範囲（地図では床の縁取りの色、一覧では文字） */
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
  /** 部屋の間（どの部屋にも入っていない所）の床。無ければ台紙のまま */
  baseFloor?: "wood" | "carpet";
  /** フローリングの通路（床だけの帯。壁はない） */
  walkway?: [number, number][];
  /** 丸柱（無ければ角柱） */
  roundColumns?: boolean;
  /** 部屋の辺のほかに立てる壁（x0, y0, x1, y1） */
  partitions?: [number, number, number, number][];
  /** ドア（壁に開ける。auto = 自動ドア、manual = 手動ドア、opening = 印のない出入口、locked = 鍵の掛かるドア。閉じたまま描く） */
  doors?: { x: number; y: number; kind: "auto" | "manual" | "opening" | "locked" }[];
  /** カウンター（低い木の台。x0, y0, x1, y1） */
  counters?: [number, number, number, number][];
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
    sub: "ハンズオン・展示・カフェ",
    note: "北の出入口（玄関フード）から。上の階へは北の EV・階段で",
    rooms: [
      {
        id: "restaurant",
        name: "カフェラウンジ EVELSA",
        use: "チャーシュー｜本に向き合う会",
        detail: "50 席",
        kind: "room",
        poly: rect(0, 11.2, 11.7, Y4),
        open: true,
        floor: "wood",
        access: "event",
      },
      { id: "kitchen", name: "キッチン", use: null, kind: "staff", poly: rect(0, 7.4, 11.7, 11.2) },
      // 玄関フード: 1F・2F への出入りはここから（2F は宿泊の方も通る）
      {
        id: "vestibule2",
        name: "北の出入口（玄関フード）",
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
        use: "味噌｜ライトニングハンズオン",
        detail: "講師 1 名＋受講 4 名 × 6 卓",
        kind: "hall",
        poly: rect(15.8, 7.4, 32.2, 16.2),
        open: true,
        floor: "carpet",
        access: "ticket",
      },
      { id: "ev2", name: "北の EV・階段", use: null, kind: "stairs", poly: rect(17.5, 18.0, 28.0, Y4), access: "shared" },
      // 北の EV の東から東の出入口の手前までと、中央広間の東（借りているが、一般の方と共有）
      {
        id: "east",
        name: "東ホール",
        use: null,
        kind: "hall",
        poly: [
          [32.2, 7.4],
          [40.2, 7.4],
          [40.2, Y4],
          [28.0, Y4],
          [28.0, 16.2],
          [32.2, 16.2],
        ],
        open: true,
        floor: "carpet",
        access: "shared",
      },
      {
        id: "entrance-hall",
        name: "中央広間（入口側）",
        use: "塩｜ものづくり展示",
        kind: "hall",
        poly: rect(40.2, 8.4, 48.0, 17.0),
        open: true,
        floor: "carpet",
        access: "event",
      },
      { id: "barista", name: "BARISTART COFFEE", use: null, detail: "別のお店", kind: "room", poly: rect(40.2, Y2, 48.0, 8.4), open: true, floor: "wood" },
      // 風除室: 北東の角が斜めの自動ドア。中からは西（東ホール）と南（展示）へ自動ドア
      {
        id: "vestibule1",
        name: "東の出入口",
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
      { id: "stairsC", name: "西の階段", use: null, kind: "stairs", poly: rect(0, 0, 7.7, 7.4), access: "closed" },
      { id: "staffS", name: "関係者のみ", use: null, kind: "staff", poly: rect(15.0, 0, 28.6, 7.4), access: "closed" },
      { id: "stairsB", name: "南の階段", use: null, kind: "stairs", poly: rect(28.6, 0, 33.4, 7.4), access: "staff" },
      // 南の EV: 2F の避難経路図の EV（x 33.96〜36.23）と同じ縦の位置に置く
      { id: "evS", name: "南の EV", use: null, kind: "stairs", poly: rect(33.4, 2.8, 36.23, 7.4) },
      { id: "staffE", name: "関係者のみ", use: null, kind: "staff", poly: rect(33.4, 0, 40.2, 2.8) },
      { id: "staffE2", name: "関係者のみ", use: null, kind: "staff", poly: rect(36.23, 2.8, 40.2, 7.4) },
      { id: "stairsA", name: "東の階段", use: null, kind: "stairs", poly: rect(40.2, 0, 48.0, Y2), access: "closed" },
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
    // 写真（2026-10）: 真ん中は仕切りのない一間で、床（フローリング／カーペット）だけで分かれている。
    // 壁・ドア・使える範囲は、運営の書き込み（2026-10-23）に合わせた
    roundColumns: true,
    baseFloor: "wood",
    glass: [
      [48.0, 8.4, 48.0, 22.6], // 窓際（展示）と東の出入口
      [48.0, 22.6, 46.3, Y4], // 北東の角の斜めの自動ドア
      [11.7, Y4, 17.5, Y4], // 北の出入口
    ],
    // 部屋の辺のほかに立てる壁: 中央広間・通路・東ホールの南、キッチンと通路の間
    partitions: [
      [11.7, 7.4, 40.2, 7.4],
      [11.7, 7.4, 11.7, 11.2],
    ],
    doors: [
      { x: 14.6, y: Y4, kind: "auto" }, // 北の出入口（外）
      { x: 14.6, y: 18.0, kind: "auto" }, // 北の出入口 → 通路
      { x: 17.5, y: 21.5, kind: "auto" }, // 北の出入口 → 北の EV
      { x: 47.15, y: 23.625, kind: "auto" }, // 東の出入口（外、斜め）
      { x: 40.2, y: 19.7, kind: "auto" }, // 東の出入口 → 東ホール
      { x: 43.0, y: 17.0, kind: "auto" }, // 東の出入口 → 展示
      { x: 32.8, y: 7.4, kind: "manual" }, // 東ホール → 南の階段（スタッフ）
      { x: 12.6, y: 7.4, kind: "opening" }, // 通路 → トイレ
    ],
    // 足あと: 北の出入口から、2F（トーク）へ上がる北の EV まで（人形の案内と同じ道）
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
    note: "北の EV で上がって、大ホールの後ろの扉から。ほかは宿泊の方の場所や事務所です",
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
      { id: "lounge", name: "ラウンジ", use: null, kind: "hall", poly: rect(20.29, 17.64, 31.92, 19.9), access: "guests" },
      { id: "kitchen", name: "シェアキッチン", use: null, kind: "room", poly: rect(20.29, 15.47, 31.92, 17.64), access: "guests" },
      { id: "meeting", name: "特別会議室", use: null, detail: "スタッフ控室", kind: "room", poly: rect(31.92, 17.87, 38.04, 24.65), access: "staff" },
      { id: "ev2N", name: "北の EV・階段", use: null, kind: "stairs", poly: rect(18.11, 20.13, 28.53, 24.65), access: "shared" },
      { id: "stairs2S", name: "南の階段", use: null, kind: "stairs", poly: rect(26.35, 2.8, 33.74, 6.42), access: "closed" },
      { id: "ev2S", name: "南の EV", use: null, kind: "stairs", poly: rect(33.96, 2.8, 36.23, 6.42), access: "staff" },
      { id: "wc2", name: "トイレ", use: null, kind: "wc", poly: rect(8.15, 2.8, 16.08, 6.42), access: "closed" },
      // 西・東の避難階段（2F 避難経路図。1F の西・東の階段の真上）
      { id: "stairs2W", name: "西の階段", use: null, kind: "stairs", poly: rect(0, 0, 7.6, 4.2), access: "closed" },
      { id: "stairs2E", name: "東の階段", use: null, kind: "stairs", poly: rect(40.2, 0, 48.0, 6.33), access: "closed" },
      // 南の真ん中（x 8〜32）は 1F より約 2.8m 引っ込んでいて、その南は建物の外
      { id: "staff2SW", name: "関係者のみ", use: null, kind: "staff", poly: rect(0, 4.2, 5.89, 6.42), access: "closed" },
      { id: "staff2S", name: "関係者のみ", use: null, kind: "staff", poly: rect(16.08, 2.8, 26.35, 6.42), access: "closed" },
      { id: "staff2EV", name: "関係者のみ", use: null, kind: "staff", poly: rect(36.23, 2.8, 40.2, 6.42), access: "staff" },
      { id: "staff2SE", name: "関係者のみ", use: null, kind: "staff", poly: rect(32.1, 0, 40.2, 2.8), access: "staff" },
      { id: "corridor-s", name: "廊下", use: null, kind: "hall", poly: rect(5.89, 6.42, 42.25, 8.82), access: "closed" },
      { id: "corridor-w", name: "廊下", use: null, kind: "hall", poly: rect(15.62, 8.82, 17.8, 20.13) },
      { id: "corridor-m", name: "廊下", use: null, kind: "hall", poly: rect(17.8, 15.47, 20.29, 20.13) },
      { id: "corridor-e", name: "廊下", use: null, kind: "hall", poly: rect(38.04, 8.37, 39.85, 24.65), access: "staff" },
      // 団体・行政の事務所（関係者のみ）
      { id: "office-city", name: "関係者のみ", use: null, kind: "staff", poly: rect(0, 14.02, 5.43, 24.65), access: "closed" },
      { id: "office-kankou", name: "関係者のみ", use: null, kind: "staff", poly: rect(0, 6.42, 5.89, 14.02), access: "closed" },
      { id: "office-jc", name: "関係者のみ", use: null, kind: "staff", poly: rect(8.92, 8.82, 15.62, 10.95), access: "closed" },
      { id: "office-tenants", name: "関係者のみ", use: null, kind: "staff", poly: rect(17.8, 8.82, 35.32, 15.47), access: "closed" },
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
        access: "closed",
      },
      { id: "office-cci", name: "関係者のみ", use: null, kind: "staff", poly: rect(39.85, 8.37, 48.0, 18.09), access: "closed" },
      { id: "office-consult", name: "関係者のみ", use: null, kind: "staff", poly: rect(42.25, 6.33, 48.0, 8.37), access: "closed" },
    ],
    // 運営の書き込み（2026-10-23）: 参加者は北の EV から廊下を通って、大ホールの後ろ（東側の南寄り）の扉へ。
    // 廊下の南端は鍵の掛かるドア。スタッフは南の EV から東の廊下を通り、特別会議室（控室）の東の扉へ
    doors: [
      { x: 20.5, y: 20.13, kind: "opening" }, // 北の EV → ラウンジ前
      { x: 15.62, y: 13.3, kind: "manual" }, // 大ホールの後ろの扉
      { x: 16.71, y: 10.95, kind: "locked" }, // 廊下の南端（鍵）
      { x: 35.1, y: 6.42, kind: "opening" }, // 南の EV → 南の廊下
      { x: 38.04, y: 18.6, kind: "manual" }, // 特別会議室（控室）の東の扉
    ],
    // 鍵の掛かるドア: 廊下をふさぐ仕切り
    partitions: [[15.62, 10.95, 17.8, 10.95]],
    // 東の廊下沿いの事務所の受付カウンター
    counters: [[39.6, 8.4, 39.6, 24.0]],
    columns: [],
    // 北側の EV・階段からホールへ
    path: [
      [19.25, 20.6],
      [16.7, 19.4],
      [16.7, 13.1],
      [15.62, 12.7],
    ],
  },
];

/**
 * 紙の人形が歩いて案内する道順（行き先の部屋 id → 階ごとの通過点）。
 * 北の出入口（玄関フード）から入る。階をまたぐときは北の EV で上がる（1F と 2F で位置がそろっている）。
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
  // 塩｜ものづくり展示（北の通路から東ホールを抜けて、東の端へ）
  "entrance-hall": [{ floor: "1F", points: [...ENTRY, [20.0, 17.1], [29.5, 17.1], [36.0, 13.0], [44.0, 12.5]] }],
  // 味噌｜ライトニングハンズオン（中央広間）
  shop: [{ floor: "1F", points: [...ENTRY, [17.5, 14.5], [24.0, 12.0]] }],
  // チャーシュー｜本に向き合う会（西のカフェ）
  restaurant: [{ floor: "1F", points: [...ENTRY, [10.0, 15.5], [6.0, 17.0]] }],
  // 醤油｜トーク（北の EV で 2F へ → 大ホール）
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
        [20.5, 20.8],
        [20.5, 19.0],
        [16.7, 18.0],
        [16.7, 13.3],
        [12.5, 13.3],
      ],
    },
  ],
};
