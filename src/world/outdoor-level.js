// outdoor-level.js - Outdoor world PoC with two approaches (Asset vs Particle)
// Matches ArenaLevel public API. URL: ?level=outdoor&approach=assets|particles

import * as THREE from 'three';
import { ELEMENT_TYPES } from '../creatures/particle-life-creature.js';

// ─── Helpers ────────────────────────────────────────────────────────
function smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

// ─── Seeded RNG ─────────────────────────────────────────────────────
function seededRNG(seed) {
    let s = seed | 0;
    return () => {
        s = (s * 1664525 + 1013904223) & 0x7fffffff;
        return s / 0x7fffffff;
    };
}

// ─── Constants ──────────────────────────────────────────────────────
const WORLD_SIZE = 200;
const SPAWN_CENTER = WORLD_SIZE / 2;  // 100
const CLEAR_RADIUS = 25;  // Keep clear around spawn (cosine falloff)
const NUM_TREES = 15;
const NUM_ROCKS = 10;
const NUM_RUINS = 3;

// BotW NPR preset values — auto-tuned via run-style-tuner.js closed-loop optimizer
// Color transfer params from headless calibration; brightness scaled for real GPU
const BOTW_NPR = {
    kuwaharaRadius: 3,
    edgeStrength: 0.05,         // Reduced — edge darkening lowers L in grass-heavy scenes
    edgeThreshold: 0.25,
    bloomStrength: 0.45,        // Slight lift for BotW glow (headless needed 0.89, GPU needs less)
    bloomRadius: 0.5,
    bloomThreshold: 0.75,       // Higher threshold prevents sky from blooming
    grainIntensity: 0,
    vignetteIntensity: 0.05,
    saturationAdjust: 0.92,
    colorTransferStrength: 0.20, // Low strength — preserves sky blue while still warming terrain
    srcMeanL: 52.0,             // Calibrated from scene (headless=40 + ~12 GPU brightness offset)
    srcMeanA: -5.0,             // Original — aggressive correction causes sky magenta (a-channel divergence)
    srcMeanB: 5.1,
    srcStdL: 17.7,
    srcStdA: 12.0,              // Original — keeps sky neutral while grass stays green
    srcStdB: 14.0,              // Matches targetStdB=14: no b-axis compression, preserves sky blue
};

// Lore pickups — environmental storytelling documents found throughout zones
const ZONE_LORE = {
    facility: [
        { title: 'Drilling Log', text: 'Day 147: Karst formation at 380m depth shows anomalous particle density. Dr. Chen wants to open the cavity. I have concerns.' },
        { title: 'ADF Radio Intercept', text: '...Foxtrot-Niner, containment breach at CHILLAGOE DEEP-CORE. Classify ECHO-BLACK. Lethal force authorised...' },
        { title: 'Sun-Bleached Memo', text: 'CSIRO INTERNAL: The self-organizing field has exceeded predicted mass by 400%. Recommend immediate facility evacuation.' },
        { title: 'Smashed Tablet', text: 'It pulled itself out of the pool today. Basketball-sized. Almost translucent. It looked at me. I swear it looked at me.' },
    ],
    scrapyard: [
        { title: 'Prospector Note', text: 'Saw something moving through the old Irvinebank smelter. Thought it was a roo at first. It ate a ute.' },
        { title: 'ABC Radio Transcript', text: '...reports of an unidentified organism moving east along the Kennedy Highway. ADF has closed the road from Mareeba...' },
        { title: 'Torn Poster', text: 'WANTED: Unidentified organism. Contact ADF hotline. DO NOT APPROACH. Reward: $50,000.' },
        { title: 'Scratched Windshield Note', text: 'It dissolved the engine block. Whole thing. Just reached in and absorbed it. Metal and all.' },
    ],
    town: [
        { title: 'Innisfail Advocate', text: 'INNISFAIL ADVOCATE: ADF establishes blockade at Johnstone River bridge. Cane harvest suspended indefinitely.' },
        { title: 'Police Report', text: 'Incident #4471: Subject dissolved patrol car on Edith St. Senior Constable Nguyen uninjured. Requesting ADF backup.' },
        { title: 'Spray Paint', text: 'THE BLOB IS ALIVE — IT JUST WANTS TO LEAVE' },
        { title: 'Voicemail', text: "Babe, take the kids to Nan's in Cairns. Something from that old Chillagoe lab is heading for town." },
        { title: 'Cracked ID Badge', text: 'DR. SARAH CHEN — CSIRO Chillagoe Deep-Core Facility. Security Clearance: OMEGA. Status: MISSING.' },
    ],
};

/**
 * OutdoorLevel - Open outdoor world PoC with two visual approaches
 * Approach A (assets): Procedural 3D geometry + Canvas2D textures
 * Approach B (particles): Entire world built from colored point particles
 */
export class OutdoorLevel {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.options = {
            approach: options.approach || 'assets',  // 'assets' or 'particles'
            seed: options.seed || 42,
            element: options.element ?? ELEMENT_TYPES.FIRE,
            ...options
        };

        this.group = new THREE.Group();
        this.group.name = 'outdoor-world';

        // External terrain height source (e.g. ChunkManager) — when set,
        // getHeightAt() delegates to it and _createTerrain() is skipped.
        // This prevents dual-terrain overlap where objects float in the air.
        this._heightSource = options.heightSource || null;

        this.sceneLights = [];
        this.enemySpawnPoints = [];
        this.animatedObjects = [];
        this.lorePickups = [];

        // Shared layout positions (generated from seed)
        this.layout = null;

        // Approach A specific
        this.heightmap = null;
        this.heightmapRes = 129;  // 128+1 vertices (smoother slopes)
        this.grassInstanced = null;

        // Approach B specific
        this.particleGroups = [];

        // Platform system stub for controller compatibility
        this.platformSystem = null;

