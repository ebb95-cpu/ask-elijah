/**
 * Safari SecurityError-safe wrappers for localStorage and sessionStorage.
 *
 * Raw storage access throws on iOS Safari in these states:
 *   - Settings → Safari → Privacy → "Block All Cookies" on
 *   - Some private-browsing / Lockdown Mode combinations
 *   - Content-blockers that wipe storage per page
 *
 * An uncaught throw inside a mount useEffect crashes the whole React tree
 * to the error boundary — which shows up as the white "Application error:
 * a client-side exception has occurred" screen.
 *
 * Every storage call in the app routes through here instead of touching
 * `localStorage` / `sessionStorage` directly.
 */

function localStore(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function sessionStore(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

export function getLocal(key: string): string | null {
  try {
    return localStore()?.getItem(key) ?? null
  } catch {
    return null
  }
}

export function setLocal(key: string, value: string): void {
  try {
    localStore()?.setItem(key, value)
  } catch {
    /* noop */
  }
}

export function removeLocal(key: string): void {
  try {
    localStore()?.removeItem(key)
  } catch {
    /* noop */
  }
}

export function getSession(key: string): string | null {
  try {
    return sessionStore()?.getItem(key) ?? null
  } catch {
    return null
  }
}

export function setSession(key: string, value: string): void {
  try {
    sessionStore()?.setItem(key, value)
  } catch {
    /* noop */
  }
}

export function removeSession(key: string): void {
  try {
    sessionStore()?.removeItem(key)
  } catch {
    /* noop */
  }
}
