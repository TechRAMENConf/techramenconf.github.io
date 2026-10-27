// タイムテーブル（fortee の /api/timetable）を、公開ページで使う形に整える。
// ビルド時（pages/timetable.astro）・ブラウザでの取り直し・保存スクリプト（npm run timetable:update）で共通。
// ブラウザでも同じ描画を使えるよう、HTML は文字列で組み立てる。

export const FORTEE_TIMETABLE = "https://fortee.jp/techramen-26-conf/api/timetable";

/** 場所のまとまり（絞り込みと色）。all は全員向けの枠（オープニング・懇親会など） */
export type Group = "hall" | "handson" | "exhibit" | "all";
export const GROUPS: Record<Exclude<Group, "all">, string> = {
  hall: "大ホール",
  handson: "ハンズオン",
  exhibit: "展示",
};

export interface Item {
  id: string;
  kind: "talk" | "slot";
  title: string;
  abstract: string;
  url?: string;
  /** "2026-11-21" */
  day: string;
  /** ISO（+09:00） */
  start: string;
  mins: number;
  group: Group;
  /** 表示する場所（"2F 大ホール"・"1F 中央広間 味噌3" など） */
  place: string;
  speaker?: { name: string; avatar?: string };
  tags: string[];
}

interface RawItem {
  type: string;
  uuid: string;
  url?: string;
  title: string;
  abstract?: string;
  track: { name: string; sort: number };
  starts_at: string;
  length_min: number;
  tags?: { name: string }[];
  speaker?: { name: string; avatar_url?: string };
}

// 参加者に見せる枠だけを出す（準備・撤収・使用不可などの運営向けの枠は出さない）。
// 知らない名前の枠は出さないので、fortee に新しい枠を足したらここにも足す
const PUBLIC_SLOTS = new Set([
  "開場",
  "オープニング",
  "自己紹介企画",
  "キーノート",
  "ランチ",
  "パネルディスカッション",
  "ライトニングハンズオン",
  "ものづくり展示",
  "明日の説明",
  "解散",
  "クロージング",
  "アンケート回答",
  "懇親会",
]);
const PLACE_SLOTS = new Set(["ライトニングハンズオン", "ものづくり展示"]);
// 参加者向けのタグだけ（「対象地域在住」などの選考用のタグは出さない）
const PUBLIC_TAGS = /^(難易度|手ぶらでOK|パソコン必須|要事前準備|児童・生徒・学生)/;

/** "醤油 - 2F大ホール" → 場所のまとまりと表示名 */
const placeOf = (track: string): { group: Exclude<Group, "all">; place: string; room: string } => {
  const [name, where = ""] = track.split(/\s*-\s*/);
  const room = where.replace(/^(\dF)/, "$1 ").replace(/（.*）$/, "");
  const floor = where.replace(/^(\dF)/, "$1 ");
  if (name.startsWith("醤油")) return { group: "hall", place: floor, room };
  if (name.startsWith("味噌")) return { group: "handson", place: `${floor} ${name}`, room };
  return { group: "exhibit", place: floor, room };
};

export function normalize(raw: { timetable?: RawItem[] }): Item[] {
  const list = (raw.timetable ?? []).filter((r) =>
    r.type === "talk" ? r.title?.trim() : PUBLIC_SLOTS.has(r.title.trim()),
  );
  // 同じ時刻・同じ名前の枠が複数の場所にあるとき（懇親会など）は 1 つにまとめる
  const merged = new Map<string, { r: RawItem; tracks: RawItem["track"][] }>();
  for (const r of list) {
    const key = r.type === "talk" ? r.uuid : `${r.title}|${r.starts_at}|${r.length_min}`;
    const m = merged.get(key);
    if (m) m.tracks.push(r.track);
    else merged.set(key, { r, tracks: [r.track] });
  }
  return [...merged.values()]
    .map(({ r, tracks }): Item & { sort: number } => {
      const p = placeOf(tracks[0].name);
      const many = tracks.length > 1;
      // 全員向けの枠は、テーブル名（味噌1 など）を出さず部屋の名前だけ
      const rooms = [...new Set(tracks.map((t) => placeOf(t.name).room))];
      const everyone = r.type !== "talk" && !PLACE_SLOTS.has(r.title.trim());
      return {
        id: r.uuid,
        kind: r.type === "talk" ? "talk" : "slot",
        title: r.title.trim(),
        abstract: (r.abstract ?? "").replace(/\r\n?/g, "\n").trim(),
        ...(r.url ? { url: r.url } : {}),
        day: r.starts_at.slice(0, 10),
        start: r.starts_at,
        mins: r.length_min,
        // 枠（オープニング・ランチなど）は全員向け。ハンズオン・展示の枠だけは場所のまとまりに入れる
        group: many || everyone ? "all" : p.group,
        place: rooms.length > 1 ? "会場ぜんぶ" : many || everyone ? rooms[0] : p.place,
        ...(r.speaker?.name
          ? { speaker: { name: r.speaker.name, ...(r.speaker.avatar_url ? { avatar: r.speaker.avatar_url } : {}) } }
          : {}),
        tags: (r.tags ?? []).map((t) => t.name).filter((t) => PUBLIC_TAGS.test(t)),
        sort: Math.min(...tracks.map((t) => t.sort)),
      };
    })
    .sort((a, b) => a.start.localeCompare(b.start) || a.sort - b.sort)
    .map(({ sort: _sort, ...it }) => it);
}

