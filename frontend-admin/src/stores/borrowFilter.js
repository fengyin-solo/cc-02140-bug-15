import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import dayjs from 'dayjs'
import { useCategoryStore } from '@/stores/category'

/**
 * 运营概览统一筛选条件
 *
 * 所有概览入口（借阅管理页的统计卡片、逾期分布、明细列表，
 * 以及首页概览中的借阅相关模块）共享同一份条件，
 * 从其他页面返回（甚至刷新页面）后所选范围仍然保持。
 */
const PERSIST_KEY = 'library_borrow_filter'

// 仅在当前会话内持久化：关闭标签页后回到无筛选的初始状态
function loadPersisted() {
  try {
    const raw = sessionStorage.getItem(PERSIST_KEY)
    if (!raw) return null
    const saved = JSON.parse(raw)
    return {
      keyword: saved.keyword || '',
      status: saved.status || null,
      categoryId: saved.categoryId || null,
      dateRange: Array.isArray(saved.dateRange) && saved.dateRange.length === 2
        ? [dayjs(saved.dateRange[0]), dayjs(saved.dateRange[1])]
        : null
    }
  } catch (e) {
    return null
  }
}

export const useBorrowFilterStore = defineStore('borrowFilter', () => {
  const persisted = loadPersisted()

  const keyword = ref(persisted?.keyword || '')
  const status = ref(persisted?.status || null)
  // dayjs 实例对，a-range-picker 直接可用
  const dateRange = ref(persisted?.dateRange || null)
  const categoryId = ref(persisted?.categoryId || null)

  const hasFilter = ref(false)

  function syncHasFilter() {
    hasFilter.value = Boolean(
      keyword.value ||
      status.value ||
      categoryId.value ||
      (dateRange.value && dateRange.value.length === 2 && dateRange.value[0] && dateRange.value[1])
    )
  }
  syncHasFilter()

  // 条件变化后写入 sessionStorage，路由切换/刷新均能恢复
  watch([keyword, status, dateRange, categoryId], () => {
    syncHasFilter()
    const payload = {
      keyword: keyword.value,
      status: status.value,
      categoryId: categoryId.value,
      dateRange: dateRange.value && dateRange.value.length === 2
        ? [dateRange.value[0].format('YYYY-MM-DD'), dateRange.value[1].format('YYYY-MM-DD')]
        : null
    }
    sessionStorage.setItem(PERSIST_KEY, JSON.stringify(payload))
  }, { deep: true })

  // 分类被删除后，自动清除失效的分类筛选，避免列表陷入永久空态
  const categoryStore = useCategoryStore()
  watch(() => categoryStore.categories.map(c => c.id), (ids) => {
    if (categoryId.value && !ids.includes(categoryId.value)) {
      setCategoryId(null)
    }
  })

  function setKeyword(val) {
    keyword.value = val || ''
  }

  function setStatus(val) {
    status.value = val || null
  }

  function setDateRange(val) {
    dateRange.value = val && val.length === 2 ? val : null
  }

  function setCategoryId(val) {
    categoryId.value = val || null
  }

  function clearAll() {
    keyword.value = ''
    status.value = null
    dateRange.value = null
    categoryId.value = null
    hasFilter.value = false
    sessionStorage.removeItem(PERSIST_KEY)
  }

  return {
    keyword,
    status,
    dateRange,
    categoryId,
    hasFilter,
    setKeyword,
    setStatus,
    setDateRange,
    setCategoryId,
    clearAll
  }
})
