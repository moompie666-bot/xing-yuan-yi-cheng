// ============================================================
// FlyingEnemy.js — 飞行骚扰怪（受击硬直优化版）
// ============================================================

import { ENEMY, COLORS, DEPTH, ENTITY_SCALE } from '../utils/Constants.js';
import { Effects } from '../utils/Effects.js';
import audioManager from '../managers/AudioManager.js';

export class FlyingEnemy extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'enemy_flying');
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setDepth(DEPTH.ENEMIES);
        this._baseScale = ENTITY_SCALE.ENEMY_FLYING;
        this.setScale(this._baseScale);
        this.body.setAllowGravity(false);
        this.body.setSize(900, 900);
        this.body.setOffset(62, 62);
        this.setCollideWorldBounds(true);

        this.hp = ENEMY.FLYING.HP;
        this.damage = ENEMY.FLYING.DAMAGE;
        this.homeX = x;
        this.homeY = y;
        this.state = 'hover'; // hover | dive | return | hit | dead
        this.diveCooldown = ENEMY.FLYING.DIVE_COOLDOWN;
        this.hitTimer = 0;
        this.sineOffset = Math.random() * Math.PI * 2;
        this.target = null;
        this.diveTargetX = 0;
        this.diveTargetY = 0;
        this._hitShakeTween = null;
    }

    setTarget(player) {
        this.target = player;
    }

    update(time, delta) {
        if (this.state === 'dead' || !this.active) return;

        const dt = delta;
        this.diveCooldown = Math.max(0, this.diveCooldown - dt);

        switch (this.state) {
            case 'hover':
                this._hover(time, dt);
                break;
            case 'dive':
                this._dive(dt);
                break;
            case 'return':
                this._returnHome(dt);
                break;
            case 'hit':
                this.hitTimer -= dt;
                this.body.setVelocity(
                    this.body.velocity.x * 0.92,
                    this.body.velocity.y * 0.92
                );
                if (this.hitTimer <= 0) {
                    this.state = 'hover';
                    this.setScale(this._baseScale);
                }
                break;
        }
    }

    _hover(time, dt) {
        const t = time / 1000 + this.sineOffset;
        this.x = this.homeX + Math.sin(t * 1.5) * 40;
        this.y = this.homeY + Math.cos(t * 2) * 15;
        this.body.reset(this.x, this.y);

        if (this.target && this.target.active && this.target.state !== 'dead' && this.diveCooldown <= 0) {
            const dist = Phaser.Math.Distance.Between(this.x, this.y, this.target.x, this.target.y);
            if (dist < ENEMY.FLYING.DETECT_RANGE) {
                this._startDive();
            }
        }
    }

    _startDive() {
        this.state = 'dive';
        this.diveCooldown = ENEMY.FLYING.DIVE_COOLDOWN;
        this.diveTargetX = this.target.x;
        this.diveTargetY = this.target.y;

        const angle = Phaser.Math.Angle.Between(this.x, this.y, this.diveTargetX, this.diveTargetY);
        this.body.setVelocity(
            Math.cos(angle) * ENEMY.FLYING.DIVE_SPEED,
            Math.sin(angle) * ENEMY.FLYING.DIVE_SPEED
        );

        this.setTint(0xff6666);

        // 俯冲残影
        Effects.createAfterimage(this.scene, this.x, this.y, 'enemy_flying', 0xff4466, 0.4);

        audioManager.play('enemy_dive');
    }

    _dive(dt) {
        // 俯冲中拖尾
        if (Math.random() > 0.5) {
            Effects.createAfterimage(this.scene, this.x, this.y, 'enemy_flying', 0xff4466, 0.25);
        }

        const dist = Phaser.Math.Distance.Between(this.x, this.y, this.diveTargetX, this.diveTargetY);
        if (dist < 20 || this.body.blocked.down || this.body.blocked.left || this.body.blocked.right) {
            this.body.setVelocity(0, 0);
            this.state = 'return';
            this.clearTint();
        }
    }

    _returnHome(dt) {
        const angle = Phaser.Math.Angle.Between(this.x, this.y, this.homeX, this.homeY);
        const spd = ENEMY.FLYING.SPEED * 0.8;
        this.body.setVelocity(Math.cos(angle) * spd, Math.sin(angle) * spd);

        const dist = Phaser.Math.Distance.Between(this.x, this.y, this.homeX, this.homeY);
        if (dist < 15) {
            this.body.setVelocity(0, 0);
            this.state = 'hover';
        }
    }

    takeDamage(amount, knockbackDir = 0) {
        if (this.state === 'dead') return;

        this.hp -= amount;
        Effects.flashWhite(this, 100);
        this.body.setVelocityY(-100);
        this.body.setVelocityX(knockbackDir * 80);

        if (this.hp <= 0) {
            this._die();
            return;
        }

        if (this._hitShakeTween) this._hitShakeTween.stop();
        this._hitShakeTween = this.scene.tweens.add({
            targets: this,
            x: this.x + knockbackDir * 3,
            duration: 30, yoyo: true, repeat: 2,
            onComplete: () => { this._hitShakeTween = null; },
        });

        this.state = 'hit';
        this.hitTimer = ENEMY.FLYING.HIT_STUN;
        this.setScale(this._baseScale * 0.85, this._baseScale * 1.15);
    }

    _die() {
        this.state = 'dead';
        if (this._hitShakeTween) { this._hitShakeTween.stop(); this._hitShakeTween = null; }
        this.scene.tweens.killTweensOf(this);
        Effects.deathExplosion(this.scene, this.x, this.y, COLORS.ENEMY_FLYING);
        audioManager.play('enemy_death');
        this.destroy();
    }
}
