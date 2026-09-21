# FA Toolbox development rules

Keep changes minimal, scoped, and easy to review. Preserve working behavior unless the task explicitly changes it.

## Project shape

```text
fa-toolbox/
├── index.html
├── README.md
├── AGENTS.md
├── css/
│   └── style.css
├── js/
│   ├── app.js
│   ├── utils.js
│   ├── chart-of-accounts.js
│   └── calculators/
│       ├── nav-impact.js
│       ├── fee-calculator.js
│       └── bond-interest.js
├── data/
│   └── accounts.js
├── tests/
│   └── calculations.test.js
```

## Responsibilities

- `index.html`: page structure and ordered script loading only. Do not add formulas or large style blocks.
- `css/style.css`: all application styling. Preserve the current visual language unless redesign is requested.
- `js/app.js`: shared calculator rendering, validation flow, accordions, results, and initialization. Do not add calculator formulas.
- `js/utils.js`: functions used by at least two independent features.
- `js/calculators/*.js`: one calculator definition and its formula, validation, and breakdown text per file.
- `js/chart-of-accounts.js`: account filtering and rendering.
- `data/accounts.js`: the single source of sample account data. Do not duplicate accounts elsewhere.
- `tests/calculations.test.js`: focused regression cases for financial formulas and shared calculation utilities.

## Scope

- Inspect and modify only files needed for the requested change.
- When changing one calculator, avoid other calculators unless shared behavior must change.
- Do not rename or reorganize unrelated code.
- Do not clean up unrelated working code.
- Explain before making a larger architectural change.

## Calculators

- Add each calculator as a kebab-case file under `js/calculators/`.
- Register it through `window.FACalculators` and add its script before `js/app.js` in `index.html`.
- Describe fields, results, optional period labels, and hints in the calculator definition so `app.js` stays generic.
- Keep calculator-specific formulas and breakdown text in the calculator file.
- Include a calculation breakdown for formula-based results.
- Preserve internal precision and round mainly for display.
- Make day-count and other financial assumptions explicit.

## Functions and data

- Prefer small functions that receive inputs and return outputs.
- Add a function to `utils.js` only when at least two features use it.
- Reuse existing functions instead of creating near-duplicates.
- Avoid hidden state beyond the documented `window.FAUtils`, `window.FACalculators`, `window.FA_CHART_OF_ACCOUNTS`, and initialization globals required by the build-free runtime.
- Keep sample account data only in `data/accounts.js`.

## UI and security

- Keep calculator panels independent and preserve calculation breakdowns.
- Reuse existing input, button, card, and panel styles.
- Render user-entered or data-file text with `textContent`, not HTML.
- Keep the application browser-only unless external data is explicitly requested.

## Dependencies

Do not add frameworks, TypeScript, build tools, npm dependencies, CSS frameworks, or external calculation libraries unless explicitly requested.

## Verification

- Test only the affected feature and shared code it uses.
- For formula changes, cover a normal case and relevant boundaries.
- Run `node tests/calculations.test.js` after changing calculations or shared date/number logic.
