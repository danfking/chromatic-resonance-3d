# Autonomous Polish Pipeline — From Concept to Playable Game

## Problem Statement

The current agent team builds features but doesn't **play the game** or **think about game design**. This creates two gaps:

1. **Functional gap**: Code that passes tests but feels broken (perpetual-motion bug — all 38 tests passed, car never stops)
2. **Creative gap**: No agent challenges design decisions, evaluates visual quality, or thinks about whether the game is actually fun

---

## Architecture: Claude Code Teams

### Team Structure: `game-polish`

```
┌────────────────────────────────────────────────────────────────────┐
│                     TEAM LEAD (main session)                       │
│  Spawns agents, routes tasks, sends human notifications            │
│  Final authority on design escalations                             │
├────────────────┬────────────────┬──────────────┬──────────────────┤
│ game-director  │  gameplay-sim  │  developer   │  qa-tester       │
│ (STRATEGIC)    │  (EXPERIENTIAL)│  (TACTICAL)  │  (VERIFICATION)  │
│                │                │              │                  │
│ Reviews every  │ Plays game via │ Fixes code   │ Runs test suites │
│ change for     │ Playwright +   │ per director │ Visual + unit    │
│ design intent  │ screenshots    │ guidance     │ regression       │
│                │                │              │                  │
│ Challenges     │ Takes + judges │ Proposes 2-3 │ Takes before/    │
│ developer      │ screenshots    │ approaches,  │ after screenshots│
│ decisions      │ at key moments │ director     │ for comparison   │
│                │                │ picks one    │                  │
│ Writes design  │ Evaluates      │              │                  │
│ preferences    │ "does this     │ Implements   │ Reports visual   │
│ to memory      │ feel fun?"     │ chosen fix   │ regressions      │
│                │                │              │                  │
│ Escalates to   │ Reports both   │              │                  │
│ human with     │ metrics AND    │              │                  │
│ context +      │ visual quality │              │                  │
│ recommendation │                │              │                  │
└────────────────┴────────────────┴──────────────┴──────────────────┘
```

### Agent Roles

#### Game Director (NEW — the missing brain)

**Purpose**: The agent that thinks about whether the game is good, not just whether the code works.

**Responsibilities**:
- Reviews EVERY fix before it ships — not for code correctness but for design alignment
- Maintains a living **design preferences file** (`.agents/state/design-preferences.json`) that accumulates human decisions so the same question is never asked twice
- Challenges developer's choices: "You set ENGINE_BRAKING to 3.0 — did you test 2.0 and 5.0? Which feels best for an arcade game about a slime hijacking cars?"
- Evaluates screenshots from gameplay-sim: "The terrain looks repetitive in this area" or "The ragdoll looks too stiff, increase joint looseness"
- Frames design decisions for the human with context and a recommendation: "The vehicle stops in 3.3 seconds. For a cartoony arcade game this feels slightly too abrupt. I recommend 2.0 m/s² (4.5 sec stop) over 3.0 m/s² (3.3 sec). Approve?"
- Thinks about the "30 seconds of fun" loop holistically — not individual bugs

**What it reads**:
- `docs/VEHICLE-COMBAT-DESIGN.md` — the game design vision
- `.agents/state/design-preferences.json` — accumulated human decisions
- Screenshots from gameplay-sim and qa-tester
- Developer's proposed fixes (before they're applied)

**What it writes**:
- Design review comments on each task
- Updated design preferences when human makes a decision
- "Design debt" tasks — things that work but don't serve the game vision

#### Gameplay Sim (Enhanced — now with eyes)

**Purpose**: Play the game AND look at it.

**Dual output per scenario**:
1. **Metrics**: speed, FPS, position, state transitions (numeric pass/fail)
2. **Screenshots**: Captured at key moments, evaluated for visual quality

