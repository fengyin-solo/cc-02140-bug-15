<template>
  <div class="borrow-list">
    <h2 class="page-title">借阅管理</h2>

    <!-- 加载失败：与零值/空数据明确区分 -->
    <a-alert
      v-if="borrowStore.loadError"
      class="error-alert"
      type="error"
      show-icon
      message="借阅数据加载失败"
      description="本地借阅记录数据已损坏，暂时无法统计。可点击“重试”重新加载，或恢复为系统默认数据。"
    >
      <template #action>
        <a-space>
          <a-button size="small" @click="borrowStore.reload()">
            <ReloadOutlined /> 重试
          </a-button>
          <a-button size="small" type="primary" @click="resetToDefault">
            恢复默认数据
          </a-button>
        </a-space>
      </template>
    </a-alert>

    <template v-else>
      <!-- 统计卡片 - 与逾期分布、明细列表使用同一份 filteredRecords -->
      <a-row :gutter="[16, 16]" class="stat-row">
        <a-col :xs="12" :sm="12" :md="6">
          <div class="stat-card-rich total">
            <div class="stat-card-header">
              <div class="stat-card-icon">
                <DatabaseOutlined />
              </div>
              <div class="stat-card-trend up">
                <RiseOutlined />
                <span>{{ summary.todayBorrows }}</span>
              </div>
            </div>
            <div class="stat-card-body">
              <div class="stat-card-value">{{ summary.total }}</div>
              <div class="stat-card-label">总记录</div>
            </div>
            <div class="stat-card-footer">
              <span>今日新增 {{ summary.todayBorrows }} 条</span>
            </div>
          </div>
        </a-col>
        <a-col :xs="12" :sm="12" :md="6">
          <div class="stat-card-rich borrowed">
            <div class="stat-card-header">
              <div class="stat-card-icon">
                <BookOutlined />
              </div>
              <div class="stat-card-badge">
                <ClockCircleOutlined />
              </div>
            </div>
            <div class="stat-card-body">
              <div class="stat-card-value">{{ summary.borrowed }}</div>
              <div class="stat-card-label">借阅中</div>
            </div>
            <div class="stat-card-footer">
              <a-progress
                :percent="borrowedPercent"
                :show-info="false"
                stroke-color="#1890ff"
                size="small"
              />
              <span>占比 {{ borrowedPercent }}%</span>
            </div>
          </div>
        </a-col>
        <a-col :xs="12" :sm="12" :md="6">
          <div class="stat-card-rich returned">
            <div class="stat-card-header">
              <div class="stat-card-icon">
                <CheckCircleOutlined />
              </div>
              <div class="stat-card-badge success">
                <SmileOutlined />
              </div>
            </div>
            <div class="stat-card-body">
              <div class="stat-card-value">{{ summary.returned }}</div>
              <div class="stat-card-label">已归还</div>
            </div>
            <div class="stat-card-footer">
              <a-progress
                :percent="returnedPercent"
                :show-info="false"
                stroke-color="#52c41a"
                size="small"
              />
              <span>归还率 {{ returnedPercent }}%</span>
            </div>
          </div>
        </a-col>
        <a-col :xs="12" :sm="12" :md="6">
          <div class="stat-card-rich overdue">
            <div class="stat-card-header">
              <div class="stat-card-icon">
                <ExclamationCircleOutlined />
              </div>
              <!-- 零值也保留徽标位，避免数字区域跳动；仅 >0 时高亮 -->
              <div :class="['stat-card-badge', { warning: summary.overdue > 0 }]">
                <WarningOutlined v-if="summary.overdue > 0" />
                <CheckOutlined v-else />
              </div>
            </div>
            <div class="stat-card-body">
              <div class="stat-card-value">{{ summary.overdue }}</div>
              <div class="stat-card-label">已逾期</div>
            </div>
            <div class="stat-card-footer">
              <span v-if="summary.overdue > 0" class="warning-text">
                <AlertOutlined /> 请及时处理
              </span>
              <span v-else class="success-text">
                <CheckOutlined /> 暂无逾期
              </span>
            </div>
          </div>
        </a-col>
      </a-row>

      <!-- 逾期分布：与卡片共用 filteredRecords / summary，数量必然一致 -->
      <div class="overdue-panel">
        <div class="overdue-panel-header">
          <h3 class="overdue-panel-title">
            <FieldTimeOutlined /> 逾期分布
            <span class="overdue-panel-total">共 {{ summary.overdue }} 条逾期</span>
          </h3>
          <span class="overdue-panel-hint">按超过应还日期的整天数统计</span>
        </div>
        <a-row :gutter="[12, 12]">
          <a-col
            v-for="bucket in summary.overdueBuckets"
            :key="bucket.key"
            :xs="12"
            :sm="12"
            :md="6"
          >
            <div
              :class="['overdue-bucket', { active: filterStore.status === 'overdue' }]"
              @click="toggleOverdueBucket(bucket)"
            >
              <div class="overdue-bucket-top">
                <span class="overdue-bucket-label">{{ bucket.label }}</span>
                <!-- 零值显式展示 0，区域不消失 -->
                <span class="overdue-bucket-count" :style="{ color: bucket.color }">
                  {{ bucket.count }}
                </span>
              </div>
              <a-progress
                :percent="overdueBucketPercent(bucket.count)"
                :show-info="false"
                :stroke-color="bucket.color"
                size="small"
              />
            </div>
          </a-col>
        </a-row>
      </div>

      <!-- 搜索区域 -->
      <div class="search-area animate-slide-down">
        <a-row :gutter="16" align="middle">
          <a-col :xs="24" :sm="12" :md="6" :lg="6">
            <div class="search-input-wrapper">
              <a-input
                :value="filterStore.keyword"
                placeholder="搜索读者、图书、卡号"
                allow-clear
                @update:value="onKeywordInput"
                class="search-input"
              >
                <template #suffix>
                  <SearchOutlined
                    :class="['search-icon', { 'searching': isSearching }]"
                  />
                </template>
              </a-input>
            </div>
          </a-col>
          <a-col :xs="24" :sm="12" :md="6" :lg="5">
            <a-select
              :value="filterStore.status"
              placeholder="选择状态"
              allow-clear
              style="width: 100%"
              @change="handleStatusChange"
            >
              <a-select-option value="borrowed">借阅中</a-select-option>
              <a-select-option value="returned">已归还</a-select-option>
              <a-select-option value="overdue">已逾期</a-select-option>
            </a-select>
          </a-col>
          <a-col :xs="24" :sm="12" :md="6" :lg="5">
            <a-select
              :value="filterStore.categoryId"
              placeholder="选择图书分类"
              allow-clear
              style="width: 100%"
              @change="handleCategoryChange"
            >
              <a-select-option
                v-for="cat in categoryStore.categories"
                :key="cat.id"
                :value="cat.id"
              >
                {{ cat.name }}
              </a-select-option>
            </a-select>
          </a-col>
          <a-col :xs="24" :sm="24" :md="6" :lg="8" style="text-align: right;">
            <a-button type="primary" @click="showBorrowModal" class="add-btn">
              <PlusOutlined /> 新增借阅
            </a-button>
          </a-col>
        </a-row>
        <a-row :gutter="16" align="middle" style="margin-top: 16px;">
          <a-col :xs="24" :sm="12" :md="10" :lg="10">
            <a-range-picker
              :value="filterStore.dateRange"
              :placeholder="['开始日期', '结束日期']"
              allow-clear
              style="width: 100%"
              @change="handleDateRangeChange"
            >
              <template #suffixIcon>
                <CalendarOutlined />
              </template>
            </a-range-picker>
          </a-col>
          <a-col :xs="24" :sm="12" :md="14" :lg="14">
            <span class="filter-hint">
              <CalendarOutlined /> 按借阅日期筛选（含起止当天）
            </span>
          </a-col>
        </a-row>

        <!-- 搜索结果提示 -->
        <transition name="fade-slide">
          <div v-if="filterStore.hasFilter" class="search-result-tip">
            <span class="result-count">
              找到 <strong>{{ filteredRecords.length }}</strong> 条结果
            </span>
            <a-button type="link" size="small" @click="clearFilters" class="clear-btn">
              清除筛选
            </a-button>
          </div>
        </transition>
      </div>

      <!-- 借阅表格 -->
      <div :class="['table-container', 'animate-fade-in', { 'table-loading': tableAnimating }]">
        <!-- 加载动画遮罩（仅模拟筛选加载过程，区别于加载失败） -->
        <transition name="fade">
          <div v-if="tableAnimating" class="table-loading-overlay">
            <div class="loading-spinner">
              <div class="spinner-ring"></div>
              <span>统计中...</span>
            </div>
          </div>
        </transition>

        <a-table
          :columns="columns"
          :data-source="filteredRecords"
          :loading="borrowStore.loading"
          row-key="id"
          :pagination="{ pageSize: 10, showTotal: total => `共 ${total} 条` }"
          :row-class-name="getRowClassName"
          :locale="tableLocale"
        >
          <template #bodyCell="{ column, record, index }">
            <template v-if="column.key === 'reader'">
              <div class="reader-cell" :style="{ animationDelay: `${index * 0.05}s` }">
                <div class="text-primary">{{ record.readerName }}</div>
                <div class="text-secondary">{{ record.cardNo }}</div>
              </div>
            </template>
            <template v-else-if="column.key === 'book'">
              <div class="book-cell">
                <div class="text-primary">{{ record.bookTitle }}</div>
                <div class="text-secondary">{{ record.isbn }}</div>
              </div>
            </template>
            <template v-else-if="column.key === 'category'">
              <a-tag color="blue">{{ categoryNameOf(record.bookId) }}</a-tag>
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="getStatusColor(effectiveStatus(record))" :class="['status-tag', effectiveStatus(record)]">
                {{ getStatusText(effectiveStatus(record)) }}
              </a-tag>
            </template>
            <template v-else-if="column.key === 'action'">
              <a-space>
                <a-button
                  v-if="effectiveStatus(record) === 'borrowed' || effectiveStatus(record) === 'overdue'"
                  type="link"
                  size="small"
                  class="table-action-btn return-btn"
                  @click="handleReturn(record)"
                >
                  <CheckOutlined /> 归还
                </a-button>
                <a-button
                  v-if="effectiveStatus(record) === 'borrowed' && record.renewCount < 2"
                  type="link"
                  size="small"
                  class="table-action-btn renew-btn"
                  @click="handleRenew(record)"
                >
                  <ReloadOutlined /> 续借
                </a-button>
                <a-popconfirm
                  title="确定要删除这条借阅记录吗？"
                  :ok-text="deleteConfirmText"
                  cancel-text="取消"
                  @confirm="handleDelete(record)"
                >
                  <a-button type="link" size="small" danger class="table-action-btn delete-btn">
                    <DeleteOutlined /> 删除
                  </a-button>
                </a-popconfirm>
              </a-space>
            </template>
          </template>
        </a-table>
      </div>
    </template>

    <!-- 新增借阅弹窗 -->
    <a-modal
      v-model:open="borrowModalVisible"
      title="新增借阅"
      :confirm-loading="submitLoading"
      @ok="handleBorrowSubmit"
      @cancel="handleModalClose"
      width="500px"
    >
      <a-form
        ref="borrowFormRef"
        :model="borrowForm"
        :rules="borrowRules"
        :label-col="{ span: 5 }"
        :wrapper-col="{ span: 18 }"
      >
        <a-form-item label="读者" name="readerId">
          <a-select
            v-model:value="borrowForm.readerId"
            placeholder="请选择读者"
            show-search
            :filter-option="filterReader"
          >
            <a-select-option
              v-for="reader in availableReaders"
              :key="reader.id"
              :value="reader.id"
              :label="reader.name"
            >
              {{ reader.name }} ({{ reader.cardNo }})
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="图书" name="bookId">
          <a-select
            v-model:value="borrowForm.bookId"
            placeholder="请选择图书"
            show-search
            :filter-option="filterBook"
          >
            <a-select-option
              v-for="book in availableBooks"
              :key="book.id"
              :value="book.id"
              :label="book.title"
            >
              {{ book.title }} (库存: {{ book.available }})
            </a-select-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, reactive, computed, nextTick, h } from 'vue'
