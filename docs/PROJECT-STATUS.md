# Chromatic Resonance 3D - Project Status

**Last Updated**: 2026-02-10
**Quality Score**: 8.2/10 (post-playtest-fix loop — 9 issues found, 7 fixed, 1 mitigated)

---

## Executive Summary

Chromatic Resonance 3D is a feature-complete proof-of-concept that has successfully transitioned from humanoid meshes to **Particle Life blob creatures**. The core gameplay loop is solid, running at 237+ FPS with massive headroom for expansion.

**What's Working**:
- Blob-based player and enemies with 4-layer particle systems
- Wave-based combat with 6 enemy types and 2 bosses
- Color charge system with 10 combo effects
- NPR post-processing pipeline (style TBD — see Art Direction below)
- Living Arsenal foundation (items exist, formations designed)
- 3 outdoor zones with themed environments (facility, scrapyard, town)
- Arena level with cover objects (debug mode)
- Vehicle system foundation (jeep physics, mesh, damage, audio)
- Open world terrain/vegetation/water systems

**What's Next** (art PoC, then polish):
1. ~~Living Arsenal Layers 2-3~~ — **DONE** (formations + symbiote companions)
2. ~~Item drop world integration~~ — **DONE** (visual pickups, loot loop)
3. ~~NPC blob characters~~ — **DONE** (Keeper, Wanderer, Fragment with dialogue)
4. ~~Music & ambient audio~~ — **DONE** (6 element themes, combat/exploration crossfade)
5. ~~WFC cut + narrative rewrite~~ — **DONE** (Feb 2026 — cut WFC, rewrote lore to FNQ setting)
7. **Art direction PoC** — Sable-style (Moebius line art + flat color) to replace watercolor (see Art Direction section)

**Art Direction**: Sable PoC **COMPLETE** — verdict is **ITERATE** (style works, needs polish before full conversion). Glowing particle blobs read well against flat-color geometry. See `.agents/data/sable-poc/evaluation.md` for detailed findings and screenshots. Next steps: depth+normal outline pass, emissive exemption, sky posterization fix.

---

## Feature Completion Matrix

### Core Systems

| System | Status | Quality | Notes |
|--------|--------|---------|-------|
| ParticleLifeCreature | Complete | Excellent | 1,960 lines, 4 particle layers |
| BubblePhysics | Complete | Excellent | Deformation, wobble, sag, bulge |
| BlobPlayerController | Complete | Good | Momentum, slide, variable jump |
| ThirdPersonCamera | Complete | Good | Pitch/yaw with lock |
| ColorInventory | Complete | Excellent | 6 colors, regen, combos |
| EnemySystem | Complete | Good | 6 types, behaviors, animations |
| WaveManager | Complete | Good | 10 waves, 2 bosses |
| PlayerHealth | Complete | Good | Damage, healing, death |
| XP/Leveling | Complete | Good | Stats, visual feedback |

### Living Arsenal (Item System)

| Layer | Status | Implementation |
|-------|--------|----------------|
| Layer 1 - Matrix Mutations | **Complete** | item-data.js, item-system.js |
| Layer 2 - Formations | **Complete** | formation-system.js (spring-damper attractors) |
| Layer 3 - Symbiotes | **Complete** | Symbiote companions with 6 attachment types |
| Item Generation | **Complete** | item-generator.js |
| Equipment UI | **Complete** | I key opens panel |
| World Drops | **Complete** | 15% normal enemies, 100% bosses, auto-pickup |

### World / Zones

| Component | Status | Notes |
|-----------|--------|-------|
| Outdoor Level | **Complete** | Procedural terrain, vegetation, water |
| Zone 0 (Facility) | **Complete** | Limestone spires, smelter chimneys, cave mouths |
| Zone 1 (Scrapyard) | **Complete** | Rusted cars, tire stacks, oil drums |
| Zone 2 (Town) | **Complete** | Art Deco buildings, barricades, gas station |
| Arena Level | **Complete** | Debug mode, 80x80 with cover |
| Lore Pickups | **Complete** | Per-zone environmental storytelling |

### Visuals

