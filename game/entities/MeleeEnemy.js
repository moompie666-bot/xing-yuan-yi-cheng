// ============================================================
// MeleeEnemy.js — 近战巡逻怪（受击硬直优化版）
// ============================================================

import { ENEMY, COLORS, DEPTH, ENTITY_SCALE } from '../utils/Constants.js';
import { Effects } from '../utils/Effects.js';
import audioManager from '../managers/AudioManager.js';

export class MeleeEnemy extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, patrolLeft, patrolRight) {
        super(scene, x, y, 'enemy_melee');
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setDepth(DEPTH.ENEMIES);
        this._baseScale = ENTITY_SCALE.ENEMY_MELEE;
        this.setScale(this._baseScale);
        this.body.setSize(560, 700);
        this.body.setOffset(232, 162);
        this.setCollideWorldBounds(true);

        this.hp = ENEMY.MELEE.HP;
        this.damage = ENEMY.MELEE.DAMAGE;
        this.patrolLeft = patrolLeft;
        this.patrolRight = patrolRight;
        this.moveDir = 1;
        this.state = 'patrol'; // patrol | chase | attack | hit | dead
        this.attackCooldown = 0;
        this.hitTimer = 0;
        this.target = null;

        // 受击震动补间引用
        this._hitShakeTween = null;
    }

    setTarget(player) {
        this.target = player;
    }

    update(time, delta) {
        if (this.state === 'dead' || !this.active) return;

        const dt = delta;
        this.attackCooldown = Math.max(0, this.attackCooldown - dt);

        switch (this.state) {
            case 'patrol':
                this._patrol(dt);
                break;
            case 'chase':
                this._chase(dt);
                break;
            case 'attack':
                this._attack(dt);
                break;
            case 'hit':
                this.hitTimer -= dt;
                this.body.setVelocityX(this.body.velocity.x * 0.9); // 摩擦减速
                if (this.hitTimer <= 0) {
                    this.state = 'patrol';
                    this.setScale(this._baseScale);
                }
                break;
        }
    }

    _patrol(dt) {
        this.body.setVelocityX(ENEMY.MELEE.SPEED * this.moveDir);
        this.setFlipX(this.moveDir < 0);

        if (this.x <= this.patrolLeft) this.moveDir = 1;
        if (this.x >= this.patrolRight) this.moveDir = -1;

        if (this.target && this.target.active && this.target.state !== 'dead') {
            const dist = Phaser.Math.Distance.Between(this.x, this.y, this.target.x, this.target.y);
            if (dist < ENEMY.MELEE.DETECT_RANGE) {
                this.state = 'chase';
            }
        }
    }

    _chase(dt) {
        if (!this.target || !this.target.active || this.target.state === 'dead') {
            this.state = 'patrol';
            return;
        }

        const dx = this.target.x - this.x;
        const dist = Math.abs(dx);
        const dir = dx > 0 ? 1 : -1;

        this.body.setVelocityX(ENEMY.MELEE.CHARGE_SPEED * dir);
        this.setFlipX(dir < 0);

        if (dist < ENEMY.MELEE.ATTACK_RANGE && this.attackCooldown <= 0) {
            this.state = 'attack';
            this._doAttack(dir);
        }

        if (dist > ENEMY.MELEE.DETECT_RANGE * 1.5) {
            this.state = 'patrol';
        }
    }

    _doAttack(dir) {
        this.body.setVelocityX(0);
        this.attackCooldown = ENEMY.MELEE.ATTACK_COOLDOWN;

        if (!this.scene) return;
        const ax = this.x + dir * 20;
        const slash = this.scene.add.rectangle(ax, this.y, 28, 34, COLORS.ENEMY_MELEE, 0.5);
        slash.setDepth(DEPTH.EFFECTS);
        this.scene.tweens.add({
            targets: slash, alpha: 0, scaleX: 1.5, duration: 150,
            onComplete: () => { if (slash && slash.active) slash.destroy(); },
        });

        // 用 scene 的引用而非 this，避免 destroy 后访问无效对象
        const scene = this.scene;
        scene.time.delayedCall(250, () => {
            if (this.active && this.scene && this.state !== 'dead') this.state = 'chase';
        });
    }

    _attack(dt) {
        // 短暂停顿
    }

    takeDamage(amount, knockbackDir = 0) {
        if (this.state === 'dead') return;

        this.hp -= amount;
        Effects.flashWhite(this, 90);

        this.body.setVelocityX(knockbackDir * 180);
        this.body.setVelocityY(-70);

        if (this.hp <= 0) {
            this._die();
            return;
        }

        if (this._hitShakeTween) this._hitShakeTween.stop();
        this._hitShakeTween = this.scene.tweens.add({
            targets: this,
            x: this.x + knockbackDir * 4,
            duration: 25, yoyo: true, repeat: 2,
            ease: 'Power3',
            onComplete: () => { this._hitShakeTween = null; },
        });

        this.state = 'hit';
        this.hitTimer = ENEMY.MELEE.HIT_STUN;
        // 受击压缩（向击退方向变形）
        const bs = this._baseScale;
        this.setScale(bs * 0.82, bs * 1.15);
    }

    _die() {
        this.state = 'dead';
        // 先停掉受击抖动 tween，防止访问已销毁对象
        if (this._hitShakeTween) { this._hitShakeTween.stop(); this._hitShakeTween = null; }
        this.scene.tweens.killTweensOf(this);
        Effects.deathExplosion(this.scene, this.x, this.y, COLORS.ENEMY_MELEE);
        audioManager.play('enemy_death');
        this.destroy();
    }
}
