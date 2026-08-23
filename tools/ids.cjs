/**
 * The dynamic half of the capture route list, derived from the database.
 *
 * Was a one-line stub that produced nothing, which meant capture-all.mjs died
 * on "Unexpected end of JSON input". Everything here is a query so the mirror
 * covers whatever the catalogue actually holds rather than a list someone
 * typed once.
 */
// Absolute: a relative file: url resolves against cwd, and this runs from the
// scratchpad rather than from the project root.
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "file:C:/Users/DELL/Desktop/growthhub/prisma/dev.db";
// Resolved from the app, not the scratchpad — this script lives outside the
// project tree and has no node_modules of its own.
const { PrismaClient } = require("C:/Users/DELL/Desktop/growthhub/node_modules/@prisma/client");
const db = new PrismaClient();

(async () => {
  const [families, venues, posts, pages, spaces, customers, companies, enquiries, partnerLeads] = await Promise.all([
    db.category.findMany({ where: { parentId: null, active: true }, select: { slug: true } }),
    db.venue.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, slug: true, citySlug: true, countrySlug: true },
      orderBy: { id: "asc" },
    }),
    db.blogPost.findMany({ where: { status: "PUBLISHED" }, select: { slug: true } }),
    db.page.findMany({ where: { status: "PUBLISHED" }, select: { slug: true } }),
    db.space.findMany({ where: { status: "ACTIVE" }, select: { id: true }, orderBy: { id: "asc" } }),
    db.customer.findMany({ select: { id: true }, orderBy: { id: "asc" }, take: 3 }),
    // Detail routes only exist to be captured if a row exists behind them.
    // Empty arrays here are how the capture knows to record 'no data' rather
    // than silently leaving the route out of the mirror.
    db.company.findMany({ select: { id: true }, orderBy: { id: "asc" }, take: 2 }),
    db.enquiry.findMany({ select: { id: true }, orderBy: { id: "asc" }, take: 2 }),
    db.partnerLead.findMany({ select: { id: true }, orderBy: { id: "asc" }, take: 2 }),
  ]);

  process.stdout.write(JSON.stringify({
    families: families.map((f) => f.slug),
    venues: venues.map((v) => `/workspaces/${v.countrySlug}/${v.citySlug}/${v.slug}`),
    venueIds: venues.map((v) => v.id),
    // Derived, not typed: the search page's city filter offers exactly these,
    // so a new venue adds its filter page without anyone remembering to.
    citySlugs: [...new Set(venues.map((v) => v.citySlug))],
    posts: posts.map((p) => p.slug),
    pages: pages.map((p) => p.slug),
    spaces: spaces.map((s) => s.id),
    customers: customers.map((c) => c.id),
    companies: companies.map((c) => c.id),
    enquiries: enquiries.map((e) => e.id),
    partnerLeads: partnerLeads.map((l) => l.id),
  }, null, 1));
  await db.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
