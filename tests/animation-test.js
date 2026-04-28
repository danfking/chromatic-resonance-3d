// animation-test.js - Automated animation verification tests
// Tests bone positions, animation states, and skeletal integrity
// Run with: node tests/animation-test.js

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GAME_URL = 'http://localhost:8082';
const SCREENSHOT_DIR = path.join(__dirname, '..', 'test-screenshots', 'animations');

// Bone integrity thresholds
const MAX_BONE_DISTANCE = 2.0;  // Max distance between connected bones (meters)
const MIN_BONE_DISTANCE = 0.01; // Min distance (bones shouldn't overlap exactly)

/**
 * Gets bone world positions from the player skeleton
 * @param {Page} page - Playwright page
 * @returns {Object} Bone positions and integrity data
 */
async function getBonePositions(page) {
    return await page.evaluate(() => {
        if (!window.game || !window.game.controller) {
            return { error: 'Game not available' };
        }

        const controller = window.game.controller;

        // Find skeleton from GLTF model directly (more robust than armIK reference)
        let skeleton = null;
        if (controller.gltfModel) {
            controller.gltfModel.traverse((child) => {
                if (child.isSkinnedMesh && child.skeleton) {
                    skeleton = child.skeleton;
                }
            });
        }

        // Fallback to armIK if available
        if (!skeleton && controller.armIK && controller.armIK.skeleton) {
            skeleton = controller.armIK.skeleton;
        }

        if (!skeleton) {
            return { error: 'No skeleton found in player model' };
        }

        // Get world positions of key bones
        const boneData = {};

        skeleton.bones.forEach(bone => {
            // Get world position using bone's matrixWorld
            // This avoids needing THREE.Vector3 constructor
            bone.updateWorldMatrix(true, false);
            const m = bone.matrixWorld.elements;
            const worldPos = { x: m[12], y: m[13], z: m[14] };

            // Store with simplified name (remove mixamorig prefix)
            const simpleName = bone.name.replace('mixamorig', '');
            boneData[simpleName] = {
                name: bone.name,
                worldPosition: worldPos,
                parent: bone.parent ? bone.parent.name : null
            };
        });

        return {
            timestamp: performance.now(),
            boneCount: skeleton.bones.length,
            bones: boneData
        };
    });
}

/**
 * Checks if arm bones are properly connected (not separated)
 * @param {Object} boneData - Bone position data
 * @returns {Object} Integrity check results
 */
function checkArmIntegrity(boneData) {
    const results = { valid: true, issues: [] };

    if (!boneData.bones) {
        return { valid: false, issues: ['No bone data available'] };
    }

    // Right arm chain: Shoulder -> Arm -> ForeArm -> Hand
    const rightArmChain = ['RightShoulder', 'RightArm', 'RightForeArm', 'RightHand'];

    for (let i = 0; i < rightArmChain.length - 1; i++) {
        const parentName = rightArmChain[i];
        const childName = rightArmChain[i + 1];

        const parent = boneData.bones[parentName];
        const child = boneData.bones[childName];

        if (!parent || !child) {
            results.issues.push(`Missing bone: ${!parent ? parentName : childName}`);
            continue;
        }

        // Calculate distance between bones
        const dx = child.worldPosition.x - parent.worldPosition.x;
        const dy = child.worldPosition.y - parent.worldPosition.y;
        const dz = child.worldPosition.z - parent.worldPosition.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (distance > MAX_BONE_DISTANCE) {
            results.valid = false;
            results.issues.push(
                `DISCONNECTED: ${parentName} -> ${childName} = ${distance.toFixed(3)}m (max: ${MAX_BONE_DISTANCE}m)`
            );
        } else if (distance < MIN_BONE_DISTANCE) {
            results.issues.push(
                `WARNING: ${parentName} -> ${childName} very close = ${distance.toFixed(3)}m`
            );
        }
    }

    return results;
}

/**
 * Captures bone positions over multiple frames during animation
 * @param {Page} page - Playwright page
 * @param {number} frames - Number of frames to capture
 * @param {number} intervalMs - Milliseconds between captures
 * @returns {Array} Array of bone position snapshots
 */
async function captureAnimationFrames(page, frames = 30, intervalMs = 50) {
    const snapshots = [];

    for (let i = 0; i < frames; i++) {
        const boneData = await getBonePositions(page);
        boneData.frame = i;
        snapshots.push(boneData);
        await page.waitForTimeout(intervalMs);
    }

    return snapshots;
}

/**
 * Tests wand cast animation for bone integrity
 */
