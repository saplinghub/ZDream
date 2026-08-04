import fs from 'fs'
import path from 'path'

const csvPath = '/Users/sapling/Downloads/梦幻西游/梦幻道具/mhhz_trader_items.csv'
const targetPath = '/Users/sapling/tool/vs_code_project/vue/ZDream/src/data/seedItems.ts'

const rawCsv = fs.readFileSync(csvPath, 'utf8')
const lines = rawCsv.split('\n').filter((l) => l.trim())

// 别称硬核映射字典
const CUSTOM_ALIASES = {
  金柳露: ['66', 'jll', '666'],
  超级金柳露: ['c66', 'cjjll', 'C66'],
  强化石: ['qhs', 'qianghua'],
  修炼果: ['xlg', 'xiulian'],
  金刚石: ['jgs', 'wb', '五宝'],
  定魂珠: ['dhz', 'wb', '五宝'],
  夜光珠: ['ygz', 'wb', '五宝'],
  避水珠: ['bsz', 'wb', '五宝'],
  龙鳞: ['ll', 'wb', '五宝'],
  特赦令牌: ['tslp', 'lp', '牌子'],
  低级魔兽要诀: ['djmsyj', 'dichou', '低兽诀', 'sj'],
  高级魔兽要诀: ['gjmsyj', 'gaoshoujue', '高兽诀', 'gjsj', 'gsj'],
  高级必杀: ['gjbs', 'gaobi', '高必'],
  高级偷袭: ['gjtx', 'gaotou', '高偷'],
  高级吸血: ['gjxx', 'gaoxi', '高吸'],
  高级连击: ['gjlj', 'gaolian', '高连'],
  高级神佑复生: ['gjsy', 'gaoshen', '高神'],
  高级法术波动: ['gjbo', 'gaobo', '高波'],
  高级法术暴击: ['gjbao', 'gaobao', '高爆'],
  高级魔之心: ['gjmo', 'gaomo', '高魔'],
  高级法术连击: ['gjfalian', '高法连'],
  催心浪: ['cxl'],
  迅敏: ['xm'],
  狂怒: ['kn'],
  阴伤: ['ys'],
  静岳: ['jy'],
  矫健: ['jj'],
  灵光: ['lg'],
  '60级武器': ['60wq', '60hzwq', '60环'],
  '70级武器': ['70wq', '70hzwq', '70环'],
  '80级武器': ['80wq', '80hzwq', '80环'],
  '60级防具': ['60fj', '60hzfj', '60环'],
  '70级防具': ['70fj', '70hzfj', '70环'],
  '80级防具': ['80fj', '80hzfj', '80环'],
  红玛瑙: ['hmn', 'bs', '宝石'],
  黑宝石: ['hbs', 'bs', '宝石'],
  太阳石: ['tys', 'bs', '宝石'],
  舍利子: ['slz', 'bs', '宝石'],
  月亮石: ['yls', 'bs', '宝石'],
  光芒石: ['gms', 'bs', '宝石'],
  星辉石: ['xhs', 'bs', '宝石'],
  珍珠: ['zz'],
  彩果: ['cg'],
  摇钱树苗: ['yqsm', 'sm', '树苗'],
  高级清灵仙露: ['gjqlxl', 'gxl', '高仙露'],
  中级清灵仙露: ['zjqlxl', 'zxl'],
  九转金丹: ['jzjd', 'jindan', '金丹'],
  金香玉: ['jxy', '3y', '三药'],
  百岁香: ['bsx'],
  海马: ['hm'],
  金银锦盒: ['jyjh', 'jh', '锦盒'],
}

// 简单生成汉字拼音首字母逻辑 (兜底常用字)
function getFirstLetters(str) {
  const pinyinMap = {
    金: 'j',
    柳: 'l',
    露: 'l',
    超: 'c',
    级: 'j',
    强: 'q',
    化: 'h',
    石: 's',
    修: 'x',
    炼: 'l',
    果: 'g',
    刚: 'g',
    定: 'd',
    魂: 'h',
    珠: 'z',
    夜: 'y',
    光: 'g',
    避: 'b',
    水: 's',
    龙: 'l',
    鳞: 'l',
    特: 't',
    赦: 's',
    令: 'l',
    牌: 'p',
    魔: 'm',
    兽: 's',
    要: 'y',
    诀: 'j',
    低: 'd',
    高: 'g',
    必: 'b',
    杀: 's',
    偷: 't',
    袭: 'x',
    吸: 'x',
    连: 'l',
    击: 'j',
    神: 's',
    佑: 'y',
    复: 'f',
    生: 's',
    波: 'b',
    动: 'd',
    暴: 'b',
    心: 'x',
    催: 'c',
    浪: 'l',
    迅: 'x',
    敏: 'm',
    狂: 'k',
    怒: 'n',
    阴: 'y',
    伤: 's',
    静: 'j',
    岳: 'y',
    矫: 'j',
    健: 'j',
    灵: 'l',
    武: 'w',
    器: 'q',
    防: 'f',
    具: 'j',
    红: 'h',
    玛: 'm',
    瑙: 'n',
    黑: 'h',
    宝: 'b',
    太: 't',
    阳: 'y',
    舍: 's',
    利: 'l',
    子: 'z',
    月: 'y',
    亮: 'l',
    光: 'g',
    芒: 'm',
    星: 'x',
    辉: 'h',
    珍: 'z',
    彩: 'c',
    树: 's',
    苗: 'm',
    清: 'q',
    仙: 'x',
    九: 'j',
    转: 'z',
    丹: 'd',
    香: 'x',
    玉: 'y',
    百: 'b',
    岁: 's',
    海: 'h',
    马: 'm',
    银: 'y',
    锦: 'j',
    盒: 'h',
  }
  let res = ''
  for (const char of str) {
    if (/[a-zA-Z0-9]/.test(char)) {
      res += char.toLowerCase()
    } else if (pinyinMap[char]) {
      res += pinyinMap[char]
    }
  }
  return res ? [res] : []
}

const items = []
const header = lines[0].split(',')

for (let i = 1; i < lines.length; i++) {
  const line = lines[i]
  const cols = line.split(',')
  if (cols.length < 5) continue

  const name = cols[1]?.trim()
  const cat = cols[3]?.trim() || '杂货'
  const rawPrice = cols[5]?.trim()
  const iconFile = cols[7]?.trim()

  if (!name) continue

  // 价格转化万两 -> 实际数额或万两
  let price = 0
  if (rawPrice && !isNaN(Number(rawPrice))) {
    price = Number(rawPrice) * 10000
  }

  // 补全别名
  const setAliases = new Set(CUSTOM_ALIASES[name] || [])
  const generatedAcronym = getFirstLetters(name)
  generatedAcronym.forEach((a) => setAliases.add(a))

  // 如果图标存在，加上图标路径
  let iconUrl = ''
  if (iconFile) {
    iconUrl = `/item-icons/${iconFile}`
  }

  items.push({
    name,
    cat,
    price,
    iconUrl: iconUrl || undefined,
    aliases: Array.from(setAliases),
  })
}

// 写入 seedItems.ts
const content = `import type { ItemDict } from '@/types'

/** 梦幻西游全量预设道具库 (含图标路径与极速别称/拼音简拼) */
export const PRESET_ITEMS: ItemDict[] = ${JSON.stringify(items, null, 2)}
`

fs.writeFileSync(targetPath, content, 'utf8')
console.log(`Successfully generated ${items.length} items to seedItems.ts`)
