/* ===================================================================
   BioEquilibrium — Landing Page interactions (TypeScript)
   Compila para ./script.js (IIFE, sem dependências, single-request).
   Build: `npm run build` | Dev: `npm run watch`
   =================================================================== */

/* ---------- Tipos globais de analytics ---------- */
type DataLayerEvent = Record<string, unknown> & { event: string };

type FbqFn = (
  method: "track" | "trackCustom" | "init" | string,
  eventName?: string,
  params?: Record<string, unknown>,
) => void;

declare global {
  interface Window {
    dataLayer?: DataLayerEvent[];
    fbq?: FbqFn;
    /** Ativa logs de tracking no console quando `true`. */
    __BIO_DEBUG?: boolean;
  }
}

/** Nomes de eventos rastreados pela página (espelha tracking_and_conversion).
    `AnalyticsEvent` para não colidir com o `TrackEvent` nativo do DOM. */
type AnalyticsEvent =
  | "click_cta_hero"
  | "click_cta_offer"
  | "click_whatsapp_chat"
  | "view_offer_box"
  | "view_reviews"
  | "faq_open"
  | "nutrition_table_zoom"
  | (string & {});

(function (): void {
  "use strict";

  /* ============================================================
     Helpers de seleção (tipados e seguros contra null)
     ============================================================ */
  const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T | null =>
    root.querySelector<T>(sel);

  const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T[] =>
    Array.from(root.querySelectorAll<T>(sel));

  const prefersReducedMotion = (): boolean =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ============================================================
     Camada de tracking (GA4 / GTM + Meta Pixel). No-op seguro.
     ============================================================ */
  function track(eventName: AnalyticsEvent, params: Record<string, unknown> = {}): void {
    if (!eventName) return;
    try {
      window.dataLayer = window.dataLayer ?? [];
      window.dataLayer.push({ event: eventName, ...params });
    } catch {
      /* dataLayer indisponível — ignora */
    }
    try {
      if (typeof window.fbq === "function") window.fbq("trackCustom", eventName, params);
    } catch {
      /* fbq indisponível — ignora */
    }
    if (window.__BIO_DEBUG) console.log("[track]", eventName, params);
  }

  /* ============================================================
     1. Click tracking via [data-event]
     ============================================================ */
  function initClickTracking(): void {
    document.addEventListener("click", (e: MouseEvent): void => {
      const target = e.target as Element | null;
      const el = target?.closest<HTMLElement>("[data-event]");
      if (el) {
        track(el.dataset.event as AnalyticsEvent, { label: (el.textContent ?? "").trim().slice(0, 40) });
      }
    });
  }

  /* ============================================================
     2. Reveal on scroll
     ============================================================ */
  function initReveal(): void {
    const els = $$<HTMLElement>(".reveal");
    if (!els.length) return;

    if (!("IntersectionObserver" in window) || prefersReducedMotion()) {
      els.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    els.forEach((el) => observer.observe(el));
  }

  /* ============================================================
     3. View tracking via [data-event-view] (dispara uma vez)
     ============================================================ */
  function initViewTracking(): void {
    const els = $$<HTMLElement>("[data-event-view]");
    if (!els.length || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const name = (entry.target as HTMLElement).dataset.eventView;
            if (name) track(name as AnalyticsEvent);
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.4 },
    );
    els.forEach((el) => observer.observe(el));
  }

  /* ============================================================
     4. Sticky mobile CTA (aparece após 30% de scroll)
        Some quando o box de oferta está visível (evita sobreposição).
     ============================================================ */
  function initStickyCta(): void {
    const stickyCta = $<HTMLElement>("#stickyCta");
    if (!stickyCta) return;
    const offerSection = $<HTMLElement>("#oferta");

    const update = (): void => {
      const viewportBottom = window.scrollY + window.innerHeight;
      const denom = document.body.scrollHeight - window.innerHeight;
      const pct = denom > 0 ? window.scrollY / denom : 0;

      let offerVisible = false;
      if (offerSection) {
        const top = offerSection.offsetTop;
        offerVisible = viewportBottom > top && window.scrollY < top + offerSection.offsetHeight;
      }

      const show = pct > 0.3 && !offerVisible;
      stickyCta.classList.toggle("is-visible", show);
      stickyCta.setAttribute("aria-hidden", show ? "false" : "true");
    };

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    update();
  }

  /* ============================================================
     5. Abas das tabelas nutricionais
     ============================================================ */
  function initTabs(): void {
    const root = $<HTMLElement>("#nutritionTabs");
    if (!root) return;

    const btns = $$<HTMLButtonElement>(".tabs__btn", root);
    const panels = $$<HTMLElement>(".tabs__panel", root);

    const activate = (key: string): void => {
      btns.forEach((b) => {
        const active = b.dataset.tab === key;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-selected", active ? "true" : "false");
      });
      panels.forEach((p) => {
        const active = p.dataset.panel === key;
        p.classList.toggle("is-active", active);
        p.toggleAttribute("hidden", !active);
      });
    };

    btns.forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.tab) activate(btn.dataset.tab);
      });
    });
  }

  /* ============================================================
     6. Carrossel de avaliações
     ============================================================ */
  function initReviews(): void {
    const trackEl = $<HTMLElement>("#reviewsTrack");
    const prevBtn = $<HTMLButtonElement>("#revPrev");
    const nextBtn = $<HTMLButtonElement>("#revNext");
    if (!trackEl || !prevBtn || !nextBtn) return;

    const dots = $$<HTMLElement>(".reviews__dot");

    const stepSize = (): number => {
      const card = $<HTMLElement>(".review", trackEl);
      return card ? card.getBoundingClientRect().width + 20 : 320;
    };

    const updateDots = (): void => {
      if (!dots.length) return;
      const idx = Math.min(
        Math.round(trackEl.scrollLeft / stepSize()),
        dots.length - 1,
      );
      dots.forEach((dot, i) => dot.classList.toggle("is-active", i === idx));
    };

    prevBtn.addEventListener("click", () => trackEl.scrollBy({ left: -stepSize(), behavior: "smooth" }));
    nextBtn.addEventListener("click", () => trackEl.scrollBy({ left: stepSize(), behavior: "smooth" }));
    if (dots.length) {
      trackEl.addEventListener("scroll", updateDots, { passive: true });
    }

    if (!prefersReducedMotion() && dots.length > 1) {
      let autoTimer: ReturnType<typeof setInterval>;
      const startAuto = (): void => {
        autoTimer = setInterval((): void => {
          const maxScroll = trackEl.scrollWidth - trackEl.clientWidth;
          if (trackEl.scrollLeft >= maxScroll - 10) {
            trackEl.scrollTo({ left: 0, behavior: "smooth" });
          } else {
            trackEl.scrollBy({ left: stepSize(), behavior: "smooth" });
          }
        }, 4_000);
      };
      const stopAuto = (): void => clearInterval(autoTimer);
      startAuto();
      trackEl.addEventListener("mouseenter", stopAuto, { passive: true });
      trackEl.addEventListener("mouseleave", startAuto, { passive: true });
      trackEl.addEventListener("touchstart", stopAuto, { passive: true });
    }
  }

  /* ============================================================
     8. Mobile nav toggle
     ============================================================ */
  function initMobileNav(): void {
    const toggle = $<HTMLButtonElement>("#navToggle");
    const nav = $<HTMLElement>("#headerNav");
    if (!toggle || !nav) return;

    const close = (): void => {
      toggle.classList.remove("is-open");
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    };

    toggle.addEventListener("click", () => {
      const isOpen = toggle.classList.contains("is-open");
      if (isOpen) {
        close();
      } else {
        toggle.classList.add("is-open");
        nav.classList.add("is-open");
        toggle.setAttribute("aria-expanded", "true");
      }
    });

    $$<HTMLAnchorElement>("a", nav).forEach((link) => {
      link.addEventListener("click", close);
    });

    document.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    });
  }

  /* ============================================================
     9. Topbar ticker (mobile)
     ============================================================ */
  function initTopbarTicker(): void {
    if (window.innerWidth > 600) return;
    const track = $<HTMLElement>(".topbar__track");
    if (!track) return;
    const items = Array.from(track.children) as HTMLElement[];
    items.forEach((item) => {
      const clone = item.cloneNode(true) as HTMLElement;
      clone.setAttribute("aria-hidden", "true");
      track.appendChild(clone);
    });
    track.classList.add("is-ticker");
  }

  /* ============================================================
     7. Modal de zoom nas tabelas nutricionais
     ============================================================ */
  function initZoomModal(): void {
    const modal = $<HTMLElement>("#zoomModal");
    const modalImg = $<HTMLImageElement>("#zoomImg");
    const modalClose = $<HTMLButtonElement>("#zoomClose");
    if (!modal || !modalImg || !modalClose) return;

    const open = (img: HTMLImageElement): void => {
      modalImg.src = img.src;
      modalImg.alt = img.alt;
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      track("nutrition_table_zoom", { img: img.alt.slice(0, 40) });
    };

    const close = (): void => {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    };

    $$<HTMLImageElement>(".zoomable").forEach((img) => {
      img.addEventListener("click", () => open(img));
    });
    modalClose.addEventListener("click", close);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) close();
    });
    document.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Escape" && modal.classList.contains("is-open")) close();
    });
  }

  /* ============================================================
     10. Countdown timer da oferta (persiste via sessionStorage)
     ============================================================ */
  function initOfferTimer(): void {
    const hEl = document.getElementById("timerH");
    const mEl = document.getElementById("timerM");
    const sEl = document.getElementById("timerS");
    if (!hEl || !mEl || !sEl) return;

    const heroEl = document.getElementById("heroTimerDisplay");

    const KEY = "bio_offer_end";
    const DURATION = 23 * 3_600_000 + 47 * 60_000 + 12_000;
    let end = parseInt(sessionStorage.getItem(KEY) ?? "0", 10);
    if (!end || end < Date.now()) {
      end = Date.now() + DURATION;
      sessionStorage.setItem(KEY, String(end));
    }

    const pad = (n: number): string => String(n).padStart(2, "0");

    const tick = (): void => {
      const diff = Math.max(0, end - Date.now());
      const h = pad(Math.floor(diff / 3_600_000));
      const m = pad(Math.floor((diff % 3_600_000) / 60_000));
      const s = pad(Math.floor((diff % 60_000) / 1_000));
      hEl.textContent = h;
      mEl.textContent = m;
      sEl.textContent = s;
      if (heroEl) heroEl.textContent = `${h}:${m}:${s}`;
    };

    tick();
    setInterval(tick, 1_000);
  }

  /* ============================================================
     Bootstrap
     ============================================================ */
  function init(): void {
    initClickTracking();
    initReveal();
    initViewTracking();
    initStickyCta();
    initTabs();
    initReviews();
    initZoomModal();
    initMobileNav();
    initTopbarTicker();
    initOfferTimer();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

/* Torna o arquivo um módulo (necessário para `declare global` acima).
   Não emite import/export úteis no bundle final. */
export {};
