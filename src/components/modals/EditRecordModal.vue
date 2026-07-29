<script setup lang="ts">
import { reactive, watch } from 'vue'
import { useAppStore } from '@/stores/app'

const store = useAppStore()
const form = reactive<Record<string, string | number>>({})

watch(
  () => store.showEditModal,
  (open) => {
    if (!open || !store.editingRecord) return
    const r = store.editingRecord
    const m = r.meta ?? {}
    form.accountId = r.accountId
    if (r.cat === 'game') {
      form.item = (m.item as string) || ''
      form.qty = (m.qty as number) || 1
      form.price = (m.price as number) || 0
      form.io = r.pos ? 'in' : 'out'
      form.sub = (m.sub as string) || ''
      form.note = (m.note as string) || ''
    } else if (r.cat === 'card') {
      form.cardType = (m.cardType as string) || ''
      form.amount = Math.abs(r.raw)
      form.points = (m.points as number) || 0
      form.note = ''
    } else if (r.cat === 'spend') {
      form.spendType = (m.spendType as string) || ''
      form.amount = Math.abs(r.raw)
      form.note = ''
    } else if (r.cat === 'cbg') {
      form.name = (m.name as string) || r.sum
      form.price = (m.price as number) || (m.soldPrice as number) || Math.abs(r.raw)
      form.note = ''
    }
  },
)

function submit() {
  store.updateRecord({ ...form })
}
</script>

<template>
  <div class="overlay" :class="{ show: store.showEditModal }">
    <div class="modal">
      <p class="eyebrow">EDIT</p>
      <h2>编辑记录</h2>

      <div class="stack" style="margin-top: 12px">
        <!-- 共同：账号选择 -->
        <div class="field">
          <label>账号</label>
          <select v-model="form.accountId" class="select">
            <option v-for="a in store.accounts" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
        </div>

        <!-- cat === 'game' -->
        <template v-if="store.editingRecord?.cat === 'game'">
          <div class="field">
            <label>物品</label>
            <input v-model="form.item" class="input" placeholder="物品名称" />
          </div>
          <div class="row" style="gap: 8px">
            <div class="field" style="flex: 1">
              <label>数量</label>
              <input v-model.number="form.qty" class="input num" type="number" min="1" />
            </div>
            <div class="field" style="flex: 1">
              <label>单价</label>
              <input v-model.number="form.price" class="input num" type="number" />
            </div>
          </div>
          <div class="field">
            <label>收支类型</label>
            <div class="seg">
              <button type="button" :class="{ active: form.io === 'in' }" @click="form.io = 'in'">收入</button>
              <button type="button" :class="{ active: form.io === 'out' }" @click="form.io = 'out'">消耗</button>
            </div>
          </div>
          <div class="field">
            <label>子类型</label>
            <input v-model="form.sub" class="input" placeholder="副本 / 任务 / 摆摊 ..." />
          </div>
          <div class="field">
            <label>备注</label>
            <input v-model="form.note" class="input" placeholder="可选" />
          </div>
        </template>

        <!-- cat === 'card' -->
        <template v-if="store.editingRecord?.cat === 'card'">
          <div class="field">
            <label>卡类型</label>
            <input v-model="form.cardType" class="input" placeholder="月卡 / 年卡 / 点卡" />
          </div>
          <div class="row" style="gap: 8px">
            <div class="field" style="flex: 1">
              <label>金额（RMB）</label>
              <input v-model.number="form.amount" class="input num" type="number" min="0" />
            </div>
            <div class="field" style="flex: 1">
              <label>点数</label>
              <input v-model.number="form.points" class="input num" type="number" min="0" />
            </div>
          </div>
          <div class="field">
            <label>备注</label>
            <input v-model="form.note" class="input" placeholder="可选" />
          </div>
        </template>

        <!-- cat === 'spend' -->
        <template v-if="store.editingRecord?.cat === 'spend'">
          <div class="field">
            <label>消费类型</label>
            <input v-model="form.spendType" class="input" placeholder="锦衣 / 祥瑞 / 其他" />
          </div>
          <div class="field">
            <label>金额（RMB）</label>
            <input v-model.number="form.amount" class="input num" type="number" min="0" />
          </div>
          <div class="field">
            <label>备注</label>
            <input v-model="form.note" class="input" placeholder="可选" />
          </div>
        </template>

        <!-- cat === 'cbg' -->
        <template v-if="store.editingRecord?.cat === 'cbg'">
          <div class="field">
            <label>物品名称</label>
            <input v-model="form.name" class="input" placeholder="物品名称" />
          </div>
          <div class="field">
            <label>价格（RMB）</label>
            <input v-model.number="form.price" class="input num" type="number" min="0" />
          </div>
          <div class="field">
            <label>备注</label>
            <input v-model="form.note" class="input" placeholder="可选" />
          </div>
        </template>
      </div>

      <div class="actions">
        <button class="btn btn-secondary" type="button" @click="store.showEditModal = false">取消</button>
        <button class="btn btn-primary" type="button" @click="submit">保存修改</button>
      </div>
    </div>
  </div>
</template>