async function testWandCastAnimation(page) {
    console.log('\nTest: Wand Cast Animation Bone Integrity');
    console.log('-'.repeat(40));

    // Capture pre-cast state
    console.log('  Capturing idle state...');
    const idleState = await getBonePositions(page);
    const idleCheck = checkArmIntegrity(idleState);

    if (!idleCheck.valid) {
        console.log('  FAIL: Arm disconnected in idle state');
        idleCheck.issues.forEach(i => console.log(`    - ${i}`));
        return { passed: false, phase: 'idle', issues: idleCheck.issues };
    }
    console.log('  PASS: Idle state OK');

    // Trigger wand cast via evaluate (simulating ability use)
    console.log('  Triggering wand cast...');
    await page.evaluate(() => {
        if (window.game && window.game.controller) {
            window.game.controller.triggerWandCast();
        }
    });

    // Capture frames during cast animation
    console.log('  Capturing cast animation frames...');
    const castFrames = await captureAnimationFrames(page, 20, 30);

    // Check each frame for integrity
    let worstFrame = null;
    let worstIssues = [];

    for (const frame of castFrames) {
        const check = checkArmIntegrity(frame);
        if (!check.valid) {
            if (!worstFrame || check.issues.length > worstIssues.length) {
                worstFrame = frame.frame;
                worstIssues = check.issues;
            }
        }
    }

    if (worstFrame !== null) {
        console.log(`  FAIL: Arm disconnected during cast (frame ${worstFrame})`);
        worstIssues.forEach(i => console.log(`    - ${i}`));
        return { passed: false, phase: 'cast', frame: worstFrame, issues: worstIssues };
    }

    console.log('  PASS: Cast animation OK');

    // Wait for recovery and check post-cast state
    await page.waitForTimeout(500);
    console.log('  Checking post-cast state...');
    const postState = await getBonePositions(page);
    const postCheck = checkArmIntegrity(postState);

    if (!postCheck.valid) {
        console.log('  FAIL: Arm disconnected after cast');
        postCheck.issues.forEach(i => console.log(`    - ${i}`));
        return { passed: false, phase: 'post-cast', issues: postCheck.issues };
    }
    console.log('  PASS: Post-cast state OK');

    return { passed: true };
}

/**
 * Tests animation state machine transitions
 */
async function testAnimationTransitions(page) {
    console.log('\nTest: Animation State Transitions');
    console.log('-'.repeat(40));

    const results = { passed: 0, failed: 0, transitions: [] };

    // Test transitions: idle -> walk -> run -> idle
    const transitions = [
        { action: 'none', expected: 'idle', duration: 500 },
        { action: 'walk', expected: 'walk', duration: 1000 },
        { action: 'run', expected: 'run', duration: 1000 },
        { action: 'stop', expected: 'idle', duration: 500 }
    ];

    for (const transition of transitions) {
        console.log(`  Testing: ${transition.action} -> ${transition.expected}`);

        // Apply movement input
        if (transition.action === 'walk') {
            await page.keyboard.down('w');
        } else if (transition.action === 'run') {
            await page.keyboard.down('w');
            await page.keyboard.down('Shift');
        } else if (transition.action === 'stop') {
            await page.keyboard.up('w');
            await page.keyboard.up('Shift');
        }

        await page.waitForTimeout(transition.duration);

        // Check animation state
        const state = await page.evaluate(() => {
            if (!window.game || !window.game.controller) return null;
            const sm = window.game.controller.animationStateMachine;
            return sm ? sm.currentState : null;
        });

        // Check bone integrity during this state
        const boneData = await getBonePositions(page);
        const integrity = checkArmIntegrity(boneData);

        const transitionResult = {
            action: transition.action,
            expected: transition.expected,
            actual: state,
            stateMatch: state === transition.expected || state?.includes(transition.expected),
            boneIntegrity: integrity.valid
        };

        results.transitions.push(transitionResult);

        if (transitionResult.stateMatch && transitionResult.boneIntegrity) {
            results.passed++;
            console.log(`    PASS: State=${state}, Bones OK`);
        } else {
            results.failed++;
            console.log(`    FAIL: State=${state} (expected ${transition.expected}), Bones=${integrity.valid ? 'OK' : 'BROKEN'}`);
            if (!integrity.valid) {
                integrity.issues.forEach(i => console.log(`      - ${i}`));
            }
        }
    }

    // Clean up - release all keys
    await page.keyboard.up('w');
    await page.keyboard.up('Shift');

    return results;
}

/**
 * Main test runner
 */
