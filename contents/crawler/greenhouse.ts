import dayjs from "dayjs"
import type { PlasmoCSConfig } from "plasmo"

import type { Education, WorkExperienceItem } from "~core/types"

import { executeSequentially, type ExecutableFunction } from "./utils/executor"
import { getLabelText, removeSpecialCharacters } from "./utils"

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
type MockItem = { name: string; value: string | string[] } | { Education: any[] }

const MOCK_DATA: Record<string, MockItem[]> = {
  "4327952003": [
    { name: "LinkedIn Profile", value: "https://www.linkedin.com/in/sean-dickson-91408/" },
    { name: "Website", value: "https://www.baidu.com" },
    {
      name: "Why Kalshi?",
      value:
        "I am passionate about product growth and innovation, and I believe Kalshi's mission aligns with my experience in managing product operations and driving growth strategies."
    },
    {
      name: "Do you live in New York City? This role requires 3-4 days a week in office.",
      value: "Yes"
    },
    {
      name: "Are you legally authorized to work in the United States?",
      value: ["Yes"]
    },
    {
      name: "Will you now or in the future require sponsorship for employment visa status (e.g., H-1B visa status)?",
      value: ["Yes"]
    },
    { name: "First Name", value: "Daniel" },
    { name: "Last Name", value: "Wang" },
    { name: "Email", value: "test@test.com" },
    { name: "Phone", value: "4123333333" },
    {
      Education: [
        {
          Degree: "Master's Degree",
          Discipline: ["Communications & Film"],
          School: "San Jose State University",
          Start: "2014-01-01",
          End: "2015-01-01",
          isCurrent: false
        },
        {
          Degree: "Bachelor's Degree",
          Discipline: ["Chemistry"],
          School: "Purdue University - Calumet",
          Start: "2024-02-16",
          End: "2025-02-16",
          isCurrent: false,
          gpa: "4.5/5.0"
        }
      ]
    }
  ],
  "6909295": [
    { name: "In which country do you currently work?", value: ["United States of America - New York"] },
    { name: "How did you perform in your native language at high school?", value: ["Top 10% at school"] },
    {
      name: "Describe your engineering experience with Python and/or Golang",
      value:
        "I have extensive experience in Python, having led teams in developing backend processes for applications, including integrating CI/CD best practices and optimizing system performance for real-time data processing. My role as a Product Manager involved overseeing the design and implementation of Python-driven systems, ensuring code quality and maintainability through rigorous code reviews."
    },
    {
      name:
        "In the past ten years, looking only at the time since you graduated your first undergraduate degree, how many companies have you worked for?",
      value: ["3"]
    },
    { name: "How did you perform in mathematics at high school?", value: ["Top 10% at school"] },
    {
      name: "Describe your software engineering leadership experience.",
      value:
        "As a Product Manager at Cider and Alibaba Group, I led cross-functional teams in designing and developing software products, focusing on integrating best practices in CI/CD and ensuring code quality through regular code reviews. My experience includes overseeing technical design reviews and fostering collaboration between product and engineering teams to enhance user experience."
    },
    {
      name:
        "What was your bachelor's university degree result, or expected result if you have not yet graduated? Please include the grading system to help us understand your result e.g. ‘85 out of 100’, ‘2:1 (Grading system: first class, 2:1, 2:2, third class)’ or ‘GPA score of 3.8/4.0 (predicted)’. We have hired outstanding individuals who did not attend or complete university. If this describes you, please continue with your application and enter ‘no degree’.",
      value: "GPA score of 3.86/4.0 (Stanford University)"
    },
    {
      name:
        "During this application process I agree to use only my own words. I understand that plagiarism, the use of AI or other generated content will disqualify my application.",
      value: ["Yes"]
    },
    {
      name: "Describe your experience with workflow engines and CI/CD",
      value:
        "I have coordinated the analysis, design, and delivery of product features with a focus on integrating CI/CD best practices to maintain system efficiency. My experience includes leading code reviews and ensuring code quality, as well as testing and maintaining deployed software to optimize performance."
    },
    {
      name:
        "We require all colleagues to meet in person 2-4 times a year, at internal company events lasting between 1-2 weeks. We try to pick new and interesting locations that will likely require international travel and entry requirement visas and vaccinations. Are you willing and able to commit to this?",
      value: ["No"]
    },
    {
      name: "Please confirm that you have read and agree to Canonical's Recruitment Privacy Notice and Privacy Policy.",
      value: ["Acknowledge/Confirm"]
    },
    { name: "Website", value: "Other" },
    {
      name:
        "Please share your rationale or evidence for the high school performance selections above. Make reference to  provincial, state or nation-wide scoring systems, rankings, or recognition awards, or to competitive or selective college entrance results such as SAT or ACT scores, JAMB, matriculation results, IB results etc. We recognise every system is different but we will ask you to justify your selections above.",
      value:
        "I graduated high school with a strong academic record, consistently achieving high grades across all subjects. I participated in various competitive exams and was recognized for my performance in state-level mathematics competitions. My SAT scores were above the national average, reflecting my readiness for college-level coursework."
    },
    {
      name: "Describe your experience with AWS, Azure and GCP, using VM level operations, and at what scale",
      value:
        "I have hands-on experience with AWS, Azure, and GCP, primarily focusing on VM-level operations. At Cider, I managed cloud infrastructure for product deployments, utilizing AWS EC2 instances to scale applications based on user demand. I have worked with Azure for data analytics projects, deploying VMs to process large datasets, and have utilized GCP for machine learning model training, handling workloads that scaled to hundreds of instances during peak processing times."
    },
    { name: "First Name", value: "Daniel" },
    { name: "Last Name", value: "Wang" },
    { name: "Email", value: "badwzc@qq.com" },
    { name: "Phone", value: "4255550100" },
    { name: "LinkedIn Profile", value: "https://www.linkedin.com/in/sean-dickson-91408/" },
    { name: "Which gender do you identify as?", value: ["Male"] },
    {
      Education: [
        {
          Degree: "Master's Degree",
          Discipline: ["Communications & Film"],
          School: "San Jose State University",
          Start: "2014-01-01",
          End: "2015-01-01",
          isCurrent: false
        },
        {
          Degree: "Bachelor's Degree",
          Discipline: ["Chemistry"],
          School: "Purdue University - Calumet",
          Start: "2024-02-16",
          End: "2025-02-16",
          isCurrent: false,
          gpa: "4.5/5.0"
        }
      ]
    }
  ]
}

