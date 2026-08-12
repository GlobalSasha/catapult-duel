import * as Phaser from "phaser";

import {
  DEFAULT_ARENA_ID,
  getArenaDefinition,
  isArenaId,
  type ArenaId,
} from "../arena/arenaCatalog";
import {
  MATCH_SETTINGS_REGISTRY_KEY,
  readMatchSettings,
} from "../core/matchSession";
import { GAME_HEIGHT, GAME_WIDTH } from "../gameDimensions";
import { getOpponentDefinition } from "../opponents/opponentCatalog";
import { configure2KCamera, sharpenSceneText } from "../rendering";
import { RETRO_UI } from "../ui/retroTheme";

interface ArenaLoadingSceneData {
  arenaId?: ArenaId;
}

const DISPLAY_FONT = RETRO_UI.font.display;
const UI_FONT = RETRO_UI.font.ui;

export class ArenaLoadingScene extends Phaser.Scene {
  private arenaId: ArenaId = DEFAULT_ARENA_ID;
  private progressFill!: Phaser.GameObjects.Rectangle;
  private progressText!: Phaser.GameObjects.Text;
  private phaseText!: Phaser.GameObjects.Text;
  private transitionStarted = false;
  private canSkip = false;

  constructor() {
    super("ArenaLoadingScene");
  }

