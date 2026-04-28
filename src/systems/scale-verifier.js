// scale-verifier.js - Runtime height verification for enemy models
// Used to catch scaling regressions and verify model heights

import * as THREE from 'three';

// Expected heights for each enemy type (in meters/game units)
const EXPECTED_HEIGHTS = {
    shade: 1.2,
    crimsonWraith: 1.5,
    azurePhantom: 1.4,
    verdantSlime: 1.8,
    chromaticGuardian: 2.5,
    voidHarbinger: 3.0
};

// Tolerance for height verification (meters)
const HEIGHT_TOLERANCE = 0.1;

/**
 * Measures the world-space height of a 3D object
 * Handles SkinnedMesh by ensuring skeleton is updated first
 * @param {THREE.Object3D} object - The object to measure
 * @returns {number} Height in meters (game units)
 */
export function measureWorldHeight(object) {
    // Ensure all transforms are up to date
    object.updateMatrixWorld(true);

    // For SkinnedMesh, ensure skeleton matrices are current
    object.traverse((child) => {
        if (child.isSkinnedMesh && child.skeleton) {
            child.skeleton.update();
            // Force geometry bounding box update
            if (child.geometry && child.geometry.boundingBox === null) {
                child.geometry.computeBoundingBox();
            }
        }
    });

    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    box.getSize(size);

    // FBX models from Mixamo are in centimeters - convert to meters
    // The scale was applied to convert to target height, but geometry units remain cm
    return size.y / 100;
}

/**
 * Verifies an enemy's height/scale matches expected value
 * Uses scale verification (more reliable than bounding box which changes with animation)
 * @param {Enemy} enemy - Enemy instance to verify
 * @returns {{valid: boolean|null, expected: number, actual: number, enemyType: string, diff: number}}
 */
export function verifyEnemyHeight(enemy) {
    if (!enemy.gltfModel) {
        return {
            valid: null,
            expected: EXPECTED_HEIGHTS[enemy.typeKey] || 0,
            actual: 0,
            enemyType: enemy.typeKey,
            diff: 0,
            reason: 'No GLTF model loaded'
        };
    }

    const expectedHeight = enemy.gltfModel.userData.expectedHeight || EXPECTED_HEIGHTS[enemy.typeKey];
    const appliedScale = enemy.gltfModel.userData.appliedScale;
    const currentScale = enemy.gltfModel.scale.x;

    // Verify scale is preserved (more reliable than bounding box which varies with animation)
    // Scale should match what model-manager applied
    if (typeof appliedScale === 'number') {
        const scaleDiff = Math.abs(currentScale - appliedScale);
        const scaleValid = scaleDiff < 0.001; // Very tight tolerance for scale

        console.log(`[Height Debug] ${enemy.typeKey}:`);
        console.log(`  - Expected height: ${expectedHeight}m`);
        console.log(`  - Applied scale: ${appliedScale.toFixed(6)}`);
        console.log(`  - Current scale: ${currentScale.toFixed(6)}`);
        console.log(`  - Scale diff: ${scaleDiff.toFixed(6)} (valid: ${scaleValid})`);

        // Calculate what the actual height should be based on scale
        // Base model is ~180.9cm, scale converts cm to target meters
        // actual = 180.9cm * scale = height in meters
        const calculatedHeight = 180.9 * currentScale;

        return {
            valid: scaleValid,
            expected: expectedHeight,
            actual: calculatedHeight,
            enemyType: enemy.typeKey,
            diff: Math.abs(calculatedHeight - expectedHeight),
            appliedScale,
            currentScale,
            reason: scaleValid ? 'Scale preserved correctly' : `Scale changed from ${appliedScale.toFixed(4)} to ${currentScale.toFixed(4)}`
        };
    }

    // Fallback to bounding box measurement if no scale data
    const actual = measureWorldHeight(enemy.gltfModel);
    const diff = Math.abs(actual - expectedHeight);

    console.log(`[Height Debug] ${enemy.typeKey} (bbox fallback):`);
    console.log(`  - Expected height: ${expectedHeight}m`);
    console.log(`  - Measured height: ${actual.toFixed(3)}m`);
    console.log(`  - Diff: ${diff.toFixed(3)}m (tolerance: ${HEIGHT_TOLERANCE}m)`);

    return {
        valid: diff <= HEIGHT_TOLERANCE,
        expected: expectedHeight,
        actual,
        enemyType: enemy.typeKey,
        diff,
        appliedScale: 'unknown',
        currentScale,
        reason: diff <= HEIGHT_TOLERANCE ? 'Height within tolerance' : `Height off by ${diff.toFixed(2)}m`
    };
}

/**
 * Verifies all enemies in an array and returns results
 * @param {Enemy[]} enemies - Array of enemies to verify
 * @returns {{results: object[], passed: number, failed: number, skipped: number}}
 */
export function verifyAllEnemies(enemies) {
    const results = [];
    let passed = 0;
    let failed = 0;
    let skipped = 0;

    for (const enemy of enemies) {
        if (enemy.isDead) continue;

        const result = verifyEnemyHeight(enemy);
        results.push(result);

        if (result.valid === null) {
            skipped++;
        } else if (result.valid) {
            passed++;
        } else {
            failed++;
        }
    }

    return { results, passed, failed, skipped };
}

/**
 * Logs verification results to console with formatting
 * @param {{results: object[], passed: number, failed: number, skipped: number}} verification
 */
export function logVerificationResults(verification) {
    console.log('=== Enemy Height Verification ===');
    console.log(`Passed: ${verification.passed}, Failed: ${verification.failed}, Skipped: ${verification.skipped}`);
    console.log('');

    for (const result of verification.results) {
        const status = result.valid === null ? 'SKIP' : (result.valid ? 'PASS' : 'FAIL');
        const statusColor = result.valid === null ? 'gray' : (result.valid ? 'green' : 'red');

        console.log(
            `%c${status}%c ${result.enemyType}: ` +
            `expected=${result.expected.toFixed(2)}m, ` +
            `actual=${result.actual.toFixed(2)}m ` +
            `(${result.reason})`,
            `color: ${statusColor}; font-weight: bold`,
            'color: inherit'
        );
    }

    console.log('=================================');
}

/**
 * Gets expected height for an enemy type
 * @param {string} enemyType - Enemy type key
 * @returns {number} Expected height in meters
 */
export function getExpectedHeight(enemyType) {
    return EXPECTED_HEIGHTS[enemyType] || 1.5;
}

/**
 * Gets all expected heights
 * @returns {object} Map of enemy type to expected height
 */
export function getExpectedHeights() {
    return { ...EXPECTED_HEIGHTS };
}

export { HEIGHT_TOLERANCE };
