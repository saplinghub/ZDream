import type { ItemCategory } from '@/types'

export interface SeedItem {
  name: string
  cat: ItemCategory
  price: number
  pinyin?: string
  note?: string
}

export const PRESET_ITEMS: SeedItem[] = [
  // ── 兽诀与内丹 ──
  { name: '高级魔兽要诀', cat: '兽诀', price: 35000000, pinyin: 'gjmsyj', note: '高兽诀' },
  { name: '高级必杀', cat: '兽诀', price: 42000000, pinyin: 'gjbs' },
  { name: '高级偷袭', cat: '兽诀', price: 38000000, pinyin: 'gjtx' },
  { name: '高级吸血', cat: '兽诀', price: 28000000, pinyin: 'gjxx' },
  { name: '高级夜战', cat: '兽诀', price: 26000000, pinyin: 'gjyz' },
  { name: '高级连击', cat: '兽诀', price: 22000000, pinyin: 'gjlj' },
  { name: '高级神佑复生', cat: '兽诀', price: 32000000, pinyin: 'gjsyfs' },
  { name: '高级魔之心', cat: '兽诀', price: 24000000, pinyin: 'gjmzx' },
  { name: '高级法术暴击', cat: '兽诀', price: 25000000, pinyin: 'gjfsbj' },
  { name: '高级法术波动', cat: '兽诀', price: 23000000, pinyin: 'gjfsbd' },
  { name: '低级魔兽要诀', cat: '兽诀', price: 650000, pinyin: 'djmsyj' },
  { name: '必杀', cat: '兽诀', price: 2500000, pinyin: 'bs' },
  { name: '偷袭', cat: '兽诀', price: 2200000, pinyin: 'tx' },
  { name: '夜战', cat: '兽诀', price: 1800000, pinyin: 'yz' },
  { name: '吸血', cat: '兽诀', price: 1500000, pinyin: 'xx' },
  { name: '连击', cat: '兽诀', price: 1200000, pinyin: 'lj' },
  { name: '高级内丹', cat: '兽诀', price: 12000000, pinyin: 'gjnd' },
  { name: '催心浪', cat: '兽诀', price: 18000000, pinyin: 'cxl' },
  { name: '舍身击', cat: '兽诀', price: 15000000, pinyin: 'ssj' },
  { name: '迅敏', cat: '兽诀', price: 1200000, pinyin: 'xm' },
  { name: '狂怒', cat: '兽诀', price: 800000, pinyin: 'kn' },
  { name: '静岳', cat: '兽诀', price: 600000, pinyin: 'jy' },

  // ── 宝石与星辉石 ──
  { name: '红玛瑙', cat: '宝石', price: 85000, pinyin: 'hmn', note: '1级红玛瑙' },
  { name: '舍利子', cat: '宝石', price: 80000, pinyin: 'slz' },
  { name: '太阳石', cat: '宝石', price: 75000, pinyin: 'tys' },
  { name: '月亮石', cat: '宝石', price: 90000, pinyin: 'yls' },
  { name: '黑宝石', cat: '宝石', price: 110000, pinyin: 'hbs' },
  { name: '光芒石', cat: '宝石', price: 70000, pinyin: 'gms' },
  { name: '翡翠石', cat: '宝石', price: 30000, pinyin: 'fcs' },
  { name: '昆仑玉', cat: '宝石', price: 35000, pinyin: 'kly' },
  { name: '神秘石', cat: '宝石', price: 20000, pinyin: 'sms' },
  { name: '星辉石', cat: '宝石', price: 150000, pinyin: 'xhs', note: '1级星辉石' },

  // ── 道具与消耗品 ──
  { name: '金柳露', cat: '消耗品', price: 120000, pinyin: 'jll', note: 'C61 / 66' },
  { name: '超级金柳露', cat: '消耗品', price: 380000, pinyin: 'cjjll', note: 'C66' },
  { name: '净瓶玉露', cat: '消耗品', price: 220000, pinyin: 'jpyl', note: 'C61' },
  { name: '强化石', cat: '道具', price: 80000, pinyin: 'qhs' },
  { name: '青龙石', cat: '道具', price: 75000, pinyin: 'qls' },
  { name: '朱雀石', cat: '道具', price: 75000, pinyin: 'zqs' },
  { name: '白虎石', cat: '道具', price: 75000, pinyin: 'bhs' },
  { name: '玄武石', cat: '道具', price: 75000, pinyin: 'xws' },
  { name: '附魔宝珠', cat: '道具', price: 12000000, pinyin: 'fmbz' },
  { name: '珍珠', cat: '道具', price: 350000, pinyin: 'zz', note: '100-130珍珠' },
  { name: '摇钱树苗', cat: '道具', price: 450000, pinyin: 'yqsm' },
  { name: '飞行符', cat: '消耗品', price: 500, pinyin: 'fxf' },
  { name: '合成旗', cat: '消耗品', price: 75000, pinyin: 'hcq' },
  { name: '炼妖石', cat: '道具', price: 150000, pinyin: 'lys' },
  { name: '九转金丹', cat: '消耗品', price: 80000, pinyin: 'jzjd' },
  { name: '修业点', cat: '道具', price: 1000, pinyin: 'xyd' },

  // ── 环装与装备 ──
  { name: '60级环装武器', cat: '装备', price: 160000, pinyin: '60hzwq' },
  { name: '70级环装武器', cat: '装备', price: 180000, pinyin: '70hzwq' },
  { name: '80级环装武器', cat: '装备', price: 420000, pinyin: '80hzwq' },
  { name: '60级环装防具', cat: '装备', price: 140000, pinyin: '60hzfj' },
  { name: '70级环装防具', cat: '装备', price: 160000, pinyin: '70hzfj' },
  { name: '80级环装防具', cat: '装备', price: 380000, pinyin: '80hzfj' },
  { name: '100级未鉴定武器', cat: '装备', price: 1800000, pinyin: '100wjdwq' },
  { name: '120级未鉴定武器', cat: '装备', price: 3500000, pinyin: '120wjdwq' },
  { name: '140级未鉴定武器', cat: '装备', price: 8500000, pinyin: '140wjdwq' },

  // ── 灵饰与制造书铁 ──
  { name: '灵饰指南书', cat: '道具', price: 2500000, pinyin: 'lszns' },
  { name: '元灵晶石', cat: '道具', price: 1200000, pinyin: 'yljs' },
  { name: '百炼精铁', cat: '道具', price: 500000, pinyin: 'bljt' },
  { name: '制造指南书', cat: '道具', price: 3000000, pinyin: 'zzzns' },

  // ── 师门与三药家具 ──
  { name: '九转还魂丹', cat: '消耗品', price: 35000, pinyin: 'jzhhd', note: '三级药' },
  { name: '金创药', cat: '消耗品', price: 15000, pinyin: 'jcy' },
  { name: '蛇胆酒', cat: '消耗品', price: 25000, pinyin: 'sdj' },
  { name: '高品三药', cat: '消耗品', price: 45000, pinyin: 'gpsy' },
  { name: '一级家具', cat: '道具', price: 25000, pinyin: 'yjjj' },
  { name: '二级家具', cat: '道具', price: 65000, pinyin: 'erjjj' },
  { name: '三级家具', cat: '道具', price: 180000, pinyin: 'sjjj' },
  { name: '长寿面', cat: '消耗品', price: 35000, pinyin: 'csm' },
  { name: '醉生梦死', cat: '消耗品', price: 45000, pinyin: 'zsms' },
  { name: '低级师门野生召唤兽', cat: '宠装', price: 8000, pinyin: 'djsmyszhs' },
  { name: '中级师门野生召唤兽', cat: '宠装', price: 15000, pinyin: 'zjsmyszhs' },
  { name: '高级师门野生召唤兽', cat: '宠装', price: 25000, pinyin: 'gjsmyszhs' },
]