import { message } from 'ant-design-vue'
import {
  PlusOutlined,
  CheckOutlined,
  ReloadOutlined,
  DeleteOutlined,
  DatabaseOutlined,
  BookOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  RiseOutlined,
  ClockCircleOutlined,
  SmileOutlined,
  WarningOutlined,
  AlertOutlined,
  SearchOutlined,
  CalendarOutlined,
  FieldTimeOutlined
} from '@ant-design/icons-vue'
import { Empty } from 'ant-design-vue'
import { useBorrowStore } from '@/stores/borrow'
import { useBorrowFilterStore } from '@/stores/borrowFilter'
import { useReaderStore } from '@/stores/reader'
import { useBookStore } from '@/stores/book'
import { useCategoryStore } from '@/stores/category'
import { borrowRecords as defaultRecords } from '@/data/mockData'
import {
  effectiveStatus,
  getStatusColor,
  getStatusText,
  filterBorrowRecords,
  summarizeRecords
} from '@/utils/borrowStats'

const borrowStore = useBorrowStore()
const filterStore = useBorrowFilterStore()
const readerStore = useReaderStore()
const bookStore = useBookStore()
const categoryStore = useCategoryStore()

const borrowModalVisible = ref(false)
const submitLoading = ref(false)
const borrowFormRef = ref(null)
const isSearching = ref(false)
const tableAnimating = ref(false)
let searchTimeout = null

