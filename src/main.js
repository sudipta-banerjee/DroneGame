// Entry shell — loads fast so the menu is interactive immediately.
// The heavy 3D bundle (three.js, cannon-es, nipplejs) lives in game.js and is
// imported dynamically only when the user clicks "INITIALIZE FLIGHT".
import './style.css';
import { inject } from '@vercel/analytics';

// Analytics starts tracking as soon as the page (and menu) is visible.
inject();

// ---------------------------------------------------------------------------
// Boot splash: with lazy-loading the initial download is tiny, so drop the
// "ESTABLISHING NEURAL LINK" splash quickly and reveal the menu.
// ---------------------------------------------------------------------------
setTimeout(() => {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) loadingScreen.style.display = 'none';
}, 600);

// ---------------------------------------------------------------------------
// Pure-DOM overlay wiring (no 3D engine needed).
// Settings / help / back / close-help work instantly before the game loads.
// ---------------------------------------------------------------------------
const settingsOverlay = document.getElementById('settings-overlay');

document.getElementById('settings-btn').addEventListener('click', () => {
    settingsOverlay.classList.add('active');
});

document.getElementById('back-btn').addEventListener('click', () => {
    settingsOverlay.classList.remove('active');
});

document.getElementById('help-btn').addEventListener('click', () => {
    document.getElementById('help-overlay').classList.add('active');
});

document.getElementById('close-help-btn').addEventListener('click', () => {
    document.getElementById('help-overlay').classList.remove('active');
});

// ---------------------------------------------------------------------------
// Lazy load the 3D bundle
// ---------------------------------------------------------------------------
const menuOverlay = document.getElementById('menu-overlay');
let gameLoadPromise = null;

function loadGame() {
    if (!gameLoadPromise) {
        // Dynamic import → Vite emits a separate chunk for game.js + three/cannon/nipplejs.
        gameLoadPromise = import('./game.js').then(({ Game }) => new Game());
    }
    return gameLoadPromise;
}

// ---------------------------------------------------------------------------
// Start button — lazy-loads the 3D bundle then begins play.
// The menu stays visible with a "LOADING…" button while the bundle downloads;
// startGame() hides the menu once the game is ready.
// ---------------------------------------------------------------------------
function setStartBtnLoading(loading) {
    const btn = document.getElementById('start-btn');
    if (!btn) return;
    btn.disabled = loading;
    btn.textContent = loading ? 'LOADING…' : 'INITIALIZE FLIGHT';
}

document.getElementById('start-btn').addEventListener('click', async () => {
    setStartBtnLoading(true);
    try {
        const game = await loadGame();
        game.startGame();
    } catch (err) {
        console.error('Failed to load game bundle:', err);
        setStartBtnLoading(false);
        gameLoadPromise = null; // allow a retry on the next click
    }
});
