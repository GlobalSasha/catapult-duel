import * as Phaser from "phaser";

import {
  ARENAS,
  DEFAULT_ARENA_ID,
  getArenaDefinition,
  type ArenaDefinition,
  type ArenaId,
} from "../arena/arenaCatalog";
import { GAME_HEIGHT, GAME_WIDTH } from "../gameDimensions";
import { STRINGS_RU } from "../i18n/strings.ru";
import {
  MATCH_SETTINGS_REGISTRY_KEY,
  readMatchSettings,
  type MatchSettings,
} from "../core/matchSession";
import { configure2KCamera, sharpenSceneText } from "../rendering";
import { RETRO_UI } from "../ui/retroTheme";
import { musicController } from "../audio/MusicController";

const COLORS = {
  navy: RETRO_UI.colors.ink,
  panel: RETRO_UI.colors.panel,
  panelStroke: RETRO_UI.colors.border,
  amber: RETRO_UI.colors.orange,
  mint: RETRO_UI.colors.cyan,
  primaryText: RETRO_UI.text.primary,
  secondaryText: RETRO_UI.text.secondary,
  buttonText: RETRO_UI.text.ink,
} as const;

const DISPLAY_FONT = RETRO_UI.font.display;
const UI_FONT = RETRO_UI.font.ui;

interface ArenaCard {
  border: Phaser.GameObjects.Rectangle;
  badge: Phaser.GameObjects.Container;
}

export class MenuScene extends Phaser.Scene {
  private selectedArenaId: ArenaId = DEFAULT_ARENA_ID;
  private background!: Phaser.GameObjects.Image;
  private readonly cards = new Map<ArenaId, ArenaCard>();
  private battleStarted = false;
  private matchSettings: MatchSettings = readMatchSettings(undefined);

  constructor() {
    super("MenuScene");
  }

  create(): void {
    configure2KCamera(this);
    musicController.setTheme("menu");
    this.matchSettings = readMatchSettings(
      this.registry.get(MATCH_SETTINGS_REGISTRY_KEY),
    );
    this.selectedArenaId = DEFAULT_ARENA_ID;
    this.battleStarted = false;
    this.cards.clear();

    this.background = this.add
      .image(0, 0, getArenaDefinition(this.selectedArenaId).textureKey)
      .setOrigin(0)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setTint(0xc77953);

    this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.navy, 0.54)
      .setOrigin(0);
    const atmosphere = this.add.graphics();
    atmosphere.fillGradientStyle(
      RETRO_UI.colors.orangeDark,
      RETRO_UI.colors.orangeDark,
      RETRO_UI.colors.ink,
      RETRO_UI.colors.ink,
      0.28,
      0.28,
      0.12,
      0.12,
    );
    atmosphere.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.add
      .rectangle(0, 0, GAME_WIDTH, 172, COLORS.navy, 0.9)
      .setOrigin(0);
    this.add.rectangle(0, 168, GAME_WIDTH, 4, COLORS.amber, 0.9).setOrigin(0);

    this.drawHeader();
    this.drawNavigation();
    this.drawArenaCards();
    this.drawStartButton();
    this.refreshSelection();
    sharpenSceneText(this);
    this.cameras.main.fadeIn(300, 8, 7, 5);