const columns = [
  { title: '读者信息', key: 'reader', width: 150 },
  { title: '图书信息', key: 'book', width: 200 },
  { title: '分类', key: 'category', width: 100 },
  { title: '借阅日期', dataIndex: 'borrowDate', key: 'borrowDate', width: 110 },
  { title: '应还日期', dataIndex: 'dueDate', key: 'dueDate', width: 110 },
  { title: '归还日期', dataIndex: 'returnDate', key: 'returnDate', width: 110 },
  { title: '续借次数', dataIndex: 'renewCount', key: 'renewCount', width: 90 },
  { title: '状态', key: 'status', width: 90 },
  { title: '操作', key: 'action', width: 210, fixed: 'right' }
]

const borrowForm = reactive({
  readerId: null,
  bookId: null
})

const borrowRules = {
  readerId: [{ required: true, message: '请选择读者' }],
  bookId: [{ required: true, message: '请选择图书' }]
}

const deleteConfirmText = '确定删除'

// 分类归属统一来自图书当前数据（bookId -> categoryId），
// 而不是借阅记录上的冗余快照，删除/切换分类后归属立即一致。
const categoryOfBook = computed(() => {
  const map = new Map()
  for (const book of bookStore.books) {
    map.set(book.id, book.categoryId)
  }
  return map
})

