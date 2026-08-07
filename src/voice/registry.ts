/**
 * 语音命令扩展注册表
 * 未来新玩法通过 ActivityPlugin.voice 声明语音能力，initVoice() 自动注册到此表，
 * executor 的 default 分支按意图类型查询并分发到其自定义 execute。
 */
import type { VoiceCommand, VoiceIntentType } from './types'

const voiceCommands = new Map<VoiceIntentType, VoiceCommand>()

export function registerVoiceCommand(cmd: VoiceCommand): void {
  if (voiceCommands.has(cmd.intentType)) {
    console.warn(`[voice] intent "${cmd.intentType}" 已注册，将被覆盖`)
  }
  voiceCommands.set(cmd.intentType, cmd)
}

export function getVoiceCommand(type: VoiceIntentType): VoiceCommand | undefined {
  return voiceCommands.get(type)
}

export function getAllVoiceCommands(): VoiceCommand[] {
  return Array.from(voiceCommands.values())
}
