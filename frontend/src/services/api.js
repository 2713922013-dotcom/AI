import axios from 'axios'

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  '/api'

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000, // 10秒超时
})

// 请求拦截器 - 添加错误日志
api.interceptors.request.use(
  config => config,
  error => {
    console.warn('API 请求失败:', error.message)
    return Promise.reject(error)
  }
)

// 响应拦截器 - 统一错误处理
api.interceptors.response.use(
  response => response,
  error => {
    console.warn('API 响应错误:', error.code || error.message)
    return Promise.reject(error)
  }
)

/**
 * 上传简历并执行完整分析
 */
export async function analyzeResume(file, targetPosition, targetCity, onProgress) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('target_position', targetPosition)
  formData.append('target_city', targetCity)

  const steps = [
    { label: '正在解析简历...', progress: 10 },
    { label: '正在匹配岗位...', progress: 30 },
    { label: '正在分析技能缺口...', progress: 50 },
    { label: '正在进行ATS评分...', progress: 65 },
    { label: '正在优化简历...', progress: 80 },
    { label: '正在预测Offer概率...', progress: 90 },
    { label: '分析完成！', progress: 100 },
  ]

  let stepIndex = 0
  const progressInterval = setInterval(() => {
    // 大模型推理耗时较长，进度条最多推进到 90%，避免提前跑完让用户以为卡住
    if (stepIndex < steps.length - 1) {
      onProgress?.(steps[stepIndex])
      stepIndex++
    }
  }, 4000)

  try {
    const response = await api.post('/analyze', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      // 大模型串行解析 + 并行推理，正常 15-60s，留足余量
      timeout: 120000,
    })

    clearInterval(progressInterval)
    onProgress?.(steps[steps.length - 1])

    if (response.data.code === 0) {
      const raw = response.data.data
      return transformAnalysisData(raw)
    } else {
      throw new Error(response.data.message || '分析失败')
    }
  } catch (error) {
    clearInterval(progressInterval)
    // 不返回 mock 数据，直接抛出真实错误
    throw error
  }
}


/**
 * 将后端返回的 v3.0 分析数据转换为前端 Dashboard 期望的嵌套格式
 */
