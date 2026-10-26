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
  const notification = document.getElementById("copy-notification");
  let notificationTimer;
  function notifyCopy(message, failed = false) {
    clearTimeout(notificationTimer);
    notification.textContent = message;
    notification.classList.toggle("is-error", failed);
    notification.classList.add("is-visible");
    notificationTimer = setTimeout(() => {
      notification.classList.remove("is-visible");
      notification.textContent = "";
    }, failed ? 6000 : 3000);
  }
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
      name.className = "chart-account-name";
      name.title = account.name;
      const copyButton = document.createElement("button");
      copyButton.type = "button";
      copyButton.className = "chart-copy";
      copyButton.setAttribute("aria-label", `Copy account code ${account.code}`);
      copyButton.title = "Copy account code";
      copyButton.addEventListener("click", async () => {
        copyButton.disabled = true;
        try {
          await copyAccountCode(String(account.code));
          copyButton.dataset.state = "copied";
          copyButton.title = "Copied";
          notifyCopy(`Account code ${account.code} copied.`);
        } catch {
          copyButton.dataset.state = "error";
          copyButton.title = "Copy failed. Click to retry";
          notifyCopy("Copy failed. Select the account code and copy it manually.", true);
        } finally {
          copyButton.disabled = false;
          setTimeout(() => {
            delete copyButton.dataset.state;
            copyButton.title = "Copy account code";
          }, 2000);
        }
      });
      row.append(code, name, copyButton);
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

async function copyAccountCode(code) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(code);
      return;
    }
  } catch {
    // Local files and restricted clipboard permissions may need the fallback.
  }
  const previousFocus = document.activeElement;
  const input = document.createElement("textarea");
  input.className = "clipboard-input";
  input.value = code;
  input.readOnly = true;
  document.body.append(input);
  try {
    input.select();
    if (!document.execCommand("copy")) throw new Error("Copy failed");
  } finally {
    input.remove();
    if (previousFocus) previousFocus.focus();
  }
}
})();
