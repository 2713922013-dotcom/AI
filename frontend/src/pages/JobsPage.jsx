import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, MapPin, Building2, Briefcase, TrendingUp,
  Filter, X, ChevronDown, ChevronUp, GraduationCap,
  Clock, DollarSign, Sparkles, Eye,
  Bookmark, BookmarkCheck, Download, RefreshCw,
  SlidersHorizontal, ArrowUpDown, Brain, Cpu
} from 'lucide-react'
import { getJobs } from '../services/api'

// ===== 常量配置 =====

const INDUSTRIES = [
  '互联网', 'AI', '游戏', '电商', '自动驾驶',
  '金融科技', '智能硬件', '芯片', '云计算', '新能源',
  '通信', '内容/媒体', '社交', '网络安全', '教育科技',
  '医疗科技', '企业服务', '区块链', '物流/供应链', '出行服务'
]

const CITIES = [
  '北京', '上海', '深圳', '杭州', '广州',
  '成都', '南京', '武汉', '西安', '合肥',
  '苏州', '厦门', '长沙', '重庆', '天津',
  '青岛', '济南', '郑州', '东莞', '佛山',
  '宁波', '珠海', '福州', '无锡', '大连',
  '沈阳', '哈尔滨'
]

const EXPERIENCE_LEVELS = ['不限', '应届生', '1-3年', '3-5年', '5-10年', '10年以上']

const EDUCATION_LEVELS = ['不限', '大专', '本科', '硕士', '博士']

const SORT_OPTIONS = [
  { key: 'default', label: '默认排序' },
  { key: 'salary_desc', label: '薪资从高到低' },
  { key: 'salary_asc', label: '薪资从低到高' },
  { key: 'title_asc', label: '岗位名称 A-Z' },
]

// 快捷筛选标签
const QUICK_FILTERS = {
  cities: ['北京', '上海', '深圳', '杭州', '广州'],
  experiences: ['应届生'],
  skills: ['Python', 'Java', 'Go', '前端', 'React', '算法', '产品经理', '运营'],
}

// ===== 技能别名映射表 =====
// 用户搜索词 → 展开为标准化关键词列表，确保前端搜索与后端 SKILL_NORMALIZE_MAP 一致
const SKILL_ALIAS_MAP = {
  '大模型': ['LLM', '大语言模型', 'Transformer', 'AIGC', '大模型'],
  'ai': ['机器学习', '深度学习', 'NLP', '人工智能', '算法'],
  '人工智能': ['机器学习', '深度学习', 'NLP', '人工智能', '算法'],
  '后端': ['后端开发', 'Go', 'Python', 'Java', 'Node.js', 'Spring', 'Django'],
  '前端': ['前端开发', 'React', 'Vue', 'JavaScript', 'TypeScript', 'Web', 'H5'],
  '算法': ['算法工程师', '机器学习', '深度学习', 'NLP', '计算机视觉', '推荐系统'],
  '数据': ['数据分析', '数据开发', '数据仓库', 'SQL', 'ETL', 'Python'],
  '测试': ['测试开发', '自动化测试', 'Selenium', 'JMeter', 'QA'],
  '运维': ['运维开发', 'SRE', 'DevOps', 'Docker', 'Kubernetes', 'CI/CD'],
  '产品': ['产品经理', 'Product Manager', '用户研究', '产品设计', '需求分析'],
  '运营': ['用户运营', '内容运营', '活动运营', '游戏运营', '电商运营', '新媒体运营'],
  '游戏': ['游戏开发', 'Unity', 'Unreal', '游戏策划', '游戏运营', 'UE4', 'UE5'],
  'java': ['Java', 'Spring Boot', 'Spring', '微服务', 'JVM'],
  'go': ['Go', 'Golang', '后端开发', '微服务'],
  'python': ['Python', 'Django', 'Flask', 'FastAPI', '机器学习', '数据分析'],
  'react': ['React', 'Next.js', '前端开发', 'JavaScript', 'TypeScript'],
  'vue': ['Vue', 'Nuxt.js', '前端开发', 'JavaScript'],
  'c++': ['C++', 'C++开发', '嵌入式', '游戏开发'],
  '数据分析': ['数据分析', '数据开发', 'SQL', 'Python', 'Tableau', 'Power BI'],
  '机器学习': ['机器学习', '深度学习', 'PyTorch', 'TensorFlow', '算法'],
  '深度学习': ['深度学习', 'PyTorch', 'TensorFlow', '计算机视觉', 'NLP', '算法'],
  'nlp': ['NLP', '自然语言处理', 'LLM', '算法'],
  'cv': ['计算机视觉', 'CV', '算法'],
  '嵌入式': ['嵌入式软件', '嵌入式硬件', 'C', 'C++', '单片机', 'RTOS'],
  '芯片': ['数字IC', 'FPGA', 'Verilog', '芯片设计', '半导体'],
  '国内': [],  // 无意义词，不匹配任何结果但保留为不过滤标记
  '远程': [],  // 同上
}

