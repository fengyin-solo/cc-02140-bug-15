<template>
  <div class="dashboard">
    <div class="page-header">
      <h2 class="page-title animate-fade-in">运营概览</h2>
      <a-button
        class="refresh-btn"
        :loading="borrowStore.loading"
        @click="handleRefresh"
      >
        <template #icon><ReloadOutlined /></template>
        刷新数据
      </a-button>
    </div>

    <!-- 统一筛选区：日期范围 / 状态 / 分类，对卡片、逾期分布、明细列表同时生效 -->
    <div class="filter-bar animate-fade-in">
      <div class="filter-item">
        <span class="filter-label">
          <CalendarOutlined /> 借阅日期
        </span>
        <a-range-picker
          v-model:value="dateRangeValue"
          :placeholder="['开始日期', '结束日期']"
          allow-clear
        />
      </div>
      <div class="filter-item">
        <span class="filter-label">状态</span>
        <a-select
          v-model:value="statusValue"
          placeholder="全部状态"
          allow-clear
          class="filter-select"
        >
          <a-select-option value="borrowed">借阅中</a-select-option>
          <a-select-option value="returned">已归还</a-select-option>
          <a-select-option value="overdue">已逾期</a-select-option>
        </a-select>
      </div>
      <div class="filter-item">
        <span class="filter-label">分类</span>
        <a-select
          v-model:value="categoryValue"
          placeholder="全部分类"
          allow-clear
          class="filter-select category-select"
        >
          <a-select-option
            v-for="cat in categoryStore.categories"
            :key="cat.id"
            :value="cat.id"
          >
            {{ cat.name }}
          </a-select-option>
        </a-select>
      </div>
      <a-button
        v-if="overview.hasActiveFilter"
        type="link"
        class="reset-btn"
        @click="overview.resetFilters()"
      >
        <ClearOutlined /> 重置筛选
      </a-button>
    </div>

    <!-- 加载失败态：与“零值”明确区分，提供重试入口 -->
    <a-result
      v-if="borrowStore.error"
      class="error-result"
      status="error"
      title="统计数据加载失败"
      :sub-title="borrowStore.error"
    >
      <template #extra>
        <a-button type="primary" @click="handleRefresh">
          <ReloadOutlined /> 重新加载
        </a-button>
      </template>
    </a-result>

    <a-spin :spinning="borrowStore.loading" tip="统计数据加载中...">
      <template v-if="!borrowStore.error">
        <!-- 统计卡片：数值全部来自 overview 同一数据源 -->
        <a-row :gutter="[16, 16]" class="stat-row">
          <a-col :xs="24" :sm="12" :lg="6">
            <div
              :class="['stat-card', { active: overview.statusFilter === null }]"
              title="点击查看全部状态记录"
              @click="overview.setStatus(null)"
            >
              <div class="stat-icon">
                <DatabaseOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ overview.totalCount }}</div>
                <div class="stat-label">借阅总量</div>
              </div>
              <div class="stat-card-bg"></div>
            </div>
          </a-col>
          <a-col :xs="24" :sm="12" :lg="6">
            <div
              :class="['stat-card', 'warning', { active: overview.statusFilter === 'borrowed' }]"
              title="点击只看借阅中记录"
              @click="overview.toggleStatus('borrowed')"
            >
              <div class="stat-icon">
                <SwapOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ overview.borrowedCount }}</div>
                <div class="stat-label">借阅中</div>
              </div>
              <div class="stat-card-bg"></div>
            </div>
          </a-col>
          <a-col :xs="24" :sm="12" :lg="6">
            <div
              :class="['stat-card', 'success', { active: overview.statusFilter === 'returned' }]"
              title="点击只看已归还记录"
              @click="overview.toggleStatus('returned')"
            >
              <div class="stat-icon">
                <CheckCircleOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ overview.returnedCount }}</div>
                <div class="stat-label">已归还</div>
              </div>
              <div class="stat-card-bg"></div>
            </div>
          </a-col>
          <a-col :xs="24" :sm="12" :lg="6">
            <div
              :class="['stat-card', 'error', { active: overview.statusFilter === 'overdue' }]"
              title="点击只看已逾期记录"
              @click="overview.toggleStatus('overdue')"
            >
              <div class="stat-icon">
                <WarningOutlined />
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ overview.overdueCount }}</div>
                <div class="stat-label">已逾期</div>
              </div>
              <div class="stat-card-bg"></div>
            </div>
          </a-col>
        </a-row>

        <!-- 明细列表和逾期分布：与卡片同一筛选口径 -->
        <a-row :gutter="[16, 16]">
          <!-- 借阅明细 -->
          <a-col :xs="24" :lg="16">
            <div class="card-container equal-height">
              <div class="card-header">
                <h3 class="card-title">
                  <HistoryOutlined /> 借阅明细
                  <span class="card-count">共 {{ overview.totalCount }} 条</span>
                </h3>
                <a-button type="link" class="view-all-btn" @click="$router.push('/borrow')">
                  查看全部 <RightOutlined />
                </a-button>
              </div>
              <div class="card-body">
                <a-table
                  :columns="columns"
                  :data-source="overview.filteredRecords"
                  :loading="borrowStore.loading"
                  :locale="tableLocale"
                  row-key="id"
                  size="middle"
                  :pagination="{ pageSize: 8, showTotal: total => `共 ${total} 条` }"
                >
                  <template #bodyCell="{ column, record }">
                    <template v-if="column.key === 'reader'">
                      <div class="cell-primary">{{ record.readerName }}</div>
                      <div class="cell-secondary">{{ record.cardNo }}</div>
                    </template>
                    <template v-else-if="column.key === 'book'">
                      <div class="cell-primary">{{ record.bookTitle }}</div>
                      <div class="cell-secondary">{{ record.isbn }}</div>
                    </template>
                    <template v-else-if="column.key === 'category'">
                      <a-tag color="blue">{{ record.categoryName || '未分类' }}</a-tag>
                    </template>
                    <template v-else-if="column.key === 'status'">
                      <a-tag :color="getStatusColor(record.status)">
                        {{ getStatusText(record.status) }}
                      </a-tag>
                    </template>
                    <template v-else-if="column.key === 'action'">
                      <a-button
                        type="link"
                        size="small"
                        danger
                        class="table-action-btn"
                        @click="handleDelete(record)"
                      >
                        <DeleteOutlined /> 删除
                      </a-button>
                    </template>
                  </template>
                </a-table>
              </div>
            </div>
          </a-col>

          <!-- 逾期分布 -->
          <a-col :xs="24" :lg="8">
            <div class="card-container equal-height">
              <div class="card-header">
                <h3 class="card-title">
                  <FieldTimeOutlined /> 逾期分布
                </h3>
                <span class="overdue-total">逾期 {{ overview.overdueCount }} 本</span>
              </div>
              <div class="card-body overdue-body">
                <a-alert
                  v-if="overview.overdueCount === 0"
                  class="overdue-empty-alert"
                  type="success"
                  show-icon
                  message="当前范围内暂无逾期记录"
                />
                <div
                  v-for="bucket in overview.overdueDistribution"
                  :key="bucket.key"
                  class="overdue-bucket"
                >
                  <div class="overdue-bucket-head">
                    <span class="overdue-bucket-label">
                      <span class="overdue-dot" :style="{ backgroundColor: bucket.color }"></span>
                      {{ bucket.label }}
                    </span>
                    <span class="overdue-bucket-count">{{ bucket.count }} 本</span>
                  </div>
                  <a-progress
                    :percent="bucketPercent(bucket.count)"
                    :show-info="false"
                    :stroke-color="bucket.color"
                    size="small"
                  />
                </div>
              </div>
            </div>
          </a-col>
        </a-row>
      </template>
    </a-spin>

    <!-- 分类统计 - 既有排序保持不变 -->
    <div class="card-container" style="margin-top: 16px">
      <div class="card-header">
        <h3 class="card-title">
          <PieChartOutlined /> 图书分类统计
        </h3>
      </div>
      <div class="card-body category-body">
        <a-empty
          v-if="topCategories.length === 0"
          :image="simpleEmpty"
          description="暂无分类数据"
        />
        <div v-else class="category-list">
          <div
            v-for="(cat, index) in topCategories"
            :key="cat.id"
            class="category-item"
            :style="{ animationDelay: `${index * 0.08}s` }"
          >
            <div class="category-left">
              <span class="category-dot" :style="{ backgroundColor: getProgressColor(cat.id) }"></span>
              <span class="category-name">{{ cat.name }}</span>
            </div>
            <div class="category-right">
              <span class="category-count">{{ cat.bookCount }}</span>
              <span class="category-unit">本</span>
            </div>
            <div class="category-progress">
              <div
                class="category-progress-bar"
                :style="{
                  width: `${(cat.bookCount / maxBookCount) * 100}%`,
                  backgroundColor: getProgressColor(cat.id)
                }"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 热门图书 - 既有排序规则保持不变 -->
    <div class="card-container" style="margin-top: 16px">
      <div class="card-header">
        <h3 class="card-title">
          <FireOutlined class="icon-fire" /> 热门图书推荐
        </h3>
      </div>
      <div class="card-body">
        <a-empty
          v-if="hotBooks.length === 0"
          :image="simpleEmpty"
          description="暂无热门图书"
        />
        <a-row v-else :gutter="[16, 16]">
          <a-col
            v-for="book in hotBooks"
            :key="book.id"
            :xs="24"
            :sm="12"
            :md="8"
            :lg="6"
          >
            <div class="book-card">
              <div class="book-cover">
                <img :src="book.cover" :alt="book.title" />
              </div>
              <div class="book-info">
                <h4 class="book-title">{{ book.title }}</h4>
                <p class="book-author">{{ book.author }}</p>
                <div class="book-meta">
                  <a-tag color="blue" class="category-tag">{{ book.categoryName }}</a-tag>
                  <span class="book-available">
                    <span class="stock-icon">📚</span>
                    {{ book.available }}/{{ book.total }}
                  </span>
                </div>
              </div>
            </div>
          </a-col>
        </a-row>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, h } from 'vue'
