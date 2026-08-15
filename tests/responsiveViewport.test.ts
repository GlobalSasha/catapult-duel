import { describe, expect, it } from "vitest";

import { calculateLogicalViewport } from "../src/game/gameDimensions";

describe("calculateLogicalViewport", () => {
  it("keeps the 1600x900 safe area unchanged at 16:9", () => {
    expect(calculateLogicalViewport(1600, 900, 1)).toEqual({
      width: 1600,
      height: 900,
      overflowX: 0,
      overflowY: 0,
    });
  });

  it("exposes extra world space on a wide mobile canvas", () => {
    expect(calculateLogicalViewport(1948, 900, 1)).toEqual({
      width: 1948,
      height: 900,
      overflowX: 174,
      overflowY: 0,
    });
  });

  it("converts the desktop render target back to logical coordinates", () => {
    expect(calculateLogicalViewport(2560, 1440, 1.6)).toEqual({
      width: 1600,
      height: 900,
      overflowX: 0,
      overflowY: 0,
    });
  });
});
