export interface GhostMapItem {
  name: string
  aliases: string[]
  routeGuide: string
}

export const GHOST_MAPS: GhostMapItem[] = [
  {
    name: '傲来国',
    aliases: ['al', 'aolai', 'algn'],
    routeGuide: '✈️ 飞行符直达傲来国（中心 100,70）/ 导标旗（客栈/车夫/女儿村入口）',
  },
  {
    name: '长安城',
    aliases: ['ca', 'changan', 'cagn'],
    routeGuide: '✈️ 飞行符直达长安城 / 导标旗（驿站/擂台/酒店/大唐官府/化生寺/国境入口）',
  },
  {
    name: '建邺城',
    aliases: ['jy', 'jianye', 'jycn'],
    routeGuide: '✈️ 飞行符直达建邺城（中心 60,80）/ 导标旗（衙门/海产店）',
  },
  {
    name: '朱紫国',
    aliases: ['zz', 'zhuzi', 'zzg'],
    routeGuide: '✈️ 飞行符直达朱紫国 / 导标旗（酒店/皇宫/境外入口/麒麟山入口）',
  },
  {
    name: '宝象国',
    aliases: ['bx', 'baoxiang', 'bxg'],
    routeGuide: '✈️ 飞行符直达宝象国（中心 90,60）',
  },
  {
    name: '西梁女国',
    aliases: ['xl', 'xiliang', 'xlng'],
    routeGuide: '✈️ 飞行符直达西梁女国（中心 80,70）',
  },
  {
    name: '长寿村',
    aliases: ['cs', 'changshou', 'csc'],
    routeGuide: '✈️ 飞行符直达长寿村 / 导标旗（方寸入口/郊外入口/酒店）',
  },
  {
    name: '墨家村',
    aliases: ['mj', 'mojia', 'mjc'],
    routeGuide: '🚩 朱紫国导标旗 ➔ 墨家村入口 (14, 10) 传送进入墨家村',
  },
  {
    name: '大唐境外',
    aliases: ['zw', 'jingwai', 'dtjw'],
    routeGuide: '🚩 朱紫国出境外（东部 500,60）或 长安驿站出国境转境外（西部 20,180）',
  },
  {
    name: '大唐郊外',
    aliases: ['jw', 'jiaowai', 'dtjw2'],
    routeGuide: '🚩 长安城东门 (280, 10) 传送进入大唐郊外',
  },
  {
    name: '大唐国境',
    aliases: ['gj', 'guojing', 'dtgj'],
    routeGuide: '🚩 长安城南门 / 驿站导标旗 传送大唐国境',
  },
  {
    name: '五庄观',
    aliases: ['wz', 'wuzhuang', 'wzg'],
    routeGuide: '🚩 大唐境外 (60, 40) 传送进入五庄观',
  },
  {
    name: '阴曹地府',
    aliases: ['df', 'difu', 'ycdf'],
    routeGuide: '🚩 长安驿站 ➔ 大唐国境 (60, 70) 传送进入阴曹地府',
  },
  {
    name: '女儿村',
    aliases: ['ne', 'nuer', 'nec'],
    routeGuide: '🚩 傲来国 ➔ 找【许小娘】(5, 140) 传送进入女儿村',
  },
  {
    name: '盘丝洞',
    aliases: ['ps', 'pansi', 'psd'],
    routeGuide: '🚩 大唐境外 ➔ 盘丝洞入口 (530, 100) 传送进入盘丝洞',
  },
  {
    name: '狮驼岭',
    aliases: ['st', 'shituo', 'stl'],
    routeGuide: '🚩 大唐境外 ➔ 狮驼岭入口 (10, 80) 传送进入狮驼岭',
  },
  {
    name: '普陀山',
    aliases: ['pt', 'putuo', 'pts'],
    routeGuide: '🚩 大唐国境 ➔ 潮音洞入口 (220, 60) 传送进入普陀山',
  },
  {
    name: '长寿郊外',
    aliases: ['cj', 'csjiaowai', 'csjw'],
    routeGuide: '✈️ 长寿村导标旗 ➔ 出长寿郊外',
  },
]

export interface GhostTactics {
  type: '血鬼' | '防鬼' | '敏鬼' | '法鬼' | '未知'
  badgeColor: string
  title: string
  desc: string
}

export const GHOST_TACTICS_MAP: Record<string, GhostTactics> = {
  血鬼: {
    type: '血鬼',
    badgeColor: '#ef4444', // 红色
    title: '🔴 血鬼 (高血量·低物理防御)',
    desc: '主怪血量极高防御较低！大唐/凌波破血狂攻，攻宠集火主怪，法系打小怪。',
  },
  防鬼: {
    type: '防鬼',
    badgeColor: '#3b82f6', // 蓝色
    title: '🔵 防鬼/壳鬼 (极高物防·极低HP)',
    desc: '主怪极高物防，物理攻击个位数！法系/固伤秒主，物理系玩家打小怪/防守。',
  },
  敏鬼: {
    type: '敏鬼',
    badgeColor: '#eab308', // 黄色
    title: '🟡 敏鬼 (高速度·先手攻击)',
    desc: '主怪出手速度极快！推荐封系控制或输出集中爆破点杀。',
  },
  法鬼: {
    type: '法鬼',
    badgeColor: '#a855f7', // 紫色
    title: '🟣 法鬼/鬼王 (高群法伤害)',
    desc: '主怪频繁施展雷/火高级群法！推荐罗汉金钟/辅助回复，低法防召唤兽防守。',
  },
  未知: {
    type: '未知',
    badgeColor: '#6b7280',
    title: '⚪ 普通鬼怪',
    desc: '根据怪的造型判定抗性，灵活切换攻法输出。',
  },
}

/** 拼音简拼快速查找地图 */
export function findGhostMap(input: string): GhostMapItem | null {
  const clean = input.trim().toLowerCase()
  if (!clean) return null

  // 1. 完全匹配地图名称
  const exact = GHOST_MAPS.find((m) => m.name === clean || m.name.includes(clean))
  if (exact) return exact

  // 2. 拼音简拼匹配 (如 al, ca, zw, wz)
  const byAlias = GHOST_MAPS.find((m) => m.aliases.includes(clean))
  if (byAlias) return byAlias

  return null
}