export class GreenhouseAutoFill {
  formRules: TRule[] = []
  filledFields = new Set<string>()
  missingFields = new Set<string>()
  private mockValueMap = new Map<string, string | string[]>()
  private educationData: Education[] = []

  extractFields(): TRule[] {
    // TODO: 1. 实现提取字段的包含要求1里面的信息
    const result: TRule[] = []
    const form = document.querySelector<HTMLFormElement>("#application_form")
    if (!form) {
      console.warn("Greenhouse form not found.")
      this.formRules = []
      return []
    }

    // 提取基础字段（First Name, Last Name, Email, Phone）
    const baseFields = [
      { id: "first_name", label: "First Name" },
      { id: "last_name", label: "Last Name" },
      { id: "email", label: "Email" },
      { id: "phone", label: "Phone" }
    ]
    baseFields.forEach(({ id, label }) => {
      const element = form.querySelector<HTMLInputElement>(`#${id}`)
      if (element) {
        result.push({ label, type: "text" })
      }
    })

    const fields = Array.from(form.querySelectorAll<HTMLElement>(".field"))
    fields.forEach((field) => {
      if (
        field.closest("#dev-fields") ||
        field.closest("#security_code_fields") ||
        field.closest("#captcha_container")
      ) {
        return
      }

      if (field.closest("#education_section") || field.closest(".education-template")) {
        return
      }

      const labelElement = field.querySelector("label")
      if (!labelElement) return
      const labelText = getLabelText(labelElement)
      if (!labelText) return

      // 跳过基础字段（已单独处理）
      if (["First Name", "Last Name", "Email", "Phone"].includes(labelText)) {
        return
      }

      // 优先查找 select 元素（包括隐藏的 Select2）
      const selectElement = field.querySelector("select")
      const textareaElement = field.querySelector("textarea")
      const inputElement = field.querySelector<HTMLInputElement>(
        "input:not([type='hidden']):not([type='file']):not([type='checkbox']):not([type='radio'])"
      )

      if (selectElement) {
        const options = Array.from(selectElement.options)
          .map((option) => option.textContent?.trim())
          .filter((option): option is string => Boolean(option))
        result.push({ label: labelText, type: "select", options })
        return
      }

      if (textareaElement || inputElement) {
        result.push({ label: labelText, type: "text" })
      }
    })

    if (document.querySelector("#education_section")) {
      result.push({ label: "Education", type: "education" })
    }

    this.formRules = result
    console.info("Greenhouse extracted fields:", result)
    return result
  }

