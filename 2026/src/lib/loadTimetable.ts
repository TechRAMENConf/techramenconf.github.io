// ビルド時にタイムテーブルを読む（トップの欄とタイムテーブルのページで共通）。
// fortee から取り、取れなければ data/timetable.json の保存分。1 回のビルドで取りに行くのは 1 回だけ。
// ブラウザ側では使わない（保存分の JSON をページの JS に入れないよう、lib/timetable.ts とは分けている）。
import saved from "../data/timetable.json";
import { FORTEE_TIMETABLE, normalize, type Item } from "./timetable";

let cache: Promise<Item[]> | undefined;

export const loadTimetable = (): Promise<Item[]> =>
  (cache ??= (async () => {
    try {
      const res = await fetch(FORTEE_TIMETABLE, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const items = normalize(await res.json());
        if (items.length > 0) return items;
      }
    } catch (err) {
      console.warn("[Timetable] fortee から取得できませんでした。保存分を使います", err);
    }
    return saved.items as Item[];
  })());
