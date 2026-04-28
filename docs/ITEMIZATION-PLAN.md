# Chromatic Resonance 3D: Itemization & Visualization Plan

## Context & Constraints

**Core constraint**: All art/content must be creatable via agentic tools -- no hand-drawn assets, no external 3D models. Everything is procedural code.

**What we already have**:
- `ParticleLifeCreature` -- transparent bubble shells with internal particle ecosystems using Particle Life physics
- `BubblePhysics` -- deformation, wobble, ground sag, turn bulge, impact response
- Vitality (red core particles), Essence (white orbital particles), Armor (grey exterior particles)
- NPR pipeline -- Kuwahara brush strokes, edge darkening, bloom, paper texture
- 6-color elemental system with interaction matrices
- Wand as a companion blob creature

**Design philosophy**: Items should not be traditional swords/shields -- they should be **extensions of the blob/particle metaphor**.

---

## Option A: Symbiotic Blob Attachments

**Concept**: Items are smaller `ParticleLifeCreature` organisms that physically bond to your bubble, creating a symbiotic relationship. Each item-blob has its own particle ecosystem that interacts with your internal particles.

### How It Works

```
Player Bubble (host)
  |
  +-- Offensive Symbiote (extends outward like a pseudopod)
  |     -> elongated sub-blob, particles flow from host into it
  |
  +-- Defensive Symbiote (orbits like a shield satellite)
  |     -> flattened blob that intercepts incoming projectiles
  |
  +-- Catalytic Symbiote (merges into membrane surface)
        -> enhances color regen, visible as a bright patch on bubble
```

### Equipment Slots = Attachment Points

| Slot | Position | Visual | Gameplay |
|------|----------|--------|----------|
| **Crown** | Top of bubble | Small blob perched on top, drips particles down | Passive buffs (XP, vision) |
| **Core Implant** | Center | Visible through membrane, glows, displaces vitality particles | Raw stat boosts |
| **Mantle** | Wrapping upper surface | Spreads across membrane like oil on water | Damage resistance, elemental affinity |
| **Tendril** | Extends from side | Elongated sub-blob that reaches outward | Offensive range, attack patterns |
| **Satellite** | Orbiting exterior | Independent small blob in orbit | Automated attacks, shields |
| **Root** | Bottom, touching ground | Tendrils that spread below | Movement speed, ground effects |

### Visual Differentiation by Rarity

| Rarity | Symbiote Behavior | Particles | Membrane Effect |
|--------|-------------------|-----------|-----------------|
| Common | Sluggish, barely moves | 10-15, dim | Slight color tint where attached |
| Uncommon | Gentle pulse | 20-30, soft glow | Visible attachment point shimmer |
| Rare | Active breathing, responds to combat | 40-60, bright | Iridescent patch spreading from contact |
| Epic | Aggressive animation, particles flow between host/symbiote | 80-100, trails | Membrane warps around attachment, Fresnel shift |
| Legendary | Symbiote and host pulse in sync, particle exchange visible | 120+, lightning arcs | Membrane becomes partially transparent at contact, internal particle reorganization visible |

### Technical Implementation

- Reuse `ParticleLifeCreature` class with new presets (smaller radii, fewer particles)
- Add `attachTo(hostCreature, slot)` method that constrains position relative to host
- Particle bridge: occasionally transfer particles between symbiote and host (visual only)
- Smooth-union the bubble geometries at contact point using vertex shader displacement
- Leverage existing `BubblePhysics` for symbiote wobble/deformation

### Pros
- Deeply thematic -- items ARE living things in this world
- Reuses core tech (`ParticleLifeCreature`, `BubblePhysics`)
- Each item is visually unique through particle count, element mix, attachment behavior
- Players can literally see their build on their character

### Cons
- Performance: each symbiote adds ~50-100 particles to the scene
- Complexity: managing attachment physics and smooth-union blending
- Could get visually noisy with multiple symbiotes

---

## Option B: Particle Recipe Mutations (Interaction Matrix Modifiers)

**Concept**: Items are not physical objects -- they are **mutations to your Particle Life interaction matrix**. Finding a "Crimson Fury Core" literally changes how fire particles behave inside your bubble. The item IS a physics rule change. You can see the effect immediately because your creature's internal behavior visibly shifts.

### How It Works

