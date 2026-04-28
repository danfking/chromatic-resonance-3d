# Alpha Build Plan — Chromatic Resonance

**Goal**: Playable alpha with 3 zones, ~15-20 min roguelike run, vehicle construction, Noita-style augments.
**Reference**: `docs/ALPHA-DESIGN.md`

---

## Team Structure: `alpha-build`

This is a **construction** team, not a polish team. Different from `game-polish` in AUTONOMOUS-POLISH-PLAN.md.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         LEAD (main session)                               │
│  Task breakdown, dependency management, design decisions                  │
│  Assigns tasks, reviews completions, resolves blockers                    │
├──────────────────┬──────────────────┬─────────────────┬─────────────────┤
│  systems-dev     │  world-dev       │  ui-dev          │  qa-vision      │
│                  │                  │                  │                 │
│  Core system     │  Zone generation │  Main menu       │  Browser verify │
│  Blob rework     │  Zone transitions│  Shop UI         │  Screenshot QA  │
│  Vehicle rework  │  Enemy rework    │  Death/restart   │  Smoke tests    │
│  Augment system  │  Wobbler humans  │  Particles-as-UI │  Visual review  │
│  Core leveling   │  Boss encounters │  Augment screen  │  Console errors │
│  Meta-progression│  Env. storytelling│                 │  FPS monitoring │
└──────────────────┴──────────────────┴─────────────────┴─────────────────┘
```

**Why 4 agents?**
- systems-dev and world-dev are the heaviest construction streams
- ui-dev handles all UI/HUD work
- **qa-vision is critical** — catches integration issues early via Playwright browser testing + Claude vision. Without QA, agents build systems that don't wire up correctly to the browser.

**Agent specs:**

| Agent | subagent_type | Key files they own | Tools used |
|-------|--------------|-------------------|------------|
| systems-dev | general-purpose | `src/systems/core-system.js` (new), `src/systems/item-system.js`, `src/systems/abilities.js`, `src/systems/progression.js`, `src/systems/augment-system.js` (new), vehicle systems | Read, Edit, Write, Bash |
| world-dev | general-purpose | `src/world/*.js`, `src/systems/enemies.js`, `src/creatures/human-wobbler.js`, `src/creatures/ragdoll-physics.js`, `src/world/zone-manager.js` (new) | Read, Edit, Write, Bash |
| ui-dev | general-purpose | `src/ui/*.js`, `src/ui/main-menu.js` (new), `src/ui/shop-ui.js` (new), `src/ui/run-hud.js` (new) | Read, Edit, Write, Bash |
| qa-vision | general-purpose | `.agents/data/qa-screenshots/`, test scripts | Playwright MCP, Read, Bash |

### QA Vision Agent

The qa-vision agent is a **continuous verification loop**, not a one-shot tester. It:

1. **Runs after every 2-3 completed tasks** (not just at the end)
2. **Launches the dev server** via `npx vite` or `npx http-server`
3. **Navigates to the game** via Playwright MCP (`browser_navigate`)
4. **Takes screenshots** at key checkpoints and evaluates them via Claude vision
5. **Checks console** for errors (`browser_console_messages`)
6. **Reports issues** to lead with screenshots + error context

**QA verification checklist per pass:**
- Game loads without errors (console clean)
- Main menu appears (when implemented)
- Blob spawns and is visible
- WASD movement works
- Enemies spawn and are visible (wobbler humanoids, not blobs)
- Vehicle construction works (when implemented)
- Zone transitions work (when implemented)
- FPS > 30 in all zones
- No visual glitches (floating objects, missing textures, z-fighting)
- UI elements positioned correctly and readable

**QA screenshots saved to:** `.agents/data/qa-screenshots/{task-id}-{description}.png`

**When qa-vision finds issues:** Creates a task describing the problem with screenshot evidence, assigns it to the responsible agent.

---

## Phase 0: Foundation (Sequential — blocks everything)

These tasks establish the skeleton that all other work builds on. Done by **systems-dev** before other agents start parallel work.

### Task 1: Game State Machine
**Owner**: systems-dev
**Blocks**: Tasks 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15
**Est**: Medium

Create `src/systems/run-manager.js`:
- States: `MENU → ZONE_INTRO → PLAYING → SHOP → DEAD → VICTORY`
- `startNewRun(seed?)` — reset all systems, generate seed
- `enterZone(zoneIndex)` — load zone, spawn player, start enemies
- `exitZone()` — cleanup, transition to shop
- `die()` — save fragments, show death screen
- `win()` — show victory, save fragments
- Event: `run-state-changed` with `{ from, to, zoneIndex }`

Rework `main.js`:
- Remove URL param level switching (`?level=wfc|arena|outdoor`)
- Replace with RunManager driving zone loading
- Keep debug URL params for testing individual zones

### Task 2: Core System
**Owner**: systems-dev
**Blocks**: Tasks 3, 4, 5, 13, 14
**Est**: Medium

Create `src/systems/core-system.js`:
- 4 core types: Vitality, Shell, Spark, Essence
- Each core tracks: `capacity`, `regenRate`, `currentLevel` (1-5), `xpToNext`
- Spark Core starts **locked** — must be found in Zone 1
- `absorbCore(type, upgrade)` — find/upgrade a core
- `getParticleBudget(type)` — returns max particles for that type
- `getRegenRate(type)` — returns regen speed
- `levelUp(type)` — implicit, called when XP threshold reached
- Visual: core glow intensity scales with level
- Event: `core-leveled` with `{ type, newLevel, capacity, regenRate }`

Replace `progression.js` XP bar with implicit core leveling:
- Remove DOM XP bar and level-up notification
- Core XP gained by using particles (see ALPHA-DESIGN.md)
- Visual pulse on level-up instead of text popup

### Task 3: Blob Rework
**Owner**: systems-dev
**Blocked by**: Task 2
**Blocks**: Tasks 5, 13
**Est**: Small

Modify `ParticleLifeCreature` and `BlobPlayerController`:
- Start with ~10 particles (tiny blob, slow, fragile)
- Particle count driven by core system budgets
- Movement speed scales with total particle count (more = faster/stronger)
- `E` key to absorb/drop nearby objects (replaces color extraction)
- Remove color wand toggle (Tab menu) — combat comes from vehicle weapons
- Keep basic blob melee/push for when on foot (weak, desperation move)

### Task 4: Vehicle Construction Rework
**Owner**: systems-dev
**Blocked by**: Task 2
**Blocks**: Tasks 5, 12
**Est**: Large

Rework existing vehicle system (`outdoor-level.js` vehicle setup, jeep physics):
- Remove "spawn a jeep" — player **builds** vehicle from scrap
- `src/systems/vehicle-builder.js` (new):
  - 4 slots: chassis, wheels, engine, weapon
  - `attachPart(slot, partItem)` — add scrap part to vehicle
  - `detachPart(slot)` — remove part
  - Vehicle mesh assembled from parts (procedural or prefab combos)
  - Vehicle stats computed from parts (speed, armor, damage, handling)
- Particle connection: blob particles flow into vehicle systems
  - Spark → weapon, Shell → chassis armor, Essence → engine
  - Visual: colored particle streams between blob and vehicle subsystems
- Player can **exit vehicle** (E key) — becomes vulnerable foot-blob
- First vehicle: shopping cart / lab cart + junk wheels from Zone 1

---

## Phase 1: Parallel Streams (after Phase 0)

Three agents work simultaneously on independent streams. Dependencies within streams are sequential; across streams they're minimal.

### Stream A: World (world-dev)

#### Task 5: Zone Manager + Zone 1 (Facility Ruins)
**Owner**: world-dev
**Blocked by**: Tasks 1, 2, 3
**Blocks**: Tasks 6, 7, 10, 11
**Est**: Large

Create `src/world/zone-manager.js`:
- `generateZone(index, seed)` — creates outdoor zone with themed objects
- `getZoneConfig(index)` — returns theme, enemies, loot tables, difficulty
- Zone exit portal (reach it to complete zone → shop)
- Zone entry portal (shop → next zone)

Zone 0: Chillagoe Research Site
- Outdoor level with `zoneTheme: 'facility'`
- Objects: limestone spires, smelter chimneys, cave entrances, containment tanks
- Lighting: blinding outback sun, red dust atmosphere
- Enemies: Security drones (weak, slow), automated turrets (stationary)
  - Rework 2 existing enemy presets (shade → drone, turret → stationary guardian)
- Scavenge points: lab equipment, broken carts, emergency vehicle bay
- Guaranteed Spark Core pickup (first weapon moment)
- Optional boss: Security Mech (rework existing chromaticGuardian)

#### Task 6: Zone 2 (Desert Scrapyard)
**Owner**: world-dev
**Blocked by**: Task 5
**Blocks**: Task 7
**Est**: Medium

Zone 2: Desert Scrapyard
- Reuse outdoor-level terrain generation, shrink to ~100x100
- Theme: rust, sand, sun-bleached metal, tire stacks, oil puddles
- Enemies: Militia with rifles (ranged humans), guard dogs (melee fast), pickup trucks (vehicle enemies)
  - Rework 3 existing enemy presets for human enemies
- Scavenge: abundant vehicle parts (junkyard goldmine)
- Vehicle upgrade opportunity (better chassis/wheels/engine)
- Optional boss: Scrapyard King (armored bulldozer + crane arm)

#### Task 7: Zone 3 (Rural Town) + Final Boss
**Owner**: world-dev
**Blocked by**: Task 6
**Blocks**: Task 15
**Est**: Large

Zone 2: Innisfail (Tropical Coastal Town) — **Alpha final zone**
- Outdoor level with `zoneTheme: 'town'`
- Theme: Art Deco streetscapes, cane field corridors, ADF barricades
- Enemies: Police (pistol), SWAT (armor + SMG), roadblocks (stationary cover)
- Scavenge: hardware store (augments), garage (parts), gas station (fire augments)
- Final Boss: Sheriff's Retrofitted Tank
  - Multi-phase fight in town square arena
  - Phase 1: Tank circles, cannon shots
  - Phase 2: Tank damaged, deploys SWAT reinforcements
  - Phase 3: Tank immobilized, blob must exit vehicle to absorb its core
- Beating boss = alpha victory

### Stream B: Systems (systems-dev continues after Phase 0)

#### Task 8: Augment System
**Owner**: systems-dev
**Blocked by**: Task 4
**Blocks**: Task 12
**Est**: Large

Create `src/systems/augment-system.js`:
- Augments are items with `type: 'augment'` and `target: 'weapon'|'chassis'|'engine'`
- Each vehicle component has 1-3 augment slots (based on part quality)
- `applyAugment(componentSlot, augmentItem)` — attach augment to vehicle part
- `removeAugment(componentSlot, slotIndex)` — detach
- Augment effects modify projectile behavior, defense, movement:

Weapon augments (priority for alpha — 5-6):
- Scatter (split into 3), Burn (DoT), Pierce (pass-through)
- Homing (tracking), Chain Lightning (arc), Acid Pool (ground DoT)

Defensive augments (2-3 for alpha):
- Thorns (contact damage), Regen Boost (shell regen), Reflect (bounce projectiles)

Engine augments (2-3 for alpha):
- Nitro Burst (speed boost), Ram Plate (collision damage), Efficiency (less essence drain)

Combo detection: when 2+ augments combine, apply bonus effect
- Reuse existing color combo system architecture from `abilities.js`

#### Task 9: Enemy Rework (Wobbler Humanoids)
**Owner**: world-dev
**Blocked by**: Task 1
**Blocks**: Tasks 5, 6, 7
**Est**: Medium

**Enemy visuals: Wobbly Life / TABS style wobbler humanoids with ragdoll.**
The codebase already has this built:
- `src/creatures/human-wobbler.js` — TABS-style 15-part procedural bodies with googly eyes (~200 triangles each)
- `src/creatures/ragdoll-physics.js` — constraint-based ragdoll with joint limits
- Existing types: civilian, police, soldier, riotShield, sniper, commander
- Already imported in `enemies.js` and used for some enemy spawns

**This task makes wobblers the ONLY enemy type** (drop blob enemies entirely for mobs):

Rework `enemies.js`:
- New spawn mode: `zone` (replaces `wave`)
  - Zone-based: enemies populate zone on generation, respawn on timers
  - No wave counter, no "wave complete" events
  - Difficulty scales with zone index, not wave number
- All enemies use `createWobblerHumanoid()` — no more `ParticleLifeCreature` for enemies
- Zone enemy roster (using existing + new HUMAN_TYPES):
  - Zone 1: `drone` (new — floating bot, use simple mesh not wobbler), `securityGuard` (new wobbler type — weak, baton)
  - Zone 2: `militia` (rework civilian — rifle, medium HP), `dog` (new — fast melee, low HP, simple mesh), `truckDriver` (new wobbler — drives pickup truck)
  - Zone 3: `police` (existing type — pistol), `swat` (rework riotShield — armor + SMG), `sniper` (existing — ranged, high damage)
  - Bosses: `commander` (existing) reworked per zone (Security Mech, Scrapyard King, Sheriff)
- Keep ragdoll on death — wobbler enemies ragdoll on kill (already implemented)
- Add `roaming` behavior (patrol paths, alert radius, chase-to-leash distance)
- Wobbler walk/idle animations already exist (`createWobblerWalkAnimation`, `createWobblerIdleAnimation`)

**QA checkpoint**: After this task, qa-vision verifies wobbler enemies spawn, animate, take damage, and ragdoll on death in the browser.

### Stream C: UI (ui-dev)

#### Task 10: Main Menu
**Owner**: ui-dev
**Blocked by**: Task 1 (needs RunManager states)
**Blocks**: Task 15
**Est**: Small

Create `src/ui/main-menu.js`:
- Full-screen overlay, shown on `MENU` state
- Title: "CHROMATIC RESONANCE"
- Subtitle: particle animation (tiny blob forms from scattered particles)
- Buttons: "New Blob" (start run), "Settings" (volume, controls)
- If Core Fragments exist from previous runs, show "Fragments: X" indicator
- On "New Blob": dispatch `start-run` → RunManager → Zone 1
- Style: minimal, dark background, particle effects, Borderlands outline aesthetic
- No save/load for alpha — roguelike, death = restart

#### Task 11: Shop UI
**Owner**: ui-dev
**Blocked by**: Task 5 (needs zone exit flow)
**Blocks**: Task 15
**Est**: Medium

Create `src/ui/shop-ui.js`:
- Shown between zones (RunManager `SHOP` state)
- Layout: grid of purchasable items on left, player vehicle preview on right
- Shop inventory: random selection based on current zone + seed
  - Vehicle parts (chassis, wheels, engine, weapon)
  - Augments
  - Core upgrades (expensive)
  - Health refill (vitality particles)
- Currency: Gold (tiny golden particles collected from kills)
- Buy: click item → gold deducted → item added to inventory
- Sell: drag owned item to shop → get gold back (50% value)
- Vehicle preview: shows current vehicle with parts highlighted
- "Continue" button → load next zone
- Timer?: No timer for alpha. Take your time.

#### Task 12: Vehicle Augment Screen
**Owner**: ui-dev
**Blocked by**: Tasks 4, 8
**Blocks**: Task 15
**Est**: Medium

Rework `equipment-ui.js` into vehicle-focused UI:
- Open with `I` key (same as current)
- Left side: Vehicle schematic showing 4 component slots
  - Each slot shows current part + augment sub-slots
  - Click slot to see available parts in inventory
  - Drag augments into augment sub-slots
- Right side: Inventory grid (scavenged parts + augments)
- Stats panel: vehicle speed, armor, damage, augment effects
- Blob stats: core levels, particle counts
- Tooltip on hover: part stats, augment effects, combo hints

---

## Phase 2: Integration (after Phase 1 streams converge)

These tasks wire everything together. Most are medium-small and can be distributed.

#### Task 13: Particles-as-UI + Run HUD
**Owner**: ui-dev
**Blocked by**: Tasks 2, 3
**Est**: Medium

Create `src/ui/run-hud.js` — minimal in-game HUD:
- Remove existing health bar, XP bar, color orb display, minimap
- Gold counter: small text in corner (only mandatory text UI)
- Zone indicator: "Zone 1: Facility Ruins" on entry, fades after 3s
- Core glow: visible on blob (no HUD element needed)
- Particle counts ARE the UI:
  - Red vitality particles = health (visible orbiting blob)
  - Gray shell particles = armor (visible on blob surface)
  - Yellow spark particles = ammo (visible in weapon system)
  - Blue essence particles = fuel (visible flowing to engine)
- Death warning: screen edge reddens when vitality < 3 particles
- Boss health: boss particles visibly deplete (no health bar)

#### Task 14: Core Fragments (Meta-Progression)
**Owner**: systems-dev
**Blocked by**: Task 2
**Est**: Small

Add to `core-system.js`:
- `CoreFragment` — persisted in localStorage between runs
- Dropped by optional bosses, found in secret areas
- On death: fragments saved, everything else reset
- On new run: fragments apply bonuses:
  - 3 Vitality Fragments → +2 starting vitality capacity
  - 3 Spark Fragments → Spark Core starts at level 2
  - 5 any fragments → +1 starting augment slot
- Fragment UI on main menu (small indicator)
- Fragment pickup: brief glow effect + "Fragment Absorbed" text

#### Task 15: Integration + Smoke Test
**Owner**: lead (or all agents)
**Blocked by**: Tasks 7, 10, 11, 12, 13, 14
**Est**: Medium

Wire everything together and verify the full loop works:
- Main Menu → New Blob → Zone 1 (facility, find spark core, build vehicle, reach exit)
- → Shop (buy parts/augments) → Zone 2 (scrapyard, upgrade vehicle, reach exit)
- → Shop → Zone 3 (town, fight to boss, defeat sheriff's tank)
- → Victory Screen
- Test death → restart flow (fragments persist)
- Test 2nd run with fragments applied
- Verify no console errors, FPS > 30 in all zones
- Update `docs/PROJECT-STATUS.md` and `CLAUDE.md`

---

## Phase 3: Polish + Ship (after integration)

#### Task 16: Per-Zone Audio
**Owner**: any dev
**Blocked by**: Task 15
**Est**: Small

Rework `music.js`:
- Zone 1: Industrial ambient, metallic echoes, alarm undertones
- Zone 2: Desert wind, sparse guitar, heat haze
- Zone 3: Tense small-town, distant sirens, radio chatter
- Combat crossfade already works — just swap the source tracks
- Boss music: intense variant of zone theme

#### Task 17: Environmental Storytelling
**Owner**: world-dev
**Blocked by**: Task 15
**Est**: Small

Scatter discoverable lore through zones:
- Zone 1: Lab notes ("Day 47: The particle field responded to music today...")
- Zone 2: Militia radio chatter ("All units, the blob was sighted heading west...")
- Zone 3: Newspaper clippings, police reports
- Pickup mechanic: walk near → text appears briefly → fades
- No journal/log — Noita style, blink and you miss it
- 3-5 lore items per zone for alpha

#### Task 18: Sprint Retro + Doc Sync
**Owner**: lead + all agents
**Blocked by**: Task 15
**Est**: Small

**This is a TEAM retro, not just a lead task.** Every agent participates.

Per AUTONOMOUS-POLISH-PLAN.md Section 6, plus agent reflection:

1. **Doc audit** (PROJECT-STATUS.md, CLAUDE.md, ALPHA-DESIGN.md)
2. **Per-agent reflection** — each agent writes a short summary:
   - What tasks they completed
   - What was harder than expected and why
   - What they'd do differently next time
   - Suggestions for improving team coordination
   - Any patterns they discovered that future agents should know
3. **Lead synthesis** — lead collects agent reflections and writes:
   - What worked / what didn't (team-wide)
   - Lessons learned → `design-preferences.json`
   - Process improvements for next sprint (coordination, file ownership, testing)
   - Next sprint prep (what's needed for beta?)
4. **Write retro** to `.agents/state/sprint-retro-alpha-build.md`

The retro summary should be specific and actionable, not generic. Example:
- BAD: "Communication could be improved"
- GOOD: "systems-dev and world-dev both modified enemies.js causing a merge conflict on line 372. Fix: move zone enemy configs to a separate file that world-dev owns."

---

## Task Dependency Graph

```
Phase 0 (Sequential — systems-dev builds foundation):
  T1 (State Machine) ──┬──→ T9 (Enemy Wobbler Rework, world-dev)
                        │
  T2 (Core System) ─┬──┤──→ T10 (Main Menu, ui-dev)
                     │  │
  T3 (Blob Rework) ─┘  │           ┌── QA pass ──┐
                        │           │  (Phase 0)  │
  T4 (Vehicle) ────────┘           └─── Mini Retro ───┘

Phase 1 (Parallel — after Phase 0 + QA pass):
  Stream A (world-dev):    T5 (Zone 1) ──→ T6 (Zone 2) ──→ T7 (Zone 3+Boss)
  Stream B (systems-dev):  T8 (Augments) ──→ T14 (Core Fragments)
  Stream C (ui-dev):       T11 (Shop UI) ──→ T12 (Augment UI) ──→ T13 (Particles-as-UI)
  qa-vision:               QA pass after T9, T5, T8, T10  (continuous)

Phase 2 (Integration):
  T15 (Integration + full QA pass)

Phase 3 (Polish):
  T16 (Audio) + T17 (Lore) → T18 (Team Retro — ALL agents participate)
```

## Critical Path

The longest dependency chain determines minimum build time:

```
T1 → T2 → T3 → T4 → [QA + mini-retro] → T5 → T6 → T7 → T15 → T18
(state) (cores) (blob) (vehicle)         (z1)  (z2) (z3+boss) (integrate) (retro)
```

**Bottleneck**: Phase 0 is sequential on systems-dev. To mitigate:
- T9 (Enemy Rework) starts after T1 — world-dev works on wobbler enemies while systems-dev does T2-T4
- T10 (Main Menu) starts after T1 — ui-dev works on menu while systems-dev does T2-T4
- qa-vision starts QA passes as soon as T1 completes (verify state machine in browser)
- Mini-retro after Phase 0 catches foundation issues before parallel work begins

## QA Checkpoints

qa-vision runs verification passes at these milestones (not just at the end):

| After Task(s) | QA Verifies |
|---------------|-------------|
| T1 (State Machine) | Game loads, state transitions work, no console errors |
| T2+T3 (Core + Blob) | Blob spawns tiny, core glow visible, E key absorb works |
| T4 (Vehicle) | Vehicle builds from parts, blob enters/exits, particles flow |
| T9 (Enemy Rework) | Wobbler humanoids spawn, walk, attack, ragdoll on death |
| T5 (Zone 1) | Zone generates, player spawns, enemies populate, exit portal works |
| T10 (Main Menu) | Menu renders, "New Blob" starts run, settings accessible |
| T8 (Augments) | Augments attach to vehicle, effects visible on projectiles |
| T6+T7 (Zones 2-3) | All zones load, transitions work, boss fight functions |
| T11+T12 (Shop + Augment UI) | Shop displays items, purchase works, augment drag-drop works |
| T15 (Integration) | Full run: menu → zone 1 → shop → zone 2 → shop → zone 3 → boss → victory |

**QA issues block task completion.** If qa-vision finds a broken feature after a task is "done", the task goes back to in_progress until the issue is fixed.

## Mid-Sprint Retro

After Phase 0 completes (Tasks 1-4) and before parallel Phase 1 begins, run a **mini-retro**:
- Each agent reflects on Phase 0 (what was hard, what to improve)
- Lead reviews: are the foundations solid enough for parallel work?
- Adjust Phase 1 task assignments if needed
- Write brief notes to `.agents/state/retro-phase0.md`

This prevents compounding problems — if the foundation has issues, catch them before 3 agents build on top of it.

## Execution Rules

1. **File ownership**: Each agent owns specific files (see table above). If you need to modify another agent's file, send a message to coordinate.
2. **main.js is shared**: All agents may need to touch main.js. Coordinate via messages. Prefer adding new imports + init calls rather than restructuring.
3. **Doc updates**: Per AUTONOMOUS-POLISH-PLAN.md Section 5, update docs after each task.
4. **Design decisions**: If a task involves a subjective choice (enemy appearance, difficulty tuning, UI layout), propose 2 options and send to lead for decision.
5. **Testing**: After each task, verify the game still loads and runs without errors. Run `npx vite build` to catch import/syntax issues.
6. **Commits**: Each completed task should be a clean commit with descriptive message.
7. **QA verification**: qa-vision runs browser checks at milestones (see QA Checkpoints). Devs should NOT mark tasks complete until qa-vision confirms the feature works in the browser.
8. **Retros**: Mini-retro after Phase 0, full team retro after Phase 3. Every agent participates with specific, actionable reflections.

## What We Cut From Current Code

These systems exist but are **removed or disabled** for the alpha:

| System | Action | Reason |
|--------|--------|--------|
| Blob enemies (ParticleLifeCreature for mobs) | Replace | Wobbler humanoids are the enemy type |
| Color wand (Tab menu) | Remove | Replaced by vehicle weapons + augments |
| 6 color types | Simplify | 4 particle types replace colors |
| Wave system | Replace | Zone-based spawning |
| Equipment panel (current) | Rework | → Vehicle augment screen |
| Outdoor open world | Rework | → Zone-sized terrain chunks |
| Arena mode | Cut | Not needed for roguelike |
| XP bar / level display | Remove | Implicit core leveling |
| Minimap | Remove | Exploration-based, no map |
| Bleaching/corruption | **Cut** | Removed with WFC (Feb 2026) |
| WFC room generation | **Cut** | All zones outdoor now |
| NPC dialogue system | Keep but rework | → Environmental lore |
| Lore fragments | Keep | → Zone-specific discoveries |

## What We Keep and Leverage

| System | Status | How it's used |
|--------|--------|---------------|
| `human-wobbler.js` | Already built | TABS-style 15-part humanoids, googly eyes, ~200 tri |
| `ragdoll-physics.js` | Already built | Constraint-based ragdoll on death — the TABS feel |
| HUMAN_TYPES | Already built | civilian, police, soldier, riotShield, sniper, commander |
| Wobbler animations | Already built | `createWobblerWalkAnimation`, `createWobblerIdleAnimation` |
| Vehicle physics | Already built | Jeep controller, damage model — rework into scrap vehicle |
| Zone theming | Already built | Outdoor levels with facility/scrapyard/town themes |
| Outdoor terrain | Already built | Terrain, vegetation, heightmap — shrink for zone size |
| Item system | Already built | Vehicle inventory, procedural generation, loot loop |
| Particle life blob | Already built | Player blob — kept as the protagonist |

## Alpha Ship Criteria

The alpha is **done** when a player can:
- [ ] Start from main menu
- [ ] Control a tiny blob in Zone 1
- [ ] Find the Spark Core (first weapon)
- [ ] Build a vehicle from scrap
- [ ] Fight wobbler humanoid enemies that ragdoll on death
- [ ] Fight through Zone 1 enemies to the exit
- [ ] Buy upgrades at the shop
- [ ] Fight through Zone 2 with upgraded vehicle
- [ ] Buy more upgrades
- [ ] Fight through Zone 3 to the final boss
- [ ] Defeat the boss → victory screen
- [ ] Die → see death screen with stats → restart
- [ ] On 2nd run, see Core Fragment bonuses applied
- [ ] Complete a full run in ~15-20 minutes
- [ ] All features verified by qa-vision agent in browser (screenshots + console clean)
