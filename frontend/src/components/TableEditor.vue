<template>
  <div class="te-wrapper">
    <div v-if="!props.config?.hideToolbar" class="te-toolbar">
      <div class="te-toolbar-start">
        <template v-for="btn in buttonGroups.toolbar" :key="btn.key">
          <button v-if="btn.isVisible()"
            :class="['btn', 'btn-sm', btn.severity, btn.class]"
            :disabled="btn.isDisabled()"
            :data-help="btn.helpKey"
            @click="btn.onClick">
            <i v-if="btn.icon" :class="btn.icon + ' me-1'"></i>
            {{ btn.getLabel() }}
          </button>
        </template>
      </div>
      <div class="te-toolbar-end">
        <div class="dropdown d-inline-block me-2">
          <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button"
            data-bs-toggle="dropdown" title="Columnas">
            <i class="bi bi-layout-three-columns me-1"></i>Columnas
          </button>
          <div class="dropdown-menu p-2" style="min-width:200px;max-height:300px;overflow-y:auto">
            <div v-for="col in availableColumns" :key="col.field" class="form-check px-2 py-1">
              <input type="checkbox" :id="'te-col-'+col.field" class="form-check-input"
                :checked="selectedColumns.includes(col)"
                @change="toggleColumn(col)" />
              <label :for="'te-col-'+col.field" class="form-check-label ms-1">{{ col.headerName }}</label>
            </div>
          </div>
        </div>
        <div class="input-group input-group-sm" style="width:200px">
          <span class="input-group-text"><i class="bi bi-search"></i></span>
          <input type="text" class="form-control" v-model="globalFilter.value"
            @input="_onGlobalFilterDebounced" placeholder="Buscar..." />
        </div>
      </div>
    </div>

    <div class="te-scroll-wrap" ref="_scrollWrapRef" @scroll="_onScroll"
      :style="scrollHeight ? { height: scrollHeight, minHeight: scrollHeight } : {}">
      <div v-if="loading" class="te-loading-overlay">
        <div class="te-loading-spinner-large"></div>
        <span class="te-loading-text">Cargando...</span>
      </div>

      <table class="te-table" :class="{ 'te-striped': striped }">
        <colgroup>
          <col v-if="selectionMode !== null" :style="{ width: selectionColWidth }" />
          <col v-if="actionButtons.length" :style="{ width: actionColWidth }" />
          <col v-for="col of visibleColumns" :key="col.field"
            :style="{ width: columnWidths[col.field] }" :data-field="col.field" />
          <col class="te-col-filler" />
        </colgroup>
        <thead>
          <template v-if="hasColumnGroups">
            <tr class="te-header-group-row">
              <th v-if="selectionMode !== null" class="te-th te-th-sel" :rowspan="2">
                <input v-if="selectionMode === 'multiple'" type="checkbox" :checked="isAllSelected"
                  @change="_toggleSelectAll" />
              </th>
              <th v-if="actionButtons.length" class="te-th te-th-acts" :rowspan="2" :style="{ width: columnWidths['__actions__'] }">
                  <div class="te-th-content">
                    <span class="te-th-label">Acciones</span>
                  </div>
                  <div class="te-resize-handle"
                    :class="{ 'te-resizing-active': _resizingField === '__actions__' }"
                    draggable="false"
                    @pointerdown.stop="_onResizeStart($event, '__actions__')"
                    @dblclick.stop="_onResizeDblClick($event, '__actions__')"
                    @click.stop />
                </th>
              <template v-for="hcol of columnGroupHeaders" :key="hcol._key">
                <th v-if="hcol._type === 'group'" :colspan="hcol._span" class="te-th te-th-group">
                  <div class="te-th-content">
                    <span class="te-th-label">{{ hcol.headerName }}</span>
                  </div>
                </th>
                <th v-else :rowspan="2"
                  :data-field="hcol._col.field"
                  :style="{ width: columnWidths[hcol._col.field] }"
                  :class="['te-th', hcol._col.css, stylingRowClass]"
                  :draggable="false">
                  <div class="te-th-content">
                    <span class="te-th-label" @click.stop="_onSortClick(hcol._col.field)">
                      {{ hcol._col.headerName }}
                      <span v-if="hcol._col.sortable" class="te-sort-icon-std">
                        {{ sortField === hcol._col.field ? (sortOrder === 'asc' ? '▲' : '▼') : '⇅' }}
                      </span>
                    </span>
                  </div>
                  <div class="te-resize-handle"
                    :class="{ 'te-resizing-active': _resizingField === hcol._col.field }"
                    draggable="false"
                    @pointerdown.stop="_onResizeStart($event, hcol._col.field)"
                    @dblclick.stop="_onResizeDblClick($event, hcol._col.field)"
                    @click.stop />
                </th>
              </template>
              <th class="te-th te-th-filler" :rowspan="2" />
            </tr>
            <tr class="te-header-row te-has-groups">
              <template v-for="hcol of columnGroupHeaders" :key="'r2-' + hcol._key">
                <template v-if="hcol._type === 'group'">
                  <th v-for="col of hcol._cols" :key="col.field"
                    :data-field="col.field"
                    :style="{ width: columnWidths[col.field] }"
                    :class="['te-th', col.css, stylingRowClass]"
                    :draggable="false">
                    <div class="te-th-content">
                      <span class="te-th-label" @click.stop="_onSortClick(col.field)">
                        {{ col.headerName }}
                        <span v-if="col.sortable" class="te-sort-icon-std">
                          {{ sortField === col.field ? (sortOrder === 'asc' ? '▲' : '▼') : '⇅' }}
                        </span>
                      </span>
                    </div>
                    <div class="te-resize-handle"
                      :class="{ 'te-resizing-active': _resizingField === col.field }"
                      draggable="false"
                      @pointerdown.stop="_onResizeStart($event, col.field)"
                      @dblclick.stop="_onResizeDblClick($event, col.field)"
                      @click.stop />
                  </th>
                </template>
              </template>
            </tr>
          </template>
          <tr v-if="!hasColumnGroups" class="te-header-row">
            <th v-if="selectionMode !== null" class="te-th te-th-sel">
              <input v-if="selectionMode === 'multiple'" type="checkbox" :checked="isAllSelected"
                @change="_toggleSelectAll" />
            </th>
            <th v-if="actionButtons.length" class="te-th te-th-acts" :style="{ width: columnWidths['__actions__'] }">
              <div class="te-th-content">
                <span class="te-th-label">Acciones</span>
              </div>
              <div class="te-resize-handle"
                :class="{ 'te-resizing-active': _resizingField === '__actions__' }"
                draggable="false"
                @pointerdown.stop="_onResizeStart($event, '__actions__')"
                @dblclick.stop="_onResizeDblClick($event, '__actions__')"
                @click.stop />
            </th>
            <th v-for="col of visibleColumns" :key="col.field"
              :data-field="col.field"
              :style="{ width: columnWidths[col.field] }"
              :class="['te-th', col.css, stylingRowClass, {
                'te-th-dragover-left': _dragOverField === col.field && _dropSide === 'left',
                'te-th-dragover-right': _dragOverField === col.field && _dropSide === 'right',
                'te-th-dragging': _dragField === col.field
              }]"
              :draggable="reorderableColumns"
              @dragstart="_onDragStart($event, col.field)"
              @dragenter.prevent="_onDragEnter($event, col.field)"
              @dragover.prevent="_onDragOver($event, col.field)"
              @dragleave="_onDragLeave($event, col.field)"
              @drop.prevent="_onDrop($event, col.field)"
              @dragend="_onDragEnd">
              <div class="te-th-content">
                <span class="te-th-grip" v-if="reorderableColumns">⠿</span>
                <span class="te-th-label" @click.stop="_onSortClick(col.field)">
                  {{ col.headerName }}
                  <span v-if="col.sortable" class="te-sort-icon-std">
                    {{ sortField === col.field ? (sortOrder === 'asc' ? '▲' : '▼') : '⇅' }}
                  </span>
                </span>
              </div>
              <div class="te-resize-handle"
                :class="{ 'te-resizing-active': _resizingField === col.field }"
                draggable="false"
                @pointerdown.stop="_onResizeStart($event, col.field)"
                @dblclick.stop="_onResizeDblClick($event, col.field)"
                @click.stop />
              <div v-if="_dragOverField === col.field && _dropSide === 'left'" class="te-drop-indicator te-drop-left" />
              <div v-if="_dragOverField === col.field && _dropSide === 'right'" class="te-drop-indicator te-drop-right" />
            </th>
            <th class="te-th te-th-filler" />
          </tr>
          <tr v-if="showFilterRow" class="te-filter-row">
            <td v-if="selectionMode !== null" class="te-td" />
            <td v-if="actionButtons.length" class="te-td" :style="{ width: columnWidths['__actions__'] }" />
            <td v-for="col of visibleColumns" :key="'f-' + col.field" class="te-td"
              :style="{ width: columnWidths[col.field] }"
              @dragenter.prevent="_onDragEnter($event, col.field)"
              @dragover.prevent="_onDragOver($event, col.field)"
              @dragleave="_onDragLeave($event, col.field)"
              @drop.prevent="_onDrop($event, col.field)">
              <input v-model="columnFilters[col.field]" @input="_onFilterDebounced" type="text"
                class="te-filter-input" placeholder="" />
              <div class="te-resize-handle"
                :class="{ 'te-resizing-active': _resizingField === col.field }"
                draggable="false"
                @pointerdown.stop="_onResizeStart($event, col.field)"
                @dblclick.stop="_onResizeDblClick($event, col.field)"
                @click.stop />
            </td>
            <td class="te-td te-td-filler" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, rIdx) of displayRows" :key="rIdx"
            :class="['te-tr', row.__css_class, {
              'te-tr-selected': _isSelected(row),
              'te-tr-highlight': row === selectedRow
            }]" :style="row.__style"
            @click="_onRowClick(row)" @dblclick="_onRowDblClick(row)">
            <td v-if="selectionMode !== null" class="te-td te-td-sel" @click.stop>
              <input v-if="selectionMode === 'multiple'" type="checkbox" :checked="_isSelected(row)"
                @change="_toggleRowSelection(row)" />
              <input v-else type="radio" :checked="selectedRow === row" @change="_selectSingle(row)" />
            </td>
            <td v-if="actionButtons.length" class="te-td te-td-acts" :style="{ width: columnWidths['__actions__'] }">
              <div class="te-actions-wrap">
                <template v-for="btn of actionButtons" :key="btn.key">
                  <button v-if="btn.isVisible()"
                    :class="['btn', 'btn-sm', btn.severity, btn.class]"
                    :disabled="btn.isDisabled()"
                    :data-help="btn.helpKey"
                    @click.stop="btn.onClick(row)">
                    <i v-if="btn.icon" :class="btn.icon + ' me-1'"></i>
                    {{ btn.getLabel() }}
                  </button>
                </template>
              </div>
            </td>
            <td v-for="col of visibleColumns" :key="col.field"
              :class="['te-td', col.css, stylingRowClass, {
                'te-td-selected': _isSelected(row),
                'te-td-editing': _isEditingCell(row, col),
                'te-td-inline-edit': !_isEditingCell(row, col) && _getInlineEditCfg(col)
              }]"
              :style="[{ width: columnWidths[col.field] }, _cellStyle(row, col)]"
              @dragenter.prevent="_onDragEnter($event, col.field)"
              @dragover.prevent="_onDragOver($event, col.field)"
              @dragleave="_onDragLeave($event, col.field)"
              @drop.prevent="_onDrop($event, col.field)">
              <template v-if="_isEditingCell(row, col)">
                <input v-model="_inlineEditValue" type="text"
                  class="te-editing-input"
                  @blur="_confirmInlineEdit(row, col)"
                  @keydown.enter="_confirmInlineEdit(row, col)"
                  @keydown.escape="_cancelInlineEdit"
                  ref="_inlineEditRef" />
              </template>
              <div v-else class="te-cell-wrap">
                <span @dblclick="_onCellDblClick($event, row, col)" v-html="_formatCell(row, col)" />
                <button v-if="_getInlineEditCfg(col)" class="te-inline-edit-btn"
                  @click.stop="_startInlineEdit(row, col)"
                  title="Editar">
                  <i class="bi bi-pencil" />
                </button>
              </div>
              <div class="te-resize-handle"
                :class="{ 'te-resizing-active': _resizingField === col.field }"
                draggable="false"
                @pointerdown.stop="_onResizeStart($event, col.field)"
                @dblclick.stop="_onResizeDblClick($event, col.field)"
                @click.stop />
            </td>
            <td class="te-td te-td-filler" />
          </tr>
          <tr v-if="!displayRows.length">
            <td :colspan="totalColspan" class="te-td te-empty">Sin registros</td>
          </tr>
        </tbody>
      </table>
      <div v-if="infiniteScroll" ref="_sentinelRef" class="te-sentinel">
        <span v-if="isLoadingMore" class="te-loading-spinner"></span>
      </div>
    </div>

    <div v-show="!infiniteScroll && showPaginator" class="te-paginator">
      <span class="te-page-info">Mostrando {{ pageStart }} a {{ pageEnd }} de {{ totalRows }}</span>
      <div class="te-page-controls">
        <button class="te-page-btn" :disabled="currentPage <= 1" @click="_goToPage(1)">««</button>
        <button class="te-page-btn" :disabled="currentPage <= 1" @click="_goToPage(currentPage - 1)">«</button>
        <span class="te-page-current">{{ currentPage }} / {{ totalPages }}</span>
        <button class="te-page-btn" :disabled="currentPage >= totalPages" @click="_goToPage(currentPage + 1)">»</button>
        <button class="te-page-btn" :disabled="currentPage >= totalPages" @click="_goToPage(totalPages)">»»</button>
      </div>
      <select v-model="pageSize" class="te-page-size" @change="_onPageSizeChange">
        <option v-for="s of pageSizeOptions" :key="s" :value="s">{{ s }}</option>
      </select>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, onUnmounted, nextTick } from 'vue'
