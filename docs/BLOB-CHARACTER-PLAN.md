# Alternative Character Models: Blob Bubbles with Particle Life

## Overview

This document explores replacing humanoid character models with **transparent blob/bubble shapes containing Particle Life simulations**. This approach sidesteps AI 3D model generation challenges while creating visually unique, procedurally-driven characters.

---

## Option Analysis

### Option 1: Particle Life Blob Creatures (Recommended)

**Concept:** Transparent bubble shells containing colored particles that exhibit emergent behavior via Particle Life physics.

**Visual:**
```
    ╭──────────╮
   ╱ ○ ● ○  ●  ╲     ← Transparent bubble shell
  │  ● ○  ● ○   │    ← Internal particles with
  │   ○ ●  ○ ●  │       Particle Life physics
   ╲  ● ○  ●   ╱     ← Particles attract/repel
    ╰──────────╯        based on type (color)
```

**Pros:**
- 100% procedural - no AI model generation needed
- Each creature is unique via different particle type ratios
- Emergent behavior creates "living" appearance
- Fits watercolor aesthetic (soft blending, glowing particles)
- GPU-friendly (instanced particles, single draw call)
- No rigging/animation complexity

**Cons:**
- Less humanoid/relatable characters
- Particle Life can be chaotic if not tuned properly
- Needs boundary forces to keep particles inside bubble

**Technical Approach:**
1. Outer shell: Refractive `SphereGeometry` with fresnel transparency
2. Inner particles: 100-300 particles per creature with Particle Life rules
3. Color types define creature class (red=aggressive, blue=defensive, etc.)
4. Particle interaction matrix creates unique "personalities"

**Performance:** 500-1000 particles at 60fps with spatial grid optimization

---

### Option 2: AI-Generated Sprite Billboards

**Concept:** Use AI (Stable Diffusion, Midjourney) to generate 2D watercolor sprites, display as always-facing billboards.

**Pros:**
- Full artistic control via prompts
- Watercolor style guaranteed
- Very simple rendering (textured quads)
- Can batch-generate hundreds of variations

**Cons:**
- 2D appearance in 3D world
- No depth/volume
- Animation requires sprite sheets (complex to generate)

**Tools:** Retro Diffusion, Scenario, SD sprite sheet generators

---

### Option 3: AI 3D Model + Simplified Rendering

**Concept:** Generate models via Tripo3D/Meshy, but render as stylized blobs rather than detailed meshes.

**Pros:**
- Still have 3D form for gameplay
- AI handles base shape generation
- Can apply blob shader post-generation

**Cons:**
- AI topology issues persist
- Rigging/animation still problematic
- Extra pipeline complexity

---

### Option 4: Hybrid - Blob Shell + AI Sprite Core

**Concept:** Transparent blob bubble containing a flat AI-generated sprite at center.

**Pros:**
- 3D bubble provides volume/depth
- AI sprite provides character identity
- Sprite doesn't need animation (bubble motion is enough)

**Cons:**
- Sprite visible through refraction may look odd
- Two rendering systems to maintain

---

## Recommended Approach: Particle Life Blobs

### Why This Fits the Game

1. **Vampire Survivors-like gameplay** = many enemies on screen
   - Particle creatures can be spawned cheaply
   - No asset loading per enemy type
   - LOD: reduce particle count at distance

2. **Watercolor aesthetic** preserved
   - Additive blending creates paint-like saturation
   - Soft edges via fresnel/alpha falloff
   - Post-process Kuwahara filter still applies

3. **Unique enemy differentiation** via particle behavior
   - Shade: Slow, orbiting particles (ethereal)
   - Crimson: Fast, chaotic particles (aggressive)
   - Verdant: Clustered, sticky particles (blobby)
   - Azure: Flowing, stream-like particles (fluid)

4. **Boss creatures** = larger bubbles with more particles
   - Guardian: 500+ particles, multiple colors
   - Void Harbinger: Black hole effect pulling particles inward

---

## Technical Implementation Plan

### Phase 1: Core Particle Life System