// 统一过滤结果：卡片、逾期分布、明细列表全部使用它
const filteredRecords = computed(() => {
  if (borrowStore.loadError) return []
  return filterBorrowRecords(borrowStore.records, {
    keyword: filterStore.keyword,
    status: filterStore.status,
    dateRange: filterStore.dateRange,
    categoryId: filterStore.categoryId
  }, categoryOfBook.value)
})

// 统一汇总：所有数字都从这一个 summary 读取
const summary = computed(() => summarizeRecords(filteredRecords.value))

const borrowedPercent = computed(() => {
  const total = summary.value.total
  if (total === 0) return 0
  return Math.round((summary.value.borrowed / total) * 100)
})

const returnedPercent = computed(() => {
  const total = summary.value.total
  if (total === 0) return 0
  return Math.round((summary.value.returned / total) * 100)
})

function overdueBucketPercent(count) {
  if (summary.value.overdue === 0) return 0
  return Math.round((count / summary.value.overdue) * 100)
}

function categoryNameOf(bookId) {
  const categoryId = categoryOfBook.value.get(bookId)
  const cat = categoryStore.getCategoryById(categoryId)
  return cat ? cat.name : '未分类'
}

// 表格空态：区分“有筛选但无匹配”与“完全没有借阅记录”
const tableLocale = computed(() => ({
  emptyText: h(Empty, {
    image: Empty.PRESENTED_IMAGE_SIMPLE,
    description: filterStore.hasFilter ? '当前筛选条件下暂无借阅记录' : '暂无借阅记录'
  })
}))

