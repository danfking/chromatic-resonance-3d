// Menu Interaction Test Scenario
// Tests Tab menu, UI clicks, and pause states (Bug #1 and #5 regression tests)

import { GameHelpers, TestResults } from '../game-helpers.js';

/**
 * Test scenario: Menu interaction and pause states
 *
 * Tests:
 * 1. Tab opens spell menu
 * 2. Pointer lock is released when menu opens (Bug #1 fix)
 * 3. Menu UI elements are clickable
 * 4. Tab closes menu and resumes game
 * 5. ESC closes menu if open (Bug #5 fix)
 * 6. Pause state stays consistent through Tab/ESC combinations
 *
 * Success criteria:
 * - Menu opens on Tab
 * - Pointer lock releases when menu opens
 * - Color toggles respond to clicks
 * - Mode buttons respond to clicks
 * - isPaused matches menu visibility
 * - No state desync after rapid Tab/ESC
 */
export async function runMenuInteractionTests(page) {
    const results = new TestResults();

    try {
        // Setup
        await GameHelpers.launchGame(page);
        await GameHelpers.waitForGameReady(page);
        await GameHelpers.enterGame(page);

        // Test 1: Tab opens menu
        await GameHelpers.openSpellMenu(page);
        const menuVisible = await GameHelpers.isSpellMenuVisible(page);
        if (menuVisible) {
            results.pass('Tab opens spell menu');
        } else {
            results.fail('Tab opens spell menu', 'Menu not visible after Tab');
        }

        // Test 2: Pointer lock released (Bug #1 fix verification)
        const pointerLockDuringMenu = await GameHelpers.isPointerLocked(page);
        if (!pointerLockDuringMenu) {
            results.pass('Pointer lock released when menu opens', 'Bug #1 fix verified');
        } else {
            results.fail('Pointer lock released when menu opens', 'Pointer lock still active - Bug #1 regression');
        }

        // Test 3: Game is paused when menu open
        const isPausedWithMenu = await GameHelpers.isGamePaused(page);
        if (isPausedWithMenu) {
            results.pass('Game paused when menu open');
        } else {
            results.fail('Game paused when menu open', 'isPaused should be true');
        }

        // Test 4: UI elements are clickable (color toggle)
        try {
            // Try to toggle crimson color
            await page.click('.color-toggle[data-color="crimson"]');
            await page.waitForTimeout(100);

            // Check if toggle state changed
            const isCrimsonEnabled = await page.evaluate(() => {
                const toggle = document.querySelector('.color-toggle[data-color="crimson"]');
                return toggle && toggle.classList.contains('enabled');
            });

            if (isCrimsonEnabled) {
                results.pass('Color toggle clickable', 'Crimson enabled');
            } else {
                results.fail('Color toggle clickable', 'Toggle did not respond to click');
            }
        } catch (e) {
            results.fail('Color toggle clickable', e);
        }

        // Test 5: Mode button clickable
        try {
            await page.click('.mode-btn[data-mode="multi"]');
            await page.waitForTimeout(100);

            const isMultiMode = await page.evaluate(() => {
                const btn = document.querySelector('.mode-btn[data-mode="multi"]');
                return btn && btn.classList.contains('active');
            });

            if (isMultiMode) {
                results.pass('Mode button clickable', 'Multi mode activated');
            } else {
                results.fail('Mode button clickable', 'Mode button did not respond');
            }
        } catch (e) {
            results.fail('Mode button clickable', e);
        }

        // Test 6: ESC closes menu (Bug #5 fix)
        await GameHelpers.pressEscape(page);
        const menuAfterEsc = await GameHelpers.isSpellMenuVisible(page);
        const pausedAfterEsc = await GameHelpers.isGamePaused(page);

        if (!menuAfterEsc && !pausedAfterEsc) {
            results.pass('ESC closes menu and resumes game', 'Bug #5 fix verified');
        } else {
            results.fail('ESC closes menu and resumes game',
                `Menu visible: ${menuAfterEsc}, Paused: ${pausedAfterEsc}`);
        }

        // Test 7: Pointer lock re-acquired after menu close
        await page.waitForTimeout(300); // Wait for pointer lock re-acquisition
        const pointerLockAfterClose = await GameHelpers.isPointerLocked(page);
        if (pointerLockAfterClose) {
            results.pass('Pointer lock re-acquired after menu close');
        } else {
            results.skip('Pointer lock re-acquired after menu close', 'May require user gesture');
        }

        // Test 8: Tab toggle works correctly
        await GameHelpers.openSpellMenu(page);
        await page.waitForTimeout(100);
        await GameHelpers.closeSpellMenu(page);
        const menuAfterToggle = await GameHelpers.isSpellMenuVisible(page);
        if (!menuAfterToggle) {
            results.pass('Tab toggle opens and closes menu');
        } else {
            results.fail('Tab toggle opens and closes menu', 'Menu still visible after second Tab');
        }

        // Test 9: Rapid Tab/ESC stress test (Bug #5 edge case)
        for (let i = 0; i < 5; i++) {
            await page.keyboard.press('Tab');
            await page.waitForTimeout(50);
            await page.keyboard.press('Escape');
            await page.waitForTimeout(50);
        }

        // Check final state consistency
        const finalMenuState = await GameHelpers.isSpellMenuVisible(page);
        const finalPauseState = await GameHelpers.isGamePaused(page);

        // Menu should be closed and game should not be paused
        if (!finalMenuState && !finalPauseState) {
            results.pass('State consistent after rapid Tab/ESC');
        } else if (finalMenuState === finalPauseState) {
            results.pass('State consistent after rapid Tab/ESC', 'States match (both true or both false)');
        } else {
            results.fail('State consistent after rapid Tab/ESC',
                `Menu: ${finalMenuState}, Paused: ${finalPauseState} - state desync detected`);
        }

    } catch (error) {
        results.fail('Menu interaction test execution', error);
    }

    return results.summary();
}

// Export test metadata
export const metadata = {
    name: 'Menu Interaction',
    description: 'Tests Tab menu, UI clicks, and pause state consistency (Bug #1 and #5 regression)',
    estimatedDuration: '45 seconds',
    dependencies: ['dev server running'],
    verifies: ['Bug #1: Tab menu pointer lock', 'Bug #5: Pause state sync']
};
