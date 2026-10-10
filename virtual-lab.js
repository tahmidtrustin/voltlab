
/* =====================================================
   VOLTLAB VIRTUAL LAB
   Loads virtual-lab.html into the existing #virtual section
   ===================================================== */

(() => {
  "use strict";

  const container = document.getElementById("virtualLabContainer");
  if (!container) return;

  const htmlUrl = new URL("virtual-lab.html", document.baseURI);

  fetch(htmlUrl)
    .then(response => {
      if (!response.ok) {
        throw new Error("Could not load virtual-lab.html (" + response.status + ")");
      }
      return response.text();
    })
    .then(markup => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(markup, "text/html");

      // This file is a fragment, not a second full webpage.
      container.innerHTML = doc.body.innerHTML;

      initializeVirtualLab();
    })
    .catch(error => {
      console.error("VoltLab Virtual Lab:", error);
      container.innerHTML = `
        <div class="section-title">
          <h2>🧪 Virtual Electrical Lab</h2>
          <p>The lab could not load. Please check that virtual-lab.html
          is in the same repository folder as index.html.</p>
        </div>`;
    });

  function initializeVirtualLab() {
    const $ = id => document.getElementById(id);
    const box = $("vlabComponents");

    if (!box || box.dataset.initialized === "true") return;
    box.dataset.initialized = "true";

    let resistors = [];
    let nextId = 1;
    let switchClosed = true;

    const fmt = (number, unit = "") => {
      if (!Number.isFinite(number)) return "—";
      const result = Math.abs(number) >= 100000
        ? number.toExponential(3)
        : String(Number(number.toPrecision(5)));
      return result + (unit ? " " + unit : "");
    };

    function addResistor() {
      if (resistors.length >= 8) {
        $("vlabExplanation").textContent =
          "Maximum 8 resistors per experiment. Remove one before adding another.";
        return;
      }

      resistors.push({ id: nextId++, value: "" });
      renderControls();
      simulate();
    }

    function renderControls() {
      box.innerHTML = "";

      resistors.forEach((resistor, index) => {
        const card = document.createElement("div");
        card.className = "vlab-component";

        const head = document.createElement("div");
        head.className = "vlab-component-head";

        const title = document.createElement("strong");
        title.textContent = "RESISTOR R" + (index + 1);

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "vlab-remove";
        remove.textContent = "Remove";
        remove.setAttribute("aria-label", "Remove resistor R" + (index + 1));

        remove.addEventListener("click", () => {
          resistors = resistors.filter(item => item.id !== resistor.id);
          renderControls();
          simulate();
        });

        head.append(title, remove);

        const label = document.createElement("label");
        label.textContent = "Resistance (Ω)";
        label.style.display = "block";
        label.style.marginBottom = "6px";
        label.style.fontSize = "12px";
        label.style.color = "#91a5c5";

        const input = document.createElement("input");
        input.type = "number";
        input.min = "0.01";
        input.max = "100000000";
        input.step = "any";
        input.placeholder = "Enter Ω";
        input.value = resistor.value;
        input.setAttribute("aria-label", "Resistance of R" + (index + 1));

        input.addEventListener("input", () => {
          resistor.value = input.value;
          simulate();
        });

        card.append(head, label, input);
        box.appendChild(card);
      });
    }

    function drawCircuit(valid) {
      const row = $("vlabCircuitRow");
      row.innerHTML = "";
      row.classList.toggle("open", !switchClosed);

      function terminal(text) {
        const element = document.createElement("div");
        element.className = "vlab-terminal";
        element.textContent = text;
        return element;
      }

      function wire() {
        const element = document.createElement("div");
        element.className = "vlab-wire";
        return element;
      }

      function part(text, extra = "") {
        const element = document.createElement("div");
        element.className = "vlab-part " + extra;
        element.textContent = text;
        return element;
      }

      row.append(terminal("+"), wire(), part("SOURCE"));

      if (!resistors.length) {
        row.append(wire(), part("ADD R"));
      } else {
        resistors.forEach((resistor, index) => {
          const value = Number(resistor.value);
          const entered = resistor.value.trim() !== "";
          const validValue = entered && Number.isFinite(value) && value > 0;

          row.append(
            wire(),
            part(
              "R" + (index + 1) + " " + (validValue ? fmt(value, "Ω") : "—")
            )
          );
        });
      }

      row.append(wire(), part("LOAD", "lamp"), wire(), terminal("−"));

      const mode = $("vlabTopology").value.toUpperCase();
      $("vlabBoardLabel").textContent =
        (!switchClosed ? "SWITCH OPEN / NO CURRENT" :
          mode + " / " + (valid ? "SIMULATING" : "CHECK INPUTS"));
    }

    function simulate() {
      const voltageText = $("vlabVoltage").value.trim();
      const voltage = Number(voltageText);
      const mode = $("vlabTopology").value;

      const voltageValid =
        voltageText !== "" &&
        Number.isFinite(voltage) &&
        voltage >= 0 &&
        voltage <= 10000;

      const values = resistors.map(resistor => ({
        text: resistor.value.trim(),
        value: Number(resistor.value)
      }));

      const valuesValid =
        values.length > 0 &&
        values.every(item =>
          item.text !== "" &&
          Number.isFinite(item.value) &&
          item.value > 0 &&
          item.value <= 100000000
        );

      let equivalent = NaN;
      let current = NaN;
      let power = NaN;

      if (voltageValid && valuesValid) {
        if (mode === "series") {
          equivalent = values.reduce((sum, item) => sum + item.value, 0);
        } else {
          equivalent = 1 / values.reduce(
            (sum, item) => sum + 1 / item.value, 0
          );
        }

        if (Number.isFinite(equivalent) && equivalent > 0) {
          current = switchClosed ? voltage / equivalent : 0;
          power = switchClosed ? voltage * current : 0;
        }
      }

      const valid =
        voltageValid &&
        valuesValid &&
        Number.isFinite(equivalent) &&
        Number.isFinite(current) &&
        Number.isFinite(power);

      $("vlabReq").textContent = valid ? fmt(equivalent, "Ω") : "—";
      $("vlabCurrent").textContent = valid ? fmt(current, "A") : "—";
      $("vlabPower").textContent = valid ? fmt(power, "W") : "—";
      $("vlabVout").textContent = voltageValid ? fmt(voltage, "V") : "—";

      const status = $("vlabStatus");
      status.classList.toggle("off", !switchClosed || !valid);

      if (!switchClosed) {
        status.textContent =
          "● SWITCH OPEN — the circuit is interrupted; current is zero.";
      } else if (!voltageValid) {
        status.textContent =
          "● WAITING — enter a supply voltage between 0 and 10,000 V.";
      } else if (!resistors.length) {
        status.textContent = "● WAITING — add at least one resistor.";
      } else if (!valuesValid) {
        status.textContent =
          "● CHECK COMPONENTS — every resistor needs a positive resistance.";
      } else if (!valid) {
        status.textContent = "● CHECK INPUTS — unable to calculate these values.";
      } else if (voltage === 0) {
        status.textContent =
          "● CIRCUIT READY — at 0 V, current and power are zero.";
      } else {
        status.textContent =
          "● CIRCUIT COMPLETE — ideal-source resistor calculation.";
      }

      const lampOn = valid && switchClosed && voltage > 0 && current > 0;
      $("vlabLamp").classList.toggle("lit", lampOn);
      $("vlabLampText").textContent = lampOn ? "Load: ON" : "Load: OFF";

      if (!voltageValid || !valuesValid) {
        $("vlabExplanation").textContent =
          "Enter a valid supply voltage and a positive resistance for every resistor. Results will appear when the inputs are valid.";
      } else if (!switchClosed) {
        $("vlabExplanation").textContent =
          "The switch is open. In this ideal model, current and delivered power are zero. The resistor network's equivalent resistance is still calculated.";
      } else if (mode === "series") {
        $("vlabExplanation").textContent =
          "Series circuit: Req = R1 + R2 + ... . The same current flows through every resistor. Total current I = V / Req, and total power P = V × I.";
      } else {
        $("vlabExplanation").textContent =
          "Parallel circuit: 1 / Req = 1 / R1 + 1 / R2 + ... . Each ideal branch has the supply voltage across it. Total current I = V / Req, and total power P = V × I.";
      }

      drawCircuit(valid);
    }

    $("vlabAddBtn").addEventListener("click", addResistor);

    $("vlabSwitchBtn").addEventListener("click", () => {
      switchClosed = !switchClosed;
      $("vlabSwitchBtn").textContent =
        "SWITCH: " + (switchClosed ? "CLOSED" : "OPEN");
      $("vlabSwitchBtn").classList.toggle("active", switchClosed);
      simulate();
    });

    $("vlabResetBtn").addEventListener("click", () => {
      resistors = [];
      nextId = 1;
      switchClosed = true;
      $("vlabVoltage").value = "";
      $("vlabTopology").value = "series";
      $("vlabSwitchBtn").textContent = "SWITCH: CLOSED";
      $("vlabSwitchBtn").classList.add("active");
      renderControls();
      simulate();
    });

    $("vlabVoltage").addEventListener("input", simulate);
    $("vlabTopology").addEventListener("change", simulate);

    renderControls();
    simulate();
  }
})();

