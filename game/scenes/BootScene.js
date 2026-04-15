// ============================================================
// BootScene.js — 启动场景：加载美术资源 + 程序化纹理
// ============================================================
// 说明：
//   - 角色类（player/boss/敌人/子弹）：加载美术图，显示时保持1:1正方形
//   - 环境类（platform/wall/phase_wall）：始终程序化生成32x32 tile纹理
//     原因：美术图均为1024x1024概念图，平铺拉伸时严重变形
//   - 道具类（checkpoint/ability_pickup/spike）：加载美术图，正方形显示
// ============================================================

import { PLAYER, ENEMY, BOSS, COLORS, GAME_WIDTH, GAME_HEIGHT } from '../utils/Constants.js';

export class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
        this._failedTextures = new Set();
    }

    preload() {
        // ---- 加载进度条 ----
        const barBg  = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 320, 12, 0x222244);
        const bar    = this.add.rectangle(GAME_WIDTH / 2 - 160, GAME_HEIGHT / 2, 0, 10, 0x44ccff);
        bar.setOrigin(0, 0.5);
        const loadText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30, '加载中...', {
            fontFamily: 'Courier New', fontSize: '16px', color: '#8899cc',
        }).setOrigin(0.5);

        this.load.on('progress', v => { bar.width = 316 * v; });
        this.load.on('complete', () => { barBg.destroy(); bar.destroy(); loadText.destroy(); });
        this.load.on('loaderror', (fileObj) => { this._failedTextures.add(fileObj.key); });

        // ---- 角色（1024x1024概念图，显示时缩为正方形）----
        this.load.image('player',         '../assets/concept/characters/player.png');
        this.load.image('boss',           '../assets/concept/characters/boss1.png');
        this.load.image('enemy_melee',    '../assets/concept/characters/enemy melee.png');
        this.load.image('enemy_ranged',   '../assets/concept/characters/enemy ranged.png');
        this.load.image('enemy_flying',   '../assets/concept/characters/enemy flying.png');

        // ---- 道具/特殊环境（1024x1024，正方形显示无变形）----
        this.load.image('checkpoint',     '../assets/concept/environment/checkpoint.png');
        this.load.image('spike',          '../assets/concept/environment/spike.png');
        this.load.image('door_trigger',   '../assets/concept/environment/door_trigger.png');
        this.load.image('ability_pickup', '../assets/concept/environment/ability_pickup.png');

        // ---- AI 生成背景图 ----
        this.load.image('bg_main', '../assets/concept/environment/bg_main.png');

        // ---- 弹道特效 ----
        this.load.image('bullet_player',  '../assets/concept/effects/bullet player.png');
        this.load.image('bullet_enemy',   '../assets/concept/effects/bullet enemy.png');
        this.load.image('bullet_boss',    '../assets/concept/effects/bullet boss.png');

        // 注意：platform / wall / phase_wall 不再加载美术图（美术图内容不适合平铺）
        // 直接用程序化 Graphics 生成高质量赛博朋克风格 tile
    }

    create() {
        const g = this.add.graphics();

        // ================================================================
        // 环境纹理：程序化绘制赛博朋克风格 tile（64x16 平台 / 32x64 墙壁）
        // ================================================================

        // ---- 平台 tile (64x16) ----
        g.clear();
        // 主体填充：深蓝紫
        g.fillStyle(0x1e1e3c, 1);
        g.fillRect(0, 0, 64, 16);
        // 顶部发光条：亮青色
        g.fillStyle(0x33ccff, 1);
        g.fillRect(0, 0, 64, 2);
        // 顶部次高光
        g.fillStyle(0x1a88bb, 0.8);
        g.fillRect(0, 2, 64, 1);
        // 内部暗纹：金属面板分割线
        g.fillStyle(0x2a2a5a, 0.8);
        g.fillRect(0, 4, 64, 1);
        g.fillRect(0, 9, 64, 1);
        // 竖向分割线（每16px一段）
        g.fillStyle(0x2a2a5a, 0.6);
        g.fillRect(16, 3, 1, 12);
        g.fillRect(32, 3, 1, 12);
        g.fillRect(48, 3, 1, 12);
        // 小高亮点（铆钉感）
        g.fillStyle(0x44aacc, 0.7);
        g.fillRect(8,  5, 2, 2);
        g.fillRect(24, 5, 2, 2);
        g.fillRect(40, 5, 2, 2);
        g.fillRect(56, 5, 2, 2);
        // 底部边线
        g.fillStyle(0x111130, 1);
        g.fillRect(0, 15, 64, 1);
        g.generateTexture('platform_tile', 64, 16);

        // ---- 墙壁 tile (32x64) ----
        g.clear();
        g.fillStyle(0x161630, 1);
        g.fillRect(0, 0, 32, 64);
        // 左侧发光边
        g.fillStyle(0x2255aa, 1);
        g.fillRect(0, 0, 2, 64);
        g.fillStyle(0x1133660, 0.5);
        g.fillRect(2, 0, 1, 64);
        // 横向分割线（每16px）
        g.fillStyle(0x1e1e40, 0.9);
        g.fillRect(3, 16, 29, 1);
        g.fillRect(3, 32, 29, 1);
        g.fillRect(3, 48, 29, 1);
        // 内部暗纹
        g.fillStyle(0x1a1a38, 0.6);
        g.fillRect(5, 5, 22, 9);
        g.fillRect(5, 21, 22, 9);
        g.fillRect(5, 37, 22, 9);
        g.fillRect(5, 53, 22, 9);
        g.generateTexture('wall_tile', 32, 64);

        // ---- 相位墙 tile (32x32) ----
        g.clear();
        g.fillStyle(0x220044, 0.7);
        g.fillRect(0, 0, 32, 32);
        // 紫色发光边框
        g.lineStyle(2, 0xaa44ff, 0.9);
        g.strokeRect(1, 1, 30, 30);
        // 内部斜纹（相位感）
        g.lineStyle(1, 0x8833cc, 0.4);
        for (let i = -32; i < 64; i += 8) {
            g.lineBetween(i, 0, i + 32, 32);
        }
        // 中心高亮
        g.fillStyle(0xcc88ff, 0.15);
        g.fillRect(8, 8, 16, 16);
        g.generateTexture('phase_wall_tile', 32, 32);

        // ---- 出口触发门 (16x64) ----
        g.clear();
        g.fillStyle(0x0011aa, 0.2);
        g.fillRect(0, 0, 16, 64);
        g.lineStyle(1, 0x4455ff, 0.7);
        g.strokeRect(0, 0, 16, 64);
        g.fillStyle(0x3344ff, 0.5);
        g.fillRect(6, 0, 4, 64);
        g.generateTexture('door_trigger', 16, 64);

        // ================================================================
        // 角色纹理 fallback（仅在美术图加载失败时生成）
        // ================================================================

        if (this._failedTextures.has('player')) {
            g.clear();
            g.fillStyle(COLORS.PLAYER_BODY, 1);
            g.fillRoundedRect(0, 0, PLAYER.WIDTH, PLAYER.HEIGHT, 4);
            g.fillStyle(COLORS.PLAYER_CORE, 1);
            g.fillRoundedRect(4, 4, PLAYER.WIDTH - 8, 12, 2);
            g.fillStyle(0xffffff, 1);
            g.fillRect(8, 14, 4, 4);
            g.fillRect(PLAYER.WIDTH - 12, 14, 4, 4);
            g.fillStyle(0x44ffff, 0.6);
            g.fillCircle(PLAYER.WIDTH / 2, 26, 3);
            g.generateTexture('player', PLAYER.WIDTH, PLAYER.HEIGHT);
        }

        if (this._failedTextures.has('enemy_melee')) {
            g.clear();
            g.fillStyle(COLORS.ENEMY_MELEE, 1);
            g.fillRect(0, 0, ENEMY.MELEE.WIDTH, ENEMY.MELEE.HEIGHT);
            g.fillStyle(0xcc2211, 1);
            g.fillRect(3, 3, ENEMY.MELEE.WIDTH - 6, 8);
            g.fillStyle(0xffff00, 1);
            g.fillRect(6, 14, 4, 3);
            g.fillRect(ENEMY.MELEE.WIDTH - 10, 14, 4, 3);
            g.generateTexture('enemy_melee', ENEMY.MELEE.WIDTH, ENEMY.MELEE.HEIGHT);
        }

        if (this._failedTextures.has('enemy_ranged')) {
            g.clear();
            g.fillStyle(COLORS.ENEMY_RANGED, 1);
            g.fillRoundedRect(0, 0, ENEMY.RANGED.WIDTH, ENEMY.RANGED.HEIGHT, 3);
            g.fillStyle(0xffcc00, 1);
            g.fillCircle(ENEMY.RANGED.WIDTH / 2, ENEMY.RANGED.HEIGHT / 2, 6);
            g.generateTexture('enemy_ranged', ENEMY.RANGED.WIDTH, ENEMY.RANGED.HEIGHT);
        }

        if (this._failedTextures.has('enemy_flying')) {
            g.clear();
            g.fillStyle(COLORS.ENEMY_FLYING, 1);
            const fw = ENEMY.FLYING.WIDTH, fh = ENEMY.FLYING.HEIGHT;
            g.fillTriangle(fw/2, 0, 0, fh/2, fw/2, fh);
            g.fillTriangle(fw/2, 0, fw, fh/2, fw/2, fh);
            g.fillStyle(0xff88ee, 1);
            g.fillCircle(fw/2, fh/2, 5);
            g.generateTexture('enemy_flying', fw, fh);
        }

        if (this._failedTextures.has('boss')) {
            g.clear();
            g.fillStyle(COLORS.BOSS_BODY, 1);
            g.fillRoundedRect(0, 0, BOSS.WIDTH, BOSS.HEIGHT, 6);
            g.fillStyle(0x9922cc, 1);
            g.fillRoundedRect(4, 4, BOSS.WIDTH - 8, 18, 3);
            g.fillStyle(COLORS.BOSS_CORE, 1);
            g.fillRoundedRect(8, 8, BOSS.WIDTH - 16, 10, 2);
            g.generateTexture('boss', BOSS.WIDTH, BOSS.HEIGHT);
        }

        // ================================================================
        // 道具/特效 fallback
        // ================================================================

        if (this._failedTextures.has('spike')) {
            g.clear();
            g.fillStyle(COLORS.SPIKE, 1);
            g.fillTriangle(16, 2, 2, 30, 30, 30);
            g.fillStyle(0xff6677, 0.5);
            g.fillTriangle(16, 8, 8, 28, 24, 28);
            g.generateTexture('spike', 32, 32);
        }

        if (this._failedTextures.has('checkpoint')) {
            g.clear();
            g.fillStyle(COLORS.CHECKPOINT, 1);
            g.fillRoundedRect(0, 0, 32, 32, 4);
            g.fillStyle(0xffffff, 0.5);
            g.fillCircle(16, 16, 8);
            g.generateTexture('checkpoint', 32, 32);
        }

        if (this._failedTextures.has('ability_pickup')) {
            g.clear();
            g.fillStyle(COLORS.ABILITY_PICKUP, 1);
            g.fillCircle(16, 16, 14);
            g.fillStyle(0xffffff, 0.6);
            g.fillCircle(16, 16, 8);
            g.lineStyle(2, 0xffee88, 1);
            g.strokeCircle(16, 16, 14);
            g.generateTexture('ability_pickup', 32, 32);
        }

        if (this._failedTextures.has('door_trigger')) {
            // door_trigger 始终程序化，已在上方生成，跳过
        }

        if (this._failedTextures.has('bullet_player')) {
            g.clear();
            g.fillStyle(COLORS.BULLET_PLAYER, 1);
            g.fillCircle(5, 5, 5);
            g.fillStyle(0xffffff, 0.7);
            g.fillCircle(5, 5, 2);
            g.generateTexture('bullet_player', 10, 10);
        }

        if (this._failedTextures.has('bullet_enemy')) {
            g.clear();
            g.fillStyle(COLORS.BULLET_ENEMY, 1);
            g.fillCircle(4, 4, 4);
            g.generateTexture('bullet_enemy', 8, 8);
        }

        if (this._failedTextures.has('bullet_boss')) {
            g.clear();
            g.fillStyle(COLORS.BULLET_BOSS, 1);
            g.fillCircle(6, 6, 6);
            g.fillStyle(0xffffff, 0.5);
            g.fillCircle(6, 6, 3);
            g.generateTexture('bullet_boss', 12, 12);
        }

        g.destroy();

        this.scene.start('Room1Scene');
        this.scene.launch('HUDScene');
    }

}

