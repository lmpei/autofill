# JobRight Helper 面试任务实施计划

## 📋 项目概述

开发浏览器扩展，实现 Greenhouse.io 求职申请表的自动填充功能。

## 🎯 核心目标

1. ✅ 提取页面上所有表单字段（文本输入框、下拉选择框、教育信息列表）
2. ✅ 将 mock 数据自动填充到对应表单项
3. ✅ 统计填充成功和失败的字段数量

## 📊 任务分解

### 阶段一：环境准备与页面分析（预计 30 分钟）

#### 1.1 环境搭建
- [ ] 运行 `pnpm install` 安装依赖
- [ ] 运行 `pnpm run dev` 启动开发服务器
- [ ] 在 Chrome 中加载扩展（`build/chrome-mv3-dev`）
- [ ] 验证扩展正常加载，能看到 "Auto Fill Form" 按钮

#### 1.2 页面结构分析
- [ ] 打开测试链接1：`https://boards.greenhouse.io/embed/job_app?token=4327952003&utm_source=jobright`
- [ ] 使用开发者工具分析 DOM 结构
- [ ] 记录关键信息：
  - 表单容器的选择器
  - Label 元素的特征和定位方式
  - 输入框、下拉框、复选框的 HTML 结构
  - 教育信息列表的结构和添加方式
- [ ] 打开测试链接2：`https://boards.greenhouse.io/embed/job_app?token=6909295&utm_source=jobright`
- [ ] 对比两个页面的结构差异
- [ ] 记录通用模式和特殊处理

#### 1.3 Mock 数据分析
- [ ] 仔细阅读 `mocks/4327952003.json` 和 `mocks/6909295.json`
- [ ] 理解数据格式：
  - 普通字段：`{ name: string, value: string | string[] }`
  - 教育信息：`{ Education: Array<EducationItem> }`
- [ ] 列出所有字段类型和特殊处理需求

---

### 阶段二：实现字段提取功能（预计 1-2 小时）

#### 2.1 实现 `extractFields()` 方法

**目标**：提取页面上所有表单字段，返回 `TRule[]` 格式

**实现步骤**：

1. **查找所有表单标签**
   ```typescript
   // 需要识别 Greenhouse.io 的 label 选择器
   // 可能的选择器：label, .field-label, [data-label] 等
   const labels = document.querySelectorAll('...')
   ```

2. **识别字段类型**
   - 文本输入框：`input[type="text"]`, `input[type="email"]`, `input[type="tel"]`, `textarea`
   - 下拉选择框：`select`, 自定义下拉组件（可能需要点击展开）
   - 复选框/单选框：`input[type="checkbox"]`, `input[type="radio"]`
   - 教育信息：特殊的列表结构（需要识别 "Education" 或 "教育" 相关区域）

3. **提取字段信息**
   - 获取 label 文本（去除多余空格、换行）
   - 确定字段类型
   - 如果是 select，提取所有选项文本

4. **处理教育信息列表**
   - 识别教育信息区域
   - 记录为特殊类型 `education`
   - 可能需要识别"添加"按钮和列表项结构

5. **输出结果**
   ```typescript
   // 返回格式
   [
     { label: "First Name", type: "text" },
     { label: "Country", type: "select", options: ["USA", "Canada", ...] },
     { label: "Education", type: "education" }
   ]
   ```

6. **控制台打印**
   - 使用 `console.log` 或 `console.table` 格式化输出
   - 包含字段数量、类型分布等统计信息

**技术要点**：
- 使用 `querySelector` / `querySelectorAll` 查找元素
- 处理 label 和 input 的关联（`for` 属性、`aria-labelledby`、父子关系）
- 处理自定义下拉组件（可能需要模拟点击展开）
- 处理动态加载的内容（可能需要 `MutationObserver` 或延迟）

**测试验证**：
- [ ] 在测试链接1上运行，验证提取结果
- [ ] 在测试链接2上运行，验证提取结果
- [ ] 检查控制台输出是否完整准确

---

### 阶段三：实现数据加载与匹配（预计 30 分钟）

#### 3.1 实现 Mock 数据加载

**目标**：根据 URL 中的 token 参数加载对应的 JSON 文件

**实现步骤**：

1. **从 URL 获取 token**
   ```typescript
   const urlParams = new URLSearchParams(window.location.search)
   const token = urlParams.get('token')
   ```

