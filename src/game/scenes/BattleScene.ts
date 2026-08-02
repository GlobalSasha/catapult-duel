import * as Phaser from "phaser";

import {
  DEFAULT_ARENA_ID,
  getArenaDefinition,
  getTerrainHeightAt,
  isArenaId,
  type ArenaDefinition,
  type ArenaObstacle,
  type ArenaId,
} from "../arena/arenaCatalog";
import { BattleController } from "../core/BattleController";
import type { PlayerId } from "../core/battleTypes";
import { createInitialBattleState } from "../core/createInitialBattleState";
import { GAME_CONFIG } from "../core/gameConfig";
import { getPlayerMaximumPower } from "../core/projectileEffects";
import type { ProtectionState } from "../core/protection";
import {
  cloneMatchPlacement,
  createDefaultMatchPlacement,
  isMatchPlacement,
  type MatchPlacement,
} from "../core/placement";
import {
  PROJECTILE_TYPES,
  type ProjectileType,
} from "../core/projectileCatalog";
import { simulateShot } from "../core/simulateShot";
import type {
  BattleEvent,
  FireCommand,
  FlightPoint,
  ShotResult,
} from "../core/shotTypes";
import {
  getWeatherDefinition,
  type WeatherId,
} from "../core/weather";
import { GAME_HEIGHT, GAME_WIDTH } from "../gameDimensions";
import { STRINGS_RU } from "../i18n/strings.ru";
import {
  AimingControls,
  type AimingValues,
} from "../ui/AimingControls";
import { CatapultView } from "../views/CatapultView";
import { drawProtectionBody } from "../views/drawProtection";

const COLORS = {
  panel: 0x171a1c,
  panelStroke: 0x8b6749,
  primaryText: "#eee5d4",
  secondaryText: "#b5a58d",
  accent: "#d28a42",
  ready: "#70b8b5",
} as const;

interface BattleSceneData {
  arenaId?: ArenaId;
  matchSeed?: number;
  placement?: MatchPlacement;
}

interface DestructibleView {
  body: Phaser.GameObjects.Graphics;
  damageOverlay: Phaser.GameObjects.Graphics;
  cracks: Phaser.GameObjects.Graphics;
  durabilityBackground: Phaser.GameObjects.Rectangle;
  durabilityFill: Phaser.GameObjects.Rectangle;
  rubble: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  width: number;
  height: number;
}

export class BattleScene extends Phaser.Scene {
  private battleController = new BattleController();
  private catapultViews!: Record<PlayerId, CatapultView>;
  private aimingControls!: AimingControls;
  private previewGraphics!: Phaser.GameObjects.Graphics;
  private fogOfWar!: Phaser.GameObjects.Graphics;
  private statusText!: Phaser.GameObjects.Text;
  private weatherText!: Phaser.GameObjects.Text;
  private windText!: Phaser.GameObjects.Text;
  private worldPositionMarker!: Phaser.GameObjects.Arc;
  private cachedPreviewPoints: FlightPoint[] = [];
  private previewDashOffset = 0;
  private previewShimmerPhase = 0;
  private readonly destructibleViews = new Map<
    string,
    DestructibleView
  >();
  private arenaId: ArenaId = DEFAULT_ARENA_ID;
  private matchPlacement: MatchPlacement = createDefaultMatchPlacement();
  private audioContext: AudioContext | null = null;

  constructor() {
    super("BattleScene");
  }

