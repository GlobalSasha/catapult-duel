import * as Phaser from "phaser";

import type { PlayerState } from "../core/battleTypes";
import { GAME_CONFIG } from "../core/gameConfig";
import type { ProjectileType } from "../core/projectileCatalog";
import { STRINGS_RU } from "../i18n/strings.ru";
import { RETRO_UI } from "../ui/retroTheme";
import { PROJECTILE_TEXTURE_KEYS } from "./projectileVisuals";

const VIEW_COLORS = {
  left: {
    signal: RETRO_UI.colors.playerLeft,
  },
  right: {
    signal: RETRO_UI.colors.playerRight,
  },
  healthBackground: RETRO_UI.colors.ink,
  health: RETRO_UI.colors.success,
  active: RETRO_UI.colors.orange,
} as const;

const UI_FONT = RETRO_UI.font.ui;

const CATAPULT_ART = {
  left: {
    bodyKey: "catapult-left-body",
    armKey: "catapult-left-arm",
    wheelKey: "catapult-left-wheel",
    bodySize: { width: 210, height: 140 },
    bodyY: 22,
    armSize: { width: 190, height: 127 },
    armPivot: { x: -22, y: -73 },
    armOrigin: { x: 370 / 1536, y: 830 / 1024 },
    cupAnchor: { x: 105, y: -70 },
    wheelPositions: [
      { x: -55, y: -14 },
      { x: 54, y: -14 },
    ],
  },
  right: {
    bodyKey: "catapult-right-body",
    armKey: "catapult-right-arm",
    wheelKey: "catapult-right-wheel",
    bodySize: { width: 220, height: 147 },
    bodyY: 31,
    armSize: { width: 190, height: 127 },
    armPivot: { x: 5, y: -78 },
    armOrigin: { x: 1070 / 1536, y: 810 / 1024 },
    cupAnchor: { x: -82, y: -70 },
    wheelPositions: [
      { x: -75, y: -14 },
      { x: 52, y: -14 },
    ],
  },
} as const;

export class CatapultView extends Phaser.GameObjects.Container {
  private readonly healthFill: Phaser.GameObjects.Rectangle;
  private readonly healthText: Phaser.GameObjects.Text;
  private readonly activeText: Phaser.GameObjects.Text;
  private readonly activeOutline: Phaser.GameObjects.Arc;
  private readonly effectAura: Phaser.GameObjects.Arc;
  private readonly effectText: Phaser.GameObjects.Text;
  private readonly bodyContainer: Phaser.GameObjects.Container;
  private readonly damageMarks: Phaser.GameObjects.Graphics;
  private readonly impactFlash: Phaser.GameObjects.Graphics;
  private readonly armContainer: Phaser.GameObjects.Container;
  private readonly loadedProjectile: Phaser.GameObjects.Image;
  private readonly wheelContainers: readonly Phaser.GameObjects.Container[];
  private readonly horizontalDirection: 1 | -1;
  private angleDeg: number = GAME_CONFIG.aiming.initialAngleDeg;
  private power: number = GAME_CONFIG.aiming.initialPower;
  private firing = false;
  private loadedProjectileVisibleWhenReady = false;

