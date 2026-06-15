import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import {
  Upload, FileText, MapPin, Zap, ArrowRight,
  Sparkles, Loader2, Briefcase, ChevronDown, Target,
  FileSearch, Crosshair, GitCompare, ShieldCheck,
  MessageSquare, TrendingUp, Trophy,
  Brain, BarChart3, GraduationCap, PenTool, Mic, Eye,
  Database, Search, XCircle, CheckCircle, Layers, Clock, Lightbulb
} from 'lucide-react'
import { analyzeResume, getStats, JOB_TITLES, JOB_CITIES, HOT_POSITIONS, HOT_CITIES } from '../services/api'

/* ============================================================
   ScrollReveal - Intersection Observer 入场动画
   ============================================================ */
function ScrollReveal({ children, className = '', delay = 0 }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`transition-all duration-1000 ease-out ${className}`}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}

/* ============================================================
   AI 功能卡片数据
   ============================================================ */
const aiFeatures = [
  {
    icon: Crosshair,
    gradientFrom: '#6C7BFF',
    gradientTo: '#38BDF8',
    title: 'AI 岗位匹配',
    desc: '基于技能图谱与行业数据，智能匹配最适合你的职业机会',
    glowColor: 'rgba(108,123,255,0.4)',
    detail: {
      how: '系统将你的简历技能、经验、学历与500+真实岗位进行多维度对比，智能计算匹配度并排序推荐。',
      steps: ['提取简历中的技能标签、项目经验、教育背景', '与岗位JD中的要求逐字段对比', '综合计算匹配度得分（技能/经验/学历/标题）', '按匹配度排序输出Top推荐岗位'],
      advantage: '覆盖20+行业、27个城市、1000+真实岗位，支持游戏策划、开发、运营等热门方向',
      time: '5-15秒',
    },
  },
  {
    icon: FileSearch,
    gradientFrom: '#8B5CF6',
    gradientTo: '#EC4899',
    title: 'AI 简历分析',
    desc: 'AI 智能解析简历，提取技能树、项目经验、教育背景等核心信息',
    glowColor: 'rgba(139,92,246,0.4)',
    detail: {
      how: '10步专业解析流水线：PDF提取→文本清洗→章节检测→结构化提取→技能标准化，将杂乱简历转为结构化JSON。',
      steps: ['PyMuPDF引擎提取PDF文本', '自动清洗页眉页脚/乱码/空行', '检测Education/Experience/Projects/Skills等章节', '正则+规则提取姓名/学校/专业/技能/项目', '100+技能别名标准化映射'],
      advantage: '支持中文简历、英文简历双语解析，准确识别双栏排版PDF',
      time: '3-8秒',
    },
  },
  {
    icon: Brain,
    gradientFrom: '#F59E0B',
    gradientTo: '#EF4444',
    title: 'AI 能力评估',
    desc: '多维度评估你的综合竞争力，定位技能短板与提升方向',
    glowColor: 'rgba(245,158,11,0.4)',
    detail: {
      how: '基于岗位要求与个人技能对比，生成雷达图展示各维度能力分布，精准定位技能缺口。',
      steps: ['汇总你已具备的技能标签', '对比目标岗位的技能要求清单', '计算技能覆盖率和缺失项', '按重要程度和频次排序缺失技能', '生成个性化学习路径和项目建议'],
      advantage: '直观雷达图展示编程语言/数据/AI/前端/后端/DevOps/架构/软技能八大维度',
      time: '3-8秒',
    },
  },
  {
    icon: PenTool,
    gradientFrom: '#22C55E',
    gradientTo: '#10B981',
    title: 'AI 简历优化',
    desc: '模拟 ATS 筛选系统，优化关键词匹配度与通过率',
    glowColor: 'rgba(34,197,94,0.4)',
    detail: {
      how: '模拟企业ATS筛选系统评分，从关键词匹配、项目质量、技能完整度、成果量化四个维度打分并给出改进建议。',
      steps: ['关键词匹配评分（40%权重）——检测简历与岗位关键词重叠度', '经验质量评分（25%）——评估项目/实习的数量和质量', '项目相关性评分（20%）——判断项目与目标岗位的关联度', '学历背景评分（10%）+格式完整性（5%）', '生成具体可操作的优化建议'],
      advantage: '基于真实ATS算法逻辑，每个维度都有具体评分和改进指引',
      time: '3-5秒',
    },
  },
  {
    icon: Mic,
    gradientFrom: '#EC4899',
    gradientTo: '#F43F5E',
    title: 'AI 模拟面试',
    desc: 'AI 职业顾问提供个性化面试准备、谈薪策略与职业规划',
    glowColor: 'rgba(236,72,153,0.4)',
    detail: {
      how: '根据你的目标岗位和技能缺口，生成针对性面试准备建议，包括常见问题、STAR法则回答框架和谈薪策略。',
      steps: ['根据目标岗位提取高频面试考点', '针对技能缺口给出知识补强建议', 'STAR法则模板：Situation→Task→Action→Result', '面试回答框架和话术参考', '薪资谈判策略和行业薪资参考'],
      advantage: '覆盖产品/运营/开发/设计等主流岗位的面试准备',
      time: '2-5秒',
    },
  },
  {
    icon: TrendingUp,
    gradientFrom: '#14B8A6',
    gradientTo: '#06B6D4',
    title: 'Offer 预测',
    desc: '基于多维度数据模型，科学预测面试成功率与 Offer 概率',
    glowColor: 'rgba(20,184,166,0.4)',
    detail: {
      how: '综合学历、技能、项目、实习、竞争度五个维度，结合行业大数据预测面试通过率和最终拿到Offer的概率。',
      steps: ['学历匹配分析——你的学历与目标岗位要求的匹配度', '技能匹配分析——技能栈覆盖目标岗位要求的比例', '项目经验评估——项目质量和相关性的综合评分', '实习经历评估——工作/实习经验的质量和时长', '行业竞争力分析——结合同类候选人竞争情况'],
      advantage: '多维度综合评估，概率分布曲线直观展示预测结果',
      time: '3-5秒',
    },
  },
]