  create(data: BattleSceneData): void {
    this.cachedPreviewPoints = [];
    this.previewDashOffset = 0;
    this.previewShimmerPhase = 0;
    this.destructibleViews.clear();
    this.arenaId = isArenaId(data.arenaId)
      ? data.arenaId
      : DEFAULT_ARENA_ID;
    this.matchPlacement = isMatchPlacement(data.placement)
      ? cloneMatchPlacement(data.placement)
      : createDefaultMatchPlacement();
    this.battleController = new BattleController(
      createInitialBattleState(
        this.arenaId,
        Number.isFinite(data.matchSeed)
          ? (data.matchSeed ?? 0)
          : Date.now(),
        this.matchPlacement,
      ),
    );
    this.cameras.main.setBounds(
      0,
      -GAME_CONFIG.world.verticalOutOfBoundsMargin,
      GAME_CONFIG.world.width,
      GAME_CONFIG.world.height +
        GAME_CONFIG.world.verticalOutOfBoundsMargin,
    );

    this.drawArena();
    this.drawWeatherEffects();
    this.drawHeader();
    this.createStatus();
    this.createWorldRail();
    this.previewGraphics = this.add.graphics().setDepth(15);
    this.time.addEvent({
      delay: 70,
      loop: true,
      callback: () => {
        this.previewDashOffset = (this.previewDashOffset + 3.5) % 40;
        this.previewShimmerPhase += 0.16;

        if (
          this.battleController.getState().phase === "aiming" &&
          this.cachedPreviewPoints.length > 1
        ) {
          this.drawCachedPreview();
        }
      },
    });
    this.createCatapultViews();
    this.fogOfWar = this.add.graphics().setDepth(40);
    this.updateFogOfWar();
    this.aimingControls = new AimingControls(this, {
      onChange: (values) => {
        this.redrawPreview(values);
      },
      onFire: (values) => {
        this.fire(values);
      },
      onProjectileChange: (projectileType) => {
        const selected = this.selectProjectile(projectileType);
        if (selected) {
          this.playTone(520, 0.055, "square", 0.025, 360);
        }
        return selected;
      },
    });
    this.input.keyboard?.on("keydown", this.handleKeyDown, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off("keydown", this.handleKeyDown, this);
      if (this.audioContext) {
        void this.audioContext.close();
        this.audioContext = null;
      }
    });
    this.renderBattleState();
    this.centerCameraOnActivePlayer();
    this.redrawPreview(this.aimingControls.getValues());
  }

  private drawArena(): void {
    const arena = getArenaDefinition(this.arenaId);
    const segmentCount =
      Math.ceil(GAME_CONFIG.world.width / GAME_WIDTH) + 1;

    for (let index = 0; index < segmentCount; index += 1) {
      this.add
        .image(index * GAME_WIDTH, 0, arena.textureKey)
        .setOrigin(0)
        .setDisplaySize(GAME_WIDTH + 2, GAME_HEIGHT)
        .setScrollFactor(0.18, 0)
        .setFlipX(index % 2 === 1)
        .setTint(index % 2 === 0 ? 0xffffff : 0xe6eef8)
        .setDepth(-100);
    }

    this.add
      .rectangle(
        0,
        0,
        GAME_CONFIG.world.width,
        GAME_HEIGHT,
        0x08101e,
        0.17,
      )
      .setOrigin(0)
      .setDepth(-95);

    this.drawDynamicWorldLayers(arena);
    this.drawWastelandInfrastructure(arena);

    const terrain = this.add.graphics().setDepth(-40);
    const firstPoint = arena.terrain[0];
    const lastPoint = arena.terrain.at(-1);

    if (firstPoint && lastPoint) {
      terrain.fillStyle(arena.palette.groundColor, 0.98);
      terrain.lineStyle(6, arena.palette.surfaceColor, 0.78);
      terrain.beginPath();
      terrain.moveTo(firstPoint.x, firstPoint.y);
      arena.terrain.slice(1).forEach((point) => {
        terrain.lineTo(point.x, point.y);
      });
      terrain.lineTo(lastPoint.x, GAME_CONFIG.world.height);
      terrain.lineTo(firstPoint.x, GAME_CONFIG.world.height);
      terrain.closePath();
      terrain.fillPath();
      terrain.strokePath();
    }

    for (let x = 140; x < GAME_CONFIG.world.width; x += 190) {
      const pointIndex = Math.floor(x / 190) % arena.terrain.length;
      const point = arena.terrain[pointIndex];

      if (!point) {
        continue;
      }

      terrain.fillStyle(arena.palette.detailColor, 0.58);
      terrain.fillTriangle(
        x,
        Math.min(point.y + 38, GAME_HEIGHT - 20),
        x + 22,
        Math.min(point.y + 12, GAME_HEIGHT - 20),
        x + 44,
        Math.min(point.y + 42, GAME_HEIGHT - 20),
      );
    }

    arena.obstacles.forEach((obstacle) => {
      this.drawObstacle(arena, obstacle);
    });
    this.battleController
      .getState()
      .protections.forEach((protection) => {
        this.drawProtection(protection);
      });
    this.drawAmbientLife(arena);

    this.add
      .rectangle(0, 0, GAME_WIDTH, 196, 0x08101e, 0.62)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(800);
  }

  private drawWeatherEffects(): void {
    const weatherId = this.battleController.getState().weather.id;
    const overlayPalette: Record<
      WeatherId,
      { color: number; alpha: number }
    > = {
      superheat: { color: 0xff8a4c, alpha: 0.055 },
      rain: { color: 0x547aa8, alpha: 0.055 },
      snow: { color: 0xc7efff, alpha: 0.07 },
      sandstorm: { color: 0xc99152, alpha: 0.085 },
    };
    const palette = overlayPalette[weatherId];

    this.add
      .rectangle(
        0,
        196,
        GAME_WIDTH,
        GAME_HEIGHT - 196,
        palette.color,
        palette.alpha,
      )
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(8);

    if (weatherId === "superheat") {
      const shimmer = this.add
        .graphics()
        .setScrollFactor(0)
        .setDepth(9);

      shimmer.lineStyle(5, 0xffc278, 0.12);
      for (let row = 0; row < 7; row += 1) {
        const y = 250 + row * 88;
        shimmer.beginPath();
        shimmer.moveTo(-80, y);
        for (let x = 0; x <= GAME_WIDTH + 80; x += 120) {
          shimmer.lineTo(x, y + ((x / 120 + row) % 2) * 9);
        }
        shimmer.strokePath();
      }

      this.tweens.add({
        targets: shimmer,
        x: 42,
        alpha: 0.45,
        duration: 2600,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
      return;
    }

    if (weatherId === "sandstorm") {
      const sand = this.add
        .graphics()
        .setScrollFactor(0)
        .setDepth(11);

      for (let index = 0; index < 18; index += 1) {
        const y = 220 + ((index * 79) % 650);
        const x = -180 + ((index * 173) % 1500);
        sand.lineStyle(
          5 + (index % 3) * 3,
          index % 2 === 0 ? 0xe5b36f : 0x9b6b42,
          0.08 + (index % 4) * 0.018,
        );
        sand.lineBetween(x, y, x + 330 + (index % 4) * 70, y - 22);
      }

      this.tweens.add({
        targets: sand,
        x: 220,
        duration: 3100,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
      return;
    }

    const fallDistance = GAME_HEIGHT - 196;

    for (let layerIndex = 0; layerIndex < 2; layerIndex += 1) {
      const layer = this.add
        .graphics()
        .setPosition(0, -layerIndex * fallDistance)
        .setScrollFactor(0)
        .setDepth(11);

      if (weatherId === "rain") {
        layer.lineStyle(2, 0x9ed8ff, 0.28);
        for (let index = 0; index < 56; index += 1) {
          const x = (index * 137 + layerIndex * 59) % GAME_WIDTH;
          const y = 196 + ((index * 83) % fallDistance);
          layer.lineBetween(x, y, x - 13, y + 34);
        }
      } else {
        for (let index = 0; index < 48; index += 1) {
          const x = (index * 149 + layerIndex * 71) % GAME_WIDTH;
          const y = 196 + ((index * 97) % fallDistance);
          const radius = 2 + (index % 3);
          layer.fillStyle(0xe4f7ff, 0.32 + (index % 4) * 0.08);
          layer.fillCircle(x, y, radius);
        }
      }

      this.tweens.add({
        targets: layer,
        y: layer.y + fallDistance,
        x: weatherId === "snow" ? 38 : -26,
        duration: weatherId === "snow" ? 6800 : 1900,
        repeat: -1,
        ease: "Linear",
      });
    }
  }

  private drawDynamicWorldLayers(arena: ArenaDefinition): void {
    const midground = this.add
      .graphics()
      .setScrollFactor(0.42, 0.08)
      .setDepth(-72);

    for (let index = 0; index < 22; index += 1) {
      const x = 80 + index * 235;
      const ridgeHeight = 82 + ((index * 47) % 118);
      const ridgeWidth = 190 + ((index * 31) % 110);
      const baseY = 620 + ((index * 29) % 76);

      midground.fillStyle(arena.palette.detailColor, 0.2);
      midground.fillTriangle(
        x,
        baseY,
        x + ridgeWidth * 0.48,
        baseY - ridgeHeight,
        x + ridgeWidth,
        baseY,
      );
      midground.fillStyle(arena.palette.obstacleColor, 0.12);
      midground.fillRoundedRect(
        x + ridgeWidth * 0.36,
        baseY - ridgeHeight - 30,
        34,
        46,
        5,
      );
    }

    for (let index = 0; index < 9; index += 1) {
      const cloud = new Phaser.GameObjects.Container(
        this,
        220 + index * 520,
        245 + ((index * 37) % 105),
      );
      const alpha = this.arenaId === "highlands" ? 0.12 : 0.09;
      const color =
        this.arenaId === "highlands" ? 0xd4e8ff : 0xffd0a8;

      cloud.add([
        new Phaser.GameObjects.Ellipse(
          this,
          -38,
          7,
          86,
          24,
          color,
          alpha,
        ),
        new Phaser.GameObjects.Ellipse(
          this,
          8,
          0,
          112,
          34,
          color,
          alpha,
        ),
        new Phaser.GameObjects.Ellipse(
          this,
          60,
          9,
          76,
          22,
          color,
          alpha,
        ),
      ]);
      cloud.setScrollFactor(0.24, 0.04).setDepth(-82);
      this.add.existing(cloud);
      this.tweens.add({
        targets: cloud,
        x: cloud.x + (index % 2 === 0 ? 180 : -150),
        y: cloud.y + (index % 3 === 0 ? 12 : -8),
        duration: 18_000 + index * 1_100,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
      });
    }
  }

  private drawAmbientLife(arena: ArenaDefinition): void {
    const foliageColor =
      this.arenaId === "highlands" ? 0x7893a9 : 0xb56f45;

    for (let index = 0; index < 30; index += 1) {
      const x = 90 + index * 238;
      const groundY = getTerrainHeightAt(arena.terrain, x);
      const tuft = this.add
        .graphics({ x, y: groundY + 2 })
        .setDepth(-8);

      tuft.lineStyle(4, foliageColor, 0.58);
      tuft.beginPath();
      tuft.moveTo(0, 0);
      tuft.lineTo(-9, -20 - (index % 3) * 5);
      tuft.moveTo(0, 0);
      tuft.lineTo(3, -27 - (index % 4) * 4);
      tuft.moveTo(0, 0);
      tuft.lineTo(13, -17 - (index % 2) * 6);
      tuft.strokePath();

      this.tweens.add({
        targets: tuft,
        rotation: index % 2 === 0 ? 0.07 : -0.06,
        duration: 1900 + (index % 5) * 260,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }

    arena.obstacles.forEach((obstacle, index) => {
      const flag = this.add
        .graphics({
          x: obstacle.x + obstacle.width * 0.5,
          y: obstacle.y - 24,
        })
        .setDepth(4);

      flag.lineStyle(4, arena.palette.obstacleStrokeColor, 0.85);
      flag.lineBetween(0, 20, 0, -48);
      flag.fillStyle(
        index % 2 === 0 ? 0x7ee2a8 : 0xffd166,
        0.84,
      );
      flag.fillTriangle(2, -44, 48, -31, 2, -15);
      this.tweens.add({
        targets: flag,
        scaleX: 0.78,
        skewY: index % 2 === 0 ? 0.08 : -0.08,
        duration: 1150 + index * 170,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    });

    for (let index = 0; index < 8; index += 1) {
      const bird = this.add
        .graphics({
          x: 420 + index * 840,
          y: 245 + (index % 4) * 56,
        })
        .setScrollFactor(0.5, 0.08)
        .setDepth(-60);

      bird.lineStyle(3, 0xdcecff, 0.32);
      bird.beginPath();
      bird.moveTo(-15, 0);
      bird.lineTo(0, index % 2 === 0 ? -7 : -4);
      bird.lineTo(15, 0);
      bird.strokePath();
      this.tweens.add({
        targets: bird,
        x: bird.x + 280 + index * 18,
        y: bird.y + (index % 2 === 0 ? -28 : 22),
        duration: 12_000 + index * 900,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }

    const motes: Phaser.GameObjects.Arc[] = [];
    for (let index = 0; index < 24; index += 1) {
      const mote = this.add
        .circle(
          160 +
            ((index * 307) % (GAME_CONFIG.world.width - 320)),
          360 + ((index * 83) % 300),
          2 + (index % 3),
          this.arenaId === "highlands" ? 0xa8e6ff : 0xffbd78,
          0.13 + (index % 4) * 0.045,
        )
        .setDepth(-6);
      motes.push(mote);
    }
    this.tweens.add({
      targets: motes,
      y: "-=34",
      alpha: 0.04,
      duration: 3100,
      yoyo: true,
      repeat: -1,
      stagger: 125,
      ease: "Sine.easeInOut",
    });

    for (let index = 0; index < 7; index += 1) {
      const drone = this.add
        .container(520 + index * 930, 300 + (index % 3) * 72)
        .setScrollFactor(0.58, 0.1)
        .setDepth(-4);

      const hull = new Phaser.GameObjects.Graphics(this);
      hull.fillStyle(0x262d31, 0.96);
      hull.fillRoundedRect(-23, -9, 46, 18, 5);
      hull.lineStyle(2, 0xb66b3e, 0.9);
      hull.strokeRoundedRect(-23, -9, 46, 18, 5);
      hull.fillStyle(0x596269, 0.9);
      hull.fillTriangle(-31, 1, -20, -8, -20, 8);
      hull.fillTriangle(31, 1, 20, -8, 20, 8);
      hull.lineStyle(2, 0x8b9499, 0.78);
      hull.lineBetween(-18, -9, -27, -17);
      hull.lineBetween(18, -9, 27, -17);
      hull.lineBetween(0, -9, 0, -22);
      hull.fillStyle(0xd39a4b, 0.9);
      hull.fillCircle(-12, 0, 2);
      hull.fillCircle(12, 0, 2);

      const lamp = new Phaser.GameObjects.Arc(
        this,
        0,
        -23,
        4,
        0,
        360,
        false,
        index % 2 === 0 ? 0x70cbd4 : 0xe07a3f,
        1,
      );

      const createRotor = (x: number): Phaser.GameObjects.Container => {
        const ring = new Phaser.GameObjects.Arc(
          this,
          0,
          0,
          11,
          0,
          360,
          false,
          0x1d2428,
          0.9,
        ).setStrokeStyle(2, 0xa36a48, 0.92);
        const horizontalBlade = new Phaser.GameObjects.Rectangle(
          this,
          0,
          0,
          18,
          3,
          0x9ba6ab,
          0.9,
        );
        const verticalBlade = new Phaser.GameObjects.Rectangle(
          this,
          0,
          0,
          3,
          18,
          0x9ba6ab,
          0.9,
        );
        const hub = new Phaser.GameObjects.Arc(
          this,
          0,
          0,
          3,
          0,
          360,
          false,
          0xd39a4b,
          1,
        );

        return new Phaser.GameObjects.Container(
          this,
          x,
          -18,
          [ring, horizontalBlade, verticalBlade, hub],
        );
      };

      const leftRotor = createRotor(-28);
      const rightRotor = createRotor(28);
      drone.add([hull, leftRotor, rightRotor, lamp]);
      this.tweens.add({
        targets: leftRotor,
        angle: 360,
        duration: 520,
        repeat: -1,
        ease: "Linear",
      });
      this.tweens.add({
        targets: rightRotor,
        angle: -360,
        duration: 520,
        repeat: -1,
        ease: "Linear",
      });
      this.tweens.add({
        targets: lamp,
        alpha: 0.28,
        duration: 460,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
      this.tweens.add({
        targets: drone,
        x: drone.x + 360,
        y: drone.y + (index % 2 === 0 ? -34 : 28),
        duration: 10_000 + index * 850,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
  }

  private drawWastelandInfrastructure(arena: ArenaDefinition): void {
    const steel = this.arenaId === "highlands" ? 0x38444c : 0x4d3832;
    const rust = this.arenaId === "highlands" ? 0x8a5236 : 0xb35e36;
    const structures = this.add.graphics().setDepth(-16);

    for (let index = 0; index < 9; index += 1) {
      const x = 1180 + index * 660;
      const groundY = getTerrainHeightAt(arena.terrain, x);
      const height = 82 + (index % 3) * 34;
      const lampY = groundY - height;

      // A readable tripod floodlight instead of an abstract crossed marker.
      structures.lineStyle(8, 0x20272b, 0.96);
      structures.lineBetween(x, lampY + 12, x - 32, groundY);
      structures.lineBetween(x, lampY + 12, x + 32, groundY);
      structures.lineStyle(3, rust, 0.78);
      structures.lineBetween(x - 25, groundY - 12, x + 25, lampY + 28);
      structures.lineBetween(x + 25, groundY - 12, x - 25, lampY + 28);
      structures.fillStyle(0x171d20, 0.98);
      structures.fillRoundedRect(x - 27, lampY - 24, 54, 36, 6);
      structures.lineStyle(3, rust, 0.92);
      structures.strokeRoundedRect(x - 27, lampY - 24, 54, 36, 6);
      structures.fillStyle(steel, 1);
      structures.fillCircle(x, lampY - 6, 13);
      structures.lineStyle(3, 0x1b2124, 1);
      structures.strokeCircle(x, lampY - 6, 13);
      structures.fillStyle(
        index % 2 === 0 ? 0x83d5d9 : 0xe59a4f,
        0.9,
      );
      structures.fillCircle(x, lampY - 6, 8);
      structures.fillStyle(0x252b2e, 1);
      structures.fillRect(x - 9, lampY + 12, 18, 8);

      if (index % 2 === 0) {
        const tankX = x + 58;
        const tankY = groundY - 64;

        // Horizontal fuel tank with supports, welded bands and a pipe valve.
        structures.fillStyle(0x171b1d, 0.95);
        structures.fillRect(tankX + 14, groundY - 8, 14, 8);
        structures.fillRect(tankX + 70, groundY - 8, 14, 8);
        structures.fillStyle(0x252a2d, 0.9);
        structures.fillRoundedRect(tankX, tankY, 104, 58, 20);
        structures.lineStyle(4, rust, 0.72);
        structures.strokeRoundedRect(tankX, tankY, 104, 58, 20);
        structures.lineStyle(5, steel, 0.95);
        structures.lineBetween(tankX + 29, tankY + 3, tankX + 29, tankY + 55);
        structures.lineBetween(tankX + 75, tankY + 3, tankX + 75, tankY + 55);
        structures.lineStyle(3, 0x9a613f, 0.86);
        structures.lineBetween(tankX + 16, tankY + 29, tankX + 88, tankY + 29);
        structures.fillStyle(0xd39a4b, 0.92);
        structures.fillTriangle(
          tankX + 43,
          tankY + 19,
          tankX + 61,
          tankY + 19,
          tankX + 52,
          tankY + 37,
        );
        structures.fillStyle(0x15191b, 1);
        structures.fillCircle(tankX + 52, tankY - 5, 11);
        structures.lineStyle(3, rust, 0.9);
        structures.strokeCircle(tankX + 52, tankY - 5, 11);
        structures.lineBetween(tankX + 44, tankY - 5, tankX + 60, tankY - 5);
        structures.lineBetween(tankX + 52, tankY - 13, tankX + 52, tankY + 3);
        structures.lineStyle(8, steel, 0.96);
        structures.lineBetween(tankX + 104, tankY + 28, tankX + 144, tankY + 28);
        structures.lineBetween(tankX + 144, tankY + 28, tankX + 144, groundY - 12);
        structures.lineStyle(3, rust, 0.82);
        structures.strokeCircle(tankX + 144, groundY - 12, 7);
      }
    }

    for (let index = 0; index < 6; index += 1) {
      const stackX = 1450 + index * 920;
      const groundY = getTerrainHeightAt(arena.terrain, stackX);
      const smokePuffs: Phaser.GameObjects.Arc[] = [];
      for (let puffIndex = 0; puffIndex < 4; puffIndex += 1) {
        const puff = this.add
          .circle(
            stackX + (puffIndex % 2) * 9,
            groundY - 155 - puffIndex * 18,
            12 + puffIndex * 4,
            0x252a2e,
            0.18,
          )
          .setDepth(-14);
        smokePuffs.push(puff);
      }
      this.tweens.add({
        targets: smokePuffs,
        y: "-=70",
        x: "+=28",
        alpha: 0,
        scale: 1.7,
        duration: 4200,
        repeat: -1,
        stagger: 420,
        ease: "Sine.easeOut",
      });
    }
  }

  private drawObstacle(
    arena: ArenaDefinition,
    obstacle: ArenaObstacle,
  ): void {
    const graphics = this.add.graphics().setDepth(5);

    graphics.fillStyle(arena.palette.obstacleColor, 0.98);
    graphics.lineStyle(
      5,
      arena.palette.obstacleStrokeColor,
      0.78,
    );

    if (obstacle.kind === "rock") {
      const inset = Math.min(28, obstacle.width * 0.22);

      graphics.beginPath();
      graphics.moveTo(obstacle.x, obstacle.y + obstacle.height);
      graphics.lineTo(obstacle.x + inset, obstacle.y + 24);
      graphics.lineTo(
        obstacle.x + obstacle.width * 0.5,
        obstacle.y,
      );
      graphics.lineTo(
        obstacle.x + obstacle.width - inset,
        obstacle.y + 20,
      );
      graphics.lineTo(
        obstacle.x + obstacle.width,
        obstacle.y + obstacle.height,
      );
      graphics.closePath();
      graphics.fillPath();
      graphics.strokePath();
      graphics.lineStyle(7, 0x24292c, 0.88);
      graphics.lineBetween(
        obstacle.x + inset,
        obstacle.y + obstacle.height * 0.72,
        obstacle.x + obstacle.width - inset,
        obstacle.y + obstacle.height * 0.28,
      );
      graphics.lineStyle(3, 0xb5673d, 0.82);
      graphics.lineBetween(
        obstacle.x + inset,
        obstacle.y + obstacle.height * 0.72,
        obstacle.x + obstacle.width - inset,
        obstacle.y + obstacle.height * 0.28,
      );
      graphics.fillStyle(0xc0a781, 0.76);
      graphics.fillCircle(obstacle.x + obstacle.width * 0.3, obstacle.y + obstacle.height * 0.57, 5);
      graphics.fillCircle(obstacle.x + obstacle.width * 0.72, obstacle.y + obstacle.height * 0.36, 5);
      this.registerDestructibleView(
        obstacle.id,
        obstacle.x,
        obstacle.y,
        obstacle.width,
        obstacle.height,
        graphics,
        arena.palette.obstacleStrokeColor,
      );
      return;
    }

    graphics.fillStyle(0x34383a, 0.98);
    graphics.fillRoundedRect(
      obstacle.x,
      obstacle.y,
      obstacle.width,
      obstacle.height,
      10,
    );
    graphics.strokeRoundedRect(
      obstacle.x,
      obstacle.y,
      obstacle.width,
      obstacle.height,
      10,
    );
    graphics.fillStyle(0x596064, 0.72);
    graphics.fillRect(obstacle.x + 9, obstacle.y + 8, obstacle.width * 0.38, obstacle.height - 16);
    graphics.fillStyle(0x24282b, 0.9);
    graphics.fillRect(obstacle.x + obstacle.width * 0.55, obstacle.y + 5, obstacle.width * 0.34, obstacle.height - 10);
    graphics.lineStyle(5, 0xb8663a, 0.82);
    graphics.lineBetween(obstacle.x + 6, obstacle.y + obstacle.height - 10, obstacle.x + obstacle.width - 5, obstacle.y + 14);
    graphics.lineStyle(4, 0x171a1c, 0.95);
    graphics.strokeCircle(obstacle.x + obstacle.width * 0.7, obstacle.y + 34, 14);
    graphics.lineBetween(obstacle.x + obstacle.width * 0.7, obstacle.y + 34, obstacle.x + obstacle.width * 0.76, obstacle.y + 26);
    graphics.fillStyle(0xbca989, 0.85);
    for (let index = 0; index < 4; index += 1) {
      graphics.fillCircle(
        obstacle.x + 14 + (index % 2) * (obstacle.width - 28),
        obstacle.y + 16 + Math.floor(index / 2) * (obstacle.height - 32),
        4,
      );
    }
    this.registerDestructibleView(
      obstacle.id,
      obstacle.x,
      obstacle.y,
      obstacle.width,
      obstacle.height,
      graphics,
      arena.palette.obstacleStrokeColor,
    );
  }

  private drawProtection(protection: ProtectionState): void {
    const graphics = this.add.graphics().setDepth(7);
    const detailColor = drawProtectionBody(graphics, protection);

    this.registerDestructibleView(
      protection.id,
      protection.x,
      protection.y,
      protection.width,
      protection.height,
      graphics,
      detailColor,
    );
  }

  private registerDestructibleView(
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
    body: Phaser.GameObjects.Graphics,
    accentColor: number,
  ): void {
    const damageOverlay = this.add.graphics().setDepth(8);
    const cracks = this.add.graphics().setDepth(9);
    const durabilityBackground = this.add
      .rectangle(x, y - 14, width, 7, 0x111a28, 0.92)
      .setOrigin(0, 0.5)
      .setDepth(10);
    const durabilityFill = this.add
      .rectangle(x, y - 14, width, 5, 0x7ee2a8, 1)
      .setOrigin(0, 0.5)
      .setDepth(11);
    const rubble = this.add.graphics().setDepth(6).setVisible(false);

    rubble.fillStyle(accentColor, 0.72);
    rubble.fillTriangle(x, y + height, x + width * 0.22, y + height - 18, x + width * 0.4, y + height);
    rubble.fillTriangle(x + width * 0.35, y + height, x + width * 0.63, y + height - 12, x + width * 0.78, y + height);
    rubble.fillTriangle(x + width * 0.66, y + height, x + width * 0.86, y + height - 22, x + width, y + height);
    rubble.fillStyle(0x25292b, 0.96);
    rubble.fillRect(x + width * 0.16, y + height - 9, width * 0.22, 8);
    rubble.fillRect(x + width * 0.58, y + height - 14, width * 0.3, 11);
    rubble.fillStyle(0xc07a3f, 0.8);
    rubble.fillCircle(x + width * 0.3, y + height - 7, 4);
    rubble.fillCircle(x + width * 0.74, y + height - 10, 3);

    durabilityBackground.setVisible(false);
    durabilityFill.setVisible(false);
    this.destructibleViews.set(id, {
      body,
      damageOverlay,
      cracks,
      durabilityBackground,
      durabilityFill,
      rubble,
      x,
      y,
      width,
      height,
    });
  }

  private updateDestructibleView(
    id: string,
    durability: number,
    maxDurability: number,
  ): void {
    const view = this.destructibleViews.get(id);

    if (!view) {
      return;
    }

    const ratio = Phaser.Math.Clamp(durability / maxDurability, 0, 1);
    const destroyed = durability === 0;
    const damaged = ratio < 1 && !destroyed;

    view.body.setVisible(!destroyed).setAlpha(0.58 + ratio * 0.42);
    view.damageOverlay.clear().setVisible(damaged);
    view.rubble.setVisible(destroyed);
    view.durabilityBackground.setVisible(damaged);
    view.durabilityFill
      .setVisible(damaged)
      .setDisplaySize(view.width * ratio, 5)
      .setFillStyle(ratio > 0.4 ? 0xffd166 : 0xff7043, 1);
    view.cracks.clear().setVisible(damaged);

    if (!damaged) {
      return;
    }

    const damageStage = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
    view.damageOverlay.fillStyle(0x101315, 0.28 + damageStage * 0.14);
    view.damageOverlay.fillTriangle(
      view.x + view.width * 0.08,
      view.y + view.height * (0.22 + damageStage * 0.08),
      view.x + view.width * (0.22 + damageStage * 0.06),
      view.y + view.height * 0.48,
      view.x + view.width * 0.12,
      view.y + view.height * 0.7,
    );
    if (damageStage >= 2) {
      view.damageOverlay.fillStyle(0xb85b2f, 0.5);
      view.damageOverlay.fillRect(
        view.x + view.width * 0.54,
        view.y + view.height * 0.18,
        view.width * 0.1,
        view.height * 0.54,
      );
    }
    if (damageStage === 3) {
      view.damageOverlay.fillStyle(0x090b0c, 0.82);
      view.damageOverlay.fillTriangle(
        view.x + view.width * 0.58,
        view.y + view.height * 0.58,
        view.x + view.width * 0.94,
        view.y + view.height * 0.44,
        view.x + view.width * 0.84,
        view.y + view.height * 0.9,
      );
    }

    const crackCount = damageStage * 2;
    view.cracks.lineStyle(4, 0x111a28, 0.82);
    for (let index = 0; index < crackCount; index += 1) {
      const crackX = view.x + view.width * (0.28 + index * 0.22);
      const crackY = view.y + view.height * (0.2 + (index % 2) * 0.18);
      view.cracks.beginPath();
      view.cracks.moveTo(crackX, crackY);
      view.cracks.lineTo(crackX - 8, crackY + 18);
      view.cracks.lineTo(crackX + 5, crackY + 31);
      view.cracks.lineTo(crackX - 4, crackY + 47);
      view.cracks.strokePath();
    }
  }

  private drawHeader(): void {
    this.add
      .text(64, 48, STRINGS_RU.gameTitle, {
        color: COLORS.primaryText,
        fontFamily: "Arial, sans-serif",
        fontSize: "34px",
        fontStyle: "bold",
        letterSpacing: 3,
      })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(901);

    this.add
      .text(66, 94, STRINGS_RU.battleSubtitle, {
        color: COLORS.secondaryText,
        fontFamily: "Arial, sans-serif",
        fontSize: "17px",
        letterSpacing: 2,
      })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(901);

    const badge = this.add.graphics().setScrollFactor(0).setDepth(901);
    badge.fillStyle(0x7ee2a8, 0.12);
    badge.fillRoundedRect(1250, 42, 286, 82, 18);
    badge.lineStyle(2, 0x7ee2a8, 0.35);
    badge.strokeRoundedRect(1250, 42, 286, 82, 18);

    this.weatherText = this.add
      .text(1393, 67, "", {
        color: COLORS.ready,
        fontFamily: "Arial, sans-serif",
        fontSize: "16px",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(902);

    this.windText = this.add
      .text(1393, 98, "", {
        color: COLORS.primaryText,
        fontFamily: "Arial, sans-serif",
        fontSize: "14px",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(902);
  }

  private createStatus(): void {
    const panel = this.add.graphics().setScrollFactor(0).setDepth(900);

    panel.fillStyle(COLORS.panel, 0.94);
    panel.fillRoundedRect(475, 124, 650, 54, 18);
    panel.lineStyle(2, COLORS.panelStroke, 0.4);
    panel.strokeRoundedRect(475, 124, 650, 54, 18);

    this.statusText = this.add
      .text(800, 151, this.getAimingStatus(), {
        color: COLORS.primaryText,
        fontFamily: "Arial, sans-serif",
        fontSize: "18px",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(901);
  }

  private createWorldRail(): void {
    const railX = 1226;
    const railY = 142;
    const railWidth = 250;
    const rail = this.add.graphics().setScrollFactor(0).setDepth(905);

    rail.fillStyle(0x0b1320, 0.9);
    rail.fillRoundedRect(railX, railY, railWidth, 18, 9);
    rail.lineStyle(2, 0x8ba4c8, 0.55);
    rail.strokeRoundedRect(railX, railY, railWidth, 18, 9);
    rail.fillStyle(0x9ec5ff, 1);
    rail.fillCircle(railX + 9, railY + 9, 6);
    rail.fillStyle(0xffb29b, 1);
    rail.fillCircle(railX + railWidth - 9, railY + 9, 6);

    this.worldPositionMarker = this.add
      .circle(railX + 9, railY + 9, 8, 0xffd166, 1)
      .setStrokeStyle(3, 0xfff0bd, 0.95)
      .setScrollFactor(0)
      .setDepth(906);
    this.updateWorldMarker(
      this.battleController.getState().players.left.catapultX,
    );
  }

  private updateWorldMarker(worldX: number): void {
    const railStartX = 1235;
    const railWidth = 232;
    const progress = Phaser.Math.Clamp(
      worldX / GAME_CONFIG.world.width,
      0,
      1,
    );

    this.worldPositionMarker.setX(railStartX + railWidth * progress);
  }

  private centerCameraOnActivePlayer(): void {
    const state = this.battleController.getState();
    const activePlayer = state.players[state.activePlayerId];

    this.cameras.main.centerOn(activePlayer.catapultX, GAME_HEIGHT / 2);
    this.updateWorldMarker(activePlayer.catapultX);
  }

  private createCatapultViews(): void {
    const battleState = this.battleController.getState();

    this.catapultViews = {
      left: new CatapultView(
        this,
        battleState.players.left,
        battleState.activePlayerId === "left",
      ),
      right: new CatapultView(
        this,
        battleState.players.right,
        battleState.activePlayerId === "right",
      ),
    };
  }

  private renderBattleState(): void {
    const battleState = this.battleController.getState();

    this.catapultViews.left.update(
      battleState.players.left,
      battleState.activePlayerId === "left",
    );
    this.catapultViews.right.update(
      battleState.players.right,
      battleState.activePlayerId === "right",
    );
    const activePlayer = battleState.players[battleState.activePlayerId];

    this.aimingControls.setProjectileState(
      activePlayer.selectedProjectileType,
      activePlayer.ammunition,
    );
    this.aimingControls.setPowerMaximum(
      getPlayerMaximumPower(activePlayer),
    );
    this.weatherText.setText(
      STRINGS_RU.weatherName(battleState.weather.id),
    );
    this.windText.setText(
      STRINGS_RU.windLabel(battleState.weather.wind),
    );
    battleState.protections.forEach((protection) => {
      this.updateDestructibleView(
        protection.id,
        protection.durability,
        protection.maxDurability,
      );
    });
    Object.values(battleState.obstacles).forEach((obstacle) => {
      this.updateDestructibleView(
        obstacle.id,
        obstacle.durability,
        obstacle.maxDurability,
      );
    });
  }

  private redrawPreview(values: AimingValues): void {
    const battleState = this.battleController.getState();

    if (battleState.phase !== "aiming") {
      return;
    }

    const result = simulateShot(
      this.createFireCommand(values),
      battleState,
    );
    this.catapultViews[battleState.activePlayerId].setAim(
      values.angleDeg,
      values.power,
    );
    const pointCount = Math.max(
      2,
      Math.ceil(
        result.points.length *
          getWeatherDefinition(battleState.weather.id).previewRatio,
      ),
    );
    const startPoint = result.points[0];
    const previewPoints = result.points
      .slice(0, pointCount)
      .filter(
        (point) =>
          !startPoint ||
          Math.abs(point.x - startPoint.x) <=
            GAME_CONFIG.aiming.previewMaxDistance,
      );

    this.cachedPreviewPoints = previewPoints;
    this.drawCachedPreview();
  }

  private drawCachedPreview(): void {
    this.previewGraphics.clear();

    if (this.cachedPreviewPoints.length < 2) {
      return;
    }

    const segments = this.cachedPreviewPoints.slice(1).map((point, index) => {
      const previous = this.cachedPreviewPoints[index];
      const length = previous
        ? Phaser.Math.Distance.Between(previous.x, previous.y, point.x, point.y)
        : 0;

      return { from: previous ?? point, to: point, length, start: 0, end: 0 };
    });
    let totalLength = 0;
    segments.forEach((segment) => {
      segment.start = totalLength;
      totalLength += segment.length;
      segment.end = totalLength;
    });

    if (totalLength <= 0) {
      return;
    }

    const pointAtDistance = (distance: number): { x: number; y: number } => {
      const clampedDistance = Phaser.Math.Clamp(distance, 0, totalLength);
      const segment =
        segments.find((candidate) => clampedDistance <= candidate.end) ??
        segments.at(-1);

      if (!segment || segment.length === 0) {
        return this.cachedPreviewPoints[0] ?? { x: 0, y: 0 };
      }

      const ratio = (clampedDistance - segment.start) / segment.length;

      return {
        x: Phaser.Math.Linear(segment.from.x, segment.to.x, ratio),
        y: Phaser.Math.Linear(segment.from.y, segment.to.y, ratio),
      };
    };

    const dashLength = 23;
    const dashPeriod = 40;
    for (
      let dashStart = -this.previewDashOffset;
      dashStart < totalLength;
      dashStart += dashPeriod
    ) {
      const visibleStart = Math.max(0, dashStart);
      const visibleEnd = Math.min(totalLength, dashStart + dashLength);

      if (visibleEnd <= visibleStart) {
        continue;
      }

      const wave =
        (Math.sin(
          (visibleStart / totalLength) * Math.PI * 4 -
            this.previewShimmerPhase,
        ) +
          1) /
        2;
      this.previewGraphics.lineStyle(
        4,
        wave > 0.62 ? 0xcff9e8 : 0x70c9ad,
        0.48 + wave * 0.42,
      );
      this.previewGraphics.beginPath();
      const startPoint = pointAtDistance(visibleStart);
      this.previewGraphics.moveTo(startPoint.x, startPoint.y);

      segments.forEach((segment) => {
        if (segment.end > visibleStart && segment.end < visibleEnd) {
          this.previewGraphics.lineTo(segment.to.x, segment.to.y);
        }
      });

      const endPoint = pointAtDistance(visibleEnd);
      this.previewGraphics.lineTo(endPoint.x, endPoint.y);
      this.previewGraphics.strokePath();
    }
  }

  private createFireCommand(values: AimingValues): FireCommand {
    const battleState = this.battleController.getState();

    return {
      playerId: battleState.activePlayerId,
      angleDeg: values.angleDeg,
      power: values.power,
      projectileType: values.projectileType,
    };
  }

  private selectProjectile(projectileType: ProjectileType): boolean {
    const battleState = this.battleController.getState();
    const result = this.battleController.selectProjectile(
      battleState.activePlayerId,
      projectileType,
    );

    if (!result.ok) {
      this.statusText.setText(STRINGS_RU.fireUnavailableStatus);
      return false;
    }

    const activePlayer =
      this.battleController.getState().players[battleState.activePlayerId];

    this.aimingControls.setProjectileState(
      activePlayer.selectedProjectileType,
      activePlayer.ammunition,
    );
    return true;
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.repeat) {
      return;
    }

    if (event.code.startsWith("Digit")) {
      const index = Number(event.code.slice(5)) - 1;
      const projectileType = PROJECTILE_TYPES[index];

      if (projectileType) {
        event.preventDefault();
        if (this.selectProjectile(projectileType)) {
          this.redrawPreview(this.aimingControls.getValues());
        }
      }
      return;
    }

    if (event.code !== "Space") {
      return;
    }

    event.preventDefault();
    this.fire(this.aimingControls.getValues());
  }

  private fire(values: AimingValues): void {
    const result = this.battleController.fire(
      this.createFireCommand(values),
    );

    if (!result.ok) {
      if (result.reason === "power-restricted") {
        this.statusText.setText(
          STRINGS_RU.frozenPowerUnavailableStatus,
        );
      } else if (result.reason !== "wrong-phase") {
        this.statusText.setText(STRINGS_RU.fireUnavailableStatus);
      }
      return;
    }

    this.aimingControls.setEnabled(false);
    this.previewGraphics.clear();
    this.statusText.setText(STRINGS_RU.projectileFlightStatus);
    const activePlayerId =
      this.battleController.getState().activePlayerId;

    this.catapultViews[activePlayerId].playFire(() => {
      this.playLaunchSound();
      this.animateShot(result.shot);
    });
  }

  private animateShot(shot: ShotResult): void {
    const firstPoint = shot.points[0];
    const lastPoint = shot.points.at(-1);

    if (!firstPoint || !lastPoint) {
      this.finishShot(shot);
      return;
    }

    const projectile = this.createProjectileView(
      firstPoint.x,
      firstPoint.y,
      shot.projectileType,
    );
    const animationClock = { timeMs: 0 };
    let pointIndex = 0;
    let nextTrailPointIndex = 2;

    this.fogOfWar.setAlpha(0.82);
    this.cameras.main.startFollow(projectile, true, 0.12, 0.12);
    this.tweens.add({
      targets: animationClock,
      timeMs: lastPoint.timeMs,
      duration: Math.max(
        1,
        lastPoint.timeMs *
          GAME_CONFIG.projectiles[shot.projectileType].playbackScale,
      ),
      ease: "Linear",
      onUpdate: () => {
        while (
          pointIndex < shot.points.length - 2 &&
          shot.points[pointIndex + 1] &&
          (shot.points[pointIndex + 1]?.timeMs ?? 0) <=
            animationClock.timeMs
        ) {
          pointIndex += 1;
        }

        const from = shot.points[pointIndex];
        const to = shot.points[pointIndex + 1] ?? from;

        if (!from || !to) {
          return;
        }

        const segmentDuration = Math.max(1, to.timeMs - from.timeMs);
        const progress = Phaser.Math.Clamp(
          (animationClock.timeMs - from.timeMs) / segmentDuration,
          0,
          1,
        );

        projectile.setPosition(
          Phaser.Math.Linear(from.x, to.x, progress),
          Phaser.Math.Linear(from.y, to.y, progress),
        );
        this.updateWorldMarker(projectile.x);
        projectile.setRotation(animationClock.timeMs * 0.012);

        if (pointIndex >= nextTrailPointIndex) {
          this.spawnProjectileTrail(
            projectile.x,
            projectile.y,
            shot.projectileType,
          );
          nextTrailPointIndex = pointIndex + 3;
        }
      },
      onComplete: () => {
        projectile.setPosition(lastPoint.x, lastPoint.y);
        projectile.destroy();
        this.finishShot(shot);
      },
    });
  }

  private finishShot(shot: ShotResult): void {
    this.cameras.main.stopFollow();
    this.fogOfWar.setAlpha(0.42);
    const transition = this.battleController.resolveShot(shot);
    const resolvedState = transition.state;
    this.renderBattleState();
    this.showBattleEvents(transition.events);

    const impactPoint = shot.points.at(-1);
    const explodes = ["impact", "ground", "obstacle"].includes(
      shot.endReason,
    );

    if (impactPoint && explodes) {
      this.showImpactEffect(
        impactPoint.x,
        impactPoint.y,
        shot.projectileType,
      );
    }

    const totalDamage = transition.events
      .filter((event) => event.kind === "damage")
      .reduce((sum, event) => sum + event.amount, 0);
    const durabilityEvents = transition.events.filter(
      (event) => event.kind === "durability",
    );
    const durabilityDamage = durabilityEvents.reduce(
      (sum, event) => sum + event.amount,
      0,
    );
    const destructibleDestroyed = durabilityEvents.some(
      (event) => event.destroyed,
    );

    if (shot.impact) {
      this.statusText.setText(
        this.getProjectileImpactStatus(
          shot.projectileType,
          totalDamage,
        ),
      );
    } else if (shot.projectileType === "bomb" && totalDamage > 0) {
      this.statusText.setText(
        STRINGS_RU.bombImpactStatus(totalDamage),
      );
    } else if (durabilityDamage > 0) {
      this.statusText.setText(
        STRINGS_RU.destructibleImpactStatus(
          durabilityDamage,
          destructibleDestroyed,
        ),
      );
    } else if (shot.endReason === "ground") {
      this.statusText.setText(STRINGS_RU.groundStatus);
    } else if (shot.endReason === "obstacle") {
      this.statusText.setText(STRINGS_RU.obstacleStatus);
    } else {
      this.statusText.setText(STRINGS_RU.missStatus);
    }

    if (resolvedState.phase === "finished" && resolvedState.winnerId) {
      this.time.delayedCall(GAME_CONFIG.battle.resultDisplayMs, () => {
        this.scene.start("ResultScene", {
          winnerId: resolvedState.winnerId,
          turnNumber: resolvedState.turnNumber,
          arenaId: this.arenaId,
          placement: this.matchPlacement,
        });
      });
      return;
    }

    this.time.delayedCall(
      GAME_CONFIG.battle.resultDisplayMs,
      this.startNextTurn,
      [],
      this,
    );
  }

  private startNextTurn(): void {
    const transition = this.battleController.startNextTurn();
    const battleState = transition.state;
    this.renderBattleState();
    this.updateFogOfWar();
    this.showBattleEvents(transition.events);

    const burnDamage = transition.events.reduce(
      (sum, event) =>
        event.kind === "damage" && event.source === "burning"
          ? sum + event.amount
          : sum,
      0,
    );

    if (battleState.phase === "finished" && battleState.winnerId) {
      if (burnDamage > 0) {
        this.statusText.setText(
          STRINGS_RU.burnDamageStatus(burnDamage),
        );
      }
      this.time.delayedCall(GAME_CONFIG.battle.resultDisplayMs, () => {
        this.scene.start("ResultScene", {
          winnerId: battleState.winnerId,
          turnNumber: battleState.turnNumber,
          arenaId: this.arenaId,
          placement: this.matchPlacement,
        });
      });
      return;
    }

    const activePlayer = battleState.players[battleState.activePlayerId];

    this.cameras.main.pan(
      activePlayer.catapultX,
      GAME_HEIGHT / 2,
      GAME_CONFIG.battle.cameraPanMs,
      "Sine.easeInOut",
    );
    this.updateWorldMarker(activePlayer.catapultX);
    this.statusText.setText(
      burnDamage > 0
        ? STRINGS_RU.burnDamageStatus(burnDamage)
        : this.getAimingStatus(),
    );
    this.aimingControls.setEnabled(true);
    this.redrawPreview(this.aimingControls.getValues());

    if (burnDamage > 0) {
      this.time.delayedCall(700, () => {
        if (this.battleController.getState().phase === "aiming") {
          this.statusText.setText(this.getAimingStatus());
        }
      });
    }
  }

  private getAimingStatus(): string {
    const battleState = this.battleController.getState();
    const playerNumber = battleState.activePlayerId === "left" ? 1 : 2;

    return STRINGS_RU.aimingStatus(
      battleState.turnNumber,
      playerNumber,
    );
  }

  private showDamage(targetId: PlayerId, damage: number): void {
    const position =
      this.catapultViews[targetId].getDamageLabelPosition();
    const label = this.add
      .text(position.x, position.y, STRINGS_RU.damageTaken(damage), {
        color: "#ff8a65",
        fontFamily: "Arial, sans-serif",
        fontSize: "36px",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(1100);

    this.tweens.add({
      targets: label,
      y: position.y - 65,
      alpha: 0,
      duration: 900,
      ease: "Cubic.easeOut",
      onComplete: () => {
        label.destroy();
      },
    });
  }

  private showImpactEffect(
    x: number,
    y: number,
    projectileType: ProjectileType,
  ): void {
    const palette = {
      stone: { primary: 0xffd166, secondary: 0x7ee2a8 },
      fire: { primary: 0xff7043, secondary: 0xffc857 },
      ice: { primary: 0x8fe8ff, secondary: 0xdaf9ff },
      diamond: { primary: 0xb8f4ff, secondary: 0xffffff },
      bomb: { primary: 0xff8b3d, secondary: 0x6f7891 },
    }[projectileType];
    const isBomb = projectileType === "bomb";
    this.playImpactSound(projectileType);
    const flash = this.add
      .circle(x, y, isBomb ? 48 : 34, palette.primary, 0.9)
      .setStrokeStyle(7, palette.secondary, 0.9)
      .setScale(0.45)
      .setDepth(69);
    const ring = this.add
      .circle(x, y, isBomb ? 54 : 44, palette.primary, 0)
      .setStrokeStyle(7, palette.secondary, 0.95)
      .setScale(0.55)
      .setDepth(71);
    const burst = this.add
      .image(x, y, "impact-burst")
      .setTint(palette.primary)
      .setDisplaySize(110, 110)
      .setAlpha(0.95)
      .setDepth(70);
    const debris: Phaser.GameObjects.Rectangle[] = [];

    for (let index = 0; index < (isBomb ? 18 : 11); index += 1) {
      const angle =
        (Math.PI * 2 * index) / (isBomb ? 18 : 11) - Math.PI / 2;
      const distance = (isBomb ? 105 : 62) + (index % 4) * 14;
      const fragment = this.add
        .rectangle(
          x,
          y,
          5 + (index % 3) * 3,
          3 + (index % 2) * 4,
          index % 2 === 0 ? palette.primary : palette.secondary,
          0.9,
        )
        .setRotation(angle)
        .setDepth(72);

      debris.push(fragment);
      this.tweens.add({
        targets: fragment,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance + 38,
        angle: Phaser.Math.RadToDeg(angle) + 150 + index * 24,
        alpha: 0,
        scale: 0.35,
        duration: 520 + (index % 5) * 70,
        ease: "Cubic.easeOut",
        onComplete: () => fragment.destroy(),
      });
    }

    const shockLines = this.add.graphics().setDepth(68);
    shockLines.lineStyle(isBomb ? 8 : 5, palette.primary, 0.5);
    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * 2 * index) / 8;
      shockLines.lineBetween(
        x + Math.cos(angle) * 28,
        y + Math.sin(angle) * 28,
        x + Math.cos(angle) * (isBomb ? 96 : 64),
        y + Math.sin(angle) * (isBomb ? 96 : 64),
      );
    }

    this.drawProjectileImpactSignature(x, y, projectileType);

    this.cameras.main.shake(isBomb ? 260 : 150, isBomb ? 0.012 : 0.006);
    this.tweens.add({
      targets: burst,
      displayWidth: 180,
      displayHeight: 180,
      alpha: 0,
      angle: 18,
      duration: 420,
      ease: "Cubic.easeOut",
      onComplete: () => {
        burst.destroy();
      },
    });
    this.tweens.add({
      targets: shockLines,
      scale: 1.45,
      alpha: 0,
      duration: 360,
      ease: "Cubic.easeOut",
      onComplete: () => shockLines.destroy(),
    });
    this.tweens.add({
      targets: flash,
      scale: 2.4,
      alpha: 0,
      duration: 320,
      ease: "Cubic.easeOut",
      onComplete: () => {
        flash.destroy();
      },
    });
    this.tweens.add({
      targets: ring,
      scale: isBomb
        ? GAME_CONFIG.projectileEffects.bomb.explosionRadius / 54
        : 2.2,
      alpha: 0,
      duration: 480,
      ease: "Cubic.easeOut",
      onComplete: () => {
        ring.destroy();
      },
    });
  }

  private spawnProjectileTrail(
    x: number,
    y: number,
    projectileType: ProjectileType,
  ): void {
    const tint = GAME_CONFIG.projectiles[projectileType].tint;
    const trail = this.add.graphics({ x, y }).setDepth(45);

    if (projectileType === "stone") {
      trail.fillStyle(0x8a6a4f, 0.5);
      trail.fillTriangle(-6, 2, 0, -3, 5, 4);
    } else if (projectileType === "fire") {
      trail.fillStyle(0xff5a2f, 0.78);
      trail.fillCircle(0, 0, 7);
      trail.fillStyle(0xffc857, 0.88);
      trail.fillTriangle(-13, 0, -3, -5, -3, 5);
    } else if (projectileType === "ice") {
      trail.fillStyle(tint, 0.78);
      trail.fillTriangle(-7, 0, 0, -5, 4, 1);
      trail.fillTriangle(-2, 2, 3, -2, 7, 5);
    } else if (projectileType === "diamond") {
      trail.lineStyle(3, tint, 0.86);
      trail.lineBetween(-15, 0, 6, 0);
      trail.lineStyle(1, 0xffffff, 0.9);
      trail.lineBetween(-5, -7, -5, 7);
    } else {
      trail.fillStyle(0x25282b, 0.72);
      trail.fillCircle(0, 0, 10);
      trail.fillStyle(0xff8b3d, 0.5);
      trail.fillCircle(-3, 1, 3);
    }

    this.tweens.add({
      targets: trail,
      scale: projectileType === "fire" ? 1.8 : 0.35,
      alpha: 0,
      duration: projectileType === "bomb" ? 650 : 360,
      ease: "Cubic.easeOut",
      onComplete: () => {
        trail.destroy();
      },
    });
  }

  private createProjectileView(
    x: number,
    y: number,
    projectileType: ProjectileType,
  ): Phaser.GameObjects.Container {
    const radius = GAME_CONFIG.projectiles[projectileType].radius * 1.5;
    const graphics = new Phaser.GameObjects.Graphics(this);
    const outline = 0x111416;

    if (projectileType === "stone") {
      graphics.fillStyle(0x806a55, 1);
      graphics.lineStyle(3, outline, 1);
      graphics.fillCircle(0, 0, radius);
      graphics.strokeCircle(0, 0, radius);
      graphics.fillStyle(0xb89a75, 0.55);
      graphics.fillTriangle(-radius * 0.55, -2, 0, -radius * 0.65, radius * 0.35, 1);
    } else if (projectileType === "fire") {
      graphics.fillStyle(0x5a2f24, 1);
      graphics.lineStyle(3, outline, 1);
      graphics.fillRoundedRect(-radius, -radius * 0.62, radius * 1.85, radius * 1.24, 4);
      graphics.strokeRoundedRect(-radius, -radius * 0.62, radius * 1.85, radius * 1.24, 4);
      graphics.fillStyle(0xe55f35, 0.95);
      graphics.fillRect(-radius * 0.3, -radius * 0.57, radius * 0.46, radius * 1.14);
      graphics.fillStyle(0xffbf48, 0.9);
      graphics.fillTriangle(-radius * 1.45, 0, -radius, -radius * 0.48, -radius, radius * 0.48);
    } else if (projectileType === "ice") {
      graphics.fillStyle(0x6eb8c7, 1);
      graphics.lineStyle(3, outline, 1);
      graphics.beginPath();
      graphics.moveTo(radius * 1.2, 0);
      graphics.lineTo(0, -radius * 0.72);
      graphics.lineTo(-radius, -radius * 0.42);
      graphics.lineTo(-radius, radius * 0.42);
      graphics.lineTo(0, radius * 0.72);
      graphics.closePath();
      graphics.fillPath();
      graphics.strokePath();
      graphics.lineStyle(2, 0xd8fbff, 0.9);
      graphics.lineBetween(-radius * 0.55, 0, radius * 0.62, 0);
    } else if (projectileType === "diamond") {
      graphics.fillStyle(0x9bd9df, 1);
      graphics.lineStyle(3, outline, 1);
      graphics.fillTriangle(radius * 1.45, 0, -radius * 0.4, -radius * 0.58, -radius * 0.4, radius * 0.58);
      graphics.strokeTriangle(radius * 1.45, 0, -radius * 0.4, -radius * 0.58, -radius * 0.4, radius * 0.58);
      graphics.fillStyle(0x333a40, 1);
      graphics.fillRect(-radius, -radius * 0.34, radius * 0.72, radius * 0.68);
      graphics.lineStyle(2, 0xffffff, 0.85);
      graphics.lineBetween(-radius * 0.05, -radius * 0.3, radius, 0);
    } else {
      graphics.fillStyle(0x34373a, 1);
      graphics.lineStyle(3, outline, 1);
      graphics.fillCircle(0, 0, radius);
      graphics.strokeCircle(0, 0, radius);
      for (let index = 0; index < 8; index += 1) {
        const angle = (Math.PI * 2 * index) / 8;
        graphics.fillStyle(index % 2 === 0 ? 0xb55d32 : 0x555c61, 1);
        graphics.fillTriangle(
          Math.cos(angle - 0.16) * radius * 0.78,
          Math.sin(angle - 0.16) * radius * 0.78,
          Math.cos(angle) * radius * 1.38,
          Math.sin(angle) * radius * 1.38,
          Math.cos(angle + 0.16) * radius * 0.78,
          Math.sin(angle + 0.16) * radius * 0.78,
        );
      }
      graphics.fillStyle(0xe08a3d, 0.95);
      graphics.fillCircle(0, 0, radius * 0.3);
    }

    return this.add.container(x, y, [graphics]).setDepth(50);
  }

  private drawProjectileImpactSignature(
    x: number,
    y: number,
    projectileType: ProjectileType,
  ): void {
    const signature = this.add.graphics({ x, y }).setDepth(73);

    if (projectileType === "fire") {
      signature.fillStyle(0xff5b32, 0.76);
      for (let index = 0; index < 5; index += 1) {
        const offset = (index - 2) * 14;
        signature.fillTriangle(offset - 9, 16, offset, -34 - (index % 2) * 18, offset + 10, 16);
      }
    } else if (projectileType === "ice") {
      signature.lineStyle(5, 0xbff6ff, 0.88);
      for (let index = 0; index < 8; index += 1) {
        const angle = (Math.PI * 2 * index) / 8;
        signature.lineBetween(0, 0, Math.cos(angle) * 72, Math.sin(angle) * 72);
      }
    } else if (projectileType === "diamond") {
      signature.lineStyle(4, 0xffffff, 0.9);
      signature.lineBetween(-96, 0, 96, 0);
      signature.lineBetween(0, -62, 0, 62);
    } else if (projectileType === "bomb") {
      signature.fillStyle(0x202326, 0.66);
      signature.fillCircle(-28, -16, 34);
      signature.fillCircle(18, -28, 46);
      signature.fillCircle(44, -5, 30);
    } else {
      signature.fillStyle(0x8f7255, 0.62);
      signature.fillTriangle(-48, 20, -16, -35, 4, 18);
      signature.fillTriangle(12, 22, 32, -24, 52, 17);
    }

    this.tweens.add({
      targets: signature,
      scale: projectileType === "bomb" ? 2.1 : 1.45,
      alpha: 0,
      duration: projectileType === "bomb" ? 720 : 460,
      ease: "Cubic.easeOut",
      onComplete: () => signature.destroy(),
    });
  }

  private updateFogOfWar(): void {
    if (!this.fogOfWar) {
      return;
    }

    const activePlayerId = this.battleController.getState().activePlayerId;
    const bandWidth = 720;
    const startX = activePlayerId === "left" ? 1500 : 5700;

    this.fogOfWar.clear().setAlpha(1);
    for (let index = 0; index < 8; index += 1) {
      const alpha = 0.1 + index * 0.055;
      const x =
        activePlayerId === "left"
          ? startX + index * bandWidth
          : startX - (index + 1) * bandWidth;
      this.fogOfWar.fillStyle(0x0b0e10, alpha);
      this.fogOfWar.fillRect(x, 150, bandWidth + 4, GAME_HEIGHT - 150);
    }

    const edgeX = activePlayerId === "left" ? startX : startX - 30;
    for (let index = 0; index < 14; index += 1) {
      this.fogOfWar.fillStyle(0x667076, 0.045 + (index % 3) * 0.018);
      this.fogOfWar.fillCircle(
        edgeX + (activePlayerId === "left" ? 1 : -1) * ((index * 131) % 840),
        260 + ((index * 97) % 470),
        70 + (index % 4) * 28,
      );
    }
  }

  private playLaunchSound(): void {
    this.playTone(118, 0.22, "square", 0.06, 46);
    this.playTone(420, 0.11, "sawtooth", 0.035, 95);
    this.time.delayedCall(70, () => {
      this.playTone(760, 0.075, "square", 0.018, 280);
    });
  }

  private playImpactSound(projectileType: ProjectileType): void {
    const sound = {
      stone: { frequency: 145, end: 58, duration: 0.18 },
      fire: { frequency: 330, end: 72, duration: 0.28 },
      ice: { frequency: 940, end: 240, duration: 0.22 },
      diamond: { frequency: 1220, end: 510, duration: 0.16 },
      bomb: { frequency: 92, end: 28, duration: 0.48 },
    }[projectileType];
    this.playTone(
      sound.frequency,
      sound.duration,
      projectileType === "ice" || projectileType === "diamond"
        ? "triangle"
        : "sawtooth",
      projectileType === "bomb" ? 0.09 : 0.055,
      sound.end,
    );
  }

  private playTone(
    frequency: number,
    durationSeconds: number,
    type: OscillatorType,
    volume: number,
    endFrequency: number,
  ): void {
    if (typeof window === "undefined" || !window.AudioContext) {
      return;
    }

    try {
      this.audioContext ??= new window.AudioContext();
      const context = this.audioContext;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;

      void context.resume();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now);
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(20, endFrequency),
        now + durationSeconds,
      );
      gain.gain.setValueAtTime(Math.max(0.0001, volume), now);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + durationSeconds,
      );
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + durationSeconds);
    } catch {
      // Sound is enhancement-only; blocked WebAudio must never block a turn.
    }
  }

  private showBattleEvents(events: readonly BattleEvent[]): void {
    const damageByPlayer: Record<PlayerId, number> = {
      left: 0,
      right: 0,
    };

    events.forEach((event) => {
      if (event.kind === "damage") {
        damageByPlayer[event.targetId] += event.amount;
      } else if (event.kind === "durability") {
        this.showDurabilityDamage(event.x, event.y, event.amount);
      }
    });

    (["left", "right"] as const).forEach((playerId) => {
      const damage = damageByPlayer[playerId];

      if (damage > 0) {
        this.catapultViews[playerId].playImpact();
        this.showDamage(playerId, damage);
      }
    });
  }

  private showDurabilityDamage(
    x: number,
    y: number,
    damage: number,
  ): void {
    const label = this.add
      .text(x, y - 20, STRINGS_RU.durabilityDamageTaken(damage), {
        color: "#ffd166",
        fontFamily: "Arial, sans-serif",
        fontSize: "27px",
        fontStyle: "bold",
        stroke: "#111a28",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(1100);

    this.tweens.add({
      targets: label,
      y: y - 75,
      alpha: 0,
      duration: 950,
      ease: "Cubic.easeOut",
      onComplete: () => label.destroy(),
    });
  }

  private getProjectileImpactStatus(
    projectileType: ProjectileType,
    damage: number,
  ): string {
    switch (projectileType) {
      case "fire": {
        const battleState = this.battleController.getState();
        const targetId =
          battleState.activePlayerId === "left" ? "right" : "left";

        return STRINGS_RU.fireImpactStatus(
          damage,
          battleState.players[targetId].effects.burningTurnsRemaining,
        );
      }
      case "ice":
        return STRINGS_RU.iceImpactStatus(damage);
      case "diamond":
        return STRINGS_RU.diamondImpactStatus(damage);
      case "bomb":
        return STRINGS_RU.bombImpactStatus(damage);
      default:
        return STRINGS_RU.impactStatus(damage);
    }
  }
}
