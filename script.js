// Mark that JS is running (enables scroll-reveal styles)
document.documentElement.classList.add("js");

const header = document.querySelector("[data-header]");
const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- Header: solid once scrolled, hides on scroll down ----------
const heroBg = document.querySelector(".hero-bg");
let lastY = window.scrollY;
let ticking = false;

const onScroll = () => {
  const y = window.scrollY;
  header.classList.toggle("is-scrolled", y > 40);

  // Tuck the header away while scrolling down; bring it back on scroll up
  const menuOpen = document.body.classList.contains("nav-open");
  if (!menuOpen && Math.abs(y - lastY) > 6) {
    header.classList.toggle("is-hidden", y > lastY && y > 400);
  }
  if (y < 400) header.classList.remove("is-hidden");
  lastY = y;

  // Hero photo parallax
  if (heroBg && !reduceMotion && y < window.innerHeight * 1.2) {
    heroBg.style.setProperty("--parallax", `${y * 0.3}px`);
  }
  ticking = false;
};

onScroll();
window.addEventListener(
  "scroll",
  () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(onScroll);
    }
  },
  { passive: true }
);

// Show the header again when keyboard focus moves into it
header.addEventListener("focusin", () => header.classList.remove("is-hidden"));

// ---------- Headline line-by-line reveal ----------
document.querySelectorAll(".hero h1, .page-hero h1").forEach((h1) => {
  h1.classList.add("split-lines");
  const lines = h1.innerHTML.split(/<br\s*\/?>/i);
  h1.innerHTML = lines
    .map(
      (line, i) =>
        `<span class="line"><span class="line-inner" style="--line:${i}">${line.trim()}</span></span>`
    )
    .join("");
  h1.classList.add("is-split");
});

// ---------- Page fade-out on internal links ----------
if (!reduceMotion) {
  document.addEventListener("click", (e) => {
    const link = e.target.closest("a[href]");
    if (!link || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    if (link.target === "_blank" || link.hasAttribute("download")) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin) return;
    const samePage = url.pathname === location.pathname ||
      (url.pathname.endsWith("/index.html") && location.pathname.endsWith("/")) ||
      (url.pathname.endsWith("/") && location.pathname.endsWith("/index.html"));
    if (samePage && url.hash) return; // in-page jump: let it scroll
    e.preventDefault();
    document.body.classList.add("is-leaving");
    setTimeout(() => (location.href = url.href), 230);
  });

  // Coming back via the browser's back button: undo the fade
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) document.body.classList.remove("is-leaving");
  });
}

// ---------- Mobile navigation ----------
const setNav = (open) => {
  siteNav.classList.toggle("is-open", open);
  document.body.classList.toggle("nav-open", open);
  navToggle.setAttribute("aria-expanded", String(open));
  navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
};

navToggle.addEventListener("click", () => {
  setNav(!siteNav.classList.contains("is-open"));
});

siteNav.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => setNav(false));
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && siteNav.classList.contains("is-open")) {
    setNav(false);
    navToggle.focus();
  }
});

// ---------- Services: only one open at a time ----------
const services = document.querySelectorAll(".service");
services.forEach((item) => {
  item.addEventListener("toggle", () => {
    if (!item.open) return;
    services.forEach((other) => {
      if (other !== item) other.open = false;
    });
  });
});

// ---------- Scroll reveal ----------
// Photos that wipe into view
document
  .querySelectorAll(".about-gallery img, .product-media img, .aside-img")
  .forEach((img) => img.classList.add("reveal-img"));

// Stagger siblings that reveal together (cards in a grid, gallery photos)
const groups = new Map();
document.querySelectorAll(".reveal, .reveal-img").forEach((el) => {
  const parent = el.parentElement.closest(
    ".review-grid, .project-grid, .service-list, .about-gallery, .about-grid, .product-grid, .quote-grid"
  ) || el.parentElement;
  if (!groups.has(parent)) groups.set(parent, []);
  groups.get(parent).push(el);
});
groups.forEach((els) =>
  els.forEach((el, i) => el.style.setProperty("--reveal-delay", `${Math.min(i, 6) * 0.08}s`))
);

// Clipped photos can't be detected directly, so watch their containers instead
const revealEls = new Set(document.querySelectorAll(".reveal"));
document.querySelectorAll(".reveal-img").forEach((img) => revealEls.add(img.parentElement));

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target;
          el.classList.add("is-visible");
          el.querySelectorAll(":scope > .reveal-img").forEach((img) => img.classList.add("is-visible"));
          observer.unobserve(el);
          // Once revealed, hand the element back its normal (hover) transitions
          if (el.classList.contains("reveal")) {
            setTimeout(() => {
              el.classList.remove("reveal");
              el.style.removeProperty("--reveal-delay");
            }, 1600);
          }
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );
  revealEls.forEach((el) => observer.observe(el));
} else {
  revealEls.forEach((el) => el.classList.add("is-visible"));
  document.querySelectorAll(".reveal-img").forEach((img) => img.classList.add("is-visible"));
}

// ---------- Footer year ----------
document.getElementById("year").textContent = new Date().getFullYear();

// ---------- Portfolio lightbox ----------
const lightbox = document.querySelector("[data-lightbox]");

