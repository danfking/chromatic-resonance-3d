# Architecture

The proof of concept got large enough that this document is worth a read before changing anything. It covers the render pipeline, the major gameplay systems, the multi-agent QA loop I built around it, and the pieces that would surprise you if you didn't know they were there.

## Top-level layout

```
chromatic-resonance-3d/
├── src/
│   ├── main.js                    Entry point and game loop
│   ├── core/scene-manager.js      Three.js setup, lighting
│   ├── rendering/npr-pipeline.js  Post-processing chain
│   ├── character/                 Player controller, animation state machine, IK
│   ├── world/                     Open world, arena, zone manager, platform system
│   ├── systems/                   Combat, abilities, items, NPCs, audio, music
│   └── ui/                        Minimap, HUD, inventory, dialogue
├── assets/
│   ├── sprites/                   AI-generated watercolour sprites
│   ├── textures/                  Diffuse, paper textures
│   ├── shaders/                   GLSL files
│   └── models/                    Models live here (see assets/models/README)
├── tests/                         Playwright visual + animation tests
└── docs/                          Design documentation
```

## Render pipeline

Three.js scene followed by a stack of post-processing passes. The chain has been tuned multiple times; the current configuration is the Sable preset, which was the best of the styles I evaluated.

1. **RenderPass.** Base 3D scene.
2. **SableOutlineShader.** Dilated Sobel for thick ink-style outlines.
3. **KuwaharaPass.** Painterly brush effect, currently radius 1 (almost off, since the Sable direction wants flatter colour rather than painterly smoothing).
4. **EdgeDarkeningPass.** Soft Sobel-based edge darken, strength 0.25.
5. **UnrealBloomPass.** Higher threshold than default so only emissive particle blobs glow.
6. **ReinhardColorTransfer.** BotW-inspired palette shift.
7. **PaperTexturePass.** Vignette and colour grading; grain is currently disabled.

The chain is configurable at runtime through a Style Lab module (`src/rendering/style-lab.js`) that exposes presets for Watercolour, Low Poly, Borderlands, BotW, and Sable, switchable via number keys 1-5 in debug mode (F3).

## Character controller (Megabonk-style)

Momentum-based third-person controller. Acceleration and deceleration are 50 and 30 units per second squared, max speed 12 units per second. The walk-to-run threshold is 6 units per second.

Notable details:

- **Sliding.** Shift while moving, 0.4s burst at 18 units per second, 0.8s cooldown. Camera dips during the slide.
- **Variable jump height.** Hold space for higher jumps, up to 1.5x.
- **Coyote time.** 0.1s grace period for jumps after walking off a ledge.
- **Jump buffer.** 0.15s window for jump inputs entered before landing.
- **Animation state machine** with crossfading between idle, walk, run, slide, jump, fall, land.

## Colour and combat

The defining mechanic of the game is colour as a resource.

- **Ivory** is the primary mana, fast passive regen at 5 per second, always available.
- **Other colours** (Crimson, Azure, Verdant, Golden, Violet) do not regenerate passively. They drop from enemies based on enemy type. A small trickle regen kicks in when a colour is fully depleted so you don't get stuck.
- **Wand modes.**
  - *Single*: cycles through enabled colours one at a time.
  - *Multi*: fires all enabled colours in a single blended projectile.
- **Colour effects.** Each colour adds a status effect to attacks: Crimson burns, Azure slows, Verdant lifesteals, Golden pierces, Violet homes.
- **Two-colour combos.** Ten combinations have unique blended effects with bonus damage.

Bosses drop multiple colours; the Chromatic Guardian and Void Harbinger are the two boss encounters.

## Living Arsenal (item system)

Three layers of progression sit on top of the same six equipment slots and five rarities.

1. **Layer 1 — Matrix mutations.** Every equipped item modifies the Particle Life interaction matrix that drives the player blob's particle composition. So every item literally changes how your character's particles move and clump.
2. **Layer 2 — Particle formations.** Uncommon-and-above items add spring-damper attractors that conscript loose particles into visible shapes around the player.
3. **Layer 3 — Symbiote companions.** Legendary items spawn small orbiting `ParticleLifeCreature` blobs that follow you and contribute to combat.

