import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export const OPENROUTER_HARD_BUDGET_USD = 15;
export const OPENROUTER_BUDGET_FILE = path.resolve(".openrouter-budget.local");

export function estimateMaximumCostUsd({ inputBytes, maxTokens, inputPrice, outputPrice }) {
  if ([inputBytes, maxTokens, inputPrice, outputPrice].some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error("Некорректные данные для оценки стоимости.");
  }

  // One UTF-8 byte per token is deliberately conservative for a hard preflight cap.
  return inputBytes * inputPrice + maxTokens * outputPrice;
}

export function assertWithinBudget({ spentUsd, maximumRequestCostUsd, requestLimitUsd }) {
  const remainingUsd = OPENROUTER_HARD_BUDGET_USD - spentUsd;
  if (remainingUsd <= 0) {
    throw new Error(`Лимит OpenRouter $${OPENROUTER_HARD_BUDGET_USD.toFixed(2)} исчерпан.`);
  }
  if (maximumRequestCostUsd > requestLimitUsd) {
    throw new Error(
      `Максимальная цена запроса $${maximumRequestCostUsd.toFixed(4)} выше лимита запроса $${requestLimitUsd.toFixed(2)}.`,
    );
  }
  if (maximumRequestCostUsd > remainingUsd) {
    throw new Error(
      `Запрос может превысить остаток бюджета: максимум $${maximumRequestCostUsd.toFixed(4)}, остаток $${remainingUsd.toFixed(4)}.`,
    );
  }
  return remainingUsd;
}

async function requestJson(url, apiKey) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? `HTTP ${response.status}`);
  }
  return payload;
}

export async function getCurrentKeyUsage(apiKey) {
  const payload = await requestJson("https://openrouter.ai/api/v1/key", apiKey);
  const usage = Number(payload?.data?.usage);
  if (!Number.isFinite(usage) || usage < 0) throw new Error("OpenRouter не вернул корректный расход ключа.");
  return usage;
}

export async function getModelPricing(apiKey, model) {
  const separator = model.indexOf("/");
  if (separator <= 0 || separator === model.length - 1) {
    throw new Error(`Нельзя проверить цену модели: ${model}`);
  }
  const author = encodeURIComponent(model.slice(0, separator));
  const slug = encodeURIComponent(model.slice(separator + 1));
  const payload = await requestJson(`https://openrouter.ai/api/v1/model/${author}/${slug}`, apiKey);
  const pricing = payload?.data?.pricing ?? payload?.pricing;
  const inputPrice = Number(pricing?.prompt);
  const outputPrice = Number(pricing?.completion);
  if (![inputPrice, outputPrice].every((value) => Number.isFinite(value) && value >= 0)) {
    throw new Error(`OpenRouter не вернул проверяемую цену модели ${model}.`);
  }
  return { inputPrice, outputPrice };
}

async function readLedger(currentKeyUsage) {
  try {
    const ledger = JSON.parse(await readFile(OPENROUTER_BUDGET_FILE, "utf8"));
    if (ledger.version !== 1 || !Number.isFinite(ledger.baselineKeyUsage)) {
      throw new Error("неподдерживаемый формат");
    }
    return {
      ...ledger,
      requests: Array.isArray(ledger.requests) ? ledger.requests : [],
      reservations: Array.isArray(ledger.reservations) ? ledger.reservations : [],
    };
  } catch (error) {
    if (error.code !== "ENOENT" && !(error instanceof SyntaxError)) {
      throw new Error(`Не удалось прочитать бюджетный журнал: ${error.message}`);
    }
    return {
      version: 1,
      budgetUsd: OPENROUTER_HARD_BUDGET_USD,
      baselineKeyUsage: currentKeyUsage,
      lastKeyUsage: currentKeyUsage,
      requests: [],
      reservations: [],
    };
  }
}

