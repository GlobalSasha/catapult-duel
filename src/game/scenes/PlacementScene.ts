import * as Phaser from "phaser";

import {
  DEFAULT_ARENA_ID,
  getArenaDefinition,
  getTerrainHeightAt,
  isArenaId,
  type ArenaDefinition,
  type ArenaId,
} from "../arena/arenaCatalog";
import type { PlayerId } from "../core/battleTypes";
import { createInitialBattleState } from "../core/createInitialBattleState";
import { GAME_CONFIG } from "../core/gameConfig";
import {
  cloneMatchPlacement,
  createCastlePlayerPlacement,
  createDefaultMatchPlacement,
  type MatchPlacement,
} from "../core/placement";
import type { ProtectionState } from "../core/protection";
import { GAME_HEIGHT, GAME_WIDTH } from "../gameDimensions";
import { STRINGS_RU } from "../i18n/strings.ru";
import {
  MATCH_SETTINGS_REGISTRY_KEY,
  createAiPlacement,
  readMatchSettings,
  type MatchSettings,
} from "../core/matchSession";
import {
  center2KCameraOn,
  configure2KCamera,
  getLogicalViewport,
  set2KCameraBounds,
  sharpenSceneText,
} from "../rendering";
import { CatapultView } from "../views/CatapultView";
import { createCastleAmbientEffects } from "../views/CastleAmbientEffects";
import {
  createCastleTowerSprite,
  PROTECTION_VIEW_COLORS,
} from "../views/drawProtection";
import { RETRO_UI } from "../ui/retroTheme";
import { musicController } from "../audio/MusicController";
import { drawArenaTerrain } from "../views/drawArenaTerrain";

interface PlacementSceneData {
  arenaId?: ArenaId;
}

const COLORS = {
  navy: RETRO_UI.colors.ink,
  panel: RETRO_UI.colors.panel,
  panelRaised: RETRO_UI.colors.panelRaised,
  panelStroke: RETRO_UI.colors.border,
  text: RETRO_UI.text.primary,
  secondary: RETRO_UI.text.secondary,
  mint: RETRO_UI.colors.cyan,
  amber: RETRO_UI.colors.orange,
  coral: RETRO_UI.colors.coral,
} as const;

const DISPLAY_FONT = RETRO_UI.font.display;
const UI_FONT = RETRO_UI.font.ui;

export class PlacementScene extends Phaser.Scene {
  private arenaId: ArenaId = DEFAULT_ARENA_ID;
  private currentPlayerId: PlayerId = "left";
  private draft: MatchPlacement = createDefaultMatchPlacement();
  private matchSettings: MatchSettings = readMatchSettings(undefined);
  private dynamicObjects: Phaser.GameObjects.GameObject[] = [];
  private statusMessage: string = STRINGS_RU.placementRecommended;
  private handoffContinue?: () => void;
  private uiOffsetX = 0;

  constructor() {
    super("PlacementScene");
  }