| System | Status | Notes |
|--------|--------|-------|
| NPR Pipeline | Complete (style TBD) | Kuwahara, edge, paper, bloom + SableOutlineShader for Moebius lines |
| Blob Shaders | Complete | Fresnel, transparency, wobble |
| Floating Damage | Complete | Numbers with decay |
| Minimap | Complete | Enemy tracking |
| UI/HUD | Complete | Color orbs, mode display |
| Art Pipeline | **BLOCKED** | ComfyUI setup exists — paused pending art direction decision |
| Style Lab | Complete | Runtime style switching (5 presets: Watercolor, Low Poly, Borderlands, BotW, Sable) |

### Audio

| System | Status | Notes |
|--------|--------|-------|
| Procedural SFX | **Complete** | Web Audio API |
| Volume Control | **Complete** | Pause menu |
| Music | **Complete** | 6 element themes, combat/exploration crossfade |
| Ambient | **Complete** | Per-element ambient soundscapes |

---

## Technical Metrics

### Performance (Automated QA)

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Average FPS | 237-240 | >60 | Excellent |
| Load Time | ~2s | <5s | Good |
| Memory | Stable | No leaks | Good |
| Particle Count | ~2,000 active | <10,000 | Headroom |

### Code Stats

| Metric | Value |
|--------|-------|
| JS Source Files | 48 |
| Total Lines (JS) | ~15,000 |
| ParticleLifeCreature | 1,960 lines |
| BubblePhysics | 550 lines |
| Documentation | 4 major docs |

---

## Implementation Gaps

### Completed (Feb 2026 Sprint)

1. ~~**Living Arsenal Layer 2**~~ - ✅ Particle formations with spring-damper attractors
2. ~~**Item Drop Integration**~~ - ✅ Full loot loop: enemy-died → rollItemDrop → spawnWorldItem → auto-pickup
3. ~~**Living Arsenal Layer 3**~~ - ✅ Symbiote companions with 6 attachment types
4. ~~**NPC Blob Varieties**~~ - ✅ Keeper, Wanderer, Fragment with dialogue system
5. ~~**Music & Ambient Audio**~~ - ✅ 6 element themes, combat/exploration crossfade
6. ~~**WFC Cut + Narrative Rewrite**~~ - ✅ Cut ~4,300 lines of WFC code, rewrote lore to FNQ "The Bloom" setting

### Next Phase (Art Direction)

9. **Art Direction PoC — Sable Style** - **IN PROGRESS**
   - ~~Add Sable preset to Style Lab~~ — **DONE** (SableOutlineShader + posterization + flat materials)
   - Convert environment materials to flat Sable-style colors — Next
   - Visual evaluation across all modes — Next
   - Key question: do glowing particle blobs work against flat-color world? — **Initial results positive**
   - See Art Direction section below

10. ~~**AI Art Expansion**~~ - **BLOCKED** on art direction
    - Do NOT invest in watercolor LoRA, room textures, or sprite generation
    - Will be reconceived after Sable PoC decision

---

## Directory Structure

```
chromatic-resonance-3d/
├── src/
│   ├── main.js                     # Entry point
│   ├── creatures/
│   │   ├── particle-life-creature.js  # Core blob system (1,960 lines)
│   │   └── bubble-physics.js          # Deformation physics (550 lines)
│   ├── character/
│   │   ├── blob-player-controller.js  # Player movement
│   │   └── third-person-controller.js # Legacy humanoid
│   ├── systems/
│   │   ├── color-inventory.js         # Color charges
│   │   ├── enemies.js                 # Enemy spawning/AI
│   │   ├── player-health.js           # Health/damage
│   │   ├── item-data.js               # Item constants
│   │   ├── item-generator.js          # Procedural items
│   │   ├── item-system.js             # Equipment logic
│   │   └── formation-system.js        # Particle formations
│   ├── world/                          # Level generation (outdoor, arena)
│   ├── rendering/
│   │   └── npr-pipeline.js            # Post-processing
│   └── ui/
│       ├── equipment-ui.js            # I key panel
│       └── ...
├── docs/
│   ├── STORY-BIBLE-BLOB-EDITION.md    # Narrative & lore
│   ├── BLOB-CHARACTER-PLAN.md         # Technical creature design
│   ├── ITEMIZATION-PLAN.md            # Living Arsenal options
│   └── PROJECT-STATUS.md              # This file
├── .agents/
│   ├── art-pipeline/                  # ComfyUI integration
│   ├── prompts/                       # AI agent prompts
│   └── state/                         # Agent state files
└── tests/                             # Playwright tests
```