  async fillForm() {
    // TODO: 2. 结合extractFields 将 mock 数据填入到页面中
    // 实现 getFormElementExecutor 方法 生成每条执行的action
    this.extractFields()
    this.loadMockData()
    const sequenceFuncCollector: ExecutableFunction[] = []
    for (let rule of this.formRules) {
      const action = this.getFormElementExecutor(rule)
      const actions = Array.isArray(action) ? action : [action]
      sequenceFuncCollector.push(...actions)
    }

    await executeSequentially(...sequenceFuncCollector)
    this.handleFilledInfo()
  }

  getFormElementExecutor(rule: TRule): ExecutableFunction[] {
    if (rule.type === "education") {
      if (this.educationData.length > 0) {
        this.filledFields.add(rule.label)
        return [{ func: () => this.fillEducation() }]
      }
      this.missingFields.add(rule.label)
      return []
    }

    const value = this.getMockValue(rule.label)
    if (!value) {
      this.missingFields.add(rule.label)
      return []
    }

    this.filledFields.add(rule.label)
    
    // 处理基础字段（直接通过 ID 查找）
    const baseFieldMap: Record<string, string> = {
      "First Name": "first_name",
      "Last Name": "last_name",
      "Email": "email",
      "Phone": "phone"
    }
    
    if (baseFieldMap[rule.label]) {
      return [
        {
          func: () => {
            const element = document.querySelector<HTMLInputElement>(`#${baseFieldMap[rule.label]}`)
            if (element) {
              this.fillInputTextField(element, value)
            }
          }
        }
      ]
    }
    
    if (rule.type === "select") {
      return [
        {
          func: () => {
            const selectElement = this.findFieldSelect(rule.label)
            if (selectElement) {
              this.fillSelectField(selectElement, value)
            }
          }
        }
      ]
    }

    return [
      {
        func: () => {
          const inputElement = this.findFieldInput(rule.label)
          if (inputElement) {
            this.fillInputTextField(inputElement, value)
          }
        }
      }
    ]
  }

  handleFilledInfo() {
    // TODO: 3. 统计完成情况
    const filled = Array.from(this.filledFields)
    const missing = Array.from(this.missingFields)
    console.info("Greenhouse fill summary:", {
      filledCount: filled.length,
      missingCount: missing.length,
      filledFields: filled,
      missingFields: missing
    })
  }

  // 填充时需要的一些基础方法
  fillInputTextField = async (
    element: HTMLInputElement | HTMLTextAreaElement,
    value: string | string[]
  ) => {
    // TODO: 实现填充输入文本字段的函数
    const resolvedValue = Array.isArray(value) ? value[0] : value
    if (!resolvedValue) return
    element.focus()
    element.value = resolvedValue
    element.dispatchEvent(new Event("input", { bubbles: true }))
    element.dispatchEvent(new Event("change", { bubbles: true }))
    element.dispatchEvent(new Event("blur", { bubbles: true }))
  }

