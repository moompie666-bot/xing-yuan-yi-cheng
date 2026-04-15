// ============================================================
// Boss.js — 相位监察者 Boss（前摇优化+难度调整版）
// ============================================================

import { BOSS, COLORS, DEPTH, ENTITY_SCALE } from '../utils/Constants.js';
import { Effects } from '../utils/Effects.js';
import gameState from '../managers/GameState.js';
import audioManager from '../managers/AudioManager.js';

const Phase = { P1: 1, P2: 2, P3: 3 };
const BState = {
    IDLE: 'idle',
    CHARGE_WINDUP: 'charge_windup',
    CHARGE: 'charge',
    SHOOT_WINDUP: 'shoot_windup',
    SHOOT: 'shoot',
    TELEPORT_WINDUP: 'teleport_windup',
    TELEPORT: 'teleport',
    HIT: 'hit',
    DEAD: 'dead',
};

export class Boss extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'boss');
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setDepth(DEPTH.ENEMIES);
        this._baseScale = ENTITY_SCALE.BOSS;
        this.setScale(this._baseScale);
        // Boss 图片1024×1024，显示约80px，碰撞体设为实际角色轮廓的约55%
        // 即 1024 * 0.55 = 563，居中偏移 (1024-563)/2 ≈ 230
        this.body.setSize(560, 700);
        this.body.setOffset(232, 200);
        this.setCollideWorldBounds(true);
        this.body.setMaxVelocity(500, 800);

        this.hp = BOSS.MAX_HP;
        this.maxHp = BOSS.MAX_HP;
        this.phase = Phase.P1;
        this.state = BState.IDLE;
        this.target = null;

        // 计时器
        this.attackCooldown = 2500; // 开场等待（加长）
        this.stateTimer = 0;
        this.shootCount = 0;
        this.shootTimer = 0;
        this.invincible = false;
        this._lastAttack = ''; // 防止连续相同攻击

        // 子弹组
        this.bullets = scene.physics.add.group({
            defaultKey: 'bullet_boss',
            maxSize: 30,
        });

        // 瞬移目标
        this.teleportTarget = { x: 0, y: 0 };

        // 视觉引用
        this._windupIndicator = null;
        this._teleportWarning = null;
        this._chargeTrail = null;

        // 初始化 gameState
        gameState.startBoss(BOSS.MAX_HP);
    }

    setTarget(player) {
        this.target = player;
    }

    update(time, delta) {
        if (this.state === BState.DEAD || !this.active) return;

        const dt = delta;

        switch (this.state) {
            case BState.IDLE:
                this._idleUpdate(dt);
                break;
            case BState.CHARGE_WINDUP:
                this._chargeWindupUpdate(dt);
                break;
            case BState.CHARGE:
                this._chargeUpdate(dt);
                break;
            case BState.SHOOT_WINDUP:
                this._shootWindupUpdate(dt);
                break;
            case BState.SHOOT:
                this._shootUpdate(dt);
                break;
            case BState.TELEPORT_WINDUP:
                this._teleportWindupUpdate(dt);
                break;
            case BState.TELEPORT:
                this._teleportUpdate(dt);
                break;
            case BState.HIT:
                this.stateTimer -= dt;
                this.body.setVelocityX(this.body.velocity.x * 0.92);
                if (this.stateTimer <= 0) this.state = BState.IDLE;
                break;
        }

        // 面向玩家
        if (this.target && this.state === BState.IDLE) {
            this.setFlipX(this.target.x < this.x);
        }

        // 清理越界子弹
        this.bullets.children.each(b => {
            if (b.active && (b.x < -100 || b.x > 2200 || b.y < -100 || b.y > 800)) {
                b.destroy();
            }
        });
    }

    // ---- IDLE ----
    _idleUpdate(dt) {
        this.attackCooldown -= dt;
        this.body.setVelocityX(0);

        if (this.attackCooldown <= 0) {
            this._chooseAttack();
        }
    }

    _chooseAttack() {
        const attacks = ['charge'];
        if (this.phase >= Phase.P2) attacks.push('shoot');
        if (this.phase >= Phase.P3) attacks.push('teleport');

        // 避免连续相同攻击
        let pick;
        let attempts = 0;
        do {
            pick = attacks[Math.floor(Math.random() * attacks.length)];
            attempts++;
        } while (pick === this._lastAttack && attacks.length > 1 && attempts < 5);

        this._lastAttack = pick;

        switch (pick) {
            case 'charge': this._startCharge(); break;
            case 'shoot': this._startShoot(); break;
            case 'teleport': this._startTeleport(); break;
        }
    }

    // ---- 冲撞 ----
    _startCharge() {
        this.state = BState.CHARGE_WINDUP;
        this.stateTimer = BOSS.CHARGE_WINDUP;
        this.invincible = false;

        this.setTint(COLORS.BOSS_CHARGE);

        const dir = this.target ? (this.target.x > this.x ? 1 : -1) : 1;
        const bs = this._baseScale;

        // 前摇抖动（原地颤抖，蓄力感）
        this.scene.tweens.add({
            targets: this, x: this.x + dir * 4,
            duration: 50, yoyo: true,
            repeat: Math.floor(BOSS.CHARGE_WINDUP / 100) - 1,
            ease: 'Sine.easeInOut',
        });

        // 身体向后压缩（蓄力压缩）
        this.scene.tweens.add({
            targets: this,
            scaleX: bs * 0.78, scaleY: bs * 1.18,
            duration: BOSS.CHARGE_WINDUP * 0.7, ease: 'Power2',
        });

        // 方向性冲锋指示线（升级版）
        Effects.createChargeIndicator(this.scene, this.x, this.y, dir, 500, BOSS.CHARGE_WINDUP);

        // 地面危险区域
        const dangerX = this.x + dir * 250;
        Effects.createDangerZone(
            this.scene, dangerX, this.y + 35,
            500, 24, BOSS.CHARGE_WINDUP, 0xff2222
        );
    }

    _chargeWindupUpdate(dt) {
        this.stateTimer -= dt;
        this.body.setVelocityX(0);
        if (this.stateTimer <= 0) {
            if (this._windupIndicator) { this._windupIndicator.destroy(); this._windupIndicator = null; }
            this.state = BState.CHARGE;
            this.stateTimer = BOSS.CHARGE_DURATION;
            const dir = this.target ? (this.target.x > this.x ? 1 : -1) : 1;
            this.body.setVelocityX(BOSS.CHARGE_SPEED * dir);

            // 冲出瞬间：水平拉伸
            const bs = this._baseScale;
            this.setScale(bs * 1.4, bs * 0.7);
            if (this.scene) {
                this.scene.tweens.add({
                    targets: this, scaleX: bs, scaleY: bs,
                    duration: 120, ease: 'Power1',
                });
            }
            audioManager.play('boss_charge');
        }
    }

    _chargeUpdate(dt) {
        this.stateTimer -= dt;

        // 冲撞残影（每两帧一个）
        if (Math.random() > 0.3) {
            Effects.createAfterimage(this.scene, this.x, this.y, 'boss', COLORS.BOSS_CHARGE, 0.35);
        }

        if (this.stateTimer <= 0 || this.body.blocked.left || this.body.blocked.right) {
            this.body.setVelocityX(0);
            this.clearTint();
            const bs = this._baseScale;
            this.setScale(bs);
            this.state = BState.IDLE;
            this.attackCooldown = this._getCooldown();

            if (this.body.blocked.left || this.body.blocked.right) {
                // 撞墙：强烈震动 + 眩晕
                Effects.shakeBoss(this.scene.cameras.main);
                Effects.spawnParticles(this.scene, this.x, this.y, 0xff4444, 8, 130);
                this.state = BState.HIT;
                this.stateTimer = 500;
            }
        }
    }

    // ---- 射击 ----
    _startShoot() {
        this.state = BState.SHOOT_WINDUP;
        this.stateTimer = BOSS.SHOOT_WINDUP;
        this.setTint(COLORS.BOSS_SHOOT);

        // 升级：收缩能量环（从外向内聚拢）
        Effects.createShootWindup(this.scene, this.x, this.y, BOSS.SHOOT_WINDUP);

        // 身体变大（充能感）
        const bs = this._baseScale;
        this.scene.tweens.add({
            targets: this, scaleX: bs * 1.12, scaleY: bs * 1.12,
            duration: BOSS.SHOOT_WINDUP * 0.8, ease: 'Power2',
        });
    }

    _shootWindupUpdate(dt) {
        this.stateTimer -= dt;
        this.body.setVelocityX(0);
        if (this.stateTimer <= 0) {
            this.state = BState.SHOOT;
            this.shootCount = this.phase >= Phase.P3 ? BOSS.SHOOT_COUNT + 2 : BOSS.SHOOT_COUNT;
            this.shootTimer = 0;
            // 射击开始时恢复大小
            const bs = this._baseScale;
            if (this.scene) this.scene.tweens.add({ targets: this, scaleX: bs, scaleY: bs, duration: 80 });
        }
    }

    _shootUpdate(dt) {
        this.shootTimer -= dt;
        if (this.shootTimer <= 0 && this.shootCount > 0) {
            this._fireBullet();
            this.shootCount--;
            this.shootTimer = BOSS.SHOOT_INTERVAL;
        }
        if (this.shootCount <= 0 && this.shootTimer <= 0) {
            this.clearTint();
            this.state = BState.IDLE;
            this.attackCooldown = this._getCooldown();
        }
    }

    _fireBullet() {
        if (!this.target) return;
        const angle = Phaser.Math.Angle.Between(this.x, this.y, this.target.x, this.target.y);
        const spread = (Math.random() - 0.5) * 0.25; // 减少散布
        const finalAngle = angle + spread;

        const bx = this.x + Math.cos(finalAngle) * 35;
        const by = this.y + Math.sin(finalAngle) * 35;
        const bullet = this.bullets.get(bx, by, 'bullet_boss');
        if (bullet) {
            bullet.setActive(true).setVisible(true);
            bullet.setDepth(DEPTH.PROJECTILES);
            bullet.setScale(ENTITY_SCALE.BULLET_BOSS);
            bullet.body.setAllowGravity(false);
            bullet.body.setVelocity(
                Math.cos(finalAngle) * BOSS.BULLET_SPEED,
                Math.sin(finalAngle) * BOSS.BULLET_SPEED
            );
            bullet.damage = BOSS.SHOOT_DAMAGE;

            const sceneRef = this.scene;
            sceneRef.time.delayedCall(4000, () => {
                if (bullet && bullet.active && bullet.body) {
                    bullet.setActive(false).setVisible(false);
                    bullet.body.setVelocity(0, 0);
                }
            });
        }

        // 枪口火花
        Effects.spawnParticles(this.scene, bx, by, COLORS.BULLET_BOSS, 3, 40);
        audioManager.play('boss_shoot');
    }

    // ---- 瞬移突进 ----
    _startTeleport() {
        this.state = BState.TELEPORT_WINDUP;
        this.stateTimer = BOSS.TELEPORT_WINDUP;

        this.teleportTarget.x = this.target ? this.target.x : this.x;
        this.teleportTarget.y = this.target ? this.target.y : this.y;

        // 前摇：高频闪烁（消失感）
        this.scene.tweens.add({
            targets: this, alpha: 0.15, duration: 70, yoyo: true,
            repeat: Math.floor(BOSS.TELEPORT_WINDUP / 140) - 1,
        });

        // 升级：目标位置十字+圆警告
        Effects.createTeleportWarning(this.scene, this.teleportTarget.x, this.teleportTarget.y - 20, BOSS.TELEPORT_WINDUP);
    }

    _teleportWindupUpdate(dt) {
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
            // 消失粒子爆发
            Effects.spawnParticles(this.scene, this.x, this.y, 0xff55ff, 8, 130);

            this.setPosition(this.teleportTarget.x, this.teleportTarget.y - 30);
            this.body.reset(this.x, this.y);
            this.setAlpha(1);

            // 出现冲击
            Effects.spawnParticles(this.scene, this.x, this.y, 0xff55ff, 8, 130);
            Effects.hitSparkBoss(this.scene, this.x, this.y, 0);
            Effects.shakeHeavy(this.scene.cameras.main);

            this.state = BState.TELEPORT;
            this.stateTimer = BOSS.TELEPORT_ATTACK_DURATION;
            this.setTint(0xff00ff);
            audioManager.play('boss_teleport');
        }
    }

    _teleportUpdate(dt) {
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
            this.clearTint();
            this.setAlpha(1);
            this.state = BState.IDLE;
            this.attackCooldown = this._getCooldown();
        }
    }

    // ---- 受击 ----
    takeDamage(amount) {
        if (this.state === BState.DEAD || this.invincible) return;

        this.hp -= amount;
        gameState.updateBossHp(this.hp);

        // Boss 受击：蓝色闪光 + Boss级火花 + hitstop
        Effects.flashBlue(this, BOSS.HIT_FLASH_DURATION);
        Effects.hitstopBoss(this.scene);
        Effects.hitSparkBoss(this.scene, this.x, this.y, 0);
        audioManager.play('boss_hit');

        // 阶段切换检查
        const ratio = this.hp / this.maxHp;
        if (this.phase === Phase.P1 && ratio <= BOSS.PHASE2_THRESHOLD) {
            this._enterPhase(Phase.P2);
        } else if (this.phase === Phase.P2 && ratio <= BOSS.PHASE3_THRESHOLD) {
            this._enterPhase(Phase.P3);
        }

        if (this.hp <= 0) {
            this._die();
            return;
        }

        // 受击打断（仅在idle时）
        if (this.state === BState.IDLE) {
            this.state = BState.HIT;
            this.stateTimer = BOSS.HIT_STUN;
            const bs = this._baseScale;
            // 受击压缩弹跳
            if (this.scene) {
                this.scene.tweens.add({
                    targets: this,
                    scaleX: bs * 0.82, scaleY: bs * 1.15,
                    duration: 40, yoyo: true, ease: 'Power3',
                    onComplete: () => { if (this.active) this.setScale(bs); },
                });
            }
        }
    }

    _enterPhase(phase) {
        this.phase = phase;
        this.invincible = true;

        // 阶段切换：全屏冲击
        Effects.phaseShiftFlash(this.scene, this.scene.cameras.main);
        Effects.spawnParticles(this.scene, this.x, this.y, COLORS.BOSS_CORE, 10, 220);

        // Boss 身体脉冲扩大再复原
        const bs = this._baseScale;
        if (this.scene) {
            this.scene.tweens.add({
                targets: this, scaleX: bs * 1.5, scaleY: bs * 1.5, alpha: 0.3,
                duration: 200, ease: 'Power2',
                yoyo: true,
                onComplete: () => { if (this.active) { this.setScale(bs); this.setAlpha(1); } },
            });
        }

        this.body.setVelocity(0, 0);
        this.state = BState.IDLE;
        this.attackCooldown = 1800;

        // 颜色变化
        const phaseColors = { [Phase.P2]: 0xff3366, [Phase.P3]: 0xff0000 };
        this.setTint(phaseColors[phase] || COLORS.BOSS_BODY);

        const sceneRef = this.scene;
        sceneRef.time.delayedCall(1000, () => {
            if (this.active && this.scene) {
                this.invincible = false;
                this.clearTint();
            }
        });

        this.scene.events.emit('boss-phase-change', phase);
    }

    _die() {
        this.state = BState.DEAD;
        this.body.setVelocity(0, 0);
        this.body.setAllowGravity(false);

        gameState.updateBossHp(0);
        gameState.endBoss();

        Effects.screenShake(this.scene.cameras.main, 600, 0.018);

        let explodeCount = 0;
        const explodeInterval = this.scene.time.addEvent({
            delay: 130,
            repeat: 10,
            callback: () => {
                if (!this.scene) return;
                const ox = this.x + (Math.random() - 0.5) * 70;
                const oy = this.y + (Math.random() - 0.5) * 70;
                Effects.deathExplosion(this.scene, ox, oy, COLORS.BOSS_CORE, 10);
                explodeCount++;
            },
        });

        this.scene.tweens.add({
            targets: this, alpha: 0, scaleX: 0.3, scaleY: 0.3,
            duration: 1800, ease: 'Power2',
            onComplete: () => {
                if (this.scene) this.scene.events.emit('boss-defeated');
                this.destroy();
            },
        });

        this.bullets.clear(true, true);
        audioManager.play('boss_death');
    }

    _getCooldown() {
        const base = BOSS.ATTACK_COOLDOWN_BASE;
        switch (this.phase) {
            case Phase.P1: return base;
            case Phase.P2: return base * 0.75;
            case Phase.P3: return base * 0.55;
            default: return base;
        }
    }

    cleanup() {
        this.bullets.clear(true, true);
        if (this._windupIndicator) { this._windupIndicator.destroy(); this._windupIndicator = null; }
        if (this._teleportWarning) { this._teleportWarning.destroy(); this._teleportWarning = null; }
    }
}
