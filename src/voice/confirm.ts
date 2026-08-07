/**
 * 歧义确认状态单例（模块级 ref，悬浮窗内可直接用）
 * 记账/消耗等不可逆操作在"歧义才确认"策略下，高置信直接执行，歧义弹确认条。
 */
import { ref } from 'vue'
import { useAppStore } from '@/stores/app'
import type { ConfirmRequest } from './types'

export const pendingConfirm = ref<ConfirmRequest | null>(null)

export function requestConfirm(req: ConfirmRequest): void {
  pendingConfirm.value = req
}

export function clearConfirm(): void {
  pendingConfirm.value = null
}

/** 用户点击确认/取消；确认后以 force 重放执行，绕过歧义拦截 */
export async function resolveConfirm(confirmed: boolean): Promise<void> {
  const req = pendingConfirm.value
  pendingConfirm.value = null
  if (confirmed && req) {
    const { executeIntent } = await import('./executor')
    await executeIntent({ ...req.intent }, { force: true })
  } else if (req) {
    useAppStore().toast('已取消该笔操作')
  }
}
