/** Minimal logger so fake adapters can record activity without pulling in pino. */
export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
}

export const noopLogger: Logger = {
  debug: () => undefined,
};

export const consoleLogger: Logger = {
  debug: (message, meta) => {
    // eslint-disable-next-line no-console
    console.debug(`[integrations] ${message}`, meta ?? {});
  },
};
