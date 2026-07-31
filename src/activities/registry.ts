import type { ActivityPlugin } from './types'

const registry = new Map<string, ActivityPlugin>()

export function registerActivity(plugin: ActivityPlugin): void {
  if (registry.has(plugin.id)) {
    console.warn(`[activity] "${plugin.id}" 已注册，将被覆盖`)
  }
  registry.set(plugin.id, plugin)
}

export function getActivity(id: string): ActivityPlugin | undefined {
  return registry.get(id)
}

export function getAllActivities(): ActivityPlugin[] {
  return Array.from(registry.values())
}

export function getActivityIds(): string[] {
  return Array.from(registry.keys())
}
