
(() => {
  "use strict";

  const root = document.getElementById("fixed-circuit-calculator");
  if (!root || root.dataset.initialized === "true") return;
  root.dataset.initialized = "true";

  const $ = id => root.querySelector("#" + id);
  const editor = $("fccResistorEditor");
  const typeSelect = $("fccType");
  let nextId = 1;
  let model = { series: [], branches: [] };

  const makeResistor = () => ({ id: nextId++, value: "" });
  const fmt = (n, unit = "") => {
    if (!Number.isFinite(n)) return "—";
    const v = Math.abs(n) < 1e-10 ? 0 : n;
    return Number(v.toPrecision(6)).toString() + (unit ? " " + unit : "");
  };
  const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);

  function ensureModel() {
    if (!model.series.length) model.series.push(makeResistor());
    if (!model.branches.length) model.branches.push([makeResistor()]);
  }

  function resistorRow(r, group, branchIndex = -1) {
    return `<div class="fcc-resistor-row">
      <div><label for="fccR${r.id}">Resistor R${r.id} (Ω)</label>
      <input id="fccR${r.id}" data-rid="${r.id}" data-group="${group}" data-branch="${branchIndex}"
        type="number" min="0" step="any" placeholder="Enter resistance" value="${escapeHtml(r.value)}"></div>
      <button type="button" data-remove="${r.id}" data-group="${group}" data-branch="${branchIndex}" aria-label="Remove resistor">Remove</button>
    </div>`;
  }

  function renderEditor() {
    ensureModel();
    const type = typeSelect.value;
    let html = "";

    if (type === "series") {
      html += `<div class="fcc-group"><h4>Series resistors</h4>`;
      html += model.series.map(r => resistorRow(r, "series")).join("");
      html += `</div>`;
    } else if (type === "parallel") {
      html += `<div class="fcc-group"><h4>Parallel branches</h4>`;
      model.branches.forEach((branch, bi) => {
        html += `<div class="fcc-group"><h4>Branch ${bi + 1}</h4>`;
        html += branch.map(r => resistorRow(r, "branch", bi)).join("");
        html += `<button type="button" data-add-branch-resistor="${bi}">＋ Resistor to branch</button>`;
        if (model.branches.length > 1) html += ` <button type="button" data-remove-branch="${bi}">Remove branch</button>`;
        html += `</div>`;
      });
      html += `</div>`;
    } else {
      html += `<div class="fcc-group"><h4>Series resistors before the parallel network</h4>`;
      html += model.series.map(r => resistorRow(r, "series")).join("");
      html += `</div><div class="fcc-group"><h4>Parallel network</h4>`;
      model.branches.forEach((branch, bi) => {
        html += `<div class="fcc-group"><h4>Branch ${bi + 1} (series resistors)</h4>`;
        html += branch.map(r => resistorRow(r, "branch", bi)).join("");
        html += `<button type="button" data-add-branch-resistor="${bi}">＋ Resistor to branch</button>`;
        if (model.branches.length > 1) html += ` <button type="button" data-remove-branch="${bi}">Remove branch</button>`;
        html += `</div>`;
      });
      html += `<button type="button" data-add-branch>＋ Add parallel branch</button></div>`;
      html += `<div class="fcc-group"><h4>Series resistors after the parallel network</h4>`;
      html += `<div class="fcc-note">Add the final series resistors using “Add resistor”.</div>`;
      html += `</div>`;
    }
    editor.innerHTML = html;
    updateDiagram();
  }

  function readValues(list) {
    return list.map(r => {
      const input = root.querySelector(`#fccR${r.id}`);
      return { ...r, value: input ? input.value : r.value };
    });
  }

  function getInputs() {
    model.series = readValues(model.series);
    model.branches = model.branches.map(readValues);
    const type = typeSelect.value;
    const voltage = Number($("fccVoltage").value);
    if ($("fccVoltage").value.trim() === "" || !Number.isFinite(voltage) || voltage < 0) {
      throw new Error("Enter a valid supply voltage of 0 V or higher.");
    }
    const lists = type === "series" ? [model.series] :
      type === "parallel" ? model.branches : [model.series, ...model.branches];
    const all = lists.flat();
    if (!all.length) throw new Error("Add at least one resistor.");
    for (const r of all) {
      if (String(r.value).trim() === "" || !Number.isFinite(Number(r.value)) || Number(r.value) <= 0) {
        throw new Error(`Enter a positive resistance value for resistor R${r.id}.`);
      }
    }
    if (type !== "series" && model.branches.some(b => b.length === 0)) {
      throw new Error("Every parallel branch must contain at least one resistor.");
    }
    return { type, voltage, series: model.series, branches: model.branches };
  }

  const sum = a => a.reduce((s, x) => s + x, 0);
  const parallelReq = values => 1 / sum(values.map(v => 1 / v));

  function solve(data) {
    const { type, voltage, series, branches } = data;
    let equivalent, resistorResults = [], branchCurrents = [];

    if (type === "series") {
      equivalent = sum(series.map(r => Number(r.value)));
      const current = equivalent ? voltage / equivalent : 0;
      resistorResults = series.map(r => {
        const R = Number(r.value);
        return { name: `R${r.id}`, R, V: current * R, I: current, P: current * current * R };
      });
    } else if (type === "parallel") {
      const branchR = branches.map(b => sum(b.map(r => Number(r.value))));
      equivalent = parallelReq(branchR);
      branches.forEach((branch, bi) => {
        const I = branchR[bi] ? voltage / branchR[bi] : 0;
        branch.forEach(r => {
          const R = Number(r.value), V = I * R;
          resistorResults.push({ name: `R${r.id} (Branch ${bi + 1})`, R, V, I, P: V * I });
        });
        branchCurrents.push({ name: `Branch ${bi + 1}`, I });
      });
    } else {
      const beforeR = sum(series.map(r => Number(r.value)));
      const branchR = branches.map(b => sum(b.map(r => Number(r.value))));
      const parallelR = parallelReq(branchR);
      equivalent = beforeR + parallelR;
      const totalI = equivalent ? voltage / equivalent : 0;
      const parallelV = totalI * parallelR;
      series.forEach(r => {
        const R = Number(r.value), V = totalI * R;
        resistorResults.push({ name: `R${r.id} (Series)`, R, V, I: totalI, P: V * totalI });
      });
      branches.forEach((branch, bi) => {
        const I = branchR[bi] ? parallelV / branchR[bi] : 0;
        branch.forEach(r => {
          const R = Number(r.value), V = I * R;
          resistorResults.push({ name: `R${r.id} (Branch ${bi + 1})`, R, V, I, P: V * I });
        });
        branchCurrents.push({ name: `Branch ${bi + 1}`, I });
      });
    }

    const totalCurrent = equivalent ? voltage / equivalent : 0;
    return { equivalent, totalCurrent, totalPower: voltage * totalCurrent, voltage, resistorResults, branchCurrents };
  }

  function svgText(x, y, text, size = 13, fill = "#dff8ff", anchor = "middle") {
    return `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" font-family="Arial">${escapeHtml(text)}</text>`;
  }
  function line(x1, y1, x2, y2) {
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#21d4fd" stroke-width="3" stroke-linecap="round"/>`;
  }
  function resistor(x, y, label) {
    return `${line(x, y, x + 10, y)}<rect x="${x + 10}" y="${y - 12}" width="56" height="24" rx="4" fill="#102642" stroke="#36e6a4" stroke-width="2"/>${line(x + 66, y, x + 76, y)}${svgText(x + 38, y + 4, label, 11)}`;
  }

  function updateDiagram() {
    const type = typeSelect.value;
    $("fccDiagramCaption").textContent =
      type === "series" ? "Series circuit" :
      type === "parallel" ? "Parallel circuit" : "Mixed series-parallel circuit";

    let svg = `<svg viewBox="0 0 560 250" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${type} circuit schematic">`;
    svg += `<rect width="560" height="250" rx="10" fill="#050b1a"/>`;
    if (type === "series") {
      const n = Math.min(model.series.length, 5);
      svg += line(35, 105, 65, 105) + svgText(48, 85, "+");
      svg += `<circle cx="25" cy="105" r="10" fill="#102642" stroke="#21d4fd" stroke-width="2"/>`;
      svg += line(25, 115, 25, 185) + line(25, 185, 520, 185) + line(520, 185, 520, 105);
      svg += line(25, 95, 25, 40) + line(25, 40, 520, 40) + line(520, 40, 520, 105);
      const spacing = 450 / Math.max(n, 1);
      for (let i = 0; i < n; i++) svg += resistor(55 + i * spacing, 105, `R${i + 1}`);
      if (model.series.length > 5) svg += svgText(280, 145, `+ ${model.series.length - 5} more resistors`, 12, "#36e6a4");
      svg += svgText(280, 25, "SERIES", 14, "#36e6a4");
    } else {
      const n = Math.min(model.branches.length, 3);
      svg += line(55, 45, 55, 205) + line(505, 45, 505, 205);
      svg += line(55, 45, 505, 45) + line(55, 205, 505, 205);
      for (let i = 0; i < n; i++) {
        const y = 70 + i * (110 / Math.max(n - 1, 1));
        svg += line(55, y, 170, y);
        svg += resistor(170, y, `R${i + 1}`);
        svg += line(246, y, 505, y);
      }
      if (model.branches.length > 3) svg += svgText(280, 238, `+ ${model.branches.length - 3} more branches`, 12, "#36e6a4");
      svg += svgText(280, 22, type === "parallel" ? "PARALLEL" : "SERIES + PARALLEL", 14, "#36e6a4");
      if (type === "mixed") {
        svg += svgText(280, 125, "Series resistors before/after network", 11, "#dff8ff");
      }
    }
    svg += `</svg>`;
    $("fccDiagram").innerHTML = svg;
  }

  function calculate() {
    $("fccError").textContent = "";
    try {
      const data = getInputs();
      const result = solve(data);
      $("fccReq").textContent = fmt(result.equivalent, "Ω");
      $("fccCurrent").textContent = fmt(result.totalCurrent, "A");
      $("fccPower").textContent = fmt(result.totalPower, "W");
      $("fccVout").textContent = fmt(result.voltage, "V");
      $("fccExplanation").innerHTML =
        `Equivalent resistance: <strong>${fmt(result.equivalent, "Ω")}</strong><br>` +
        `Total current: <strong>I = V / R = ${fmt(result.totalCurrent, "A")}</strong><br>` +
        `Total power: <strong>P = V × I = ${fmt(result.totalPower, "W")}</strong>`;
      const rows = result.resistorResults.map(r =>
        `<tr><td>${escapeHtml(r.name)}</td><td>${fmt(r.R, "Ω")}</td><td>${fmt(r.V, "V")}</td><td>${fmt(r.I, "A")}</td><td>${fmt(r.P, "W")}</td></tr>`
      ).join("");
      const branches = result.branchCurrents.length ? `<h4>Parallel branch currents</h4><ul>${
        result.branchCurrents.map(b => `<li>${escapeHtml(b.name)}: ${fmt(b.I, "A")}</li>`).join("")
      }</ul>` : "";
      $("fccDetails").innerHTML = `<h4>Individual resistor measurements</h4>
        <div class="fcc-table-wrap"><table class="fcc-table">
        <thead><tr><th>Component</th><th>Resistance</th><th>Voltage</th><th>Current</th><th>Power</th></tr></thead>
        <tbody>${rows}</tbody></table></div>${branches}`;
    } catch (err) {
      $("fccError").textContent = err.message || "Please check your inputs.";
      $("fccReq").textContent = $("fccCurrent").textContent = $("fccPower").textContent = $("fccVout").textContent = "—";
      $("fccExplanation").textContent = "Calculation could not be completed. Correct the inputs and try again.";
      $("fccDetails").innerHTML = "";
    }
  }

  editor.addEventListener("input", e => {
    const input = e.target.closest("[data-rid]");
    if (!input) return;
    const id = Number(input.dataset.rid);
    const group = input.dataset.group;
    const bi = Number(input.dataset.branch);
    const list = group === "series" ? model.series : model.branches[bi];
    const r = list && list.find(item => item.id === id);
    if (r) r.value = input.value;
  });

  editor.addEventListener("click", e => {
    const btn = e.target.closest("button");
    if (!btn) return;
    if (btn.hasAttribute("data-add-branch-resistor")) {
      model.branches[Number(btn.dataset.addBranchResistor)].push(makeResistor());
    } else if (btn.hasAttribute("data-remove-branch")) {
      const i = Number(btn.dataset.removeBranch);
      if (model.branches.length > 1) model.branches.splice(i, 1);
    } else if (btn.hasAttribute("data-remove")) {
      const id = Number(btn.dataset.remove);
      const group = btn.dataset.group;
      const bi = Number(btn.dataset.branch);
      const list = group === "series" ? model.series : model.branches[bi];
      if (list) {
        const index = list.findIndex(r => r.id === id);
        if (index >= 0 && list.length > 1) list.splice(index, 1);
        else if (list.length === 1) list[0].value = "";
      }
    } else if (btn.hasAttribute("data-add-branch")) {
      model.branches.push([makeResistor()]);
    } else return;
    renderEditor();
  });

  $("fccAddResistor").addEventListener("click", () => {
    model.series.push(makeResistor());
    renderEditor();
  });
  $("fccAddBranch").addEventListener("click", () => {
    model.branches.push([makeResistor()]);
    renderEditor();
  });
  typeSelect.addEventListener("change", () => {
    renderEditor();
    $("fccError").textContent = "";
  });
  $("fccCalculate").addEventListener("click", calculate);
  $("fccReset").addEventListener("click", () => {
    nextId = 1;
    model = { series: [makeResistor()], branches: [[makeResistor()], [makeResistor()]] };
    $("fccVoltage").value = "";
    $("fccError").textContent = "";
    $("fccReq").textContent = $("fccCurrent").textContent = $("fccPower").textContent = $("fccVout").textContent = "—";
    $("fccExplanation").textContent = "Choose a circuit and enter your values, then click Calculate Circuit.";
    $("fccDetails").innerHTML = "";
    renderEditor();
  });

  renderEditor();
})();
