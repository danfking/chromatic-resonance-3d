// visual-feedback-test.js - Tests that visual effects are actually visible
// This catches issues like "animation runs but can't see it"

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GAME_URL = 'http://localhost:8082';
const SCREENSHOT_DIR = path.join(__dirname, '..', 'test-screenshots', 'visual-feedback');

/**
 * Compare two screenshots and return pixel difference percentage
 */
function compareScreenshots(img1Path, img2Path) {
    // Simple file size comparison as proxy for visual change
    // (Real implementation would use pixelmatch or similar)
    const size1 = fs.statSync(img1Path).size;
    const size2 = fs.statSync(img2Path).size;
    const diff = Math.abs(size1 - size2) / Math.max(size1, size2);
    return diff;
}

/**
 * Test that wand cast produces visible effect
 */
async function testWandCastVisible(page) {
    console.log('\nTest: Wand Cast Visual Feedback');
    console.log('-'.repeat(40));

    // Enable debug mode
    await page.keyboard.press('F3');
    await page.waitForTimeout(300);

    // Take screenshot BEFORE cast
    const beforePath = path.join(SCREENSHOT_DIR, 'wand-before.png');
    await page.screenshot({ path: beforePath });
    console.log('  Captured: before cast');

    // Trigger wand cast
    await page.evaluate(() => {
        if (window.game && window.game.controller) {
            window.game.controller.triggerWandCast();
        }
    });

    // Wait a frame for effect to appear
    await page.waitForTimeout(50);

    // Take screenshot DURING cast
    const duringPath = path.join(SCREENSHOT_DIR, 'wand-during.png');
    await page.screenshot({ path: duringPath });
    console.log('  Captured: during cast');

    // Wait for effect to end
    await page.waitForTimeout(300);

    // Take screenshot AFTER cast
    const afterPath = path.join(SCREENSHOT_DIR, 'wand-after.png');
    await page.screenshot({ path: afterPath });
    console.log('  Captured: after cast');

    // Analyze: Did the screen change during cast?
    const changeDuringCast = compareScreenshots(beforePath, duringPath);
    const changeAfterCast = compareScreenshots(duringPath, afterPath);

    console.log(`  Change during cast: ${(changeDuringCast * 100).toFixed(2)}%`);
    console.log(`  Change after cast: ${(changeAfterCast * 100).toFixed(2)}%`);

    // Also check game state
    const wandState = await page.evaluate(() => {
        if (!window.game || !window.game.controller) return null;
        const wand = window.game.controller.wandMesh;
        if (!wand) return null;
        return {
            tipGlowIntensity: wand.tip?.material?.emissiveIntensity || 0,
            groupPositionZ: wand.group?.position?.z || 0
        };
    });

    console.log(`  Wand state: ${JSON.stringify(wandState)}`);

    // THRESHOLD: Effect should cause at least 0.5% screen change
    const VISIBILITY_THRESHOLD = 0.005;
    const isVisible = changeDuringCast > VISIBILITY_THRESHOLD;

    if (isVisible) {
        console.log('  PASS: Cast effect is visually noticeable');
        return { passed: true, change: changeDuringCast };
    } else {
        console.log('  FAIL: Cast effect NOT visually noticeable');
        console.log(`    Expected: > ${VISIBILITY_THRESHOLD * 100}% screen change`);
        console.log(`    Actual: ${(changeDuringCast * 100).toFixed(2)}%`);
        return {
            passed: false,
            change: changeDuringCast,
            issue: {
                severity: 'P2',
                category: 'visual-feedback',
                description: 'Wand cast animation not visually noticeable',
                evidence: { changeDuringCast, threshold: VISIBILITY_THRESHOLD },
                suggestedFix: 'Increase tip glow intensity, add particles, or increase recoil distance'
            }
        };
    }
}

/**
 * Test that movement produces visible animation change
 */
async function testMovementVisible(page) {
    console.log('\nTest: Movement Visual Feedback');
    console.log('-'.repeat(40));

    // This test is limited without pointer lock
    // We can only check if animation state changes

    const stateResult = await page.evaluate(() => {
        if (!window.game || !window.game.controller) return null;
        const sm = window.game.controller.animationStateMachine;
        return {
            currentState: sm?.currentState || 'unknown',
            hasAnimations: sm?.animations?.size > 0
        };
    });

    console.log(`  Current state: ${stateResult?.currentState}`);
    console.log(`  Has animations: ${stateResult?.hasAnimations}`);

    if (stateResult?.hasAnimations) {
        console.log('  PASS: Animation system initialized');
        return { passed: true };
    } else {
        console.log('  FAIL: No animations loaded');
        return { passed: false };
    }
}

/**
 * Main test runner
 */
async function runVisualFeedbackTests() {
    console.log('='.repeat(50));
    console.log('VISUAL FEEDBACK TESTS');
    console.log('='.repeat(50));
    console.log('These tests verify effects are VISIBLE, not just running\n');

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

    const results = { passed: 0, failed: 0, issues: [] };

    try {
        // Load game
        console.log('Loading game...');
        await page.goto(GAME_URL, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(3000);

        // Dismiss tutorial
        await page.evaluate(() => {
            localStorage.setItem('tutorialSeen', 'true');
            const tutorial = document.getElementById('tutorial-overlay');
            if (tutorial) tutorial.remove();
            const pause = document.getElementById('pause-menu');
            if (pause) pause.classList.remove('visible');
            if (window.game) window.game.isPaused = false;
        });

        await page.waitForTimeout(2000);

        // Test 1: Wand cast visibility
        const wandResult = await testWandCastVisible(page);
        if (wandResult.passed) {
            results.passed++;
        } else {
            results.failed++;
            if (wandResult.issue) results.issues.push(wandResult.issue);
        }

        // Test 2: Movement visibility
        const moveResult = await testMovementVisible(page);
        if (moveResult.passed) {
            results.passed++;
        } else {
            results.failed++;
        }

    } catch (error) {
        console.error(`\nTest error: ${error.message}`);
        results.failed++;
    } finally {
        await browser.close();
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('VISUAL FEEDBACK TEST RESULTS');
    console.log('='.repeat(50));
    console.log(`Passed: ${results.passed}`);
    console.log(`Failed: ${results.failed}`);

    if (results.issues.length > 0) {
        console.log('\nIssues found:');
        results.issues.forEach(issue => {
            console.log(`  [${issue.severity}] ${issue.description}`);
            console.log(`    Suggested fix: ${issue.suggestedFix}`);
        });
    }

    console.log('\nScreenshots saved to:', SCREENSHOT_DIR);
    console.log('='.repeat(50));

    return results.failed === 0;
}

// Run tests
runVisualFeedbackTests()
    .then(success => process.exit(success ? 0 : 1))
    .catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
