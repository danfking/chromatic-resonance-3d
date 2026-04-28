// ui-visibility-test.js - UI Visibility Smoke Test
// Verifies that UI elements are visible/hidden correctly in each game state.
// Run with: node tests/ui-visibility-test.js
// Or use the exported checks via Playwright MCP browser_evaluate in agent workflows.
//
// THIS TEST EXISTS because the alpha-build QA only tested state machine transitions
// via page.evaluate() and never checked what the player actually SEES on screen.
// It missed: #color-inventory, #ability-bar, #combo-display, #hud all visible
// during gameplay when they should be hidden by RunHUD.

import { chromium } from 'playwright';

// --- Element visibility definitions per game state ---
// These define what SHOULD be visible/hidden in each state.
// An agent running UI checks must verify these after every code change.

const LEGACY_ELEMENTS = [
    '#color-inventory',
    '#ability-bar',
    '#combo-display',
    '#wave-notification',
    '#hud',
    '#player-health',
    '#progression-ui',
    '#minimap',
    '#wand-hud',
    '#spell-menu',
    '#equipment-hud',
    '#equipment-panel',
    '#debug-info',
    '#crosshair',
    '#color-tooltip',
    '#controls-hint',
    '#floating-text-container',
    '#lore-overlay',
    '#boss-announcement',
    '#boss-health-bar',
    '#tutorial-overlay',
    '#game-over',
    '#game-over-screen',
    '#victory-screen',
    '#damage-overlay',
    '#style-lab-hud',
    '#npc-interact-prompt',
];

const STATE_EXPECTATIONS = {
    MENU: {
        visible: ['#main-menu'],
        hidden: ['#death-screen', '#victory-screen-rm', '#shop-overlay'],
        legacyHidden: true,
    },
    PLAYING: {
        visible: ['#run-gold'],
        hidden: ['#main-menu', '#death-screen', '#victory-screen-rm', '#shop-overlay', '#loading-overlay.hidden'],
        legacyHidden: true,
    },
    DEAD: {
        visible: ['#death-screen'],
        hidden: ['#main-menu', '#victory-screen-rm', '#shop-overlay'],
        legacyHidden: true,
    },
    VICTORY: {
        visible: ['#victory-screen-rm'],
        hidden: ['#main-menu', '#death-screen', '#shop-overlay'],
        legacyHidden: true,
    },
    SHOP: {
        visible: ['#shop-overlay'],
        hidden: ['#main-menu', '#death-screen', '#victory-screen-rm'],
        legacyHidden: true,
    },
};

/**
 * Check if a DOM element is effectively visible to the player.
 * Returns { exists, visible, display, opacity, reason }
 * This function is designed to run inside page.evaluate().
 */
function checkElementVisibility(selector) {
    const el = document.querySelector(selector);
    if (!el) return { exists: false, visible: false, reason: 'not in DOM' };

    const style = window.getComputedStyle(el);
    const display = style.display;
    const opacity = parseFloat(style.opacity);
    const visibility = style.visibility;

    // Check for .hidden class (used by loading overlay)
    const hasHiddenClass = el.classList.contains('hidden');

    // Check for .visible class absence (used by main-menu-screen)
    const needsVisibleClass = el.classList.contains('main-menu-screen') ||
                               el.className.includes('main-menu-screen');
    const hasVisibleClass = el.classList.contains('visible');

    const isHidden = display === 'none' ||
                     opacity === 0 ||
                     visibility === 'hidden' ||
                     hasHiddenClass;

    const isVisible = !isHidden && (!needsVisibleClass || hasVisibleClass);

    let reason = '';
    if (display === 'none') reason = 'display:none';
    else if (opacity === 0) reason = 'opacity:0';
    else if (visibility === 'hidden') reason = 'visibility:hidden';
    else if (hasHiddenClass) reason = 'has .hidden class';
    else if (needsVisibleClass && !hasVisibleClass) reason = 'missing .visible class';
    else reason = 'visible';

    return {
        exists: true,
        visible: isVisible,
        display,
        opacity,
        visibility,
        hasHiddenClass,
        hasVisibleClass,
        reason,
    };
}

/**
 * Run all UI visibility checks for the current game state.
 * Designed to be serialized and run inside page.evaluate().
 */
