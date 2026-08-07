import type { Component } from 'vue'
import type { VoiceCapability } from '@/voice/types'

/**
 * 玩法插件接口
 * 每个玩法（师门/抓鬼/副本/炼妖…）实现此接口后注册到 registry
 */
export interface ActivityPlugin {
  /** 唯一标识，如 'ghost-hunt' */
  readonly id: string
  /** 显示名称 */
  readonly name: string
  /** 小图标 SVG */
  readonly icon: string

  /** 悬浮窗展开态迷你面板（必填） */
  readonly floatComponent: Component | (() => Promise<Component>)

  /** 主窗口完整功能页（可选，无则路由不注册） */
  readonly mainComponent?: Component | (() => Promise<Component>)

  /** 收起态悬浮球显示的文字（默认使用 name 首字） */
  readonly ballText?: string

  /**
   * 收起态悬浮球下方动态摘要。
   * 返回 null 表示不显示摘要行。
   */
  summary?: () => string | null

  /**
   * 语音能力声明（可选）：本玩法支持的语音意图。
   * 实现后 initVoice() 会自动收集注册，语音命令即可路由到该玩法。
   */
  readonly voice?: VoiceCapability
}
