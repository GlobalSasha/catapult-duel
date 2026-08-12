/**
 * Shared UI tokens for the wasteland arcade-terminal look.
 *
 * The palette deliberately stays small: warm phosphor orange carries actions,
 * cyan marks navigation/selection, and brown-black surfaces keep arena art
 * visible without falling back to a generic blue game UI.
 */
export const RETRO_UI = {
  colors: {
    ink: 0x17140f,
    inkSoft: 0x211d16,
    panel: 0x2d291f,
    panelRaised: 0x403824,
    panelActive: 0x594424,
    field: 0x17150f,
    border: 0x967745,
    borderDim: 0x68583b,
    orange: 0xff941f,
    orangeDark: 0xe65227,
    cyan: 0x45d5df,
    cream: 0xffedc2,
    muted: 0xdec99e,
    coral: 0xff7557,
    success: 0x74d6a0,
    danger: 0xff7557,
    playerLeft: 0x45d5df,
    playerRight: 0xff7557,
  },
  text: {
    primary: "#ffedc2",
    secondary: "#dec99e",
    orange: "#ff941f",
    cyan: "#45d5df",
    coral: "#ff7557",
    success: "#74d6a0",
    danger: "#ff7557",
    ink: "#17140f",
  },
  font: {
    display: 'Impact, "Arial Black", sans-serif',
    ui: '"Courier New", Courier, monospace',
  },
  line: {
    hairline: 2,
    selected: 4,
    frame: 6,
  },
  motion: {
    instant: 90,
    fast: 140,
    standard: 220,
    emphasis: 420,
    ambient: 1800,
  },
} as const;
