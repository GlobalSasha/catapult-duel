import * as Phaser from "phaser";

import {
  MATCH_SETTINGS_REGISTRY_KEY,
  createDefaultMatchSettings,
  getRatingForPlayer,
  getRatingLeaderboard,
  loadPlayerProfile,
  normalizePlayerName,
  saveMatchSettings,
  type AiDifficulty,
  type GameMode,
  type MatchSettings,
} from "../core/matchSession";
import { GAME_HEIGHT, GAME_WIDTH } from "../gameDimensions";
import { configure2KCamera, sharpenSceneText } from "../rendering";

const COLORS = {
  navy: 0x07101d,
  panel: 0x101927,
  panelBright: 0x172538,
  stroke: 0x617b9e,
  amber: 0xffd166,
  mint: 0x7ee2a8,
  cyan: 0x83d7ff,
  coral: 0xff9d82,
} as const;

interface TextFieldView {
  panel: Phaser.GameObjects.Rectangle;
  value: Phaser.GameObjects.Text;
  side: "left" | "right";
}

export class HomeScene extends Phaser.Scene {
  private settings: MatchSettings = createDefaultMatchSettings();
  private activeField: "left" | "right" | null = null;
  private readonly fields = new Map<"left" | "right", TextFieldView>();
  private readonly modeButtons = new Map<GameMode, Phaser.GameObjects.Rectangle>();
  private readonly difficultyButtons = new Map<AiDifficulty, Phaser.GameObjects.Rectangle>();
  private ratingText!: Phaser.GameObjects.Text;
  private leaderboardText!: Phaser.GameObjects.Text;
  private secondPlayerLabel!: Phaser.GameObjects.Text;
  private difficultyGroup!: Phaser.GameObjects.Container;
  private navigationStarted = false;

  constructor() {
    super("HomeScene");
  }

