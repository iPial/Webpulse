/* Webpulse — tiny chart + interaction helpers */

(function () {
  const NS = "http://www.w3.org/2000/svg";

  // ---------- Sparkline ----------
  // Usage:  <svg class="spark" data-spark="38,57,42,30,38,28,43" data-color="#0EA86B"></svg>
  function renderSpark(svg) {
    const data = (svg.dataset.spark || "").split(",").map(Number).filter(n => !isNaN(n));
    if (!data.length) return;
    const color = svg.dataset.color || getComputedStyle(document.body).getPropertyValue('--ink');
    const w = svg.clientWidth || 300;
    const h = svg.clientHeight || 60;
    const pad = 4;
    const min = Math.min(...data, 0);
    const max = Math.max(...data, 1);
    const range = (max - min) || 1;
    const stepX = (w - pad * 2) / Math.max(1, data.length - 1);
    const pts = data.map((v, i) => [pad + i * stepX, h - pad - ((v - min) / range) * (h - pad * 2)]);

    let d = "M " + pts.map(p => p.map(n => n.toFixed(1)).join(" ")).join(" L ");
    let area = d + ` L ${w-pad} ${h-pad} L ${pad} ${h-pad} Z`;

    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.innerHTML = "";
    const a = document.createElementNS(NS, "path");
    a.setAttribute("d", area); a.setAttribute("fill", color); a.classList.add("area");
    svg.appendChild(a);
    const l = document.createElementNS(NS, "path");
    l.setAttribute("d", d); l.setAttribute("stroke", color); l.classList.add("line");
    svg.appendChild(l);
    pts.forEach((p, i) => {
      if (i !== pts.length - 1) return;
      const c = document.createElementNS(NS, "circle");
      c.setAttribute("cx", p[0]); c.setAttribute("cy", p[1]);
      c.setAttribute("fill", color);
      svg.appendChild(c);
    });
  }

  // ---------- Multi-line chart ----------
  // <svg class="multi" data-series='[{"name":"Perf","color":"#0EA86B","points":[1,2,3]},...]'></svg>
  function renderMulti(svg) {
    const series = JSON.parse(svg.dataset.series || "[]");
    const labels = JSON.parse(svg.dataset.labels || "[]");
    if (!series.length) return;
    const w = svg.clientWidth || 600;
    const h = svg.clientHeight || 220;
    const padL = 36, padR = 16, padT = 16, padB = 28;

    // bounds from override or auto
    const allVals = series.flatMap(s => s.points);
    const yMin = svg.dataset.min !== undefined ? +svg.dataset.min : Math.min(...allVals, 0);
    const yMax = svg.dataset.max !== undefined ? +svg.dataset.max : Math.max(...allVals, 100);
    const yRange = (yMax - yMin) || 1;
    const len = Math.max(...series.map(s => s.points.length));
    const stepX = (w - padL - padR) / Math.max(1, len - 1);

    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.innerHTML = "";

    // grid lines
    for (let i = 0; i <= 4; i++) {
      const y = padT + ((h - padT - padB) * i) / 4;
      const line = document.createElementNS(NS, "line");
      line.setAttribute("x1", padL); line.setAttribute("x2", w - padR);
      line.setAttribute("y1", y);    line.setAttribute("y2", y);
      line.setAttribute("stroke", "rgba(14,13,16,0.07)"); line.setAttribute("stroke-dasharray", "3 4");
      svg.appendChild(line);
      const lbl = document.createElementNS(NS, "text");
      lbl.textContent = Math.round(yMax - (yRange * i) / 4);
      lbl.setAttribute("x", padL - 8); lbl.setAttribute("y", y + 4);
      lbl.setAttribute("text-anchor", "end");
      lbl.setAttribute("font-size", "10");
      lbl.setAttribute("fill", "rgba(14,13,16,0.45)");
      lbl.setAttribute("font-family", "JetBrains Mono, monospace");
      svg.appendChild(lbl);
    }

    // x labels
    if (labels.length) {
      labels.forEach((lab, i) => {
        if (i % Math.ceil(labels.length / 6) !== 0 && i !== labels.length - 1) return;
        const x = padL + i * stepX;
        const t = document.createElementNS(NS, "text");
        t.textContent = lab;
        t.setAttribute("x", x); t.setAttribute("y", h - 8);
        t.setAttribute("text-anchor", "middle");
        t.setAttribute("font-size", "10");
        t.setAttribute("fill", "rgba(14,13,16,0.5)");
        t.setAttribute("font-family", "JetBrains Mono, monospace");
        svg.appendChild(t);
      });
    }

    // each series
    series.forEach(s => {
      const pts = s.points.map((v, i) => [
        padL + i * stepX,
        padT + (h - padT - padB) - ((v - yMin) / yRange) * (h - padT - padB),
      ]);
      const d = "M " + pts.map(p => p.map(n => n.toFixed(1)).join(" ")).join(" L ");
      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", d);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", s.color);
      path.setAttribute("stroke-width", "2.2");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      svg.appendChild(path);
      pts.forEach(p => {
        const c = document.createElementNS(NS, "circle");
        c.setAttribute("cx", p[0]); c.setAttribute("cy", p[1]); c.setAttribute("r", 3);
        c.setAttribute("fill", "var(--surface)");
        c.setAttribute("stroke", s.color); c.setAttribute("stroke-width", "1.6");
        svg.appendChild(c);
      });
    });
  }

  // ---------- Bar chart ----------
  // <svg class="bars" data-bars='[{"label":"Apr 16","value":40,"color":"#D6FF3C"}, ...]'></svg>
  function renderBars(svg) {
    const data = JSON.parse(svg.dataset.bars || "[]");
    if (!data.length) return;
    const w = svg.clientWidth || 600;
    const h = svg.clientHeight || 160;
    const padL = 28, padR = 8, padT = 12, padB = 22;
    const yMax = +svg.dataset.max || Math.max(...data.map(d => d.value), 100);
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;
    const barW = (innerW / data.length) - 6;

    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.innerHTML = "";

    // baseline
    const base = document.createElementNS(NS, "line");
    base.setAttribute("x1", padL); base.setAttribute("x2", w - padR);
    base.setAttribute("y1", h - padB); base.setAttribute("y2", h - padB);
    base.setAttribute("stroke", "rgba(14,13,16,0.1)");
    svg.appendChild(base);

    data.forEach((d, i) => {
      const x = padL + i * (innerW / data.length) + 3;
      const bh = (d.value / yMax) * innerH;
      const y = h - padB - bh;
      const r = document.createElementNS(NS, "rect");
      r.setAttribute("x", x); r.setAttribute("y", y);
      r.setAttribute("width", barW); r.setAttribute("height", bh);
      r.setAttribute("rx", 4);
      r.setAttribute("fill", d.color || "var(--ink)");
      svg.appendChild(r);
      if (d.label && (i % Math.ceil(data.length / 7) === 0 || i === data.length - 1)) {
        const t = document.createElementNS(NS, "text");
        t.textContent = d.label;
        t.setAttribute("x", x + barW / 2); t.setAttribute("y", h - 6);
        t.setAttribute("text-anchor", "middle");
        t.setAttribute("font-size", "10");
        t.setAttribute("fill", "rgba(14,13,16,0.5)");
        t.setAttribute("font-family", "JetBrains Mono, monospace");
        svg.appendChild(t);
      }
    });
  }

  function init() {
    document.querySelectorAll("svg.spark").forEach(renderSpark);
    document.querySelectorAll("svg.multi").forEach(renderMulti);
    document.querySelectorAll("svg.bars").forEach(renderBars);
  }
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
  window.addEventListener("resize", () => requestAnimationFrame(init));
})();