The Particle Life system already has an interaction matrix:
```
         Fire  Water  Earth  Air  Shadow  Light
Fire      0    -0.5    0.3   0.4   0      0
Water    0.3    0     0.3   -0.5   0      0
...
```

**Items modify specific cells in this matrix**, changing attraction/repulsion between particle types.

### Example Items

| Item | Matrix Change | Visual Effect |
|------|--------------|---------------|
| **Ember Heart** | Fire-Fire attraction +0.3 | Fire particles cluster tightly at core, pulsing red knot |
| **Tidal Weave** | Water-Air attraction +0.5 | Water and air particles form swirling vortex pattern |
| **Shadow Anchor** | Shadow-Shadow attraction +0.8 | Shadow particles collapse into dense dark core |
| **Prismatic Chaos** | All interactions randomized | Particles exhibit wild, unpredictable behavior |
| **Elemental Harmony** | All repulsions reduced by 0.2 | Particles spread evenly, serene internal state |
| **Void Leak** | Shadow repels everything at -0.6 | Shadow particles push all others to bubble edge, dark center |
| **Crystal Lattice** | All attractions become 0.0 | Particles form evenly-spaced grid pattern (no attraction) |

### Equipment as "Recipes"

Instead of traditional equipment slots, players collect and combine **Resonance Recipes** -- sets of matrix modifications that stack:

```
Recipe: "Berserker's Fury"
  - Fire-Fire: +0.4 (fire clusters aggressively)
  - Fire-Water: -0.3 (fire repels water more)
  - Particle speed: +20%
  Visual: Tight red knot at core, water pushed to edges, fast chaotic motion
  Gameplay: +30% fire damage, -15% water resistance
```

### Visualization

The beauty is the visualization IS the gameplay -- changing the matrix changes how the creature LOOKS and BEHAVES simultaneously.

**Readable patterns:**
- Tight core cluster = offensive power (concentrated energy)
- Even distribution = balanced/defensive (stable membrane)
- Swirling vortex = speed/agility (dynamic energy)
- Separated layers = elemental specialization (color stratification)
- Chaotic noise = high risk/high reward (unstable but powerful)

### UI: Recipe Viewer

A 2D preview panel showing the interaction matrix as a colored grid (green = attract, red = repel, brightness = intensity). Players can see at a glance what a recipe does before equipping it. The preview renders a small `ParticleLifeCreature` running the recipe in real-time.

### Technical Implementation

- Modify `ParticleLifeCreature.interactionMatrix` at runtime
- Add `applyRecipe(recipe)` and `removeRecipe(recipe)` methods
- Matrix changes are additive -- multiple recipes stack
- Clamp final matrix values to [-1, 1] range
- Store recipes as simple JSON: `{ "fire-fire": 0.3, "water-air": 0.5 }`

### Pros
- Zero additional geometry or draw calls -- items modify existing particles
- Extremely performant -- just changing numbers in a matrix
- Deeply emergent -- players discover unexpected visual/gameplay combos
- Thematically perfect -- in a world of living color, items ARE behavioral mutations
- Easy to generate procedurally -- random matrix perturbations create new items

### Cons
- Harder to communicate item properties at a glance (subtle visual differences)
- Could be confusing without good UI showing matrix changes
- Some combinations might create degenerate particle behavior
- Less "collectible" feel -- no physical object to find

---

## Option C: Chromatic Crystallization (SDF Geometry Inside Blobs)

**Concept**: When color particles are compressed with enough force, they crystallize into geometric structures -- **SDF-rendered gems and crystals** that float inside or orbit the bubble. Items are crystallized color essence. This creates a striking visual contrast between the organic blob exterior and sharp geometric items within.

### How It Works

```
Transparent Bubble
  |
  +-- Particle ecosystem (existing, organic motion)
  |
  +-- Crystallized Items (NEW, geometric, rendered via SDF)
        -> Faceted gem floating at core (weapon)
        -> Ring of small crystals orbiting (armor)
        -> Crown of spikes protruding through membrane (helm)
```

### Crystal Generation via SDF

Each crystal is a raymarched SDF object rendered on a quad inside the bubble:

