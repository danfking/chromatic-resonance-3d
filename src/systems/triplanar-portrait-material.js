// triplanar-portrait-material.js - Enhanced triplanar texture projection for 3D enemy bodies
// Optimized for watercolor portrait textures with front-dominant projection

import * as THREE from 'three';

const TRIPLANAR_VERTEX = `
    varying vec3 vWorldPosition;
    varying vec3 vWorldNormal;
    varying vec3 vLocalPosition;
    varying vec3 vViewDirection;

    void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vLocalPosition = position;

        // View direction for fresnel edge effect
        vViewDirection = normalize(cameraPosition - worldPosition.xyz);

        gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
`;

const TRIPLANAR_FRAGMENT = `
    uniform sampler2D portraitTexture;
    uniform vec3 tintColor;
    uniform float projectionScale;
    uniform vec2 projectionOffset;
    uniform float blendSharpness;
    uniform float frontBias;
    uniform float sideBias;
    uniform float topBias;
    uniform float opacity;
    uniform float emissiveIntensity;

    // Enhanced projection parameters
    uniform float frontDominance;    // How much to favor front projection (2.0-3.0)
    uniform float headBodySplit;     // Y position where head meets body (0.5-0.7)
    uniform float headUVScale;       // Scale for head UV region
    uniform float bodyUVScale;       // Scale for body UV region
    uniform float edgeSoftness;      // Fresnel edge softening amount

    // Bottom bleeding effect (watercolor fade at bottom edge)
    uniform float bottomBleedStrength; // 0.0-1.0, how much bottom fades (default 0.4)
    uniform float bottomBleedHeight;   // 0.0-1.0, how high the bleed extends (default 0.3)

    varying vec3 vWorldPosition;
    varying vec3 vWorldNormal;
    varying vec3 vLocalPosition;
    varying vec3 vViewDirection;

    // Soft noise for watercolor variation
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

    void main() {
        // === BLEND WEIGHTS (Front-dominant for portraits) ===
        vec3 absNormal = abs(vWorldNormal);

        // Apply biases - strong front dominance reduces side/top bleeding
        vec3 blendWeights = absNormal;
        blendWeights.z *= frontBias * frontDominance;  // Front (Z-facing)
        blendWeights.x *= sideBias * 0.3;              // Sides (X-facing) - reduce
        blendWeights.y *= topBias * 0.1;               // Top (Y-facing) - minimize

        // Sharpen the blend
        blendWeights = pow(blendWeights, vec3(blendSharpness));
        blendWeights /= (blendWeights.x + blendWeights.y + blendWeights.z + 0.001);

        // === HEAD/BODY UV REGION MAPPING ===
        // Determine if we're in head or body region based on local Y position
        float normalizedY = (vLocalPosition.y + 1.0) * 0.5; // Normalize to 0-1
        float isHead = smoothstep(headBodySplit - 0.1, headBodySplit + 0.1, normalizedY);

        // Head samples from top 30% of texture (portrait face region)
        // Body samples from middle-lower region
        vec2 headUVOffset = vec2(0.0, 0.7);  // Start at 70% up
        vec2 bodyUVOffset = vec2(0.0, 0.2);  // Start at 20% up

        // === UV COORDINATES FOR EACH PROJECTION ===
        // Front projection (primary for portraits)
        vec2 uvFront = vWorldPosition.xy * projectionScale + projectionOffset;
        uvFront = uvFront * 0.5 + 0.5;

        // Apply head/body UV offset
        vec2 uvFrontHead = uvFront * vec2(1.0, headUVScale) + headUVOffset;
        vec2 uvFrontBody = uvFront * vec2(1.0, bodyUVScale) + bodyUVOffset;
        uvFront = mix(uvFrontBody, uvFrontHead, isHead);

        // Side projection (reduced influence)
        vec2 uvSide = vWorldPosition.zy * projectionScale + projectionOffset;
        uvSide = uvSide * 0.5 + 0.5;
        // Side uses body region to avoid face smearing
        uvSide = uvSide * vec2(1.0, bodyUVScale) + bodyUVOffset;

        // Top projection (minimal influence)
        vec2 uvTop = vWorldPosition.xz * projectionScale + projectionOffset;
        uvTop = uvTop * 0.5 + 0.5;

        // === SAMPLE TEXTURES ===
        vec4 colFront = texture2D(portraitTexture, uvFront);
        vec4 colSide = texture2D(portraitTexture, uvSide);
        vec4 colTop = texture2D(portraitTexture, uvTop);

        // Blend based on weights
        vec4 color = colFront * blendWeights.z +
                     colSide * blendWeights.x +
                     colTop * blendWeights.y;

        // === WATERCOLOR EDGE SOFTENING (Fresnel) ===
        float fresnel = 1.0 - max(dot(vViewDirection, vWorldNormal), 0.0);
        float edgeAlpha = 1.0 - smoothstep(0.6, 1.0, fresnel) * edgeSoftness;

        // Add subtle noise to edges for painterly feel
        float edgeNoise = noise(vWorldPosition.xy * 10.0) * 0.1;
        edgeAlpha = clamp(edgeAlpha + edgeNoise - 0.05, 0.0, 1.0);

        // === TINTING AND LIGHTING ===
        // Subtle tint based on enemy color
        color.rgb *= mix(vec3(1.0), tintColor, 0.25);

        // Soft diffuse lighting
        vec3 lightDir = normalize(vec3(0.5, 1.0, 0.3));
        float diffuse = max(dot(vWorldNormal, lightDir), 0.0);
        color.rgb *= 0.55 + 0.45 * diffuse;

        // Add emissive glow
        color.rgb += tintColor * emissiveIntensity;

        // === BOTTOM BLEEDING EFFECT ===
        // Creates watercolor bleeding/fading at bottom 20-30% of model
        float verticalNorm = (vLocalPosition.y + 1.0) * 0.5; // Normalize to 0-1 range
        float bottomFade = smoothstep(0.0, bottomBleedHeight, verticalNorm);
        float bleedAlpha = mix(1.0 - bottomBleedStrength, 1.0, bottomFade);

        // Add noise to bottom edge for organic watercolor look
        float bottomNoise = noise(vWorldPosition.xz * 15.0 + vWorldPosition.y * 5.0);
        bleedAlpha = clamp(bleedAlpha + (bottomNoise - 0.5) * 0.15 * bottomBleedStrength, 0.0, 1.0);

        // === FINAL OUTPUT ===
        // Combine opacity with edge softening AND bottom bleeding
        float finalAlpha = color.a * opacity * edgeAlpha * bleedAlpha;

        gl_FragColor = vec4(color.rgb, finalAlpha);
    }
`;

