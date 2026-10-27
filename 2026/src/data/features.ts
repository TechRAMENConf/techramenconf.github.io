/**
 * 公開の切り替え。検討中のページは false にしておくと、サイト内からのリンクを出さず、
 * ページ自体も検索エンジンに載せない（noindex）。URL を知っていれば開ける。
 */
export const FEATURES = {
  /** 会場の 3D マップ（/2026/venue/）。部屋割り・図面の公開可否を検討中 */
  venueMap: false,
  /** タイムテーブル（/2026/timetable/）。fortee の内容が固まるまで隠して準備 */
  timetable: false,
  /** スタッフ一覧（fortee から取得。取れないときは data/staff.json） */
  staff: true,
};
