# Sources — Actions Required Checklist

## Work category expansion — checked 2026-09-21

These feeds remain in `sources-pending.json` and are not polled. Results are point-in-time checks using the existing robots-aware poller, not proof that a publisher has permanently removed RSS.

- [ ] **Harvard Business Review (AI topics) — Leadership**
  - Supplied URL: https://hbr.org/feed
  - Result: Client error '404 Not Found' for url 'https://hbr.org/feed'
  - Action: Find the current publisher-advertised RSS/Atom endpoint, then verify XML and robots access before activation.
  - Alternative tested: https://feeds.harvardbusiness.org/harvardbusiness?format=xml —

- [ ] **Deloitte Insights — Leadership**
  - Supplied URL: https://www2.deloitte.com/rss
  - Result: Redirect response '302 Moved Temporarily' for url 'https://www2.deloitte.com/robots.txt'
  - Action: Confirm the publisher’s canonical host and accessible robots policy, then retest the feed. Do not bypass access restrictions.

- [ ] **BCG Henderson Institute — Leadership**
  - Supplied URL: https://www.bcg.com/rss
  - Result: Client error '404 Not Found' for url 'https://www.bcg.com/rss'
  - Action: Find the current publisher-advertised RSS/Atom endpoint, then verify XML and robots access before activation.

- [ ] **Strategy+Business — Leadership**
  - Supplied URL: https://www.strategy-business.com/rss
  - Result: Response is not a parseable RSS/Atom feed
  - Action: Find the current publisher-advertised RSS/Atom endpoint, then verify XML and robots access before activation.

- [ ] **INSEAD Knowledge — Leadership**
  - Supplied URL: https://knowledge.insead.edu/rss
  - Result: Client error '403 Forbidden' for url 'https://knowledge.insead.edu/robots.txt'
  - Action: Confirm the publisher’s canonical host and accessible robots policy, then retest the feed. Do not bypass access restrictions.

- [ ] **CIPD — Organisations**
  - Supplied URL: https://www.cipd.org/en/rss/
  - Result: Client error '404 Not Found' for url 'https://www.cipd.org/en/rss/'
  - Action: Find the current publisher-advertised RSS/Atom endpoint, then verify XML and robots access before activation.

- [ ] **HR Brew — Organisations**
  - Supplied URL: https://www.hr-brew.com/rss
  - Result: Client error '403 Forbidden' for url 'https://www.hr-brew.com/robots.txt'
  - Action: Confirm the publisher’s canonical host and accessible robots policy, then retest the feed. Do not bypass access restrictions.

- [ ] **People Management — Organisations**
  - Supplied URL: https://www.peoplemanagement.co.uk/rss
  - Result: Redirect response '301 Moved Permanently' for url 'http://www.peoplemanagement.co.uk/robots.txt'
  - Action: Confirm the publisher’s canonical host and accessible robots policy, then retest the feed. Do not bypass access restrictions.

- [ ] **SHRM — Organisations**
  - Supplied URL: https://www.shrm.org/rss
  - Result: Client error '404 Not Found' for url 'https://www.shrm.org/rss'
  - Action: Find the current publisher-advertised RSS/Atom endpoint, then verify XML and robots access before activation.

- [ ] **Gartner HR — Organisations**
  - Supplied URL: https://www.gartner.com/en/human-resources/rss
  - Result: Client error '403 Forbidden' for url 'https://www.gartner.com/robots.txt'
  - Action: Confirm the publisher’s canonical host and accessible robots policy, then retest the feed. Do not bypass access restrictions.

- [ ] **Mercer Insights — Organisations**
  - Supplied URL: https://www.mercer.com/rss
  - Result: Client error '404 Not Found' for url 'https://www.mercer.com/rss/'
  - Action: Find the current publisher-advertised RSS/Atom endpoint, then verify XML and robots access before activation.

- [ ] **ILO (International Labour Organization) — People & Jobs**
  - Supplied URL: https://www.ilo.org/rss
  - Result: Client error '404 Not Found' for url 'https://www.ilo.org/rss'
  - Action: Find the current publisher-advertised RSS/Atom endpoint, then verify XML and robots access before activation.

- [ ] **Eurofound — People & Jobs**
  - Supplied URL: https://www.eurofound.europa.eu/rss
  - Result: Client error '429 Too Many Requests' for url 'https://www.eurofound.europa.eu/robots.txt'
  - Action: Confirm the publisher’s canonical host and accessible robots policy, then retest the feed. Do not bypass access restrictions.

- [ ] **ETUI (European Trade Union Institute) — People & Jobs**
  - Supplied URL: https://www.etui.org/rss
  - Result: Client error '404 Not Found' for url 'https://www.etui.org/rss'
  - Action: Find the current publisher-advertised RSS/Atom endpoint, then verify XML and robots access before activation.