  constructor(
    scene: Phaser.Scene,
    player: PlayerState,
    isActive: boolean,
    displayName?: string,
  ) {
    super(scene, player.catapultX, player.catapultY);
    scene.add.existing(this);

    const palette = VIEW_COLORS[player.id];
    const art = CATAPULT_ART[player.id];
    this.horizontalDirection = player.id === "left" ? 1 : -1;
    const shadow = new Phaser.GameObjects.Ellipse(
      scene,
      0,
      3,
      148,
      24,
      0x05080d,
      0.46,
    ).setScale(GAME_CONFIG.catapult.visualScale);
    const body = new Phaser.GameObjects.Image(
      scene,
      0,
      art.bodyY,
      art.bodyKey,
    )
      .setOrigin(0.5, 1)
      .setDisplaySize(art.bodySize.width, art.bodySize.height);

    const arm = new Phaser.GameObjects.Image(scene, 0, 0, art.armKey)
      .setOrigin(art.armOrigin.x, art.armOrigin.y)
      .setDisplaySize(art.armSize.width, art.armSize.height);
    this.loadedProjectile = new Phaser.GameObjects.Image(
      scene,
      art.cupAnchor.x,
      art.cupAnchor.y,
      PROJECTILE_TEXTURE_KEYS[player.selectedProjectileType],
    ).setDepth(2);
    this.armContainer = new Phaser.GameObjects.Container(
      scene,
      art.armPivot.x,
      art.armPivot.y,
      [arm, this.loadedProjectile],
    );

    this.wheelContainers = art.wheelPositions.map(({ x, y }) =>
      this.createWheel(scene, x, y, art.wheelKey),
    );
    this.bodyContainer = new Phaser.GameObjects.Container(scene, 0, 0, [
      body,
      this.armContainer,
      ...this.wheelContainers,
    ]).setScale(
      -GAME_CONFIG.catapult.visualScale,
      GAME_CONFIG.catapult.visualScale,
    );
    this.damageMarks = new Phaser.GameObjects.Graphics(scene).setDepth(3);
    this.impactFlash = new Phaser.GameObjects.Graphics(scene)
      .setDepth(4)
      .setAlpha(0);

    this.healthFill = new Phaser.GameObjects.Rectangle(
      scene,
      -50,
      -112,
      100,
      9,
      VIEW_COLORS.health,
    ).setOrigin(0, 0.5);

    const healthBackground = new Phaser.GameObjects.Rectangle(
      scene,
      0,
      -112,
      108,
      17,
      VIEW_COLORS.healthBackground,
      0.95,
    ).setStrokeStyle(2, palette.signal, 0.45);

    this.healthText = new Phaser.GameObjects.Text(
      scene,
      0,
      -133,
      "",
      {
        color: RETRO_UI.text.primary,
        fontFamily: UI_FONT,
        fontSize: "13px",
        fontStyle: "bold",
      },
    ).setOrigin(0.5);

    const playerNumber = player.id === "left" ? 1 : 2;
    const playerLabel = new Phaser.GameObjects.Text(
      scene,
      0,
      -155,
      displayName?.toLocaleUpperCase("ru-RU") ??
        STRINGS_RU.playerName(playerNumber),
      {
        color:
          player.id === "left"
            ? RETRO_UI.text.cyan
            : RETRO_UI.text.coral,
        fontFamily: UI_FONT,
        fontSize: "15px",
        fontStyle: "bold",
        letterSpacing: 1,
      },
    ).setOrigin(0.5);

    this.activeText = new Phaser.GameObjects.Text(
      scene,
      0,
      -177,
      STRINGS_RU.activePlayer,
      {
        color: RETRO_UI.text.orange,
        fontFamily: UI_FONT,
        fontSize: "11px",
        fontStyle: "bold",
        letterSpacing: 1,
      },
    ).setOrigin(0.5);

    this.activeOutline = new Phaser.GameObjects.Arc(
      scene,
      0,
      -34,
      58,
      0,
      360,
      false,
      VIEW_COLORS.active,
      0.06,
    ).setStrokeStyle(3, VIEW_COLORS.active, 0.7);

    this.effectAura = new Phaser.GameObjects.Arc(
      scene,
      0,
      -36,
      64,
      0,
      360,
      false,
      0xff7043,
      0.08,
    ).setStrokeStyle(4, 0xff8a65, 0.82);

    this.effectText = new Phaser.GameObjects.Text(
      scene,
      0,
      -202,
      "",
      {
        color: RETRO_UI.text.coral,
        fontFamily: UI_FONT,
        fontSize: "12px",
        fontStyle: "bold",
        backgroundColor: RETRO_UI.text.ink,
        padding: { x: 8, y: 4 },
      },
    ).setOrigin(0.5);

    this.add([
      this.activeOutline,
      this.effectAura,
      shadow,
      this.bodyContainer,
      this.damageMarks,
      this.impactFlash,
      healthBackground,
      this.healthFill,
      this.healthText,
      playerLabel,
      this.activeText,
      this.effectText,
    ]);
    this.setDepth(20);
    this.setLoadedProjectile(player.selectedProjectileType, isActive);
    this.update(player, isActive);
    this.setAim(this.angleDeg, this.power);
  }

  private createWheel(
    scene: Phaser.Scene,
    x: number,
    y: number,
    textureKey: string,
  ): Phaser.GameObjects.Container {
    const wheel = new Phaser.GameObjects.Container(scene, x, y);
    const wheelSprite = new Phaser.GameObjects.Image(
      scene,
      0,
      0,
      textureKey,
    ).setDisplaySize(42, 42);
    wheel.add(wheelSprite);

    return wheel;
  }

  update(
    player: PlayerState,
    isActive: boolean,
    showLoadedProjectile: boolean = isActive,
  ): void {
    const healthRatio = player.health / GAME_CONFIG.catapult.maxHealth;

    this.setPosition(player.catapultX, player.catapultY);
    this.healthFill.setDisplaySize(100 * healthRatio, 9);
    this.healthText.setText(STRINGS_RU.health(player.health));
    this.drawDamageMarks(healthRatio);
    this.activeText.setVisible(isActive);
    this.activeOutline.setVisible(isActive);
    this.setLoadedProjectile(
      player.selectedProjectileType,
      showLoadedProjectile,
    );

    const isFrozen = player.effects.frozenTurnsRemaining > 0;
    const isBurning = player.effects.burningTurnsRemaining > 0;

    this.effectAura.setVisible(isFrozen || isBurning);
    this.effectText.setVisible(isFrozen || isBurning);

    if (isFrozen) {
      this.effectAura
        .setFillStyle(0x72d7ff, 0.1)
        .setStrokeStyle(4, 0x8fe8ff, 0.9);
      this.effectText
        .setColor("#b8f4ff")
        .setText(
          STRINGS_RU.frozenStatus(
            player.effects.frozenTurnsRemaining,
          ),
        );
    } else if (isBurning) {
      this.effectAura
        .setFillStyle(0xff7043, 0.08)
        .setStrokeStyle(4, 0xff8a65, 0.82);
      this.effectText
        .setColor("#ffb08f")
        .setText(
          STRINGS_RU.burningStatus(
            player.effects.burningTurnsRemaining,
          ),
        );
    }
  }

