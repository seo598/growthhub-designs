# GrowthHub — website designs

Design screens for the **GrowthHub** workspace marketplace
(Growth Hub Global — Bahrain & Saudi Arabia).

**Live preview:** https://seo598.github.io/growthhub-designs/

## Screens

| | Screen | What it shows |
| --- | --- | --- |
| 01 | [Homepage](homepage.html) | Live availability as the hero, dual-mode search, meeting-hour allowance |
| 02 | [Search results](search.html) | Monthly vs hourly kept separate, working filters, map view |
| 03 | [Venue detail](venue.html) | One venue, twelve bookable spaces, availability calendar, booking card |
| 04 | [Customer dashboard](dashboard.html) | Membership, meeting-hours ledger, bookings, invoices, wishlist |
| 05 | [Membership plans](membership.html) | The paid benefits tier for people without an office |
| 06 | [Homepage — rebuilt](homepage-v2.html) | The corrected brand; the tower as hero, navigation and inventory browser |
| 07 | [The working site — clickable](app-home.html) | Seven pages captured from the running application, with working navigation |

Each page is a single self-contained HTML file — no build step, no external
requests. The filters, tabs, calendars and booking calculator all work.

**Screen 06 replaces screen 01.** The first homepage used the wrong pink
(`#C3405D` rather than the logo's `#D2758B`), a system UI font, and reduced the
speech-bubble mark to a plain blob. Screen 06 corrects all three: the mark is
real SVG geometry, the palette is derived from the logo with every contrast
ratio computed, and the type is Rubik. Screen 01 is kept only for comparison.

**Screen 07 is the one to open.** It is the real application captured page by
page, and the navigation works — click between Offices, Meeting hours,
Membership, Ecosystem, Locations and What we publish exactly as you would on
the live site. Search, booking, the customer account and the admin panel read
and write a database, so they cannot be captured; those links land on a page
that says so rather than breaking.

Screens 01–04 are designs. **Screen 05 is a capture of the working
application** — the real `/membership` page as a signed-out visitor sees it,
styles inlined so it opens without a server. The join buttons are live in the
app and inert here.

## About the data

Office names, sizes, seat counts, monthly prices, included meeting hours and
the add-ons are **real**, taken from the Al-Khobar catalogue.

Meeting-room rates, live unit availability, photography and the street address
are **placeholders**, and each is marked as such on the screen itself rather
than being quietly invented.

## What this repo is not

This is a static design preview. The working application — booking flow, admin
panel, CRM, payments, loyalty and database — is a separate Next.js project and
is **not** part of this repository.

---

© 2026 Growth Hub Global · *Land. Launch. Lead.*
