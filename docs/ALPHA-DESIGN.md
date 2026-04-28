# CHROMATIC RESONANCE — Alpha Concept Draft

## The Pitch
*A particle-based slime escapes a ruined lab, scavenges a junker vehicle, and fights through increasingly hostile human zones in a roguelike loop where everything — health, weapons, armor — is visible as particles on your body.*

## Backstory: "The Bloom"

**The CSIRO Chillagoe Deep-Core Facility**, remote Far North Queensland, 215km west of Cairns. Scientists experimenting with exotic matter containment in limestone cave systems accidentally created a self-organizing particle field — matter that *wants* to be alive. The experiment was sealed. But the particle field didn't die. Over years it absorbed waste, chemicals, scrap metal — slowly forming a crude awareness.

One day, it pulls itself out of the containment pool. A wobbling, translucent blob the size of a basketball. Almost no particles. Barely able to move.

It can feel other particles nearby — in machines, in fuel, in the walls. It reaches out and *absorbs*.

**Why humans are hostile:** The Australian Defence Force (ADF) classified the anomaly as a containment breach (ECHO-BLACK). Kill orders were issued before anyone realised it was alive. The blob doesn't know this. It just knows everything with legs wants it dead.

**Why this works for gameplay:**
- Facility wreckage in limestone karst = tutorial zone (scrap everywhere, weak site security)
- Blob starts pathetically weak (3-4 particles, barely mobile)
- First vehicle is literally junk bolted together
- Each zone = further from the facility = more organised human response
- The blob isn't evil — it's just trying to survive. Players discover this through environmental storytelling (drilling logs, ADF radio intercepts, sun-bleached newspaper clippings), not cutscenes.

---

## Core Loop (Noita-style Roguelike)

```
START RUN
  │
  ├─ Zone 0: Chillagoe Research Site (tutorial, scavenge first vehicle)
  │   ├─ Limestone karst, abandoned CSIRO cave lab
  │   ├─ Scrap + weak site security
  │   ├─ Boss: Commander (site security head)
  │   └─ Zone exit → SHOP
  │
  ├─ Zone 1: Herberton Scrapyard
  │   ├─ Militia, dogs, ute drivers
  │   ├─ Ghost mining town = vehicle part goldmine
  │   ├─ Boss: Commander (militia leader)
  │   └─ Zone exit → SHOP
  │
  ├─ Zone 2: Innisfail (ALPHA FINAL)
  │   ├─ Police, ADF soldiers, snipers
  │   ├─ Art Deco town, cane fields, ADF blockade
  │   ├─ Boss: ADF Commander
  │   └─ WIN → Blob escapes to the coast
  │       DEATH at any point → restart from Zone 0
  │
  ├─ Zone 3 (Future): ADF Forward Operating Base
  │
  └─ Zone 4 (Future): ADF Containment Zone + Final Boss
```

**Run length target:** 30-45 minutes for a successful run.

---

## The Blob

### Starting State
- ~10 particles total. Tiny. Slow. Fragile.
- Can absorb (E) and drop (E) objects — pull scrap into your body
- Can't fight. Can barely push a door open.
- **First objective:** Find enough scrap to build a junker vehicle.

### Particle Types (visible, no UI bars)
| Particle | Color | Role | Visual |
|----------|-------|------|--------|
| **Vitality** | Red | Health — lose them, you die | Pulsing red orbs orbiting blob core |
| **Shell** | Gray | Armor — absorb hits before vitality | Hard gray crust on blob surface |
| **Spark** | Yellow/Orange | Offensive — base projectile ammo | Crackling bright particles, orbit fast |
| **Essence** | Blue/White | Core energy — regen fuel, powers systems | Calm inner glow near core |

**Key rule:** You can always SEE your state. 10 red particles orbiting = 10 health. They visibly pop off when you take damage. No health bar needed.

---

## Experience, Leveling & Cores

This is the blob's progression system — how you grow stronger within and across runs.

### Cores: Your Particle Engine

A **core** is the glowing nucleus at the center of the blob. It controls how many particles you can sustain and how fast they regenerate. Cores are physical objects — you find them, absorb them, and they become part of you.

**Every particle type has its own core:**