  create(data: ArenaLoadingSceneData): void {
    configure2KCamera(this);
    this.arenaId = isArenaId(data.arenaId)
      ? data.arenaId
      : DEFAULT_ARENA_ID;
    this.transitionStarted = false;
    this.canSkip = false;

    this.drawScreen();
    this.cameras.main.fadeIn(320, 12, 10, 7);
    sharpenSceneText(this);

    this.setProgress(0.18, "РАЗВЕДКА РЕЛЬЕФА");
    this.time.delayedCall(520, () => {
      this.setProgress(0.46, "РАССТАНОВКА РУБЕЖЕЙ");
    });
    this.time.delayedCall(980, () => {
      this.canSkip = true;
      this.setProgress(0.74, "ПРОВЕРКА ВЕТРА");
    });
    this.time.delayedCall(1450, () => {
      this.setProgress(1, "АРЕНА ГОТОВА");
    });
    this.time.delayedCall(1850, () => this.startPlacement());

    this.input.keyboard?.on("keydown", this.handleKeyDown, this);
    this.input.on("pointerdown", this.handlePointerDown, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off("keydown", this.handleKeyDown, this);
      this.input.off("pointerdown", this.handlePointerDown, this);
    });
  }

  private drawScreen(): void {
    const arena = getArenaDefinition(this.arenaId);
    const settings = readMatchSettings(
      this.registry.get(MATCH_SETTINGS_REGISTRY_KEY),
    );
    const opponent = getOpponentDefinition(settings.aiDifficulty);

    const background = this.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, arena.textureKey)
      .setDisplaySize(GAME_WIDTH * 1.06, GAME_HEIGHT * 1.06)
      .setTint(0xe9c09c);
    this.tweens.add({
      targets: background,
      scaleX: background.scaleX * 0.96,
      scaleY: background.scaleY * 0.96,
      duration: 2100,
      ease: "Sine.easeOut",
    });

    this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, RETRO_UI.colors.ink, 0.48)
      .setOrigin(0);
    const shade = this.add.graphics();
    shade.fillGradientStyle(
      RETRO_UI.colors.ink,
      RETRO_UI.colors.inkSoft,
      RETRO_UI.colors.ink,
      RETRO_UI.colors.orangeDark,
      0.9,
      0.42,
      0.92,
      0.28,
    );
    shade.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const frame = this.add.graphics();
    frame.lineStyle(5, RETRO_UI.colors.ink, 0.95);
    frame.strokeRect(34, 34, GAME_WIDTH - 68, GAME_HEIGHT - 68);
    frame.lineStyle(2, arena.accentColor, 0.8);
    frame.strokeRect(46, 46, GAME_WIDTH - 92, GAME_HEIGHT - 92);
    frame.fillStyle(RETRO_UI.colors.orange, 1);
    frame.fillTriangle(46, 46, 92, 46, 46, 92);
    frame.fillTriangle(
      GAME_WIDTH - 46,
      GAME_HEIGHT - 46,
      GAME_WIDTH - 92,
      GAME_HEIGHT - 46,
      GAME_WIDTH - 46,
      GAME_HEIGHT - 92,
    );

    this.add.text(92, 78, "ПОДГОТОВКА К ОСАДЕ", {
      color: RETRO_UI.text.cyan,
      fontFamily: UI_FONT,
      fontSize: "13px",
      fontStyle: "bold",
      letterSpacing: 4,
    });
    this.add.text(92, 116, arena.displayName, {
      color: arena.accentTextColor,
      fontFamily: DISPLAY_FONT,
      fontSize: "54px",
      fontStyle: "bold",
      letterSpacing: 4,
      stroke: RETRO_UI.text.ink,
      strokeThickness: 8,
    });
    this.add.text(96, 184, arena.description, {
      color: RETRO_UI.text.primary,
      fontFamily: UI_FONT,
      fontSize: "17px",
    });

    const versusY = 548;
    this.add
      .text(112, versusY, settings.playerNames.left, {
        color: RETRO_UI.text.cyan,
        fontFamily: DISPLAY_FONT,
        fontSize: "30px",
        fontStyle: "bold",
        letterSpacing: 2,
      })
      .setOrigin(0, 0.5);
    this.add
      .text(GAME_WIDTH / 2, versusY, "ПРОТИВ", {
        color: RETRO_UI.text.secondary,
        fontFamily: UI_FONT,
        fontSize: "12px",
        fontStyle: "bold",
        letterSpacing: 3,
      })
      .setOrigin(0.5);
    this.add
      .text(
        GAME_WIDTH - 112,
        versusY,
        settings.mode === "ai" ? opponent.displayName : settings.playerNames.right,
        {
          color:
            settings.mode === "ai"
              ? opponent.accentTextColor
              : RETRO_UI.text.coral,
          fontFamily: DISPLAY_FONT,
          fontSize: "30px",
          fontStyle: "bold",
          letterSpacing: 2,
        },
      )
      .setOrigin(1, 0.5);

    this.add
      .rectangle(96, 674, GAME_WIDTH - 192, 20, RETRO_UI.colors.ink, 0.95)
      .setOrigin(0)
      .setStrokeStyle(2, RETRO_UI.colors.border, 0.9);
    this.progressFill = this.add
      .rectangle(101, 679, GAME_WIDTH - 202, 10, arena.accentColor, 1)
      .setOrigin(0)
      .setScale(0, 1);
    this.phaseText = this.add.text(96, 718, "", {
      color: RETRO_UI.text.primary,
      fontFamily: UI_FONT,
      fontSize: "13px",
      fontStyle: "bold",
      letterSpacing: 2,
    });
    this.progressText = this.add
      .text(GAME_WIDTH - 96, 718, "0%", {
        color: arena.accentTextColor,
        fontFamily: UI_FONT,
        fontSize: "13px",
        fontStyle: "bold",
      })
      .setOrigin(1, 0);
    this.add
      .text(GAME_WIDTH - 96, 790, "ENTER ИЛИ КЛИК · ПРОПУСТИТЬ", {
        color: RETRO_UI.text.secondary,
        fontFamily: UI_FONT,
        fontSize: "10px",
        letterSpacing: 1.5,
      })
      .setOrigin(1, 0);
  }

  private setProgress(progress: number, phase: string): void {
    this.tweens.add({
      targets: this.progressFill,
      scaleX: progress,
      duration: 360,
      ease: "Sine.easeOut",
    });
    this.phaseText.setText(phase);
    this.progressText.setText(`${Math.round(progress * 100)}%`);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.code === "Escape") {
      this.scene.start("MenuScene");
      return;
    }

    if ((event.code === "Enter" || event.code === "Space") && this.canSkip) {
      event.preventDefault();
      this.startPlacement();
    }
  }

  private handlePointerDown(): void {
    if (this.canSkip) {
      this.startPlacement();
    }
  }

  private startPlacement(): void {
    if (this.transitionStarted) {
      return;
    }

    this.transitionStarted = true;
    this.cameras.main.fadeOut(300, 10, 8, 6);
    this.cameras.main.once(
      Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
      () => {
        this.scene.start("PlacementScene", { arenaId: this.arenaId });
      },
    );
  }
}