const availableReaders = computed(() => {
  return readerStore.readers.filter(r =>
    r.status === 'active' && r.borrowCount < r.maxBorrow
  )
})

const availableBooks = computed(() => {
  return bookStore.books.filter(b => b.available > 0)
})

function filterReader(input, option) {
  return option.label.toLowerCase().includes(input.toLowerCase())
}

function filterBook(input, option) {
  return option.label.toLowerCase().includes(input.toLowerCase())
}

// 切换筛选时仅做短暂的加载反馈，不改变统计口径
function triggerSearchAnimation() {
  tableAnimating.value = true
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    tableAnimating.value = false
  }, 300)
}

function handleStatusChange(val) {
  filterStore.setStatus(val)
  triggerSearchAnimation()
}

function handleCategoryChange(val) {
  filterStore.setCategoryId(val)
  triggerSearchAnimation()
}

function handleDateRangeChange(dates) {
  filterStore.setDateRange(dates)
  triggerSearchAnimation()
}

// 关键词变化：更新共享筛选条件（防抖只作用于加载动画）
function onKeywordInput(val) {
  filterStore.setKeyword(val)
  isSearching.value = true

  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }

  searchTimeout = setTimeout(() => {
    isSearching.value = false
    tableAnimating.value = false
  }, 300)
}

// 清除筛选（条件保存在共享 store 中，此处清空后所有入口同步）
function clearFilters() {
  filterStore.clearAll()
  triggerSearchAnimation()
}

// 点击逾期分布桶：快捷切换“已逾期”状态筛选，便于核对数量
function toggleOverdueBucket() {
  if (filterStore.status === 'overdue') {
    filterStore.setStatus(null)
  } else {
    filterStore.setStatus('overdue')
  }
  triggerSearchAnimation()
}

// 获取行样式类名
function getRowClassName(record, index) {
  return `table-row-animate row-${index}`
}

function resetToDefault() {
  localStorage.removeItem('library_borrow_records')
  borrowStore.records.splice(0, borrowStore.records.length, ...defaultRecords)
  borrowStore.loadError = false
  message.success('已恢复默认借阅数据')
}

function handleModalClose() {
  nextTick(() => {
    borrowFormRef.value?.resetFields()
  })
}

function showBorrowModal() {
  borrowForm.readerId = null
  borrowForm.bookId = null
  borrowModalVisible.value = true
  nextTick(() => {
    borrowFormRef.value?.clearValidate()
  })
}

async function handleBorrowSubmit() {
  try {
    await borrowFormRef.value.validate()
    submitLoading.value = true

    const reader = readerStore.getReaderById(borrowForm.readerId)
    const book = bookStore.getBookById(borrowForm.bookId)

    if (!reader || !book) {
      message.error('读者或图书信息不存在')
      return
    }

    await new Promise(resolve => setTimeout(resolve, 500))

    borrowStore.addRecord({
      readerId: reader.id,
      readerName: reader.name,
      cardNo: reader.cardNo,
      bookId: book.id,
      bookTitle: book.title,
      isbn: book.isbn
    })

    bookStore.updateBook(book.id, { available: book.available - 1 })
    readerStore.updateReader(reader.id, { borrowCount: reader.borrowCount + 1 })

    message.success('借阅成功')
    borrowModalVisible.value = false
  } catch (error) {
    console.error('表单验证失败:', error)
  } finally {
    submitLoading.value = false
  }
}