2. **动态加载 JSON 文件**
   ```typescript
   // 使用 fetch 或 import 加载对应的 JSON
   const mockData = await fetch(`/mocks/${token}.json`).then(r => r.json())
   // 或者使用 chrome.runtime.getURL 获取扩展内资源路径
   ```

3. **数据预处理**
   - 将数组格式统一处理
   - 分离普通字段和教育信息
   - 建立字段名到值的映射

**技术要点**：
- 处理扩展内资源路径（可能需要使用 `chrome.runtime.getURL`）
- 错误处理：token 不存在或文件不存在的情况
- 数据格式验证

---

### 阶段四：实现自动填充功能（预计 2-3 小时）

#### 4.1 实现 `fillInputTextField()` 方法

**目标**：填充文本输入框和文本域

**实现步骤**：
```typescript
fillInputTextField = async (element: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  // 直接使用现有的工具函数
  await fillDefaultInputField(element, value)
}
```

**测试验证**：
- [ ] 测试普通文本输入框
- [ ] 测试 email 输入框
- [ ] 测试 phone 输入框
- [ ] 测试 textarea

---

#### 4.2 实现 `fillSelectField()` 方法

**目标**：填充下拉选择框

**实现步骤**：

1. **处理标准 select 元素**
   ```typescript
   // 使用 findMatchOption 找到匹配的选项
   const options = Array.from(element.options) as HTMLElement[]
   const matchedOption = findMatchOption(options, targetValue)
   if (matchedOption) {
     element.value = matchedOption.value
     // 触发 change 事件
   }
   ```

2. **处理自定义下拉组件**
   - 可能需要点击展开下拉框
   - 查找选项元素并点击
   - 处理异步加载的选项

**技术要点**：
- 使用 `findMatchOption` 进行模糊匹配
- 处理数组值（如 `["Yes"]` 需要提取字符串 "Yes"）
- 处理选项文本的部分匹配

**测试验证**：
- [ ] 测试标准 select
- [ ] 测试自定义下拉组件
- [ ] 测试选项匹配的准确性

---

#### 4.3 实现 `fillEducation()` 方法

**目标**：填充教育信息列表

**实现步骤**：

1. **识别教育信息区域**
   - 查找包含 "Education" 或相关关键词的区域
   - 找到"添加"按钮或列表容器

2. **处理每个教育项**
   ```typescript
   for (const eduItem of educationData) {
     // 1. 点击"添加"按钮（如果需要）
     // 2. 等待新列表项出现
     // 3. 填充各个字段：
     //    - School (学校)
     //    - Degree (学位)
     //    - Discipline (专业)
     //    - Start Date (开始日期)
     //    - End Date (结束日期)
     //    - isCurrent (是否在读)
     //    - GPA (如果有)
   }
   ```

3. **日期格式处理**
   - Mock 数据格式：`"2014-01-01"`
   - 表单可能需要：`"01/2014"` 或其他格式
   - 需要格式转换

**技术要点**：
- 处理动态添加的 DOM 元素
- 等待元素出现（可能需要 `setTimeout` 或 `MutationObserver`）
- 日期格式转换
- 处理"是否在读"的复选框

**测试验证**：
- [ ] 测试单个教育项填充
- [ ] 测试多个教育项填充
- [ ] 测试日期格式转换
- [ ] 测试"是否在读"状态

---

#### 4.4 实现 `getFormElementExecutor()` 方法

**目标**：为每个字段规则生成执行函数

**实现步骤**：

```typescript
getFormElementExecutor(rule: TRule): ExecutableFunction[] {
  // 1. 根据 rule.label 在 mock 数据中查找匹配的值
  const matchedData = this.findMatchingData(rule.label)
  
  if (!matchedData) {
    return [] // 没有匹配的数据，跳过
  }
  
  // 2. 根据字段类型生成对应的填充函数
  switch (rule.type) {
    case 'text':
      return [{
        func: async () => {
          const element = this.findInputElement(rule.label)
          if (element) {
            await this.fillInputTextField(element, matchedData.value)
            this.recordFillStatus(rule.label, true)
          } else {
            this.recordFillStatus(rule.label, false)
          }
        },
        delay: 500
      }]
    
    case 'select':
      return [{
        func: async () => {
          const element = this.findSelectElement(rule.label)
          if (element) {
            await this.fillSelectField(element, matchedData.value)
            this.recordFillStatus(rule.label, true)
          } else {
            this.recordFillStatus(rule.label, false)
          }
        },
        delay: 500
      }]
    
    case 'checkbox':
      // 处理复选框逻辑
      break
    
    case 'education':
      return this.getEducationExecutors(matchedData.Education)
    
    default:
      return []
  }
}
```

