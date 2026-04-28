// grass-material.js - Custom ShaderMaterial for GPU-animated instanced grass blades
// Uses InstancedBufferGeometry attributes for per-blade position, height, phase, and color

import * as THREE from 'three';

export function createGrassMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            windDirection: { value: new THREE.Vector2(1, 0.3) },
            windStrength: { value: 0.8 },
        },
        vertexShader: /* glsl */ `
            // Per-instance attributes
            attribute vec3 instancePosition;   // world position of blade base
            attribute float instanceHeight;    // blade height (0.3-0.8)
            attribute float instancePhase;     // random phase for wind offset
            attribute vec3 instanceColor;      // per-blade color tint

            uniform float time;
            uniform vec2 windDirection;
            uniform float windStrength;

            varying vec3 vColor;
            varying float vHeightFrac;

            void main() {
                // Height fraction: position.y goes 0 (base) to 1 (tip) in blade geometry
                vHeightFrac = position.y;

                // Wind displacement increases quadratically with height (natural bending)
                float windFactor = vHeightFrac * vHeightFrac;

                // Octave 1: broad, slow sway (large-scale gusts)
                float phase1 = time * 1.8 + instancePhase + instancePosition.x * 0.08 + instancePosition.z * 0.08;
                float windX1 = sin(phase1) * windDirection.x;
                float windZ1 = sin(phase1 * 0.7 + 1.3) * windDirection.y;

                // Octave 2: finer, faster flutter (local turbulence, half amplitude, double freq)
                float phase2 = time * 3.6 + instancePhase * 2.7 + instancePosition.x * 0.22 + instancePosition.z * 0.17;
                float windX2 = sin(phase2) * windDirection.x * 0.5;
                float windZ2 = sin(phase2 * 0.9 + 2.1) * windDirection.y * 0.5;

                float windX = (windX1 + windX2) * windStrength * windFactor;
                float windZ = (windZ1 + windZ2) * windStrength * windFactor;

                // Scale blade by instance height
                vec3 scaledPos = position * vec3(1.0, instanceHeight, 1.0);

                // World position = instance base + scaled local + wind offset
                vec3 worldPos = instancePosition + scaledPos + vec3(windX, 0.0, windZ);

                // Color gradient: dark green at base, yellow-green at tip, tinted per-blade
                vec3 baseColor = vec3(0.2, 0.45, 0.1);
                vec3 tipColor = vec3(0.6, 0.75, 0.2);
                vColor = mix(baseColor, tipColor, vHeightFrac) * instanceColor;

                gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);
            }
        `,
        fragmentShader: /* glsl */ `
            varying vec3 vColor;
            varying float vHeightFrac;

            void main() {
                // Slight alpha fade at tip for soft edge
                float alpha = 1.0 - smoothstep(0.85, 1.0, vHeightFrac) * 0.3;
                gl_FragColor = vec4(vColor, alpha);

                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }
        `,
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: true,
    });
}
