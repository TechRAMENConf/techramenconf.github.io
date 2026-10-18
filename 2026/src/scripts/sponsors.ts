// スポンサー欄（応援団）の中身を作る。
// ビルド時（Sponsors.astro）と、見た人のブラウザ（fortee から最新の応援団を読んで描き直す）の
// 両方で同じものを使う。気球・一覧のシールは HTML の文字列で返す。
// 更新スクリプト（scripts/update-personal-sponsors.mjs）からも読むので、ほかのファイルを import しない。

export interface Personal {
  userName: string;
  avatarUrl?: string;
  twitterUrl?: string;
}
export interface CorporateRow {
  userName: string;
  avatarUrl?: string;
  url?: string;
}

export const validPersonal = (list: unknown): Personal[] =>
  Array.isArray(list)
    ? (list as Personal[]).filter((s) => typeof s?.userName === "string" && s.userName.trim() !== "")
    : [];

// fortee の応援団 API の応答を、2025 と同じ形 { userName, avatarUrl, twitterUrl } の 1 口 1 行に直す。
// 応答: { attendees: [{ avatar_url, "x-account"?: { name: "@handle", link } }] }。1 件＝1 口（2 口なら 2 件）。
// 名前の項目は無いので X のアカウント名を名前にする。X が無い人は名前が分からないので 2025 と同じ「隠し味（匿名応援団）」
// （「匿名」を含む名前は口数を 1 件ずつ数える）
export const ANONYMOUS = "隠し味（匿名応援団）";
type Row = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined);
export const fromFortee = (data: unknown): Personal[] => {
  const list = (data as Row | null)?.attendees;
  if (!Array.isArray(list)) return [];
  return list.flatMap((a: Row | null) => {
    if (!a || typeof a !== "object") return [];
    const x = (a["x-account"] ?? {}) as Row;
    const handle = str(x.name)?.replace(/^@/, "");
    return [{ userName: handle ?? ANONYMOUS, avatarUrl: str(a.avatar_url), twitterUrl: handle ? str(x.link) : undefined }];
  });
};

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
// リンクは http(s) だけ通す（API から来る値なので）
const safeUrl = (u?: string) => (u && /^https?:\/\//i.test(u) ? u : undefined);

// fortee の画像 URL（個人は相対パス、企業は絶対 URL）。未設定は null
const img = (u?: string) =>
  !u || u.includes("avatar-blank")
    ? null
    : /^https?:/i.test(u)
      ? (safeUrl(u) ?? null)
      : new URL(u.replace(/^\//, ""), "https://fortee.jp/").href;

// 画像が無いときの 1 文字。匿名の応援団は「？」、会社は「株式会社」などを除いた頭文字
const initial = (name: string) =>
  name.includes("匿名") ? "？" : name.replace(/株式会社|合同会社|有限会社|一般社団法人/g, "").trim().slice(0, 1);

// 名前から決まる疑似乱数（ビルドのたびに色・順番が変わらないように）
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
};

/** 応援団の一覧の指紋。ビルド時の一覧と、ブラウザで読んだ最新の一覧が同じかを見る */
export const sigOf = (rows: Personal[]) =>
  hash(JSON.stringify(rows.map((p) => [p.userName, p.avatarUrl ?? "", p.twitterUrl ?? ""])))
    .toString(36)
    .slice(2);

// サイトの色（ロゴと同じ）。2 色で気球の縦じまにする
const PALETTE = ["#a8364a", "#8a74c0", "#d4a046", "#c07a3e", "#7a9a44"];
const LIGHT = ["#e8b7bf", "#cfc3e6", "#f1dca8", "#e9c39d", "#cbdba9"];
const colors = (seed: string) => {
  const c = Math.floor(hash(seed) * PALETTE.length);
  return `--c1:${PALETTE[c]};--c2:${LIGHT[(c + 2) % LIGHT.length]}`;
};

// 気球の幅（px）
const W = 52;
// 口数が多いほど速く飛ぶ（つかまえにくい＝ゲームとして手ごわい。一覧は下にあるので見せる時間より遊びを優先）
// 空を横切る時間の倍率。応援団: 1 口 / 2 / 3 / 4 口以上
const SPEED = [1, 0.8, 0.65, 0.5];
// 法人: 1 口 / 2-3 / 4-9 / 10 口以上
const corpPace = (kuchi: number) => (kuchi >= 10 ? 0.55 : kuchi >= 4 ? 0.7 : kuchi >= 2 ? 0.85 : 1);

// 帯のジグザグ（柄 2 以上）
const ZIG = (() => {
  const top = Array.from({ length: 11 }, (_, k) => `${k * 10},${k % 2 ? 46 : 50}`);
  const bottom = Array.from({ length: 11 }, (_, k) => `${100 - k * 10},${k % 2 ? 64 : 60}`);
  return [...top, ...bottom].join(" ");
})();

// 画像が読めないとき（リンク切れなど）は、隣の 1 文字に切り替える
const FALLBACK = "this.hidden=true;this.nextElementSibling.hidden=false";
const imgTag = (src: string | null, extra = "") =>
  src ? `<img src="${esc(src)}" alt=""${extra} loading="lazy" decoding="async" onerror="${FALLBACK}">` : "";
const hiddenIf = (b: boolean) => (b ? " hidden" : "");

interface Member {
  id: string;
  name: string;
  href?: string;
  src: string | null;
  corp: boolean;
  kuchi: number;
  deco: number; // 柄の豪華さ 1..4（応援団の口数）
}

// 1 機ぶん（空を流れる外枠＋気球）
const balloon = (m: Member, k: number, pace: number, tone: string) => {
  const unitStyle = `--uw:${W}px;--uh:${Math.round(W * 1.9)}px;--dur:${Math.round((34 + hash(m.id) * 14) * pace)}s`;
  const style = `--w:${W}px;--mx:0px;--my:0px;--bob:${(4 + hash(m.id + "b") * 3).toFixed(1)}s;${tone}`;
  const d = m.deco;
  const attrs = [
    `class="bln${m.corp ? " bln--corp" : ""} bln--d${d}"`,
    `style="${style}"`,
    `data-id="${esc(m.id)}"`,
    `data-name="${esc(m.name)}"`,
    m.href ? `data-href="${esc(m.href)}"` : "",
    m.corp ? `data-corp=""` : `data-kuchi="${m.kuchi}"`,
  ].join(" ");
  return `<span class="unit" style="${unitStyle}"><span ${attrs}><span class="bln__bob">
<svg class="bln__env" viewBox="0 0 100 124"><defs><clipPath id="bc-${k}"><path d="M50 3C80 3 97 26 94 54C91 79 67 94 59 104H41C33 94 9 79 6 54C3 26 20 3 50 3Z"/></clipPath></defs>
<path class="bln__backing" d="M50 0C83 0 100 25 97 55C94 81 69 97 61 107H39C31 97 6 81 3 55C0 25 17 0 50 0Z"/>
${d >= 4 ? `<path class="bln__flag" d="M50 2V-14M50 -14L66 -9L50 -4"/>` : ""}
<g clip-path="url(#bc-${k})"><rect x="0" y="0" width="100" height="110" fill="var(--c1)"/><ellipse cx="50" cy="52" rx="30" ry="62" fill="var(--c2)"/><ellipse cx="50" cy="52" rx="13" ry="62" fill="var(--c1)"/>
${d >= 2 ? `<polygon class="bln__band" points="${ZIG}"/>` : ""}
${d >= 3 ? `<ellipse class="bln__gold" cx="50" cy="4" rx="22" ry="9"/>${[14, 32, 50, 68, 86].map((x) => `<path class="bln__gold" d="M${x} 49L${x + 5} 55L${x} 61L${x - 5} 55Z"/>`).join("")}` : ""}
</g><path class="bln__rope" d="M42 104L45 122M58 104L55 122"/>
${d >= 4 ? `<path class="bln__streamer" d="M22 84q-6 10 0 20t0 20M78 84q6 10 0 20t0 20"/>` : ""}
</svg><span class="bln__card${m.corp ? " bln__card--logo" : ""}">${imgTag(m.src)}<span class="bln__initial"${hiddenIf(!!m.src)}>${esc(initial(m.name))}</span></span></span></span></span>`;
};

/**
 * 応援団と法人の一覧から、空・一覧の HTML と数を作る。
 * anonSrc: 応援団のアバターが無いとき（匿名・未設定）のアイコン（ロゴの丼）。無ければ頭文字か「？」
 */
export const buildSponsors = (personalRows: Personal[], corporateRows: CorporateRow[], anonSrc?: string) => {
  const personal = validPersonal(personalRows);

  // ゲームの記録用 ID: 名前＋同名の通し番号（匿名の応援団は同じ名前で何人もいる）
  const seen = new Map<string, number>();
  const idOf = (kind: string, name: string) => {
    const k = `${kind}:${name}`;
    const nth = seen.get(k) ?? 0;
    seen.set(k, nth + 1);
    return nth ? `${k}#${nth}` : k;
  };

  // 応援団: 1 行＝1 口（法人と同じく、まとめずに口数ぶん並べる・飛ばす）。
  // 口数は同じ名前の行数（「匿名」は別々の人なので 1 口ずつ）。気球の柄と速さに使う
  const kuchiOf = new Map<string, number>();
  for (const p of personal) kuchiOf.set(p.userName, (kuchiOf.get(p.userName) ?? 0) + 1);
  const personList = personal.map((p) => ({
    name: p.userName,
    href: safeUrl(p.twitterUrl),
    id: idOf("p", p.userName),
    // 匿名の人と、アバターが未設定の人はロゴの丼（2025 と同じ）
    src: (p.userName.includes("匿名") ? null : img(p.avatarUrl)) ?? anonSrc ?? null,
    kuchi: p.userName.includes("匿名") ? 1 : kuchiOf.get(p.userName)!,
  }));

  // 企業: 同じ社の行数＝口数。1 口ごとに ID を持つ（気球 1 機・一覧のシール 1 枚に対応）
  const corporate = Object.values(
    corporateRows
      .filter((c) => c?.userName?.trim())
      .reduce<Record<string, CorporateRow & { kuchi: number }>>((acc, c) => {
        acc[c.userName] ??= { ...c, kuchi: 0 };
        acc[c.userName].kuchi++;
        return acc;
      }, {}),
  ).sort((a, b) => b.kuchi - a.kuchi);
  const corpList = corporate.map((c) => ({
    name: c.userName,
    href: safeUrl(c.url),
    kuchi: c.kuchi,
    ids: Array.from({ length: c.kuchi }, () => idOf("c", c.userName)),
    src: img(c.avatarUrl),
  }));

  const flights = [
    ...personList.map((p) => ({
      m: { id: p.id, name: p.name, href: p.href, src: p.src, corp: false, kuchi: p.kuchi, deco: Math.min(p.kuchi, 4) },
      pace: SPEED[Math.min(p.kuchi, 4) - 1],
      tone: colors(p.id),
    })),
    // 法人は 1 口 1 機。同じ社は同じ色
    ...corpList.flatMap((c) =>
      c.ids.map((id) => ({
        m: { id, name: c.name, href: c.href, src: c.src, corp: true, kuchi: c.kuchi, deco: 1 },
        pace: corpPace(c.kuchi),
        tone: colors(c.name),
      })),
    ),
    // 出てくる順（企業も個人も混ぜる）
  ].sort((a, b) => hash(a.m.id + "#") - hash(b.m.id + "#"));

  const skyHtml =
    `<span class="sky__cloud sky__cloud--a"></span><span class="sky__cloud sky__cloud--b"></span>` +
    flights.map((f, k) => balloon(f.m, k, f.pace, f.tone)).join("");

  // 1 口＝ロゴのシール 1 枚
  const corpHtml = corpList
    .map((c) => {
      const tag = c.href ? "a" : "div";
      const link = c.href ? ` href="${esc(c.href)}" target="_blank" rel="noopener"` : "";
      const seals = c.ids
        .map(
          (id) =>
            `<span class="corp__seal" data-catch-id="${esc(id)}">${imgTag(c.src)}<span class="corp__initial"${hiddenIf(!!c.src)}>${esc(initial(c.name))}</span></span>`,
        )
        .join("");
      return `<li class="corp__row"><${tag} class="corp__link"${link}><span class="corp__head"><span class="corp__name">${esc(c.name)}</span><span class="corp__kuchi">${c.kuchi} 口</span></span><span class="corp__seals" aria-hidden="true">${seals}</span></${tag}></li>`;
    })
    .join("");

  const personHtml = personList
    .map((p) => {
      const tag = p.href ? "a" : "span";
      const link = p.href ? ` href="${esc(p.href)}" target="_blank" rel="noopener"` : "";
      // 「隠し味（匿名応援団）」のような名前は、かっこの前で改行して、かっこ内を小さく
      const cut = p.name.indexOf("（");
      const main = cut >= 0 ? p.name.slice(0, cut) : p.name;
      const sub = cut >= 0 ? `<span class="seal__sub">${esc(p.name.slice(cut))}</span>` : "";
      return `<li data-catch-id="${esc(p.id)}"><${tag} class="seal"${link}>${imgTag(p.src, ` width="48" height="48"`)}<span class="seal__none" aria-hidden="true"${hiddenIf(!!p.src)}>${esc(initial(p.name))}</span><span class="seal__name">${esc(main)}${sub}</span></${tag}></li>`;
    })
    .join("");

  return {
    total: flights.length,
    personCount: personList.length,
    corpCount: corpList.length,
    skyHtml,
    corpHtml,
    personHtml,
  };
};
