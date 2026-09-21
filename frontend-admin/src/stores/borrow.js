import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { borrowRecords as initialRecords } from '@/data/mockData'
import { effectiveStatus } from '@/utils/borrowStats'

const STORAGE_KEY = 'library_borrow_records'

export const useBorrowStore = defineStore('borrow', () => {
  // loading: 正在加载（与“加载失败”“零数据”三态互斥）
  const loading = ref(false)
  // loadError: 加载失败，需要与空数据（records 正常但长度为 0）明确区分
  const loadError = ref(false)

  const loadRecords = () => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (!Array.isArray(parsed)) throw new Error('借阅记录数据格式不正确')
        loadError.value = false
        return parsed
      } catch (e) {
        console.error('Failed to parse stored records:', e)
        loadError.value = true
        return []
      }
    }
    loadError.value = false
    return [...initialRecords]
  }

  const records = ref(loadRecords())

  watch(records, (newRecords) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newRecords))
  }, { deep: true })

  // 重新加载（失败后可重试）；纯前端环境用一次微任务模拟加载过程
  function reload() {
    loading.value = true
    loadError.value = false
    setTimeout(() => {
      records.value = loadRecords()
      loading.value = false
    }, 300)
  }

  // 全局口径下的统计（不携带任何筛选条件）
  const totalBorrowed = computed(() =>
    records.value.filter(r => effectiveStatus(r) === 'borrowed').length
  )

  const totalOverdue = computed(() =>
    records.value.filter(r => effectiveStatus(r) === 'overdue').length
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
      renewCount: 0
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
      // 续借后若尚未到新的应还日期，状态恢复为借阅中
      if (effectiveStatus(records.value[index]) === 'borrowed') {
        records.value[index].status = 'borrowed'
      }
      return true
    }
    return false
  }

  // 删除借阅记录（删除后各入口的统计必须同步减少）
  function deleteRecord(id) {
    const index = records.value.findIndex(record => record.id === id)
    if (index !== -1) {
      records.value.splice(index, 1)
      return true
    }
    return false
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
    loadError,
    reload,
    totalBorrowed,
    totalOverdue,
    todayBorrows,
    getRecordById,
    getRecordsByReader,
    addRecord,
    returnBook,
    renewBook,
    deleteRecord,
    searchRecords
  }
})
