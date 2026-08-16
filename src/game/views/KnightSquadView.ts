import * as Phaser from "phaser";

import {
  getTerrainHeightAt,
  type TerrainPoint,
} from "../arena/arenaCatalog";
import type { KnightSquadState } from "../core/battleTypes";
import { GAME_CONFIG } from "../core/gameConfig";
import { RETRO_UI } from "../ui/retroTheme";

export const KNIGHT_MARCH_DURATION_MS = 2_800;

const WALK_FRAMES = {
  "royal-swordswoman-walk-v3": [1, 2, 3, 4, 5, 6, 7, 8],
  "royal-swordswoman": [0, 1, 2, 3, 4, 5, 6, 7],
  "royal-spearman": [0, 1, 2, 3, 4, 5, 6, 7],
  "royal-ranger": [0, 1, 2, 3, 4, 5, 6, 7],
  "raider-axeman": [0, 1, 2, 3, 4, 5, 6, 7],
  "raider-captain": [0, 1, 2, 3, 4, 5, 6, 7],
  "raider-scout": [0, 1, 2, 3, 4, 5, 6, 7],
} as const;

type UnitKey = keyof typeof WALK_FRAMES;

interface UnitVisualMetadata {
  readonly idleFrame: number;
  readonly walkFrames: readonly number[];
  readonly originY: number;
  readonly scale: number;
  readonly stride: number;
}

const UNIT_METADATA: Record<
  UnitKey,
  Omit<UnitVisualMetadata, "walkFrames">
> = {
  "royal-swordswoman-walk-v3": {
    idleFrame: 0,
    originY: 232 / 256,
    scale: 0.5,
    stride: 132,
  },
  "royal-swordswoman": {
    idleFrame: 0,
    originY: 0.9,
    scale: 0.5,
    stride: 96,
  },
  "royal-spearman": {
    idleFrame: 0,
    originY: 0.9,
    scale: 0.5,
    stride: 96,
  },
  "royal-ranger": {
    idleFrame: 0,
    originY: 0.9,
    scale: 0.5,
    stride: 96,
  },
  "raider-axeman": {
    idleFrame: 0,
    originY: 0.9,
    scale: 0.5,
    stride: 96,
  },
  "raider-captain": {
    idleFrame: 0,
    originY: 0.9,
    scale: 0.5,
    stride: 96,
  },
  "raider-scout": {
    idleFrame: 0,
    originY: 0.9,
    scale: 0.5,
    stride: 96,
  },
};

function getUnitVisualMetadata(unitKey: UnitKey): UnitVisualMetadata {
  return {
    ...UNIT_METADATA[unitKey],
    walkFrames: WALK_FRAMES[unitKey],
  };
}

export class KnightSquadView {
  private static readonly UNIT_KEYS = {
    left: [
      "royal-swordswoman-walk-v3",
      "royal-spearman",
      "royal-ranger",
    ],
    right: ["raider-axeman", "raider-captain", "raider-scout"],
  } as const;
  private static readonly IDLE_FRAMES = [0, 2, 4] as const;
  private static readonly PHASE_FRAMES = [0, 2, 4] as const;
  private static readonly OFFSETS = [-58, 0, 58] as const;
  private static readonly SURFACE_SAMPLE_STEP = 8;
  private static readonly SLOPE_SAMPLE_OFFSET = 24;
  private static readonly SLOPE_FACTOR = 0.45;
  private static readonly MAX_TILT_DEGREES = 8;

  private readonly container: Phaser.GameObjects.Container;
  private readonly terrain: readonly TerrainPoint[];
  private readonly shadows: Phaser.GameObjects.Ellipse[];
  private readonly fighters: Phaser.GameObjects.Sprite[];
  private readonly unitVisuals: readonly UnitVisualMetadata[];
  private readonly healthFill: Phaser.GameObjects.Rectangle;
  private readonly label: Phaser.GameObjects.Text;
  private lastHealth: number;