  setAim(angleDeg: number, power: number): void {
    this.angleDeg = angleDeg;
    this.power = power;

    if (this.firing) {
      return;
    }

    this.applyLoadedPose();
  }

  setLoadedProjectile(
    projectileType: ProjectileType,
    visible: boolean = true,
  ): void {
    const displaySize =
      GAME_CONFIG.projectiles[projectileType].radius * 2.8;

    this.loadedProjectileVisibleWhenReady = visible;
    this.loadedProjectile
      .setTexture(PROJECTILE_TEXTURE_KEYS[projectileType])
      .setDisplaySize(displaySize, displaySize)
      .setVisible(visible && !this.firing);
  }

  getLoadedProjectileWorldPosition(): { x: number; y: number } {
    const point = this.loadedProjectile
      .getWorldTransformMatrix()
      .transformPoint(0, 0);

    return { x: point.x, y: point.y };
  }

  /**
   * Returns the cup position at the end of the firing swing.
   *
   * The body recoil is a visual effect and must not move the physics spawn
   * point. Temporarily evaluating the release pose keeps the preview and the
   * actual shot on the same trajectory while preserving the recoil animation.
   */
  getReleaseProjectileWorldPosition(): { x: number; y: number } {
    const bodyX = this.bodyContainer.x;
    const bodyY = this.bodyContainer.y;
    const bodyAngle = this.bodyContainer.angle;
    const armAngle = this.armContainer.angle;

    this.bodyContainer.setPosition(0, this.getLoadedBodyY());
    this.bodyContainer.setAngle(this.getLoadedBodyAngle());
    this.armContainer.setAngle(this.getReleaseArmAngle());

    const point = this.getLoadedProjectileWorldPosition();

    this.bodyContainer.setPosition(bodyX, bodyY);
    this.bodyContainer.setAngle(bodyAngle);
    this.armContainer.setAngle(armAngle);

    return point;
  }

  playFire(
    onRelease: (launchPoint: { x: number; y: number }) => void,
  ): void {
    if (this.firing) {
      return;
    }

    this.firing = true;
    const recoilX = -this.horizontalDirection * 9;
    const loadedAngle = this.getLoadedBodyAngle();
    const loadedY = this.getLoadedBodyY();
    const releaseArmAngle = this.getReleaseArmAngle();

    this.scene.tweens.killTweensOf(this.armContainer);
    this.scene.tweens.add({
      targets: this.armContainer,
      angle: releaseArmAngle,
      duration: 270,
      ease: "Cubic.easeIn",
      onComplete: () => {
        const launchPoint = this.getReleaseProjectileWorldPosition();
        this.loadedProjectileVisibleWhenReady = false;
        this.loadedProjectile.setVisible(false);
        onRelease(launchPoint);
        this.scene.time.delayedCall(110, () => {
          this.scene.tweens.add({
            targets: this.armContainer,
            angle: this.getLoadedArmAngle(),
            duration: 520,
            ease: "Back.easeOut",
            onComplete: () => {
              this.firing = false;
              this.applyLoadedPose();
              this.loadedProjectile.setVisible(
                this.loadedProjectileVisibleWhenReady,
              );
            },
          });
        });
      },
    });

    this.scene.tweens.add({
      targets: this.bodyContainer,
      x: recoilX,
      y: loadedY + 4,
      angle: loadedAngle - this.horizontalDirection * 2.5,
      duration: 220,
      ease: "Cubic.easeIn",
      onComplete: () => {
        this.scene.time.delayedCall(90, () => {
          this.scene.tweens.add({
            targets: this.bodyContainer,
            x: 0,
            y: loadedY,
            angle: loadedAngle,
            duration: 430,
            ease: "Back.easeOut",
          });
        });
      },
    });

    this.wheelContainers.forEach((wheel) => {
      this.scene.tweens.add({
        targets: wheel,
        angle: wheel.angle - this.horizontalDirection * 75,
        duration: 300,
        ease: "Cubic.easeOut",
      });
    });
  }

