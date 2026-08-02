import * as Phaser from "phaser";

import { GAME_HEIGHT, GAME_WIDTH } from "./game/gameDimensions";
import { STRINGS_RU } from "./game/i18n/strings.ru";
import { BattleScene } from "./game/scenes/BattleScene";
import { BootScene } from "./game/scenes/BootScene";
import { MenuScene } from "./game/scenes/MenuScene";
import { PlacementScene } from "./game/scenes/PlacementScene";
import { ResultScene } from "./game/scenes/ResultScene";
import "./style.css";

const gameRoot = document.querySelector("#game");
const rotateTitle = document.querySelector('[data-string="rotate-title"]');
const rotateMessage = document.querySelector('[data-string="rotate-message"]');

gameRoot?.setAttribute("aria-label", STRINGS_RU.gameAriaLabel);
if (rotateTitle) {
  rotateTitle.textContent = STRINGS_RU.rotateDeviceTitle;
}
if (rotateMessage) {
  rotateMessage.textContent = STRINGS_RU.rotateDeviceMessage;
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#161a24",
  scene: [
    BootScene,
    MenuScene,
    PlacementScene,
    BattleScene,
    ResultScene,
  ],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
};

new Phaser.Game(config);