export function buildUICheckScript(expectedState) {
    const expectations = STATE_EXPECTATIONS[expectedState];
    if (!expectations) return null;

    // Return a function string that can be evaluated in the browser
    return `(() => {
        const results = { state: '${expectedState}', pass: true, checks: [] };

        function checkEl(selector) {
            const el = document.querySelector(selector);
            if (!el) return { exists: false, visible: false, reason: 'not in DOM' };
            const style = window.getComputedStyle(el);
            const display = style.display;
            const opacity = parseFloat(style.opacity);
            const visibility = style.visibility;
            const hasHiddenClass = el.classList.contains('hidden');
            const needsVisibleClass = el.className.includes('main-menu-screen');
            const hasVisibleClass = el.classList.contains('visible');
            const isHidden = display === 'none' || opacity === 0 || visibility === 'hidden' || hasHiddenClass;
            const isVisible = !isHidden && (!needsVisibleClass || hasVisibleClass);
            let reason = '';
            if (display === 'none') reason = 'display:none';
            else if (opacity === 0) reason = 'opacity:0';
            else if (visibility === 'hidden') reason = 'visibility:hidden';
            else if (hasHiddenClass) reason = 'has .hidden class';
            else if (needsVisibleClass && !hasVisibleClass) reason = 'missing .visible class';
            else reason = 'visible';
            return { exists: true, visible: isVisible, reason };
        }

        // Check elements that SHOULD be visible
        ${JSON.stringify(expectations.visible)}.forEach(sel => {
            const r = checkEl(sel);
            const ok = r.visible;
            if (!ok) results.pass = false;
            results.checks.push({ selector: sel, expected: 'visible', actual: r.reason, pass: ok });
        });

        // Check elements that SHOULD be hidden
        ${JSON.stringify(expectations.hidden)}.forEach(sel => {
            const r = checkEl(sel);
            const ok = !r.visible;
            if (!ok) results.pass = false;
            results.checks.push({ selector: sel, expected: 'hidden', actual: r.reason, pass: ok });
        });

        // Check legacy elements should be hidden
        ${expectations.legacyHidden ? `
        ${JSON.stringify(LEGACY_ELEMENTS)}.forEach(sel => {
            const r = checkEl(sel);
            // Only fail if element exists AND is visible
            if (r.exists && r.visible) {
                results.pass = false;
                results.checks.push({ selector: sel, expected: 'hidden (legacy)', actual: r.reason, pass: false });
            }
        });
        ` : ''}

        // Check loading overlay is hidden during gameplay
        ${expectedState === 'PLAYING' ? `
        const loadingOverlay = checkEl('#loading-overlay');
        if (loadingOverlay.exists && loadingOverlay.visible) {
            results.pass = false;
            results.checks.push({ selector: '#loading-overlay', expected: 'hidden', actual: loadingOverlay.reason, pass: false });
        }
        ` : ''}

        return results;
    })()`;
}

// --- Standalone test runner ---

async function runTest() {
    const BASE_URL = process.env.GAME_URL || 'http://localhost:8084';
    console.log(`UI Visibility Test — ${BASE_URL}\n`);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

    // Disable pointer lock (prevents grabbing user's mouse during headless runs)
    await page.addInitScript(() => {
        Element.prototype.requestPointerLock = function() {};
        Document.prototype.exitPointerLock = function() {};
        Object.defineProperty(Document.prototype, 'pointerLockElement', { get: () => null });
    });

    const results = { passed: 0, failed: 0, errors: [] };

    function report(label, checkResults) {
        console.log(`\n[${checkResults.pass ? 'PASS' : 'FAIL'}] ${label} (state: ${checkResults.state})`);
        const failures = checkResults.checks.filter(c => !c.pass);
        if (failures.length > 0) {
            failures.forEach(f => {
                console.log(`  FAIL: ${f.selector} — expected ${f.expected}, got ${f.actual}`);
            });
            results.failed++;
            results.errors.push(...failures.map(f => `${label}: ${f.selector} expected ${f.expected}, got ${f.actual}`));
        } else {
            results.passed++;
        }
    }

    try {
        // 1. Navigate and wait for init
        console.log('Loading game...');
        await page.goto(BASE_URL);
        await page.waitForTimeout(5000);

        // 2. Check MENU state
        const menuCheck = await page.evaluate(buildUICheckScript('MENU'));
        report('Menu Screen', menuCheck);
        await page.screenshot({ path: 'tests/screenshots/ui-test-menu.png' });

        // 3. Click "New Blob" to start game
        console.log('\nStarting run...');
        await page.click('#menu-new-blob');
        await page.waitForTimeout(4000); // Wait for zone generation + transition to PLAYING

        // Verify we're in PLAYING state
        const gameState = await page.evaluate(() => {
            return window.game?.runManager?.state || 'unknown';
        });
        console.log(`Game state: ${gameState}`);

        // 4. Check PLAYING state — the critical check
        const playingCheck = await page.evaluate(buildUICheckScript('PLAYING'));
        report('Gameplay (PLAYING)', playingCheck);
        await page.screenshot({ path: 'tests/screenshots/ui-test-playing.png' });

        // 5. Force player death to check DEAD state
        console.log('\nTriggering player death...');
        await page.evaluate(() => {
            if (window.game?.playerHealth) {
                window.game.playerHealth.takeDamage(9999);
            }
        });
        await page.waitForTimeout(1500);

        const deadCheck = await page.evaluate(buildUICheckScript('DEAD'));
        report('Death Screen', deadCheck);
        await page.screenshot({ path: 'tests/screenshots/ui-test-dead.png' });

        // 6. Start new run from death to verify cycle
        console.log('\nRestarting from death...');
        const tryAgainBtn = await page.$('#death-try-again');
        if (tryAgainBtn) {
            await tryAgainBtn.click();
            await page.waitForTimeout(4000);

            const restartCheck = await page.evaluate(buildUICheckScript('PLAYING'));
            report('Restart from Death', restartCheck);
            await page.screenshot({ path: 'tests/screenshots/ui-test-restart.png' });
        } else {
            console.log('  SKIP: Try Again button not found');
        }

    } catch (err) {
        console.error(`\nERROR: ${err.message}`);
        results.errors.push(err.message);
        results.failed++;
    } finally {
        await browser.close();
    }

    // Summary
    console.log('\n=== UI VISIBILITY TEST SUMMARY ===');
    console.log(`Passed: ${results.passed}`);
    console.log(`Failed: ${results.failed}`);
    if (results.errors.length > 0) {
        console.log('\nErrors:');
        results.errors.forEach(e => console.log(`  - ${e}`));
    }
    console.log(`\nResult: ${results.failed === 0 ? 'ALL PASS' : 'FAILURES DETECTED'}`);

    process.exit(results.failed > 0 ? 1 : 0);
}

// Run if called directly
runTest().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