import { useModalStore } from '@/stores/modal'
import { usePreferenciasStore } from '@/stores/preferencias'
import { BtnConfig } from './BtnConfig'
import { mapFilaJSONtabla, getCamposJSONyFieldDef, getCamposJson } from '@/helpers/mapCampoJSON'
import { getProcessFieldDef, reOrder, getFieldsForFilter, getFiltersFrFields, getFieldDefFFormated } from '@/helpers/procesarFieldDef'
import { row_formatter } from '@/helpers/formatter'
import { verifica_permisos } from '@/helpers/rbac'
import AlertModal from '@/components/modals/AlertModal.vue'
import ConfirmModal from '@/components/modals/ConfirmModal.vue'
import FormularioGenerico from '@/components/genericos/formulario-generico/FormularioGenerico.vue'

const modal = useModalStore()
const prefStore = usePreferenciasStore()
const props = defineProps(['api', 'permisos', 'config', 'data', 'id'])
const emit = defineEmits(['loaded', 'rowSelected', 'rowDoubleClick'])
defineExpose({ loadData, applyConfig })

const STORAGE_KEY_PREFIX = 'te_cfg'

function _getPrefKey() { return props.id ? `${STORAGE_KEY_PREFIX}_${props.id}` : null }

async function _loadPersistedConfig() {
  const key = _getPrefKey()
  if (!key) return null
  try {
    const val = prefStore.valor(key)
    if (val) return typeof val === 'string' ? JSON.parse(val) : val
    return null
  } catch { return null }
}

async function _savePersistedConfig() {
  const key = _getPrefKey()
  if (!key) return
  const fields = visibleColumns.value.map(c => c.field)
  if (actionButtons.value.length) fields.push('__actions__')
  const cw = {}
  for (const f of fields) cw[f] = columnWidths.value[f] || '15rem'
  const ord = columnOrder.value.length ? columnOrder.value : fields
  await prefStore.guardarMisPreferencias({ [key]: JSON.stringify({ columnOrder: ord, columnWidths: cw }) })
}