| Core | Controls | Starting State | Visual |
|------|----------|----------------|--------|
| **Vitality Core** | Max red particles + regen rate | 10 capacity, 0.5/sec regen | Dim red ember at blob center |
| **Shell Core** | Max gray particles + regen rate | 5 capacity, 0.3/sec regen | Dull metallic speck |
| **Spark Core** | Max yellow particles + regen rate | 0 — **not unlocked at start** | Not visible until found |
| **Essence Core** | Max blue particles + regen rate | 8 capacity, 0.4/sec regen | Faint blue glow |

**You start with Vitality + Shell + Essence cores only.** The Spark Core (offensive particles) must be *found* in Zone 1 — this is the first real progression milestone. Until you find it, you can't shoot. You're scavenging, running, and hiding.

### Finding Cores

Cores are rare, significant pickups — not common drops:

| Source | Core Type | Notes |
|--------|-----------|-------|
| Zone 1 lab equipment | Spark Core (first) | Guaranteed spawn — your "get a weapon" moment |
| Optional bosses | Random core upgrade | +5-10 capacity, +0.2/sec regen |
| Hidden lab caches | Specific core upgrades | Reward for exploration |
| Shops | Core upgrades (expensive) | Spend gold to grow |
| Zone 5 final boss | Massive core upgrade or new core type? | End-of-run reward for meta-progression |

### Leveling Cores (Per-Run Progression)

Cores level up by **absorbing matching particle sources** in the world:

| Action | XP Toward Core Level |
|--------|---------------------|
| Kill an enemy (spark particles fly off them) | Spark Core XP |
| Take damage and survive (vitality tested) | Vitality Core XP |
| Block hits with shell (shell tested) | Shell Core XP |
| Power vehicle systems (essence spent) | Essence Core XP |
| Absorb matching environmental sources | Respective Core XP |

This is **implicit leveling** — you don't see XP numbers. Instead, you notice:
- Your core glows a bit brighter
- A brief pulse of matching-color particles (visual "ding")
- More particles orbit you than before

**Core levels per run (5 levels per core):**

| Level | Capacity Bonus | Regen Bonus | Visual |
|-------|---------------|-------------|--------|
| 1 | Base | Base | Dim glow |
| 2 | +20% | +15% | Slightly brighter |
| 3 | +45% | +30% | Steady glow, small halo |
| 4 | +75% | +50% | Bright core, particle trails |
| 5 | +110% | +75% | Blazing, visible from distance |

### Core Fragments (Meta-Progression / Persistent Upgrades)

When you die (and you will), most progress resets. But **Core Fragments** persist between runs:

- Dropped by optional bosses and found in secret areas
- Collected fragments carry over to your next run
- At the start of each new run, fragments provide a small permanent boost:
  - **3 Vitality Fragments** → Start with 12 vitality capacity instead of 10
  - **3 Spark Fragments** → Spark Core starts at level 2
  - **5 Fragments of any type** → Unlock a permanent starting augment slot

This creates a Noita-like meta-loop: each death teaches you something, and fragments give you a slight edge on the next attempt without making the game trivially easier.

### How Cores Interact with Vehicles

When you connect to a vehicle, your cores determine what systems you can power:

| Core | Vehicle System | Effect |
|------|---------------|--------|
| Spark Core level | Weapon power | Higher level = more projectiles, faster fire |
| Shell Core level | Chassis integrity | Higher level = more armor particles coat the vehicle |
| Essence Core level | Engine output | Higher level = faster, better handling |
| Vitality Core level | Emergency systems | Higher level = survive harder crashes, self-repair |

A blob with a maxed Spark Core and weak Shell Core will have a glass cannon vehicle — powerful weapons but paper-thin armor. The player's core investment IS their build.

### Discovery-Based Core Mechanics (Hidden / Not Told)

Following Noita's philosophy, some core mechanics are secret:

- **Core Fusion:** If two cores reach level 5 in the same run, they can fuse into a hybrid core (e.g., Spark+Shell = "Voltaic Core" — projectiles that leave armor fragments)
- **Overcharge:** Absorbing particles beyond your core capacity causes a temporary power surge, but damages the core if done too often
- **Core Sacrifice:** You can destroy a core to supercharge another — permanent within the run
- **The Sixth Core:** Hints exist that a fifth particle type (and core) can be discovered...

---

## The Vehicle

