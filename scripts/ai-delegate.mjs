import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  inspectBudget,
  OPENROUTER_HARD_BUDGET_USD,
  preflightOpenRouterRequest,
  recordOpenRouterUsage,
} from "./openrouter-budget.mjs";

const PROVIDERS = {
  openrouter: {
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    keyEnv: "OPENROUTER_API_KEY",
    modelEnv: "OPENROUTER_MODEL",
    defaultModel: "openrouter/auto",
  },
  groq: {
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    keyEnv: "GROQ_API_KEY",
    modelEnv: "GROQ_MODEL",
    defaultModel: "llama-3.3-70b-versatile",
  },
  xai: {
    endpoint: "https://api.x.ai/v1/chat/completions",
    keyEnv: "XAI_API_KEY",
    modelEnv: "XAI_MODEL",
    defaultModel: "grok-4.6",
  },
};

const SECRET_FILE_PATTERN = /(^|\/)(\.env|.*(?:secret|credential|token|key).*)($|\/)/i;
const MAX_CONTEXT_FILE_BYTES = 50_000;
const MAX_CONTEXT_TOTAL_BYTES = 150_000;

function printHelp() {
  console.log(`Использование:
  npm run delegate -- --provider openrouter --task "Проверь решение"
  npm run delegate -- --all --task "Сравни варианты" --context src/file.ts,tests/file.test.ts

Параметры:
  --provider <openrouter|groq|xai>  выбрать одного провайдера
  --all                            спросить всех провайдеров с доступными ключами
  --task <текст>                   задача для модели
  --context <пути через запятую>   явно выбранные файлы проекта
  --model <id>                     переопределить модель (только с --provider)
  --max-tokens <число>             максимум ответа, по умолчанию 2500
  --max-cost <USD>                 максимум одного OpenRouter-запроса, по умолчанию $1
  --reasoning <уровень>            none|minimal|low|medium|high
  --budget-status                  показать расход из жёсткого лимита $15
  --dry-run                        проверить настройки без API-запроса
`);
}

function parseArgs(argv) {
  const options = { context: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--all") options.all = true;
    else if (argument === "--dry-run") options.dryRun = true;
    else if (argument === "--budget-status") options.budgetStatus = true;
    else if (argument === "--help" || argument === "-h") options.help = true;
    else if (["--provider", "--task", "--context", "--model", "--max-tokens", "--max-cost", "--reasoning"].includes(argument)) {
      const value = argv[index + 1];
      if (!value) throw new Error(`Для ${argument} не указано значение.`);
      index += 1;
      if (argument === "--context") {
        options.context.push(...value.split(",").map((item) => item.trim()).filter(Boolean));
      } else {
        const optionName = {
          "max-tokens": "maxTokens",
          "max-cost": "maxCost",
        }[argument.slice(2)] ?? argument.slice(2);
        options[optionName] = value;
      }
    } else {
      throw new Error(`Неизвестный параметр: ${argument}`);
    }
  }

  return options;
}

function resolveProviders(options) {
  if (options.all && options.provider) {
    throw new Error("Используйте либо --all, либо --provider.");
  }

  if (options.model && options.all) {
    throw new Error("--model можно использовать только с одним --provider.");
  }

  const names = options.all ? Object.keys(PROVIDERS) : [options.provider ?? "openrouter"];
  for (const name of names) {
    if (!PROVIDERS[name]) throw new Error(`Неизвестный провайдер: ${name}`);
  }
  return names;
}

async function loadContext(fileNames) {
  const projectRoot = process.cwd();
  let totalBytes = 0;
  const sections = [];

  for (const fileName of fileNames) {
    if (SECRET_FILE_PATTERN.test(fileName)) {
      throw new Error(`Файл с возможным секретом запрещён в контексте: ${fileName}`);
    }

    const absolutePath = path.resolve(projectRoot, fileName);
    const relativePath = path.relative(projectRoot, absolutePath);
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      throw new Error(`Контекст можно брать только из проекта: ${fileName}`);
    }

    const content = await readFile(absolutePath, "utf8");
    const bytes = Buffer.byteLength(content);
    if (bytes > MAX_CONTEXT_FILE_BYTES) {
      throw new Error(`Файл слишком большой для делегирования: ${fileName}`);
    }
    totalBytes += bytes;
    if (totalBytes > MAX_CONTEXT_TOTAL_BYTES) {
      throw new Error("Общий размер контекста превышает 150 КБ.");
    }

    sections.push(`\n--- ${relativePath} ---\n${content}`);
  }

  return sections.join("\n");
}

