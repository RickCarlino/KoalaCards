export type EnvErrorHandler = (message: string) => void;

function missingEnvMessage(name: string) {
  return `Missing ENV Var: ${name}`;
}

function invalidJsonMessage(name: string) {
  return `Invalid JSON in ENV Var: ${name}`;
}

export function requireEnv(
  name: string,
  onError?: EnvErrorHandler,
): string {
  const value = process.env[name];
  if (!value) {
    const message = missingEnvMessage(name);
    onError?.(message);
    throw new Error(message);
  }
  return value;
}

export function parseJsonEnv(
  name: string,
  onError?: EnvErrorHandler,
): unknown {
  const raw = requireEnv(name, onError);
  try {
    return JSON.parse(raw);
  } catch {
    const message = invalidJsonMessage(name);
    onError?.(message);
    throw new Error(message);
  }
}

export function parseOptionalJsonEnv(
  name: string,
  onError?: EnvErrorHandler,
): unknown | undefined {
  const raw = process.env[name];
  if (!raw) {
    return undefined;
  }
  try {
    return JSON.parse(raw);
  } catch {
    const message = invalidJsonMessage(name);
    onError?.(message);
    throw new Error(message);
  }
}
