# Independent index refresh

Repository: `mariijakobson/mariijakobson.github.io`, branch `main`.
Published page: https://mariijakobson.github.io/FAtoolbox/

Two independent schedulers maintain the same data file:

1. GitHub Actions runs the deterministic updater using its existing UTC schedule.
2. A ChatGPT scheduled automation checks in the 07:00, 08:00, 09:00 and 10:00
   Europe/Tallinn morning windows every day (flexible scheduling can run within
   an hour of each time). If needed, it runs the same deterministic updater
   outside GitHub Actions and commits the data using the connected GitHub app.
   It does not depend on GitHub's scheduled workflows or on Actions runners.

Neither scheduler has an exact-time availability guarantee. This redundancy addresses
missed GitHub schedule events; it does not remove dependency on GitHub publishing or Yahoo.
Yahoo's two hosts are fallback endpoints of the same provider, not independent feeds.

## Procedure for each automation run

Use the connected GitHub app for repository reads and writes. Do not use a workflow
dispatch or a heartbeat commit as the backup: refresh the data directly.

1. Read `FAtoolbox/data/indices.json` on current `main`, retaining its content SHA.
   Resolve today's date in Europe/Tallinn. If there are exactly five expected symbols
   (`^NDX`, `^OMX`, `^N225`, `^STOXX50E`, `^GSPC`), each has at least two observations,
   no error, and a valid `fetchedAt` on today's Tallinn date, do not write anything.
   Always also fetch the public data file below with a unique query parameter and
   verify its five latest dates/values match the repository. Skip only if repository
   AND public data are fresh and agree. A failed public check requires a refresh.
2. Otherwise fetch the current `FAtoolbox/scripts/update-indices.mjs` and
   `FAtoolbox/tests/indices.test.mjs` through the connected GitHub app. Write those exact
   contents and the current data into a fresh scratch directory, preserving the
   `FAtoolbox/scripts`, `FAtoolbox/tests`, `FAtoolbox/data` paths. Do not reuse old code.
3. Run `node FAtoolbox/tests/indices.test.mjs`, then
   `node FAtoolbox/scripts/update-indices.mjs`. Tests must pass before publication.
   The updater filters out today's exchange-local values, checks source completeness,
   tries two Yahoo hosts, and preserves previous values with error status on failure.
   A nonzero updater exit can still produce publishable per-index failure status;
   never describe that as a successful update. No values are calculated by the model.
4. Parse the generated JSON. Confirm all five expected symbols are present exactly
   once, observations are finite positive closes on strictly increasing dates, no
   current/future exchange-local dates are included, and the latest observation of
   each index has not regressed compared with the file read in step 1. Use the
   updater's exported `validateData(generated, previous)` for this check.
5. Replace only `FAtoolbox/data/indices.json` with the exact generated UTF-8 contents
   using GitHub `update_file`, the retained SHA, branch `main` and commit message
   `Refresh index closes via independent scheduler`. A SHA conflict means another
   writer won: reread current main and repeat the procedure, at most three times.
   Never force-push or overwrite a concurrent writer with a stale local file.
6. A commit by the connected app triggers the existing branch-based GitHub Pages
   deployment. Inspect Actions runs for that exact commit and confirm a successful
   Pages deployment. Also fetch
   `https://mariijakobson.github.io/FAtoolbox/data/indices.json?v=<commit-sha>`
   using a regular HTTP GET and verify its `attemptedAt` and all five latest dates
   match the committed JSON. Poll briefly, no more than five minutes in total;
   an already verified newer publication also counts as success. Avoid blind sleeps
   longer than 30 seconds. Do not confuse a commit with a verified publication.
7. If the source failed, save the generated failure status so the page warns while
   keeping previous values. Report a brief Estonian alert identifying whether source
   fetch, repository write or Pages publication failed, with the last closing dates.
   The next scheduled check retries because errors/old fetchedAt fail step 1.
   If the repository data is fresh but publication previously failed, retry by making
   a fresh deterministic data refresh/commit and verify again. Do not change workflows,
   application code, permissions or secrets during these maintenance runs.

On successful refresh or an already-fresh no-op, do not send a routine user message.

## Manual verification

Run the same procedure immediately after changing the updater. The unit tests cover
exchange-local date boundaries, exclusion of today's intraday close, malformed data,
regression prevention, holidays, incomplete successful HTTP responses, host fallback
and complete network failure. A real download and public-file comparison separately
verify the source-to-publication path. Never invent missing market values.
