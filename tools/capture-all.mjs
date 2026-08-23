import { writeFileSync, mkdirSync, readdirSync, unlinkSync, rmSync, statSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { randomBytes } from "node:crypto";

const R = "file:///C:/Users/DELL/Desktop/growthhub/";
const { db } = await import(R + "lib/db.js");

const BASE = "http://localhost:3000";
const OUT = "C:/Users/DELL/Desktop/growthhub-designs/site";

// A dead dev server used to mean: fetch nothing, wipe the mirror, publish an
// empty site. Check ONCE before destroying anything.
//
// OUT is declared ABOVE this guard on purpose: it used to sit below, so the
// one line whose whole job is to explain the refusal threw a ReferenceError
// instead of printing it.
const probe = await fetch(BASE + "/").catch(() => null);
if (!probe || !probe.ok) {
  throw new Error(`REFUSING to wipe ${OUT}: ${BASE} is not answering. Start the dev server first.`);
}
const ids = JSON.parse(readFileSync(process.argv[2], "utf8"));

/* ---------- temporary sessions (Session.id IS the cookie value) ---------- */
const adminTok = randomBytes(32).toString("hex");
const custTok = randomBytes(32).toString("hex");
const exp = new Date(Date.now() + 3600e3);
const superUser = await db.user.findUnique({ where: { email: "super@growthhub.local" } });
if (!superUser) throw new Error("super@growthhub.local not seeded");
await db.session.create({ data: { id: adminTok, userId: superUser.id, expiresAt: exp } });
await db.customerSession.create({ data: { id: custTok, customerId: ids.customers[0], expiresAt: exp } });
const { createHash } = await import("node:crypto");
const challengeTok = randomBytes(32).toString("hex");
const enrollTok = randomBytes(32).toString("hex");
const sha = (x) => createHash("sha256").update(x).digest("hex");
const { generateSecret } = await import(R + "lib/totp.js");
await db.loginChallenge.deleteMany({});
await db.loginChallenge.create({ data: { id: sha(challengeTok), userId: superUser.id, purpose: "VERIFY", expiresAt: new Date(Date.now() + 3600e3) } });
// enrollTok was generated and generateSecret imported, but no ENROLL row was
// ever created and the route was never in the list — so the two-step setup
// screen has never once appeared in the mirror. It needs a challenge carrying
// an enrollSecret, or the page redirects straight back to the login.
await db.loginChallenge.create({ data: { id: sha(enrollTok), userId: superUser.id, purpose: "ENROLL_LOGIN", enrollSecret: generateSecret(), expiresAt: new Date(Date.now() + 3600e3) } });

// The recovery-code hand-off renders from a short-lived cookie and nothing
// else — by design, since the codes are stored hashed and can never be read
// back. Capturing it means presenting that cookie. These are throwaway strings
// for a static screenshot: they are hashed against no account and open nothing.
const { generateRecoveryCodes } = await import(R + "lib/recoveryCodes.js");
const handoffCookie = `gh_recovery_once=${generateRecoveryCodes().join(",")}`;
const capturedUser = await db.user.findUnique({ where: { id: superUser.id } });
console.log(`minted temp sessions (admin=${superUser.email}, customer id=${ids.customers[0]}) + 2FA challenges`);

// Declared ABOVE the route lists on purpose: the first version of this sat with
// fileFor/urlFor further down and was spread into `pub` up here, which threw
// 'Cannot access QUERY_ROUTES before initialization' the moment it ran. Tenth
// instance of that defect class in this project, and written by the person who
// had just finished counting the other nine.
// Query-string routes, mapped to real directories.
//
// The rewriter used to strip the query and map what was left, so
// /workspaces?mode=hour resolved to /workspaces — the "Meeting & event" tab
// pointed at the same page as "Monthly office" and appeared to do nothing when
// clicked. A link that silently goes somewhere else is worse than one visibly
// marked live-only, because nobody reports it: it looks like the site is broken
// rather than like the capture is partial.
//
// Named directories rather than an algorithmic escape: '?' and '&' are not
// legal in a Windows path, and an underscore prefix is dropped by Jekyll on
// GitHub Pages.
const QUERY_ROUTES = {
  "/workspaces?mode=hour": "workspaces/hourly/index.html",
  "/workspaces?view=map": "workspaces/map/index.html",
  "/workspaces?mode=hour&view=map": "workspaces/hourly-map/index.html",
  // The city chips on /locations point here. Thirty query links on /workspaces
  // were being neutralised, and these three are the ones a visitor actually
  // follows from a page inviting them to pick a centre.
  ...Object.fromEntries(
    (ids.citySlugs ?? []).map((c) => [`/workspaces?city=${c}`, `workspaces/city-${c}/index.html`])
  ),
};

/* ---------- the route list ---------- */
const pub = [
  "/", "/offices", "/meeting-hours", "/ecosystem", "/locations", "/what-we-publish",
  "/spaces", "/workspaces", "/membership", "/partners", "/partner", "/contact", "/faq",
  ...Object.keys(QUERY_ROUTES),
  "/blog", "/ar", "/ar/blog", "/ar/faq", "/ar/partners",
  "/account/login", "/account/register",
  ...ids.families.map((f) => `/spaces/${f}`),
  ...ids.venues,
  ...ids.posts.map((s) => `/blog/${s}`),
  ...ids.posts.map((s) => `/ar/blog/${s}`),
  ...ids.pages.map((s) => `/${s}`),
  ...ids.pages.map((s) => `/ar/${s}`),
];

// Booking pages need a signed-in customer — they 307 to login otherwise.
const booking = ids.spaces.map((i) => `/book/${i}`);

const account = [
  "/account/verify",
  // The corporate portal — three pages the mirror has never carried, because
  // they were simply never on this list. Only reachable if a company exists.
  ...ids.companies.flatMap((c) => [
    `/account/company/${c}`,
    `/account/company/${c}/bookings`,
    `/account/company/${c}/approvals`,
  ]),
  "/account", "/account/bookings", "/account/hours", "/account/invoices",
  "/account/loyalty", "/account/profile", "/account/reviews", "/account/wishlist",
  "/account/notifications",
];

const adminStatic = [
  "/admin", "/admin/bookings", "/admin/calendar", "/admin/enquiries", "/admin/leads",
  "/admin/customers", "/admin/companies", "/admin/venues", "/admin/venues/new",
  "/admin/spaces", "/admin/spaces/new", "/admin/categories", "/admin/amenities",
  "/admin/subscriptions", "/admin/plans", "/admin/payments", "/admin/pricing",
  "/admin/loyalty", "/admin/reviews", "/admin/coupons", "/admin/coupons/test",
  "/admin/cms/pages", "/admin/cms/faq", "/admin/cms/testimonials",
  "/admin/reports", "/admin/notifications", "/admin/notifications/templates",
  "/admin/cms/blog", "/admin/cms/newsletter", "/admin/payments/gateways",
  "/admin/notifications/channels", "/admin/users", "/admin/security", "/admin/launch",
];
const admin = [
  ...adminStatic,
  ...ids.venueIds.map((i) => `/admin/venues/${i}`),
  ...ids.spaces.slice(0, 4).map((i) => `/admin/spaces/${i}`),
  ...ids.customers.map((i) => `/admin/customers/${i}`),
  ...ids.companies.map((i) => `/admin/companies/${i}`),
  ...ids.enquiries.map((i) => `/admin/enquiries/${i}`),
  ...ids.partnerLeads.map((i) => `/admin/leads/${i}`),
];

// Served from a project subpath, so links must be absolute FROM THE HOST.
const BASE_PATH = "/growthhub-designs/site";


// "/" -> index.html ; "/offices" -> offices/index.html
const fileFor = (r) =>
  QUERY_ROUTES[r] ?? (r === "/" ? "index.html" : r.replace(/^\//, "") + "/index.html");
// the URL a visitor sees, and what every internal link points at
const urlFor = (r) =>
  QUERY_ROUTES[r]
    ? `${BASE_PATH}/${QUERY_ROUTES[r].replace(/index\.html$/, "")}`
    : r === "/"
      ? BASE_PATH + "/"
      : BASE_PATH + r + "/";
const ALL = [
  ...pub.map((r) => ({ r, area: "public", cookie: null })),
  ...account.map((r) => ({ r, area: "account", cookie: `gh_customer=${custTok}` })),
  ...booking.map((r) => ({ r, area: "account", cookie: `gh_customer=${custTok}` })),
  { r: "/admin/login", area: "admin", cookie: null },
  { r: "/admin/login/verify", area: "admin", cookie: `gh_login=${challengeTok}` },
  { r: "/admin/login/enroll", area: "admin", cookie: `gh_login=${enrollTok}` },
  { r: "/admin/security/recovery-codes", area: "admin", cookie: `gh_session=${adminTok}; ${handoffCookie}` },
  ...admin.map((r) => ({ r, area: "admin", cookie: `gh_session=${adminTok}` })),
];
const MAP = Object.fromEntries(ALL.map(({ r }) => [r, fileFor(r)]));

// Routes deliberately not captured, each with the reason. An omission that
// carries a reason is a decision; an omission that does not is a bug nobody
// has noticed yet. The coverage check below subtracts these, so anything that
// remains uncovered is genuinely unaccounted for.
const EXCLUDED = {
  "/book": "a router — always redirects to /book/{id} or /workspaces, never renders",
  "/admin/login/verify": "captured separately, needs a login challenge cookie",
  "/admin/login/enroll": "captured separately, needs an ENROLL challenge cookie",
  "/admin/security/recovery-codes": "captured separately, needs the one-shot handoff cookie",
};

/* ---------- COVERAGE: what exists but is not in the list above ---------- */
//
// The route list is written by hand. A page added to app/ and not added here
// is silently missing from the mirror — the capture reports 104/104 and looks
// like a success while the new page simply is not there. That is the same
// reachability failure this codebase keeps producing, pointed at the
// deliverable instead of the code.
//
// So: walk app/ for every page.jsx, turn it into the route it serves, and say
// out loud what the list does not cover. Dynamic segments are reported as a
// pattern rather than a route, because only ids.json knows which ids matter.
function routesOnDisk(dir, prefix = "") {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      // (group) folders do not appear in the URL; @slot and _private never route
      const seg = /^\(.*\)$/.test(e.name) ? "" : e.name;
      if (e.name.startsWith("_") || e.name.startsWith("@")) continue;
      out.push(...routesOnDisk(join(dir, e.name), seg ? `${prefix}/${seg}` : prefix));
    } else if (/^page\.(jsx?|tsx?)$/.test(e.name)) {
      out.push(prefix === "" ? "/" : prefix);
    }
  }
  return out;
}

const APP_DIR = "C:/Users/DELL/Desktop/growthhub/app";
const onDisk = [...new Set(routesOnDisk(APP_DIR))];
const listed = new Set(ALL.map((a) => a.r));
// Segment-wise, no regex: a listed route covers a disk route when they have
// the same number of segments and every segment either matches literally or
// sits where the disk route has a dynamic one.
function covers(listedRoute, diskRoute) {
  const a = listedRoute.split("/");
  const b = diskRoute.split("/");
  if (a.length !== b.length) return false;
  return b.every((seg, i) => (/^\[.+\]$/.test(seg) ? a[i].length > 0 : a[i] === seg));
}

const uncovered = onDisk.filter(
  (r) => !listed.has(r) && !EXCLUDED[r] && ![...listed].some((l) => covers(l, r))
);

// A dynamic route with no rows behind it is not a gap in the list — there is
// simply nothing to render. Say which, so 'missing from the mirror' and
// 'nothing exists yet' never look like the same thing.
const noData = uncovered.filter((r) => /\[[^\]]+\]/.test(r));
const realGaps = uncovered.filter((r) => !noData.includes(r));
console.log(`coverage: ${onDisk.length} routes on disk, ${listed.size} in the capture list`);
for (const [r, why] of Object.entries(EXCLUDED)) console.log(`  skipped ${r} — ${why}`);
for (const r of noData.sort()) console.log(`  no data yet ${r} — no row exists to render`);
if (realGaps.length) {
  console.log(`UNACCOUNTED FOR (${realGaps.length}) — these exist and are not in the mirror:`);
  for (const r of realGaps.sort()) console.log("  " + r);
} else {
  console.log("  every other page.jsx on disk is covered");
}

