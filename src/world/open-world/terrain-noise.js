// terrain-noise.js - Extracted terrain noise functions (shared by chunks)
// Identical to outdoor-level.js _interpolatedNoise + _fbmNoise
// Purely positional — chunks generate independently with matching edges

/**
 * Seeded value noise with bilinear interpolation
 */
export function interpolatedNoise(x, z, seed) {
    const hash = (ix, iz) => {
        let h = (ix * 374761393 + iz * 668265263 + seed * 1274126177) | 0;
        h = ((h ^ (h >> 13)) * 1274126177) | 0;
        return ((h ^ (h >> 16)) & 0x7fffffff) / 0x7fffffff;
    };

    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const fx = x - ix;
    const fz = z - iz;

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
 * @param {number} x - world X coordinate
 * @param {number} z - world Z coordinate
 * @param {number} seed - noise seed
 * @returns {number} height value (0 to ~25)
 */
export function fbmNoise(x, z, seed) {
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
        let n = interpolatedNoise(nx, nz, seed + i * 31);

        // Ridge noise for higher octaves
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

/**
 * Seeded RNG (matches outdoor-level.js)
 */
export function seededRNG(seed) {
    let s = seed | 0;
    return () => {
        s = (s * 1664525 + 1013904223) & 0x7fffffff;
        return s / 0x7fffffff;
    };
}
