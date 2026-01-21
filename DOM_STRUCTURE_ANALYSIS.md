# Greenhouse.io 表单 DOM 结构分析文档

> 基于测试链接1和链接2的HTML结构分析
> 创建时间：2026-01-20

## 📋 概述

两个测试链接的DOM结构**高度一致**，可以使用统一的实现方案。

## 🎯 关键选择器

### 1. 表单容器

```javascript
// 主表单容器
const form = document.querySelector('#application_form')

// 主要区域
const mainFields = document.querySelector('#main_fields')        // 基础字段区域
const customFields = document.querySelector('#custom_fields')      // 自定义问题区域
const educationSection = document.querySelector('#education_section')  // 教育信息区域
```

### 2. 基础字段（Main Fields）

**结构模式**：
```html
<div class="field">
  <label for="field_id">Field Name <span class="asterisk">*</span></label>
  <input type="text" id="field_id" name="job_application[field_name]" />
</div>
```

**具体字段**：
- `#first_name` - First Name (input[type="text"])
- `#last_name` - Last Name (input[type="text"])
- `#email` - Email (input[type="text"])
- `#phone` - Phone (input[type="text"])

**定位方式**：
```javascript
// 通过 label 的 for 属性找到对应的 input
const label = field.querySelector('label')
const inputId = label.getAttribute('for')
const input = document.getElementById(inputId)
```

### 3. 自定义问题字段（Custom Fields）

**结构模式**：
```html
<div class="field">
  <label>
    Question Text<span class="asterisk">*</span>
    <br>
    <input type="hidden" name="job_application[answers_attributes][N][question_id]" />
    <input type="text" id="job_application_answers_attributes_N_text_value" />
    <!-- 或 -->
    <textarea id="job_application_answers_attributes_N_text_value"></textarea>
    <!-- 或 -->
    <select id="job_application_answers_attributes_N_boolean_value" style="display: none;">
      <option value="">--</option>
      <option value="1">Yes</option>
      <option value="0">No</option>
    </select>
  </label>
</div>
```

**特点**：
- Label 文本在 `<label>` 的第一行（去除 `<br>` 后的内容）
- 需要去除 `*` 和多余空格
- 可能包含 `<input type="text">`、`<textarea>` 或 `<select>`
- Select 使用 Select2 组件，但原生 `<select>` 仍然存在（隐藏）

**定位方式**：
```javascript
// 获取 label 文本（第一行，去除 * 和空格）
const labelText = label.childNodes[0].textContent.trim().replace(/\s*\*\s*$/, '')

// 查找输入元素
const textInput = label.querySelector('input[type="text"]')
const textarea = label.querySelector('textarea')
const select = label.querySelector('select')
```

### 4. Select2 下拉选择框

**结构模式**：
```html
<div class="select2-container" id="s2id_xxx">
  <a class="select2-choice">...</a>
  <!-- Select2 UI -->
</div>
<select id="xxx" style="display: none;">
  <option value="">--</option>
  <option value="1">Yes</option>
  <option value="0">No</option>
</select>
```

**处理策略**：
- **优先直接操作隐藏的 `<select>` 元素**
- 设置 `select.value` 并触发 `change` 事件
- Select2 会自动同步显示

**代码示例**：
```javascript
// 找到隐藏的 select
const select = document.querySelector('select#xxx')
if (select) {
  // 设置值
  select.value = '1'
  // 触发 change 事件（Select2 会监听）
  select.dispatchEvent(new Event('change', { bubbles: true }))
}
```

### 5. 教育信息（Education）

**区域选择器**：
```javascript
const educationSection = document.querySelector('#education_section')
const addEducationBtn = document.querySelector('#add_education')
const educationItems = educationSection.querySelectorAll('.education:not(.education-template)')
```

**单个教育项结构**（第0条）：
```html
<div class="education" data-education-required="false">
  <fieldset>
    <!-- School (Select2，远程搜索) -->
    <div class="field">
      <label for="education_school_name_0">School</label>
      <div class="select2-container" id="s2id_education_school_name_0">...</div>
      <input type="hidden" id="education_school_name_0" 
             data-url="https://boards-api.greenhouse.io/v1/boards/kalshi/education/schools" />
    </div>
    
    <!-- Degree (Select2) -->
    <div class="field">
      <label for="education_degree_0">Degree</label>
      <div class="select2-container" id="s2id_education_degree_0">...</div>
      <select id="education_degree_0" style="display: none;">
        <option value=""></option>
        <option value="12178857003">Bachelor's Degree</option>
        <option value="12178858003">Master's Degree</option>
        <!-- ... -->
      </select>
    </div>
    
    <!-- Discipline (Select2) -->
    <div class="field">
      <label for="education_discipline_0">Discipline</label>
      <div class="select2-container" id="s2id_education_discipline_0">...</div>
      <select id="education_discipline_0" style="display: none;">
        <option value=""></option>
        <option value="12178876003">Chemistry</option>
        <option value="12178878003">Communications & Film</option>
        <!-- ... -->
      </select>
    </div>
    
    <!-- Start Date (可能) -->
    <div class="field">
      <fieldset>
        <legend><label>Start Date</label></legend>
        <input type="text" class="start-date-month" placeholder="MM" />
        <input type="text" class="start-date-year" placeholder="YYYY" />
      </fieldset>
    </div>
    
    <!-- End Date -->
    <div class="field">
      <fieldset>
        <legend><label>End Date</label></legend>
        <input type="text" class="end-date-month" placeholder="MM" />
        <input type="text" class="end-date-year" placeholder="YYYY" />
      </fieldset>
    </div>
  </fieldset>
</div>
```