let _saveTimer = null
function _debouncedPersist() {
  if (_saveTimer) clearTimeout(_saveTimer)
  _saveTimer = setTimeout(() => _savePersistedConfig(), 500)
}

const rows = ref([])
const columnDefs = ref([])
const selectedColumns = ref([])
const availableColumns = ref([])
const isLoaded = ref(false)
const editEnabled = ref(true)
const formModel = ref({})
const selectionMode = ref('single')
const stylingRowClass = ref('')
const pinnedRows = ref([])
const totalRecords = ref(0)
const _lazyParams = ref({ page: 1, rows: 25 })
const lazy = computed(() => props.config?.lazy === true)
const loading = ref(false)

const infiniteScroll = computed(() => props.config?.infiniteScroll === true || (props.config?.infiniteScroll !== false && lazy.value))
const _sentinelRef = ref(null)
const _scrollWrapRef = ref(null)
const isLoadingMore = ref(false)
const hasMorePages = ref(true)
const _infinitePage = ref(1)

let _filterTimer = null
let _gfTimer = null
let _infiniteObserver = null

const selectedRow = ref(null)
const selectedRows = ref(new Map())
const sortField = ref(null)
const sortOrder = ref('asc')
const columnFilters = ref({})
const globalFilter = ref({ value: null })
const currentPage = ref(1)
const pageSize = ref(25)
const pageSizeOptions = ref([25, 50, 100, 200])
const scrollHeight = ref(null)
const showPaginator = ref(true)
const striped = ref(true)
const resizableColumns = ref(true)
const reorderableColumns = ref(true)
const showFilterRow = ref(false)
const selectionColWidth = ref('3rem')
const actionColWidth = ref('auto')
const columnWidths = ref({})
const columnOrder = ref([])

let _dragField = null
const _dragOverField = ref(null)
const _dropSide = ref(null)
const _resizingField = ref(null)
let _resizeStartX = null
let _resizeStartWidth = null

const _editingCell = ref(null)
const _inlineEditValue = ref(null)
const _inlineEditRef = ref(null)
const _inlineOriginalValue = ref(null)
let _inlineSaveTimer = null
let _pendingInlineSave = null

const elementLabels = ref({
  create: 'Nuevo', edit: 'Editar', delete: 'Borrar',
  article: 'un', deleted: 'eliminado'
})

const actionButtons = computed(() => buttonGroups.value.rowActions || [])

const visibleColumns = computed(() => {
  const sel = selectedColumns.value
  if (columnOrder.value.length) {
    const ordered = []
    for (const f of columnOrder.value) {
      const found = sel.find(c => c.field === f)
      if (found) ordered.push(found)
    }
    for (const c of sel) if (!ordered.some(x => x.field === c.field)) ordered.push(c)
    return ordered
  }
  return sel
})

const totalColspan = computed(() => {
  let n = visibleColumns.value.length + 1
  if (selectionMode.value !== null) n++
  if (actionButtons.value.length) n++
  return n
})

const hasColumnGroups = computed(() => {
  return props.config?.columnGroups?.length > 0
})

const inlineEditingConfig = computed(() => props.config?.inlineEditing)
const _inlineEditFields = computed(() => inlineEditingConfig.value?.campos || {})

const columnGroupHeaders = computed(() => {
  if (!hasColumnGroups.value) return []
  const groups = props.config.columnGroups || []
  const cols = visibleColumns.value
  const fieldToGroup = {}
  for (let gi = 0; gi < groups.length; gi++) {
    for (const f of groups[gi].fields) {
      fieldToGroup[f] = gi
    }
  }
  const result = []
  let i = 0
  while (i < cols.length) {
    const col = cols[i]
    const gi = fieldToGroup[col.field]
    if (gi !== undefined) {
      const groupCols = []
      while (i < cols.length && fieldToGroup[cols[i].field] === gi) {
        groupCols.push(cols[i])
        i++
      }
      if (groupCols.length) {
        result.push({
          _key: 'group-' + gi,
          _type: 'group',
          headerName: groups[gi].headerName,
          _span: groupCols.length,
          _cols: groupCols
        })
      }
    } else {
      result.push({
        _key: 'col-' + col.field,
        _type: 'col',
        _col: col
      })
      i++
    }
  }
  return result
})

const filteredRows = computed(() => {
  let r = rows.value || []
  const gf = globalFilter.value?.value
  if (gf) {
    const q = gf.toLowerCase()
    r = r.filter(row => visibleColumns.value.some(c => {
      const v = row[c.field]
      return v != null && String(v).toLowerCase().includes(q)
    }))
  }
  for (const col of visibleColumns.value) {
    const fv = columnFilters.value[col.field]
    if (fv) {
      const q = fv.toLowerCase()
      r = r.filter(row => {
        const v = row[col.field]
        return v != null && String(v).toLowerCase().includes(q)
      })
    }
  }
  if (sortField.value) {
    r = [...r].sort((a, b) => {
      let va = a[sortField.value], vb = b[sortField.value]
      if (va == null) va = ''
      if (vb == null) vb = ''
      if (typeof va === 'number' && typeof vb === 'number') return sortOrder.value === 'asc' ? va - vb : vb - va
      va = String(va).toLowerCase()
      vb = String(vb).toLowerCase()
      return sortOrder.value === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    })
  }
  return r
})

const totalRows = computed(() => lazy.value ? totalRecords.value : filteredRows.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(totalRows.value / pageSize.value)))

const displayRows = computed(() => {
  if (infiniteScroll.value) return rows.value || []
  if (lazy.value) return rows.value || []
  const start = (currentPage.value - 1) * pageSize.value
  return filteredRows.value.slice(start, start + pageSize.value)
})

const pageStart = computed(() => (currentPage.value - 1) * pageSize.value + 1)
const pageEnd = computed(() => Math.min(currentPage.value * pageSize.value, totalRows.value))

const isAllSelected = computed(() => {
  if (!displayRows.value.length) return false
  return displayRows.value.every(r => _isSelected(r))
})

const buttonGroups = ref({
  toolbar: [
    new BtnConfig({ key: 'refresh', icon: 'bi bi-arrow-clockwise', severity: 'btn-info',
      onClick: _refresh, isVisible: () => !props.config?.hideRefresh }),
    new BtnConfig({ key: 'csv', icon: 'bi bi-download', severity: 'btn-info',
      onClick: _exportCsv, label: 'CSV', isVisible: () => !props.config?.hideCsvExport }),
    new BtnConfig({ key: 'create', icon: 'bi bi-plus', severity: 'btn-success',
      permissions: props.permisos?.create, onClick: _createRecord,
      isVisible: () => props.api?.create != null, getLabel: () => elementLabels.value.create }),
    new BtnConfig({ key: 'edit', icon: 'bi bi-pencil', severity: 'btn-warning',
      permissions: props.permisos?.edit, onClick: _editRecord,
      isVisible: () => props.api?.edit != null, getLabel: () => elementLabels.value.edit,
      isDisabled: () => editEnabled.value }),
    new BtnConfig({ key: 'delete', icon: 'bi bi-trash', severity: 'btn-danger',
      permissions: props.permisos?.delete, onClick: _deleteRecord,
      isVisible: () => props.api?.delete != null, getLabel: () => elementLabels.value.delete,
      isDisabled: () => editEnabled.value })
  ],
  rowActions: []
})