  playImpact(damage: number = 1): void {
    const impulseX = this.horizontalDirection * 8;
    const intensity = Phaser.Math.Clamp(damage / 35, 0.65, 1.45);

    this.impactFlash.clear();
    this.impactFlash.fillStyle(0xffffff, 0.92);
    this.impactFlash.fillEllipse(0, -25, 112, 86);
    this.impactFlash.setAlpha(0.95).setScale(0.72);
    this.scene.tweens.add({
      targets: this.impactFlash,
      alpha: 0,
      scale: 1.2,
      duration: 180,
      ease: "Cubic.easeOut",
    });

    this.scene.tweens.add({
      targets: this.bodyContainer,
      x: impulseX * intensity,
      angle:
        this.getLoadedBodyAngle() +
        this.horizontalDirection * 3.5 * intensity,
      duration: 95,
      yoyo: true,
      repeat: 2,
      ease: "Sine.easeInOut",
    });

    this.scene.tweens.add({
      targets: this.armContainer,
      angle: this.getLoadedArmAngle() - this.horizontalDirection * 7,
      duration: 85,
      yoyo: true,
      repeat: 2,
      ease: "Sine.easeInOut",
    });
  }

  playDisplacement(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
  ): void {
    this.setPosition(fromX, fromY);
    this.wheelContainers.forEach((wheel) => {
      this.scene.tweens.add({
        targets: wheel,
        angle: wheel.angle + (toX - fromX) * 2.8,
        duration: 420,
        ease: "Cubic.easeOut",
      });
    });
    this.scene.tweens.add({
      targets: this,
      x: toX,
      y: toY,
      duration: 420,
      ease: "Cubic.easeOut",
    });
  }

  private getPowerRatio(): number {
    return Phaser.Math.Clamp(
      (this.power - GAME_CONFIG.aiming.minPower) /
        (GAME_CONFIG.aiming.maxPower - GAME_CONFIG.aiming.minPower),
      0,
      1,
    );
  }

  private getLoadedBodyAngle(): number {
    const normalizedAngle =
      (this.angleDeg - GAME_CONFIG.aiming.initialAngleDeg) /
      (GAME_CONFIG.aiming.maxAngleDeg - GAME_CONFIG.aiming.minAngleDeg);

    return -this.horizontalDirection * normalizedAngle * 1.2;
  }

  private getLoadedBodyY(): number {
    return this.getPowerRatio() * 1.5;
  }

  private getAngleRatio(): number {
    return Phaser.Math.Clamp(
      (this.angleDeg - GAME_CONFIG.aiming.minAngleDeg) /
        (GAME_CONFIG.aiming.maxAngleDeg - GAME_CONFIG.aiming.minAngleDeg),
      0,
      1,
    );
  }

  private getLoadedArmAngle(): number {
    // The cup stays behind the axle: the left catapult launches right and
    // the right catapult launches left after the authored art is mirrored.
    const forwardLean =
      6 + this.getPowerRatio() * 6 + this.getAngleRatio() * 4;

    return this.horizontalDirection * forwardLean;
  }

  private getReleaseArmAngle(): number {
    return this.horizontalDirection * (38 + this.getAngleRatio() * 12);
  }

  private applyLoadedPose(): void {
    this.bodyContainer.setPosition(0, this.getLoadedBodyY());
    this.bodyContainer.setAngle(this.getLoadedBodyAngle());
    this.armContainer.setAngle(this.getLoadedArmAngle());
  }

  getDamageLabelPosition(): { x: number; y: number } {
    return {
      x: this.x,
      y: this.y - 205,
    };
  }

  private drawDamageMarks(healthRatio: number): void {
    this.damageMarks.clear();

    if (healthRatio >= 0.76) {
      return;
    }

    const stage = healthRatio > 0.5 ? 1 : healthRatio > 0.25 ? 2 : 3;
    this.damageMarks.lineStyle(3, 0x23160f, 0.96);
    for (let index = 0; index < stage + 1; index += 1) {
      const startX = -30 + index * 19;
      const startY = -42 + (index % 2) * 13;
      this.damageMarks.beginPath();
      this.damageMarks.moveTo(startX, startY);
      this.damageMarks.lineTo(startX + 8, startY + 9);
      this.damageMarks.lineTo(startX + 2, startY + 19);
      this.damageMarks.lineTo(startX + 13, startY + 27);
      this.damageMarks.strokePath();
    }

    this.damageMarks.fillStyle(0x120d09, 0.4 + stage * 0.12);
    this.damageMarks.fillEllipse(18, -20, 22 + stage * 6, 12 + stage * 4);
    if (stage === 3) {
      this.damageMarks.lineStyle(4, 0xb85b2f, 0.85);
      this.damageMarks.lineBetween(-38, -2, -18, -14);
      this.damageMarks.lineBetween(24, -4, 42, -18);
    }
  }
}
