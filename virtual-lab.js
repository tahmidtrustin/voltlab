
/* =========================================================
   VOLTLAB VIRTUAL LAB — INTERACTIVE CIRCUIT ENGINE
   Drag/drop • Wiring • Multiple sources • DC measurements
   ========================================================= */

(() => {
  "use strict";

  const container = document.getElementById("virtualLabContainer");
  if (!container) return;

  const htmlUrl = new URL("virtual-lab.html", document.baseURI);

  fetch(htmlUrl)
    .then(response => {
      if (!response.ok) {
        throw new Error("Unable to load virtual-lab.html: " + response.status);
      }
      return response.text();
    })
    .then(markup => {
      const doc = new DOMParser().parseFromString(markup, "text/html");
      container.innerHTML = doc.body.innerHTML;
      initLab();
    })
    .catch(error => {
      console.error("VoltLab:", error);
      container.innerHTML =
        '<div class="vlab-status error">Virtual Lab could not load. Check the file names and GitHub Pages paths.</div>';
    });

  function initLab() {
    const $ = id => document.getElementById(id);
    const svg = $("vlabBoard");
    if (!svg || svg.dataset.initialized === "true") return;
    svg.dataset.initialized = "true";

    const NS = "http://www.w3.org/2000/svg";
    const wireLayer = $("vlabWireLayer");
    const componentLayer = $("vlabComponentLayer");
    const previewLayer = $("vlabPreviewLayer");

    let components = [];
    let wires = [];
    let nextId = 1;
    let selectedPin = null;
    let selectedWire = null;
    let powered = false;
    let running = false;
    let lastResults = null;
    let dragState = null;

    const defaults = {
      battery: { value: 12, label: "Battery", unit: "V" },
      resistor: { value: 100, label: "Resistor", unit: "Ω" },
      bulb: { value: 24, label: "Bulb / Load", unit: "Ω" },
      switch: { value: 0, label: "Switch", unit: "" },
      ammeter: { value: 0, label: "Ammeter", unit: "A" },
      voltmeter: { value: 0, label: "Voltmeter", unit: "V" }
    };

    const fmt = (n, unit = "") => {
      if (!Number.isFinite(n)) return "—";
      const a = Math.abs(n);
      const s = a !== 0 && (a >= 1e6 || a < 0.001)
        ? n.toExponential(3)
        : String(Number(n.toPrecision(5)));
      return s + (unit ? " " + unit : "");
    };

    const componentById = id => components.find(c => c.id === id);
    const pinKey = (id, pin) => id + ":" + pin;

    function el(name, attrs = {}) {
      const node = document.createElementNS(NS, name);
      Object.entries(attrs).forEach(([key, value]) => {
        node.setAttribute(key, String(value));
      });
      return node;
    }

    function textNode(x, y, text, cls) {
      const node = el("text", { x, y, class: cls });
      node.textContent = text;
      return node;
    }

    function setStatus(message, kind = "") {
      const node = $("vlabStatus");
      node.textContent = message;
      node.className = "vlab-status" + (kind ? " " + kind : "");
    }

    function setBoardState(message) {
      $("vlabBoardState").textContent = message;
    }

    function pinPosition(c, pin) {
      return {
        x: c.x + (pin === "a" ? -43 : 43),
        y: c.y
      };
    }

    function boardPoint(event) {
      const point = svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      const matrix = svg.getScreenCTM();
      if (!matrix) return { x: 500, y: 300 };
      const p = point.matrixTransform(matrix.inverse());
      return { x: p.x, y: p.y };
    }

    function addComponent(type, x, y) {
      const d = defaults[type];
      if (!d) return;

      const c = {
        id: nextId++,
        type,
        label: d.label,
        value: d.value,
        x: Math.max(55, Math.min(945, x)),
        y: Math.max(60, Math.min(540, y)),
        closed: true
      };

      components.push(c);
      renderAll();
      setStatus(c.label + " added. Connect its terminals to build the circuit.");
      calculateIfRunning();
    }

    function componentText(c) {
      if (c.type === "battery") return fmt(c.value, "V");
      if (c.type === "resistor" || c.type === "bulb") {
        return fmt(c.value, "Ω");
      }
      if (c.type === "switch") return c.closed ? "CLOSED" : "OPEN";
      if (c.type === "ammeter") return "A";
      return "V";
    }

    function drawSymbol(group, c) {
      const line = (x1, y1, x2, y2) =>
        group.appendChild(el("line", {
          x1, y1, x2, y2, class: "component-symbol"
        }));

      if (c.type === "battery") {
        line(-43, 0, -12, 0);
        line(12, 0, 43, 0);
        line(-7, -16, -7, 16);
        line(5, -10, 5, 10);
        group.appendChild(textNode(-7, -22, "+", "component-value"));
        group.appendChild(textNode(5, 23, "−", "component-value"));
      } else if (c.type === "resistor") {
        line(-43, 0, -24, 0);
        line(24, 0, 43, 0);
        group.appendChild(el("path", {
          d: "M -24 0 L -17 -10 L -7 10 L 3 -10 L 13 10 L 24 0",
          class: "component-symbol"
        }));
      } else if (c.type === "bulb") {
        line(-43, 0, -22, 0);
        line(22, 0, 43, 0);
        group.appendChild(el("circle", {
          cx: 0, cy: 0, r: 21,
          fill: powered ? "#854d0e" : "#111d34",
          stroke: powered ? "#fde047" : "#8b5cf6",
          "stroke-width": 2
        }));
        line(-10, -10, 10, 10);
        line(-10, 10, 10, -10);
      } else if (c.type === "switch") {
        line(-43, 0, -12, 0);
        line(12, 0, 43, 0);
        group.appendChild(el("circle", {
          cx: -12, cy: 0, r: 3, fill: "#21d4fd"
        }));
        group.appendChild(el("circle", {
          cx: 12, cy: 0, r: 3, fill: "#21d4fd"
        }));
        line(-12, 0, c.closed ? 12 : 0, c.closed ? 0 : -18);
      } else {
        line(-43, 0, -23, 0);
        line(23, 0, 43, 0);
        group.appendChild(el("circle", {
          cx: 0, cy: 0, r: 22,
          fill: "#09162c",
          stroke: c.type === "ammeter" ? "#22c55e" : "#3b82f6",
          "stroke-width": 2
        }));
        group.appendChild(textNode(0, 5, c.type === "ammeter" ? "A" : "V", "component-label"));
      }
    }

    function drawComponent(c) {
      const g = el("g", {
        class: "vlab-component-group" +
          (c.id === selectedComponentId ? " selected" : ""),
        transform: `translate(${c.x} ${c.y})`,
        "data-id": c.id
      });

      const body = el("rect", {
        x: -34, y: -37, width: 68, height: 74, rx: 10,
        class: "component-body"
      });
      g.appendChild(body);
      drawSymbol(g, c);
      g.appendChild(textNode(0, -47, c.label, "component-label"));
      g.appendChild(textNode(0, 54, componentText(c), "component-value"));

      ["a", "b"].forEach(pin => {
        const p = pinPosition(c, pin);
        const circle = el("circle", {
          cx: p.x - c.x, cy: p.y - c.y, r: 6,
          class: "vlab-pin" +
            (selectedPin &&
             selectedPin.id === c.id &&
             selectedPin.pin === pin ? " pending" : ""),
          "data-id": c.id,
          "data-pin": pin
        });
        circle.addEventListener("click", event => {
          event.stopPropagation();
          handlePinClick(c.id, pin);
        });
        g.appendChild(circle);
      });

      g.addEventListener("pointerdown", event => {
        if (event.target.classList.contains("vlab-pin")) return;
        if (event.button !== 0) return;

        const p = boardPoint(event);
        selectedComponentId = c.id;
        dragState = {
          id: c.id,
          dx: c.x - p.x,
          dy: c.y - p.y,
          moved: false
        };
        try { svg.setPointerCapture(event.pointerId); } catch (_) {}
        renderEditor();
        renderComponents();
      });

      componentLayer.appendChild(g);
    }

    let selectedComponentId = null;

    function renderWires() {
      wireLayer.replaceChildren();

      wires.forEach((w, index) => {
        const a = componentById(w.a.id);
        const b = componentById(w.b.id);
        if (!a || !b) return;

        const p1 = pinPosition(a, w.a.pin);
        const p2 = pinPosition(b, w.b.pin);
        const mid = (p1.x + p2.x) / 2;

        const path = el("path", {
          d: `M ${p1.x} ${p1.y} L ${mid} ${p1.y} L ${mid} ${p2.y} L ${p2.x} ${p2.y}`,
          class: "vlab-wire-line" +
            (powered && running ? " powered" : "") +
            (selectedWire === w.id ? " selected" : ""),
          "data-wire-id": w.id
        });

        path.addEventListener("click", event => {
          event.stopPropagation();
          selectedWire = w.id;
          renderWires();
          setStatus("Wire selected. Use Delete last wire to remove the latest wire.");
        });

        wireLayer.appendChild(path);
      });
    }

    function renderComponents() {
      componentLayer.replaceChildren();
      components.forEach(drawComponent);
    }

    function renderAll() {
      renderWires();
      renderComponents();
      renderEditor();
    }

    function renderEditor() {
      const host = $("vlabComponentEditor");
      host.replaceChildren();

      if (!components.length) {
        const empty = document.createElement("div");
        empty.className = "vlab-empty";
        empty.textContent = "No components yet. Add one from the Component Kit.";
        host.appendChild(empty);
        return;
      }

      components.forEach(c => {
        const card = document.createElement("div");
        card.className = "vlab-editor-item";

        const head = document.createElement("div");
        head.className = "vlab-editor-head";

        const title = document.createElement("strong");
        title.textContent = c.label + " #" + c.id;

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "vlab-remove";
        remove.textContent = "Remove";
        remove.addEventListener("click", () => removeComponent(c.id));

        head.append(title, remove);
        card.appendChild(head);

        const labelLabel = document.createElement("label");
        labelLabel.textContent = "Component name";
        const labelInput = document.createElement("input");
        labelInput.value = c.label;
        labelInput.maxLength = 32;
        labelInput.addEventListener("change", () => {
          c.label = labelInput.value.trim() || defaults[c.type].label;
          renderAll();
        });
        card.append(labelLabel, labelInput);

        if (["battery", "resistor", "bulb"].includes(c.type)) {
          const valueLabel = document.createElement("label");
          valueLabel.textContent =
            c.type === "battery" ? "Voltage (V)" : "Resistance (Ω)";

          const valueInput = document.createElement("input");
          valueInput.type = "number";
          valueInput.min = "0.000001";
          valueInput.step = "any";
          valueInput.placeholder =
            c.type === "battery" ? "Enter volts" : "Enter ohms";
          valueInput.value = c.value;
          valueInput.addEventListener("input", () => {
            c.value = valueInput.value === "" ? "" : Number(valueInput.value);
            renderComponents();
            calculateIfRunning();
          });

          card.append(valueLabel, valueInput);
        }

        if (c.type === "switch") {
          const switchButton = document.createElement("button");
          switchButton.type = "button";
          switchButton.className = "vlab-btn";
          switchButton.textContent = c.closed ? "Switch: CLOSED" : "Switch: OPEN";
          switchButton.addEventListener("click", () => {
            c.closed = !c.closed;
            renderAll();
            calculateIfRunning();
          });
          card.appendChild(switchButton);
        }

        const actions = document.createElement("div");
        actions.className = "vlab-editor-actions";

        const select = document.createElement("button");
        select.type = "button";
        select.className = "vlab-btn small";
        select.textContent = "Select on board";
        select.addEventListener("click", () => {
          selectedComponentId = c.id;
          renderComponents();
          setStatus("Selected " + c.label + ". Drag it on the board to reposition.");
        });

        actions.appendChild(select);
        card.appendChild(actions);
        host.appendChild(card);
      });
    }

    function removeComponent(id) {
      components = components.filter(c => c.id !== id);
      wires = wires.filter(w => w.a.id !== id && w.b.id !== id);
      if (selectedComponentId === id) selectedComponentId = null;
      if (selectedPin && selectedPin.id === id) selectedPin = null;
      renderAll();
      calculateIfRunning();
      setStatus("Component removed.");
    }

    function handlePinClick(id, pin) {
      if (!selectedPin) {
        selectedPin = { id, pin };
        renderComponents();
        setStatus("Terminal selected. Click another component terminal to connect a wire.");
        return;
      }

      if (selectedPin.id === id && selectedPin.pin === pin) {
        selectedPin = null;
        renderComponents();
        setStatus("Terminal selection cancelled.");
        return;
      }

      const exists = wires.some(w =>
        (w.a.id === selectedPin.id && w.a.pin === selectedPin.pin &&
         w.b.id === id && w.b.pin === pin) ||
        (w.b.id === selectedPin.id && w.b.pin === selectedPin.pin &&
         w.a.id === id && w.a.pin === pin)
      );

      if (exists) {
        selectedPin = null;
        renderComponents();
        setStatus("Those terminals are already connected.");
        return;
      }

      wires.push({
        id: nextId++,
        a: { ...selectedPin },
        b: { id, pin }
      });

      selectedPin = null;
      selectedWire = null;
      renderAll();
      calculateIfRunning();
      setStatus("Wire connected. Continue wiring or run the experiment.", "success");
    }

    function unionFind() {
      const parent = new Map();
      const find = x => {
        if (!parent.has(x)) parent.set(x, x);
        let p = parent.get(x);
        while (p !== parent.get(p)) p = parent.get(p);
        let cur = x;
        while (parent.get(cur) !== p) {
          const next = parent.get(cur);
          parent.set(cur, p);
          cur = next;
        }
        return p;
      };
      const union = (a, b) => {
        const x = find(a), y = find(b);
        if (x !== y) parent.set(y, x);
      };
      return { parent, find, union };
    }

    function gaussian(A, b) {
      const n = b.length;
      const M = A.map((row, i) => row.slice().concat(b[i]));

      for (let col = 0; col < n; col++) {
        let pivot = col;
        for (let r = col + 1; r < n; r++) {
          if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
        }

        if (Math.abs(M[pivot][col]) < 1e-12) {
          throw new Error("Circuit is disconnected, floating, or has conflicting ideal sources.");
        }

        [M[col], M[pivot]] = [M[pivot], M[col]];

        const div = M[col][col];
        for (let j = col; j <= n; j++) M[col][j] /= div;

        for (let r = 0; r < n; r++) {
          if (r === col) continue;
          const factor = M[r][col];
          if (!factor) continue;
          for (let j = col; j <= n; j++) {
            M[r][j] -= factor * M[col][j];
          }
        }
      }

      return M.map(row => row[n]);
    }

    function solveCircuit() {
      const active = components.filter(c =>
        ["battery", "resistor", "bulb", "switch", "ammeter"].includes(c.type)
      );

      if (!active.some(c => c.type === "battery")) {
        throw new Error("Add at least one battery to supply the circuit.");
      }
      if (!active.some(c => ["resistor", "bulb"].includes(c.type))) {
        throw new Error("Add at least one resistor or load.");
      }

      for (const c of active) {
        if (c.type === "battery" &&
            !(Number.isFinite(Number(c.value)) && Number(c.value) > 0)) {
          throw new Error("Every battery needs a positive voltage.");
        }
        if (["resistor", "bulb"].includes(c.type) &&
            !(Number.isFinite(Number(c.value)) && Number(c.value) > 0)) {
          throw new Error("Every resistor/load needs a positive resistance.");
        }
      }

      const uf = unionFind();

      components.forEach(c => {
        uf.find(pinKey(c.id, "a"));
        uf.find(pinKey(c.id, "b"));
      });

      wires.forEach(w => {
        uf.union(pinKey(w.a.id, w.a.pin), pinKey(w.b.id, w.b.pin));
      });

      const roots = new Set();
      active.forEach(c => {
        roots.add(uf.find(pinKey(c.id, "a")));
        roots.add(uf.find(pinKey(c.id, "b")));
      });

      const nodes = [...roots];
      if (nodes.length < 2) {
        throw new Error("Connect the battery, loads and return path with wires.");
      }

      const ground = nodes[0];
      const nodeIndex = new Map();
      let next = 0;
      nodes.forEach(root => {
        if (root !== ground) nodeIndex.set(root, next++);
      });

      const vSources = active.filter(c => c.type === "battery");
      const N = nodes.length - 1;
      const M = vSources.length;
      const size = N + M;

      if (size < 1) throw new Error("Connect a complete circuit first.");

      const A = Array.from({ length: size }, () => Array(size).fill(0));
      const z = Array(size).fill(0);

      function stampConductance(rootA, rootB, g) {
        const a = rootA === ground ? -1 : nodeIndex.get(rootA);
        const b = rootB === ground ? -1 : nodeIndex.get(rootB);

        if (a >= 0) A[a][a] += g;
        if (b >= 0) A[b][b] += g;
        if (a >= 0 && b >= 0) {
          A[a][b] -= g;
          A[b][a] -= g;
        }
      }

      active.forEach(c => {
        const ra = uf.find(pinKey(c.id, "a"));
        const rb = uf.find(pinKey(c.id, "b"));
        if (ra === rb) {
          if (c.type === "battery" && Number(c.value) !== 0) {
            throw new Error("A battery is short-circuited. Check its terminals.");
          }
          return;
        }

        if (c.type === "resistor" || c.type === "bulb") {
          stampConductance(ra, rb, 1 / Number(c.value));
        } else if (c.type === "ammeter") {
          // Ideal ammeter approximation with a very small series resistance.
          stampConductance(ra, rb, 1e6);
        } else if (c.type === "switch" && c.closed) {
          stampConductance(ra, rb, 1e6);
        }
      });

      vSources.forEach((c, i) => {
        const ra = uf.find(pinKey(c.id, "a"));
        const rb = uf.find(pinKey(c.id, "b"));
        const row = N + i;
        const a = ra === ground ? -1 : nodeIndex.get(ra);
        const b = rb === ground ? -1 : nodeIndex.get(rb);

        if (a >= 0) {
          A[a][row] += 1;
          A[row][a] += 1;
        }
        if (b >= 0) {
          A[b][row] -= 1;
          A[row][b] -= 1;
        }

        // Battery positive terminal is pin "a".
        z[row] = Number(c.value);
      });

      const solution = gaussian(A, z);

      function voltageAtRoot(root) {
        if (root === ground) return 0;
        const idx = nodeIndex.get(root);
        return idx === undefined ? NaN : solution[idx];
      }

      const results = {
        uf,
        voltageAtRoot,
        batteries: [],
        parts: [],
        meters: [],
        totalSourceCurrent: 0,
        sourcePower: 0,
        loadPower: 0
      };

      vSources.forEach((c, i) => {
        const current = solution[N + i];
        const va = voltageAtRoot(uf.find(pinKey(c.id, "a")));
        const vb = voltageAtRoot(uf.find(pinKey(c.id, "b")));
        results.batteries.push({ id: c.id, current, va, vb });
        results.totalSourceCurrent += Math.abs(current);
        results.sourcePower += Number(c.value) * current;
      });

      active.forEach(c => {
        const ra = uf.find(pinKey(c.id, "a"));
        const rb = uf.find(pinKey(c.id, "b"));
        const va = voltageAtRoot(ra);
        const vb = voltageAtRoot(rb);
        const voltage = va - vb;
        let current = 0;
        let resistance = null;

        if (c.type === "resistor" || c.type === "bulb") {
          resistance = Number(c.value);
          current = voltage / resistance;
          results.loadPower += voltage * current;
        } else if (c.type === "ammeter") {
          current = voltage * 1e6;
        } else if (c.type === "switch" && c.closed) {
          current = voltage * 1e6;
        }

        results.parts.push({
          id: c.id, type: c.type, voltage, current, resistance,
          power: voltage * current
        });
      });

      components.filter(c => c.type === "voltmeter" || c.type === "ammeter")
        .forEach(c => {
          const ra = uf.find(pinKey(c.id, "a"));
          const rb = uf.find(pinKey(c.id, "b"));
          const va = voltageAtRoot(ra);
          const vb = voltageAtRoot(rb);
          const difference = va - vb;

          if (c.type === "voltmeter") {
            results.meters.push({
              id: c.id, label: c.label, type: "Voltage",
              value: difference, unit: "V"
            });
          } else {
            const measured = results.parts.find(p => p.id === c.id);
            results.meters.push({
              id: c.id, label: c.label, type: "Current",
              value: measured ? measured.current : 0, unit: "A"
            });
          }
        });

      return results;
    }

    function showReadings(results) {
      const meterHost = $("vlabMeterReadings");
      meterHost.replaceChildren();

      if (!results.meters.length) {
        const p = document.createElement("p");
        p.textContent = "Add an ammeter or voltmeter and connect both terminals.";
        meterHost.appendChild(p);
      } else {
        results.meters.forEach(m => {
          const row = document.createElement("div");
          row.className = "vlab-reading";
          const label = document.createElement("span");
          label.textContent = m.label + " — " + m.type;
          const value = document.createElement("strong");
          value.textContent = fmt(m.value, m.unit);
          row.append(label, value);
          meterHost.appendChild(row);
        });
      }

      const partHost = $("vlabPartReadings");
      partHost.replaceChildren();

      results.parts.forEach(p => {
        const c = componentById(p.id);
        if (!c) return;
        const row = document.createElement("div");
        row.className = "vlab-reading";

        const label = document.createElement("span");
        label.textContent = c.label + " #" + c.id;

        const value = document.createElement("strong");
        value.textContent =
          "V " + fmt(p.voltage, "V") +
          " · I " + fmt(p.current, "A") +
          " · P " + fmt(p.power, "W");

        row.append(label, value);
        partHost.appendChild(row);
      });

      $("vlabVoltageReadout").textContent =
        results.batteries.length
          ? fmt(results.batteries[0].vb - results.batteries[0].va, "V")
          : "—";

      $("vlabCurrentReadout").textContent =
        fmt(results.totalSourceCurrent, "A");
      $("vlabPowerReadout").textContent =
        fmt(results.sourcePower, "W");
      $("vlabLoadPowerReadout").textContent =
        fmt(results.loadPower, "W");

      $("vlabExplanation").replaceChildren();
      const heading = document.createElement("strong");
      heading.textContent = "Experiment results";
      const p = document.createElement("p");
      p.textContent =
        "DC network solution completed. Readings are based on the connected circuit topology, ideal voltage sources and resistive components. Ammeter and closed-switch resistance use a small numerical approximation.";
      $("vlabExplanation").append(heading, p);
    }

    function calculateIfRunning() {
      if (!running) return;
      if (!powered) {
        setStatus("Power is OFF. Turn on power before running the experiment.");
        return;
      }

      try {
        lastResults = solveCircuit();
        showReadings(lastResults);
        setStatus("Experiment running — circuit measurements updated.", "success");
        setBoardState("SIMULATION RUNNING");
      } catch (error) {
        lastResults = null;
        setStatus(error.message, "error");
        setBoardState("CHECK CONNECTIONS");
      }
    }

    // Component kit: click to add.
    document.querySelectorAll("#virtual .vlab-kit-item").forEach(button => {
      button.addEventListener("click", () => {
        const rect = svg.getBoundingClientRect();
        addComponent(
          button.dataset.add,
          160 + Math.random() * 680,
          100 + Math.random() * 390
        );
      });

      button.addEventListener("dragstart", event => {
        event.dataTransfer.setData("text/plain", button.dataset.add);
        event.dataTransfer.effectAllowed = "copy";
      });
    });

    // HTML drag-and-drop from kit onto SVG.
    svg.addEventListener("dragover", event => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    });

    svg.addEventListener("drop", event => {
      event.preventDefault();
      const type = event.dataTransfer.getData("text/plain");
      if (!defaults[type]) return;
      const p = boardPoint(event);
      addComponent(type, p.x, p.y);
    });

    // Move components with pointer/touch.
    svg.addEventListener("pointermove", event => {
      if (!dragState) return;
      const p = boardPoint(event);
      const c = componentById(dragState.id);
      if (!c) return;

      c.x = Math.max(55, Math.min(945, p.x + dragState.dx));
      c.y = Math.max(60, Math.min(540, p.y + dragState.dy));
      dragState.moved = true;
      renderWires();
      renderComponents();
    });

    function endDrag() {
      if (!dragState) return;
      dragState = null;
      renderAll();
      calculateIfRunning();
    }

    svg.addEventListener("pointerup", endDrag);
    svg.addEventListener("pointercancel", endDrag);

    $("vlabPowerBtn").addEventListener("click", () => {
      powered = !powered;
      $("vlabPowerBtn").textContent =
        powered ? "⏻ Power ON" : "⏻ Power OFF";
      $("vlabPowerBtn").classList.toggle("primary", powered);

      if (!powered) {
        running = false;
        lastResults = null;
        $("vlabRunBtn").textContent = "▶ Run experiment";
        $("vlabVoltageReadout").textContent = "—";
        $("vlabCurrentReadout").textContent = "—";
        $("vlabPowerReadout").textContent = "—";
        $("vlabLoadPowerReadout").textContent = "—";
        $("vlabMeterReadings").innerHTML =
          "<p>Power is off. Turn it on and run the experiment.</p>";
        $("vlabPartReadings").innerHTML =
          "<p>Power is off. Measurements are paused.</p>";
        setStatus("Power OFF — measurements stopped.");
        setBoardState("POWER OFF");
        renderWires();
      } else {
        setStatus("Power ON — press Run experiment to calculate the circuit.");
        setBoardState("POWER ON");
      }
    });

    $("vlabRunBtn").addEventListener("click", () => {
      if (!powered) {
        setStatus("Turn power ON before running the experiment.", "error");
        return;
      }
      running = true;
      $("vlabRunBtn").textContent = "▶ Running";
      calculateIfRunning();
    });

    $("vlabStopBtn").addEventListener("click", () => {
      running = false;
      $("vlabRunBtn").textContent = "▶ Run experiment";
      setStatus("Experiment stopped. Circuit layout and component values are preserved.");
      setBoardState(powered ? "POWER ON / STOPPED" : "POWER OFF");
    });

    $("vlabResetBtn").addEventListener("click", () => {
      components = [];
      wires = [];
      nextId = 1;
      selectedPin = null;
      selectedWire = null;
      selectedComponentId = null;
      powered = false;
      running = false;
      lastResults = null;
      $("vlabPowerBtn").textContent = "⏻ Power OFF";
      $("vlabPowerBtn").classList.remove("primary");
      $("vlabRunBtn").textContent = "▶ Run experiment";
      $("vlabSupply").value = "";
      $("vlabVoltageReadout").textContent = "—";
      $("vlabCurrentReadout").textContent = "—";
      $("vlabPowerReadout").textContent = "—";
      $("vlabLoadPowerReadout").textContent = "—";
      $("vlabMeterReadings").innerHTML = "<p>No ammeter or voltmeter readings yet.</p>";
      $("vlabPartReadings").innerHTML = "<p>Run a connected circuit to see component readings.</p>";
      renderAll();
      setStatus("Board reset. Add components to start a new experiment.");
      setBoardState("BOARD READY");
    });

    $("vlabDeleteWireBtn").addEventListener("click", () => {
      let index = selectedWire
        ? wires.findIndex(w => w.id === selectedWire)
        : wires.length - 1;

      if (index < 0 || index >= wires.length) {
        setStatus("There are no wires to remove.");
        return;
      }

      wires.splice(index, 1);
      selectedWire = null;
      selectedPin = null;
      renderAll();
      calculateIfRunning();
      setStatus("Wire removed.");
    });

    $("vlabCancelWireBtn").addEventListener("click", () => {
      selectedPin = null;
      renderComponents();
      previewLayer.replaceChildren();
      setStatus("Unfinished wire cancelled.");
    });

    $("vlabSupply").addEventListener("change", () => {
      const value = Number($("vlabSupply").value);
      if (!Number.isFinite(value) || value <= 0) {
        setStatus("Enter a positive default battery voltage.", "error");
        return;
      }
      setStatus("Default battery voltage set to " + fmt(value, "V") +
        ". New batteries use this value; existing batteries are unchanged.");
      Object.assign(defaults.battery, { value });
    });

    // Escape cancels an unfinished connection.
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && selectedPin) {
        selectedPin = null;
        renderComponents();
        setStatus("Wire selection cancelled.");
      }
    });

    renderAll();
    setStatus("READY — drag or click a component to add it to the board.");
  }
})();