```javascript
// Example: not just "speed < 0.5" but also "does the stop LOOK good?"
async function scenarioCoastToStop(page) {
    // ... drive and release ...

    // Numeric check
    const speed = await page.evaluate(() =>
        window.game?.vehicleCombat?.vehicleController?.physics?.speed);

    // Visual check — take screenshot of the stopped vehicle
    const screenshot = await page.screenshot({ path: 'coast-stop.png' });

    return {
        metrics: { speed, pass: Math.abs(speed) < 0.5 },
        screenshot: 'coast-stop.png',
        visualPrompt: 'Does the vehicle look naturally stopped? Is it on terrain properly? Any visual artifacts?',
    };
}
```

The game director reviews the screenshots (Claude has vision capabilities) and can flag visual issues that metrics can't catch:
- "The vehicle is hovering 2 feet above the ground"
- "The camera angle makes it hard to see enemies approaching"
- "The terrain texture is stretched on that hillside"

#### Developer (Enhanced — proposes alternatives)

Instead of silently applying a fix, the developer:
1. Reads the issue + game director's design context
2. Proposes 2-3 approaches with trade-offs
3. Sends to game director for selection
4. Implements the chosen approach
5. Takes before/after screenshots

```
Developer → Director: "Engine braking fix — 3 options:
  A) Constant 3.0 m/s² decel (stops in 3.3s, feels snappy)
  B) Speed-proportional 0.3*speed (stops in 5s, gradual feel)
  C) Ease-out curve (fast initial decel, gentle final stop)
  I recommend C for arcade feel. Which do you prefer?"

Director → Developer: "C, but cap minimum decel at 1.0 so it
  doesn't creep forever at low speed. This aligns with the
  'snappy but not jarring' design preference from iteration 2."
```

#### QA Tester (Enhanced — visual regression)

Before/after screenshot comparison for every fix:
1. Capture 5 camera angles before developer's change
2. Developer applies fix
3. Capture same 5 angles after
4. Compare: any visual regressions?
5. Report to director with side-by-side evidence

---

## Design Preferences — Accumulated Learning

The key to self-improvement: **the team remembers every design decision**.

```json
// .agents/state/design-preferences.json
{
    "version": 1,
    "lastUpdated": "2026-02-08",
    "preferences": [
        {
            "id": "dp-001",
            "category": "vehicle-feel",
            "decision": "Vehicle should stop within 3-5 seconds of releasing gas",
            "reasoning": "Arcade feel — snappy but not jarring",
            "decidedBy": "human",
            "iteration": 2,
            "relatedFiles": ["jeep-physics.js", "vehicle-physics-4x4.js"]
        },
        {
            "id": "dp-002",
            "category": "combat-feel",
            "decision": "Ragdoll force = 45 (comic over realistic)",
            "reasoning": "Matches TABS comedy style, human said '45 not 15'",
            "decidedBy": "human",
            "iteration": 3,
            "relatedFiles": ["ragdoll-physics.js"]
        },
        {
            "id": "dp-003",
            "category": "visual-style",
            "decision": "NPR color transfer strength max 0.20",
            "reasoning": "Higher kills sky blue. Keep BotW warmth but preserve sky.",
            "decidedBy": "agent-director",
            "approved": true,
            "iteration": 1,
            "relatedFiles": ["npr-pipeline.js", "outdoor-level.js"]
        }
    ],
    "principles": [
        "Comedy over realism — this is a game about a slime stealing cars",
        "Snappy controls — respond immediately to input, no sluggishness",
        "Visual clarity — player should always know what's happening",
        "Art direction is under review — do NOT invest in watercolor/NPR visual polish. Sable-style (bold outlines, flat colors) PoC is planned after gameplay systems are complete. Focus on gameplay feel, not rendering aesthetics."
    ]
}
```

When the director faces a new decision similar to a past one, it checks preferences first:
- "Ragdoll stiffness question → I see dp-002 says 'comic over realistic' → I'll default to the looser/funnier option and note why"
- Only escalates to human if genuinely novel or conflicts with existing preferences

---

## Visual Verification Pipeline

### Full Playtest (MANDATORY — P0 — Added Feb 2026)

**Why this exists:** The alpha-build agent team wrote 18 tasks worth of gameplay systems, tested state machines via `page.evaluate()`, and declared the build "smoke-tested." But NO agent ever clicked "New Blob" and played the game. Result: the `main-menu.js` dispatched `game-paused` but never `game-resumed`, leaving the entire game loop frozen after starting a run. Vehicle never built. Enemies never moved. Spark core never unlocked. All because `this.isPaused` was stuck `true` — a bug that ANY 10-second playtest would have caught.