async function saveLedger(ledger) {
  const temporaryFile = `${OPENROUTER_BUDGET_FILE}.${process.pid}.tmp`;
  await writeFile(temporaryFile, `${JSON.stringify(ledger, null, 2)}\n`, { mode: 0o600 });
  await rename(temporaryFile, OPENROUTER_BUDGET_FILE);
}

export async function inspectBudget(apiKey) {
  const currentKeyUsage = await getCurrentKeyUsage(apiKey);
  const ledger = await readLedger(currentKeyUsage);
  const remoteSpentUsd = Math.max(0, currentKeyUsage - ledger.baselineKeyUsage);
  const recordedSpentUsd = ledger.requests.reduce(
    (total, request) => total + (Number.isFinite(request.cost) ? request.cost : 0),
    0,
  );
  const reservedUsd = ledger.reservations.reduce(
    (total, reservation) => total + reservation.maximumRequestCostUsd,
    0,
  );
  const spentUsd = Math.max(remoteSpentUsd, recordedSpentUsd) + reservedUsd;
  return {
    ledger,
    currentKeyUsage,
    spentUsd,
    remoteSpentUsd,
    recordedSpentUsd,
    reservedUsd,
    remainingUsd: Math.max(0, OPENROUTER_HARD_BUDGET_USD - spentUsd),
  };
}

export async function preflightOpenRouterRequest({ apiKey, model, messages, maxTokens, requestLimitUsd }) {
  const budget = await inspectBudget(apiKey);
  const pricing = await getModelPricing(apiKey, model);
  const inputBytes = Buffer.byteLength(JSON.stringify(messages), "utf8");
  const maximumRequestCostUsd = estimateMaximumCostUsd({
    inputBytes,
    maxTokens,
    ...pricing,
  });

  assertWithinBudget({
    spentUsd: budget.spentUsd,
    maximumRequestCostUsd,
    requestLimitUsd,
  });

  const reservationId = `${Date.now()}-${process.pid}`;
  await saveLedger({
    ...budget.ledger,
    lastKeyUsage: budget.currentKeyUsage,
    lastPreflight: {
      at: new Date().toISOString(),
      model,
      inputBytes,
      maxTokens,
      maximumRequestCostUsd,
    },
    reservations: [
      ...budget.ledger.reservations,
      {
        id: reservationId,
        at: new Date().toISOString(),
        model,
        maximumRequestCostUsd,
      },
    ],
  });

  return { ...budget, ...pricing, inputBytes, maximumRequestCostUsd, reservationId };
}

export async function recordOpenRouterUsage({ apiKey, model, usage, reservationId }) {
  const budget = await inspectBudget(apiKey);
  const reportedCost = Number(usage?.cost);
  const requests = [
    ...budget.ledger.requests,
    {
      at: new Date().toISOString(),
      model,
      cost: Number.isFinite(reportedCost) ? reportedCost : null,
      promptTokens: usage?.prompt_tokens ?? null,
      completionTokens: usage?.completion_tokens ?? null,
    },
  ];
  const ledger = {
    ...budget.ledger,
    lastKeyUsage: budget.currentKeyUsage,
    requests,
    reservations: budget.ledger.reservations.filter(
      (reservation) => reservation.id !== reservationId,
    ),
  };
  await saveLedger(ledger);
  const recordedSpentUsd = requests.reduce(
    (total, request) => total + (Number.isFinite(request.cost) ? request.cost : 0),
    0,
  );
  const reservedUsd = ledger.reservations.reduce(
    (total, reservation) => total + reservation.maximumRequestCostUsd,
    0,
  );
  const spentUsd = Math.max(budget.remoteSpentUsd, recordedSpentUsd) + reservedUsd;
  return {
    ...budget,
    ledger,
    recordedSpentUsd,
    reservedUsd,
    spentUsd,
    remainingUsd: Math.max(0, OPENROUTER_HARD_BUDGET_USD - spentUsd),
  };
}