  fillSelectField = async (element: HTMLSelectElement, value: string | string[]) => {
    const resolvedValue = Array.isArray(value) ? value[0] : value
    if (!resolvedValue) return

    const normalizedValue = this.normalizeLabel(resolvedValue)
    const options = Array.from(element.options)
    
    // 多种匹配策略
    let matchedOption = options.find(
      (option) => this.normalizeLabel(option.textContent || "") === normalizedValue
    )
    
    if (!matchedOption) {
      matchedOption = options.find((option) =>
        this.normalizeLabel(option.textContent || "").includes(normalizedValue)
      )
    }
    
    if (!matchedOption) {
      matchedOption = options.find((option) =>
        normalizedValue.includes(this.normalizeLabel(option.textContent || ""))
      )
    }
    
    // 处理 Yes/No 到 1/0 的转换
    if (!matchedOption && (normalizedValue === "yes" || normalizedValue === "no")) {
      const boolValue = normalizedValue === "yes" ? "1" : "0"
      matchedOption = options.find((option) => option.value === boolValue)
    }
    
    // 处理 Acknowledge/Confirm
    if (!matchedOption && (normalizedValue.includes("acknowledge") || normalizedValue.includes("confirm"))) {
      matchedOption = options.find((option) =>
        this.normalizeLabel(option.textContent || "").includes("acknowledge") ||
        this.normalizeLabel(option.textContent || "").includes("confirm")
      )
    }

    if (!matchedOption) {
      console.warn(`No match found for select field with value: ${resolvedValue}`)
      return
    }

    element.value = matchedOption.value
    element.dispatchEvent(new Event("input", { bubbles: true }))
    element.dispatchEvent(new Event("change", { bubbles: true }))
    element.dispatchEvent(new Event("blur", { bubbles: true }))
    
    // 如果存在 Select2 容器，触发 Select2 更新
    const select2Container = element.closest(".field")?.querySelector(".select2-container")
    if (select2Container && (window as any).jQuery) {
      try {
        (window as any).jQuery(element).trigger("change")
      } catch (e) {
        // 忽略 jQuery 错误
      }
    }
  }