function applyConfig() {
  if (props.config?.selectionMode != null) selectionMode.value = props.config.selectionMode
  if (props.config?.elementName?.gender === 'F') {
    elementLabels.value = { create: 'Nueva', edit: 'Editar', delete: 'Borrar', article: 'una', deleted: 'eliminada' }
  }
  if (props.config?.pageSize != null) pageSize.value = props.config.pageSize
  if (props.config?.pageSizeOptions != null) pageSizeOptions.value = props.config.pageSizeOptions
  if (props.config?.scrollHeight != null) scrollHeight.value = props.config.scrollHeight
  if (props.config?.styling?.rowClass) stylingRowClass.value = props.config.styling.rowClass
  if (props.config?.showPaginator != null) showPaginator.value = props.config.showPaginator
  if (props.config?.showFilterRow != null) showFilterRow.value = props.config.showFilterRow
  if (props.config?.striped != null) striped.value = props.config.striped
  if (props.config?.resizableColumns != null) resizableColumns.value = props.config.resizableColumns
  if (props.config?.reorderableColumns != null) reorderableColumns.value = props.config.reorderableColumns
  if (props.config?.selectionColWidth) selectionColWidth.value = props.config.selectionColWidth
  if (props.config?.actionColWidth) actionColWidth.value = props.config.actionColWidth
  if (props.config?.buttons) {
    for (const k of Object.keys(buttonGroups.value)) {
      if (props.config.buttons[k]) {
        buttonGroups.value[k] = [...buttonGroups.value[k], ...props.config.buttons[k]]
      }
    }
  }
}

function toggleColumn(col) {
  const idx = selectedColumns.value.indexOf(col)
  if (idx >= 0) {
    selectedColumns.value = selectedColumns.value.filter(c => c !== col)
  } else {
    selectedColumns.value = [...selectedColumns.value, col]
  }
  _debouncedPersist()
}

function _applyFieldDefCss(fd) {
  for (let c = 0; c < fd?.length; c++) {
    const f = fd[c]
    f.css = (f.css || '') + (props.config?.styling?.fieldClasses?.[f.field] ? ' ' + props.config.styling.fieldClasses[f.field] : '')
  }
  return fd
}

function _applyRowDefCss(row) {
  row.__css_class = ''
  if (typeof props.config?.styling?.rowClassFn === 'function')
    row.__css_class = props.config.styling.rowClassFn(row)
  if (typeof props.config?.styling?.rowStyleFn === 'function')
    row.__style = props.config.styling.rowStyleFn(row)
  row.__field_styles = {}
  if (props.config?.styling?.fieldStyleFns) {
    for (const f of Object.keys(props.config.styling.fieldStyleFns)) {
      if (row[f] != null)
        row.__field_styles[f] = props.config.styling.fieldStyleFns[f](row[f])
    }
  }
  return row
}

function _invertHexColor(h) {
  if (h.length !== 7) return null
  return '#' + (255 - parseInt(h.slice(1, 3), 16)).toString(16).padStart(2, '0') +
    (255 - parseInt(h.slice(3, 5), 16)).toString(16).padStart(2, '0') +
    (255 - parseInt(h.slice(5, 7), 16)).toString(16).padStart(2, '0')
}

function _unwrapCell(row, col) {
  if (row == null) return { value: null, style: null }
  const v = row[col?.field]
  if (v != null && typeof v === 'object' && '__style' in v) return { value: v.value, style: v.__style }
  if (row.__field_styles?.[col?.field]) return { value: v, style: row.__field_styles[col?.field] }
  return { value: v, style: null }
}

function _cellStyle(row, col) {
  return _unwrapCell(row, col).style
}

function _formatCell(row, col) {
  let { value: data } = _unwrapCell(row, col)
  if (data === null) return '-'
  const formatter = props.config?.valueFormatters?.[col?.field]
  if (col?.form_type === 'color') {
    if (data == null || data === '') data = 'NULL'
    const bg = '#' + data
    const fg = _invertHexColor(bg) || '#FFF'
    return `<span class="te-color-badge" style="background:${bg};color:${fg}">${data}</span>`
  }
  if (col?.form_type === 'json') return JSON.stringify(data)
  return formatter === undefined ? data : (typeof formatter === 'function' ? formatter(row) : data)
}

function _emitLoaded(s) { isLoaded.value = s; emit('loaded', s) }

async function _createRecord() {
  let cf = [...columnDefs.value]
  const fc = props.config?.formConfig || {}
  if (props.config?.extraFields?.create) cf.push(...props.config.extraFields.create)
  const modalId = modal.open(FormularioGenerico, {
    campos: cf,
    modelo: formModel.value,
    onSubmit: props.api.create,
    guardado: _refresh,
    _modalState: null,
  }, { title: `${elementLabels.value.create} ${props.config?.elementName?.singular || ''}` })
}

async function _editRecord() {
  if (!props.api?.edit) return
  if (!selectedRow.value && !selectedRows.value.size) {
    modal.open(AlertModal, { message: `Es necesario seleccionar ${elementLabels.value.article} ${props.config?.elementName?.singular || 'elemento'}` }, { title: 'Aviso' })
    return
  }
  let dr = selectionMode.value === 'multiple' ? [...selectedRows.value.values()][0] : selectedRow.value
  let cf = [...columnDefs.value]
  if (props.config?.extraFields?.edit) cf.push(...props.config.extraFields.edit)
  modal.open(FormularioGenerico, {
    campos: cf,
    modelo: dr,
    onSubmit: props.api.edit,
    guardado: _refresh,
    _modalState: null,
  }, { title: `Editar ${props.config?.elementName?.singular || ''}` })
}

async function _deleteRecord() {
  if (!selectedRow.value && !selectedRows.value.size) {
    modal.open(AlertModal, { message: `Es necesario seleccionar ${elementLabels.value.article} ${props.config?.elementName?.singular || 'elemento'}` }, { title: 'Aviso' })
    return
  }
  const data = selectionMode.value === 'multiple'
    ? [...selectedRows.value.keys()]
    : [selectedRow.value]
  const ids = data.map(r => r.id).filter(Boolean)
  if (!ids.length) return
  modal.open(ConfirmModal, {
    message: '¿Está seguro?',
    confirmLabel: elementLabels.value.delete,
    confirmSeverity: 'btn-danger',
  }, {
    title: 'Confirmar',
    onClose: () => _executeDelete(ids),
  })
}

async function _executeDelete(ids) {
  loading.value = true
  try {
    const res = await props.api.delete({ id: ids[0] })
    selectedRow.value = null
    selectedRows.value = new Map()
    editEnabled.value = true
    if (res?.stat) {
      modal.open(AlertModal, { message: `${props.config?.elementName?.singular || ''} ${elementLabels.value.deleted} correctamente` }, { title: 'Éxito' })
      _refresh()
    } else {
      modal.open(AlertModal, { message: res?.text || 'Error al eliminar' }, { title: 'Error' })
    }
  } catch (err) {
    console.error('[TableEditor] Error al eliminar:', err)
    modal.open(AlertModal, { message: 'Error al eliminar' }, { title: 'Error' })
  } finally {
    loading.value = false
  }
}

async function _flushInlineEdit() {
  _editingCell.value = null
  _inlineEditValue.value = null
  _inlineOriginalValue.value = null
  if (_inlineSaveTimer) {
    clearTimeout(_inlineSaveTimer)
    _inlineSaveTimer = null
  }
  if (_pendingInlineSave) {
    const { api, data } = _pendingInlineSave
    _pendingInlineSave = null
    const res = await api(data)
    if (res?.stat && inlineEditingConfig.value?.onSave) {
      inlineEditingConfig.value.onSave()
    }
  }
}

function _refresh() {
  _flushInlineEdit()
  selectedRow.value = null; selectedRows.value = new Map(); editEnabled.value = true
  if (infiniteScroll.value) {
    _infinitePage.value = 1; hasMorePages.value = true
    if (lazy.value) rows.value = []
  }
  loadData()
}

function _isSelected(row) {
  if (selectionMode.value === 'single') return selectedRow.value === row
  return selectedRows.value.has(row)
}

function _selectSingle(row) {
  selectedRow.value = row
  editEnabled.value = false
  emit('rowSelected', row)
}

function _toggleRowSelection(row) {
  if (selectedRows.value.has(row)) selectedRows.value.delete(row)
  else selectedRows.value.set(row, true)
  editEnabled.value = selectedRows.value.size === 0
  emit('rowSelected', [...selectedRows.value.keys()])
}

function _toggleSelectAll() {
  if (isAllSelected.value) {
    selectedRows.value = new Map()
    editEnabled.value = true
    emit('rowSelected', [])
  } else {
    const m = new Map()
    for (const r of displayRows.value) m.set(r, true)
    selectedRows.value = m
    editEnabled.value = false
    emit('rowSelected', [...m.keys()])
  }
}

