<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Character Scripting — User Guide</title>
<style>
  :root {
    --bg: #0c0a12;
    --surface: #13111a;
    --surface2: #1a1724;
    --border: #2a2538;
    --text: #d4cfe6;
    --text-dim: #8a82a0;
    --gold: #d4a73a;
    --gold-dim: #8a6e28;
    --green: #5cc98a;
    --red: #e05c6c;
    --blue: #5c8ae0;
    --purple: #9c6ce0;
    --orange: #e09c5c;
    --cyan: #5cc9d4;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.7;
    padding: 2rem 3rem;
    max-width: 960px;
    margin: 0 auto;
  }

  h1 { color: var(--gold); font-size: 2rem; margin: 2.5rem 0 1rem; border-bottom: 2px solid var(--gold-dim); padding-bottom: .5rem; }
  h2 { color: var(--gold); font-size: 1.5rem; margin: 2rem 0 .75rem; }
  h3 { color: var(--gold); font-size: 1.15rem; margin: 1.5rem 0 .5rem; }
  h4 { color: var(--text); font-size: 1rem; margin: 1rem 0 .4rem; font-style: italic; }

  p { margin: .5rem 0; }
  code { background: var(--surface2); padding: .1em .4em; border-radius: 3px; font-family: 'Fira Code', 'Consolas', monospace; font-size: .9em; color: var(--cyan); }
  pre { background: var(--surface2); padding: 1rem; border-radius: 6px; overflow-x: auto; border: 1px solid var(--border); margin: .75rem 0; }
  pre code { padding: 0; background: none; }
  a { color: var(--blue); }

  /* Callout boxes */
  .callout {
    border-left: 4px solid var(--gold-dim);
    background: var(--surface);
    padding: .75rem 1rem;
    margin: 1rem 0;
    border-radius: 0 6px 6px 0;
  }
  .callout.tip { border-left-color: var(--green); }
  .callout.warn { border-left-color: var(--orange); }
  .callout.danger { border-left-color: var(--red); }
  .callout.info { border-left-color: var(--blue); }

  .callout strong { color: var(--gold); }
  .callout.tip strong { color: var(--green); }
  .callout.warn strong { color: var(--orange); }
  .callout.danger strong { color: var(--red); }
  .callout.info strong { color: var(--blue); }

  /* Tables */
  table { width: 100%; border-collapse: collapse; margin: .75rem 0; font-size: .9em; }
  th { background: var(--surface2); color: var(--gold); text-align: left; padding: .5rem .75rem; border: 1px solid var(--border); }
  td { padding: .4rem .75rem; border: 1px solid var(--border); }
  tr:nth-child(even) td { background: var(--surface); }

  /* Diagram / anatomy */
  .anatomy {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1.25rem;
    margin: 1rem 0;
    font-family: 'Fira Code', monospace;
    font-size: .85rem;
    line-height: 1.9;
    color: var(--text-dim);
  }
  .anatomy .hl-block { color: var(--purple); font-weight: bold; }
  .anatomy .hl-rule { color: var(--blue); }
  .anatomy .hl-line { color: var(--cyan); }
  .anatomy .hl-fallback { color: var(--orange); }
  .anatomy .hl-reaction { color: var(--red); }
  .anatomy .hl-comment { color: var(--text-dim); font-style: italic; }

  /* Badges */
  .badge {
    display: inline-block;
    padding: .1em .5em;
    border-radius: 4px;
    font-size: .8em;
    font-weight: bold;
    margin: 0 .15em;
  }
  .badge.type { background: #1a2a44; color: var(--blue); }
  .badge.kind { background: #2a1a44; color: var(--purple); }
  .badge.scope { background: #1a3a2a; color: var(--green); }
  .badge.event { background: #3a2a1a; color: var(--orange); }
  .badge.status { background: #3a1a2a; color: var(--red); }

  /* Steps */
  .step {
    display: flex;
    gap: .75rem;
    margin: .75rem 0;
    align-items: flex-start;
  }
  .step-num {
    background: var(--gold);
    color: var(--bg);
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: .85rem;
    flex-shrink: 0;
    margin-top: .15rem;
  }

  /* Screenshot frames */
  .screenshot {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1rem;
    margin: 1rem 0;
    text-align: center;
  }
  .screenshot img { max-width: 100%; border-radius: 4px; }
  .screenshot figcaption { color: var(--text-dim); font-size: .85rem; margin-top: .5rem; }

  /* Tabs mockup */
  .ui-mock {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    margin: 1rem 0;
  }
  .ui-mock-title {
    background: var(--surface2);
    padding: .4rem .75rem;
    font-size: .85rem;
    color: var(--text-dim);
    border-bottom: 1px solid var(--border);
    font-weight: bold;
  }
  .ui-mock-body { padding: 1rem; }

  hr { border: none; border-top: 1px solid var(--border); margin: 2rem 0; }
</style>
</head>
<body>

<h1>Character Scripting — User Guide</h1>

<p>This guide explains how to build, test, and refine AI scripts for your characters using the <strong>Battle Script Grimoire</strong>. Scripts tell a character what to do automatically during autobattle — which skills to use, who to target, and when to react.</p>

<div class="callout info">
  <strong>Quick start:</strong> Every character starts with two built-in scripts — <em>Aggressive DPS</em> and <em>Healer</em>. Duplicate one to customize, or start from scratch.
</div>

<hr>

<h2 id="anatomy">Script Anatomy</h2>

<p>Every script is a stack of numbered <strong>rules</strong> evaluated from top to bottom. The first rule whose conditions are satisfied wins — the rest are skipped. If no rule matches, the <strong>fallback</strong> always fires.</p>

<div class="anatomy">
  <span class="hl-block">┌─ Script: "Reactive Mage"</span><br>
  <span class="hl-block">│</span><br>
  <span class="hl-rule">│  Rule 01</span> <span class="hl-comment">── trigger + target + action</span><br>
  <span class="hl-rule">│  Rule 02</span><br>
  <span class="hl-rule">│  Rule 03</span><br>
  <span class="hl-block">│</span><br>
  <span class="hl-line">│  ┌─ Nested Block</span> <span class="hl-comment">── depth 1 (conditional sub-rules)</span><br>
  <span class="hl-line">│  │  Rule 04</span><br>
  <span class="hl-line">│  │  Rule 05</span><br>
  <span class="hl-line">│  └──────────────</span><br>
  <span class="hl-rule">│  Rule 06</span><br>
  <span class="hl-block">│</span><br>
  <span class="hl-reaction">│  Reactions</span> <span class="hl-comment">── event-triggered interrupt skills</span><br>
  <span class="hl-reaction">│    Reaction 01</span><br>
  <span class="hl-reaction">│    Reaction 02</span><br>
  <span class="hl-block">│</span><br>
  <span class="hl-fallback">└─ Fallback: Attack Random Enemy</span> <span class="hl-comment">── always fires if nothing else matched</span>
</div>

<h3>Rules</h3>

<p>Each rule has three parts, evaluated in order:</p>

<table>
<tr><th>Part</th><th>What it does</th><th>Example</th></tr>
<tr><td><strong>Trigger</strong></td><td>Conditions that must ALL be true</td><td>Self HP < 40%</td></tr>
<tr><td><strong>Target</strong></td><td>Who to act on</td><td>Lowest HP enemy</td></tr>
<tr><td><strong>Action</strong></td><td>What to do</td><td>Any heal skill</td></tr>
</table>

<p>Rules resolve from top to bottom. The <strong>first matching rule wins</strong> — so put your most important rules at the top.</p>

<h3>Nested Blocks</h3>

<p>Blocks let you add a second layer of conditional sub-rules inside a rule. They have their own trigger conditions, and only evaluate when the parent condition is satisfied. You can nest up to <strong>2 levels deep</strong> (root → block → block).</p>

<div class="callout">
  <strong>Example:</strong> A top-level rule checks <em>"Self MP > 50%"</em> and enters a block. Inside, rules select which spell to cast based on enemy weaknesses and HP thresholds.
</div>

<h3>Fallback</h3>

<p>Every script has a fallback rule at the bottom, marked with <strong>∞</strong>. It always matches (conditions are always true) and runs only when no other rule above it matched. Common defaults:</p>
<ul>
  <li><strong>Attack</strong> — basic attack against a random enemy</li>
  <li><strong>Defend</strong> — skip turn to recover MP</li>
</ul>

<h3>Reactions</h3>

<p>Reactions are <strong>interrupt skills</strong> that trigger in response to battle events — like getting hit, evading, or an ally being attacked. They're evaluated <em>before</em> the normal rule stack during the event processing phase.</p>

<div class="callout tip">
  <strong>Tip:</strong> Reactions are perfect for counter-attacks (Thorns when attacked), opportunistic strikes (Steal on evaded attack), or protecting allies (Guardian's Vow when ally is hit).
</div>

<hr>

<h2 id="editor">The Script Editor</h2>

<p>Open the editor from the <strong>Automation Panel</strong> in the party configuration screen. Click any script in the library to open it, or click <strong>New Script</strong> to start from scratch.</p>

<div class="ui-mock">
  <div class="ui-mock-title">Battle Script Grimoire — Editor Layout</div>
  <div class="ui-mock-body">

    <h4>Left Sidebar — Script Library</h4>
    <p style="color: var(--text-dim); font-size:.9em;">All your scripts, built-in and custom. Each shows its name, rule count, and how many characters use it. Built-in scripts are marked with a lock icon.</p>

    <h4>Main Area — Rule Editor</h4>
    <p style="color: var(--text-dim); font-size:.9em;">Numbered rule cards, expandable and reorderable. The evaluation order is shown as <strong>↕ Execution Order: Top → Bottom</strong>.</p>

    <h4>Top Bar — Script Info</h4>
    <p style="color: var(--text-dim); font-size:.9em;">Script name (editable), rule/block count badges, and Save / Duplicate actions.</p>

    <h4>Bottom — Dry-Run Preview</h4>
    <p style="color: var(--text-dim); font-size:.9em;">Test your script without entering battle. Mock actors, adjust HP/MP, simulate events.</p>

  </div>
</div>

<h3>Creating a Script</h3>

<div class="step">
  <div class="step-num">1</div>
  <div><strong>Click "New Script"</strong> in the library sidebar, or click <strong>Duplicate</strong> on an existing script to start with a copy.</div>
</div>

<div class="step">
  <div class="step-num">2</div>
  <div><strong>Name your script</strong> using the title input at the top. Something descriptive like <code>"Fire Mage DPS"</code> or <code>"Defensive Cleric"</code>.</div>
</div>

<div class="step">
  <div class="step-num">3</div>
  <div><strong>Add rules</strong> by clicking <strong>+ Add Rule</strong>. Each rule starts with a trigger, target, and action.</div>
</div>

<div class="step">
  <div class="step-num">4</div>
  <div><strong>Expand a rule card</strong> by clicking the chevron (›) to configure its trigger conditions, target, and action in detail.</div>
</div>

<div class="step">
  <div class="step-num">5</div>
  <div><strong>Test with Dry-Run</strong> at the bottom of the editor before saving.</div>
</div>

<hr>

<h2 id="triggers">Building Trigger Conditions</h2>

<p>Every rule starts with one or more conditions. All conditions must pass (they're combined with AND). Click <strong>+ Add Condition</strong> to stack multiple checks.</p>

<h3>Condition Types</h3>

<table>
<tr><th>Condition</th><th>Syntax</th><th>Description</th></tr>
<tr><td><span class="badge kind">always</span></td><td><code>always</code></td><td>Always true (used in fallback)</td></tr>
<tr><td><span class="badge kind">never</span></td><td><code>never</code></td><td>Always false (disable a rule temporarily)</td></tr>
<tr><td><span class="badge kind">hp-pct</span></td><td><code>Self HP &lt; 40%</code></td><td>Compare actor's HP percentage</td></tr>
<tr><td><span class="badge kind">mp-pct</span></td><td><code>Self MP &gt; 50%</code></td><td>Compare actor's MP percentage</td></tr>
<tr><td><span class="badge kind">stat-compare</span></td><td><code>Enemy ATK &gt; 20</code></td><td>Compare a stat against an absolute value</td></tr>
<tr><td><span class="badge kind">has-status</span></td><td><code>Self has Poison</code></td><td>Check for an active status effect</td></tr>
<tr><td><span class="badge kind">weak-to</span></td><td><code>Enemy weak to Fire</code></td><td>Check enemy elemental weakness</td></tr>
<tr><td><span class="badge kind">enemy-rank</span></td><td><code>Enemy is Elite OR Boss</code></td><td>Check enemy rank (elite, boss, etc.)</td></tr>
<tr><td><span class="badge kind">ally-count</span></td><td><code>Allies alive = 3</code></td><td>Count alive allies matching a condition</td></tr>
<tr><td><span class="badge kind">enemy-count</span></td><td><code>Enemies alive &lt; 3</code></td><td>Count alive enemies</td></tr>
<tr><td><span class="badge kind">turn-count</span></td><td><code>Turn &gt; 5</code></td><td>Current battle turn number</td></tr>
<tr><td><span class="badge kind">turn-mod</span></td><td><code>Turn mod 3 = 0</code></td><td>Turn number modulo a value (every N turns)</td></tr>
<tr><td><span class="badge kind">cooldown-ready</span></td><td><code>Fireball ready</code></td><td>Whether a specific skill's cooldown is available</td></tr>
<tr><td><span class="badge kind">can-cast</span></td><td><code>Can cast any heal skill</code></td><td>Can afford MP + off cooldown + know the skill</td></tr>
<tr><td><span class="badge kind">has-item</span></td><td><code>Has Health Potion</code></td><td>Whether the actor has a specific item</td></tr>
<tr><td><span class="badge kind">and</span></td><td><code>(HP &lt; 50%) AND (MP &gt; 30%)</code></td><td>Combine two conditions</td></tr>
<tr><td><span class="badge kind">or</span></td><td><code>(Fire weakness) OR (HP &lt; 20%)</code></td><td>Either condition passes</td></tr>
<tr><td><span class="badge kind">not</span></td><td><code>NOT has Poison</code></td><td>Invert a condition</td></tr>
</table>

<h3>Actor Scopes for Conditions</h3>

<p>Conditions reference actors using scopes. The scope determines <em>who</em> you're checking:</p>

<table>
<tr><th>Scope</th><th>Meaning</th><th>Available when</th></tr>
<tr><td><strong>Self</strong></td><td>The actor executing this script</td><td>Always</td></tr>
<tr><td><strong>Trigger Target</strong></td><td>The primary target of the current event</td><td>During reactions / nested evaluation</td></tr>
<tr><td><strong>Previous Trigger Target</strong></td><td>Target resolved by an outer scope</td><td>In nested blocks / conditions referencing earlier targets</td></tr>
<tr><td><strong>Party Member</strong></td><td>A specific party member</td><td>In ally-related scopes</td></tr>
<tr><td><strong>Ally / Any Ally</strong></td><td>Checks across all alive allies</td><td>With <span class="badge scope">any-</span> or <span class="badge scope">all-</span> prefix</td></tr>
<tr><td><strong>Enemy / Any Enemy</strong></td><td>Checks across all alive enemies</td><td>With <span class="badge scope">any-</span> or <span class="badge scope">all-</span> prefix</td></tr>
<tr><td><strong>Attacker</strong></td><td>The enemy who triggered the event</td><td>In reactions (attacked / evaded)</td></tr>
</table>

<div class="callout tip">
  <strong>Tip:</strong> Event-relative scopes (Attacker, Trigger Target, Previous Trigger Target) only resolve during reactions. In normal turn rules, they fall back to the actor itself or return empty.
</div>

<h3>Combining Conditions</h3>

<p>You can combine multiple conditions in a single rule using AND logic:</p>

<div class="ui-mock">
  <div class="ui-mock-title">Example: Multi-condition rule card</div>
  <div class="ui-mock-body" style="font-family: monospace; font-size:.85rem; line-height:2;">
    <span style="color:var(--blue);">I</span>&ensp;
    <span class="badge scope">Self</span> <span style="color:var(--cyan);">HP</span> &lt; <strong style="color:var(--gold);">40%</strong>
    <br>
    <span style="color:var(--text-dim);">AND</span>
    <br>
    <span style="color:var(--blue);">II</span>&ensp;
    <span class="badge scope">Self</span> <span style="color:var(--cyan);">MP</span> &gt; <strong style="color:var(--gold);">30%</strong>
    <br>
    <span style="color:var(--text-dim);">AND</span>
    <br>
    <span style="color:var(--blue);">III</span>&ensp;
    <span class="badge scope">Self</span> doesn't have <span class="badge status">Shield</span>
  </div>
</div>

<hr>

<h2 id="targets">Targeting</h2>

<p>After the trigger passes, the script resolves a <strong>target</strong> — who to act on. Targeting has two stages: first, pick a <em>target source</em> (the pool), then optionally <em>narrow</em> it with a condition.</p>

<h3>Target Sources</h3>

<table>
<tr><th>Target</th><th>Resolves to</th></tr>
<tr><td><strong>Self</strong></td><td>The actor itself</td></tr>
<tr><td><strong>Trigger Target</strong></td><td>The event's primary target (reactions only)</td></tr>
<tr><td><strong>Previous Trigger Target</strong></td><td>Target from an outer evaluation context</td></tr>
<tr><td><strong>Attacker</strong></td><td>The enemy who triggered the event (reactions only)</td></tr>
<tr><td><strong>Lowest HP Enemy</strong></td><td>Enemy with the lowest current HP %</td></tr>
<tr><td><strong>Highest HP Enemy</strong></td><td>Enemy with the highest current HP %</td></tr>
<tr><td><strong>Random Enemy</strong></td><td>A random alive enemy</td></tr>
<tr><td><strong>Lowest HP Ally</strong></td><td>Ally with the lowest current HP %</td></tr>
<tr><td><strong>Highest HP Ally</strong></td><td>Ally with the highest current HP %</td></tr>
<tr><td><strong>Random Ally</strong></td><td>A random alive ally</td></tr>
<tr><td><strong>All Enemies</strong></td><td>All alive enemies (for AoE actions)</td></tr>
<tr><td><strong>All Allies</strong></td><td>All alive allies (for AoE actions)</td></tr>
<tr><td><strong>Party Member</strong></td><td>A specific party member by selection</td></tr>
</table>

<h3>Target Narrowing</h3>

<p>You can optionally add a <strong>condition filter</strong> to further narrow the pool. For example:</p>
<ul>
  <li><em>"Lowest HP Ally who doesn't have Shield status"</em> — adds a status check to the pool</li>
  <li><em>"Random Enemy weak to Fire"</em> — only considers enemies with fire weakness</li>
</ul>

<hr>

<h2 id="actions">Actions / Skill Selectors</h2>

<p>The action determines <em>what to do</em> to the resolved target. Actions are chosen from the actor's known skills, filtered by the selector.</p>

<h3>Basic Actions</h3>

<table>
<tr><th>Action</th><th>Description</th></tr>
<tr><td><strong>Attack</strong></td><td>Basic attack against the target</td></tr>
<tr><td><strong>Defend</strong></td><td>Skip turn, recover MP</td></tr>
</table>

<h3>Skill Selectors</h3>

<p>Selectors let you filter from the actor's known skills. Multiple filters are combined with AND logic:</p>

<table>
<tr><th>Filter</th><th>What it matches</th><th>Example</th></tr>
<tr><td><span class="badge type">element</span></td><td>Skills of a specific element</td><td><code>Any Fire-element Spell</code></td></tr>
<tr><td><span class="badge type">kind</span></td><td>Skills of a specific kind</td><td><code>Any Heal Skill</code></td></tr>
<tr><td><span class="badge type">target</span></td><td>Skills targeting a scope</td><td><code>Any Self-targeting Skill</code></td></tr>
<tr><td><span class="badge type">stat-scaling</span></td><td>Skills scaling off a stat</td><td><code>Any ATK-scaling Skill</code></td></tr>
<tr><td><span class="badge type">status-inflict</span></td><td>Skills that inflict a status</td><td><code>Any Skill inflicting Poison</code></td></tr>
<tr><td><span class="badge type">specific</span></td><td>A single specific skill</td><td><code>Fireball</code></td></tr>
<tr><td><span class="badge type">category</span></td><td>All skills in a category</td><td><code>Any Skill</code></td></tr>
<tr><td><span class="badge type">tag</span></td><td>Skills matching a tag string</td><td><code>Any skill tagged "buff"</code></td></tr>
</table>

<div class="callout tip">
  <strong>Tip:</strong> When multiple skills match a selector, one is chosen <strong>randomly</strong>. This adds variety to your character's behavior. If you want deterministic selection, use <span class="badge type">specific</span> to pick an exact skill.
</div>

<hr>

<h2 id="reactions">Reactions</h2>

<p>Reactions are <strong>event-driven interrupt skills</strong> that fire outside the normal turn order. They have their own section at the bottom of the script, above the fallback.</p>

<h3>How Reactions Work</h3>

<ol>
  <li>An <strong>event</strong> happens in battle (getting attacked, evading, ally hit, status applied, etc.)</li>
  <li>The engine checks <strong>each actor's reaction sheet</strong> in order</li>
  <li>For each reaction, the <strong>gate</strong> (event pattern) is checked against the event</li>
  <li>If the gate matches, the reaction's <strong>conditions</strong> are evaluated</li>
  <li>If conditions pass, the <strong>target + action</strong> resolve</li>
  <li>The reaction fires (with optional <strong>delay</strong>)</li>
</ol>

<h3>Reaction Structure</h3>

<div class="ui-mock">
  <div class="ui-mock-title">Reaction Rule Card</div>
  <div class="ui-mock-body">
    <table>
      <tr><th style="width:120px">Gate</th><td><span class="badge event">WHEN</span> <strong>Evading an attack</strong></td></tr>
      <tr><th>Conditions</th><td>Optional extra checks (AND logic)</td></tr>
      <tr><th>Target</th><td>Who to act on (e.g. Attacker, Self)</td></tr>
      <tr><th>Action</th><td>What to do (e.g. Steal, Thorns)</td></tr>
      <tr><th>Delay</th><td>Optional turn delay before the reaction fires</td></tr>
    </table>
  </div>
</div>

<h3>Event Patterns (Gates)</h3>

<table>
<tr><th>Event</th><th>Triggers when</th><th>Source / Target filters</th></tr>
<tr><td><span class="badge event">attacked</span></td><td>The actor is hit by an attack</td><td>source: enemy, target: self/ally</td></tr>
<tr><td><span class="badge event">evaded</span></td><td>The actor evades an attack</td><td>source: enemy, target: self</td></tr>
<tr><td><span class="badge event">ko</span></td><td>An actor is knocked out</td><td>source: enemy, target: ally</td></tr>
<tr><td><span class="badge event">status-applied</span></td><td>A status is applied to the actor</td><td>source: enemy, target: self</td></tr>
<tr><td><span class="badge event">status-cured</span></td><td>A status is removed from the actor</td><td>target: self/ally</td></tr>
<tr><td><span class="badge event">healed</span></td><td>The actor is healed</td><td>source: ally, target: self/ally</td></tr>
<tr><td><span class="badge event">buff-applied</span></td><td>A buff is applied</td><td>source: ally, target: self/ally</td></tr>
<tr><td><span class="badge event">skill-used</span></td><td>An actor uses a skill</td><td>source: enemy, target: self</td></tr>
</table>

<h3>Built-in Reaction Skills</h3>

<table>
<tr><th>Skill</th><th>Element</th><th>Power</th><th>Cost</th><th>Reaction Gate</th></tr>
<tr><td><strong>Thorns</strong></td><td>Earth</td><td>40 (ATK)</td><td>4 MP</td><td>When attacked by enemy</td></tr>
<tr><td><strong>Steal</strong></td><td>Shadow</td><td>30 (ATK)</td><td>6 MP</td><td>When evading enemy attack</td></tr>
<tr><td><strong>Guardian's Vow</strong></td><td>Earth</td><td>35 (ATK)</td><td>5 MP</td><td>When an ally is attacked by enemy</td></tr>
</table>

<div class="callout warn">
  <strong>Important:</strong> A reaction skill must be in the actor's known skills AND the event must match the skill's <code>reactionTo</code> pattern for the reaction to fire. The engine validates this with a <em>reaction gate</em>.
</div>

<hr>

<h2 id="dry-run">Dry-Run Preview</h2>

<p>The dry-run section at the bottom of the script editor lets you <strong>test your script without entering battle</strong>. It builds a mock battle scenario and runs your script's logic against it.</p>

<h3>Setup</h3>

<div class="ui-mock">
  <div class="ui-mock-title">Dry-Run Panel</div>
  <div class="ui-mock-body">
    <table>
      <tr><th style="width:160px">Hero Class</th><td>Select which class the mock actor uses (determines known skills)</td></tr>
      <tr><th>HP %</th><td>Slider to set mock actor's current HP percentage (0–100%)</td></tr>
      <tr><th>MP %</th><td>Slider to set mock actor's current MP percentage (0–100%)</td></tr>
      <tr><th>Statuses</th><td>Toggle which statuses the mock actor has active</td></tr>
      <tr><th>Items</th><td>Toggle which items the mock actor is carrying</td></tr>
      <tr><th>Cooldowns</th><td>Set which skills are on cooldown</td></tr>
      <tr><th>Turn #</th><td>Set the current turn number (for turn-count conditions)</td></tr>
    </table>
  </div>
</div>

<h3>Running a Test</h3>

<div class="step">
  <div class="step-num">1</div>
  <div><strong>Set the mock actor</strong> — choose a class (Warrior, Archer, Mage, Bard, Cleric) and adjust HP/MP sliders.</div>
</div>

<div class="step">
  <div class="step-num">2</div>
  <div><strong>Set statuses and items</strong> — toggle Poison, Shield, etc. on or off. Toggle items to test <code>has-item</code> conditions.</div>
</div>

<div class="step">
  <div class="step-num">3</div>
  <div><strong>Set the turn number</strong> — useful for testing <code>turn-count</code> and <code>turn-mod</code> conditions.</div>
</div>

<div class="step">
  <div class="step-num">4</div>
  <div><strong>Click "Run"</strong> — the dry-run evaluates your script and shows which rule matched (or if the fallback fired).</div>
</div>

<div class="callout tip">
  <strong>Tip:</strong> Adjust the HP slider to find the exact threshold where different rules activate. This is great for tuning priority ordering.
</div>

<h3>Interpreting Results</h3>

<p>The dry-run output shows:</p>
<ul>
  <li><strong>Which rule matched</strong> — displayed as the rule number (e.g. "Rule 03")</li>
  <li><strong>Which action was selected</strong> — the specific skill or basic action</li>
  <li><strong>Which target was resolved</strong> — who the action would target</li>
  <li><strong>No match → fallback</strong> — if no rule matched, the fallback action is shown</li>
</ul>

<hr>

<h2 id="event-mock">Event Mock</h2>

<p>The <strong>Event Mock</strong> section is specifically for testing <strong>reaction rules</strong>. It simulates a battle event and checks whether your reaction sheet would fire.</p>

<h3>Setup</h3>

<div class="ui-mock">
  <div class="ui-mock-title">Event Mock Panel</div>
  <div class="ui-mock-body">
    <table>
      <tr><th style="width:160px">Event Type</th><td>Select the event to simulate (attacked, evaded, ko, status-applied, etc.)</td></tr>
      <tr><th>Source</th><td>Who triggered the event (enemy, ally, self)</td></tr>
      <tr><th>Target</th><td>Who the event happened to (self, ally, enemy)</td></tr>
    </table>
  </div>
</div>

<h3>Running an Event Mock</h3>

<div class="step">
  <div class="step-num">1</div>
  <div><strong>Select an event type</strong> — e.g. "Attacked" to test a Thorns reaction.</div>
</div>

<div class="step">
  <div class="step-num">2</div>
  <div><strong>Set the source</strong> — who caused the event (typically "Enemy").</div>
</div>

<div class="step">
  <div class="step-num">3</div>
  <div><strong>Set the target</strong> — who was affected (typically "Self" or "Ally").</div>
</div>

<div class="step">
  <div class="step-num">4</div>
  <div><strong>Click "Apply"</strong> — the event mock fires the event through your reaction sheet and shows which reaction (if any) triggered.</div>
</div>

<h3>Example: Testing a Thorns Reaction</h3>

<div class="ui-mock">
  <div class="ui-mock-title">Event Mock — Thorns Test</div>
  <div class="ui-mock-body" style="font-family: monospace; font-size:.85rem; line-height:2;">
    Event: <span class="badge event">attacked</span><br>
    Source: <strong>Enemy</strong><br>
    Target: <strong>Self</strong><br>
    <hr style="border-color:var(--border)">
    → Reaction 01 gate matches: ✓<br>
    → Conditions: ✓<br>
    → Action: <strong>Thorns</strong> → Target: Attacker ✓<br>
    <span style="color:var(--green);">✓ Reaction fires!</span>
  </div>
</div>

<h3>Example: Testing a Guardian's Vow Reaction</h3>

<div class="ui-mock">
  <div class="ui-mock-title">Event Mock — Guardian's Vow Test</div>
  <div class="ui-mock-body" style="font-family: monospace; font-size:.85rem; line-height:2;">
    Event: <span class="badge event">attacked</span><br>
    Source: <strong>Enemy</strong><br>
    Target: <strong>Ally</strong> <span style="color:var(--text-dim);">(not Self!)</span><br>
    <hr style="border-color:var(--border)">
    → Reaction 01 (Thorns) gate: ✗ (target mismatch — expects Self)<br>
    → Reaction 02 (Guardian's Vow) gate: ✓<br>
    → Conditions: ✓<br>
    → Action: <strong>Guardian's Vow</strong> → Target: Attacker ✓<br>
    <span style="color:var(--green);">✓ Guardian's Vow fires!</span>
  </div>
</div>

<div class="callout tip">
  <strong>Tip:</strong> If your reaction isn't firing, check: (1) does the event type match the gate? (2) does the source/target filter match? (3) does the actor know the reaction skill? (4) does the reaction skill have a <code>reactionTo</code> that matches this event? (5) are all extra conditions passing?
</div>

<hr>

<h2 id="examples">Practical Examples</h2>

<h3>Example 1: Simple DPS Script</h3>

<p>A straightforward damage dealer — heal if hurt, otherwise attack the weakest enemy.</p>

<div class="ui-mock">
  <div class="ui-mock-title">Script: "Aggressive DPS"</div>
  <div class="ui-mock-body">
    <table>
      <tr><th style="width:60px;color:var(--blue)">01</th>
        <td><strong>Self-heal when wounded</strong><br><span style="color:var(--text-dim)">Self HP &lt; 40% · Can cast any heal skill</span></td>
        <td>→ Target: Self · Action: <span class="badge kind">Any Heal Skill</span></td></tr>
      <tr><th style="width:60px;color:var(--blue)">02</th>
        <td><strong>Attack weakest enemy</strong><br><span style="color:var(--text-dim)">Always</span></td>
        <td>→ Target: <span style="color:var(--cyan)">Lowest HP Enemy</span> · Action: <span class="badge kind">Attack</span></td></tr>
    </table>
  </div>
</div>

<h3>Example 2: Reactive Mage with Nested Blocks</h3>

<p>Uses MP gating via a nested block to select between strong and weak spells.</p>

<div class="ui-mock">
  <div class="ui-mock-title">Script: "Reactive Mage"</div>
  <div class="ui-mock-body">
    <table>
      <tr><th style="width:60px;color:var(--blue)">01</th>
        <td><strong>Emergency heal</strong><br><span style="color:var(--text-dim)">Self HP &lt; 30% · Can cast any heal skill</span></td>
        <td>→ Target: Self · Action: <span class="badge kind">Any Heal Skill</span></td></tr>
      <tr><th style="width:60px;color:var(--purple)" colspan="2">Block: Self MP &gt; 50%</th><td></td></tr>
      <tr><th style="width:60px;color:var(--cyan)">&nbsp;&nbsp;A</th>
        <td><strong>Exploit fire weakness</strong><br><span style="color:var(--text-dim)">Enemy weak to Fire · Can cast Fireball</span></td>
        <td>→ Target: Previous Trigger Target · Action: <span class="badge type">Fireball</span></td></tr>
      <tr><th style="width:60px;color:var(--cyan)">&nbsp;&nbsp;B</th>
        <td><strong>Burst elite enemy</strong><br><span style="color:var(--text-dim)">Enemy is Elite OR Boss · HP &gt; 50%</span></td>
        <td>→ Target: Previous Trigger Target · Action: <span class="badge type">Comet / Fireball</span></td></tr>
      <tr><th style="width:60px;color:var(--blue)">02</th>
        <td><strong>Weak spell at low MP</strong><br><span style="color:var(--text-dim)">Always</span></td>
        <td>→ Target: Lowest HP Enemy · Action: <span class="badge kind">Any Damage Skill</span></td></tr>
      <tr><th style="width:60px;color:var(--orange)">∞</th>
        <td><strong>Fallback</strong><br><span style="color:var(--text-dim)">Always true</span></td>
        <td>→ Target: Random Enemy · Action: <span class="badge kind">Attack</span></td></tr>
    </table>
  </div>
</div>

<h3>Example 3: Healer with Conditional Support</h3>

<p>Prioritizes healing the most wounded ally, buffs when everyone's healthy.</p>

<div class="ui-mock">
  <div class="ui-mock-title">Script: "Support Cleric"</div>
  <div class="ui-mock-body">
    <table>
      <tr><th style="width:60px;color:var(--blue)">01</th>
        <td><strong>Heal critical ally</strong><br><span style="color:var(--text-dim)">Any Ally HP &lt; 30% · Can cast any heal skill</span></td>
        <td>→ Target: <span style="color:var(--cyan)">Lowest HP Ally</span> · Action: <span class="badge kind">Any Heal Skill</span></td></tr>
      <tr><th style="width:60px;color:var(--blue)">02</th>
        <td><strong>Heal wounded ally</strong><br><span style="color:var(--text-dim)">Any Ally HP &lt; 60% · Can cast any heal skill</span></td>
        <td>→ Target: <span style="color:var(--cyan)">Lowest HP Ally</span> · Action: <span class="badge kind">Any Heal Skill</span></td></tr>
      <tr><th style="width:60px;color:var(--blue)">03</th>
        <td><strong>Cleanse debuffs</strong><br><span style="color:var(--text-dim)">Any Ally has Poison OR Blind · Can cast Cleanse</span></td>
        <td>→ Target: <span style="color:var(--cyan)">Lowest HP Ally</span> · Action: <span class="badge type">Cleanse</span></td></tr>
      <tr><th style="width:60px;color:var(--blue)">04</th>
        <td><strong>Buff party attack</strong><br><span style="color:var(--text-dim)">Can cast Battle Anthem</span></td>
        <td>→ Target: <span style="color:var(--cyan)">All Allies</span> · Action: <span class="badge type">Battle Anthem</span></td></tr>
      <tr><th style="width:60px;color:var(--orange)">∞</th>
        <td><strong>Fallback</strong><br><span style="color:var(--text-dim)">Always true</span></td>
        <td>→ Target: Self · Action: <span class="badge kind">Defend</span></td></tr>
    </table>
  </div>
</div>

<h3>Example 4: Reaction-Heavy Tank</h3>

<p>A warrior who counter-attacks when hit and protects allies.</p>

<div class="ui-mock">
  <div class="ui-mock-title">Script: "Guardian Tank"</div>
  <div class="ui-mock-body">
    <table>
      <tr><th style="width:60px;color:var(--blue)">01</th>
        <td><strong>Self-heal</strong><br><span style="color:var(--text-dim)">Self HP &lt; 50% · Can cast any heal skill</span></td>
        <td>→ Target: Self · Action: <span class="badge kind">Any Heal Skill</span></td></tr>
      <tr><th style="width:60px;color:var(--blue)">02</th>
        <td><strong>Buff defense</strong><br><span style="color:var(--text-dim)">Can cast Iron Guard</span></td>
        <td>→ Target: Self · Action: <span class="badge type">Iron Guard</span></td></tr>
      <tr><th style="width:60px;color:var(--red)" colspan="2">Reactions</th><td></td></tr>
      <tr><th style="width:60px;color:var(--red)">R1</th>
        <td><strong>Counter-attack when hit</strong><br><span style="color:var(--text-dim)">WHEN: Attacked by enemy → Target: Self</span></td>
        <td>→ Action: <span class="badge type">Thorns</span></td></tr>
      <tr><th style="width:60px;color:var(--red)">R2</th>
        <td><strong>Protect ally</strong><br><span style="color:var(--text-dim)">WHEN: Ally attacked by enemy</span></td>
        <td>→ Action: <span class="badge type">Guardian's Vow</span></td></tr>
      <tr><th style="width:60px;color:var(--orange)">∞</th>
        <td><strong>Fallback</strong><br><span style="color:var(--text-dim)">Always true</span></td>
        <td>→ Target: Random Enemy · Action: <span class="badge kind">Attack</span></td></tr>
    </table>
  </div>
</div>

<hr>

<h2 id="reference">Reference Tables</h2>

<h3>Skill Reference</h3>

<table>
<tr><th>Skill</th><th>Element</th><th>Kind</th><th>Power</th><th>Scaling</th><th>Target</th><th>MP</th><th>CD</th><th>Notes</th></tr>
<tr><td>Slashing Strike</td><td>Earth</td><td>damage</td><td>45</td><td>ATK</td><td>single</td><td>4</td><td>—</td><td></td></tr>
<tr><td>Shield Bash</td><td>Earth</td><td>damage</td><td>35</td><td>ATK</td><td>single</td><td>5</td><td>2</td><td>DEF debuff 0.8× 2t</td></tr>
<tr><td>Iron Guard</td><td>Earth</td><td>buff</td><td>—</td><td>HP</td><td>self</td><td>6</td><td>3</td><td>DEF buff 1.3× 3t</td></tr>
<tr><td>Flame Slash</td><td>Fire</td><td>damage</td><td>50</td><td>ATK</td><td>single</td><td>5</td><td>—</td><td></td></tr>
<tr><td>Berserk Strike</td><td>Fire</td><td>damage</td><td>60</td><td>ATK</td><td>single</td><td>6</td><td>1</td><td></td></tr>
<tr><td>Battle Fury</td><td>Fire</td><td>buff</td><td>—</td><td>HP</td><td>self</td><td>6</td><td>3</td><td>ATK buff 1.25× 3t</td></tr>
<tr><td>Backstab</td><td>Shadow</td><td>damage</td><td>55</td><td>ATK</td><td>single</td><td>5</td><td>—</td><td></td></tr>
<tr><td>Poison Blade</td><td>Shadow</td><td>damage</td><td>40</td><td>ATK</td><td>single</td><td>4</td><td>—</td><td>Poison 5 3t</td></tr>
<tr><td>Shadow Bolt</td><td>Shadow</td><td>damage</td><td>45</td><td>MAG</td><td>single</td><td>5</td><td>—</td><td></td></tr>
<tr><td>Rapid Shot</td><td>Water</td><td>damage</td><td>30</td><td>ATK</td><td>single</td><td>3</td><td>—</td><td></td></tr>
<tr><td>Frost Arrow</td><td>Frost</td><td>damage</td><td>45</td><td>ATK</td><td>single</td><td>5</td><td>—</td><td></td></tr>
<tr><td>Tri-Shot</td><td>None</td><td>damage</td><td>30</td><td>ATK</td><td>single</td><td>4</td><td>—</td><td></td></tr>
<tr><td>Fireball</td><td>Fire</td><td>damage</td><td>55</td><td>MAG</td><td>single</td><td>6</td><td>—</td><td></td></tr>
<tr><td>Frost Bite</td><td>Frost</td><td>damage</td><td>45</td><td>MAG</td><td>single</td><td>5</td><td>—</td><td>SPD debuff 0.7× 2t</td></tr>
<tr><td>Flame Wave</td><td>Fire</td><td>damage</td><td>40</td><td>MAG</td><td>all</td><td>8</td><td>2</td><td>AoE</td></tr>
<tr><td>Arcane Bolt</td><td>None</td><td>damage</td><td>40</td><td>MAG</td><td>single</td><td>4</td><td>—</td><td></td></tr>
<tr><td>Heal</td><td>Holy</td><td>heal</td><td>60</td><td>MAG</td><td>single</td><td>5</td><td>—</td><td></td></tr>
<tr><td>Cleanse</td><td>Holy</td><td>utility</td><td>—</td><td>HP</td><td>single</td><td>4</td><td>—</td><td>Removes debuffs</td></tr>
<tr><td>Holy Light</td><td>Holy</td><td>damage</td><td>45</td><td>MAG</td><td>single</td><td>5</td><td>—</td><td></td></tr>
<tr><td>Greater Heal</td><td>Holy</td><td>heal</td><td>120</td><td>MAG</td><td>single</td><td>8</td><td>—</td><td></td></tr>
<tr><td>Battle Anthem</td><td>Frost</td><td>buff</td><td>—</td><td>HP</td><td>all allies</td><td>6</td><td>3</td><td>ATK buff 1.2× 3t</td></tr>
<tr><td>Ice Song</td><td>Frost</td><td>damage</td><td>40</td><td>MAG</td><td>single</td><td>5</td><td>—</td><td></td></tr>
<tr><td>Soothing Song</td><td>Frost</td><td>heal</td><td>50</td><td>MAG</td><td>single</td><td>5</td><td>—</td><td></td></tr>
<tr><td>Slow Rhythm</td><td>Frost</td><td>debuff</td><td>—</td><td>HP</td><td>all enemies</td><td>6</td><td>3</td><td>SPD debuff 0.7× 2t</td></tr>
<tr><td>Thorns ⚡</td><td>Earth</td><td>damage</td><td>40</td><td>ATK</td><td>single</td><td>4</td><td>—</td><td>Reaction: attacked</td></tr>
<tr><td>Steal ⚡</td><td>Shadow</td><td>damage</td><td>30</td><td>ATK</td><td>single</td><td>6</td><td>—</td><td>Reaction: evaded</td></tr>
<tr><td>Guardian's Vow ⚡</td><td>Earth</td><td>damage</td><td>35</td><td>ATK</td><td>single</td><td>5</td><td>—</td><td>Reaction: ally attacked</td></tr>
</table>

<h3>Element Chart</h3>

<table>
<tr><th></th><th>→ Frost</th><th>→ Water</th><th>→ Fire</th><th>→ Holy</th><th>→ Shadow</th><th>→ Earth</th></tr>
<tr><th>Fire</th><td style="color:var(--green);font-weight:bold">2×</td><td style="color:var(--red)">½×</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>
<tr><th>Water</th><td style="color:var(--red)">½×</td><td>—</td><td style="color:var(--green);font-weight:bold">2×</td><td>—</td><td>—</td><td>—</td></tr>
<tr><th>Frost</th><td>—</td><td style="color:var(--green);font-weight:bold">2×</td><td style="color:var(--red)">½×</td><td>—</td><td>—</td><td>—</td></tr>
<tr><th>Earth</th><td>—</td><td>—</td><td>—</td><td style="color:var(--green);font-weight:bold">2×</td><td style="color:var(--red)">½×</td><td>—</td></tr>
<tr><th>Holy</th><td>—</td><td>—</td><td>—</td><td>—</td><td style="color:var(--green);font-weight:bold">2×</td><td style="color:var(--red)">½×</td></tr>
<tr><th>Shadow</th><td>—</td><td>—</td><td>—</td><td style="color:var(--red)">½×</td><td>—</td><td style="color:var(--green);font-weight:bold">2×</td></tr>
</table>

<h3>Status Effects</h3>

<table>
<tr><th>Status</th><th>Category</th><th>Effect</th></tr>
<tr><td><span class="badge status">Stat Buff</span></td><td>Buff</td><td>Increases a stat by a multiplier (e.g. ATK ×1.25)</td></tr>
<tr><td><span class="badge status">Stat Debuff</span></td><td>Debuff</td><td>Decreases a stat by a multiplier (e.g. DEF ×0.8)</td></tr>
<tr><td><span class="badge status">Regen</span></td><td>Buff</td><td>Restores HP each turn</td></tr>
<tr><td><span class="badge status">Shield</span></td><td>Buff</td><td>Absorbs incoming damage</td></tr>
<tr><td><span class="badge status">Taunt</span></td><td>Buff</td><td>Forces enemies to target this actor</td></tr>
<tr><td><span class="badge status">Poison</span></td><td>Debuff</td><td>Deals damage each turn</td></tr>
<tr><td><span class="badge status">Burn</span></td><td>Debuff</td><td>Deals fire damage each turn</td></tr>
<tr><td><span class="badge status">Freeze</span></td><td>Debuff</td><td>Prevents acting for a turn</td></tr>
<tr><td><span class="badge status">Sleep</span></td><td>Debuff</td><td>Prevents acting until damaged</td></tr>
<tr><td><span class="badge status">Blind</span></td><td>Debuff</td><td>Reduces accuracy / causes misses</td></tr>
<tr><td><span class="badge status">Stun</span></td><td>Debuff</td><td>Skips the next turn</td></tr>
</table>

<h3>Enemy Reference</h3>

<table>
<tr><th>Enemy</th><th>Element</th><th>Level</th><th>Rank</th><th>HP</th><th>ATK</th><th>DEF</th><th>MAG</th><th>RES</th><th>SPD</th></tr>
<tr><td>Slime</td><td>Water</td><td>1</td><td>—</td><td>40</td><td>8</td><td>6</td><td>3</td><td>4</td><td>4</td></tr>
<tr><td>Goblin</td><td>None</td><td>2</td><td>—</td><td>45</td><td>12</td><td>6</td><td>3</td><td>4</td><td>8</td></tr>
<tr><td>Fire Elemental</td><td>Fire</td><td>3</td><td>—</td><td>55</td><td>10</td><td>7</td><td>14</td><td>8</td><td>9</td></tr>
<tr><td>Frost Wraith</td><td>Frost</td><td>3</td><td>—</td><td>50</td><td>9</td><td>6</td><td>15</td><td>9</td><td>10</td></tr>
<tr><td>Shadow Assassin</td><td>Shadow</td><td>4</td><td>—</td><td>60</td><td>16</td><td>8</td><td>8</td><td>7</td><td>13</td></tr>
<tr><td>Earth Golem</td><td>Earth</td><td>4</td><td>Tanky</td><td>110</td><td>13</td><td>14</td><td>4</td><td>10</td><td>5</td></tr>
<tr><td>Holy Guardian</td><td>Holy</td><td>5</td><td>Tanky</td><td>100</td><td>12</td><td>12</td><td>12</td><td>14</td><td>7</td></tr>
<tr><td>Goblin King</td><td>None</td><td>6</td><td style="color:var(--gold);font-weight:bold">Boss</td><td>180</td><td>18</td><td>12</td><td>10</td><td>10</td><td>9</td></tr>
</table>

<hr>

<h2 id="tips">Tips & Best Practices</h2>

<div class="callout">
  <strong>Priority matters:</strong> Rules are evaluated top-to-bottom. Put critical rules (healing, emergency actions) at the top, and general damage rules below.
</div>

<div class="callout">
  <strong>MP gating:</strong> Use <code>MP > X%</code> conditions to prevent wasting MP early. Pair with <code>Can cast [skill]</code> to ensure the skill is affordable.
</div>

<div class="callout">
  <strong>Fallback is safety:</strong> Always set a useful fallback. "Attack Random Enemy" is the standard; "Defend" is good for healers who are out of MP.
</div>

<div class="callout tip">
  <strong>Test edge cases:</strong> Use the dry-run to check: what happens at 0% HP? At 100% MP? On turn 1 vs turn 20? With no items? This catches bugs before they cost you a permadeath.
</div>

<div class="callout tip">
  <strong>Reactions are optional:</strong> You don't need reactions. Most characters work fine with just the rule stack. Add reactions only when you have specific reaction skills (Thorns, Steal, Guardian's Vow) that benefit from event-driven triggers.
</div>

<div class="callout warn">
  <strong>Built-in scripts are read-only:</strong> You can't edit the Aggressive DPS or Healer built-ins. Duplicate them first, then customize the copy.
</div>

<div class="callout info">
  <strong>Library capacity:</strong> You can store up to 50 scripts in your library. Plan wisely if you have many characters to manage.
</div>

<hr>

<h2 id="troubleshooting">Troubleshooting</h2>

<table>
<tr><th>Problem</th><th>Fix</th></tr>
<tr><td>Script isn't firing any rules</td><td>Check that conditions aren't too restrictive. Use <code>always</code> to test. Verify MP/HP thresholds against your character's stats.</td></tr>
<tr><td>Wrong skill is selected</td><td>Use the <span class="badge type">specific</span> selector to lock to one skill. Check that the skill selector filters match what you expect.</td></tr>
<tr><td>Reaction never fires</td><td>Verify: (1) actor knows the reaction skill, (2) event type matches gate, (3) source/target filters match, (4) all conditions pass, (5) skill has <code>reactionTo</code> matching the event.</td></tr>
<tr><td>Nested block doesn't evaluate</td><td>Check nesting depth (max 2 levels). Ensure the parent block's trigger conditions pass. Verify the nested rules have valid conditions (1–3 per trigger).</td></tr>
<tr><td>"Can cast" always returns false</td><td>The actor must know the skill AND have enough MP AND the cooldown must be ready. Check all three.</td></tr>
<tr><td>Fallback fires unexpectedly</td><td>A rule above matched but its action failed (wrong target, no valid skill). Check the rule's action selector against the actor's known skills.</td></tr>
</table>

<hr>

<p style="color: var(--text-dim); text-align: center; margin-top: 2rem;">
  <em>Covenant of Crystals — Battle Script Grimoire Documentation</em>
</p>

</body>
</html>
