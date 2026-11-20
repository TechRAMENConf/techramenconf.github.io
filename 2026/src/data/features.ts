/**
 * 公開の切り替え。検討中のページは false にしておくと、サイト内からのリンクを出さず、
 * ページ自体も検索エンジンに載せない（noindex）。URL を知っていれば開ける。
 */
export const FEATURES = {
  /** 会場の 3D マップ（/2026/venue/） */
  venueMap: true,
  /** タイムテーブル（/2026/timetable/）。fortee から取得（取れないときは data/timetable.json） */
  timetable: true,
  /** スタッフ一覧（fortee から取得。取れないときは data/staff.json） */
  staff: true,
};
