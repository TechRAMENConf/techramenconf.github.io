// ラーメン応援団の一覧を fortee から取得し、src/data/personal_sponsors.json に保存する
// （npm run sponsors:update）。ビルド時とブラウザが API を読めないときは、この保存分を出す。
// fortee は GitHub Actions からのアクセスを 403 で断るので、手元で実行してコミットする。
import { readFile, writeFile } from "node:fs/promises";
import { fromFortee } from "../src/scripts/sponsors.ts";

const conf = await readFile(new URL("../src/data/personalSponsors.ts", import.meta.url), "utf8");
const apiUrl = conf.match(/apiUrl:\s*"([^"]*)"/)?.[1];
if (!apiUrl) throw new Error("src/data/personalSponsors.ts の apiUrl が空です");

const res = await fetch(apiUrl);
if (!res.ok) throw new Error(`fortee から取得できませんでした: HTTP ${res.status}`);
const list = fromFortee(await res.json());
if (list.length === 0) throw new Error("fortee の応答に応援団が 1 人もいません（形が想定と違う可能性）。保存しませんでした");
await writeFile(
  new URL("../src/data/personal_sponsors.json", import.meta.url),
  "[\n" + list.map((p) => JSON.stringify(p)).join(",\n") + "\n]\n",
);
console.log(`${list.length} 口ぶんを保存しました`);
