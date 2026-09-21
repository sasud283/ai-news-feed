# Work category split

The active taxonomy replaces Future of Work with these three categories, in order:

| Category | Focus | Audience |
|---|---|---|
| Leadership | AI strategy, competitive positioning, boardroom decisions | C-suite, senior leaders, boards |
| Organisations | Workforce adaptation, hiring, skills development, internal adoption, people operations | HR directors, CHROs, L&D |
| People & Jobs | Labour markets, worker displacement, reskilling, societal employment impact | Workers, policy researchers; regional and institutional evidence prioritised |

An article can have more than one category when both perspectives are substantive.
Organisations concerns action inside an employer; People & Jobs concerns workers
and labour markets. Leadership concerns strategic decisions. General business or
management reporting still needs an AI connection before inclusion.

`src/config.py` is the Python category source of truth. `src/lib/taxonomy.ts`
provides frontend order, descriptions, and compatibility for older saved views.
A regression test keeps the Python and frontend lists aligned. Model IDs now map
5→Leadership, 6→Organisations, 7→People & Jobs, 8→Future of Daily Life,
9→AI Equity & Representation, 10→Tools & Products. The model prompt and validators
were updated together; the total local prompt budget remains below 500 tokens.

Migration 0007 recreates the database topic enum without the old label. Existing
work stories receive provisional topic suggestions based on their headline and
summary and return to review; rejected stories remain rejected. The migration
records the original label in audit metadata rather than inventing certainty.
Existing newsletter/profile topic preferences expand the old category to all
three, preserving their scope and removing duplicates. Older bookmarks and
browser defaults receive the same expansion when loaded. Historical migrations,
source names and original reference documents retain their original wording.

Nine feeds were verified and activated; 16 remain pending. All 25 proposed entries
are preserved in the source audit, including aliases for existing SHRM and WEF
entries. Existing sources were redistributed without removing their provenance.
See [source checks](../sources/work-category-expansion.md) and the
[sources action checklist](../sources/actions-required.md).

Migration 0007 was applied live on 2026-09-21. No live stories used the old work topic; both published stories remain published.