---

## Art Direction (Under Review)

**Current state**: NPR watercolor pipeline (Kuwahara + edge darkening + paper grain + Reinhard color transfer). Designed for 2D; the watercolor filter has been progressively dialed down as the game became more 3D (Kuwahara radius=1, paper grain disabled, edge strength=0.25).

**Proposed direction**: Sable-inspired style (Moebius line art, flat color fills, bold outlines, minimal shading). Reference: [GDC 2022 talk by Shedworks](https://gdcvault.com/play/1027721/The-Art-of-Sable-Imperfection).

**Plan**:
1. Complete all gameplay systems first (Living Arsenal L2-3, item drops, NPCs, audio)
2. Build Sable PoC (3-4 days): one room + player blob + enemies in Sable style
3. Evaluate whether glowing particle blobs work against flat-color geometry
4. If yes: full conversion (~4 weeks) — replace materials, add outline pass, strip PBR
5. If no: evaluate alternatives (bioluminescent/glow, cel-shading, hybrid)

**What to avoid until decided**:
- Do NOT train watercolor LoRA or generate new texture assets
- Do NOT tune bloom, paper grain, or Kuwahara parameters
- Do NOT invest in visual polish of NPR effects
- DO build gameplay systems — they are style-agnostic

**Style Lab** (`src/rendering/style-lab.js`) supports runtime style switching with 5 presets (key 1-5 in debug mode). The **Sable preset** (key 5) is now implemented with:
- `SableOutlineShader` — dilated Sobel for bold ink outlines (~2-3px at 1080p)
- Color posterization (6 levels) for flat discrete shading
- Flat materials, no textures/normal maps, matte surfaces
- Higher bloom threshold so only emissive particle blobs glow
- Initial PoC results: particle blobs read well against flat-color geometry, outlines give the environment a hand-drawn Moebius quality

## Technology Stack

| Layer | Technology |
|-------|------------|
| Rendering | Three.js |
| Build | Vite |
| Language | JavaScript (ES modules) |
| Testing | Playwright |
| Art Generation | ComfyUI + Stable Diffusion (PAUSED — pending art direction) |
| World Gen | Procedural terrain + zone themes |
| Sound | Web Audio API |

---

## Known Issues

### Fixed (Feb 2026 Playtest Loop)

| Issue | Severity | Fix | Files |
|-------|----------|-----|-------|
| Enemies spawn on top of player | P0 | MIN_SPAWN_DIST=15 pushes spawns away | enemies.js |
| Spawn invulnerability race condition | P0 | Trigger on ZONE_INTRO (before enemies), 8s duration | player-health.js |
| Shop overlay persists over gameplay | P1 | Auto-close on ZONE_INTRO/PLAYING states | shop-ui.js |
| Camera under vehicle chassis | P1 | Raised blob camera Y=5.0/Z=6.0, jeep dist=10/height=5.5 | blob-player-controller.js, jeep-controller.js |
| Vehicle drives underground on slopes | P1 | Hard floor clamp + center-height target | jeep-physics.js |
| Dual-terrain overlap (blob underground) | P1 | OutdoorLevel delegates heights to ChunkManager, skips terrain mesh | main.js, outdoor-level.js, zone-manager.js |
| Sky/horizon too dark | P2 | Brightened sky shader zenith/mid bands | outdoor-level.js |
| TypeError on player death | P1 | Null guard in renderer.render() path | main.js |

### Architectural Lesson: Dual Terrain Systems

**Root cause of multiple P0/P1 bugs**: Two terrain systems (ChunkManager 1024x1024 procedural + OutdoorLevel 200x200 heightmap) independently created terrain meshes at different heights. This caused:
- Blob appeared to walk underground (walking on ChunkManager terrain while OutdoorLevel terrain rendered above)
- 30K grass instances + trees/rocks floated in air (placed at OutdoorLevel heights, not visible ChunkManager surface)
- Vehicle clipped through terrain (physics used wrong height source)

**Fix pattern**: OutdoorLevel delegates `getHeightAt()` to ChunkManager via `_heightSource` option. When set, `_createTerrain()` is skipped entirely. All zone objects (grass, trees, facility structures) automatically use ChunkManager heights.

**Rule**: NEVER create two terrain meshes in the same scene. ONE authoritative height source, all systems delegate.

### P2 (Should Fix)

| Issue | Impact | Location |
|-------|--------|----------|
| Zone 1 limited visual differentiation | Design | Zone theming |
| Missing favicon | Polish | Root |
| Test ESM/CJS mismatch | Tests fail | tests/*.js |

### P3 (Nice to Have)

| Issue | Impact | Notes |
|-------|--------|-------|
| Walk/run transitions | Animation | Detected but subtle |
| Wand animation subtle | Visual | 150ms, small tip |
| Missing clothing sprite textures | Visual | Non-fatal warnings |

---

## Development Commands

```bash
# Start dev server
npm run dev              # http://localhost:8082

# Build for production
npx vite build           # Warning about chunk size is normal

# Run tests
npm test                 # ESM issues exist
node tests/test-scene-verification.js  # Works

# Generate art assets
cd .agents/art-pipeline && generate.bat
```

### URL Parameters

```
?zone=0|1|2    # Jump directly to a zone (skips menu)
?debug=true    # Enable debug mode on load
?test=true     # Test mode (no enemies/tutorial)
```

### Zones

| Zone | Name | Theme | Description |
|------|------|-------|-------------|
| 0 | Chillagoe Research Site | facility | Limestone karst, abandoned CSIRO cave lab |
| 1 | Herberton Scrapyard | scrapyard | Volcanic tablelands, ghost mining town |
| 2 | Innisfail | town | Cyclone-damaged Art Deco, cane fields, tropical coast |

---

## Next Session Recommendations

1. **Sable Polish** (RECOMMENDED — PoC complete, verdict: ITERATE):
   - Add depth+normal outline pass for better silhouette lines (P2)
   - Add emissive material exemption from outline shader (P2)
   - Fix sky posterization banding (P3)
   - See `.agents/data/sable-poc/evaluation.md` for full findings

2. **Zone Polish**:
   - Add zone-specific lighting/atmosphere (red dust haze for facility, mist for scrapyard, humidity for town)
   - Tune facility objects (limestone spires, containment tanks)
   - Real terrain data pipeline (ELVIS, Sentinel-2) — see STORY-BIBLE-BLOB-EDITION.md Part 10

3. **Gameplay Polish**:
   - Tune item drop rates and rarity distributions
   - Add more NPC dialogue lines (recontextualised for FNQ setting)
   - Update NPC dialogue to reference Australian Gothic elements

---

## Quality Assurance

### Automated Testing

The project has multi-agent QA infrastructure:
- Animation Swarm (review-fix-test loop)
- Sprint Orchestrator (full QA cycle)
- Visual regression tests
- Bone integrity tests

### Manual Testing Checklist

- [ ] Game loads without errors
- [ ] Player blob moves with WASD
- [ ] Enemies spawn and attack
- [ ] Colors drop from enemies
- [ ] Tab menu pauses game
- [ ] I key opens equipment
- [ ] Bosses appear at waves 5, 10
- [ ] FPS stays above 60

---

## Historical Context

1. **Original Chromatic Resonance**: Turn-based room crawler
2. **3D Conversion Start**: Real-time action RPG
3. **Humanoid Phase**: Mixamo models with wand
4. **Blob Transition**: ParticleLifeCreature system
5. **Current State**: Feature-complete PoC with blob creatures

The blob transition was a major pivot that unified visual representation with game mechanics - health IS the red particles, armor IS the grey shell, etc. This is the project's core differentiator.
