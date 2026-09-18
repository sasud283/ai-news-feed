# Source inventory

Updated 18 September 2026 from the [supplied source list](../specs/source-list.txt).
This list supersedes the original ten-source scaffold.

## Files

- [sources.json](../../src/ingestion/sources.json): 57 verified feeds (51 article/news, 6 podcast).
- [sources-pending.json](../../src/ingestion/sources-pending.json): 39 pending, manual, or excluded entries.
- [verification.json](verification.json): machine-readable checks, topic coverage,
  supplied aliases/URLs, popularity claims, and discovery references.

All 108 supplied table rows are represented, consolidated by feed/source. The eight
podcasts, six YouTube channels, and manual documentary category are also retained.
There are 96 unique connections or manual intake entries in total. Data & Society
from the original scaffold is omitted because it is absent from the replacement list.

## How the inventory works

Both registry files preserve the same seven fields: name, url, feed_url, category,
region, connection_type, notes. Empty URLs in pending entries mean the supplied
list did not identify a specific publication or feed; placeholders are not fetched.
Only sources.json should be passed to poll_all_sources. In the pending file,
connection_type describes the intended method, not an enabled connection.

Each shared feed is fetched once. Its primary category is the first listed category,
and notes plus the verification inventory retain all cross-listed topics and the
supplied filter instructions. Safety & Alignment routes to Ethics & Responsible AI.
Cross-topic article feeds come first, followed by supplemental feeds and podcasts.
The current poller runs concurrently; strict priority scheduling and article-level
classification remain future work. Region is a broad editorial label, not a
restriction on which countries a source covers. Popularity values are user-supplied
and were not independently verified.

## Corrections and limitations

- AI Now and ITU AI for Good have verified public RSS feeds, despite contradictory
  scrape-only claims in the supplied list. Their feeds are used instead of scraping.
- DeepMind and Mozilla redirected to current feed URLs; those destinations are saved.
- One Useful Thing and Ben's Bites were corrected to working publisher feed URLs.
- Anthropic uses the supplied third-party mirror. AP's third-party mirror remains
  pending. Mirrors are explicitly labeled and are not official publisher feeds.
- Podcast addresses were discovered through Apple Podcasts directory listings;
  publisher/show identity was matched before verifying the RSS feeds. Six verified;
  AI Daily Brief and Machine Learning Street Talk remain pending because their
  hosting service redirects robots.txt, which the current poller rejects.
- All six YouTube channel IDs were resolved from each channel's own metadata.
  Their public feed URLs remain pending because the current poller rejects the
  feed path under YouTube's robots policy. No access restriction was bypassed.
- Some sources return 404, 403, 429, non-feed HTML, or DNS errors. A failed check
  here does not establish that a publisher has no feed or is permanently offline.
- Scraping claims have not been revalidated; no scraper or email bridge was enabled.
  Chain of Thought needs its exact publication URL. Bloomberg remains excluded
  from MVP. LinkedIn reports and one-off documentaries remain manually curated.
- Verification means HTTP 200, recognized RSS/Atom, and compatibility with the
  current robots-aware fetcher at check time. No article bodies, audio, or video
  were saved. Feeds are configured locally, not scheduled or connected to the site.

## Verified feeds