import { Empty, Modal, message } from 'ant-design-vue'
import dayjs from 'dayjs'
import {
  DatabaseOutlined,
  SwapOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  HistoryOutlined,
  RightOutlined,
  PieChartOutlined,
  FireOutlined,
  ReloadOutlined,
  DeleteOutlined,
  CalendarOutlined,
  ClearOutlined,
  FieldTimeOutlined
} from '@ant-design/icons-vue'
import { useBookStore } from '@/stores/book'
import { useBorrowStore } from '@/stores/borrow'
import { useCategoryStore } from '@/stores/category'
import { useOverviewStore } from '@/stores/overview'

const bookStore = useBookStore()
const borrowStore = useBorrowStore()
const categoryStore = useCategoryStore()
const overview = useOverviewStore()

// 筛选控件与 store 之间的双向绑定（store 内以 YYYY-MM-DD 字符串持久化）
const dateRangeValue = computed({
  get: () => {
    const range = overview.dateRange
    return range ? [dayjs(range[0]), dayjs(range[1])] : null
  },
  set: value => overview.setDateRange(value)
})

const statusValue = computed({
  get: () => overview.statusFilter,
  set: value => overview.setStatus(value)
})

const categoryValue = computed({
  get: () => overview.categoryId,
  set: value => overview.setCategoryId(value)
})

