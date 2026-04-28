// water-material.js - GLSL water shader with animated ripples + Fresnel reflection

import * as THREE from 'three';

export function createWaterMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            waterColor: { value: new THREE.Color(0x3a7ca5) },
            skyColor: { value: new THREE.Color(0x87ceeb) },
            opacity: { value: 0.75 },
        },
        vertexShader: /* glsl */ `
            uniform float time;

            varying vec3 vWorldPosition;
            varying vec3 vWorldNormal;
            varying vec2 vUv;

            void main() {
                vUv = uv;

                // Vertex wave displacement (applied before model transform)
                vec3 pos = position;
                float wave1 = sin(pos.x * 0.8 + time * 1.2) * 0.08;
                float wave2 = sin(pos.y * 0.6 + time * 0.9 + 1.5) * 0.05;
                pos.z += wave1 + wave2;

                vec4 worldPos = modelMatrix * vec4(pos, 1.0);
                vWorldPosition = worldPos.xyz;

                // Approximate perturbed normal from wave derivatives
                float dx = cos(position.x * 0.8 + time * 1.2) * 0.8 * 0.08
                         + cos(position.y * 0.6 + time * 0.9 + 1.5) * 0.0;
                float dy = cos(position.y * 0.6 + time * 0.9 + 1.5) * 0.6 * 0.05;
                vec3 perturbedNormal = normalize(vec3(-dx, -dy, 1.0));
                vWorldNormal = normalize(mat3(modelMatrix) * perturbedNormal);

                gl_Position = projectionMatrix * viewMatrix * worldPos;
            }
        `,
        fragmentShader: /* glsl */ `
            uniform float time;
            uniform vec3 waterColor;
            uniform vec3 skyColor;
            uniform float opacity;

            varying vec3 vWorldPosition;
            varying vec3 vWorldNormal;
            varying vec2 vUv;

            // Simple ripple function
            float ripple(vec2 uv, float t) {
                float r1 = sin(uv.x * 8.0 + t * 2.0) * 0.5 + 0.5;
                float r2 = sin(uv.y * 6.0 + t * 1.5 + 1.0) * 0.5 + 0.5;
                float r3 = sin((uv.x + uv.y) * 10.0 + t * 3.0) * 0.5 + 0.5;
                return (r1 + r2 + r3) / 3.0;
            }

            void main() {
                // Animated ripple normals
                float r = ripple(vUv, time);

                // Fresnel effect (more reflective at grazing angles)
                vec3 viewDir = normalize(cameraPosition - vWorldPosition);
                float fresnel = pow(1.0 - max(dot(viewDir, vWorldNormal), 0.0), 3.0);
                fresnel = clamp(fresnel, 0.1, 0.9);

                // Mix water color with sky reflection
                vec3 color = mix(waterColor, skyColor, fresnel);

                // Add subtle brightness variation from ripples
                color += vec3(r * 0.08);

                // Sparkle highlights
                float sparkle = pow(r, 8.0) * fresnel * 0.5;
                color += vec3(sparkle);

                gl_FragColor = vec4(color, opacity);

                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }
        `,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
    });
}
