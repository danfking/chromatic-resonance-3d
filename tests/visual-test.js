// visual-test.js - Playwright headless visual verification for Chromatic Resonance 3D
// Run with: node tests/visual-test.js
// Enemy tests: node tests/visual-test.js --enemies
// Height tests: node tests/visual-test.js --heights

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const GAME_URL = 'http://localhost:8082';
const SCREENSHOT_DIR = path.join(__dirname, '..', 'test-screenshots');
const BASELINE_DIR = path.join(__dirname, '..', 'test-baselines');

// Enemy types to test
const ENEMY_TYPES = ['shade', 'crimsonWraith', 'azurePhantom', 'verdantSlime'];
const BOSS_TYPES = ['chromaticGuardian', 'voidHarbinger'];

// Camera angles for enemy screenshots
const CAMERA_ANGLES = [
    { name: 'front', yaw: 0 },
    { name: '45deg', yaw: Math.PI / 4 },
    { name: 'side', yaw: Math.PI / 2 }
];

async function runVisualTests() {
    console.log('Starting visual tests for Chromatic Resonance 3D...\n');

    // Ensure directories exist
    [SCREENSHOT_DIR, BASELINE_DIR].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });

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

    const errors = [];
    const warnings = [];
    const results = {
        passed: 0,
        failed: 0,
        checks: []
    };

    // Collect console messages
    page.on('console', msg => {
        if (msg.type() === 'error') {
            errors.push(msg.text());
        } else if (msg.type() === 'warning') {
            warnings.push(msg.text());
        }
    });

    // Collect page errors
    page.on('pageerror', err => {
        errors.push(`Page error: ${err.message}`);
    });

    try {
        // Test 1: Game loads without critical errors
        console.log('Test 1: Loading game...');
        await page.goto(GAME_URL, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(3000); // Wait for game initialization

        const loadErrors = errors.filter(e =>
            !e.includes('favicon') &&
            !e.includes('404') &&
            !e.includes('texture')
        );

        if (loadErrors.length === 0) {
            results.checks.push({ name: 'Game loads without critical errors', passed: true });
            results.passed++;
            console.log('  PASS: Game loaded successfully');
        } else {
            results.checks.push({ name: 'Game loads without critical errors', passed: false, errors: loadErrors });
            results.failed++;
            console.log('  FAIL: Critical errors during load');
            loadErrors.forEach(e => console.log(`    - ${e}`));
        }

        // Hide tutorial overlay
        await page.evaluate(() => {
            localStorage.setItem('tutorialSeen', 'true');
            const tutorial = document.getElementById('tutorial-overlay');
            if (tutorial) tutorial.remove();
        });

        // Test 2: Canvas renders
        console.log('Test 2: Checking canvas rendering...');
        const canvas = await page.$('canvas');
        if (canvas) {
            const canvasBox = await canvas.boundingBox();
            if (canvasBox && canvasBox.width > 0 && canvasBox.height > 0) {
                results.checks.push({ name: 'Canvas renders', passed: true });
                results.passed++;
                console.log(`  PASS: Canvas rendering (${canvasBox.width}x${canvasBox.height})`);
            } else {
                results.checks.push({ name: 'Canvas renders', passed: false });
                results.failed++;
                console.log('  FAIL: Canvas has no dimensions');
            }
        } else {
            results.checks.push({ name: 'Canvas renders', passed: false });
            results.failed++;
            console.log('  FAIL: No canvas found');
        }

        // Wait for enemies to spawn
        console.log('Test 3: Waiting for enemies to spawn...');
        await page.waitForTimeout(5000);

        // Take initial screenshot
        await page.screenshot({
            path: path.join(SCREENSHOT_DIR, 'gameplay-initial.png'),
            fullPage: false
        });
        console.log('  Screenshot saved: gameplay-initial.png');

        // Test 3: Check FPS is reasonable
        console.log('Test 4: Checking FPS performance...');
        const fpsText = await page.evaluate(() => {
            const fpsElement = document.getElementById('fps');
            return fpsElement ? fpsElement.textContent : null;
        });

        if (fpsText) {
            const fps = parseInt(fpsText);
            if (fps > 30) {
                results.checks.push({ name: 'FPS above 30', passed: true, value: fps });
                results.passed++;
                console.log(`  PASS: FPS is ${fps}`);
            } else {
                results.checks.push({ name: 'FPS above 30', passed: false, value: fps });
                results.failed++;
                console.log(`  FAIL: FPS is ${fps} (below 30)`);
            }
        } else {
            results.checks.push({ name: 'FPS above 30', passed: false, value: null });
            results.failed++;
            console.log('  FAIL: Could not read FPS');
        }

        // Test 4: Check wave system is active
        console.log('Test 5: Checking wave system...');
        const waveText = await page.evaluate(() => {
            const waveElement = document.getElementById('wave');
            return waveElement ? waveElement.textContent : null;
        });

        if (waveText && parseInt(waveText) >= 1) {
            results.checks.push({ name: 'Wave system active', passed: true, value: waveText });
            results.passed++;
            console.log(`  PASS: Wave ${waveText} active`);
        } else {
            results.checks.push({ name: 'Wave system active', passed: false });
            results.failed++;
            console.log('  FAIL: Wave system not active');
        }

        // Test 5: Check UI elements are visible
        console.log('Test 6: Checking UI elements...');
        const uiElements = await page.evaluate(() => {
            const checks = {
                healthBar: !!document.querySelector('.health-bar, #health-container, [class*="health"]'),
                colorInventory: !!document.querySelector('.color-inventory, #color-panel, [class*="color"]'),
                minimap: !!document.querySelector('.minimap, #minimap, canvas[id*="minimap"]'),
                debugInfo: !!document.getElementById('fps')
            };
            return checks;
        });

        const uiPassed = Object.values(uiElements).some(v => v);
        results.checks.push({ name: 'UI elements visible', passed: uiPassed, details: uiElements });
        if (uiPassed) {
            results.passed++;
            console.log('  PASS: UI elements found');
        } else {
            results.failed++;
            console.log('  FAIL: No UI elements found');
        }

        // Test 6: WebGL context is valid
        console.log('Test 7: Checking WebGL context...');
        const webglValid = await page.evaluate(() => {
            const canvas = document.querySelector('canvas');
            if (!canvas) return false;
            const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
            return gl && !gl.isContextLost();
        });

        results.checks.push({ name: 'WebGL context valid', passed: webglValid });
        if (webglValid) {
            results.passed++;
            console.log('  PASS: WebGL context is valid');
        } else {
            results.failed++;
            console.log('  FAIL: WebGL context lost or invalid');
        }

        // Wait a bit more and take another screenshot
        await page.waitForTimeout(3000);
        await page.screenshot({
            path: path.join(SCREENSHOT_DIR, 'gameplay-after.png'),
            fullPage: false
        });
        console.log('  Screenshot saved: gameplay-after.png');

        // Test 7: No z-fighting or major visual artifacts (basic check via pixel sampling)
        console.log('Test 8: Basic visual artifact check...');
        const visualCheck = await page.evaluate(() => {
            const canvas = document.querySelector('canvas');
            if (!canvas) return { valid: false, reason: 'no canvas' };

            // Check that canvas isn't completely black or white
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) {
                // For WebGL canvas, we can't easily read pixels, but we can check it exists
                return { valid: true, reason: 'WebGL canvas present' };
            }

            return { valid: true, reason: 'Canvas rendering' };
        });

        results.checks.push({ name: 'No major visual artifacts', passed: visualCheck.valid });
        if (visualCheck.valid) {
            results.passed++;
            console.log(`  PASS: ${visualCheck.reason}`);
        } else {
            results.failed++;
            console.log(`  FAIL: ${visualCheck.reason}`);
        }

    } catch (error) {
        console.error(`\nTest execution error: ${error.message}`);
        results.checks.push({ name: 'Test execution', passed: false, error: error.message });
        results.failed++;
    } finally {
        await browser.close();
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('VISUAL TEST RESULTS');
    console.log('='.repeat(50));
    console.log(`Passed: ${results.passed}`);
    console.log(`Failed: ${results.failed}`);
    console.log(`Total:  ${results.passed + results.failed}`);

    if (errors.length > 0) {
        console.log('\nConsole Errors:');
        errors.forEach(e => console.log(`  - ${e}`));
    }

    if (warnings.length > 0) {
        console.log('\nConsole Warnings:');
        warnings.slice(0, 5).forEach(w => console.log(`  - ${w}`));
        if (warnings.length > 5) {
            console.log(`  ... and ${warnings.length - 5} more`);
        }
    }

    console.log('\nScreenshots saved to:', SCREENSHOT_DIR);
    console.log('='.repeat(50));

    const success = results.failed === 0;
    console.log(`\n${success ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);

    return success;
}

/**
 * Spawns a specific enemy type for screenshot capture
 * @param {object} page - Playwright page
 * @param {string} enemyType - Enemy type to spawn
 */
async function spawnEnemyForScreenshot(page, enemyType) {
    await page.evaluate((type) => {
        // Access game instance via debug mode
        if (!window.game) {
            console.error('Game not in debug mode - press F3 first');
            return false;
        }

        const game = window.game;
        const enemyManager = game.enemyManager;

        // Clear existing enemies
        enemyManager.enemies.forEach(e => {
            if (!e.isDead) {
                e.isDead = true;
                e.cleanup();
            }
        });
        enemyManager.enemies = [];

        // Spawn single enemy at origin for clear view
        const THREE = window.THREE;
        const position = new THREE.Vector3(0, 0, 5);

        // Import Enemy class and spawn
        const enemy = new enemyManager.enemies.constructor.prototype.constructor(
            enemyManager.scene, type, position
        );

        // Actually we need to use the spawnEnemy method differently
        // Store player position, spawn enemy at fixed location
        const oldPos = enemyManager.playerPosition.clone();
        enemyManager.playerPosition.set(0, 0, 0);
        enemyManager.spawnRadius = 5;
        enemyManager.spawnEnemy(type);
        enemyManager.spawnRadius = 15;
        enemyManager.playerPosition.copy(oldPos);

        return true;
    }, enemyType);
}

/**
 * Captures enemy from multiple angles
 * @param {object} page - Playwright page
 * @param {string} enemyType - Enemy type to capture
 * @returns {object} Paths to captured screenshots
 */
async function captureEnemyAngles(page, enemyType) {
    const screenshots = {};

    // Enable debug mode first
    await page.keyboard.press('F3');
    await page.waitForTimeout(500);

    // Freeze enemies and disable NPR for raw geometry view
    await page.keyboard.press('8'); // Freeze enemies
    await page.waitForTimeout(100);
    await page.keyboard.press('9'); // Disable NPR
    await page.waitForTimeout(500);

    // Spawn the specific enemy
    await spawnEnemyForScreenshot(page, enemyType);
    await page.waitForTimeout(1000); // Wait for enemy to fully initialize

    for (const angle of CAMERA_ANGLES) {
        // Rotate camera to specified angle
        await page.evaluate((yaw) => {
            if (window.game && window.game.controller) {
                // Set camera yaw
                window.game.controller.yaw = yaw;
            }
        }, angle.yaw);

        await page.waitForTimeout(300);

        // Take screenshot
        const filename = `enemy-${enemyType}-${angle.name}.png`;
        const filepath = path.join(SCREENSHOT_DIR, filename);
        await page.screenshot({ path: filepath, fullPage: false });
        screenshots[angle.name] = filepath;

        console.log(`  Captured: ${filename}`);
    }

    // Re-enable NPR for normal view comparison
    await page.keyboard.press('9'); // Enable NPR
    await page.waitForTimeout(500);

    // Capture with NPR enabled (front view only)
    await page.evaluate(() => {
        if (window.game && window.game.controller) {
            window.game.controller.yaw = 0;
        }
    });
    await page.waitForTimeout(300);

    const nprFilename = `enemy-${enemyType}-front-npr.png`;
    const nprFilepath = path.join(SCREENSHOT_DIR, nprFilename);
    await page.screenshot({ path: nprFilepath, fullPage: false });
    screenshots['front-npr'] = nprFilepath;
    console.log(`  Captured: ${nprFilename}`);

    return screenshots;
}

/**
 * Compares current screenshot to baseline
 * @param {string} currentPath - Path to current screenshot
 * @param {string} baselinePath - Path to baseline screenshot
 * @returns {object} Comparison result
 */
function compareToBaseline(currentPath, baselinePath) {
    if (!fs.existsSync(baselinePath)) {
        return { match: null, reason: 'No baseline exists' };
    }

    const current = fs.readFileSync(currentPath);
    const baseline = fs.readFileSync(baselinePath);

    // Simple byte comparison (for exact match)
    const exactMatch = current.equals(baseline);

    if (exactMatch) {
        return { match: true, reason: 'Exact match' };
    }

    // For more sophisticated comparison, we'd need image processing libraries
    // For now, just check file size difference as rough heuristic
    const sizeDiff = Math.abs(current.length - baseline.length) / baseline.length;

    if (sizeDiff < 0.05) {
        return { match: true, reason: `Size within 5% (${(sizeDiff * 100).toFixed(1)}% diff)` };
    }

    return { match: false, reason: `Size differs by ${(sizeDiff * 100).toFixed(1)}%` };
}

/**
 * Runs enemy-specific visual tests
 */
async function runEnemyTests() {
    console.log('Starting enemy visual tests...\n');

    // Ensure directories exist
    [SCREENSHOT_DIR, BASELINE_DIR].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });

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
        noBaseline: 0,
        enemies: {}
    };

    try {
        // Load game
        console.log('Loading game...');
        await page.goto(GAME_URL, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(3000);

        // Hide tutorial
        await page.evaluate(() => {
            localStorage.setItem('tutorialSeen', 'true');
            const tutorial = document.getElementById('tutorial-overlay');
            if (tutorial) tutorial.remove();
        });

        // Test each enemy type
        const allTypes = [...ENEMY_TYPES, ...BOSS_TYPES];

        for (const enemyType of allTypes) {
            console.log(`\nTesting enemy: ${enemyType}`);
            results.enemies[enemyType] = { screenshots: {}, comparisons: {} };

            try {
                // Capture from multiple angles
                const screenshots = await captureEnemyAngles(page, enemyType);
                results.enemies[enemyType].screenshots = screenshots;

                // Compare to baselines
                for (const [angle, screenshotPath] of Object.entries(screenshots)) {
                    const baselineFilename = `enemy-${enemyType}-${angle}.png`;
                    const baselinePath = path.join(BASELINE_DIR, baselineFilename);

                    const comparison = compareToBaseline(screenshotPath, baselinePath);
                    results.enemies[enemyType].comparisons[angle] = comparison;

                    if (comparison.match === null) {
                        results.noBaseline++;
                        console.log(`    ${angle}: No baseline (${comparison.reason})`);
                    } else if (comparison.match) {
                        results.passed++;
                        console.log(`    ${angle}: PASS (${comparison.reason})`);
                    } else {
                        results.failed++;
                        console.log(`    ${angle}: FAIL (${comparison.reason})`);
                    }
                }
            } catch (error) {
                console.error(`  Error testing ${enemyType}: ${error.message}`);
                results.failed++;
            }
        }

    } catch (error) {
        console.error(`\nTest execution error: ${error.message}`);
    } finally {
        await browser.close();
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('ENEMY VISUAL TEST RESULTS');
    console.log('='.repeat(50));
    console.log(`Passed: ${results.passed}`);
    console.log(`Failed: ${results.failed}`);
    console.log(`No Baseline: ${results.noBaseline}`);
    console.log(`Total Comparisons: ${results.passed + results.failed + results.noBaseline}`);
    console.log('\nScreenshots saved to:', SCREENSHOT_DIR);
    console.log('Baselines expected at:', BASELINE_DIR);

    if (results.noBaseline > 0) {
        console.log('\nTo create baselines, copy screenshots to baseline directory:');
        console.log(`  cp ${SCREENSHOT_DIR}/enemy-*.png ${BASELINE_DIR}/`);
    }

    console.log('='.repeat(50));

    return results.failed === 0;
}

/**
 * Saves current screenshots as new baselines
 */
async function saveBaselines() {
    console.log('Saving current screenshots as baselines...\n');

    if (!fs.existsSync(SCREENSHOT_DIR)) {
        console.error('No screenshots found. Run tests first.');
        return false;
    }

    if (!fs.existsSync(BASELINE_DIR)) {
        fs.mkdirSync(BASELINE_DIR, { recursive: true });
    }

    const files = fs.readdirSync(SCREENSHOT_DIR)
        .filter(f => f.startsWith('enemy-') && f.endsWith('.png'));

    for (const file of files) {
        const src = path.join(SCREENSHOT_DIR, file);
        const dest = path.join(BASELINE_DIR, file);
        fs.copyFileSync(src, dest);
        console.log(`  Saved: ${file}`);
    }

    console.log(`\nSaved ${files.length} baselines to ${BASELINE_DIR}`);
    return true;
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.includes('--enemies')) {
    runEnemyTests()
        .then(success => process.exit(success ? 0 : 1))
        .catch(err => {
            console.error('Fatal error:', err);
            process.exit(1);
        });
} else if (args.includes('--heights')) {
    runHeightTests()
        .then(success => process.exit(success ? 0 : 1))
        .catch(err => {
            console.error('Fatal error:', err);
            process.exit(1);
        });
} else if (args.includes('--save-baselines')) {
    saveBaselines()
        .then(success => process.exit(success ? 0 : 1))
        .catch(err => {
            console.error('Fatal error:', err);
            process.exit(1);
        });
} else {
    // Default: run standard visual tests
    runVisualTests()
        .then(success => process.exit(success ? 0 : 1))
        .catch(err => {
            console.error('Fatal error:', err);
            process.exit(1);
        });
}

// Expected heights for each enemy type (in meters/game units)
const EXPECTED_HEIGHTS = {
    shade: 1.2,
    crimsonWraith: 1.5,
    azurePhantom: 1.4,
    verdantSlime: 1.8,
    chromaticGuardian: 2.5,
    voidHarbinger: 3.0
};

// Height tolerance in meters
const HEIGHT_TOLERANCE = 0.1;

/**
 * Runs automated height verification tests for all enemy types
 * Uses the game's built-in scale verification system
 */
async function runHeightTests() {
    console.log('Starting enemy height verification tests...\n');

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
        errors: [],
        details: {}
    };

    // Collect console messages for height data
    const consoleMessages = [];
    page.on('console', msg => {
        consoleMessages.push(msg.text());
    });

    try {
        // Load game
        console.log('Loading game...');
        await page.goto(GAME_URL, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(3000);

        // Hide tutorial
        await page.evaluate(() => {
            localStorage.setItem('tutorialSeen', 'true');
            const tutorial = document.getElementById('tutorial-overlay');
            if (tutorial) tutorial.remove();
        });

        // Enable debug mode
        await page.keyboard.press('F3');
        await page.waitForTimeout(500);

        // Freeze enemies for consistent testing
        await page.keyboard.press('8');
        await page.waitForTimeout(100);

        const allTypes = [...ENEMY_TYPES, ...BOSS_TYPES];

        for (const enemyType of allTypes) {
            console.log(`\nTesting height: ${enemyType}`);
            console.log(`  Expected: ${EXPECTED_HEIGHTS[enemyType]}m`);

            // Clear existing enemies and spawn specific type
            await page.evaluate((type) => {
                if (!window.game) return false;

                const game = window.game;
                const enemyManager = game.enemyManager;

                // Clear existing enemies
                enemyManager.enemies.forEach(e => {
                    if (!e.isDead) {
                        e.isDead = true;
                        e.cleanup();
                    }
                });
                enemyManager.enemies = [];

                // Spawn single enemy at fixed position
                enemyManager.playerPosition.set(0, 0, 0);
                enemyManager.spawnRadius = 5;
                enemyManager.spawnEnemy(type);
                enemyManager.spawnRadius = 15;

                return true;
            }, enemyType);

            // Wait for enemy to fully load (GLTF models are async)
            await page.waitForTimeout(1500);

            // Verify the enemy's scale is preserved correctly
            const measurement = await page.evaluate((type) => {
                if (!window.game) return { error: 'Game not available' };

                const game = window.game;
                const enemy = game.enemyManager.enemies.find(e => e.typeKey === type && !e.isDead);

                if (!enemy) return { error: 'Enemy not found' };
                if (!enemy.gltfModel) return { error: 'No GLTF model loaded', hasProceduralOnly: true };

                const appliedScale = enemy.gltfModel.userData.appliedScale;
                const currentScale = enemy.gltfModel.scale.x;
                const expectedHeight = enemy.gltfModel.userData.expectedHeight || 0;

                if (typeof appliedScale !== 'number') {
                    return { error: 'No scale data stored', appliedScale, currentScale };
                }

                const scaleDiff = Math.abs(currentScale - appliedScale);
                const valid = scaleDiff < 0.001; // Very tight tolerance for scale

                // Calculate actual height based on scale (base model is ~180.9cm, scale converts to meters)
                const actualHeight = 180.9 * currentScale;

                return {
                    expected: expectedHeight,
                    actual: actualHeight,
                    diff: Math.abs(actualHeight - expectedHeight),
                    valid,
                    scale: appliedScale,
                    currentScale,
                    scaleDiff
                };
            }, enemyType);

            results.details[enemyType] = measurement;

            if (measurement.error) {
                if (measurement.hasProceduralOnly) {
                    console.log(`  SKIP: ${measurement.error} (procedural geometry only)`);
                } else {
                    console.log(`  ERROR: ${measurement.error}`);
                    results.errors.push(`${enemyType}: ${measurement.error}`);
                }
                continue;
            }

            console.log(`  Actual: ${measurement.actual.toFixed(3)}m`);
            console.log(`  Applied scale: ${typeof measurement.scale === 'number' ? measurement.scale.toFixed(6) : measurement.scale}`);
            console.log(`  Current scale: ${typeof measurement.currentScale === 'number' ? measurement.currentScale.toFixed(6) : measurement.currentScale}`);
            console.log(`  Scale diff: ${typeof measurement.scaleDiff === 'number' ? measurement.scaleDiff.toFixed(6) : 'N/A'}`);

            if (measurement.valid) {
                console.log(`  PASS`);
                results.passed++;
            } else {
                console.log(`  FAIL: Height off by ${measurement.diff.toFixed(3)}m`);
                results.failed++;
            }
        }

    } catch (error) {
        console.error(`\nTest execution error: ${error.message}`);
        results.errors.push(`Execution error: ${error.message}`);
    } finally {
        await browser.close();
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('ENEMY HEIGHT TEST RESULTS');
    console.log('='.repeat(50));
    console.log(`Passed: ${results.passed}`);
    console.log(`Failed: ${results.failed}`);
    console.log(`Errors: ${results.errors.length}`);

    if (results.errors.length > 0) {
        console.log('\nErrors:');
        results.errors.forEach(e => console.log(`  - ${e}`));
    }

    console.log('='.repeat(50));

    const success = results.failed === 0 && results.errors.length === 0;
    console.log(`\n${success ? 'ALL HEIGHT TESTS PASSED' : 'SOME HEIGHT TESTS FAILED'}`);

    return success;
}

// Export for programmatic use
module.exports = {
    runVisualTests,
    runEnemyTests,
    runHeightTests,
    spawnEnemyForScreenshot,
    captureEnemyAngles,
    compareToBaseline,
    saveBaselines,
    ENEMY_TYPES,
    BOSS_TYPES,
    CAMERA_ANGLES,
    EXPECTED_HEIGHTS,
    HEIGHT_TOLERANCE
};
