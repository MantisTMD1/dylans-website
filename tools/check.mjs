// Site check: screenshots + layout checks for every page, at four widths,
// in Chromium (Chrome/Edge) and WebKit (Safari's engine).
//
//   cd tools && npm run check            # everything
//   npm run check -- --pages=index       # just some pages
//   npm run check -- --engines=webkit    # just one engine
//
// Output goes to tools/report/: open tools/report/index.html to browse the
// screenshots and every flagged issue.

import { chromium, webkit } from "playwright";
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "tools", "report");

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => a.replace(/^--/, "").split("="))
);
const pick = (all, key) => (args[key] ? all.filter((x) => args[key].split(",").includes(x.name)) : all);

const PAGES = pick(
  [
    { name: "index", path: "/index.html" },
    { name: "portfolio", path: "/portfolio.html" },
    { name: "products", path: "/products.html" },
    { name: "quick-quote", path: "/quick-quote.html" },
  ],
  "pages"
);
const WIDTHS = [
  { name: "phone", width: 375, height: 812, mobile: true },
  { name: "tablet", width: 768, height: 1024, mobile: true },
  { name: "laptop", width: 1024, height: 680 },
  { name: "desktop", width: 1440, height: 900 },
];
const ENGINES = pick(
  [
    { name: "chromium", type: chromium },
    { name: "webkit", type: webkit },
  ],
  "engines"
);

// ---------- Tiny static server for the site folder ----------
const TYPES = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".ico": "image/x-icon",
};
const server = http.createServer(async (req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = path.join(ROOT, urlPath === "/" ? "/index.html" : urlPath);
  if (!file.startsWith(ROOT) || file.includes(`${path.sep}tools${path.sep}`)) {
    res.writeHead(404).end();
    return;
  }
  try {
    const body = await fs.readFile(file);
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" }).end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}`;

// ---------- Checks that run inside the page ----------
// Returns a list of { type, message } for anything that looks wrong.
function pageChecks({ isHome }) {
  const issues = [];
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const visible = (el) => {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && !el.closest(".sr-only, [aria-hidden='true'], [hidden]");
  };
  const describe = (el) => {
    const cls = [...el.classList].slice(0, 2).join(".");
    const text = (el.innerText || el.getAttribute("aria-label") || el.alt || "").trim().replace(/\s+/g, " ").slice(0, 40);
    return `<${el.tagName.toLowerCase()}${cls ? "." + cls : ""}>${text ? ` "${text}"` : ""}`;
  };
  // Inside something that scrolls or clips on purpose (e.g. the review carousel)?
  const contained = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) return true;
    }
    return false;
  };

  // 1. Sideways scrolling
  const sw = document.documentElement.scrollWidth;
  if (sw > vw + 1) {
    const culprits = [...document.body.querySelectorAll("*")]
      .filter((el) => visible(el) && !contained(el))
      .filter((el) => el.getBoundingClientRect().right > vw + 1)
      .slice(0, 5)
      .map(describe);
    issues.push({ type: "overflow", message: `Page scrolls sideways (${sw}px content in ${vw}px screen): ${culprits.join(", ")}` });
  }

  // 2. Items that should line up in a list but don't
  //    (matching children of sibling rows share the same right or left edge)
  const groups = [
    [".service-col", ".service summary", ".service-icon", "right"],
    [".service-col", ".service summary", ".service-title", "left"],
    [".footer-col ul", "li", "a", "left"],
    [".site-nav ul", "li", "a:not(.btn)", "left"],
  ];
  for (const [wrapSel, rowSel, itemSel, edge] of groups) {
    document.querySelectorAll(wrapSel).forEach((wrap) => {
      const items = [...wrap.querySelectorAll(rowSel)]
        .map((row) => row.querySelector(itemSel))
        .filter((el) => el && visible(el));
      if (items.length < 2) return;
      // Only compare items stacked in a column (a horizontal menu is fine)
      const tops = items.map((el) => Math.round(el.getBoundingClientRect().top));
      if (new Set(tops).size < items.length) return;
      const xs = items.map((el) => Math.round(el.getBoundingClientRect()[edge]));
      const spread = Math.max(...xs) - Math.min(...xs);
      if (spread > 2) {
        const odd = items.filter((_, i) => xs[i] !== xs[0]).map(describe);
        issues.push({ type: "alignment", message: `${itemSel} in ${wrapSel} not lined up on the ${edge} (off by ${spread}px): ${odd.join(", ")}` });
      }
    });
  }

  // 3. Text cut off by its own box
  document.querySelectorAll("h1, h2, h3, p, a, button, label, li, blockquote, span, summary").forEach((el) => {
    if (!visible(el) || !el.innerText?.trim()) return;
    const s = getComputedStyle(el);
    const clipsX = /(hidden|clip)/.test(s.overflowX) || s.textOverflow === "ellipsis";
    const clipsY = /(hidden|clip)/.test(s.overflowY);
    if ((clipsX && el.scrollWidth > el.clientWidth + 2) || (clipsY && el.scrollHeight > el.clientHeight + 2)) {
      issues.push({ type: "clipped", message: `Text cut off: ${describe(el)}` });
    }
  });

  // 4. Clickable things sitting on top of each other
  const clickables = [...document.querySelectorAll("a[href], button, input, select, textarea, summary")]
    .filter((el) => visible(el) && getComputedStyle(el).position !== "fixed" && !el.closest(".mobile-cta, .lightbox"));
  for (let i = 0; i < clickables.length; i++) {
    for (let j = i + 1; j < clickables.length; j++) {
      const a = clickables[i], b = clickables[j];
      if (a.contains(b) || b.contains(a)) continue;
      const r1 = a.getBoundingClientRect(), r2 = b.getBoundingClientRect();
      const ox = Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left);
      const oy = Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top);
      if (ox > 4 && oy > 4) issues.push({ type: "overlap", message: `${describe(a)} overlaps ${describe(b)}` });
    }
  }

  // 5. Broken images
  document.querySelectorAll("img").forEach((img) => {
    if (!img.getAttribute("src") || !visible(img)) return; // e.g. the empty photo popup
    if (img.complete && img.naturalWidth === 0) issues.push({ type: "image", message: `Image failed to load: ${img.getAttribute("src")}` });
  });

  // 5b. Photos spilling out of their own section (caught a Safari-only grid bug)
  document.querySelectorAll("main img, footer img").forEach((img) => {
    if (!visible(img)) return;
    const box = img.closest("section, footer");
    if (!box) return;
    const r = img.getBoundingClientRect(), b = box.getBoundingClientRect();
    if (r.bottom > b.bottom + 2 || r.top < b.top - 2) {
      issues.push({ type: "spill", message: `Image sticks out of its section by ${Math.round(Math.max(r.bottom - b.bottom, b.top - r.top))}px: ${img.getAttribute("src")}` });
    }
  });

  // 5c. Things marked hidden that still show (a class overriding the hidden attribute)
  document.querySelectorAll("[hidden]").forEach((el) => {
    if (getComputedStyle(el).display !== "none") issues.push({ type: "hidden", message: `Marked hidden but still showing: ${describe(el)}` });
  });

  // 6. Small tap targets on phones (under 32px tall or wide)
  if (vw < 768) {
    clickables
      .filter((el) => !el.closest("p, li.footer-legal, .review-meta") || el.matches(".btn, .chip, button"))
      .forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.height < 32 && r.width < 32) issues.push({ type: "tap-target", message: `Small tap target (${Math.round(r.width)}×${Math.round(r.height)}): ${describe(el)}` });
      });
  }

  // 7. Main quote button visible without scrolling (home page)
  if (isHome) {
    const btn = document.querySelector(".hero .btn-primary");
    if (btn && btn.getBoundingClientRect().bottom > vh) {
      issues.push({ type: "fold", message: `Hero "Get a quick quote" button is below the fold (bottom at ${Math.round(btn.getBoundingClientRect().bottom)}px, screen ${vh}px)` });
    }
  }

  return issues;
}