/**
 * Creates an enhanced triplanar portrait material with front-dominant projection
 * @param {THREE.Texture} texture - Portrait texture
 * @param {number} enemyColor - Enemy tint color (hex)
 * @param {number} size - Enemy size for projection scaling
 * @param {object} options - Optional parameters for fine-tuning
 * @returns {THREE.ShaderMaterial}
 */
export function createTriplanarPortraitMaterial(texture, enemyColor, size, options = {}) {
    const {
        frontDominance = 2.5,      // How much to favor front view
        headBodySplit = 0.55,      // Where head meets body (0-1)
        headUVScale = 0.3,         // UV scale for head region
        bodyUVScale = 0.5,         // UV scale for body region
        edgeSoftness = 0.5,        // Edge feathering amount
        blendSharpness = 2.0,      // Triplanar blend sharpness
        frontBias = 1.5,           // Base front weight
        sideBias = 1.0,            // Base side weight
        topBias = 1.0,             // Base top weight
        bottomBleedStrength = 0.4, // Bottom watercolor bleed intensity
        bottomBleedHeight = 0.3    // How high the bottom bleed extends
    } = options;

    return new THREE.ShaderMaterial({
        uniforms: {
            portraitTexture: { value: texture },
            tintColor: { value: new THREE.Color(enemyColor) },
            projectionScale: { value: 1.0 / (size * 1.5) },
            projectionOffset: { value: new THREE.Vector2(0, -0.3) },
            blendSharpness: { value: blendSharpness },
            frontBias: { value: frontBias },
            sideBias: { value: sideBias },
            topBias: { value: topBias },
            opacity: { value: 1.0 },
            emissiveIntensity: { value: 0.15 },
            // Enhanced parameters
            frontDominance: { value: frontDominance },
            headBodySplit: { value: headBodySplit },
            headUVScale: { value: headUVScale },
            bodyUVScale: { value: bodyUVScale },
            edgeSoftness: { value: edgeSoftness },
            // Bottom bleeding parameters
            bottomBleedStrength: { value: bottomBleedStrength },
            bottomBleedHeight: { value: bottomBleedHeight }
        },
        vertexShader: TRIPLANAR_VERTEX,
        fragmentShader: TRIPLANAR_FRAGMENT,
        transparent: true,
        side: THREE.DoubleSide
    });
}

