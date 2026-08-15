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
import {
  MATCH_SETTINGS_REGISTRY_KEY,
  readMatchSettings,
  type MatchSettings,
} from "../core/matchSession";
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
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  IS_MOBILE_RENDER_TARGET,
} from "../gameDimensions";
import { STRINGS_RU } from "../i18n/strings.ru";
import {
  center2KCameraOn,
  configure2KCamera,
  follow2KCameraOnStep,
  getLogicalViewport,
  pan2KCameraOn,
  set2KCameraBounds,
  sharpenSceneText,
} from "../rendering";
import {
  AimingControls,
  type AimingValues,
} from "../ui/AimingControls";
import { RETRO_UI } from "../ui/retroTheme";
import { musicController } from "../audio/MusicController";
import { CatapultView } from "../views/CatapultView";
import {
  KNIGHT_MARCH_DURATION_MS,
  KnightSquadView,
} from "../views/KnightSquadView";
import { createCastleAmbientEffects } from "../views/CastleAmbientEffects";
import {
  createCastleTowerSprite,
  PROTECTION_VIEW_COLORS,
} from "../views/drawProtection";
import { PROJECTILE_TEXTURE_KEYS } from "../views/projectileVisuals";
import { drawArenaTerrain } from "../views/drawArenaTerrain";

const COLORS = {
  panel: RETRO_UI.colors.panel,
  panelRaised: RETRO_UI.colors.panelRaised,
  panelStroke: RETRO_UI.colors.border,
  primaryText: RETRO_UI.text.primary,
  secondaryText: RETRO_UI.text.secondary,
  accent: RETRO_UI.text.orange,
  ready: RETRO_UI.text.cyan,
} as const;

const DISPLAY_FONT = RETRO_UI.font.display;
const UI_FONT = RETRO_UI.font.ui;
const BATTLE_HEADER_HEIGHT = 0;

interface BattleSceneData {
  arenaId?: ArenaId;
  matchSeed?: number;
  placement?: MatchPlacement;
}

interface DestructibleView {
  body: Phaser.GameObjects.Graphics | Phaser.GameObjects.Image;
  damageOverlay: Phaser.GameObjects.Graphics;
  cracks: Phaser.GameObjects.Graphics;
  impactMarks: Phaser.GameObjects.Graphics;
  impactMarkCount: number;
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
  private knightSquadViews!: Record<PlayerId, KnightSquadView>;
  private aimingControls!: AimingControls;
  private previewGraphics!: Phaser.GameObjects.Graphics;
  private gestureGuide!: Phaser.GameObjects.Graphics;
  private fogOfWar!: Phaser.GameObjects.Graphics;
  private statusText!: Phaser.GameObjects.Text;
  private weatherText!: Phaser.GameObjects.Text;
  private windText!: Phaser.GameObjects.Text;
  private worldPositionMarker!: Phaser.GameObjects.Rectangle;
  private cachedPreviewPoints: FlightPoint[] = [];
  private previewDashOffset = 0;
  private previewShimmerPhase = 0;
  private readonly destructibleViews = new Map<
    string,
    DestructibleView
  >();
  private arenaId: ArenaId = DEFAULT_ARENA_ID;
  private matchPlacement: MatchPlacement = createDefaultMatchPlacement();
  private matchSettings: MatchSettings = readMatchSettings(undefined);
  private aiThinking = false;
  private launchInProgress = false;
  private knightMarchInProgress = false;
  private audioContext: AudioContext | null = null;
  private dragAimPointerId: number | null = null;
  private dragAimStart = { x: 0, y: 0 };
  private dragAimDistance = 0;
  private uiOffsetX = 0;

  constructor() {
    super("BattleScene");
  }