const columns = [
  { title: '读者', key: 'reader', width: 120 },
  { title: '图书', key: 'book' },
  { title: '分类', key: 'category', width: 100 },
  { title: '借阅日期', dataIndex: 'borrowDate', key: 'borrowDate', width: 110 },
  { title: '应还日期', dataIndex: 'dueDate', key: 'dueDate', width: 110 },
  { title: '状态', key: 'status', width: 90 },
  { title: '操作', key: 'action', width: 80 }
]

// 空态：与加载中（表格 loading）、加载失败（错误页）三者明确区分
const simpleEmpty = Empty.PRESENTED_IMAGE_SIMPLE
const tableLocale = {
  emptyText: h(Empty, {
    image: Empty.PRESENTED_IMAGE_SIMPLE,
    description: '当前筛选条件下暂无借阅记录'
  })
}

// 热门图书：保持既有排序规则（图书列表前 4 本），不受概览筛选影响
const hotBooks = computed(() => {
  return bookStore.books.slice(0, 4)
})

// 分类统计：保持既有排序规则
const topCategories = computed(() => {
  return categoryStore.categories.slice(0, 6)
})

const maxBookCount = computed(() => {
  const counts = categoryStore.categories.map(c => c.bookCount)
  return Math.max(...counts, 1)
})

