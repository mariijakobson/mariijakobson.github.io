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

The accounts in `data/accounts.js` come from `P998YOBChart of Accounts123115.csv.xlsx`. Rows highlighted yellow in the source workbook are the default key-account view.

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