```javascript
// particle-life-creature.js

class ParticleLifeCreature {
    constructor(options = {}) {
        this.particleCount = options.particles || 150;
        this.radius = options.radius || 1.0;
        this.types = options.types || 3;  // Number of particle colors

        // Interaction matrix: attraction[typeA][typeB] = force (-1 to 1)
        this.attractions = this.generateAttractionMatrix();

        // Particle data
        this.positions = new Float32Array(this.particleCount * 3);
        this.velocities = new Float32Array(this.particleCount * 3);
        this.particleTypes = new Uint8Array(this.particleCount);

        // THREE.js rendering
        this.bubbleMesh = null;  // Outer shell
        this.particleMesh = null;  // Inner points
    }

    generateAttractionMatrix() {
        // Random matrix creates unique creature behavior
        const matrix = [];
        for (let i = 0; i < this.types; i++) {
            matrix[i] = [];
            for (let j = 0; j < this.types; j++) {
                matrix[i][j] = Math.random() * 2 - 1;  // -1 to 1
            }
        }
        return matrix;
    }

    update(delta) {
        // Spatial grid for O(n) instead of O(n²)
        const grid = this.buildSpatialGrid();

        for (let i = 0; i < this.particleCount; i++) {
            const typeA = this.particleTypes[i];
            let fx = 0, fy = 0, fz = 0;

            // Get nearby particles from grid
            const neighbors = this.getNeighbors(grid, i);

            for (const j of neighbors) {
                const typeB = this.particleTypes[j];
                const attraction = this.attractions[typeA][typeB];

                // Distance and direction
                const dx = this.positions[j*3] - this.positions[i*3];
                const dy = this.positions[j*3+1] - this.positions[i*3+1];
                const dz = this.positions[j*3+2] - this.positions[i*3+2];
                const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);

                if (dist > 0.01 && dist < 0.5) {  // Interaction radius
                    // Repulsion when too close
                    if (dist < 0.1) {
                        const repel = (0.1 - dist) * 5;
                        fx -= (dx/dist) * repel;
                        fy -= (dy/dist) * repel;
                        fz -= (dz/dist) * repel;
                    } else {
                        // Attraction/repulsion based on types
                        const force = attraction / dist;
                        fx += (dx/dist) * force;
                        fy += (dy/dist) * force;
                        fz += (dz/dist) * force;
                    }
                }
            }

            // Boundary force - keep inside bubble
            const px = this.positions[i*3];
            const py = this.positions[i*3+1];
            const pz = this.positions[i*3+2];
            const distFromCenter = Math.sqrt(px*px + py*py + pz*pz);

            if (distFromCenter > this.radius * 0.8) {
                const pushBack = (distFromCenter - this.radius * 0.8) * 2;
                fx -= (px/distFromCenter) * pushBack;
                fy -= (py/distFromCenter) * pushBack;
                fz -= (pz/distFromCenter) * pushBack;
            }

            // Apply forces
            this.velocities[i*3] += fx * delta;
            this.velocities[i*3+1] += fy * delta;
            this.velocities[i*3+2] += fz * delta;

            // Friction
            this.velocities[i*3] *= 0.95;
            this.velocities[i*3+1] *= 0.95;
            this.velocities[i*3+2] *= 0.95;

            // Update position
            this.positions[i*3] += this.velocities[i*3] * delta;
            this.positions[i*3+1] += this.velocities[i*3+1] * delta;
            this.positions[i*3+2] += this.velocities[i*3+2] * delta;
        }

        // Update GPU buffer
        this.particleMesh.geometry.attributes.position.needsUpdate = true;
    }
}
```

### Phase 2: Visual Rendering