// ------- 表示 -------

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** "2026-11-21T12:15:00+09:00" → "12:15"（会場の時刻のまま） */
export const hhmm = (iso: string) => iso.slice(11, 16);
const endOf = (it: Item) => {
  const [h, m] = hhmm(it.start).split(":").map(Number);
  const t = h * 60 + m + it.mins;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

/** 1 行。左に時刻、まんなかに場所・題・登壇者、右に「行く」の判子 */
function row(it: Item, withPlace = true): string {
  // 絞り込み・判子・いまここ の判定に使う
  const attrs = `data-group="${it.group}" data-id="${esc(it.id)}" data-start="${esc(it.start)}" data-mins="${it.mins}"`;
  const time = `<span class="tt-row__time">${hhmm(it.start)}</span>`;
  const place = withPlace ? `<p class="tt-row__place">${esc(it.place)}</p>` : "";
  const until = `〜${endOf(it)}（${it.mins}分）`;
  if (it.kind === "slot") {
    return `<li class="tt-row tt-row--slot" ${attrs}>${time}<div class="tt-row__body">${place}<p class="tt-row__title">${esc(
      it.title,
    )}</p><p class="tt-row__meta">${until}</p></div></li>`;
  }
  const speaker = it.speaker
    ? `<span class="tt-row__speaker">${
        it.speaker.avatar
          ? `<img src="${esc(it.speaker.avatar)}" alt="" width="22" height="22" loading="lazy" decoding="async" />`
          : ""
      }${esc(it.speaker.name)}</span>`
    : "";
  // タグは札にせず、時刻表の注記のように「・」でつなぐ
  const notes = [until, ...it.tags.map((t) => t.replace(/^難易度:\s*/, "難易度 "))].map(esc).join("・");
  const more =
    it.abstract || it.url
      ? `<details class="tt-row__more"><summary>概要</summary>${
          it.abstract ? `<p class="tt-row__abstract">${esc(it.abstract)}</p>` : ""
        }${it.url ? `<a href="${esc(it.url)}" target="_blank" rel="noopener">fortee で見る →</a>` : ""}</details>`
      : "";
  return `<li class="tt-row" ${attrs}>${time}<div class="tt-row__body">${place}<p class="tt-row__title">${esc(
    it.title,
  )}</p><p class="tt-row__meta">${speaker}<span>${notes}</span></p>${more}</div><button type="button" class="tt-stamp" aria-pressed="false" aria-label="${esc(
    it.title,
  )} に行く"><span>行く</span></button></li>`;
}

const ms = (it: Item) => Date.parse(it.start);
const endMs = (it: Item) => ms(it) + it.mins * 60e3;
/** 同時に進む枠になりうるもの（大ホールの発表とハンズオン）。展示・全員向けの枠は 1 行で出す */
const parallel = (it: Item) => it.group === "hall" || it.group === "handson";

/**
 * 1 日分。時間が重なる発表は 1 つの囲みにまとめ、場所ごとの列に分ける
 * （「行けるのはどれか 1 つ」と分かるように）。重ならないものは 1 行ずつ
 */
export function renderDay(items: Item[]): string {
  type Block = { items: Item[]; end: number };
  const parts: (Item | Block)[] = [];
  let cur: Block | null = null;
  for (const it of items) {
    if (!parallel(it)) {
      parts.push(it);
      continue;
    }
    if (cur && ms(it) < cur.end) {
      cur.items.push(it);
      cur.end = Math.max(cur.end, endMs(it));
    } else {
      cur = { items: [it], end: endMs(it) };
      parts.push(cur);
    }
  }
  const out = parts.flatMap((p) => {
    if (!("end" in p)) return [`<ol class="tt-list">${row(p)}</ol>`];
    const lanes = new Map<string, Item[]>();
    for (const it of p.items) lanes.set(it.place, [...(lanes.get(it.place) ?? []), it]);
    // 1 か所だけなら囲まない
    if (lanes.size === 1) return [`<ol class="tt-list">${p.items.map((it) => row(it)).join("")}</ol>`];
    const from = hhmm(p.items[0].start);
    const to = endOf({ ...p.items[0], mins: Math.round((p.end - ms(p.items[0])) / 60e3) });
    return [
      `<section class="tt-block" aria-label="${from}〜${to} は ${lanes.size} か所で同時に進みます"><p class="tt-block__head"><b>${from}〜${to}</b><span>${
        lanes.size
      } か所で同時に進みます・同じ時間に行けるのは 1 か所</span></p><div class="tt-block__lanes">${[...lanes.entries()]
        .map(
          ([place, list]) =>
            `<div class="tt-lane" data-group="${list[0].group}"><p class="tt-lane__place">${esc(
              place,
            )}</p><ol class="tt-lane__rows">${list.map((it) => row(it, false)).join("")}</ol></div>`,
        )
        .join('<p class="tt-or hand" aria-hidden="true">または</p>')}</div></section>`,
    ];
  });
  return out.join("");
}

/** 日ごとに分ける（"2026-11-20" → 一覧） */
export const byDay = (items: Item[]) => {
  const days = new Map<string, Item[]>();
  for (const it of items) days.set(it.day, [...(days.get(it.day) ?? []), it]);
  return days;
};
