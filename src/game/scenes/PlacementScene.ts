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
  createDefaultMatchPlacement,
  validatePlayerPlacement,
  type MatchPlacement,
  type PlayerPlacement,
} from "../core/placement";
import type { ProtectionType } from "../core/protection";
import { GAME_HEIGHT, GAME_WIDTH } from "../gameDimensions";
import { STRINGS_RU } from "../i18n/strings.ru";
import { CatapultView } from "../views/CatapultView";
import {
  drawProtectionBody,
  PROTECTION_VIEW_COLORS,
} from "../views/drawProtection";

interface PlacementSceneData {
  arenaId?: ArenaId;
}

type PlacementTool = ProtectionType | "erase";

const COLORS = {
  navy: 0x0e1113,
  panel: 0x1b1f21,
  panelStroke: 0x896448,
  text: "#eee5d4",
  secondary: "#b4a48c",
  mint: 0x70b8b5,
  amber: 0xd39245,
  coral: 0xc56c42,
} as const;

export class PlacementScene extends Phaser.Scene {
  private arenaId: ArenaId = DEFAULT_ARENA_ID;
  private currentPlayerId: PlayerId = "left";
  private draft: MatchPlacement = createDefaultMatchPlacement();
  private selectedTool: PlacementTool = "wood";
  private dynamicObjects: Phaser.GameObjects.GameObject[] = [];
  private statusMessage: string = STRINGS_RU.placementRecommended;

  constructor() {
    super("PlacementScene");
  }