- [ ] **OECD Employment — People & Jobs**
  - Supplied URL: https://www.oecd.org/employment/rss
  - Result: Client error '403 Forbidden' for url 'https://www.oecd.org/employment/rss'
  - Action: Retry later and check the publisher’s RSS availability; retain manual/pending status if access remains unavailable.

- [ ] **World Economic Forum (Future of Work) — People & Jobs**
  - Supplied URL: https://www.weforum.org/rss
  - Result: Client error '403 Forbidden' for url 'https://www.weforum.org/rss'
  - Action: Retry later and check the publisher’s RSS availability; retain manual/pending status if access remains unavailable.

Nine additions passed: MIT Sloan Management Review, McKinsey Insights, Chief Executive Magazine, Josh Bersin, HR Dive, Social Europe, Resolution Foundation, Economic Policy Institute, and The Guardian (Work). Social Europe uses the verified canonical URL `https://www.socialeurope.eu/feed`. McKinsey’s earlier feed-verification action is now resolved for the Insights URL; AI relevance filtering remains required.

## Earlier supplied checklist — retained for follow-up

The original checklist below was deferred by the owner. Its assertions (including scraping permission, feed availability, and YouTube API requirements) are historical claims, not fresh verification or instructions to activate those sources. The current registry and `verification.json` remain authoritative. The existing YouTube RSS approach is unchanged.

### Original checklist from 2026-09-18

> Work through this before the first ingestion run. Items are grouped by effort.
> Legend: 🔴 Blocker · 🟡 Verify at runtime · 🟢 Done (no action needed) · ⚪ Deferred / MVP excluded

---

## 🔴 Must resolve before first run

- [ ] **YouTube Data API v3** — Register a Google Cloud project, enable YouTube Data API v3, generate an API key, and add it to `.env` as `YOUTUBE_API_KEY`. Affects 6 channels: Two Minute Papers, AI Explained, Matt Wolfe, Wes Roth, Fireship, Yannic Kilcher. Without this, YouTube sources produce nothing.

