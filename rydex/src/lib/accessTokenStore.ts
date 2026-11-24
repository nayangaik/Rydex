let accessToken: string | null = null;
const listeners = new Set<(token: string | null) => void>();

export function getInMemoryAccessToken() {
  return accessToken;
}

export function setInMemoryAccessToken(token: string | null) {
  accessToken = token;
  listeners.forEach((listener) => listener(token));
}

export function subscribeToAccessToken(listener: (token: string | null) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
