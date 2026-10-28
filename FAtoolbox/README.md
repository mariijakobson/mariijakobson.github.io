# FA Toolbox

A dependency-free browser toolbox for small fund-administration calculations and accounting references.

## Run

Open `index.html` in a modern browser. No installation, build step, server, or external service is required.

All calculations run locally in the browser. The application does not store or transmit entered values.

## Included tools

- NAV Impact
- Annual Fee Calculator
- Bond Interest Calculator
- Debit/credit reference
- Searchable P998YOB chart of accounts with source-workbook defaults

The accounts in `data/accounts.js` come from `P998YOBChart of Accounts123208.csv`. The default key-account view preserves the yellow selections from the preceding source workbook.

## Input conventions

- Amounts accept a comma or dot as the decimal separator.
- Spaces may be used as thousands separators, for example `1 250 000.50`.
- Dates use `DD.MM.YYYY`.
- Date periods exclude the end date.
- ACT/365 uses a 365-day denominator.
- ACT/360 uses a 360-day denominator.
- 30/360 uses the Bond Basis convention implemented in `js/utils.js`.
- The default previous business day excludes weekends, but not public holidays.

## Add a calculator

1. Copy the structure of an existing file in `js/calculators/`.
2. Give the calculator a unique `id`, field definitions, result definitions, validation, and a `calculate()` function.
3. Register it by pushing it to `window.FACalculators`.
4. Add its script before `js/app.js` in `index.html`.
5. Add focused calculation cases to `tests/calculations.test.js`.

`js/app.js` builds the shared calculator UI from the calculator definition. Keep formulas and calculator-specific breakdown text in the calculator file.

## Verify calculations

With Node.js available, run:

```text
node tests/calculations.test.js
```

The application itself has no runtime dependency on Node.js.

## Daily index closing values

The index panel shows Nasdaq-100, OMXS30, Nikkei 225, EURO STOXX 50 and S&P 500.
It uses daily closes from Yahoo Finance's publicly accessible, undocumented chart endpoint.
No paid account or API key is used. This endpoint has no availability guarantee and may
change or rate-limit requests. This is a reference display, not an official valuation feed.

The updater excludes the current exchange-local calendar date even after that exchange
has closed. Weekends and holidays naturally retain the preceding available observation.
The compact index strip above the debit/credit reference displays S&P 500 first, followed
by the other indices, with closing values, closing dates and percentage changes from the
preceding trading-day close. Comparison dates are available in the hover tooltip and to screen readers. Missing
holiday observations are not replaced with invented values.

Run `node scripts/update-indices.mjs` to refresh `data/indices.json`, and
`node tests/indices.test.mjs` to check the closing-date rules. A failed download retains
that index's previous observations and records an error for the page to display.
The page checks for a newer published data file every five minutes, with a 15-second request timeout.
After 07:00 UTC it warns if any index has not refreshed that UTC day; before then it expects
the preceding day. This checks download freshness, not a holiday-aware trading calendar.
Older source history never replaces a newer published closing date.
Serve this folder over HTTP to view the index panel locally; the calculators still work
when opening `index.html` directly.

For the existing GitHub Pages repository, place the supplied workflow at the repository
root `.github/workflows/update-index-closes.yml`, alongside the `FAtoolbox/` folder.
It runs daily at 04:17, 05:17, 06:17, 08:17 and 10:17 UTC (add two hours in Estonia
in winter, three in summer). Later runs provide recovery opportunities for a missed schedule
or a temporary source failure. GitHub scheduling remains best-effort. The updater checks out
current main even on reruns, saves only the index data file, and explicitly requests a Pages
rebuild. Concurrent branch changes trigger up to three publication attempts, regenerating
data against current main rather than overwriting others’ commits. Pages requests are retried. It needs GitHub Actions enabled
with Contents and Pages write permissions and branch-based Pages publishing from the
default branch. The schedule is active only once installed in that default branch.
Run it manually after installation to verify the full download and publication path;
GitHub may delay scheduled runs. No API key or additional secret is needed.


All calculator panels start collapsed on page load.
