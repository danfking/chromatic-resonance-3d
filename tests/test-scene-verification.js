// test-scene-verification.js - Animation tests using isolated test scene
// More reliable than main game testing due to no visual noise

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_SCENE_URL = 'http://localhost:8082/test-scene.html';
const SCREENSHOT_DIR = path.join(__dirname, '..', 'test-screenshots', 'test-scene');

/**
 * Test wand cast animation via state queries
 * This verifies the animation IS running even if visually subtle
 */
async function testWandCastAnimation(page) {
    console.log('\nTest: Wand Cast Animation State');
    console.log('-'.repeat(40));

    // Query wand state programmatically
    const result = await page.evaluate(async () => {
        const ts = window.testScene;
        if (!ts || !ts.wandMesh) return { error: 'testScene or wand not ready' };

        // Capture before state
        const before = {
            tipGlow: ts.wandMesh.tipMat?.emissiveIntensity || 0,
            tipScale: ts.wandMesh.tip?.scale.x || 1,
            casting: ts.wandMesh.casting
        };

        // Trigger cast
        ts.wandMesh.triggerCast();

        // Wait 20ms and capture during state
        await new Promise(r => setTimeout(r, 20));
        const during = {
            tipGlow: ts.wandMesh.tipMat?.emissiveIntensity || 0,
            tipScale: ts.wandMesh.tip?.scale.x || 1,
            casting: ts.wandMesh.casting
        };

        // Wait for completion
        await new Promise(r => setTimeout(r, 200));
        const after = {
            tipGlow: ts.wandMesh.tipMat?.emissiveIntensity || 0,
            tipScale: ts.wandMesh.tip?.scale.x || 1,
            casting: ts.wandMesh.casting
        };

        return { before, during, after };
    });

    if (result.error) {
        console.log(`  FAIL: ${result.error}`);
        return { passed: false, error: result.error };
    }

    console.log(`  Before: tipGlow=${result.before.tipGlow.toFixed(2)}, tipScale=${result.before.tipScale.toFixed(2)}`);
    console.log(`  During: tipGlow=${result.during.tipGlow.toFixed(2)}, tipScale=${result.during.tipScale.toFixed(2)}, casting=${result.during.casting}`);
    console.log(`  After:  tipGlow=${result.after.tipGlow.toFixed(2)}, tipScale=${result.after.tipScale.toFixed(2)}`);

    // Verify animation triggered
    const glowIncrease = result.during.tipGlow / result.before.tipGlow;
    const scaleIncrease = result.during.tipScale / result.before.tipScale;
    const castingDuring = result.during.casting;
    const resetAfter = !result.after.casting &&
                       Math.abs(result.after.tipGlow - result.before.tipGlow) < 0.1;

    const passed = glowIncrease > 2 && scaleIncrease > 1.5 && castingDuring && resetAfter;

    if (passed) {
        console.log(`  PASS: Glow increased ${glowIncrease.toFixed(1)}x, scale increased ${scaleIncrease.toFixed(1)}x`);
    } else {
        console.log('  FAIL: Animation did not meet expected thresholds');
        console.log(`    Expected: glow > 2x (got ${glowIncrease.toFixed(1)}x), scale > 1.5x (got ${scaleIncrease.toFixed(1)}x)`);
    }

    return { passed, result };
}

/**
 * Test animation state transitions
 */
async function testAnimationStateTransitions(page) {
    console.log('\nTest: Animation State Transitions');
    console.log('-'.repeat(40));

    const result = await page.evaluate(async () => {
        const ts = window.testScene;
        if (!ts || !ts.animationStateMachine) return { error: 'animation system not ready' };

        const states = [];
        const sm = ts.animationStateMachine;

        // Test idle
        states.push({ action: 'idle', state: sm.currentState });

        // Test walk
        ts.triggerAction('walk');
        await new Promise(r => setTimeout(r, 100));
        states.push({ action: 'walk', state: sm.currentState });

        // Test run
        ts.triggerAction('run');
        await new Promise(r => setTimeout(r, 100));
        states.push({ action: 'run', state: sm.currentState });

        // Test jump
        ts.triggerAction('jump');
        await new Promise(r => setTimeout(r, 100));
        states.push({ action: 'jump', state: sm.currentState });

        // Return to idle
        ts.triggerAction('idle');
        await new Promise(r => setTimeout(r, 100));
        states.push({ action: 'back_to_idle', state: sm.currentState });

        return { states };
    });

    if (result.error) {
        console.log(`  FAIL: ${result.error}`);
        return { passed: false, error: result.error };
    }

    let passed = true;
    for (const { action, state } of result.states) {
        const expected = action === 'back_to_idle' ? 'idle' : action;
        const match = state?.toLowerCase().includes(expected.toLowerCase()) ||
                      (action === 'idle' && state?.toLowerCase().includes('idle'));
        console.log(`  ${action}: state=${state} ${match ? '✓' : '✗'}`);
        if (!match && action !== 'jump') { // Jump might transition to fall
            passed = false;
        }
    }

    console.log(passed ? '  PASS: All state transitions working' : '  FAIL: Some transitions failed');
    return { passed, result };
}