**教育字段定位**：
```javascript
// 获取第 N 个教育项
const educationItem = educationItems[N]

// School (远程 Select2，复杂，可能需要特殊处理)
const schoolInput = educationItem.querySelector('input.school-name[type="hidden"]')

// Degree (Select2，可直接操作隐藏的 select)
const degreeSelect = educationItem.querySelector('select.degree')

// Discipline (Select2，可直接操作隐藏的 select)
const disciplineSelect = educationItem.querySelector('select.discipline')

// Start Date
const startMonth = educationItem.querySelector('input.start-date-month')
const startYear = educationItem.querySelector('input.start-date-year')

// End Date
const endMonth = educationItem.querySelector('input.end-date-month')
const endYear = educationItem.querySelector('input.end-date-year')
```

**添加新教育项**：
```javascript
// 点击添加按钮
const addBtn = document.querySelector('#add_education')
addBtn.click()

// 等待新项出现（可能需要延迟或 MutationObserver）
// 新项的 id 会递增：education_degree_1, education_degree_2, ...
```

## 📝 字段提取策略

### 步骤1：遍历所有 field

```javascript
const form = document.querySelector('#application_form')
const fields = form.querySelectorAll('.field')
```

### 步骤2：识别字段类型

```javascript
function getFieldType(field) {
  const label = field.querySelector('label')
  const input = label?.querySelector('input[type="text"]')
  const textarea = label?.querySelector('textarea')
  const select = label?.querySelector('select')
  
  if (textarea) return 'textarea'
  if (select) return 'select'
  if (input) return 'text'
  return 'unknown'
}
```

### 步骤3：提取 Label 文本

```javascript
function getLabelText(label) {
  // 获取第一个文本节点（在 <br> 之前）
  let text = ''
  for (const node of label.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent
    } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName !== 'BR') {
      break
    }
  }
  // 去除 * 和多余空格
  return text.trim().replace(/\s*\*\s*$/, '').replace(/\s+/g, ' ')
}
```

### 步骤4：提取 Select 选项

```javascript
function getSelectOptions(select) {
  return Array.from(select.options)
    .filter(opt => opt.value !== '')
    .map(opt => opt.textContent.trim())
}
```

### 步骤5：识别教育信息区域

```javascript
function isEducationField(field) {
  // 检查是否在教育区域内
  const educationSection = document.querySelector('#education_section')
  return educationSection?.contains(field)
}
```

## 🔧 特殊处理说明

### 1. Select2 组件

- **策略**：直接操作隐藏的 `<select>` 元素
- **原因**：更稳定，不需要模拟点击和等待下拉展开
- **方法**：设置 `value` + 触发 `change` 事件

### 2. School 字段（远程 Select2）

- **特点**：使用 `data-url` 进行远程搜索
- **处理**：
  - 方案1：尝试在 Select2 输入框中输入学校名，等待结果，选择匹配项
  - 方案2：如果太复杂，可以标记为"未填充"或跳过
- **建议**：先实现其他字段，School 字段作为后续优化

### 3. 日期字段

- **格式**：Mock 数据为 `"2014-01-01"` (YYYY-MM-DD)
- **表单格式**：`MM` (月份) 和 `YYYY` (年份) 分开输入
- **转换**：
  ```javascript
  const date = "2014-01-01"
  const [year, month] = date.split('-')
  // month: "01" -> "1" (去除前导0)
  // year: "2014"
  ```

### 4. 数组值处理

- Mock 数据中某些字段值为数组：`["Yes"]`
- **提取**：取第一个元素：`value[0]` 或 `Array.isArray(value) ? value[0] : value`

## 📊 字段类型映射

| Mock 数据字段名 | 表单 Label | 字段类型 | 选择器 |
|----------------|-----------|---------|--------|
| First Name | First Name | text | `#first_name` |
| Last Name | Last Name | text | `#last_name` |
| Email | Email | text | `#email` |
| Phone | Phone | text | `#phone` |
| LinkedIn Profile | LinkedIn Profile | text | `#job_application_answers_attributes_0_text_value` |
| Website | Website | text | `#job_application_answers_attributes_1_text_value` |
| Why Kalshi? | Why Kalshi? | textarea | `#job_application_answers_attributes_2_text_value` |
| Are you legally authorized... | Are you legally authorized... | select | `#job_application_answers_attributes_3_boolean_value` |
| Will you now or in the future... | Will you now or in the future... | select | `#job_application_answers_attributes_4_boolean_value` |
| Do you live in New York City... | Do you live in New York City... | text | `#job_application_answers_attributes_5_text_value` |
| Education | Education | education | `#education_section` |

## ✅ 验证清单

- [x] 表单容器选择器已确认
- [x] 基础字段结构已分析
- [x] 自定义问题字段结构已分析
- [x] Select2 处理策略已确定
- [x] 教育信息结构已分析
- [x] 字段定位方式已明确

## 🚀 下一步

可以开始**阶段二：实现字段提取功能**

主要任务：
1. 实现 `extractFields()` 方法
2. 遍历所有 `.field` 元素
3. 提取 label 文本和字段类型
4. 处理 Select2 下拉框
5. 识别教育信息区域
6. 输出 `TRule[]` 格式结果