**Rule: Every agent sprint MUST include a full-loop playtest via Playwright MCP before marking the sprint complete. This is NON-NEGOTIABLE and takes priority over all other verification.**

#### What the Playtest Covers

The playtest walks through the complete player experience:

1. **Main Menu → Zone 0**: Click "New Blob", wait for zone to load, verify PLAYING state
2. **Core Systems Check**: Verify via `window._gameInstance` that:
   - `runManager.getState() === 'PLAYING'`
   - `isPaused === false` (CRITICAL — this was the P0 bug)
   - `vehicleBuilder.functional === true` (starter vehicle built)
   - `coreSystem.cores.spark.unlocked === true` (spark core collected)
   - `enemyManager.enemies` has alive enemies with distributed positions
   - All enemies have `wobblerParts !== null` (wobbler mesh created)
3. **Visual Screenshot**: Take screenshot of gameplay — verify:
   - No terrain void/holes
   - Player blob visible
   - Vehicle mesh visible
   - Enemies visible (wobbler stick figures)
   - No stale UI overlays from menu state
4. **Combat Test**: Walk near enemies, verify they move/attack (confirm `update()` runs)
5. **Death → Restart Loop**: Die or kill enemies → death screen → "Try Again" → verify Zone 0 loads cleanly with no stale state

#### Playwright MCP Playtest Script

```javascript
// === STEP 1: Navigate and start run ===
// browser_navigate to http://localhost:8086/
// Wait 2s for init
// browser_click "New Blob" button
// Wait 3s for zone generation + ZONE_INTRO → PLAYING transition

// === STEP 2: Core systems check via evaluate ===
const state = await page.evaluate(() => {
    const gi = window._gameInstance;
    if (!gi) return { error: 'No game instance' };

    const rm = gi.runManager;
    const vb = gi.vehicleBuilder;
    const cs = gi.coreSystem;
    const em = gi.enemyManager;

    const enemies = em?.enemies?.map(e => ({
        type: e.typeKey,
        pos: e.mesh ? `(${e.mesh.position.x.toFixed(0)},${e.mesh.position.z.toFixed(0)})` : 'no mesh',
        alive: !e.isDead,
        hasWobbler: !!e.wobblerParts,
    })) || [];

    // Check enemies aren't all stacked at same position
    const positions = enemies.map(e => e.pos);
    const uniquePositions = new Set(positions).size;

    return {
        runState: rm?.getState(),
        isPaused: gi.isPaused,
        vehicleFunctional: vb?.functional,
        vehicleSlots: vb ? JSON.parse(JSON.stringify(vb.slots)) : null,
        sparkUnlocked: cs?.cores?.spark?.unlocked,
        enemyCount: enemies.length,
        enemiesAlive: enemies.filter(e => e.alive).length,
        allHaveWobblers: enemies.every(e => e.hasWobbler),
        uniqueEnemyPositions: uniquePositions,
        enemies: enemies.slice(0, 3),
    };
});

// === STEP 3: Assertions (ALL must pass) ===
const CHECKS = [
    ['runState === PLAYING',       state.runState === 'PLAYING'],
    ['isPaused === false',         state.isPaused === false],
    ['vehicle functional',         state.vehicleFunctional === true],
    ['vehicle has chassis',        state.vehicleSlots?.chassis !== null],
    ['spark core unlocked',        state.sparkUnlocked === true],
    ['enemies spawned',            state.enemyCount >= 4],
    ['enemies alive',              state.enemiesAlive >= 1],
    ['enemies have wobblers',      state.allHaveWobblers === true],
    ['enemies not stacked',        state.uniqueEnemyPositions >= 3],
];
const failures = CHECKS.filter(([_, pass]) => !pass).map(([name]) => name);
// If failures.length > 0 → P0 BLOCKER, do not ship

// === STEP 4: Take gameplay screenshot ===
// browser_take_screenshot → verify visually:
//   - Terrain solid (no void/holes)
//   - Player blob visible (red/colored particle mass)
//   - Vehicle visible (box/mesh near player)
//   - At least 1 enemy visible (stick figure wobbler)
//   - No menu/loading/death screens visible
//   - Gold counter "G 0" visible in corner

// === STEP 5: Console error check ===
// browser_console_messages level=error
// Acceptable: pointer lock errors (headless limitation)
// NOT acceptable: TypeError, ReferenceError, null access in game loop
```