/* ============================================================
   统计数据 - 从API动态获取
   ============================================================ */
const DEFAULT_STATS = [
  { value: '1000+', label: '岗位数据', suffix: '' },
  { value: '20', label: '行业覆盖', suffix: '' },
  { value: '27', label: '城市覆盖', suffix: '' },
  { value: '92', label: '匹配准确率', suffix: '%' },
]

/* ============================================================
   路线图数据 (保留原有流程展示)
   ============================================================ */
const roadmapSteps = [
  {
    icon: FileSearch, gradient: 'from-primary to-secondary', name: 'Resume Analyzer',
    title: '简历解析', desc: 'AI智能解析简历，提取技能树、项目经验、教育背景等核心信息',
  },
  {
    icon: Crosshair, gradient: 'from-accent to-success', name: 'Job Matcher',
    title: '岗位匹配', desc: '基于技能图谱与行业数据，精准匹配最适合你的职业机会',
  },
  {
    icon: GitCompare, gradient: 'from-warning to-orange-400', name: 'Gap Analysis',
    title: '缺口分析', desc: '深度对比岗位要求与个人能力，定位技能差距与提升路径',
  },
  {
    icon: ShieldCheck, gradient: 'from-accent-pink to-rose-400', name: 'ATS Optimizer',
    title: 'ATS优化', desc: '模拟企业ATS筛选系统，优化简历关键词匹配度与通过率',
  },
  {
    icon: MessageSquare, gradient: 'from-red-500 to-pink-400', name: 'Career Coach',
    title: '职业教练', desc: 'AI职业顾问提供个性化面试准备、谈薪策略与职业规划',
  },
  {
    icon: TrendingUp, gradient: 'from-teal-500 to-cyan-400', name: 'Offer Predictor',
    title: 'Offer预测', desc: '基于多维度数据模型，科学预测面试成功率与Offer概率',
  },
]

/* ============================================================
   AutocompleteInput - 智能联想输入框
   从岗位数据库提取关键词，支持模糊匹配 + 快捷标签选择
   ============================================================ */
