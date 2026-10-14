/**
 * ラーメン応援団（個人スポンサー）の設定。2025 と同じく Google Apps Script（GAS）から一覧を取る。
 * GAS_URL には必ず https://script.google.com/macros/s/<デプロイID>/exec を書く。
 * （転送先の script.googleusercontent.com/macros/echo?... は一時 URL で、失効すると取得できなくなる）
 */
export const PERSONAL_SPONSORS = {
  /** 一覧の取得先（GAS の /exec）。空のあいだは保存分 data/personal_sponsors.json だけを使う */
  gasUrl: "",
  /** 「応援団員になる」の申込先。空ならボタンを出さない */
  joinUrl: "",
};