/**
 * Creates material optimized for head geometry
 * Uses higher head UV region and stronger front dominance
 */
export function createHeadMaterial(texture, enemyColor, size, options = {}) {
    return createTriplanarPortraitMaterial(texture, enemyColor, size, {
        frontDominance: 3.0,       // Very strong front for face
        headBodySplit: 0.3,        // Treat more as head
        headUVScale: 0.35,
        bodyUVScale: 0.3,
        edgeSoftness: 0.4,
        ...options
    });
}

/**
 * Creates material optimized for body geometry
 * Uses lower body UV region with moderate front dominance
 */
export function createBodyMaterial(texture, enemyColor, size, options = {}) {
    return createTriplanarPortraitMaterial(texture, enemyColor, size, {
        frontDominance: 2.0,       // Moderate front
        headBodySplit: 0.7,        // Treat more as body
        headUVScale: 0.4,
        bodyUVScale: 0.6,
        edgeSoftness: 0.6,
        ...options
    });
}

/**
 * Enemy-specific material presets
 */
export const ENEMY_MATERIAL_PRESETS = {
    shade: {
        frontDominance: 2.8,
        headBodySplit: 0.6,
        edgeSoftness: 0.7,        // Ghostly soft edges
        blendSharpness: 1.5,      // Softer blends
        bottomBleedStrength: 0.5, // Strong bottom fade for ghostly effect
        bottomBleedHeight: 0.35
    },
    verdantSlime: {
        frontDominance: 2.0,
        headBodySplit: 0.5,
        edgeSoftness: 0.3,        // Blobby solid edges
        blendSharpness: 1.2,
        bottomBleedStrength: 0.3, // Less bleed - more solid
        bottomBleedHeight: 0.25
    },
    crimsonWraith: {
        frontDominance: 2.5,
        headBodySplit: 0.55,
        edgeSoftness: 0.6,        // Fiery soft edges
        blendSharpness: 2.5,
        bottomBleedStrength: 0.45, // Moderate fiery fade
        bottomBleedHeight: 0.3
    },
    azurePhantom: {
        frontDominance: 3.0,
        headBodySplit: 0.6,
        edgeSoftness: 0.8,        // Very ethereal
        blendSharpness: 1.8,
        bottomBleedStrength: 0.6, // Strong ethereal fade
        bottomBleedHeight: 0.4
    },
    chromaticGuardian: {
        frontDominance: 2.2,
        headBodySplit: 0.5,
        edgeSoftness: 0.4,        // Solid boss presence
        blendSharpness: 2.5,
        bottomBleedStrength: 0.25, // Less bleed - more imposing
        bottomBleedHeight: 0.2
    },
    voidHarbinger: {
        frontDominance: 2.5,
        headBodySplit: 0.55,
        edgeSoftness: 0.5,
        blendSharpness: 3.0,      // Sharp menacing edges
        bottomBleedStrength: 0.5, // Void energy bleeding
        bottomBleedHeight: 0.35
    }
};

/**
 * Creates material with enemy-specific presets
 */
export function createEnemyMaterial(texture, enemyColor, size, enemyType) {
    const preset = ENEMY_MATERIAL_PRESETS[enemyType] || {};
    return createTriplanarPortraitMaterial(texture, enemyColor, size, preset);
}