/* ---------- fetch ---------- */
// The wipe happens AFTER every page is safely in memory — see below.

const raw = new Map();
const cssUrls = new Set();
const failed = [];
for (const { r, area, cookie } of ALL) {
  try {
    const res = await fetch(BASE + r, { headers: cookie ? { cookie } : {}, redirect: "manual" });
    if (res.status !== 200) { failed.push(`${r} [${area}] HTTP ${res.status}${res.headers.get("location") ? " -> " + res.headers.get("location") : ""}`); continue; }
    const html = await res.text();
    raw.set(r, { html, area });
    for (const m of html.matchAll(/<link[^>]+href="([^"]+\.css[^"]*)"/g)) cssUrls.add(m[1]);
  } catch (e) { failed.push(`${r} [${area}] ${e.message}`); }
}
console.log(`fetched ${raw.size}/${ALL.length}`);

// A PARTIAL capture must never reach the mirror. The dev server recompiling
// mid-run used to mean: some pages fail, the directory is already wiped, and a
// half-built site gets published. Everything is fetched into memory first and
// nothing is deleted unless all of it arrived.
// A detail route is derived from a snapshot of the database taken before the
// fetch begins. Rows can legitimately disappear in between — a colleague
// deleting a test company, another process cleaning up fixtures — and when one
// does, its page correctly 404s. That is a RACE, not a broken page, and
// aborting the whole capture for it means the mirror can never be rebuilt while
// anything else is touching the database.
//
// So: re-derive the ids and ask whether the row is still there. Gone means the
// route should not have been in the list at all — drop it and say so. Still
// present and still failing means the page is genuinely broken, and the refusal
// below stands. The distinction is made from the database, not from the status
// code, because a 404 looks identical either way.
const vanished = [];
if (failed.length > 0) {
  const { execSync } = await import("node:child_process");
  let fresh = null;
  try {
    fresh = JSON.parse(execSync(`node "${process.argv[2].replace(/ids\.json$/, "ids.cjs")}"`, { encoding: "utf8" }));
  } catch (e) {
    console.error(`could not re-derive ids to classify failures: ${e.message}`);
  }
  if (fresh) {
    const liveIds = new Set([
      ...fresh.spaces, ...fresh.venueIds, ...fresh.customers,
      ...fresh.companies, ...fresh.enquiries, ...fresh.partnerLeads,
    ].map(String));
    for (let i = failed.length - 1; i >= 0; i--) {
      // The last numeric segment of the route is the row it was derived from.
      const seg = failed[i].split(" ")[0].split("/").filter((x) => /^\d+$/.test(x)).pop();
      if (seg && !liveIds.has(seg)) {
        vanished.push(failed[i].split(" ")[0]);
        failed.splice(i, 1);
      }
    }
  }
}
for (const v of vanished) console.log(`  dropped ${v} — the row it points at no longer exists`);