function handleReturn(record) {
  borrowStore.returnBook(record.id)

  const book = bookStore.getBookById(record.bookId)
  const reader = readerStore.getReaderById(record.readerId)

  if (book) {
    bookStore.updateBook(book.id, { available: book.available + 1 })
  }
  if (reader) {
    readerStore.updateReader(reader.id, { borrowCount: Math.max(0, reader.borrowCount - 1) })
  }

  message.success('归还成功')
}

function handleRenew(record) {
  const success = borrowStore.renewBook(record.id)
  if (success) {
    message.success('续借成功，借阅期限延长15天')
  } else {
    message.error('续借失败，已达到最大续借次数')
  }
}

// 删除借阅记录：若书尚未归还，同步回补库存和读者在借数，
// 保证其他页面的数字也对得上。
function handleDelete(record) {
  const wasActive = effectiveStatus(record) !== 'returned'

  const ok = borrowStore.deleteRecord(record.id)
  if (!ok) {
    message.error('删除失败，记录不存在')
    return
  }

  if (wasActive) {
    const book = bookStore.getBookById(record.bookId)
    const reader = readerStore.getReaderById(record.readerId)
    if (book) {
      bookStore.updateBook(book.id, { available: Math.min(book.total, book.available + 1) })
    }
    if (reader) {
      readerStore.updateReader(reader.id, { borrowCount: Math.max(0, reader.borrowCount - 1) })
    }
  }

  message.success('借阅记录已删除')
}
</script>

<style lang="less" scoped>
.borrow-list {
  .page-title {
    font-size: 20px;
    font-weight: 600;
    color: #1a1a1a;
    margin-bottom: 24px;
  }
}

.error-alert {
  margin-bottom: 16px;
  border-radius: 12px;
}

.stat-row {
  margin-bottom: 16px;
}

