import { loadDefaultJapaneseParser } from "budoux";

// ビルド時に文節で <wbr> を挿入し、日本語が変な位置で改行しないようにする
// （.jp クラスの word-break: keep-all と併用。全ブラウザ対応）
const budoux = loadDefaultJapaneseParser();
// BudouX が分けてしまうが、1 語として読ませたい言い回し
const KEEP = ["決まり次第"];
export const jp = (text: string) =>
  KEEP.reduce(
    (h, w) => h.replace(new RegExp([...w].join("(?:<wbr>)?"), "g"), w),
    budoux.parse(text).join("<wbr>"),
  );
// <b>や<br>を含むHTMLにも文節区切りを挿入（keep-all等のスタイルも付与される）
export const jpHtml = (html: string) => budoux.translateHTMLString(html);

/** "2026-08-31" -> "2026.08.31" */
export const dotDate = (iso: string) => iso.replaceAll("-", ".");