if (failed.length > 0) {
  console.error(`REFUSING to write: ${failed.length} of ${ALL.length} pages failed.`);
  for (const f of failed.slice(0, 10)) console.error("  " + f);
  throw new Error("partial capture — the existing mirror is untouched");
}

mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) {
  const p = join(OUT, f);
  statSync(p).isDirectory() ? rmSync(p, { recursive: true, force: true }) : unlinkSync(p);
}

/* ---------- css + fonts ---------- */
let css = "";
const NL = String.fromCharCode(10);
const seenChunks = new Set();  // Next emits one CSS chunk per route and they are
                              // largely identical; keep the first copy of each.
for (const u of cssUrls) {
  const rr = await fetch(u.startsWith("http") ? u : BASE + u);
  if (!rr.ok) continue;
  const body = await rr.text();
  if (seenChunks.has(body)) continue;
  seenChunks.add(body);
  css += NL + body;
}
const faces = new Set();
css = css.replace(/@font-face\s*\{[^}]*\}/g, (b) => {
  const k = b.replace(/\s+/g, " ");
  if (faces.has(k)) return "";
  faces.add(k); return b;
});
mkdirSync(join(OUT, "fonts"), { recursive: true });
const fontUrls = [...new Set([...css.matchAll(/url\((\/_next\/static\/media\/[^)"']+)\)/g)].map((m) => m[1]))];
for (const u of fontUrls) {
  const rr = await fetch(BASE + u);
  if (!rr.ok) continue;
  const name = u.split("/").pop();
  writeFileSync(join(OUT, "fonts", name), Buffer.from(await rr.arrayBuffer()));
  css = css.split(`url(${u})`).join(`url(${BASE_PATH}/fonts/${name})`);
}
writeFileSync(join(OUT, "app.css"), css, "utf8");
console.log(`css ${(css.length / 1024).toFixed(0)}KB, ${faces.size} faces, ${fontUrls.length} fonts`);

/* ---------- icons ---------- */
// Next serves these out of app/, not public/, so the media copy never saw them
// and /favicon.ico 404'd in the mirror. Their <link> hrefs are root-absolute
// too, so without the rewrite below they would be neutralised to '#'.
for (const f of ["favicon.ico", "icon.svg", "apple-icon.png"]) {
  try {
    writeFileSync(join(OUT, f), readFileSync(join("C:/Users/DELL/Desktop/growthhub/app", f)));
  } catch (e) {
    console.log(`icon ${f} not copied: ${e.message}`);
  }
}

/* ---------- the photography ---------- */
// The pages reference /media/... with a root-absolute path. The mirror is
// served from a subdirectory, so the files have to travel with it and every
// reference has to be re-pointed — including srcset, which is a second list of
// urls the href rewriter never sees.
// The WHOLE media tree, not one folder inside it. This read
// public/media/gh, so when partner logos landed in public/media/partners the
// pages referencing them captured fine and every one of those ten <img> tags
// pointed at a file that was never copied. A hardcoded leaf directory is a
// silent dependency on nobody ever adding a sibling.
const MEDIA_SRC = "C:/Users/DELL/Desktop/growthhub/public/media";
let copied = 0;
try {
  const copyTree = (from, to) => {
    mkdirSync(to, { recursive: true });
    for (const e of readdirSync(from, { withFileTypes: true })) {
      if (e.isDirectory()) copyTree(join(from, e.name), join(to, e.name));
      else { writeFileSync(join(to, e.name), readFileSync(join(from, e.name))); copied++; }
    }
  };
  copyTree(MEDIA_SRC, join(OUT, "media"));
} catch (e) {
  console.log(`no media library copied: ${e.message}`);
}
console.log(`copied ${copied} media files`);

/* ---------- rewrite ---------- */
const LABEL = { public: "Public site", account: "Customer account", admin: "Admin panel" };
const neutralised = new Set();
let written = 0;
for (const [r, { html, area }] of raw) {
  let out = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "")
    .replace(/<link[^>]+rel="(preload|prefetch|stylesheet)"[^>]*>/g, "")
    .replace(/<\/head>/, `<link rel="stylesheet" href="${BASE_PATH}/app.css">\n</head>`);

  // Root-absolute asset urls: point them at the copies that travel with the
  // mirror. Done before the href pass so the two cannot fight over the same
  // attribute text.
  out = out
    .replace(/src="(\/media\/[^"]+)"/g, (_m, u) => `src="${BASE_PATH}${u}"`)
    .replace(/href="(\/(?:favicon\.ico|icon\.svg|apple-icon\.png)[^"]*)"/g,
      (_m, u) => `href="${BASE_PATH}${u}"`)
    .replace(/srcSet="([^"]+)"/gi, (_m, set) =>
      `srcset="${set.split(",").map((c) => c.trim().replace(/^\/media\//, `${BASE_PATH}/media/`)).join(", ")}"`);

  out = out.replace(/href="([^"]+)"/g, (full, href) => {
    if (/^(https?:|mailto:|tel:|#)/i.test(href)) return full;
    // Assets this script itself inserted are already correct. Without this the
    // generic rewriter below sees /growthhub-designs/site/app.css, fails to
    // find it in MAP, and neutralises the stylesheet to "#" — which left every
    // page unstyled while still returning 200 for the CSS file.
    // Assets this script itself rewrote, exempt BEFORE the route lookup. The
    // icons were added to the src/href rewrite above but not to this list, so
    // the generic pass immediately neutralised all three back to "#" — and
    // icon.svg carries a cache-busting query, which the new query rule below
    // would have killed even if the path had matched.
    if (href.startsWith(BASE_PATH + "/app.css") || href.startsWith(BASE_PATH + "/enhance.js") ||
        href.startsWith(BASE_PATH + "/fonts/") || href === BASE_PATH + "/all-pages.html" ||
        href.startsWith(BASE_PATH + "/favicon.ico") || href.startsWith(BASE_PATH + "/icon.svg") ||
        href.startsWith(BASE_PATH + "/apple-icon.png")) return full;
    if (!href.startsWith("/")) return full;
    // HTML encodes & as &amp;, so an href reads "?mode=hour&amp;view=map" while
    // the route table is keyed on the real URL. Comparing them raw meant the
    // multi-parameter route was captured and then linked to by nothing — a page
    // written to disk that no visitor could reach.
    const whole = href.split("#")[0].replace(/&amp;/g, "&");
    // Full URL first, query included. Only a href with NO query may fall back to
    // its path, because dropping a query changes which page it means.
    if (MAP[whole]) return `href="${urlFor(whole).replace(/&/g, "&amp;")}"`;
    if (whole.includes("?")) {
      neutralised.add(whole);
      return `href="#" data-live-only="${whole}"`;
    }
    const clean = whole;
    if (MAP[clean]) return `href="${urlFor(clean)}"`;
    if (clean === "/") return `href="${BASE_PATH}/"`;
    neutralised.add(clean);
    return `href="#" data-live-only="${clean}"`;
  });

  const bar = `<div style="background:#2B2B2B;color:#fff;font:13px/1.5 system-ui,sans-serif;padding:9px 16px;display:flex;gap:14px;flex-wrap:wrap;align-items:center">
<a href="${BASE_PATH}/" style="color:#fff;font-weight:700;text-decoration:none">&#8962; Home</a><a href="${BASE_PATH}/all-pages.html" style="color:#fff;text-decoration:none;opacity:.75">All pages</a>
<span style="opacity:.65">${LABEL[area]}</span><code style="opacity:.8">${r}</code>
<span style="margin-left:auto;opacity:.55">Static capture &middot; forms and sign-in are live-only</span></div>`;
  out = out.replace(/<body([^>]*)>/, `<body$1>${bar}`);
  const dest = join(OUT, MAP[r]);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, out, "utf8");
  written++;
}
console.log(`wrote ${written} pages`);