    this.input.keyboard?.on("keydown", this.handleKeyDown, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off("keydown", this.handleKeyDown, this);
    });
  }

  private drawHeader(): void {
    this.add
      .text(GAME_WIDTH / 2, 18, STRINGS_RU.menuEyebrow, {
        color: RETRO_UI.text.cyan,
        fontFamily: UI_FONT,
        fontSize: "12px",
        fontStyle: "bold",
        letterSpacing: 4,
      })
      .setOrigin(0.5, 0);

    this.add
      .text(GAME_WIDTH / 2, 42, STRINGS_RU.gameTitle, {
        color: RETRO_UI.text.orange,
        fontFamily: DISPLAY_FONT,
        fontSize: "38px",
        fontStyle: "bold",
        letterSpacing: 5,
        stroke: RETRO_UI.text.ink,
        strokeThickness: 8,
      })
      .setOrigin(0.5, 0);

    this.add
      .text(GAME_WIDTH / 2, 92, STRINGS_RU.chooseArenaTitle, {
        color: COLORS.primaryText,
        fontFamily: DISPLAY_FONT,
        fontSize: "18px",
        fontStyle: "bold",
        letterSpacing: 3,
      })
      .setOrigin(0.5, 0);

    this.add
      .text(GAME_WIDTH / 2, 124, STRINGS_RU.chooseArenaHint, {
        color: COLORS.secondaryText,
        fontFamily: UI_FONT,
        fontSize: "13px",
      })
      .setOrigin(0.5, 0);

    this.add
      .text(GAME_WIDTH / 2, 151, "ДЕНЬ · ЗАКАТ · СУМЕРКИ · НОЧЬ · 12 РАЗНЫХ РЕЛЬЕФОВ", {
        color: RETRO_UI.text.cyan,
        fontFamily: UI_FONT,
        fontSize: "10px",
        fontStyle: "bold",
        letterSpacing: 2,
      })
      .setOrigin(0.5, 0);
  }

  private drawNavigation(): void {
    const back = this.add
      .rectangle(92, 74, 134, 44, COLORS.panel, 0.96)
      .setStrokeStyle(3, RETRO_UI.colors.cyan, 0.9)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(92, 74, "←  МЕНЮ", {
        color: COLORS.primaryText,
        fontFamily: UI_FONT,
        fontSize: "11px",
        fontStyle: "bold",
        letterSpacing: 1,
      })
      .setOrigin(0.5);
    const modeLabel =
      this.matchSettings.mode === "ai"
        ? `ПРОТИВ ${this.matchSettings.playerNames.right} · ${STRINGS_RU.aiDifficultyName(this.matchSettings.aiDifficulty)}`
        : "ДВА ИГРОКА";
    this.add
      .text(1510, 61, `${this.matchSettings.playerNames.left}\n${modeLabel}`, {
        color: RETRO_UI.text.primary,
        fontFamily: UI_FONT,
        fontSize: "11px",
        fontStyle: "bold",
        align: "right",
        lineSpacing: 5,
      })
      .setOrigin(1, 0);
    back.on("pointerdown", () => this.scene.start("HomeScene"));
  }

  private drawArenaCards(): void {
    ARENAS.forEach((arena, index) => {
      this.drawArenaCard(arena, index);
    });
  }

  private drawArenaCard(arena: ArenaDefinition, index: number): void {
    const column = index % 4;
    const row = Math.floor(index / 4);
    const x = 236 + column * 376;
    const y = 267 + row * 190;

    const border = this.add
      .rectangle(x, y, 344, 174, COLORS.panel, 0.98)
      .setStrokeStyle(3, COLORS.panelStroke, 0.85)
      .setInteractive({ useHandCursor: true });

    this.add
      .image(x, y - 27, arena.textureKey)
      .setDisplaySize(328, 108);

    this.add
      .rectangle(x, y + 49, 328, 56, COLORS.panel, 0.98)
      .setOrigin(0.5);

    this.add
      .text(x - 154, y + 28, arena.displayName, {
        color: arena.accentTextColor,
        fontFamily: UI_FONT,
        fontSize: "12px",
        fontStyle: "bold",
        letterSpacing: 0.6,
      })
      .setOrigin(0, 0.5);

    this.add
      .text(x - 154, y + 50, arena.description, {
        color: COLORS.secondaryText,
        fontFamily: UI_FONT,
        fontSize: "10px",
      })
      .setOrigin(0, 0.5);

    const timeBackground = this.add
      .rectangle(0, 0, 126, 22, RETRO_UI.colors.inkSoft, 0.96)
      .setStrokeStyle(2, RETRO_UI.colors.cyan, 0.9);
    const timeText = this.add
      .text(0, 0, arena.timeLabel, {
        color: arena.accentTextColor,
        fontFamily: UI_FONT,
        fontSize: "8px",
        fontStyle: "bold",
        letterSpacing: 0.7,
      })
      .setOrigin(0.5);
    this.add.container(x + 101, y - 72, [timeBackground, timeText]);

    const badgeBackground = this.add
      .rectangle(0, 0, 92, 23, COLORS.amber, 1)
      .setStrokeStyle(2, RETRO_UI.colors.cream, 0.9);
    const badgeText = this.add
      .text(0, 0, STRINGS_RU.selectedArena, {
        color: RETRO_UI.text.ink,
        fontFamily: UI_FONT,
        fontSize: "8px",
        fontStyle: "bold",
        letterSpacing: 0.6,
      })
      .setOrigin(0.5);
    const badge = this.add.container(x - 119, y - 72, [
      badgeBackground,
      badgeText,
    ]);

    border.on("pointerdown", () => {
      this.selectArena(arena.id);
    });
    border.on("pointerover", () => {
      if (arena.id !== this.selectedArenaId) {
        border.setStrokeStyle(4, RETRO_UI.colors.cyan, 0.9);
      }
    });
    border.on("pointerout", () => {
      this.refreshSelection();
    });

    this.cards.set(arena.id, { border, badge });
  }

  private drawStartButton(): void {
    const button = this.add
      .rectangle(GAME_WIDTH / 2, 839, 326, 52, COLORS.amber, 1)
      .setStrokeStyle(4, RETRO_UI.colors.ink, 1);
    const hitZone = this.add
      .rectangle(GAME_WIDTH / 2, 839, 356, 72, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(GAME_WIDTH / 2, 839, STRINGS_RU.startBattleButton, {
        color: COLORS.buttonText,
        fontFamily: UI_FONT,
        fontSize: "16px",
        fontStyle: "bold",
        letterSpacing: 1.5,
      })
      .setOrigin(0.5);

    hitZone.on("pointerover", () => {
      button.setFillStyle(RETRO_UI.colors.cyan, 1);
    });
    hitZone.on("pointerout", () => {
      button.setFillStyle(COLORS.amber, 1);
    });
    hitZone.on("pointerdown", this.startBattle, this);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.target instanceof HTMLElement && event.target.closest("button, input")) {
      return;
    }

    if (event.repeat) {
      return;
    }

    if (event.code === "Escape") {
      this.scene.start("HomeScene");
      return;
    }

    if (event.code === "ArrowLeft") {
      this.selectRelative(-1);
      return;
    }

    if (event.code === "ArrowRight") {
      this.selectRelative(1);
      return;
    }

    if (event.code === "ArrowUp") {
      this.selectRelative(-4);
      return;
    }

    if (event.code === "ArrowDown") {
      this.selectRelative(4);
      return;
    }

    if (event.code === "Enter" || event.code === "Space") {
      event.preventDefault();
      this.startBattle();
    }
  }

  private selectRelative(offset: number): void {
    const currentIndex = ARENAS.findIndex(
      ({ id }) => id === this.selectedArenaId,
    );
    const nextIndex =
      (currentIndex + offset + ARENAS.length) % ARENAS.length;
    const nextArena = ARENAS[nextIndex];

    if (nextArena) {
      this.selectArena(nextArena.id);
    }
  }

  private selectArena(id: ArenaId): void {
    if (id === this.selectedArenaId) {
      return;
    }

    this.selectedArenaId = id;
    this.refreshSelection();
  }

  private refreshSelection(): void {
    const arena = getArenaDefinition(this.selectedArenaId);

    this.background.setTexture(arena.textureKey);
    this.cards.forEach((card, id) => {
      const selected = id === this.selectedArenaId;
      card.border.setStrokeStyle(
        selected ? 5 : 3,
        selected ? RETRO_UI.colors.cyan : COLORS.panelStroke,
        selected ? 1 : 0.7,
      );
      card.badge.setVisible(selected);
    });
  }

  private startBattle(): void {
    if (this.battleStarted) {
      return;
    }

    this.battleStarted = true;
    this.cameras.main.fadeOut(180, 6, 10, 18);
    this.cameras.main.once(
      Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
      () => {
        this.scene.start("ArenaLoadingScene", {
          arenaId: this.selectedArenaId,
        });
      },
    );
  }
}