function transformAnalysisData(raw) {
  if (!raw) return raw

  const parsed = raw.resume_parsed || {}
  const ats = raw.ats_score || {}
  const offer = raw.offer_prediction || {}
  const gap = raw.skill_gap || {}
  const opt = raw.resume_optimization || {}

  // 计算 ATS 维度数据（兼容数字/对象两种 ats_score，以及 ats_detail 备用结构）
  const atsObj = typeof ats === 'object' ? ats : (raw.ats_detail || {})
  const atsDimensions = (Array.isArray(atsObj.dimensions) ? atsObj.dimensions : []).map(d => ({
    name: d.name,
    score: d.score || 0,
    max_score: d.max || (d.weight || 20),
    weight: d.weight || 20,
  }))

  return {
    session_id: raw.session_id,
    timestamp: raw.timestamp,
    target_position: raw.target_position,
    target_city: raw.target_city,

    // 推理引擎标识（llm = 大模型参与，rule = 纯规则引擎）
    engine: raw.engine || null,

    // 简历解析结果 (Step 1-5)
    resume_parsed: {
      name: parsed.name || '',
      email: parsed.email || '',
      phone: parsed.phone || '',
      school: parsed.school || '',
      major: parsed.major || '',
      education: parsed.education || '--',
      graduation_year: parsed.graduation_year || '',
      gpa: parsed.gpa || '',
      gender: parsed.gender || '',
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      // 新增结构化字段
      education_records: parsed.education_records || [],
      experience_records: parsed.experience_records || [],
      project_records: parsed.project_records || [],
      certifications: parsed.certifications || [],
      awards: parsed.awards || [],
      self_evaluation: parsed.self_evaluation || '',
    },

    // 原始文本（调试用）
    _debug: raw._debug || null,
    resume_raw_text: raw.resume_raw_text || '',
    resume_cleaned_text: raw.resume_cleaned_text || '',

    // ATS评分 (Step 6 - 新5维度格式)
    // 兼容两种结构: ats_score 可能是对象或数字
    ats_score: {
      total_score: typeof ats === 'number' ? ats : (ats.total_score || 0),
      dimensions: atsDimensions,
      keyword_score: atsDimensions[0]?.score || (raw.ats_detail?.dimensions?.[0]?.score || 0),
      project_quality_score: atsDimensions[1]?.score || (raw.ats_detail?.dimensions?.[1]?.score || 0),
      skill_completeness_score: atsDimensions[2]?.score || (raw.ats_detail?.dimensions?.[2]?.score || 0),
      quantification_score: atsDimensions[3]?.score || atsDimensions[4]?.score || (raw.ats_detail?.dimensions?.[3]?.score || 0),
      issues: ats.issues || raw.ats_detail?.issues || [],
      suggestions: ats.suggestions || raw.ats_detail?.suggestions || [],
    },

    // ATS AI 评审（大模型可用时才有值）
    ats_review: raw.ats_review || null,

    // 简历优化 (Step 9)
    resume_optimization: {
      original: opt.original || '',
      optimized: (Array.isArray(opt.optimized_sections) ? opt.optimized_sections.map(s => s.optimized).filter(Boolean).join('\n') : ''),
      optimized_sections: Array.isArray(opt.optimized_sections) ? opt.optimized_sections : [],
      summary: opt.summary || '',
    },

    // Offer预测
    // 兼容两种结构: offer_prediction 嵌套对象，或 interview_probability/offer_probability 在顶层
    offer_prediction: {
      interview_probability: offer.interview_probability ?? raw.interview_probability ?? 0,
      offer_probability: offer.offer_probability ?? raw.offer_probability ?? 0,
      competitiveness_score: offer.competitiveness_score || 0,
      radar_data: offer.radar_data || [],
      strengths: offer.strengths || raw.strengths || [],
      weaknesses: offer.weaknesses || raw.weaknesses || [],
      growth_advice: offer.growth_advice || raw.recommendations || [],
      interview_focus: offer.interview_focus || [],
      reasoning: offer.reasoning || '',
      key_factors: offer.key_factors || [],
      analysis: offer.analysis || null,
    },

    // 技能缺口 (Step 8 - 新结构)
    skill_gap: {
      current_skills: gap.current_skills || gap.existing_skills || parsed.skills || [],
      matched_skills: gap.matched_skills || [],
      missing_skills: Array.isArray(gap.missing_skills)
        ? gap.missing_skills.map(m => typeof m === 'string' ? m : m.name)
        : [],
      missing_detailed: Array.isArray(gap.missing_skills) ? gap.missing_skills.filter(m => typeof m === 'object') : [],
      learning_path: gap.learning_paths || (gap.missing_skills || [])
        .filter(m => typeof m === 'object')
        .map(m => ({
          skill: m.name, priority: m.importance || '中',
          resources: [m.learning_path].filter(Boolean), estimated_time: '2-4周', project_suggestion: m.learning_path || ''
        })),
      recommended_skills: gap.recommended_skills || [],
      target_skills: gap.target_skills_for_position ? [gap.target_skills_for_position] : [],
      stats: gap.stats || {},
    },

    // 匹配岗位 (Step 7 - 含字段级匹配详情)
    matched_jobs: (raw.matched_jobs || []).map(job => ({
      ...job,
      match_score: job.match_score || 0,
      match_reason: job.match_reason || '',
      matched_skills: Array.isArray(job.matched_skills) ? job.matched_skills : [],
      missing_skills: Array.isArray(job.missing_skills) ? job.missing_skills : [],
      salary_range: `${job.salary_min || ''}-${job.salary_max || ''}K`,
    })),

    execution_flow: raw.execution_flow || [],

    // 能力提升计划 (Step 10)
    improvement_plan: raw.improvement_plan || null,

    _raw: raw,
  }
}

