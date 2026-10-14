// ラーメン応援団の一覧を GAS から取得し、src/data/personal_sponsors.json に保存する
// （npm run sponsors:update）。本番ビルドで GAS から取れなかったときは、この保存分を使う。
import { readFile, writeFile } from "node:fs/promises";

const conf = await readFile(new URL("../src/data/personalSponsors.ts", import.meta.url), "utf8");
const gasUrl = conf.match(/gasUrl:\s*"([^"]*)"/)?.[1];
if (!gasUrl) throw new Error("src/data/personalSponsors.ts の gasUrl が空です");

const res = await fetch(gasUrl);
if (!res.ok) throw new Error(`GAS から取得できませんでした: HTTP ${res.status}`);
const list = await res.json();
if (!Array.isArray(list)) throw new Error("GAS の応答が配列ではありません");
await writeFile(
  new URL("../src/data/personal_sponsors.json", import.meta.url),
  JSON.stringify(list, null, 2) + "\n",
);
console.log(`${list.length} 人を保存しました`);