  constructor(
    private readonly scene: Phaser.Scene,
    state: KnightSquadState,
    terrain: readonly TerrainPoint[],
  ) {
    this.terrain = terrain;
    const color =
      state.ownerId === "left"
        ? RETRO_UI.colors.playerLeft
        : RETRO_UI.colors.playerRight;
    const unitKeys = KnightSquadView.UNIT_KEYS[state.ownerId];
    this.unitVisuals = unitKeys.map((unitKey, index) => {
      const visual = getUnitVisualMetadata(unitKey);
      return {
        ...visual,
        idleFrame:
          index === 0
            ? visual.idleFrame
            : KnightSquadView.IDLE_FRAMES[index] ?? visual.idleFrame,
      };
    });
    this.shadows = KnightSquadView.OFFSETS.map((offsetX, index) =>
      scene.add
        .ellipse(offsetX, index === 1 ? 2 : 0, 70, 15, 0x07090d, 0.42)
        .setScale(index === 1 ? 1.05 : 0.92),
    );
    this.fighters = unitKeys.map((unitKey, index) => {
      const visual = this.unitVisuals[index];
      const scale =
        index === 1 && unitKey !== "royal-swordswoman-walk-v3"
          ? 0.54
          : visual?.scale ?? 0.5;
      const fighter = scene.add
        .sprite(
          KnightSquadView.OFFSETS[index] ?? 0,
          0,
          unitKey,
          visual?.idleFrame ?? 0,
        )
        .setOrigin(0.5, visual?.originY ?? 0.9)
        .setScale(scale)
        .setFlipX(state.ownerId === "right");
      fighter.setData(
        "idleFrame",
        visual?.idleFrame ?? 0,
      );
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
        ...this.shadows,
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
    this.layoutAt(state.x);
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
    void fromY;
    void toY;

    this.layoutAt(fromX);
    this.container.setVisible(true);
    const direction = toX >= fromX ? 1 : -1;
    const surfacePathLength = this.getSurfacePathLength(fromX, toX);
    const cycles = this.unitVisuals.map((visual) =>
      Math.min(
        5,
        Math.max(3, Math.round(surfacePathLength / visual.stride)),
      ),
    );
    const cursor = { progress: 0 };

    this.fighters.forEach((fighter) => {
      fighter.setFlipX(direction < 0);
      fighter.stop();
    });
    this.layoutAt(fromX, {
      travelled: 0,
      total: surfacePathLength,
      cycles,
    });

    this.scene.tweens.add({
      targets: cursor,
      progress: 1,
      duration: KNIGHT_MARCH_DURATION_MS,
      ease: "Linear",
      onUpdate: () => {
        const progress = Phaser.Math.Clamp(cursor.progress, 0, 1);
        const centerX = Phaser.Math.Linear(fromX, toX, progress);
        const travelled = this.getSurfacePathLength(fromX, centerX);

        this.layoutAt(centerX, {
          travelled,
          total: surfacePathLength,
          cycles,
        });
      },
      onComplete: () => {
        this.layoutAt(toX);
        this.container.setAngle(0);
      },
    });
  }

  private layoutAt(
    centerX: number,
    march?: {
      travelled: number;
      total: number;
      cycles: readonly number[];
    },
  ): void {
    const centerY = getTerrainHeightAt(this.terrain, centerX);
    this.container.setPosition(centerX, centerY).setAngle(0);

    this.fighters.forEach((fighter, index) => {
      const visual = this.unitVisuals[index];
      const offsetX = KnightSquadView.OFFSETS[index] ?? 0;
      const worldX = centerX + offsetX;
      const groundY = getTerrainHeightAt(this.terrain, worldX);
      const localY = groundY - centerY;
      const slopeLeft = getTerrainHeightAt(
        this.terrain,
        worldX - KnightSquadView.SLOPE_SAMPLE_OFFSET,
      );
      const slopeRight = getTerrainHeightAt(
        this.terrain,
        worldX + KnightSquadView.SLOPE_SAMPLE_OFFSET,
      );
      const slopeDegrees = Phaser.Math.RadToDeg(
        Math.atan2(
          slopeRight - slopeLeft,
          KnightSquadView.SLOPE_SAMPLE_OFFSET * 2,
        ),
      );
      const angle = Phaser.Math.Clamp(
        slopeDegrees * KnightSquadView.SLOPE_FACTOR,
        -KnightSquadView.MAX_TILT_DEGREES,
        KnightSquadView.MAX_TILT_DEGREES,
      );

      fighter.setPosition(offsetX, localY).setAngle(angle);
      this.shadows[index]?.setPosition(
        offsetX,
        localY + (index === 1 ? 2 : 0),
      );

      if (!march) {
        fighter
          .stop()
          .setFrame(visual?.idleFrame ?? 0);
      } else {
        const frameOffset =
          march.total === 0
            ? 0
            : Math.floor(
                (march.travelled / march.total) *
                  (march.cycles[index] ?? 3) *
                  8,
              ) % 8;
        const phaseOffset = KnightSquadView.PHASE_FRAMES[index] ?? 0;
        const walkFrames = visual?.walkFrames ?? [0];
        const frameIndex =
          (frameOffset + phaseOffset) % walkFrames.length;
        fighter.setFrame(visual?.walkFrames[frameIndex] ?? 0);
      }
    });
  }

  private getSurfacePathLength(fromX: number, toX: number): number {
    const startX = Math.min(fromX, toX);
    const endX = Math.max(fromX, toX);

    if (startX === endX) {
      return 0;
    }

    let previousX = startX;
    let previousY = getTerrainHeightAt(this.terrain, previousX);
    let surfaceLength = 0;

    for (
      let sampleX = startX + KnightSquadView.SURFACE_SAMPLE_STEP;
      sampleX < endX;
      sampleX += KnightSquadView.SURFACE_SAMPLE_STEP
    ) {
      const sampleY = getTerrainHeightAt(this.terrain, sampleX);
      surfaceLength += Math.hypot(
        sampleX - previousX,
        sampleY - previousY,
      );
      previousX = sampleX;
      previousY = sampleY;
    }

    const endY = getTerrainHeightAt(this.terrain, endX);
    return (
      surfaceLength +
      Math.hypot(endX - previousX, endY - previousY)
    );
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
