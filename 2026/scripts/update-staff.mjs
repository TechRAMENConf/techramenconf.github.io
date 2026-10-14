// fortee のスタッフ一覧を src/data/staff.json に保存する（npm run staff:update）。
// fortee は GitHub Actions からのアクセスを 403 で断るため、本番ビルドはこの保存分を使う。
// スタッフが増えたら手元でこれを実行してコミットする。
import { writeFile } from "node:fs/promises";

const res = await fetch("https://fortee.jp/techramen-26-conf/api/staff/v1");
if (!res.ok) throw new Error(`fortee から取得できませんでした: HTTP ${res.status}`);
const data = await res.json();
const staff = (data.staff ?? [])
  .filter((s) => s.name && s.name.trim() !== "")
  .map(({ name, link_url, avatar_url, type }) => ({ name, link_url, avatar_url, type }));
await writeFile(new URL("../src/data/staff.json", import.meta.url), JSON.stringify({ staff }, null, 2) + "\n");
console.log(`${staff.length} 人を保存しました`);