**技术要点**：
- 字段名匹配（精确匹配 + 模糊匹配）
- 返回 `ExecutableFunction[]` 数组（支持一个字段对应多个操作）
- 记录填充状态用于后续统计

---

#### 4.5 实现 `fillForm()` 方法

**目标**：协调整个填充流程

**实现步骤**：

```typescript
async fillForm() {
  // 1. 加载 mock 数据
  this.mockData = await this.loadMockData()
  
  // 2. 提取表单字段
  this.formRules = this.extractFields()
  console.log('提取到的表单字段：', this.formRules)
  
  // 3. 初始化统计
  this.fillStatus = {
    filled: [],
    unfilled: []
  }
  
  // 4. 生成执行函数序列
  const sequenceFuncCollector = []
  for (let rule of this.formRules) {
    const actions = this.getFormElementExecutor(rule)
    sequenceFuncCollector.push(...actions)
  }
  
  // 5. 顺序执行
  await executeSequentially(...sequenceFuncCollector)
  
  // 6. 统计结果
  this.handleFilledInfo()
}
```

**技术要点**：
- 错误处理：某个字段填充失败不影响其他字段
- 合理的延迟设置，避免操作过快
- 清晰的日志输出

---

### 阶段五：实现统计功能（预计 30 分钟）

#### 5.1 实现 `handleFilledInfo()` 方法

**目标**：统计并打印填充结果

**实现步骤**：

```typescript
handleFilledInfo() {
  const filledCount = this.fillStatus.filled.length
  const unfilledCount = this.fillStatus.unfilled.length
  const totalCount = filledCount + unfilledCount
  
  console.log('='.repeat(50))
  console.log('📊 填充统计结果')
  console.log('='.repeat(50))
  console.log(`✅ 成功填充字段数：${filledCount}`)
  console.log(`✅ 成功填充的字段：`, this.fillStatus.filled)
  console.log(`❌ 未填充字段数：${unfilledCount}`)
  console.log(`❌ 未填充的字段：`, this.fillStatus.unfilled)
  console.log(`📈 总字段数：${totalCount}`)
  console.log(`📊 填充成功率：${((filledCount / totalCount) * 100).toFixed(2)}%`)
  console.log('='.repeat(50))
}
```

**技术要点**：
- 清晰的格式化输出
- 包含成功和失败的字段列表
- 计算填充成功率

**测试验证**：
- [ ] 验证统计结果准确
- [ ] 验证控制台输出格式清晰易读

---

### 阶段六：完善与优化（预计 1 小时）

#### 6.1 字段匹配优化

- [ ] 实现模糊匹配算法
  - 使用 `similarity.ts` 中的相似度算法
  - 处理大小写、空格、标点符号差异
  - 设置相似度阈值（如 0.8）

- [ ] 处理特殊字段名
  - 处理同义词（如 "First Name" vs "Given Name"）
  - 处理部分匹配（如 "Email" vs "Email Address"）

#### 6.2 错误处理

- [ ] 添加 try-catch 包裹关键操作
- [ ] 处理元素不存在的情况
- [ ] 处理数据格式错误
- [ ] 友好的错误提示

#### 6.3 边界情况处理

- [ ] 处理空值
- [ ] 处理数组值的第一个元素提取
- [ ] 处理日期格式转换失败
- [ ] 处理教育信息为空的情况

#### 6.4 代码优化

- [ ] 提取公共方法，减少代码重复
- [ ] 添加必要的注释
- [ ] 优化变量命名
- [ ] 确保类型安全

---

### 阶段七：测试验证（预计 1 小时）

#### 7.1 功能测试

- [ ] **测试链接1验证**
  - 打开链接1
  - 点击 "Auto Fill Form" 按钮
  - 验证所有字段正确填充
  - 检查控制台统计输出
  - 手动验证关键字段的值

- [ ] **测试链接2验证**
  - 打开链接2
  - 点击 "Auto Fill Form" 按钮
  - 验证所有字段正确填充
  - 检查控制台统计输出
  - 对比两个链接的差异处理

#### 7.2 边界测试

- [ ] 测试字段不存在的情况
- [ ] 测试数据不匹配的情况
- [ ] 测试部分字段填充失败的情况

#### 7.3 性能测试

- [ ] 验证填充速度合理（不会过快导致页面未响应）
- [ ] 验证没有内存泄漏
- [ ] 验证多次点击按钮不会出错

