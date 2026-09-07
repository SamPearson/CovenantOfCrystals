document.addEventListener("DOMContentLoaded", () => {

function toggleRule(rule) {
const expanded = rule.dataset.expanded === "true";

rule.dataset.expanded = String(!expanded);

const chevron = rule.querySelector(".chevron");

if (chevron) {
  chevron.textContent = expanded ? "›" : "⌃";
}

}

// Expand / collapse rules

document.querySelectorAll("[data-toggle-rule]").forEach((summary) => {

summary.addEventListener("click", (event) => {

  if (
    event.target.closest("select") ||
    event.target.closest("input") ||
    event.target.closest("button:not(.chevron)")
  ) {
    return;
  }

  toggleRule(summary.closest("[data-rule]"));
});

});

document.querySelectorAll(".chevron").forEach((button) => {

button.addEventListener("click", (event) => {

  event.stopPropagation();

  toggleRule(button.closest("[data-rule]"));

});

});

// Script block collapse

document.querySelectorAll("[data-collapse-block]").forEach((button) => {

button.addEventListener("click", () => {

  const block = button.closest("[data-block]");
  const collapsed = block.dataset.collapsed === "true";

  block.dataset.collapsed = String(!collapsed);

  button.textContent = collapsed ? "⌄" : "›";

});

});

// Collapse everything

document
.getElementById("collapseAll")
.addEventListener("click", () => {

  document.querySelectorAll("[data-rule]").forEach((rule) => {

    rule.dataset.expanded = "false";

    const chevron = rule.querySelector(".chevron");

    if (chevron) {
      chevron.textContent = "›";
    }

  });

  document.querySelectorAll("[data-block]").forEach((block) => {

    block.dataset.collapsed = "true";

    const button =
      block.querySelector("[data-collapse-block]");

    if (button) {
      button.textContent = "›";
    }

  });

});

// Expand everything

document
.getElementById("expandAll")
.addEventListener("click", () => {

  document.querySelectorAll("[data-rule]").forEach((rule) => {

    rule.dataset.expanded = "true";

    const chevron = rule.querySelector(".chevron");

    if (chevron) {
      chevron.textContent = "⌃";
    }

  });

  document.querySelectorAll("[data-block]").forEach((block) => {

    block.dataset.collapsed = "false";

    const button =
      block.querySelector("[data-collapse-block]");

    if (button) {
      button.textContent = "⌄";
    }

  });

});

// Add a demonstration rule

document
.getElementById("addRule")
.addEventListener("click", () => {

  const fallback = document.querySelector(".fallback");

  const card = document.createElement("article");

  card.className = "rule-card";
  card.dataset.rule = "";
  card.dataset.expanded = "true";

  card.innerHTML = `
    <div class="rule-summary" data-toggle-rule>

      <div class="priority">07</div>

      <div class="rule-copy">
        <strong>Unnamed Rule</strong>
        <small>Configure a trigger condition</small>
      </div>

      <div class="action-badge">
        <span>✦</span>
        Choose Action
      </div>

      <button class="chevron">⌃</button>

    </div>

    <div class="rule-editor">

      <div class="editor-heading">
        <span>TRIGGER CONDITIONS</span>
      </div>

      <div class="condition-preview">
        Configure when this rule should execute.
      </div>

      <div class="editor-section">

        <div class="editor-heading">
          <span>TARGET</span>
        </div>

        <select>
          <option>Choose Target...</option>
          <option>Self</option>
          <option>Trigger Target</option>
          <option>Previous Trigger Target</option>
          <option>Random Enemy</option>
        </select>

      </div>

      <div class="editor-section">

        <div class="editor-heading">
          <span>ACTION</span>
        </div>

        <select>
          <option>Choose Action...</option>
          <option>Skill...</option>
          <option>Item...</option>
        </select>

      </div>

    </div>
  `;

  fallback.before(card);

  const summary =
    card.querySelector("[data-toggle-rule]");

  const chevron =
    card.querySelector(".chevron");

  summary.addEventListener("click", (event) => {

    if (
      event.target.closest("select") ||
      event.target.closest("input") ||
      event.target.closest("button:not(.chevron)")
    ) {
      return;
    }

    toggleRule(card);

  });

  chevron.addEventListener("click", (event) => {

    event.stopPropagation();

    toggleRule(card);

  });

  renumberRules();

});

function renumberRules() {

const rules = document.querySelectorAll(
  ".rules > .rule-card:not(.fallback-card)"
);

rules.forEach((rule, index) => {

  const priority = rule.querySelector(".priority");

  if (
    priority &&
    priority.textContent.trim() !== "R"
  ) {
    priority.textContent =
      String(index + 1).padStart(2, "0");
  }

});

}

// Library selection

document.querySelectorAll(".script").forEach((script) => {

script.addEventListener("click", () => {

  document
    .querySelectorAll(".script")
    .forEach((item) => {
      item.classList.remove("active");
    });

  script.classList.add("active");

});

});

});