// ===== 辅助函数 =====

function parseSkills(skillsRaw) {
  if (!skillsRaw) return []
  if (Array.isArray(skillsRaw)) return skillsRaw
  try {
    const parsed = JSON.parse(skillsRaw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return skillsRaw.split(/[,，]/).map(s => s.trim()).filter(Boolean)
  }
}

/** 将用户搜索词拆分为标准化 token 列表（含别名展开） */
function tokenizeSearchTerm(raw) {
  const term = raw.trim().toLowerCase()
  if (!term) return []
  // 先尝试整词匹配别名表
  if (SKILL_ALIAS_MAP[term] !== undefined) {
    // 别名展开后加上原词本身（如"运营"展开为各种运营岗位，也保留"运营"原词匹配标题）
    const expanded = SKILL_ALIAS_MAP[term].length ? SKILL_ALIAS_MAP[term].map(t => t.toLowerCase()) : []
    if (expanded.length) {
      expanded.push(term) // 加上原词，确保能匹配标题
    }
    return expanded
  }
  // 按空格/逗号拆分 multiple keywords
  const parts = term.split(/[\s,，、]+/).filter(Boolean)
  const allTokens = []
  for (const p of parts) {
    if (SKILL_ALIAS_MAP[p] !== undefined) {
      const expanded = SKILL_ALIAS_MAP[p].length ? SKILL_ALIAS_MAP[p].map(t => t.toLowerCase()) : []
      allTokens.push(...expanded)
      allTokens.push(p) // 保留原词
    } else {
      allTokens.push(p.toLowerCase())
    }
  }
  return allTokens.length ? allTokens : [term]
}

/**
 * 智能岗位匹配评分
 * 搜索 token 之间是 OR 关系（任一命中即可），取最高分作为匹配分
 * 返回 -1 表示完全不匹配（应从结果中排除）
 */
function scoreJobMatch(job, tokens) {
  const title = (job.title || '').toLowerCase()
  const desc = (job.description || '').toLowerCase()
  const company = (job.company || '').toLowerCase()
  const skills = parseSkills(job.skills_required).map(s => s.toLowerCase())
  const industry = (job.industry || '').toLowerCase()
  const experience = (job.experience_required || '').toLowerCase()
  const city = (job.city || '').toLowerCase()
  const edu = (job.education_required || '').toLowerCase()

  let bestTotal = 0
  let anyMatched = false

  for (const token of tokens) {
    let best = 0
    // 优先级 1: 技能精确匹配 → 100分
    if (skills.some(s => s === token)) { best = 100 }
    // 优先级 2: 技能包含匹配 → 70分
    else if (skills.some(s => s.includes(token) || token.includes(s))) { best = 70 }
    // 优先级 3: 岗位标题命中 → 60分
    else if (title.includes(token)) { best = 60 }
    // 优先级 4: 经验要求命中 → 50分
    else if (experience.includes(token)) { best = 50 }
    // 优先级 5: 行业命中 → 40分
    else if (industry.includes(token)) { best = 40 }
    // 优先级 6: 岗位描述命中 → 35分
    else if (desc.includes(token)) { best = 35 }
    // 优先级 7: 学历命中 → 25分
    else if (edu.includes(token)) { best = 25 }
    // 优先级 8: 公司名命中 → 15分
    else if (company.includes(token)) { best = 15 }
    // 优先级 9: 城市命中 → 10分
    else if (city.includes(token)) { best = 10 }

    if (best > 0) {
      bestTotal += best
      anyMatched = true
    }
    // 注意：不再因为某个 token 没命中就返回 -1（OR 逻辑）
  }

  return anyMatched ? bestTotal : -1
}

function formatSalary(min, max) {
  if (min && max) return `${min}K-${max}K`
  if (min) return `${min}K起`
  if (max) return `最高${max}K`
  return '薪资面议'
}

// AI 匹配度（模拟）
function getAIMatchScore() {
  return Math.floor(Math.random() * 30) + 70 // 70-99
}

// 薪资颜色（渐变文字用）
function getSalaryGradientClass(min, max) {
  const avg = ((Number(min) || 0) + (Number(max) || 0)) / 2
  if (avg >= 40) return 'from-emerald-400 to-green-300'
  if (avg >= 25) return 'from-secondary to-primary'
  if (avg >= 15) return 'from-warning to-amber-300'
  return 'from-gray-400 to-gray-350'
}

// 行业标签渐变边框色
function getIndustryStyle(industry) {
  const map = {
    '互联网': { border: 'border-blue-500/20', bg: 'bg-blue-500/8', text: 'text-blue-350' },
    '游戏': { border: 'border-violet-500/20', bg: 'bg-violet-500/8', text: 'text-violet-350' },
    '电商': { border: 'border-orange-500/20', bg: 'bg-orange-500/8', text: 'text-orange-350' },
    'AI': { border: 'border-accent-pink/30', bg: 'bg-accent-pink/8', text: 'text-purple-330' },
    '金融科技': { border: 'border-yellow-500/20', bg: 'bg-yellow-500/8', text: 'text-yellow-330' },
    '新能源': { border: 'border-emerald-500/20', bg: 'bg-emerald-500/8', text: 'text-emerald-330' },
    '社交': { border: 'border-pink-500/20', bg: 'bg-pink-500/8', text: 'text-pink-330' },
    '内容/媒体': { border: 'border-rose-500/20', bg: 'bg-rose-500/8', text: 'text-rose-330' },
  }
  return map[industry] || { border: 'border-white/10', bg: 'bg-white/[0.03]', text: 'text-white/60' }
}

// 匹配度环形进度条 SVG
function MatchRing({ score }) {
  const pct = score
  const radius = 22
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (pct / 100) * circumference
  
  let color = '#EF4444'
  if (score >= 85) color = '#22C55E'
  else if (score >= 70) color = '#F59E0B'
  else if (score >= 50) color = '#38BDF8'

  return (
    <svg width="52" height="52" viewBox="0 0 52 52">
      <circle cx="26" cy="26" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
      <circle cx="26" cy="26" r={radius} fill="none" stroke={color} strokeWidth="4"
        strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1s ease-out', transform: 'rotate(-90deg)', transformOrigin: 'center' }}
      />
      <text x="26" y="26" dominantBaseline="central" textAnchor="middle"
        fontSize="12" fontWeight="800" fill={color}>{score}%</text>
    </svg>
  )
}

// ===== 子组件：筛选面板 =====
const FilterPanel = ({ filters, setFilters, showFilters, industries, cities, experienceLevels, educationLevels }) => (
  <div className={`glass-card overflow-hidden transition-all duration-400 ${showFilters ? 'max-h-[900px] opacity-100 filter-panel-enter' : 'max-h-0 opacity-0'}`}>
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-bold text-white/90 flex items-center gap-2.5">
          <SlidersHorizontal className="w-5 h-5 text-primary" />
          高级筛选
        </h3>
        <button onClick={() => setFilters({ industry: '', city: '', experience: '', education: '', salaryMin: '', salaryMax: '', skills: '' })}
          className="text-sm font-medium flex items-center gap-1 hover:text-white/80 transition-colors" style={{ color: 'rgba(255,255,255,0.35)' }}>
          <RefreshCw className="w-3 h-3" />重置
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 行业 */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>行业</label>
          <select value={filters.industry} onChange={e => setFilters(p => ({ ...p, industry: e.target.value }))}
            className="input-dark w-full px-3 py-2.5 text-sm"
            style={{ color: filters.industry ? 'white' : undefined }}
          >
            <option value="">全部行业</option>
            {industries.map(ind => <option key={ind} value={ind}>{ind}</option>)}
          </select>
        </div>

        {/* 城市 */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>城市</label>
          <select value={filters.city} onChange={e => setFilters(p => ({ ...p, city: e.target.value }))}
            className="input-dark w-full px-3 py-2.5 text-sm"
          >
            <option value="">全部城市</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* 经验 */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>经验要求</label>
          <select value={filters.experience} onChange={e => setFilters(p => ({ ...p, experience: e.target.value }))}
            className="input-dark w-full px-3 py-2.5 text-sm"
          >
            <option value="">不限经验</option>
            {experienceLevels.filter(e => e !== '不限').map(exp => <option key={exp} value={exp}>{exp}</option>)}
          </select>
        </div>

        {/* 学历 */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>学历要求</label>
          <select value={filters.education} onChange={e => setFilters(p => ({ ...p, education: e.target.value }))}
            className="input-dark w-full px-3 py-2.5 text-sm"
          >
            <option value="">不限学历</option>
            {educationLevels.filter(e => e !== '不限').map(edu => <option key={edu} value={edu}>{edu}</option>)}
          </select>
        </div>
      </div>

      {/* 薪资范围 */}
      <div className="mt-4">
        <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>薪资范围 (K)</label>
        <div className="flex items-center gap-3">
          <input type="number" placeholder="最低" value={filters.salaryMin}
            onChange={e => setFilters(p => ({ ...p, salaryMin: e.target.value }))}
            className="input-dark w-24 px-3 py-2.5 text-sm" />
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>-</span>
          <input type="number" placeholder="最高" value={filters.salaryMax}
            onChange={e => setFilters(p => ({ ...p, salaryMax: e.target.value }))}
            className="input-dark w-24 px-3 py-2.5 text-sm" />
        </div>
      </div>
    </div>
  </div>
)

// ===== 子组件：统计概览条（深色版）=====
const StatsBar = ({ total, filtered, industries, cities }) => (
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
    {[
      { value: total, label: '岗位总数', gradFrom: '#6C7BFF', gradTo: '#38BDF8' },
      { value: filtered, label: '当前筛选结果', gradFrom: '#8B5CF6', gradTo: '#EC4899' },
      { value: Object.keys(industries).length, label: '覆盖行业', gradFrom: '#F59E0B', gradTo: '#EF4444' },
      { value: Object.keys(cities).length, label: '覆盖城市', gradFrom: '#22C55E', gradTo: '#14B8A6' },
    ].map((stat, i) => (
      <div key={i} className="glass-card card-lift p-5 text-center count-animate-dark" style={{ animationDelay: `${i * 80}ms` }}>
        <p className="text-3xl md:text-4xl font-extrabold stat-number-grad">{stat.value}</p>
        <p className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{stat.label}</p>
      </div>
    ))}
  </div>
)

// ===== 子组件：岗位卡片（Glass Card 风格）=====
const JobCard = ({ job, isCollected, onToggleCollect, onExport, index }) => {
  const [expanded, setExpanded] = useState(false)
  const skills = parseSkills(job.skills_required)
  const matchScore = getAIMatchScore()
  const salaryGrad = getSalaryGradientClass(job.salary_min, job.salary_max)
  const indStyle = getIndustryStyle(job.industry)

  return (
    <div className="glass-card card-lift group relative overflow-hidden" style={{ transitionDelay: `${(index % 4) * 80}ms` }}>
      {/* Hover ambient glow */}
      <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(108,123,255,0.08), transparent 65%)' }}
      />

      <div className="relative z-10 p-6">
        {/* Header row: title + salary */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2.5 mb-2 flex-wrap">
              <h3 className="text-xl md:text-2xl font-bold text-white/95 truncate">{job.title}</h3>
              <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${indStyle.border} ${indStyle.bg} ${indStyle.text}`}>
                {job.industry || '互联网'}
              </span>
            </div>
            
            {/* Company info row with icons */}
            <div className="flex items-center gap-3 text-sm flex-wrap" style={{ color: 'rgba(255,255,255,0.4)' }}>
              <span className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                <span className="font-medium">{job.company}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                {job.city}
              </span>
              {job.experience_required && (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {job.experience_required}
                </span>
              )}
              {job.education_required && (
                <span className="flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5" />
                  {job.education_required}
                </span>
              )}
            </div>
          </div>

          {/* Right column: AI match ring + Salary */}
          <div className="flex-shrink-0 flex flex-col items-end gap-3">
            <MatchRing score={matchScore} />
            <div className="text-right">
              <p className={`text-xl md:text-2xl font-extrabold bg-gradient-to-r ${salaryGrad} bg-clip-text text-transparent`}>
                {formatSalary(job.salary_min, job.salary_max)}
              </p>
              <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.22)' }}>月薪</p>
            </div>
          </div>
        </div>

        {/* Skill tags */}
        {skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-5">
            {skills.slice(0, 7).map((skill, i) => (
              <span key={i} className="skill-tag text-[11px]">{skill}</span>
            ))}
            {skills.length > 7 && (
              <span className="tag-glass text-[11px]">+{skills.length - 7}</span>
            )}
          </div>
        )}

        {/* Action bar */}
        <div className="flex items-center gap-2 pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <button onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-xl btn-glass text-white/60 hover:text-white transition-all"
          >
            <Eye className="w-4 h-4" />
            {expanded ? '收起详情' : '查看详情'}
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <button onClick={() => onToggleCollect(job.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-xl transition-all ${
              isCollected
                ? 'text-yellow-400 bg-yellow-400/[0.08] border border-yellow-400/20'
                : 'text-white/40 hover:text-yellow-400 hover:bg-yellow-400/[0.05] border border-transparent'
            }`}
          >
            {isCollected ? <BookmarkCheck className="w-4 h-4 bookmark-animate" /> : <Bookmark className="w-4 h-4" />}
            {isCollected ? '已收藏' : '收藏'}
          </button>

          <button onClick={() => onExport(job)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-xl text-white/40 hover:text-white/70 hover:bg-white/[0.04] border border-transparent transition-all ml-auto"
          >
            <Download className="w-4 h-4" />
            导出
          </button>

          <button className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-xl btn-primary-grad text-white">
            <Brain className="w-4 h-4" />
            AI 分析
          </button>
        </div>
      </div>

      {/* Expandable details */}
      {expanded && (
        <div className="px-6 pb-6 animate-fade-up">
          <div className="pt-5 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            {/* Description */}
            {job.description && (
              <div className="mb-5">
                <h4 className="text-sm font-semibold text-white/70 mb-2.5 flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4" />岗位描述
                </h4>
                <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {job.description}
                </p>
              </div>
            )}

            {/* Detail grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { l: '公司', v: job.company },
                { l: '城市', v: job.city },
                { l: '行业', v: job.industry || '-' },
                { l: '薪资', v: formatSalary(job.salary_min, job.salary_max) },
                { l: '经验要求', v: job.experience_required || '-' },
                { l: '学历要求', v: job.education_required || '-' },
                { l: '技能数量', v: `${skills.length} 项` },
                { l: '岗位ID', v: `#${job.id}` },
              ].map((item, i) => (
                <div key={i} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.28)' }}>{item.l}</p>
                  <p className="text-sm font-semibold mt-0.5 text-white/75">{item.v}</p>
                </div>
              ))}
            </div>

            {/* All skills */}
            {skills.length > 0 && (
              <div className="mt-5">
                <h4 className="text-sm font-semibold text-white/70 mb-2.5 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />全部技能要求 ({skills.length})
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {skills.map((skill, i) => (
                    <span key={i} className="skill-tag text-[11px]">{skill}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ===== 子组件：收藏抽屉 =====
const CollectionDrawer = ({ collected, jobs, onToggleCollect, onExportAll, onClose }) => {
  const collectedJobs = jobs.filter(j => collected.has(j.id))

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md glass-card drawer-enter h-full overflow-y-auto border-l border-white/5"
        style={{ borderRadius: '0', borderTopLeftRadius: '24px', borderBottomLeftRadius: '24px' }}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-white/90 flex items-center gap-2.5">
              <BookmarkCheck className="w-5 h-5 text-yellow-400" />
              我的收藏
              <span className="text-sm font-normal px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)' }}>
                {collectedJobs.length}
              </span>
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-white/[0.06] rounded-xl transition-colors">
              <X className="w-5 h-5 text-white/40" />
            </button>
          </div>

          {collectedJobs.length === 0 ? (
            <div className="text-center py-16">
              <Bookmark className="w-14 h-14 mx-auto mb-4" style={{ color: 'rgba(255,255,255,0.12)' }} />
              <p className="font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>暂无收藏岗位</p>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.22)' }}>点击岗位卡片上的收藏按钮添加</p>
            </div>
          ) : (
            <>
              <button onClick={onExportAll}
                className="w-full mb-5 py-2.5 rounded-xl btn-glass text-sm font-medium text-white/70 hover:text-white flex items-center justify-center gap-2 border border-white/8"
              >
                <Download className="w-4 h-4" />
                一键导出全部收藏
              </button>

              <div className="space-y-3">
                {collectedJobs.map(job => (
                  <div key={job.id} className="glass-card p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-white/85 text-sm">{job.title}</h4>
                        <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{job.company} · {job.city}</p>
                      </div>
                      <button onClick={() => onToggleCollect(job.id)} className="text-yellow-400 hover:text-yellow-300">
                        <BookmarkCheck className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-sm font-bold bg-gradient-to-r from-secondary to-primary bg-clip-text text-transparent">
                      {formatSalary(job.salary_min, job.salary_max)}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ===== 子组件：分页器 =====
const Pagination = ({ current, total, pageSize, onChange }) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const pages = useMemo(() => {
    const result = []; const maxVisible = 7
    if (totalPages <= maxVisible) { for (let i = 1; i <= totalPages; i++) result.push(i) }
    else {
      result.push(1)
      if (current > 3) result.push('...')
      const start = Math.max(2, current - 1), end = Math.min(totalPages - 1, current + 1)
      for (let i = start; i <= end; i++) result.push(i)
      if (current < totalPages - 2) result.push('...')
      result.push(totalPages)
    }
    return result
  }, [current, totalPages])

  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-center gap-1 mt-8">
      <button onClick={() => onChange(current - 1)} disabled={current <= 1}
        className="px-3.5 py-2 rounded-xl text-sm font-medium btn-glass text-white/50 hover:text-white/80 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
      >上一页</button>
      
      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`dots-${i}`} className="px-2" style={{ color: 'rgba(255,255,255,0.18)' }}>...</span>
        ) : (
          <button key={p} onClick={() => onChange(p)}
            className={`w-9 h-9 rounded-xl text-sm font-semibold transition-all ${
              current === p
                ? 'btn-primary-grad text-white shadow-glow-blue'
                : 'text-white/55 hover:text-white hover:bg-white/[0.06]'
            }`}
          >{p}</button>
        )
      )}
      
      <button onClick={() => onChange(current + 1)} disabled={current >= totalPages}
        className="px-3.5 py-2 rounded-xl text-sm font-medium btn-glass text-white/50 hover:text-white/80 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
      >下一页</button>
      
      <span className="ml-3 text-sm" style={{ color: 'rgba(255,255,255,0.2)' }}>共 {total} 个岗位</span>
    </div>
  )
}

// ===== 主组件 =====
const JobsPage = () => {
  const navigate = useNavigate()

  // Data state
  const [allJobs, setAllJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Search & filter
  const [searchTerm, setSearchTerm] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({ industry: '', city: '', experience: '', education: '', salaryMin: '', salaryMax: '', skills: '' })

  // Sort & pagination
  const [sortBy, setSortBy] = useState('default')
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 12

  // Collection
  const [collected, setCollected] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('offer-hunter-collected') || '[]')) }
    catch { return new Set() }
  })
  const [showCollection, setShowCollection] = useState(false)

  useEffect(() => { localStorage.setItem('offer-hunter-collected', JSON.stringify([...collected])) }, [collected])

  // Fetch jobs
  const fetchJobs = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await getJobs('', '', 2000)
      if (res && Array.isArray(res.data)) setAllJobs(res.data)
      else if (Array.isArray(res)) setAllJobs(res)
      else { console.warn('Data format error'); setAllJobs([]) }
    } catch (err) {
      console.error('Failed to load jobs:', err)
      setError(err.message || 'Load failed'); setAllJobs([])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchJobs() }, [fetchJobs])

  // Filter logic — 智能关键词匹配 + 字段级筛选
  const { filteredJobs, searchMatched } = useMemo(() => {
    let result = [...allJobs]
    let matched = false

    // 搜索词处理：使用别名展开 + 智能评分
    if (searchTerm.trim()) {
      matched = true
      const tokens = tokenizeSearchTerm(searchTerm)
      if (tokens.length === 0) {
        result = [] // 无意义搜索词（如"远程"），不返回结果
      } else {
        // 评分 + 过滤 + 按匹配度排序
        const scored = []
        for (const job of result) {
          const s = scoreJobMatch(job, tokens)
          if (s > 0) scored.push({ job, score: s })
        }
        scored.sort((a, b) => b.score - a.score)
        result = scored.map(({ job, score }) => {
          job._searchScore = score
          return job
        })
        // 清除之前可能残留的 _searchScore
        for (const item of scored) {
          item.job._searchScore = item.score
        }
      }
    }

    // 侧面筛选（行业/城市/经验/学历/薪资）
    if (filters.industry) result = result.filter(j => j.industry === filters.industry)
    if (filters.city) result = result.filter(j => j.city === filters.city)
    if (filters.experience) result = result.filter(j => (j.experience_required||'').includes(filters.experience))
    if (filters.education) result = result.filter(j => (j.education_required||'').includes(filters.education))

    const sMin = parseFloat(filters.salaryMin), sMax = parseFloat(filters.salaryMax)
    if (!isNaN(sMin)) result = result.filter(j => (j.salary_max || j.salary_min || 0) >= sMin)
    if (!isNaN(sMax)) result = result.filter(j => (j.salary_min || 0) <= sMax)

    return { filteredJobs: result, searchMatched: matched }
  }, [allJobs, searchTerm, filters])

  // Sort logic — 搜索时保留匹配度排序，非搜索时按用户选择排序
  const sortedJobs = useMemo(() => {
    const result = [...filteredJobs]
    if (searchMatched) {
      // 搜索模式：按匹配度排序（已在上一步排序，此处保留）
      // 如果用户选了薪资排序，则在匹配度分组内按薪资排
      if (sortBy === 'salary_desc' || sortBy === 'salary_asc') {
        const desc = sortBy === 'salary_desc'
        result.sort((a, b) => {
          const scoreDiff = (b._searchScore || 0) - (a._searchScore || 0)
          if (Math.abs(scoreDiff) > 20) return scoreDiff // 匹配度差距大，按相关性
          const avgA = ((a.salary_max||0) + (a.salary_min||0)) / 2
          const avgB = ((b.salary_max||0) + (b.salary_min||0)) / 2
          return desc ? avgB - avgA : avgA - avgB
        })
      }
      return result
    }
    // 非搜索模式：按用户选择的排序
    switch (sortBy) {
      case 'salary_desc': result.sort((a,b) => ((b.salary_max||0)+(b.salary_min||0))/2 - ((a.salary_max||0)+(a.salary_min||0))/2); break
      case 'salary_asc': result.sort((a,b) => ((a.salary_max||0)+(a.salary_min||0))/2 - ((b.salary_max||0)+(b.salary_min||0))/2); break
      case 'title_asc': result.sort((a,b) => (a.title||'').localeCompare(b.title||'', 'zh')); break
    }
    return result
  }, [filteredJobs, sortBy, searchMatched])

  // Pagination
  const pagedJobs = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE; return sortedJobs.slice(start, start + PAGE_SIZE)
  }, [sortedJobs, currentPage])

  useEffect(() => { setCurrentPage(1) }, [searchTerm, filters, sortBy])

  // Stats
  const stats = useMemo(() => {
    const industries = {}, cities = {}
    allJobs.forEach(job => {
      if (job.industry) industries[job.industry] = (industries[job.industry] || 0) + 1
      if (job.city) cities[job.city] = (cities[job.city] || 0) + 1
    })
    return { industries, cities }
  }, [allJobs])

  const toggleCollect = useCallback((jobId) => {
    setCollected(prev => { const next = new Set(prev); next.has(jobId) ? next.delete(jobId) : next.add(jobId); return next })
  }, [])

  const exportJob = useCallback((job) => {
    const skills = parseSkills(job.skills_required).join(', ')
    const content = `岗位名称: ${job.title}\n公司: ${job.company}\n城市: ${job.city}\n行业: ${job.industry || '-'}\n薪资: ${formatSalary(job.salary_min, job.salary_max)}\n经验要求: ${job.experience_required || '-'}\n学历要求: ${job.education_required || '-'}\n技能要求: ${skills || '-'}\n\n岗位描述:\n${job.description || '暂无描述'}\n\n--- 由 Offer Hunter 导出 ---`
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `${job.title}-${job.company}.txt`; a.click(); URL.revokeObjectURL(url)
  }, [])

  const exportAllCollected = useCallback(() => {
    const cj = allJobs.filter(j => collected.has(j.id)); if (!cj.length) return
    const content = `Offer Hunter - 收藏岗位导出 (共 ${cj.length} 个岗位)\n导出时间: ${new Date().toLocaleString()}\n\n` +
      cj.map((j,i) => `${'='.repeat(45)}\n[${i+1}] ${j.title} @ ${j.company}\n${'='.repeat(45)}\n城市: ${j.city}  行业: ${j.industry||'-'}  薪资: ${formatSalary(j.salary_min, j.salary_max)}\n技能: ${parseSkills(j.skills_required).join(', ')}\n`).join('\n')
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    URL.revokeObjectURL(URL.createObjectURL(blob))
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `OfferHunter-收藏-${new Date().toISOString().slice(0,10)}.txt`; a.click(); URL.revokeObjectURL(a.href)
  }, [allJobs, collected])

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8 animate-fade-up">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight hero-title-grad flex items-center gap-3">
            <Briefcase className="w-7 h-7 text-primary" />
            岗位浏览
          </h1>
          <p className="text-sm mt-1.5" style={{ color: 'rgba(255,255,255,0.32)' }}>
            浏览全部岗位数据，搜索、筛选、收藏你感兴趣的职位
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowCollection(true)}
            className="flex items-center gap-2 px-4 py-2.5 glass-card btn-glass text-sm font-medium text-white/70 hover:text-white/90"
          >
            <BookmarkCheck className="w-4 h-4" />
            我的收藏
            {collected.size > 0 && (
              <span className="bg-yellow-500 text-black text-[11px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                {collected.size}
              </span>
            )}
          </button>
          <button onClick={() => navigate('/')}
            className="flex items-center gap-2 px-4 py-2.5 btn-primary-grad text-sm font-semibold text-white"
          >
            <Sparkles className="w-4 h-4" />
            AI 分析简历
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="mb-6 animate-fade-up delay-1">
        <StatsBar total={allJobs.length} filtered={filteredJobs.length} industries={stats.industries} cities={stats.cities} />
      </div>

      {/* Search bar — Glass Style */}
      <div className="glass-card p-4 mb-4 animate-fade-up delay-2 glow-border-focus">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[220px] relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none" style={{ color: 'rgba(255,255,255,0.22)' }} />
            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="搜索职位、公司、技能..." autoComplete="off" spellCheck="false"
              className="input-dark w-full pl-11 pr-10 py-3 text-sm"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-white/[0.08] rounded-full">
                <X className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.3)' }} />
              </button>
            )}
          </div>

          {/* Sort select */}
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            className="input-dark px-4 py-3 text-sm"
            style={{ colorScheme: 'dark' }}
          >
            {SORT_OPTIONS.map(opt => <option key={opt.key} value={opt.key} style={{ background: '#1a1a2e', color: '#e0e0e0' }}>{opt.label}</option>)}
          </select>

          {/* Filter toggle button */}
          <button onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-medium transition-all ${
              showFilters ? 'tag-active' : 'tag-glass'
            }`}
          >
            <Filter className="w-4 h-4" />
            筛选
            {Object.values(filters).some(v => v) && (
              <span className="bg-primary text-white text-[11px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">!</span>
            )}
          </button>

          {/* Refresh */}
          <button onClick={fetchJobs} className="p-3 tag-glass rounded-2xl" title="刷新数据">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Quick filter pills */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <span className="text-[11px] font-medium mr-1" style={{ color: 'rgba(255,255,255,0.25)' }}>快捷筛选:</span>
          {[...QUICK_FILTERS.cities, ...QUICK_FILTERS.experiences, ...QUICK_FILTERS.skills].map((tag, i) => (
            <button key={i} onClick={() => setSearchTerm(tag)}
              className="tag-glass text-[11px] hover:tag-active"
            >{tag}</button>
          ))}
        </div>
      </div>

      {/* Advanced filter panel */}
      <div className="mb-6 animate-fade-up delay-3">
        <FilterPanel filters={filters} setFilters={setFilters} showFilters={showFilters} setShowFilters={setShowFilters}
          industries={INDUSTRIES} cities={CITIES} experienceLevels={EXPERIENCE_LEVELS} educationLevels={EDUCATION_LEVELS}
        />
      </div>

      {/* Active filter tags */}
      {Object.values(filters).some(v => v) && (
        <div className="flex items-center gap-2 mb-4 flex-wrap animate-fade-up">
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>当前筛选:</span>
          {[
            filters.industry && { k: 'industry', v: filters.industry },
            filters.city && { k: 'city', v: filters.city },
            filters.experience && { k: 'experience', v: filters.experience },
            filters.education && { k: 'education', v: filters.education },
            (filters.salaryMin || filters.salaryMax) && { k: 'salary', v: `${filters.salaryMin||0}K-${filters.salaryMax||'∞'}K` },
          ].filter(Boolean).map(({ k, v }) => (
            <span key={k} className="tag-active tag-glass text-xs flex items-center gap-1">
              {v}
              <button onClick={() => setFilters(p => ({ ...p, [k]: '' }))}><X className="w-3 h-3" /></button>
            </span>
          ))}
          <button onClick={() => setFilters({ industry:'', city:'', experience:'', education:'', salaryMin:'', salaryMax:'', skills:'' })}
            className="text-xs underline" style={{ color: 'rgba(239,68,68,0.6)' }}
          >清除全部</button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass-card p-6">
              <div className="flex gap-4">
                <div className="flex-1 space-y-3">
                  <div className="skeleton-dark h-5 w-48" />
                  <div className="skeleton-dark h-4 w-64" />
                  <div className="flex gap-2">
                    <div className="skeleton-dark h-7 w-16 rounded-full" />
                    <div className="skeleton-dark h-7 w-16 rounded-full" />
                    <div className="skeleton-dark h-7 w-16 rounded-full" />
                  </div>
                </div>
                <div className="skeleton-dark h-20 w-24 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="glass-card p-12 text-center border-red-500/15">
          <p className="font-semibold mb-2 text-red-400">加载失败</p>
          <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>{error}</p>
          <button onClick={fetchJobs} className="px-6 py-2.5 rounded-xl btn-glass text-red-400 hover:bg-red-500/10 text-sm font-medium">
            重试
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && sortedJobs.length === 0 && (
        <div className="glass-card p-16 text-center">
          <Search className="w-16 h-16 mx-auto mb-5" style={{ color: 'rgba(255,255,255,0.1)' }} />
          <h3 className="text-lg font-semibold text-white/60 mb-2">未找到匹配的岗位</h3>
          <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.25)' }}>
            {searchTerm || Object.values(filters).some(v => v) ? '试试调整搜索关键词或筛选条件' : '当前数据库中没有岗位数据'}
          </p>
          {(searchTerm || Object.values(filters).some(v => v)) && (
            <button onClick={() => { setSearchTerm(''); setFilters({ industry:'', city:'', experience:'', education:'', salaryMin:'', salaryMax:'', skills:'' }) }}
              className="px-6 py-2.5 btn-glass text-sm font-medium"
            >清除所有筛选</button>
          )}
        </div>
      )}

      {/* Result summary */}
      {!loading && !error && sortedJobs.length > 0 && (
        <div className="flex items-center justify-between mb-4 animate-fade-up">
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
            共找到 <span className="font-semibold text-white/65">{sortedJobs.length}</span> 个岗位
            {allJobs.length !== sortedJobs.length && <span style={{ color: 'rgba(255,255,255,0.18)' }} > / {allJobs.length} 个</span>}
          </p>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.18)' }}>第 {currentPage}/{Math.max(1, Math.ceil(sortedJobs.length/PAGE_SIZE))} 页</p>
        </div>
      )}

      {/* Job list */}
      {!loading && !error && pagedJobs.length > 0 && (
        <div className="space-y-4 animate-fade-up">
          {pagedJobs.map((job, i) => (
            <JobCard key={job.id} job={job} index={i} isCollected={collected.has(job.id)}
              onToggleCollect={toggleCollect} onExport={exportJob} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && !error && sortedJobs.length > 0 && (
        <Pagination current={currentPage} total={sortedJobs.length} pageSize={PAGE_SIZE} onChange={setCurrentPage} />
      )}

      {/* Collection drawer */}
      {showCollection && (
        <CollectionDrawer collected={collected} jobs={allJobs} onToggleCollect={toggleCollect}
          onExportAll={exportAllCollected} onClose={() => setShowCollection(false)}
        />
      )}
    </main>
  )
}

export default JobsPage
