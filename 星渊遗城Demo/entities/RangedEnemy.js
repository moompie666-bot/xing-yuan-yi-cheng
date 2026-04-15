// ============================================================
// RangedEnemy.js — 远程射击怪（受击硬直优化版）
// ============================================================

import { ENEMY, COLORS, DEPTH, ENTITY_SCALE } from '../utils/Constants.js';
import { Effects } from '../utils/Effects.js';
import audioManager from '../managers/AudioManager.js';

export class RangedEnemy extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, patrolLeft, patrolRight) {
        super(scene, x, y, 'enemy_ranged');
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setDepth(DEPTH.ENEMIES);
        this._baseScale = ENTITY_SCALE.ENEMY_RANGED;
        this.setScale(this._baseScale);
        this.body.setSize(520, 680);
        this.body.setOffset(252, 172);
        this.setCollideWorldBounds(true);

        this.hp = ENEMY.RANGED.HP;
        this.damage = ENEMY.RANGED.DAMAGE;
        this.patrolLeft = patrolLeft;
        this.patrolRight = patrolRight;
        this.moveDir = 1;
        this.state = 'patrol'; // patrol | shoot | hit | dead
        this.shootCooldown = ENEMY.RANGED.SHOOT_COOLDOWN;
        this.hitTimer = 0;
        this.target = null;
        this._hitShakeTween = null;

        this.bullets = scene.physics.add.group({
            defaultKey: 'bullet_enemy',
            maxSize: 10,
        });
    }

    setTarget(player) {
        this.target = player;
    }

    update(time, delta) {
        if (this.state === 'dead' || !this.active) return;

        const dt = delta;
        this.shootCooldown = Math.max(0, this.shootCooldown - dt);

        switch (this.state) {
            case 'patrol':
                this._patrol(dt);
                break;
            case 'shoot':
                this._shoot(dt);
                break;
            case 'hit':
                this.hitTimer -= dt;
                this.body.setVelocityX(this.body.velocity.x * 0.9);
                if (this.hitTimer <= 0) {
                    this.state = 'patrol';
                    this.setScale(this._baseScale);
                }
                break;
        }

        this.bullets.children.each(b => {
            if (b.active && b.body && (b.x < -50 || b.x > this.scene.physics.world.bounds.width + 50 ||
                b.y < -50 || b.y > this.scene.physics.world.bounds.height + 50)) {
                b.setActive(false).setVisible(false);
                b.body.setVelocity(0, 0);
            }
        });
    }

    _patrol(dt) {
        this.body.setVelocityX(ENEMY.RANGED.SPEED * this.moveDir);
        this.setFlipX(this.moveDir < 0);

        if (this.x <= this.patrolLeft) this.moveDir = 1;
        if (this.x >= this.patrolRight) this.moveDir = -1;

        if (this.target && this.target.active && this.target.state !== 'dead') {
            const dist = Phaser.Math.Distance.Between(this.x, this.y, this.target.x, this.target.y);
            if (dist < ENEMY.RANGED.DETECT_RANGE && this.shootCooldown <= 0) {
                this._fire();
            }
        }
    }

    _fire() {
        if (!this.scene || this.state === 'dead') return;
        this.shootCooldown = ENEMY.RANGED.SHOOT_COOLDOWN;
        this.state = 'shoot';
        this.body.setVelocityX(0);

        const dir = this.target.x > this.x ? 1 : -1;
        this.setFlipX(dir < 0);

        this.setTintFill(COLORS.ENEMY_RANGED);

        // 保存 scene 引用，避免 destroy 后 this.scene 变 null
        const scene = this.scene;

        scene.time.delayedCall(100, () => {
            if (this.active && this.scene) this.clearTint();
        });

        scene.time.delayedCall(250, () => {
            // 敌人已死亡则不发射
            if (!this.active || !this.scene || this.state === 'dead') return;

            const bx = this.x + dir * 18;
            const bullet = this.bullets.get(bx, this.y, 'bullet_enemy');
            if (bullet) {
                bullet.setActive(true).setVisible(true);
                bullet.setDepth(DEPTH.PROJECTILES);
                bullet.setScale(ENTITY_SCALE.BULLET_ENEMY);
                bullet.body.setAllowGravity(false);
                bullet.body.setVelocity(ENEMY.RANGED.BULLET_SPEED * dir, 0);
                bullet.damage = ENEMY.RANGED.DAMAGE;

                // 用当前帧的 scene 引用，不用 this.scene
                scene.time.delayedCall(3000, () => {
                    if (bullet && bullet.active && bullet.body) {
                        bullet.setActive(false).setVisible(false);
                        bullet.body.setVelocity(0, 0);
                    }
                });
            }

            if (this.scene) {
                Effects.spawnParticles(this.scene, bx, this.y, COLORS.BULLET_ENEMY, 4, 50);
            }
            audioManager.play('enemy_shoot');
            if (this.active && this.state !== 'dead') this.state = 'patrol';
        });
    }

    _shoot(dt) {
        // 等待发射延迟
    }

    takeDamage(amount, knockbackDir = 0) {
        if (this.state === 'dead') return;

        this.hp -= amount;
        Effects.flashWhite(this, 100);

        this.body.setVelocityX(knockbackDir * 130);
        this.body.setVelocityY(-50);

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
        this.hitTimer = ENEMY.RANGED.HIT_STUN;
        this.setScale(this._baseScale * 0.9, this._baseScale * 1.1);
    }

    _die() {
        this.state = 'dead';
        if (this._hitShakeTween) { this._hitShakeTween.stop(); this._hitShakeTween = null; }
        this.scene.tweens.killTweensOf(this);
        Effects.deathExplosion(this.scene, this.x, this.y, COLORS.ENEMY_RANGED);
        this.bullets.clear(true, true);
        audioManager.play('enemy_death');
        this.destroy();
    }
}
