(() => {
"use strict";
const chart = document.getElementById("indices-chart");
const legend = document.getElementById("indices-legend");
const status = document.getElementById("indices-status");
const reset = document.getElementById("indices-reset");
const number = value => new Intl.NumberFormat("et-EE", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(value);
const dateLabel = value => new Intl.DateTimeFormat("et-EE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value + "T12:00:00Z"));
const ns = "http://www.w3.org/2000/svg";
function svgElement(tag, attributes, text) {
  const element = document.createElementNS(ns, tag);
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, String(value)));
  if (text !== undefined) element.textContent = text;
  return element;
}

async function initialize() {
  try {
    const response = await fetch("data/indices.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load closing data");
    const data = await response.json();
    if (!Array.isArray(data.series) || data.series.length !== 5) throw new Error("Invalid index data");
    let pinned = null;
    let preview = null;
    const series = data.series.map(item => ({ ...item, observations: item.observations.filter(point =>
      /^\d{4}-\d{2}-\d{2}$/.test(point.date) && Number.isFinite(point.close) && point.close > 0
    ).slice(-6) }));
    const available = series.filter(item => item.observations.length >= 2);
    if (!available.length) throw new Error("No closing data available");
    const dates = [...new Set(available.flatMap(item => item.observations.map(point => point.date)))].sort().slice(-5);
    const plotted = available.map(item => ({ ...item, observations: item.observations.filter(point => dates.includes(point.date)) }));
    const buttons = [];

    function draw() {
      const selected = preview || pinned;
      buttons.forEach((button, index) => {
        button.setAttribute("aria-pressed", String(pinned === series[index].symbol));
        button.classList.toggle("is-muted", Boolean(selected && selected !== series[index].symbol));
      });
      const active = plotted.filter(item => !selected || item.symbol === selected);
      const single = Boolean(selected);
      const width = 860, height = 320, left = 88, right = single ? 40 : 140, top = 38, bottom = 42;
      const x = date => left + dates.indexOf(date) * (width - left - right) / Math.max(1, dates.length - 1);
      const values = active.flatMap(item => item.observations.map(point => single ? point.close : point.close / item.observations[0].close * 100));
      if (!values.length) { chart.textContent = "Closing data is unavailable for this index."; return; }
      const low = Math.min(...values), high = Math.max(...values);
      const padding = Math.max((high - low) * .22, Math.abs(high) * .001, .1);
      const min = low - padding, max = high + padding;
      const y = value => top + (max - value) * (height - top - bottom) / (max - min);
      const svg = svgElement("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": single ? `${active[0].name}: daily closing values` : "Five indices, first displayed closing value = 100" });
      svg.append(svgElement("text", { x: left, y: 18, class: "index-axis" }, single ? `${active[0].name} · index points` : "First displayed close = 100"));
      for (let i = 0; i <= 4; i++) {
        const value = min + (max - min) * i / 4;
        svg.append(svgElement("line", { x1: left, x2: width - right, y1: y(value), y2: y(value), class: "index-grid" }));
        svg.append(svgElement("text", { x: left - 10, y: y(value) + 4, "text-anchor": "end", class: "index-axis" }, number(value)));
      }
      dates.forEach(date => svg.append(svgElement("text", { x: x(date), y: height - 12, "text-anchor": "middle", class: "index-axis" }, dateLabel(date).slice(0, 6))));
      const endLabels = [];
      active.forEach(item => {
        const pointValue = point => single ? point.close : point.close / item.observations[0].close * 100;
        svg.append(svgElement("polyline", { points: item.observations.map(point => `${x(point.date)},${y(pointValue(point))}`).join(" "), fill: "none", stroke: item.color, "stroke-width": 2.5 }));
        item.observations.forEach(point => {
          const originalIndex = available.find(source => source.symbol === item.symbol).observations.findIndex(source => source.date === point.date);
          const previous = available.find(source => source.symbol === item.symbol).observations[originalIndex - 1];
          const change = previous ? (point.close / previous.close - 1) * 100 : null;
          const changeLabel = change === null ? "" : ` · ${change > 0 ? "+" : ""}${number(change)}%`;
          const dot = svgElement("circle", { cx: x(point.date), cy: y(pointValue(point)), r: 4, fill: item.color, tabindex: 0 });
          const description = `${item.name} · ${dateLabel(point.date)} · ${number(point.close)}${changeLabel}`;
          dot.setAttribute("aria-label", description);
          dot.append(svgElement("title", {}, description));
          svg.append(dot);
          if (single) {
            svg.append(svgElement("text", { x: x(point.date), y: y(point.close) - 12, "text-anchor": "middle", class: "index-point-value" }, number(point.close)));
            if (change !== null) svg.append(svgElement("text", { x: x(point.date), y: y(point.close) + 22, "text-anchor": "middle", fill: change < 0 ? "#b52f36" : "#24734d", class: "index-point-change" }, changeLabel.slice(3)));
          }
        });
        const last = item.observations.at(-1);
        if (!single && last) endLabels.push({ name: item.name, color: item.color, y: y(pointValue(last)), pointY: y(pointValue(last)), x: x(last.date) });
      });
      endLabels.sort((a, b) => a.y - b.y);
      endLabels.forEach((label, index) => { if (index) label.y = Math.max(label.y, endLabels[index - 1].y + 17); });
      endLabels.forEach(label => {
        svg.append(svgElement("line", { x1: label.x + 4, x2: width - right + 10, y1: label.pointY, y2: label.y, stroke: label.color, "stroke-width": 1 }));
        svg.append(svgElement("text", { x: width - right + 14, y: label.y + 4, fill: label.color, class: "index-line-label" }, label.name));
      });
      chart.replaceChildren(svg);
    }

    legend.replaceChildren();
    series.forEach(item => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "index-legend-button";
      const name = document.createElement("strong");
      name.textContent = item.name;
      name.style.color = item.color;
      const value = document.createElement("span");
      const last = item.observations.at(-1);
      value.textContent = last ? `${number(last.close)} · ${dateLabel(last.date)}` : "Closing data unavailable";
      button.append(name, value);
      button.disabled = item.observations.length < 2;
      button.addEventListener("pointerenter", event => { if (event.pointerType !== "touch") { preview = item.symbol; draw(); } });
      button.addEventListener("pointerleave", () => { preview = null; draw(); });
      button.addEventListener("focus", () => { preview = item.symbol; draw(); });
      button.addEventListener("blur", () => { preview = null; draw(); });
      button.addEventListener("click", () => { pinned = pinned === item.symbol ? null : item.symbol; preview = null; draw(); });
      buttons.push(button);
      legend.append(button);
    });
    reset.onclick = () => { pinned = null; preview = null; draw(); };
    const outdated = series.some(item => item.error || !item.fetchedAt || Date.now() - Date.parse(item.fetchedAt) > 36 * 60 * 60 * 1000);
    status.textContent = outdated
      ? "Data update is overdue or failed. Check the closing date shown for each index."
      : "Previous trading-day closes · Yahoo Finance · Closing dates may differ due to local holidays.";
    status.classList.toggle("indices-warning", outdated);
    draw();
  } catch {
    status.textContent = "Closing data could not be loaded. Try refreshing the page. When opening a local file, use a local web server.";
    status.classList.add("indices-warning");
  }
}
initialize();
// Pick up newly published closing data in tabs left open overnight.
setInterval(initialize, 60 * 60 * 1000);
})();
