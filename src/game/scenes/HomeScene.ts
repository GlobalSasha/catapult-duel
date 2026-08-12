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
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  IS_MOBILE_RENDER_TARGET,
  RENDER_HEIGHT,
  RENDER_WIDTH,
} from "../gameDimensions";
import { configure2KCamera, sharpenSceneText } from "../rendering";
import { RETRO_UI } from "../ui/retroTheme";
import { musicController } from "../audio/MusicController";
import {
  getOpponentDefinition,
  isOpponentDisplayName,
} from "../opponents/opponentCatalog";

const COLORS = {
  navy: RETRO_UI.colors.ink,
  panel: RETRO_UI.colors.panel,
  panelBright: RETRO_UI.colors.panelRaised,
  panelActive: RETRO_UI.colors.panelActive,
  stroke: RETRO_UI.colors.border,
  amber: RETRO_UI.colors.orange,
  mint: RETRO_UI.colors.cyan,
  cyan: RETRO_UI.colors.cyan,
  coral: RETRO_UI.colors.coral,
} as const;

const DISPLAY_FONT = RETRO_UI.font.display;
const UI_FONT = RETRO_UI.font.ui;

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
  private mobileNameEditor: HTMLFormElement | null = null;
  private mobileNameInput: HTMLInputElement | null = null;

  constructor() {
    super("HomeScene");
  }

  create(): void {
    configure2KCamera(this);
    musicController.setTheme("menu");
    const profile = loadPlayerProfile();
    this.settings = profile.settings;
    if (this.settings.mode === "ai") {
      this.settings.playerNames.right = getOpponentDefinition(
        this.settings.aiDifficulty,
      ).displayName;
    }
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
    this.cameras.main.fadeIn(320, 8, 7, 5);

    this.input.keyboard?.on("keydown", this.handleKeyDown, this);
    this.installMobileNameEditor();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off("keydown", this.handleKeyDown, this);
      this.removeMobileNameEditor();
    });
  }

  private drawBackdrop(): void {
    this.add
      .image(0, 0, "arena-highlands")
      .setOrigin(0)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setTint(0xc6784f);
    this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.navy, 0.58)
      .setOrigin(0);
    const atmosphere = this.add.graphics();
    atmosphere.fillGradientStyle(
      RETRO_UI.colors.orangeDark,
      RETRO_UI.colors.orangeDark,
      RETRO_UI.colors.ink,
      RETRO_UI.colors.ink,
      0.38,
      0.38,
      0.16,
      0.16,
    );
    atmosphere.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    atmosphere.fillStyle(COLORS.navy, 0.86);
    atmosphere.fillRect(0, 0, GAME_WIDTH, 184);
    atmosphere.fillStyle(COLORS.amber, 0.9);
    atmosphere.fillRect(0, 180, GAME_WIDTH, 4);

    for (let index = 0; index < 24; index += 1) {
      const mote = this.add
        .rectangle(
          40 + ((index * 173) % 1540),
          185 + ((index * 97) % 650),
          3 + (index % 3) * 2,
          3 + (index % 2) * 2,
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
        color: RETRO_UI.text.cyan,
        fontFamily: UI_FONT,
        fontSize: "13px",
        fontStyle: "bold",
        letterSpacing: 4,
      })
      .setDepth(2);
    this.add
      .text(76, 66, "CATAPULT DUEL", {
        color: RETRO_UI.text.orange,
        fontFamily: DISPLAY_FONT,
        fontSize: "52px",
        fontStyle: "bold",
        letterSpacing: 6,
        stroke: RETRO_UI.text.ink,
        strokeThickness: 8,
      })
      .setDepth(2);
    this.add
      .text(80, 132, "Соберите бойцов, выберите противника и войдите на одну из 12 арен", {
        color: RETRO_UI.text.primary,
        fontFamily: UI_FONT,
        fontSize: "16px",
      })
      .setDepth(2);
    this.add
      .text(1518, 70, IS_MOBILE_RENDER_TARGET ? "MOBILE" : "2K", {
        color: RETRO_UI.text.cyan,
        fontFamily: DISPLAY_FONT,
        fontSize: "30px",
        fontStyle: "bold",
      })
      .setOrigin(1, 0)
      .setDepth(2);
    this.add
      .text(
        1518,
        108,
        `${RENDER_WIDTH} × ${RENDER_HEIGHT} · ${IS_MOBILE_RENDER_TARGET ? "PERFORMANCE" : "HIGH DETAIL"}`,
        {
          color: RETRO_UI.text.secondary,
          fontFamily: UI_FONT,
          fontSize: "10px",
          fontStyle: "bold",
          letterSpacing: 1.2,
        },
      )
      .setOrigin(1, 0)
      .setDepth(2);
  }

  private drawSetupPanel(): void {
    const panel = this.add.graphics().setDepth(2);
    panel.fillStyle(COLORS.panel, 0.96);
    panel.fillRect(70, 210, 950, 590);
    panel.lineStyle(6, RETRO_UI.colors.ink, 1);
    panel.strokeRect(70, 210, 950, 590);
    panel.lineStyle(3, COLORS.stroke, 0.9);
    panel.strokeRect(78, 218, 934, 574);
    panel.fillStyle(COLORS.amber, 1);
    panel.fillRect(94, 230, 8, 44);

    this.add
      .text(110, 244, "ВОЕННЫЙ СОВЕТ", {
        color: RETRO_UI.text.orange,
        fontFamily: DISPLAY_FONT,
        fontSize: "24px",
        fontStyle: "bold",
        letterSpacing: 3,
      })
      .setDepth(3);
    this.add
      .text(110, 285, "ВЫБЕРИТЕ ПРОТИВНИКА", {
        color: RETRO_UI.text.secondary,
        fontFamily: UI_FONT,
        fontSize: "11px",
        fontStyle: "bold",
        letterSpacing: 2,
      })
      .setDepth(3);

    this.createModeButton("ai", 110, 320, 410, "ВОЕНАЧАЛЬНИК AI", "Три соперника с разной тактикой");
    this.createModeButton("local", 540, 320, 410, "ДВА КОМАНДИРА", "По очереди на одном устройстве");

    this.add
      .text(110, 426, "ИМЕНА БОЙЦОВ", {
        color: RETRO_UI.text.secondary,
        fontFamily: UI_FONT,
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
      color: RETRO_UI.text.secondary,
      fontFamily: UI_FONT,
      fontSize: "11px",
      fontStyle: "bold",
      letterSpacing: 2,
    });
    this.difficultyGroup.add(difficultyTitle);
    this.createDifficultyButton("easy", 110);
    this.createDifficultyButton("normal", 390);
    this.createDifficultyButton("hard", 670);
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
        color: RETRO_UI.text.primary,
        fontFamily: UI_FONT,
        fontSize: "16px",
        fontStyle: "bold",
        letterSpacing: 1.5,
      })
      .setDepth(4);
    this.add
      .text(x + 24, y + 46, description, {
        color: RETRO_UI.text.secondary,
        fontFamily: UI_FONT,
        fontSize: "11px",
      })
      .setDepth(4);
    button.on("pointerdown", () => {
      this.settings.mode = mode;
      if (mode === "ai") {
        this.settings.playerNames.right = getOpponentDefinition(
          this.settings.aiDifficulty,
        ).displayName;
      } else if (isOpponentDisplayName(this.settings.playerNames.right)) {
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
        color: side === "left" ? RETRO_UI.text.cyan : RETRO_UI.text.coral,
        fontFamily: UI_FONT,
        fontSize: "9px",
        fontStyle: "bold",
        letterSpacing: 1.2,
      })
      .setDepth(4);
    const panel = this.add
      .rectangle(x, y, 410, 72, RETRO_UI.colors.field, 1)
      .setOrigin(0)
      .setStrokeStyle(2, COLORS.stroke, 0.7)
      .setInteractive({ useHandCursor: true })
      .setDepth(3);
    const value = this.add
      .text(x + 20, y + 36, "", {
        color: RETRO_UI.text.primary,
        fontFamily: UI_FONT,
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
      this.openMobileNameEditor(side);
    });
    this.fields.set(side, { panel, value, side });
    return fieldLabel;
  }

  private createDifficultyButton(
    difficulty: AiDifficulty,
    x: number,
  ): void {
    const opponent = getOpponentDefinition(difficulty);
    const panel = this.add
      .rectangle(x, 600, 255, 88, COLORS.panelBright, 1)
      .setOrigin(0)
      .setStrokeStyle(2, COLORS.stroke, 0.65)
      .setInteractive({ useHandCursor: true });
    const titleText = this.add.text(x + 18, 614, opponent.displayName, {
      color: opponent.accentTextColor,
      fontFamily: UI_FONT,
      fontSize: "13px",
      fontStyle: "bold",
      letterSpacing: 0.5,
    });
    const detailText = this.add.text(
      x + 18,
      638,
      `${opponent.rankLabel} · ${opponent.description}`,
      {
      color: RETRO_UI.text.secondary,
      fontFamily: UI_FONT,
      fontSize: "10px",
      wordWrap: { width: 215 },
      lineSpacing: 2,
      },
    );
    this.difficultyGroup.add([panel, titleText, detailText]);
    panel.on("pointerdown", () => {
      this.settings.aiDifficulty = difficulty;
      this.settings.playerNames.right = opponent.displayName;
      this.refresh();
    });
    this.difficultyButtons.set(difficulty, panel);
  }

  private drawRatingPanel(): void {
    const panel = this.add.graphics().setDepth(2);
    panel.fillStyle(COLORS.panel, 0.96);
    panel.fillRect(1050, 210, 480, 590);
    panel.lineStyle(6, RETRO_UI.colors.ink, 1);
    panel.strokeRect(1050, 210, 480, 590);
    panel.lineStyle(3, COLORS.stroke, 0.9);
    panel.strokeRect(1058, 218, 464, 574);
    panel.fillStyle(COLORS.panelActive, 1);
    panel.fillRect(1168, 284, 244, 142);
    panel.lineStyle(5, COLORS.amber, 1);
    panel.strokeRect(1168, 284, 244, 142);
    panel.lineStyle(2, RETRO_UI.colors.cyan, 0.9);
    panel.strokeRect(1176, 292, 228, 126);

    this.add
      .text(1090, 245, "ДОСЬЕ БОЙЦА", {
        color: RETRO_UI.text.orange,
        fontFamily: DISPLAY_FONT,
        fontSize: "21px",
        fontStyle: "bold",
        letterSpacing: 2,
      })
      .setDepth(3);
    this.ratingText = this.add
      .text(1290, 355, "", {
        color: RETRO_UI.text.primary,
        fontFamily: UI_FONT,
        fontSize: "26px",
        fontStyle: "bold",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(3);
    this.add
      .text(1090, 500, "ЛОКАЛЬНЫЙ РЕЙТИНГ", {
        color: RETRO_UI.text.cyan,
        fontFamily: UI_FONT,
        fontSize: "11px",
        fontStyle: "bold",
        letterSpacing: 2,
      })
      .setDepth(3);
    this.leaderboardText = this.add
      .text(1090, 535, "", {
        color: RETRO_UI.text.primary,
        fontFamily: UI_FONT,
        fontSize: "14px",
        lineSpacing: 12,
      })
      .setDepth(3);
  }

  private drawStartButton(): void {
    const button = this.add
      .rectangle(545, 744, 520, 70, COLORS.amber, 1)
      .setStrokeStyle(4, RETRO_UI.colors.ink, 1)
      .setInteractive({ useHandCursor: true })
      .setDepth(3);
    this.add
      .rectangle(545, 744, 500, 50, COLORS.amber, 1)
      .setStrokeStyle(2, RETRO_UI.colors.cream, 0.9)
      .setDepth(3);
    this.add
      .text(545, 744, "ОТКРЫТЬ КАРТУ МИРА", {
        color: RETRO_UI.text.ink,
        fontFamily: UI_FONT,
        fontSize: "19px",
        fontStyle: "bold",
        letterSpacing: 2,
      })
      .setOrigin(0.5)
      .setDepth(4);
    button.on("pointerover", () => {
      button.setFillStyle(RETRO_UI.colors.cyan, 1);
    });
    button.on("pointerout", () => {
      button.setFillStyle(COLORS.amber, 1);
    });
    button.on("pointerdown", this.startArenaSelection, this);
  }

  private refresh(): void {
    this.modeButtons.forEach((button, mode) => {
      const selected = this.settings.mode === mode;
      button.setStrokeStyle(selected ? 4 : 2, selected ? COLORS.amber : COLORS.stroke, selected ? 1 : 0.65);
      button.setFillStyle(selected ? COLORS.panelActive : COLORS.panelBright, 1);
    });

    this.difficultyButtons.forEach((button, difficulty) => {
      const selected = this.settings.aiDifficulty === difficulty;
      button.setStrokeStyle(selected ? 4 : 2, selected ? COLORS.mint : COLORS.stroke, selected ? 1 : 0.65);
      button.setFillStyle(selected ? 0x24565a : COLORS.panelBright, 1);
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
    if (event.target instanceof HTMLElement && event.target.closest("button, input")) {
      return;
    }

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

  private installMobileNameEditor(): void {
    if (!IS_MOBILE_RENDER_TARGET) {
      return;
    }

    this.mobileNameEditor = document.querySelector("#mobile-name-editor");
    this.mobileNameInput = document.querySelector("#mobile-name-input");
    this.mobileNameEditor?.addEventListener(
      "submit",
      this.handleMobileNameSubmit,
    );
    this.mobileNameInput?.addEventListener("input", this.handleMobileNameInput);
    this.mobileNameInput?.addEventListener(
      "keydown",
      this.handleMobileNameKeyDown,
    );
    this.mobileNameInput?.addEventListener("blur", this.handleMobileNameBlur);
  }

  private removeMobileNameEditor(): void {
    this.mobileNameEditor?.classList.remove("is-active");
    this.mobileNameEditor?.removeEventListener(
      "submit",
      this.handleMobileNameSubmit,
    );
    this.mobileNameInput?.removeEventListener(
      "input",
      this.handleMobileNameInput,
    );
    this.mobileNameInput?.removeEventListener(
      "keydown",
      this.handleMobileNameKeyDown,
    );
    this.mobileNameInput?.removeEventListener("blur", this.handleMobileNameBlur);
    this.mobileNameEditor = null;
    this.mobileNameInput = null;
  }

  private openMobileNameEditor(side: "left" | "right"): void {
    if (
      !IS_MOBILE_RENDER_TARGET ||
      !this.mobileNameEditor ||
      !this.mobileNameInput
    ) {
      return;
    }

    this.activeField = side;
    this.mobileNameInput.value = this.settings.playerNames[side];
    this.mobileNameEditor.classList.add("is-active");
    this.mobileNameInput.focus({ preventScroll: true });
    this.mobileNameInput.setSelectionRange(
      this.mobileNameInput.value.length,
      this.mobileNameInput.value.length,
    );
  }

  private finishMobileNameEditing(): void {
    if (!this.activeField) {
      return;
    }

    const side = this.activeField;
    this.settings.playerNames[side] = normalizePlayerName(
      this.settings.playerNames[side],
      side === "left" ? "ИГРОК 1" : "ИГРОК 2",
    );
    this.activeField = null;
    this.mobileNameEditor?.classList.remove("is-active");
    this.mobileNameInput?.blur();
    this.refresh();
    document.querySelector<HTMLElement>("#game")?.focus({
      preventScroll: true,
    });
  }

  private readonly handleMobileNameInput = (event: Event): void => {
    if (!this.activeField) {
      return;
    }

    const input = event.currentTarget as HTMLInputElement;
    const filtered = Array.from(input.value)
      .filter((character) => /[A-Za-zА-Яа-яЁё0-9 _-]/.test(character))
      .join("")
      .slice(0, 16);
    input.value = filtered;
    this.settings.playerNames[this.activeField] = filtered;
    this.refresh();
  };

  private readonly handleMobileNameKeyDown = (event: KeyboardEvent): void => {
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      this.finishMobileNameEditing();
    }
  };

  private readonly handleMobileNameSubmit = (event: SubmitEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    this.finishMobileNameEditing();
  };

  private readonly handleMobileNameBlur = (): void => {
    if (!this.mobileNameEditor?.classList.contains("is-active")) {
      return;
    }

    window.setTimeout(() => this.finishMobileNameEditing(), 0);
  };

  private startArenaSelection(): void {
    if (this.navigationStarted) {
      return;
    }

    this.navigationStarted = true;
    this.settings.playerNames.left = normalizePlayerName(this.settings.playerNames.left, "ИГРОК 1");
    this.settings.playerNames.right =
      this.settings.mode === "ai"
        ? getOpponentDefinition(this.settings.aiDifficulty).displayName
        : normalizePlayerName(this.settings.playerNames.right, "ИГРОК 2");
    saveMatchSettings(this.settings);
    this.registry.set(MATCH_SETTINGS_REGISTRY_KEY, this.settings);
    this.cameras.main.fadeOut(180, 6, 10, 18);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start("MenuScene");
    });
  }
}