- [ ] **AP Technology feed** — The rsshub.app mirror returns 403. Two options:
  - Self-host an [rss-bridge](https://github.com/RSS-Bridge/rss-bridge) or [rsshub](https://github.com/DIYgod/RSSHub) instance and point the feed_url to it, **or**
  - Find a direct AP RSS URL (AP has limited public feeds — check `apnews.com/apf-technology` at runtime).

- [ ] **Reuters Technology** — Reuters removed public RSS ~2023. Either:
  - Test `https://feeds.reuters.com/reuters/technologyNews` at runtime (may still partially resolve), **or**
  - Replace with a scraper on `https://www.reuters.com/technology/` (robots.txt permits general crawlers — verify), **or**
  - Accept that Reuters coverage comes through mainstream feeds (Guardian, BBC, AP) and drop this entry.

---

## 🟡 Verify at runtime (test feed URL on first polling run)

- [ ] **Tech Policy Press** — `https://techpolicy.press/feed/` — correct URL, prior 301 was a robots.txt check artefact. Confirm feed returns XML.

- [ ] **Euractiv AI** — Switched to main feed `https://www.euractiv.com/feed/` — section path `/sections/digital/` was dead. Confirm XML returned; add keyword filter for AI Act, DSA, digital policy post-ingestion.

- [ ] **a16z Blog** — `https://a16z.com/feed/` — URL correct, prior 404 likely transient. Confirm at runtime.

- [ ] **MIT Work of the Future** — `https://workofthefuture.mit.edu/feed/` — 301 was on robots.txt check, not feed. Confirm XML.

- [ ] **AI Daily Brief** (podcast) — `https://anchor.fm/s/f7cac464/podcast/rss` — Anchor 302 redirects to Spotify. Confirm feedparser follows redirect correctly.

- [ ] **Machine Learning Street Talk** (podcast) — `https://anchor.fm/s/1e4a0eac/podcast/rss` — same as above. Confirm redirect followed.

- [ ] **SHRM (HR)** — Corrected to `https://www.shrm.org/rss/pages/rss.aspx` — SHRM restructured URLs. Confirm at runtime; may need further path adjustment.

- [ ] **Chain of Thought** — `https://chainofthought.substack.com/feed` — Standard Substack path. Confirm at runtime.

- [ ] **AI4D Africa** — `https://africa.ai4d.ai/feed/` — Domain migrated. Confirm feed returns XML.

- [ ] **Analytics India Magazine** — `https://analyticsindiamag.com/ai/feed/` — Fallback: `/tag/artificial-intelligence/feed/`. Confirm one of these works.

- [ ] **SCMP** — `https://www.scmp.com/rss/4/feed` — Site blocks some crawlers. Test with a browser-like User-Agent. If blocked, consider RSSHub self-hosted instance.

- [ ] **Fortune** — `https://fortune.com/feed/` — Main feed valid. Add keyword filter (future of work, automation, AI jobs) post-ingestion to keep signal-to-noise high.

- [ ] **McKinsey** — `https://www.mckinsey.com/insights/rss` — Confirmed valid. Add keyword filter (AI, automation, workforce) post-ingestion.

---

## 🟢 Confirmed working — no action needed

- [x] **Center for AI Safety** — `https://newsletter.safe.ai/feed` — RSS 2.0 confirmed, recent issues present.
- [x] **GovAI** — `https://www.governance.ai/post/rss.xml` — Found in site footer, confirmed.
- [x] **McKinsey** — URL confirmed valid (listed above for filter note only).
- [x] **VentureBeat** — `https://venturebeat.com/feed/` — Main feed confirmed valid.
- [x] **Redwood Research** — `https://redwoodresearch.substack.com/feed` — Moved to Substack.

---

## ⚪ Scrape-pending (no RSS — decide before v1 launch)

- [ ] **Algorithmic Justice League** — Scrape `/media` and `/news`. Verify robots.txt empty (check again at runtime before enabling).
- [ ] **Alan Turing Institute** — Scrape `https://www.turing.ac.uk/news`. No RSS found. Verify robots.txt permits.
- [ ] **Apolitical** — All RSS paths 404. Scrape-pending. Verify robots.txt at runtime before enabling.
- [ ] **Harvard Berkman Klein** — No working RSS. Scrape `https://cyber.harvard.edu/news` or drop. Low AI-signal volume — consider dropping for MVP and revisiting.
- [ ] **DataCamp blog** — Scrape `https://www.datacamp.com/blog`. robots.txt allows general crawlers — verify current policy.
- [ ] **TAAFT** — Scrape `/new-tools`. robots.txt blocks SEO bots only. Verify and consider API contact.
- [ ] **Law firm trackers** — Check ToS and robots.txt per firm (White & Case, DLA Piper) individually before any scraping.

---

## ⚪ Manual curation only (no automation possible)

- [ ] **WEF Future of Jobs** — No public RSS (403). Add flagship report links manually on publication (typically Jan–May annually).
- [ ] **LinkedIn Work Change Report** — Annual release only. Add manually.
- [ ] **Nikkei Asia** — RSS requires subscriber account. Either subscribe and extract feed URL from account, or monitor manually at `https://asia.nikkei.com/Business/Tech`.
- [ ] **UNDP Digital** — No digital-specific feed. Using UN News Development feed as substitute — monitor actual UNDP Digital page manually for major publications.
- [ ] **One-off documentaries** — Monthly manual review: Netflix, Bloomberg Originals, PBS Frontline, BBC, long-form YouTube.
- [ ] **AI Ethics Brief (Montreal)** — Email only. Contact publisher: `https://montrealethics.ai/` to request a feed or API.

---

## ⚪ Excluded from MVP

- [x] **Bloomberg Technology** — Paywalled. No action.

---

## One-time setup tasks (infrastructure)

- [ ] Add `YOUTUBE_API_KEY` to `.env` and `.env.example`
- [ ] Implement YouTube Data API v3 client in `src/ingestion/youtube_poller.py` (separate from `rss_poller.py`)
- [ ] Add post-ingestion keyword filter config (e.g. `src/processing/keyword_filters.json`) for McKinsey, Fortune, Euractiv, VentureBeat — these use broad feeds that need narrowing
- [ ] Add `connection_type: "api"` branch to ingestion router in `rss_poller.py`
- [ ] Add `connection_type: "scrape"` stubs with robots.txt pre-check in `scraper.py`
- [ ] Self-host rss-bridge or rsshub if AP/SCMP blocking persists

---

*Generated: 2026-09-18 | Based on connectivity audit of sources.json*

## Part 2 — Regional and non-English sources: deferred until before live

Owner instruction (2026-09-21): add later, not now. These are unverified candidates; this section does not activate feeds or scraping. Before activation, deduplicate against both registries, confirm RSS/Atom and robots access, record verification, and retain AI relevance filtering for general news feeds.

- [ ] When activating Part 2, add to the actual GPT-4o-mini prompt in `src/processing/summariser.py`: **Always write the summary in English, regardless of the language of the source article.** The suggested `src/pipeline/summarise.py` does not exist here.
- [ ] Test multilingual accuracy and English output while preserving the complete prompt/schema budget below 500 tokens.
- [ ] Verify country, language and topic scope for every feed before adding it to `sources.json`.

### China — Technology / AI Policy & Regulation

- [ ] South China Morning Post Tech — EN — https://www.scmp.com/rss/36/feed/ — compare existing SCMP coverage.
- [ ] KrASIA — EN — https://console.kr-asia.com/feed
- [ ] Sixth Tone — EN — https://www.sixthtone.com/rss
- [ ] Caixin Global — EN — https://www.caixinglobal.com/rss/latest.xml
- [ ] Xinhua English — EN — http://www.xinhuanet.com/english/rss_eng.htm — may be a feed directory, not an XML feed.
- [ ] MIIT, CAC and State Council: supplied as having no RSS. Confirm current RSS options and official URLs; add scraper targets only if robots/access policies permit.

### Middle East — AI Policy & Regulation / Technology

- [ ] Middle East AI News — EN — https://middleeastainews.substack.com/feed
- [ ] Arab News — EN — https://www.arabnews.com/rss
- [ ] Al Arabiya Technology — AR — https://www.alarabiya.net/feed/rss2/ar/technology.xml
- [ ] Asharq Al-Awsat Technology — AR — https://aawsat.com/feed/information-technology
- [ ] UAE AI Office and SDAIA: confirm the supplied no-RSS claim and official URLs; future scraping only if robots/access policies permit.

### Africa — Technology / AI Policy & Regulation

- [ ] TechCabal — EN — https://techcabal.com/feed/
- [ ] Disrupt Africa — EN — https://disruptafrica.com/feed/
- [ ] Techpoint Africa — EN — https://techpoint.africa/feed/
- [ ] IT News Africa — EN — https://www.itnewsafrica.com/feed/
- [ ] CIPESA — EN — https://cipesa.org/feed/
- [ ] Africa AI News — EN — https://africaainews.substack.com/feed

### Germany — DE — Technology / AI Policy / Leadership

- [ ] Handelsblatt Tech — https://www.handelsblatt.com/contentexport/feed/technologie
- [ ] Der Spiegel Netzwelt — https://www.spiegel.de/netzwelt/index.rss
- [ ] Golem.de — https://www.golem.de/rss
- [ ] t3n — https://t3n.de/rss.xml
- [ ] BSI — https://www.bsi.bund.de/SiteGlobals/Functions/RSSFeed/RSSNewsfeed/RSSNewsfeed.xml
- [ ] Süddeutsche Zeitung Digital — https://rss.sueddeutsche.de/rss/Digital

### France — FR — AI Policy / Technology

- [ ] Le Monde Informatique AI — https://www.lemondeinformatique.fr/flux-rss/thematique/intelligence-artificielle/rss.xml
- [ ] ActuIA — https://www.actuia.com/feed/

### Italy — IT — AI Policy / Technology

- [ ] Wired Italia — https://www.wired.it/feed/rss
- [ ] Agenda Digitale — https://www.agendadigitale.eu/feed/

### Spain — ES — Technology

- [ ] El País Tecnología — https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/tecnologia/portada
- [ ] El Confidencial Tech — https://www.elconfidencial.com/rss/tecnologia

### Central & Eastern Europe

- [ ] Hospodářské noviny — Czech Republic — https://archiv.hn.cz/rss
- [ ] Rzeczpospolita Tech — Poland — https://www.rp.pl/rss/1019
- [ ] Forbes Romania — Romania — https://www.forbes.ro/feed
- [ ] HVG Tech — Hungary — https://hvg.hu/rss/tudomany
- [ ] Digi24 — Romania — https://www.digi24.ro/rss — moved here from the supplied Nordics grouping.

### Benelux

- [ ] De Tijd — Belgium — https://www.tijd.be/rss
- [ ] NRC Tech — Netherlands — https://www.nrc.nl/rss/ — verify technology filtering.
- [ ] Tweakers.net — Netherlands — https://feeds.tweakers.net/nieuws/full.xml

### Nordics

- [ ] Altinget — Denmark — https://www.altinget.dk/feed
- [ ] Yle Uutiset — Finland — https://feeds.yle.fi/uutiset/v1/majorHeadlines/YLE_UUTISET.rss

### Baltic States

- [ ] Delfi Tech (LT/LV/EE) — https://tech.delfi.lt/rss/ — verify language and coverage; the supplied Lithuanian endpoint must not be assumed to cover Latvia and Estonia.

### Southern Europe

- [ ] Público Tech — Portugal — https://www.publico.pt/rss — verify technology filtering.
- [ ] Kathimerini Tech — Greece — https://www.kathimerini.gr/rss — verify technology filtering.

### EU cross-border

- [ ] Euractiv Digital — EN — https://www.euractiv.com/sections/digital/feed/ — compare earlier Euractiv action; section URLs may be obsolete.
- [ ] Netzpolitik.org — DE/EN — https://netzpolitik.org/feed/