```javascript
// Bubble shell material
const bubbleMaterial = new THREE.ShaderMaterial({
    uniforms: {
        uColor: { value: new THREE.Color(0x88aaff) },
        uOpacity: { value: 0.3 },
        uFresnelPower: { value: 2.0 },
        uTime: { value: 0 }
    },
    vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewDir;

        void main() {
            vNormal = normalize(normalMatrix * normal);
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vViewDir = normalize(cameraPosition - worldPos.xyz);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        uniform float uFresnelPower;

        varying vec3 vNormal;
        varying vec3 vViewDir;

        void main() {
            // Fresnel: more opaque at edges
            float fresnel = pow(1.0 - abs(dot(vViewDir, vNormal)), uFresnelPower);
            float alpha = uOpacity + fresnel * 0.5;

            // Slight iridescence
            vec3 color = uColor + vNormal * 0.1;

            gl_FragColor = vec4(color, alpha);
        }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false
});

// Particle material (inside bubble)
const particleMaterial = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0 }
    },
    vertexShader: `
        attribute vec3 aColor;
        attribute float aSize;

        varying vec3 vColor;

        void main() {
            vColor = aColor;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = aSize * (300.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragmentShader: `
        varying vec3 vColor;

        void main() {
            // Soft circular particle
            vec2 center = gl_PointCoord - 0.5;
            float dist = length(center) * 2.0;
            float alpha = 1.0 - smoothstep(0.5, 1.0, dist);

            // Glow effect
            vec3 glow = vColor * (1.0 + (1.0 - dist) * 0.5);

            gl_FragColor = vec4(glow, alpha * 0.8);
        }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});
```

### Phase 3: Enemy Type Presets

```javascript
const CREATURE_PRESETS = {
    shade: {
        particles: 100,
        radius: 0.8,
        types: 2,
        colors: [0x666688, 0x8888aa],
        attractions: [
            [0.5, -0.2],   // Type 0 attracts self, repels type 1
            [-0.2, 0.5]    // Type 1 repels type 0, attracts self
        ],
        // Results in two orbiting clusters
    },

    crimsonWraith: {
        particles: 150,
        radius: 1.0,
        types: 3,
        colors: [0xcc4444, 0xff6644, 0xffaa44],
        attractions: [
            [0.8, 0.3, -0.5],   // Chaotic mixing
            [0.3, 0.6, 0.4],
            [-0.5, 0.4, 0.9]
        ],
        // Results in turbulent, aggressive motion
    },

    verdantSlime: {
        particles: 200,
        radius: 1.2,
        types: 2,
        colors: [0x44aa44, 0x88cc88],
        attractions: [
            [0.9, 0.7],    // Strong mutual attraction
            [0.7, 0.9]
        ],
        // Results in sticky, blobby cluster
    },

    azurePhantom: {
        particles: 120,
        radius: 0.9,
        types: 4,
        colors: [0x4488cc, 0x66aaee, 0x88ccff, 0xaaeeff],
        attractions: [
            [0.2, 0.8, -0.3, 0.1],
            [-0.3, 0.2, 0.8, -0.3],
            [0.1, -0.3, 0.2, 0.8],
            [0.8, 0.1, -0.3, 0.2]
        ],
        // Results in flowing, chasing streams
    },

    chromaticGuardian: {
        particles: 400,
        radius: 2.0,
        types: 5,
        colors: [0xff4444, 0xffaa44, 0xffff44, 0x44ff44, 0x4444ff],
        attractions: 'generateRandom',  // Complex emergent behavior
    }
};
```

---

## Performance Budget

| Component | Per Creature | 10 Creatures | Notes |
|-----------|-------------|--------------|-------|
| Particles | 150 | 1,500 | Well under 5,000 limit |
| Bubble mesh | 32 segments | 320 tris | Negligible |
| Draw calls | 2 | 20 | Could instance |
| Update (grid) | ~0.5ms | ~2ms | O(n) with spatial grid |

**Target:** 20-30 creatures at 60fps on mid-range hardware

---

## AI Generation Opportunities

Even with procedural creatures, AI can assist:

1. **Attraction Matrix Generation** - Train model to generate "interesting" matrices
2. **Color Palette Generation** - AI suggests harmonious particle colors
3. **Behavior Descriptions** - "Generate a matrix for an aggressive creature"
4. **Thumbnail Previews** - AI generates 2D portraits of each creature type

---

## Comparison: Current vs Proposed

| Aspect | Current (Humanoid) | Proposed (Blob) |
|--------|-------------------|-----------------|
| Model source | Mixamo FBX | Procedural |
| Animation | Skeletal clips | Particle physics |
| Visual variety | Limited by assets | Infinite via matrices |
| Performance | Heavy (skinned mesh) | Light (instanced points) |
| Watercolor fit | Good with shader | Excellent (additive blend) |
| AI dependency | Texture generation | Optional (matrices) |
| Rigging issues | Yes (bone names, etc.) | None |

---

## Next Steps

1. **POC:** Create single Particle Life creature in skin-preview.html
2. **Tune:** Find attraction matrices that look good
3. **Integrate:** Replace enemy rendering with blob system
4. **Polish:** Add bubble wobble, glow effects, death animations
5. **Optimize:** Spatial grid, instancing for 30+ creatures

---

## Open Questions

- Should player also be a blob, or remain humanoid for relatability?
- How to indicate creature health? (Bubble opacity? Particle count?)
- Should particles escape when creature dies? (Satisfying death effect)
- Can we procedurally generate unique creatures per run?