Items drop at 15% from regular enemies, 100% from bosses (with bosses guaranteeing Rare or higher). Auto-pickup at 1.5 unit distance; items despawn after 60 seconds.

## NPC system

Three NPC types with distinct behaviours:

- **Keepers** — stationary guides, stand still and bob.
- **Wanderers** — patrol an area on a path.
- **Fragments** — follow the player with a flickering presence.

Interaction is press E within 3m. Dialogue pauses the game and shows element-themed lore fragments alongside NPC-specific lines.

## World architecture

This is the part most likely to bite a future contributor.

### Two terrain systems

There are two systems that can produce ground geometry. Only one of them is authoritative.

- **`ChunkManager`** (`src/world/open-world/chunk-manager.js`). 1024x1024 world, 64x64 chunks, procedural heightmap. This is the visible ground.
- **`OutdoorLevel`** (`src/world/outdoor-level.js`). 200x200, zone-specific decoration (grass, trees, rocks, facility structures). It delegates `getHeightAt()` to ChunkManager via `_heightSource` and does not create its own terrain mesh when that delegation is wired up.

`main.js` passes `this.vehicleCombat?.chunkManager` to `zoneManager.generateZone()` so OutdoorLevel delegates correctly. The boot level (created before ChunkManager exists) hides its own terrain mesh via `_hideOutdoorLevelTerrain()`.

If you ever see entities underground or floating, the cause is almost always `OutdoorLevel` not having `_heightSource` set or `_createTerrain()` running when it should not.

## Multi-agent QA system

This is one of the more interesting parts of the project from an agentic-development perspective.

The codebase has an autonomous review-fix-test loop built on top of three roles: a Reviewer that detects issues, a Fixer that proposes patches, and a Verifier that runs tests. State files in `.agents/state/` track issues and fix attempts; safety limits cap iterations and escalate to human after repeated failures.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  REVIEWER   │────▶│   FIXER     │────▶│  VERIFIER   │
│  (Detect)   │     │   (Fix)     │     │   (Test)    │
└─────────────┘     └─────────────┘     └─────────────┘
       │                                       │
       └───────────── feedback loop ───────────┘
```

Two harnesses sit on top of this:

- **Animation Swarm.** Dedicated to animation issues (bone integrity, state transitions, visual regressions in animated meshes). Designed to run autonomously with hard limits at 5 iterations per run and 3 fix attempts per issue.
- **Sprint Orchestrator.** Full sprint loop with all QA agents.

The orchestration scripts and prompts live in `.agents/` and aren't shipped with the public repo because they're tied to a local environment. The architecture and findings are documented; the prompts themselves were less interesting than the coordination patterns.

## Testing

Two complementary approaches:

- **Visual regression** (`tests/visual-test.js`) — Playwright-driven screenshot comparison with baselines and pixel tolerance.
- **Animation integrity** (`tests/animation-test.js`) — queries bone world positions via `page.evaluate()` and validates connected bones don't separate beyond a 2m threshold across many sampled frames.

For animation testing specifically, there's an isolated test scene (`src/test-scene.js`, accessible at `/test-scene.html`) with a neutral background, single player model, and orbit camera. It exposes `window.testScene` for programmatic state queries. This was significantly more useful than testing in the main game, since the noise of enemies, NPR post-processing, and UI made screenshot-based regression unreliable.

## Coding conventions

- camelCase for functions and variables.
- UPPER_SNAKE for constants.
- kebab-case for file names and CSS classes.
- PascalCase for classes.

## Performance

Target was 60 FPS at 1080p. The PoC sustained around 240 FPS on the hardware I tested, which left plenty of headroom for the systems that came later (item formations, symbiote companions, vehicles, NPCs).

## Asset pipeline

The art pipeline is paused. Existing sprites in `assets/sprites/` (77 watercolour-style images) were generated through a ComfyUI pipeline (configs lived in `.agents/art-pipeline/`, not shipped). The next step would be either restyling these toward Sable-aligned flat-colour outputs or replacing them entirely. The shipped sprites work but show the original watercolour style direction.

Models are not shipped. See `assets/models/README.md` for the recommended CC0 sources and how to wire them up.