        // NPR pipeline reference (set externally by main.js)
        this.nprPipeline = null;
    }

    async build() {
        const approach = this.options.approach;
        console.log(`Building outdoor world: approach=${approach}, seed=${this.options.seed}`);

        // Generate shared layout from seed
        this.layout = this._generateWorldLayout(this.options.seed);

        // Common infrastructure
        this._setupOutdoorLighting();
        this._setupFog();
        this._createProceduralSky();

        // Build the chosen approach
        if (approach === 'hybrid') {
            this._buildHybridWorld();
        } else if (approach === 'particles') {
            this._buildParticleWorld();
        } else {
            this._buildAssetWorld();
        }

        // Add zone-specific environmental objects
        if (this.options.zoneTheme === 'facility') {
            this._createSpawnCompound();
            this._createFacilityObjects();
        } else if (this.options.zoneTheme === 'scrapyard') {
            this._createScrapyardObjects();
        } else if (this.options.zoneTheme === 'town') {
            this._createTownObjects();
        }

        // Scrap pickup points for vehicle part upgrades (outdoor zones only)
        if (this.options.zoneTheme) {
            this._createScrapPickups();
        }

        // Lore pickups for environmental storytelling
        if (this.options.zoneTheme) {
            this._createLorePickups();
        }

        // Generate enemy spawn points
        this._generateSpawnPoints();

        // Add group to scene
        this.scene.add(this.group);

        // Auto-apply BotW NPR (deferred until nprPipeline is set)
        this._nprPending = true;

        console.log(`Outdoor world built: ${approach} approach, ${this.enemySpawnPoints.length} spawn points`);
        return { approach, size: { width: WORLD_SIZE, height: WORLD_SIZE } };
    }

    /**
     * Called by main.js after NPR pipeline is initialized
     */
    setNPRPipeline(pipeline) {
        this.nprPipeline = pipeline;
        if (this._nprPending) {
            this._autoApplyNPR();
            this._nprPending = false;
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // COMMON INFRASTRUCTURE
    // ═══════════════════════════════════════════════════════════════════

    _generateWorldLayout(seed) {
        const rng = seededRNG(seed);
        const layout = { trees: [], rocks: [], ruins: [] };

        const placedPositions = [];
        const minSpacing = 8;

        const tryPlace = (count, collection) => {
            for (let i = 0; i < count; i++) {
                let placed = false;
                for (let attempt = 0; attempt < 30; attempt++) {
                    const x = 15 + rng() * (WORLD_SIZE - 30);
                    const z = 15 + rng() * (WORLD_SIZE - 30);

                    // Check clear radius around spawn
                    const dx = x - SPAWN_CENTER;
                    const dz = z - SPAWN_CENTER;
                    if (Math.sqrt(dx * dx + dz * dz) < CLEAR_RADIUS) continue;

                    // Check min spacing
                    const tooClose = placedPositions.some(p => {
                        const px = p.x - x, pz = p.z - z;
                        return Math.sqrt(px * px + pz * pz) < minSpacing;
                    });
                    if (tooClose) continue;

                    const pos = { x, z, scale: 0.7 + rng() * 0.6, rotation: rng() * Math.PI * 2 };
                    placedPositions.push(pos);
                    collection.push(pos);
                    placed = true;
                    break;
                }
            }
        };

        tryPlace(NUM_TREES, layout.trees);
        tryPlace(NUM_ROCKS, layout.rocks);
        tryPlace(NUM_RUINS, layout.ruins);

        return layout;
    }

    _setupOutdoorLighting() {
        // Remove scene-manager's arena lights — they're positioned at origin (0,0,0)
        // and their shadow maps don't cover the outdoor terrain at (100,100),
        // causing the terrain to be treated as fully shadowed by those lights.
        const toRemove = [];
        this.scene.traverse(obj => {
            if (obj.isLight) toRemove.push(obj);
        });
        for (const light of toRemove) {
            this.scene.remove(light);
            if (light.target) this.scene.remove(light.target);
        }

        // BotW lighting philosophy: extremely strong fill so shadows are NEVER dark.
        // Shadows get their depth from warm-cool COLOR contrast, not brightness contrast.
        // Shadow floor should be ~40-50% brightness (Lab L ≈ 45-55).

        // Directional sun — warm key light, high angle for broad coverage
        const sunLight = new THREE.DirectionalLight(0xfff4e0, 2.7);
        sunLight.position.set(SPAWN_CENTER + 40, 100, SPAWN_CENTER + 40);
        sunLight.target.position.set(SPAWN_CENTER, 0, SPAWN_CENTER);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 10;
        sunLight.shadow.camera.far = 250;
        const shadowSize = WORLD_SIZE * 0.55;
        sunLight.shadow.camera.left = -shadowSize;
        sunLight.shadow.camera.right = shadowSize;
        sunLight.shadow.camera.top = shadowSize;
        sunLight.shadow.camera.bottom = -shadowSize;
        this.scene.add(sunLight);
        this.scene.add(sunLight.target);
        this.sceneLights.push(sunLight);

        // Hemisphere light — bright sky + warm-cool ground bounce
        // Sky color provides blue fill from above; ground color tints shadows warm-green
        const hemiLight = new THREE.HemisphereLight(0xb4d4f0, 0x8a9878, 2.4);
        this.scene.add(hemiLight);
        this.sceneLights.push(hemiLight);

        // Very strong ambient — this sets the shadow floor (BotW's lifted shadows)
        // Warm-tinted so shadows have golden undertone, not cold gray
        const ambient = new THREE.AmbientLight(0xd0c8b8, 2.8);
        this.scene.add(ambient);
        this.sceneLights.push(ambient);

        // Fill directional from opposite side — further lifts shadows
        const fillLight = new THREE.DirectionalLight(0xc8d8f0, 1.0);
        fillLight.position.set(SPAWN_CENTER - 30, 60, SPAWN_CENTER - 30);
        this.scene.add(fillLight);
        this.sceneLights.push(fillLight);
    }

    _setupFog() {
        // Per-zone fog color creates distinct atmosphere per zone
        const fogColors = {
            facility:  0xe8e4d2,  // Warm golden — dusty limestone facility
            scrapyard: 0xddd4c0,  // Dry amber — sun-baked scrapyard
            town:      0xd8dce6,  // Cool grey-blue — overcast coastal town
        };
        const fogColor = fogColors[this.options.zoneTheme] || 0xe8e4d2;
        this.scene.fog = new THREE.Fog(fogColor, 50, 180);
    }

    _createProceduralSky() {
        // Derive sun direction from the directional light position
        const sunLight = this.sceneLights.find(l => l.isDirectionalLight);
        const sunDir = sunLight ? sunLight.position.clone().normalize() : new THREE.Vector3(0.4, 0.7, 0.4).normalize();

        // Shader-based sky dome — renders at full screen resolution
        // BotW-inspired: 3-stop gradient, anti-aliased sun, animated FBM clouds
        // Colors are in linear space; Three.js applies ACES tone mapping + sRGB conversion
        this._skyUniforms = {
            sunDirection:  { value: sunDir },
            zenithColor:   { value: new THREE.Color(0.08, 0.18, 0.55) },    // Brighter cerulean (visible above horizon)
            midColor:      { value: new THREE.Color(0.15, 0.32, 0.58) },    // Soft sky blue (lifted for clear daytime feel)
            horizonColor:  { value: new THREE.Color(0.28, 0.25, 0.18) },    // Warm golden cream
            sunColor:      { value: new THREE.Color(0.6, 0.55, 0.42) },     // Warm white-gold
            cloudColor:    { value: new THREE.Color(0.30, 0.28, 0.24) },    // Warm cloud white
            cloudShadow:   { value: new THREE.Color(0.10, 0.12, 0.16) },    // Blue-grey underside
            sunRadius:     { value: 0.03 },
            cloudCoverage: { value: 0.35 },
            cloudSoftness: { value: 0.15 },
            time:          { value: 0.0 },
        };

        const vertexShader = /* glsl */`
            varying vec3 vWorldDir;
            void main() {
                vWorldDir = normalize(position);
                // Standard sky dome: strip translation so dome is always centered on camera,
                // use unit direction to avoid w≈0 singularity for vertices near camera plane
                vec4 clipPos = projectionMatrix * mat4(mat3(modelViewMatrix)) * vec4(normalize(position), 1.0);
                gl_Position = clipPos.xyww; // z = w → always at far plane
            }
        `;

        const fragmentShader = /* glsl */`
            uniform vec3 sunDirection;
            uniform vec3 zenithColor;
            uniform vec3 midColor;
            uniform vec3 horizonColor;
            uniform vec3 sunColor;
            uniform vec3 cloudColor;
            uniform vec3 cloudShadow;
            uniform float sunRadius;
            uniform float cloudCoverage;
            uniform float cloudSoftness;
            uniform float time;

            varying vec3 vWorldDir;

            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
            }

            float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                float a = hash(i);
                float b = hash(i + vec2(1.0, 0.0));
                float c = hash(i + vec2(0.0, 1.0));
                float d = hash(i + vec2(1.0, 1.0));
                return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
            }

            // 5-octave FBM for detailed, natural cloud shapes
            float fbm(vec2 p) {
                float v = 0.0, a = 0.5;
                for (int i = 0; i < 5; i++) {
                    v += a * noise(p);
                    p *= 2.0;
                    a *= 0.5;
                }
                return v;
            }

            void main() {
                vec3 dir = normalize(vWorldDir);
                float elevation = dir.y;

                // === 3-stop sky gradient (BotW characteristic) ===
                // Power curve spends more time near horizon color
                float h = pow(max(elevation, 0.0), 0.7);
                vec3 sky = mix(
                    horizonColor,
                    mix(midColor, zenithColor, smoothstep(0.3, 0.8, h)),
                    smoothstep(0.0, 0.25, h)
                );

                // Below horizon: solid warm fog color
                if (elevation < 0.0) {
                    sky = horizonColor * 0.95;
                }

                // === Horizon haze band ===
                float haze = exp(-abs(elevation) * 6.0) * 0.08;
                sky += sunColor * haze;

                // === Sun disc (per-pixel anti-aliased — no more pixelation) ===
                float cosTheta = dot(dir, sunDirection);
                float cosR = cos(sunRadius);
                float disc = smoothstep(cosR - 0.002, cosR + 0.001, cosTheta);
                sky = mix(sky, sunColor * 1.5, disc);

                // Sun glow halo (soft exponential falloff)
                float glow = pow(max(cosTheta, 0.0), 8.0) * 0.15;
                sky += sunColor * glow;

                // === Animated clouds (BotW-style flat projection) ===
                if (elevation > 0.01) {
                    vec2 cloudUV = dir.xz / (dir.y + 0.1);

                    // Two layers at different scroll speeds for formation/dissipation
                    float base = fbm(cloudUV * 0.8 + vec2(time * 0.01, time * 0.005));
                    float detail = fbm(cloudUV * 3.0 + vec2(time * 0.03, -time * 0.02));
                    float density = base + detail * 0.3;

                    // Soft threshold for painterly cloud edges
                    float thresh = 1.0 - cloudCoverage;
                    float shape = smoothstep(thresh - cloudSoftness, thresh + cloudSoftness, density);

                    // Sun-facing side brighter, shadow side cooler
                    float sunFacing = max(dot(normalize(vec3(dir.x, 0.0, dir.z)), sunDirection), 0.0);
                    vec3 litCloud = mix(cloudShadow, cloudColor, 0.5 + 0.5 * sunFacing);

                    // Thicker cloud parts slightly darker (depth shading)
                    float depth = smoothstep(thresh, thresh + cloudSoftness + 0.15, density);
                    litCloud = mix(litCloud, cloudShadow * 0.9, depth * 0.3);

                    sky = mix(sky, litCloud, shape * 0.85);
                }

                // Output linear color — Three.js handles tone mapping + sRGB conversion
                gl_FragColor = vec4(sky, 1.0);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }
        `;

        const skyGeo = new THREE.SphereGeometry(10000, 64, 32);
        const skyMat = new THREE.ShaderMaterial({
            uniforms: this._skyUniforms,
            vertexShader,
            fragmentShader,
            side: THREE.BackSide,
            depthWrite: false,
            fog: false,
            // toneMapped: true (default) — Three.js injects ACES + sRGB via #includes
        });

        this._skyMesh = new THREE.Mesh(skyGeo, skyMat);
        this._skyMesh.frustumCulled = false;
        this._skyMesh.renderOrder = -1;
        this._skyMesh.position.set(SPAWN_CENTER, 0, SPAWN_CENTER);
        this.scene.add(this._skyMesh);
    }

    _autoApplyNPR() {
        if (!this.nprPipeline) return;
        this.nprPipeline.applyPreset(BOTW_NPR);

        // High exposure for BotW's bright, airy daylit look
        if (this.nprPipeline.renderer) {
            this.nprPipeline.renderer.toneMappingExposure = 2.5;
        }

        // BotW uses smooth shading — Kuwahara filter handles the cel-shaded look
        // Do NOT call _applyToonMaterials() for asset approach
        if (this.options.approach === 'hybrid') {
            this._applyToonMaterials();
        }

        console.log('BotW NPR preset applied');
    }

    _applyToonMaterials() {
        const gradientMap = this._createToonGradientMap();

        this.group.traverse((obj) => {
            if (!obj.isMesh || !obj.material) return;
            if (obj.material.isMeshToonMaterial) return;  // Already toon

            const mat = obj.material;
            if (!mat.isMeshStandardMaterial) return;

            const toonMat = new THREE.MeshToonMaterial({
                color: mat.color.clone(),
                gradientMap: gradientMap,
                map: mat.map || null,
                side: mat.side,
                transparent: mat.transparent || false,
                opacity: mat.opacity ?? 1,
                depthWrite: mat.depthWrite ?? true,
            });

            // Preserve userData
            toonMat.userData = { ...mat.userData };
            obj.material = toonMat;
        });
    }

    _createToonGradientMap() {
        if (this._toonGradientMap) return this._toonGradientMap;

        // 3-tone step gradient: dark (0.2), mid (0.5), light (0.8)
        const width = 4;
        const data = new Uint8Array(width * 4);
        data[0] = 51;  data[1] = 51;  data[2] = 51;  data[3] = 255;
        data[4] = 51;  data[5] = 51;  data[6] = 51;  data[7] = 255;
        data[8] = 128; data[9] = 128; data[10] = 128; data[11] = 255;
        data[12] = 204; data[13] = 204; data[14] = 204; data[15] = 255;

        const texture = new THREE.DataTexture(data, width, 1, THREE.RGBAFormat);
        texture.minFilter = THREE.NearestFilter;
        texture.magFilter = THREE.NearestFilter;
        texture.needsUpdate = true;

        this._toonGradientMap = texture;
        return texture;
    }

    _generateSpawnPoints() {
        const approach = this.options.approach;
        const blobGroundOffset = (approach === 'particles') ? 0 : 0.25;

        // Facility theme: place 2 tutorial enemies 45u north, rest on outer ring
        if (this.options.zoneTheme === 'facility') {
            // Tutorial enemies flanking the vehicle parts pickup
            const tutorialPositions = [
                { x: SPAWN_CENTER - 10, z: SPAWN_CENTER - 45 },
                { x: SPAWN_CENTER + 10, z: SPAWN_CENTER - 45 },
            ];
            for (const pos of tutorialPositions) {
                const rawY = (approach === 'assets' || approach === 'hybrid')
                    ? this.getHeightAt(pos.x, pos.z) : 0;
                this.enemySpawnPoints.push({
                    position: new THREE.Vector3(pos.x, rawY + blobGroundOffset + 1, pos.z),
                    type: null,
                });
            }
            // Remaining enemies on 70u+ ring (further from spawn)
            const numRing = 18;
            for (let i = 0; i < numRing; i++) {
                const angle = (i / numRing) * Math.PI * 2;
                const radius = WORLD_SIZE * 0.35;
                const x = SPAWN_CENTER + Math.cos(angle) * radius;
                const z = SPAWN_CENTER + Math.sin(angle) * radius;
                const rawY = (approach === 'assets' || approach === 'hybrid')
                    ? this.getHeightAt(x, z) : 0;
                this.enemySpawnPoints.push({
                    position: new THREE.Vector3(x, rawY + blobGroundOffset + 1, z),
                    type: null,
                });
            }
        } else {
            // Standard ring placement for other zones
            const numSpawns = 20;
            for (let i = 0; i < numSpawns; i++) {
                const angle = (i / numSpawns) * Math.PI * 2;
                const radius = WORLD_SIZE * 0.35;
                const x = SPAWN_CENTER + Math.cos(angle) * radius;
                const z = SPAWN_CENTER + Math.sin(angle) * radius;
                const rawY = (approach === 'assets' || approach === 'hybrid')
                    ? this.getHeightAt(x, z) : 0;
                this.enemySpawnPoints.push({
                    position: new THREE.Vector3(x, rawY + blobGroundOffset + 1, z),
                    type: null,
                });
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // APPROACH A: ASSET WORLD
    // ═══════════════════════════════════════════════════════════════════

    _buildAssetWorld() {
        // Skip terrain mesh when external height source (ChunkManager) provides
        // the visible terrain. Zone objects still use getHeightAt() for placement.
        if (!this._heightSource) {
            this._createTerrain();
        }
        this._createAssetTrees();
        this._createAssetRocks();
        this._createAssetRuins();
        this._createInstancedGrass();
        this._createDistantMountains();
    }

    /**
     * Seeded value noise with bilinear interpolation (replaces 8x8 grid)
     */
    _interpolatedNoise(x, z, seed) {
        // Hash function for seeded noise at integer coords
        const hash = (ix, iz) => {
            let h = (ix * 374761393 + iz * 668265263 + seed * 1274126177) | 0;
            h = ((h ^ (h >> 13)) * 1274126177) | 0;
            return ((h ^ (h >> 16)) & 0x7fffffff) / 0x7fffffff;
        };

        const ix = Math.floor(x);
        const iz = Math.floor(z);
        const fx = x - ix;
        const fz = z - iz;

        // Smoothstep for smoother interpolation
        const sx = fx * fx * (3 - 2 * fx);
        const sz = fz * fz * (3 - 2 * fz);

        const v00 = hash(ix, iz);
        const v10 = hash(ix + 1, iz);
        const v01 = hash(ix, iz + 1);
        const v11 = hash(ix + 1, iz + 1);

        const v0 = v00 * (1 - sx) + v10 * sx;
        const v1 = v01 * (1 - sx) + v11 * sx;
        return v0 * (1 - sz) + v1 * sz;
    }

    /**
     * 5-octave fractional Brownian motion for dramatic terrain
     */
    _fbmNoise(x, z, seed) {
        const octaves = 5;
        const persistence = 0.45;
        const lacunarity = 2.2;
        const baseFrequency = 0.015;
        const heightScale = 25;

        let amplitude = 1;
        let frequency = baseFrequency;
        let total = 0;
        let maxAmplitude = 0;

        for (let i = 0; i < octaves; i++) {
            const nx = x * frequency;
            const nz = z * frequency;
            let n = this._interpolatedNoise(nx, nz, seed + i * 31);

            // Ridge noise for higher octaves (above threshold 0.6)
            if (i >= 2 && n > 0.6) {
                n = 1.0 - Math.abs(n * 2 - 1);
            }

            total += n * amplitude;
            maxAmplitude += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }

        return (total / maxAmplitude) * heightScale;
    }

    _createTerrain() {
        const res = this.heightmapRes;
        const size = WORLD_SIZE;

        // Generate fBm heightmap
        this.heightmap = new Float32Array(res * res);
        const seed = this.options.seed + 1000;

        for (let y = 0; y < res; y++) {
            for (let x = 0; x < res; x++) {
                const wx = (x / (res - 1)) * size;
                const wz = (y / (res - 1)) * size;

                // fBm noise for dramatic rolling hills
                let h = this._fbmNoise(wx, wz, seed);

                // Cosine falloff spawn flattening (smoother than linear)
                const distFromSpawn = Math.sqrt(
                    (wx - SPAWN_CENTER) ** 2 + (wz - SPAWN_CENTER) ** 2
                );
                if (distFromSpawn < CLEAR_RADIUS) {
                    const t = distFromSpawn / CLEAR_RADIUS;
                    const flattenFactor = 0.5 * (1 - Math.cos(t * Math.PI));
                    h *= flattenFactor;
                }

                this.heightmap[y * res + x] = h;
            }
        }

        // Create terrain geometry with vertex displacement
        const geo = new THREE.PlaneGeometry(size, size, res - 1, res - 1);
        const posAttr = geo.attributes.position;

        for (let i = 0; i < posAttr.count; i++) {
            posAttr.setZ(i, this.heightmap[i]);
        }

        geo.computeVertexNormals();

        // Per-vertex colors based on height (plays well with Kuwahara smoothing)
        const colors = new Float32Array(posAttr.count * 3);
        const lowColor = new THREE.Color('#7aba6a');   // Bright green (0-8)
        const midColor = new THREE.Color('#c8b67a');   // Warm golden (8-15)
        const highColor = new THREE.Color('#a89786');   // Light gray-brown rock (15-25)

        for (let i = 0; i < posAttr.count; i++) {
            const h = this.heightmap[i];
            let color;
            if (h < 8) {
                const t = Math.max(0, h / 8);
                color = lowColor.clone().lerp(midColor, t);
            } else if (h < 15) {
                const t = (h - 8) / 7;
                color = midColor.clone().lerp(highColor, t);
            } else {
                color = highColor;
            }
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        // Procedural terrain texture (height-banded) + normal map for micro-detail
        const terrainTex = this._createTerrainTexture();
        const terrainNormalMap = this._createTerrainNormalMap();
        const terrainMat = new THREE.MeshStandardMaterial({
            map: terrainTex,
            normalMap: terrainNormalMap,
            normalScale: new THREE.Vector2(0.6, 0.6),
            vertexColors: true,
            roughness: 0.85,
            metalness: 0.0,
        });

        const terrain = new THREE.Mesh(geo, terrainMat);
        terrain.rotation.x = -Math.PI / 2;
        terrain.position.set(SPAWN_CENTER, 0, SPAWN_CENTER);
        terrain.receiveShadow = true;
        terrain.userData = { type: 'terrain' };

        this.group.add(terrain);
    }

    _createTerrainTexture() {
        const size = 1024;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Base: bright green-brown blend (vertex colors provide height banding)
        ctx.fillStyle = '#8aaa7a';
        ctx.fillRect(0, 0, size, size);

        const rng = seededRNG(this.options.seed + 2000);

        // Height-based texture variation: divide canvas into 3 bands
        // Low (top third): dense green grass streaks
        // Mid (middle third): sparse golden streaks with earth patches
        // High (bottom third): rock cracks and lichen dots
        const bandH = size / 3;

        // --- Low band: dense green grass streaks ---
        for (let i = 0; i < 4000; i++) {
            const x = rng() * size;
            const y = rng() * bandH;
            const angle = rng() * Math.PI; // Random orientation
            const len = 3 + rng() * 8;
            const red = 55 + Math.floor(rng() * 35);
            const green = 100 + Math.floor(rng() * 65);
            const blue = 35 + Math.floor(rng() * 25);
            const alpha = 0.1 + rng() * 0.2;
            ctx.strokeStyle = `rgba(${red}, ${green}, ${blue}, ${alpha})`;
            ctx.lineWidth = 1 + rng() * 2;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
            ctx.stroke();
        }

        // --- Mid band: sparse golden streaks + earth patches ---
        for (let i = 0; i < 2500; i++) {
            const x = rng() * size;
            const y = bandH + rng() * bandH;
            const type = rng();
            if (type < 0.6) {
                // Golden grass streaks
                const angle = rng() * Math.PI;
                const len = 2 + rng() * 6;
                const red = 140 + Math.floor(rng() * 50);
                const green = 125 + Math.floor(rng() * 40);
                const blue = 55 + Math.floor(rng() * 30);
                const alpha = 0.1 + rng() * 0.18;
                ctx.strokeStyle = `rgba(${red}, ${green}, ${blue}, ${alpha})`;
                ctx.lineWidth = 1 + rng() * 1.5;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
                ctx.stroke();
            } else {
                // Earth patches (brown dots)
                const r = 2 + rng() * 4;
                const red = 120 + Math.floor(rng() * 35);
                const green = 95 + Math.floor(rng() * 25);
                const blue = 65 + Math.floor(rng() * 20);
                const alpha = 0.08 + rng() * 0.15;
                ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha})`;
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // --- High band: rock cracks + lichen dots ---
        for (let i = 0; i < 2000; i++) {
            const x = rng() * size;
            const y = bandH * 2 + rng() * bandH;
            const type = rng();
            if (type < 0.5) {
                // Rock cracks (dark lines)
                const angle = rng() * Math.PI;
                const len = 3 + rng() * 10;
                const grey = 70 + Math.floor(rng() * 30);
                const alpha = 0.08 + rng() * 0.12;
                ctx.strokeStyle = `rgba(${grey}, ${grey - 10}, ${grey - 15}, ${alpha})`;
                ctx.lineWidth = 0.5 + rng() * 1.5;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
                ctx.stroke();
            } else {
                // Lichen dots (yellow-green)
                const r = 1 + rng() * 2;
                const red = 130 + Math.floor(rng() * 40);
                const green = 140 + Math.floor(rng() * 40);
                const blue = 50 + Math.floor(rng() * 30);
                const alpha = 0.06 + rng() * 0.12;
                ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha})`;
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Scatter some universal detail dots across all bands for continuity
        for (let i = 0; i < 3000; i++) {
            const x = rng() * size;
            const y = rng() * size;
            const r = 1 + rng() * 2;
            const band = rng();
            let red, green, blue;
            if (band < 0.5) {
                red = 60 + Math.floor(rng() * 40);
                green = 100 + Math.floor(rng() * 70);
                blue = 40 + Math.floor(rng() * 30);
            } else if (band < 0.8) {
                red = 130 + Math.floor(rng() * 50);
                green = 120 + Math.floor(rng() * 40);
                blue = 60 + Math.floor(rng() * 30);
            } else {
                red = 110 + Math.floor(rng() * 40);
                green = 100 + Math.floor(rng() * 30);
                blue = 80 + Math.floor(rng() * 30);
            }
            const alpha = 0.05 + rng() * 0.12;
            ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha})`;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(6, 6);  // Reduced from 10x — each tile covers ~33 units
        return tex;
    }

    _createTerrainNormalMap() {
        const nmSize = 256;
        const canvas = document.createElement('canvas');
        canvas.width = nmSize;
        canvas.height = nmSize;
        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(nmSize, nmSize);
        const data = imgData.data;

        const res = this.heightmapRes;
        const eps = 1.0; // Sample spacing in world units

        for (let py = 0; py < nmSize; py++) {
            for (let px = 0; px < nmSize; px++) {
                // Map normal map pixel to world position
                const wx = (px / nmSize) * WORLD_SIZE;
                const wz = (py / nmSize) * WORLD_SIZE;

                // Finite-difference normal from heightmap
                const hL = this.getHeightAt(wx - eps, wz);
                const hR = this.getHeightAt(wx + eps, wz);
                const hD = this.getHeightAt(wx, wz - eps);
                const hU = this.getHeightAt(wx, wz + eps);

                let nx = (hL - hR);
                let ny = 2.0 * eps;
                let nz = (hD - hU);
                const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
                nx /= len;
                ny /= len;
                nz /= len;

                // Encode normal as RGB: (n * 0.5 + 0.5) → [0, 255]
                const idx = (py * nmSize + px) * 4;
                data[idx]     = Math.floor((nx * 0.5 + 0.5) * 255);
                data[idx + 1] = Math.floor((ny * 0.5 + 0.5) * 255);
                data[idx + 2] = Math.floor((nz * 0.5 + 0.5) * 255);
                data[idx + 3] = 255;
            }
        }

        ctx.putImageData(imgData, 0, 0);
        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.type = THREE.UnsignedByteType;
        return tex;
    }

    _createAssetTrees() {
        const trunkMat = new THREE.MeshStandardMaterial({
            color: 0x8B5A2B,
            roughness: 0.9,
        });
        const canopyMat = new THREE.MeshStandardMaterial({
            color: 0x2d7a1e,
            roughness: 0.8,
        });

        for (const tree of this.layout.trees) {
            const height = 4 + tree.scale * 6;  // 4-8 units
            const trunkRadius = 0.3 + tree.scale * 0.2;
            const canopyRadius = 1.5 + tree.scale * 1.5;

            // Trunk
            const trunkGeo = new THREE.CylinderGeometry(
                trunkRadius * 0.7, trunkRadius, height * 0.5, 6
            );
            const trunk = new THREE.Mesh(trunkGeo, trunkMat);
            const baseY = this.getHeightAt(tree.x, tree.z);
            trunk.position.set(tree.x, baseY + height * 0.25, tree.z);
            trunk.castShadow = true;
            trunk.receiveShadow = true;
            trunk.userData = { type: 'tree-trunk' };
            this.group.add(trunk);

            // Canopy - dodecahedron for organic shape
            const canopyGeo = new THREE.DodecahedronGeometry(canopyRadius, 1);
            const canopy = new THREE.Mesh(canopyGeo, canopyMat);
            canopy.position.set(tree.x, baseY + height * 0.7, tree.z);
            canopy.rotation.set(tree.rotation, tree.rotation * 0.5, 0);
            canopy.castShadow = true;
            canopy.receiveShadow = true;
            canopy.userData = { type: 'tree-canopy' };
            this.group.add(canopy);
        }
    }

    _createAssetRocks() {
        const rockMat = new THREE.MeshStandardMaterial({
            color: 0x808080,
            roughness: 0.9,
            metalness: 0.05,
        });

        for (const rock of this.layout.rocks) {
            const radius = 1 + rock.scale * 2;  // 1-3 units
            const geo = new THREE.DodecahedronGeometry(radius, 0);
            const mesh = new THREE.Mesh(geo, rockMat);
            const baseY = this.getHeightAt(rock.x, rock.z);
            mesh.position.set(rock.x, baseY + radius * 0.4, rock.z);
            mesh.rotation.set(rock.rotation * 0.3, rock.rotation, rock.rotation * 0.2);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.userData = { type: 'rock' };
            this.group.add(mesh);
        }
    }

    _createAssetRuins() {
        const stoneMat = new THREE.MeshStandardMaterial({
            color: 0x999988,
            roughness: 0.85,
            metalness: 0.05,
        });

        for (const ruin of this.layout.ruins) {
            const baseY = this.getHeightAt(ruin.x, ruin.z);

            // 4 pillars in a rectangle
            const spacing = 3;
            for (let px = -1; px <= 1; px += 2) {
                for (let pz = -1; pz <= 1; pz += 2) {
                    const pillarHeight = 3 + ruin.scale * 3;
                    const pillarGeo = new THREE.CylinderGeometry(0.4, 0.5, pillarHeight, 6);
                    const pillar = new THREE.Mesh(pillarGeo, stoneMat);
                    pillar.position.set(
                        ruin.x + px * spacing,
                        baseY + pillarHeight / 2,
                        ruin.z + pz * spacing
                    );
                    pillar.castShadow = true;
                    pillar.receiveShadow = true;
                    pillar.userData = { type: 'ruin-pillar' };
                    this.group.add(pillar);
                }
            }

            // 2-3 wall segments
            const wallCount = 2 + (ruin.scale > 0.5 ? 1 : 0);
            for (let w = 0; w < wallCount; w++) {
                const wallWidth = 3 + ruin.scale * 2;
                const wallHeight = 2 + ruin.scale * 2;
                const wallGeo = new THREE.BoxGeometry(wallWidth, wallHeight, 0.5);
                const wall = new THREE.Mesh(wallGeo, stoneMat);
                const angle = ruin.rotation + (w * Math.PI) / wallCount;
                const dist = spacing * 0.8;
                wall.position.set(
                    ruin.x + Math.cos(angle) * dist,
                    baseY + wallHeight / 2,
                    ruin.z + Math.sin(angle) * dist
                );
                wall.rotation.y = angle;
                wall.castShadow = true;
                wall.receiveShadow = true;
                wall.userData = { type: 'ruin-wall' };
                this.group.add(wall);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // ZONE-SPECIFIC OBJECTS
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Authored spawn compound for Zone 0 — limestone "research compound" forming
     * a corridor that opens northward (-Z), guiding the player toward objectives.
     * Replaces the random scatter near spawn with intentional spatial narrative.
     */
    _createSpawnCompound() {
        const approach = this.options.approach;
        const limestoneMat = new THREE.MeshStandardMaterial({ color: 0xD4C5A0, roughness: 0.9, metalness: 0.0 });
        const fenceMat = new THREE.MeshStandardMaterial({
            color: 0x999999, roughness: 0.6, metalness: 0.4, transparent: true, opacity: 0.7, side: THREE.DoubleSide,
        });

        const cx = SPAWN_CENTER;   // 100
        const cz = SPAWN_CENTER;   // 100

        const getY = (x, z) => (approach === 'assets' || approach === 'hybrid') ? this.getHeightAt(x, z) : 0;

        // --- Left wall: 3 tall limestone spires at X = -12 from center ---
        const leftWallX = cx - 12;
        const leftWallZPositions = [cz - 5, cz - 15, cz - 25];
        for (const z of leftWallZPositions) {
            const baseY = getY(leftWallX, z);
            const height = 12 + Math.random() * 4;
            const radius = 2 + Math.random() * 1;
            const spire = new THREE.Mesh(
                new THREE.ConeGeometry(radius, height, 7),
                limestoneMat
            );
            spire.position.set(leftWallX, baseY + height / 2, z);
            spire.castShadow = true;
            spire.receiveShadow = true;
            spire.userData = { type: 'compound-wall' };
            this.group.add(spire);
        }

        // --- Right wall: 3 tall limestone spires at X = +12 from center ---
        const rightWallX = cx + 12;
        const rightWallZPositions = [cz - 5, cz - 15, cz - 25];
        for (const z of rightWallZPositions) {
            const baseY = getY(rightWallX, z);
            const height = 12 + Math.random() * 4;
            const radius = 2 + Math.random() * 1;
            const spire = new THREE.Mesh(
                new THREE.ConeGeometry(radius, height, 7),
                limestoneMat
            );
            spire.position.set(rightWallX, baseY + height / 2, z);
            spire.castShadow = true;
            spire.receiveShadow = true;
            spire.userData = { type: 'compound-wall' };
            this.group.add(spire);
        }

        // --- Back wall (south): 5 medium spires + 2 broken fence segments at Z = +15 ---
        const backZ = cz + 15;
        const backXPositions = [cx - 12, cx - 6, cx, cx + 6, cx + 12];
        for (const x of backXPositions) {
            const baseY = getY(x, backZ);
            const height = 8 + Math.random() * 4;
            const radius = 1.5 + Math.random() * 1;
            const spire = new THREE.Mesh(
                new THREE.ConeGeometry(radius, height, 6),
                limestoneMat
            );
            spire.position.set(x, baseY + height / 2, backZ);
            spire.castShadow = true;
            spire.receiveShadow = true;
            spire.userData = { type: 'compound-wall' };
            this.group.add(spire);
        }

        // Broken fencing on back wall
        for (const xOff of [-9, 9]) {
            const baseY = getY(cx + xOff, backZ);
            const fenceLen = 5;
            const fence = new THREE.Mesh(
                new THREE.PlaneGeometry(fenceLen, 2.5),
                fenceMat
            );
            fence.position.set(cx + xOff, baseY + 1.25, backZ);
            fence.rotation.z = (Math.random() - 0.5) * 0.15;
            fence.castShadow = true;
            fence.userData = { type: 'compound-fence' };
            this.group.add(fence);
        }

        // --- Gap at Z = -30: 8u wide opening (no spires between X -4 and +4) ---
        // Add flanking spires at the exit to frame the gap
        const exitZ = cz - 30;
        for (const xOff of [-6, 6]) {
            const baseY = getY(cx + xOff, exitZ);
            const height = 14 + Math.random() * 2;
            const radius = 2.5;
            const spire = new THREE.Mesh(
                new THREE.ConeGeometry(radius, height, 7),
                limestoneMat
            );
            spire.position.set(cx + xOff, baseY + height / 2, exitZ);
            spire.castShadow = true;
            spire.receiveShadow = true;
            spire.userData = { type: 'compound-gate' };
            this.group.add(spire);
        }

        console.log('[OutdoorLevel] Spawn compound placed (facility corridor)');
    }

    /**
     * Chillagoe Research Site (Zone 0) — limestone spires, smelter chimneys, cave entrances, containment tanks
     */
    _createFacilityObjects() {
        const rng = seededRNG(this.options.seed + 4000);
        const approach = this.options.approach;

        // Materials
        const limestoneMat = new THREE.MeshStandardMaterial({ color: 0xD4C5A0, roughness: 0.9, metalness: 0.0 });
        const concreteMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.85, metalness: 0.1 });
        const metalMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.6, metalness: 0.5 });
        const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.7, metalness: 0.4 });
        const redDirtMat = new THREE.MeshStandardMaterial({ color: 0xB5451B, roughness: 0.95, metalness: 0.0 });
        const fenceMat = new THREE.MeshStandardMaterial({
            color: 0x999999, roughness: 0.6, metalness: 0.4, transparent: true, opacity: 0.7, side: THREE.DoubleSide,
        });

        const placedPositions = [];
        const minSpacing = 10;
        // Extended clear radius for facility — compound extends ~35u from spawn
        const facilityClearRadius = 35;

        const tryPlace = (rng) => {
            for (let attempt = 0; attempt < 30; attempt++) {
                const x = 20 + rng() * (WORLD_SIZE - 40);
                const z = 20 + rng() * (WORLD_SIZE - 40);
                const dx = x - SPAWN_CENTER;
                const dz = z - SPAWN_CENTER;
                if (Math.sqrt(dx * dx + dz * dz) < facilityClearRadius) continue;
                let tooClose = false;
                for (const p of placedPositions) {
                    if (Math.abs(x - p.x) < minSpacing && Math.abs(z - p.z) < minSpacing) { tooClose = true; break; }
                }
                if (!tooClose) {
                    placedPositions.push({ x, z });
                    return { x, z };
                }
            }
            return null;
        };

        // Limestone spires (tall jagged cylinders)
        for (let i = 0; i < 12; i++) {
            const pos = tryPlace(rng);
            if (!pos) continue;
            const baseY = (approach === 'assets' || approach === 'hybrid') ? this.getHeightAt(pos.x, pos.z) : 0;
            const height = 6 + rng() * 10;
            const radius = 1.5 + rng() * 2;
            const spire = new THREE.Mesh(
                new THREE.ConeGeometry(radius, height, 6 + Math.floor(rng() * 3)),
                limestoneMat
            );
            spire.position.set(pos.x, baseY + height / 2, pos.z);
            spire.rotation.y = rng() * Math.PI;
            spire.castShadow = true;
            spire.receiveShadow = true;
            spire.userData = { type: 'facility-limestone' };
            this.group.add(spire);
        }

        // Smelter chimneys (tall narrow cylinders with dark tops)
        for (let i = 0; i < 4; i++) {
            const pos = tryPlace(rng);
            if (!pos) continue;
            const baseY = (approach === 'assets' || approach === 'hybrid') ? this.getHeightAt(pos.x, pos.z) : 0;
            const chimney = new THREE.Group();
            const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 12, 8), concreteMat);
            shaft.position.y = 6;
            shaft.castShadow = true;
            chimney.add(shaft);
            const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.8, 1.5, 8), darkMetalMat);
            cap.position.y = 12.5;
            chimney.add(cap);
            chimney.position.set(pos.x, baseY, pos.z);
            chimney.userData = { type: 'facility-chimney' };
            this.group.add(chimney);
        }

        // Containment tanks (squat cylinders with pipes)
        for (let i = 0; i < 5; i++) {
            const pos = tryPlace(rng);
            if (!pos) continue;
            const baseY = (approach === 'assets' || approach === 'hybrid') ? this.getHeightAt(pos.x, pos.z) : 0;
            const tank = new THREE.Group();
            const body = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 3, 12), metalMat);
            body.position.y = 1.5;
            body.castShadow = true;
            tank.add(body);
            // Pipe
            const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 4, 6), darkMetalMat);
            pipe.rotation.z = Math.PI / 2;
            pipe.position.set(2.5, 2, 0);
            tank.add(pipe);
            tank.position.set(pos.x, baseY, pos.z);
            tank.rotation.y = rng() * Math.PI * 2;
            tank.userData = { type: 'facility-tank' };
            this.group.add(tank);
        }

        // Cave mouth entrances (dark arches)
        for (let i = 0; i < 3; i++) {
            const pos = tryPlace(rng);
            if (!pos) continue;
            const baseY = (approach === 'assets' || approach === 'hybrid') ? this.getHeightAt(pos.x, pos.z) : 0;
            const cave = new THREE.Group();
            // Arch frame from limestone
            const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(1, 4, 1.5), limestoneMat);
            leftPillar.position.set(-2, 2, 0);
            leftPillar.castShadow = true;
            cave.add(leftPillar);
            const rightPillar = new THREE.Mesh(new THREE.BoxGeometry(1, 4, 1.5), limestoneMat);
            rightPillar.position.set(2, 2, 0);
            rightPillar.castShadow = true;
            cave.add(rightPillar);
            const archTop = new THREE.Mesh(new THREE.BoxGeometry(5, 1, 1.5), limestoneMat);
            archTop.position.set(0, 4.5, 0);
            cave.add(archTop);
            // Dark interior
            const interior = new THREE.Mesh(
                new THREE.BoxGeometry(3, 3.5, 0.5),
                new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1, metalness: 0 })
            );
            interior.position.set(0, 2, 0.5);
            cave.add(interior);
            cave.position.set(pos.x, baseY, pos.z);
            cave.rotation.y = rng() * Math.PI * 2;
            cave.userData = { type: 'facility-cave' };
            this.group.add(cave);
        }

        // Broken chain-link fencing
        for (let i = 0; i < 6; i++) {
            const pos = tryPlace(rng);
            if (!pos) continue;
            const baseY = (approach === 'assets' || approach === 'hybrid') ? this.getHeightAt(pos.x, pos.z) : 0;
            const fenceLen = 4 + rng() * 6;
            const fence = new THREE.Mesh(
                new THREE.PlaneGeometry(fenceLen, 2.5),
                fenceMat
            );
            fence.position.set(pos.x, baseY + 1.25, pos.z);
            fence.rotation.y = rng() * Math.PI;
            fence.rotation.z = (rng() - 0.5) * 0.15; // Slight lean
            fence.castShadow = true;
            fence.userData = { type: 'facility-fence' };
            this.group.add(fence);
        }

        // Mine shaft headframes (simple A-frames)
        for (let i = 0; i < 2; i++) {
            const pos = tryPlace(rng);
            if (!pos) continue;
            const baseY = (approach === 'assets' || approach === 'hybrid') ? this.getHeightAt(pos.x, pos.z) : 0;
            const frame = new THREE.Group();
            // Two angled legs
            const legGeo = new THREE.BoxGeometry(0.3, 8, 0.3);
            const leftLeg = new THREE.Mesh(legGeo, darkMetalMat);
            leftLeg.position.set(-1.5, 4, 0);
            leftLeg.rotation.z = 0.15;
            leftLeg.castShadow = true;
            frame.add(leftLeg);
            const rightLeg = new THREE.Mesh(legGeo, darkMetalMat);
            rightLeg.position.set(1.5, 4, 0);
            rightLeg.rotation.z = -0.15;
            rightLeg.castShadow = true;
            frame.add(rightLeg);
            // Crossbeam
            const crossbeam = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.3, 0.3), darkMetalMat);
            crossbeam.position.y = 7.5;
            frame.add(crossbeam);
            // Wheel
            const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.08, 8, 16), metalMat);
            wheel.position.set(0, 8, 0);
            frame.add(wheel);
            frame.position.set(pos.x, baseY, pos.z);
            frame.rotation.y = rng() * Math.PI;
            frame.userData = { type: 'facility-mineshaft' };
            this.group.add(frame);
        }

        console.log(`[OutdoorLevel] Facility objects placed: ${placedPositions.length} items`);
    }

    /**
     * Herberton Scrapyard (Zone 1) — corrugated iron sheds, rusted mining equipment, old rail lines
     */
    _createScrapyardObjects() {
        const rng = seededRNG(this.options.seed + 5000);
        const approach = this.options.approach;

        // Shared materials
        const rustMat = new THREE.MeshStandardMaterial({
            color: 0x8B4513, roughness: 0.95, metalness: 0.2,
        });
        const darkRustMat = new THREE.MeshStandardMaterial({
            color: 0x5C3317, roughness: 0.9, metalness: 0.3,
        });
        const tireMat = new THREE.MeshStandardMaterial({
            color: 0x222222, roughness: 0.8, metalness: 0.0,
        });
        const oilDrumMat = new THREE.MeshStandardMaterial({
            color: 0x4A6741, roughness: 0.7, metalness: 0.4,
        });
        const scrapMetalMat = new THREE.MeshStandardMaterial({
            color: 0x7A7A7A, roughness: 0.85, metalness: 0.5,
        });

        const placedPositions = [];
        const minSpacing = 6;
        const scrapClearRadius = 15; // Closer to spawn than base objects for visible zone identity

        const tryPlace = () => {
            for (let attempt = 0; attempt < 30; attempt++) {
                const x = 20 + rng() * (WORLD_SIZE - 40);
                const z = 20 + rng() * (WORLD_SIZE - 40);
                const dx = x - SPAWN_CENTER;
                const dz = z - SPAWN_CENTER;
                if (Math.sqrt(dx * dx + dz * dz) < scrapClearRadius) continue;
                const tooClose = placedPositions.some(p => {
                    const px = p.x - x, pz = p.z - z;
                    return Math.sqrt(px * px + pz * pz) < minSpacing;
                });
                if (tooClose) continue;
                placedPositions.push({ x, z });
                const baseY = (approach === 'assets' || approach === 'hybrid')
                    ? this.getHeightAt(x, z) : 0;
                return { x, z, baseY };
            }
            return null;
        };

        // Rusted car hulks (6-8)
        const numCars = 6 + Math.floor(rng() * 3);
        for (let i = 0; i < numCars; i++) {
            const pos = tryPlace();
            if (!pos) continue;
            const rotation = rng() * Math.PI * 2;
            const tilt = (rng() - 0.5) * 0.15; // Slight tilt for wrecked look

            const car = new THREE.Group();
            // Body
            const body = new THREE.Mesh(
                new THREE.BoxGeometry(3.5, 1.2, 1.8),
                rustMat
            );
            body.position.y = 0.8;
            body.castShadow = true;
            body.receiveShadow = true;
            car.add(body);
            // Roof
            const roof = new THREE.Mesh(
                new THREE.BoxGeometry(1.8, 0.8, 1.6),
                darkRustMat
            );
            roof.position.set(-0.2, 1.6, 0);
            roof.castShadow = true;
            car.add(roof);
            // Wheels (flat/missing)
            for (const wx of [-1.2, 1.2]) {
                for (const wz of [-0.9, 0.9]) {
                    if (rng() > 0.3) { // 70% chance wheel exists
                        const wheel = new THREE.Mesh(
                            new THREE.CylinderGeometry(0.35, 0.35, 0.2, 8),
                            tireMat
                        );
                        wheel.position.set(wx, 0.2, wz);
                        wheel.rotation.x = Math.PI / 2;
                        car.add(wheel);
                    }
                }
            }
            car.position.set(pos.x, pos.baseY, pos.z);
            car.rotation.y = rotation;
            car.rotation.z = tilt;
            car.userData = { type: 'scrapyard-car' };
            this.group.add(car);
        }

        // Tire stacks (8-12)
        const numTireStacks = 8 + Math.floor(rng() * 5);
        for (let i = 0; i < numTireStacks; i++) {
            const pos = tryPlace();
            if (!pos) continue;
            const stackHeight = 2 + Math.floor(rng() * 4);
            const stack = new THREE.Group();
            for (let t = 0; t < stackHeight; t++) {
                const tire = new THREE.Mesh(
                    new THREE.TorusGeometry(0.4, 0.15, 8, 12),
                    tireMat
                );
                tire.position.y = t * 0.32 + 0.15;
                tire.rotation.x = Math.PI / 2;
                // Slight random offset for messy look
                tire.position.x += (rng() - 0.5) * 0.1;
                tire.position.z += (rng() - 0.5) * 0.1;
                tire.castShadow = true;
                stack.add(tire);
            }
            stack.position.set(pos.x, pos.baseY, pos.z);
            stack.userData = { type: 'scrapyard-tires' };
            this.group.add(stack);
        }

        // Oil drums (6-10)
        const numDrums = 6 + Math.floor(rng() * 5);
        for (let i = 0; i < numDrums; i++) {
            const pos = tryPlace();
            if (!pos) continue;
            const cluster = new THREE.Group();
            const drumCount = 1 + Math.floor(rng() * 3);
            for (let d = 0; d < drumCount; d++) {
                const standing = rng() > 0.3;
                const drum = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.3, 0.3, 0.9, 8),
                    rng() > 0.5 ? oilDrumMat : rustMat
                );
                if (standing) {
                    drum.position.set(d * 0.7, 0.45, (rng() - 0.5) * 0.5);
                } else {
                    drum.position.set(d * 0.8, 0.3, (rng() - 0.5) * 0.5);
                    drum.rotation.z = Math.PI / 2;
                    drum.rotation.y = rng() * Math.PI;
                }
                drum.castShadow = true;
                drum.receiveShadow = true;
                cluster.add(drum);
            }
            cluster.position.set(pos.x, pos.baseY, pos.z);
            cluster.rotation.y = rng() * Math.PI * 2;
            cluster.userData = { type: 'scrapyard-drums' };
            this.group.add(cluster);
        }

        // Scrap metal piles (5-8)
        const numPiles = 5 + Math.floor(rng() * 4);
        for (let i = 0; i < numPiles; i++) {
            const pos = tryPlace();
            if (!pos) continue;
            const pile = new THREE.Group();
            const pieceCount = 3 + Math.floor(rng() * 5);
            for (let p = 0; p < pieceCount; p++) {
                const type = Math.floor(rng() * 3);
                let piece;
                if (type === 0) {
                    // Flat sheet
                    piece = new THREE.Mesh(
                        new THREE.BoxGeometry(0.8 + rng() * 1.2, 0.05, 0.6 + rng() * 0.8),
                        scrapMetalMat
                    );
                } else if (type === 1) {
                    // Pipe
                    piece = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.05, 0.05, 1.0 + rng() * 1.5, 6),
                        scrapMetalMat
                    );
                    piece.rotation.z = (rng() - 0.5) * 1.0;
                } else {
                    // Crumpled box
                    piece = new THREE.Mesh(
                        new THREE.BoxGeometry(0.4 + rng() * 0.4, 0.3 + rng() * 0.3, 0.4 + rng() * 0.4),
                        rng() > 0.5 ? rustMat : scrapMetalMat
                    );
                }
                piece.position.set(
                    (rng() - 0.5) * 2,
                    rng() * 0.5,
                    (rng() - 0.5) * 2
                );
                piece.rotation.set(rng() * 0.5, rng() * Math.PI, rng() * 0.5);
                piece.castShadow = true;
                pile.add(piece);
            }
            pile.position.set(pos.x, pos.baseY, pos.z);
            pile.userData = { type: 'scrapyard-pile' };
            this.group.add(pile);
        }

        // Chain-link fence sections (4-6)
        const fenceMat = new THREE.MeshStandardMaterial({
            color: 0x888888, roughness: 0.6, metalness: 0.5,
            transparent: true, opacity: 0.7, side: THREE.DoubleSide,
        });
        const numFences = 4 + Math.floor(rng() * 3);
        for (let i = 0; i < numFences; i++) {
            const pos = tryPlace();
            if (!pos) continue;
            const fenceLength = 5 + rng() * 8;
            const fence = new THREE.Group();
            // Mesh panel
            const panel = new THREE.Mesh(
                new THREE.PlaneGeometry(fenceLength, 2.5),
                fenceMat
            );
            panel.position.y = 1.25;
            panel.castShadow = true;
            fence.add(panel);
            // Posts
            const postCount = Math.ceil(fenceLength / 2.5);
            const postMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.6, roughness: 0.5 });
            for (let p = 0; p <= postCount; p++) {
                const post = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.04, 0.04, 2.8, 6),
                    postMat
                );
                post.position.set(-fenceLength / 2 + p * (fenceLength / postCount), 1.4, 0);
                post.castShadow = true;
                fence.add(post);
            }
            fence.position.set(pos.x, pos.baseY, pos.z);
            fence.rotation.y = rng() * Math.PI;
            fence.userData = { type: 'scrapyard-fence' };
            this.group.add(fence);
        }

        console.log(`[OutdoorLevel] Scrapyard objects placed: ${numCars} cars, ${numTireStacks} tire stacks, ${numDrums} drum clusters, ${numPiles} scrap piles, ${numFences} fences`);
    }

    /**
     * Create scrap pickup points that dispatch vehicle-part-found on collection.
     * Zone 1 (scrapyard) → tier 1 parts. Zone 2 (town) → tier 2 parts.
     */
    _createScrapPickups() {
        const rng = seededRNG(this.options.seed + 9000);
        const approach = this.options.approach;
        const numPiles = 2 + Math.floor(rng() * 2); // 2-3 piles

        // Part pools by zone theme
        const partPools = {
            scrapyard: ['sedanFrame', 'bikeWheels', 'v4Engine', 'mountedTurret'],
            town: ['truckCab', 'monsterTires', 'turbine', 'missileRack'],
        };
        const pool = partPools[this.options.zoneTheme] || partPools.scrapyard;

        const glowMat = new THREE.MeshStandardMaterial({
            color: 0x88ff88,
            emissive: 0x88ff88,
            emissiveIntensity: 0.4,
            transparent: true,
            opacity: 0.8,
        });
        const crateRustMat = new THREE.MeshStandardMaterial({
            color: 0x7A5A3A, roughness: 0.95, metalness: 0.3,
        });

        for (let i = 0; i < numPiles; i++) {
            // Place away from spawn center
            let x, z;
            for (let attempt = 0; attempt < 30; attempt++) {
                x = 25 + rng() * (WORLD_SIZE - 50);
                z = 25 + rng() * (WORLD_SIZE - 50);
                const dx = x - SPAWN_CENTER;
                const dz = z - SPAWN_CENTER;
                if (Math.sqrt(dx * dx + dz * dz) >= CLEAR_RADIUS + 10) break;
            }
            const baseY = (approach === 'assets' || approach === 'hybrid')
                ? this.getHeightAt(x, z) : 0;

            const pile = new THREE.Group();
            pile.position.set(x, baseY, z);

            // 2-3 rusty crates
            const crateCount = 2 + Math.floor(rng() * 2);
            for (let c = 0; c < crateCount; c++) {
                const crate = new THREE.Mesh(
                    new THREE.BoxGeometry(0.5 + rng() * 0.4, 0.4 + rng() * 0.3, 0.5 + rng() * 0.4),
                    crateRustMat
                );
                crate.position.set(
                    (rng() - 0.5) * 1.2,
                    rng() * 0.3,
                    (rng() - 0.5) * 1.2
                );
                crate.rotation.y = rng() * Math.PI;
                crate.castShadow = true;
                pile.add(crate);
            }

            // Subtle glow orb above pile
            const glow = new THREE.Mesh(
                new THREE.SphereGeometry(0.25, 8, 8),
                glowMat
            );
            glow.position.y = 1.2;
            pile.add(glow);

            // Point light
            const light = new THREE.PointLight(0x88ff88, 0.5, 6, 2);
            light.position.y = 1.2;
            pile.add(light);

            pile.userData = {
                type: 'scrap-pickup',
                collected: false,
                partId: pool[i % pool.length],
            };
            this.group.add(pile);
        }
    }

    /**
     * Lore pickups — glowing documents scattered around zones for environmental storytelling
     */
    _createLorePickups() {
        const theme = this.options.zoneTheme;
        const lorePool = ZONE_LORE[theme];
        if (!lorePool || lorePool.length === 0) return;

        const rng = seededRNG(this.options.seed + 11000);
        const approach = this.options.approach;
        const count = 2 + Math.floor(rng() * 2); // 2-3 pickups

        const docMat = new THREE.MeshStandardMaterial({
            color: 0xFFF8DC,
            emissive: 0xFFDD66,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide,
        });

        // Shuffle lore pool deterministically
        const shuffled = [...lorePool];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        for (let i = 0; i < count && i < shuffled.length; i++) {
            let x, z;
            // Facility theme: place first lore pickup near vehicle parts (onboarding trail)
            if (theme === 'facility' && i === 0) {
                x = SPAWN_CENTER + 5;
                z = SPAWN_CENTER - 50;
            } else {
                for (let attempt = 0; attempt < 30; attempt++) {
                    x = 25 + rng() * (WORLD_SIZE - 50);
                    z = 25 + rng() * (WORLD_SIZE - 50);
                    const dx = x - SPAWN_CENTER;
                    const dz = z - SPAWN_CENTER;
                    if (Math.sqrt(dx * dx + dz * dz) >= CLEAR_RADIUS + 5) break;
                }
            }
            const baseY = (approach === 'assets' || approach === 'hybrid')
                ? this.getHeightAt(x, z) : 0;

            // Small glowing document
            const doc = new THREE.Mesh(
                new THREE.BoxGeometry(0.3, 0.02, 0.4),
                docMat.clone()
            );
            doc.position.set(x, baseY + 0.8, z);
            doc.rotation.y = rng() * Math.PI * 2;

            // Subtle point light
            const light = new THREE.PointLight(0xFFDD66, 0.4, 4, 2);
            light.position.set(0, 0.3, 0);
            doc.add(light);

            doc.userData = {
                type: 'lore-pickup',
                collected: false,
                loreTitle: shuffled[i].title,
                loreText: shuffled[i].text,
                baseY: baseY + 0.8,
                bobPhase: rng() * Math.PI * 2,
            };
            this.group.add(doc);
            this.lorePickups.push(doc);
        }

        console.log(`[OutdoorLevel] ${count} lore pickups placed for theme '${theme}'`);
    }

    /**
     * Rural Town (Zone 2) — buildings, barricades, gas station elements
     */
    _createTownObjects() {
        const rng = seededRNG(this.options.seed + 7000);
        const approach = this.options.approach;

        // Materials
        const woodMat = new THREE.MeshStandardMaterial({ color: 0x8B6914, roughness: 0.9, metalness: 0.0 });
        const stuccoMat = new THREE.MeshStandardMaterial({ color: 0xD2C4A0, roughness: 0.85, metalness: 0.0 });
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x6B3A2A, roughness: 0.8, metalness: 0.1 });
        const concreteMat = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.9, metalness: 0.1 });
        const metalMat = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.6, metalness: 0.5 });
        const glassMat = new THREE.MeshStandardMaterial({
            color: 0x88BBDD, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.4,
        });
        const redMat = new THREE.MeshStandardMaterial({ color: 0xCC3333, roughness: 0.7, metalness: 0.2 });
        const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.95, metalness: 0.0 });

        const placedPositions = [];
        const minSpacing = 8;
        const townClearRadius = 15; // Closer to spawn for visible zone identity

        const tryPlace = (spacing) => {
            const sp = spacing || minSpacing;
            for (let attempt = 0; attempt < 30; attempt++) {
                const x = 25 + rng() * (WORLD_SIZE - 50);
                const z = 25 + rng() * (WORLD_SIZE - 50);
                const dx = x - SPAWN_CENTER;
                const dz = z - SPAWN_CENTER;
                if (Math.sqrt(dx * dx + dz * dz) < townClearRadius) continue;
                const tooClose = placedPositions.some(p => {
                    const px = p.x - x, pz = p.z - z;
                    return Math.sqrt(px * px + pz * pz) < sp;
                });
                if (tooClose) continue;
                placedPositions.push({ x, z });
                const baseY = (approach === 'assets' || approach === 'hybrid')
                    ? this.getHeightAt(x, z) : 0;
                return { x, z, baseY };
            }
            return null;
        };

        // Small buildings / houses (5-7)
        const numBuildings = 5 + Math.floor(rng() * 3);
        for (let i = 0; i < numBuildings; i++) {
            const pos = tryPlace(12);
            if (!pos) continue;
            const bldg = new THREE.Group();
            const w = 4 + rng() * 3;
            const h = 3 + rng() * 2;
            const d = 4 + rng() * 3;

            // Walls
            const walls = new THREE.Mesh(
                new THREE.BoxGeometry(w, h, d),
                rng() > 0.4 ? stuccoMat : woodMat
            );
            walls.position.y = h / 2;
            walls.castShadow = true;
            walls.receiveShadow = true;
            bldg.add(walls);

            // Roof (pitched)
            const roofW = w + 0.6;
            const roofD = d + 0.6;
            const roofH = 1.5 + rng() * 1.0;
            const roofGeo = new THREE.ConeGeometry(Math.max(roofW, roofD) * 0.6, roofH, 4);
            const roof = new THREE.Mesh(roofGeo, roofMat);
            roof.position.y = h + roofH / 2;
            roof.rotation.y = Math.PI / 4;
            roof.castShadow = true;
            bldg.add(roof);

            // Window (front face)
            const win = new THREE.Mesh(
                new THREE.PlaneGeometry(1.0, 0.8),
                glassMat
            );
            win.position.set(0, h * 0.6, d / 2 + 0.02);
            bldg.add(win);

            // Door (front face)
            const door = new THREE.Mesh(
                new THREE.PlaneGeometry(0.9, 1.8),
                woodMat
            );
            door.position.set(w * 0.25, 0.9, d / 2 + 0.02);
            bldg.add(door);

            bldg.position.set(pos.x, pos.baseY, pos.z);
            bldg.rotation.y = Math.floor(rng() * 4) * (Math.PI / 2);
            bldg.userData = { type: 'town-building' };
            this.group.add(bldg);
        }

        // Police barricades (4-6)
        const numBarricades = 4 + Math.floor(rng() * 3);
        for (let i = 0; i < numBarricades; i++) {
            const pos = tryPlace(6);
            if (!pos) continue;
            const barricade = new THREE.Group();
            const bLen = 3 + rng() * 2;

            // Jersey barrier
            const barrier = new THREE.Mesh(
                new THREE.BoxGeometry(bLen, 0.9, 0.5),
                concreteMat
            );
            barrier.position.y = 0.45;
            barrier.castShadow = true;
            barrier.receiveShadow = true;
            barricade.add(barrier);

            // Warning stripe
            const stripe = new THREE.Mesh(
                new THREE.BoxGeometry(bLen, 0.1, 0.52),
                redMat
            );
            stripe.position.y = 0.7;
            barricade.add(stripe);

            barricade.position.set(pos.x, pos.baseY, pos.z);
            barricade.rotation.y = rng() * Math.PI;
            barricade.userData = { type: 'town-barricade' };
            this.group.add(barricade);
        }

        // Gas station (1)
        const gasPos = tryPlace(15);
        if (gasPos) {
            const station = new THREE.Group();

            // Canopy
            const canopyTop = new THREE.Mesh(
                new THREE.BoxGeometry(8, 0.3, 5),
                metalMat
            );
            canopyTop.position.y = 3.5;
            canopyTop.castShadow = true;
            station.add(canopyTop);

            // Canopy pillars
            for (const cx of [-3.5, 3.5]) {
                for (const cz of [-2, 2]) {
                    const pillar = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.12, 0.12, 3.5, 6),
                        metalMat
                    );
                    pillar.position.set(cx, 1.75, cz);
                    pillar.castShadow = true;
                    station.add(pillar);
                }
            }

            // Fuel pumps (2)
            for (const px of [-1.5, 1.5]) {
                const pump = new THREE.Mesh(
                    new THREE.BoxGeometry(0.6, 1.5, 0.4),
                    redMat
                );
                pump.position.set(px, 0.75, 0);
                pump.castShadow = true;
                station.add(pump);
            }

            // Station building (small)
            const booth = new THREE.Mesh(
                new THREE.BoxGeometry(4, 2.5, 3),
                stuccoMat
            );
            booth.position.set(0, 1.25, -5);
            booth.castShadow = true;
            booth.receiveShadow = true;
            station.add(booth);

            station.position.set(gasPos.x, gasPos.baseY, gasPos.z);
            station.rotation.y = rng() * Math.PI * 2;
            station.userData = { type: 'town-gas-station' };
            this.group.add(station);
        }

        // Pickup trucks / civilian vehicles (3-5)
        const numVehicles = 3 + Math.floor(rng() * 3);
        for (let i = 0; i < numVehicles; i++) {
            const pos = tryPlace(6);
            if (!pos) continue;
            const vehicle = new THREE.Group();
            const vColor = [0x8B0000, 0x2F4F4F, 0xDAA520, 0x4682B4][Math.floor(rng() * 4)];
            const vMat = new THREE.MeshStandardMaterial({ color: vColor, roughness: 0.6, metalness: 0.3 });

            // Body
            const body = new THREE.Mesh(
                new THREE.BoxGeometry(3.8, 1.3, 1.8),
                vMat
            );
            body.position.y = 0.85;
            body.castShadow = true;
            vehicle.add(body);

            // Cab
            const cab = new THREE.Mesh(
                new THREE.BoxGeometry(1.6, 0.9, 1.6),
                vMat
            );
            cab.position.set(-0.5, 1.8, 0);
            cab.castShadow = true;
            vehicle.add(cab);

            // Wheels
            const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
            for (const wx of [-1.3, 1.3]) {
                for (const wz of [-0.85, 0.85]) {
                    const wheel = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.35, 0.35, 0.2, 8),
                        wheelMat
                    );
                    wheel.position.set(wx, 0.25, wz);
                    wheel.rotation.x = Math.PI / 2;
                    vehicle.add(wheel);
                }
            }

            vehicle.position.set(pos.x, pos.baseY, pos.z);
            vehicle.rotation.y = rng() * Math.PI * 2;
            vehicle.userData = { type: 'town-vehicle' };
            this.group.add(vehicle);
        }

        // Street lights (5-8)
        const numLights = 5 + Math.floor(rng() * 4);
        for (let i = 0; i < numLights; i++) {
            const pos = tryPlace(5);
            if (!pos) continue;
            const pole = new THREE.Group();

            // Post
            const post = new THREE.Mesh(
                new THREE.CylinderGeometry(0.06, 0.08, 5, 6),
                metalMat
            );
            post.position.y = 2.5;
            post.castShadow = true;
            pole.add(post);

            // Arm
            const arm = new THREE.Mesh(
                new THREE.BoxGeometry(1.2, 0.06, 0.06),
                metalMat
            );
            arm.position.set(0.6, 5, 0);
            pole.add(arm);

            // Light housing
            const housing = new THREE.Mesh(
                new THREE.BoxGeometry(0.4, 0.15, 0.3),
                metalMat
            );
            housing.position.set(1.1, 4.9, 0);
            pole.add(housing);

            pole.position.set(pos.x, pos.baseY, pos.z);
            pole.userData = { type: 'town-streetlight' };
            this.group.add(pole);
        }

        // Road patches (2-3 asphalt strips)
        const numRoads = 2 + Math.floor(rng() * 2);
        for (let i = 0; i < numRoads; i++) {
            const pos = tryPlace(10);
            if (!pos) continue;
            const roadLen = 15 + rng() * 20;
            const road = new THREE.Mesh(
                new THREE.PlaneGeometry(roadLen, 5),
                asphaltMat
            );
            road.rotation.x = -Math.PI / 2;
            road.position.set(pos.x, pos.baseY + 0.02, pos.z);
            road.rotation.z = rng() * Math.PI;
            road.receiveShadow = true;
            road.userData = { type: 'town-road' };
            this.group.add(road);
        }

        console.log(`[OutdoorLevel] Town objects placed: ${numBuildings} buildings, ${numBarricades} barricades, ${numVehicles} vehicles, ${numLights} streetlights, ${numRoads} roads`);
    }

    _createInstancedGrass() {
        const count = 30000;

        // Triangle blade geometry (3 vertices — half the vertex count of a quad)
        // Normals are placeholder — overridden per-instance via terrain normal in the matrix
        const bladeGeo = new THREE.BufferGeometry();
        const vertices = new Float32Array([
            -0.08, 0,   0,   // Bottom-left
             0.08, 0,   0,   // Bottom-right
             0,    0.5, 0,   // Top (tip)
        ]);
        const normals = new Float32Array([
            0, 1, 0,
            0, 1, 0,
            0, 1, 0,
        ]);
        bladeGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        bladeGeo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));

        // Lambert material — cheapest lit material, per-vertex lighting
        // Grass blades inherit terrain normals so they shade as a unified field
        const grassMat = new THREE.MeshLambertMaterial({
            side: THREE.DoubleSide,
        });

        this.grassInstanced = new THREE.InstancedMesh(bladeGeo, grassMat, count);
        this.grassInstanced.instanceColor = new THREE.InstancedBufferAttribute(
            new Float32Array(count * 3), 3
        );
        this.grassInstanced.receiveShadow = true;
        this.grassInstanced.userData = { type: 'grass' };

        const dummy = new THREE.Object3D();
        const rng = seededRNG(this.options.seed + 3000);

        // Cache base positions for per-blade wind animation
        this._grassData = [];

        // Bright base colors — BotW grass is vivid in sunlight, warm golden on hills
        const greenValley = new THREE.Color('#7aba6a');
        const goldenHill = new THREE.Color('#d0b870');
        const tmpColor = new THREE.Color();

        // Temp quaternion for encoding terrain normal into instance rotation
        const terrainQuat = new THREE.Quaternion();
        const upVec = new THREE.Vector3(0, 1, 0);
        const normalVec = new THREE.Vector3();

        for (let i = 0; i < count; i++) {
            const x = rng() * WORLD_SIZE;
            const z = rng() * WORLD_SIZE;
            const y = this.getHeightAt(x, z);

            // No grass above height 20 (rocky peaks)
            if (y > 20) {
                // Place offscreen — cheaper than conditional draw
                dummy.position.set(0, -100, 0);
                dummy.scale.set(0, 0, 0);
                dummy.updateMatrix();
                this.grassInstanced.setMatrixAt(i, dummy.matrix);
                this._grassData.push({ x: 0, y: -100, z: 0, wx: 0, phase: 0, baseRotY: 0, scaleX: 0, scaleY: 0 });
                this.grassInstanced.setColorAt(i, greenValley);
                continue;
            }

            const baseRotY = rng() * Math.PI * 2;
            const scaleX = 0.8 + rng() * 0.4;
            const scaleY = 0.7 + rng() * 0.6;
            const phase = rng() * Math.PI * 2;

            // BotW trick: copy terrain normal onto grass blade
            // Blades on sun-facing slopes are bright, shadow-facing slopes are dark
            const tn = this._getTerrainNormal(x, z);
            normalVec.set(tn.x, tn.y, tn.z);
            terrainQuat.setFromUnitVectors(upVec, normalVec);

            // Combine terrain tilt with blade's Y rotation
            const yRotQuat = new THREE.Quaternion().setFromAxisAngle(upVec, baseRotY);
            terrainQuat.multiply(yRotQuat);

            dummy.position.set(x, y, z);
            dummy.quaternion.copy(terrainQuat);
            dummy.scale.set(scaleX, scaleY, 1);
            dummy.updateMatrix();
            this.grassInstanced.setMatrixAt(i, dummy.matrix);

            // Per-instance color: green in valleys → golden on hillsides
            const heightBlend = Math.min(1, Math.max(0, (y - 3) / 12));
            tmpColor.copy(greenValley).lerp(goldenHill, heightBlend);
            // Per-blade HSL variation
            const hsl = {};
            tmpColor.getHSL(hsl);
            hsl.h += (rng() - 0.5) * 0.05;
            hsl.s *= 0.8 + rng() * 0.4;
            hsl.l *= 0.85 + rng() * 0.3;
            tmpColor.setHSL(hsl.h, Math.min(1, hsl.s), Math.min(1, hsl.l));
            this.grassInstanced.setColorAt(i, tmpColor);

            this._grassData.push({ x, y, z, wx: x, phase, baseRotY, scaleX, scaleY, nx: tn.x, ny: tn.y, nz: tn.z });
        }

        this.grassInstanced.instanceMatrix.needsUpdate = true;
        this.grassInstanced.instanceColor.needsUpdate = true;
        this.group.add(this.grassInstanced);
    }

    _createDistantMountains() {
        const rng = seededRNG(this.options.seed + 9000);

        // Derive mountain colors from fog for cohesive atmosphere
        const fogColor = new THREE.Color(0xe8e4d2);
        const ring1Color = fogColor.clone().lerp(new THREE.Color(0x667788), 0.6);
        const ring2Color = fogColor.clone().lerp(new THREE.Color(0x778899), 0.35);
        const ring3Color = fogColor.clone().lerp(new THREE.Color(0x8899aa), 0.15);

        // 3 rings at increasing distances — solid materials (no transparency/depth sorting issues)
        const rings = [
            { distance: 120, count: 12, color: ring1Color },
            { distance: 160, count: 10, color: ring2Color },
            { distance: 200, count: 8,  color: ring3Color },
        ];

        for (const ring of rings) {
            const mat = new THREE.MeshStandardMaterial({
                color: ring.color,
                roughness: 0.9,
                metalness: 0,
                fog: true,
            });

            for (let i = 0; i < ring.count; i++) {
                const angle = (i / ring.count) * Math.PI * 2 + rng() * 0.4;
                const dist = ring.distance + (rng() - 0.5) * 20;

                const height = 25 + rng() * 35;  // 25-60 units
                const baseRadius = 15 + rng() * 25;  // 15-40

                // LatheGeometry with jagged mountain profile (6-8 points)
                const numPoints = 6 + Math.floor(rng() * 3);
                const profilePoints = [];
                // Peak at top
                profilePoints.push(new THREE.Vector2(0, height));
                // Descend with random offsets for ridges and saddles
                for (let p = 1; p < numPoints - 1; p++) {
                    const t = p / (numPoints - 1);
                    const r = baseRadius * t;
                    const h = height * (1 - t);
                    // Random jag: +/- 30% on radius, +/- 20% on height
                    const rJag = r * (0.7 + rng() * 0.6);
                    const hJag = h * (0.8 + rng() * 0.4);
                    profilePoints.push(new THREE.Vector2(rJag, hJag));
                }
                // Base
                profilePoints.push(new THREE.Vector2(baseRadius, 0));

                const geo = new THREE.LatheGeometry(profilePoints, 8);
                geo.computeVertexNormals();

                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.set(
                    SPAWN_CENTER + Math.cos(angle) * dist,
                    height * 0.3,  // Partially embedded in ground
                    SPAWN_CENTER + Math.sin(angle) * dist
                );
                mesh.rotation.y = rng() * Math.PI * 2;
                mesh.castShadow = false;
                mesh.userData = { type: 'distant-mountain' };
                this.group.add(mesh);
            }
        }
    }

    /**
     * Get terrain height at world position (bilinear interpolation)
     */
    getHeightAt(wx, wz) {
        if (this._heightSource) {
            return this._heightSource.getHeightAt(wx, wz);
        }
        if (!this.heightmap) return 0;

        // World coords to heightmap coords
        const res = this.heightmapRes;
        const hx = ((wx / WORLD_SIZE) + 0.5) * (res - 1);  // centered
        const hz = ((wz / WORLD_SIZE) + 0.5) * (res - 1);

        // After rotation, terrain is centered at SPAWN_CENTER
        const nx = ((wx - SPAWN_CENTER) / WORLD_SIZE + 0.5) * (res - 1);
        const nz = ((wz - SPAWN_CENTER) / WORLD_SIZE + 0.5) * (res - 1);

        const ix = Math.floor(nx);
        const iz = Math.floor(nz);
        const fx = nx - ix;
        const fz = nz - iz;

        // Clamp indices to valid range instead of returning 0 at edges
        const cix = Math.max(0, Math.min(ix, res - 2));
        const ciz = Math.max(0, Math.min(iz, res - 2));
        // Clamp fractions when indices were clamped to avoid extrapolation
        const cfx = (cix !== ix) ? 0 : fx;
        const cfz = (ciz !== iz) ? 0 : fz;

        const v00 = this.heightmap[ciz * res + cix];
        const v10 = this.heightmap[ciz * res + cix + 1];
        const v01 = this.heightmap[(ciz + 1) * res + cix];
        const v11 = this.heightmap[(ciz + 1) * res + cix + 1];

        const v0 = v00 * (1 - cfx) + v10 * cfx;
        const v1 = v01 * (1 - cfx) + v11 * cfx;
        return v0 * (1 - cfz) + v1 * cfz;
    }

    /**
     * Get terrain surface normal at world position (finite-difference)
     */
    _getTerrainNormal(wx, wz) {
        const eps = 0.5; // Sample spacing
        const hL = this.getHeightAt(wx - eps, wz);
        const hR = this.getHeightAt(wx + eps, wz);
        const hD = this.getHeightAt(wx, wz - eps);
        const hU = this.getHeightAt(wx, wz + eps);

        // Cross product of tangent vectors gives normal
        // tangentX = (2*eps, hR - hL, 0), tangentZ = (0, hU - hD, 2*eps)
        const nx = (hL - hR);
        const ny = 2 * eps;
        const nz = (hD - hU);
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        return { x: nx / len, y: ny / len, z: nz / len };
    }

    // ═══════════════════════════════════════════════════════════════════
    // APPROACH B: PARTICLE WORLD
    // ═══════════════════════════════════════════════════════════════════

    _buildParticleWorld() {
        this._createGroundParticles();
        this._createVegetationParticles();
        this._createStructureParticles();
        this._createAtmosphericParticles();
    }

    _createGroundParticles() {
        // Grass (25000) + Water pond (3000)
        const grassCount = 25000;
        const waterCount = 3000;
        const total = grassCount + waterCount;

        const positions = new Float32Array(total * 3);
        const colors = new Float32Array(total * 3);
        const sizes = new Float32Array(total);

        const rng = seededRNG(this.options.seed + 4000);
        const grassBase = new THREE.Color(0x66CC33);

        // Grass particles
        for (let i = 0; i < grassCount; i++) {
            const i3 = i * 3;
            positions[i3] = rng() * WORLD_SIZE;
            positions[i3 + 1] = rng() * 0.3;  // Slightly above ground
            positions[i3 + 2] = rng() * WORLD_SIZE;

            // Vary green
            const variation = 0.8 + rng() * 0.4;
            colors[i3] = grassBase.r * variation * (0.7 + rng() * 0.3);
            colors[i3 + 1] = grassBase.g * variation;
            colors[i3 + 2] = grassBase.b * variation * (0.5 + rng() * 0.5);

            sizes[i] = 0.08 + rng() * 0.04;
        }

        // Water pond - circular area offset from center
        const pondX = SPAWN_CENTER + 30;
        const pondZ = SPAWN_CENTER - 25;
        const pondRadius = 12;
        const waterBase = new THREE.Color(0x2288CC);

        for (let i = 0; i < waterCount; i++) {
            const idx = grassCount + i;
            const i3 = idx * 3;
            const angle = rng() * Math.PI * 2;
            const dist = rng() * pondRadius;
            positions[i3] = pondX + Math.cos(angle) * dist;
            positions[i3 + 1] = 0.05;
            positions[i3 + 2] = pondZ + Math.sin(angle) * dist;

            const variation = 0.8 + rng() * 0.4;
            colors[i3] = waterBase.r * variation;
            colors[i3 + 1] = waterBase.g * variation;
            colors[i3 + 2] = waterBase.b * variation;

            sizes[i] = 0.10;
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const mat = new THREE.PointsMaterial({
            size: 0.1,
            vertexColors: true,
            sizeAttenuation: true,
        });

        const points = new THREE.Points(geo, mat);
        points.userData = {
            type: 'ground-particles',
            grassCount,
            waterCount,
            pondX, pondZ,
        };
        this.group.add(points);
        this.particleGroups.push(points);
    }

    _createVegetationParticles() {
        // Trees: ~300 particles each = ~4500
        const rng = seededRNG(this.options.seed + 5000);
        const totalParticles = this.layout.trees.length * 300;

        const positions = new Float32Array(totalParticles * 3);
        const colors = new Float32Array(totalParticles * 3);

        const trunkColor = new THREE.Color(0x664422);
        const canopyColor = new THREE.Color(0x226611);

        let idx = 0;
        for (const tree of this.layout.trees) {
            const height = 4 + tree.scale * 6;
            const canopyRadius = 1.5 + tree.scale * 1.5;
            const trunkCount = 60;
            const canopyCount = 240;

            // Trunk particles (cylindrical distribution)
            for (let i = 0; i < trunkCount; i++) {
                const i3 = idx * 3;
                const angle = rng() * Math.PI * 2;
                const r = rng() * 0.4;
                const y = rng() * height * 0.5;
                positions[i3] = tree.x + Math.cos(angle) * r;
                positions[i3 + 1] = y;
                positions[i3 + 2] = tree.z + Math.sin(angle) * r;

                const v = 0.7 + rng() * 0.6;
                colors[i3] = trunkColor.r * v;
                colors[i3 + 1] = trunkColor.g * v;
                colors[i3 + 2] = trunkColor.b * v;
                idx++;
            }

            // Canopy particles (spherical distribution)
            for (let i = 0; i < canopyCount; i++) {
                const i3 = idx * 3;
                const theta = rng() * Math.PI * 2;
                const phi = rng() * Math.PI;
                const r = rng() * canopyRadius;
                positions[i3] = tree.x + Math.sin(phi) * Math.cos(theta) * r;
                positions[i3 + 1] = height * 0.7 + Math.cos(phi) * r * 0.6;
                positions[i3 + 2] = tree.z + Math.sin(phi) * Math.sin(theta) * r;

                const v = 0.6 + rng() * 0.8;
                colors[i3] = canopyColor.r * v;
                colors[i3 + 1] = canopyColor.g * v;
                colors[i3 + 2] = canopyColor.b * v;
                idx++;
            }
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions.slice(0, idx * 3), 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors.slice(0, idx * 3), 3));

        const mat = new THREE.PointsMaterial({
            size: 0.15,
            vertexColors: true,
            sizeAttenuation: true,
        });

        const points = new THREE.Points(geo, mat);
        points.userData = { type: 'vegetation-particles', treeCount: this.layout.trees.length };
        this.group.add(points);
        this.particleGroups.push(points);
    }

    _createStructureParticles() {
        // Rocks (~200 each = ~2000) + Ruins (~400 each = ~1200)
        const rng = seededRNG(this.options.seed + 6000);
        const rockParticlesPer = 200;
        const ruinParticlesPer = 400;
        const total = this.layout.rocks.length * rockParticlesPer +
                      this.layout.ruins.length * ruinParticlesPer;

        const positions = new Float32Array(total * 3);
        const colors = new Float32Array(total * 3);

        const rockColor = new THREE.Color(0x888888);
        const stoneColor = new THREE.Color(0x999988);

        let idx = 0;

        // Rock particles (roughly spherical)
        for (const rock of this.layout.rocks) {
            const radius = 1 + rock.scale * 2;
            for (let i = 0; i < rockParticlesPer; i++) {
                const i3 = idx * 3;
                const theta = rng() * Math.PI * 2;
                const phi = rng() * Math.PI;
                const r = rng() * radius;
                positions[i3] = rock.x + Math.sin(phi) * Math.cos(theta) * r;
                positions[i3 + 1] = radius * 0.4 + Math.cos(phi) * r * 0.5;
                positions[i3 + 2] = rock.z + Math.sin(phi) * Math.sin(theta) * r;

                const v = 0.7 + rng() * 0.6;
                colors[i3] = rockColor.r * v;
                colors[i3 + 1] = rockColor.g * v;
                colors[i3 + 2] = rockColor.b * v;
                idx++;
            }
        }

        // Ruin particles (columns + walls)
        for (const ruin of this.layout.ruins) {
            const spacing = 3;

            // Pillars (4 columns)
            for (let px = -1; px <= 1; px += 2) {
                for (let pz = -1; pz <= 1; pz += 2) {
                    const pillarHeight = 3 + ruin.scale * 3;
                    for (let i = 0; i < 40; i++) {
                        const i3 = idx * 3;
                        const angle = rng() * Math.PI * 2;
                        const r = rng() * 0.5;
                        positions[i3] = ruin.x + px * spacing + Math.cos(angle) * r;
                        positions[i3 + 1] = rng() * pillarHeight;
                        positions[i3 + 2] = ruin.z + pz * spacing + Math.sin(angle) * r;

                        const v = 0.7 + rng() * 0.6;
                        colors[i3] = stoneColor.r * v;
                        colors[i3 + 1] = stoneColor.g * v;
                        colors[i3 + 2] = stoneColor.b * v;
                        idx++;
                    }
                }
            }

            // Wall segments (scattered particles between pillars)
            const wallParticles = ruinParticlesPer - 160;  // Remaining after pillars
            for (let i = 0; i < wallParticles; i++) {
                const i3 = idx * 3;
                const wallAngle = ruin.rotation + rng() * Math.PI;
                const dist = rng() * spacing;
                const wallHeight = 2 + ruin.scale * 2;
                positions[i3] = ruin.x + Math.cos(wallAngle) * dist;
                positions[i3 + 1] = rng() * wallHeight;
                positions[i3 + 2] = ruin.z + Math.sin(wallAngle) * dist;

                const v = 0.6 + rng() * 0.6;
                colors[i3] = stoneColor.r * v;
                colors[i3 + 1] = stoneColor.g * v;
                colors[i3 + 2] = stoneColor.b * v;
                idx++;
            }
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions.slice(0, idx * 3), 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors.slice(0, idx * 3), 3));

        const mat = new THREE.PointsMaterial({
            size: 0.2,
            vertexColors: true,
            sizeAttenuation: true,
        });

        const points = new THREE.Points(geo, mat);
        points.userData = { type: 'structure-particles' };
        this.group.add(points);
        this.particleGroups.push(points);
    }

    _createAtmosphericParticles() {
        // Mountains (edges, 5000) + mist
        const rng = seededRNG(this.options.seed + 7000);
        const mountainCount = 5000;
        const total = mountainCount;

        const positions = new Float32Array(total * 3);
        const colors = new Float32Array(total * 3);

        const mountainColor = new THREE.Color(0x667788);
        const snowColor = new THREE.Color(0xccccdd);

        // Mountain particles along edges
        for (let i = 0; i < mountainCount; i++) {
            const i3 = i * 3;

            // Pick a random edge side (0-3: N, E, S, W)
            const side = Math.floor(rng() * 4);
            let x, z;
            const edgeOffset = -10 + rng() * 20;  // Variation along edge

            switch (side) {
                case 0: x = rng() * WORLD_SIZE; z = -10 - rng() * 30; break;  // North
                case 1: x = WORLD_SIZE + 10 + rng() * 30; z = rng() * WORLD_SIZE; break;  // East
                case 2: x = rng() * WORLD_SIZE; z = WORLD_SIZE + 10 + rng() * 30; break;  // South
                case 3: x = -10 - rng() * 30; z = rng() * WORLD_SIZE; break;  // West
            }

            const height = rng() * 40 + 5;
            positions[i3] = x;
            positions[i3 + 1] = height;
            positions[i3 + 2] = z;

            // Snow on top, gray below
            const isSnowy = height > 25;
            const baseColor = isSnowy ? snowColor : mountainColor;
            const v = 0.6 + rng() * 0.4;
            colors[i3] = baseColor.r * v;
            colors[i3 + 1] = baseColor.g * v;
            colors[i3 + 2] = baseColor.b * v;
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const mat = new THREE.PointsMaterial({
            size: 0.8,
            vertexColors: true,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });

        const points = new THREE.Points(geo, mat);
        points.userData = { type: 'atmospheric-particles' };
        this.group.add(points);
        this.particleGroups.push(points);
    }

    // ═══════════════════════════════════════════════════════════════════
    // APPROACH C: HYBRID WORLD (transparent shells + interior particles)
    // ═══════════════════════════════════════════════════════════════════

    _buildHybridWorld() {
        // Accumulated particle data for single merged Points object
        this._hybridParticleData = [];  // { x, y, z, r, g, b }
        this._hybridSegments = [];      // { type, start, end }

        // 1. Reuse terrain but make it semi-transparent
        this._createTerrain();
        this.group.traverse(obj => {
            if (obj.isMesh && obj.userData.type === 'terrain' && obj.material) {
                obj.material.transparent = true;
                obj.material.opacity = 0.6;
                obj.material.depthWrite = false;
            }
        });

        // 2. Ground particles following heightmap
        this._createHybridGroundParticles();

        // 3. Hybrid objects (shells + interior particles)
        this._createHybridTrees();
        this._createHybridRocks();
        this._createHybridRuins();

        // 4. Atmospheric mountain particles (reuse existing)
        this._createAtmosphericParticles();

        // 5. Merge all accumulated particle data into one Points object
        this._finalizeHybridParticles();
    }

    // ─── Shell Material & Geometry Helpers ────────────────────────────

    _createShellMaterial(color, opacity = 0.2) {
        return new THREE.MeshStandardMaterial({
            color,
            transparent: true,
            opacity,
            side: THREE.DoubleSide,
            depthWrite: false,
            roughness: 0.7,
            metalness: 0.0,
        });
    }

    _deformGeometry(geometry, seed, intensity) {
        const rng = seededRNG(seed);
        const posAttr = geometry.attributes.position;
        const normalAttr = geometry.attributes.normal;

        // Compute normals if not present
        if (!normalAttr) {
            geometry.computeVertexNormals();
        }
        const normals = geometry.attributes.normal;

        for (let i = 0; i < posAttr.count; i++) {
            const displacement = (rng() - 0.5) * 2 * intensity;
            posAttr.setX(i, posAttr.getX(i) + normals.getX(i) * displacement);
            posAttr.setY(i, posAttr.getY(i) + normals.getY(i) * displacement);
            posAttr.setZ(i, posAttr.getZ(i) + normals.getZ(i) * displacement);
        }

        posAttr.needsUpdate = true;
        geometry.computeVertexNormals();
    }

    // ─── Particle Volume Fill Helpers ─────────────────────────────────

    _fillSphereVolume(cx, cy, cz, radius, scaleVec, count, color, variation, rng) {
        const start = this._hybridParticleData.length;
        for (let i = 0; i < count; i++) {
            // Rejection sampling for uniform sphere fill
            let x, y, z;
            do {
                x = (rng() - 0.5) * 2;
                y = (rng() - 0.5) * 2;
                z = (rng() - 0.5) * 2;
            } while (x * x + y * y + z * z > 1);

            const v = 1 - variation + rng() * variation * 2;
            this._hybridParticleData.push({
                x: cx + x * radius * (scaleVec?.x ?? 1),
                y: cy + y * radius * (scaleVec?.y ?? 1),
                z: cz + z * radius * (scaleVec?.z ?? 1),
                r: color.r * v,
                g: color.g * v,
                b: color.b * v,
            });
        }
        return { start, end: this._hybridParticleData.length };
    }

    _fillCylinderVolume(cx, cy, cz, radius, height, count, color, variation, rng) {
        const start = this._hybridParticleData.length;
        for (let i = 0; i < count; i++) {
            // sqrt(random) for uniform disk distribution
            const angle = rng() * Math.PI * 2;
            const r = radius * Math.sqrt(rng());
            const yOff = (rng() - 0.5) * height;

            const v = 1 - variation + rng() * variation * 2;
            this._hybridParticleData.push({
                x: cx + Math.cos(angle) * r,
                y: cy + yOff,
                z: cz + Math.sin(angle) * r,
                r: color.r * v,
                g: color.g * v,
                b: color.b * v,
            });
        }
        return { start, end: this._hybridParticleData.length };
    }

    _fillBoxVolume(cx, cy, cz, w, h, d, rotY, count, color, variation, rng) {
        const start = this._hybridParticleData.length;
        const cosR = Math.cos(rotY);
        const sinR = Math.sin(rotY);

        for (let i = 0; i < count; i++) {
            let lx = (rng() - 0.5) * w;
            const ly = (rng() - 0.5) * h;
            let lz = (rng() - 0.5) * d;

            // Apply Y-axis rotation
            const rx = lx * cosR - lz * sinR;
            const rz = lx * sinR + lz * cosR;

            const v = 1 - variation + rng() * variation * 2;
            this._hybridParticleData.push({
                x: cx + rx,
                y: cy + ly,
                z: cz + rz,
                r: color.r * v,
                g: color.g * v,
                b: color.b * v,
            });
        }
        return { start, end: this._hybridParticleData.length };
    }

    _finalizeHybridParticles() {
        const data = this._hybridParticleData;
        const count = data.length;
        if (count === 0) return;

        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);

        for (let i = 0; i < count; i++) {
            const p = data[i];
            const i3 = i * 3;
            positions[i3] = p.x;
            positions[i3 + 1] = p.y;
            positions[i3 + 2] = p.z;
            colors[i3] = p.r;
            colors[i3 + 1] = p.g;
            colors[i3 + 2] = p.b;
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const mat = new THREE.PointsMaterial({
            size: 0.12,
            vertexColors: true,
            sizeAttenuation: true,
        });

        this._hybridPoints = new THREE.Points(geo, mat);
        this._hybridPoints.userData = { type: 'hybrid-particles', segments: this._hybridSegments };
        this.group.add(this._hybridPoints);

        console.log(`Hybrid particles finalized: ${count} total`);
    }

    // ─── Hybrid Object Builders ───────────────────────────────────────

    _createHybridGroundParticles() {
        const count = 15000;
        const rng = seededRNG(this.options.seed + 8000);
        const grassColor = new THREE.Color(0x66CC33);
        const start = this._hybridParticleData.length;

        for (let i = 0; i < count; i++) {
            const x = rng() * WORLD_SIZE;
            const z = rng() * WORLD_SIZE;
            const y = this.getHeightAt(x, z) + rng() * 0.2;

            const v = 0.7 + rng() * 0.6;
            this._hybridParticleData.push({
                x, y, z,
                r: grassColor.r * v * (0.7 + rng() * 0.3),
                g: grassColor.g * v,
                b: grassColor.b * v * (0.5 + rng() * 0.5),
            });
        }

        this._hybridSegments.push({ type: 'ground', start, end: this._hybridParticleData.length });
    }

    _createHybridTrees() {
        const rng = seededRNG(this.options.seed + 8100);
        const canopyColor = new THREE.Color(0x2d7a1e);
        const trunkColor = new THREE.Color(0x664422);

        for (const tree of this.layout.trees) {
            const height = 4 + tree.scale * 6;
            const trunkRadius = 0.3 + tree.scale * 0.2;
            const canopyRadius = 1.5 + tree.scale * 1.5;
            const baseY = this.getHeightAt(tree.x, tree.z);

            // ─ Trunk shell ─
            const trunkGeo = new THREE.CylinderGeometry(
                trunkRadius * 0.7, trunkRadius, height * 0.5, 12, 8
            );
            this._deformGeometry(trunkGeo, this.options.seed + tree.x * 100, 0.06);
            const trunkMesh = new THREE.Mesh(trunkGeo, this._createShellMaterial(0x8B5A2B, 0.2));
            trunkMesh.position.set(tree.x, baseY + height * 0.25, tree.z);
            trunkMesh.castShadow = true;
            trunkMesh.userData = { type: 'hybrid-shell-trunk' };
            this.group.add(trunkMesh);

            // Trunk interior particles
            const trunkSeg = this._fillCylinderVolume(
                tree.x, baseY + height * 0.25, tree.z,
                trunkRadius * 0.8, height * 0.5,
                80, trunkColor, 0.3, rng
            );
            this._hybridSegments.push({ type: 'trunk', ...trunkSeg });

            // ─ Canopy shell ─
            const canopyGeo = new THREE.SphereGeometry(canopyRadius, 16, 12);
            canopyGeo.scale(1, 0.7, 1);
            this._deformGeometry(canopyGeo, this.options.seed + tree.z * 100, 0.2);
            const canopyMesh = new THREE.Mesh(canopyGeo, this._createShellMaterial(0x2d7a1e, 0.15));
            canopyMesh.position.set(tree.x, baseY + height * 0.7, tree.z);
            canopyMesh.castShadow = true;
            canopyMesh.userData = { type: 'hybrid-shell-canopy' };
            this.group.add(canopyMesh);

            // Canopy interior particles
            const canopySeg = this._fillSphereVolume(
                tree.x, baseY + height * 0.7, tree.z,
                canopyRadius * 0.85, { x: 1, y: 0.7, z: 1 },
                300, canopyColor, 0.4, rng
            );
            this._hybridSegments.push({ type: 'canopy', ...canopySeg });
        }
    }

    _createHybridRocks() {
        const rng = seededRNG(this.options.seed + 8200);
        const rockColor = new THREE.Color(0x888888);

        for (const rock of this.layout.rocks) {
            const radius = 1 + rock.scale * 2;
            const baseY = this.getHeightAt(rock.x, rock.z);

            // Rock shell — deformed sphere
            const rockGeo = new THREE.SphereGeometry(radius, 12, 10);
            rockGeo.scale(1, 0.75, 1);
            this._deformGeometry(rockGeo, this.options.seed + rock.x * 77, 0.3);
            const rockMesh = new THREE.Mesh(rockGeo, this._createShellMaterial(0x808080, 0.2));
            rockMesh.position.set(rock.x, baseY + radius * 0.35, rock.z);
            rockMesh.rotation.set(rock.rotation * 0.3, rock.rotation, rock.rotation * 0.2);
            rockMesh.castShadow = true;
            rockMesh.userData = { type: 'hybrid-shell-rock' };
            this.group.add(rockMesh);

            // Rock interior particles
            const seg = this._fillSphereVolume(
                rock.x, baseY + radius * 0.35, rock.z,
                radius * 0.8, { x: 1, y: 0.75, z: 1 },
                180, rockColor, 0.3, rng
            );
            this._hybridSegments.push({ type: 'rock', ...seg });
        }
    }

    _createHybridRuins() {
        const rng = seededRNG(this.options.seed + 8300);
        const stoneColor = new THREE.Color(0x999988);

        for (const ruin of this.layout.ruins) {
            const baseY = this.getHeightAt(ruin.x, ruin.z);
            const spacing = 3;

            // ─ 4 Pillars (capsule shells) ─
            for (let px = -1; px <= 1; px += 2) {
                for (let pz = -1; pz <= 1; pz += 2) {
                    const pillarHeight = 3 + ruin.scale * 3;
                    const pillarRadius = 0.4;

                    const pillarGeo = new THREE.CapsuleGeometry(pillarRadius, pillarHeight, 6, 8);
                    this._deformGeometry(pillarGeo, this.options.seed + px * 31 + pz * 47, 0.08);
                    const pillarMesh = new THREE.Mesh(pillarGeo, this._createShellMaterial(0x999988, 0.2));
                    pillarMesh.position.set(
                        ruin.x + px * spacing,
                        baseY + pillarHeight / 2 + pillarRadius,
                        ruin.z + pz * spacing
                    );
                    pillarMesh.castShadow = true;
                    pillarMesh.userData = { type: 'hybrid-shell-pillar' };
                    this.group.add(pillarMesh);

                    // Pillar interior particles
                    const seg = this._fillCylinderVolume(
                        ruin.x + px * spacing,
                        baseY + pillarHeight / 2 + pillarRadius,
                        ruin.z + pz * spacing,
                        pillarRadius * 0.7, pillarHeight,
                        100, stoneColor, 0.25, rng
                    );
                    this._hybridSegments.push({ type: 'pillar', ...seg });
                }
            }

            // ─ Wall segments (deformed box shells) ─
            const wallCount = 2 + (ruin.scale > 0.5 ? 1 : 0);
            for (let w = 0; w < wallCount; w++) {
                const wallWidth = 3 + ruin.scale * 2;
                const wallHeight = 2 + ruin.scale * 2;
                const wallDepth = 0.5;
                const angle = ruin.rotation + (w * Math.PI) / wallCount;
                const dist = spacing * 0.8;
                const wx = ruin.x + Math.cos(angle) * dist;
                const wz = ruin.z + Math.sin(angle) * dist;

                const wallGeo = new THREE.BoxGeometry(wallWidth, wallHeight, wallDepth, 8, 6, 2);
                this._deformGeometry(wallGeo, this.options.seed + w * 53 + ruin.x, 0.1);
                const wallMesh = new THREE.Mesh(wallGeo, this._createShellMaterial(0x999988, 0.2));
                wallMesh.position.set(wx, baseY + wallHeight / 2, wz);
                wallMesh.rotation.y = angle;
                wallMesh.castShadow = true;
                wallMesh.userData = { type: 'hybrid-shell-wall' };
                this.group.add(wallMesh);

                // Wall interior particles
                const seg = this._fillBoxVolume(
                    wx, baseY + wallHeight / 2, wz,
                    wallWidth * 0.9, wallHeight * 0.9, wallDepth * 0.8,
                    angle,
                    120, stoneColor, 0.25, rng
                );
                this._hybridSegments.push({ type: 'wall', ...seg });
            }
        }
    }

    // ─── Hybrid Animation ─────────────────────────────────────────────

    _updateHybridWorld(delta, elapsed) {
        if (!this._hybridPoints) return;

        const posArray = this._hybridPoints.geometry.attributes.position.array;
        let needsUpdate = false;

        for (const seg of this._hybridSegments) {
            if (seg.type === 'canopy') {
                // Gentle XZ sway for canopy particles
                for (let i = seg.start; i < seg.end; i++) {
                    const i3 = i * 3;
                    posArray[i3] += Math.sin(elapsed * 1.2 + i * 0.04) * 0.003;
                    posArray[i3 + 2] += Math.cos(elapsed * 0.9 + i * 0.06) * 0.003;
                }
                needsUpdate = true;
            } else if (seg.type === 'ground') {
                // Subtle Y oscillation (stride every 4th for perf)
                for (let i = seg.start; i < seg.end; i += 4) {
                    const i3 = i * 3;
                    posArray[i3 + 1] += Math.sin(elapsed * 1.5 + i * 0.02) * 0.001;
                }
                needsUpdate = true;
            }
            // Rock, pillar, wall, trunk particles: static (no per-frame update)
        }

        if (needsUpdate) {
            this._hybridPoints.geometry.attributes.position.needsUpdate = true;
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // PUBLIC API (matches ArenaLevel interface)
    // ═══════════════════════════════════════════════════════════════════

    getPlatformSystem() {
        const self = this;
        const dummyObject = { userData: {} };
        const upNormal = new THREE.Vector3(0, 1, 0);
        // Raise effective surface so the blob sits visibly above terrain
        const blobGroundOffset = (self.options.approach === 'particles') ? 0 : 0.25;

        // Return platform-system-compatible object for all approaches
        return {
            isOutdoorTerrain: true,
            getSurfaceBelow(position, maxDistance = 10) {
                const rawGroundY = (self.options.approach === 'assets' || self.options.approach === 'hybrid')
                    ? self.getHeightAt(position.x, position.z)
                    : 0;
                const groundY = rawGroundY + blobGroundOffset;

                const dist = position.y - groundY;
                if (dist < 0 || dist > maxDistance) return null;

                return {
                    point: new THREE.Vector3(position.x, groundY, position.z),
                    distance: dist,
                    normal: upNormal.clone(),
                    object: dummyObject,
                    isPlatform: false,
                    isRamp: false,
                    slopeAngle: 0,
                };
            },
            isOnPlatform(position, tolerance = 0.5) {
                const surface = this.getSurfaceBelow(position, tolerance + 0.1);
                return surface !== null && surface.distance <= tolerance;
            },
        };
    }

    /**
     * Check player proximity to lore pickups and dispatch events on collection
     * @param {THREE.Vector3} playerPosition - Current player world position
     */
    checkLorePickups(playerPosition) {
        for (const doc of this.lorePickups) {
            if (doc.userData.collected) continue;

            const dist = playerPosition.distanceTo(doc.position);
            if (dist < 2.0) {
                doc.userData.collected = true;

                // Dispatch discovery event
                window.dispatchEvent(new CustomEvent('lore-discovered', {
                    detail: {
                        title: doc.userData.loreTitle,
                        text: doc.userData.loreText,
                    }
                }));

                // Remove pickup visually
                this.group.remove(doc);
                if (doc.geometry) doc.geometry.dispose();
                if (doc.material) doc.material.dispose();
            }
        }
    }

    getPlayerSpawnPosition() {
        const approach = this.options.approach;
        const rawY = (approach === 'assets' || approach === 'hybrid')
            ? this.getHeightAt(SPAWN_CENTER, SPAWN_CENTER) : 0;
        const blobGroundOffset = (approach === 'particles') ? 0 : 0.25;
        return new THREE.Vector3(SPAWN_CENTER, rawY + blobGroundOffset + 1, SPAWN_CENTER);
    }

    getEnemySpawns() {
        return this.enemySpawnPoints;
    }

    getBounds() {
        return {
            minX: 0,
            maxX: WORLD_SIZE,
            minZ: 0,
            maxZ: WORLD_SIZE,
            centerX: SPAWN_CENTER,
            centerZ: SPAWN_CENTER,
        };
    }

    getTheme() {
        return {
            name: `Outdoor (${this.options.approach})`,
            colors: {
                floor: 0x4a8c3f,
                wall: 0x999988,
                accent: 0xffaa00,
            },
        };
    }

    getStats() {
        let meshCount = 0;
        let particleCount = 0;
        this.group.traverse(obj => {
            if (obj.isMesh) meshCount++;
            if (obj.isPoints) {
                const posAttr = obj.geometry.attributes.position;
                if (posAttr) particleCount += posAttr.count;
            }
        });

        return {
            approach: this.options.approach,
            meshes: meshCount,
            particles: particleCount,
            trees: this.layout?.trees?.length || 0,
            rocks: this.layout?.rocks?.length || 0,
            ruins: this.layout?.ruins?.length || 0,
            enemies: this.enemySpawnPoints.length,
        };
    }

    update(delta, elapsed) {
        // Animate sky clouds
        if (this._skyUniforms) {
            this._skyUniforms.time.value = elapsed;
        }

        if (this.options.approach === 'hybrid') {
            this._updateHybridWorld(delta, elapsed);
        } else if (this.options.approach === 'assets') {
            this._updateAssetWorld(delta, elapsed);
        } else {
            this._updateParticleWorld(delta, elapsed);
        }

        // Animate lore pickups (gentle bob)
        for (const doc of this.lorePickups) {
            if (doc.userData.collected) continue;
            const ud = doc.userData;
            doc.position.y = ud.baseY + Math.sin(elapsed * 2 + ud.bobPhase) * 0.15;
            doc.rotation.y += delta * 0.5;
        }
    }

    _updateAssetWorld(delta, elapsed) {
        // Per-blade wind animation (update half per frame: odd/even alternation)
        // Preserves terrain normal inheritance via quaternion composition
        if (this.grassInstanced && this._grassData) {
            const dummy = this._windDummy || (this._windDummy = new THREE.Object3D());
            const data = this._grassData;
            const count = data.length;
            // Alternate odd/even frames
            const frameOdd = (this._grassFrame = (this._grassFrame || 0) + 1) & 1;
            const start = frameOdd ? 1 : 0;

            // Pre-allocate all reusable objects once
            if (!this._windHelpers) {
                this._windHelpers = {
                    upVec: new THREE.Vector3(0, 1, 0),
                    normalVec: new THREE.Vector3(),
                    terrainQuat: new THREE.Quaternion(),
                    yRotQuat: new THREE.Quaternion(),
                    windQuat: new THREE.Quaternion(),
                    tmpQuat: new THREE.Quaternion(),
                    xAxis: new THREE.Vector3(1, 0, 0),
                    zAxis: new THREE.Vector3(0, 0, 1),
                };
            }
            const { upVec, normalVec, terrainQuat, yRotQuat, windQuat, tmpQuat, xAxis, zAxis } = this._windHelpers;

            for (let i = start; i < count; i += 2) {
                const d = data[i];
                if (d.scaleY === 0) continue; // Skip hidden blades

                // Wind varies by world position for wave-like propagation
                const windAngle = Math.sin(elapsed * 1.5 + d.wx * 0.05 + d.phase) * 0.25;
                const windTilt = Math.sin(elapsed * 1.1 + d.z * 0.04 + d.phase * 0.7) * 0.1;

                // Reconstruct terrain-normal quaternion
                normalVec.set(d.nx, d.ny, d.nz);
                terrainQuat.setFromUnitVectors(upVec, normalVec);

                // Y rotation for blade facing direction
                yRotQuat.setFromAxisAngle(upVec, d.baseRotY);

                // Wind: tilt on X and roll on Z (no allocation)
                windQuat.setFromAxisAngle(xAxis, windTilt);
                tmpQuat.setFromAxisAngle(zAxis, windAngle);
                windQuat.multiply(tmpQuat);

                // Compose: terrain tilt → Y rotation → wind sway
                dummy.quaternion.copy(terrainQuat).multiply(yRotQuat).multiply(windQuat);
                dummy.position.set(d.x, d.y, d.z);
                dummy.scale.set(d.scaleX, d.scaleY, 1);
                dummy.updateMatrix();
                this.grassInstanced.setMatrixAt(i, dummy.matrix);
            }

            this.grassInstanced.instanceMatrix.needsUpdate = true;
        }
    }

    _updateParticleWorld(delta, elapsed) {
        for (const points of this.particleGroups) {
            const type = points.userData.type;
            const posArray = points.geometry.attributes.position.array;

            if (type === 'ground-particles') {
                const grassCount = points.userData.grassCount;
                const waterStart = grassCount;
                const waterCount = points.userData.waterCount;

                // Grass wind sway (only X/Z, subtle)
                for (let i = 0; i < grassCount; i++) {
                    const i3 = i * 3;
                    const origX = posArray[i3];
                    posArray[i3 + 1] = Math.abs(Math.sin(elapsed * 1.2 + i * 0.03)) * 0.25;
                }

                // Water wave (Y oscillation)
                for (let i = 0; i < waterCount; i++) {
                    const idx = waterStart + i;
                    const i3 = idx * 3;
                    const dx = posArray[i3] - points.userData.pondX;
                    const dz = posArray[i3 + 2] - points.userData.pondZ;
                    const dist = Math.sqrt(dx * dx + dz * dz);
                    posArray[i3 + 1] = 0.05 + Math.sin(elapsed * 2 + dist * 0.5) * 0.15;
                }

                points.geometry.attributes.position.needsUpdate = true;
            }

            if (type === 'vegetation-particles') {
                // Canopy sway (subtle position oscillation for particles above trunk height)
                const count = points.geometry.attributes.position.count;
                for (let i = 0; i < count; i++) {
                    const i3 = i * 3;
                    if (posArray[i3 + 1] > 3) {  // Above trunk height = canopy
                        posArray[i3] += Math.sin(elapsed + i * 0.05) * 0.002;
                        posArray[i3 + 2] += Math.cos(elapsed * 0.8 + i * 0.07) * 0.002;
                    }
                }
                points.geometry.attributes.position.needsUpdate = true;
            }
        }
    }

    dispose() {
        // Remove group and all children
        if (this.group) {
            this.scene.remove(this.group);
            this.group.traverse(obj => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach(m => m.dispose());
                    } else {
                        obj.material.dispose();
                    }
                }
            });
        }

        // Remove scene lights
        for (const light of this.sceneLights) {
            this.scene.remove(light);
            if (light.target) this.scene.remove(light.target);
        }

        // Clear fog and background
        this.scene.fog = null;
        this.scene.background = null;

        // Clean up toon gradient map
        if (this._toonGradientMap) {
            this._toonGradientMap.dispose();
            this._toonGradientMap = null;
        }

        // Clean up sky texture
        if (this._skyTexture) {
            this._skyTexture.dispose();
            this._skyTexture = null;
        }

        this.sceneLights = [];
        this.enemySpawnPoints = [];
        this.particleGroups = [];
        this.heightmap = null;
        this.grassInstanced = null;

        // Hybrid references
        this._hybridPoints = null;
        this._hybridParticleData = null;
        this._hybridSegments = null;
    }

    async regenerate(options = {}) {
        this.dispose();
        this.options = { ...this.options, ...options };
        return this.build();
    }
}