function _onRowClick(row) {
  if (_resizingField.value || _dragField) return
  if (selectionMode.value === 'multiple') _toggleRowSelection(row)
  else _selectSingle(row)
}

function _onRowDblClick(row) {
  if (_resizingField.value || _dragField) return
  emit('rowDoubleClick', { event: {}, data: row })
  if (!props.permisos?.edit || !verifica_permisos(props.permisos.edit)) return
  if (selectionMode.value === 'single') selectedRow.value = row
  _editRecord()
}

function _getInlineEditCfg(col) {
  return _inlineEditFields.value[col?.field] || null
}

function _isEditingCell(row, col) {
  if (!_editingCell.value) return false
  return _editingCell.value.row === row && _editingCell.value.field === col.field
}

function _onCellDblClick(event, row, col) {
  const cfg = _getInlineEditCfg(col)
  if (cfg) {
    event.stopPropagation()
    _startInlineEdit(row, col)
  }
}

function _startInlineEdit(row, col) {
  const cfg = _getInlineEditCfg(col)
  if (!cfg) return
  const raw = row.__raw?.[col.field]
  const val = raw ?? row[col.field] ?? ''
  _inlineOriginalValue.value = val
  _editingCell.value = { row, field: col.field }
  _inlineEditValue.value = val
  nextTick(() => {
    const el = Array.isArray(_inlineEditRef.value) ? _inlineEditRef.value[0] : _inlineEditRef.value
    el?.focus()
    el?.select()
  })
}

function _confirmInlineEdit(row, col) {
  if (!_editingCell.value) return
  const cfg = _getInlineEditCfg(col)
  if (!cfg) { _cancelInlineEdit(); return }
  let val = _inlineEditValue.value
  if (cfg.type === 'currency') {
    const cleaned = String(val).replace(/[^0-9,\-]/g, '').replace(',', '.')
    const num = parseFloat(cleaned)
    if (isNaN(num)) { _cancelInlineEdit(); return }
    val = num
  } else if (cfg.type === 'integer') {
    val = parseInt(val, 10)
    if (isNaN(val) || (cfg.min !== undefined && val < cfg.min)) { _cancelInlineEdit(); return }
  } else if (cfg.type === 'number') {
    val = parseFloat(val)
    if (isNaN(val) || (cfg.min !== undefined && val < cfg.min)) { _cancelInlineEdit(); return }
  }
  if (cfg.format) {
    row[col.field] = cfg.format(val)
  } else {
    row[col.field] = val
  }
  if (!row.__raw) row.__raw = {}
  row.__raw[col.field] = val
  if (cfg.afterEdit) cfg.afterEdit(row, col.field, val)
  _editingCell.value = null
  _inlineEditValue.value = null
  _debouncedInlineSave(row, col.field, val)
}

function _cancelInlineEdit() {
  if (_editingCell.value && _inlineOriginalValue.value !== null) {
    const { row, field } = _editingCell.value
    row[field] = _inlineOriginalValue.value
  }
  _editingCell.value = null
  _inlineEditValue.value = null
  _inlineOriginalValue.value = null
}

function _debouncedInlineSave(row, field, value) {
  const api = inlineEditingConfig.value?.api
  if (!api) return
  const id = row.id
  if (!id) return
  if (_inlineSaveTimer) {
    clearTimeout(_inlineSaveTimer)
    _inlineSaveTimer = null
  }
  if (_pendingInlineSave) {
    _pendingInlineSave.api(_pendingInlineSave.data)
    _pendingInlineSave = null
  }
  const originalValue = _inlineOriginalValue.value
  _pendingInlineSave = { api, data: { id, field, value } }
  _inlineSaveTimer = setTimeout(async () => {
    const res = await api({ id, field, value })
    _pendingInlineSave = null
    if (res?.stat && inlineEditingConfig.value?.onSave) {
      inlineEditingConfig.value.onSave()
    } else if (!res?.stat) {
      row[field] = originalValue
    }
  }, inlineEditingConfig.value?.debounce_ms ?? 1000)
}

function _onSortClick(field) {
  if (_resizingField.value || _dragField) return
  _flushInlineEdit()
  const col = visibleColumns.value.find(c => c.field === field)
  if (!col?.sortable) return
  if (sortField.value === field) sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  else { sortField.value = field; sortOrder.value = 'asc' }
  if (lazy.value) {
    currentPage.value = 1
    _lazyParams.value = { ..._lazyParams.value, page: 1, sortField: field, sortOrder: sortOrder.value }
    if (infiniteScroll.value) { _infinitePage.value = 1; hasMorePages.value = true; rows.value = [] }
    _loadLazyData()
  }
}

function _onFilterDebounced() {
  if (_filterTimer) clearTimeout(_filterTimer)
  _filterTimer = setTimeout(() => {
    currentPage.value = 1
    if (lazy.value) {
      _lazyParams.value = { ..._lazyParams.value, page: 1 }
      if (infiniteScroll.value) { _infinitePage.value = 1; hasMorePages.value = true; rows.value = [] }
      _loadLazyData()
    }
  }, 400)
}

function _onGlobalFilterDebounced() {
  if (_gfTimer) clearTimeout(_gfTimer)
  _gfTimer = setTimeout(() => {
    currentPage.value = 1
    if (lazy.value) {
      _lazyParams.value = { ..._lazyParams.value, page: 1 }
      if (infiniteScroll.value) { _infinitePage.value = 1; hasMorePages.value = true; rows.value = [] }
      _loadLazyData()
    }
  }, 400)
}

function _goToPage(p) {
  _flushInlineEdit()
  currentPage.value = p
  if (lazy.value) { _lazyParams.value = { ..._lazyParams.value, page: p }; _loadLazyData() }
}

function _onPageSizeChange() {
  _flushInlineEdit()
  currentPage.value = 1
  if (lazy.value) { _lazyParams.value = { ..._lazyParams.value, page: 1, rows: pageSize.value }; _loadLazyData() }
}

function _onScroll() { }

function _onResizeStart(e, field) {
  if (e.button !== 0 || _dragField) return
  e.preventDefault()
  try { e.target.setPointerCapture(e.pointerId) } catch (_) {}
  const el = e.currentTarget.closest('th, td')
  if (!el) return
  const rect = el.getBoundingClientRect()
  if (rect.right - e.clientX > 11) return
  _resizingField.value = field
  _resizeStartX = e.clientX
  _resizeStartWidth = el.offsetWidth
  document.body.style.cursor = 'col-resize'
  document.body.classList.add('te-resizing')
  document.addEventListener('pointermove', _onResizeMove)
  document.addEventListener('pointerup', _onResizeEnd)
}

function _onResizeMove(e) {
  if (!_resizingField.value || _resizeStartX == null || _resizeStartWidth == null) return
  let nw = Math.max(100, _resizeStartWidth + (e.clientX - _resizeStartX))
  columnWidths.value = { ...columnWidths.value, [_resizingField.value]: nw + 'px' }
}

function _onResizeEnd() {
  document.removeEventListener('pointermove', _onResizeMove)
  document.removeEventListener('pointerup', _onResizeEnd)
  document.body.style.cursor = ''
  document.body.classList.remove('te-resizing')
  if (_resizingField.value) _debouncedPersist()
  _resizeStartX = null
  _resizeStartWidth = null
  _resizingField.value = null
}

function _onResizeDblClick(e, field) {
  if (e.button !== 0 || _dragField) return
  e.preventDefault()
  try { e.target.setPointerCapture(e.pointerId) } catch (_) {}
  const el = e.currentTarget.closest('th, td')
  if (!el) return
  const rect = el.getBoundingClientRect()
  if (rect.right - e.clientX > 11) return
  _resizingField.value = field
  _resizeStartX = e.clientX
  _resizeStartWidth = el.offsetWidth
  document.body.style.cursor = 'col-resize'
  document.body.classList.add('te-resizing')
  document.addEventListener('pointermove', _onResizeMove)
  requestAnimationFrame(() => {
    document.addEventListener('pointerup', _onResizeEnd)
  })
}

