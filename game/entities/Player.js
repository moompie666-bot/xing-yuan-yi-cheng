// ============================================================
// Player.js — 玩家角色控制器（手感优化版）
// ============================================================

import { PLAYER, COLORS, DEPTH, ENTITY_SCALE } from '../utils/Constants.js';
import { Effects } from '../utils/Effects.js';
import gameState from '../managers/GameState.js';
import audioManager from '../managers/AudioManager.js';

// 状态枚举
const S = {
    IDLE: 'idle',
    RUN: 'run',
    JUMP: 'jump',
    FALL: 'fall',
    DASH: 'dash',
    WALL_SLIDE: 'wall_slide',
    ATTACK_MELEE: 'attack_melee',
    ATTACK_RANGED: 'attack_ranged',
    HIT: 'hit',
    DEAD: 'dead',
};

export class Player extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'player');
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setDepth(DEPTH.PLAYER);
        this._baseScale = ENTITY_SCALE.PLAYER;
        this.setScale(this._baseScale);
        this.setCollideWorldBounds(true);
        // body.setSize 参数是原始纹理像素（1024），不受 setScale 影响
        // 设为接近全尺寸，让碰撞体覆盖整个显示区域
        this.body.setSize(900, 960);
        this.body.setOffset(62, 40);   // 居中对齐
        this.setMaxVelocity(600, 800);

        // ---- 状态 ----
        this.state = S.IDLE;
        this.facingRight = true;

        // ---- 输入 ----
        this.cursors = scene.input.keyboard.createCursorKeys();
        this.keys = scene.input.keyboard.addKeys({
            jump: Phaser.Input.Keyboard.KeyCodes.Z,
            jump2: Phaser.Input.Keyboard.KeyCodes.SPACE,
            melee: Phaser.Input.Keyboard.KeyCodes.X,
            ranged: Phaser.Input.Keyboard.KeyCodes.C,
            dash: Phaser.Input.Keyboard.KeyCodes.SHIFT,
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
        });

        // ---- 计时器 ----
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        this.dashTimer = 0;
        this.dashCooldownTimer = 0;
        this.dashAfterimageTimer = 0;
        this.meleeCooldownTimer = 0;
        this.rangedCooldownTimer = 0;
        this.hitTimer = 0;
        this.invincibleTimer = 0;
        this.wallJumpLockTimer = 0;

        // ---- 标志 ----
        this.canDoubleJump = true;
        this.touchingWallSide = 0; // -1 左, 0 无, 1 右
        this.wasOnFloor = false;
        this.prevVelocityY = 0; // 记录上一帧Y速度（落地反馈用）

        // ---- 子弹组 ----
        this.bullets = scene.physics.add.group({
            defaultKey: 'bullet_player',
            maxSize: 20,
        });

        // ---- 近战 hitbox ----
        this.meleeHitbox = null;
        this._meleeHitTargets = new Set(); // 防止同一次攻击多次命中

        // ---- 连击状态 ----
        this._comboCount = 0;          // 当前连击数 (1~3)
        this._comboWindowActive = false; // 是否在连击接受窗口内
        this._comboWindowTimer = 0;    // 连击窗口剩余时间(ms)

        // ---- 程序化腿部动画 ----
        this._legL = scene.add.rectangle(x, y + 28, 5, 10, COLORS.PLAYER_DASH, 0.8);
        this._legR = scene.add.rectangle(x, y + 28, 5, 10, COLORS.PLAYER_DASH, 0.8);
        this._legL.setDepth(DEPTH.PLAYER - 1);
        this._legR.setDepth(DEPTH.PLAYER - 1);
        this._legTime = 0;

        // ---- 程序化手部动画 ----
        // 主武器手（右手/左手，持剑）：粗短矩形
        this._armWeapon = scene.add.rectangle(x, y, 6, 14, COLORS.PLAYER_CORE, 0.9);
        this._armWeapon.setDepth(DEPTH.PLAYER + 1);
        // 剑刃（从武器手延伸的细长矩形）
        this._sword = scene.add.rectangle(x, y, 3, 22, COLORS.NEON_CYAN, 0.85);
        this._sword.setDepth(DEPTH.PLAYER + 1);
        // 副手（左手/右手）：辅助平衡臂
        this._armOff = scene.add.rectangle(x, y, 5, 10, COLORS.PLAYER_BODY, 0.7);
        this._armOff.setDepth(DEPTH.PLAYER - 1);
        // 武器能量光效（剑尖高亮圆点）
        this._swordTip = scene.add.circle(x, y, 3, COLORS.NEON_CYAN, 0.9);
        this._swordTip.setDepth(DEPTH.PLAYER + 2);
        this._armTime = 0; // 待机摇摆计时
    }

    // ----------------------------------------------------------------
    // 主更新
    // ----------------------------------------------------------------
    update(time, delta) {
        const dt = delta;

        if (this.state === S.DEAD) return;

        // 更新计时器
        this.dashCooldownTimer = Math.max(0, this.dashCooldownTimer - dt);
        this.meleeCooldownTimer = Math.max(0, this.meleeCooldownTimer - dt);
        this.rangedCooldownTimer = Math.max(0, this.rangedCooldownTimer - dt);
        this.invincibleTimer = Math.max(0, this.invincibleTimer - dt);
        this.wallJumpLockTimer = Math.max(0, this.wallJumpLockTimer - dt);

        // 连击窗口倒计时（IDLE/RUN/FALL/JUMP 状态下计时，超时则重置连击）
        if (this._comboWindowTimer > 0) {
            this._comboWindowTimer -= dt;
            if (this._comboWindowTimer <= 0) {
                this._comboWindowTimer = 0;
                this._comboWindowActive = false;
                this._comboCount = 0;
            }
        }

        // 闪烁表现无敌
        if (this.invincibleTimer > 0) {
            this.setAlpha(Math.sin(time * 0.02) > 0 ? 0.3 : 1);
        } else {
            this.setAlpha(1);
        }

        // 能量自然回复
        gameState.regenEnergy(PLAYER.ENERGY_REGEN * dt / 1000);

        const onFloor = this.body.blocked.down || this.body.touching.down;

        // ---- 落地检测与反馈 ----
        if (onFloor && !this.wasOnFloor) {
            this._onLanding();
        }

        // Coyote time
        if (onFloor) {
            this.coyoteTimer = PLAYER.COYOTE_TIME;
            this.canDoubleJump = true;
        } else {
            this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
        }

        // 记录上帧状态
        this.prevVelocityY = this.body.velocity.y;
        this.wasOnFloor = onFloor;

        // 墙壁检测
        this.touchingWallSide = 0;
        if (this.body.blocked.left) this.touchingWallSide = -1;
        if (this.body.blocked.right) this.touchingWallSide = 1;

        // Jump buffer
        const jumpPressed = Phaser.Input.Keyboard.JustDown(this.keys.jump) ||
            Phaser.Input.Keyboard.JustDown(this.keys.jump2) ||
            Phaser.Input.Keyboard.JustDown(this.cursors.up);

        if (jumpPressed) {
            this.jumpBufferTimer = PLAYER.JUMP_BUFFER;
        } else {
            this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
        }

        // ---- 状态机 ----
        switch (this.state) {
            case S.IDLE:
            case S.RUN:
                this._handleGroundState(dt, onFloor, jumpPressed);
                break;
            case S.JUMP:
            case S.FALL:
                this._handleAirState(dt, onFloor, jumpPressed);
                break;
            case S.DASH:
                this._handleDash(dt);
                break;
            case S.WALL_SLIDE:
                this._handleWallSlide(dt, jumpPressed);
                break;
            case S.ATTACK_MELEE:
                this._handleMeleeState(dt, onFloor);
                break;
            case S.ATTACK_RANGED:
                this._handleRangedState(dt, onFloor);
                break;
            case S.HIT:
                this._handleHitState(dt);
                break;
        }

        // 更新子弹（越界时停用，不直接 destroy）
        this.bullets.children.each(b => {
            if (b.active && (b.x < -50 || b.x > this.scene.physics.world.bounds.width + 50 ||
                b.y < -50 || b.y > this.scene.physics.world.bounds.height + 50)) {
                b.setActive(false).setVisible(false);
                b.body.setVelocity(0, 0);
            }
        });

        // 腿部动画更新
        this._updateLegs(time, delta);
        // 手部动画更新
        this._updateArms(time, delta);
    }

    // ----------------------------------------------------------------
    // 程序化腿部动画
    // ----------------------------------------------------------------
    _updateLegs(time, delta) {
        if (!this._legL || !this._legR) return;

        const bs = this._baseScale;
        // 角色显示半高（56px * scale * 0.5 ≈ 28px）
        const halfH = 1024 * bs * 0.45;
        const footY = this.y + halfH * 0.72;
        const spacing = 1024 * bs * 0.14; // 两腿间距

        const isVisible = this.state !== S.DEAD &&
            this.state !== S.DASH &&
            this.alpha > 0.1;

        if (!isVisible) {
            this._legL.setVisible(false);
            this._legR.setVisible(false);
            return;
        }

        this._legL.setVisible(true);
        this._legR.setVisible(true);
        this._legL.setAlpha(this.alpha * 0.85);
        this._legR.setAlpha(this.alpha * 0.85);

        const speed = Math.abs(this.body.velocity.x);
        const onFloor = this.body.blocked.down || this.body.touching.down;

        if (this.state === S.RUN || (speed > 30 && onFloor)) {
            // 跑步：两腿交替摆动
            this._legTime += delta;
            const cycleMs = Math.max(120, 300 - speed * 0.4); // 速度越快摆腿越快
            const phase = (this._legTime % cycleMs) / cycleMs; // 0~1
            const swing = Math.sin(phase * Math.PI * 2);       // -1~1

            const legLen = 1024 * bs * 0.22;
            const maxSwing = 1024 * bs * 0.14;

            // 左腿
            this._legL.setSize(4, legLen);
            this._legL.setPosition(this.x - spacing, footY + swing * maxSwing * 0.5);
            this._legL.setRotation(swing * 0.35);
            // 右腿（反相）
            this._legR.setSize(4, legLen);
            this._legR.setPosition(this.x + spacing, footY - swing * maxSwing * 0.5);
            this._legR.setRotation(-swing * 0.35);

            // 跑步时脚底有轻微上下弹动感
            const bounce = Math.abs(Math.sin(phase * Math.PI * 2)) * 1024 * bs * 0.03;
            this._legL.y -= bounce;
            this._legR.y -= bounce;

        } else if (!onFloor) {
            // 空中：腿向后收拢（跳跃姿势）
            this._legTime = 0;
            const legLen = 1024 * bs * 0.18;
            const tuck = this.body.velocity.y < 0 ? 0.3 : -0.2; // 上升时收，下落时微伸
            this._legL.setSize(4, legLen);
            this._legR.setSize(4, legLen);
            this._legL.setPosition(this.x - spacing * 0.7, footY - 1024 * bs * 0.04);
            this._legR.setPosition(this.x + spacing * 0.7, footY - 1024 * bs * 0.04);
            this._legL.setRotation(tuck);
            this._legR.setRotation(-tuck);

        } else {
            // 待机：腿垂直站立，轻微呼吸摆动
            this._legTime += delta;
            const idle = Math.sin(this._legTime / 600) * 0.04;
            const legLen = 1024 * bs * 0.20;
            this._legL.setSize(4, legLen);
            this._legR.setSize(4, legLen);
            this._legL.setPosition(this.x - spacing, footY);
            this._legR.setPosition(this.x + spacing, footY);
            this._legL.setRotation(idle);
            this._legR.setRotation(-idle);
        }

        // 颜色跟随朝向（冲刺时变亮）
        const legColor = this.state === S.DASH ? COLORS.NEON_CYAN : COLORS.PLAYER_DASH;
        this._legL.setFillStyle(legColor);
        this._legR.setFillStyle(legColor);
    }

    // ----------------------------------------------------------------
    // 程序化手部/武器动画
    // ----------------------------------------------------------------
    _updateArms(time, delta) {
        if (!this._armWeapon || !this._sword) return;

        const bs = this._baseScale;
        const px = this.x;
        const py = this.y;
        const dir = this.facingRight ? 1 : -1;

        // 角色身体中心偏上（胸部位置）
        const bodyW = 1024 * bs * 0.28;
        const bodyH = 1024 * bs * 0.5;

        // 是否可见
        const isVisible = this.state !== S.DEAD && this.alpha > 0.1;
        [this._armWeapon, this._sword, this._armOff, this._swordTip].forEach(obj => {
            if (obj) obj.setVisible(isVisible).setAlpha(isVisible ? this.alpha * 0.9 : 0);
        });
        if (!isVisible) return;

        this._armTime += delta;

        // ---- 武器手位置基准（身体侧前方）----
        const wBaseX = px + dir * bodyW * 0.55;
        const wBaseY = py - bodyH * 0.05;

        // ---- 副手位置基准（对侧，后方）----
        const oBaseX = px - dir * bodyW * 0.45;
        const oBaseY = py - bodyH * 0.08;

        switch (this.state) {
            case S.IDLE: {
                // 待机：持剑斜向下，微微前倾呼吸感
                const breathe = Math.sin(this._armTime / 700) * 0.06;
                const swordRot = dir * (0.35 + breathe);

                this._armWeapon.setPosition(wBaseX, wBaseY + 4);
                this._armWeapon.setRotation(swordRot);
                this._armWeapon.setSize(6, 14);

                this._sword.setPosition(
                    wBaseX + Math.sin(swordRot) * 14,
                    wBaseY + 4 + Math.cos(swordRot) * 10
                );
                this._sword.setRotation(swordRot);
                this._sword.setSize(3, 22);

                this._swordTip.setPosition(
                    wBaseX + Math.sin(swordRot) * 24,
                    wBaseY + 4 + Math.cos(swordRot) * 18
                );

                this._armOff.setPosition(oBaseX, oBaseY + 2);
                this._armOff.setRotation(-dir * 0.18 + breathe);
                this._armOff.setSize(5, 10);
                break;
            }

            case S.RUN: {
                // 跑步：手臂前后摆动，剑跟随
                const runPhase = (this._armTime % 300) / 300;
                const swing = Math.sin(runPhase * Math.PI * 2);
                const swordRot = dir * (0.3 + swing * 0.3);

                this._armWeapon.setPosition(wBaseX + dir * swing * 5, wBaseY - swing * 3);
                this._armWeapon.setRotation(swordRot);
                this._armWeapon.setSize(6, 14);

                this._sword.setPosition(
                    wBaseX + dir * swing * 5 + Math.sin(swordRot) * 14,
                    wBaseY - swing * 3 + Math.cos(swordRot) * 10
                );
                this._sword.setRotation(swordRot);
                this._sword.setSize(3, 22);

                this._swordTip.setPosition(
                    wBaseX + dir * swing * 5 + Math.sin(swordRot) * 24,
                    wBaseY - swing * 3 + Math.cos(swordRot) * 18
                );

                this._armOff.setPosition(oBaseX - dir * swing * 4, oBaseY + swing * 3);
                this._armOff.setRotation(-dir * 0.15 - swing * 0.2);
                this._armOff.setSize(5, 10);
                break;
            }

            case S.JUMP: {
                // 起跳：剑向上举（拔剑姿势）
                const swordRot = dir * -0.4;
                this._armWeapon.setPosition(wBaseX, wBaseY - 6);
                this._armWeapon.setRotation(swordRot);
                this._armWeapon.setSize(6, 14);
                this._sword.setPosition(
                    wBaseX + Math.sin(swordRot) * 14,
                    wBaseY - 6 + Math.cos(swordRot) * 10
                );
                this._sword.setRotation(swordRot);
                this._sword.setSize(3, 22);
                this._swordTip.setPosition(
                    wBaseX + Math.sin(swordRot) * 24,
                    wBaseY - 6 + Math.cos(swordRot) * 18
                );
                this._armOff.setPosition(oBaseX, oBaseY - 4);
                this._armOff.setRotation(dir * 0.3);
                break;
            }

            case S.FALL: {
                // 下落：剑斜向下（俯冲感）
                const swordRot = dir * 0.6;
                this._armWeapon.setPosition(wBaseX, wBaseY + 6);
                this._armWeapon.setRotation(swordRot);
                this._armWeapon.setSize(6, 14);
                this._sword.setPosition(
                    wBaseX + Math.sin(swordRot) * 14,
                    wBaseY + 6 + Math.cos(swordRot) * 10
                );
                this._sword.setRotation(swordRot);
                this._sword.setSize(3, 22);
                this._swordTip.setPosition(
                    wBaseX + Math.sin(swordRot) * 24,
                    wBaseY + 6 + Math.cos(swordRot) * 18
                );
                this._armOff.setPosition(oBaseX, oBaseY + 4);
                this._armOff.setRotation(-dir * 0.15);
                break;
            }

            case S.DASH: {
                // 冲刺：剑向前平刺（穿刺姿势）
                const swordRot = 0;
                this._armWeapon.setPosition(px + dir * bodyW * 0.7, py);
                this._armWeapon.setRotation(dir * 0.1);
                this._armWeapon.setSize(6, 12);
                this._sword.setPosition(px + dir * bodyW * 0.7 + dir * 20, py);
                this._sword.setRotation(dir > 0 ? 1.5708 : -1.5708); // 水平
                this._sword.setSize(3, 26);
                this._swordTip.setPosition(px + dir * bodyW * 0.7 + dir * 34, py);
                this._armOff.setPosition(px - dir * bodyW * 0.3, py - 2);
                this._armOff.setRotation(dir * 0.6);
                // 冲刺时剑变亮蓝
                this._sword.setFillStyle(COLORS.NEON_CYAN);
                this._swordTip.setFillStyle(0xffffff);
                return; // 冲刺提前return，不重置颜色
            }

            case S.ATTACK_MELEE: {
                // 近战：根据连击段数显示不同姿势
                const combo = this._comboCount;
                let swordRot, armX, armY, swordX, swordY;

                if (combo === 1) {
                    // 横斩：剑水平前划
                    swordRot = dir > 0 ? 1.5708 : -1.5708;
                    armX = wBaseX + dir * 8; armY = wBaseY;
                    swordX = armX + dir * 20; swordY = armY;
                } else if (combo === 2) {
                    // 上挑：剑斜向上
                    swordRot = dir * -0.8;
                    armX = wBaseX; armY = wBaseY - 8;
                    swordX = armX + Math.sin(swordRot) * 14;
                    swordY = armY + Math.cos(swordRot) * 10;
                } else {
                    // 重击：剑大幅向前下砸
                    swordRot = dir * 0.9;
                    armX = wBaseX + dir * 10; armY = wBaseY + 4;
                    swordX = armX + Math.sin(swordRot) * 16;
                    swordY = armY + Math.cos(swordRot) * 12;
                }

                this._armWeapon.setPosition(armX, armY);
                this._armWeapon.setRotation(swordRot);
                this._armWeapon.setSize(7, combo === 3 ? 16 : 14);

                this._sword.setPosition(swordX, swordY);
                this._sword.setRotation(swordRot);
                this._sword.setSize(combo === 3 ? 4 : 3, combo === 3 ? 28 : 22);

                this._swordTip.setPosition(
                    swordX + Math.sin(swordRot) * (combo === 3 ? 18 : 14),
                    swordY + Math.cos(swordRot) * (combo === 3 ? 14 : 11)
                );
                // 重击时剑尖变红
                this._swordTip.setFillStyle(combo === 3 ? 0xff4444 : COLORS.NEON_CYAN);
                this._sword.setFillStyle(combo === 3 ? 0xffffff : COLORS.NEON_CYAN);

                this._armOff.setPosition(oBaseX, oBaseY);
                this._armOff.setRotation(combo === 3 ? dir * 0.5 : -dir * 0.2);
                return;
            }

            case S.HIT: {
                // 受击：手向后甩
                this._armWeapon.setPosition(px - dir * bodyW * 0.4, py - 4);
                this._armWeapon.setRotation(-dir * 0.8);
                this._armWeapon.setSize(6, 12);
                this._sword.setPosition(px - dir * bodyW * 0.4 - dir * 12, py - 2);
                this._sword.setRotation(-dir * 0.8);
                this._sword.setSize(3, 20);
                this._swordTip.setPosition(px - dir * bodyW * 0.4 - dir * 22, py);
                this._armOff.setPosition(oBaseX + dir * 8, oBaseY - 6);
                this._armOff.setRotation(dir * 0.4);
                break;
            }

            default: {
                // 其他状态：持剑待机
                const swordRot = dir * 0.35;
                this._armWeapon.setPosition(wBaseX, wBaseY + 4);
                this._armWeapon.setRotation(swordRot);
                this._armWeapon.setSize(6, 14);
                this._sword.setPosition(
                    wBaseX + Math.sin(swordRot) * 14,
                    wBaseY + 4 + Math.cos(swordRot) * 10
                );
                this._sword.setRotation(swordRot);
                this._sword.setSize(3, 22);
                this._swordTip.setPosition(
                    wBaseX + Math.sin(swordRot) * 24,
                    wBaseY + 4 + Math.cos(swordRot) * 18
                );
                this._armOff.setPosition(oBaseX, oBaseY + 2);
                this._armOff.setRotation(-dir * 0.18);
                break;
            }
        }

        // 恢复默认颜色
        this._sword.setFillStyle(COLORS.NEON_CYAN);
        this._swordTip.setFillStyle(COLORS.NEON_CYAN);
    }

    // ----------------------------------------------------------------
    // 落地反馈
    // ----------------------------------------------------------------
    _onLanding() {
        const fallSpeed = Math.abs(this.prevVelocityY);
        if (fallSpeed < 80) return;

        const intensity = Math.min(fallSpeed / 280, 2.2);
        // 落地冲击特效（水平冲击波 + 粉尘）
        Effects.landingDust(this.scene, this.x, this.y + 28, intensity);

        // 落地挤压：越重越扁，越快弹回
        if (this.scene && this.scene.tweens) {
            const bs = this._baseScale;
            const squashX = bs * (1 + intensity * 0.15);
            const squashY = bs * (1 - intensity * 0.18);
            const dur = Math.max(60, 130 - intensity * 30);
            this.scene.tweens.add({
                targets: this,
                scaleX: squashX, scaleY: squashY,
                duration: dur * 0.35,
                ease: 'Power3',
                yoyo: true,
                onComplete: () => { if (this.active) this.setScale(bs); },
            });
        }

        // 重落地摄像机震动
        if (fallSpeed > 350) {
            Effects.shakeLight(this.scene.cameras.main);
        }
        if (fallSpeed > 600) {
            Effects.shakeHeavy(this.scene.cameras.main);
        }

        audioManager.play('land');
    }

    // ----------------------------------------------------------------
    // 地面状态
    // ----------------------------------------------------------------
    _handleGroundState(dt, onFloor, jumpPressed) {
        if (!onFloor && this.coyoteTimer <= 0) {
            this.state = S.FALL;
            return;
        }

        this._handleMovement(dt);

        // 跳跃（包括 jump buffer）
        if (this.jumpBufferTimer > 0 || jumpPressed) {
            this._jump();
            return;
        }

        // 冲刺
        if (Phaser.Input.Keyboard.JustDown(this.keys.dash) && this.dashCooldownTimer <= 0) {
            this._startDash();
            return;
        }

        // 攻击
        if (Phaser.Input.Keyboard.JustDown(this.keys.melee) &&
            (this.meleeCooldownTimer <= 0 || this._comboWindowActive)) {
            this._startMelee();
            return;
        }
        if (Phaser.Input.Keyboard.JustDown(this.keys.ranged) && this.rangedCooldownTimer <= 0) {
            this._startRanged();
            return;
        }

        // 状态切换
        this.state = Math.abs(this.body.velocity.x) > 10 ? S.RUN : S.IDLE;
    }

    // ----------------------------------------------------------------
    // 空中状态
    // ----------------------------------------------------------------
    _handleAirState(dt, onFloor, jumpPressed) {
        if (onFloor) {
            // 落地 - 检查 jump buffer
            if (this.jumpBufferTimer > 0) {
                this._jump();
            } else {
                this.state = S.IDLE;
            }
            return;
        }

        this._handleMovement(dt);

        // 墙滑检测
        if (this.touchingWallSide !== 0 && gameState.hasAbility('wallJump')) {
            const holdingTowardWall =
                (this.touchingWallSide === -1 && this.cursors.left.isDown) ||
                (this.touchingWallSide === 1 && this.cursors.right.isDown);
            if (holdingTowardWall && this.body.velocity.y > 0) {
                this.state = S.WALL_SLIDE;
                return;
            }
        }

        // 二段跳
        if (jumpPressed && this.canDoubleJump && gameState.hasAbility('doubleJump')) {
            this.canDoubleJump = false;
            this.body.setVelocityY(PLAYER.DOUBLE_JUMP_VELOCITY);
            this.state = S.JUMP;
            // 二段跳粒子 + 挤压
            Effects.spawnParticles(this.scene, this.x, this.y + PLAYER.HEIGHT / 2, COLORS.PLAYER_DASH, 8, 100);
            if (this.scene && this.scene.tweens) {
                const bs = this._baseScale;
                this.scene.tweens.add({
                    targets: this,
                    scaleX: bs * 0.85, scaleY: bs * 1.15,
                    duration: 80, yoyo: true, ease: 'Power2',
                    onComplete: () => { if (this.active) this.setScale(bs); },
                });
            }
            audioManager.play('double_jump');
            return;
        }

        // 冲刺（空中）
        if (Phaser.Input.Keyboard.JustDown(this.keys.dash) && this.dashCooldownTimer <= 0) {
            this._startDash();
            return;
        }

        // 攻击
        if (Phaser.Input.Keyboard.JustDown(this.keys.melee) &&
            (this.meleeCooldownTimer <= 0 || this._comboWindowActive)) {
            this._startMelee();
            return;
        }
        if (Phaser.Input.Keyboard.JustDown(this.keys.ranged) && this.rangedCooldownTimer <= 0) {
            this._startRanged();
            return;
        }

        // 状态切换
        this.state = Math.abs(this.body.velocity.x) > 10 ? S.RUN : S.IDLE;

        // 跳跃键松开截断（短跳）
        const jumpHeld = this.keys.jump.isDown || this.keys.jump2.isDown || this.cursors.up.isDown;
        if (!jumpHeld && this.body.velocity.y < 0 && this.state === S.JUMP) {
            this.body.setVelocityY(this.body.velocity.y * PLAYER.JUMP_CUT_MULTIPLIER);
        }

        this.state = this.body.velocity.y < 0 ? S.JUMP : S.FALL;
    }

    // ----------------------------------------------------------------
    // 移动处理
    // ----------------------------------------------------------------
    _handleMovement(dt) {
        if (this.wallJumpLockTimer > 0) return;

        const left = this.cursors.left.isDown;
        const right = this.cursors.right.isDown;
        const dtSec = dt / 1000;

        if (left && !right) {
            this.body.setVelocityX(Math.max(
                this.body.velocity.x - PLAYER.ACCELERATION * dtSec,
                -PLAYER.MOVE_SPEED
            ));
            this.facingRight = false;
            this.setFlipX(true);
        } else if (right && !left) {
            this.body.setVelocityX(Math.min(
                this.body.velocity.x + PLAYER.ACCELERATION * dtSec,
                PLAYER.MOVE_SPEED
            ));
            this.facingRight = true;
            this.setFlipX(false);
        } else {
            // 减速
            if (this.body.velocity.x > 0) {
                this.body.setVelocityX(Math.max(0, this.body.velocity.x - PLAYER.DECELERATION * dtSec));
            } else if (this.body.velocity.x < 0) {
                this.body.setVelocityX(Math.min(0, this.body.velocity.x + PLAYER.DECELERATION * dtSec));
            }
        }
    }

    // ----------------------------------------------------------------
    // 跳跃
    // ----------------------------------------------------------------
    _jump() {
        this.body.setVelocityY(PLAYER.JUMP_VELOCITY);
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        this.state = S.JUMP;

        // 跳跃挤压动画（stretch）
        if (this.scene && this.scene.tweens) {
            const bs = this._baseScale;
            this.scene.tweens.add({
                targets: this,
                scaleX: bs * 0.85, scaleY: bs * 1.15,
                duration: 80, yoyo: true, ease: 'Power2',
                onComplete: () => { if (this.active) this.setScale(bs); },
            });
        }

        // 起跳灰尘
        Effects.landingDust(this.scene, this.x, this.y + PLAYER.HEIGHT / 2, 0.5);

        audioManager.play('jump');
    }

    // ----------------------------------------------------------------
    // 冲刺
    // ----------------------------------------------------------------
    _startDash() {
        this.state = S.DASH;
        this.dashTimer = PLAYER.DASH_DURATION;
        this.dashCooldownTimer = PLAYER.DASH_COOLDOWN;
        this.dashAfterimageTimer = 0;
        const dir = this.facingRight ? 1 : -1;

        this.body.setVelocityX(PLAYER.DASH_SPEED * dir);
        this.body.setVelocityY(0);

        this.isDashing = true;
        this.isPhaseShifting = gameState.hasAbility('phaseShift');

        // 把当前 scale 告知 afterimage 函数
        if (this.scene) this.scene._playerBaseScale = this._baseScale;

        // 冲刺爆发
        Effects.dashBurst(this.scene, this.x, this.y, dir);
        // 冲刺前瞬间拉伸（水平拉长）
        const bs = this._baseScale;
        if (this.scene && this.scene.tweens) {
            this.scene.tweens.add({
                targets: this,
                scaleX: bs * 1.35, scaleY: bs * 0.75,
                duration: 40, ease: 'Power3',
                onComplete: () => {
                    if (this.active) {
                        this.scene.tweens.add({
                            targets: this, scaleX: bs, scaleY: bs,
                            duration: 80, ease: 'Power1',
                        });
                    }
                },
            });
        }

        audioManager.play('dash');
    }

    _handleDash(dt) {
        this.dashTimer -= dt;
        this.dashAfterimageTimer -= dt;

        // 更密集的残影
        if (this.dashAfterimageTimer <= 0) {
            Effects.createAfterimage(this.scene, this.x, this.y, 'player',
                this.isPhaseShifting ? COLORS.PHASE_WALL : COLORS.PLAYER_DASH, 0.5);
            this.dashAfterimageTimer = PLAYER.DASH_AFTERIMAGE_INTERVAL;
        }

        // 速度线
        const dir = this.facingRight ? 1 : -1;
        if (Math.random() > 0.4) {
            Effects.createSpeedLines(this.scene, this.x, this.y, dir, 2);
        }

        // 禁用重力
        this.body.setAllowGravity(false);

        if (this.dashTimer <= 0) {
            this.body.setAllowGravity(true);
            this.isDashing = false;
            this.isPhaseShifting = false;
            const onFloor = this.body.blocked.down || this.body.touching.down;
            this.state = onFloor ? S.IDLE : S.FALL;
        }
    }

    // ----------------------------------------------------------------
    // 墙滑 / 墙跳
    // ----------------------------------------------------------------
    _handleWallSlide(dt, jumpPressed) {
        // 限制下落速度
        if (this.body.velocity.y > PLAYER.WALL_SLIDE_SPEED) {
            this.body.setVelocityY(PLAYER.WALL_SLIDE_SPEED);
        }

        // 松开方向键或离开墙
        const holdingLeft = this.cursors.left.isDown;
        const holdingRight = this.cursors.right.isDown;
        const stillOnWall =
            (this.touchingWallSide === -1 && holdingLeft) ||
            (this.touchingWallSide === 1 && holdingRight);

        if (!stillOnWall || (this.body.blocked.down || this.body.touching.down)) {
            this.state = (this.body.blocked.down || this.body.touching.down) ? S.IDLE : S.FALL;
            return;
        }

        // 墙跳
        if (jumpPressed) {
            const awayDir = -this.touchingWallSide;
            this.body.setVelocityX(PLAYER.WALL_JUMP_X * awayDir);
            this.body.setVelocityY(PLAYER.WALL_JUMP_Y);
            this.facingRight = awayDir > 0;
            this.setFlipX(!this.facingRight);
            this.wallJumpLockTimer = PLAYER.WALL_JUMP_LOCK;
            this.canDoubleJump = true;
            this.state = S.JUMP;
            // 增强墙跳粒子
            const wx = this.x + this.touchingWallSide * (PLAYER.WIDTH / 2);
            Effects.wallJumpBurst(this.scene, wx, this.y, this.touchingWallSide);
            audioManager.play('wall_jump');
            return;
        }

        // 视觉：滑墙粒子
        if (Math.random() > 0.6) {
            const px = this.x + this.touchingWallSide * (PLAYER.WIDTH / 2);
            const r = this.scene.add.rectangle(px, this.y + Math.random() * PLAYER.HEIGHT / 2, 2, 2, 0x7777bb, 0.5);
            r.setDepth(DEPTH.EFFECTS);
            this.scene.tweens.add({
                targets: r, alpha: 0, y: r.y + 20, duration: 250,
                onComplete: () => r.destroy(),
            });
        }
    }

    // ----------------------------------------------------------------
    // 近战三连击系统
    // 第1击：横斩（水平弧线，快速）
    // 第2击：上挑（向上弧线，轻盈）
    // 第3击：重击（下劈，强力，有hitstop）
    // 连击窗口：每击结束后 220ms 内按攻击键可接下一击
    // ----------------------------------------------------------------
    _startMelee() {
        const now = this.scene.time.now;

        // 判断是否在连击窗口内
        if (this._comboWindowActive && this._comboCount < 3) {
            this._comboCount++;
        } else {
            this._comboCount = 1;
        }
        this._comboWindowActive = false;

        this.state = S.ATTACK_MELEE;
        // 第3击 cooldown 更长（收招）
        this.meleeCooldownTimer = this._comboCount === 3
            ? PLAYER.MELEE_COOLDOWN * 1.5
            : PLAYER.MELEE_COOLDOWN * 0.65;
        this._meleeTimer = this._comboCount === 3
            ? PLAYER.MELEE_DURATION * 1.4
            : PLAYER.MELEE_DURATION;
        this._meleeHitTargets = new Set();

        const dir = this.facingRight ? 1 : -1;
        const bs = this._baseScale;

        switch (this._comboCount) {
            case 1: this._doCombo1(dir, bs); break;
            case 2: this._doCombo2(dir, bs); break;
            case 3: this._doCombo3(dir, bs); break;
        }

        audioManager.play('melee');
    }

    // ---- 第1击：横斩 ----
    _doCombo1(dir, bs) {
        const hx = this.x + dir * (PLAYER.WIDTH / 2 + PLAYER.MELEE_RANGE / 2);

        // 前摇：身体后仰压缩（轻微）
        this.scene.tweens.add({
            targets: this,
            scaleX: bs * 0.85, scaleY: bs * 1.10,
            x: this.x - dir * 3,
            duration: 35, ease: 'Power2',
            onComplete: () => {
                if (!this.active) return;
                // 爆发：横向前冲拉伸
                this.scene.tweens.add({
                    targets: this,
                    scaleX: bs * 1.20, scaleY: bs * 0.85,
                    x: this.x + dir * 7,
                    duration: 45, ease: 'Power3',
                    onComplete: () => {
                        if (!this.active) return;
                        this.scene.tweens.add({
                            targets: this, scaleX: bs, scaleY: bs,
                            duration: 60, ease: 'Power1',
                            onComplete: () => { if (this.active) this.setScale(bs); },
                        });
                    },
                });
            },
        });

        // 横斩弧光（延迟35ms）
        this.scene.time.delayedCall(35, () => {
            if (!this.active) return;
            Effects.meleeSlash(this.scene, this.x, this.y, dir, PLAYER.MELEE_RANGE + 8);
        });

        // hitbox
        this.scene.time.delayedCall(38, () => {
            if (!this.active) return;
            this.meleeHitbox = this.scene.add.zone(hx, this.y, PLAYER.MELEE_RANGE, PLAYER.HEIGHT + 8);
            this.scene.physics.add.existing(this.meleeHitbox, true);
        });
    }

    // ---- 第2击：上挑 ----
    _doCombo2(dir, bs) {
        const hx = this.x + dir * (PLAYER.WIDTH / 2 + PLAYER.MELEE_RANGE * 0.4);

        // 前摇：身体下蹲（蓄力上挑感）
        this.scene.tweens.add({
            targets: this,
            scaleX: bs * 1.05, scaleY: bs * 0.82,
            y: this.y + 4,
            duration: 30, ease: 'Power2',
            onComplete: () => {
                if (!this.active) return;
                // 爆发：纵向拉伸（向上）
                this.scene.tweens.add({
                    targets: this,
                    scaleX: bs * 0.82, scaleY: bs * 1.22,
                    y: this.y - 6,
                    duration: 50, ease: 'Power3',
                    onComplete: () => {
                        if (!this.active) return;
                        this.scene.tweens.add({
                            targets: this, scaleX: bs, scaleY: bs, y: this.y + 2,
                            duration: 70, ease: 'Power1',
                            onComplete: () => { if (this.active) this.setScale(bs); },
                        });
                    },
                });
            },
        });

        // 上挑弧光（斜向上）
        this.scene.time.delayedCall(30, () => {
            if (!this.active || !this.scene) return;
            // 斜向上弧线
            const sx = this.x + dir * 16;
            const sy = this.y;
            // 主弧（斜上方）
            const slash = this.scene.add.rectangle(sx, sy - 8, PLAYER.MELEE_RANGE * 0.8, 14, COLORS.NEON_CYAN, 0.6);
            slash.setDepth(DEPTH.EFFECTS + 1);
            slash.setRotation(dir * -0.6); // 斜上角度
            this.scene.tweens.add({
                targets: slash,
                scaleX: 1.5, scaleY: 0.15, alpha: 0,
                rotation: dir * -0.9,
                y: sy - 20,
                duration: 150, ease: 'Power2',
                onComplete: () => slash.destroy(),
            });
            // 顶部亮点
            const tip = this.scene.add.circle(sx + dir * 12, sy - 18, 5, 0xffffff, 1.0);
            tip.setDepth(DEPTH.EFFECTS + 2);
            this.scene.tweens.add({
                targets: tip, scaleX: 2.5, scaleY: 2.5, alpha: 0, y: sy - 32,
                duration: 120, ease: 'Power2',
                onComplete: () => tip.destroy(),
            });
        });

        // hitbox（范围略小，偏上方）
        this.scene.time.delayedCall(32, () => {
            if (!this.active) return;
            this.meleeHitbox = this.scene.add.zone(
                hx, this.y - 10,
                PLAYER.MELEE_RANGE * 0.85, PLAYER.HEIGHT + 16
            );
            this.scene.physics.add.existing(this.meleeHitbox, true);
        });
    }

    // ---- 第3击：重击下劈（终结技）----
    _doCombo3(dir, bs) {
        const hx = this.x + dir * (PLAYER.WIDTH / 2 + PLAYER.MELEE_RANGE * 0.6);

        // 前摇：身体向后大幅压缩（重蓄力感）
        this.scene.tweens.add({
            targets: this,
            scaleX: bs * 0.72, scaleY: bs * 1.25,
            x: this.x - dir * 6,
            duration: 60, ease: 'Power2',
            onComplete: () => {
                if (!this.active) return;
                // 爆发：猛烈前冲 + 重度拉伸
                this.scene.tweens.add({
                    targets: this,
                    scaleX: bs * 1.35, scaleY: bs * 0.72,
                    x: this.x + dir * 10,
                    duration: 60, ease: 'Power4',
                    onComplete: () => {
                        if (!this.active) return;
                        // 收招：弹回 + 轻微震颤
                        this.scene.tweens.add({
                            targets: this, scaleX: bs, scaleY: bs,
                            duration: 100, ease: 'Bounce.easeOut',
                            onComplete: () => { if (this.active) this.setScale(bs); },
                        });
                    },
                });
            },
        });

        // 重击特效（延迟60ms，与爆发同步）
        this.scene.time.delayedCall(58, () => {
            if (!this.active || !this.scene) return;
            // 主重击弧（更宽更亮）
            const sx = this.x + dir * (PLAYER.MELEE_RANGE * 0.5);
            const slash = this.scene.add.rectangle(sx, this.y, PLAYER.MELEE_RANGE * 1.1, 22, 0xffffff, 0.7);
            slash.setDepth(DEPTH.EFFECTS + 2);
            slash.setRotation(dir * -0.12);
            this.scene.tweens.add({
                targets: slash,
                scaleX: 1.6, scaleY: 0.1, alpha: 0,
                rotation: dir * 0.18,
                duration: 180, ease: 'Power3',
                onComplete: () => slash.destroy(),
            });
            // 能量拖尾（蓝紫色）
            const trail = this.scene.add.rectangle(sx - dir * 8, this.y, PLAYER.MELEE_RANGE * 0.7, 10, COLORS.NEON_CYAN, 0.4);
            trail.setDepth(DEPTH.EFFECTS + 1);
            trail.setRotation(dir * -0.08);
            this.scene.tweens.add({
                targets: trail, alpha: 0, scaleX: 0.5, duration: 220,
                onComplete: () => trail.destroy(),
            });
            // 重击冲击波（放射形圆环）
            const ring = this.scene.add.circle(sx, this.y, 8, 0xffffff, 0.0);
            ring.setDepth(DEPTH.EFFECTS + 2);
            ring.setStrokeStyle(3, COLORS.NEON_CYAN, 0.9);
            this.scene.tweens.add({
                targets: ring, scaleX: 4.5, scaleY: 3, alpha: 0,
                duration: 200, ease: 'Power2',
                onComplete: () => ring.destroy(),
            });
            // 地面冲击波（仅第三击）
            const groundShock = this.scene.add.rectangle(this.x, this.y + 28, 60, 3, COLORS.NEON_CYAN, 0.5);
            groundShock.setDepth(DEPTH.EFFECTS);
            this.scene.tweens.add({
                targets: groundShock, scaleX: 3, alpha: 0, duration: 200, ease: 'Power2',
                onComplete: () => groundShock.destroy(),
            });
        });

        // hitbox（更大范围）
        this.scene.time.delayedCall(62, () => {
            if (!this.active) return;
            this.meleeHitbox = this.scene.add.zone(
                hx, this.y,
                PLAYER.MELEE_RANGE * 1.3, PLAYER.HEIGHT + 20
            );
            this.scene.physics.add.existing(this.meleeHitbox, true);
        });
    }

    _handleMeleeState(dt, onFloor) {
        this._meleeTimer -= dt;

        // 连击窗口：攻击进入尾段（剩余40ms）时开启连击接受窗口
        if (this._meleeTimer <= 40 && this._meleeTimer > 0 && !this._comboWindowActive) {
            this._comboWindowActive = true;
            // 第3击结束后重置连击计数，不能再接
            if (this._comboCount >= 3) {
                this._comboWindowActive = false;
            }
        }

        if (this._meleeTimer <= 0) {
            this._destroyMeleeHitbox();
            // 连击窗口持续到攻击结束后220ms
            if (this._comboCount < 3) {
                this._comboWindowTimer = 220;
            } else {
                // 第3击结束，重置连击
                this._comboCount = 0;
                this._comboWindowActive = false;
                this._comboWindowTimer = 0;
            }
            this.state = onFloor ? S.IDLE : S.FALL;
        }
        if (!onFloor) this._handleMovement(dt);
    }

    _destroyMeleeHitbox() {
        if (this.meleeHitbox) {
            this.meleeHitbox.destroy();
            this.meleeHitbox = null;
        }
        this._meleeHitTargets.clear();
    }

    /**
     * 检查近战是否已命中该目标（防止重复命中）
     */
    hasMeleeHit(target) {
        return this._meleeHitTargets.has(target);
    }
    markMeleeHit(target) {
        this._meleeHitTargets.add(target);
    }

    // ----------------------------------------------------------------
    // 远程攻击
    // ----------------------------------------------------------------
    _startRanged() {
        if (!gameState.useEnergy(PLAYER.RANGED_COST)) return;
        this.state = S.ATTACK_RANGED;
        this.rangedCooldownTimer = PLAYER.RANGED_COOLDOWN;
        this._rangedTimer = 120;

        const dir = this.facingRight ? 1 : -1;
        const bx = this.x + dir * (PLAYER.WIDTH / 2 + 8);
        const bullet = this.bullets.get(bx, this.y, 'bullet_player');
        if (bullet) {
            bullet.setActive(true).setVisible(true);
            bullet.setDepth(DEPTH.PROJECTILES);
            bullet.setScale(ENTITY_SCALE.BULLET_PLAYER);
            bullet.body.setAllowGravity(false);
            bullet.body.setVelocity(PLAYER.RANGED_SPEED * dir, 0);
            bullet.damage = PLAYER.RANGED_DAMAGE;

            const sceneRef = this.scene;
            sceneRef.time.delayedCall(2000, () => {
                if (bullet && bullet.active && bullet.body) {
                    bullet.setActive(false).setVisible(false);
                    bullet.body.setVelocity(0, 0);
                }
            });
        }

        // 枪口闪光（增强）
        Effects.spawnParticles(this.scene, bx, this.y, COLORS.BULLET_PLAYER, 5, 70);
        // 后座微震
        this.body.setVelocityX(this.body.velocity.x - dir * 30);

        audioManager.play('ranged');
    }

    _handleRangedState(dt, onFloor) {
        this._rangedTimer -= dt;
        if (this._rangedTimer <= 0) {
            this.state = onFloor ? S.IDLE : S.FALL;
        }
        if (!onFloor) this._handleMovement(dt);
    }

    // ----------------------------------------------------------------
    // 受击
    // ----------------------------------------------------------------
    takeDamage(amount, knockbackDir = 0) {
        if (this.invincibleTimer > 0 || this.state === S.DEAD || this.state === S.DASH) return;

        const isDead = gameState.takeDamage(amount);
        this.invincibleTimer = PLAYER.HIT_INVINCIBLE;

        this.body.setVelocityX(knockbackDir * 210);
        this.body.setVelocityY(-160);

        Effects.flashRed(this, 120);
        Effects.shakeHeavy(this.scene.cameras.main);
        // 方向性受击特效
        Effects.playerHitEffect(this.scene, this.x, this.y, knockbackDir);
        audioManager.play('player_hit');

        if (isDead) {
            this._die();
        } else {
            this.state = S.HIT;
            this.hitTimer = 300;
            // 受击压缩动画（向后退缩感）
            const bs = this._baseScale;
            if (this.scene && this.scene.tweens) {
                this.scene.tweens.add({
                    targets: this,
                    scaleX: bs * 0.75, scaleY: bs * 1.2,
                    duration: 50, ease: 'Power3',
                    yoyo: true,
                    onComplete: () => { if (this.active) this.setScale(bs); },
                });
            }
        }
    }

    _handleHitState(dt) {
        this.hitTimer -= dt;
        if (this.hitTimer <= 0) {
            const onFloor = this.body.blocked.down || this.body.touching.down;
            this.state = onFloor ? S.IDLE : S.FALL;
        }
    }

    // ----------------------------------------------------------------
    // 死亡
    // ----------------------------------------------------------------
    _die() {
        this.state = S.DEAD;
        this.body.setVelocity(0, -180);
        this.setTint(0xff4444);
        Effects.playerDeathEffect(this.scene, this.x, this.y);
        Effects.shakeBoss(this.scene.cameras.main);
        audioManager.play('player_death');
        gameState.gameOver = true;
        this.scene.events.emit('player-death');
    }

    // ----------------------------------------------------------------
    // 复活
    // ----------------------------------------------------------------
    respawnAt(x, y) {
        this.setPosition(x, y);
        this.body.setVelocity(0, 0);
        this.state = S.IDLE;
        this.clearTint();
        this.setAlpha(1);
        this.setScale(this._baseScale);
        this.invincibleTimer = 1000;
        this.isDashing = false;
        this.isPhaseShifting = false;
        gameState.gameOver = false;
    }

    // ----------------------------------------------------------------
    // 销毁清理
    // ----------------------------------------------------------------
    cleanup() {
        this._destroyMeleeHitbox();
        this.bullets.clear(true, true);
        if (this._legL) { this._legL.destroy(); this._legL = null; }
        if (this._legR) { this._legR.destroy(); this._legR = null; }
        if (this._armWeapon) { this._armWeapon.destroy(); this._armWeapon = null; }
        if (this._sword)     { this._sword.destroy();     this._sword = null; }
        if (this._armOff)    { this._armOff.destroy();    this._armOff = null; }
        if (this._swordTip)  { this._swordTip.destroy();  this._swordTip = null; }
    }
}