  create(): void {
    configure2KCamera(this);
    const profile = loadPlayerProfile();
    this.settings = profile.settings;
    this.navigationStarted = false;
    this.activeField = null;
    this.fields.clear();
    this.modeButtons.clear();
    this.difficultyButtons.clear();

    this.drawBackdrop();
    this.drawBrand();
    this.drawSetupPanel();
    this.drawRatingPanel();
    this.drawStartButton();
    this.refresh();
    sharpenSceneText(this);

    this.input.keyboard?.on("keydown", this.handleKeyDown, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off("keydown", this.handleKeyDown, this);
    });
  }

  private drawBackdrop(): void {
    this.add
      .image(0, 0, "arena-highlands")
      .setOrigin(0)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setTint(0x72809b);
    this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.navy, 0.66)
      .setOrigin(0);
    this.add
      .rectangle(0, 0, GAME_WIDTH, 185, COLORS.navy, 0.83)
      .setOrigin(0);

    for (let index = 0; index < 24; index += 1) {
      const mote = this.add
        .circle(
          40 + ((index * 173) % 1540),
          185 + ((index * 97) % 650),
          1.5 + (index % 3),
          index % 2 === 0 ? COLORS.amber : COLORS.cyan,
          0.16 + (index % 4) * 0.04,
        )
        .setDepth(1);
      this.tweens.add({
        targets: mote,
        y: mote.y - 24 - (index % 5) * 7,
        alpha: 0.04,
        duration: 2400 + (index % 7) * 380,
        delay: index * 95,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
  }

  private drawBrand(): void {
    this.add
      .text(76, 36, "ПУСТОШИ · АРТИЛЛЕРИЙСКАЯ ЛИГА", {
        color: "#ffd166",
        fontFamily: "Arial, sans-serif",
        fontSize: "13px",
        fontStyle: "bold",
        letterSpacing: 4,
      })
      .setDepth(2);
    this.add
      .text(76, 66, "CATAPULT DUEL", {
        color: "#f7f4ec",
        fontFamily: "Arial, sans-serif",
        fontSize: "52px",
        fontStyle: "bold",
        letterSpacing: 6,
        stroke: "#07101d",
        strokeThickness: 7,
      })
      .setDepth(2);
    this.add
      .text(80, 132, "Соберите бойцов, выберите противника и войдите на одну из 12 арен", {
        color: "#b9c7db",
        fontFamily: "Arial, sans-serif",
        fontSize: "16px",
      })
      .setDepth(2);
    this.add
      .text(1518, 70, "2K", {
        color: "#7ee2a8",
        fontFamily: "Arial, sans-serif",
        fontSize: "30px",
        fontStyle: "bold",
      })
      .setOrigin(1, 0)
      .setDepth(2);
    this.add
      .text(1518, 108, "2560 × 1440 · HIGH DETAIL", {
        color: "#9fb2ce",
        fontFamily: "Arial, sans-serif",
        fontSize: "10px",
        fontStyle: "bold",
        letterSpacing: 1.2,
      })
      .setOrigin(1, 0)
      .setDepth(2);
  }

  private drawSetupPanel(): void {
    const panel = this.add.graphics().setDepth(2);
    panel.fillStyle(COLORS.panel, 0.96);
    panel.fillRoundedRect(70, 210, 950, 590, 24);
    panel.lineStyle(2, COLORS.stroke, 0.72);
    panel.strokeRoundedRect(70, 210, 950, 590, 24);

    this.add
      .text(110, 244, "НОВАЯ ИГРА", {
        color: "#f7f4ec",
        fontFamily: "Arial, sans-serif",
        fontSize: "24px",
        fontStyle: "bold",
        letterSpacing: 3,
      })
      .setDepth(3);
    this.add
      .text(110, 285, "РЕЖИМ БОЯ", {
        color: "#9fb2ce",
        fontFamily: "Arial, sans-serif",
        fontSize: "11px",
        fontStyle: "bold",
        letterSpacing: 2,
      })
      .setDepth(3);

    this.createModeButton("ai", 110, 320, 410, "ПРОТИВ AI", "Одиночная рейтинговая дуэль");
    this.createModeButton("local", 540, 320, 410, "ДВА ИГРОКА", "По очереди на одном устройстве");

    this.add
      .text(110, 426, "ИМЕНА БОЙЦОВ", {
        color: "#9fb2ce",
        fontFamily: "Arial, sans-serif",
        fontSize: "11px",
        fontStyle: "bold",
        letterSpacing: 2,
      })
      .setDepth(3);

    this.createNameField("left", 110, 461, "ИГРОК 1");
    this.secondPlayerLabel = this.createNameField(
      "right",
      540,
      461,
      "ИГРОК 2",
    );

    this.difficultyGroup = this.add.container(0, 0).setDepth(3);
    const difficultyTitle = this.add.text(110, 562, "СЛОЖНОСТЬ ПРОТИВНИКА", {
      color: "#9fb2ce",
      fontFamily: "Arial, sans-serif",
      fontSize: "11px",
      fontStyle: "bold",
      letterSpacing: 2,
    });
    this.difficultyGroup.add(difficultyTitle);
    this.createDifficultyButton("easy", 110, "ЛЕГКО", "Ошибается в расчётах");
    this.createDifficultyButton("normal", 390, "НОРМАЛЬНО", "Учитывает ветер и рельеф");
    this.createDifficultyButton("hard", 670, "СЛОЖНО", "Выбирает оружие и точную дугу");
  }

  private createModeButton(
    mode: GameMode,
    x: number,
    y: number,
    width: number,
    title: string,
    description: string,
  ): void {
    const button = this.add
      .rectangle(x, y, width, 78, COLORS.panelBright, 1)
      .setOrigin(0)
      .setStrokeStyle(2, COLORS.stroke, 0.65)
      .setInteractive({ useHandCursor: true })
      .setDepth(3);
    this.add
      .text(x + 24, y + 17, title, {
        color: "#f7f4ec",
        fontFamily: "Arial, sans-serif",
        fontSize: "16px",
        fontStyle: "bold",
        letterSpacing: 1.5,
      })
      .setDepth(4);
    this.add
      .text(x + 24, y + 46, description, {
        color: "#9fb2ce",
        fontFamily: "Arial, sans-serif",
        fontSize: "11px",
      })
      .setDepth(4);
    button.on("pointerdown", () => {
      this.settings.mode = mode;
      if (mode === "ai") {
        this.settings.playerNames.right = "РАЗБОЙНИК AI";
      } else if (this.settings.playerNames.right.includes("AI")) {
        this.settings.playerNames.right = "ИГРОК 2";
      }
      this.activeField = null;
      this.refresh();
    });
    this.modeButtons.set(mode, button);
  }

  private createNameField(
    side: "left" | "right",
    x: number,
    y: number,
    label: string,
  ): Phaser.GameObjects.Text {
    const fieldLabel = this.add
      .text(x + 18, y - 18, label, {
        color: side === "left" ? "#83d7ff" : "#ff9d82",
        fontFamily: "Arial, sans-serif",
        fontSize: "9px",
        fontStyle: "bold",
        letterSpacing: 1.2,
      })
      .setDepth(4);
    const panel = this.add
      .rectangle(x, y, 410, 72, 0x09121f, 1)
      .setOrigin(0)
      .setStrokeStyle(2, COLORS.stroke, 0.7)
      .setInteractive({ useHandCursor: true })
      .setDepth(3);
    const value = this.add
      .text(x + 20, y + 36, "", {
        color: "#f7f4ec",
        fontFamily: "Arial, sans-serif",
        fontSize: "19px",
        fontStyle: "bold",
      })
      .setOrigin(0, 0.5)
      .setDepth(4);
    panel.on("pointerdown", () => {
      if (side === "right" && this.settings.mode === "ai") {
        return;
      }
      this.activeField = side;
      this.refresh();
    });
    this.fields.set(side, { panel, value, side });
    return fieldLabel;
  }

  private createDifficultyButton(
    difficulty: AiDifficulty,
    x: number,
    title: string,
    description: string,
  ): void {
    const panel = this.add
      .rectangle(x, 600, 255, 88, COLORS.panelBright, 1)
      .setOrigin(0)
      .setStrokeStyle(2, COLORS.stroke, 0.65)
      .setInteractive({ useHandCursor: true });
    const titleText = this.add.text(x + 18, 618, title, {
      color: "#f7f4ec",
      fontFamily: "Arial, sans-serif",
      fontSize: "14px",
      fontStyle: "bold",
      letterSpacing: 1,
    });
    const detailText = this.add.text(x + 18, 648, description, {
      color: "#91a4c0",
      fontFamily: "Arial, sans-serif",
      fontSize: "9px",
      wordWrap: { width: 215 },
    });
    this.difficultyGroup.add([panel, titleText, detailText]);
    panel.on("pointerdown", () => {
      this.settings.aiDifficulty = difficulty;
      this.refresh();
    });
    this.difficultyButtons.set(difficulty, panel);
  }

  private drawRatingPanel(): void {
    const panel = this.add.graphics().setDepth(2);
    panel.fillStyle(COLORS.panel, 0.96);
    panel.fillRoundedRect(1050, 210, 480, 590, 24);
    panel.lineStyle(2, COLORS.stroke, 0.72);
    panel.strokeRoundedRect(1050, 210, 480, 590, 24);
    panel.fillStyle(COLORS.amber, 0.12);
    panel.fillCircle(1290, 355, 112);
    panel.lineStyle(3, COLORS.amber, 0.58);
    panel.strokeCircle(1290, 355, 84);

    this.add
      .text(1090, 245, "ДОСЬЕ БОЙЦА", {
        color: "#f7f4ec",
        fontFamily: "Arial, sans-serif",
        fontSize: "21px",
        fontStyle: "bold",
        letterSpacing: 2,
      })
      .setDepth(3);
    this.ratingText = this.add
      .text(1290, 355, "", {
        color: "#ffd166",
        fontFamily: "Arial, sans-serif",
        fontSize: "26px",
        fontStyle: "bold",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(3);
    this.add
      .text(1090, 500, "ЛОКАЛЬНЫЙ РЕЙТИНГ", {
        color: "#9fb2ce",
        fontFamily: "Arial, sans-serif",
        fontSize: "11px",
        fontStyle: "bold",
        letterSpacing: 2,
      })
      .setDepth(3);
    this.leaderboardText = this.add
      .text(1090, 535, "", {
        color: "#d9e3f1",
        fontFamily: "Arial, sans-serif",
        fontSize: "14px",
        lineSpacing: 12,
      })
      .setDepth(3);
  }

  private drawStartButton(): void {
    const shadow = this.add
      .rectangle(545, 752, 520, 70, 0x000000, 0.4)
      .setDepth(2);
    const button = this.add
      .rectangle(545, 744, 520, 70, COLORS.mint, 1)
      .setStrokeStyle(3, 0xd6ffe8, 0.8)
      .setInteractive({ useHandCursor: true })
      .setDepth(3);
    this.add
      .text(545, 744, "ВЫБРАТЬ АРЕНУ", {
        color: "#10221a",
        fontFamily: "Arial, sans-serif",
        fontSize: "19px",
        fontStyle: "bold",
        letterSpacing: 2,
      })
      .setOrigin(0.5)
      .setDepth(4);
    button.on("pointerover", () => {
      button.setScale(1.02);
      shadow.setScale(1.02);
    });
    button.on("pointerout", () => {
      button.setScale(1);
      shadow.setScale(1);
    });
    button.on("pointerdown", this.startArenaSelection, this);
  }

  private refresh(): void {
    this.modeButtons.forEach((button, mode) => {
      const selected = this.settings.mode === mode;
      button.setStrokeStyle(selected ? 4 : 2, selected ? COLORS.amber : COLORS.stroke, selected ? 1 : 0.65);
      button.setFillStyle(selected ? 0x3b3424 : COLORS.panelBright, 1);
    });

    this.difficultyButtons.forEach((button, difficulty) => {
      const selected = this.settings.aiDifficulty === difficulty;
      button.setStrokeStyle(selected ? 4 : 2, selected ? COLORS.mint : COLORS.stroke, selected ? 1 : 0.65);
      button.setFillStyle(selected ? 0x17352b : COLORS.panelBright, 1);
    });

    this.fields.forEach((field, side) => {
      const disabled = side === "right" && this.settings.mode === "ai";
      const active = this.activeField === side && !disabled;
      field.panel.setStrokeStyle(active ? 4 : 2, active ? COLORS.amber : COLORS.stroke, active ? 1 : 0.7);
      field.panel.setAlpha(disabled ? 0.62 : 1);
      field.value.setText(`${this.settings.playerNames[side]}${active ? "  |" : ""}`);
      field.value.setAlpha(disabled ? 0.75 : 1);
    });

    this.secondPlayerLabel.setText(this.settings.mode === "ai" ? "ПРОТИВНИК AI" : "ИГРОК 2");
    this.difficultyGroup.setVisible(this.settings.mode === "ai");
    this.refreshRating();
  }

  private refreshRating(): void {
    const rating = getRatingForPlayer(this.settings.playerNames.left);
    this.ratingText.setText(`${rating.rating}\nРЕЙТИНГ\n\n${rating.wins} П  ·  ${rating.losses} ПР`);
    const leaders = getRatingLeaderboard();
    this.leaderboardText.setText(
      leaders.length === 0
        ? "Сыграйте первый матч — рейтинг появится здесь"
        : leaders.map((entry, index) => `${index + 1}.  ${entry.name}   ${entry.rating}`).join("\n"),
    );
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.activeField) {
      if (event.code === "Enter" || event.code === "Space") {
        event.preventDefault();
        this.startArenaSelection();
      }
      return;
    }

    event.preventDefault();
    if (event.code === "Escape" || event.code === "Enter") {
      const side = this.activeField;
      this.settings.playerNames[side] = normalizePlayerName(
        this.settings.playerNames[side],
        side === "left" ? "ИГРОК 1" : "ИГРОК 2",
      );
      this.activeField = null;
      this.refresh();
      return;
    }

    if (event.code === "Backspace") {
      this.settings.playerNames[this.activeField] = this.settings.playerNames[this.activeField].slice(0, -1);
      this.refresh();
      return;
    }

    if (event.key.length === 1 && /[A-Za-zА-Яа-яЁё0-9 _-]/.test(event.key)) {
      const current = this.settings.playerNames[this.activeField];
      if (current.length < 16) {
        this.settings.playerNames[this.activeField] = `${current}${event.key}`;
        this.refresh();
      }
    }
  }

  private startArenaSelection(): void {
    if (this.navigationStarted) {
      return;
    }

    this.navigationStarted = true;
    this.settings.playerNames.left = normalizePlayerName(this.settings.playerNames.left, "ИГРОК 1");
    this.settings.playerNames.right =
      this.settings.mode === "ai"
        ? "РАЗБОЙНИК AI"
        : normalizePlayerName(this.settings.playerNames.right, "ИГРОК 2");
    saveMatchSettings(this.settings);
    this.registry.set(MATCH_SETTINGS_REGISTRY_KEY, this.settings);
    this.cameras.main.fadeOut(180, 6, 10, 18);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start("MenuScene");
    });
  }
}
