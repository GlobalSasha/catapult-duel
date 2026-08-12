export const OPENROUTER_HARD_BUDGET_USD: number;
export const OPENROUTER_BUDGET_FILE: string;

export function estimateMaximumCostUsd(options: {
  inputBytes: number;
  maxTokens: number;
  inputPrice: number;
  outputPrice: number;
}): number;

export function assertWithinBudget(options: {
  spentUsd: number;
  maximumRequestCostUsd: number;
  requestLimitUsd: number;
}): number;

export function getCurrentKeyUsage(apiKey: string): Promise<number>;
export function getModelPricing(
  apiKey: string,
  model: string,
): Promise<{ inputPrice: number; outputPrice: number }>;

export function inspectBudget(apiKey: string): Promise<{
  ledger: Record<string, unknown>;
  currentKeyUsage: number;
  spentUsd: number;
  remainingUsd: number;
}>;

export function preflightOpenRouterRequest(options: {
  apiKey: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
  maxTokens: number;
  requestLimitUsd: number;
}): Promise<Record<string, unknown>>;

export function recordOpenRouterUsage(options: {
  apiKey: string;
  model: string;
  usage: Record<string, unknown> | undefined;
  reservationId: string;
}): Promise<Record<string, unknown>>;
