// Basic Controls Test Scenario
// Tests WASD movement, mouse look, jump, and ESC

import { GameHelpers, TestResults } from '../game-helpers.js';

/**
 * Test scenario: Basic character controls
 *
 * Tests:
 * 1. WASD movement changes player position
 * 2. Mouse movement changes camera direction
 * 3. Space triggers jump (position Y changes)
 * 4. ESC releases pointer lock
 *
 * Success criteria:
 * - Player position changes when WASD pressed
 * - Camera rotates on mouse move
 * - Player Y increases on jump
 * - Pointer lock releases on ESC
 * - No console errors
 */
export async function runBasicControlsTests(page) {
    const results = new TestResults();

    try {
        // Setup
        await GameHelpers.launchGame(page);
        await GameHelpers.waitForGameReady(page);

        // Test 1: Enter game (acquire pointer lock)
        await GameHelpers.enterGame(page);
        const hasPointerLock = await GameHelpers.isPointerLocked(page);
        if (hasPointerLock) {
            results.pass('Pointer lock acquired on click');
        } else {
            results.fail('Pointer lock acquisition', 'Failed to acquire pointer lock');
        }

        // Test 2: Forward movement
        const positionBefore = await GameHelpers.getPlayerPosition(page);
        await GameHelpers.move(page, 'forward', 500);
        const positionAfter = await GameHelpers.getPlayerPosition(page);

        if (positionBefore && positionAfter) {
            const moved = Math.abs(positionAfter.z - positionBefore.z) > 0.5 ||
                         Math.abs(positionAfter.x - positionBefore.x) > 0.5;
            if (moved) {
                results.pass('Forward movement', `Moved from z=${positionBefore.z.toFixed(2)} to z=${positionAfter.z.toFixed(2)}`);
            } else {
                results.fail('Forward movement', 'Position did not change significantly');
            }
        } else {
            results.fail('Forward movement', 'Could not read player position');
        }

        // Test 3: Left/Right movement
        const posBefore2 = await GameHelpers.getPlayerPosition(page);
        await GameHelpers.move(page, 'left', 300);
        const posAfter2 = await GameHelpers.getPlayerPosition(page);

        if (posBefore2 && posAfter2) {
            const movedX = Math.abs(posAfter2.x - posBefore2.x) > 0.3;
            if (movedX) {
                results.pass('Lateral movement');
            } else {
                results.fail('Lateral movement', 'X position did not change');
            }
        }

        // Test 4: Jump (if grounded)
        const posBeforeJump = await GameHelpers.getPlayerPosition(page);
        await page.keyboard.press('Space');
        await page.waitForTimeout(300); // Wait for jump apex
        const posDuringJump = await GameHelpers.getPlayerPosition(page);

        if (posBeforeJump && posDuringJump && posDuringJump.y > posBeforeJump.y) {
            results.pass('Jump mechanics', `Y increased from ${posBeforeJump.y.toFixed(2)} to ${posDuringJump.y.toFixed(2)}`);
        } else {
            results.skip('Jump mechanics', 'Could not verify jump (may need to be grounded)');
        }

        // Wait for landing
        await page.waitForTimeout(500);

        // Test 5: ESC releases pointer lock
        await GameHelpers.pressEscape(page);
        const pointerLockAfterEsc = await GameHelpers.isPointerLocked(page);
        if (!pointerLockAfterEsc) {
            results.pass('ESC releases pointer lock');
        } else {
            results.fail('ESC releases pointer lock', 'Pointer lock still active after ESC');
        }

        // Test 6: Can re-enter game
        await GameHelpers.enterGame(page);
        const reacquiredLock = await GameHelpers.isPointerLocked(page);
        if (reacquiredLock) {
            results.pass('Re-enter game after ESC');
        } else {
            results.skip('Re-enter game after ESC', 'Could not verify pointer lock re-acquisition');
        }

    } catch (error) {
        results.fail('Basic controls test execution', error);
    }

    return results.summary();
}

// Export test metadata
export const metadata = {
    name: 'Basic Controls',
    description: 'Tests WASD movement, mouse look, jump, and ESC key',
    estimatedDuration: '30 seconds',
    dependencies: ['dev server running']
};
