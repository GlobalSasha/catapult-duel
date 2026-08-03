import * as Phaser from "phaser";

import type { PlayerState } from "../core/battleTypes";
import { GAME_CONFIG } from "../core/gameConfig";
import { STRINGS_RU } from "../i18n/strings.ru";

const VIEW_COLORS = {
  left: {
    signal: 0x9ec5ff,
  },
  right: {
    signal: 0xffb29b,
  },
  healthBackground: 0x111a28,
  health: 0x7ee2a8,
  active: 0xffd166,
} as const;

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
  private readonly armContainer: Phaser.GameObjects.Container;
  private readonly wheelContainers: readonly Phaser.GameObjects.Container[];
  private readonly horizontalDirection: 1 | -1;
  private angleDeg: number = GAME_CONFIG.aiming.initialAngleDeg;
  private power: number = GAME_CONFIG.aiming.initialPower;
  private firing = false;

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
    this.armContainer = new Phaser.GameObjects.Container(
      scene,
      art.armPivot.x,
      art.armPivot.y,
      [arm],
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

    this.healthFill = new Phaser.GameObjects.Rectangle(
      scene,
      -50,
      -142,
      100,
      9,
      VIEW_COLORS.health,
    ).setOrigin(0, 0.5);

    const healthBackground = new Phaser.GameObjects.Rectangle(
      scene,
      0,
      -142,
      108,
      17,
      VIEW_COLORS.healthBackground,
      0.95,
    ).setStrokeStyle(2, palette.signal, 0.45);

    this.healthText = new Phaser.GameObjects.Text(
      scene,
      0,
      -163,
      "",
      {
        color: "#eaf1ff",
        fontFamily: "Arial, sans-serif",
        fontSize: "13px",
        fontStyle: "bold",
      },
    ).setOrigin(0.5);

    const playerNumber = player.id === "left" ? 1 : 2;
    const playerLabel = new Phaser.GameObjects.Text(
      scene,
      0,
      -186,
      displayName?.toLocaleUpperCase("ru-RU") ??
        STRINGS_RU.playerName(playerNumber),
      {
        color: player.id === "left" ? "#9ec5ff" : "#ffb29b",
        fontFamily: "Arial, sans-serif",
        fontSize: "15px",
        fontStyle: "bold",
        letterSpacing: 1,
      },
    ).setOrigin(0.5);

    this.activeText = new Phaser.GameObjects.Text(
      scene,
      0,
      -208,
      STRINGS_RU.activePlayer,
      {
        color: "#ffd166",
        fontFamily: "Arial, sans-serif",
        fontSize: "11px",
        fontStyle: "bold",
        letterSpacing: 1,
      },
    ).setOrigin(0.5);

    this.activeOutline = new Phaser.GameObjects.Arc(
      scene,
      0,
      -44,
      72,
      0,
      360,
      false,
      VIEW_COLORS.active,
      0.06,
    ).setStrokeStyle(3, VIEW_COLORS.active, 0.7);

    this.effectAura = new Phaser.GameObjects.Arc(
      scene,
      0,
      -48,
      78,
      0,
      360,
      false,
      0xff7043,
      0.08,
    ).setStrokeStyle(4, 0xff8a65, 0.82);

    this.effectText = new Phaser.GameObjects.Text(
      scene,
      0,
      -234,
      "",
      {
        color: "#ffb08f",
        fontFamily: "Arial, sans-serif",
        fontSize: "12px",
        fontStyle: "bold",
        backgroundColor: "#111a28",
        padding: { x: 8, y: 4 },
      },
    ).setOrigin(0.5);

    this.add([
      this.activeOutline,
      this.effectAura,
      shadow,
      this.bodyContainer,
      healthBackground,
      this.healthFill,
      this.healthText,
      playerLabel,
      this.activeText,
      this.effectText,
    ]);
    this.setDepth(20);
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

  update(player: PlayerState, isActive: boolean): void {
    const healthRatio = player.health / GAME_CONFIG.catapult.maxHealth;

    this.healthFill.setDisplaySize(100 * healthRatio, 9);
    this.healthText.setText(STRINGS_RU.health(player.health));
    this.activeText.setVisible(isActive);
    this.activeOutline.setVisible(isActive);

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

  playFire(onRelease: () => void): void {
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
        onRelease();
        this.scene.time.delayedCall(110, () => {
          this.scene.tweens.add({
            targets: this.armContainer,
            angle: this.getLoadedArmAngle(),
            duration: 520,
            ease: "Back.easeOut",
            onComplete: () => {
              this.firing = false;
              this.applyLoadedPose();
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

  playImpact(): void {
    const impulseX = this.horizontalDirection * 8;

    this.scene.tweens.add({
      targets: this.bodyContainer,
      x: impulseX,
      angle: this.getLoadedBodyAngle() + this.horizontalDirection * 3.5,
      duration: 85,
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
      y: this.y - 222,
    };
  }
}
