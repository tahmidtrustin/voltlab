/* =========================================================
   VOLTLAB — STEP 7
   CIRCUIT DETECTIVE
   Self-contained module
   ========================================================= */

(function () {
    "use strict";

    /* ---------------------------------------------------------
       1. STEP 7 HTML + STYLE
       --------------------------------------------------------- */

    const detectiveHTML = `
    <style id="voltlab-step7-style">

        .vl7-section {
            padding: 95px 0;
            background: linear-gradient(
                180deg,
                transparent,
                rgba(33,212,253,.025),
                transparent
            );
        }

        .vl7-wrapper {
            max-width: 1200px;
            margin: auto;
            padding: 0 25px;
        }

        .vl7-panel {
            background:
                linear-gradient(
                    145deg,
                    rgba(16,28,54,.88),
                    rgba(8,16,32,.94)
                );
            border: 1px solid #1d3157;
            border-radius: 18px;
            padding: 30px;
            box-shadow: 0 0 25px rgba(33,212,253,.12);
        }

        .vl7-header {
            text-align: center;
            margin-bottom: 45px;
        }

        .vl7-header h2 {
            font-size: 38px;
            margin-bottom: 10px;
        }

        .vl7-header p {
            color: #91a5c5;
        }

        .vl7-layout {
            display: grid;
            grid-template-columns: 1.15fr .85fr;
            gap: 25px;
        }

        .vl7-case-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 15px;
            margin-bottom: 22px;
            flex-wrap: wrap;
        }

        .vl7-case-number {
            color: #21d4fd;
            font-size: 13px;
            font-weight: bold;
            letter-spacing: 1px;
        }

        .vl7-score {
            padding: 7px 14px;
            border-radius: 30px;
            border: 1px solid rgba(33,212,253,.35);
            color: #21d4fd;
            background: rgba(33,212,253,.06);
            font-size: 13px;
            font-weight: bold;
        }

        .vl7-question {
            font-size: 24px;
            margin-bottom: 8px;
        }

        .vl7-description {
            color: #91a5c5;
            font-size: 14px;
            margin-bottom: 25px;
        }

        .vl7-circuit {
            position: relative;
            min-height: 245px;
            border: 1px solid #1b3154;
            border-radius: 16px;
            background:
                radial-gradient(
                    circle at center,
                    rgba(33,212,253,.06),
                    transparent 58%
                ),
                #030914;
            overflow: hidden;
            margin-bottom: 25px;
        }

        .vl7-wire {
            position: absolute;
            background: #29466e;
        }

        .vl7-wire.active {
            background: #21d4fd;
            box-shadow: 0 0 9px rgba(33,212,253,.65);
        }

        .vl7-battery {
            position: absolute;
            left: 10%;
            top: 92px;
            width: 48px;
            height: 65px;
            border: 3px solid #21d4fd;
            border-radius: 6px;
            box-shadow: 0 0 18px rgba(33,212,253,.25);
        }

        .vl7-battery:before {
            content: "+";
            position: absolute;
            top: -29px;
            left: 16px;
            color: #21d4fd;
            font-size: 20px;
            font-weight: bold;
        }

        .vl7-battery:after {
            content: "12V";
            position: absolute;
            left: 4px;
            bottom: -27px;
            color: #21d4fd;
            font-size: 11px;
        }

        .vl7-resistor {
            position: absolute;
            right: 16%;
            top: 105px;
            width: 78px;
            height: 38px;
            border: 3px solid #f59e0b;
            transform: skew(-15deg);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #f59e0b;
            font-size: 11px;
            font-weight: bold;
            background: #081126;
        }

        .vl7-lamp {
            position: absolute;
            left: 49%;
            top: 85px;
            width: 65px;
            height: 65px;
            border: 3px solid #8b5cf6;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 25px;
            background: rgba(139,92,246,.05);
        }

        .vl7-switch {
            position: absolute;
            left: 30%;
            top: 105px;
            width: 65px;
            height: 38px;
            border-bottom: 3px solid #22c55e;
        }

        .vl7-switch:after {
            content: "";
            position: absolute;
            width: 55px;
            height: 3px;
            background: #22c55e;
            left: 2px;
            top: 14px;
            transform: rotate(-25deg);
            transform-origin: left center;
        }

        .vl7-node {
            position: absolute;
            width: 9px;
            height: 9px;
            border-radius: 50%;
            background: #21d4fd;
            box-shadow: 0 0 12px #21d4fd;
        }

        .vl7-options {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
        }

        .vl7-option {
            padding: 14px 15px;
            border: 1px solid #1d3157;
            border-radius: 11px;
            background: rgba(255,255,255,.025);
            color: #dce8f8;
            cursor: pointer;
            text-align: left;
            font-size: 14px;
            transition: .25s;
        }

        .vl7-option:hover {
            border-color: rgba(33,212,253,.65);
            background: rgba(33,212,253,.06);
            transform: translateY(-2px);
        }

        .vl7-option.correct {
            border-color: #22c55e;
            background: rgba(34,197,94,.10);
            color: #22c55e;
        }

        .vl7-option.wrong {
            border-color: #ef4444;
            background: rgba(239,68,68,.10);
            color: #ef4444;
        }

        .vl7-feedback {
            margin-top: 18px;
            min-height: 24px;
            font-size: 14px;
            color: #91a5c5;
        }

        .vl7-controls {
            display: flex;
            gap: 10px;
            margin-top: 22px;
            flex-wrap: wrap;
        }

        .vl7-btn {
            border: none;
            padding: 12px 19px;
            border-radius: 10px;
            font-weight: bold;
            cursor: pointer;
            transition: .25s;
            font-size: 14px;
        }

        .vl7-btn-primary {
            background: linear-gradient(
                90deg,
                #21d4fd,
                #3b82f6
            );
            color: #03101c;
        }

        .vl7-btn-secondary {
            background: rgba(255,255,255,.035);
            color: #fff;
            border: 1px solid #1d3157;
        }

        .vl7-btn:hover {
            transform: translateY(-2px);
            filter: brightness(1.08);
        }

        .vl7-report h3 {
            font-size: 22px;
            margin-bottom: 18px;
        }

        .vl7-stat {
            padding: 16px;
            border: 1px solid rgba(33,212,253,.16);
            border-radius: 12px;
            background: rgba(33,212,253,.035);
            margin-bottom: 12px;
        }

        .vl7-stat-label {
            color: #91a5c5;
            font-size: 12px;
            margin-bottom: 4px;
        }

        .vl7-stat-value {
            color: #21d4fd;
            font-size: 24px;
            font-weight: 800;
        }

        .vl7-tip {
            margin-top: 20px;
            padding: 17px;
            border-left: 3px solid #8b5cf6;
            background: rgba(139,92,246,.06);
            color: #91a5c5;
            border-radius: 8px;
            font-size: 14px;
        }

        .vl7-tip strong {
            color: #fff;
        }

        .vl7-complete {
            margin-top: 20px;
            padding: 18px;
            border: 1px solid rgba(34,197,94,.35);
            border-radius: 12px;
            background: rgba(34,197,94,.06);
            display: none;
        }

        .vl7-complete.show {
            display: block;
        }

        .vl7-complete strong {
            color: #22c55e;
        }

        @media(max-width:850px) {
            .vl7-layout {
                grid-template-columns: 1fr;
            }

            .vl7-options {
                grid-template-columns: 1fr;
            }

            .vl7-header h2 {
                font-size: 30px;
            }
        }

    </style>

    <section id="circuit-detective" class="vl7-section">
        <div class="vl7-wrapper">

            <div class="vl7-header">
                <h2>🕵️ Circuit Detective</h2>
                <p>
                    Find the fault, diagnose the circuit and become the detective.
                </p>
            </div>

            <div class="vl7-layout">

                <div class="vl7-panel">

                    <div class="vl7-case-top">
                        <div id="vl7CaseNumber" class="vl7-case-number">
                            CASE 01 / 05
                        </div>

                        <div id="vl7Score" class="vl7-score">
                            SCORE: 0 / 5
                        </div>
                    </div>

                    <div id="vl7Question" class="vl7-question">
                        What is wrong with this circuit?
                    </div>

                    <div id="vl7Description" class="vl7-description">
                        Inspect the circuit carefully and identify the most likely fault.
                    </div>

                    <div id="vl7Circuit" class="vl7-circuit">
                        <div class="vl7-wire active"
                             style="left:14%;top:76px;width:72%;height:3px;"></div>

                        <div class="vl7-wire active"
                             style="left:14%;top:168px;width:72%;height:3px;"></div>

                        <div class="vl7-wire active"
                             style="left:14%;top:76px;width:3px;height:95px;"></div>

                        <div class="vl7-wire active"
                             style="right:14%;top:76px;width:3px;height:95px;"></div>

                        <div class="vl7-battery"></div>
                        <div class="vl7-switch"></div>
                        <div class="vl7-lamp">💡</div>
                        <div class="vl7-resistor">6Ω</div>

                        <div class="vl7-node"
                             style="left:13.2%;top:72px;"></div>

                        <div class="vl7-node"
                             style="right:13.2%;top:72px;"></div>

                    </div>

                    <div id="vl7Options" class="vl7-options"></div>

                    <div id="vl7Feedback" class="vl7-feedback">
                        Select a diagnosis to investigate the circuit.
                    </div>

                    <div class="vl7-controls">

                        <button
                            id="vl7Next"
                            class="vl7-btn vl7-btn-primary"
                            type="button">
                            NEXT CASE →
                        </button>

                        <button
                            id="vl7Reset"
                            class="vl7-btn vl7-btn-secondary"
                            type="button">
                            RESET
                        </button>

                    </div>

                    <div id="vl7Complete" class="vl7-complete">
                        <strong>🏆 Investigation Complete!</strong>
                        <br>
                        You have completed all five circuit detective cases.
                    </div>

                </div>


                <div class="vl7-panel vl7-report">

                    <h3>🧠 Detective Report</h3>

                    <div class="vl7-stat">
                        <div class="vl7-stat-label">
                            CASES COMPLETED
                        </div>

                        <div
                            id="vl7Solved"
                            class="vl7-stat-value">
                            0
                        </div>
                    </div>

                    <div class="vl7-stat">
                        <div class="vl7-stat-label">
                            CURRENT SCORE
                        </div>

                        <div
                            id="vl7ReportScore"
                            class="vl7-stat-value">
                            0 / 5
                        </div>
                    </div>

                    <div class="vl7-stat">
                        <div class="vl7-stat-label">
                            INVESTIGATION STATUS
                        </div>

                        <div
                            id="vl7Status"
                            class="vl7-stat-value">
                            READY
                        </div>
                    </div>

                    <div class="vl7-tip">
                        <strong>🔬 Investigator Tip</strong>
                        <br><br>
                        Start by checking whether the circuit has a complete
                        path. Then inspect the switch, resistance and current.
                        Finally compare the circuit behaviour with Ohm's Law.
                    </div>

                </div>

            </div>

        </div>
    </section>
    `;


    /* ---------------------------------------------------------
       2. INSERT SECTION
       --------------------------------------------------------- */

    function insertDetective() {

        if (document.getElementById("circuit-detective")) {
            return;
        }

        document.body.insertAdjacentHTML(
            "beforeend",
            detectiveHTML
        );
    }


    /* ---------------------------------------------------------
       3. DETECTIVE DATA
       --------------------------------------------------------- */

    const cases = [

        {
            title: "Open Circuit",
            description:
                "The lamp does not turn on because the electrical path is interrupted.",
            answer: "Open circuit",
            explanation:
                "An open circuit breaks the current path, so current cannot flow through the load.",
            options: [
                "Open circuit",
                "Short circuit",
                "Correct resistance",
                "High voltage"
            ]
        },

        {
            title: "Short Circuit",
            description:
                "A very low-resistance path has appeared across the circuit.",
            answer: "Short circuit",
            explanation:
                "A short circuit provides an extremely low-resistance path and can cause excessive current.",
            options: [
                "Normal operation",
                "Short circuit",
                "Open circuit",
                "Correct resistance"
            ]
        },

        {
            title: "Wrong Resistance",
            description:
                "The circuit is receiving the expected voltage, but the resistance value is incorrect.",
            answer: "Wrong resistance",
            explanation:
                "Changing resistance changes current according to I = V/R.",
            options: [
                "Wrong resistance",
                "Open circuit",
                "Correct wiring",
                "No voltage"
            ]
        },

        {
            title: "Broken Connection",
            description:
                "One connection between two circuit components is missing.",
            answer: "Broken connection",
            explanation:
                "A missing wire creates an incomplete path and prevents normal current flow.",
            options: [
                "High power",
                "Broken connection",
                "Correct circuit",
                "Short circuit"
            ]
        },

        {
            title: "Overcurrent",
            description:
                "The circuit current is much higher than the expected safe value.",
            answer: "Overcurrent",
            explanation:
                "From I = V/R, very low resistance can produce excessive current for a given voltage.",
            options: [
                "Open circuit",
                "Normal current",
                "Overcurrent",
                "Zero voltage"
            ]
        }

    ];


    /* ---------------------------------------------------------
       4. STATE
       --------------------------------------------------------- */

    let currentCase = 0;
    let score = 0;
    let solved = 0;
    let answered = false;


    /* ---------------------------------------------------------
       5. ELEMENT REFERENCES
       --------------------------------------------------------- */

    function get(id) {
        return document.getElementById(id);
    }


    /* ---------------------------------------------------------
       6. LOAD CASE
       --------------------------------------------------------- */

    function loadCase(index) {

        const data = cases[index];

        if (!data) {
            return;
        }

        answered = false;

        get("vl7CaseNumber").textContent =
            "CASE " +
            String(index + 1).padStart(2, "0") +
            " / 05";

        get("vl7Question").textContent =
            "What is wrong with this circuit?";

        get("vl7Description").textContent =
            data.description;

        get("vl7Feedback").textContent =
            "Select a diagnosis to investigate the circuit.";

        get("vl7Feedback").style.color =
            "#91a5c5";

        get("vl7Status").textContent =
            "INVESTIGATING";

        const options = get("vl7Options");

        options.innerHTML = "";

        data.options.forEach(function (option) {

            const button = document.createElement("button");

            button.type = "button";
            button.className = "vl7-option";
            button.textContent = option;

            button.addEventListener("click", function () {
                checkAnswer(button, option);
            });

            options.appendChild(button);

        });

        get("vl7Score").textContent =
            "SCORE: " + score + " / 5";

        get("vl7ReportScore").textContent =
            score + " / 5";

        get("vl7Solved").textContent =
            solved;

        get("vl7Complete").classList.remove("show");
    }


    /* ---------------------------------------------------------
       7. CHECK ANSWER
       --------------------------------------------------------- */

    function checkAnswer(button, selected) {

        if (answered) {
            return;
        }

        const data = cases[currentCase];

        answered = true;

        const buttons =
            document.querySelectorAll(".vl7-option");

        buttons.forEach(function (btn) {
            btn.style.pointerEvents = "none";
        });


        if (selected === data.answer) {

            button.classList.add("correct");

            score++;
            solved++;

            get("vl7Feedback").textContent =
                "✓ Correct! " + data.explanation;

            get("vl7Feedback").style.color =
                "#22c55e";

            get("vl7Status").textContent =
                "CASE SOLVED";

        } else {

            button.classList.add("wrong");

            buttons.forEach(function (btn) {

                if (btn.textContent === data.answer) {
                    btn.classList.add("correct");
                }

            });

            get("vl7Feedback").textContent =
                "✗ Not quite. Correct diagnosis: " +
                data.answer +
                ". " +
                data.explanation;

            get("vl7Feedback").style.color =
                "#ef4444";

            get("vl7Status").textContent =
                "CASE REVIEW";

        }

        get("vl7Score").textContent =
            "SCORE: " + score + " / 5";

        get("vl7ReportScore").textContent =
            score + " / 5";

        get("vl7Solved").textContent =
            solved;

    }


    /* ---------------------------------------------------------
       8. NEXT CASE
       --------------------------------------------------------- */

    function nextCase() {

        if (!answered) {

            get("vl7Feedback").textContent =
                "Please select a diagnosis before moving to the next case.";

            get("vl7Feedback").style.color =
                "#f59e0b";

            return;
        }

        if (currentCase < cases.length - 1) {

            currentCase++;

            loadCase(currentCase);

            document
                .getElementById("circuit-detective")
                .scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });

        } else {

            get("vl7Complete").classList.add("show");

            get("vl7Status").textContent =
                "COMPLETE";

            get("vl7Feedback").textContent =
                "All five investigations are complete. Final score: " +
                score +
                " / 5";

            get("vl7Feedback").style.color =
                "#21d4fd";

        }

    }


    /* ---------------------------------------------------------
       9. RESET
       --------------------------------------------------------- */

    function resetDetective() {

        currentCase = 0;
        score = 0;
        solved = 0;
        answered = false;

        loadCase(0);

    }


    /* ---------------------------------------------------------
       10. START
       --------------------------------------------------------- */

    function startStep7() {

        insertDetective();

        get("vl7Next").addEventListener(
            "click",
            nextCase
        );

        get("vl7Reset").addEventListener(
            "click",
            resetDetective
        );

        loadCase(0);

    }


    /* ---------------------------------------------------------
       11. WAIT UNTIL PAGE IS READY
       --------------------------------------------------------- */

    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            startStep7
        );

    } else {

        startStep7();

    }

})();