// Freeze animations and show everything that normally reveals on scroll
const SETTLE_CSS = `
  *, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important;
    transition-duration: 0s !important; transition-delay: 0s !important; caret-color: transparent !important; }
`;
async function settle(page) {
  await page.addStyleTag({ content: SETTLE_CSS });
  await page.evaluate(async () => {
    document.querySelectorAll(".reveal, .reveal-img").forEach((el) => el.classList.add("is-visible"));
    // Scroll through so lazy images load, then back to the top
    for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight * 0.8) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
    // Wait for visible images to finish (hidden lazy images never load, so cap the wait)
    const pending = [...document.images].filter((img) => !img.complete && img.offsetParent !== null);
    await Promise.race([
      Promise.all(pending.map((img) => img.decode().catch(() => {}))),
      new Promise((r) => setTimeout(r, 3000)),
    ]);
    await document.fonts.ready;
  });
  await page.waitForTimeout(250);
}

// ---------- Run ----------
await fs.rm(OUT, { recursive: true, force: true });
await fs.mkdir(path.join(OUT, "shots"), { recursive: true });

const results = [];
const brokenLinks = new Set();

for (const engine of ENGINES) {
  const browser = await engine.type.launch();
  for (const size of WIDTHS) {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: 1,
      isMobile: engine.name === "chromium" && size.mobile, // isMobile isn't supported in WebKit desktop
      hasTouch: Boolean(size.mobile),
      reducedMotion: "no-preference",
    });
    for (const pg of PAGES) {
      const page = await context.newPage();
      const consoleErrors = [];
      const failed = [];
      page.on("pageerror", (e) => consoleErrors.push(e.message));
      page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
      page.on("response", (r) => r.status() >= 400 && r.url().startsWith(BASE) && failed.push(`${r.status()} ${r.url().replace(BASE, "")}`));

      await page.goto(BASE + pg.path, { waitUntil: "load" });
      // Above-the-fold check happens before anything is forced visible
      await page.waitForTimeout(1200);
      const foldIssues = (await page.evaluate(pageChecks, { isHome: pg.name === "index" })).filter((i) => i.type === "fold");

      await settle(page);
      const issues = [
        ...foldIssues,
        ...(await page.evaluate(pageChecks, { isHome: false })),
        ...consoleErrors.map((m) => ({ type: "console", message: m })),
        ...failed.map((m) => ({ type: "request", message: `Failed to load: ${m}` })),
      ];

      const id = `${pg.name}--${size.name}--${engine.name}`;
      const shots = [];
      await page.screenshot({ path: path.join(OUT, "shots", `${id}.png`), fullPage: true });
      shots.push({ label: "page", file: `shots/${id}.png` });

      // State: every service / FAQ <details> opened
      if (await page.locator("details").count()) {
        await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
        await page.waitForTimeout(150);
        issues.push(...(await page.evaluate(pageChecks, { isHome: false })).map((i) => ({ ...i, message: `[sections open] ${i.message}` })));
        await page.screenshot({ path: path.join(OUT, "shots", `${id}--open.png`), fullPage: true });
        shots.push({ label: "sections open", file: `shots/${id}--open.png` });
        await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = false)));
      }

      // State: mobile menu open
      const toggle = page.locator(".nav-toggle");
      if (await toggle.isVisible()) {
        await toggle.click();
        await page.waitForTimeout(200);
        await page.screenshot({ path: path.join(OUT, "shots", `${id}--menu.png`) });
        shots.push({ label: "menu open", file: `shots/${id}--menu.png` });
        await toggle.click();
      }

      // Internal links resolve (checked once per page)
      if (engine === ENGINES[0] && size === WIDTHS[0]) {
        const hrefs = await page.evaluate(() =>
          [...document.querySelectorAll("a[href]")].map((a) => a.href).filter((h) => h.startsWith(location.origin))
        );
        for (const href of new Set(hrefs.map((h) => h.split("#")[0]))) {
          const status = await page.request.get(href).then((r) => r.status()).catch(() => 0);
          if (status >= 400 || status === 0) brokenLinks.add(`${pg.name}: ${href.replace(BASE, "")} (${status})`);
        }
      }

      // De-duplicate repeated messages
      const unique = [...new Map(issues.map((i) => [i.type + i.message, i])).values()];
      results.push({ id, page: pg.name, size: size.name, width: size.width, engine: engine.name, shots, issues: unique });
      process.stdout.write(`${unique.length ? "✗" : "✓"} ${id}${unique.length ? ` — ${unique.length} issue(s)` : ""}\n`);
      await page.close();
    }
    await context.close();
  }
  await browser.close();
}
server.close();