  create(data: PlacementSceneData): void {
    this.arenaId = isArenaId(data.arenaId)
      ? data.arenaId
      : DEFAULT_ARENA_ID;
    this.currentPlayerId = "left";
    this.draft = createDefaultMatchPlacement();
    this.selectedTool = "wood";
    this.statusMessage = STRINGS_RU.placementRecommended;
    this.drawBackdrop();
    this.drawPlayerSetup();
    this.input.keyboard?.on("keydown", this.handleKeyDown, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off("keydown", this.handleKeyDown, this);
    });
  }

  private drawBackdrop(): void {
    const arena = getArenaDefinition(this.arenaId);

    this.cameras.main.setBounds(
      0,
      0,
      GAME_CONFIG.world.width,
      GAME_CONFIG.world.height,
    );
    for (let index = 0; index < 3; index += 1) {
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
        COLORS.navy,
        0.2,
      )
      .setOrigin(0)
      .setDepth(-90);

    this.drawTerrain(arena);

    this.add
      .rectangle(0, 0, GAME_WIDTH, 150, 0x07101d, 0.76)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(900);
    this.add
      .rectangle(0, 700, GAME_WIDTH, 200, 0x07101d, 0.93)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(900)
      .setStrokeStyle(3, arena.accentColor, 0.3);

    const panelWear = this.add.graphics().setScrollFactor(0).setDepth(901);
    panelWear.lineStyle(3, 0x9a6a45, 0.38);
    panelWear.lineBetween(0, 154, GAME_WIDTH, 154);
    panelWear.lineBetween(0, 704, GAME_WIDTH, 704);
    panelWear.lineStyle(2, 0x090b0c, 0.78);
    for (let x = 22; x < GAME_WIDTH; x += 96) {
      panelWear.strokeCircle(x, 716, 4);
      panelWear.strokeCircle(x + 42, 884, 4);
    }
    panelWear.lineStyle(5, 0xd28a42, 0.42);
    for (let x = 0; x < GAME_WIDTH; x += 42) {
      panelWear.lineBetween(x, 700, x + 25, 713);
    }
  }

  private drawTerrain(arena: ArenaDefinition): void {
    const terrain = this.add.graphics().setDepth(-35);
    const firstPoint = arena.terrain[0];
    const lastPoint = arena.terrain.at(-1);

    if (!firstPoint || !lastPoint) {
      return;
    }

    terrain.fillStyle(arena.palette.groundColor, 0.98);
    terrain.lineStyle(6, arena.palette.surfaceColor, 0.86);
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

    for (let x = 150; x < GAME_CONFIG.world.width; x += 190) {
      const groundY = getTerrainHeightAt(arena.terrain, x);
      terrain.fillStyle(arena.palette.detailColor, 0.55);
      terrain.fillTriangle(
        x,
        groundY + 42,
        x + 24,
        groundY + 14,
        x + 48,
        groundY + 44,
      );
    }

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
    const playerNumber = this.currentPlayerId === "left" ? 1 : 2;
    const placement = this.draft[this.currentPlayerId];
    const validation = validatePlayerPlacement(placement);
    const arena = getArenaDefinition(this.arenaId);
    const accent =
      this.currentPlayerId === "left" ? 0x83d7ff : COLORS.coral;
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

    this.cameras.main.centerOn(baseCenterX, GAME_HEIGHT / 2);

    this.trackUi(
      this.add
        .text(70, 35, STRINGS_RU.placementEyebrow, {
          color: "#ffd166",
          fontFamily: "Arial, sans-serif",
          fontSize: "13px",
          fontStyle: "bold",
          letterSpacing: 5,
        })
        .setOrigin(0, 0.5),
    );
    this.trackUi(
      this.add
        .text(70, 78, STRINGS_RU.placementTitle(playerNumber), {
          color: COLORS.text,
          fontFamily: "Arial, sans-serif",
          fontSize: "31px",
          fontStyle: "bold",
          letterSpacing: 3,
        })
        .setOrigin(0, 0.5),
    );
    this.trackUi(
      this.add
        .text(70, 119, STRINGS_RU.placementFieldHint, {
          color: COLORS.secondary,
          fontFamily: "Arial, sans-serif",
          fontSize: "15px",
        })
        .setOrigin(0, 0.5),
    );
    this.trackUi(
      this.add
        .text(
          1530,
          62,
          this.currentPlayerId === "left"
            ? STRINGS_RU.placementEnemyDirectionRight
            : STRINGS_RU.placementEnemyDirectionLeft,
          {
            color: "#ffd166",
            fontFamily: "Arial, sans-serif",
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
          fontFamily: "Arial, sans-serif",
          fontSize: "13px",
          fontStyle: "bold",
          letterSpacing: 2,
        })
        .setOrigin(0, 0.5)
        .setBackgroundColor("rgba(7, 16, 29, 0.72)")
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
              selected ? 4 : 2,
              selected ? COLORS.mint : accent,
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
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
          });
        }
        this.track(
        this.add
            .text(x, groundY + 22, `${slotIndex + 1}`, {
            color: COLORS.text,
            fontFamily: "Arial, sans-serif",
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
          footprint.setStrokeStyle(4, COLORS.mint, 1),
        );
        hitZone.on("pointerout", () =>
          footprint.setStrokeStyle(
            selected ? 4 : 2,
            selected ? COLORS.mint : accent,
            selected ? 1 : 0.7,
          ),
        );
        hitZone.on("pointerdown", () => {
        this.draft[this.currentPlayerId].catapultSlotIndex = slotIndex;
        this.statusMessage = STRINGS_RU.placementRecommended;
        this.drawPlayerSetup();
      });
      },
    );

    const catapult = this.track(
      new CatapultView(this, playerState, true),
    );
    catapult.setDepth(24);

    GAME_CONFIG.placement.protectionSlotCenters[
      this.currentPlayerId
    ].forEach((x, slotIndex) => {
      const groundY = getTerrainHeightAt(arena.terrain, x);
      const item = placement.protections.find(
        (candidate) => candidate.slotIndex === slotIndex,
      );
      const frame = this.track(
        this.add
          .rectangle(x, groundY - 65, 76, 126, COLORS.panel, item ? 0.08 : 0.24)
          .setStrokeStyle(
            item ? 3 : 2,
            item ? COLORS.mint : COLORS.panelStroke,
            item ? 0.9 : 0.66,
          )
          .setDepth(17),
      );
      this.track(
        this.add
          .circle(x, groundY + 21, 14, COLORS.panel, 0.94)
          .setStrokeStyle(2, item ? COLORS.mint : accent, 0.82)
          .setDepth(26),
      );
      this.track(
        this.add
          .text(x, groundY + 21, `${slotIndex + 1}`, {
            color: COLORS.text,
            fontFamily: "Arial, sans-serif",
            fontSize: "11px",
            fontStyle: "bold",
          })
          .setOrigin(0.5)
          .setDepth(27),
      );
      if (item) {
        const protection = battleState.protections.find(
          (candidate) =>
            candidate.ownerId === this.currentPlayerId &&
            candidate.id.includes(`slot-${slotIndex}-`),
        );
        if (protection) {
          this.drawProtectionOnField(protection);
        }
      }
      const hitZone = this.track(
        this.add
          .rectangle(x, groundY - 65, 82, 142, accent, 0.001)
          .setInteractive({ useHandCursor: true })
          .setDepth(42),
      );
      hitZone.on("pointerover", () =>
        frame.setStrokeStyle(4, COLORS.mint, 1),
      );
      hitZone.on("pointerout", () =>
        frame.setStrokeStyle(
          item ? 3 : 2,
          item ? COLORS.mint : COLORS.panelStroke,
          item ? 0.9 : 0.66,
        ),
      );
      hitZone.on("pointerdown", () => this.applyToolToSlot(slotIndex));
    });

    this.trackUi(
      this.add
        .text(70, 725, STRINGS_RU.placementProtectionLabel, {
          color: COLORS.text,
          fontFamily: "Arial, sans-serif",
          fontSize: "13px",
          fontStyle: "bold",
          letterSpacing: 1,
        })
        .setOrigin(0, 0.5),
    );
    this.trackUi(
      this.add
        .text(
          1530,
          725,
          STRINGS_RU.placementBudget(
            validation.spentBudget,
            validation.remainingBudget,
          ),
          {
            color:
              validation.remainingBudget >= 0 ? "#7ee2a8" : "#ff8066",
            fontFamily: "Arial, sans-serif",
            fontSize: "15px",
            fontStyle: "bold",
          },
        )
        .setOrigin(1, 0.5),
    );

    const tools: readonly {
      type: PlacementTool;
      label: string;
      x: number;
      color: number;
    }[] = [
      { type: "wood", label: STRINGS_RU.placementWood, x: 170, color: 0x5b4130 },
      { type: "net", label: STRINGS_RU.placementNet, x: 390, color: 0x384247 },
      { type: "metal", label: STRINGS_RU.placementMetal, x: 610, color: 0x4a4f52 },
      { type: "erase", label: STRINGS_RU.placementErase, x: 830, color: 0x70463c },
    ];
    tools.forEach((tool) => {
      const selected = this.selectedTool === tool.type;
      const button = this.trackUi(
        this.add
          .rectangle(tool.x, 775, 198, 56, selected ? tool.color : 0x263247, selected ? 1 : 0.92)
          .setStrokeStyle(selected ? 4 : 2, selected ? COLORS.mint : COLORS.panelStroke, selected ? 1 : 0.58)
          .setInteractive({ useHandCursor: true }),
      );
      this.trackUi(
        this.add
          .text(tool.x, 775, tool.label, {
            color: COLORS.text,
            fontFamily: "Arial, sans-serif",
            fontSize: "14px",
            fontStyle: "bold",
          })
          .setOrigin(0.5),
      );
      button.on("pointerdown", () => {
        this.selectedTool = tool.type;
        this.drawPlayerSetup();
      });
    });

    this.trackUi(
      this.add
        .text(70, 845, this.statusMessage, {
          color: this.statusMessage === STRINGS_RU.placementRecommended ? COLORS.secondary : "#ff9b86",
          fontFamily: "Arial, sans-serif",
          fontSize: "14px",
        })
        .setOrigin(0, 0.5),
    );
    this.createActionButton(1220, 820, 190, STRINGS_RU.placementReset, 0x263247, () => this.resetCurrentPlayer());
    this.createActionButton(1430, 820, 190, STRINGS_RU.placementReady, COLORS.mint, () => this.confirmCurrentPlayer(), "#14231c");
  }

  private drawProtectionOnField(
    protection: ReturnType<typeof createInitialBattleState>["protections"][number],
  ): void {
    const graphics = this.track(this.add.graphics().setDepth(22));
    drawProtectionBody(graphics, protection);
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
      alpha: 0.12,
      duration: 1100,
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
      Phaser.GameObjects.Components.Depth,
  >(object: T): T {
    object.setScrollFactor(0).setDepth(1000);
    return this.track(object);
  }

  private createActionButton(
    x: number,
    y: number,
    width: number,
    label: string,
    color: number,
    onClick: () => void,
    textColor: string = "#f4f7ff",
  ): void {
    const button = this.trackUi(this.add.rectangle(x, y, width, 58, color, 1).setStrokeStyle(3, 0xd6e4f4, 0.65).setInteractive({ useHandCursor: true }));
    this.trackUi(this.add.text(x, y, label, { color: textColor, fontFamily: "Arial, sans-serif", fontSize: "15px", fontStyle: "bold", letterSpacing: 1 }).setOrigin(0.5));
    button.on("pointerover", () => button.setScale(1.03));
    button.on("pointerout", () => button.setScale(1));
    button.on("pointerdown", onClick);
  }

  private applyToolToSlot(slotIndex: number): void {
    const placement = this.draft[this.currentPlayerId];
    const withoutSlot = placement.protections.filter(
      (item) => item.slotIndex !== slotIndex,
    );

    if (this.selectedTool === "erase") {
      placement.protections = withoutSlot;
      this.statusMessage = STRINGS_RU.placementRecommended;
      this.drawPlayerSetup();
      return;
    }

    const candidate: PlayerPlacement = {
      ...placement,
      protections: [
        ...withoutSlot,
        { slotIndex, type: this.selectedTool },
      ],
    };
    const validation = validatePlayerPlacement(candidate);

    if (!validation.valid) {
      this.statusMessage =
        validation.reason === "over-budget"
          ? STRINGS_RU.placementErrorBudget
          : validation.reason === "too-many-metal"
            ? STRINGS_RU.placementErrorMetal
            : STRINGS_RU.placementErrorCount;
      this.drawPlayerSetup();
      return;
    }

    this.draft[this.currentPlayerId] = candidate;
    this.statusMessage = STRINGS_RU.placementRecommended;
    this.drawPlayerSetup();
  }

  private resetCurrentPlayer(): void {
    this.draft[this.currentPlayerId] = {
      catapultSlotIndex: 1,
      protections: [],
    };
    this.statusMessage = STRINGS_RU.placementRecommended;
    this.drawPlayerSetup();
  }

  private confirmCurrentPlayer(): void {
    if (this.currentPlayerId === "left") {
      this.showHandoff();
      return;
    }

    this.scene.start("BattleScene", {
      arenaId: this.arenaId,
      placement: cloneMatchPlacement(this.draft),
    });
  }

  private showHandoff(): void {
    const cover = this.add.container(0, 0).setDepth(2000);
    const background = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x07101d, 0.99).setOrigin(0);
    const halo = this.add.circle(800, 390, 210, 0x263b62, 0.56).setBlendMode(Phaser.BlendModes.ADD);
    const title = this.add.text(800, 330, STRINGS_RU.placementHandoffTitle, { color: "#ffd166", fontFamily: "Arial, sans-serif", fontSize: "34px", fontStyle: "bold", letterSpacing: 3 }).setOrigin(0.5);
    const message = this.add.text(800, 408, STRINGS_RU.placementHandoffMessage, { color: COLORS.text, fontFamily: "Arial, sans-serif", fontSize: "19px", align: "center", wordWrap: { width: 620 } }).setOrigin(0.5);
    const button = this.add.rectangle(800, 530, 390, 68, COLORS.mint, 1).setStrokeStyle(3, 0xd7ffe8, 0.85).setInteractive({ useHandCursor: true });
    const label = this.add.text(800, 530, STRINGS_RU.placementHandoffButton, { color: "#14231c", fontFamily: "Arial, sans-serif", fontSize: "17px", fontStyle: "bold", letterSpacing: 1 }).setOrigin(0.5);
    cover.add([background, halo, title, message, button, label]);
    button.on("pointerdown", () => {
      cover.destroy(true);
      this.currentPlayerId = "right";
      this.selectedTool = "wood";
      this.statusMessage = STRINGS_RU.placementRecommended;
      this.drawPlayerSetup();
    });
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.code === "Escape") {
      this.scene.start("MenuScene");
    }
  }
}
