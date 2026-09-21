// 统计口径验证脚本：node --experimental-vm-modules 无需，直接用 node 运行 ESM
// 用法：node scripts/verify-overview-stats.mjs
import dayjs from 'dayjs'
import {
  filterRecords,
  summarizeRecords,
  buildOverdueDistribution,
  overdueDaysOf
} from '../src/utils/overviewStats.js'

let failures = 0
function assert(name, actual, expected) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) {
    console.log(`  ✓ ${name}`)
  } else {
    failures += 1
    console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`)
  }
}

// 固定"今天"，保证逾期天数确定
const NOW = dayjs('2024-02-01')

const records = [
  { id: 1, readerName: 'A', bookTitle: 'B1', categoryId: 1, status: 'borrowed', borrowDate: '2024-01-10', dueDate: '2024-02-10' },
  { id: 2, readerName: 'B', bookTitle: 'B2', categoryId: 2, status: 'borrowed', borrowDate: '2024-01-15', dueDate: '2024-02-15' },
  { id: 3, readerName: 'C', bookTitle: 'B3', categoryId: 1, status: 'returned', borrowDate: '2024-01-05', dueDate: '2024-02-05' },
  { id: 4, readerName: 'D', bookTitle: 'B4', categoryId: 2, status: 'overdue', borrowDate: '2023-12-20', dueDate: '2024-01-25' }, // 逾期 7 天
  { id: 5, readerName: 'E', bookTitle: 'B5', categoryId: 3, status: 'overdue', borrowDate: '2023-11-01', dueDate: '2023-12-15' }, // 逾期 48 天
  { id: 6, readerName: 'F', bookTitle: 'B6', categoryId: 3, status: 'overdue', borrowDate: '2023-08-01', dueDate: '2023-10-01' }  // 逾期 123 天
]

console.log('逾期天数计算')
assert('逾期 7 天', overdueDaysOf(records[3], NOW), 7)
assert('逾期 48 天', overdueDaysOf(records[4], NOW), 48)
assert('未到期按 0 计', overdueDaysOf(records[0], NOW), 0)
assert('到期当天按 0 计（边界）', overdueDaysOf({ dueDate: '2024-02-01' }, NOW), 0)

console.log('无筛选：卡片、分布、明细同口径')
const all = filterRecords(records, {})
const sum = summarizeRecords(all, NOW)
assert('总量', sum.total, 6)
assert('借阅中', sum.borrowed, 2)
assert('已归还', sum.returned, 1)
assert('已逾期', sum.overdue, 3)
assert('明细按借阅日期倒序', all.map(r => r.id), [2, 1, 3, 4, 5, 6])
assert('逾期分布各区间', sum.distribution.map(d => d.count), [1, 0, 1, 1])
assert('分布区间之和 == 逾期卡片数',
  sum.distribution.reduce((s, d) => s + d.count, 0), sum.overdue)

console.log('日期边界：首尾当天均包含')
const ranged = filterRecords(records, { dateRange: ['2024-01-10', '2024-01-15'] })
assert('闭区间命中起止当天 2 条', ranged.map(r => r.id), [2, 1])
const rangedEmpty = filterRecords(records, { dateRange: ['2025-01-01', '2025-01-31'] })
assert('范围无数据时返回空数组（非 undefined / 非消失）', rangedEmpty, [])
const sumEmpty = summarizeRecords(rangedEmpty, NOW)
assert('空范围卡片全部为 0', [sumEmpty.total, sumEmpty.borrowed, sumEmpty.returned, sumEmpty.overdue], [0, 0, 0, 0])
assert('空范围分布各区间仍为 0（区域不消失）', sumEmpty.distribution.map(d => d.count), [0, 0, 0, 0])

console.log('状态条件与分类归属')
assert('仅借阅中', filterRecords(records, { status: 'borrowed' }).map(r => r.id), [2, 1])
assert('仅已逾期', filterRecords(records, { status: 'overdue' }).map(r => r.id), [4, 5, 6])
const cat1 = filterRecords(records, { categoryId: 1 })
assert('分类 1 共 2 条', cat1.length, 2)
const cat1Sum = summarizeRecords(cat1, NOW)
assert('分类 1：卡片数量与明细一致', cat1Sum.total, cat1.length)
assert('分类 1 内逾期为 0（逾期记录不在该分类，不串口径）', cat1Sum.overdue, 0)
const cat3Overdue = summarizeRecords(filterRecords(records, { categoryId: 3, status: 'overdue' }), NOW)
assert('分类 3 + 逾期：卡片=明细=分布和', [cat3Overdue.total, cat3Overdue.overdue, cat3Overdue.distribution.reduce((s, d) => s + d.count, 0)], [2, 2, 2])

console.log('删除借阅：对同一数组原地删除后重新汇总，三处数字同步变化')
const afterDelete = records.filter(r => r.id !== 4)
const sumAfter = summarizeRecords(filterRecords(afterDelete, {}), NOW)
assert('删除一条逾期后总量 5', sumAfter.total, 5)
assert('删除一条逾期后逾期数 2', sumAfter.overdue, 2)
assert('删除后分布和仍等于逾期数', sumAfter.distribution.reduce((s, d) => s + d.count, 0), 2)
assert('删除后 1-7 天区间归零', sumAfter.distribution.map(d => d.count), [0, 0, 1, 1])

console.log('空数据集')
const emptySum = summarizeRecords([], NOW)
assert('空数据全 0', [emptySum.total, emptySum.borrowed, emptySum.returned, emptySum.overdue], [0, 0, 0, 0])
assert('空数据分布仍有 4 个区间', buildOverdueDistribution([], NOW).length, 4)

console.log('')
if (failures > 0) {
  console.error(`${failures} 项验证失败`)
  process.exit(1)
} else {
  console.log('全部统计口径验证通过')
}
