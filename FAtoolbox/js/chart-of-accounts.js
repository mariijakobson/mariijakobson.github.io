(() => {
"use strict";

function normalize(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().trim();
}

function filterAccounts(accounts, query, showAll) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const matches = accounts.filter(account => {
    if (!terms.length) return showAll || account.key;
    const text = normalize(`${account.code} ${account.name} ${account.nameEt || ""} ${(account.aliases || []).join(" ")}`);
    return terms.every(term => text.includes(term));
  });

  const codeQuery = normalize(query).replace(/\s+/g, "");
  if (!/^\d+$/.test(codeQuery)) return matches;

  return matches
    .map((account, index) => ({ account, index }))
    .sort((left, right) => {
      const leftStartsWith = String(left.account.code).startsWith(codeQuery);
      const rightStartsWith = String(right.account.code).startsWith(codeQuery);
      return Number(rightStartsWith) - Number(leftStartsWith) || left.index - right.index;
    })
    .map(item => item.account);
}

function initializeChartOfAccounts() {
  const search = document.getElementById("account-search");
  const keyButton = document.getElementById("chart-key");
  const allButton = document.getElementById("chart-all");
  const count = document.getElementById("chart-count");
  const status = document.getElementById("chart-status");
  const list = document.getElementById("chart-list");
  let showAll = false;
  const accounts = Array.isArray(window.FA_CHART_OF_ACCOUNTS)
    ? window.FA_CHART_OF_ACCOUNTS
    : [];

  function render() {
    const searching = search.value.trim().length > 0;
    const visibleAccounts = filterAccounts(accounts, search.value, showAll);
    list.replaceChildren();

    visibleAccounts.forEach(account => {
      const row = document.createElement("li");
      const code = document.createElement("span");
      const name = document.createElement("span");
      code.className = "chart-code";
      code.textContent = account.code;
      name.textContent = account.name;
      row.append(code, name);
      list.append(row);
    });

    keyButton.setAttribute("aria-pressed", String(!searching && !showAll));
    allButton.setAttribute("aria-pressed", String(searching || showAll));
    count.textContent = `${accounts.length} accounts`;
    status.textContent = !accounts.length
      ? "Your chart of accounts has not been added yet."
      : searching
        ? (visibleAccounts.length ? `${visibleAccounts.length} matches across all accounts` : "No matching accounts. Try another code or name.")
        : `${visibleAccounts.length} ${showAll ? "accounts" : "key accounts"}`;
  }

  search.addEventListener("input", render);
  keyButton.addEventListener("click", () => {
    showAll = false;
    search.value = "";
    render();
  });
  allButton.addEventListener("click", () => {
    showAll = true;
    search.value = "";
    render();
  });

  render();
}

window.FAInitializeChartOfAccounts = initializeChartOfAccounts;
})();
