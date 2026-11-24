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
  /**
   * 閉幕後のアーカイブ。true のあいだは
   * - fortee を読みに行かない（ビルドもブラウザも、保存分の data/*.json だけを使う）
   * - 会期中だけの仕組み（いま／つぎ・いまここ・「行く」の判子・カレンダーへの追加）を出さない
   * ルートの src/pages/index.astro の description は 2026 の features を読まないので、戻すときは手で「開催する」に書き換える
   */
  archived: true,
};