  create(data: PlacementSceneData): void {
    configure2KCamera(this);
    this.uiOffsetX = getLogicalViewport(this).overflowX;
    musicController.setTheme("placement");
    this.matchSettings = readMatchSettings(
      this.registry.get(MATCH_SETTINGS_REGISTRY_KEY),
    );
    this.arenaId = isArenaId(data.arenaId)
      ? data.arenaId
      : DEFAULT_ARENA_ID;
    this.currentPlayerId = "left";
    this.draft = createDefaultMatchPlacement();
    this.handoffContinue = undefined;
    this.statusMessage = STRINGS_RU.placementRecommended;
    this.drawBackdrop();
    this.drawPlayerSetup();
    sharpenSceneText(this);
    this.cameras.main.fadeIn(300, 10, 8, 6);
    this.input.keyboard?.on("keydown", this.handleKeyDown, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off("keydown", this.handleKeyDown, this);
    });
  }

  private drawBackdrop(): void {
    const arena = getArenaDefinition(this.arenaId);

    set2KCameraBounds(
      this,
      0,
      0,
      GAME_CONFIG.world.width,
      GAME_CONFIG.world.height,
    );
    const backgroundSegmentCount =
      Math.ceil(GAME_CONFIG.world.width / GAME_WIDTH) + 1;
    for (let index = 0; index < backgroundSegmentCount; index += 1) {
      this.add
        .image(index * GAME_WIDTH, 0, arena.textureKey)
        .setOrigin(0)
        .setDisplaySize(GAME_WIDTH + 2, GAME_HEIGHT)
        .setScrollFactor(0.18, 0)
        .setFlipX(index % 2 === 1)
        .setTint(index % 2 === 0 ? 0xffffff : 0xe6eef8)
        .setDepth(-100);
    }
    createCastleAmbientEffects(
      this,
      this.arenaId,
      backgroundSegmentCount,
    );
    this.add
      .rectangle(
        0,
        0,
        GAME_CONFIG.world.width,
        GAME_HEIGHT,
        RETRO_UI.colors.orangeDark,
        0.11,
      )
      .setOrigin(0)
      .setDepth(-90);

    this.drawTerrain(arena);

    this.add
      .rectangle(0, 0, GAME_WIDTH, 150, COLORS.navy, 0.88)
      .setOrigin(0)
      .setX(this.uiOffsetX)
      .setScrollFactor(0)
      .setDepth(900);
    this.add
      .rectangle(0, 700, GAME_WIDTH, 200, COLORS.navy, 0.96)
      .setOrigin(0)
      .setX(this.uiOffsetX)
      .setScrollFactor(0)
      .setDepth(900)
      .setStrokeStyle(RETRO_UI.line.selected, COLORS.panelStroke, 0.88);

    const panelWear = this.add
      .graphics()
      .setX(this.uiOffsetX)
      .setScrollFactor(0)
      .setDepth(901);
    panelWear.lineStyle(3, COLORS.amber, 0.72);
    panelWear.lineBetween(0, 154, GAME_WIDTH, 154);
    panelWear.lineBetween(0, 704, GAME_WIDTH, 704);
    panelWear.lineStyle(2, COLORS.navy, 0.92);
    for (let x = 22; x < GAME_WIDTH; x += 96) {
      panelWear.strokeCircle(x, 716, 4);
      panelWear.strokeCircle(x + 42, 884, 4);
    }
    panelWear.lineStyle(5, COLORS.amber, 0.42);
    for (let x = 0; x < GAME_WIDTH; x += 42) {
      panelWear.lineBetween(x, 700, x + 25, 713);
    }
  }

  private drawTerrain(arena: ArenaDefinition): void {
    drawArenaTerrain(this, arena, -35);

    for (let index = 0; index < 34; index += 1) {
      const x = 110 + index * 205;
      const groundY = getTerrainHeightAt(arena.terrain, x);
      const tuft = this.add.graphics().setDepth(-20);
      tuft.lineStyle(3, arena.palette.surfaceColor, 0.34);
      tuft.lineBetween(x, groundY, x - 8, groundY - 18);
      tuft.lineBetween(x, groundY, x + 3, groundY - 24);
      tuft.lineBetween(x, groundY, x + 11, groundY - 15);
      this.tweens.add({
        targets: tuft,
        angle: index % 2 === 0 ? 2 : -2,
        duration: 1500 + (index % 5) * 170,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
  }

  private drawPlayerSetup(): void {
    this.clearDynamicObjects();
    const placement = this.draft[this.currentPlayerId];
    const arena = getArenaDefinition(this.arenaId);
    const accent =
      this.currentPlayerId === "left"
        ? RETRO_UI.colors.playerLeft
        : RETRO_UI.colors.playerRight;
    const battleState = createInitialBattleState(
      this.arenaId,
      GAME_CONFIG.weather.defaultMatchSeed,
      this.draft,
    );
    const playerState = battleState.players[this.currentPlayerId];
    const baseCenterX =
      this.currentPlayerId === "left"
        ? GAME_CONFIG.placement.catapultSlots.left[1]
        : GAME_CONFIG.placement.catapultSlots.right[1];

    center2KCameraOn(this, baseCenterX, GAME_HEIGHT / 2);

    this.trackUi(
      this.add
        .text(70, 35, STRINGS_RU.placementEyebrow, {
          color: RETRO_UI.text.cyan,
          fontFamily: UI_FONT,
          fontSize: "13px",
          fontStyle: "bold",
          letterSpacing: 5,
        })
        .setOrigin(0, 0.5),
    );
    this.trackUi(
      this.add
        .text(
          70,
          78,
          STRINGS_RU.placementTitleForName(
            this.matchSettings.playerNames[this.currentPlayerId],
          ),
          {
          color: RETRO_UI.text.orange,
          fontFamily: DISPLAY_FONT,
          fontSize: "31px",
          fontStyle: "bold",
          letterSpacing: 3,
          },
        )
        .setOrigin(0, 0.5),
    );
    this.trackUi(
      this.add
        .text(70, 119, STRINGS_RU.placementFieldHint, {
          color: COLORS.secondary,
          fontFamily: UI_FONT,
          fontSize: "15px",
        })
        .setOrigin(0, 0.5),
    );
    this.trackUi(
      this.add
        .text(
          GAME_WIDTH - 70,
          62,
          this.currentPlayerId === "left"
            ? STRINGS_RU.placementEnemyDirectionRight
            : STRINGS_RU.placementEnemyDirectionLeft,
          {
            color: RETRO_UI.text.cyan,
            fontFamily: UI_FONT,
            fontSize: "15px",
            fontStyle: "bold",
            letterSpacing: 1,
          },
        )
        .setOrigin(1, 0.5),
    );

    this.trackUi(
      this.add
        .text(70, 178, STRINGS_RU.placementCatapultFieldLabel, {
          color: COLORS.text,
          fontFamily: UI_FONT,
          fontSize: "13px",
          fontStyle: "bold",
          letterSpacing: 2,
        })
        .setOrigin(0, 0.5)
        .setBackgroundColor("rgba(23, 20, 15, 0.88)")
        .setPadding(12, 7),
    );

    GAME_CONFIG.placement.catapultSlots[this.currentPlayerId].forEach(
      (x, slotIndex) => {
        const groundY = getTerrainHeightAt(arena.terrain, x);
        const selected = placement.catapultSlotIndex === slotIndex;
        const footprint = this.track(
        this.add
            .ellipse(
              x,
              groundY - 6,
              selected ? 112 : 82,
              selected ? 34 : 26,
              selected ? accent : COLORS.panel,
              selected ? 0.22 : 0.58,
            )
            .setStrokeStyle(
              selected ? RETRO_UI.line.selected : RETRO_UI.line.hairline,
              selected ? COLORS.amber : accent,
              selected ? 1 : 0.7,
            )
            .setDepth(16),
      );
        if (selected) {
          this.tweens.add({
            targets: footprint,
            scaleX: 1.12,
            scaleY: 1.12,
            alpha: 0.45,
            duration: RETRO_UI.motion.ambient,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
          });
        }
        this.track(
        this.add
            .text(x, groundY + 22, `${slotIndex + 1}`, {
            color: COLORS.text,
            fontFamily: UI_FONT,
              fontSize: "12px",
            fontStyle: "bold",
          })
            .setOrigin(0.5)
            .setDepth(18),
      );
        const hitZone = this.track(
          this.add
            .rectangle(x, groundY - 64, 108, 150, accent, 0.001)
            .setInteractive({ useHandCursor: true })
            .setDepth(40),
        );
        hitZone.on("pointerover", () =>
          footprint.setStrokeStyle(RETRO_UI.line.selected, COLORS.amber, 1),
        );
        hitZone.on("pointerout", () =>
          footprint.setStrokeStyle(
            selected ? RETRO_UI.line.selected : RETRO_UI.line.hairline,
            selected ? COLORS.amber : accent,
            selected ? 1 : 0.7,
          ),
        );
        hitZone.on("pointerdown", () => {
          const castleEnabled =
            this.draft[this.currentPlayerId].protections.length > 0;
          this.draft[this.currentPlayerId] = createCastlePlayerPlacement(
            this.currentPlayerId,
            slotIndex,
            castleEnabled,
          );
          this.statusMessage = STRINGS_RU.placementRecommended;
          this.drawPlayerSetup();
        });
      },
    );

    const catapult = this.track(
      new CatapultView(this, playerState, true),
    );
    catapult.setDepth(24);

    placement.protections.forEach((item) => {
      const protection = battleState.protections.find(
        (candidate) =>
          candidate.ownerId === this.currentPlayerId &&
          candidate.id.includes(`slot-${item.slotIndex}-`),
      );
      if (protection) {
        this.drawProtectionOnField(protection);
      }
    });

    this.trackUi(
      this.add
        .text(70, 725, STRINGS_RU.placementProtectionLabel, {
          color: COLORS.text,
          fontFamily: UI_FONT,
          fontSize: "13px",
          fontStyle: "bold",
          letterSpacing: 1,
        })
        .setOrigin(0, 0.5),
    );
    const castleEnabled = placement.protections.length > 0;
    this.createActionButton(
      220,
      775,
      300,
      castleEnabled
        ? STRINGS_RU.placementCastleBuilt
        : STRINGS_RU.placementBuildCastle,
      castleEnabled ? COLORS.mint : COLORS.panelRaised,
      () => this.setCastleEnabled(true),
      castleEnabled ? RETRO_UI.text.ink : RETRO_UI.text.primary,
    );
    this.createActionButton(
      550,
      775,
      300,
      STRINGS_RU.placementRemoveCastle,
      COLORS.panelRaised,
      () => this.setCastleEnabled(false),
    );

    this.trackUi(
      this.add
        .text(70, 845, this.statusMessage, {
          color:
            this.statusMessage === STRINGS_RU.placementRecommended
              ? COLORS.secondary
              : RETRO_UI.text.danger,
          fontFamily: UI_FONT,
          fontSize: "14px",
          wordWrap: { width: 990 },
        })
        .setOrigin(0, 0.5),
    );
    this.createActionButton(
      GAME_WIDTH - 380,
      820,
      190,
      STRINGS_RU.placementReset,
      COLORS.panelRaised,
      () => this.resetCurrentPlayer(),
    );
    this.createActionButton(
      GAME_WIDTH - 170,
      820,
      190,
      STRINGS_RU.placementReady,
      COLORS.amber,
      () => this.confirmCurrentPlayer(),
      RETRO_UI.text.ink,
    );
  }

  private drawProtectionOnField(protection: ProtectionState): void {
    this.track(createCastleTowerSprite(this, protection, 22));
    const glowColor = PROTECTION_VIEW_COLORS[protection.type].detail;
    const glow = this.track(
      this.add
        .rectangle(
          protection.x + protection.width / 2,
          protection.y + protection.height / 2,
          protection.width + 14,
          protection.height + 14,
          glowColor,
          0.025,
        )
        .setStrokeStyle(2, glowColor, 0.32)
        .setDepth(21),
    );
    this.tweens.add({
      targets: glow,
      scaleX: 1.04,
      scaleY: 1.04,
      duration: RETRO_UI.motion.ambient,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  private clearDynamicObjects(): void {
    this.dynamicObjects.forEach((object) => {
      this.tweens.killTweensOf(object);
      object.destroy();
    });
    this.dynamicObjects = [];
  }

  private track<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.dynamicObjects.push(object);
    return object;
  }

  private trackUi<
    T extends Phaser.GameObjects.GameObject &
      Phaser.GameObjects.Components.ScrollFactor &
      Phaser.GameObjects.Components.Depth &
      Phaser.GameObjects.Components.Transform,
  >(object: T): T {
    object
      .setX(object.x + this.uiOffsetX)
      .setScrollFactor(0)
      .setDepth(1000);
    return this.track(object);
  }

  private createActionButton(
    x: number,
    y: number,
    width: number,
    label: string,
    color: number,
    onClick: () => void,
    textColor: string = RETRO_UI.text.primary,
  ): void {
    const button = this.trackUi(
      this.add
        .rectangle(x, y, width, 58, color, 1)
        .setStrokeStyle(RETRO_UI.line.selected, COLORS.panelStroke, 0.9)
        .setInteractive({ useHandCursor: true }),
    );
    this.trackUi(
      this.add
        .text(x, y, label, {
          color: textColor,
          fontFamily: UI_FONT,
          fontSize: "15px",
          fontStyle: "bold",
          letterSpacing: 1,
        })
        .setOrigin(0.5),
    );
    button.on("pointerover", () =>
      button.setStrokeStyle(
        RETRO_UI.line.selected,
        RETRO_UI.colors.cyan,
        1,
      ),
    );
    button.on("pointerout", () =>
      button.setStrokeStyle(
        RETRO_UI.line.selected,
        COLORS.panelStroke,
        0.9,
      ),
    );
    button.on("pointerdown", onClick);
  }

  private resetCurrentPlayer(): void {
    this.draft[this.currentPlayerId] = createCastlePlayerPlacement(
      this.currentPlayerId,
      1,
    );
    this.statusMessage = STRINGS_RU.placementRecommended;
    this.drawPlayerSetup();
  }

  private setCastleEnabled(enabled: boolean): void {
    const catapultSlotIndex =
      this.draft[this.currentPlayerId].catapultSlotIndex;
    this.draft[this.currentPlayerId] = createCastlePlayerPlacement(
      this.currentPlayerId,
      catapultSlotIndex,
      enabled,
    );
    this.statusMessage = enabled
      ? STRINGS_RU.placementCastleReady
      : STRINGS_RU.placementCastleRemoved;
    this.drawPlayerSetup();
  }

  private confirmCurrentPlayer(): void {
    if (this.currentPlayerId === "left") {
      if (this.matchSettings.mode === "ai") {
        this.draft.right = createAiPlacement(
          this.matchSettings.aiDifficulty,
        );
        this.scene.start("BattleScene", {
          arenaId: this.arenaId,
          placement: cloneMatchPlacement(this.draft),
        });
        return;
      }

      this.showHandoff();
      return;
    }

    this.scene.start("BattleScene", {
      arenaId: this.arenaId,
      placement: cloneMatchPlacement(this.draft),
    });
  }

  private showHandoff(): void {
    const centerX = GAME_WIDTH / 2;
    const cover = this.add
      .container(this.uiOffsetX, 0)
      .setScrollFactor(0)
      .setDepth(2000);
    const background = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.navy, 1)
      .setOrigin(0)
      .setInteractive();
    const frame = this.add.graphics();
    frame.fillStyle(COLORS.panel, 1);
    frame.fillRect(centerX - 370, 220, 740, 410);
    frame.lineStyle(RETRO_UI.line.frame, COLORS.navy, 1);
    frame.strokeRect(centerX - 370, 220, 740, 410);
    frame.lineStyle(RETRO_UI.line.selected, COLORS.panelStroke, 0.95);
    frame.strokeRect(centerX - 358, 232, 716, 386);
    frame.fillStyle(COLORS.amber, 1);
    frame.fillRect(centerX - 330, 262, 8, 68);
    const eyebrow = this.add
      .text(centerX, 270, "ПЕРЕДАЧА УПРАВЛЕНИЯ", {
        color: RETRO_UI.text.cyan,
        fontFamily: UI_FONT,
        fontSize: "13px",
        fontStyle: "bold",
        letterSpacing: 4,
      })
      .setOrigin(0.5);
    const title = this.add
      .text(centerX, 326, STRINGS_RU.placementHandoffTitle, {
        color: RETRO_UI.text.orange,
        fontFamily: DISPLAY_FONT,
        fontSize: "34px",
        fontStyle: "bold",
        letterSpacing: 3,
      })
      .setOrigin(0.5);
    const message = this.add
      .text(centerX, 410, STRINGS_RU.placementHandoffMessage, {
        color: COLORS.text,
        fontFamily: UI_FONT,
        fontSize: "19px",
        align: "center",
        lineSpacing: 8,
        wordWrap: { width: 620 },
      })
      .setOrigin(0.5);
    const button = this.add
      .rectangle(centerX, 540, 390, 68, COLORS.amber, 1)
      .setStrokeStyle(
        RETRO_UI.line.selected,
        RETRO_UI.colors.cream,
        0.9,
      )
      .setInteractive({ useHandCursor: true });
    const label = this.add
      .text(centerX, 540, STRINGS_RU.placementHandoffButton, {
        color: RETRO_UI.text.ink,
        fontFamily: UI_FONT,
        fontSize: "17px",
        fontStyle: "bold",
        letterSpacing: 1,
      })
      .setOrigin(0.5);
    cover.add([background, frame, eyebrow, title, message, button, label]);
    button.on("pointerover", () =>
      button.setFillStyle(RETRO_UI.colors.cyan, 1),
    );
    button.on("pointerout", () => button.setFillStyle(COLORS.amber, 1));
    const continuePlacement = (): void => {
      cover.destroy(true);
      this.handoffContinue = undefined;
      this.currentPlayerId = "right";
      this.statusMessage = STRINGS_RU.placementRecommended;
      this.drawPlayerSetup();
    };
    this.handoffContinue = continuePlacement;
    button.on("pointerdown", continuePlacement);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.target instanceof HTMLElement && event.target.closest("button, input")) {
      return;
    }

    if (event.repeat) {
      return;
    }

    if (this.handoffContinue) {
      if (event.code === "Enter" || event.code === "Space") {
        event.preventDefault();
        this.handoffContinue();
      }
      return;
    }

    if (event.code === "Escape") {
      this.scene.start("MenuScene");
      return;
    }

    if (event.code === "Enter" || event.code === "Space") {
      event.preventDefault();
      this.confirmCurrentPlayer();
      return;
    }

    if (event.code === "KeyR") {
      this.resetCurrentPlayer();
    }
  }
}
