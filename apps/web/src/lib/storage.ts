/**
 * localStorage guarded against environments where access throws
 * (iOS Safari "Block All Cookies", quota exhaustion, private windows).
 */
export function storageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function storageSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // best-effort persistence
  }
}
