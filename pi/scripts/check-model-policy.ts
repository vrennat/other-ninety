import {
	CHEAP_OPENROUTER_MODELS,
	OPENROUTER_PRICE_CAP_USD_PER_MILLION,
} from "../extensions/model-policy";

interface CatalogModel {
	id: string;
	pricing: { prompt: string; completion: string };
}

const endpoint = process.env.OPENROUTER_MODELS_URL ?? "https://openrouter.ai/api/v1/models";
const response = await fetch(endpoint);
if (!response.ok) {
	throw new Error(`OpenRouter catalog request failed: ${response.status} ${response.statusText}`);
}

const payload = (await response.json()) as { data?: CatalogModel[] };
const catalog = new Map((payload.data ?? []).map((model) => [model.id, model]));
const failures: string[] = [];
const formatPrice = (price: number) => Number(price.toFixed(6)).toString();

for (const id of [...CHEAP_OPENROUTER_MODELS].sort()) {
	if (id.startsWith("~") || id.endsWith("-latest")) {
		failures.push(`${id}: moving aliases are not allowed`);
		continue;
	}
	const model = catalog.get(id);
	if (!model) {
		failures.push(`${id}: missing from the OpenRouter catalog`);
		continue;
	}
	const input = Number(model.pricing.prompt) * 1_000_000;
	const output = Number(model.pricing.completion) * 1_000_000;
	if (!Number.isFinite(input) || !Number.isFinite(output)) {
		failures.push(`${id}: invalid catalog pricing`);
		continue;
	}
	if (
		input > OPENROUTER_PRICE_CAP_USD_PER_MILLION.input ||
		output > OPENROUTER_PRICE_CAP_USD_PER_MILLION.output
	) {
		failures.push(`${id}: $${input}/M input, $${output}/M output exceeds the worker cap`);
		continue;
	}
	console.log(`${id}\t$${formatPrice(input)}/M input\t$${formatPrice(output)}/M output`);
}

if (failures.length > 0) {
	for (const failure of failures) console.error(failure);
	process.exitCode = 1;
} else {
	console.log(`delegated-worker model policy OK: ${CHEAP_OPENROUTER_MODELS.size} routes`);
}