async function askProvider(name, task, context, modelOverride) {
  const provider = PROVIDERS[name];
  const apiKey = process.env[provider.keyEnv];
  if (!apiKey) {
    return { name, skipped: true, error: `нет переменной ${provider.keyEnv}` };
  }

  const model = modelOverride ?? process.env[provider.modelEnv] ?? provider.defaultModel;
  const maxTokens = Number(globalThis.delegateOptions.maxTokens ?? 2500);
  const requestLimitUsd = Number(globalThis.delegateOptions.maxCost ?? 1);
  const reasoning = globalThis.delegateOptions.reasoning;
  if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 10_000) {
    throw new Error("--max-tokens должен быть целым числом от 1 до 10000.");
  }
  if (!Number.isFinite(requestLimitUsd) || requestLimitUsd <= 0 || requestLimitUsd > OPENROUTER_HARD_BUDGET_USD) {
    throw new Error(`--max-cost должен быть больше 0 и не выше $${OPENROUTER_HARD_BUDGET_USD}.`);
  }
  if (reasoning && !["none", "minimal", "low", "medium", "high"].includes(reasoning)) {
    throw new Error("--reasoning: допустимы none, minimal, low, medium, high.");
  }

  const messages = [
    {
      role: "system",
      content:
        "Ты технический советник проекта Catapult Duel. Дай конкретный, краткий ответ: решение, риски, проверки. Не утверждай, что изменил файлы.",
    },
    {
      role: "user",
      content: context ? `${task}\n\nКонтекст проекта:${context}` : task,
    },
  ];
  const body = {
    model,
    messages,
    temperature: 0.2,
    ...(name === "openrouter" && reasoning
      ? { reasoning: { effort: reasoning, exclude: true } }
      : {}),
    ...(name === "groq" ? { max_completion_tokens: maxTokens } : { max_tokens: maxTokens }),
  };

  let openRouterReservationId;
  if (name === "openrouter") {
    const preflight = await preflightOpenRouterRequest({
      apiKey,
      model,
      messages,
      maxTokens,
      requestLimitUsd,
    });
    openRouterReservationId = preflight.reservationId;
    console.error(
      `[Бюджет] потрачено $${preflight.spentUsd.toFixed(4)} из $${OPENROUTER_HARD_BUDGET_USD.toFixed(2)}; ` +
        `максимум запроса $${preflight.maximumRequestCostUsd.toFixed(4)}`,
    );
  }

  const response = await fetch(provider.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(name === "openrouter" ? { "X-OpenRouter-Title": "Catapult Duel Dev Delegate" } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message ?? `HTTP ${response.status}`;
    throw new Error(`${name}: ${message}`);
  }

  let budget;
  if (name === "openrouter") {
    budget = await recordOpenRouterUsage({
      apiKey,
      model,
      usage: payload.usage,
      reservationId: openRouterReservationId,
    });
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    const finishReason = payload?.choices?.[0]?.finish_reason ?? "не указан";
    const completionTokens = payload?.usage?.completion_tokens ?? "не указаны";
    throw new Error(
      `${name}: API вернул пустой ответ (finish_reason=${finishReason}, completion_tokens=${completionTokens}).`,
    );
  }

  return { name, model, content: content.trim(), usage: payload.usage, budget };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  globalThis.delegateOptions = options;
  if (options.help) {
    printHelp();
    return;
  }
  if (options.budgetStatus) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("Нет переменной OPENROUTER_API_KEY.");
    const budget = await inspectBudget(apiKey);
    console.log(`OpenRouter: $${budget.spentUsd.toFixed(4)} из $${OPENROUTER_HARD_BUDGET_USD.toFixed(2)}.`);
    console.log(`Остаток: $${budget.remainingUsd.toFixed(4)}.`);
    return;
  }
  if (!options.task) throw new Error("Укажите задачу через --task.");

  const providerNames = resolveProviders(options);
  const context = await loadContext(options.context);
  const configured = providerNames.filter((name) => Boolean(process.env[PROVIDERS[name].keyEnv]));

  if (options.dryRun) {
    console.log(`Провайдеры: ${providerNames.join(", ")}`);
    console.log(`С ключами: ${configured.length ? configured.join(", ") : "нет"}`);
    console.log(`Файлов контекста: ${options.context.length}`);
    return;
  }

  if (configured.length === 0) {
    throw new Error("Нет API-ключа ни для одного выбранного провайдера.");
  }

  const results = await Promise.allSettled(
    providerNames.map((name) => askProvider(name, options.task, context, options.model)),
  );

  let successCount = 0;
  for (const result of results) {
    if (result.status === "rejected") {
      console.error(`\n[Ошибка] ${result.reason?.message ?? result.reason}`);
      continue;
    }
    if (result.value.skipped) {
      console.log(`\n[Пропущен ${result.value.name}] ${result.value.error}`);
      continue;
    }
    successCount += 1;
    console.log(`\n=== ${result.value.name} / ${result.value.model} ===\n`);
    console.log(result.value.content);
    if (result.value.usage?.cost != null) {
      console.log(`\n[Стоимость ответа] $${Number(result.value.usage.cost).toFixed(6)}`);
    }
    if (result.value.budget) {
      console.log(`[Остаток бюджета] $${result.value.budget.remainingUsd.toFixed(4)}`);
    }
  }

  if (successCount === 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`Ошибка делегирования: ${error.message}`);
  process.exitCode = 1;
});
