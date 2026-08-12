import { describe, expect, it } from "vitest";

import {
  assertWithinBudget,
  estimateMaximumCostUsd,
  OPENROUTER_HARD_BUDGET_USD,
} from "../scripts/openrouter-budget.mjs";

describe("OpenRouter budget guard", () => {
  it("uses a conservative maximum request cost", () => {
    expect(
      estimateMaximumCostUsd({
        inputBytes: 100_000,
        maxTokens: 5_000,
        inputPrice: 3 / 1_000_000,
        outputPrice: 15 / 1_000_000,
      }),
    ).toBeCloseTo(0.375);
  });

  it("stops a request that could cross the global limit", () => {
    expect(() =>
      assertWithinBudget({
        spentUsd: OPENROUTER_HARD_BUDGET_USD - 0.1,
        maximumRequestCostUsd: 0.11,
        requestLimitUsd: 1,
      }),
    ).toThrow(/превысить остаток бюджета/);
  });

  it("stops a request above its individual limit", () => {
    expect(() =>
      assertWithinBudget({
        spentUsd: 0,
        maximumRequestCostUsd: 1.01,
        requestLimitUsd: 1,
      }),
    ).toThrow(/выше лимита запроса/);
  });

  it("counts a conservative UTF-8 byte upper bound", () => {
    const ascii = estimateMaximumCostUsd({
      inputBytes: new TextEncoder().encode("тест").byteLength,
      maxTokens: 0,
      inputPrice: 1,
      outputPrice: 1,
    });
    expect(ascii).toBe(8);
  });
});
