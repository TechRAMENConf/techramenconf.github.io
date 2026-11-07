/**
 * スポンサーの設定。
 * - 企業（ラーメン法人応援団）: data/corporate_sponsors.json に手で書く
 *   （2025 と同じ形 { userName, avatarUrl(ロゴ), screenName, url }。口数ぶん同じ社を並べる）
 * - 個人（ラーメン応援団）: fortee の API。見た人のブラウザが直接読む（リアルタイム）。
 *   ビルド時は保存分 data/personal_sponsors.json を使う（npm run sponsors:update で更新してコミット）
 */
export const PERSONAL_SPONSORS = {
  /** 応援団の一覧（fortee）。npm run sponsors:update もここから読む */
  apiUrl: "https://fortee.jp/techramen-26-conf/api/attendees/api-list/e81a5c0b-9e4b-4577-895f-2babbe3c2ce1",
  /**
   * 見た人のブラウザで apiUrl を読むか（リアルタイム）。
   * fortee にデータが無いと API が 404（CORS の許可も無い）を返し、読むたびにコンソールにエラーが出る。
   * そのときは false にする
   */
  live: true,
  /** 「応援団員になる」の申込先（fortee のラーメン応援窓口）。空ならボタンを出さない */
  joinUrl: "https://fortee.jp/techramen-26-conf/ticket-shop/index/e81a5c0b-9e4b-4577-895f-2babbe3c2ce1",
  /** 1 口の金額と、1 人が申し込める口数（fortee の応援窓口に合わせる） */
  joinPrice: 5000,
  joinMax: 20,
};
