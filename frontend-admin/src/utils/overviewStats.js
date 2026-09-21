import dayjs from 'dayjs'

// 逾期天数分布区间（左闭右开，最后一个区间无上限）
export const OVERDUE_BUCKETS = [
  { key: '1to7', label: '1-7天', min: 1, max: 8, color: '#faad14' },
  { key: '8to30', label: '8-30天', min: 8, max: 31, color: '#fa8c16' },
  { key: '31to90', label: '31-90天', min: 31, max: 91, color: '#fa541c' },
  { key: '90plus', label: '90天以上', min: 91, max: Infinity, color: '#ff4d4f' }
]

// 计算一条记录距应还日期的逾期天数（当天或未到期按 0 计）
export function overdueDaysOf(record, now = dayjs()) {
  if (!record.dueDate) return 0
  const base = dayjs.isDayjs(now) ? now : dayjs(now)
  const diff = base.startOf('day').diff(dayjs(record.dueDate).startOf('day'), 'day')
  return Math.max(0, diff)
}

// 统一的概览筛选条件：日期范围（按借阅日期，含首尾当天）/ 状态 / 分类归属
export function filterRecords(records, { dateRange = null, status = null, categoryId = null } = {}) {
  let result = records

  if (Array.isArray(dateRange) && dateRange.length === 2) {
    const startDate = dayjs(dateRange[0]).format('YYYY-MM-DD')
    const endDate = dayjs(dateRange[1]).format('YYYY-MM-DD')
    result = result.filter(record =>
      record.borrowDate >= startDate && record.borrowDate <= endDate
    )
  }

  if (status) {
    result = result.filter(record => record.status === status)
  }

  if (categoryId != null) {
    result = result.filter(record => Number(record.categoryId) === Number(categoryId))
  }

  // 明细列表统一排序：借阅日期倒序
  return [...result].sort(
    (a, b) => dayjs(b.borrowDate).valueOf() - dayjs(a.borrowDate).valueOf()
  )
}

// 逾期分布：区间数量之和恒等于传入记录中的逾期记录数
export function buildOverdueDistribution(overdueRecords, now = dayjs()) {
  return OVERDUE_BUCKETS.map(bucket => ({
    ...bucket,
    count: overdueRecords.filter(record => {
      const days = overdueDaysOf(record, now)
      return days >= bucket.min && days < bucket.max
    }).length
  }))
}

// 概览卡片 + 逾期分布统一汇总，所有入口必须基于同一份 filteredRecords 调用
export function summarizeRecords(records, now = dayjs()) {
  const borrowed = records.filter(r => r.status === 'borrowed').length
  const returned = records.filter(r => r.status === 'returned').length
  const overdueRecords = records.filter(r => r.status === 'overdue')
  const distribution = buildOverdueDistribution(overdueRecords, now)

  return {
    total: records.length,
    borrowed,
    returned,
    overdue: overdueRecords.length,
    distribution
  }
}
