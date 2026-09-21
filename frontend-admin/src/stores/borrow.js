import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { borrowRecords as initialRecords } from '@/data/mockData'
import { books as initialBooks } from '@/data/mockData'

const STORAGE_KEY = 'library_borrow_records'

// 图书 id -> 分类归属，用于保证借阅记录的分类口径与图书数据一致
function buildCategoryMap() {
  const map = new Map()
  initialBooks.forEach(book => {
    map.set(book.id, {
      categoryId: book.categoryId,
      categoryName: book.categoryName
    })
  })
  return map
}

const categoryMap = buildCategoryMap()

// 为历史数据（缺少分类字段的借阅记录）补全分类归属
function withCategory(record) {
  if (record.categoryId != null && record.categoryName) return record
  const category = categoryMap.get(record.bookId)
  return category ? { ...record, ...category } : { ...record }
}

function parseRecords(raw) {
  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed)) throw new Error('借阅记录数据格式错误')
  return parsed.map(withCategory)
}

export const useBorrowStore = defineStore('borrow', () => {
  const loadRecords = () => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        return parseRecords(stored)
      } catch (e) {
        console.error('Failed to parse stored records:', e)
      }
    }
    return initialRecords.map(withCategory)
  }

  const records = ref(loadRecords())
  const loading = ref(false)
  const error = ref('')

  watch(records, (newRecords) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newRecords))
  }, { deep: true })

  const totalBorrowed = computed(() =>
    records.value.filter(r => r.status === 'borrowed').length
  )

  const totalOverdue = computed(() =>
    records.value.filter(r => r.status === 'overdue').length
  )

  const todayBorrows = computed(() => {
    const today = new Date().toISOString().split('T')[0]
    return records.value.filter(r => r.borrowDate === today).length
  })

  function getRecordById(id) {
    return records.value.find(record => record.id === id)
  }

  function getRecordsByReader(readerId) {
    return records.value.filter(record => record.readerId === readerId)
  }

  function addRecord(record) {
    const newId = records.value.length > 0
      ? Math.max(...records.value.map(r => r.id)) + 1
      : 1
    const today = new Date().toISOString().split('T')[0]
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 30)

    records.value.push({
      ...record,
      id: newId,
      borrowDate: today,
      dueDate: dueDate.toISOString().split('T')[0],
      returnDate: null,
      status: 'borrowed',
      renewCount: 0,
      ...(record.categoryId != null ? {} : (categoryMap.get(record.bookId) || {}))
    })
    return newId
  }

  function returnBook(id) {
    const index = records.value.findIndex(record => record.id === id)
    if (index !== -1) {
      records.value[index].returnDate = new Date().toISOString().split('T')[0]
      records.value[index].status = 'returned'
      return true
    }
    return false
  }

  function renewBook(id) {
    const index = records.value.findIndex(record => record.id === id)
    if (index !== -1 && records.value[index].renewCount < 2) {
      const newDueDate = new Date(records.value[index].dueDate)
      newDueDate.setDate(newDueDate.getDate() + 15)
      records.value[index].dueDate = newDueDate.toISOString().split('T')[0]
      records.value[index].renewCount += 1
      return true
    }
    return false
  }

  // 删除借阅记录：所有概览区域均基于 records 派生，删除后同步更新
  function deleteRecord(id) {
    const index = records.value.findIndex(record => record.id === id)
    if (index !== -1) {
      records.value.splice(index, 1)
      return true
    }
    return false
  }

  // 重新加载数据，明确区分加载中与加载失败
  async function reloadRecords() {
    loading.value = true
    error.value = ''
    try {
      await new Promise(resolve => setTimeout(resolve, 400))
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        records.value = parseRecords(stored)
      } else {
        records.value = initialRecords.map(withCategory)
      }
      return true
    } catch (e) {
      error.value = '统计数据加载失败，请重试'
      console.error('Failed to reload records:', e)
      return false
    } finally {
      loading.value = false
    }
  }

  function searchRecords(keyword) {
    if (!keyword) return records.value
    const lowerKeyword = keyword.toLowerCase()
    return records.value.filter(record =>
      record.readerName.toLowerCase().includes(lowerKeyword) ||
      record.bookTitle.toLowerCase().includes(lowerKeyword) ||
      record.cardNo.toLowerCase().includes(lowerKeyword)
    )
  }

  return {
    records,
    loading,
    error,
    totalBorrowed,
    totalOverdue,
    todayBorrows,
    getRecordById,
    getRecordsByReader,
    addRecord,
    returnBook,
    renewBook,
    deleteRecord,
    reloadRecords,
    searchRecords
  }
})