```glsl
// Example: Fire Crystal
float crystal = sdOctahedron(p, 0.15);       // Base octahedron
crystal = opSmoothUnion(crystal,
  sdPyramid(p - vec3(0, 0.1, 0), 0.08),     // Top spike
  0.02);
float noise = fbm(p * 8.0 + time * 0.5);     // Surface detail
crystal += noise * 0.01;                      // Micro-facets
```

### Crystal Types by Slot

| Slot | Shape | SDF Primitives | Inside/Outside |
|------|-------|----------------|----------------|
| **Weapon Crystal** | Elongated shard | Capsule + cone tips | Inside, aligned with movement direction |
| **Armor Lattice** | Cage/shell of connected bars | Torus + cylinders via repetition | Outside, replaces some armor particles |
| **Core Gem** | Faceted polyhedron | Octahedron, icosahedron | Center of bubble, displaces vitality particles |
| **Focus Lens** | Disc/ring | Torus + flat cylinder | Floats in front, projectiles pass through it |
| **Crown Spires** | Upward spikes | Cones + pyramids | Protrude through top of membrane |
| **Sigil Ring** | Flat inscribed disc | 2D SDF patterns on a plane | Orbits at membrane level, visible as surface pattern |

### Rarity = Geometric Complexity

| Rarity | Geometry | Surface | Glow | Animation |
|--------|----------|---------|------|-----------|
| Common | Single primitive (sphere, box) | Smooth | None | Static |
| Uncommon | 2-3 primitives combined | Subtle facets | Faint rim glow | Slow rotation |
| Rare | 4-6 primitives, smooth-unioned | Noise-displaced surface | Color-matched glow | Rotation + pulse |
| Epic | Complex boolean operations | Worley noise (crystalline texture) | Strong glow + Fresnel | Rotation + internal light flicker |
| Legendary | Fractal-like recursive SDF | Iridescent surface via thin-film shader | Bloom-visible radiance | Rotation + particle emission + membrane distortion |

### Color Coding

Crystal color = element of the item:
- **Crimson crystal** -- red, faceted, hot glow, internal fire particles orbit it
- **Azure crystal** -- blue, smooth, cold fog effect, nearby water particles attracted
- **Verdant crystal** -- green, organic shape (like a seed), growth-like surface noise
- **Golden crystal** -- yellow, sharp geometric, lens flare effect
- **Violet crystal** -- purple, impossible geometry (Escher-like SDF), spatial distortion

### Technical Implementation

- Render SDF crystals as raymarched quads (screen-space) or via marching cubes mesh
- For in-world: use `THREE.MarchingCubes` (built into Three.js) at low resolution (16x16x16)
- For inventory/preview: full raymarched SDF shader on a fullscreen quad
- Crystals interact with existing particle system: nearby particles orbit/are attracted to crystal
- Add selective bloom layer for crystal glow (project already has `UnrealBloomPass`)

