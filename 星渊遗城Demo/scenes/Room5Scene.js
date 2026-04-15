// ============================================================
// Room5Scene.js — 房间5：Boss 房
// ============================================================

import { GAME_WIDTH, GAME_HEIGHT, COLORS, DEPTH, PLAYER as PC, BOSS as BC } from '../utils/Constants.js';
import { BaseRoomScene } from './BaseRoomScene.js';
import { Boss } from '../entities/Boss.js';
import { Effects } from '../utils/Effects.js';
import gameState from '../managers/GameState.js';
import checkpointManager from '../managers/CheckpointManager.js';

const ARENA_W = GAME_WIDTH + 200;

export class Room5Scene extends BaseRoomScene {
    constructor() {
        super({ key: 'Room5Scene' });
    }

    getRoomConfig() {
        return {
            worldWidth: ARENA_W,
            nextScene: null,  // Boss房无出口（靠事件结束）
            bgStarCount: 50,
            bgStarColorSet: [0xcc44ff, COLORS.STAR, COLORS.STAR_PURPLE, 0xff4488],
            bgGlowColor: 0x220022,
            bgGlowAlpha: 0.15,
            neonLines: [
                { x: 30,           y: GAME_HEIGHT / 2,    length: GAME_HEIGHT - 80, vertical: true,  color: COLORS.NEON_PURPLE },
                { x: ARENA_W - 30, y: GAME_HEIGHT / 2,    length: GAME_HEIGHT - 80, vertical: true,  color: COLORS.NEON_PURPLE },
                { x: ARENA_W / 2,  y: GAME_HEIGHT - 40,   length: 200,              vertical: false, color: COLORS.NEON_PINK },
            ],
            cameraFollowX: 0.04,
            cameraFollowY: 0.04,
            cameraDeadzoneX: 80,
            cameraDeadzoneY: 40,
            cameraFadeIn: 600,
            initialCheckpoint: { x: 80, y: GAME_HEIGHT - 80 },
        };
    }

    buildRoom() {
        // ---- 竞技场地板 + 边墙 + 平台 ----
        this._addPlatform(0,          GAME_HEIGHT - 32, ARENA_W, 32);
        this._addPlatform(0,          0,                24,      GAME_HEIGHT);
        this._addPlatform(ARENA_W-24, 0,                24,      GAME_HEIGHT);
        this._addPlatform(150,        GAME_HEIGHT - 180, 120, 16);
        this._addPlatform(500,        GAME_HEIGHT - 250, 100, 16);
        this._addPlatform(850,        GAME_HEIGHT - 180, 120, 16);
        this._addPlatform(350,        GAME_HEIGHT - 380,  80, 16);
        this._addPlatform(700,        GAME_HEIGHT - 380,  80, 16);

        // Boss 房标识
        this.add.text(ARENA_W / 2, 30, '— BOSS 竞技场 —', {
            fontFamily: 'Courier New', fontSize: '12px', color: '#664488',
            stroke: '#000000', strokeThickness: 1,
        }).setOrigin(0.5).setDepth(DEPTH.BG_NEAR).setAlpha(0.5).setScrollFactor(0);
    }

    onPlayerCreated() {
        // ---- Boss ----
        this.boss = new Boss(this, ARENA_W - 150, GAME_HEIGHT - 100);
        this.boss.setTarget(this.player);
        this.physics.add.collider(this.boss, this.platforms);

        this._bossContactTimer = 0;

        // Boss 事件
        this.events.on('boss-defeated',     () => this._handleVictory());
        this.events.on('boss-phase-change', (phase) => this._onPhaseChange(phase));

        // 检查点（Boss房固定）
        checkpointManager.activate('Room5Scene', 80, GAME_HEIGHT - 80);

        // Boss 入场介绍
        this._showBossIntro();

        gameState.bossActive = true;
        this.victoryShown = false;
    }

    // Room5 需要在 victoryShown 时完全跳过更新
    update(time, delta) {
        if (this.victoryShown) return;
        super.update(time, delta);
    }

    onUpdate(time, delta) {
        if (!this.boss) return;

        if (this.boss.active) {
            this.boss.update(time, delta);
        }

        if (this._bossContactTimer > 0) this._bossContactTimer -= delta;

        const player = this.player;
        if (!player || !player.active) return;

        // ---- 玩家子弹 vs Boss（手动检测）----
        if (this.boss.active && this.boss.state !== 'dead') {
            player.bullets.children.each(bullet => {
                if (!bullet.active) return;
                if (this._rectOverlap(bullet, this.boss)) {
                    bullet.setActive(false).setVisible(false);
                    bullet.body.setVelocity(0, 0);
                    const dir = this.boss.x > player.x ? 1 : -1;
                    Effects.hitSpark(this, bullet.x, bullet.y, COLORS.BULLET_PLAYER, dir);
                    this.boss.takeDamage(bullet.damage || PC.RANGED_DAMAGE);
                }
            });
        }

        // ---- Boss 子弹 vs 玩家（手动检测）----
        if (this.boss.bullets) {
            this.boss.bullets.children.each(bullet => {
                if (!bullet.active) return;
                if (this._rectOverlap(bullet, player)) {
                    bullet.setActive(false).setVisible(false);
                    bullet.body.setVelocity(0, 0);
                    const dir = player.x < bullet.x ? -1 : 1;
                    player.takeDamage(bullet.damage || BC.SHOOT_DAMAGE, dir);
                }
            });
        }

        // ---- Boss 接触伤害（手动检测）----
        if (this.boss.active && this.boss.state !== 'dead' && this._bossContactTimer <= 0) {
            if (this._rectOverlap(player, this.boss)) {
                const dir = player.x < this.boss.x ? -1 : 1;
                const dmg = this.boss.state === 'charge' ? BC.CHARGE_DAMAGE : 15;
                player.takeDamage(dmg, dir);
                this._bossContactTimer = 500;
            }
        }

        // ---- 近战 hitbox vs Boss（手动 AABB）----
        if (player.meleeHitbox && player.meleeHitbox.body &&
            this.boss.active && this.boss.state !== 'dead' &&
            !player.hasMeleeHit(this.boss)) {
            if (this._rectOverlap(player.meleeHitbox, this.boss)) {
                player.markMeleeHit(this.boss);
                const dir = this.boss.x > player.x ? 1 : -1;
                // Boss 命中：重级打击感
                Effects.hitSparkHeavy(this, this.boss.x - dir * 15, this.boss.y, dir);
                Effects.hitstopBoss(this);
                Effects.shakeBoss(this.cameras.main);
                this.boss.takeDamage(PC.MELEE_DAMAGE);
            }
        }
    }

