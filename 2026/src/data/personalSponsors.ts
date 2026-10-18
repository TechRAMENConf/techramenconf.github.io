/**
 * スポンサーの設定。
 * - 企業（ラーメン法人応援団）: data/corporate_sponsors.json に手で書く
 *   （2025 と同じ形 { userName, avatarUrl(ロゴ), screenName, url }。口数ぶん同じ社を並べる）
 * - 個人（ラーメン応援団）: fortee の API。見た人のブラウザが直接読む（リアルタイム）。
 *   ビルド時は保存分 data/personal_sponsors.json を使う（npm run sponsors:update で更新してコミット）
 */
export const PERSONAL_SPONSORS = {
  /** 応援団の一覧（fortee）。空ならブラウザでは読まず、保存分だけを出す */
  apiUrl: "https://fortee.jp/techramen-26-conf/api/attendees/api-list/e81a5c0b-9e4b-4577-895f-2babbe3c2ce1",
  /** 「応援団員になる」の申込先。空ならボタンを出さない */
  joinUrl: "",
};