| Source | Primary category | Format |
| --- | --- | --- |
| [The Rundown AI](https://rss.beehiiv.com/feeds/2R3C6Bt5wj.xml) | Cross-Topic AI Specialist Sources | article |
| [MIT Technology Review (AI)](https://www.technologyreview.com/topic/artificial-intelligence/feed/) | Cross-Topic AI Specialist Sources | article |
| [TechCrunch AI](https://techcrunch.com/category/artificial-intelligence/feed/) | Cross-Topic AI Specialist Sources | article |
| [Ars Technica AI](https://arstechnica.com/ai/feed/) | Cross-Topic AI Specialist Sources | article |
| [The Verge AI](https://www.theverge.com/rss/ai-artificial-intelligence/index.xml) | Cross-Topic AI Specialist Sources | article |
| [WIRED AI](https://www.wired.com/feed/tag/ai/latest/rss) | Cross-Topic AI Specialist Sources | article |
| [OpenAI News](https://openai.com/news/rss.xml) | Cross-Topic AI Specialist Sources | article |
| [Google DeepMind Blog](https://deepmind.google/blog/rss.xml) | Cross-Topic AI Specialist Sources | article |
| [Hugging Face Blog](https://huggingface.co/blog/feed.xml) | Cross-Topic AI Specialist Sources | article |
| [The Gradient](https://thegradient.pub/rss/) | Cross-Topic AI Specialist Sources | article |
| [Import AI (Jack Clark)](https://importai.substack.com/feed) | Cross-Topic AI Specialist Sources | article |
| [Simon Willison's Weblog](https://simonwillison.net/atom/everything/) | Cross-Topic AI Specialist Sources | article |
| [One Useful Thing (E. Mollick)](https://www.oneusefulthing.org/feed) | Cross-Topic AI Specialist Sources | article |
| [arXiv cs.AI](https://rss.arxiv.org/rss/cs.AI) | Models & Research | article |
| [arXiv cs.LG](https://rss.arxiv.org/rss/cs.LG) | Models & Research | article |
| [Anthropic News](https://rsshub.bestblogs.dev/anthropic/news) | Models & Research | article |
| [BAIR Blog](https://bair.berkeley.edu/blog/feed.xml) | Models & Research | article |
| [Ahead of AI (S. Raschka)](https://magazine.sebastianraschka.com/feed) | Models & Research | article |
| [Interconnects (N. Lambert)](https://www.interconnects.ai/feed) | Models & Research | article |
| [AI Now Institute](https://ainowinstitute.org/feed) | Ethics & Responsible AI | article |
| [The Conversation (AI)](https://theconversation.com/topics/artificial-intelligence-ai-90/articles.atom) | Ethics & Responsible AI | article |
| [Mozilla Foundation AI](https://www.mozillafoundation.org/en/blog/rss/) | Ethics & Responsible AI | article |
| [The Guardian (AI/Society)](https://www.theguardian.com/technology/artificialintelligenceai/rss) | Ethics & Responsible AI | article |
| [AlgorithmWatch (EU)](https://algorithmwatch.org/en/feed/) | Ethics & Responsible AI | article |
| [Ada Lovelace Institute (UK)](https://www.adalovelaceinstitute.org/feed/) | Ethics & Responsible AI | article |
| [LessWrong (curated)](https://www.lesswrong.com/feed.xml?view=curated-rss) | Ethics & Responsible AI | article |
| [AI Alignment Forum](https://www.alignmentforum.org/feed.xml) | Ethics & Responsible AI | article |
| [Future of Life Institute](https://futureoflife.org/feed/) | Ethics & Responsible AI | article |
| [MIRI (Machine Intelligence)](https://intelligence.org/feed/) | Ethics & Responsible AI | article |
| [80,000 Hours](https://80000hours.org/feed/) | Ethics & Responsible AI | article |
| [Georgetown CSET](https://cset.georgetown.edu/feed/) | Policy & Regulation | article |
| [European Commission Digital](https://digital-strategy.ec.europa.eu/en/rss.xml) | Policy & Regulation | article |
| [NIST AI (US standards)](https://www.nist.gov/blogs/cybersecurity-insights/rss.xml) | Policy & Regulation | article |
| [AI in Europe (Substack)](https://europeanai.substack.com/feed) | Policy & Regulation | article |
| [Politico EU Tech (EU)](https://www.politico.eu/feed/) | Policy & Regulation | article |
| [Ben's Bites](https://www.bensbites.com/feed) | Tools & Products | article |
| [Product Hunt (all)](https://www.producthunt.com/feed) | Tools & Products | article |
| [TLDR AI](https://tldr.tech/api/rss/ai) | Tools & Products | article |
| [Crunchbase News (AI)](https://news.crunchbase.com/sections/ai/feed/) | Business & Industry | article |
| [Financial Times (AI)](https://www.ft.com/artificial-intelligence?format=rss) | Business & Industry | article |
| [The Economist (AI filter)](https://www.economist.com/science-and-technology/rss.xml) | Business & Industry | article |
| [Stratechery](https://stratechery.com/feed/) | Business & Industry | article |
| [AI Weekly (China tracker)](https://aiweekly.co/issues.rss) | Geopolitics of AI | article |
| [Rest of World](https://restofworld.org/feed/latest/) | Geopolitics of AI | article |
| [Synced / 机器之心 (China)](https://syncedreview.com/feed/) | Geopolitics of AI | article |
| [Inc42 Tech (India)](https://inc42.com/feed/) | Geopolitics of AI | article |
| [TechCabal](https://techcabal.com/feed/) | AI Equity & Representation | article |
| [ITU AI for Good](https://aiforgood.itu.int/feed/) | AI Equity & Representation | article |
| [The Guardian (Technology)](https://www.theguardian.com/uk/technology/rss) | Mainstream / General Press | article |
| [NYT Technology](https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml) | Mainstream / General Press | article |
| [BBC Technology (UK)](https://feeds.bbci.co.uk/news/technology/rss.xml) | Mainstream / General Press | article |
| [Dwarkesh Podcast](https://apple.dwarkesh-podcast.workers.dev/feed.rss) | Cross-Topic AI Specialist Sources | podcast |
| [Latent Space](https://api.substack.com/feed/podcast/1084089.rss) | Cross-Topic AI Specialist Sources | podcast |
| [The Cognitive Revolution](https://feeds.megaphone.fm/RINTP3108857801) | Cross-Topic AI Specialist Sources | podcast |
| [No Priors](https://feeds.megaphone.fm/nopriors) | Cross-Topic AI Specialist Sources | podcast |
| [The TWIML AI Podcast](https://feeds.megaphone.fm/MLN2155636147) | Cross-Topic AI Specialist Sources | podcast |
| [NVIDIA AI Podcast](https://feeds.megaphone.fm/nvidiaaipodcast) | Cross-Topic AI Specialist Sources | podcast |

## Pending, manual, and excluded

| Source | Reason |
| --- | --- |
| Algorithmic Justice League | No confirmed RSS URL supplied; do not scrape until current robots policy and terms are checked. |
| AI Ethics Brief (Montreal AI Ethics) | No confirmed RSS URL supplied; do not scrape until current robots policy and terms are checked. |
| [Center for AI Safety (CAIS)](https://www.safe.ai/feed) | Redirect response '301 Moved Permanently' for url 'https://www.safe.ai/robots.txt' |
| [Redwood Research](https://www.redwoodresearch.org/blog-feed) | Client error '404 Not Found' for url 'https://www.redwoodresearch.org/blog-feed' |
| [Tech Policy Press](https://techpolicy.press/feed/) | Redirect response '301 Moved Permanently' for url 'https://techpolicy.press/robots.txt' |
| Law firm trackers (White & Case, DLA Piper) | No confirmed RSS URL supplied; do not scrape until current robots policy and terms are checked. |
| [Reuters Technology](https://feeds.reuters.com/reuters/technologyNews) | [Errno 8] nodename nor servname provided, or not known |
| [Euractiv AI (EU)](https://www.euractiv.com/sections/digital/feed/) | Client error '404 Not Found' for url 'https://www.euractiv.com/sections/digital/feed/' |
| The Median (DataCamp) | No confirmed RSS URL supplied; do not scrape until current robots policy and terms are checked. |
| Chain of Thought | No confirmed RSS URL supplied; do not scrape until current robots policy and terms are checked. |
| [SHRM (HR)](https://www.shrm.org/ResourcesAndTools/hr-topics/technology/rss/Pages/rss.aspx) | Client error '404 Not Found' for url 'https://www.shrm.org/resourcesandtools/hr-topics/technology/rss/pages/rss.aspx' |
| [WEF Future of Jobs](https://www.weforum.org/rss.xml) | Client error '403 Forbidden' for url 'https://www.weforum.org/rss.xml' |
| [McKinsey Global Institute](https://www.mckinsey.com/rss/insights/article-feed/all.xml) | Client error '404 Not Found' for url 'https://www.mckinsey.com/rss/insights/article-feed/all.xml' |
| [Work of the Future (MIT)](https://workofthefuture.mit.edu/feed/) | Redirect response '301 Moved Permanently' for url 'https://workofthefuture.mit.edu/robots.txt' |
| [Fortune (Future of Work)](https://fortune.com/tag/the-future-of-work/feed/) | Client error '404 Not Found' for url 'https://fortune.com/tag/the-future-of-work/feed/' |
| LinkedIn Work Change Report | No confirmed RSS URL supplied; do not scrape until current robots policy and terms are checked. |
| There's An AI For That (TAAFT) | No confirmed RSS URL supplied; do not scrape until current robots policy and terms are checked. |
| [VentureBeat AI](https://venturebeat.com/category/ai/feed/) | Client error '429 Too Many Requests' for url 'https://venturebeat.com/category/ai/feed/' |
| [a16z Blog](https://a16z.com/feed/) | Client error '404 Not Found' for url 'https://a16z.com/feed/' |
| [South China Morning Post (Tech)](https://www.scmp.com/rss/2/feed) | Redirect response '301 Moved Permanently' for url 'http://www.scmp.com/robots.txt' |
| [Nikkei Asia (Tech)](https://asia.nikkei.com/rss/feed/tnews) | Client error '404 Not Found' for url 'https://asia.nikkei.com/rss/feed/tnews' |
| [Analytics India Magazine (India)](https://analyticsindiamag.com/feed/) | not_feed |
| [Harvard Berkman Klein (AI)](https://cyber.harvard.edu/rss.xml) | not_feed |
| [AP Technology](https://rsshub.app/apnews/topics/technology) | Client error '403 Forbidden' for url 'https://rsshub.app/robots.txt' |
| Bloomberg Technology | No confirmed RSS URL supplied; do not scrape until current robots policy and terms are checked. |
| [GovAI (Centre for the Governance of AI)](https://www.governance.ai/feed) | Client error '404 Not Found' for url 'https://www.governance.ai/feed' |
| [Alan Turing Institute](https://www.turing.ac.uk/news/rss.xml) | Client error '404 Not Found' for url 'https://www.turing.ac.uk/news/rss.xml' |
| [AI4D Africa](https://ai4d.ai/feed/) | Redirect response '301 Moved Permanently' for url 'https://ai4d.ai/robots.txt' |
| [UNDP Digital](https://www.undp.org/rss/digital) | Client error '404 Not Found' for url 'https://www.undp.org/rss/digital' |
| [Apolitical (AI in government)](https://apolitical.co/rss) | Client error '404 Not Found' for url 'https://apolitical.co/en/rss' |
| [The AI Daily Brief](https://anchor.fm/s/f7cac464/podcast/rss) | Redirect response '302 ' for url 'https://anchor.fm/robots.txt' |
| [Machine Learning Street Talk](https://anchor.fm/s/1e4a0eac/podcast/rss) | Redirect response '302 ' for url 'https://anchor.fm/robots.txt' |
| [Two Minute Papers](https://www.youtube.com/feeds/videos.xml?channel_id=UCbfYPyITQ-7l4upoX8nvctg) | YouTube /feeds/videos.xml is disallowed by robots.txt for the current poller. Channel ID resolved from channelMetadataRenderer.externalId; feed not fetched. |
| [AI Explained](https://www.youtube.com/feeds/videos.xml?channel_id=UCNJ1Ymd5yFuUPtn21xtRbbw) | YouTube /feeds/videos.xml is disallowed by robots.txt for the current poller. Channel ID resolved from channelMetadataRenderer.externalId; feed not fetched. |
| [Matt Wolfe](https://www.youtube.com/feeds/videos.xml?channel_id=UChpleBmo18P08aKCIgti38g) | YouTube /feeds/videos.xml is disallowed by robots.txt for the current poller. Channel ID resolved from channelMetadataRenderer.externalId; feed not fetched. |
| [Wes Roth](https://www.youtube.com/feeds/videos.xml?channel_id=UCqcbQf6yw5KzRoDDcZ_wBSw) | YouTube /feeds/videos.xml is disallowed by robots.txt for the current poller. Channel ID resolved from channelMetadataRenderer.externalId; feed not fetched. |
| [Fireship](https://www.youtube.com/feeds/videos.xml?channel_id=UCsBjURrPoezykLs9EqgamOA) | YouTube /feeds/videos.xml is disallowed by robots.txt for the current poller. Channel ID resolved from channelMetadataRenderer.externalId; feed not fetched. |
| [Yannic Kilcher](https://www.youtube.com/feeds/videos.xml?channel_id=UCZHmQk67mSJgfCCTn7xBfew) | YouTube /feeds/videos.xml is disallowed by robots.txt for the current poller. Channel ID resolved from channelMetadataRenderer.externalId; feed not fetched. |
| One-off documentaries | Manual curation, as requested. |