/**
 * 生成面试题单
 * @param {{target_position: string, parsed: object, jd_text?: string}} payload
 */
export async function buildInterviewPlan(payload) {
  const response = await api.post('/interview/plan', payload, { timeout: 15000 })
  if (response.data?.code !== 0) {
    throw new Error(response.data?.message || '题单生成失败')
  }
  return response.data.data
}

/**
 * 给单题作答打分
 * @param {{question: object, answer: string}} payload
 */
export async function scoreInterviewAnswer(payload) {
  const response = await api.post('/interview/answer', payload, { timeout: 15000 })
  if (response.data?.code !== 0) {
    throw new Error(response.data?.message || '评分失败')
  }
  return response.data.data
}

/**
 * 获取岗位列表
 *
 * 失败时直接抛错，不再回退到本地假数据。
 * 之前后端一挂，页面会静默显示 1340 条凭空生成的岗位，
 * 用户以为看到的是真数据 —— 这比报错危险得多。
 */
export async function getJobs(position = '', city = '', limit = 1000) {
  const response = await api.get('/jobs', {
    params: { position, city, limit },
    timeout: 15000,
  })
  const data = response.data
  if (data && Array.isArray(data.data)) return data
  if (Array.isArray(data)) {
    return { code: 0, data, total: data.length, message: 'ok', stale: 0 }
  }
  throw new Error('岗位数据格式异常，请稍后重试')
}

/**
 * 解析 JD 原文，不入库。用于导入弹窗的「识别」步骤。
 */
export async function parseJD(rawText) {
  const response = await api.post('/jobs/parse', { raw_text: rawText }, { timeout: 15000 })
  return response.data
}

/**
 * 导入岗位。payload 可只带 raw_text，也可带用户校对过的完整字段。
 */
export async function importJob(payload) {
  const response = await api.post('/jobs/import', payload, { timeout: 15000 })
  return response.data
}

/**
 * 删除岗位（仅限自己导入的，预置核验岗位受保护）
 */
export async function deleteJob(jobId) {
  const response = await api.delete(`/jobs/${jobId}`, { timeout: 10000 })
  return response.data
}


/**
 * 获取分析历史
 */
export async function getHistory(limit = 20) {
  const response = await api.get('/history', { params: { limit } })
  return response.data
}

/**
 * 获取分析详情
 */
export async function getAnalysisDetail(sessionId) {
  const response = await api.get(`/history/${sessionId}`)
  return response.data
}

/**
 * 获取平台统计数据（岗位数、行业、城市等）
 */
export async function getStats() {
  try {
    const response = await api.get('/stats', { timeout: 5000 })
    const data = response.data
    if (data && data.code === 0 && data.data) {
      return data
    }
    // fallback
    return { code: 0, data: { total_jobs: 1020, industries_count: 20, cities_count: 27 }, message: 'ok' }
  } catch (error) {
    return { code: 0, data: { total_jobs: 1020, industries_count: 20, cities_count: 27 }, message: 'ok (mock)' }
  }
}

/**
 * 最小安全 fallback 数据（确保 Dashboard 不会崩溃）
 */