  create(data: BattleSceneData): void {
    configure2KCamera(this);
    this.uiOffsetX = getLogicalViewport(this).overflowX;
    musicController.setTheme("battle");
    this.matchSettings = readMatchSettings(
      this.registry.get(MATCH_SETTINGS_REGISTRY_KEY),
    );
    this.aiThinking = false;
    this.launchInProgress = false;
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
    set2KCameraBounds(
      this,
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
    this.createKnightSquadViews();
    this.cameras.main.fadeIn(300, 10, 8, 6);
    this.fogOfWar = this.add.graphics().setDepth(40);
    this.gestureGuide = this.add.graphics().setDepth(16);
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
      onRepair: () => this.repairActivePlayer(),
    });
    this.input.keyboard?.on("keydown", this.handleKeyDown, this);
    this.input.on("pointerdown", this.handleAimPointerDown, this);
    this.input.on("pointermove", this.handleAimPointerMove, this);
    this.input.on("pointerup", this.handleAimPointerUp, this);
    this.input.on("pointerupoutside", this.handleAimPointerUp, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off("keydown", this.handleKeyDown, this);
      this.input.off("pointerdown", this.handleAimPointerDown, this);
      this.input.off("pointermove", this.handleAimPointerMove, this);
      this.input.off("pointerup", this.handleAimPointerUp, this);
      this.input.off("pointerupoutside", this.handleAimPointerUp, this);
      if (this.audioContext) {
        void this.audioContext.close();
        this.audioContext = null;
      }
    });
    this.renderBattleState();
    this.centerCameraOnActivePlayer();
    this.redrawPreview(this.aimingControls.getValues());
    sharpenSceneText(this);
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
    createCastleAmbientEffects(this, this.arenaId, segmentCount);

    this.add
      .rectangle(
        0,
        0,
        GAME_CONFIG.world.width,
        GAME_HEIGHT,
        RETRO_UI.colors.orangeDark,
        0.08,
      )
      .setOrigin(0)
      .setDepth(-95);

    this.drawDynamicWorldLayers(arena);
    const usesPremiumMapPackage = arena.obstacles.every(
      ({ textureKey }) => textureKey !== undefined,
    );

    if (!usesPremiumMapPackage) {
      this.drawWastelandInfrastructure(arena);
    }

    drawArenaTerrain(this, arena, -40);

    arena.obstacles.forEach((obstacle) => {
      this.drawObstacle(arena, obstacle);
    });
    this.battleController
      .getState()
      .protections.forEach((protection) => {
        this.drawProtection(protection);
      });
    if (!usesPremiumMapPackage) {
      this.drawAmbientLife(arena);
    }

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
        BATTLE_HEADER_HEIGHT,
        GAME_WIDTH,
        GAME_HEIGHT - BATTLE_HEADER_HEIGHT,
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

    const fallDistance = GAME_HEIGHT - BATTLE_HEADER_HEIGHT;

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
          const y = BATTLE_HEADER_HEIGHT + ((index * 83) % fallDistance);
          layer.lineBetween(x, y, x - 13, y + 34);
        }
      } else {
        for (let index = 0; index < 48; index += 1) {
          const x = (index * 149 + layerIndex * 71) % GAME_WIDTH;
          const y = BATTLE_HEADER_HEIGHT + ((index * 97) % fallDistance);
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
    if (obstacle.textureKey) {
      const sprite = this.add
        .image(obstacle.x, obstacle.y, obstacle.textureKey)
        .setOrigin(0)
        .setDisplaySize(obstacle.width, obstacle.height)
        .setFlipX(obstacle.flipX ?? false)
        .setDepth(5);

      this.registerDestructibleView(
        obstacle.id,
        obstacle.x,
        obstacle.y,
        obstacle.width,
        obstacle.height,
        sprite,
        arena.palette.obstacleStrokeColor,
      );
      return;
    }

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
    const tower = createCastleTowerSprite(this, protection, 7);

    this.registerDestructibleView(
      protection.id,
      protection.x,
      protection.y,
      protection.width,
      protection.height,
      tower,
      PROTECTION_VIEW_COLORS.castle.detail,
    );
  }

  private registerDestructibleView(
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
    body: Phaser.GameObjects.Graphics | Phaser.GameObjects.Image,
    accentColor: number,
  ): void {
    const damageOverlay = this.add.graphics().setDepth(8);
    const cracks = this.add.graphics().setDepth(9);
    const impactMarks = this.add.graphics().setDepth(10);
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
      impactMarks,
      impactMarkCount: 0,
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
    view.impactMarks.setVisible(!destroyed);
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
    const frame = this.add
      .graphics()
      .setX(this.uiOffsetX)
      .setScrollFactor(0)
      .setDepth(900);
    frame.fillStyle(RETRO_UI.colors.orange, 1);
    frame.fillRect(34, 18, 6, 46);

    this.add
      .text(50 + this.uiOffsetX, 20, STRINGS_RU.gameTitle, {
        color: RETRO_UI.text.orange,
        fontFamily: DISPLAY_FONT,
        fontSize: "25px",
        fontStyle: "bold",
        letterSpacing: 4,
        stroke: RETRO_UI.text.ink,
        strokeThickness: 6,
      })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(901);

    this.add
      .text(52 + this.uiOffsetX, 52, STRINGS_RU.battleSubtitle, {
        color: COLORS.secondaryText,
        fontFamily: UI_FONT,
        fontSize: "9px",
        letterSpacing: 2,
      })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(901);

    const badge = this.add
      .graphics()
      .setX(this.uiOffsetX)
      .setScrollFactor(0)
      .setDepth(901);
    badge.fillStyle(COLORS.panel, 0.7);
    badge.fillRoundedRect(1260, 14, 276, 58, 7);
    badge.lineStyle(RETRO_UI.line.selected, RETRO_UI.colors.ink, 1);
    badge.strokeRoundedRect(1260, 14, 276, 58, 7);
    badge.lineStyle(RETRO_UI.line.hairline, RETRO_UI.colors.cyan, 0.85);
    badge.strokeRoundedRect(1267, 21, 262, 44, 5);

    this.weatherText = this.add
      .text(1398 + this.uiOffsetX, 34, "", {
        color: COLORS.ready,
        fontFamily: UI_FONT,
        fontSize: "13px",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(902);

    this.windText = this.add
      .text(1398 + this.uiOffsetX, 57, "", {
        color: COLORS.primaryText,
        fontFamily: UI_FONT,
        fontSize: "12px",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(902);
  }

  private createStatus(): void {
    const panelX = 470;
    const panelY = 18;
    const panelWidth = 670;
    const panelHeight = 42;
    const panel = this.add
      .graphics()
      .setX(this.uiOffsetX)
      .setScrollFactor(0)
      .setDepth(900);

    panel.fillStyle(RETRO_UI.colors.ink, 0.6);
    panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 8);
    panel.lineStyle(2, COLORS.panelStroke, 0.68);
    panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 8);
    panel.lineStyle(1, RETRO_UI.colors.cyan, 0.3);
    panel.strokeRoundedRect(panelX + 5, panelY + 5, panelWidth - 10, panelHeight - 10, 5);

    panel.lineStyle(3, RETRO_UI.colors.orange, 0.9);
    panel.lineBetween(panelX + 14, panelY + 9, panelX + 50, panelY + 9);
    panel.lineBetween(panelX + 14, panelY + 9, panelX + 14, panelY + 22);
    panel.lineBetween(panelX + panelWidth - 14, panelY + panelHeight - 9, panelX + panelWidth - 50, panelY + panelHeight - 9);
    panel.lineBetween(panelX + panelWidth - 14, panelY + panelHeight - 9, panelX + panelWidth - 14, panelY + panelHeight - 22);
    panel.fillStyle(RETRO_UI.colors.cyan, 0.9);
    panel.fillCircle(panelX + 30, panelY + 31, 3);
    panel.fillStyle(RETRO_UI.colors.orange, 0.9);
    panel.fillCircle(panelX + 42, panelY + 31, 3);

    this.statusText = this.add
      .text(800 + this.uiOffsetX, panelY + panelHeight / 2, this.getAimingStatus(), {
        color: COLORS.primaryText,
        fontFamily: UI_FONT,
        fontSize: "12px",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(901);
  }

  private createWorldRail(): void {
    const railX = 1226;
    const railY = 82;
    const railWidth = 250;
    const rail = this.add
      .graphics()
      .setX(this.uiOffsetX)
      .setScrollFactor(0)
      .setDepth(905);

    rail.fillStyle(RETRO_UI.colors.ink, 0.7);
    rail.fillRoundedRect(railX, railY, railWidth, 18, 4);
    rail.lineStyle(RETRO_UI.line.hairline, RETRO_UI.colors.border, 0.72);
    rail.strokeRoundedRect(railX, railY, railWidth, 18, 4);
    rail.fillStyle(RETRO_UI.colors.playerLeft, 1);
    rail.fillRect(railX + 4, railY + 4, 10, 10);
    rail.fillStyle(RETRO_UI.colors.playerRight, 1);
    rail.fillRect(railX + railWidth - 14, railY + 4, 10, 10);

    this.worldPositionMarker = this.add
      .rectangle(
        railX + 9 + this.uiOffsetX,
        railY + 9,
        14,
        24,
        RETRO_UI.colors.orange,
        1,
      )
      .setStrokeStyle(2, RETRO_UI.colors.cream, 0.95)
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

    this.worldPositionMarker.setX(
      railStartX + this.uiOffsetX + railWidth * progress,
    );
  }

  private centerCameraOnActivePlayer(): void {
    const state = this.battleController.getState();
    const activePlayer = state.players[state.activePlayerId];

    center2KCameraOn(this, activePlayer.catapultX, GAME_HEIGHT / 2);
    this.updateWorldMarker(activePlayer.catapultX);
  }

  private createCatapultViews(): void {
    const battleState = this.battleController.getState();

    this.catapultViews = {
      left: new CatapultView(
        this,
        battleState.players.left,
        battleState.activePlayerId === "left",
        this.matchSettings.playerNames.left,
      ),
      right: new CatapultView(
        this,
        battleState.players.right,
        battleState.activePlayerId === "right",
        this.matchSettings.playerNames.right,
      ),
    };
  }

  private createKnightSquadViews(): void {
    const battleState = this.battleController.getState();

    this.knightSquadViews = {
      left: new KnightSquadView(
        this,
        battleState.knightSquads.left,
      ),
      right: new KnightSquadView(
        this,
        battleState.knightSquads.right,
      ),
    };
  }

  private renderBattleState(): void {
    const battleState = this.battleController.getState();

    this.catapultViews.left.update(
      battleState.players.left,
      battleState.activePlayerId === "left",
      battleState.phase === "aiming" &&
        battleState.activePlayerId === "left",
    );
    this.catapultViews.right.update(
      battleState.players.right,
      battleState.activePlayerId === "right",
      battleState.phase === "aiming" &&
        battleState.activePlayerId === "right",
    );
    this.knightSquadViews.left.update(battleState.knightSquads.left);
    this.knightSquadViews.right.update(battleState.knightSquads.right);
    const activePlayer = battleState.players[battleState.activePlayerId];

    this.aimingControls.setProjectileState(
      activePlayer.selectedProjectileType,
      activePlayer.ammunition,
    );
    this.aimingControls.setPowerMaximum(
      getPlayerMaximumPower(activePlayer),
    );
    this.aimingControls.setRepairState(
      battleState.phase === "aiming" &&
        !activePlayer.repairUsed &&
        activePlayer.health < GAME_CONFIG.catapult.maxHealth,
      activePlayer.repairUsed,
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

    this.catapultViews[battleState.activePlayerId].setAim(
      values.angleDeg,
      values.power,
    );
    const result = simulateShot(
      this.createFireCommand(values),
      battleState,
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

  private createFireCommand(
    values: AimingValues,
    launchPoint?: { x: number; y: number },
  ): FireCommand {
    const battleState = this.battleController.getState();
    const resolvedLaunchPoint =
      launchPoint ??
      this.catapultViews[
        battleState.activePlayerId
      ].getReleaseProjectileWorldPosition();

    return {
      playerId: battleState.activePlayerId,
      angleDeg: values.angleDeg,
      power: values.power,
      projectileType: values.projectileType,
      launchPoint: resolvedLaunchPoint,
    };
  }

  private handleAimPointerDown(pointer: Phaser.Input.Pointer): void {
    if (
      this.launchInProgress ||
      this.aiThinking ||
      this.battleController.getState().phase !== "aiming" ||
      this.dragAimPointerId !== null
    ) {
      return;
    }

    const worldPoint = this.cameras.main.getWorldPoint(
      pointer.x,
      pointer.y,
    );
    if (worldPoint.y > 720) {
      return;
    }

    const playerId = this.battleController.getState().activePlayerId;
    const anchor = this.catapultViews[playerId].getAimAnchorWorldPosition();
    if (
      Phaser.Math.Distance.Between(
        worldPoint.x,
        worldPoint.y,
        anchor.x,
        anchor.y,
      ) > 155
    ) {
      return;
    }

    this.dragAimPointerId = pointer.id;
    this.dragAimStart = anchor;
    this.dragAimDistance = 0;
    this.updateAimFromPointer(pointer);
  }

  private handleAimPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.dragAimPointerId !== pointer.id) {
      return;
    }

    this.updateAimFromPointer(pointer);
  }

  private handleAimPointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.dragAimPointerId !== pointer.id) {
      return;
    }

    const shouldFire = this.dragAimDistance >= 28;
    this.dragAimPointerId = null;
    this.dragAimDistance = 0;
    this.gestureGuide.clear();

    if (shouldFire) {
      this.fire(this.aimingControls.getValues());
    }
  }

  private updateAimFromPointer(pointer: Phaser.Input.Pointer): void {
    const worldPoint = this.cameras.main.getWorldPoint(
      pointer.x,
      pointer.y,
    );
    const playerId = this.battleController.getState().activePlayerId;
    const direction = playerId === "left" ? 1 : -1;
    const rawPullX =
      (this.dragAimStart.x - worldPoint.x) * direction;
    const pullX = Math.max(0, rawPullX);
    const pullY = worldPoint.y - this.dragAimStart.y;
    const distance = Math.sqrt(pullX * pullX + pullY * pullY);
    const angleDeg = Phaser.Math.RadToDeg(
      Math.atan2(pullY, Math.max(1, pullX)),
    );
    const power = Phaser.Math.Linear(
      GAME_CONFIG.aiming.minPower,
      GAME_CONFIG.aiming.maxPower,
      Phaser.Math.Clamp(distance / 240, 0, 1),
    );

    this.dragAimDistance = distance;
    this.aimingControls.setAimValues(angleDeg, power);
    this.gestureGuide.clear();
    this.gestureGuide.lineStyle(5, RETRO_UI.colors.cyan, 0.9);
    this.gestureGuide.lineBetween(
      this.dragAimStart.x,
      this.dragAimStart.y,
      worldPoint.x,
      worldPoint.y,
    );
    this.gestureGuide.lineStyle(3, RETRO_UI.colors.cream, 0.82);
    this.gestureGuide.strokeCircle(
      this.dragAimStart.x,
      this.dragAimStart.y,
      42,
    );
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
    this.catapultViews[battleState.activePlayerId].setLoadedProjectile(
      activePlayer.selectedProjectileType,
      true,
    );
    return true;
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.repeat) {
      return;
    }

    if (this.isAiTurn()) {
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

    if (event.code === "KeyR") {
      event.preventDefault();
      this.repairActivePlayer();
      return;
    }

    if (event.code !== "Space") {
      return;
    }

    event.preventDefault();
    this.fire(this.aimingControls.getValues());
  }

  private repairActivePlayer(): boolean {
    const before = this.battleController.getState();
    const result = this.battleController.repair(before.activePlayerId);

    if (!result.ok) {
      this.statusText.setText(STRINGS_RU.repairUnavailableStatus);
      return false;
    }

    this.renderBattleState();
    this.showBattleEvents(result.transition.events);
    this.statusText.setText(
      STRINGS_RU.repairStatus(
        result.restoredHealth,
        result.transition.state.players[before.activePlayerId].health,
      ),
    );
    this.playTone(640, 0.18, "sine", 0.035, 920);
    this.redrawPreview(this.aimingControls.getValues());
    return true;
  }

  private fire(values: AimingValues): void {
    if (this.launchInProgress || this.knightMarchInProgress) {
      return;
    }

    const activePlayerId =
      this.battleController.getState().activePlayerId;
    this.launchInProgress = true;
    this.aimingControls.setEnabled(false);
    this.cachedPreviewPoints = [];
    this.previewGraphics.clear();
    this.statusText.setText(STRINGS_RU.projectileFlightStatus);

    this.catapultViews[activePlayerId].playFire((launchPoint) => {
      const result = this.battleController.fire(
        this.createFireCommand(values, launchPoint),
      );

      if (!result.ok) {
        this.launchInProgress = false;
        this.aimingControls.setEnabled(true);
        this.catapultViews[activePlayerId].setLoadedProjectile(
          values.projectileType,
          true,
        );
        if (result.reason === "power-restricted") {
          this.statusText.setText(
            STRINGS_RU.frozenPowerUnavailableStatus,
          );
        } else if (result.reason !== "wrong-phase") {
          this.statusText.setText(STRINGS_RU.fireUnavailableStatus);
        }
        return;
      }

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
        follow2KCameraOnStep(this, projectile.x, projectile.y);
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
    this.launchInProgress = false;
    this.fogOfWar.setAlpha(0.42);
    const transition = this.battleController.resolveShot(shot);
    const resolvedState = transition.state;
    this.renderBattleState();
    this.showBattleEvents(transition.events);

    const impactPoint =
      shot.impact ??
      shot.knightImpact ??
      shot.objectImpact ??
      shot.points.at(-1);
    const explodes = [
      "impact",
      "knight-impact",
      "ground",
      "obstacle",
    ].includes(
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
    const knightDamage = transition.events
      .filter((event) => event.kind === "knight-damage")
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

    if (shot.knightImpact) {
      this.statusText.setText(
        STRINGS_RU.knightImpactStatus(knightDamage),
      );
    } else if (shot.impact) {
      this.statusText.setText(
        this.getProjectileImpactStatus(
          shot.projectileType,
          totalDamage,
        ),
      );
    } else if (
      shot.projectileType === "bomb" &&
      totalDamage + knightDamage > 0
    ) {
      this.statusText.setText(
        STRINGS_RU.bombImpactStatus(totalDamage + knightDamage),
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

    if (
      resolvedState.phase === "finished" &&
      (resolvedState.winnerId || resolvedState.isDraw)
    ) {
      this.time.delayedCall(GAME_CONFIG.battle.resultDisplayMs, () => {
        this.scene.start("ResultScene", {
          winnerId: resolvedState.winnerId,
          isDraw: resolvedState.isDraw,
          victoryReason: resolvedState.victoryReason,
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
    const battleEventDuration = this.showBattleEvents(transition.events);
    const knightsAreMarching = battleEventDuration > 0;
    this.knightMarchInProgress = knightsAreMarching;

    const burnDamage = transition.events.reduce(
      (sum, event) =>
        event.kind === "damage" && event.source === "burning"
          ? sum + event.amount
          : sum,
      0,
    );

    if (
      battleState.phase === "finished" &&
      (battleState.winnerId || battleState.isDraw)
    ) {
      if (burnDamage > 0) {
        this.statusText.setText(
          STRINGS_RU.burnDamageStatus(burnDamage),
        );
      }
      this.time.delayedCall(
        Math.max(
          GAME_CONFIG.battle.resultDisplayMs,
          battleEventDuration + 200,
        ),
        () => {
          this.scene.start("ResultScene", {
            winnerId: battleState.winnerId,
            isDraw: battleState.isDraw,
            victoryReason: battleState.victoryReason,
            turnNumber: battleState.turnNumber,
            arenaId: this.arenaId,
            placement: this.matchPlacement,
          });
        },
      );
      return;
    }

    const activePlayer = battleState.players[battleState.activePlayerId];

    pan2KCameraOn(
      this,
      activePlayer.catapultX,
      GAME_HEIGHT / 2,
      GAME_CONFIG.battle.cameraPanMs,
    );
    this.updateWorldMarker(activePlayer.catapultX);
    this.statusText.setText(
      knightsAreMarching
        ? STRINGS_RU.knightMovementStatus(
            battleState.knightSquads.left.progress,
          )
        : burnDamage > 0
          ? STRINGS_RU.burnDamageStatus(burnDamage)
          : this.getAimingStatus(),
    );
    const aiTurn = this.isAiTurn();
    this.aimingControls.setEnabled(!aiTurn && !knightsAreMarching);
    this.redrawPreview(this.aimingControls.getValues());

    if (aiTurn) {
      this.scheduleAiTurn(
        Math.max(
          GAME_CONFIG.battle.cameraPanMs + 300,
          battleEventDuration + 200,
        ),
      );
    }

    if (knightsAreMarching) {
      this.time.delayedCall(battleEventDuration, () => {
        this.knightMarchInProgress = false;
        if (this.battleController.getState().phase !== "aiming") {
          return;
        }
        this.statusText.setText(this.getAimingStatus());
        if (!this.isAiTurn()) {
          this.aimingControls.setEnabled(true);
        }
      });
    }

    if (burnDamage > 0) {
      this.time.delayedCall(700, () => {
        if (
          this.battleController.getState().phase === "aiming" &&
          !this.knightMarchInProgress
        ) {
          this.statusText.setText(this.getAimingStatus());
        }
      });
    }
  }

  private getAimingStatus(): string {
    const battleState = this.battleController.getState();
    const playerName =
      this.matchSettings.playerNames[battleState.activePlayerId];
    const aimingStatus = IS_MOBILE_RENDER_TARGET
      ? STRINGS_RU.touchAimingStatusForName(
          battleState.turnNumber,
          playerName,
        )
      : STRINGS_RU.aimingStatusForName(
          battleState.turnNumber,
          playerName,
        );
    return `${aimingStatus} · ${STRINGS_RU.knightRoundStatus(
      battleState.knightSquads.left.progress,
    )}`;
  }

  private isAiTurn(): boolean {
    const battleState = this.battleController.getState();
    return (
      this.matchSettings.mode === "ai" &&
      battleState.phase === "aiming" &&
      battleState.activePlayerId === "right"
    );
  }

  private scheduleAiTurn(delay: number): void {
    if (!this.isAiTurn() || this.aiThinking) {
      return;
    }

    this.aiThinking = true;
    this.statusText.setText(
      STRINGS_RU.aiThinkingStatus(
        STRINGS_RU.aiDifficultyName(this.matchSettings.aiDifficulty),
      ),
    );
    this.time.delayedCall(delay, () => {
      if (!this.isAiTurn()) {
        this.aiThinking = false;
        return;
      }

      const aiPlayer = this.battleController.getState().players.right;

      if (
        !aiPlayer.repairUsed &&
        aiPlayer.health <=
          GAME_CONFIG.catapult.maxHealth *
            (1 - GAME_CONFIG.repair.healthRatio)
      ) {
        this.repairActivePlayer();
        this.statusText.setText(
          STRINGS_RU.aiThinkingStatus(
            STRINGS_RU.aiDifficultyName(
              this.matchSettings.aiDifficulty,
            ),
          ),
        );
      }

      const values = this.chooseAiAimingValues();
      this.selectProjectile(values.projectileType);
      this.catapultViews.right.setAim(values.angleDeg, values.power);
      this.redrawPreview(values);
      this.time.delayedCall(520, () => {
        this.aiThinking = false;
        if (this.isAiTurn()) {
          this.fire(values);
        }
      });
    });
  }

  private chooseAiAimingValues(): AimingValues {
    const state = this.battleController.getState();
    const activePlayer = state.players.right;
    const difficulty = this.matchSettings.aiDifficulty;
    const projectileTypes =
      difficulty === "hard"
        ? PROJECTILE_TYPES.filter((type) => {
            const ammunition = activePlayer.ammunition[type];
            return ammunition === null || ammunition > 0;
          })
        : (["stone"] as const satisfies readonly ProjectileType[]);
    const angleStep = difficulty === "hard" ? 2 : difficulty === "normal" ? 4 : 6;
    const powerStep = difficulty === "hard" ? 2 : difficulty === "normal" ? 4 : 7;
    const maximumPower = getPlayerMaximumPower(activePlayer);
    const enemySquad = state.knightSquads.left;
    const remainingRounds =
      GAME_CONFIG.knights.stepsToVictory - enemySquad.progress;
    const estimatedAccuracy =
      difficulty === "easy" ? 0.25 : difficulty === "normal" ? 0.4 : 0.6;
    const expectedDefenseShots =
      Math.ceil(enemySquad.health / GAME_CONFIG.projectiles.stone.baseDamage) /
      estimatedAccuracy;
    const preferSquad =
      enemySquad.health > 0 &&
      expectedDefenseShots >= Math.max(1, remainingRounds - 1);
    const targetX = preferSquad
      ? enemySquad.x
      : state.players.left.catapultX;
    let best: { values: AimingValues; score: number } | undefined;

    for (const projectileType of projectileTypes) {
      for (let angleDeg = GAME_CONFIG.aiming.minAngleDeg; angleDeg <= GAME_CONFIG.aiming.maxAngleDeg; angleDeg += angleStep) {
        for (let power = Math.max(40, GAME_CONFIG.aiming.minPower); power <= maximumPower; power += powerStep) {
          const result = simulateShot(
            { playerId: "right", angleDeg, power, projectileType },
            state,
          );
          const lastPoint = result.points.at(-1);
          const hitScore = result.impact?.targetId === "left" ? 100_000 + result.impact.damage * 500 : 0;
          const knightHitScore =
            result.knightImpact?.targetId === "left"
              ? (preferSquad ? 125_000 : 24_000) +
                result.knightImpact.damage * 600
              : 0;
          const obstacleScore = result.objectImpact ? 8_000 : 0;
          const distanceScore = lastPoint ? -Math.abs(lastPoint.x - targetX) : -20_000;
          const score =
            hitScore + knightHitScore + obstacleScore + distanceScore;

          if (!best || score > best.score) {
            best = {
              score,
              values: { angleDeg, power, projectileType },
            };
          }
        }
      }
    }

    const fallback: AimingValues = {
      angleDeg: 42,
      power: Math.min(78, maximumPower),
      projectileType: "stone",
    };
    const values = { ...(best?.values ?? fallback) };
    const variation = (state.turnNumber % 3) - 1;

    if (difficulty === "easy") {
      values.angleDeg += variation * 8;
      values.power += state.turnNumber % 2 === 0 ? 8 : -12;
    } else if (difficulty === "normal") {
      values.angleDeg += variation * 2;
      values.power += variation * 2;
    }

    values.angleDeg = Phaser.Math.Clamp(
      Math.round(values.angleDeg),
      GAME_CONFIG.aiming.minAngleDeg,
      GAME_CONFIG.aiming.maxAngleDeg,
    );
    values.power = Phaser.Math.Clamp(
      Math.round(values.power),
      GAME_CONFIG.aiming.minPower,
      maximumPower,
    );
    return values;
  }

  private showDamage(targetId: PlayerId, damage: number): void {
    const position =
      this.catapultViews[targetId].getDamageLabelPosition();
    const label = this.add
      .text(position.x, position.y, STRINGS_RU.damageTaken(damage), {
        color: RETRO_UI.text.danger,
        fontFamily: DISPLAY_FONT,
        fontSize: "44px",
        fontStyle: "bold",
        stroke: RETRO_UI.text.ink,
        strokeThickness: 9,
        backgroundColor: "#17140fcc",
        padding: { x: 13, y: 7 },
      })
      .setOrigin(0.5)
      .setScale(0.68)
      .setDepth(1100);

    this.tweens.add({
      targets: label,
      y: position.y - 88,
      scale: 1.08,
      alpha: 0,
      duration: 1450,
      ease: "Back.easeOut",
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
    const displaySize = Math.max(34, radius * 2.75);
    const glow = new Phaser.GameObjects.Arc(
      this,
      0,
      0,
      displaySize * 0.42,
      0,
      360,
      false,
      GAME_CONFIG.projectiles[projectileType].tint,
      projectileType === "fire" || projectileType === "bomb" ? 0.24 : 0.1,
    );
    const model = new Phaser.GameObjects.Image(
      this,
      0,
      0,
      PROJECTILE_TEXTURE_KEYS[projectileType],
    ).setDisplaySize(displaySize, displaySize);

    return this.add.container(x, y, [glow, model]).setDepth(50);
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
    const verticalMargin = GAME_CONFIG.world.verticalOutOfBoundsMargin;
    const fogTop = -verticalMargin;
    const fogHeight = GAME_HEIGHT + verticalMargin * 2;

    this.fogOfWar.clear().setAlpha(1);
    for (let index = 0; index < 8; index += 1) {
      const alpha = 0.1 + index * 0.055;
      const x =
        activePlayerId === "left"
          ? startX + index * bandWidth
          : startX - (index + 1) * bandWidth;
      this.fogOfWar.fillStyle(0x0b0e10, alpha);
      this.fogOfWar.fillRect(x, fogTop, bandWidth + 4, fogHeight);
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

  private showBattleEvents(events: readonly BattleEvent[]): number {
    const damageByPlayer: Record<PlayerId, number> = {
      left: 0,
      right: 0,
    };
    const impactDamageByPlayer: Record<PlayerId, number> = {
      left: 0,
      right: 0,
    };

    events.forEach((event) => {
      if (event.kind === "damage") {
        damageByPlayer[event.targetId] += event.amount;
        if (event.source !== "burning") {
          impactDamageByPlayer[event.targetId] += event.amount;
        }
      } else if (event.kind === "durability") {
        this.showDurabilityDamage(event);
      } else if (event.kind === "material-reaction") {
        this.showMaterialReaction(event);
      } else if (event.kind === "displacement") {
        this.catapultViews[event.targetId].playDisplacement(
          event.fromX,
          event.fromY,
          event.toX,
          event.toY,
        );
      } else if (event.kind === "repair") {
        this.showRepair(event.targetId, event.amount);
      } else if (event.kind === "knight-move") {
        this.knightSquadViews[event.targetId].animateMove(
          event.fromX,
          event.fromY,
          event.toX,
          event.toY,
        );
      } else if (event.kind === "knight-damage") {
        this.knightSquadViews[event.targetId].playImpact(event.health <= 0);
        this.showKnightDamage(event.targetId, event.amount);
      }
    });

    (["left", "right"] as const).forEach((playerId) => {
      const damage = damageByPlayer[playerId];

      if (damage > 0) {
        this.catapultViews[playerId].playImpact(damage);
        if (impactDamageByPlayer[playerId] > 0) {
          this.showCatapultDebris(
            playerId,
            impactDamageByPlayer[playerId],
          );
        }
        this.showDamage(playerId, damage);
      }
    });

    return events.some((event) => event.kind === "knight-move")
      ? KNIGHT_MARCH_DURATION_MS
      : 0;
  }

  private showKnightDamage(targetId: PlayerId, damage: number): void {
    const position = this.knightSquadViews[targetId].getLabelPosition();
    const label = this.add
      .text(position.x, position.y, `−${damage} ОТРЯД`, {
        color: RETRO_UI.text.danger,
        fontFamily: DISPLAY_FONT,
        fontSize: "28px",
        fontStyle: "bold",
        stroke: RETRO_UI.text.ink,
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(1100);

    this.tweens.add({
      targets: label,
      y: position.y - 65,
      alpha: 0,
      duration: 1000,
      ease: "Cubic.easeOut",
      onComplete: () => label.destroy(),
    });
  }

  private showCatapultDebris(
    targetId: PlayerId,
    damage: number,
  ): void {
    const catapult = this.catapultViews[targetId];
    const direction = targetId === "left" ? -1 : 1;
    const intensity = Phaser.Math.Clamp(damage / 35, 0.55, 1.5);
    const fragmentCount = Math.round(7 + intensity * 5);
    const originX = catapult.x;
    const originY = catapult.y - 18;

    for (let index = 0; index < fragmentCount; index += 1) {
      const isWheel = index === 0;
      const isMetal = !isWheel && index % 4 === 0;
      let fragment:
        | Phaser.GameObjects.Graphics
        | Phaser.GameObjects.Arc
        | Phaser.GameObjects.Rectangle;

      if (isWheel) {
        const wheel = this.add.graphics();
        wheel.lineStyle(3, 0x5b321c, 1);
        wheel.strokeCircle(0, 0, 7);
        wheel.lineStyle(2, 0xc07a35, 0.95);
        wheel.lineBetween(-6, 0, 6, 0);
        wheel.lineBetween(0, -6, 0, 6);
        wheel.fillStyle(0xd39a4a, 1);
        wheel.fillCircle(0, 0, 2.5);
        fragment = wheel;
      } else if (isMetal) {
        fragment = this.add
          .circle(0, 0, 3 + (index % 2), 0x9aa4aa, 1)
          .setStrokeStyle(1.5, 0x34383a, 1);
      } else {
        fragment = this.add
          .rectangle(
            0,
            0,
            index === 1 ? 24 : 9 + (index % 4) * 4,
            index === 1 ? 5 : 3 + (index % 2) * 2,
            index % 3 === 0 ? 0xd58a39 : 0x7a4526,
            1,
          )
          .setStrokeStyle(1, 0x3c2418, 0.9);
      }

      const spread = (index - (fragmentCount - 1) / 2) * 6;
      const travelX =
        direction * (45 + intensity * 45 + (index % 4) * 15) + spread;
      const lift = 45 + intensity * 46 + (index % 5) * 10;
      const duration = 620 + (index % 5) * 75;

      fragment
        .setPosition(originX + (index % 3) * 3, originY)
        .setRotation(Phaser.Math.DegToRad(index * 29))
        .setDepth(76);

      this.tweens.add({
        targets: fragment,
        x: originX + travelX,
        angle: direction * (220 + index * 67),
        duration,
        ease: "Quad.easeOut",
      });
      this.tweens.add({
        targets: fragment,
        y: originY - lift,
        duration: duration * 0.42,
        ease: "Cubic.easeOut",
        onComplete: () => {
          this.tweens.add({
            targets: fragment,
            y: originY + 70 + (index % 3) * 14,
            alpha: 0,
            duration: duration * 0.72,
            ease: "Quad.easeIn",
            onComplete: () => fragment.destroy(),
          });
        },
      });
    }
  }

  private showRepair(playerId: PlayerId, amount: number): void {
    const position = this.catapultViews[playerId].getDamageLabelPosition();
    const ring = this.add
      .circle(
        this.catapultViews[playerId].x,
        this.catapultViews[playerId].y - 42,
        42,
        RETRO_UI.colors.success,
        0.14,
      )
      .setStrokeStyle(5, RETRO_UI.colors.success, 0.9)
      .setDepth(1098);
    const label = this.add
      .text(position.x, position.y, `+${amount} HP`, {
        color: RETRO_UI.text.success,
        fontFamily: DISPLAY_FONT,
        fontSize: "30px",
        fontStyle: "bold",
        stroke: RETRO_UI.text.ink,
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(1100);

    this.tweens.add({
      targets: ring,
      scale: 2,
      alpha: 0,
      duration: 650,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy(),
    });
    this.tweens.add({
      targets: label,
      y: position.y - 65,
      alpha: 0,
      duration: 1000,
      ease: "Cubic.easeOut",
      onComplete: () => label.destroy(),
    });
  }

  private showMaterialReaction(
    event: Extract<BattleEvent, { kind: "material-reaction" }>,
  ): void {
    const { x, y, reaction, intensity } = event;
    const palette = {
      splinter: [0xc99355, 0x6e4228],
      tear: [0xd8c89b, 0x6b6555],
      spark: [0xffd166, 0xffffff],
      crack: [0xa79784, 0x51483f],
      scorch: [0xff7043, 0x2b1a16],
      frost: [0x8fe8ff, 0xe8fbff],
      dust: [0xc7a574, 0x766048],
    }[reaction];
    const fragmentCount = Math.round(8 + intensity * 7);

    for (let index = 0; index < fragmentCount; index += 1) {
      const angle =
        -Math.PI * 0.88 +
        (Math.PI * 0.76 * index) / Math.max(1, fragmentCount - 1);
      const distance = 48 + intensity * 52 + (index % 3) * 12;
      const fragment = this.add
        .rectangle(
          x,
          y,
          reaction === "spark" ? 10 : 7 + (index % 4) * 3,
          reaction === "tear" ? 3 : 5 + (index % 2) * 3,
          index % 2 === 0 ? palette[0] : palette[1],
          1,
        )
        .setStrokeStyle(
          reaction === "crack" ? 2 : 1,
          reaction === "crack" ? 0x2d2925 : palette[1],
          0.9,
        )
        .setRotation(angle)
        .setDepth(74);

      this.tweens.add({
        targets: fragment,
        x: x + Math.cos(angle) * distance,
        angle: Phaser.Math.RadToDeg(angle) + index * 55,
        duration: 620 + index * 28,
        ease: "Quad.easeOut",
      });
      this.tweens.add({
        targets: fragment,
        y: y - 46 - intensity * 38 - (index % 5) * 11,
        duration: 270 + index * 12,
        ease: "Cubic.easeOut",
        onComplete: () => {
          this.tweens.add({
            targets: fragment,
            y: y + 66 + (index % 3) * 12,
            alpha: 0,
            scale: 0.55,
            duration: 560 + index * 18,
            ease: "Quad.easeIn",
            onComplete: () => fragment.destroy(),
          });
        },
      });
    }

    if (event.targetKind === "protection" || event.targetKind === "obstacle") {
      this.addPersistentDamageMark(event);
    }
  }

  private showDurabilityDamage(
    event: Extract<BattleEvent, { kind: "durability" }>,
  ): void {
    const view = this.destructibleViews.get(event.targetId);
    this.showStoneDebris(event.x, event.y, event.amount, event.destroyed);
    const labelX = view ? view.x + view.width / 2 : event.x;
    const labelY = view ? view.y - 28 : event.y - 28;
    const targetLabel =
      event.targetKind === "protection" ? "БАШНЯ" : "ОБЪЕКТ";
    const flash = view
      ? this.add
          .rectangle(
            view.x + view.width / 2,
            view.y + view.height / 2,
            view.width + 12,
            view.height + 12,
            0xffffff,
            0.72,
          )
          .setStrokeStyle(7, RETRO_UI.colors.orange, 1)
          .setDepth(12)
      : null;
    const label = this.add
      .text(
        labelX,
        labelY,
        `${targetLabel}  −${event.amount}\n${event.destroyed ? "РАЗРУШЕНО" : `ПРОЧНОСТЬ ${event.remaining}`}`,
        {
          color: RETRO_UI.text.orange,
          fontFamily: DISPLAY_FONT,
          fontSize: "34px",
          fontStyle: "bold",
          stroke: RETRO_UI.text.ink,
          strokeThickness: 8,
          align: "center",
          backgroundColor: "#17140fd9",
          padding: { x: 14, y: 9 },
        },
      )
      .setOrigin(0.5)
      .setScale(0.72)
      .setDepth(1100);

    if (flash) {
      this.tweens.add({
        targets: flash,
        alpha: 0,
        scaleX: 1.08,
        scaleY: 1.04,
        duration: 260,
        ease: "Cubic.easeOut",
        onComplete: () => flash.destroy(),
      });
    }

    this.tweens.add({
      targets: label,
      y: labelY - 82,
      scale: 1,
      alpha: 0,
      duration: 1550,
      ease: "Back.easeOut",
      onComplete: () => label.destroy(),
    });
  }

  private showStoneDebris(
    x: number,
    y: number,
    damage: number,
    destroyed: boolean,
  ): void {
    const count = destroyed ? 24 : Phaser.Math.Clamp(8 + Math.round(damage / 3), 10, 18);
    const colors = [0xc0a781, 0x8a7a68, 0x665b50, 0x3f3934];

    for (let index = 0; index < count; index += 1) {
      const direction = index % 2 === 0 ? -1 : 1;
      const horizontalSpeed = 55 + (index % 6) * 23 + damage * 1.4;
      const rise = 58 + (index % 5) * 17 + (destroyed ? 46 : 0);
      const size = (destroyed ? 10 : 7) + (index % 4) * 3;
      const chunk = this.add
        .rectangle(
          x + direction * (index % 3) * 3,
          y,
          size,
          Math.max(5, size - (index % 3) * 2),
          colors[index % colors.length],
          1,
        )
        .setStrokeStyle(2, 0x2d2925, 0.9)
        .setRotation((index * 0.67) % Math.PI)
        .setDepth(76);

      this.tweens.add({
        targets: chunk,
        x: x + direction * horizontalSpeed,
        angle: direction * (180 + index * 37),
        duration: 720 + (index % 5) * 70,
        ease: "Quad.easeOut",
      });
      this.tweens.add({
        targets: chunk,
        y: y - rise,
        duration: 300 + (index % 4) * 38,
        ease: "Cubic.easeOut",
        onComplete: () => {
          this.tweens.add({
            targets: chunk,
            y: y + 74 + (index % 3) * 10,
            alpha: destroyed && index < 5 ? 0.85 : 0,
            scale: destroyed && index < 5 ? 0.8 : 0.45,
            duration: 560 + (index % 5) * 65,
            ease: "Quad.easeIn",
            onComplete: () => {
              if (destroyed && index < 5) {
                this.time.delayedCall(2400, () => chunk.destroy());
              } else {
                chunk.destroy();
              }
            },
          });
        },
      });
    }
  }

  private addPersistentDamageMark(
    event: Extract<BattleEvent, { kind: "material-reaction" }>,
  ): void {
    if (!event.targetId) {
      return;
    }

    const view = this.destructibleViews.get(event.targetId);
    if (!view) {
      return;
    }

    const mark = view.impactMarks;
    const x = Phaser.Math.Clamp(event.x, view.x + 14, view.x + view.width - 14);
    const y = Phaser.Math.Clamp(event.y, view.y + 18, view.y + view.height - 16);
    const rotation = (view.impactMarkCount * 0.91) % (Math.PI * 2);
    const size =
      (13 + event.intensity * 8) *
      (event.projectileType === "bomb" ? 1.55 : 1);
    view.impactMarkCount += 1;

    if (event.projectileType === "fire") {
      mark.fillStyle(0x140b08, 0.72);
      mark.fillCircle(x, y, size * 0.82);
      mark.fillStyle(0x7b2f18, 0.68);
      mark.fillCircle(x + 2, y + 1, size * 0.5);
      mark.fillStyle(0xff7043, 0.82);
      mark.fillCircle(x, y, Math.max(3, size * 0.16));
      return;
    }

    if (event.projectileType === "ice") {
      mark.lineStyle(5, 0x73dfff, 0.78);
      for (let branch = 0; branch < 6; branch += 1) {
        const angle = rotation + (Math.PI * 2 * branch) / 6;
        mark.lineBetween(
          x,
          y,
          x + Math.cos(angle) * size,
          y + Math.sin(angle) * size,
        );
      }
      mark.fillStyle(0xe8fbff, 0.9);
      mark.fillTriangle(
        x,
        y - size * 0.55,
        x + size * 0.35,
        y + size * 0.25,
        x - size * 0.28,
        y + size * 0.2,
      );
      return;
    }

    const craterSize =
      event.projectileType === "diamond" ? size * 0.52 : size * 0.68;
    mark.fillStyle(
      event.projectileType === "bomb" ? 0x120d0b : 0x27231f,
      0.88,
    );
    mark.fillCircle(x, y, craterSize);
    mark.lineStyle(
      event.projectileType === "diamond" ? 3 : 4,
      event.projectileType === "diamond" ? 0xbff6ff : 0x171411,
      0.94,
    );
    const branches =
      event.projectileType === "bomb"
        ? 9
        : event.projectileType === "diamond"
          ? 7
          : 5;
    for (let branch = 0; branch < branches; branch += 1) {
      const angle = rotation + (Math.PI * 2 * branch) / branches;
      const length = size * (0.85 + (branch % 3) * 0.22);
      const midX = x + Math.cos(angle + 0.16) * length * 0.46;
      const midY = y + Math.sin(angle + 0.16) * length * 0.46;
      mark.beginPath();
      mark.moveTo(x, y);
      mark.lineTo(midX, midY);
      mark.lineTo(
        x + Math.cos(angle) * length,
        y + Math.sin(angle) * length,
      );
      mark.strokePath();
    }
    if (event.projectileType === "diamond") {
      mark.fillStyle(0xffffff, 0.95);
      mark.fillCircle(x, y, 4);
    }
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