### Construction
Blob doesn't "buy" a vehicle. It **builds one** by absorbing scrap:
1. Find a chassis (rusted car frame, shopping cart, tractor shell — whatever's nearby)
2. Absorb wheels/treads
3. Absorb an engine/motor
4. Absorb a weapon mount

Each component is visible on the vehicle. A shopping cart with lawnmower wheels and a pipe gun looks exactly like that.

### Vehicle ↔ Particle Connection
The vehicle runs on YOUR particles:
- **Spark particles** flow into the weapon system → they ARE the projectiles
- **Shell particles** flow into the chassis → they ARE the armor (visible particle coating)
- **Essence particles** power the engine → more essence = faster/stronger
- **Vitality** stays with the blob (your life force)

If you dump all sparks into weapons, you hit hard but have no armor. Visible trade-off — players SEE the particles redistributing.

### Vehicle Parts (Loot)
Found by scavenging, mob drops, shops, boss drops:

| Slot | Examples | Effect |
|------|----------|--------|
| **Chassis** | Shopping cart, sedan frame, truck cab, APC hull | Base armor capacity, size, weight |
| **Wheels** | Bicycle wheels, monster truck tires, tank treads | Speed, terrain handling |
| **Engine** | Lawnmower motor, V8, turbine, alien tech | Top speed, acceleration, essence drain |
| **Weapon** | Pipe gun, mounted turret, missile rack, tesla coil | Base damage, fire rate, slot count |
| **Augment slots** | (on each component) | Noita-style spell modifiers |

### Scavenging Sources
| Source | What You Find | Where |
|--------|--------------|-------|
| Wrecked vehicles | Chassis, wheels, engines | Roadsides, scrapyards, garages |
| Mob drops | Gold, small parts, ammo augments | Killed humans |
| Environmental objects | Augment ingredients | Power lines (electric), gas pumps (fire), water towers (water), chemical barrels (acid) |
| Hidden caches | Rare parts, cores | Secret rooms, underground bunkers |
| Boss drops | Guaranteed rare+ part, gold, core fragment | Optional bosses |
| Shops | Anything, at a price | Between zones |

---

## Augments (Noita Spell System → Vehicle Components)

Each vehicle component has **augment slots** (like Noita wand slots). You drag augment blocks in to modify behavior:

### Weapon Augments (applied to weapon component)
| Augment | Effect | Source |
|---------|--------|--------|
| **Scatter** | Projectiles split into 3 | Mob drop |
| **Burn** | Projectiles ignite on hit | Gas station scavenge |
| **Pierce** | Projectiles pass through 1 target | Military crate |
| **Homing** | Slight tracking toward nearest enemy | Boss drop |
| **Chain Lightning** | Hit arcs to nearby enemies | Power line scavenge |
| **Acid Pool** | Impact leaves DoT puddle | Chemical barrel scavenge |

### Defensive Augments (applied to chassis)
| Augment | Effect |
|---------|--------|
| **Thorns** | Melee attackers take damage |
| **Regen Boost** | Shell particles regenerate faster |
| **Reflect** | Small chance to bounce projectiles |

### Engine Augments
| Augment | Effect |
|---------|--------|
| **Nitro Burst** | Short speed boost on cooldown |
| **Ram Plate** | Collision damage to enemies |
| **Efficiency** | Reduced essence drain |

**Combining augments creates emergent effects** (Noita-style):
- Scatter + Burn = shotgun blast that ignites a crowd
- Pierce + Chain Lightning = lightning bolt that chains through a line
- Homing + Acid Pool = seeking acid bombs

---

## Zones

### Zone 0: Chillagoe Research Site
- **Vibe:** Limestone spires rising from red dirt, abandoned smelter chimneys, cave entrances, containment tanks, blinding outback sun
- **Real inspiration:** Chillagoe mines, Irvinebank smelter ruins, 600+ limestone caves
- **Enemies:** Site security guards (weak), automated systems offline
- **Scavenge:** Lab equipment, containment tanks, mine shaft detritus
- **Purpose:** Learn absorption, build first vehicle, find Spark Core
- **Optional boss:** Commander — head of site security
- **Transition to Zone 1:** Emerge into outback sun. Burke Dev Rd to Kennedy Hwy, climbing through Mareeba to the Great Dividing Range.

### Zone 1: Herberton Scrapyard
- **Vibe:** Corrugated iron sheds, rusted mining equipment, old rail lines, crater lakes, mist, 920m elevation
- **Real inspiration:** Herberton Historic Village, Mt Mulligan ghost town, Ravenshoe
- **Enemies:** Militia/prospectors with rifles, guard dogs, ute drivers
- **Scavenge:** Endless vehicle parts, junkyard goldmine
- **Purpose:** Upgrade vehicle significantly, first real combat
- **Optional boss:** Commander — militia leader on modified ute
- **Transition to Zone 2:** Gillies Highway — 263 hairpin curves, 800m drop in 19km. Descend from cool misty tablelands into wall-of-heat tropical lowlands. Cane fields burning, black ash falling like snow.

### Zone 2: Innisfail
- **Vibe:** Cyclone-damaged Art Deco streetscapes, cane field corridors 4m tall, mangrove coast, crocodile warning signs, ADF barricades
- **Real inspiration:** Innisfail Art Deco town centre, Johnstone River, sugar cane fields
- **Enemies:** QPS police, ADF soldiers, snipers on Art Deco rooftops
- **Scavenge:** Hardware stores (augments), servos (parts), gas stations (fire augments)
- **Purpose:** Augment system opens up, difficulty spike, ADF blockade
- **Boss:** Commander — ADF field commander, full military loadout

### Zone 3 (Future): ADF Forward Operating Base
- **Vibe:** Razor wire, sandbags, watchtowers, motor pool, comms array
- **Enemies:** Soldiers, APCs, attack helicopters, snipers
- **Purpose:** Endgame build preparation, tough fights

### Zone 4 (Future): ADF Containment Zone
- **Vibe:** The ADF's response to YOU — mobile labs, particle containment tech, experimental weapons
- **Final boss:** "Project Crucible" — the ADF built their own particle weapon using research from Chillagoe. A mirror of you — a blob in a war machine. Artificial, unstable, angry.

---

## What the Player Discovers (Not Told)

Following Noita's philosophy — no tooltips, no tutorials, no hand-holding:

- **Augment combinations** — experiment to find synergies
- **Environmental interactions** — shoot a gas pump and it explodes, drive through power lines for a temporary electric coating
- **Blob can exit the vehicle** — risky (you're fragile) but sometimes necessary to squeeze through gaps, absorb things, or hide
- **Friendly NPCs exist** — some humans aren't hostile. A mechanic who helps upgrade. A scientist who explains what you are. Found by NOT killing everyone.
- **The backstory** — told through lab notes, radio chatter, overheard conversations. The player pieces it together.
- **Secret zones** — off-path areas with powerful loot but dangerous enemies
- **The blob isn't the only one** — hints that other particle entities exist...

---

## Minimal UI (Particles ARE the UI)

| Traditional UI | Particle Replacement |
|---------------|---------------------|
| Health bar | Count the red vitality particles orbiting your blob |
| Armor bar | Visible gray shell thickness on blob/vehicle surface |
| Ammo count | See how many spark particles are loaded in weapon system |
| Speed gauge | Essence particle flow rate through engine (visible stream) |
| Gold counter | Tiny golden particles swirling inside blob (only UI text element — small number) |
| Minimap | No minimap. Explore. Get lost. |
| Damage numbers | Particles visibly fly off enemies on hit |
| Boss health | Boss particles visibly deplete |
| XP / Leveling | Core glow intensity + particle pulse on level-up (no numbers) |

**Only text UI allowed:** Gold count (small), zone name on entry, shop prices. Everything else is visual/particle-based.

---

## What This Means for the Alpha

**Alpha scope = ONE successful run attempt:**
- Main menu → "New Blob" → Zone 1 → Shop → Zone 2 → Death or Shop → Zone 3 → Death or Final Boss
- 3 zones for alpha (Chillagoe Research Site, Herberton Scrapyard, Innisfail + final boss)
- ~15-20 minute run
- Vehicle construction + 1 upgrade tier
- 5-6 augments to discover
- 4 core types (Vitality, Shell, Spark, Essence) with 5 levels each
- Core Fragments as meta-progression (persist across deaths)
- Shop between zones
- Death = restart (keep fragments)

**What we keep from current code:**
- Particle life creatures (blob body)
- Vehicle combat system (jeep → scrap vehicle)
- Wave/enemy spawning (→ zone enemies)
- Noita spell system (→ augments)
- Outdoor level with zone themes (facility, scrapyard, town)
- Borderlands visual style
- Music system (per-zone themes)

**What we cut/redesign:**
- Color wand system → replaced by vehicle weapons + augments
- Tab menu → replaced by vehicle augment screen
- Equipment panel → vehicle parts
- Outdoor open world → zone-based progression
- Arena mode → cut
- 6 element themes → 3-5 zone themes
- XP bar / level numbers → implicit core leveling (visual only)