  async fillEducation() {
    // TODO: 实现填充教育信息的函数
    if (this.educationData.length === 0) return

    const addButton = document.querySelector<HTMLAnchorElement>("#add_education")
    const ensureEducationSlots = (count: number) => {
      const currentSlots = document.querySelectorAll(
        "#education_section .education:not(.education-template)"
      ).length
      for (let i = currentSlots; i < count; i += 1) {
        addButton?.click()
      }
    }

    ensureEducationSlots(this.educationData.length)

    const educationBlocks = Array.from(
      document.querySelectorAll<HTMLElement>("#education_section .education:not(.education-template)")
    )

    for (let index = 0; index < this.educationData.length; index++) {
      const item = this.educationData[index]
      const block = educationBlocks[index]
      if (!block) continue

      // 处理 School 字段（Select2 远程搜索）
      if (item.school) {
        const schoolInput = block.querySelector<HTMLInputElement>("input.school-name")
        const select2Container = block.querySelector<HTMLElement>(".select2-container.school-name")
        
        if (select2Container && schoolInput) {
          // 点击 Select2 容器打开下拉框
          const anchor = select2Container.querySelector<HTMLElement>("a.select2-choice")
          if (anchor) {
            anchor.click()
            await new Promise((resolve) => setTimeout(resolve, 500))
            
            // 查找搜索输入框
            const searchInput = document.querySelector<HTMLInputElement>(
              `.select2-drop:not(.select2-display-none) .select2-input`
            )
            
            if (searchInput) {
              // 输入学校名称
              searchInput.value = item.school
              searchInput.focus()
              
              // 触发各种事件以触发远程搜索
              searchInput.dispatchEvent(new Event("input", { bubbles: true }))
              searchInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
              searchInput.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", bubbles: true }))
              
              // 等待搜索结果出现
              await new Promise((resolve) => setTimeout(resolve, 1500))
              
              // 查找匹配的结果
              const results = document.querySelectorAll<HTMLElement>(
                `.select2-drop:not(.select2-display-none) .select2-results li:not(.select2-no-results):not(.select2-searching)`
              )
              
              let matchedResult: HTMLElement | null = null
              const normalizedSchool = this.normalizeLabel(item.school)
              
              for (const result of Array.from(results)) {
                const text = result.textContent?.trim() || ""
                if (
                  this.normalizeLabel(text) === normalizedSchool ||
                  this.normalizeLabel(text).includes(normalizedSchool) ||
                  normalizedSchool.includes(this.normalizeLabel(text))
                ) {
                  matchedResult = result
                  break
                }
              }
              
              if (matchedResult) {
                matchedResult.click()
                await new Promise((resolve) => setTimeout(resolve, 300))
              } else {
                console.warn(`School search result not found for: ${item.school}`)
              }
            }
          }
        } else if (schoolInput) {
          // 回退方案：直接设置值
          schoolInput.value = item.school
          schoolInput.dispatchEvent(new Event("input", { bubbles: true }))
          schoolInput.dispatchEvent(new Event("change", { bubbles: true }))
        }
      }

      // 处理 Degree
      const degreeSelect = block.querySelector<HTMLSelectElement>("select.degree")
      if (degreeSelect && item.degree) {
        await this.fillSelectField(degreeSelect, item.degree)
        await new Promise((resolve) => setTimeout(resolve, 200))
      }

      // 处理 Discipline
      const disciplineSelect = block.querySelector<HTMLSelectElement>("select.discipline")
      if (disciplineSelect && item.discipline) {
        await this.fillSelectField(disciplineSelect, item.discipline)
        await new Promise((resolve) => setTimeout(resolve, 200))
      }

      // 处理 Start Date
      if (item.start) {
        const startDate = dayjs(item.start)
        const startMonth = block.querySelector<HTMLInputElement>("input.start-date-month")
        const startYear = block.querySelector<HTMLInputElement>("input.start-date-year")
        if (startMonth) {
          startMonth.value = startDate.format("MM")
          startMonth.dispatchEvent(new Event("input", { bubbles: true }))
          startMonth.dispatchEvent(new Event("change", { bubbles: true }))
        }
        if (startYear) {
          startYear.value = startDate.format("YYYY")
          startYear.dispatchEvent(new Event("input", { bubbles: true }))
          startYear.dispatchEvent(new Event("change", { bubbles: true }))
        }
      }

      // 处理 End Date
      if (item.end) {
        const endDate = dayjs(item.end)
        const endMonth = block.querySelector<HTMLInputElement>("input.end-date-month")
        const endYear = block.querySelector<HTMLInputElement>("input.end-date-year")
        if (endMonth) {
          endMonth.value = endDate.format("MM")
          endMonth.dispatchEvent(new Event("input", { bubbles: true }))
          endMonth.dispatchEvent(new Event("change", { bubbles: true }))
        }
        if (endYear) {
          endYear.value = endDate.format("YYYY")
          endYear.dispatchEvent(new Event("input", { bubbles: true }))
          endYear.dispatchEvent(new Event("change", { bubbles: true }))
        }
      }
      
      // 每个教育项之间添加延迟
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }

  private loadMockData() {
    if (this.mockValueMap.size > 0 || this.educationData.length > 0) return
    const token = this.getToken()
    const dataset = MOCK_DATA[token] || []
    dataset.forEach((item) => {
      if ("name" in item) {
        this.mockValueMap.set(this.normalizeLabel(item.name), item.value)
      } else if ("Education" in item) {
        this.educationData = item.Education.map((education) => ({
          school: education.School || "",
          degree: education.Degree || "",
          discipline: Array.isArray(education.Discipline)
            ? education.Discipline[0]
            : education.Discipline || "",
          start: education.Start || "",
          end: education.End || ""
        }))
      }
    })
  }

  private getToken(): string {
    const url = new URL(window.location.href)
    const tokenFromQuery = url.searchParams.get("token")
    if (tokenFromQuery) return tokenFromQuery
    const action = document.querySelector<HTMLFormElement>("#application_form")?.getAttribute("action")
    const match = action?.match(/jobs\/(\d+)/)
    return match?.[1] || ""
  }

  private getMockValue(label: string): string | string[] | null {
    const normalizedLabel = this.normalizeLabel(label)
    return this.mockValueMap.get(normalizedLabel) || null
  }

  private normalizeLabel(label: string): string {
    const cleaned = removeSpecialCharacters(label || "").toLowerCase()
    return cleaned.replace(/\s+/g, " ").trim()
  }

  private findFieldInput(label: string): HTMLInputElement | HTMLTextAreaElement | null {
    const labelElement = this.findLabelElement(label)
    if (!labelElement) return null
    const field = labelElement.closest(".field")
    if (!field) return null
    return (
      field.querySelector("textarea") ||
      field.querySelector<HTMLInputElement>(
        "input:not([type='hidden']):not([type='file']):not([type='checkbox']):not([type='radio'])"
      )
    )
  }

  private findFieldSelect(label: string): HTMLSelectElement | null {
    const labelElement = this.findLabelElement(label)
    if (!labelElement) return null
    const field = labelElement.closest(".field")
    return field?.querySelector("select") || null
  }

  private findLabelElement(label: string): HTMLLabelElement | null {
    const normalizedLabel = this.normalizeLabel(label)
    const labels = Array.from(document.querySelectorAll<HTMLLabelElement>("#application_form label"))
    return (
      labels.find((labelElement) => this.normalizeLabel(getLabelText(labelElement)) === normalizedLabel) ||
      null
    )
  }
}