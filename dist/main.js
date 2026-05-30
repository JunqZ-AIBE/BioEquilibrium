/* ===================================================================
   BioEquilibrium — Landing Page interactions (TypeScript)
   Compila para ./script.js (IIFE, sem dependências, single-request).
   Build: `npm run build` | Dev: `npm run watch`
   =================================================================== */
(function () {
    "use strict";
    /* ============================================================
       Helpers de seleção (tipados e seguros contra null)
       ============================================================ */
    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
    const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    /* ============================================================
       Camada de tracking (GA4 / GTM + Meta Pixel). No-op seguro.
       ============================================================ */
    function track(eventName, params = {}) {
        var _a;
        if (!eventName)
            return;
        try {
            window.dataLayer = (_a = window.dataLayer) !== null && _a !== void 0 ? _a : [];
            window.dataLayer.push({ event: eventName, ...params });
        }
        catch {
            /* dataLayer indisponível — ignora */
        }
        try {
            if (typeof window.fbq === "function")
                window.fbq("trackCustom", eventName, params);
        }
        catch {
            /* fbq indisponível — ignora */
        }
        if (window.__BIO_DEBUG)
            console.log("[track]", eventName, params);
    }
    /* ============================================================
       1. Click tracking via [data-event]
       ============================================================ */
    function initClickTracking() {
        document.addEventListener("click", (e) => {
            var _a;
            const target = e.target;
            const el = target === null || target === void 0 ? void 0 : target.closest("[data-event]");
            if (el) {
                track(el.dataset.event, { label: ((_a = el.textContent) !== null && _a !== void 0 ? _a : "").trim().slice(0, 40) });
            }
        });
    }
    /* ============================================================
       2. Reveal on scroll
       ============================================================ */
    function initReveal() {
        const els = $$(".reveal");
        if (!els.length)
            return;
        if (!("IntersectionObserver" in window) || prefersReducedMotion()) {
            els.forEach((el) => el.classList.add("is-visible"));
            return;
        }
        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("is-visible");
                    obs.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
        els.forEach((el) => observer.observe(el));
    }
    /* ============================================================
       3. View tracking via [data-event-view] (dispara uma vez)
       ============================================================ */
    function initViewTracking() {
        const els = $$("[data-event-view]");
        if (!els.length || !("IntersectionObserver" in window))
            return;
        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const name = entry.target.dataset.eventView;
                    if (name)
                        track(name);
                    obs.unobserve(entry.target);
                }
            });
        }, { threshold: 0.4 });
        els.forEach((el) => observer.observe(el));
    }
    /* ============================================================
       4. Sticky mobile CTA (aparece após 30% de scroll)
          Some quando o box de oferta está visível (evita sobreposição).
       ============================================================ */
    function initStickyCta() {
        const stickyCta = $("#stickyCta");
        if (!stickyCta)
            return;
        const offerSection = $("#oferta");
        const update = () => {
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
    function initTabs() {
        const root = $("#nutritionTabs");
        if (!root)
            return;
        const btns = $$(".tabs__btn", root);
        const panels = $$(".tabs__panel", root);
        const activate = (key) => {
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
                if (btn.dataset.tab)
                    activate(btn.dataset.tab);
            });
        });
    }
    /* ============================================================
       6. Carrossel de avaliações
       ============================================================ */
    function initReviews() {
        const trackEl = $("#reviewsTrack");
        const prevBtn = $("#revPrev");
        const nextBtn = $("#revNext");
        if (!trackEl || !prevBtn || !nextBtn)
            return;
        const dots = $$(".reviews__dot");
        const stepSize = () => {
            const card = $(".review", trackEl);
            return card ? card.getBoundingClientRect().width + 20 : 320;
        };
        const updateDots = () => {
            if (!dots.length)
                return;
            const idx = Math.min(Math.round(trackEl.scrollLeft / stepSize()), dots.length - 1);
            dots.forEach((dot, i) => dot.classList.toggle("is-active", i === idx));
        };
        prevBtn.addEventListener("click", () => trackEl.scrollBy({ left: -stepSize(), behavior: "smooth" }));
        nextBtn.addEventListener("click", () => trackEl.scrollBy({ left: stepSize(), behavior: "smooth" }));
        if (dots.length) {
            trackEl.addEventListener("scroll", updateDots, { passive: true });
        }
        if (!prefersReducedMotion() && dots.length > 1) {
            let autoTimer;
            const startAuto = () => {
                autoTimer = setInterval(() => {
                    const maxScroll = trackEl.scrollWidth - trackEl.clientWidth;
                    if (trackEl.scrollLeft >= maxScroll - 10) {
                        trackEl.scrollTo({ left: 0, behavior: "smooth" });
                    }
                    else {
                        trackEl.scrollBy({ left: stepSize(), behavior: "smooth" });
                    }
                }, 4000);
            };
            const stopAuto = () => clearInterval(autoTimer);
            startAuto();
            trackEl.addEventListener("mouseenter", stopAuto, { passive: true });
            trackEl.addEventListener("mouseleave", startAuto, { passive: true });
            trackEl.addEventListener("touchstart", stopAuto, { passive: true });
        }
    }
    /* ============================================================
       8. Mobile nav toggle
       ============================================================ */
    function initMobileNav() {
        const toggle = $("#navToggle");
        const nav = $("#headerNav");
        if (!toggle || !nav)
            return;
        const close = () => {
            toggle.classList.remove("is-open");
            nav.classList.remove("is-open");
            toggle.setAttribute("aria-expanded", "false");
        };
        toggle.addEventListener("click", () => {
            const isOpen = toggle.classList.contains("is-open");
            if (isOpen) {
                close();
            }
            else {
                toggle.classList.add("is-open");
                nav.classList.add("is-open");
                toggle.setAttribute("aria-expanded", "true");
            }
        });
        $$("a", nav).forEach((link) => {
            link.addEventListener("click", close);
        });
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape")
                close();
        });
    }
    /* ============================================================
       9. Topbar ticker (mobile)
       ============================================================ */
    function initTopbarTicker() {
        if (window.innerWidth > 600)
            return;
        const track = $(".topbar__track");
        if (!track)
            return;
        const items = Array.from(track.children);
        items.forEach((item) => {
            const clone = item.cloneNode(true);
            clone.setAttribute("aria-hidden", "true");
            track.appendChild(clone);
        });
        track.classList.add("is-ticker");
    }
    /* ============================================================
       7. Modal de zoom nas tabelas nutricionais
       ============================================================ */
    function initZoomModal() {
        const modal = $("#zoomModal");
        const modalImg = $("#zoomImg");
        const modalClose = $("#zoomClose");
        if (!modal || !modalImg || !modalClose)
            return;
        const open = (img) => {
            modalImg.src = img.src;
            modalImg.alt = img.alt;
            modal.classList.add("is-open");
            modal.setAttribute("aria-hidden", "false");
            document.body.style.overflow = "hidden";
            track("nutrition_table_zoom", { img: img.alt.slice(0, 40) });
        };
        const close = () => {
            modal.classList.remove("is-open");
            modal.setAttribute("aria-hidden", "true");
            document.body.style.overflow = "";
        };
        $$(".zoomable").forEach((img) => {
            img.addEventListener("click", () => open(img));
        });
        modalClose.addEventListener("click", close);
        modal.addEventListener("click", (e) => {
            if (e.target === modal)
                close();
        });
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && modal.classList.contains("is-open"))
                close();
        });
    }
    /* ============================================================
       10. Countdown timer da oferta (persiste via sessionStorage)
       ============================================================ */
    function initOfferTimer() {
        var _a;
        const hEl = document.getElementById("timerH");
        const mEl = document.getElementById("timerM");
        const sEl = document.getElementById("timerS");
        if (!hEl || !mEl || !sEl)
            return;
        const heroEl = document.getElementById("heroTimerDisplay");
        const KEY = "bio_offer_end";
        const DURATION = 23 * 3600000 + 47 * 60000 + 12000;
        let end = parseInt((_a = sessionStorage.getItem(KEY)) !== null && _a !== void 0 ? _a : "0", 10);
        if (!end || end < Date.now()) {
            end = Date.now() + DURATION;
            sessionStorage.setItem(KEY, String(end));
        }
        const pad = (n) => String(n).padStart(2, "0");
        const tick = () => {
            const diff = Math.max(0, end - Date.now());
            const h = pad(Math.floor(diff / 3600000));
            const m = pad(Math.floor((diff % 3600000) / 60000));
            const s = pad(Math.floor((diff % 60000) / 1000));
            hEl.textContent = h;
            mEl.textContent = m;
            sEl.textContent = s;
            if (heroEl)
                heroEl.textContent = `${h}:${m}:${s}`;
        };
        tick();
        setInterval(tick, 1000);
    }
    /* ============================================================
       Bootstrap
       ============================================================ */
    function init() {
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
    }
    else {
        init();
    }
})();
export {};