function _onDragStart(e, field) {
  if (_resizingField.value) { e.preventDefault(); return }
  _dragField = field; _dragOverField.value = null; _dropSide.value = null
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', field)
  if (e.dataTransfer.setDragImage) {
    const el = e.target.closest('th')
    if (el) e.dataTransfer.setDragImage(el, e.offsetX, e.offsetY)
  }
}

function _onDragEnter(e, field) {
  if (_dragField === field || (e.relatedTarget && e.currentTarget.contains(e.relatedTarget))) return
  _dragOverField.value = field
}

function _onDragOver(e, field) {
  if (_dragField === field) return
  e.dataTransfer.dropEffect = 'move'
  const rect = e.currentTarget.getBoundingClientRect()
  _dropSide.value = e.clientX < rect.left + rect.width / 2 ? 'left' : 'right'
}

function _onDragLeave(e, field) {
  if (e.currentTarget.contains(e.relatedTarget)) return
  if (_dragOverField.value === field) { _dragOverField.value = null; _dropSide.value = null }
}

function _onDrop(e, field) {
  if (!_dragField || _dragField === field) { _onDragEnd(); return }
  const order = columnOrder.value.length ? [...columnOrder.value] : selectedColumns.value.map(c => c.field)
  const from = order.indexOf(_dragField)
  const to = order.indexOf(field)
  if (from < 0 || to < 0) { _onDragEnd(); return }
  const [m] = order.splice(from, 1)
  const at = from < to
    ? (_dropSide.value === 'right' ? to : to - 1)
    : (_dropSide.value === 'left' ? to : to + 1)
  order.splice(Math.max(0, Math.min(order.length, at)), 0, m)
  columnOrder.value = order
  _debouncedPersist()
  _onDragEnd()
}

function _onDragEnd() {
  _dragField = null; _dragOverField.value = null; _dropSide.value = null
}

async function _exportCsv() {
  if (lazy.value) {
    const p = { ..._lazyParams.value, globalSearch: globalFilter.value?.value || null }
    const cf = {}
    for (const k of Object.keys(columnFilters.value)) if (columnFilters.value[k]) cf[k] = { value: columnFilters.value[k], matchMode: 'contains' }
    if (Object.keys(cf).length) p.filters = JSON.stringify(cf)
    const res = await props.api.list(p)
    if (res?.stat) _downloadCsvData(res.data.rows)
    return
  }
  _downloadCsvData(rows.value)
}

function _downloadCsvData(data) {
  if (!data?.length) return
  const cols = visibleColumns.value
  let csv = cols.map(c => _csvEscape(c.headerName)).join(',') + '\n'
  for (const r of data) {
    csv += cols.map(c => _csvEscape(r[c.field] != null ? String(r[c.field]) : '')).join(',') + '\n'
  }
  const a = document.createElement('a')
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('\uFEFF' + csv)
  a.download = 'datos.csv'
  a.click()
}

function _csvEscape(v) {
  v = String(v).replace(/"/g, '""')
  return v.includes(',') || v.includes('"') || v.includes('\n') ? '"' + v + '"' : v
}

async function _loadLazyData() {
  _flushInlineEdit()
  loading.value = true
  const p = { ..._lazyParams.value, page: infiniteScroll.value ? _infinitePage.value : _lazyParams.value.page, globalSearch: globalFilter.value?.value || null }
  const cf = {}
  for (const k of Object.keys(columnFilters.value)) if (columnFilters.value[k]) cf[k] = { value: columnFilters.value[k], matchMode: 'contains' }
  if (Object.keys(cf).length) p.filters = JSON.stringify(cf)
  try {
    const res = await props.api.list(p)
    if (res?.stat) {
      totalRecords.value = res.data.totalRecords || 0
      await _processData(res.data)
    }
  } catch (err) {
    console.error('[TableEditor] Error loading lazy data:', err)
  } finally {
    loading.value = false
  }
  emit('rowSelected', selectionMode.value === 'single' ? null : [])
  selectedRow.value = null; selectedRows.value = new Map()
}

async function loadData(data = props.data) {
  loading.value = true
  if (data != null) {
    await _processData(data)
    loading.value = false
    return
  }
  if (props.api?.list) {
    if (lazy.value) {
      loading.value = false
      return _loadLazyData()
    }
    try {
      const res = await props.api.list()
      if (res?.stat) await _processData(res.data)
      else console.error('[TableEditor] No se obtuvieron datos')
    } catch (err) {
      console.error('[TableEditor] Error loading data:', err)
    } finally {
      loading.value = false
    }
  }
  emit('rowSelected', selectionMode.value === 'single' ? null : [])
  selectedRow.value = null; selectedRows.value = new Map()
}

async function _processData(data) {
  rows.value = data.rows || []
  let fields_def = data.fields_def
  if (rows.value?.length) {
    const cj = getCamposJson(fields_def)
    for (let c = 0; c < rows.value.length; c++) {
      rows.value[c] = mapFilaJSONtabla(rows.value[c], cj)
      rows.value[c] = row_formatter(rows.value[c], fields_def)
      rows.value[c] = _applyRowDefCss(rows.value[c])
    }
    fields_def = getCamposJSONyFieldDef(fields_def, cj, rows.value[0])
    fields_def = getFieldDefFFormated(fields_def)
  }
  if (fields_def != null) {
    columnDefs.value = [...fields_def]
    if (props.config?.extraFields?.list) columnDefs.value.push(...props.config.extraFields.list)
    columnDefs.value = _applyFieldDefCss(columnDefs.value)
    selectedColumns.value = getProcessFieldDef(columnDefs.value)
    if (props.config?.defaultColumnProps) {
      for (let c = 0; c < selectedColumns.value.length; c++)
        selectedColumns.value[c] = { ...selectedColumns.value[c], ...props.config.defaultColumnProps }
    }
    const nf = getFiltersFrFields(columnDefs.value)
    for (const k of Object.keys(nf)) if (!columnFilters.value[k]) columnFilters.value[k] = null
    for (const k of Object.keys(columnFilters.value)) if (!nf[k]) delete columnFilters.value[k]
    if (props.config?.columnOrder) selectedColumns.value = reOrder(selectedColumns.value, props.config.columnOrder)

    const saved = props.id ? await _loadPersistedConfig() : null
    const widths = saved?.columnWidths || {}
    for (const col of selectedColumns.value) {
      const w = parseFloat(widths[col.field])
      columnWidths.value[col.field] = w ? Math.max(100, w) + 'px' : '15rem'
    }
    if (actionButtons.value.length) {
      const w = parseFloat(widths['__actions__'])
      columnWidths.value['__actions__'] = w ? Math.max(100, w) + 'px' : 'auto'
    }
    columnOrder.value = saved?.columnOrder || []
    availableColumns.value = [...selectedColumns.value]
  }
  if (props.config?.pinnedRows?.[0] !== undefined) {
    pinnedRows.value = [data.rows[props.config.pinnedRows[0]]]
  }
  _emitLoaded(true)
}

watch(() => props.data, (nd) => {
  if (nd?.rows !== undefined) {
    loadData(nd)
  }
})

watch(() => prefStore.misValores, async () => {
  if (props.id) {
    const saved = await _loadPersistedConfig()
    if (saved?.columnWidths) {
      for (const [f, w] of Object.entries(saved.columnWidths)) {
        const n = parseFloat(w)
        columnWidths.value[f] = n ? Math.max(100, n) + 'px' : w
      }
    }
    columnOrder.value = saved?.columnOrder || []
  }
}, { deep: true })

function _setupInfiniteScroll() {
  if (!infiniteScroll.value) return
  const wrap = _scrollWrapRef.value
  if (!wrap || !_sentinelRef.value) return
  _infiniteObserver?.disconnect()
  _infiniteObserver = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && hasMorePages.value && !isLoadingMore.value) {
      _loadMoreInfinite()
    }
  }, { root: wrap, rootMargin: '0px 0px 200px 0px', threshold: 0 })
  _infiniteObserver.observe(_sentinelRef.value)
}

