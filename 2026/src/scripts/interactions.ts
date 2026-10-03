// 紙・判子・荷札・きっぷのふるまい（見た目の演出は styles/motion.css）。
// どれも装飾なので、失敗しても内容や操作には影響しない。

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

// iOS Safari で :active（ボタンを押したときの「ぺたっ」）を効かせる
document.addEventListener("touchstart", () => {}, { passive: true });

// ---------- 判子: 画面に入ったら「ポン」 ----------
const stamps = document.querySelectorAll<HTMLElement>("[data-stamp]");
if (reduced || !("IntersectionObserver" in window)) {
  stamps.forEach((el) => el.classList.add("is-stamped"));
} else {
  const io = new IntersectionObserver(
    (entries, obs) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        // 紙が置かれてから押す
        window.setTimeout(() => e.target.classList.add("is-stamped"), 450);
        obs.unobserve(e.target);
      }
    },
    { threshold: 0.6 },
  );
  stamps.forEach((el) => io.observe(el));
}

// ---------- 荷札: 触れると揺れる ----------
for (const tag of document.querySelectorAll<HTMLElement>(".swing")) {
  const swing = () => {
    if (reduced || tag.classList.contains("is-swinging")) return;
    tag.classList.add("is-swinging");
  };
  tag.addEventListener("pointerenter", swing);
  tag.addEventListener("pointerdown", swing);
  tag.addEventListener("animationend", (e) => {
    if (e.animationName === "swing") tag.classList.remove("is-swinging");
  });
}

// ---------- 名札: タップで角がめくれる（ホバーできない端末向け） ----------
for (const tag of document.querySelectorAll<HTMLElement>(".nametag")) {
  let timer = 0;
  tag.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse") return;
    tag.classList.add("is-peeled");
    window.clearTimeout(timer);
    timer = window.setTimeout(() => tag.classList.remove("is-peeled"), 1400);
  });
}

// ---------- きっぷ: カレンダーに追加したら、そのボタンに改札パンチを入れる ----------
// 追加済みはこのブラウザでだけ覚えておく（共有はしない・失敗しても無視）
const PUNCH_KEY = "techramen2026:punched";
const readPunched = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(PUNCH_KEY) ?? "[]");
  } catch {
    return [];
  }
};
const punch = (btn: HTMLElement, animate: boolean) => {
  if (btn.classList.contains("is-punched")) return;
  btn.classList.add("is-punched");
  const hole = document.createElement("span");
  hole.className = animate ? "punch is-new" : "punch";
  hole.setAttribute("aria-hidden", "true");
  btn.append(hole);
};
const ticketBtns = [...document.querySelectorAll<HTMLAnchorElement>(".ticket__btn[data-cal]")];
const punched = readPunched();
for (const btn of ticketBtns) {
  if (punched.includes(btn.dataset.cal!)) punch(btn, false);
  btn.addEventListener("click", () => {
    punch(btn, !reduced);
    try {
      const next = new Set(readPunched()).add(btn.dataset.cal!);
      localStorage.setItem(PUNCH_KEY, JSON.stringify([...next]));
    } catch {
      /* noop */
    }
  });
}

// ---------- ページ遷移の向き ----------
// 観光ページ → トップ は「戻る」向きにする。
// 古いページ側（pageswap）と新しいページ側（pagereveal）の両方で同じ type を付ける
type VTEvent = Event & { viewTransition?: ViewTransition | null };
const isTravel = (url: string) => new URL(url, location.href).pathname.includes("/travel");
window.addEventListener("pageswap", (e) => {
  const ev = e as VTEvent & { activation?: { entry?: { url?: string } } | null };
  const to = ev.activation?.entry?.url;
  if (ev.viewTransition && to && isTravel(location.href) && !isTravel(to)) {
    ev.viewTransition.types?.add("back");
  }
});
window.addEventListener("pagereveal", (e) => {
  const vt = (e as VTEvent).viewTransition;
  const from = (
    window as Window & { navigation?: { activation?: { from?: { url?: string } } } }
  ).navigation?.activation?.from?.url;
  if (vt && from && isTravel(from) && !isTravel(location.href)) vt.types?.add("back");
});
