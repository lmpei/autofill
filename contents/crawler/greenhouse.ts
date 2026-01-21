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
  formRules: TRule[]
  formRules: TRule[] = []
  filledFields = new Set<string>()
  missingFields = new Set<string>()
  private mockValueMap = new Map<string, string | string[]>()
  private educationData: Education[] = []

  extractFields(): TRule[] {
    // TODO: 1. 实现提取字段的包含要求1里面的信息
    const result: TRule[] = []
    this.formRules = []
    return []
    const form = document.querySelector<HTMLFormElement>("#application_form")
    if (!form) {
      console.warn("Greenhouse form not found.")
      this.formRules = []
      return []
    }

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
    const sequenceFuncCollector = []
    this.extractFields()
    this.loadMockData()
    const sequenceFuncCollector: ExecutableFunction[] = []
    for (let rule of this.formRules) {
      const action = this.getFormElementExecutor(rule)
      const actions = Array.isArray(action) ? action : [action]
      sequenceFuncCollector.push(...actions)
      actions.filter(Boolean).forEach((item) => sequenceFuncCollector.push(item))
    }

    await executeSequentially(...sequenceFuncCollector)
    this.handleFilledInfo()
  }

  getFormElementExecutor(rule: TRule): ExecutableFunction[] {
    return []
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
    element: HTMLInputElement | HTMLTextAreaElement
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
  }

  fillSelectField = async (element: HTMLSelectElement) => {
  fillSelectField = async (element: HTMLSelectElement, value: string | string[]) => {
    // TODO: 实现填充输入文本字段的函数
    const resolvedValue = Array.isArray(value) ? value[0] : value
    if (!resolvedValue) return
    const normalizedValue = this.normalizeLabel(resolvedValue)
    const options = Array.from(element.options)
    const matchedOption =
      options.find((option) => this.normalizeLabel(option.textContent || "") === normalizedValue) ||
      options.find((option) =>
        this.normalizeLabel(option.textContent || "").includes(normalizedValue)
      ) ||
      options.find((option) =>
        normalizedValue.includes(this.normalizeLabel(option.textContent || ""))
      )
    if (matchedOption) {
      element.value = matchedOption.value
      element.dispatchEvent(new Event("change", { bubbles: true }))
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

    this.educationData.forEach((item, index) => {
      const block = educationBlocks[index]
      if (!block) return

      const schoolInput = block.querySelector<HTMLInputElement>("input.school-name")
      if (schoolInput && item.school) {
        schoolInput.value = item.school
        schoolInput.dispatchEvent(new Event("change", { bubbles: true }))
        const chosen = block.querySelector<HTMLElement>(".select2-chosen")
        if (chosen) {
          chosen.textContent = item.school
        }
      }

      const degreeSelect = block.querySelector<HTMLSelectElement>("select.degree")
      if (degreeSelect && item.degree) {
        this.fillSelectField(degreeSelect, item.degree)
      }

      const disciplineSelect = block.querySelector<HTMLSelectElement>("select.discipline")
      if (disciplineSelect && item.discipline) {
        this.fillSelectField(disciplineSelect, item.discipline)
      }

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
    })
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