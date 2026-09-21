// store 集成验证：范围持久化、三处统计同源联动、删除同步、加载失败与零值区分
// 用法：node scripts/verify-overview-store.mjs
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'

const tick = () => nextTick()

// --- 最小 localStorage 桩 ---
const storage = new Map()
globalThis.localStorage = {
  getItem: key => (storage.has(key) ? storage.get(key) : null),
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key),
  clear: () => storage.clear()
}

// pinia 在 Node 下可能依赖 markRaw 之外的浏览器 API，仅需补齐
globalThis.window = globalThis

let failures = 0
function assert(name, actual, expected) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else {
    failures += 1
    console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`)
  }
}

const { useBorrowStore } = await import('../src/stores/borrow.js')
const { useOverviewStore } = await import('../src/stores/overview.js')

setActivePinia(createPinia())
const borrow = useBorrowStore()
const overview = useOverviewStore()

const before = borrow.records.length
console.log(`初始记录数: ${before}`)

console.log('初始口径：卡片数 == 明细数')
assert('totalCount 与明细长度一致', overview.totalCount, overview.filteredRecords.length)
assert('分布和 == 逾期卡片',
  overview.overdueDistribution.reduce((s, d) => s + d.count, 0),
  overview.overdueCount)

console.log('切换状态：卡片与明细联动')
overview.setStatus('overdue')
await tick()
assert('状态持久化到 localStorage', JSON.parse(storage.get('library_overview_filter')).status, 'overdue')
assert('逾期明细数 == 逾期卡片', overview.filteredRecords.length, overview.overdueCount)
assert('明细全部为逾期', overview.filteredRecords.every(r => r.status === 'overdue'), true)
overview.setStatus(null)

console.log('切换分类：按分类归属过滤')
overview.setCategoryId(2)
assert('分类 2 明细数 == 总量卡片', overview.filteredRecords.length, overview.totalCount)
assert('分类 2 明细全部归属分类 2',
  overview.filteredRecords.every(r => Number(r.categoryId) === 2), true)
overview.setCategoryId(null)

console.log('日期范围：结束日期当天包含（mock 中 2024-01-20 有一条）')
overview.setDateRange(['2024-01-20', '2024-01-20'])
assert('单日范围命中当天记录', overview.totalCount, overview.filteredRecords.length)
assert('命中借阅日期恰好为当天的记录', overview.filteredRecords.every(r => r.borrowDate === '2024-01-20'), true)

console.log('零值与加载失败必须区分')
overview.setDateRange(['2030-01-01', '2030-12-31'])
assert('无数据时卡片为 0（非错误、非消失）',
  [overview.totalCount, overview.borrowedCount, overview.returnedCount, overview.overdueCount],
  [0, 0, 0, 0])
assert('无数据时 error 仍为空', borrow.error, '')
assert('无数据时分布区间仍渲染 4 个且为 0',
  overview.overdueDistribution.map(d => d.count), [0, 0, 0, 0])
overview.resetFilters()

console.log('模拟加载失败（损坏的 localStorage 缓存）')
storage.set('library_borrow_records', '{损坏的JSON')
const reloadOk = await borrow.reloadRecords()
assert('reload 返回 false', reloadOk, false)
assert('error 有明确文案', borrow.error === '统计数据加载失败，请重试', true)
assert('失败时 loading 已复位', borrow.loading, false)

console.log('恢复数据后重试成功，错误清除')
storage.delete('library_borrow_records')
const reloadOk2 = await borrow.reloadRecords()
assert('reload 返回 true', reloadOk2, true)
assert('error 已清空', borrow.error, '')
assert('记录恢复', borrow.records.length, before)

console.log('删除借阅：卡片 / 分布 / 明细同步刷新且无旧数字残留')
const target = borrow.records.find(r => r.status === 'overdue')
const totalBefore = overview.totalCount
const overdueBefore = overview.overdueCount
const removed = borrow.deleteRecord(target.id)
assert('deleteRecord 返回 true', removed, true)
assert('总量卡片 -1', overview.totalCount, totalBefore - 1)
assert('明细长度 -1', overview.filteredRecords.length, totalBefore - 1)
assert('逾期卡片 -1', overview.overdueCount, overdueBefore - 1)
assert('分布和仍等于逾期卡片',
  overview.overdueDistribution.reduce((s, d) => s + d.count, 0),
  overview.overdueCount)
assert('被删记录在明细中找不到',
  overview.filteredRecords.some(r => r.id === target.id), false)

console.log('筛选范围保持（store 内状态 + 持久化）')
overview.setCategoryId(1)
overview.setStatus('borrowed')
await tick()
// 模拟从其它页面"返回"：重新创建 store 实例，状态应从 localStorage 恢复
setActivePinia(createPinia())
const borrow2 = useBorrowStore()
const overview2 = useOverviewStore()
assert('返回后分类保持', overview2.categoryId, 1)
assert('返回后状态保持', overview2.statusFilter, 'borrowed')
assert('返回后卡片与明细仍同口径', overview2.totalCount, overview2.filteredRecords.length)

console.log('')
if (failures > 0) {
  console.error(`${failures} 项验证失败`)
  process.exit(1)
} else {
  console.log('全部 store 集成验证通过')
}