    /** 简单 AABB 重叠检测 */
    _rectOverlap(a, b) {
        if (!a || !b || !a.body || !b.body) return false;
        const ab = a.body, bb = b.body;
        return ab.x < bb.x + bb.width  &&
               ab.x + ab.width  > bb.x &&
               ab.y < bb.y + bb.height &&
               ab.y + ab.height > bb.y;
    }

    _showBossIntro() {
        const nameBg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, 520, 55, 0x000000, 0.8);
        nameBg.setScrollFactor(0).setDepth(DEPTH.HUD);
        const line1 = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 68, 520, 2, COLORS.BOSS_CORE, 0.5);
        line1.setScrollFactor(0).setDepth(DEPTH.HUD);
        const line2 = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 12, 520, 2, COLORS.BOSS_CORE, 0.5);
        line2.setScrollFactor(0).setDepth(DEPTH.HUD);
        const nameText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 52, '「相位监察者」', {
            fontFamily: 'Courier New', fontSize: '26px', color: '#cc33ff',
            stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.HUD);
        const subText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 25, '裂环城区 · 守卫协议已启动', {
            fontFamily: 'Courier New', fontSize: '13px', color: '#9966bb',
            stroke: '#000000', strokeThickness: 1,
        }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.HUD);

        this.time.delayedCall(2800, () => {
            this.tweens.add({
                targets: [nameBg, nameText, subText, line1, line2], alpha: 0, duration: 600,
                onComplete: () => { nameBg.destroy(); nameText.destroy(); subText.destroy(); line1.destroy(); line2.destroy(); },
            });
        });
    }

    _onPhaseChange(phase) {
        const texts = {
            2: '— 阶段 II · 射击协议激活 —',
            3: '— 阶段 III · 瞬移突进解锁 —',
        };
        const t = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 90, texts[phase] || '', {
            fontFamily: 'Courier New', fontSize: '16px', color: '#ff3366',
            stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.HUD);
        this.tweens.add({
            targets: t, alpha: 0, y: t.y - 30, delay: 1800, duration: 500,
            onComplete: () => t.destroy(),
        });
    }

    _handleVictory() {
        if (this.victoryShown) return;
        this.victoryShown = true;
        gameState.victory = true;

        if (this.player && this.player.body) {
            this.player.body.setVelocity(0, 0);
        }

        this.time.delayedCall(2000, () => {
            const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0);
            overlay.setScrollFactor(0).setDepth(DEPTH.HUD - 1);
            this.tweens.add({ targets: overlay, alpha: 0.75, duration: 1000 });

            const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 90, '「相位监察者」已击败', {
                fontFamily: 'Courier New', fontSize: '28px', color: '#44ffaa',
                stroke: '#000000', strokeThickness: 3,
            }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.HUD).setAlpha(0);

            const hook = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 10,
                '"环城的秘密远不止于此……\n深处传来的信号，指向星髓深井的核心。\n你的旅途，才刚刚开始。"', {
                fontFamily: 'Courier New', fontSize: '14px', color: '#aabbcc',
                align: 'center', lineSpacing: 8,
                stroke: '#000000', strokeThickness: 1,
            }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.HUD).setAlpha(0);

            const thanks = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 100,
                '—— 《星渊遗城》Demo 结束 ——\n感谢游玩！按 R 重新开始', {
                fontFamily: 'Courier New', fontSize: '13px', color: '#778899',
                align: 'center', lineSpacing: 6,
                stroke: '#000000', strokeThickness: 1,
            }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.HUD).setAlpha(0);

            this.tweens.add({ targets: title,  alpha: 1, y: title.y + 10,  duration: 800, delay: 300 });
            this.tweens.add({ targets: hook,   alpha: 1, duration: 800, delay: 1200 });
            this.tweens.add({ targets: thanks, alpha: 1, duration: 800, delay: 2200 });

            this.input.keyboard.on('keydown-R', () => {
                gameState.reset();
                this.scene.stop('HUDScene');
                this.scene.start('Room1Scene');
                this.scene.launch('HUDScene');
            });
        });
    }

    // Boss房死亡：重启场景
    _handleDeath() {
        this.time.delayedCall(1500, () => {
            if (this.player) this.player.cleanup();
            if (this.boss && this.boss.cleanup) this.boss.cleanup();
            // 重启前必须重置 gameState，否则重启后 gameOver=true 导致玩家无法操作
            gameState.gameOver = false;
            gameState.bossActive = false;
            this.scene.restart();
        });
    }
}