/* ---------- retired routes ---------- */
// GitHub Pages cannot 301, and this directory is wiped above on every run, so a
// stub placed by hand does not survive. The app answers the old venue path with
// a 308 from next.config.mjs; the mirror can only offer a meta refresh, and it
// has to be one, because every <script> is stripped from a captured page.
// Written directly rather than through the href rewriter, which neutralises
// hrefs it does not find in MAP to "#".
const RETIRED = [
  ["workspaces/bahrain/adliya/growth-hub-adliya", "../fahdan/",
   "https://www.saudigrowthhub.com/workspaces/bahrain/adliya/fahdan",
   "This centre is now called Fahdan."],
];
for (const [dir, rel, canonical, line] of RETIRED) {
  const dest = join(OUT, dir, "index.html");
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta http-equiv="refresh" content="0; url=${rel}">` +
    `<link rel="canonical" href="${canonical}">` +
    `<title>Moved</title></head><body style="font:16px/1.5 system-ui;padding:3rem">` +
    `<p>${line} <a href="${rel}">Go to the current page</a>.</p>` +
    `</body></html>`, "utf8");
}
console.log(`wrote ${RETIRED.length} retired-route stub(s)`);

/* ---------- cleanup ---------- */
await db.session.deleteMany({ where: { id: adminTok } });
await db.customerSession.deleteMany({ where: { id: custTok } });
await db.loginChallenge.deleteMany({});
console.log("temp sessions deleted");
await db.$disconnect();

writeFileSync(join(OUT, "_manifest.json"), JSON.stringify({
  captured: [...raw.keys()].map((r) => ({ route: r, area: raw.get(r).area, file: MAP[r] })),
  failed, neutralised: [...neutralised].sort(),
  uncaptured: realGaps.sort(),
  vanishedMidRun: vanished.sort(),
  uncapturedNoData: noData.sort(),
  excluded: EXCLUDED,
}, null, 1));
console.log(`\nFAILED (${failed.length}):`); failed.forEach((f) => console.log("  " + f));
