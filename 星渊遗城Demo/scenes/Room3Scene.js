// ============================================================
// Room3Scene.js — 房间3：战斗区
// ============================================================

import { GAME_HEIGHT, ROOM_WIDTH, COLORS, DEPTH, PLAYER as PC } from '../utils/Constants.js';
import { BaseRoomScene } from './BaseRoomScene.js';
import { MeleeEnemy } from '../entities/MeleeEnemy.js';
import { RangedEnemy } from '../entities/RangedEnemy.js';
import { FlyingEnemy } from '../entities/FlyingEnemy.js';
import { Effects } from '../utils/Effects.js';
import checkpointManager from '../managers/CheckpointManager.js';
import gameState from '../managers/GameState.js';

export class Room3Scene extends BaseRoomScene {
    constructor() {
        super({ key: 'Room3Scene' });
    }

    getRoomConfig() {
        return {
            worldWidth: ROOM_WIDTH,
            nextScene: 'Room4Scene',
            bgStarCount: 60,
            bgStarColorSet: [COLORS.STAR, COLORS.STAR_DIM],
            bgGlowColor: 0x331111,
            bgGlowAlpha: 0.10,
            neonLines: [
                { x: 250,  y: GAME_HEIGHT - 200, length: 50, vertical: true,  color: 0xff3344 },
                { x: 800,  y: GAME_HEIGHT - 280, length: 40, vertical: false, color: 0xff6644 },
                { x: 1400, y: GAME_HEIGHT - 220, length: 45, vertical: true,  color: 0xff3344 },
            ],
            initialCheckpoint: { x: 100, y: GAME_HEIGHT - 80 },
        };
    }

    buildRoom() {
        this._addPlatform(0,    GAME_HEIGHT - 32,  ROOM_WIDTH, 32);
        this._addPlatform(200,  GAME_HEIGHT - 140, 160, 16);
        this._addPlatform(500,  GAME_HEIGHT - 200, 128, 16);
        this._addPlatform(750,  GAME_HEIGHT - 130, 160, 16);
        this._addPlatform(1000, GAME_HEIGHT - 200, 128, 16);
        this._addPlatform(1250, GAME_HEIGHT - 140, 160, 16);
        this._addPlatform(1500, GAME_HEIGHT - 180, 128, 16);
        this._addPlatform(1750, GAME_HEIGHT - 120, 160, 16);

        this._addHintText(200, GAME_HEIGHT - 80, '⚠ 战斗区域 — 消灭敌人前进', '#ff6644');
    }

    onPlayerCreated() {
        this.enemies = [];

        const m1 = new MeleeEnemy(this, 400,  GAME_HEIGHT - 70, 300,  600);
        const m2 = new MeleeEnemy(this, 1300, GAME_HEIGHT - 70, 1200, 1500);
        const r1 = new RangedEnemy(this, 900,  GAME_HEIGHT - 70, 800,  1000);
        const f1 = new FlyingEnemy(this, 700,  GAME_HEIGHT - 300);

        this.enemies.push(m1, m2, r1, f1);
        this.enemies.forEach(e => {
            e.setTarget(this.player);
            this.physics.add.collider(e, this.platforms);
        });

        // 接触伤害冷却计时器
        this._contactDamageTimers = new Map();
        this.enemies.forEach(e => this._contactDamageTimers.set(e, 0));

        // 检查点
        this._addCheckpoint(100, GAME_HEIGHT - 52, 'Room3Scene', 100, GAME_HEIGHT - 80);
        const cp = gameState.getCheckpoint();
        if (cp.scene !== 'Room3Scene') {
            checkpointManager.activate('Room3Scene', 100, GAME_HEIGHT - 80);
        }
    }

