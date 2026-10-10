
"use strict";

(async function loadFixedCircuitCalculator() {
  const section = document.getElementById("fixed-circuit-calculator");
  if (!section || section.dataset.loaderStarted === "true") return;
  section.dataset.loaderStarted = "true";

  try {
    const response = await fetch("fixed-circuit-calculator.html");
    if (!response.ok) throw new Error("Could not load fixed-circuit-calculator.html");

    const html = await response.text();
    section.innerHTML = '<div class="container">' + html + '</div>';

    const root = section;
    const $ = id => root.querySelector("#" + id);
    const editor = $("fccResistorEditor");
    const typeSelect = $("fccType");

    if (!editor || !typeSelect) {
      throw new Error("Calculator HTML is missing required elements.");
    }

    let nextId = 1;
    let model = {
      series: [{ id: nextId++, value: "" }],
      branches: [
        [{ id: nextId++, value: "" }],
        [{ id: nextId++, value: "" }]
      ]
    };

    const makeResistor = () => ({ id: nextId++, value: "" });

    const fmt = (n, unit = "") => {
      if (!Number.isFinite(n)) return "—";
      const v = Math.abs(n) < 1e-10 ? 0 : n;
      return Number(v.toPrecision(6)).toString() + (unit ? " " + unit : "");
    };

    const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;",
      '"': "&quot;", "'": "&#39;"
    })[c]);

    function ensureModel() {
      if (!model.series.length) model.series.push(makeResistor());
      if (!model.branches.length) model.branches.push([makeResistor()]);
      model.branches.forEach((branch, i) => {
        if (!branch.length) model.branches[i].push(makeResistor());
      });
    }

    function resistorRow(r, group, branchIndex = -1) {
      return `
        <div class="fcc-resistor-row">
          <div>
            <label for="fccR${r.id}">Resistor R${r.id} (Ω)</label>
            <input id="fccR${r.id}" data-rid="${r.id}"
              data-group="${group}" data-branch="${branchIndex}"
              type="number" min="0" step="any"
              placeholder="Enter resistance"
              value="${escapeHtml(r.value)}">
          </div>
          <button type="button" data-remove="${r.id}"
            data-group="${group}" data-branch="${branchIndex}">
            Remove
          </button>
        </div>`;
    }

    function renderEditor() {
      ensureModel();
      const type = typeSelect.value;
      let html = "";

      if (type === "series") {
        html += '<div class="fcc-group"><h4>Series resistors</h4>';
        html += model.series.map(r => resistorRow(r, "series")).join("");
        html += "</div>";
      } else if (type === "parallel") {
        html += '<div class="fcc-group"><h4>Parallel branches</h4>';

        model.branches.forEach((branch, bi) => {
          html += `<div class="fcc-group"><h4>Branch ${bi + 1}</h4>`;
          html += branch.map(r => resistorRow(r, "branch", bi)).join("");
          html += `<button type="button" data-add-branch-resistor="${bi}">
            ＋ Resistor to branch
          </button>`;

          if (model.branches.length > 1) {
            html += ` <button type="button" data-remove-branch="${bi}">
              Remove branch
            </button>`;
          }
          html += "</div>";
        });

        html += '<button type="button" data-add-branch>＋ Add parallel branch</button>';
        html += "</div>";
      } else {
        html += '<div class="fcc-group"><h4>Series resistors before the parallel network</h4>';
        html += model.series.map(r => resistorRow(r, "series")).join("");
        html += "</div><div class=\"fcc-group\"><h4>Parallel network</h4>";

        model.branches.forEach((branch, bi) => {
          html += `<div class="fcc-group"><h4>Branch ${bi + 1} (series resistors)</h4>`;
          html += branch.map(r => resistorRow(r, "branch", bi)).join("");
          html += `<button type="button" data-add-branch-resistor="${bi}">
            ＋ Resistor to branch
          </button>`;

          if (model.branches.length > 1) {
            html += ` <button type="button" data-remove-branch="${bi}">
              Remove branch
            </button>`;
          }
          html += "</div>";
        });

        html += '<button type="button" data-add-branch>＋ Add parallel branch</button>';
        html += "</div>";
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

    function saveCurrentValues() {
      model.series = readValues(model.series);
      model.branches = model.branches.map(readValues);
    }

    function getInputs() {
      saveCurrentValues();

      const type = typeSelect.value;
      const voltageInput = $("fccVoltage");
      const voltage = Number(voltageInput.value);

      if (voltageInput.value.trim() === "" ||
          !Number.isFinite(voltage) || voltage < 0) {
        throw new Error("Enter a valid supply voltage of 0 V or higher.");
      }

      const lists = type === "series"
        ? [model.series]
        : type === "parallel"
          ? model.branches
          : [model.series, ...model.branches];

      const all = lists.flat();

      if (!all.length) throw new Error("Add at least one resistor.");

      for (const r of all) {
        if (String(r.value).trim() === "" ||
            !Number.isFinite(Number(r.value)) ||
            Number(r.value) <= 0) {
          throw new Error(`Enter a positive resistance value for resistor R${r.id}.`);
        }
      }

      if (type !== "series" &&
          model.branches.some(branch => branch.length === 0)) {
        throw new Error("Every parallel branch must contain a resistor.");
      }

      return {
        type,
        voltage,
        series: model.series,
        branches: model.branches
      };
    }

    const sum = values => values.reduce((total, value) => total + value, 0);

    function parallelReq(values) {
      if (!values.length || values.some(v => !(v > 0))) {
        throw new Error("Each parallel branch must have positive resistance.");
      }
      return 1 / sum(values.map(v => 1 / v));
    }

    function solve(data) {
      const { type, voltage, series, branches } = data;
      let equivalent;
      const resistorResults = [];
      const branchCurrents = [];

      if (type === "series") {
        equivalent = sum(series.map(r => Number(r.value)));
        const current = voltage / equivalent;

        series.forEach(r => {
          const R = Number(r.value);
          const V = current * R;
          resistorResults.push({
            name: `R${r.id}`, R, V, I: current, P: V * current
          });
        });
      } else if (type === "parallel") {
        const branchR = branches.map(branch =>
          sum(branch.map(r => Number(r.value)))
        );

        equivalent = parallelReq(branchR);

        branches.forEach((branch, bi) => {
          const I = voltage / branchR[bi];

          branch.forEach(r => {
            const R = Number(r.value);
            const V = I * R;
            resistorResults.push({
              name: `R${r.id} (Branch ${bi + 1})`,
              R, V, I, P: V * I
            });
          });

          branchCurrents.push({ name: `Branch ${bi + 1}`, I });
        });
      } else {
        // Mixed topology: series resistors followed by a parallel network.
        const beforeR = sum(series.map(r => Number(r.value)));
        const branchR = branches.map(branch =>
          sum(branch.map(r => Number(r.value)))
        );
        const parallelR = parallelReq(branchR);

        equivalent = beforeR + parallelR;
        const totalI = voltage / equivalent;
        const parallelV = totalI * parallelR;

        series.forEach(r => {
          const R = Number(r.value);
          const V = totalI * R;
          resistorResults.push({
            name: `R${r.id} (Series)`,
            R, V, I: totalI, P: V * totalI
          });
        });

        branches.forEach((branch, bi) => {
          const I = parallelV / branchR[bi];

          branch.forEach(r => {
            const R = Number(r.value);
            const V = I * R;
            resistorResults.push({
              name: `R${r.id} (Branch ${bi + 1})`,
              R, V, I, P: V * I
            });
          });

          branchCurrents.push({ name: `Branch ${bi + 1}`, I });
        });
      }

      const totalCurrent = voltage / equivalent;

      return {
        equivalent,
        totalCurrent,
        totalPower: voltage * totalCurrent,
        voltage,
        resistorResults,
        branchCurrents
      };
    }

    function svgText(x, y, text, size = 13, fill = "#dff8ff", anchor = "middle") {
      return `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}"
        text-anchor="${anchor}" font-family="Arial">${escapeHtml(text)}</text>`;
    }

    function line(x1, y1, x2, y2) {
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
        stroke="#21d4fd" stroke-width="3" stroke-linecap="round"/>`;
    }

    function resistor(x, y, label) {
      return `${line(x, y, x + 10, y)}
        <rect x="${x + 10}" y="${y - 12}" width="56" height="24"
          rx="4" fill="#102642" stroke="#36e6a4" stroke-width="2"/>
        ${line(x + 66, y, x + 76, y)}
        ${svgText(x + 38, y + 4, label, 11)}`;
    }

    function batterySymbol(x, y) {
  return `${line(x, y - 14, x, y + 14)}
    ${line(x + 10, y - 8, x + 10, y + 8)}
    ${svgText(x + 4, y - 23, "+", 12, "#36e6a4")}
    ${svgText(x + 4, y + 30, "−", 12, "#36e6a4")}`;
}

    function updateDiagram() {
      const type = typeSelect.value;

      $("fccDiagramCaption").textContent =
        type === "series" ? "Series circuit" :
        type === "parallel" ? "Parallel circuit" :
        "Mixed series-parallel circuit";

      let svg = `<svg viewBox="0 0 560 270" xmlns="http://www.w3.org/2000/svg"
        role="img" aria-label="${type} circuit schematic">
        <rect width="560" height="270" rx="10" fill="#050b1a"/>`;

      if (type === "series") {
        const n = Math.min(model.series.length, 5);
        const positions = n === 1 ? [270] :
          Array.from({ length: n }, (_, i) => 95 + i * (365 / (n - 1)));

        svg += line(55, 110, 75, 110);
        svg += batterySymbol(55, 110);
        svg += line(65, 110, 65, 195);
        svg += line(65, 195, 510, 195);
        svg += line(510, 195, 510, 110);
        svg += line(510, 110, 500, 110);

        positions.forEach((x, i) => {
          svg += resistor(x, 110, `R${i + 1}`);
          if (i < positions.length - 1) {
            svg += line(x + 76, 110, positions[i + 1], 110);
          }
        });

        if (model.series.length > 5) {
          svg += svgText(280, 150, `+ ${model.series.length - 5} more resistors`, 12, "#36e6a4");
        }
        svg += svgText(280, 28, "SERIES CIRCUIT", 14, "#36e6a4");
      } else {
        const n = Math.min(model.branches.length, 4);
        const ys = n === 1 ? [130] :
          Array.from({ length: n }, (_, i) => 65 + i * (130 / (n - 1)));

        svg += line(65, 55, 65, 205);
        svg += line(495, 55, 495, 205);
        svg += line(65, 55, 495, 55);
        svg += line(65, 205, 495, 205);
        svg += batterySymbol(65, 130);

        if (type === "mixed") {
          svg += svgText(280, 25, "SERIES + PARALLEL", 14, "#36e6a4");
          svg += svgText(280, 44, "Series resistors + parallel network", 10);
        } else {
          svg += svgText(280, 25, "PARALLEL CIRCUIT", 14, "#36e6a4");
        }

        ys.forEach((y, i) => {
          svg += line(65, y, 145, y);
          svg += resistor(145, y, `R${i + 1}`);
          svg += line(221, y, 495, y);
        });

        if (model.branches.length > 4) {
          svg += svgText(280, 245, `+ ${model.branches.length - 4} more branches`, 12, "#36e6a4");
        }

        if (type === "mixed" && model.series.length) {
          svg += svgText(280, 263,
            `${model.series.length} series resistor(s) before the network`, 10);
        }
      }

      svg += "</svg>";
      $("fccDiagram").innerHTML = svg;
    }

    function calculate() {
      $("fccError").textContent = "";

      try {
        const result = solve(getInputs());

        $("fccReq").textContent = fmt(result.equivalent, "Ω");
        $("fccCurrent").textContent = fmt(result.totalCurrent, "A");
        $("fccPower").textContent = fmt(result.totalPower, "W");
        $("fccVout").textContent = fmt(result.voltage, "V");

        $("fccExplanation").innerHTML =
          `Equivalent resistance: <strong>${fmt(result.equivalent, "Ω")}</strong><br>` +
          `Total current: <strong>I = V / R = ${fmt(result.totalCurrent, "A")}</strong><br>` +
          `Total power: <strong>P = V × I = ${fmt(result.totalPower, "W")}</strong>`;

        const rows = result.resistorResults.map(r => `
          <tr>
            <td>${escapeHtml(r.name)}</td>
            <td>${fmt(r.R, "Ω")}</td>
            <td>${fmt(r.V, "V")}</td>
            <td>${fmt(r.I, "A")}</td>
            <td>${fmt(r.P, "W")}</td>
          </tr>`).join("");

        const branches = result.branchCurrents.length
          ? `<h4>Parallel branch currents</h4><ul>${
              result.branchCurrents.map(b =>
                `<li>${escapeHtml(b.name)}: ${fmt(b.I, "A")}</li>`
              ).join("")
            }</ul>`
          : "";

        $("fccDetails").innerHTML = `
          <h4>Individual resistor measurements</h4>
          <div class="fcc-table-wrap">
            <table class="fcc-table">
              <thead>
                <tr>
                  <th>Component</th><th>Resistance</th>
                  <th>Voltage</th><th>Current</th><th>Power</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>${branches}`;
      } catch (err) {
        $("fccError").textContent = err.message || "Please check your inputs.";
        $("fccReq").textContent = "—";
        $("fccCurrent").textContent = "—";
        $("fccPower").textContent = "—";
        $("fccVout").textContent = "—";
        $("fccExplanation").textContent =
          "Calculation could not be completed. Correct the inputs and try again.";
        $("fccDetails").innerHTML = "";
      }
    }

    editor.addEventListener("input", event => {
      const input = event.target.closest("[data-rid]");
      if (!input) return;

      const id = Number(input.dataset.rid);
      const list = input.dataset.group === "series"
        ? model.series
        : model.branches[Number(input.dataset.branch)];

      const item = list && list.find(r => r.id === id);
      if (item) item.value = input.value;
    });

    editor.addEventListener("click", event => {
      const button = event.target.closest("button");
      if (!button) return;

      saveCurrentValues();

      if (button.hasAttribute("data-add-branch-resistor")) {
        model.branches[Number(button.dataset.addBranchResistor)].push(makeResistor());
      } else if (button.hasAttribute("data-remove-branch")) {
        const i = Number(button.dataset.removeBranch);
        if (model.branches.length > 1) model.branches.splice(i, 1);
      } else if (button.hasAttribute("data-remove")) {
        const id = Number(button.dataset.remove);
        const list = button.dataset.group === "series"
          ? model.series
          : model.branches[Number(button.dataset.branch)];

        if (list) {
          const index = list.findIndex(r => r.id === id);
          if (index >= 0 && list.length > 1) list.splice(index, 1);
          else if (list.length === 1) list[0].value = "";
        }
      } else if (button.hasAttribute("data-add-branch")) {
        model.branches.push([makeResistor()]);
      } else {
        return;
      }

      renderEditor();
    });

    $("fccAddResistor").addEventListener("click", () => {
      saveCurrentValues();

      if (typeSelect.value === "parallel") {
        model.branches[0].push(makeResistor());
      } else {
        model.series.push(makeResistor());
      }

      renderEditor();
    });

    $("fccAddBranch").addEventListener("click", () => {
      saveCurrentValues();
      model.branches.push([makeResistor()]);
      renderEditor();
    });

    typeSelect.addEventListener("change", () => {
      saveCurrentValues();
      renderEditor();
      $("fccError").textContent = "";
    });

    $("fccCalculate").addEventListener("click", calculate);

    $("fccReset").addEventListener("click", () => {
      nextId = 1;
      model = {
        series: [makeResistor()],
        branches: [[makeResistor()], [makeResistor()]]
      };

      $("fccVoltage").value = "";
      $("fccError").textContent = "";
      $("fccReq").textContent = "—";
      $("fccCurrent").textContent = "—";
      $("fccPower").textContent = "—";
      $("fccVout").textContent = "—";
      $("fccExplanation").textContent =
        "Choose a circuit and enter your values, then click Calculate Circuit.";
      $("fccDetails").innerHTML = "";

      renderEditor();
    });

    renderEditor();
  } catch (error) {
    console.error("Fixed Circuit Calculator:", error);
    section.innerHTML =
      '<div class="container"><p style="color:#ff8e9c">Fixed Circuit Calculator could not load. Check that fixed-circuit-calculator.html exists in the repository root.</p></div>';
  }
})();