if (lightbox) {
  const lbImg = lightbox.querySelector("[data-lb-img]");
  const lbTitle = lightbox.querySelector("[data-lb-title]");
  const lbCount = lightbox.querySelector("[data-lb-count]");
  const lbThumbs = lightbox.querySelector("[data-lb-thumbs]");
  const lbClose = lightbox.querySelector("[data-lb-close]");
  let photos = [];
  let title = "";
  let index = 0;
  let opener = null;

  const show = (i) => {
    index = (i + photos.length) % photos.length;
    const full = photos[index];
    lbImg.srcset = `${full.replace(/\.webp$/, "-800.webp")} 800w, ${full} 1500w`;
    lbImg.sizes = "100vw";
    lbImg.src = full;
    lbImg.alt = `${title}, photo ${index + 1} of ${photos.length}`;
    lbCount.textContent = `${index + 1} / ${photos.length}`;
    lbThumbs.querySelectorAll("button").forEach((b, n) => {
      const active = n === index;
      b.setAttribute("aria-current", String(active));
      if (active) b.scrollIntoView({ block: "nearest", inline: "center" });
    });
    // Preload neighbours for snappy next/prev
    [index + 1, index - 1].forEach((n) => {
      const img = new Image();
      img.sizes = "100vw";
      const next = photos[(n + photos.length) % photos.length];
      img.srcset = `${next.replace(/\.webp$/, "-800.webp")} 800w, ${next} 1500w`;
    });
  };

  const open = (card) => {
    const slug = card.dataset.gallery;
    const count = Number(card.dataset.count);
    title = card.dataset.title;
    photos = Array.from(
      { length: count },
      (_, n) => `images/portfolio/${slug}/${String(n + 1).padStart(2, "0")}.webp`
    );
    lbTitle.textContent = title;
    lbThumbs.innerHTML = photos
      .map(
        (src, n) =>
          `<button type="button" aria-label="Photo ${n + 1}"><img src="${src.replace(/\/(\d+\.webp)$/, "/thumbs/$1")}" alt="" loading="lazy"></button>`
      )
      .join("");
    lbThumbs.querySelectorAll("button").forEach((b, n) =>
      b.addEventListener("click", () => show(n))
    );
    opener = card;
    lightbox.hidden = false;
    document.body.classList.add("lightbox-open");
    show(0);
    lbClose.focus();
  };

  const close = () => {
    lightbox.hidden = true;
    document.body.classList.remove("lightbox-open");
    lbImg.removeAttribute("srcset");
    lbImg.removeAttribute("src");
    if (opener) opener.focus();
  };

  document.querySelectorAll("[data-gallery]").forEach((card) =>
    card.addEventListener("click", () => open(card))
  );
  lightbox.querySelector("[data-lb-prev]").addEventListener("click", () => show(index - 1));
  lightbox.querySelector("[data-lb-next]").addEventListener("click", () => show(index + 1));
  lbClose.addEventListener("click", close);

  // Click the dark backdrop to close
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox || e.target.classList.contains("lightbox-stage")) close();
  });

  document.addEventListener("keydown", (e) => {
    if (lightbox.hidden) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowRight") show(index + 1);
    if (e.key === "ArrowLeft") show(index - 1);
    // Keep focus inside the dialog
    if (e.key === "Tab") {
      const focusables = [...lightbox.querySelectorAll("button")];
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  // Swipe on touch screens
  let touchX = null;
  lbImg.addEventListener("touchstart", (e) => (touchX = e.touches[0].clientX), { passive: true });
  lbImg.addEventListener("touchend", (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 40) show(index + (dx < 0 ? 1 : -1));
    touchX = null;
  });
}

// ---------- Quick quote form ----------
const quoteForm = document.querySelector("[data-quote-form]");

if (quoteForm) {
  const errorBox = quoteForm.querySelector("[data-form-error]");
  const QUOTE_EMAIL = "floors@groovebox.info";

  quoteForm.addEventListener("input", (e) => {
    if (e.target.hasAttribute("aria-invalid")) e.target.removeAttribute("aria-invalid");
  });

  quoteForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const required = [...quoteForm.querySelectorAll("[required]")];
    const invalid = required.filter((field) => !field.checkValidity());
    required.forEach((field) =>
      field.toggleAttribute("aria-invalid", invalid.includes(field))
    );

    if (invalid.length) {
      const emailBad = invalid.some((f) => f.type === "email" && f.value.trim());
      errorBox.textContent = emailBad
        ? "Please enter a valid email address."
        : "Please fill in your name and email so we can get back to you.";
      errorBox.hidden = false;
      invalid[0].focus();
      return;
    }
    errorBox.hidden = true;

    const data = new FormData(quoteForm);
    const name = `${data.get("first_name")} ${data.get("last_name")}`.trim();
    const services = data.getAll("services").join(", ") || "Not specified";
    const lines = [
      `Name: ${name}`,
      `Email: ${data.get("email")}`,
      `Phone: ${data.get("phone") || "—"}`,
      `Services: ${services}`,
      `Size: ${data.get("size") || "—"}`,
      `Heard about us: ${data.get("source") || "—"}`,
      "",
      "Project description:",
      data.get("description") || "—",
    ];

    const subject = encodeURIComponent(`Quick quote request — ${name}`);
    const body = encodeURIComponent(lines.join("\n"));
    window.location.href = `mailto:${QUOTE_EMAIL}?subject=${subject}&body=${body}`;
  });
}
