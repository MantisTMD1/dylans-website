// Developer credit in the browser console
console.log("Need a website? Reach out here: https://evanstmartindevelopment.com/");

// Mark that JS is running (enables scroll-reveal styles)
document.documentElement.classList.add("js");

const header = document.querySelector("[data-header]");
const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- Header: solid once scrolled, hides on scroll down ----------
const heroBg = document.querySelector(".hero-bg");
const mobileCta = document.querySelector("[data-mobile-cta]");
const topSection = document.querySelector(".hero, .page-hero");
const endSections = [...document.querySelectorAll(".cta, .site-footer")];
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

  // Phone call/quote bar: show after the top section, hide near the page's own
  // calls to action, and while the menu or photo viewer is open
  if (mobileCta) {
    const pastTop = y > (topSection ? topSection.offsetHeight * 0.7 : 300);
    const nearEnd = endSections.some((el) => el.getBoundingClientRect().top < window.innerHeight - 40);
    const overlayOpen = menuOpen || document.body.classList.contains("lightbox-open");
    const show = pastTop && !nearEnd && !overlayOpen;
    mobileCta.classList.toggle("is-visible", show);
    mobileCta.inert = !show;
  }

  // Hero photo parallax
  if (heroBg && !reduceMotion && y < window.innerHeight * 1.2) {
    heroBg.style.setProperty("--parallax", `${y * 0.15}px`);
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

// ---------- In-page jumps (e.g. "15 Google reviews" → #reviews) ----------
// The browser's own jump leaves room for the header, but the header hides
// itself when scrolling down — leaving a gap. Work out the landing spot here.
document.addEventListener("click", (e) => {
  const link = e.target.closest("a[href*='#']");
  if (!link || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  const url = new URL(link.href, location.href);
  const samePage =
    url.origin === location.origin &&
    url.pathname.replace(/index\.html$/, "") === location.pathname.replace(/index\.html$/, "");
  if (!samePage || !url.hash || url.hash === "#") return;
  const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
  if (!target) return;

  e.preventDefault();
  const targetY = target.getBoundingClientRect().top + window.scrollY;
  const goingDown = targetY > window.scrollY;
  // Going down past the top area: the header will tuck away, so no offset.
  // Going up (or landing near the top): the header shows, so clear it.
  const offset = goingDown && targetY > 400 ? 0 : header.offsetHeight;
  window.scrollTo({ top: Math.max(0, targetY - offset), behavior: reduceMotion ? "auto" : "smooth" });
  history.pushState(null, "", url.hash);
  if (goingDown && targetY > 400) header.classList.add("is-hidden");
  else header.classList.remove("is-hidden");
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
  onScroll();
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
  els.forEach((el, i) => el.style.setProperty("--reveal-delay", `${Math.min(i, 4) * 0.05}s`))
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
            }, 1100);
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
    onScroll();
    show(0);
    lbClose.focus();
  };

  const close = () => {
    lightbox.hidden = true;
    document.body.classList.remove("lightbox-open");
    onScroll();
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
  const otherToggle = quoteForm.querySelector("[data-other-toggle]");
  const otherField = quoteForm.querySelector("[data-other-field]");
  const otherInput = quoteForm.querySelector("#other-service");
  const QUOTE_EMAIL = "floors@groovebox.info";

  const NAME_RE = /^[\p{L}][\p{L}' .-]*$/u;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

  const phoneDigits = (value) => {
    let d = value.replace(/\D/g, "");
    if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
    return d;
  };

  // Each rule returns an error message, or "" when the value is fine
  const rules = {
    "first-name": (v) =>
      !v ? "Please enter your first name." :
      !NAME_RE.test(v) ? "Use letters only, please." : "",
    "last-name": (v) =>
      !v ? "Please enter your last name." :
      !NAME_RE.test(v) ? "Use letters only, please." : "",
    email: (v) =>
      !v ? "Please enter your email so we can reply." :
      !EMAIL_RE.test(v) ? "That email doesn’t look right — check for a typo, e.g. name@example.com." : "",
    phone: (v) => {
      if (!v) return "";
      if (/[a-z]/i.test(v)) return "Use numbers only, e.g. (608) 555-0123.";
      const d = phoneDigits(v);
      if (d.length !== 10) return "Please enter a 10-digit phone number, e.g. (608) 555-0123.";
      if (/^[01]/.test(d) || /^\d{3}[01]/.test(d)) return "That phone number isn’t valid — please double-check it.";
      return "";
    },
    "other-service": (v) =>
      otherToggle.checked && !v ? "Tell us what service you need." : "",
  };

  const fields = Object.keys(rules).map((id) => quoteForm.querySelector(`#${id}`));

  const validate = (field) => {
    const message = rules[field.id](field.value.trim());
    const errorEl = quoteForm.querySelector(`#${field.id}-error`);
    if (message) field.setAttribute("aria-invalid", "true");
    else field.removeAttribute("aria-invalid");
    errorEl.textContent = message;
    errorEl.hidden = !message;
    return !message;
  };

  fields.forEach((field) => {
    // Check a field once the visitor leaves it, then re-check live while it's wrong
    field.addEventListener("blur", () => {
      if (field.value.trim() || field.dataset.touched) validate(field);
      field.dataset.touched = "1";
      if (field.id === "phone" && !field.getAttribute("aria-invalid")) {
        const d = phoneDigits(field.value);
        if (d.length === 10) field.value = `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
      }
    });
    field.addEventListener("input", () => {
      if (field.getAttribute("aria-invalid")) validate(field);
      if (!quoteForm.querySelector('[aria-invalid="true"]')) errorBox.hidden = true;
    });
  });

  otherToggle.addEventListener("change", () => {
    otherField.hidden = !otherToggle.checked;
    if (otherToggle.checked) {
      otherInput.focus();
    } else {
      otherInput.value = "";
      validate(otherInput);
    }
  });

  quoteForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const invalid = fields.filter((field) => !validate(field));
    if (invalid.length) {
      errorBox.textContent =
        invalid.length === 1
          ? "Please fix the highlighted field above."
          : `Please fix the ${invalid.length} highlighted fields above.`;
      errorBox.hidden = false;
      invalid[0].focus();
      return;
    }
    errorBox.hidden = true;

    const data = new FormData(quoteForm);
    const name = `${data.get("first_name").trim()} ${data.get("last_name").trim()}`;
    const services = data
      .getAll("services")
      .map((s) => (s === "Other" ? `Other (${data.get("other_service").trim()})` : s))
      .join(", ") || "Not specified";
    const lines = [
      `Name: ${name}`,
      `Email: ${data.get("email").trim()}`,
      `Phone: ${data.get("phone").trim() || "—"}`,
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