async function runAnimationTests() {
    console.log('='.repeat(50));
    console.log('ANIMATION INTEGRITY TESTS');
    console.log('='.repeat(50));

    // Ensure screenshot directory exists
    if (!fs.existsSync(SCREENSHOT_DIR)) {
        fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();

    // Disable pointer lock (prevents grabbing user's mouse during headless runs)
    await page.addInitScript(() => {
        Element.prototype.requestPointerLock = function() {};
        Document.prototype.exitPointerLock = function() {};
        Object.defineProperty(Document.prototype, 'pointerLockElement', { get: () => null });
    });

    const results = {
        passed: 0,
        failed: 0,
        tests: []
    };

    try {
        // Load game
        console.log('\nLoading game...');
        await page.goto(GAME_URL, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(3000);

        // Hide tutorial
        await page.evaluate(() => {
            localStorage.setItem('tutorialSeen', 'true');
            const tutorial = document.getElementById('tutorial-overlay');
            if (tutorial) tutorial.remove();
        });

        // Wait for player model to load (GLTF models are async)
        console.log('Waiting for player model to load...');
        await page.waitForTimeout(3000);

        // Enable debug mode (F3) to expose window.game
        console.log('Enabling debug mode...');
        await page.keyboard.press('F3');
        await page.waitForTimeout(500);

        // Debug: Check what's available
        const debugInfo = await page.evaluate(() => {
            if (!window.game) return { error: 'No game object' };
            if (!window.game.controller) return { error: 'No controller' };

            const c = window.game.controller;
            const info = {
                hasGLTFModel: !!c.gltfModel,
                hasCharacter: !!c.character,
                hasArmIK: !!c.armIK,
                armIKInitialized: c.armIK ? c.armIK.initialized : false
            };

            // Try to find skeleton
            if (c.gltfModel) {
                let skeletonFound = false;
                c.gltfModel.traverse((child) => {
                    if (child.isSkinnedMesh && child.skeleton) {
                        skeletonFound = true;
                        info.skeletonBoneCount = child.skeleton.bones.length;
                        info.sampleBones = child.skeleton.bones.slice(0, 5).map(b => b.name);
                    }
                });
                info.skeletonFound = skeletonFound;
            }

            return info;
        });
        console.log('Debug info:', JSON.stringify(debugInfo, null, 2));

        // Take initial screenshot
        await page.screenshot({
            path: path.join(SCREENSHOT_DIR, 'animation-test-start.png')
        });

        // Test 1: Wand cast animation
        const castResult = await testWandCastAnimation(page);
        results.tests.push({ name: 'Wand Cast Animation', ...castResult });
        if (castResult.passed) results.passed++; else results.failed++;

        // Screenshot after cast test
        await page.screenshot({
            path: path.join(SCREENSHOT_DIR, 'animation-test-after-cast.png')
        });

        // Test 2: Animation state transitions
        // Note: This test requires pointer lock which doesn't work in headless
        // We can only test partial functionality
        console.log('\n(Skipping movement transition tests - requires pointer lock)');

        // Test 3: Check bone integrity at rest
        console.log('\nTest: Idle Bone Integrity');
        console.log('-'.repeat(40));
        const idleBones = await getBonePositions(page);
        const idleIntegrity = checkArmIntegrity(idleBones);

        if (idleIntegrity.valid) {
            console.log('  PASS: All arm bones connected');
            results.passed++;
            results.tests.push({ name: 'Idle Bone Integrity', passed: true });
        } else {
            console.log('  FAIL: Arm bones disconnected');
            idleIntegrity.issues.forEach(i => console.log(`    - ${i}`));
            results.failed++;
            results.tests.push({ name: 'Idle Bone Integrity', passed: false, issues: idleIntegrity.issues });
        }

        // Final screenshot
        await page.screenshot({
            path: path.join(SCREENSHOT_DIR, 'animation-test-final.png')
        });

    } catch (error) {
        console.error(`\nTest execution error: ${error.message}`);
        results.failed++;
        results.tests.push({ name: 'Execution', passed: false, error: error.message });
    } finally {
        await browser.close();
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('ANIMATION TEST RESULTS');
    console.log('='.repeat(50));
    console.log(`Passed: ${results.passed}`);
    console.log(`Failed: ${results.failed}`);
    console.log(`Total:  ${results.passed + results.failed}`);
    console.log('\nScreenshots saved to:', SCREENSHOT_DIR);
    console.log('='.repeat(50));

    const success = results.failed === 0;
    console.log(`\n${success ? 'ALL ANIMATION TESTS PASSED' : 'SOME ANIMATION TESTS FAILED'}`);

    return success;
}

// Run tests
runAnimationTests()
    .then(success => process.exit(success ? 0 : 1))
    .catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });

export {
    getBonePositions,
    checkArmIntegrity,
    captureAnimationFrames,
    testWandCastAnimation,
    runAnimationTests
};
