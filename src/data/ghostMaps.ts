export interface GhostMapItem {
  name: string
  aliases: string[]
  routeGuide: string
  maxWidth: number
  maxHeight: number
  entryPos: { x: number; y: number }
  bgTheme: string
  mapImgUrl?: string
}

export const GHOST_MAPS: GhostMapItem[] = [
  {
    name: '傲来国',
    aliases: ['al', 'aolai', 'algn'],
    routeGuide: '✈️ 飞行符直达傲来国（中心 100,70）/ 导标旗（客栈/车夫/女儿村入口）',
    maxWidth: 220,
    maxHeight: 150,
    entryPos: { x: 100, y: 70 },
    bgTheme: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)',
    mapImgUrl: '/maps/傲来国.jpg',
  },
  {
    name: '长安城',
    aliases: ['ca', 'changan', 'cagn'],
    routeGuide: '✈️ 飞行符直达长安城 / 导标旗（驿站/擂台/酒店/大唐官府/化生寺/国境入口）',
    maxWidth: 540,
    maxHeight: 270,
    entryPos: { x: 270, y: 135 },
    bgTheme: 'linear-gradient(135deg, #78350f 0%, #451a03 100%)',
  },
  {
    name: '建邺城',
    aliases: ['jy', 'jianye', 'jycn', '建业城', 'jyc'],
    routeGuide: '✈️ 飞行符直达建邺城（中心 110,75）/ 导标旗（衙门/海产店）',
    maxWidth: 280,
    maxHeight: 140,
    entryPos: { x: 110, y: 75 },
    bgTheme: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)',
    mapImgUrl: '/maps/建邺城.jpg',
  },
  {
    name: '朱紫国',
    aliases: ['zz', 'zhuzi', 'zzg'],
    routeGuide: '✈️ 飞行符直达朱紫国 / 导标旗（酒店/皇宫/境外入口/麒麟山入口）',
    maxWidth: 180,
    maxHeight: 110,
    entryPos: { x: 90, y: 55 },
    bgTheme: 'linear-gradient(135deg, #92400e 0%, #713f12 100%)',
  },
  {
    name: '宝象国',
    aliases: ['bx', 'baoxiang', 'bxg'],
    routeGuide: '✈️ 飞行符直达宝象国（中心 90,60）',
    maxWidth: 160,
    maxHeight: 120,
    entryPos: { x: 90, y: 60 },
    bgTheme: 'linear-gradient(135deg, #854d0e 0%, #53380b 100%)',
  },
  {
    name: '西梁女国',
    aliases: ['xl', 'xiliang', 'xlng'],
    routeGuide: '✈️ 飞行符直达西梁女国（中心 80,70）',
    maxWidth: 160,
    maxHeight: 140,
    entryPos: { x: 80, y: 70 },
    bgTheme: 'linear-gradient(135deg, #831843 0%, #500724 100%)',
    mapImgUrl: '/maps/西梁女国.jpg',
  },
  {
    name: '长寿村',
    aliases: ['cs', 'changshou', 'csc'],
    routeGuide: '✈️ 飞行符直达长寿村 / 导标旗（方寸入口/郊外入口/酒店）',
    maxWidth: 160,
    maxHeight: 210,
    entryPos: { x: 80, y: 100 },
    bgTheme: 'linear-gradient(135deg, #14532d 0%, #052e16 100%)',
    mapImgUrl: '/maps/长寿村.jpg',
  },
  {
    name: '江南野外',
    aliases: ['yw', 'yewai', 'jnyw', '野外'],
    routeGuide: '🚩 建邺城西门 / 长安东门 传送进入江南野外',
    maxWidth: 160,
    maxHeight: 120,
    entryPos: { x: 10, y: 10 },
    bgTheme: 'linear-gradient(135deg, #15803d 0%, #052e16 100%)',
    mapImgUrl: '/maps/江南野外.jpg',
  },
  {
    name: '墨家村',
    aliases: ['mj', 'mojia', 'mjc'],
    routeGuide: '🚩 朱紫国导标旗 ➔ 墨家村入口 (14, 10) 传送进入墨家村',
    maxWidth: 90,
    maxHeight: 110,
    entryPos: { x: 14, y: 10 },
    bgTheme: 'linear-gradient(135deg, #3f3f46 0%, #18181b 100%)',
  },
  {
    name: '大唐境外',
    aliases: ['zw', 'jingwai', 'dtjw'],
    routeGuide: '🚩 朱紫国出境外（东部 500,60）或 长安驿站出国境转境外（西部 20,180）',
    maxWidth: 630,
    maxHeight: 120,
    entryPos: { x: 500, y: 60 },
    bgTheme: 'linear-gradient(135deg, #713f12 0%, #451a03 100%)',
  },
  {
    name: '大唐郊外',
    aliases: ['jw', 'jiaowai', 'dtjw2'],
    routeGuide: '🚩 长安城东门 (280, 10) 传送进入大唐郊外',
    maxWidth: 190,
    maxHeight: 130,
    entryPos: { x: 10, y: 20 },
    bgTheme: 'linear-gradient(135deg, #166534 0%, #14532d 100%)',
  },
  {
    name: '大唐国境',
    aliases: ['gj', 'guojing', 'dtgj'],
    routeGuide: '🚩 长安城南门 / 驿站导标旗 传送大唐国境',
    maxWidth: 350,
    maxHeight: 340,
    entryPos: { x: 10, y: 330 },
    bgTheme: 'linear-gradient(135deg, #581c87 0%, #3b0764 100%)',
  },
  {
    name: '五庄观',
    aliases: ['wz', 'wuzhuang', 'wzg'],
    routeGuide: '🚩 大唐境外 (60, 40) 传送进入五庄观',
    maxWidth: 100,
    maxHeight: 90,
    entryPos: { x: 10, y: 10 },
    bgTheme: 'linear-gradient(135deg, #15803d 0%, #14532d 100%)',
    mapImgUrl: '/maps/五庄观.jpg',
  },
  {
    name: '阴曹地府',
    aliases: ['df', 'difu', 'ycdf'],
    routeGuide: '🚩 长安驿站 ➔ 大唐国境 (60, 70) 传送进入阴曹地府',
    maxWidth: 150,
    maxHeight: 120,
    entryPos: { x: 60, y: 70 },
    bgTheme: 'linear-gradient(135deg, #311042 0%, #1e092b 100%)',
  },
  {
    name: '女儿村',
    aliases: ['ne', 'nuer', 'nec'],
    routeGuide: '🚩 傲来国 ➔ 找【许小娘】(5, 140) 传送进入女儿村',
    maxWidth: 120,
    maxHeight: 140,
    entryPos: { x: 5, y: 140 },
    bgTheme: 'linear-gradient(135deg, #9d174d 0%, #500724 100%)',
    mapImgUrl: '/maps/女儿村.jpg',
  },
  {
    name: '盘丝洞',
    aliases: ['ps', 'pansi', 'psd'],
    routeGuide: '🚩 大唐境外 ➔ 盘丝洞入口 (530, 100) 传送进入盘丝洞',
    maxWidth: 200,
    maxHeight: 140,
    entryPos: { x: 10, y: 10 },
    bgTheme: 'linear-gradient(135deg, #4c1d95 0%, #2e1065 100%)',
  },
  {
    name: '狮驼岭',
    aliases: ['st', 'shituo', 'stl'],
    routeGuide: '🚩 大唐境外 ➔ 狮驼岭入口 (10, 80) 传送进入狮驼岭',
    maxWidth: 130,
    maxHeight: 110,
    entryPos: { x: 120, y: 10 },
    bgTheme: 'linear-gradient(135deg, #701a75 0%, #4a044e 100%)',
  },
  {
    name: '普陀山',
    aliases: ['pt', 'putuo', 'pts'],
    routeGuide: '🚩 大唐国境 ➔ 潮音洞入口 (220, 60) 传送进入普陀山',
    maxWidth: 100,
    maxHeight: 120,
    entryPos: { x: 10, y: 10 },
    bgTheme: 'linear-gradient(135deg, #047857 0%, #064e3b 100%)',
    mapImgUrl: '/maps/普陀山.jpg',
  },
  {
    name: '长寿郊外',
    aliases: ['cj', 'csjiaowai', 'csjw'],
    routeGuide: '✈️ 长寿村导标旗 ➔ 出长寿郊外',
    maxWidth: 180,
    maxHeight: 190,
    entryPos: { x: 10, y: 180 },
    bgTheme: 'linear-gradient(135deg, #14532d 0%, #052e16 100%)',
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

/** 拼音简拼/中文全文本快速查找地图 */
export function findGhostMap(input: string): GhostMapItem | null {
  const clean = input.trim().toLowerCase()
  if (!clean) return null

  // 1. 优先完全匹配或相互包含
  const match = GHOST_MAPS.find((m) => {
    const nameLower = m.name.toLowerCase()
    if (clean === nameLower) return true
    if (clean.includes(nameLower)) return true
    if (nameLower.includes(clean)) return true
    if (m.aliases.some((a) => clean === a || clean.includes(a) || a.includes(clean))) return true
    return false
  })

  return match || null
}
