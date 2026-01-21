import { executeSequentially, type ExecutableFunction } from "./utils/executor"
import { getLabelText, shouldSkipLabel } from "./utils/index"
import { fillDefaultInputField } from "./utils/input"
import { findMatchOption } from "./utils/select"

// 静态导入 mock 数据
import mock4327952003 from "../../mocks/4327952003.json"
import mock6909295 from "../../mocks/6909295.json"

type MockItem =
  | { name: string; value: string | string[] }
  | { Education: Array<Record<string, any>> }

// 要求
/**
 * 1. 能够爬取到页面上所有的表单项
 *  - 整理表单项的label 和 表单的类型 type,如果是select 类型，获取到所有选项
 *  - 基础表单的类型包括文本框、下拉框
 *  - form list（education 信息（））包含基础的表单类型
 *  - 将所有的信息打印在console里
 *
 * 2. 能够将提供的 mock 的数据填入到表单中
 *
 * 3. 填充完成后统计完成情况。
 */

type TRule = { label: string; type: string; options?: string[] }
export class GreenhouseAutoFill {
  formRules: TRule[]
  private mockMap: Map<string, string | string[]>
  private educationMock: Array<Record<string, any>> | null
  private filledLabels: string[] = []
  private missingLabels: string[] = []

  /**
   * 提取页面上所有表单字段
   * @returns 字段规则数组，包含 label、type 和 options（如果是 select）
   */
  extractFields(): TRule[] {
    const result: TRule[] = []

    const form = document.querySelector<HTMLFormElement>("#application_form")
    if (!form) {
      console.warn("[GreenhouseAutoFill] #application_form not found")
      this.formRules = []
      return []
    }

    // 基础字段 + 自定义问题都是 .field
    const fields = Array.from(form.querySelectorAll<HTMLElement>(".field"))
    console.log(`[GreenhouseAutoFill] total fields found: ${fields.length}`)
    
    // 识别教育信息区域，用于跳过教育信息内的字段（它们会在 fillEducation 中统一处理）
    const educationSection = form.querySelector<HTMLElement>("#education_section")

    for (const field of fields) {
      // 跳过教育信息区域内的字段（School, Degree, Discipline, End Date 等）
      // 这些字段会在 fillEducation() 中统一处理
      if (educationSection?.contains(field)) {
        continue
      }

      // 1) 优先处理 label[for] 的标准结构
      const labelEl =
        field.querySelector<HTMLLabelElement>("label[for]") ??
        field.querySelector<HTMLLabelElement>("label")

      if (!labelEl) {
        console.log(`[GreenhouseAutoFill] field skipped: no label`, field)
        continue
      }
      if (shouldSkipLabel(labelEl)) {
        console.log(`[GreenhouseAutoFill] field skipped: offscreen label`, field)
        continue
      }

      const labelText = getLabelText(labelEl)
      if (!labelText) {
        console.log(`[GreenhouseAutoFill] field skipped: empty label text`, field)
        continue
      }
      
      // 调试：打印提取的label文本
      if (labelText.includes("How did you perform") || 
          labelText.includes("We require all colleagues") ||
          labelText.includes("In which country") ||
          labelText.includes("Please confirm") ||
          labelText.includes("During this application") ||
          labelText.includes("In the past ten years") ||
          labelText.includes("Which gender")) {
        console.log(`[GreenhouseAutoFill] 🔍 Found dropdown field: "${labelText}"`)
      }

      // 跳过 Security Code（验证码字段，不应该自动填充）
      if (/security code/i.test(labelText)) {
        console.log(`[GreenhouseAutoFill] field skipped: Security Code`, labelText)
        continue
      }

      // 跳过上传类字段（Resume/CV, Cover Letter 等），不在本题要求范围
      if (/resume|cv|cover letter/i.test(labelText)) {
        console.log(`[GreenhouseAutoFill] field skipped: upload field`, labelText)
        continue
      }

      // 通过 label[for] 找关联控件
      const forId = labelEl.getAttribute("for")
      const byFor =
        forId && forId.trim()
          ? form.querySelector<HTMLElement>(`#${CSS.escape(forId.trim())}`)
          : null

      // 优先查找 input/textarea（排除隐藏的）
      const inputEl =
        (byFor as HTMLInputElement | HTMLTextAreaElement | null) ??
        labelEl.querySelector<HTMLInputElement>(
          'input[type="text"]:not([style*="display: none"]), input[type="email"]:not([style*="display: none"]), input[type="tel"]:not([style*="display: none"])'
        ) ??
        labelEl.querySelector<HTMLTextAreaElement>("textarea:not([style*='display: none'])") ??
        field.querySelector<HTMLInputElement>(
          'input[type="text"]:not([style*="display: none"]), input[type="email"]:not([style*="display: none"]), input[type="tel"]:not([style*="display: none"])'
        ) ??
        field.querySelector<HTMLTextAreaElement>("textarea:not([style*='display: none'])")

      // 检查是否有 Select2 容器（无论 select 是否隐藏）
      const hasSelect2Container = field.querySelector(".select2-container") || 
                                   labelEl.querySelector(".select2-container")

      // 查找 select（包括隐藏的 Select2 select）
      // 优先在field中查找，因为label可能包含很多嵌套元素
      let selectEl: HTMLSelectElement | null = null
      
      // 1. 先尝试通过 for 属性查找
      if (byFor && byFor.tagName === "SELECT") {
        selectEl = byFor as HTMLSelectElement
      }
      
      // 2. 在field中查找（优先，因为field是直接容器）
      if (!selectEl) {
        selectEl = field.querySelector<HTMLSelectElement>("select")
      }
      
      // 3. 在label中查找（作为后备，因为有些label直接包含select）
      if (!selectEl) {
        // 查找label内的所有select，包括隐藏的
        const labelSelects = labelEl.querySelectorAll<HTMLSelectElement>("select")
        if (labelSelects.length > 0) {
          // 优先选择有id的select（通常是主要的）
          selectEl = Array.from(labelSelects).find(s => s.id) || labelSelects[0] || null
        }
      }

      // 如果找到 select（包括隐藏的），优先处理
      if (selectEl) {
        const options = Array.from(selectEl.options || [])
          .map((o) => (o?.textContent || "").trim())
          .filter(Boolean)
        console.log(`[GreenhouseAutoFill] extracted select field: "${labelText}" with ${options.length} options`, selectEl.id)
        result.push({ label: labelText, type: "select", options })
        continue
      }

      // 如果有 Select2 容器但没有找到 select，尝试更积极地查找隐藏的 select
      if (hasSelect2Container && !selectEl) {
        // 尝试查找所有可能的隐藏select（在field和label中）
        const allSelectsInField = field.querySelectorAll<HTMLSelectElement>("select")
        const allSelectsInLabel = labelEl.querySelectorAll<HTMLSelectElement>("select")
        const allSelects = Array.from(allSelectsInField).concat(Array.from(allSelectsInLabel))
        
        // 优先选择有id的select
        const hiddenSelect = allSelects.find(s => {
          const style = window.getComputedStyle(s)
          return style.display === "none" || s.style.display === "none" || s.getAttribute("style")?.includes("display: none")
        }) || allSelects[0] // 如果没有找到隐藏的，就用第一个
        
        if (hiddenSelect) {
          const options = Array.from(hiddenSelect.options || [])
            .map((o) => (o?.textContent || "").trim())
            .filter(Boolean)
          console.log(`[GreenhouseAutoFill] extracted hidden select field: "${labelText}" with ${options.length} options`, hiddenSelect.id)
          result.push({ label: labelText, type: "select", options })
          continue
        }
      }
      
      // 即使没有Select2容器，也要检查是否有隐藏的select（有些下拉框可能没有Select2容器）
      if (!selectEl && !inputEl) {
        const allSelectsInField = field.querySelectorAll<HTMLSelectElement>("select")
        const allSelectsInLabel = labelEl.querySelectorAll<HTMLSelectElement>("select")
        const allSelects = Array.from(allSelectsInField).concat(Array.from(allSelectsInLabel))
        
        if (allSelects.length > 0) {
          // 优先选择有id的select
          const foundSelect = allSelects.find(s => s.id) || allSelects[0]
          const options = Array.from(foundSelect.options || [])
            .map((o) => (o?.textContent || "").trim())
            .filter(Boolean)
          console.log(`[GreenhouseAutoFill] extracted select field (no Select2 container): "${labelText}" with ${options.length} options`, foundSelect.id)
          result.push({ label: labelText, type: "select", options })
          continue
        }
      }

      // 优先处理 input/textarea（只有在没有 select 的情况下）
      if (inputEl && !hasSelect2Container) {
        const tag = inputEl.tagName.toLowerCase()
        const type =
          tag === "textarea"
            ? "textarea"
            : (inputEl as HTMLInputElement).type || "text"
        result.push({ label: labelText, type })
        continue
      }

      // 如果都没找到，但找到了 input（可能是 Select2 的情况）
      if (inputEl) {
        const tag = inputEl.tagName.toLowerCase()
        const type =
          tag === "textarea"
            ? "textarea"
            : (inputEl as HTMLInputElement).type || "text"
        result.push({ label: labelText, type })
        continue
      }

      // 如果什么都没找到，记录警告
      console.warn(`[GreenhouseAutoFill] field skipped: no input/select found for "${labelText}"`, field)
      // 调试：检查是否有隐藏的select
      const allSelectsInField = field.querySelectorAll<HTMLSelectElement>("select")
      const allSelectsInLabel = labelEl.querySelectorAll<HTMLSelectElement>("select")
      if (allSelectsInField.length > 0 || allSelectsInLabel.length > 0) {
        console.warn(`[GreenhouseAutoFill] ⚠️ Found ${allSelectsInField.length + allSelectsInLabel.length} select(s) but not extracted:`, 
          Array.from(allSelectsInField).map(s => ({ id: s.id, display: s.style.display, hidden: s.hidden })),
          Array.from(allSelectsInLabel).map(s => ({ id: s.id, display: s.style.display, hidden: s.hidden }))
        )
      }
    }

    // 教育信息：作为特殊 list 类型规则（后续阶段填充时再细拆）
    if (educationSection) {
      result.push({ label: "Education", type: "education" })
    }

    this.formRules = result
    console.info("[GreenhouseAutoFill] extractFields count:", result.length)
    console.table(result)
    return result
  }

