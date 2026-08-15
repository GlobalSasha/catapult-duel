import * as Phaser from "phaser";

import type { KnightSquadState } from "../core/battleTypes";
import { GAME_CONFIG } from "../core/gameConfig";
import { RETRO_UI } from "../ui/retroTheme";

export const KNIGHT_MARCH_DURATION_MS = 2_800;

export class KnightSquadView {
  private static readonly UNIT_KEYS = {
    left: ["royal-swordswoman", "royal-spearman", "royal-ranger"],
    right: ["raider-axeman", "raider-captain", "raider-scout"],
  } as const;

  private readonly container: Phaser.GameObjects.Container;
  private readonly fighters: Phaser.GameObjects.Sprite[];
  private readonly healthFill: Phaser.GameObjects.Rectangle;
  private readonly label: Phaser.GameObjects.Text;
  private lastHealth: number;

  constructor(
    private readonly scene: Phaser.Scene,
    state: KnightSquadState,
  ) {
    const color =
      state.ownerId === "left"
        ? RETRO_UI.colors.playerLeft
        : RETRO_UI.colors.playerRight;
    const unitKeys = KnightSquadView.UNIT_KEYS[state.ownerId];
    const offsets = [-58, 0, 58] as const;
    const shadows = offsets.map((offsetX, index) =>
      scene.add
        .ellipse(offsetX, index === 1 ? 2 : 0, 70, 15, 0x07090d, 0.42)
        .setScale(index === 1 ? 1.05 : 0.92),
    );
    this.fighters = unitKeys.map((unitKey, index) => {
      const animationKey = `${unitKey}-march`;

      if (!scene.anims.exists(animationKey)) {
        scene.anims.create({
          key: animationKey,
          frames: scene.anims.generateFrameNumbers(unitKey, {
            start: 0,
            end: 7,
          }),
          frameRate: 9,
          repeat: -1,
        });
      }

      const baseY = index === 1 ? 4 : 0;
      const fighter = scene.add
        .sprite(offsets[index], baseY, unitKey, index * 2)
        .setOrigin(0.5, 0.9)
        .setScale(index === 1 ? 0.54 : 0.5)
        .setFlipX(state.ownerId === "right");
      fighter.setData("baseY", baseY);
      fighter.setData("animationKey", animationKey);
      fighter.anims.timeScale = [0.92, 0.82, 1.08][index] ?? 1;
      scene.tweens.add({
        targets: fighter,
        y: baseY - (index === 1 ? 2.5 : 1.5),
        duration: 880 + index * 130,
        delay: index * 170,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
      });
      return fighter;
    });

    const healthBackground = scene.add
      .rectangle(-75, -116, 150, 10, RETRO_UI.colors.ink, 0.92)
      .setOrigin(0, 0.5)
      .setStrokeStyle(1, RETRO_UI.colors.cream, 0.75);
    this.healthFill = scene.add
      .rectangle(-72, -116, 144, 6, color, 1)
      .setOrigin(0, 0.5);
    this.label = scene.add
      .text(0, -136, "", {
        color: RETRO_UI.text.primary,
        fontFamily: RETRO_UI.font.ui,
        fontSize: "14px",
        fontStyle: "bold",
        stroke: RETRO_UI.text.ink,
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    this.container = scene.add
      .container(state.x, state.y, [
        ...shadows,
        ...this.fighters,
        healthBackground,
        this.healthFill,
        this.label,
      ])
      .setDepth(34);
    this.lastHealth = state.health;
    this.update(state);
  }

  update(state: KnightSquadState): void {
    this.container.setPosition(state.x, state.y);
    const wasAlive = this.lastHealth > 0;
    this.container.setVisible(state.health > 0 || wasAlive);
    this.healthFill.setScale(
      state.health / GAME_CONFIG.knights.maxHealth,
      1,
    );
    this.label.setText(
      `РЫЦАРИ ${state.progress}/${GAME_CONFIG.knights.stepsToVictory} · ${state.health} HP`,
    );
    this.lastHealth = state.health;
  }

  animateMove(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
  ): void {
    this.container.setPosition(fromX, fromY).setVisible(true);
    const direction = toX >= fromX ? 1 : -1;

    this.fighters.forEach((fighter, index) => {
      fighter.setFlipX(direction < 0);
      fighter.play({
        key: fighter.getData("animationKey") as string,
        startFrame: (index * 2) % 8,
      });
    });
    this.scene.tweens.add({
      targets: this.container,
      x: toX,
      y: toY,
      angle: direction * 0.8,
      duration: KNIGHT_MARCH_DURATION_MS,
      ease: "Linear",
      onComplete: () => {
        this.container.setAngle(0);
        this.fighters.forEach((fighter, index) => {
          fighter.stop().setFrame((index * 2) % 8);
        });
      },
    });
  }

  playImpact(destroyed: boolean): void {
    this.container.setVisible(true);
    this.fighters.forEach((fighter, index) => {
      fighter.stop();
      fighter.setTint(0xff6b55);
      this.scene.time.delayedCall(130, () => fighter.clearTint());

      if (!destroyed) {
        this.scene.tweens.add({
          targets: fighter,
          x: fighter.x + (index % 2 === 0 ? -5 : 5),
          duration: 55,
          yoyo: true,
          repeat: 3,
        });
        return;
      }

      this.scene.tweens.add({
        targets: fighter,
        y: fighter.y + 18,
        angle: index % 2 === 0 ? -72 : 72,
        alpha: 0,
        delay: index * 80,
        duration: 520,
        ease: "Cubic.easeIn",
        onComplete: () => {
          if (index === this.fighters.length - 1) {
            this.container.setVisible(false);
          }
        },
      });
    });
  }

  getLabelPosition(): { x: number; y: number } {
    return { x: this.container.x, y: this.container.y - 150 };
  }
}
