// fortee のタイムテーブルを src/data/timetable.json に保存する（npm run timetable:update）。
// fortee は GitHub Actions からのアクセスを 403 で断るため、本番ビルドはこの保存分を使う
// （ページを開いたときはブラウザから最新を取り直す）。タイムテーブルが変わったら手元で実行してコミットする。
// 公開しない枠・タグは normalize で落としてから保存する。Node 23.6 以降（.ts をそのまま読める）で実行する。
import { writeFile } from "node:fs/promises";
import { FORTEE_TIMETABLE, normalize } from "../src/lib/timetable.ts";

const res = await fetch(FORTEE_TIMETABLE);
if (!res.ok) throw new Error(`fortee から取得できませんでした: HTTP ${res.status}`);
const items = normalize(await res.json());
await writeFile(new URL("../src/data/timetable.json", import.meta.url), JSON.stringify({ items }, null, 2) + "\n");
console.log(`${items.length} 件を保存しました`);
