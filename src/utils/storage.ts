import { platformGetItem, platformRemoveItem, platformSetItem } from '@/platform/ztools'

const PREFIX = 'mhxy-zdream:'

export function loadJson<T>(key: string, fallback: T): T {
  const v = platformGetItem<T>(PREFIX + key)
  if (v == null) return fallback
  return v
}

export function saveJson(key: string, value: unknown) {
  platformSetItem(PREFIX + key, value)
}

export function removeKey(key: string) {
  platformRemoveItem(PREFIX + key)
}
