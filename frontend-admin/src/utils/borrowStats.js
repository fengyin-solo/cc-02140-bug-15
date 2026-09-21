import dayjs from 'dayjs'

/**
 * 运营概览统一统计口径
 *
 * 所有概览入口（统计卡片、逾期分布、明细列表、首页概览）
 * 必须使用这里的同一套：
 *  - 日期范围：按借阅日期 borrowDate 的整天闭区间 [start 00:00, end 23:59:59.999]
 *  - 状态条件：effectiveStatus（borrowed / returned / overdue）
 *  - 分类归属：通过 bookId 关联图书的 categoryId；关联不到图书时归属为“未分类”
 */

// 统一的状态文案 / 颜色，避免各入口各写一份
export const STATUS_META = {
  borrowed: { text: '借阅中', color: 'processing' },
  returned: { text: '已归还', color: 'success' },
  overdue: { text: '已逾期', color: 'error' }
}

export function getStatusText(status) {
  return STATUS_META[status]?.text || status
}

export function getStatusColor(status) {
  return STATUS_META[status]?.color || 'default'
}

/**
 * 动态派生真实状态：
 * 已归还的始终是 returned；未归还且超过应还日期的视为 overdue；
 * 其余未归还的为 borrowed。
 * 这样即使存量数据里状态字段没有及时更新，各入口统计也不会对不上。
 */
export function effectiveStatus(record) {
  if (!record) return ''
  if (record.status === 'returned') return 'returned'
  if (record.dueDate && dayjs(record.dueDate).endOf('day').isBefore(dayjs())) {
    return 'overdue'
  }
  return record.status === 'overdue' ? 'overdue' : 'borrowed'
}

/**
 * 逾期天数分布桶（仅统计 effectiveStatus === 'overdue' 的记录）
 * 桶定义以“超过应还日期的整天数”为准。
 */
export const OVERDUE_BUCKETS = [
  { key: '1-7', label: '逾期 1-7 天', min: 1, max: 7, color: '#faad14' },
  { key: '8-30', label: '逾期 8-30 天', min: 8, max: 30, color: '#fa8c16' },
  { key: '31-90', label: '逾期 31-90 天', min: 31, max: 90, color: '#fa541c' },
  { key: '90+', label: '逾期 90 天以上', min: 91, max: Infinity, color: '#ff4d4f' }
]

export function overdueDays(record) {
  if (effectiveStatus(record) !== 'overdue') return 0
  // 应还日当天不算逾期，次日起算 1 天
  return Math.max(0, dayjs().startOf('day').diff(dayjs(record.dueDate).startOf('day'), 'day'))
}

export function overdueBucketKey(record) {
  const days = overdueDays(record)
  const bucket = OVERDUE_BUCKETS.find(b => days >= b.min && days <= b.max)
  return bucket ? bucket.key : null
}

/**
 * 日期范围匹配：整天闭区间。
 * range 为 [dayjsLike, dayjsLike] 或 null。
 * 边界当天的记录一定被包含，避免字符串比较带来的边界歧义。
 */
export function isWithinDateRange(borrowDate, range) {
  if (!range || range.length !== 2 || !range[0] || !range[1]) return true
  const d = dayjs(borrowDate)
  if (!d.isValid()) return false
  const start = dayjs(range[0]).startOf('day')
  const end = dayjs(range[1]).endOf('day')
  return !d.isBefore(start) && !d.isAfter(end)
}

/**
 * 统一的记录过滤：所有概览入口共用此函数。
 *
 * filters: {
 *   keyword, status, dateRange: [start, end], categoryId
 * }
 *
 * categoryOf: Map(bookId -> categoryId)，由调用方用当前图书数据构建，
 * 保证“分类归属”随图书分类变化而变化，而不是取记录上的冗余快照。
 */
export function filterBorrowRecords(records, filters = {}, categoryOf = null) {
  const { keyword, status, dateRange, categoryId } = filters

  return records.filter(record => {
    if (keyword) {
      const kw = String(keyword).toLowerCase()
      const hit =
        String(record.readerName || '').toLowerCase().includes(kw) ||
        String(record.bookTitle || '').toLowerCase().includes(kw) ||
        String(record.cardNo || '').toLowerCase().includes(kw)
      if (!hit) return false
    }

    // 状态条件统一走派生状态
    if (status && effectiveStatus(record) !== status) return false

    // 日期范围统一按借阅日期整天闭区间
    if (!isWithinDateRange(record.borrowDate, dateRange)) return false

    // 分类归属统一按图书当前 categoryId
    if (categoryId) {
      const cid = categoryOf ? categoryOf.get(record.bookId) : record.categoryId
      if (cid !== categoryId) return false
    }

    return true
  })
}

/**
 * 基于一份过滤结果做汇总，卡片 / 分布 / 列表共用，保证数量必然对得上。
 */
export function summarizeRecords(records) {
  const summary = {
    total: records.length,
    borrowed: 0,
    returned: 0,
    overdue: 0,
    todayBorrows: 0,
    overdueBuckets: OVERDUE_BUCKETS.map(b => ({ ...b, count: 0 }))
  }

  const today = dayjs().format('YYYY-MM-DD')

  for (const record of records) {
    const s = effectiveStatus(record)
    if (s === 'borrowed') summary.borrowed += 1
    else if (s === 'returned') summary.returned += 1
    else if (s === 'overdue') {
      summary.overdue += 1
      const key = overdueBucketKey(record)
      const bucket = summary.overdueBuckets.find(b => b.key === key)
      if (bucket) bucket.count += 1
    }

    if (record.borrowDate === today) summary.todayBorrows += 1
  }

  return summary
}