function AutocompleteInput({
  value, onChange, placeholder, suggestions, hotTags,
  icon: Icon, label,
}) {
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const wrapperRef = useRef(null)
  const inputRef = useRef(null)

  // 过滤匹配项：支持中文/英文模糊搜索
  const filtered = useMemo(() => {
    if (!value.trim()) return []
    const term = value.trim().toLowerCase()
    return suggestions.filter(s => s.toLowerCase().includes(term))
  }, [value, suggestions])

  // 点击外部关闭
  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // 键盘导航
  function handleKeyDown(e) {
    if (!open || filtered.length === 0 && !hotTags.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted(prev => Math.min(prev + 1, (filtered.length || hotTags.length) - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted(prev => Math.max(prev - 1, -1))
    } else if (e.key === 'Enter' && highlighted >= 0) {
      e.preventDefault()
      const items = filtered.length > 0 ? filtered : hotTags
      onChange(items[highlighted])
      setOpen(false)
      setHighlighted(-1)
    } else if (e.key === 'Escape') {
      setOpen(false)
      setHighlighted(-1)
    }
  }

  function handleSelect(item) {
    onChange(item)
    setOpen(false)
    setHighlighted(-1)
    inputRef.current?.blur()
  }

  const showDropdown = open && (
    value.trim() ? filtered.length > 0 : hotTags.length > 0
  )

  return (
    <div ref={wrapperRef} className="relative">
      {label && (
        <label className="flex items-center gap-2 text-sm font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.55)' }}>
          {Icon && <Icon className="w-4 h-4" />}{label}
        </label>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => { onChange(e.target.value); setOpen(true); setHighlighted(-1) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          placeholder={placeholder}
          className="input-dark w-full px-4 py-3.5 text-sm"
          style={{ paddingRight: value ? '36px' : '16px' }}
        />
        {/* 清除按钮 */}
        {value && (
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(true); inputRef.current?.focus() }}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full transition-colors"
            style={{ color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.08)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.18)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
          >
            ✕
          </button>
        )}
      </div>

      {/* 联想下拉面板 */}
      {showDropdown && (
        <div
          className="absolute z-50 w-full mt-1.5 rounded-xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-top-1 duration-150"
          style={{
            background: 'rgba(22,22,28,0.97)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(16px)',
            maxHeight: '280px',
            overflowY: 'auto',
          }}
        >
          {/* 匹配结果 */}
          {filtered.length > 0 && (
            <>
              <div style={{ padding: '6px 14px', fontSize: '11px', color: 'rgba(255,255,255,0.32)', letterSpacing: '0.5px', fontWeight: 600 }}>
                匹配岗位 · {filtered.length}
              </div>
              {filtered.map((item, i) => (
                <button
                  key={item}
                  type="button"
                  onMouseDown={() => handleSelect(item)}
                  onMouseEnter={() => setHighlighted(i)}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2.5`}
                  style={{
                    color: highlighted === i ? '#fff' : 'rgba(255,255,255,0.72)',
                    background: highlighted === i ? 'rgba(99,102,241,0.18)' : 'transparent',
                  }}
                >
                  <Search className="w-3.5 h-3.5 shrink-0" style={{ color: highlighted === i ? '#818cf8' : 'rgba(255,255,255,0.25)' }} />
                  <span>{item}</span>
                </button>
              ))}
            </>
          )}

          {/* 热门标签（无输入或输入为空时显示） */}
          {!value.trim() && hotTags.length > 0 && (
            <>
              <div style={{ padding: '6px 14px', fontSize: '11px', color: 'rgba(255,255,255,0.32)', letterSpacing: '0.5px', fontWeight: 600 }}>
                🔥 热门搜索
              </div>
              <div className="flex flex-wrap gap-1.5 px-3 pb-3 pt-1">
                {hotTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onMouseDown={() => handleSelect(tag)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
                    style={{
                      color: 'rgba(129,140,248,0.9)',
                      background: 'rgba(99,102,241,0.10)',
                      border: '1px solid rgba(99,102,241,0.18)',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(99,102,241,0.22)'
                      e.currentTarget.style.borderColor = 'rgba(99,102,241,0.40)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(99,102,241,0.10)'
                      e.currentTarget.style.borderColor = 'rgba(99,102,241,0.18)'
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/* ============================================================
   HomePage 主组件
   ============================================================ */
const HomePage = ({ onAnalysisComplete }) => {
  const navigate = useNavigate()
  const uploadRef = useRef(null)
  const [file, setFile] = useState(null)
  const [position, setPosition] = useState('')
  const [city, setCity] = useState('')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(null)
  const [detailFeature, setDetailFeature] = useState(null)
  const [statsData, setStatsData] = useState(DEFAULT_STATS)

  // 进入首页时清除旧分析缓存，确保每次分析都是最新的
  useEffect(() => {
    sessionStorage.removeItem('analysis_data')
  }, [])

  // 动态获取平台统计数据
  useEffect(() => {
    getStats().then(res => {
      if (res?.data) {
        const d = res.data
        setStatsData([
          { value: `${d.total_jobs || 1000}+`, label: '岗位数据', suffix: '' },
          { value: `${d.industries?.length || d.industries_count || 20}`, label: '行业覆盖', suffix: '' },
          { value: `${d.cities?.length || d.cities_count || 27}`, label: '城市覆盖', suffix: '' },
          { value: '92', label: '匹配准确率', suffix: '%' },
        ])
      }
    }).catch(() => {})
  }, [])

  const scrollToUpload = () => {
    uploadRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) setFile(acceptedFiles[0])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  })

  const handleAnalyze = async () => {
    if (!file || !position || !city) return
    setLoading(true)
    setProgress({ label: '正在上传简历...', progress: 5 })
    try {
      const data = await analyzeResume(file, position, city, setProgress)
      sessionStorage.setItem('analysis_data', JSON.stringify(data))
      onAnalysisComplete(data)
      setTimeout(() => navigate('/dashboard'), 50)
    } catch (error) {
      alert('分析失败：' + (error.response?.data?.message || error.message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-cosmos text-white overflow-hidden">
      {/* Background grid overlay */}
      <div className="fixed inset-0 bg-grid-pattern pointer-events-none" />

      {/* ============================================================
          SECTION 1 — HERO（全屏暗色科技风）
          ============================================================ */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6">
        {/* Aurora background blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, rgba(108,123,255,0.15), transparent 70%)' }} />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full opacity-15"
            style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.12), transparent 70%)' }} />
          <div className="absolute top-1/2 right-1/3 w-[300px] h-[300px] rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, rgba(56,189,248,0.12), transparent 70%)' }} />
        </div>

        <div className="relative z-10 text-center max-w-5xl mx-auto">
          {/* Top badge */}
          <ScrollReveal>
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full mb-10 animate-fade-in"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                animationDelay: '0.1s',
              }}>
              <Sparkles className="w-4 h-4 text-secondary" />
              <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>从迷茫到 Offer</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>Powered by 6 AI Agents</span>
            </div>
          </ScrollReveal>

          {/* Hero Title */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-[80px] font-extrabold tracking-tight leading-[1.05] animate-fade-up"
            style={{ animationDelay: '0.25s' }}
          >
            <span className="block hero-title-grad">你的下一份工作</span>
            <span className="block mt-2 hero-title-highlight">不应该靠海投获得</span>
          </h1>

          {/* Subtitle */}
          <p className="mt-7 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed animate-fade-up"
            style={{ color: 'rgba(255,255,255,0.42)', animationDelay: '0.45s' }}
          >
            Offer Hunter 通过 6 个 AI Agent，
            <br className="hidden sm:block" />
            帮你完成岗位匹配、能力分析、简历优化、面试准备与 Offer 预测
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4 mt-12 animate-fade-up"
            style={{ animationDelay: '0.65s' }}
          >
            <button
              onClick={scrollToUpload}
              className="btn-primary-grad group inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl text-base font-semibold text-white"
            >
              开始求职之旅
              <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <button
              onClick={() => navigate('/jobs')}
              className="btn-glass inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-semibold text-white/80"
            >
              浏览岗位
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-fade-up cursor-pointer"
          style={{ animationDelay: '1.2s' }}
          onClick={scrollToUpload}
        >
          <ChevronDown className="w-5 h-5 animate-bounce" style={{ color: 'rgba(255,255,255,0.18)' }} />
          <p className="text-xs tracking-wider uppercase" style={{ color: 'rgba(255,255,255,0.14)' }}>向下探索</p>
        </div>
      </section>

      {/* ============================================================
          SECTION 2 — AI 功能卡片（六宫格）
          ============================================================ */}
      <section className="relative py-28 px-6" style={{ background: 'var(--bg-secondary)' }}>
        <div className="max-w-7xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-16">
              <p className="text-xs font-mono tracking-widest uppercase mb-4" style={{ color: 'rgba(255,255,255,0.25)' }}>
                AI Powered Features
              </p>
              <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight hero-title-grad">
                6 大核心能力
              </h2>
              <p className="mt-4 text-base max-w-lg mx-auto" style={{ color: 'rgba(255,255,255,0.35)' }}>
                从简历到 Offer，全链路 AI 驱动
              </p>
            </div>
          </ScrollReveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {aiFeatures.map((feature, i) => (
              <ScrollReveal key={i} delay={i * 100}>
                <div
                  className="glass-card card-lift p-7 relative group cursor-pointer"
                  style={{ transitionDelay: `${i * 60}ms` }}
                  onClick={() => setDetailFeature(feature)}
                >
                  {/* Hover glow effect */}
                  <div
                    className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                    style={{
                      background: `radial-gradient(ellipse at center, ${feature.glowColor} 0%, transparent 65%)`,
                    }}
                  />

                  <div className="relative z-10">
                    {/* Icon */}
                    <div
                      className="w-13 h-13 rounded-2xl flex items-center justify-center mb-5 roadmap-icon-dark"
                      style={{
                        background: `linear-gradient(135deg, ${feature.gradientFrom}, ${feature.gradientTo})`,
                        boxShadow: `0 0 30px ${feature.glowColor}`,
                      }}
                    >
                      <feature.icon className="w-6.5 h-6.5 text-white" />
                    </div>

                    {/* Title & Desc */}
                    <h3 className="text-lg font-bold text-white/95 mb-2">{feature.title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {feature.desc}
                    </p>

                    {/* Arrow on hover */}
                    <div className="mt-4 flex items-center gap-1.5 text-xs font-medium opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0"
                      style={{ color: feature.gradientFrom }}
                    >
                      了解更多
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 3 — 数据统计条（横向发光卡片）
          ============================================================ */}
      <section className="py-20 px-6" style={{ background: 'var(--bg-primary)' }}>
        <div className="max-w-5xl mx-auto">
          <ScrollReveal>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              {statsData.map((stat, i) => (
                <div key={i} className="glass-card card-lift p-6 text-center" style={{ animationDelay: `${i * 100}ms` }}>
                  <p className="text-4xl md:text-5xl font-extrabold stat-number-grad count-animate-dark">
                    {stat.value}
                    {stat.suffix && <span className="text-xl ml-0.5">{stat.suffix}</span>}
                  </p>
                  <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>{stat.label}</p>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ============================================================
          SECTION 4 — Agent 执行路线图（发光流程线）
          ============================================================ */}
      <section className="relative py-28 px-6 overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
        {/* Center ambient glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(108,123,255,0.06), transparent 70%)' }}
        />

        <div className="max-w-7xl mx-auto relative z-10">
          <ScrollReveal>
            <div className="text-center mb-18">
              <p className="text-xs font-mono tracking-widest uppercase mb-4" style={{ color: 'rgba(255,255,255,0.25)' }}>
                How It Works
              </p>
              <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
                <span className="hero-title-grad">6 个 AI Agent</span>
                <br />
                <span className="hero-title-highlight">一条通往 Offer 的路线</span>
              </h2>
            </div>
          </ScrollReveal>

          {/* Desktop horizontal layout */}
          <div className="hidden lg:flex items-start justify-center gap-0">
            {roadmapSteps.map((step, i) => (
              <React.Fragment key={i}>
                <ScrollReveal delay={i * 150} className="flex flex-col items-center text-center" style={{ width: '155px' }}>
                  <div
                    className="relative w-15 h-15 rounded-2xl flex items-center justify-center mb-4 roadmap-icon-dark"
                    style={{
                      background: `linear-gradient(135deg, var(--glow-blue), var(--glow-purple))`,
                      boxShadow: `0 0 30px var(--glow-blue), 0 0 60px var(--glow-purple)`,
                    }}
                  >
                    <step.icon className="w-6.5 h-6.5 text-white" />
                  </div>
                  <p className="text-[11px] font-mono mb-1.5" style={{ color: 'rgba(255,255,255,0.18)' }}>
                    Step {String(i + 1).padStart(2, '0')}
                  </p>
                  <h4 className="text-sm font-bold mb-1" style={{ color: 'rgba(255,255,255,0.9)' }}>{step.name}</h4>
                  <p className="text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{step.title}</p>
                  <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.25)' }}>{step.desc}</p>
                </ScrollReveal>

                {/* Connector line */}
                {i < roadmapSteps.length - 1 && (
                  <div className="flex items-center pt-7" style={{ width: '52px' }}>
                    <div className="relative w-full h-px" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <div
                        className="absolute inset-0 roadmap-glow-line"
                        style={{
                          background: 'linear-gradient(90deg, transparent, rgba(108,123,255,0.6), transparent)',
                          animationDelay: `${i * 0.3}s`,
                        }}
                      />
                    </div>
                    <ArrowRight className="w-3 h-3 flex-shrink-0 ml-1" style={{ color: 'rgba(255,255,255,0.15)' }} />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Mobile vertical layout */}
          <div className="lg:hidden space-y-0">
            {roadmapSteps.map((step, i) => (
              <React.Fragment key={i}>
                <ScrollReveal delay={i * 90}>
                  <div className="flex items-start gap-4 py-4">
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center roadmap-icon-dark"
                        style={{
                          background: 'linear-gradient(135deg, rgba(108,123,255,0.4), rgba(139,92,246,0.3))',
                          boxShadow: '0 0 20px rgba(108,123,255,0.3)',
                        }}
                      >
                        <step.icon className="w-5 h-5 text-white" />
                      </div>
                      {i < roadmapSteps.length - 1 && (
                        <div className="w-0.5 flex-1 min-h-[36px] mt-2 mb-2"
                          style={{ background: 'linear-gradient(180deg, rgba(108,123,255,0.3), rgba(139,92,246,0.15))' }}
                        />
                      )}
                    </div>
                    <div className="pt-1">
                      <p className="text-[11px] font-mono mb-1" style={{ color: 'rgba(255,255,255,0.18)' }}>
                        Step {String(i + 1).padStart(2, '0')}
                      </p>
                      <h4 className="text-base font-bold" style={{ color: 'rgba(255,255,255,0.9)' }}>{step.name}</h4>
                      <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{step.title}</p>
                      <p className="text-xs mt-1 leading-relaxed" style={{ color: 'rgba(255,255,255,0.25)' }}>{step.desc}</p>
                    </div>
                  </div>
                </ScrollReveal>
              </React.Fragment>
            ))}
          </div>

          {/* Congratulations Card */}
          <ScrollReveal delay={900}>
            <div className="flex justify-center mt-16">
              <div className="congratulations-card-dark glass-card relative text-center px-12 py-10 border-yellow-500/10">
                <div className="absolute inset-0 rounded-3xl pointer-events-none"
                  style={{ background: 'radial-gradient(ellipse at center, rgba(245,158,11,0.08), transparent 70%)' }}
                />
                <div className="relative z-10">
                  <div
                    className="w-18 h-18 mx-auto mb-5 rounded-full flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, #F59E0B 0%, #EAB308 50%, #FBBF24 100%)',
                      boxShadow: '0 0 40px rgba(245,158,11,0.35), 0 0 80px rgba(245,158,11,0.15)',
                    }}
                  >
                    <Trophy className="w-9 h-9 text-white" />
                  </div>
                  <p className="text-3xl md:text-4xl font-extrabold mb-2 gradient-text-shine"
                    style={{
                      background: 'linear-gradient(135deg, #FBBF24, #F59E0B, #EAB308)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    Congratulations
                  </p>
                  <p className="text-base font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.65)' }}>Offer Received</p>
                  <p className="text-sm max-w-md mx-auto" style={{ color: 'rgba(255,255,255,0.28)' }}>
                    从简历上传到 Offer 到手，6 个 AI Agent 为你全链路护航
                  </p>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ============================================================
          SECTION 5 — 上传简历区域
          ============================================================ */}
      <section ref={uploadRef} className="relative py-28 px-6" style={{ background: 'var(--bg-primary)' }}>
        <div className="max-w-3xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-12">
              <p className="text-xs font-mono tracking-widest uppercase mb-4" style={{ color: 'rgba(255,255,255,0.25)' }}>
                Get Started
              </p>
              <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">
                <span className="hero-title-grad">准备好开始了吗？</span>
              </h2>
              <p className="mt-4 text-base" style={{ color: 'rgba(255,255,255,0.32)' }}>
                上传简历，设置求职意向，AI 即刻为你分析
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={200}>
            <div className="glass-card p-8 md:p-10">
              {/* Upload area */}
              <div className="mb-8">
                <label className="flex items-center gap-2 text-sm font-semibold mb-4" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  <FileText className="w-4 h-4 text-primary" />
                  上传简历
                  <span className="text-xs font-normal ml-2 px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    仅支持 PDF，最大 10MB
                  </span>
                </label>

                <div
                  {...getRootProps()}
                  className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-500 ${
                    isDragActive ? 'scale-[1.01]' : ''
                  }`}
                  style={{
                    borderColor: isDragActive ? 'rgba(108,123,255,0.5)'
                      : file ? 'rgba(108,123,255,0.3)'
                      : 'rgba(255,255,255,0.07)',
                    background: isDragActive ? 'rgba(108,123,255,0.05)'
                      : file ? 'rgba(108,123,255,0.03)'
                      : 'transparent',
                  }}
                >
                  <input {...getInputProps()} />

                  {file ? (
                    <div className="space-y-3">
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
                        style={{ background: 'rgba(108,123,255,0.12)' }}
                      >
                        <FileText className="w-8 h-8" style={{ color: '#818cf8' }} />
                      </div>
                      <p className="font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>{file.name}</p>
                      <p className="text-sm" style={{ color: 'rgba(255,255,255,0.28)' }}>
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null) }}
                        className="text-sm font-medium transition-colors hover:text-white"
                        style={{ color: 'rgba(255,255,255,0.35)' }}
                      >重新选择</button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
                        style={{ background: 'rgba(255,255,255,0.03)' }}
                      >
                        <Upload className="w-8 h-8" style={{ color: 'rgba(255,255,255,0.22)' }} />
                      </div>
                      <p style={{ color: 'rgba(255,255,255,0.42)' }}>
                        拖拽简历文件到此处，或{' '}
                        <span style={{ color: '#818cf8' }}>点击上传</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Position + City — 带智能联想 */}
              <div className="grid sm:grid-cols-2 gap-4 mb-8">
                <AutocompleteInput
                  value={position}
                  onChange={setPosition}
                  placeholder="例如：游戏策划、前端开发"
                  suggestions={JOB_TITLES}
                  hotTags={HOT_POSITIONS}
                  icon={Briefcase}
                  label="目标岗位"
                />
                <AutocompleteInput
                  value={city}
                  onChange={setCity}
                  placeholder="例如：北京、上海、深圳"
                  suggestions={JOB_CITIES}
                  hotTags={HOT_CITIES}
                  icon={MapPin}
                  label="目标城市"
                />
              </div>

              {/* Submit Button */}
              <button
                onClick={handleAnalyze}
                disabled={!file || !position || !city || loading}
                className={`w-full py-4 rounded-2xl font-semibold text-base flex items-center justify-center gap-2.5 transition-all duration-500 ${
                  !file || !position || !city || loading ? '' : 'hover:scale-[1.01]'
                }`}
                style={{
                  background: (!file || !position || !city || loading)
                    ? 'rgba(255,255,255,0.05)'
                    : 'linear-gradient(135deg, #6C7BFF 0%, #8B5CF6 50%, #FF7FD1 100%)',
                  color: (!file || !position || !city || loading)
                    ? 'rgba(255,255,255,0.18)'
                    : '#ffffff',
                  boxShadow: (!file || !position || !city || loading)
                    ? 'none'
                    : '0 0 36px rgba(108,123,255,0.25)',
                  cursor: (!file || !position || !city || loading) ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    分析中...
                    <div className="flex items-center gap-1 ml-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-white ai-dot-1" />
                      <span className="w-1.5 h-1.5 rounded-full bg-white ai-dot-2" />
                      <span className="w-1.5 h-1.5 rounded-full bg-white ai-dot-3" />
                    </div>
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    开始分析
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              {/* Progress bar */}
              {loading && progress && (
                <div className="mt-6 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: '#818cf8' }}>{progress.label}</span>
                    <span style={{ color: 'rgba(255,255,255,0.25)' }}>{progress.progress}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div className="h-full rounded-full transition-all duration-500 relative overflow-hidden progress-shine"
                      style={{
                        width: `${progress.progress}%`,
                        background: 'linear-gradient(90deg, #6C7BFF, #8B5CF6, #FF7FD1)',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 text-center border-t" style={{ borderColor: 'rgba(255,255,255,0.04)', background: 'var(--bg-primary)' }}>
        <div className="flex items-center justify-center gap-2.5 mb-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          >
            <Target className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.4)' }} />
          </div>
          <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Offer Hunter
          </span>
        </div>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.16)' }}>
          AI 求职助手 · From Confusion to Offer
        </p>
      </footer>

      {/* ===== 功能详情弹窗 ===== */}
    {detailFeature && (
      <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-12 bg-black/60 backdrop-blur-sm"
        onClick={() => setDetailFeature(null)}
        style={{ overflow: 'hidden' }}
      >
        <div className="glass-card max-w-xl w-full p-8 rounded-3xl shadow-2xl border border-white/10"
          onClick={e => e.stopPropagation()}
          style={{
            background: 'rgba(17,24,39,0.97)',
            maxHeight: '85vh',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
            touchAction: 'pan-y',
          }}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${detailFeature.gradientFrom}, ${detailFeature.gradientTo})`,
                  boxShadow: `0 0 30px ${detailFeature.glowColor}`,
                }}
              >
                <detailFeature.icon className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white/90">{detailFeature.title}</h3>
                <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{detailFeature.desc}</p>
              </div>
            </div>
            <button onClick={() => setDetailFeature(null)}
              className="p-1.5 hover:bg-white/[0.06] rounded-xl transition-colors"
            >
              <XCircle className="w-6 h-6" style={{ color: 'rgba(255,255,255,0.3)' }} />
            </button>
          </div>

          {/* 功能原理 */}
          <div className="glass-card p-5 mb-5 rounded-2xl border border-white/5">
            <h4 className="text-sm font-semibold text-white/75 mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4" style={{ color: detailFeature.gradientFrom }} />
              功能原理
            </h4>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {detailFeature.detail.how}
            </p>
          </div>

          {/* 处理流程 */}
          <div className="glass-card p-5 mb-5 rounded-2xl border border-white/5">
            <h4 className="text-sm font-semibold text-white/75 mb-3 flex items-center gap-2">
              <GitCompare className="w-4 h-4" style={{ color: detailFeature.gradientFrom }} />
              处理流程
            </h4>
            <div className="space-y-2">
              {detailFeature.detail.steps.map((step, si) => (
                <div key={si} className="flex items-start gap-3 p-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold"
                    style={{ background: `${detailFeature.gradientFrom}20`, color: detailFeature.gradientFrom }}
                  >{si + 1}</div>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{step}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 优势 + 耗时 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="glass-card p-4 rounded-2xl border border-white/5">
              <h4 className="text-xs font-semibold text-white/55 mb-2 flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                核心优势
              </h4>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {detailFeature.detail.advantage}
              </p>
            </div>
            <div className="glass-card p-4 rounded-2xl border border-white/5">
              <h4 className="text-xs font-semibold text-white/55 mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                处理耗时
              </h4>
              <p className="text-2xl font-bold" style={{ color: detailFeature.gradientFrom }}>
                {detailFeature.detail.time}
              </p>
            </div>
          </div>
        </div>
      </div>
    )}
    </div>
  )
}

export default HomePage
