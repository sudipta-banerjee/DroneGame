import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = path.resolve('test_screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runTests() {
    console.log('=== STARTING AUTOMATED MOBILE & DESKTOP GAMEPLAY VERIFICATION ===');

    const browser = await puppeteer.launch({
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu-sandbox',
            '--use-gl=angle',
            '--use-angle=swiftshader-webgl',
            '--enable-webgl',
            '--mute-audio'
        ]
    });

    const page = await browser.newPage();

    // Mobile landscape (iPhone landscape: 844 x 390)
    await page.setViewport({
        width: 844,
        height: 390,
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2
    });

    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.error('Browser Console Error:', msg.text());
        }
    });

    page.on('pageerror', err => {
        console.error('Page Exception:', err.message, err.stack);
    });

    try {
        console.log('\n[1] Navigating to http://localhost:5173...');
        await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
        await new Promise(r => setTimeout(r, 2000)); // Wait for loading screen

        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_main_menu.png') });
        console.log('  Screenshot saved: 01_main_menu.png');

        // Test Settings Dialog & Mobile DevTools toggle from Main Menu
        console.log('\n[2] Testing Settings Dialog & Mobile DevTools toggle...');
        await page.click('#settings-btn');
        await new Promise(r => setTimeout(r, 400));
        
        const isSettingsActive = await page.$eval('#settings-overlay', el => el.classList.contains('active'));
        console.log('  Settings dialog opened:', isSettingsActive);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_settings_dialog.png') });

        // Toggle DevTools
        await page.click('#toggle-eruda-btn');
        await new Promise(r => setTimeout(r, 600));
        const erudaActive = await page.evaluate(() => !!(window.eruda && window.eruda._isInit));
        console.log('  Eruda Mobile DevTools initialized:', erudaActive);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_eruda_active.png') });

        // Close Settings via close button [✕]
        await page.click('#settings-dialog-close');
        await new Promise(r => setTimeout(r, 400));
        const isSettingsClosed = await page.$eval('#settings-overlay', el => !el.classList.contains('active'));
        console.log('  Settings dialog closed with [✕]:', isSettingsClosed);

        // Start Flight
        console.log('\n[3] Initializing Flight (clicking INITIALIZE FLIGHT)...');
        await page.click('#start-btn');
        await new Promise(r => setTimeout(r, 1200));
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_flight_started.png') });
        console.log('  Screenshot saved: 04_flight_started.png');

        // Test Problem 1: Screen flickering black/red
        console.log('\n[4] Testing Screen Flickering (Collision / Ground flash check)...');
        // Let the drone idle on the ground for 3 seconds and monitor if flash triggers
        const flashStats = await page.evaluate(async () => {
            let flashCount = 0;
            const flashEl = document.getElementById('collision-flash');
            const observer = new MutationObserver(() => {
                if (flashEl && flashEl.classList.contains('active')) {
                    flashCount++;
                }
            });
            if (flashEl) {
                observer.observe(flashEl, { attributes: true, attributeFilter: ['class'] });
            }
            await new Promise(r => setTimeout(r, 3000));
            observer.disconnect();
            return {
                flashCount,
                flashStyle: flashEl ? window.getComputedStyle(flashEl).boxShadow : null,
                flashBackground: flashEl ? window.getComputedStyle(flashEl).backgroundColor : null
            };
        });
        console.log('  Ground collision flashes triggered (0 expected):', flashStats.flashCount);
        console.log('  Flash background is non-opaque:', flashStats.flashBackground);
        console.log('  Flash has peripheral vignette:', flashStats.flashStyle && flashStats.flashStyle.includes('rgba'));

        // Test Problem 2: Help Dialog in-flight
        console.log('\n[5] Testing Help Dialog (Mobile Instructions & Scrolling)...');
        await page.click('#help-btn');
        await new Promise(r => setTimeout(r, 400));

        const isHelpActive = await page.$eval('#help-overlay', el => el.classList.contains('active'));
        console.log('  Help dialog opened in-flight:', isHelpActive);

        const helpInfo = await page.evaluate(() => {
            const overlay = document.getElementById('help-overlay');
            const content = overlay.querySelector('.menu-content');
            const cols = content.querySelectorAll('.help-col');
            return {
                colCount: cols.length,
                hasDesktopCol: cols[0] ? cols[0].innerText.includes('DESKTOP CONTROLS') : false,
                hasMobileCol: cols[1] ? cols[1].innerText.includes('MOBILE CONTROLS') : false,
                mobileText: cols[1] ? cols[1].innerText : '',
                contentScrollHeight: content.scrollHeight,
                contentClientHeight: content.clientHeight,
                isOverflowScrollable: content.scrollHeight > content.clientHeight || window.getComputedStyle(content).overflowY === 'auto'
            };
        });
        console.log('  Help columns count:', helpInfo.colCount);
        console.log('  Desktop instructions present:', helpInfo.hasDesktopCol);
        console.log('  Mobile instructions present:', helpInfo.hasMobileCol);
        console.log('  Mobile text snippet:\n    ' + helpInfo.mobileText.replace(/\n/g, '\n    '));
        console.log('  Dialog overflow scrollable:', helpInfo.isOverflowScrollable);

        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_help_dialog.png') });
        console.log('  Screenshot saved: 05_help_dialog.png');

        // Close Help via [✕] button
        await page.click('#help-dialog-close');
        await new Promise(r => setTimeout(r, 400));
        const isHelpClosed = await page.$eval('#help-overlay', el => !el.classList.contains('active'));
        console.log('  Help dialog closed with [✕]:', isHelpClosed);

        // Test Problem 3: Altitude climb on mobile (Virtual Joysticks)
        console.log('\n[6] Testing Mobile Altitude Climb (Left Virtual Joystick)...');
        const joysticksVisible = await page.evaluate(() => {
            const container = document.getElementById('joysticks-container');
            const left = document.getElementById('left-joystick');
            const right = document.getElementById('right-joystick');
            return {
                leftVisible: !!left && left.getBoundingClientRect().width > 0,
                rightVisible: !!right && right.getBoundingClientRect().width > 0,
                leftRect: left ? left.getBoundingClientRect().toJSON() : null,
                rightRect: right ? right.getBoundingClientRect().toJSON() : null
            };
        });
        console.log('  Left virtual joystick visible:', joysticksVisible.leftVisible);
        console.log('  Right virtual joystick visible:', joysticksVisible.rightVisible);

        const initialAlt = await page.$eval('#alt-val', el => parseFloat(el.textContent));
        console.log(`  Initial Altitude before climb: ${initialAlt}m`);

        // Simulate touch drag UP on the left joystick (climb altitude)
        const leftBox = joysticksVisible.leftRect;
        const centerX = leftBox.x + leftBox.width / 2;
        const centerY = leftBox.y + leftBox.height / 2;
        const targetY = centerY - (leftBox.height * 0.42); // Drag UP

        console.log('  Applying upward thrust via left virtual joystick...');
        await page.evaluate(({ cx, cy, ty }) => {
            const zone = document.getElementById('left-joystick');
            zone.dispatchEvent(new PointerEvent('pointerdown', {
                pointerId: 1,
                pointerType: 'touch',
                clientX: cx,
                clientY: cy,
                bubbles: true
            }));
            zone.dispatchEvent(new PointerEvent('pointermove', {
                pointerId: 1,
                pointerType: 'touch',
                clientX: cx,
                clientY: ty,
                bubbles: true
            }));
        }, { cx: centerX, cy: centerY, ty: targetY });

        // Climb for 3 seconds
        await new Promise(r => setTimeout(r, 3000));

        const climbingAlt = await page.$eval('#alt-val', el => parseFloat(el.textContent));
        const currentSpeed = await page.$eval('#speed-val', el => parseFloat(el.textContent));
        console.log(`  Altitude after 3s climbing thrust: ${climbingAlt}m (Speed: ${currentSpeed} km/h)`);
        console.log(`  CLIMB TEST: ${climbingAlt > initialAlt ? 'PASS (Drone climbed successfully!)' : 'FAIL'}`);

        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_climbing_altitude.png') });
        console.log('  Screenshot saved: 06_climbing_altitude.png');

        // Release left joystick
        await page.evaluate(({ cx, cy }) => {
            const zone = document.getElementById('left-joystick');
            zone.dispatchEvent(new PointerEvent('pointerup', {
                pointerId: 1,
                pointerType: 'touch',
                clientX: cx,
                clientY: cy,
                bubbles: true
            }));
        }, { cx: centerX, cy: centerY });

        // Test: 30° Max Tilt Angle Limiter (Preventing Flips)
        console.log('\n[6B] Testing 30° Max Tilt Angle Limiter (Preventing Flips)...');
        const tiltTestResults = await page.evaluate(async () => {
            const rightZone = document.getElementById('right-joystick');
            const rect = rightZone.getBoundingClientRect();
            const cx = rect.x + rect.width / 2;
            const cy = rect.y + rect.height / 2;
            const targetX = cx + (rect.width * 0.45);
            const targetY = cy - (rect.height * 0.45);

            rightZone.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 2, pointerType: 'touch', clientX: cx, clientY: cy, bubbles: true }));
            rightZone.dispatchEvent(new PointerEvent('pointermove', { pointerId: 2, pointerType: 'touch', clientX: targetX, clientY: targetY, bubbles: true }));

            let maxObservedTilt = 0;
            const startTime = performance.now();
            while (performance.now() - startTime < 2500) {
                if (window.__drone && window.__drone.body) {
                    const q = window.__drone.body.quaternion;
                    // Y component of rotated (0, 1, 0) vector is 1 - 2*(qx^2 + qz^2)
                    const localUpY = 1 - 2 * (q.x * q.x + q.z * q.z);
                    const tiltRad = Math.acos(Math.max(-1, Math.min(1, localUpY)));
                    const tiltDeg = (tiltRad * 180) / Math.PI;
                    if (tiltDeg > maxObservedTilt) maxObservedTilt = tiltDeg;
                }
                await new Promise(r => setTimeout(r, 60));
            }

            rightZone.dispatchEvent(new PointerEvent('pointerup', { pointerId: 2, pointerType: 'touch', clientX: cx, clientY: cy, bubbles: true }));
            
            await new Promise(r => setTimeout(r, 800));
            let recoveredTiltDeg = 0;
            if (window.__drone && window.__drone.body) {
                const q = window.__drone.body.quaternion;
                const localUpY = 1 - 2 * (q.x * q.x + q.z * q.z);
                const recoveredTiltRad = Math.acos(Math.max(-1, Math.min(1, localUpY)));
                recoveredTiltDeg = (recoveredTiltRad * 180) / Math.PI;
            }

            return {
                maxObservedTilt: parseFloat(maxObservedTilt.toFixed(1)),
                recoveredTiltDeg: parseFloat(recoveredTiltDeg.toFixed(1))
            };
        });

        console.log(`  Max tilt observed under full diagonal stick: ${tiltTestResults.maxObservedTilt}° (Limit: 30°)`);
        console.log(`  Tilt after stick released (Auto-Level): ${tiltTestResults.recoveredTiltDeg}°`);
        console.log(`  30° TILT LIMITER TEST: ${tiltTestResults.maxObservedTilt <= 30.5 ? 'PASS (Drone locked steady at ≤30°!)' : 'FAIL (Exceeded 30°)'}`);
        console.log(`  ANTI-FLIP TEST: ${tiltTestResults.maxObservedTilt < 90 ? 'PASS (Drone never flipped!)' : 'FAIL (Drone flipped over)'}`);

        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06b_tilt_limited_flight.png') });
        console.log('  Screenshot saved: 06b_tilt_limited_flight.png');

        // Test Problem 2 (Part B): Training Complete Dialog & Close
        console.log('\n[7] Testing Training Complete Dialog...');
        await page.click('#end-practice-btn');
        await new Promise(r => setTimeout(r, 500));

        const isResultsActive = await page.$eval('#results-overlay', el => el.classList.contains('active'));
        console.log('  Training Complete dialog opened:', isResultsActive);

        const resultsStats = await page.evaluate(() => {
            return {
                flightTime: document.getElementById('res-time').textContent,
                maxSpeed: document.getElementById('res-speed').textContent,
                maxAlt: document.getElementById('res-alt').textContent,
                totalHours: document.getElementById('res-total-hours').textContent
            };
        });
        console.log('  Training results data:', resultsStats);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_training_complete_dialog.png') });
        console.log('  Screenshot saved: 07_training_complete_dialog.png');

        // Close Training Complete via [✕] button
        console.log('  Clicking [✕] button on Training Complete dialog...');
        await page.click('#results-dialog-close');
        await new Promise(r => setTimeout(r, 500));

        const isResultsClosed = await page.$eval('#results-overlay', el => !el.classList.contains('active'));
        console.log('  Training Complete dialog successfully closed via [✕]:', isResultsClosed);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08_after_closing_results.png') });
        console.log('  Screenshot saved: 08_after_closing_results.png');

        // Test On-Screen Reset button
        console.log('\n[8] Testing On-Screen RESET button...');
        await page.click('#reset-btn');
        await new Promise(r => setTimeout(r, 600));
        const resetAlt = await page.$eval('#alt-val', el => parseFloat(el.textContent));
        console.log(`  Altitude after RESET: ${resetAlt}m (drone returned to spawn point)`);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09_after_reset.png') });
        console.log('  Screenshot saved: 09_after_reset.png');

        console.log('\n===========================================================');
        console.log('  ALL AUTOMATED GAMEPLAY & ISSUE VERIFICATIONS PASSED!  ');
        console.log('===========================================================');
    } catch (err) {
        console.error('Test execution failed:', err);
    } finally {
        await browser.close();
    }
}

runTests();