function getSafeFallbackData(fileName, targetPosition, targetCity) {
  return transformAnalysisData({
    session_id: 'safe-' + Date.now(),
    timestamp: new Date().toISOString(),
    engine_version: '3.0.0 (safe-fallback)',
    resume_text: `[模拟简历] ${fileName}`,
    target_position: targetPosition,
    target_city: targetCity,
    _debug: { extraction_method: 'fallback', section_count: 0, sections_detected: [] },
    resume_parsed: {
      name: '', email: '', phone: '',
      school: '--', major: '--', education: '--',
      graduation_year: '--', gpa: '', gender: '',
      skills: ['Python', 'SQL', '数据分析'],
      education_records: [], experience_records: [],
      project_records: [], certifications: [], awards: [],
      self_evaluation: '',
    },
    resume_raw_text: `[模拟简历] ${fileName}`,
    resume_cleaned_text: '',
    resume_skills: ['Python', 'SQL', '数据分析'],
    matched_jobs: [],
    ats_score: { total_score: 65, dimensions: [
      { name: '关键词匹配', score: 25, max: 40, weight: 40 },
      { name: '经验质量', score: 16, max: 25, weight: 25 },
      { name: '项目相关', score: 12, max: 20, weight: 20 },
      { name: '学历匹配', score: 8, max: 10, weight: 10 },
      { name: '格式完整', score: 4, max: 5, weight: 5 },
    ], issues: [], suggestions: [] },
    interview_probability: 50,
    offer_probability: 35,
    radar_data: [{ name: '学历匹配', score: 70 }, { name: '技能匹配', score: 60 }, { name: '项目经验', score: 55 }, { name: '实习经历', score: 40 }, { name: '行业竞争力', score: 50 }],
    skill_gap: { existing_skills: ['Python', 'SQL'], missing_skills: [], target_skills: [] },
    strengths: ['有基础技术能力'],
    weaknesses: ['缺少实战项目经验'],
    recommendations: ['建议补充项目经验'],
    execution_flow: [],
    ats_detail: { total: 65, max: 100, dimensions: [{ name: '关键词匹配', score: 60, max: 30 }, { name: '项目质量', score: 70, max: 25 }, { name: '技能完整度', score: 65, max: 25 }, { name: '成果量化', score: 70, max: 20 }], issues: [], suggestions: [] },
    resume_optimization: { original: '', optimized_sections: [] },
  })
}

export default api

/* ============================================================
   岗位关键词联想表（仅用于首页输入框补全）
   注意：这些是搜索建议词，不是岗位数据。
   真实岗位数据一律来自后端 /api/jobs，页面不再内置任何假岗位。
   ============================================================ */

/** 所有可用岗位标题（从岗位数据库提取） */
export const JOB_TITLES = [
  '后端开发工程师', '前端开发工程师', '数据分析师', '算法工程师-推荐系统', '算法工程师-NLP',
  '算法工程师-CV方向', '算法工程师-大模型方向', '产品经理', '测试开发工程师', 'Android开发工程师',
  'iOS开发工程师', '游戏客户端开发工程师',
  // 游戏策划系列
  '游戏策划-系统方向', '游戏策划-关卡方向', '游戏策划-数值方向',
  '游戏策划-剧情方向', '游戏策划-文案方向', '游戏策划-战斗方向',
  '游戏策划-主策划', '游戏策划-执行策划',
  // 运营系列
  '游戏运营', '用户运营', '内容运营', '活动运营', '电商运营', '品牌策划',
  // 技术/工程
  '数据开发工程师', '运维开发工程师', 'SRE工程师', '安全工程师',
  '嵌入式软件工程师', 'FPGA开发工程师', '云计算开发工程师', '存储系统开发工程师',
  '医学影像算法工程师', '数字IC设计工程师', '5G协议栈工程师',
  'BMS算法工程师', '区块链开发工程师', '供应链算法工程师',
]

/** 所有可用城市（从岗位数据库提取） */
export const JOB_CITIES = [
  '北京', '上海', '深圳', '杭州', '广州', '成都', '南京', '武汉', '西安', '合肥',
  '苏州', '厦门', '长沙', '重庆', '天津', '青岛', '济南', '郑州', '东莞', '佛山',
]

/** 热门搜索词（展示在输入框下方作为快捷标签） */
export const HOT_POSITIONS = [
  '游戏策划', '前端开发', '后端开发', '算法工程师',
  '产品经理', '数据分析', '测试开发', '运营',
]

export const HOT_CITIES = [
  '北京', '上海', '深圳', '杭州', '广州',
]