#### When to Run

| Trigger | Required? | Notes |
|---------|-----------|-------|
| After implementing ANY gameplay system | YES | Even "small" changes can break the game loop |
| After modifying main.js | YES | Main.js owns the animate loop and event wiring |
| After modifying any UI file | YES | UI files dispatch game-paused/game-resumed |
| After modifying run-manager.js | YES | State machine drives everything |
| End of every sprint | YES | Final verification before declaring work complete |
| Start of every sprint | RECOMMENDED | Establish baseline — know what's already broken |

#### Access Pattern

**Game instance**: `window._gameInstance` (NOT `window.game`)
**Run state**: `window._gameInstance.runManager.getState()`
**Vehicle**: `window._gameInstance.vehicleBuilder` (slots store string IDs like `'labCart'`)
**Enemies**: `window._gameInstance.enemyManager.enemies[]`
**Core system**: `window._gameInstance.coreSystem`
**Paused flag**: `window._gameInstance.isPaused` (check this FIRST — if true, nothing works)

#### Common Failures and Root Causes

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| `isPaused === true` during PLAYING | UI dispatched `game-paused` without matching `game-resumed` | Ensure every show/hide pair has paired pause/resume events |
| Vehicle slots all null | Pickup orbs not collected (isPaused, or orb position != player position) | Check isPaused, verify orb y matches terrain height |
| Enemies at same position | `_populateZone()` called before `setSpawnBounds()` | Ensure spawn bounds set during ZONE_INTRO, before PLAYING |
| Enemies have no wobblers | `HUMAN_TYPES[type]` undefined | Add missing type to `human-wobbler.js HUMAN_TYPES` |
| Terrain void/hole | Two terrain meshes overlapping (boot level not disposed) | Dispose `this.testLevel` before generating zone |
| Stale UI from menu | `hideAll()`/`hideMenu()` doesn't dispatch `game-resumed` | Add `game-resumed` dispatch to hide methods |

### UI Visibility Verification (MANDATORY — Added Feb 2026)