async function _loadMoreInfinite() {
  isLoadingMore.value = true
  if (lazy.value) {
    _infinitePage.value++
    const p = { ..._lazyParams.value, page: _infinitePage.value, rows: pageSize.value }
    p.globalSearch = globalFilter.value?.value || null
    const cf = {}
    for (const k of Object.keys(columnFilters.value)) if (columnFilters.value[k]) cf[k] = { value: columnFilters.value[k], matchMode: 'contains' }
    if (Object.keys(cf).length) p.filters = JSON.stringify(cf)
    if (sortField.value) { p.sortField = sortField.value; p.sortOrder = sortOrder.value }
    try {
      const res = await props.api.list(p)
      if (res?.stat) {
        const newRows = res.data.rows || []
        if (newRows.length) {
          const camposJSON = getCamposJson(res.data.fields_def)
          for (let c = 0; c < newRows.length; c++) {
            newRows[c] = mapFilaJSONtabla(newRows[c], camposJSON)
            newRows[c] = row_formatter(newRows[c], res.data.fields_def)
            newRows[c] = _applyRowDefCss(newRows[c])
          }
          rows.value = [...rows.value, ...newRows]
          totalRecords.value = res.data.totalRecords || 0
        }
        hasMorePages.value = rows.value.length < totalRecords.value
      } else {
        hasMorePages.value = false
      }
    } catch (err) {
      console.error('[TableEditor] Error loading more infinite:', err)
      hasMorePages.value = false
    }
  } else {
    const total = filteredRows.value.length
    const shown = rows.value.length
    const next = Math.min(shown + pageSize.value, total)
    if (next > shown) {
      rows.value = [...filteredRows.value.slice(0, next)]
    }
    hasMorePages.value = rows.value.length < total
  }
  isLoadingMore.value = false
}

onMounted(async () => {
  applyConfig()
  await loadData()
  nextTick(() => {
    _setupInfiniteScroll()
  })
})

onUnmounted(() => {
  document.removeEventListener('pointermove', _onResizeMove)
  document.removeEventListener('pointerup', _onResizeEnd)
  _infiniteObserver?.disconnect()
  if (_inlineSaveTimer) {
    clearTimeout(_inlineSaveTimer)
    _inlineSaveTimer = null
  }
  if (_pendingInlineSave) {
    const { api, data } = _pendingInlineSave
    _pendingInlineSave = null
    api(data)
  }
})

watch(infiniteScroll, (v) => { if (v) nextTick(() => _setupInfiniteScroll()) })
</script>

<style>
.te-wrapper {
  display: grid;
  grid-template-rows: auto 1fr auto;
  height: 100%;
  font-size: 1rem;
}

.te-toolbar {
  display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;
  background: #fff; border: 1px solid #dee2e6; border-radius: 8px 8px 0 0; padding: 0.5rem 1rem;
}
.te-toolbar-start { display: flex; align-items: center; gap: 0.25rem; flex-wrap: wrap; }
.te-toolbar-end { display: flex; align-items: center; gap: 0.5rem; white-space: nowrap; }