for (const link of brokenLinks) results.push({ id: "links", page: "links", size: "", engine: "", shots: [], issues: [{ type: "link", message: `Broken link — ${link}` }] });

// ---------- Report ----------
await fs.writeFile(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const total = results.reduce((n, r) => n + r.issues.length, 0);
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Site check</title>
<style>
  body{font:14px/1.5 system-ui,sans-serif;margin:0;padding:24px;background:#f4efe6;color:#231f1f}
  h1{margin:0 0 4px} .sum{margin:0 0 24px;color:#555}
  section{background:#fff;border-radius:12px;padding:16px 20px;margin:0 0 16px}
  h2{font-size:15px;margin:0 0 8px} .ok{color:#2c4c23} .bad{color:#a33a2a}
  ul{margin:0 0 12px;padding-left:18px} li{margin:2px 0} code{background:#f1ece2;padding:0 4px;border-radius:4px}
  .shots{display:flex;gap:12px;flex-wrap:wrap} .shots a{display:block;font-size:12px;color:#555;text-decoration:none}
  .shots img{display:block;width:180px;max-height:320px;object-fit:cover;object-position:top;border:1px solid #ddd;border-radius:6px}
</style>
<h1>Site check</h1>
<p class="sum">${results.filter((r) => r.shots.length).length} views · ${total} issue(s) flagged · ${new Date().toLocaleString()}</p>
${results
  .map(
    (r) => `<section><h2 class="${r.issues.length ? "bad" : "ok"}">${r.issues.length ? "✗" : "✓"} ${esc(r.page)} · ${esc(r.size)}${r.width ? ` (${r.width}px)` : ""} · ${esc(r.engine)}</h2>
${r.issues.length ? `<ul>${r.issues.map((i) => `<li><code>${esc(i.type)}</code> ${esc(i.message)}</li>`).join("")}</ul>` : ""}
<div class="shots">${r.shots.map((s) => `<a href="${s.file}" target="_blank"><img src="${s.file}" loading="lazy" alt="">${esc(s.label)}</a>`).join("")}</div></section>`
  )
  .join("\n")}`;
await fs.writeFile(path.join(OUT, "index.html"), html);

console.log(`\n${total} issue(s) across ${results.length} views. Report: tools/report/index.html`);