.stat-card-rich {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: all 0.3s ease;
  border-left: 4px solid transparent;
  height: 100%;

  &:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    background: #f0f7ff;
  }

  &.total {
    border-left-color: #667eea;
    .stat-card-icon { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
    .stat-card-value { color: #667eea; }
  }

  &.borrowed {
    border-left-color: #1890ff;
    .stat-card-icon { background: linear-gradient(135deg, #1890ff 0%, #40a9ff 100%); }
    .stat-card-value { color: #1890ff; }
  }

  &.returned {
    border-left-color: #52c41a;
    .stat-card-icon { background: linear-gradient(135deg, #52c41a 0%, #73d13d 100%); }
    .stat-card-value { color: #52c41a; }
  }

  &.overdue {
    border-left-color: #ff4d4f;
    .stat-card-icon { background: linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%); }
    .stat-card-value { color: #ff4d4f; }
  }

  .stat-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;

    .stat-card-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      color: #fff;
    }

    .stat-card-trend {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      padding: 4px 8px;
      border-radius: 12px;

      &.up {
        background: #f6ffed;
        color: #52c41a;
      }
    }

    .stat-card-badge {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      background: #f5f5f5;
      color: #999;

      &.success {
        background: #f6ffed;
        color: #52c41a;
      }

      &.warning {
        background: #fff2e8;
        color: #fa541c;
        animation: pulse 1.5s infinite;
      }
    }
  }

  .stat-card-body {
    margin-bottom: 12px;

    .stat-card-value {
      font-size: 32px;
      font-weight: 700;
      line-height: 1.2;
    }

    .stat-card-label {
      font-size: 14px;
      color: #999;
      margin-top: 4px;
    }
  }

  .stat-card-footer {
    font-size: 12px;
    color: #999;
    padding-top: 12px;
    border-top: 1px dashed #f0f0f0;

    :deep(.ant-progress) {
      margin-bottom: 4px;
    }

    .warning-text {
      color: #fa541c;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .success-text {
      color: #52c41a;
      display: flex;
      align-items: center;
      gap: 4px;
    }
  }
}

// 逾期分布面板
.overdue-panel {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  padding: 16px 20px;
  margin-bottom: 16px;

  .overdue-panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    flex-wrap: wrap;
    gap: 8px;
  }

  .overdue-panel-title {
    font-size: 15px;
    font-weight: 600;
    color: #1a1a1a;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .overdue-panel-total {
    font-size: 12px;
    font-weight: 400;
    color: #ff4d4f;
    background: #fff1f0;
    border-radius: 10px;
    padding: 2px 8px;
  }

  .overdue-panel-hint {
    font-size: 12px;
    color: #999;
  }

  .overdue-bucket {
    border: 1px solid #f0f0f0;
    border-radius: 8px;
    padding: 10px 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    height: 100%;

    &:hover {
      border-color: #ffa39e;
      background: #fff8f7;
    }

    &.active {
      border-color: #ff4d4f;
      background: #fff1f0;
    }

    .overdue-bucket-top {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 6px;
    }

    .overdue-bucket-label {
      font-size: 13px;
      color: #666;
    }

    .overdue-bucket-count {
      font-size: 20px;
      font-weight: 700;
    }
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

// ========================================
// 动画定义
// ========================================
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes rowFadeIn {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

// ========================================
// 动画类
// ========================================
.animate-fade-in {
  animation: fadeIn 0.5s ease-out both;
}

.animate-slide-down {
  animation: slideDown 0.5s ease-out both;
}

// ========================================
// 过渡动画
// ========================================
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s ease;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.search-area {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  padding: 20px;
  margin-bottom: 16px;
  transition: all 0.3s ease;

  &:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  }

  .search-input-wrapper {
    position: relative;

    .search-input {
      transition: all 0.3s ease;

      &:focus-within {
        box-shadow: 0 0 0 2px rgba(250, 173, 20, 0.2);
      }
    }

    .search-icon {
      color: rgba(0, 0, 0, 0.45);
      cursor: pointer;
      transition: all 0.3s ease;

      &:hover {
        color: #faad14;
        transform: scale(1.1);
      }

      &.searching {
        animation: pulse 0.5s ease-in-out infinite;
        color: #faad14;
      }
    }
  }

  .add-btn {
    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(24, 144, 255, 0.4);
    }
  }

  .filter-hint {
    font-size: 13px;
    color: #999;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .search-result-tip {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px dashed #f0f0f0;
    display: flex;
    align-items: center;
    justify-content: space-between;

    .result-count {
      color: #666;
      font-size: 13px;

      strong {
        color: #faad14;
        font-size: 16px;
        margin: 0 4px;
      }
    }

    .clear-btn {
      font-size: 13px;

      &:hover {
        color: #ff4d4f;
      }
    }
  }
}

.table-container {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  padding: 20px;
  position: relative;
  transition: all 0.3s ease;

  &:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  }

  &.table-loading {
    .ant-table {
      filter: blur(2px);
      pointer-events: none;
    }
  }

  .table-loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.95);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    border-radius: 12px;

    .loading-spinner {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;

      .spinner-ring {
        width: 40px;
        height: 40px;
        border: 3px solid #f0f0f0;
        border-top-color: #faad14;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }

      span {
        color: #faad14;
        font-size: 14px;
      }
    }
  }

  // 表格行样式
  :deep(.ant-table-tbody) {
    .ant-table-row {
      &:hover td {
        background: #fafafa !important;
      }
    }
  }

  .table-action-btn {
    padding: 2px 4px;
    height: auto;
    border-radius: 4px;
    transition: all 0.2s ease;

    &.return-btn:hover,
    &.renew-btn:hover {
      color: #1890ff;
      background: #e6f7ff;
    }
  }

  .completed-text {
    color: #52c41a;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 4px;
  }
}

.reader-cell,
.book-cell {
  // 保持默认样式
}

.text-primary {
  font-weight: 500;
  color: #1a1a1a;
}

.text-secondary {
  font-size: 12px;
  color: #999;
}

.status-tag {
  // 保持默认样式
}
</style>
