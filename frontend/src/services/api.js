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
    if (stepIndex < steps.length) {
      onProgress?.(steps[stepIndex])
      stepIndex++
    }
  }, 1500)

  try {
    const response = await api.post('/analyze', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
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
 * 生成本地模拟分析数据（后端不可用时的fallback）
 * 从岗位数据库 JOB_TITLES/JOB_PROFILES 中提取，智能匹配目标岗位
 */
function generateMockAnalysis(fileName, targetPosition, targetCity) {
  const uuid = 'mock-' + Date.now()

  // ---- 1. 从岗位数据库获取所有真实数据 ----
  // getMockJobs() 包含 1340+ 条岗位（含 320 条上海游戏策划岗位）
  const posLower = (targetPosition || '').toLowerCase()
  const cityLower = (targetCity || '').toLowerCase()
  const jobsResponse = getMockJobs()
  const allJobs = jobsResponse.data || []

  // ---- 2. 按目标岗位和目标城市过滤 ----
  const posKeywords = posLower ? posLower.split('-').filter(k => k.length >= 2) : []

  let matchedJobs = allJobs.filter(job => {
    if (cityLower && (job.city || '').toLowerCase() !== cityLower) return false
    if (posLower) {
      const titleL = (job.title || '').toLowerCase()
      if (titleL === posLower || titleL.includes(posLower)) return true
      for (const kw of posKeywords) {
        if (titleL.includes(kw)) return true
      }
      return false
    }
    return true
  })

  // ---- 3. 按标题匹配度排序 ----
  matchedJobs.sort((a, b) => {
    const aT = (a.title || '').toLowerCase(), bT = (b.title || '').toLowerCase()
    let as = 0, bs = 0
    if (posLower) {
      if (aT === posLower) as += 100; else if (aT.includes(posLower)) as += 80
      if (bT === posLower) bs += 100; else if (bT.includes(posLower)) bs += 80
      for (const kw of posKeywords) {
        if (aT.includes(kw)) as += 20; if (bT.includes(kw)) bs += 20
      }
    }
    return bs - as
  })
  matchedJobs = matchedJobs.slice(0, 30)

  // ---- 4. 转换为分析格式 ----
  const userSkills = ['Python', '内容运营', '数据分析', '新媒体运营', '活动策划', '用户运营']
  const analysisMatched = matchedJobs.map((job, i) => {
    let jdSkills = []
    if (typeof job.skills_required === 'string') {
      try { jdSkills = JSON.parse(job.skills_required) || [] } catch { jdSkills = job.skills_required.split(/[,，]/).map(s => s.trim()) }
    } else if (Array.isArray(job.skills_required)) {
      jdSkills = job.skills_required
    }
    const matchedSkills = userSkills.filter(s => jdSkills.some(js => js.toLowerCase().includes(s.toLowerCase())))
    const missingSkills = jdSkills.filter(js => !userSkills.some(s => js.toLowerCase().includes(s.toLowerCase())))
    const matchScore = Math.min(98, 55 + matchedSkills.length * 8 + (i < 5 ? 10 : 0))
    return {
      id: job.id || 9000 + i, title: job.title, company: job.company, city: job.city,
      description: job.description || '',
      skills_required: jdSkills,
      education_required: job.education_required || '本科',
      salary_min: job.salary_min, salary_max: job.salary_max,
      industry: job.industry || '',
      experience_required: job.experience_required || '',
      match_score: matchScore,
      match_reason: matchedSkills.length > 0
        ? `技能匹配(${matchedSkills.length}项): ${matchedSkills.join('、')}`
        : '岗位方向匹配',
      matched_skills: matchedSkills.slice(0, 3),
      missing_skills: missingSkills.slice(0, 5),
    }
  })

  // ---- 5. 构建完整分析数据 ----
  const major = posLower.includes('策划') ? '数字媒体技术/游戏设计'
    : posLower.includes('数据') ? '数据科学与大数据技术'
    : posLower.includes('前端') ? '软件工程'
    : '计算机科学与技术'

  const isGame = posLower.includes('策划') || posLower.includes('游戏')
  const atsTotal = (isGame ? 68 : 72) + Math.floor(Math.random() * 8)

  const raw = {
    session_id: uuid,
    timestamp: new Date().toISOString(),
    engine_version: '3.0.0 (mock)',
    target_position: targetPosition,
    target_city: targetCity,
    _debug: {
      extraction: { method: 'PyMuPDF', pages: 2, char_count: 2800, needs_ocr: false },
      raw_char_count: 2800,
      cleaned_char_count: 2450,
      sections_detected: ['Education', 'Experience', 'Projects', 'Skills'],
      section_count: 4,
      extraction_method: 'PyMuPDF',
    },
    resume_parsed: {
      name: '张三',
      email: 'zhangsan@example.com',
      phone: '138****8888',
      school: '示例大学',
      major,
      education: '本科',
      graduation_year: '2026',
      gpa: '3.6/4.0',
      gender: '',
      skills: isGame
        ? ['游戏策划', '交互设计', '用户体验', '数据分析', '文档撰写', '团队协作', '原型设计', 'Axure/Figma']
        : ['Python', 'Java', 'JavaScript', 'React', 'SQL', 'Docker', 'Git', 'Linux'],
      education_records: [{ school: '示例大学', time_range: '2022-2026', major }],
      experience_records: [],
      project_records: isGame
        ? [{ name: '游戏策划项目', role: '游戏策划', tech_stack: ['游戏设计', '关卡设计'], description: '参与游戏系统设计，完成关卡策划和数值平衡设计...' }]
        : [{ name: '求职助手系统', role: '后端开发', tech_stack: ['Python','FastAPI','React'], description: '基于AI的简历分析平台...' }],
      certifications: ['CET-6'],
      awards: [],
      self_evaluation: isGame
        ? '热爱游戏行业，具备扎实的策划功底和用户洞察能力...'
        : '具备扎实的编程基础，热爱技术学习...',
    },
    resume_raw_text: `[模拟简历] ${fileName} 目标岗位: ${targetPosition}`,
    resume_cleaned_text: `[模拟简历] ${fileName} 目标岗位: ${targetPosition}`,
    resume_skills: isGame
      ? ['游戏策划', '交互设计', '用户体验', '数据分析']
      : ['Python', 'SQL', '数据分析', 'Docker', 'Git', 'Linux'],
    matched_jobs: analysisMatched,
    matched_count: analysisMatched.length,
    ats_score: atsTotal,
    ats_detail: {
      total: atsTotal,
      max: 100,
      dimensions: [
        { name: '关键词匹配', score: Math.min(atsTotal - 5, 88), max: 30, weight: 30 },
        { name: '项目经验质量', score: Math.min(atsTotal - 8, 82), max: 25, weight: 25 },
        { name: '技能完整度', score: Math.min(atsTotal - 3, 85), max: 25, weight: 25 },
        { name: '成果量化', score: Math.min(atsTotal - 12, 75), max: 20, weight: 20 },
      ],
      issues: isGame
        ? ['建议增加游戏设计相关项目经验', '数值建模能力可提升', '缺少具体游戏品类经验案例']
        : ['建议增加量化成果描述', '关键词密度可优化', '建议添加行业认证'],
      suggestions: isGame
        ? ['补充游戏Demo或策划案作品集', '深入掌握数值平衡与Excel建模', '研究行业Top游戏产品设计模式']
        : ['使用STAR法则重构项目经历', '增加技术栈版本号', '添加GitHub链接'],
    },
    resume_optimization: {
      original: '个人简介较为简略或未检测到。\n参与项目开发',
      optimized_sections: [
        { section: '个人总结', reason: '原版缺少核心竞争力定位和差异化亮点', original: '个人简介较为简略或未检测到', optimized: `${isGame ? '热爱游戏行业，具备扎实的策划功底' : '具备扎实的编程基础和技术能力'} | 应聘${targetPosition||'目标岗位'} | 擅长将业务需求转化为解决方案。` },
        { section: '项目经历', reason: '使用STAR法则重构，加入技术细节和可量化的业务影响', original: '参与项目开发', optimized: isGame ? '主导游戏策划相关工作，完成系统设计和数值平衡，推动项目落地。' : '核心参与业务系统建设，负责需求分析到上线全流程，交付周期缩短30%。' },
        { section: '技能列表', reason: '按熟练度分级展示', original: '熟悉相关技能', optimized: isGame ? '精通: 游戏策划、系统设计、用户体验\n熟练: 数据分析、文档撰写、团队协作\n了解: 数值建模、关卡设计' : '精通: Python、SQL\n熟练: Docker、Git、Linux\n了解: 微服务架构、系统设计' },
      ],
    },
    interview_probability: isGame ? 55 + Math.floor(Math.random() * 10) : 60 + Math.floor(Math.random() * 10),
    offer_probability: isGame ? 35 + Math.floor(Math.random() * 10) : 38 + Math.floor(Math.random() * 10),
    radar_data: [
      { name: '学历匹配', score: 70 }, { name: '技能匹配', score: 60 },
      { name: '项目经验', score: 55 }, { name: '实习经历', score: 40 },
      { name: '行业竞争力', score: 50 },
    ],
    skill_gap: {
      existing_skills: isGame ? ['游戏策划', '交互设计', '用户体验'] : ['Python', 'SQL'],
      missing_skills: isGame
        ? [{ name: '数值建模', importance: '高', learning_path: '学习Excel数据建模与概率统计' },
           { name: '关卡设计', importance: '高', learning_path: '掌握关卡设计方法论与Unity关卡编辑' },
           { name: '玩家心理', importance: '中', learning_path: '研究游戏心理学与用户行为分析' }]
        : [{ name: '微服务架构', importance: '高', learning_path: '学习Spring Cloud/Docker/K8s' },
           { name: '系统设计', importance: '中', learning_path: '学习分布式系统设计模式' }],
      target_skills: ['Python', 'SQL', '数据分析'],
    },
    strengths: isGame ? ['游戏理解深入', '策划思维敏锐'] : ['技术栈匹配度高', '项目经验有业务价值'],
    weaknesses: ['缺少实战项目经验', '简历关键词密度不足'],
    recommendations: isGame
      ? ['建议补充游戏策划实习或课程项目', '深入研究数值平衡设计']
      : ['建议补充项目经验', '使用STAR法则重构经历'],
    execution_flow: [
      { agent: '简历解析Agent', status: 'completed', duration_ms: 800, parallel: false },
      { agent: '岗位匹配Agent', status: 'completed', duration_ms: 1200, parallel: false },
      { agent: '技能缺口分析Agent', status: 'completed', duration_ms: 600, parallel: true },
      { agent: 'ATS评分Agent', status: 'completed', duration_ms: 500, parallel: true },
      { agent: '简历优化Agent', status: 'completed', duration_ms: 1000, parallel: false },
      { agent: '能力提升Agent', status: 'completed', duration_ms: 600, parallel: true },
      { agent: 'Offer预测Agent', status: 'completed', duration_ms: 400, parallel: true },
    ],
    improvement_plan: (function() {
      const p = targetPosition || '目标岗位'
      const g = isGame
      const hi = g
        ? [{ skill: '数值建模', category: '游戏', action: '系统学习数值建模核心知识', resource: '学习Excel数据建模与概率统计', estimated_time: '2-4周', priority: '紧急', checkpoint: '能独立完成一个包含数值建模的Demo项目' },{ skill: '关卡设计', category: '游戏', action: '系统学习关卡设计核心知识', resource: '掌握关卡设计方法论与Unity关卡编辑', estimated_time: '2-4周', priority: '紧急', checkpoint: '能独立完成一个包含关卡设计的Demo项目' }]
        : [{ skill: '微服务架构', category: '架构', action: '系统学习微服务架构核心知识', resource: '学习Spring Cloud/Docker/K8s', estimated_time: '2-4周', priority: '紧急', checkpoint: '能独立完成一个包含微服务架构的Demo项目' },{ skill: '系统设计', category: '架构', action: '系统学习系统设计核心知识', resource: '学习分布式系统设计模式', estimated_time: '2-4周', priority: '紧急', checkpoint: '能独立完成一个包含系统设计的Demo项目' }]
      return {
        target_position: p,
        summary: `针对「${p}」岗位，建议按「基础补强→项目实战→面试冲刺」三阶段推进，预计8-15周可显著提升竞争力。`,
        phases: [
          { phase: 1, title: '基础补强 · 核心技能', subtitle: '高优缺口，建议优先攻克', color: '#EF4444', icon: 'target', duration: '2-4周', items: hi },
          { phase: 2, title: '项目实战 · 学以致用', subtitle: '将学到的技能落地为简历可写项目', color: '#8B5CF6', icon: 'code', duration: '3-6周', items: [{ name: '综合实战项目', description: '结合已有技能完成一个完整项目', difficulty: '进阶', output: '可展示到简历上的项目经验', estimated_time: '3-6周' }] },
          { phase: 3, title: '面试冲刺 · 成果包装', subtitle: '把能力转化为面试中的竞争力', color: '#38BDF8', icon: 'zap', duration: '3-5周', items: [
            { skill: 'STAR法则', category: '面试技巧', action: '用STAR法则重构简历中每段经历', resource: 'Situation(背景) → Task(任务) → Action(行动) → Result(结果)', estimated_time: '1周', priority: '中', checkpoint: '所有项目经历能用STAR方式流畅讲述' },
            { skill: `${p}方向面试题`, category: '专业知识', action: `收集${p}岗位常见面试题并逐题准备`, resource: `牛客网/力扣/面经 → 针对${p}方向的真题练习`, estimated_time: '2-3周', priority: '中', checkpoint: '能回答80%以上常见面试问题' },
            { skill: '作品集/案例整理', category: '成果展示', action: '将项目经验和成果整理为结构化作品集', resource: 'PDF作品集/Notion主页/GitHub Readme 整理关键项目和量化成果', estimated_time: '1周', priority: '低', checkpoint: '完成一份可直接投递的作品集' },
          ]},
        ],
        strategy: { target_companies: '优先投递游戏/互联网行业中大型公司，次选有相关业务的创业公司', channels: ['牛客网校招/社招频道', 'BOSS直聘', '拉勾网', '公司官网招聘页', '内推渠道（优先）'], daily_plan: `每天投递5-10个${p}相关岗位，每周复盘投递反馈`, timeline: '第1-2周集中投递 → 第3-4周面试练习 → 第5-6周冲刺目标公司' },
        checklist: [
          { item: '优化关键词密度', done: false, detail: `在简历中融入${p}相关的核心技能词汇` },
          { item: '增加量化成果', done: false, detail: '每个项目描述都加入可量化的业务影响（提升XX%、节省XX元）' },
          { item: '添加技术外链', done: false, detail: 'GitHub/Gitee主页、技术博客、作品集链接' },
          { item: '简历格式优化', done: false, detail: '使用标准ATS友好格式，一页以内，PDF导出' },
        ],
        total_estimated_time: '8-15周',
      }
    })(),
  }

  return transformAnalysisData(raw)
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

    // 简历优化 (Step 9)
    resume_optimization: {
      original: opt.original || '',
      optimized: (Array.isArray(opt.optimized_sections) ? opt.optimized_sections.map(s => s.optimized).filter(Boolean).join('\n') : ''),
      optimized_sections: Array.isArray(opt.optimized_sections) ? opt.optimized_sections : [],
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
 * 获取岗位列表
 */
export async function getJobs(position = '', city = '', limit = 1000) {
  try {
    const response = await api.get('/jobs', {
      params: { position, city, limit },
      timeout: 8000, // 岗位接口专用 8s 超时
    })
    const data = response.data
    // 确保返回格式正确
    if (data && Array.isArray(data.data)) {
      return data
    }
    if (Array.isArray(data)) {
      return { code: 0, data: data, total: data.length, message: 'ok' }
    }
    console.warn('API 返回格式异常，使用本地数据')
    return getMockJobs()
  } catch (error) {
    console.warn('后端API不可用，使用本地模拟岗位数据')
    return getMockJobs()
  }
}

/** 本地模拟岗位数据（后端不可用时的fallback） */
function getMockJobs() {
  const companies = ['腾讯', '阿里巴巴', '字节跳动', '美团', '百度', '小红书', '米哈游', '网易', '京东', '拼多多',
    '华为', '小米', '快手', 'B站', '滴滴', '蔚来汽车', '理想汽车', '商汤科技', '科大讯飞', '大疆创新']
  const cities = ['北京', '上海', '深圳', '杭州', '广州', '成都', '南京', '武汉', '西安', '合肥',
    '苏州', '厦门', '长沙', '重庆', '天津', '青岛', '济南', '郑州', '东莞', '佛山']
  const titles = [
    '后端开发工程师', '前端开发工程师', '数据分析师', '算法工程师-推荐系统', '算法工程师-NLP',
    '算法工程师-CV方向', '算法工程师-大模型方向', '产品经理', '测试开发工程师', 'Android开发工程师',
    'iOS开发工程师', '游戏客户端开发工程师', '游戏策划-系统方向', '游戏运营', '用户运营',
    '内容运营', '活动运营', '电商运营', '品牌策划', '数据开发工程师',
    '运维开发工程师', 'SRE工程师', '安全工程师', '嵌入式软件工程师', 'FPGA开发工程师',
    '云计算开发工程师', '存储系统开发工程师', '医学影像算法工程师', '数字IC设计工程师',
    '5G协议栈工程师', 'BMS算法工程师', '区块链开发工程师', '供应链算法工程师',
    // 上海游戏策划岗位（后续追加到循环中）
    '游戏策划-关卡方向', '游戏策划-数值方向', '游戏策划-剧情方向', '游戏策划-文案方向', '游戏策划-战斗方向',
  ]
  const industries = [
    '互联网', 'AI', '游戏', '电商', '自动驾驶', '金融科技', '智能硬件', '芯片', '云计算',
    '新能源', '通信', '内容/媒体', '社交', '网络安全', '教育科技', '医疗科技',
    '企业服务', '区块链', '物流/供应链', '出行服务'
  ]

  // 岗位标题 → 对应技能和描述的映射，保证搜索关键词能命中
  const JOB_PROFILES = {
    '后端开发工程师': {
      skills: ['Python', 'Java', 'Go', 'MySQL', 'Redis', 'Docker', 'Kubernetes', '微服务', 'Linux'],
      desc: '负责高并发后端服务设计与开发，参与微服务架构演进、分布式系统优化。要求熟悉 Python/Java/Go 至少一门语言，掌握 MySQL、Redis、消息队列等中间件，了解 Docker/Kubernetes 容器化部署。',
      industry: '互联网'
    },
    '前端开发工程师': {
      skills: ['React', 'Vue', 'TypeScript', 'JavaScript', 'CSS', 'Next.js', 'Webpack', '前端工程化'],
      desc: '参与 Web/H5 前端架构设计与核心模块开发，优化首屏加载与渲染性能。要求精通 React/Vue 至少一个框架，熟悉 TypeScript、Webpack/Vite 工程化工具链，有组件库或跨端开发经验优先。',
      industry: '互联网'
    },
    '数据分析师': {
      skills: ['SQL', 'Python', '数据分析', 'Tableau', 'Power BI', 'Excel/PPT', 'ETL', '数据仓库'],
      desc: '负责业务数据监控与分析，搭建指标体系，输出数据驱动决策报告。要求熟练使用 SQL 和 Python 进行数据处理，掌握 Tableau/Power BI 可视化工具，有数据仓库建设和 ETL 经验者优先。',
      industry: '互联网'
    },
    '算法工程师-推荐系统': {
      skills: ['Python', '机器学习', '深度学习', '推荐系统', 'PyTorch', 'Spark', 'A/B测试'],
      desc: '负责推荐系统算法研发与优化，包括召回、排序、重排等核心模块。要求扎实的机器学习/深度学习基础，熟练使用 PyTorch/TensorFlow，有推荐系统、广告算法相关项目经验。',
      industry: '互联网'
    },
    '算法工程师-NLP': {
      skills: ['Python', 'NLP', '深度学习', 'PyTorch', 'Transformer', 'BERT', '文本生成'],
      desc: '负责自然语言处理算法研发，包括文本理解、信息抽取、对话系统等方向。要求深入理解 NLP 经典模型（BERT/GPT 等），有文本分类、命名实体识别或大模型微调经验。',
      industry: 'AI'
    },
    '算法工程师-CV方向': {
      skills: ['Python', '计算机视觉', '深度学习', 'PyTorch', 'OpenCV', '目标检测', '图像分割'],
      desc: '负责计算机视觉算法研发，包括目标检测、图像分割、3D视觉等前沿方向。要求精通 PyTorch，有 CV 顶会论文或实际落地经验，熟悉模型压缩与部署。',
      industry: 'AI'
    },
    '算法工程师-大模型方向': {
      skills: ['Python', '深度学习', 'LLM', 'Transformer', 'PyTorch', 'RLHF', 'AIGC', '大模型'],
      desc: '参与大语言模型（LLM）训练与优化，包括 SFT、RLHF、RAG 等技术方向。要求深入理解 Transformer 架构，有大规模分布式训练经验，熟悉大模型评估与对齐技术。',
      industry: 'AI'
    },
    '产品经理': {
      skills: ['产品设计', '用户研究', '需求分析', 'Axure', 'Figma', '竞品分析', '项目管理', '数据分析'],
      desc: '负责产品规划与需求定义，推动产品从 0 到 1 的设计与迭代。要求优秀的逻辑思维和用户洞察力，熟练使用 Figma/Axure 等原型工具，有数据驱动产品决策能力。',
      industry: '互联网'
    },
    '测试开发工程师': {
      skills: ['Python', 'Java', '自动化测试', 'Selenium', 'JMeter', 'CI/CD', '性能测试', 'SQL'],
      desc: '负责自动化测试框架搭建与质量保障体系建设，开发测试工具提升效率。要求掌握 Python/Java 编程，熟悉 Selenium/JMeter 测试工具，有 CI/CD 集成测试经验。',
      industry: '互联网'
    },
    'Android开发工程师': {
      skills: ['Java', 'Kotlin', 'Android', 'Flutter', '性能优化', 'MVVM', '组件化'],
      desc: '负责 Android 客户端应用开发与维护，性能优化及架构改进。要求精通 Java/Kotlin，熟悉 Android 系统机制与主流架构模式，有跨平台开发经验优先。',
      industry: '互联网'
    },
    'iOS开发工程师': {
      skills: ['Swift', 'Objective-C', 'iOS', 'SwiftUI', '性能优化', 'MVVM', '组件化'],
      desc: '负责 iOS 客户端应用开发与架构优化，提升产品体验与稳定性。要求精通 Swift/Objective-C，深入理解 iOS 系统原理，有组件化架构设计经验者优先。',
      industry: '互联网'
    },
    '游戏客户端开发工程师': {
      skills: ['C++', 'Unity', 'Unreal Engine', 'Shader', '3D数学', '性能优化', '图形学'],
      desc: '负责游戏客户端功能开发与渲染优化，实现高质量画面效果和流畅交互体验。要求精通 C++，熟悉 Unity/Unreal Engine 引擎，了解图形学基础与性能优化技术。',
      industry: '游戏'
    },
    '游戏策划-系统方向': {
      skills: ['游戏策划', '系统策划', '数值设计', '文档撰写', '数据分析', '用户体验'],
      desc: '负责游戏系统设计、数值平衡与玩法创新，撰写详细策划案并推动开发落地。要求热爱游戏行业，逻辑清晰，能独立完成系统设计和数值模型搭建，有上线项目经验优先。',
      industry: '游戏'
    },
    '游戏运营': {
      skills: ['游戏运营', '用户运营', '活动策划', '数据分析', '社群管理', '版本运营'],
      desc: '负责游戏产品日常运营，策划线上活动提升用户活跃和付费。要求熟悉游戏行业运营节奏，擅长数据分析和活动策划，有游戏社区管理或发行经验者优先。',
      industry: '游戏'
    },
    '用户运营': {
      skills: ['用户运营', '用户增长', '社群运营', '数据分析', '活动策划', '用户研究'],
      desc: '负责用户生命周期管理，制定拉新、促活、留存、转化策略。要求有用户分层运营经验，熟悉 A/B 测试和数据分析方法，能独立策划并执行运营活动。',
      industry: '互联网'
    },
    '内容运营': {
      skills: ['内容运营', '内容策划', '新媒体运营', '文案撰写', '数据分析', '社区运营'],
      desc: '负责内容生态建设与运营，策划优质内容提升用户活跃。要求优秀的文字功底和创意能力，熟悉新媒体平台玩法，有内容策划和热点运营成功案例。',
      industry: '内容/媒体'
    },
    '活动运营': {
      skills: ['活动策划', '用户运营', '数据分析', '项目管理', '文案撰写', '社群运营'],
      desc: '负责线上线下活动策划与执行，通过活动手段达成拉新促活目标。要求有完整的活动策划能力，出色的沟通协调和项目管理能力，有大型活动操盘经验优先。',
      industry: '互联网'
    },
    '电商运营': {
      skills: ['电商运营', '活动策划', '数据分析', '品牌推广', '供应链管理', '用户增长'],
      desc: '负责电商平台店铺运营，制定销售策略与推广方案。要求熟悉电商平台规则和流量玩法，具有商品策划、数据分析和促销活动操盘能力。',
      industry: '电商'
    },
    '品牌策划': {
      skills: ['品牌策划', '市场调研', '创意策划', '文案撰写', '活动策划', '数据分析'],
      desc: '负责品牌定位策略与传播规划，制定品牌形象建设方案。要求有完整的品牌策划方法论，出色的创意能力和市场洞察力，有知名品牌策划案例优先。',
      industry: '互联网'
    },
    '数据开发工程师': {
      skills: ['SQL', 'Python', 'Spark', 'Hadoop', '数据仓库', 'ETL', 'Flink', 'Java'],
      desc: '负责大数据平台建设与数据链路开发，构建离线/实时数据仓库。要求精通 SQL 和 Python/Java，熟悉 Hadoop/Spark/Flink 等大数据技术栈，有数据治理和建模经验。',
      industry: '互联网'
    },
    '运维开发工程师': {
      skills: ['Python', 'Go', 'Docker', 'Kubernetes', 'CI/CD', '监控告警', 'Linux', '自动化运维'],
      desc: '负责运维平台开发与自动化体系建设，提升系统可靠性和运维效率。要求熟悉 Linux 系统管理，掌握 Python/Go 编程，有 Docker/Kubernetes 容器化运维经验。',
      industry: '云计算'
    },
    'SRE工程师': {
      skills: ['Python', 'Go', 'Kubernetes', 'Docker', '监控', 'Linux', 'CI/CD', '故障排查'],
      desc: '保障线上服务的高可用与稳定性，负责容量规划、故障预防与应急响应。要求深入理解分布式系统原理，精通 Kubernetes/Linux，有大规模集群运维和自动化工具开发经验。',
      industry: '云计算'
    },
    '安全工程师': {
      skills: ['Python', '安全测试', '渗透测试', '漏洞挖掘', 'Web安全', '网络安全', '加密算法'],
      desc: '负责企业安全体系建设和攻防对抗，包括漏洞挖掘、渗透测试和安全产品研发。要求熟悉 Web/网络安全攻防技术，有 CTF 经验或 CVE 漏洞发现者优先。',
      industry: '网络安全'
    },
    '嵌入式软件工程师': {
      skills: ['C', 'C++', 'RTOS', 'Linux驱动', '单片机', 'ARM', '嵌入式开发', 'I2C/SPI'],
      desc: '负责嵌入式系统软件设计与开发，包括驱动开发和应用层实现。要求精通 C/C++，熟悉 FreeRTOS/Linux 嵌入式开发，了解 ARM 架构和常用通信协议。',
      industry: '智能硬件'
    },
    'FPGA开发工程师': {
      skills: ['Verilog', 'VHDL', 'FPGA', '信号处理', '高速接口', '时序分析', 'C/C++'],
      desc: '负责 FPGA 逻辑设计与验证，实现高速数字信号处理和数据传输。要求精通 Verilog/VHDL，熟悉 Xilinx/Altera 平台，有时序约束和板级调试经验。',
      industry: '芯片'
    },
    '云计算开发工程师': {
      skills: ['Go', 'Python', 'Kubernetes', 'Docker', '分布式系统', 'Linux', '网络', '微服务'],
      desc: '负责云原生平台设计与开发，包括容器编排、服务网格、弹性伸缩等核心功能。要求精通 Go/Python，深入理解 Kubernetes 原理，有大规模分布式系统开发经验。',
      industry: '云计算'
    },
    '存储系统开发工程师': {
      skills: ['C++', 'Go', '分布式存储', '文件系统', 'Linux内核', 'Redis', 'LevelDB'],
      desc: '负责分布式存储系统设计与开发，包括对象存储、块存储等方向。要求精通 C++/Go，理解分布式一致性协议，有文件系统或 KV 存储引擎开发经验优先。',
      industry: '云计算'
    },
    '医学影像算法工程师': {
      skills: ['Python', '深度学习', '计算机视觉', 'PyTorch', '医学影像', '图像分割', '分类检测'],
      desc: '负责医学影像 AI 算法研发，包括 CT/MRI/X光 图像的智能分析和辅助诊断。要求有 CV 和深度学习背景，熟悉医学影像 DICOM 标准，有医疗 AI 项目经验优先。',
      industry: '医疗科技'
    },
    '数字IC设计工程师': {
      skills: ['Verilog', 'SystemVerilog', 'VCS', 'DC综合', 'STA', 'FPGA原型验证', 'EDA'],
      desc: '负责数字芯片前端设计，包括 RTL 编码、仿真验证和综合实现。要求精通 Verilog/SystemVerilog，熟悉 ASIC 设计流程和 EDA 工具链，有流片经验优先。',
      industry: '芯片'
    },
    '5G协议栈工程师': {
      skills: ['C', 'C++', '5G NR', 'LTE', '协议栈', '嵌入式开发', 'DSP', 'RTOS'],
      desc: '负责 5G 通信协议栈软件设计与开发，包括 L1/L2/L3 协议实现与优化。要求精通 C/C++，深入理解 3GPP 协议规范，有基站或终端协议栈开发经验。',
      industry: '通信'
    },
    'BMS算法工程师': {
      skills: ['Python', '电池建模', 'SOC估算', '卡尔曼滤波', 'C/C++', 'MATLAB', '嵌入式'],
      desc: '负责电池管理系统核心算法开发，包括 SOC/SOH 估计、电池均衡策略等。要求熟悉电池建模和状态估计算法，掌握卡尔曼滤波/深度学习电池预测方法。',
      industry: '新能源'
    },
    '区块链开发工程师': {
      skills: ['Go', 'Solidity', '区块链', '智能合约', '共识算法', '密码学', 'Rust'],
      desc: '负责区块链底层平台与智能合约开发，参与共识机制优化和跨链方案设计。要求精通 Go/Rust/Solidity，深入理解区块链原理和密码学，有公链或联盟链项目经验。',
      industry: '区块链'
    },
    '供应链算法工程师': {
      skills: ['Python', '运筹优化', '供应链', '机器学习', 'Java', 'MySQL', '数据建模'],
      desc: '负责供应链优化算法研发，包括需求预测、库存优化和路径规划。要求熟悉运筹优化理论和机器学习方法，有供应链/物流领域算法落地经验。',
      industry: '物流/供应链'
    },
    '游戏策划-关卡方向': {
      skills: ['游戏策划', '关卡设计', 'Unity', 'Unreal Engine', '玩法设计', '数值平衡', 'UE4', 'UE5'],
      desc: '负责游戏关卡设计，包括地图布局、怪物配置、难度曲线与节奏控制。要求有丰富的游戏经验，理解关卡设计方法论，能独立完成白盒搭建到精细打磨的全流程，有动作/射击类游戏关卡经验优先。',
      industry: '游戏'
    },
    '游戏策划-数值方向': {
      skills: ['游戏策划', '数值策划', '数值建模', 'Excel/PPT', '平衡性设计', '经济系统', '概率统计', 'VBA'],
      desc: '负责游戏数值体系设计，包括战斗公式、成长曲线、经济系统平衡与商业化数值。要求数学/统计学基础扎实，精通 Excel 建模与数据分析，有 MMORPG 或卡牌游戏数值策划经验优先。',
      industry: '游戏'
    },
    '游戏策划-剧情方向': {
      skills: ['游戏策划', '剧情策划', '世界观架构', '角色设定', '任务设计', '文案撰写', '分镜设计'],
      desc: '负责游戏剧情设计与世界观构建，包括主线/支线剧情、角色对白、任务文本撰写。要求文笔出色、叙事能力强，有影视/文学/游戏文案创作经验，熟悉交互叙事设计方法。',
      industry: '游戏'
    },
    '游戏策划-文案方向': {
      skills: ['游戏策划', '文案策划', '角色设计', '世界观', '任务文案', '本地化', '游戏叙事'],
      desc: '负责游戏内文案创作，包括角色台词、道具描述、任务文本、世界观文档编写。要求有出色的文字把控力，能在有限篇幅内塑造鲜明角色，有二次元/古风游戏文案经验优先。',
      industry: '游戏'
    },
    '游戏策划-战斗方向': {
      skills: ['游戏策划', '战斗设计', '动作设计', '技能系统', 'AI行为树', '打击感', 'Unity', 'Unreal Engine'],
      desc: '负责游戏战斗系统设计，包括角色技能、敌人 AI、打击感调整与战斗节奏控制。要求对动作/ARPG 游戏有深入理解，有战斗系统从原型到上线的完整经验，能与程序美术高效协作。',
      industry: '游戏'
    },
  }

  // 默认 profile（未专门配置的岗位使用）
  const DEFAULT_PROFILE = {
    skills: ['Python', 'SQL', 'Linux', 'Git'],
    desc: '参与核心业务系统开发与优化，负责架构设计与性能提升，与团队紧密协作推动业务发展。',
    industry: '互联网'
  }

  const jobs = []
  for (let i = 0; i < 1020; i++) {
    const title = titles[i % titles.length]
    const profile = JOB_PROFILES[title] || DEFAULT_PROFILE
    const isCampus = i % 3 === 0
    const prefix = isCampus ? '【校招/应届生岗位】面向应届毕业生开放，提供完善培训体系。' : ''

    jobs.push({
      id: 9000 + i,
      title,
      company: companies[i % companies.length],
      city: cities[i % cities.length],
      description: prefix + profile.desc,
      skills_required: JSON.stringify(profile.skills),
      education_required: i % 7 === 0 ? '硕士' : '本科',
      salary_min: 12 + (i % 8) * 4,
      salary_max: 25 + (i % 8) * 6,
      industry: profile.industry || industries[i % industries.length],
      experience_required: isCampus ? '应届生' : ['1-3年', '3-5年'][(i + 1) % 2],
    })
  }

  // ===== 追加上海游戏策划专项岗位（300+ 条） =====
  const shanghaiGameCompanies = [
    '米哈游', '莉莉丝', '鹰角网络', '叠纸游戏', '心动网络', '哔哩哔哩',
    '盛趣游戏', '巨人网络', '游族网络', '紫龙游戏', '蛮啾网络', '散爆网络',
    '烛龙游戏', '云畅游戏', '波克城市', '幻电科技', '游戏科学', '有爱互娱',
    '星线网络', '深蓝互动',
  ]

  const gamePlanTitles = [
    '游戏策划-系统方向', '游戏策划-关卡方向', '游戏策划-数值方向',
    '游戏策划-剧情方向', '游戏策划-文案方向', '游戏策划-战斗方向',
    '游戏策划-主策划', '游戏策划-执行策划',
  ]

  const gameExpLevels = ['应届生', '应届生', '1-3年', '1-3年', '3-5年', '3-5年', '5-10年']
  const baseId = 10000

  for (let i = 0; i < 320; i++) {
    const title = gamePlanTitles[i % gamePlanTitles.length]
    const profile = JOB_PROFILES[title] || JOB_PROFILES['游戏策划-系统方向']
    const company = shanghaiGameCompanies[i % shanghaiGameCompanies.length]
    const exp = i % 2 === 0
      ? gameExpLevels[i % gameExpLevels.length]
      : gameExpLevels[(i + 3) % gameExpLevels.length]
    const isCampus = exp === '应届生'
    const prefix = isCampus ? '【上海·校招】坐标漕河泾/新天地，提供有竞争力的校招薪资包。' : '【上海】坐标漕河泾/新天地/张江，游戏氛围浓厚，项目奖金丰厚。'

    const salaryBase = exp === '应届生' ? [14, 22] : exp === '1-3年' ? [18, 30] : exp === '3-5年' ? [25, 42] : [35, 55]

    jobs.push({
      id: baseId + i,
      title,
      company,
      city: '上海',
      description: prefix + profile.desc,
      skills_required: JSON.stringify(profile.skills),
      education_required: i % 6 === 0 ? '硕士' : '本科',
      salary_min: salaryBase[0] + (i % 5) * 2,
      salary_max: salaryBase[1] + (i % 5) * 3,
      industry: '游戏',
      experience_required: exp,
    })
  }

  return { code: 0, data: jobs, total: jobs.length, message: 'ok (mock)' }
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
   岗位数据库关键词（用于首页输入框联想）
   与 getMockJobs() 中的 titles / cities 保持同步
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
