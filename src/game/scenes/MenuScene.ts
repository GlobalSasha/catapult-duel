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

const COLORS = {
  navy: 0x0b1220,
  panel: 0x101927,
  panelStroke: 0x7188a9,
  amber: 0xffd166,
  mint: 0x7ee2a8,
  primaryText: "#f7f4ec",
  secondaryText: "#b9c7db",
  buttonText: "#14231c",
} as const;

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
      .setTint(0x6b7890);

    this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.navy, 0.5)
      .setOrigin(0);
    this.add
      .rectangle(0, 0, GAME_WIDTH, 172, COLORS.navy, 0.8)
      .setOrigin(0);

    this.drawHeader();
    this.drawNavigation();
    this.drawArenaCards();
    this.drawStartButton();
    this.refreshSelection();
    sharpenSceneText(this);

    this.input.keyboard?.on("keydown", this.handleKeyDown, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off("keydown", this.handleKeyDown, this);
    });
  }

  private drawHeader(): void {
    this.add
      .text(GAME_WIDTH / 2, 18, STRINGS_RU.menuEyebrow, {
        color: "#ffd166",
        fontFamily: "Arial, sans-serif",
        fontSize: "12px",
        fontStyle: "bold",
        letterSpacing: 4,
      })
      .setOrigin(0.5, 0);

    this.add
      .text(GAME_WIDTH / 2, 42, STRINGS_RU.gameTitle, {
        color: COLORS.primaryText,
        fontFamily: "Arial, sans-serif",
        fontSize: "38px",
        fontStyle: "bold",
        letterSpacing: 5,
        stroke: "#0b1220",
        strokeThickness: 6,
      })
      .setOrigin(0.5, 0);

    this.add
      .text(GAME_WIDTH / 2, 92, STRINGS_RU.chooseArenaTitle, {
        color: COLORS.primaryText,
        fontFamily: "Arial, sans-serif",
        fontSize: "18px",
        fontStyle: "bold",
        letterSpacing: 3,
      })
      .setOrigin(0.5, 0);

    this.add
      .text(GAME_WIDTH / 2, 124, STRINGS_RU.chooseArenaHint, {
        color: COLORS.secondaryText,
        fontFamily: "Arial, sans-serif",
        fontSize: "13px",
      })
      .setOrigin(0.5, 0);

    this.add
      .text(GAME_WIDTH / 2, 151, "ДЕНЬ · ЗАКАТ · СУМЕРКИ · НОЧЬ · 12 РАЗНЫХ РЕЛЬЕФОВ", {
        color: "#f0d18b",
        fontFamily: "Arial, sans-serif",
        fontSize: "10px",
        fontStyle: "bold",
        letterSpacing: 2,
      })
      .setOrigin(0.5, 0);
  }

  private drawNavigation(): void {
    const back = this.add
      .rectangle(92, 74, 134, 44, COLORS.panel, 0.96)
      .setStrokeStyle(2, COLORS.panelStroke, 0.75)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(92, 74, "←  МЕНЮ", {
        color: COLORS.primaryText,
        fontFamily: "Arial, sans-serif",
        fontSize: "11px",
        fontStyle: "bold",
        letterSpacing: 1,
      })
      .setOrigin(0.5);
    const modeLabel =
      this.matchSettings.mode === "ai"
        ? `ПРОТИВ AI · ${STRINGS_RU.aiDifficultyName(this.matchSettings.aiDifficulty)}`
        : "ДВА ИГРОКА";
    this.add
      .text(1510, 61, `${this.matchSettings.playerNames.left}\n${modeLabel}`, {
        color: "#d8e4f2",
        fontFamily: "Arial, sans-serif",
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

    this.add
      .rectangle(x + 6, y + 8, 344, 174, 0x000000, 0.42)
      .setOrigin(0.5);

    const border = this.add
      .rectangle(x, y, 344, 174, COLORS.panel, 0.98)
      .setStrokeStyle(2, COLORS.panelStroke, 0.7)
      .setInteractive({ useHandCursor: true });

    this.add
      .image(x, y - 27, arena.textureKey)
      .setDisplaySize(332, 112);

    this.add
      .rectangle(x, y + 49, 332, 56, COLORS.panel, 0.97)
      .setOrigin(0.5);

    this.add
      .text(x - 154, y + 28, arena.displayName, {
        color: arena.accentTextColor,
        fontFamily: "Arial, sans-serif",
        fontSize: "12px",
        fontStyle: "bold",
        letterSpacing: 0.6,
      })
      .setOrigin(0, 0.5);

    this.add
      .text(x - 154, y + 50, arena.description, {
        color: COLORS.secondaryText,
        fontFamily: "Arial, sans-serif",
        fontSize: "9px",
      })
      .setOrigin(0, 0.5);

    const timeBackground = this.add
      .rectangle(0, 0, 126, 22, 0x111723, 0.9)
      .setStrokeStyle(1, arena.accentColor, 0.85);
    const timeText = this.add
      .text(0, 0, arena.timeLabel, {
        color: arena.accentTextColor,
        fontFamily: "Arial, sans-serif",
        fontSize: "8px",
        fontStyle: "bold",
        letterSpacing: 0.7,
      })
      .setOrigin(0.5);
    this.add.container(x + 101, y - 72, [timeBackground, timeText]);

    const badgeBackground = this.add
      .rectangle(0, 0, 92, 23, COLORS.amber, 1)
      .setStrokeStyle(1, 0xffe7a6, 0.9);
    const badgeText = this.add
      .text(0, 0, STRINGS_RU.selectedArena, {
        color: "#2a2517",
        fontFamily: "Arial, sans-serif",
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
        border.setStrokeStyle(4, arena.accentColor, 0.9);
      }
    });
    border.on("pointerout", () => {
      this.refreshSelection();
    });

    this.cards.set(arena.id, { border, badge });
  }

  private drawStartButton(): void {
    const shadow = this.add.rectangle(
      GAME_WIDTH / 2 + 6,
      845,
      326,
      52,
      0x000000,
      0.42,
    );
    const button = this.add
      .rectangle(GAME_WIDTH / 2, 839, 326, 52, COLORS.mint, 1)
      .setStrokeStyle(2, 0xd4ffe6, 0.9);
    const hitZone = this.add
      .rectangle(GAME_WIDTH / 2, 839, 356, 72, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(GAME_WIDTH / 2, 839, STRINGS_RU.startBattleButton, {
        color: COLORS.buttonText,
        fontFamily: "Arial, sans-serif",
        fontSize: "16px",
        fontStyle: "bold",
        letterSpacing: 1.5,
      })
      .setOrigin(0.5);

    hitZone.on("pointerover", () => {
      button.setScale(1.025);
      shadow.setScale(1.025);
    });
    hitZone.on("pointerout", () => {
      button.setScale(1);
      shadow.setScale(1);
    });
    hitZone.on("pointerdown", this.startBattle, this);
  }

  private handleKeyDown(event: KeyboardEvent): void {
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
      const cardArena = getArenaDefinition(id);

      card.border.setStrokeStyle(
        selected ? 5 : 2,
        selected ? cardArena.accentColor : COLORS.panelStroke,
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
        this.scene.start("PlacementScene", {
          arenaId: this.selectedArenaId,
        });
      },
    );
  }
}
