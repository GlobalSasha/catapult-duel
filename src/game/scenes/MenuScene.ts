import * as Phaser from "phaser";

import {
  ARENAS,
  DEFAULT_ARENA_ID,
  getArenaDefinition,
  type ArenaId,
} from "../arena/arenaCatalog";
import { GAME_HEIGHT, GAME_WIDTH } from "../gameDimensions";
import { STRINGS_RU } from "../i18n/strings.ru";

const COLORS = {
  navy: 0x0b1220,
  panel: 0x101927,
  panelStroke: 0x7f99bd,
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

  constructor() {
    super("MenuScene");
  }

  create(): void {
    this.selectedArenaId = DEFAULT_ARENA_ID;
    this.battleStarted = false;
    this.cards.clear();

    this.background = this.add
      .image(0, 0, getArenaDefinition(this.selectedArenaId).textureKey)
      .setOrigin(0)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setTint(0x738099);

    this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.navy, 0.52)
      .setOrigin(0);
    this.add
      .rectangle(0, 0, GAME_WIDTH, 255, COLORS.navy, 0.68)
      .setOrigin(0);

    this.drawHeader();
    this.drawArenaCards();
    this.drawStartButton();
    this.refreshSelection();

    this.input.keyboard?.on("keydown", this.handleKeyDown, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off("keydown", this.handleKeyDown, this);
    });
  }

  private drawHeader(): void {
    this.add
      .text(GAME_WIDTH / 2, 52, STRINGS_RU.menuEyebrow, {
        color: "#ffd166",
        fontFamily: "Arial, sans-serif",
        fontSize: "16px",
        fontStyle: "bold",
        letterSpacing: 5,
      })
      .setOrigin(0.5, 0);

    this.add
      .text(GAME_WIDTH / 2, 86, STRINGS_RU.gameTitle, {
        color: COLORS.primaryText,
        fontFamily: "Arial, sans-serif",
        fontSize: "58px",
        fontStyle: "bold",
        letterSpacing: 6,
        stroke: "#0b1220",
        strokeThickness: 8,
      })
      .setOrigin(0.5, 0);

    this.add
      .text(GAME_WIDTH / 2, 162, STRINGS_RU.menuSubtitle, {
        color: COLORS.secondaryText,
        fontFamily: "Arial, sans-serif",
        fontSize: "19px",
        align: "center",
      })
      .setOrigin(0.5, 0);

    this.add
      .text(GAME_WIDTH / 2, 222, STRINGS_RU.chooseArenaTitle, {
        color: COLORS.primaryText,
        fontFamily: "Arial, sans-serif",
        fontSize: "24px",
        fontStyle: "bold",
        letterSpacing: 3,
      })
      .setOrigin(0.5, 0);

    this.add
      .text(GAME_WIDTH / 2, 257, STRINGS_RU.chooseArenaHint, {
        color: COLORS.secondaryText,
        fontFamily: "Arial, sans-serif",
        fontSize: "15px",
      })
      .setOrigin(0.5, 0);
  }

  private drawArenaCards(): void {
    ARENAS.forEach((arena, index) => {
      const x = index === 0 ? 450 : 1150;
      const y = 480;

      this.add
        .rectangle(x + 10, y + 14, 578, 354, 0x000000, 0.38)
        .setOrigin(0.5);

      const border = this.add
        .rectangle(x, y, 578, 354, COLORS.panel, 0.98)
        .setStrokeStyle(3, COLORS.panelStroke, 0.72)
        .setInteractive({ useHandCursor: true });

      this.add
        .image(x, y - 44, arena.textureKey)
        .setDisplaySize(558, 250)
        .setCrop(0, 35, 1672, 780);

      this.add
        .rectangle(x, y + 119, 558, 96, COLORS.panel, 0.98)
        .setOrigin(0.5);

      this.add
        .text(x - 252, y + 91, this.getArenaName(arena.id), {
          color: arena.accentTextColor,
          fontFamily: "Arial, sans-serif",
          fontSize: "20px",
          fontStyle: "bold",
          letterSpacing: 1,
        })
        .setOrigin(0, 0.5);

      this.add
        .text(x - 252, y + 126, this.getArenaDescription(arena.id), {
          color: COLORS.secondaryText,
          fontFamily: "Arial, sans-serif",
          fontSize: "15px",
        })
        .setOrigin(0, 0.5);

      const badgeBackground = this.add
        .rectangle(0, 0, 120, 34, COLORS.amber, 1)
        .setStrokeStyle(2, 0xffe7a6, 0.9);
      const badgeText = this.add
        .text(0, 0, STRINGS_RU.selectedArena, {
          color: "#2a2517",
          fontFamily: "Arial, sans-serif",
          fontSize: "13px",
          fontStyle: "bold",
          letterSpacing: 1,
        })
        .setOrigin(0.5);
      const badge = this.add.container(x + 208, y - 144, [
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
    });
  }

  private drawStartButton(): void {
    const shadow = this.add.rectangle(
      GAME_WIDTH / 2 + 8,
      781,
      340,
      72,
      0x000000,
      0.38,
    );
    const button = this.add
      .rectangle(GAME_WIDTH / 2, 773, 340, 72, COLORS.mint, 1)
      .setStrokeStyle(3, 0xd4ffe6, 0.9);
    const hitZone = this.add
      .rectangle(
        GAME_WIDTH / 2,
        773,
        372,
        112,
        0xffffff,
        0.001,
      )
      .setInteractive({ useHandCursor: true });

    this.add
      .text(GAME_WIDTH / 2, 773, STRINGS_RU.startBattleButton, {
        color: COLORS.buttonText,
        fontFamily: "Arial, sans-serif",
        fontSize: "21px",
        fontStyle: "bold",
        letterSpacing: 2,
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 829, STRINGS_RU.startBattleHint, {
        color: COLORS.secondaryText,
        fontFamily: "Arial, sans-serif",
        fontSize: "14px",
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

    if (event.code === "ArrowLeft") {
      this.selectArena("highlands");
      return;
    }

    if (event.code === "ArrowRight") {
      this.selectArena("canyon");
      return;
    }

    if (event.code === "Enter" || event.code === "Space") {
      event.preventDefault();
      this.startBattle();
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
        selected ? 6 : 3,
        selected ? cardArena.accentColor : COLORS.panelStroke,
        selected ? 1 : 0.72,
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

  private getArenaName(id: ArenaId): string {
    return id === "highlands"
      ? STRINGS_RU.arenaHighlandsName
      : STRINGS_RU.arenaCanyonName;
  }

  private getArenaDescription(id: ArenaId): string {
    return id === "highlands"
      ? STRINGS_RU.arenaHighlandsDescription
      : STRINGS_RU.arenaCanyonDescription;
  }
}
