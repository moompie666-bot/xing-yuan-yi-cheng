// ============================================================
// main.js — 游戏主入口
// ============================================================

import { GAME_WIDTH, GAME_HEIGHT, GRAVITY, COLORS } from './utils/Constants.js';
import { BootScene } from './scenes/BootScene.js';
import { Room1Scene } from './scenes/Room1Scene.js';
import { Room2Scene } from './scenes/Room2Scene.js';
import { Room3Scene } from './scenes/Room3Scene.js';
import { Room4Scene } from './scenes/Room4Scene.js';
import { Room5Scene } from './scenes/Room5Scene.js';
import { HUDScene } from './scenes/HUDScene.js';

// 全局错误捕获，显示在屏幕上
window.onerror = (msg, src, line, col, err) => {
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;top:0;left:0;width:100%;background:rgba(200,0,0,0.9);color:#fff;font:14px monospace;padding:10px;z-index:9999;white-space:pre-wrap;word-break:break-all;max-height:50vh;overflow:auto;';
    div.textContent = `ERROR: ${msg}\nAt: ${src}:${line}:${col}\n${err && err.stack ? err.stack : ''}`;
    document.body.appendChild(div);
    return false;
};
window.addEventListener('unhandledrejection', e => {
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;top:0;left:0;width:100%;background:rgba(200,0,0,0.9);color:#fff;font:14px monospace;padding:10px;z-index:9999;white-space:pre-wrap;word-break:break-all;max-height:50vh;overflow:auto;';
    div.textContent = `PROMISE ERROR: ${e.reason}`;
    document.body.appendChild(div);
});

const config = {
    type: Phaser.WEBGL,  // tileSprite 需要 WebGL 才能正常平铺
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent: 'game-container',
    backgroundColor: '#0a0a1a',
    pixelArt: false,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: GRAVITY },
            debug: false,
        },
    },
    scene: [
        BootScene,
        Room1Scene,
        Room2Scene,
        Room3Scene,
        Room4Scene,
        Room5Scene,
        HUDScene,
    ],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
};

const game = new Phaser.Game(config);