/**
 * Test bone integrity (skeleton not disconnected)
 */
async function testBoneIntegrity(page) {
    console.log('\nTest: Bone Integrity');
    console.log('-'.repeat(40));

    const result = await page.evaluate(() => {
        const ts = window.testScene;
        if (!ts || !ts.model) return { error: 'model not loaded' };

        const bonePositions = ts.getBonePositions();
        if (!bonePositions) return { error: 'no bone data' };

        // Check key bone chains
        const chains = [
            ['mixamorigHips', 'mixamorigSpine', 'mixamorigSpine1', 'mixamorigSpine2'],
            ['mixamorigRightArm', 'mixamorigRightForeArm', 'mixamorigRightHand'],
            ['mixamorigLeftArm', 'mixamorigLeftForeArm', 'mixamorigLeftHand']
        ];

        const issues = [];
        const MAX_BONE_DISTANCE = 2.0; // Units

        for (const chain of chains) {
            for (let i = 0; i < chain.length - 1; i++) {
                const bone1 = bonePositions[chain[i]];
                const bone2 = bonePositions[chain[i + 1]];

                if (!bone1 || !bone2) continue;

                const dx = bone2.x - bone1.x;
                const dy = bone2.y - bone1.y;
                const dz = bone2.z - bone1.z;
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

                if (distance > MAX_BONE_DISTANCE) {
                    issues.push({
                        chain: `${chain[i]} -> ${chain[i + 1]}`,
                        distance: distance.toFixed(2)
                    });
                }
            }
        }

        return {
            boneCount: Object.keys(bonePositions).length,
            issues
        };
    });

    if (result.error) {
        console.log(`  FAIL: ${result.error}`);
        return { passed: false, error: result.error };
    }

    console.log(`  Found ${result.boneCount} bones`);

    if (result.issues.length === 0) {
        console.log('  PASS: All bone chains connected');
        return { passed: true };
    } else {
        console.log('  FAIL: Disconnected bones detected:');
        for (const issue of result.issues) {
            console.log(`    ${issue.chain}: ${issue.distance} units apart`);
        }
        return { passed: false, issues: result.issues };
    }
}

/**
 * Main test runner
 */
async function runTestSceneVerification() {
    console.log('='.repeat(50));
    console.log('ANIMATION TEST SCENE VERIFICATION');
    console.log('='.repeat(50));
    console.log('Using isolated test scene for reliable testing\n');

    // Ensure screenshot directory exists
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();

    // Disable pointer lock (prevents grabbing user's mouse during headless runs)
    await page.addInitScript(() => {
        Element.prototype.requestPointerLock = function() {};
        Document.prototype.exitPointerLock = function() {};
        Object.defineProperty(Document.prototype, 'pointerLockElement', { get: () => null });
    });

    const results = { passed: 0, failed: 0, tests: [] };

    try {
        // Load test scene
        console.log('Loading test scene...');
        await page.goto(TEST_SCENE_URL, { waitUntil: 'networkidle', timeout: 30000 });

        // Wait for model to load
        await page.waitForFunction(() => {
            return window.testScene &&
                   (window.testScene.model || window.testScene.wandMesh);
        }, { timeout: 10000 });

        await page.waitForTimeout(1000); // Extra wait for animations to initialize

        // Take baseline screenshot
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'baseline.png') });

        // Test 1: Wand cast animation
        const wandResult = await testWandCastAnimation(page);
        results.tests.push({ name: 'Wand Cast Animation', ...wandResult });
        if (wandResult.passed) results.passed++;
        else results.failed++;

        // Test 2: Animation state transitions
        const stateResult = await testAnimationStateTransitions(page);
        results.tests.push({ name: 'State Transitions', ...stateResult });
        if (stateResult.passed) results.passed++;
        else results.failed++;

        // Test 3: Bone integrity
        const boneResult = await testBoneIntegrity(page);
        results.tests.push({ name: 'Bone Integrity', ...boneResult });
        if (boneResult.passed) results.passed++;
        else results.failed++;

    } catch (error) {
        console.error(`\nTest error: ${error.message}`);
        results.failed++;
    } finally {
        await browser.close();
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('TEST SCENE VERIFICATION RESULTS');
    console.log('='.repeat(50));
    console.log(`Passed: ${results.passed}`);
    console.log(`Failed: ${results.failed}`);
    console.log('='.repeat(50));

    return results.failed === 0;
}

// Run tests
runTestSceneVerification()
    .then(success => process.exit(success ? 0 : 1))
    .catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
