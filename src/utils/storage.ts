import {
  platformGetItemSync,
  platformRemoveItemSync,
  platformSetItemSync,
} from '@/platform/desktop'

const PREFIX = 'mhxy-zdream:'

export function storageKey(key: string) {
  return PREFIX + key
}

export function loadJson<T>(key: string, fallback: T): T {
  const v = platformGetItemSync<T>(PREFIX + key)
  if (v == null) return fallback
  return v
}

export function saveJson(key: string, value: unknown) {
  platformSetItemSync(PREFIX + key, value)
}

export function removeKey(key: string) {
  platformRemoveItemSync(PREFIX + key)
}

export const STORAGE_KEYS = {
  accounts: 'accounts',
  items: 'items',
  templates: 'templates',
  records: 'records',
  listings: 'listings',
  sessions: 'sessions',
  settings: 'settings',
  events: 'events',
  bootstrapped: 'bootstrapped',
} as const

export function allPrefixedStorageKeys(): string[] {
  return Object.values(STORAGE_KEYS).map((k) => PREFIX + k)
}