.te-scroll-wrap {
  overflow: auto;
  border: 1px solid #dee2e6; border-top: 0; border-bottom: 0;
  background: #fff;
  &::-webkit-scrollbar { width: 8px; height: 8px; }
  &::-webkit-scrollbar-track { background: #f1f1f1; }
  &::-webkit-scrollbar-thumb { background: #c1c7cd; border-radius: 4px; }
  &::-webkit-scrollbar-thumb:hover { background: #a0a7ae; }
}

.te-loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.75);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 20;
  gap: 0.75rem;
}
.te-scroll-wrap { position: relative; }
.te-loading-spinner-large {
  width: 2.5rem; height: 2.5rem;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: te-spin 0.6s linear infinite;
}
.te-loading-text {   font-size: 1rem; color: #6b7280; }

.te-table {
  width: 1px; min-width: 100%; border-collapse: collapse; table-layout: fixed;
}
.te-th-filler, .te-td-filler { padding: 0; }
.te-mono { font-family: 'SF Mono', 'Cascadia Code', 'Consolas', 'Liberation Mono', monospace !important; }
.te-striped .te-tr:nth-child(even) { background: #fafbfc; }
.te-tr {
  transition: background 0.12s ease;
  &:hover { background: #e8ecf4 !important; }
  &.te-tr-highlight { background: #c7d9f5 !important; color: #1a202c; }
  &.te-tr-selected td { background: #dce8f5; }
  &.te-tr-selected:hover td { background: #c4d4e8 !important; }
}
.te-td-selected { background: #dce8f5 !important; }

.te-header-row .te-th {
  position: sticky; top: 0; z-index: 2;
  background: #f0f2f5; font-weight: 600; font-size: 0.8rem; padding: 0 10px 0 0; color: #2c3e50;
  border-bottom: 2px solid #d0d5dd; white-space: nowrap; user-select: none;
  border-right: 1px solid #dce0e6;
  &:last-child { border-right: none; }
}
.te-header-row.te-has-groups .te-th {
  top: 2.5rem; background: #e2e8f0;
}
.te-header-group-row .te-th {
  position: sticky; top: 0; z-index: 3;
  background: #e2e8f0; font-weight: 700; font-size: 0.8rem; padding: 0 10px 0 0; color: #1e293b;
  text-align: center;
  white-space: nowrap; user-select: none;
  border-right: 1px solid #dce0e6;
  &:last-child { border-right: none; }
}
.te-th-content {
  padding: 0.55rem 0; padding-left: 0.75rem;
  overflow: hidden; text-overflow: ellipsis; min-height: 2.2rem;
  max-width: 100%;
}
.te-th-grip {
  font-size: 1rem; color: #9ca3af; line-height: 1; cursor: grab;
  padding: 0 0.15rem; border-radius: 3px; transition: color 0.15s;
  .te-th:hover & { color: #4b5563; }
  &:active { cursor: grabbing; }
}
.te-th-label {
  display: inline; overflow: hidden; text-overflow: ellipsis; cursor: pointer; white-space: nowrap;
  &:hover { color: #1a56db; }
}
.te-sort-icon-std {
  font-size: 1rem; color: #adb5bd; line-height: 1; margin-left: 0.3rem;
  .te-th-label:hover & { color: #3b82f6; }
}
.te-th[draggable='true'] { cursor: grab; }
.te-th:active { cursor: grabbing; }
.te-th-dragging { opacity: 0.35; background: #e5e7eb !important; }
.te-th-dragover-left { background: #eff6ff !important; box-shadow: inset 3px 0 0 0 #3b82f6; }
.te-th-dragover-right { background: #eff6ff !important; box-shadow: inset -3px 0 0 0 #3b82f6; }
.te-drop-indicator {
  position: absolute; top: 0; bottom: 0; width: 3px; z-index: 5;
  background: #3b82f6; pointer-events: none;
  &::after {
    content: ''; position: absolute; top: -4px; width: 8px; height: 8px;
    background: #3b82f6; border-radius: 50%; left: -2.5px;
  }
}
.te-drop-left { left: -1.5px; }
.te-drop-right { right: -4px; }

.te-resizing {
  user-select: none !important;
  -webkit-user-select: none !important;
  -moz-user-select: none !important;
  -ms-user-select: none !important;
}

.te-resize-handle {
  position: absolute; right: 0; top: 0; bottom: 0; width: 10px; cursor: col-resize;
  z-index: 3; background: transparent; touch-action: none;
  &::before {
    content: ''; position: absolute; right: 4px; top: 15%; bottom: 15%; width: 2px;
    background: #e2e8f0; border-radius: 1px; transition: background 0.12s, width 0.12s;
  }
  &:hover::before, &:active::before { background: #3b82f6; }
  &:hover { background: rgba(59,130,246,0.06); }
}
.te-resize-handle.te-resizing-active::before {
  background: #2563eb; width: 3px;
}

.te-filter-row .te-td { padding: 0.2rem 10px 0.2rem 0.4rem; background: #f8f9fa; }
.te-filter-input { width: 100%; font-size: 1rem; padding: 0.2rem 0.4rem; }

.te-td {
  position: relative;
  box-sizing: border-box;
  padding: 0.4rem 10px 0.4rem 0.75rem; font-size: 0.8rem; line-height: 1.45;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  border-bottom: 1px solid #f0f0f0; border-right: 1px solid #f0f0f0;
  &:last-child { border-right: none; }
}
.te-th { position: relative; box-sizing: border-box; overflow: hidden; }
.te-td-sel, .te-th-sel { text-align: center; min-width: 2rem; }
.te-actions-wrap { display: block; }
.te-actions-wrap > * { margin-right: 0.25rem; }
.te-empty { text-align: center; color: #999; padding: 2rem; border-right: none; }
.te-color-badge {
  display: inline-block; padding: 0.1rem 0.5rem; border-radius: 4px;
  border: 1px solid rgba(0,0,0,.15); font-weight: 600; font-size: 1rem;
}

.te-paginator {
  background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 0 0 8px 8px;
  padding: 0.4rem 0.75rem; font-size: 1rem;
}
.te-page-info { color: #6c757d; }
.te-page-controls { display: inline; }
.te-page-btn {
  background: #fff; border: 1px solid #dee2e6; border-radius: 4px; padding: 0.25rem 0.5rem;
  cursor: pointer; font-size: 1rem; color: #495057;
  &:hover:not(:disabled) { background: #e9ecef; }
  &:disabled { opacity: 0.4; cursor: default; }
}
.te-page-current { padding: 0 0.5rem; font-weight: 600; }
.te-page-size {
  background: #fff; border: 1px solid #dee2e6; border-radius: 4px; padding: 0.25rem 0.5rem;
  font-size: 1rem;
}

.te-sentinel { text-align: center; padding: 1rem; min-height: 3rem; }
.te-loading-spinner {
  display: inline-block; width: 1.5rem; height: 1.5rem;
  border: 2px solid #e5e7eb; border-top-color: #3b82f6;
  border-radius: 50%; animation: te-spin 0.6s linear infinite;
}
@keyframes te-spin { to { transform: rotate(360deg); } }

.te-editing-input {
  width: 100%;
  border: 1px solid #3b82f6;
  border-radius: 4px;
  padding: 0.2rem 0.4rem;
  font-size: inherit;
  font-family: inherit;
  background: #fff;
  outline: none;
  box-sizing: border-box;
}
.te-td-editing { padding: 0.2rem !important; vertical-align: middle; }
.te-cell-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.25rem;
  width: 100%;
  overflow: hidden;
}
.te-cell-wrap > span {
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}
.te-inline-edit-btn {
  flex-shrink: 0;
  opacity: 0;
  width: 1.5rem;
  height: 1.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 4px;
  background: #e8ecf4;
  color: #4b5563;
  cursor: pointer;
  transition: opacity 0.15s, background 0.15s;
  font-size: 1rem;
  padding: 0;
  line-height: 1;
}
.te-td-inline-edit:hover .te-inline-edit-btn { opacity: 1; }
.te-inline-edit-btn:hover { background: #3b82f6; color: #fff; }

/* === DARK MODE === */
[data-bs-theme="dark"] .te-toolbar {
  background: #1e1e2e; border-color: #3a3a50;
}
[data-bs-theme="dark"] .te-scroll-wrap {
  border-color: #3a3a50; background: #1e1e2e;
}
[data-bs-theme="dark"] .te-scroll-wrap::-webkit-scrollbar-track { background: #2a2a3d; }
[data-bs-theme="dark"] .te-scroll-wrap::-webkit-scrollbar-thumb { background: #4a4a65; border-radius: 4px; }
[data-bs-theme="dark"] .te-scroll-wrap::-webkit-scrollbar-thumb:hover { background: #5a5a75; }
[data-bs-theme="dark"] .te-loading-overlay { background: rgba(0, 0, 0, 0.75); }
[data-bs-theme="dark"] .te-loading-spinner-large { border-color: #3a3a50; border-top-color: #60a5fa; }
[data-bs-theme="dark"] .te-loading-text { color: #94a3b8; }
[data-bs-theme="dark"] .te-striped .te-tr:nth-child(even) { background: #2a2a3d; }
[data-bs-theme="dark"] .te-tr:hover { background: #2a3a5c !important; }
[data-bs-theme="dark"] .te-tr.te-tr-highlight { background: #1e3a5f !important; color: #e0e0e0; }
[data-bs-theme="dark"] .te-tr.te-tr-selected td { background: #1e3050; }
[data-bs-theme="dark"] .te-tr.te-tr-selected:hover td { background: #2a3a5c !important; }
[data-bs-theme="dark"] .te-td-selected { background: #1e3050 !important; }
[data-bs-theme="dark"] .te-header-row .te-th {
  background: #2a2a3d; color: #e0e0e0;
  border-bottom-color: #4a4a65; border-right-color: #3a3a50;
}
[data-bs-theme="dark"] .te-header-row.te-has-groups .te-th { background: #333348; }
[data-bs-theme="dark"] .te-header-group-row .te-th {
  background: #333348; color: #e0e0e0; border-right-color: #3a3a50;
}
[data-bs-theme="dark"] .te-th-label:hover { color: #60a5fa; }
[data-bs-theme="dark"] .te-sort-icon-std { color: #64748b; }
[data-bs-theme="dark"] .te-th-label:hover .te-sort-icon-std { color: #60a5fa; }
[data-bs-theme="dark"] .te-th-grip { color: #64748b; }
[data-bs-theme="dark"] .te-th:hover .te-th-grip { color: #94a3b8; }
[data-bs-theme="dark"] .te-th-dragging { opacity: 0.35; background: #3a3a50 !important; }
[data-bs-theme="dark"] .te-th-dragover-left { background: #1e3050 !important; box-shadow: inset 3px 0 0 0 #60a5fa; }
[data-bs-theme="dark"] .te-th-dragover-right { background: #1e3050 !important; box-shadow: inset -3px 0 0 0 #60a5fa; }
[data-bs-theme="dark"] .te-drop-indicator { background: #60a5fa; }
[data-bs-theme="dark"] .te-drop-indicator::after { background: #60a5fa; }
[data-bs-theme="dark"] .te-resize-handle::before { background: #3a3a50; }
[data-bs-theme="dark"] .te-resize-handle:hover::before,
[data-bs-theme="dark"] .te-resize-handle:active::before { background: #60a5fa; }
[data-bs-theme="dark"] .te-resize-handle:hover { background: rgba(96, 165, 250, 0.08); }
[data-bs-theme="dark"] .te-resize-handle.te-resizing-active::before { background: #3b82f6; }
[data-bs-theme="dark"] .te-filter-row .te-td { background: #252536; }
[data-bs-theme="dark"] .te-td {
  border-bottom-color: #2a2a3d; border-right-color: #2a2a3d;
}
[data-bs-theme="dark"] .te-empty { color: #6b7280; }
[data-bs-theme="dark"] .te-paginator {
  background: #252536; border-color: #3a3a50;
}
[data-bs-theme="dark"] .te-page-info { color: #94a3b8; }
[data-bs-theme="dark"] .te-page-btn {
  background: #1e1e2e; border-color: #3a3a50; color: #cbd5e1;
}
[data-bs-theme="dark"] .te-page-btn:hover:not(:disabled) { background: #333348; }
[data-bs-theme="dark"] .te-page-size {
  background: #1e1e2e; border-color: #3a3a50; color: #cbd5e1;
}
[data-bs-theme="dark"] .te-filter-input { background: #2a2a3d; color: #e0e0e0; border-color: #3a3a50; }
[data-bs-theme="dark"] .te-editing-input {
  border-color: #60a5fa; background: #2a2a3d; color: #e0e0e0;
}
[data-bs-theme="dark"] .te-inline-edit-btn { background: #3a3a50; color: #94a3b8; }
[data-bs-theme="dark"] .te-td-inline-edit:hover .te-inline-edit-btn { opacity: 1; }
[data-bs-theme="dark"] .te-inline-edit-btn:hover { background: #60a5fa; color: #fff; }
</style>
