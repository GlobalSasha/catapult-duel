import * as Phaser from "phaser";

import { RENDER_HEIGHT, RENDER_WIDTH } from "./game/gameDimensions";
import { musicController } from "./game/audio/MusicController";
import { STRINGS_RU } from "./game/i18n/strings.ru";
import { BattleScene } from "./game/scenes/BattleScene";
import { ArenaLoadingScene } from "./game/scenes/ArenaLoadingScene";
import { BootScene } from "./game/scenes/BootScene";
import { HomeScene } from "./game/scenes/HomeScene";
import { MenuScene } from "./game/scenes/MenuScene";
import { PlacementScene } from "./game/scenes/PlacementScene";
import { ResultScene } from "./game/scenes/ResultScene";
import "./style.css";

const gameRoot = document.querySelector("#game");
const rotateTitle = document.querySelector('[data-string="rotate-title"]');
const rotateMessage = document.querySelector('[data-string="rotate-message"]');
const musicToggle = document.querySelector<HTMLButtonElement>("#music-toggle");

gameRoot?.setAttribute("aria-label", STRINGS_RU.gameAriaLabel);
if (rotateTitle) {
  rotateTitle.textContent = STRINGS_RU.rotateDeviceTitle;
}
if (rotateMessage) {
  rotateMessage.textContent = STRINGS_RU.rotateDeviceMessage;
}

musicController.installAutoUnlock();
musicController.subscribe((muted) => {
  if (!musicToggle) {
    return;
  }

  musicToggle.textContent = "♫";
  musicToggle.setAttribute("aria-pressed", String(!muted));
  musicToggle.setAttribute(
    "aria-label",
    muted ? "Включить музыку" : "Выключить музыку",
  );
  musicToggle.title = muted ? "Включить музыку" : "Выключить музыку";
});
musicToggle?.addEventListener("click", (event) => {
  event.stopPropagation();
  void musicController.toggleMuted();
});

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  width: RENDER_WIDTH,
  height: RENDER_HEIGHT,
  backgroundColor: "#17140f",
  scene: [
    BootScene,
    HomeScene,
    MenuScene,
    ArenaLoadingScene,
    PlacementScene,
    BattleScene,
    ResultScene,
  ],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    autoRound: true,
    width: RENDER_WIDTH,
    height: RENDER_HEIGHT,
  },
};

new Phaser.Game(config);