    onUpdate(time, delta) {
        const player = this.player;
        if (!player || !player.active) return;

        // 更新敌人
        this.enemies.forEach(e => {
            if (e.active) e.update(time, delta);
        });

        // 接触伤害冷却
        this._contactDamageTimers.forEach((val, key) => {
            if (val > 0) this._contactDamageTimers.set(key, val - delta);
        });

        // ---- 玩家子弹 vs 敌人 ----
        player.bullets.children.each(bullet => {
            if (!bullet.active || !bullet.body) return;
            for (const enemy of this.enemies) {
                if (!enemy.active || enemy.state === 'dead' || !enemy.body) continue;
                if (this._rectOverlap(bullet, enemy)) {
                    // 先停用子弹，再处理伤害，防止同帧多次命中
                    bullet.setActive(false).setVisible(false);
                    bullet.body.setVelocity(0, 0);
                    const dmg = bullet.damage || PC.RANGED_DAMAGE;
                    const dir = enemy.x > player.x ? 1 : -1;
                    Effects.hitSpark(this, bullet.x, bullet.y, COLORS.BULLET_PLAYER, dir);
                    if (enemy.active && enemy.state !== 'dead') {
                        enemy.takeDamage(dmg, dir);
                    }
                    break; // 一颗子弹只命中一个敌人
                }
            }
        });

        // ---- 敌人子弹 vs 玩家 ----
        this.enemies.forEach(enemy => {
            if (!enemy.bullets) return;
            enemy.bullets.children.each(bullet => {
                if (!bullet.active || !bullet.body) return;
                if (this._rectOverlap(bullet, player)) {
                    bullet.setActive(false).setVisible(false);
                    bullet.body.setVelocity(0, 0);
                    const dir = player.x < bullet.x ? -1 : 1;
                    player.takeDamage(bullet.damage || 10, dir);
                }
            });
        });

        // ---- 接触伤害（距离检测，避免大body误触）----
        this.enemies.forEach(e => {
            if (!e.active || e.state === 'dead') return;
            const timer = this._contactDamageTimers.get(e) || 0;
            if (timer > 0) return;
            const dist = Phaser.Math.Distance.Between(player.x, player.y, e.x, e.y);
            if (dist < 36) {
                const dir = player.x < e.x ? -1 : 1;
                player.takeDamage(e.damage, dir);
                this._contactDamageTimers.set(e, 600);
            }
        });

        // ---- 近战 hitbox vs 敌人 ----
        if (player.meleeHitbox && player.meleeHitbox.body) {
            for (const e of this.enemies) {
                if (!e.active || e.state === 'dead' || !e.body) continue;
                if (player.hasMeleeHit(e)) continue;
                if (this._rectOverlap(player.meleeHitbox, e)) {
                    player.markMeleeHit(e);
                    const dir = e.x > player.x ? 1 : -1;
                    const isFinisher = player._comboCount === 3;
                    if (isFinisher) {
                        // 第三击重击：重级打击感
                        Effects.hitSparkHeavy(this, e.x - dir * 8, e.y, dir);
                        Effects.hitstopHeavy(this);
                        Effects.shakeHeavy(this.cameras.main);
                    } else {
                        // 第1/2击：轻击
                        Effects.hitSpark(this, e.x - dir * 8, e.y, COLORS.NEON_CYAN, dir);
                        Effects.hitstopLight(this);
                        Effects.shakeLight(this.cameras.main);
                    }
                    const dmg = isFinisher ? PC.MELEE_DAMAGE * 1.5 : PC.MELEE_DAMAGE;
                    if (e.active && e.state !== 'dead') {
                        e.takeDamage(dmg, dir);
                    }
                }
            }
        }
    }

    /** 简单 AABB 重叠检测（基于 body 坐标） */
    _rectOverlap(a, b) {
        if (!a || !b || !a.body || !b.body) return false;
        const ab = a.body, bb = b.body;
        return ab.x < bb.x + bb.width  &&
               ab.x + ab.width  > bb.x &&
               ab.y < bb.y + bb.height &&
               ab.y + ab.height > bb.y;
    }

    // Room3 死亡后重启场景
    _handleDeath() {
        this.time.delayedCall(1500, () => {
            this.player.cleanup();
            this.scene.restart();
        });
    }
}
