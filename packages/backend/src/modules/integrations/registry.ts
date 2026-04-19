import type { IntegrationAdapter, IntegrationProvider } from "./types";
import { telegramIntegrationAdapter } from "./providers/telegram";

const registry = new Map<IntegrationProvider, IntegrationAdapter>([
  ["telegram", telegramIntegrationAdapter],
]);

export const getIntegrationAdapter = (provider: IntegrationProvider) => {
  const adapter = registry.get(provider);
  if (!adapter) {
    throw new Error(`Unsupported integration provider: ${provider}`);
  }

  return adapter;
};