  /**
   * 从当前页面 URL 中提取 token 参数
   * @returns token 值，如果不存在则返回 null
   */
  private getTokenFromUrl(): string | null {
    const url = new URL(window.location.href)
    // 题目给的是 token=xxxx；另外 Greenhouse 也常见 gh_jid=xxxx
    return url.searchParams.get("token") || url.searchParams.get("gh_jid")
  }

  /**
   * 规范化字段名（用于匹配）
   * 将字段名转换为小写、去除特殊字符、合并空格
   * @param label 原始字段名
   * @returns 规范化后的字段名
   */
  private normalizeKey(label: string): string {
    return label
      .toLowerCase()
      .replace(/[✱*]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  }

  /**
   * 加载 mock 数据文件
   * 使用静态 import 的方式，避免扩展资源权限问题
   * @returns mock 数据数组，加载失败返回 null
   */
  private async loadMockData(): Promise<MockItem[] | null> {
    const token = this.getTokenFromUrl()
    if (!token) {
      console.warn("[GreenhouseAutoFill] token/gh_jid not found in URL")
      return null
    }

    // 根据 token 选择对应的 mock 数据
    let mockData: MockItem[] | null = null
    if (token === "4327952003") {
      mockData = mock4327952003 as unknown as MockItem[]
    } else if (token === "6909295") {
      mockData = mock6909295 as unknown as MockItem[]
    }

    if (mockData) {
      console.info("[GreenhouseAutoFill] mock loaded:", { token, source: "static import" })
      return mockData
    }

    console.error(
      "[GreenhouseAutoFill] failed to load mock data",
      `mocks/${token}.json`,
      "Token not found in static imports"
    )
    return null
  }

  /**
   * 构建 mock 数据映射表
   * 将 mock 数据转换为 Map，同时存储原始 key 和规范化 key
   * @param mock mock 数据数组
   */
  private buildMockMap(mock: MockItem[] | null) {
    this.mockMap = new Map()
    this.educationMock = null
    this.filledLabels = []
    this.missingLabels = []
    if (!mock) return

    for (const item of mock) {
      if (!item) continue

      // 分离教育信息
      if ("Education" in item) {
        this.educationMock = Array.isArray(item.Education) ? item.Education : []
        continue
      }

      // 普通字段：同时存储原始 key 和规范化 key
      if ("name" in item) {
        const rawKey = (item.name || "").trim()
        if (!rawKey) continue
        this.mockMap.set(rawKey, item.value)
        this.mockMap.set(this.normalizeKey(rawKey), item.value)
      }
    }
  }

  /**
   * 主填充流程：加载 mock 数据并填充表单
   */
  async fillForm() {
    // 1. 加载 mock 数据并建立映射
    const mock = await this.loadMockData()
    this.buildMockMap(mock)
    console.info("[GreenhouseAutoFill] mock keys:", this.mockMap?.size || 0)
    if (this.educationMock) {
      console.info(
        "[GreenhouseAutoFill] education items:",
        this.educationMock.length
      )
    }

    // 2. 确保表单字段已提取
    if (!this.formRules?.length) {
      this.extractFields()
    }

    // 3. 为每个字段规则生成执行函数
    const sequenceFuncCollector = []
    for (let rule of this.formRules) {
      const action = this.getFormElementExecutor(rule)
      const actions = Array.isArray(action) ? action : [action]
      sequenceFuncCollector.push(...actions)
    }

    // 4. 顺序执行填充操作
    await executeSequentially(...sequenceFuncCollector)
    
    // 5. 统计并输出填充结果
    this.handleFilledInfo()
  }

  /**
   * 根据 label 从 mock 映射中获取值
   * @param label 字段标签
   * @returns mock 值（可能是 string 或 string[]），未找到返回 undefined
   */
  private getMockValueByLabel(label: string): string | string[] | undefined {
    if (!this.mockMap) return
    
    // 先尝试精确匹配
    let value = this.mockMap.get(label) || this.mockMap.get(this.normalizeKey(label))
    if (value) return value
    
    // 如果精确匹配失败，尝试部分匹配（label包含mock key，或mock key包含label）
    const normalizedLabel = this.normalizeKey(label)
    for (const [mockKey, mockValue] of this.mockMap.entries()) {
      const normalizedMockKey = this.normalizeKey(mockKey)
      // 检查是否label包含mock key的关键部分，或mock key包含label的关键部分
      if (normalizedLabel.includes(normalizedMockKey) || normalizedMockKey.includes(normalizedLabel)) {
        // 进一步验证：确保匹配的关键词足够长（避免误匹配）
        const minLength = Math.min(normalizedLabel.length, normalizedMockKey.length)
        if (minLength > 10) { // 至少10个字符匹配
          console.log(`[GreenhouseAutoFill] Found partial match: "${label}" -> "${mockKey}"`)
          return mockValue
        }
      }
    }
    
    return undefined
  }

  /**
   * 将值转换为单个字符串
   * 如果是数组，取第一个元素
   * @param value 原始值（string | string[] | undefined）
   * @returns 单个字符串值
   */
  private toSingleValue(value: string | string[] | undefined): string | undefined {
    if (typeof value === "string") return value
    if (Array.isArray(value)) return value[0]
    return undefined
  }

  /**
   * 标记字段为已填充
   * @param label 字段标签
   */
  private markFilled(label: string) {
    if (!this.filledLabels.includes(label)) this.filledLabels.push(label)
    // 如果之前标记为 missing，移除
    this.missingLabels = this.missingLabels.filter((x) => x !== label)
  }

  /**
   * 标记字段为未填充
   * @param label 字段标签
   */
  private markMissing(label: string) {
    if (!this.missingLabels.includes(label)) this.missingLabels.push(label)
  }

  /**
   * 等待某个条件满足（轮询）
   * @param getter 获取目标值的函数
   * @param timeoutMs 超时时间（毫秒）
   * @param intervalMs 轮询间隔（毫秒）
   * @returns 目标值，超时返回 null
   */
  private async waitFor<T>(
    getter: () => T | null | undefined,
    timeoutMs: number = 5000,
    intervalMs: number = 100
  ): Promise<T | null> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      const v = getter()
      if (v) return v as T
      await new Promise((r) => setTimeout(r, intervalMs))
    }
    return null
  }

  /**
   * 解析日期字符串为月份和年份
   * @param dateStr 日期字符串，格式：YYYY-MM-DD
   * @returns 包含 month 和 year 的对象
   */
  private parseMonthYear(dateStr?: string): { month?: string; year?: string } {
    if (!dateStr) return {}
    const parts = dateStr.split("-")
    if (parts.length < 2) return {}
    const year = parts[0]
    const monthRaw = parts[1]
    const month = String(Number(monthRaw)) // 去掉前导 0，如 "01" -> "1"
    return { month, year }
  }

  /**
   * 为字段规则生成执行函数
   * @param rule 字段规则
   * @returns 执行函数数组（支持一个字段对应多个操作）
   */
  getFormElementExecutor(rule: TRule): ExecutableFunction[] {
    // education 特殊处理：一次性生成一组 action
    if (rule.type === "education") {
      return [
        {
          func: async () => {
            try {
              await this.fillEducation()
              this.markFilled(rule.label)
            } catch (e) {
              console.error("[GreenhouseAutoFill] fillEducation failed", e)
              this.markMissing(rule.label)
            }
          },
          delay: 800
        }
      ]
    }

    const raw = this.getMockValueByLabel(rule.label)
    const value = this.toSingleValue(raw)

    // 没有对应 mock 数据
    if (value == null || value === "") {
      return [
        {
          func: () => this.markMissing(rule.label),
          delay: 0
        }
      ]
    }

    return [
      {
        func: async () => {
          const form = document.querySelector<HTMLFormElement>("#application_form")
          if (!form) {
            this.markMissing(rule.label)
            return
          }

          // 特殊处理：基础字段（First Name, Last Name, Email, Phone）可能不在 .field 容器内
          // 先尝试通过 ID 直接查找
          const baseFieldMap: Record<string, { id: string; type?: "input" | "select" }> = {
            "first name": { id: "first_name" },
            "last name": { id: "last_name" },
            email: { id: "email" },
            phone: { id: "phone" }
          }
          const normalizedLabel = this.normalizeKey(rule.label)
          const baseFieldInfo = baseFieldMap[normalizedLabel]

          if (baseFieldInfo) {
            // 先尝试 input
            const directInput = form.querySelector<HTMLInputElement>(`#${baseFieldInfo.id}`)
            // 再尝试 select（Phone 可能是 select）
            const directSelect = form.querySelector<HTMLSelectElement>(`#${baseFieldInfo.id}`)

            if (directInput) {
              console.log(
                `[GreenhouseAutoFill] found base field ${rule.label} by ID: #${baseFieldInfo.id} (input)`
              )
              try {
                await this.fillInputTextField(directInput, value)
                await new Promise((r) => setTimeout(r, 200))
                if (directInput.value && directInput.value.trim() === value.trim()) {
                  this.markFilled(rule.label)
                  console.log(`[GreenhouseAutoFill] ✅ ${rule.label} filled successfully (base field)`)
                } else {
                  console.warn(
                    `[GreenhouseAutoFill] ❌ base field value mismatch for ${rule.label}`,
                    `expected: "${value}"`,
                    `actual: "${directInput.value}"`
                  )
                  this.markMissing(rule.label)
                }
                return
              } catch (e) {
                console.error(`[GreenhouseAutoFill] fill base field failed for ${rule.label}`, e)
                this.markMissing(rule.label)
                return
              }
            } else if (directSelect) {
              console.log(
                `[GreenhouseAutoFill] found base field ${rule.label} by ID: #${baseFieldInfo.id} (select)`
              )
              try {
                await this.fillSelectField(directSelect, value)
                await new Promise((r) => setTimeout(r, 300))
                if (directSelect.value) {
                  this.markFilled(rule.label)
                  console.log(`[GreenhouseAutoFill] ✅ ${rule.label} filled successfully (base field select)`)
                } else {
                  console.warn(
                    `[GreenhouseAutoFill] ❌ base field select value not set for ${rule.label}`,
                    `expected: "${value}"`,
                    `current value: "${directSelect.value}"`
                  )
                  this.markMissing(rule.label)
                }
                return
              } catch (e) {
                console.error(`[GreenhouseAutoFill] fill base field select failed for ${rule.label}`, e)
                this.markMissing(rule.label)
                return
              }
            }
          }

          // 找到对应 field（按 label 文本匹配）
          const fields = Array.from(form.querySelectorAll<HTMLElement>(".field"))
          let field: HTMLElement | undefined
          for (const f of fields) {
            // 跳过教育信息区域内的字段
            const educationSection = form.querySelector<HTMLElement>("#education_section")
            if (educationSection?.contains(f)) {
              continue
            }

            const labelEl =
              f.querySelector<HTMLLabelElement>("label[for]") ??
              f.querySelector<HTMLLabelElement>("label")
            if (!labelEl) continue
            if (shouldSkipLabel(labelEl)) continue
            const labelText = getLabelText(labelEl)
            if (!labelText) continue
            if (this.normalizeKey(labelText) === this.normalizeKey(rule.label)) {
              field = f
              break
            }
          }

          if (!field) {
            console.warn(
              `[GreenhouseAutoFill] field not found for ${rule.label}`,
              `searched in ${fields.length} fields`
            )
            this.markMissing(rule.label)
            return
          }

          const labelEl =
            field.querySelector<HTMLLabelElement>("label[for]") ??
            field.querySelector<HTMLLabelElement>("label")

          const forId = labelEl?.getAttribute("for")
          const byFor =
            forId && forId.trim()
              ? form.querySelector<HTMLElement>(`#${CSS.escape(forId.trim())}`)
              : null

          // 查找 input/textarea（排除隐藏的，与 extractFields 保持一致）
          const inputEl =
            (byFor as HTMLInputElement | HTMLTextAreaElement | null) ??
            labelEl?.querySelector<HTMLInputElement>(
              'input[type="text"]:not([style*="display: none"]), input[type="email"]:not([style*="display: none"]), input[type="tel"]:not([style*="display: none"])'
            ) ??
            labelEl?.querySelector<HTMLTextAreaElement>("textarea:not([style*='display: none'])") ??
            field.querySelector<HTMLInputElement>(
              'input[type="text"]:not([style*="display: none"]), input[type="email"]:not([style*="display: none"]), input[type="tel"]:not([style*="display: none"])'
            ) ??
            field.querySelector<HTMLTextAreaElement>("textarea:not([style*='display: none'])")

          // 查找 select（排除隐藏的 Select2 select）
          const selectEl =
            (byFor as HTMLSelectElement | null) ??
            labelEl?.querySelector<HTMLSelectElement>("select:not([style*='display: none'])") ??
            field.querySelector<HTMLSelectElement>("select:not([style*='display: none'])")

          // 如果找到的是隐藏的 select（Select2），检查是否有可见的 Select2 容器
          const hiddenSelect = field.querySelector<HTMLSelectElement>("select[style*='display: none']")
          const hasSelect2Container = field.querySelector(".select2-container")

          try {
            if (selectEl || (hiddenSelect && hasSelect2Container)) {
              const targetSelect = selectEl || hiddenSelect
              if (targetSelect) {
                console.log(
                  `[GreenhouseAutoFill] filling select ${rule.label}`,
                  `element: ${targetSelect.id || targetSelect.name || 'unknown'}`,
                  `value: ${value}`,
                  `options count: ${targetSelect.options.length}`
                )
                
                // 如果是 Select2，使用特殊处理方式
                if (hasSelect2Container && hiddenSelect) {
                  const success = await this.fillSelect2Field(field, targetSelect, value, rule.label)
                  if (success) {
                    return
                  }
                  // 如果 Select2 方式失败，回退到普通方式
                  console.warn(`[GreenhouseAutoFill] Select2 fill failed, trying fallback for ${rule.label}`)
                }
                
                // 对于select类型，传递原始值（可能是数组），fillSelectField会处理
                const selectValue = rule.type === "select" ? (raw || value) : value
                console.log(`[GreenhouseAutoFill] Filling select field "${rule.label}" with value:`, selectValue)
                await this.fillSelectField(targetSelect, selectValue as string | string[])
                
                // 等待 Select2 同步（如果是 Select2）
                if (hasSelect2Container) {
                  await new Promise((r) => setTimeout(r, 500)) // 增加等待时间
                  
                  // 如果是 Select2，验证显示的值
                  const select2Container = field.querySelector<HTMLElement>(".select2-container")
                  const selectedText = select2Container?.querySelector(".select2-chosen")?.textContent?.trim()
                  if (selectedText && selectedText !== "--" && selectedText !== "Select..." && selectedText !== "") {
                    this.markFilled(rule.label)
                    console.log(`[GreenhouseAutoFill] ✅ ${rule.label} (select2) filled successfully: ${selectedText}`)
                    return
                  }
                }
                
                // 验证填充是否成功
                // 对于Select2，检查显示的值；对于普通select，检查value
                let isFilled = false
                if (hasSelect2Container) {
                  const select2Container = field.querySelector<HTMLElement>(".select2-container")
                  const selectedText = select2Container?.querySelector(".select2-chosen")?.textContent?.trim()
                  if (selectedText && selectedText !== "--" && selectedText !== "Please select" && selectedText !== "Select..." && selectedText !== "") {
                    isFilled = true
                  }
                }
                
                if (!isFilled && targetSelect.value) {
                  isFilled = true
                }
                
                if (isFilled) {
                  this.markFilled(rule.label)
                  const displayText = hasSelect2Container 
                    ? field.querySelector<HTMLElement>(".select2-container")?.querySelector(".select2-chosen")?.textContent?.trim()
                    : targetSelect.options[targetSelect.selectedIndex]?.textContent?.trim()
                  console.log(`[GreenhouseAutoFill] ✅ ${rule.label} (select) filled successfully: "${displayText}"`)
                } else {
                  console.warn(
                    `[GreenhouseAutoFill] ❌ select value not set for ${rule.label}`,
                    `target value: ${value}`,
                    `current value: ${targetSelect.value}`,
                    `options:`,
                    Array.from(targetSelect.options).map((o) => ({
                      text: o.textContent?.trim(),
                      value: o.value
                    }))
                  )
                  this.markMissing(rule.label)
                }
                return
              }
            }
            if (inputEl) {
              // 记录填充前的值（用于调试）
              const beforeValue = inputEl.value
              console.log(
                `[GreenhouseAutoFill] filling ${rule.label}`,
                `element: ${inputEl.id || inputEl.name || 'unknown'}`,
                `value: ${value}`
              )

              await this.fillInputTextField(inputEl, value)

              // 等待一小段时间，让事件处理完成
              await new Promise((r) => setTimeout(r, 200))

              // 验证填充是否成功
              const afterValue = inputEl.value
              if (afterValue && afterValue.trim() === value.trim()) {
                this.markFilled(rule.label)
                console.log(`[GreenhouseAutoFill] ✅ ${rule.label} filled successfully`)
              } else {
                console.warn(
                  `[GreenhouseAutoFill] ❌ input value mismatch for ${rule.label}`,
                  `expected: "${value}"`,
                  `before: "${beforeValue}"`,
                  `after: "${afterValue}"`,
                  `element:`,
                  inputEl
                )
                // 尝试再次填充
                inputEl.value = value
                inputEl.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }))
                inputEl.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }))
                await new Promise((r) => setTimeout(r, 200))
                if (inputEl.value && inputEl.value.trim() === value.trim()) {
                  this.markFilled(rule.label)
                  console.log(`[GreenhouseAutoFill] ✅ ${rule.label} filled successfully (retry)`)
                } else {
                  this.markMissing(rule.label)
                }
              }
              return
            }
            console.warn(`[GreenhouseAutoFill] element not found for ${rule.label}`)
            this.markMissing(rule.label)
          } catch (e) {
            console.error("[GreenhouseAutoFill] fill field failed", rule.label, e)
            this.markMissing(rule.label)
          }
        },
        delay: 500
      }
    ]
  }

  /**
   * 统计并打印填充结果
   */
  handleFilledInfo() {
    const filled = this.filledLabels || []
    const missing = this.missingLabels || []
    const total = filled.length + missing.length

    console.log("=".repeat(60))
    console.log("[GreenhouseAutoFill] 填充统计")
    console.log(`✅ 成功填充：${filled.length}`)
    console.log(`❌ 未填充：${missing.length}`)
    console.log(`📌 总计：${total}`)
    if (filled.length) console.log("✅ filled:", filled)
    if (missing.length) console.log("❌ missing:", missing)
    console.log("=".repeat(60))
  }

  /**
   * 填充文本输入框或文本域
   * @param element 输入元素（input 或 textarea）
   * @param value 要填充的值
   */
  fillInputTextField = async (
    element: HTMLInputElement | HTMLTextAreaElement,
    value: string
  ) => {
    await fillDefaultInputField(element, value)
  }

  /**
   * 专门处理 Select2 下拉框的填充
   * 通过点击下拉框和选项来实现，而不是直接设置值
   * @param field 字段容器元素
   * @param selectElement 隐藏的 select 元素
   * @param value 要匹配的值
   * @param label 字段标签（用于日志）
   * @returns 是否成功填充
   */
  private async fillSelect2Field(
    field: HTMLElement,
    selectElement: HTMLSelectElement,
    value: string,
    label: string
  ): Promise<boolean> {
    try {
      const select2Container = field.querySelector<HTMLElement>(".select2-container")
      if (!select2Container) {
        console.warn(`[GreenhouseAutoFill] Select2 container not found for ${label}`)
        return false
      }

      // 点击打开下拉框
      const openAnchor = select2Container.querySelector<HTMLElement>("a.select2-choice")
      if (!openAnchor) {
        console.warn(`[GreenhouseAutoFill] Select2 open anchor not found for ${label}`)
        return false
      }

      openAnchor.click()
      await new Promise((r) => setTimeout(r, 400)) // 等待下拉框展开

      // 等待下拉框出现
      const dropdown = await this.waitFor<HTMLElement>(
        () => {
          const activeDrop = document.querySelector(".select2-drop-active")
          const visibleDrop = document.querySelector(".select2-drop:not(.select2-display-none)")
          return (activeDrop || visibleDrop) as HTMLElement | null
        },
        5000,
        100
      )

      if (!dropdown) {
        console.warn(`[GreenhouseAutoFill] Select2 dropdown not found for ${label}`)
        return false
      }

      // 获取所有选项
      const options = Array.from(selectElement.options || [])
      const target = String(value).trim().toLowerCase()

      // 找到匹配的选项
      let bestOption: HTMLOptionElement | null = null

      // 先尝试精确匹配
      bestOption = options.find(
        (opt) =>
          opt.textContent?.trim().toLowerCase() === target ||
          opt.value === target ||
          opt.value === String(value).trim()
      ) as HTMLOptionElement | null

      // 如果没有精确匹配，使用模糊匹配
      if (!bestOption) {
        bestOption = findMatchOption(options as unknown as HTMLElement[], target) as HTMLOptionElement | null
      }

      // 如果还是没有匹配，尝试匹配 "Yes" -> "1", "No" -> "0"
      if (!bestOption && (target === "yes" || target === "no")) {
        const targetValue = target === "yes" ? "1" : "0"
        bestOption = options.find((opt) => opt.value === targetValue) as HTMLOptionElement | null
      }

      if (!bestOption) {
        console.warn(
          `[GreenhouseAutoFill] no matching option found for Select2 ${label}`,
          `target: "${value}"`,
          `options:`,
          options.map((o) => ({ text: o.textContent, value: o.value }))
        )
        // 关闭下拉框
        document.body.click()
        return false
      }

      // 在下拉框中找到对应的 li 元素并点击
      const optionText = bestOption.textContent?.trim() || ""
      const optionValue = bestOption.value

      // 尝试多种方式找到选项
      const optionLi = await this.waitFor<HTMLElement>(
        () => {
          // 方法1: 通过文本内容匹配
          const lis = Array.from(dropdown.querySelectorAll<HTMLElement>("li"))
          for (const li of lis) {
            const liText = li.textContent?.trim() || ""
            if (
              liText.toLowerCase() === optionText.toLowerCase() ||
              liText.toLowerCase() === target ||
              li.getAttribute("data-value") === optionValue
            ) {
              // 确保不是禁用或隐藏的选项
              if (!li.classList.contains("select2-disabled") && !li.classList.contains("select2-searching")) {
                return li
              }
            }
          }
          return null
        },
        3000,
        100
      )

      if (optionLi) {
        optionLi.click()
        await new Promise((r) => setTimeout(r, 500)) // 等待选择完成

        // 验证是否成功
        const selectedText = select2Container.querySelector(".select2-chosen")?.textContent?.trim()
        if (selectedText && selectedText !== "--" && selectedText !== "Select..." && selectedText !== "") {
          console.log(`[GreenhouseAutoFill] ✅ ${label} (Select2) filled successfully: ${selectedText}`)
          return true
        }
      }

      // 如果点击方式失败，尝试直接设置值
      selectElement.value = bestOption.value
      selectElement.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }))
      await new Promise((r) => setTimeout(r, 300))

      const selectedText = select2Container.querySelector(".select2-chosen")?.textContent?.trim()
      if (selectedText && selectedText !== "--" && selectedText !== "Select..." && selectedText !== "") {
        console.log(`[GreenhouseAutoFill] ✅ ${label} (Select2 fallback) filled successfully: ${selectedText}`)
        return true
      }

      return false
    } catch (error) {
      console.error(`[GreenhouseAutoFill] error filling Select2 ${label}:`, error)
      return false
    }
  }

  /**
   * 填充下拉选择框
   * @param element select 元素
   * @param value 要匹配的值（会进行模糊匹配）
   */
  fillSelectField = async (element: HTMLSelectElement, value: string | string[]) => {
    if (!element) return

    const options = Array.from(element.options || [])
    if (!options.length) {
      console.warn(`[GreenhouseAutoFill] select has no options`, element)
      return
    }

    // 处理数组值（从mock数据中提取第一个值）
    let targetValue = value
    if (Array.isArray(value)) {
      targetValue = value[0]
    }
    const target = String(targetValue).trim()
    
    console.log(`[GreenhouseAutoFill] Filling select "${element.id}" with target: "${target}"`)
    
    // 先尝试精确匹配（包括 value 和 text）
    let best = options.find(
      (opt) =>
        opt.value === target ||
        opt.textContent?.trim().toLowerCase() === target.toLowerCase() ||
        opt.textContent?.trim() === target
    ) as HTMLOptionElement | null

    // 如果没有精确匹配，尝试部分匹配（选项文本包含目标值，或目标值包含选项文本）
    if (!best) {
      const lowerTarget = target.toLowerCase()
      best = options.find((opt) => {
        const optText = opt.textContent?.trim().toLowerCase() || ""
        return optText.includes(lowerTarget) || lowerTarget.includes(optText)
      }) as HTMLOptionElement | null
    }

    // 如果还是没有匹配，使用模糊匹配
    if (!best) {
      best = findMatchOption(options as unknown as HTMLElement[], target) as
        | HTMLOptionElement
        | null
    }

    // 如果还是没有匹配，尝试匹配 "Yes" -> "1", "No" -> "0"
    if (!best && (target.toLowerCase() === "yes" || target.toLowerCase() === "no")) {
      const targetValue = target.toLowerCase() === "yes" ? "1" : "0"
      best = options.find((opt) => opt.value === targetValue) as HTMLOptionElement | null
    }

    if (!best) {
      console.warn(
        `[GreenhouseAutoFill] ❌ no match found for select`,
        `target: "${target}"`,
        `options:`,
        options.map((o) => ({ text: o.textContent?.trim(), value: o.value }))
      )
      return
    }

    console.log(`[GreenhouseAutoFill] ✅ Selected option: "${best.textContent?.trim()}" (value: ${best.value})`)

    // 设置值并触发事件（兼容 Select2）
    element.value = best.value
    
    // 触发多个事件确保 Select2 能正确响应
    element.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }))
    element.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }))
    element.dispatchEvent(new Event("blur", { bubbles: true, cancelable: true }))
    
    // 如果是 Select2，尝试通过 jQuery 触发（如果可用）
    if (typeof window !== "undefined" && (window as any).jQuery) {
      try {
        const $select = (window as any).jQuery(element)
        $select.trigger("change")
        $select.trigger("select2:select")
      } catch (e) {
        // jQuery 不可用或出错，继续使用原生事件
      }
    }
    
    // 等待 Select2 同步
    await new Promise((r) => setTimeout(r, 500))
    
    // 验证是否成功（检查Select2容器显示的值）
    const select2Container = element.closest(".field")?.querySelector(".select2-container")
    if (select2Container) {
      const selectedText = select2Container.querySelector(".select2-chosen")?.textContent?.trim()
      if (selectedText && selectedText !== "Please select" && selectedText !== "--") {
        console.log(`[GreenhouseAutoFill] ✅ Select2 updated: "${selectedText}"`)
      } else {
        console.warn(`[GreenhouseAutoFill] ⚠️ Select2 may not have updated, selected text: "${selectedText}"`)
      }
    }
  }

  /**
   * 填充教育信息列表
   * 支持多个教育项，会自动添加新的教育项（如果不够）
   * 填充字段包括：School（远程 Select2）、Degree、Discipline、Start Date、End Date
   */
  async fillEducation() {
    const form = document.querySelector<HTMLFormElement>("#application_form")
    if (!form) return

    const educationList = Array.isArray(this.educationMock)
      ? this.educationMock
      : []
    if (!educationList.length) {
      // 没有教育数据就不做任何事，但不算错误
      return
    }

    const section = form.querySelector<HTMLElement>("#education_section")
    if (!section) return

    const getEducationItems = () =>
      Array.from(
        section.querySelectorAll<HTMLElement>(".education:not(.education-template)")
      )

    for (let idx = 0; idx < educationList.length; idx++) {
      // 确保有足够的 education block（不够则点击添加按钮）
      let items = getEducationItems()
      if (items.length <= idx) {
        const addBtn = section.querySelector<HTMLAnchorElement>("#add_education")
        if (addBtn) addBtn.click()
        await this.waitFor(() => getEducationItems()[idx], 6000, 150)
        items = getEducationItems()
      }

      const eduEl = items[idx]
      if (!eduEl) continue

      const edu = educationList[idx] || {}
      const school = edu.School as string | undefined
      const degree = edu.Degree as string | undefined
      const disciplineArr = edu.Discipline as string[] | undefined
      const discipline = Array.isArray(disciplineArr) ? disciplineArr[0] : undefined
      const start = edu.Start as string | undefined
      const end = edu.End as string | undefined

      // Degree / Discipline：直接操作隐藏的 select（Select2 会自动同步）
      const degreeSelect = eduEl.querySelector<HTMLSelectElement>("select.degree")
      if (degreeSelect && degree) {
        await this.fillSelectField(degreeSelect, degree)
        await new Promise((r) => setTimeout(r, 300)) // 等待 Select2 同步
      }

      const disciplineSelect =
        eduEl.querySelector<HTMLSelectElement>("select.discipline")
      if (disciplineSelect && discipline) {
        await this.fillSelectField(disciplineSelect, discipline)
        await new Promise((r) => setTimeout(r, 300)) // 等待 Select2 同步
      }

      // Start / End Date：MM / YYYY 两个独立的 input
      const { month: sm, year: sy } = this.parseMonthYear(start)
      const { month: em, year: ey } = this.parseMonthYear(end)

      const startMonthInput =
        eduEl.querySelector<HTMLInputElement>("input.start-date-month") ??
        eduEl.querySelector<HTMLInputElement>('input[name*="[start_date][month]"]')
      const startYearInput =
        eduEl.querySelector<HTMLInputElement>("input.start-date-year") ??
        eduEl.querySelector<HTMLInputElement>('input[name*="[start_date][year]"]')

      const endMonthInput =
        eduEl.querySelector<HTMLInputElement>("input.end-date-month") ??
        eduEl.querySelector<HTMLInputElement>('input[name*="[end_date][month]"]')
      const endYearInput =
        eduEl.querySelector<HTMLInputElement>("input.end-date-year") ??
        eduEl.querySelector<HTMLInputElement>('input[name*="[end_date][year]"]')

      if (startMonthInput && sm) {
        await fillDefaultInputField(startMonthInput, sm)
        await new Promise((r) => setTimeout(r, 200))
      }
      if (startYearInput && sy) {
        await fillDefaultInputField(startYearInput, sy)
        await new Promise((r) => setTimeout(r, 200))
      }
      if (endMonthInput && em) {
        await fillDefaultInputField(endMonthInput, em)
        await new Promise((r) => setTimeout(r, 200))
      }
      if (endYearInput && ey) {
        await fillDefaultInputField(endYearInput, ey)
        await new Promise((r) => setTimeout(r, 200))
      }

      // School：远程 Select2（方案A - 输入关键字 + 等待结果 + 点击匹配项）
      if (school) {
        console.log(`[GreenhouseAutoFill] 🔍 Looking for School field in education item ${idx}, target: "${school}"`)
        
        // 尝试多种选择器找到 Select2 容器
        const select2Container =
          eduEl.querySelector<HTMLElement>(".select2-container.school-name") ??
          eduEl.querySelector<HTMLElement>('[id^="s2id_education_school_name_"]') ??
          eduEl.querySelector<HTMLElement>('.select2-container[id*="school"]') ??
          eduEl.querySelector<HTMLElement>('.select2-container[id*="School"]') ??
          eduEl.querySelector<HTMLElement>('.select2-container')

        if (!select2Container) {
          console.warn(`[GreenhouseAutoFill] ❌ School Select2 container not found in education item ${idx}`)
          console.warn(`[GreenhouseAutoFill] education element:`, eduEl)
          console.warn(`[GreenhouseAutoFill] available containers:`, eduEl.querySelectorAll('.select2-container'))
          continue
        }

        console.log(`[GreenhouseAutoFill] ✅ Found School Select2 container:`, select2Container.id)

        const openAnchor = select2Container.querySelector<HTMLElement>(
          "a.select2-choice"
        ) ?? select2Container.querySelector<HTMLElement>("a.select2-selection")
        
        if (!openAnchor) {
          console.warn(`[GreenhouseAutoFill] ❌ School Select2 anchor not found`, select2Container)
          console.warn(`[GreenhouseAutoFill] container children:`, Array.from(select2Container.children))
          continue
        }
        
        console.log(`[GreenhouseAutoFill] ✅ Found School Select2 anchor, clicking...`)
        
        // 尝试多种方式打开下拉框
        // 方法1: 点击anchor
        openAnchor.click()
        await new Promise((r) => setTimeout(r, 300))
        
        // 方法2: 如果没打开，尝试点击容器
        let dropdown: HTMLElement | null = null
        dropdown = await this.waitFor<HTMLElement>(
          () => {
            // 检查所有可能的dropdown
            const allDrops = document.querySelectorAll(".select2-drop")
            for (const drop of allDrops) {
              const style = window.getComputedStyle(drop)
              const isVisible = !drop.classList.contains("select2-display-none") && 
                                style.display !== "none" && 
                                style.visibility !== "hidden"
              if (isVisible) {
                // 检查是否有输入框
                const inp = drop.querySelector<HTMLInputElement>(".select2-input")
                if (inp) {
                  const inpStyle = window.getComputedStyle(inp)
                  if (inpStyle.display !== "none" && inpStyle.visibility !== "hidden") {
                    console.log(`[GreenhouseAutoFill] ✅ Found visible dropdown with input:`, drop.id, inp.id)
                    return drop as HTMLElement
                  }
                }
              }
            }
            return null
          },
          2000,
          100
        )
        
        // 方法3: 如果还没打开，再次点击并等待更长时间
        if (!dropdown) {
          console.log(`[GreenhouseAutoFill] Dropdown not found, clicking again...`)
          select2Container.click()
          await new Promise((r) => setTimeout(r, 500))
          
          dropdown = await this.waitFor<HTMLElement>(
            () => {
              const allDrops = document.querySelectorAll(".select2-drop")
              for (const drop of allDrops) {
                const style = window.getComputedStyle(drop)
                if (style.display !== "none" && style.visibility !== "hidden") {
                  const inp = drop.querySelector<HTMLInputElement>(".select2-input")
                  if (inp) {
                    return drop as HTMLElement
                  }
                }
              }
              return null
            },
            3000,
            100
          )
        }
        
        // 方法4: 如果还是没打开，尝试直接查找输入框（可能下拉框已经打开但选择器不对）
        let input: HTMLInputElement | null = null
        if (!dropdown) {
          console.log(`[GreenhouseAutoFill] Still no dropdown, searching for input directly...`)
          input = await this.waitFor<HTMLInputElement>(
            () => {
              const allInputs = document.querySelectorAll<HTMLInputElement>(".select2-input")
              for (const inp of allInputs) {
                const style = window.getComputedStyle(inp)
                // 检查输入框是否可见且可编辑
                if (style.display !== "none" && 
                    style.visibility !== "hidden" && 
                    inp.offsetParent !== null &&
                    !inp.disabled &&
                    !inp.readOnly) {
                  // 检查输入框是否在打开的dropdown中
                  const parentDrop = inp.closest(".select2-drop")
                  if (parentDrop) {
                    const dropStyle = window.getComputedStyle(parentDrop)
                    if (dropStyle.display !== "none" && dropStyle.visibility !== "hidden") {
                      console.log(`[GreenhouseAutoFill] ✅ Found input directly:`, inp.id)
                      dropdown = parentDrop as HTMLElement
                      return inp
                    }
                  }
                }
              }
              return null
            },
            3000,
            100
          )
        }
        
        // 如果dropdown找到了但input还没找到，在dropdown中查找
        if (dropdown && !input) {
          console.log(`[GreenhouseAutoFill] ✅ School dropdown opened, looking for input...`)
          input = await this.waitFor<HTMLInputElement>(
            () => {
              const inputs = dropdown.querySelectorAll<HTMLInputElement>(".select2-input")
              for (const inp of inputs) {
                const style = window.getComputedStyle(inp)
                if (style.display !== "none" && style.visibility !== "hidden") {
                  return inp
                }
              }
              return null
            },
            2000,
            100
          )
        }

        if (!input || !dropdown) {
          console.warn(`[GreenhouseAutoFill] ❌ School input or dropdown not found`)
          console.warn(`[GreenhouseAutoFill] dropdown:`, dropdown?.id)
          console.warn(`[GreenhouseAutoFill] input:`, input?.id)
          continue
        }
        
        console.log(`[GreenhouseAutoFill] ✅ School dropdown and input found:`, dropdown.id, input.id)
        
        console.log(`[GreenhouseAutoFill] ✅ School input found: ${input.id}`)
        
        // 聚焦并清空输入框
        input.focus()
        input.value = ""
        await new Promise((r) => setTimeout(r, 200))

        // 逐字符输入，触发Select2的远程搜索
        console.log(`[GreenhouseAutoFill] Typing: "${school}"`)
        for (let i = 0; i < school.length; i++) {
          input.value += school[i]
          input.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }))
          await new Promise((r) => setTimeout(r, 100))
        }
        
        // 触发keyup事件
        input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, cancelable: true }))
        
        console.log(`[GreenhouseAutoFill] ✅ School name entered, waiting for results...`)

        // 等待搜索结果出现（在整个文档中查找，不限于dropdown）
        const resultsUl = await this.waitFor<HTMLElement>(
          () => {
            // 先尝试在dropdown中查找
            let results = dropdown.querySelector(".select2-results")
            
            // 如果没找到，尝试在整个文档中查找所有可见的select2-results
            if (!results) {
              const allResults = document.querySelectorAll(".select2-results")
              for (const res of allResults) {
                const style = window.getComputedStyle(res)
                if (style.display !== "none" && style.visibility !== "hidden") {
                  results = res
                  break
                }
              }
            }
            
            if (!results) return null
            
            const lis = results.querySelectorAll("li")
            const validLis = Array.from(lis).filter(li => {
              const text = (li.textContent || "").trim()
              const classes = li.classList
              const style = window.getComputedStyle(li)
              return text.length > 0 &&
                     !classes.contains("select2-no-results") &&
                     !classes.contains("select2-searching") &&
                     !classes.contains("select2-disabled") &&
                     !text.toLowerCase().includes("searching") &&
                     style.display !== "none"
            })
            
            if (validLis.length > 0) {
              console.log(`[GreenhouseAutoFill] ✅ Found ${validLis.length} School results`)
              return results as HTMLElement
            }
            
            // 检查是否还在搜索中
            const searchingLis = Array.from(lis).filter(li => 
              li.classList.contains("select2-searching") ||
              (li.textContent || "").toLowerCase().includes("searching")
            )
            
            if (searchingLis.length > 0) {
              return null // 还在搜索，继续等待
            }
            
            return null
          },
          20000, // 增加超时时间到20秒
          500 // 增加检查间隔
        )

        if (resultsUl) {
          // 找到最匹配的选项或第一条
          const lis = Array.from(
            resultsUl.querySelectorAll<HTMLElement>("li")
          ).filter(
            (li) =>
              (li.textContent || "").trim().length > 0 &&
              !li.classList.contains("select2-no-results") &&
              !li.classList.contains("select2-searching") &&
              !li.classList.contains("select2-disabled")
          )

          console.log(`[GreenhouseAutoFill] Found ${lis.length} valid School options`)

          if (lis.length > 0) {
            const bestLi = findMatchOption(lis, school) as HTMLElement | null
            const targetLi = bestLi ?? lis[0]
            if (targetLi) {
              console.log(`[GreenhouseAutoFill] ✅ Selecting School: ${targetLi.textContent?.trim()}`)
              targetLi.scrollIntoView({ behavior: "smooth", block: "center" })
              await new Promise((r) => setTimeout(r, 200))
              targetLi.click()
              await new Promise((r) => setTimeout(r, 1000)) // 等待选择完成
              
              // 验证选择是否成功
              const selectedText = select2Container.querySelector(".select2-chosen")?.textContent?.trim()
              if (selectedText && selectedText !== "Select a School" && selectedText !== "--") {
                console.log(`[GreenhouseAutoFill] ✅ School filled successfully: ${selectedText}`)
              } else {
                console.warn(`[GreenhouseAutoFill] ⚠️ School selection may have failed, selected text: "${selectedText}"`)
              }
            } else {
              console.warn(`[GreenhouseAutoFill] ❌ no valid School option found`)
            }
          } else {
            console.warn(`[GreenhouseAutoFill] ❌ School search returned no valid results`)
          }
        } else {
          console.warn(`[GreenhouseAutoFill] ❌ School search results did not appear within timeout`)
        }
      }
    }
  }
}
