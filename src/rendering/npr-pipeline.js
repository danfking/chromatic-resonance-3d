// npr-pipeline.js - Non-Photorealistic Rendering post-processing pipeline

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// ─── Reinhard Color Transfer shader ──────────────────────────────────
// Shifts color palette toward a target style (BotW) using Lab color space
// statistics. Pre-computed from BotW screenshot analysis.
// Reference: "Color Transfer between Images" (Reinhard et al., 2001)
const ReinhardColorTransferShader = {
    uniforms: {
        tDiffuse: { value: null },
        // Source stats are computed per-frame from the rendered image (approximated here)
        // Target stats: pre-computed from BotW screenshots in Lab space
        // BotW palette: warm golden horizon, muted blue sky, desaturated greens, lifted shadows
        targetMeanL: { value: 62.0 },   // BotW midtone brightness (lifted shadows → higher L mean)
        targetMeanA: { value: 1.5 },    // Slight warm bias (positive a = red/magenta)
        targetMeanB: { value: 12.0 },   // Warm golden bias (positive b = yellow)
        targetStdL:  { value: 18.0 },   // BotW contrast range (low — desaturated midtones)
        targetStdA:  { value: 8.0 },    // Moderate chroma spread on a axis
        targetStdB:  { value: 14.0 },   // Wider spread on b axis (warm-cool contrast)
        srcMeanL:    { value: 45.0 },   // Source scene mean brightness (tunable)
        srcMeanA:    { value: -5.0 },   // Source scene mean a (tunable)
        srcMeanB:    { value: 5.0 },    // Source scene mean b (tunable)
        srcStdL:     { value: 22.0 },   // Source scene std brightness (tunable)
        srcStdA:     { value: 12.0 },   // Source scene std a (tunable)
        srcStdB:     { value: 15.0 },   // Source scene std b (tunable)
        strength:    { value: 0.35 },   // Blend factor (0 = no transfer, 1 = full transfer)
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float targetMeanL, targetMeanA, targetMeanB;
        uniform float targetStdL, targetStdA, targetStdB;
        uniform float srcMeanL, srcMeanA, srcMeanB;
        uniform float srcStdL, srcStdA, srcStdB;
        uniform float strength;
        varying vec2 vUv;

        // sRGB → linear
        vec3 srgbToLinear(vec3 c) {
            return pow(c, vec3(2.2));
        }

        // linear → sRGB
        vec3 linearToSrgb(vec3 c) {
            return pow(c, vec3(1.0 / 2.2));
        }

        // Linear RGB → CIE XYZ
        vec3 rgbToXyz(vec3 rgb) {
            mat3 m = mat3(
                0.4124564, 0.2126729, 0.0193339,
                0.3575761, 0.7151522, 0.1191920,
                0.1804375, 0.0721750, 0.9503041
            );
            return m * rgb;
        }

        // CIE XYZ → Linear RGB
        vec3 xyzToRgb(vec3 xyz) {
            mat3 m = mat3(
                 3.2404542, -0.9692660,  0.0556434,
                -1.5371385,  1.8760108, -0.2040259,
                -0.4985314,  0.0415560,  1.0572252
            );
            return m * xyz;
        }

        // XYZ → Lab helper
        float labF(float t) {
            return t > 0.008856 ? pow(t, 1.0 / 3.0) : 7.787 * t + 16.0 / 116.0;
        }

        // Lab → XYZ helper
        float labFInv(float t) {
            return t > 0.206893 ? t * t * t : (t - 16.0 / 116.0) / 7.787;
        }

        // RGB → Lab (D65 illuminant)
        vec3 rgbToLab(vec3 rgb) {
            vec3 xyz = rgbToXyz(srgbToLinear(rgb));
            // D65 white point
            float xn = 0.95047, yn = 1.0, zn = 1.08883;
            float fx = labF(xyz.x / xn);
            float fy = labF(xyz.y / yn);
            float fz = labF(xyz.z / zn);
            float L = 116.0 * fy - 16.0;
            float a = 500.0 * (fx - fy);
            float b = 200.0 * (fy - fz);
            return vec3(L, a, b);
        }

        // Lab → RGB
        vec3 labToRgb(vec3 lab) {
            float xn = 0.95047, yn = 1.0, zn = 1.08883;
            float fy = (lab.x + 16.0) / 116.0;
            float fx = lab.y / 500.0 + fy;
            float fz = fy - lab.z / 200.0;
            vec3 xyz = vec3(xn * labFInv(fx), yn * labFInv(fy), zn * labFInv(fz));
            vec3 rgb = xyzToRgb(xyz);
            return linearToSrgb(clamp(rgb, 0.0, 1.0));
        }

        void main() {
            vec4 texel = texture2D(tDiffuse, vUv);
            vec3 lab = rgbToLab(texel.rgb);

            // Source statistics — set via uniforms (tunable at runtime)

            // Reinhard transfer: shift mean and scale std
            vec3 transferred;
            transferred.x = (lab.x - srcMeanL) * (targetStdL / srcStdL) + targetMeanL;
            transferred.y = (lab.y - srcMeanA) * (targetStdA / srcStdA) + targetMeanA;
            transferred.z = (lab.z - srcMeanB) * (targetStdB / srcStdB) + targetMeanB;

            // Clamp Lab to valid range
            transferred.x = clamp(transferred.x, 0.0, 100.0);
            transferred.y = clamp(transferred.y, -128.0, 128.0);
            transferred.z = clamp(transferred.z, -128.0, 128.0);

            // Blend between original and transferred
            vec3 result = labToRgb(mix(lab, transferred, strength));
            gl_FragColor = vec4(result, texel.a);
        }
    `,
};

// Kuwahara filter for painterly effect
const KuwaharaShader = {
    uniforms: {
        tDiffuse: { value: null },
        resolution: { value: new THREE.Vector2() },
        radius: { value: 4 }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 resolution;
        uniform int radius;
        varying vec2 vUv;

        void main() {
            vec2 texel = 1.0 / resolution;
            int r = radius;

            // Sample 4 quadrants
            vec3 mean[4];
            vec3 sigma[4];

            for (int i = 0; i < 4; i++) {
                mean[i] = vec3(0.0);
                sigma[i] = vec3(0.0);
            }

            // Calculate mean and variance for each quadrant
            for (int j = -r; j <= 0; j++) {
                for (int i = -r; i <= 0; i++) {
                    vec3 c = texture2D(tDiffuse, vUv + vec2(float(i), float(j)) * texel).rgb;
                    mean[0] += c;
                    sigma[0] += c * c;
                }
            }

            for (int j = -r; j <= 0; j++) {
                for (int i = 0; i <= r; i++) {
                    vec3 c = texture2D(tDiffuse, vUv + vec2(float(i), float(j)) * texel).rgb;
                    mean[1] += c;
                    sigma[1] += c * c;
                }
            }

            for (int j = 0; j <= r; j++) {
                for (int i = 0; i <= r; i++) {
                    vec3 c = texture2D(tDiffuse, vUv + vec2(float(i), float(j)) * texel).rgb;
                    mean[2] += c;
                    sigma[2] += c * c;
                }
            }

            for (int j = 0; j <= r; j++) {
                for (int i = -r; i <= 0; i++) {
                    vec3 c = texture2D(tDiffuse, vUv + vec2(float(i), float(j)) * texel).rgb;
                    mean[3] += c;
                    sigma[3] += c * c;
                }
            }

            float n = float((r + 1) * (r + 1));
            float minSigma = 1e10;
            vec3 result = vec3(0.0);

            for (int i = 0; i < 4; i++) {
                mean[i] /= n;
                sigma[i] = abs(sigma[i] / n - mean[i] * mean[i]);
                float s = sigma[i].r + sigma[i].g + sigma[i].b;
                if (s < minSigma) {
                    minSigma = s;
                    result = mean[i];
                }
            }

            gl_FragColor = vec4(result, 1.0);
        }
    `
};

// Edge darkening shader (soft Sobel)
const EdgeDarkeningShader = {
    uniforms: {
        tDiffuse: { value: null },
        resolution: { value: new THREE.Vector2() },
        edgeStrength: { value: 0.4 },
        edgeThreshold: { value: 0.1 }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 resolution;
        uniform float edgeStrength;
        uniform float edgeThreshold;
        varying vec2 vUv;

        float luminance(vec3 color) {
            return dot(color, vec3(0.299, 0.587, 0.114));
        }

        void main() {
            vec2 texel = 1.0 / resolution;
            vec4 center = texture2D(tDiffuse, vUv);

            // Sobel edge detection
            float tl = luminance(texture2D(tDiffuse, vUv + vec2(-texel.x, -texel.y)).rgb);
            float t  = luminance(texture2D(tDiffuse, vUv + vec2(0.0, -texel.y)).rgb);
            float tr = luminance(texture2D(tDiffuse, vUv + vec2(texel.x, -texel.y)).rgb);
            float l  = luminance(texture2D(tDiffuse, vUv + vec2(-texel.x, 0.0)).rgb);
            float r  = luminance(texture2D(tDiffuse, vUv + vec2(texel.x, 0.0)).rgb);
            float bl = luminance(texture2D(tDiffuse, vUv + vec2(-texel.x, texel.y)).rgb);
            float b  = luminance(texture2D(tDiffuse, vUv + vec2(0.0, texel.y)).rgb);
            float br = luminance(texture2D(tDiffuse, vUv + vec2(texel.x, texel.y)).rgb);

            float gx = -tl - 2.0 * l - bl + tr + 2.0 * r + br;
            float gy = -tl - 2.0 * t - tr + bl + 2.0 * b + br;
            float edge = sqrt(gx * gx + gy * gy);

            // Soft edge darkening
            float darken = smoothstep(edgeThreshold, edgeThreshold + 0.2, edge) * edgeStrength;
            vec3 result = center.rgb * (1.0 - darken);

            gl_FragColor = vec4(result, center.a);
        }
    `
};

// Bold outline shader for Sable/Moebius style
// Uses dilated Sobel on luminance for thick ink lines (2-4px at 1080p)
const SableOutlineShader = {
    uniforms: {
        tDiffuse: { value: null },
        resolution: { value: new THREE.Vector2() },
        lineThickness: { value: 1.5 },
        lineStrength: { value: 1.0 },
        lineThreshold: { value: 0.04 },
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 resolution;
        uniform float lineThickness;
        uniform float lineStrength;
        uniform float lineThreshold;
        varying vec2 vUv;

        float luminance(vec3 c) {
            return dot(c, vec3(0.299, 0.587, 0.114));
        }

        void main() {
            vec2 texel = lineThickness / resolution;
            vec4 center = texture2D(tDiffuse, vUv);

            // Sobel with configurable offset (lineThickness) for bold lines
            float tl = luminance(texture2D(tDiffuse, vUv + vec2(-texel.x, -texel.y)).rgb);
            float t  = luminance(texture2D(tDiffuse, vUv + vec2(0.0, -texel.y)).rgb);
            float tr = luminance(texture2D(tDiffuse, vUv + vec2(texel.x, -texel.y)).rgb);
            float l  = luminance(texture2D(tDiffuse, vUv + vec2(-texel.x, 0.0)).rgb);
            float r  = luminance(texture2D(tDiffuse, vUv + vec2(texel.x, 0.0)).rgb);
            float bl = luminance(texture2D(tDiffuse, vUv + vec2(-texel.x, texel.y)).rgb);
            float b  = luminance(texture2D(tDiffuse, vUv + vec2(0.0, texel.y)).rgb);
            float br = luminance(texture2D(tDiffuse, vUv + vec2(texel.x, texel.y)).rgb);

            float gx = -tl - 2.0 * l - bl + tr + 2.0 * r + br;
            float gy = -tl - 2.0 * t - tr + bl + 2.0 * b + br;
            float edge = sqrt(gx * gx + gy * gy);

            // Hard-edge ink effect: step with slight smoothing
            float ink = smoothstep(lineThreshold, lineThreshold + 0.02, edge) * lineStrength;

            // Darken toward black for ink line effect
            vec3 result = center.rgb * (1.0 - ink);
            gl_FragColor = vec4(result, center.a);
        }
    `
};

// Paper texture overlay shader
const PaperTextureShader = {
    uniforms: {
        tDiffuse: { value: null },
        resolution: { value: new THREE.Vector2() },
        time: { value: 0.0 },
        grainIntensity: { value: 0.08 },
        vignetteIntensity: { value: 0.3 },
        saturationAdjust: { value: 0.9 },
        posterizeLevels: { value: 0.0 }  // 0 = disabled, 4-8 = Sable flat shading
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 resolution;
        uniform float time;
        uniform float grainIntensity;
        uniform float vignetteIntensity;
        uniform float saturationAdjust;
        uniform float posterizeLevels;
        varying vec2 vUv;

        // Simplex noise for paper grain
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

        vec3 adjustSaturation(vec3 color, float amount) {
            float gray = dot(color, vec3(0.299, 0.587, 0.114));
            return mix(vec3(gray), color, amount);
        }

        void main() {
            vec4 color = texture2D(tDiffuse, vUv);

            // Subtle paper grain - much lower frequency for softer look
            float grain = noise(vUv * 200.0 + time * 0.05) * 2.0 - 1.0;
            grain *= grainIntensity;

            // Apply grain
            vec3 result = color.rgb + vec3(grain);

            // Saturation adjustment
            result = adjustSaturation(result, saturationAdjust);

            // Posterization (flat color quantization for Sable style)
            if (posterizeLevels > 1.0) {
                result = floor(result * posterizeLevels + 0.5) / posterizeLevels;
            }

            // Vignette
            vec2 center = vUv - 0.5;
            float vignette = 1.0 - dot(center, center) * vignetteIntensity * 2.0;
            result *= vignette;

            // Warm paper tint
            result = mix(result, result * vec3(1.02, 0.98, 0.94), 0.3);

            gl_FragColor = vec4(result, color.a);
        }
    `
};

export class NPRPipeline {
    constructor(renderer, scene, camera) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        this.composer = null;
        this.paperPass = null;
        this.kuwaharaPass = null;
        this.edgePass = null;
        this.sableOutlinePass = null;
        this.clock = new THREE.Clock();
    }

    init() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        // Create composer
        this.composer = new EffectComposer(this.renderer);

        // Render pass
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        // Kuwahara pass (painterly effect) - minimal for crisp blob particles
        this.kuwaharaPass = new ShaderPass(KuwaharaShader);
        this.kuwaharaPass.uniforms.resolution.value.set(width, height);
        this.kuwaharaPass.uniforms.radius.value = 1;  // Minimal for crisp blob particles
        this.composer.addPass(this.kuwaharaPass);

        // Edge darkening pass - softer for blob mode
        this.edgePass = new ShaderPass(EdgeDarkeningShader);
        this.edgePass.uniforms.resolution.value.set(width, height);
        this.edgePass.uniforms.edgeStrength.value = 0.25;  // Reduced for crisper blobs
        this.edgePass.uniforms.edgeThreshold.value = 0.15;
        this.composer.addPass(this.edgePass);

        // Sable bold outline pass - disabled by default, enabled by Sable preset
        this.sableOutlinePass = new ShaderPass(SableOutlineShader);
        this.sableOutlinePass.uniforms.resolution.value.set(width, height);
        this.sableOutlinePass.enabled = false;
        this.composer.addPass(this.sableOutlinePass);

        // Subtle bloom for magical glow - lower threshold
        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(width, height),
            0.3,  // strength
            0.4,  // radius
            0.80  // threshold - lowered for more glow
        );
        this.composer.addPass(this.bloomPass);

        // Reinhard color transfer pass — shifts palette toward BotW target
        this.colorTransferPass = new ShaderPass(ReinhardColorTransferShader);
        this.colorTransferPass.uniforms.strength.value = 0.20;
        this.composer.addPass(this.colorTransferPass);

        // Paper texture pass (final) - soft vignette only, grain disabled
        this.paperPass = new ShaderPass(PaperTextureShader);
        this.paperPass.uniforms.resolution.value.set(width, height);
        this.paperPass.uniforms.grainIntensity.value = 0.0;  // Disabled - was causing visible pattern
        this.paperPass.uniforms.vignetteIntensity.value = 0.10;  // Soft vignette for focus
        this.paperPass.uniforms.saturationAdjust.value = 0.95;  // Slightly desaturated for watercolor feel
        this.composer.addPass(this.paperPass);

        // Handle resize
        window.addEventListener('resize', () => this.onResize());
    }

    onResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.composer.setSize(width, height);

        // Update shader resolutions
        this.composer.passes.forEach(pass => {
            if (pass.uniforms && pass.uniforms.resolution) {
                pass.uniforms.resolution.value.set(width, height);
            }
        });
    }

    render() {
        // Update time for animated effects
        if (this.paperPass) {
            this.paperPass.uniforms.time.value = this.clock.getElapsedTime();
        }

        this.composer.render();
    }

    setKuwaharaRadius(radius) {
        const pass = this.composer.passes.find(p =>
            p.uniforms && p.uniforms.radius !== undefined
        );
        if (pass) {
            pass.uniforms.radius.value = radius;
        }
    }

    setEdgeStrength(strength) {
        const pass = this.composer.passes.find(p =>
            p.uniforms && p.uniforms.edgeStrength !== undefined
        );
        if (pass) {
            pass.uniforms.edgeStrength.value = strength;
        }
    }

    setGrainIntensity(intensity) {
        if (this.paperPass) {
            this.paperPass.uniforms.grainIntensity.value = intensity;
        }
    }

    /**
     * Apply a complete NPR preset in one call.
     * @param {object} config - Preset values
     * @param {number} [config.kuwaharaRadius]
     * @param {number} [config.edgeStrength]
     * @param {number} [config.edgeThreshold]
     * @param {number} [config.bloomStrength]
     * @param {number} [config.bloomRadius]
     * @param {number} [config.bloomThreshold]
     * @param {number} [config.grainIntensity]
     * @param {number} [config.vignetteIntensity]
     * @param {number} [config.saturationAdjust]
     * @param {number} [config.colorTransferStrength]
     * @param {number} [config.srcMeanL] - Reinhard source mean L (measured from scene)
     * @param {number} [config.srcMeanA] - Reinhard source mean a
     * @param {number} [config.srcMeanB] - Reinhard source mean b
     * @param {number} [config.srcStdL]  - Reinhard source std L
     * @param {number} [config.srcStdA]  - Reinhard source std a
     * @param {number} [config.srcStdB]  - Reinhard source std b
     */
    applyPreset(config) {
        if (config.kuwaharaRadius !== undefined && this.kuwaharaPass) {
            this.kuwaharaPass.uniforms.radius.value = config.kuwaharaRadius;
        }
        if (config.edgeStrength !== undefined && this.edgePass) {
            this.edgePass.uniforms.edgeStrength.value = config.edgeStrength;
        }
        if (config.edgeThreshold !== undefined && this.edgePass) {
            this.edgePass.uniforms.edgeThreshold.value = config.edgeThreshold;
        }
        if (config.bloomStrength !== undefined && this.bloomPass) {
            this.bloomPass.strength = config.bloomStrength;
        }
        if (config.bloomRadius !== undefined && this.bloomPass) {
            this.bloomPass.radius = config.bloomRadius;
        }
        if (config.bloomThreshold !== undefined && this.bloomPass) {
            this.bloomPass.threshold = config.bloomThreshold;
        }
        if (config.grainIntensity !== undefined && this.paperPass) {
            this.paperPass.uniforms.grainIntensity.value = config.grainIntensity;
        }
        if (config.vignetteIntensity !== undefined && this.paperPass) {
            this.paperPass.uniforms.vignetteIntensity.value = config.vignetteIntensity;
        }
        if (config.saturationAdjust !== undefined && this.paperPass) {
            this.paperPass.uniforms.saturationAdjust.value = config.saturationAdjust;
        }
        if (config.colorTransferStrength !== undefined && this.colorTransferPass) {
            this.colorTransferPass.uniforms.strength.value = config.colorTransferStrength;
        }
        // Posterization (flat color quantization) — defaults to 0 (disabled) when not specified
        if (this.paperPass) {
            this.paperPass.uniforms.posterizeLevels.value = config.posterizeLevels || 0.0;
        }
        // Sable bold outline pass — defaults to disabled when not specified
        if (this.sableOutlinePass) {
            this.sableOutlinePass.enabled = config.sableOutlineEnabled || false;
            if (config.sableLineThickness !== undefined) {
                this.sableOutlinePass.uniforms.lineThickness.value = config.sableLineThickness;
            }
            if (config.sableLineStrength !== undefined) {
                this.sableOutlinePass.uniforms.lineStrength.value = config.sableLineStrength;
            }
            if (config.sableLineThreshold !== undefined) {
                this.sableOutlinePass.uniforms.lineThreshold.value = config.sableLineThreshold;
            }
        }
        // Source stat uniforms for Reinhard color transfer
        if (config.srcMeanL !== undefined && this.colorTransferPass) {
            this.colorTransferPass.uniforms.srcMeanL.value = config.srcMeanL;
        }
        if (config.srcMeanA !== undefined && this.colorTransferPass) {
            this.colorTransferPass.uniforms.srcMeanA.value = config.srcMeanA;
        }
        if (config.srcMeanB !== undefined && this.colorTransferPass) {
            this.colorTransferPass.uniforms.srcMeanB.value = config.srcMeanB;
        }
        if (config.srcStdL !== undefined && this.colorTransferPass) {
            this.colorTransferPass.uniforms.srcStdL.value = config.srcStdL;
        }
        if (config.srcStdA !== undefined && this.colorTransferPass) {
            this.colorTransferPass.uniforms.srcStdA.value = config.srcStdA;
        }
        if (config.srcStdB !== undefined && this.colorTransferPass) {
            this.colorTransferPass.uniforms.srcStdB.value = config.srcStdB;
        }
    }
}