function bucketPercent(count) {
  if (overview.overdueCount === 0) return 0
  return Math.round((count / overview.overdueCount) * 100)
}

function getStatusColor(status) {
  const colors = {
    borrowed: 'processing',
    returned: 'success',
    overdue: 'error'
  }
  return colors[status] || 'default'
}

function getStatusText(status) {
  const texts = {
    borrowed: '借阅中',
    returned: '已归还',
    overdue: '已逾期'
  }
  return texts[status] || status
}

const progressColors = ['#1890ff', '#52c41a', '#faad14', '#722ed1', '#eb2f96', '#13c2c2', '#fa541c', '#2f54eb']

function getProgressColor(id) {
  return progressColors[(id - 1) % progressColors.length]
}

// 手动刷新：loading / error 由 store 统一维护
async function handleRefresh() {
  const ok = await borrowStore.reloadRecords()
  if (ok) {
    message.success('统计数据已刷新')
  } else {
    message.error('统计数据加载失败，请重试')
  }
}

// 删除借阅：store 内 records 变更后，卡片、逾期分布、明细列表同源自动刷新
function handleDelete(record) {
  Modal.confirm({
    title: '删除借阅记录',
    content: `确定删除「${record.readerName} - ${record.bookTitle}」的借阅记录吗？删除后概览统计将同步更新。`,
    okText: '确定删除',
    okType: 'danger',
    cancelText: '取消',
    onOk() {
      const ok = borrowStore.deleteRecord(record.id)
      if (ok) {
        message.success('借阅记录已删除')
      } else {
        message.error('记录不存在或已被删除')
      }
    }
  })
}
</script>

<style lang="less" scoped>
// ========================================
// 动画定义
// ========================================
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes progressGrow {
  from { width: 0; }
}

.animate-fade-in {
  animation: fadeIn 0.5s ease-out both;
}

// ========================================
// 页头与筛选区
// ========================================
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;

  .page-title {
    font-size: 20px;
    font-weight: 600;
    color: #1a1a1a;
    margin-bottom: 0;
  }
}

.filter-bar {
  background: #fff;
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 16px;
  border: 1px solid #f0f0f0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;

  .filter-item {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .filter-label {
    font-size: 13px;
    color: #666;
    white-space: nowrap;
  }

  .filter-select {
    width: 130px;
  }

  .category-select {
    min-width: 150px;
  }

  .reset-btn {
    padding-left: 0;
    padding-right: 0;
  }
}

.error-result {
  background: #fff;
  border-radius: 12px;
  border: 1px solid #f0f0f0;
  margin-bottom: 16px;
}

// ========================================
// 统计卡片
// ========================================
.stat-row {
  margin-bottom: 0;
}

.stat-card {
  background: linear-gradient(135deg, #1890ff 0%, #40a9ff 100%);
  border-radius: 12px;
  padding: 24px;
  display: flex;
  align-items: center;
  color: #fff;
  box-shadow: 0 2px 8px rgba(24, 144, 255, 0.15);
  position: relative;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.3s ease;
  height: 100%;
  box-sizing: border-box;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 32px rgba(24, 144, 255, 0.35);
  }

  &.active {
    border-color: rgba(255, 255, 255, 0.85);
    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.35), 0 8px 24px rgba(0, 0, 0, 0.18);
  }

  &.success {
    background: linear-gradient(135deg, #52c41a 0%, #73d13d 100%);
    box-shadow: 0 2px 8px rgba(82, 196, 26, 0.15);

    &:hover {
      box-shadow: 0 12px 32px rgba(82, 196, 26, 0.4);
    }
  }

  &.warning {
    background: linear-gradient(135deg, #faad14 0%, #ffc53d 100%);
    box-shadow: 0 2px 8px rgba(250, 173, 20, 0.15);

    &:hover {
      box-shadow: 0 12px 32px rgba(250, 173, 20, 0.4);
    }
  }

  &.error {
    background: linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%);
    box-shadow: 0 2px 8px rgba(255, 77, 79, 0.15);

    &:hover {
      box-shadow: 0 12px 32px rgba(255, 77, 79, 0.4);
    }
  }

  .stat-card-bg {
    position: absolute;
    right: -20px;
    bottom: -20px;
    width: 120px;
    height: 120px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 50%;
    transition: transform 0.3s ease;
  }

  &:hover .stat-card-bg {
    transform: scale(1.1);
  }

  .stat-icon {
    font-size: 40px;
    opacity: 0.9;
    margin-right: 20px;
    z-index: 1;
  }

  .stat-info {
    z-index: 1;

    .stat-value {
      font-size: 32px;
      font-weight: 700;
      line-height: 1.2;
    }

    .stat-label {
      font-size: 14px;
      opacity: 0.9;
      margin-top: 4px;
    }
  }
}

// ========================================
// 通用卡片容器
// ========================================
.card-container {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: box-shadow 0.3s ease;
  border: 1px solid #f0f0f0;
  height: 100%;

  &:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  }

  &.equal-height {
    display: flex;
    flex-direction: column;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid #f0f0f0;

    .card-title {
      font-size: 16px;
      font-weight: 600;
      color: #1a1a1a;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .card-count {
      font-size: 12px;
      font-weight: 400;
      color: #999;
    }

    .overdue-total {
      font-size: 12px;
      color: #ff4d4f;
      background: #fff1f0;
      padding: 2px 10px;
      border-radius: 10px;
    }

    .view-all-btn {
      transition: all 0.3s ease;

      &:hover {
        transform: translateX(2px);
      }
    }
  }

  .card-body {
    padding: 16px 20px;
    flex: 1;
  }
}