### References
- [Inigo Quilez SDF Primitives](https://iquilezles.org/articles/distfunctions/) -- definitive SDF function library
- [Three.js Marching Cubes](https://threejs.org/examples/webgl_marchingcubes.html) -- built-in metaball/SDF mesh
- [Ray Marching SDFs - Jamie Wong](https://jamie-wong.com/2016/07/15/ray-marching-signed-distance-functions/)
- [Demoscene 64k intros](https://www.lofibucket.com/articles/64k_intro.html) -- procedural SDF scenes in <64KB
- [Bumpy Metaballs](https://www.clicktorelease.com/code/bumpy-metaballs/) -- noise-displaced metaball surfaces

### Pros
- Visually striking -- geometric crystals inside organic blobs is a unique aesthetic
- SDF generation is entirely procedural (perfect for agentic constraint)
- Clear visual hierarchy -- bigger/more complex crystals = better items
- Crystals can interact with existing particle systems (attraction/repulsion)
- Inventory screen can use high-quality raymarched rendering

### Cons
- Raymarching is GPU-expensive -- needs LOD strategy
- Two rendering paradigms in one scene (raster blobs + raymarched crystals)
- May need to limit visible crystals per creature for performance
- More complex rendering pipeline integration

---

## Option D: Membrane Inscription System (Shader-Based Equipment)

**Concept**: Equipment is inscribed directly onto the bubble membrane -- shader effects that modify the Fresnel, add animated patterns, change transparency regions, and create visible "tattoos" on the bubble surface. Your blob's skin IS your equipment.

### How It Works

The bubble is already rendered with a custom vertex+fragment shader. Equipment adds **inscription layers** to this shader -- procedural patterns painted onto the membrane.

```
Base Bubble Shader
  +-- Layer 1: Armor Inscription (geometric pattern, grey-metallic)
  +-- Layer 2: Elemental Attunement (color wash, animated flow)
  +-- Layer 3: Enchantment Sigil (glowing symbol, pulses with attacks)
  +-- Layer 4: Rarity Aura (Fresnel modification, rim color/intensity)
```

### Inscription Types

| Slot | Pattern Type | Shader Technique | Example |
|------|-------------|------------------|---------|
| **Armor** | Tessellation/scales | Voronoi cells with edge highlighting | Hexagonal scale pattern across lower hemisphere |
| **Helm** | Crown/halo | Radial SDF pattern at top | Ring of glowing runes orbiting crown |
| **Cloak** | Flowing gradient | Animated UV-warped color field | Color cascading down from top like paint dripping |
| **Sigil** | Symbol/glyph | 2D SDF rendered on surface | Elemental symbol (procedural) visible through membrane |
| **Enchant** | Energy lines | Animated bezier curves on surface | Lightning-like lines crawling across membrane |
| **Aura** | Fresnel modification | Rim color and power changes | Epic items change the rim from default blue to blazing gold |

### Procedural Pattern Generation

All patterns generated via shader math -- no textures needed:

```glsl
// Voronoi armor scales
vec2 cell = voronoi(uv * scaleCount);
float edge = smoothstep(0.02, 0.05, cell.y); // cell edge detection
vec3 armorColor = mix(metallicGrey, darkGrey, edge);
armorColor *= (1.0 + 0.2 * sin(time + cell.x * 6.28)); // shimmer

// Elemental flow (animated gradient)
float flow = fbm(uv * 3.0 + vec2(time * 0.3, 0.0));
vec3 elementColor = mix(fireOrange, fireRed, flow);
float mask = smoothstep(0.3, 0.7, uv.y); // upper hemisphere only

// Enchantment sigil (2D SDF on surface)
float sigil = sdStar(uv - 0.5, 0.15, 5, 0.4); // 5-pointed star
float glowRing = abs(sigil) - 0.005;
float glow = exp(-glowRing * 200.0) * pulseIntensity;
```

### Visual Hierarchy

Players read equipment quality by how much of the membrane is "inscribed":

- **Naked bubble**: Completely transparent, default Fresnel, no patterns
- **Light equipment**: Subtle single-layer pattern on lower hemisphere
- **Medium equipment**: Multi-layer patterns covering ~50% of surface
- **Heavy equipment**: Dense inscriptions covering most of surface, reduced transparency
- **Legendary**: Membrane is a canvas of animated, glowing, multi-layered patterns -- the creature looks like a living spell

### Technical Implementation

- Extend existing bubble vertex/fragment shader with uniform-driven inscription layers
- Each equipped item adds uniforms: `uInscription1Type`, `uInscription1Color`, `uInscription1Intensity`, etc.
- Pattern library: 8-10 procedural pattern functions (voronoi, flow, sigil, scales, runes, energy lines, etc.)
- Mix layers using alpha blending with falloff masks (hemisphere, radial, etc.)
- Animate via time uniform (already exists in shader)

### Pros
- Zero additional geometry -- purely shader-based, minimal performance impact
- Creates a unique "living tattoo" aesthetic that fits the painted realm
- Clear visual progression (naked bubble -> inscribed artifact)
- Integrates seamlessly with existing rendering pipeline
- Easy to generate procedurally -- patterns are math functions with random seeds

### Cons
- Shader complexity grows with number of inscription layers
- May obscure the internal particle ecosystem that makes blobs interesting
- Less "collectible" -- items are shader parameters, not objects in the world
- Harder to show items as drops/pickups (need a preview representation)

---

## Option E: Particle Constellation Equipment

**Concept**: Items force subsets of your internal particles into specific formations -- **constellations**. Equipping a "Crimson Lance" causes fire particles to arrange into a spear-like line extending from the bubble. A "Verdant Shield" causes earth particles to form a flat disc in front. The particles are still alive and breathing, but their attractor points create recognizable shapes.

### How It Works

Add **formation attractors** to the particle system. Each equipped item defines attractor points that specific particle types are drawn toward, creating visible formations while preserving the organic Particle Life behavior.

```javascript
const formations = {
  'crimson-lance': {
    element: 'fire',
    attractors: [
      { pos: [0, 0, 0.3], strength: 0.8 },
      { pos: [0, 0, 0.5], strength: 0.6 },
      { pos: [0, 0, 0.7], strength: 0.4 },
      { pos: [0, 0, 0.9], strength: 0.2 },  // tip, weakest = particles drift more
    ],
    particleCount: 30,  // how many particles are conscripted
    stability: 0.7,     // 0=loose cloud, 1=rigid formation
  }
};
```

### Formation Types

| Equipment | Formation Shape | Element | Visual |
|-----------|----------------|---------|--------|
| **Lance** | Linear chain extending forward | Fire | Red particles in a spear line, tip particles drift most |
| **Shield** | Flat disc in front | Earth | Green particles form a hovering plate, wobbles on impact |
| **Crown** | Ring above bubble | Light | Golden particles orbiting above like a halo |
| **Cloak** | Trailing cloud behind | Shadow | Purple particles drag behind during movement |
| **Wings** | Two swept arcs from sides | Air | White particles form swept-back wing shapes |
| **Roots** | Downward tendrils | Earth | Green particles reach toward ground |
| **Eye** | Dense sphere with gap | Shadow | Dark particles form a sphere with a gap = "iris" |
| **Storm** | Rapid orbit ring at equator | Water+Air | Blue-white particles spinning fast around middle |

### Rarity = Formation Stability & Complexity

| Rarity | Stability | Particle Count | Formation Detail |
|--------|-----------|----------------|------------------|
| Common | 0.3 (barely holds shape, drifts a lot) | 10-15 | Simple: line, circle |
| Uncommon | 0.5 (recognizable but loose) | 20-30 | Compound: line + circle |
| Rare | 0.7 (clear shape, gentle breathing) | 40-50 | Complex: helix, branching |
| Epic | 0.85 (crisp formation, slight pulse) | 60-80 | Intricate: fractal, nested shapes |
| Legendary | 0.95 (razor-sharp, synchronized pulse) | 100+ | Spectacular: animated transformation, leaves trails |

### Dynamic Formation Behavior

Formations respond to gameplay:
- **Attacking**: Lance formation extends further, particles accelerate to tip
- **Blocking**: Shield formation compresses, becomes denser
- **Hit**: Formation scatters momentarily, particles scramble then reform
- **Low health**: Formations destabilize, particles struggle to hold position
- **Ability use**: Formation briefly transforms (lance spins into shield, etc.)

### Technical Implementation

- Add `FormationSystem` that manages attractor points per equipped item
- In particle update loop, blend between Particle Life forces and formation attractors:
  ```
  finalForce = particleLifeForce * (1 - stability) + formationAttractor * stability
  ```
- Formations defined as JSON arrays of attractor positions + strengths
- Particles "conscripted" by formation are marked and rendered with slight size/glow boost
- Remaining particles continue normal Particle Life behavior

### Pros
- Leverages existing particle system -- formations are just new attractor forces
- Visually readable -- spear shape = weapon, disc shape = shield
- Preserves the organic, living quality (particles still breathe/drift)
- Equipment is literally visible on the creature at all times
- Easy to procedurally generate (random attractor point clouds)
- Performance: zero new geometry, just modified force calculations

### Cons
- Limited shape fidelity -- particles can only approximate formations
- Visual noise with multiple formations active simultaneously
- Requires careful tuning of stability vs. organic feel
- Formation collapse under rapid movement could be disorienting

---

## Hybrid Recommendation: "Living Arsenal" (A + B + E Combined)

The most compelling system combines elements from multiple options into a coherent whole:

### Equipment Paradigm

```
ITEMS IN THIS WORLD ARE LIVING COLOR ESSENCE

You don't "find a sword" -- you absorb a Symbiote that teaches
your particles a new formation and mutates your interaction matrix.
```

### Three-Layer Item System

**Layer 1 -- Matrix Mutation (Option B)**
Every item modifies your Particle Life interaction matrix. This is the core stat system. A weapon that does fire damage increases Fire-Fire attraction. A defensive item increases Earth self-repulsion (spreading earth particles into a protective shell). This is invisible but creates emergent visual changes.

**Layer 2 -- Particle Formation (Option E)**
Major equipment (weapon, shield) conscripts some particles into formations. Your weapon is visible as a formation of colored particles extending from your bubble. Your armor is a formation of grey particles in a specific protective pattern. Formations respond to combat state.

**Layer 3 -- Symbiote Companions (Option A, limited)**
Legendary/epic items only. A small companion blob orbits or attaches to your bubble, creating the most visually impressive tier. These are rare and special -- most equipment is formations + mutations, but the best items get their own living blob.

### Rarity Progression (What the Player Sees)

| Rarity | Layer 1 (Matrix) | Layer 2 (Formation) | Layer 3 (Symbiote) | Overall Visual |
|--------|------------------|---------------------|---------------------|----------------|
| Common | Subtle matrix shift | No formation | No | Barely noticeable internal change |
| Uncommon | Moderate matrix shift | Loose formation (stability 0.3) | No | Some particles drift into rough shape |
| Rare | Strong matrix shift | Clear formation (stability 0.6) | No | Recognizable shape + changed particle behavior |
| Epic | Major matrix shift | Crisp formation (stability 0.8) + Fresnel modification | No | Dramatic internal restructuring + glowing formation |
| Legendary | Extreme matrix shift | Perfect formation (stability 0.95) + membrane inscription | YES -- companion blob | Transformed creature with companion, complex formations, membrane effects |

### Item Drops: Chromatic Essence Orbs

When items drop from enemies, they appear as **small floating particle clusters** -- a preview of the formation they'll create. The cluster slowly rotates, its particles demonstrating the formation pattern. Rarity is communicated by:
- **Size** of the cluster (bigger = rarer)
- **Particle count** (more = rarer)
- **Glow intensity** (brighter = rarer)
- **Formation complexity** (simple circle vs. intricate pattern)
- **Color** matching the elemental affinity

Players approach and absorb the orb -- particles flow from the orb into the player's bubble, and the formation establishes itself.

### Pickup Animation

```
1. Player approaches orb
2. Orb particles accelerate toward player bubble
3. Particles stream through membrane
4. Inside bubble, particles find their formation positions
5. Matrix mutation applies (subtle shift in all particle behavior)
6. Brief flash on membrane (inscription appears if epic+)
7. If legendary: symbiote blob inflates from absorbed particles
```

### Equipment Slots

| Slot | Formation Location | Matrix Focus | Max Items |
|------|-------------------|--------------|-----------|
| **Weapon** | Front/side extension | Offensive matrix (damage type affinities) | 1 |
| **Guard** | Front disc/shell | Defensive matrix (resistance affinities) | 1 |
| **Core** | Center of bubble | Base stats (vitality, essence density) | 1 |
| **Mantle** | Upper hemisphere glow | Passive effects (regen, speed) | 1 |
| **Resonance** | Color of formation particles | Elemental specialization | 2 |

### Procedural Item Generation Algorithm

```javascript
function generateItem(level, rarity, element) {
  const item = {
    name: generateName(element, rarity),  // "Scorching Ember Lance"
    rarity: rarity,
    element: element,

    // Layer 1: Matrix mutation
    matrixMods: generateMatrixMods(element, rarity, level),

    // Layer 2: Formation (uncommon+)
    formation: rarity >= UNCOMMON ? {
      attractors: generateAttractors(item.slot, rarity),
      stability: 0.2 + rarity * 0.15,
      particleCount: 10 + rarity * 15,
      element: element,
    } : null,

    // Layer 3: Symbiote (legendary only)
    symbiote: rarity >= LEGENDARY ? {
      preset: generateSymbiotePreset(element),
      radius: 0.15 + Math.random() * 0.1,
      particleCount: 30 + Math.random() * 20,
      attachSlot: item.slot,
    } : null,

    // Stats
    stats: calculateStats(level, rarity, element),
  };
  return item;
}
```

---

## Performance Budget

| Component | Per-Item Cost | Max On-Screen | Total Budget |
|-----------|--------------|---------------|-------------|
| Matrix mutation | ~0 (just number changes) | Unlimited | 0ms |
| Formation attractors | ~0.1ms per formation update | 5 formations (player equipped) | 0.5ms |
| Enemy formations | ~0.05ms (simplified) | 10 enemies x 1 formation | 0.5ms |
| Symbiote blobs | ~0.5ms per blob | 2 (player legendaries) | 1.0ms |
| Item drop orbs | ~0.1ms per orb | 5 on ground | 0.5ms |
| **Total** | | | **~2.5ms CPU** |

This fits well within the existing budget of 20-30 creatures at 60 FPS on mid-range hardware.

---

## Research Sources

### Procedural Item Systems
- [Borderlands procedural weapon generation](https://procedural-generation.tumblr.com/post/156045652087/borderlands-2) -- modular visual assembly
- [URR procedural weapons](https://www.markrjohnsongames.com/2021/08/31/0-9-august-urrpdate-procedural-weapon-and-shield-generation/) -- civilization-based visual differentiation with quality tiers
- [Path of Exile / Diablo affix systems](https://diablo-archive.fandom.com/wiki/Procedural_Generation) -- rarity-driven generation

### Blob/Metaball Technology
- [Three.js MarchingCubes](https://threejs.org/examples/webgl_marchingcubes.html) -- built-in metaball mesh generation
- [GPU Metaballs for WebGL](https://github.com/sjpt/metaballsWebgl) -- optimized GPU implementation
- [Bumpy Metaballs](https://www.clicktorelease.com/code/bumpy-metaballs/) -- noise-displaced metaball surfaces
- [Metaball rendering techniques](https://matiaslavik.wordpress.com/computer-graphics/metaball-rendering/)

### SDF & Raymarching
- [Inigo Quilez - SDF Primitives](https://iquilezles.org/articles/distfunctions/) -- definitive SDF function library
- [Inigo Quilez - Smooth Min/Max](https://iquilezles.org/articles/smin/) -- organic shape blending
- [Ray Marching SDFs - Jamie Wong](https://jamie-wong.com/2016/07/15/ray-marching-signed-distance-functions/)
- [Painting with Math - Raymarching](https://blog.maximeheckel.com/posts/painting-with-math-a-gentle-study-of-raymarching/)

### Shader Effects
- [Vertex Displacement with 3D Noise](https://www.clicktorelease.com/blog/vertex-displacement-noise-3d-webgl-glsl-three-js/) -- surface detail via shader
- [10 Noise Functions for Three.js](https://threejsroadmap.com/blog/10-noise-functions-for-threejs-tsl-shaders) -- perlin, simplex, worley, curl
- [Rim/Fresnel Lighting](https://threejsroadmap.com/blog/rim-lighting-shader) -- procedural glow edges
- [Fresnel Shader Material](https://github.com/OtanoStudio/Fresnel-Shader-Material) -- Three.js implementation
- [Selective Bloom in Three.js](https://discourse.threejs.org/t/how-do-i-set-up-post-processing-to-make-only-one-object-in-the-scene-glow-not-all-of-it/50643)

### Particle Systems
- [GPGPU Particles in Three.js](https://tympanus.net/codrops/2024/12/19/crafting-a-dreamy-particle-effect-with-three-js-and-gpgpu/) -- GPU-driven particle system
- [Dissolve Effect with Particles](https://tympanus.net/codrops/2025/02/17/implementing-a-dissolve-effect-with-shaders-and-particles-in-three-js/)

### Color Theory for Items
- [Color Theory Codifies Item Quality](https://medium.com/@ClaireFish/how-color-theory-codifies-item-quality-in-video-games-104d8118044) -- why white->green->blue->purple->orange works
- [Procedural Color Algorithm](https://shahriyarshahrabi.medium.com/procedural-color-algorithm-a37739f6dc1) -- generating harmonious palettes in code

### Demoscene (Procedural Art Mastery)
- [How a 64k Intro is Made](https://www.lofibucket.com/articles/64k_intro.html) -- everything procedural in <64KB
- [Inigo Quilez Demoscene](https://iquilezles.org/demoscene/) -- SDF scenes from math alone

### GDC Talks
- [Exploring the Tech and Design of Noita](https://www.gdcvault.com/play/1025695/) -- per-pixel physics simulation
- [Practical Procedural Generation for Everyone](https://gdcvault.com/play/1024213/) -- PCG building blocks