**Why this exists:** The alpha-build agent team tested state machine transitions via `page.evaluate()` but never verified what the player actually sees. This led to 5 legacy UI elements (#color-inventory, #ability-bar, #combo-display, #hud, wave notification) being visible during gameplay, cluttering the screen.

**Rule: Every agent sprint MUST run `npm run test:ui` or the equivalent Playwright MCP checks before marking work complete.**

#### What to Check in Every Game State

For each state (MENU, PLAYING, DEAD, VICTORY, SHOP), verify:
1. **Correct screens visible** — Only the screen for that state should show
2. **Legacy UI hidden** — All elements in the RunHUD hide list must have `display: none`
3. **Loading overlay hidden** — `#loading-overlay` must have `.hidden` class during gameplay
4. **No stale overlays** — Zone intro, lore panel, NPC dialogue must not persist across states
5. **Take a screenshot** — Visual confirmation that the player sees a clean screen

#### How to Run

**Option A: npm script** (standalone, full test)
```bash
npm run test:ui
```

**Option B: Playwright MCP** (agent workflow, per-state check)
```javascript
// After navigating to the game and reaching PLAYING state:
const result = await page.evaluate(() => {
    const LEGACY = ['#color-inventory','#ability-bar','#combo-display','#wave-notification',
        '#hud','#player-health','#progression-ui','#minimap','#wand-hud','#spell-menu',
        '#equipment-hud','#equipment-panel','#debug-info','#crosshair','#color-tooltip',
        '#controls-hint','#floating-text-container','#lore-overlay','#boss-announcement',
        '#boss-health-bar'];
    const failures = [];
    LEGACY.forEach(sel => {
        const el = document.querySelector(sel);
        if (!el) return;
        const s = window.getComputedStyle(el);
        if (s.display !== 'none' && parseFloat(s.opacity) !== 0) {
            failures.push(`${sel} is visible (display: ${s.display}, opacity: ${s.opacity})`);
        }
    });
    return { pass: failures.length === 0, failures };
});
```

#### When Adding New UI Elements

If you create a new UI element (DOM div with an id), you MUST either:
1. Add it to the RunHUD CSS hide list in `src/ui/run-hud.js` (if it's legacy/not needed during runs)
2. Manage its visibility explicitly in the state change handler
3. Update the `LEGACY_ELEMENTS` array in `tests/ui-visibility-test.js`

**Test file:** `tests/ui-visibility-test.js`
**Key source:** `src/ui/run-hud.js` (CSS hide list)

### What Agents Can See

Using Playwright MCP (`browser_take_screenshot`) + Claude's vision:

| Check | Tool | What It Catches |
|-------|------|-----------------|
| Game loads correctly | Screenshot at t=3s | Black screen, crash, missing assets |
| **UI clean during gameplay** | **`npm run test:ui`** | **Legacy HUD leaking, stale overlays, loading overlay stuck** |
| Vehicle visible at spawn | Screenshot facing forward | Spawn position bugs, missing mesh |
| Terrain quality | 5 angles (overview, ground, horizon, close, sky) | Repetitive textures, z-fighting, gaps |
| Enter/exit animation | 4 screenshots during transition | Glitchy particles, popup, clipping |
| Combat impact | Screenshot on enemy hit | Ragdoll working, hit effects visible |
| Damage progression | Screenshots at 80%, 40%, 10% HP | Smoke, dents, fire effects visible |
| Style consistency | Lab color distance measurement | NPR pipeline drift, color issues |

### Visual Review Flow

```
gameplay-sim takes screenshot → sends to game-director via task description
game-director evaluates screenshot:
  "Screenshot coast-stop.png: Vehicle is properly on terrain, no floating.
   BUT the shadow is clipping through a rock on the right side.
   Filing P3 task for developer."

qa-tester takes before/after screenshots:
  "Before fix: vehicle floating 0.3m above ground at (105, 2.3, 94)
   After fix: vehicle resting on ground at (105, 0.45, 94)
   Visual regression check: PASS — no new artifacts introduced"
```

---

## Cross-Agent Challenge Protocol

The director doesn't just rubber-stamp fixes. For every P1+ issue:

```
1. Developer sends fix proposal → director
2. Director challenges:
   - "Why this value and not ±50%?"
   - "Does this fix the symptom or the root cause?"
   - "How does this affect the feel at different speeds/scenarios?"
   - "Show me a screenshot proving it looks right"
3. Developer responds with evidence (test output, screenshots)
4. Director approves or requests revision
5. Only then does qa-tester run regression
```

For P2 (feel) issues, the director may request A/B comparison:
```
Director → Developer: "Implement both ENGINE_BRAKING = 2.0 and 3.0.
  Run coast-to-stop scenario with each. Send me the stop times
  and a screenshot of each at the moment of stopping."

Developer runs both, reports:
  "2.0: stops in 4.5s, screenshot shows gentle coast"
  "3.0: stops in 3.3s, screenshot shows snappier stop"

Director evaluates against design preferences:
  "dp-001 says 'snappy but not jarring'. 3.0 feels right.
   But I want ease-out behavior so the last 0.5 m/s fades gently.
   Developer, add a soft landing zone below speed 1.0."
```

---

## Human Notification System

### ntfy.sh (Recommended — zero setup)

```javascript
// .agents/scripts/notify.js
const NTFY_TOPIC = process.env.NTFY_TOPIC || 'chromatic-polish-x9k2j';

export async function notifyHuman(title, message, priority = 'default') {
    try {
        await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
            method: 'POST',
            headers: {
                'Title': title,
                'Priority': priority,
                'Tags': 'robot,video_game',
            },
            body: message,
        });
    } catch (err) {
        console.error('[NOTIFY] Failed:', err.message);
    }
}
```

### Notification Tiers

| Event | Priority | Who Triggers |
|-------|----------|-------------|
| All scenarios pass | max | Lead |
| P0 bug found | max | Gameplay-sim → Lead |
| Design decision (novel) | high | Director → Lead → Human |
| Design decision (has precedent) | none | Director decides autonomously |
| Iteration progress | low | Lead (every 2 iterations) |
| Agent blocked | default | Any agent → Lead |
| Visual regression detected | high | QA-tester → Director → Lead |

### What the Director Handles Autonomously (No Human Needed)

- Decisions covered by existing design preferences
- Code-level choices (algorithm, data structure) — only game-feel matters
- P3 visual glitches with obvious fixes
- Parameter tuning within established ranges

### What Gets Escalated to Human

- Novel design direction ("Should we add a minimap to the vehicle HUD?")
- Conflicting preferences ("Snappy controls vs heavy vehicle feel")
- Subjective visual quality ("Does this terrain look good enough?")
- Architecture decisions ("Should we refactor the physics to support motorcycles?")
- Any P0 that fails after 3 fix attempts

---

## Execution Flow

### Startup

```
User: "Start the game polish team"

Lead:
  1. TeamCreate('game-polish')
  2. TaskCreate: "Establish design preferences baseline"
  3. TaskCreate: "Run gameplay scenarios (iteration 1)"
  4. TaskCreate × 14: One per gameplay scenario
  5. Spawn game-director (reads design docs + preferences)
  6. Spawn gameplay-sim (starts Playwright, runs scenarios)
  7. Spawn developer (waits for issues)
  8. Spawn qa-tester (waits for fixes to verify)
  9. Notify human: "Polish team active. Will notify on decisions/completion."
```

### Iteration Loop

```
gameplay-sim: Runs scenarios, takes screenshots, files issues as tasks
     ↓
game-director: Reviews issues + screenshots, prioritizes, adds design context
     ↓
game-director → developer: "Fix P1 #4. Here's the design intent. Propose 2 options."
     ↓
developer: Proposes options with evidence
     ↓
game-director: Picks option (or escalates to human if novel)
     ↓
developer: Implements chosen fix + updates PROJECT-STATUS.md / CLAUDE.md
     ↓
qa-tester: Runs regression + visual before/after
     ↓
game-director: Reviews qa results + screenshots, approves or requests revision
     ↓
gameplay-sim: Re-runs failing scenarios
     ↓
LOOP until all pass or iteration limit
     ↓
lead: Creates "Sprint Retro" task — doc audit, lessons learned, next sprint prep
```

### Example Conversation Between Agents

```
[gameplay-sim → lead]
"Iteration 1 complete. 8/14 pass. Screenshots in .agents/data/polish/iter-1/.
Filed 6 issue tasks. Key findings:
- P1: Vehicle never stops (coast speed 9.5 after 10s)
- P1: Can't enter vehicle (E key not working)
- P2: Camera clips terrain on hills
- P2: Enter animation instant (no particle transfer visible)
- P3: Shadow artifacts on rocks
- P3: FPS dips to 28 with 40 enemies"

[director → developer]
"Fix P1 vehicle-never-stops. Design context: this is an arcade game
about a wobbly slime stealing cars. The stop should feel SNAPPY —
player releases gas, car stops in 3-5 seconds. Not realistic physics
drag, but game-feel engine braking. Propose 2 approaches."

[developer → director]
"Two options for engine braking:
A) Constant 3.0 m/s² when throttle=0. Stops from 10 m/s in 3.3s.
   Simple, predictable. But feels slightly robotic at the end.
B) 3.0 m/s² with ease-out below 2 m/s (halves to 1.5).
   Stops in ~4s. Final meter feels smooth, not abrupt.
Screenshots of each: A=coast-A.png, B=coast-B.png
Recommendation: B — matches 'snappy but not jarring'."

[director → developer]
"Go with B. Adding to design preferences:
{category: 'vehicle-feel', decision: 'Engine braking uses ease-out
curve for smooth final stop', reasoning: 'Arcade snappy + gentle landing'}
Implement it."

[developer → director]
"Implemented in jeep-physics.js and vehicle-physics-4x4.js.
Coast-to-stop now 4.1s from speed 10. Sanity test passes.
Before/after screenshots attached."

[director → qa-tester]
"Developer fixed engine braking. Run full regression + capture
5-angle visual comparison."

[qa-tester → director]
"37/37 physics, 24/24 jeep regression — all pass.
Visual comparison: no regressions detected.
Before: vehicle floating at speed 9.5 after 10s
After: vehicle stationary after 4.1s"

[director → lead]
"P1 vehicle-never-stops RESOLVED. Fix verified, design-aligned,
no regressions. Ready for next issue."
```

---

## Self-Improvement Mechanisms

### 1. Design Preferences Accumulation
Every human decision is recorded with context. The director checks this FIRST before escalating, reducing human interruptions over time.

### 2. Fix Pattern Library
When a fix works, the developer records the pattern:
```json
{
    "pattern": "missing-force-in-physics",
    "symptom": "Object doesn't decelerate naturally",
    "fix": "Add constant braking force when input is zero",
    "files": ["*-physics.js"],
    "lesson": "Always test zero-input coasting, not just active braking"
}
```
Next time a similar symptom appears, the developer tries the known pattern first.

### 3. Scenario Library Growth
When a bug is found manually (by the human), gameplay-sim adds a permanent scenario to prevent regression:
```
Human reports: "The car flies off cliffs"
→ New scenario: "drive-off-cliff" — drive toward steep drop, verify vehicle follows terrain
→ This scenario runs in every future iteration
```

### 4. Visual Baseline Evolution
QA-tester maintains "known good" screenshots. After each successful iteration, the baselines update. Visual regressions are caught by comparing against the latest approved baseline, not a static reference from months ago.

### 5. Documentation Keeping (Post-Task Rule)

**Every agent must update project docs after completing a task.** This prevents docs from drifting out of sync with the codebase — a problem that wastes time when agents (or humans) make decisions based on stale information.

**Rule**: After completing any task that changes code, the implementing agent MUST:

1. Update **`docs/PROJECT-STATUS.md`** if the task changes:
   - Feature completion status (mark items complete, add new items)
   - URL parameters or level types
   - System capabilities or known issues

2. Update **`CLAUDE.md`** if the task changes:
   - Architecture (new files, renamed files, removed files)
   - Feature status ("In Progress" → "Completed", new "Planned" items)
   - Controls, key bindings, or user-facing behavior
   - System descriptions (new capabilities, changed behavior)

3. Update **`.agents/state/design-preferences.json`** if the task involves:
   - A design decision (even if made autonomously by the director)
   - A parameter tuning choice with rationale

**What NOT to update**: Don't update docs for pure bug fixes that don't change feature status, or for internal refactors that don't affect the architecture description.

**Enforcement**: The team lead should verify doc updates are included in the task completion message. If an agent marks a task complete without mentioning doc updates, the lead sends it back: "Task marked complete but PROJECT-STATUS.md still shows [X] as 'Not Started'. Update docs before closing."

### 6. Sprint Retro (End-of-Sprint Task)

**After all sprint tasks are complete**, the team lead creates a final retro task:

```
TaskCreate:
  subject: "Sprint Retro — review and sync"
  description: |
    End-of-sprint review. Complete ALL of the following:

    1. DOC AUDIT
       - Read docs/PROJECT-STATUS.md and CLAUDE.md
       - Verify every completed task is reflected (status, features, file lists)
       - Verify URL params, level types, and system descriptions are current
       - Fix any gaps or stale info

    2. WHAT WORKED
       - List systems/features that were completed successfully
       - Note any patterns that made work efficient

    3. WHAT DIDN'T
       - List any tasks that were harder than expected and why
       - Note any agent coordination issues (blocked tasks, stale info, miscommunication)
       - Note any assumptions that turned out wrong

    4. LESSONS LEARNED
       - Add any new entries to .agents/state/design-preferences.json
       - Update fix-pattern library if applicable
       - Record insights that would help the next sprint

    5. NEXT SPRINT PREP
       - Update "Next Session Recommendations" in PROJECT-STATUS.md
       - Identify blockers or open questions for the human

    Write the retro summary to: .agents/state/sprint-retro-{date}.md
```

**Why retros matter**: Agents don't automatically learn across sessions. The retro creates a written record that future agents (and humans) can read to avoid repeating mistakes. The doc audit catches anything individual agents missed during their post-task updates.

**Frequency**: Run a retro at the end of every sprint (typically after 4-8 tasks). For shorter work sessions (1-2 tasks), a retro is optional — the post-task doc updates should be sufficient.

---

## Gameplay Scenarios

### Full Playtest (P0 — Must Pass FIRST — Added Feb 2026)

0. **Full-loop playtest via Playwright MCP** (see "Full Playtest" section above)
   - Click "New Blob" → wait for PLAYING state
   - Verify: isPaused=false, vehicle built, spark unlocked, enemies alive and distributed
   - Take screenshot: terrain solid, player/vehicle/enemies visible, no stale UI
   - Check console: no TypeErrors or ReferenceErrors in game loop
   - **This scenario gates ALL other testing.** If the game loop is frozen (isPaused=true), all other scenarios will produce garbage results.

### UI Visibility (P0 — Must Pass Second)

0a. MENU state: main-menu visible, all legacy HUD hidden, death/victory screens hidden
0b. PLAYING state: only #run-gold visible, all legacy HUD hidden, loading overlay hidden, no menu screens
0c. DEAD state: death-screen visible, all legacy HUD hidden, no menu/victory screens
0d. PLAYING after restart: same as 0b — no stale overlays from previous run
0e. Screenshot during PLAYING: clean gameplay view with no UI clutter

**Test command:** `npm run test:ui`

### Core Loop (P0/P1 — Must Pass)

1. Walk to vehicle → Enter → Drive → Stop → Exit → Walk
2. Drive into enemy → Enemy ragdolls → Scavenge drops
3. Take damage → Visual damage states → Destruction → Eject
4. Navigate full map without falling through terrain
5. 30-second sustained combat encounter

### Feel Tests (P2)

6. Vehicle reaches max speed in < 3 seconds
7. Vehicle stops within 4 seconds of releasing gas
8. Camera doesn't clip through terrain
9. Steering responsive at low speed, stable at high speed
10. Enter/exit vehicle completes without visual glitch

### Stress Tests (P3)

11. Drive at max speed for 60 seconds → no crash
12. 50 enemies on screen → FPS > 30
13. Rapid enter/exit 10 times → no state corruption
14. Drive to map boundary → proper handling

---

## Walk-Away Operation

```bash
# 1. Install ntfy app, subscribe to secret topic
# 2. Start Claude Code:
claude "Start the game polish team with ntfy topic chromatic-XXXX.
Iterate up to 10 times. Notify me for design decisions and completion."
# 3. Walk away.
```

What happens:
```
Iteration 1: gameplay-sim finds 6 issues, director reviews, developer fixes 4
Iteration 2: 12/14 pass, director makes 2 autonomous decisions from preferences
Iteration 3: director escalates 1 novel decision → 📱 phone buzzes
You reply → team continues
Iteration 4: 14/14 pass → 📱 "ALL SCENARIOS PASS!"
Team shuts down.
```

---

## Summary

| Dimension | Old Plan | New Plan |
|-----------|----------|----------|
| **Strategic thinking** | None — pure bug fixing | Game Director reviews every change for design alignment |
| **Visual verification** | Numeric metrics only | Screenshots at key moments, evaluated by director |
| **Decision quality** | Developer picks first working fix | Developer proposes 2-3 options, director picks best |
| **Human interruptions** | Every design question | Only novel decisions — preferences handle repeats |
| **Self-improvement** | None — same mistakes repeat | Preferences, fix patterns, scenario growth, baseline evolution, sprint retros |
| **Documentation** | Docs drift out of sync | Post-task doc updates (enforced) + sprint retro audit |
| **Cross-agent challenge** | None — blind trust | Director challenges: "why this value?", "show me proof" |
| **Coordination** | JSON files | Claude Code Teams (TaskCreate, SendMessage) |
| **Notifications** | None | ntfy.sh / Telegram with priority tiers |