.cell-primary {
  font-weight: 500;
  color: #1a1a1a;
}

.cell-secondary {
  font-size: 12px;
  color: #999;
}

.table-action-btn {
  padding: 2px 4px;
}

// ========================================
// 逾期分布
// ========================================
.overdue-body {
  display: flex;
  flex-direction: column;
  gap: 4px;

  .overdue-empty-alert {
    margin-bottom: 12px;
  }
}

.overdue-bucket {
  padding: 10px 0;
  border-bottom: 1px solid #f5f5f5;

  &:last-child {
    border-bottom: none;
  }

  .overdue-bucket-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }

  .overdue-bucket-label {
    font-size: 13px;
    color: #1a1a1a;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .overdue-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .overdue-bucket-count {
    font-size: 13px;
    font-weight: 600;
    color: #1a1a1a;
  }
}

// ========================================
// 分类列表
// ========================================
.category-body {
  padding: 8px 20px !important;
}

.category-list {
  .category-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid #f5f5f5;
    flex-wrap: wrap;

    &:last-child {
      border-bottom: none;
    }

    .category-left {
      display: flex;
      align-items: center;
      gap: 10px;

      .category-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .category-name {
        font-size: 14px;
        color: #1a1a1a;
      }
    }

    .category-right {
      display: flex;
      align-items: baseline;
      gap: 2px;

      .category-count {
        font-size: 16px;
        font-weight: 600;
        color: #1a1a1a;
      }

      .category-unit {
        font-size: 12px;
        color: #999;
      }
    }

    .category-progress {
      width: 100%;
      height: 2px;
      background: #f0f0f0;
      border-radius: 2px;
      margin-top: 8px;
      overflow: hidden;

      .category-progress-bar {
        height: 100%;
        border-radius: 2px;
        transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        animation: progressGrow 1s ease-out both;
      }
    }
  }
}

// ========================================
// 热门图书
// ========================================
.book-card {
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #f0f0f0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  box-sizing: border-box;
  height: 100%;
  transition: all 0.3s ease;

  &:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
    border-color: #1890ff;
  }

  .book-cover {
    height: 180px;
    overflow: hidden;
    background: #f5f5f5;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  .book-info {
    padding: 16px;

    .book-title {
      font-size: 14px;
      font-weight: 600;
      color: #1a1a1a;
      margin: 0 0 8px 0;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      line-height: 1.5;
      min-height: 42px;
      word-break: break-all;
    }

    .book-author {
      font-size: 13px;
      color: #666;
      margin: 0 0 12px 0;
    }

    .book-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;

      .book-available {
        font-size: 12px;
        color: #999;
        display: flex;
        align-items: center;
        gap: 4px;

        .stock-icon {
          font-size: 14px;
        }
      }
    }
  }
}
</style>
