import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import dayjs from 'dayjs'
import { useBorrowStore } from './borrow'
import {
  OVERDUE_BUCKETS,
  filterRecords,
  summarizeRecords
} from '@/utils/overviewStats'

const FILTER_STORAGE_KEY = 'library_overview_filter'

function loadPersistedFilter() {
  const stored = localStorage.getItem(FILTER_STORAGE_KEY)
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      return {
        dateRange: Array.isArray(parsed.dateRange) && parsed.dateRange.length === 2
          ? parsed.dateRange
          : null,
        status: typeof parsed.status === 'string' ? parsed.status : null,
        categoryId: parsed.categoryId != null ? Number(parsed.categoryId) : null
      }
    } catch (e) {
      console.error('Failed to parse overview filter:', e)
    }
  }
  return { dateRange: null, status: null, categoryId: null }
}

export { OVERDUE_BUCKETS }

export const useOverviewStore = defineStore('overview', () => {
  const initialFilter = loadPersistedFilter()

  // 概览入口共享的筛选条件：日期范围 / 状态 / 分类
  const dateRange = ref(initialFilter.dateRange)
  const statusFilter = ref(initialFilter.status)
  const categoryId = ref(initialFilter.categoryId)

  // 持久化所选范围，返回页面或刷新后保持
  watch([dateRange, statusFilter, categoryId], () => {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify({
      dateRange: dateRange.value,
      status: statusFilter.value,
      categoryId: categoryId.value
    }))
  }, { deep: true })

  const borrowStore = useBorrowStore()

  // —— 唯一数据源：概览卡片、逾期分布、明细列表全部派生自此 ——
  const filteredRecords = computed(() =>
    filterRecords(borrowStore.records, {
      dateRange: dateRange.value,
      status: statusFilter.value,
      categoryId: categoryId.value
    })
  )

  // 概览卡片 + 逾期分布与明细列表同口径（同一份 filteredRecords）
  const summary = computed(() => summarizeRecords(filteredRecords.value))
  const totalCount = computed(() => summary.value.total)
  const borrowedCount = computed(() => summary.value.borrowed)
  const returnedCount = computed(() => summary.value.returned)
  const overdueCount = computed(() => summary.value.overdue)
  const overdueDistribution = computed(() => summary.value.distribution)

  const hasActiveFilter = computed(() =>
    !!(dateRange.value || statusFilter.value || categoryId.value != null)
  )

  function setDateRange(value) {
    if (Array.isArray(value) && value.length === 2) {
      dateRange.value = [
        dayjs(value[0]).format('YYYY-MM-DD'),
        dayjs(value[1]).format('YYYY-MM-DD')
      ]
    } else {
      dateRange.value = null
    }
  }

  function setStatus(value) {
    statusFilter.value = value || null
  }

  function setCategoryId(value) {
    categoryId.value = value != null ? Number(value) : null
  }

  // 点击卡片切换状态条件，保证卡片与下方列表、分布联动且口径一致
  function toggleStatus(value) {
    statusFilter.value = statusFilter.value === value ? null : value
  }

  function resetFilters() {
    dateRange.value = null
    statusFilter.value = null
    categoryId.value = null
  }

  return {
    dateRange,
    statusFilter,
    categoryId,
    filteredRecords,
    totalCount,
    borrowedCount,
    returnedCount,
    overdueCount,
    overdueDistribution,
    hasActiveFilter,
    setDateRange,
    setStatus,
    setCategoryId,
    toggleStatus,
    resetFilters
  }
})