---

### 阶段八：文档与交付（预计 30 分钟）

#### 8.1 代码整理

- [ ] 清理调试代码
- [ ] 确保代码格式统一
- [ ] 检查是否有 TODO 注释未完成

#### 8.2 录制演示视频

- [ ] 准备演示脚本
- [ ] 录制 5-10 秒的演示视频
- [ ] 视频应包含：
  - 打开测试链接
  - 点击 "Auto Fill Form" 按钮
  - 展示表单自动填充过程
  - 展示控制台的统计输出

#### 8.3 最终检查

- [ ] 代码完整性检查
- [ ] 功能完整性检查
- [ ] 文档完整性检查

---

## 🔧 技术实现细节

### 关键工具函数使用

1. **`fillDefaultInputField`** (`contents/crawler/utils/input/index.ts`)
   - 用于填充文本输入框和文本域
   - 已实现完整的事件触发逻辑

2. **`fillCheckbox`** (`contents/crawler/utils/checkbox/index.ts`)
   - 用于填充复选框
   - 已实现完整的事件触发逻辑

3. **`findMatchOption`** (`contents/crawler/utils/select.ts`)
   - 用于在下拉选项中查找匹配项
   - 支持模糊匹配

4. **`executeSequentially`** (`contents/crawler/utils/executor.ts`)
   - 用于顺序执行填充操作
   - 支持延迟设置

5. **`similarity`** (`contents/crawler/utils/similarity.ts`)
   - 用于计算字符串相似度
   - 可用于字段名匹配

### 数据结构

#### TRule 类型
```typescript
type TRule = { 
  label: string;      // 字段标签文本
  type: string;       // 字段类型：'text' | 'select' | 'checkbox' | 'education'
  options?: string[]; // 如果是 select，包含所有选项
}
```

#### Mock 数据格式
```typescript
type MockDataItem = 
  | { name: string; value: string | string[] }
  | { Education: EducationItem[] }

type EducationItem = {
  Degree: string;
  Discipline: string[];
  School: string;
  Start: string;      // "YYYY-MM-DD"
  End: string;        // "YYYY-MM-DD"
  isCurrent: boolean;
  gpa?: string;
}
```

---

## 📝 实施注意事项

### 1. DOM 结构识别
- Greenhouse.io 可能使用自定义组件，需要仔细分析实际 DOM 结构
- 可能需要处理 Shadow DOM
- 注意动态加载的内容

### 2. 字段匹配策略
- 优先使用精确匹配
- 精确匹配失败时使用模糊匹配（相似度 > 0.8）
- 处理大小写不敏感匹配
- 处理空格和标点符号差异

### 3. 异步处理
- 所有 DOM 操作可能需要等待
- 使用适当的延迟（`executeSequentially` 默认 1200ms）
- 处理动态添加的元素（教育信息列表）

### 4. 事件触发
- 确保触发所有必要的事件（input, change, blur）
- 某些字段可能需要特殊的事件序列
- 参考现有工具函数的实现

### 5. 错误处理
- 字段不存在时记录但继续执行
- 数据不匹配时记录但继续执行
- 确保统计信息准确反映实际情况

---

## ⏱️ 时间估算

| 阶段 | 预计时间 | 累计时间 |
|------|---------|---------|
| 阶段一：环境准备与页面分析 | 30分钟 | 30分钟 |
| 阶段二：实现字段提取功能 | 1-2小时 | 2小时 |
| 阶段三：实现数据加载与匹配 | 30分钟 | 2.5小时 |
| 阶段四：实现自动填充功能 | 2-3小时 | 5小时 |
| 阶段五：实现统计功能 | 30分钟 | 5.5小时 |
| 阶段六：完善与优化 | 1小时 | 6.5小时 |
| 阶段七：测试验证 | 1小时 | 7.5小时 |
| 阶段八：文档与交付 | 30分钟 | 8小时 |

**总计预计时间：6-8 小时**

---

## ✅ 完成标准

1. ✅ 能够提取页面上所有表单字段（文本、下拉、教育信息）
2. ✅ 能够将 mock 数据正确填充到对应字段
3. ✅ 能够统计并打印填充成功和失败的字段
4. ✅ 在两个测试链接上都能正常工作
5. ✅ 代码结构清晰，有适当注释
6. ✅ 有演示视频展示功能

---

## 🚀 开始实施

按照计划逐步实施，每个阶段完成后进行验证，确保质量。

**下一步**：开始阶段一 - 环境准备与页面分析

