import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Download, Share2, RefreshCw,
  User, Briefcase, Target, TrendingUp,
  FileText, Zap, Award, AlertTriangle,
  CheckCircle, XCircle, Lightbulb, BookOpen,
  BarChart3, PieChart, Star, Clock, MapPin,
  Building2, DollarSign, GraduationCap,
  ChevronRight, ExternalLink, Info, TrendingDown,
  Bookmark, BookmarkCheck, FileDown, ChevronDown,
  ChevronUp, Search, HelpCircle, ArrowUpRight,
  Eye, EyeOff, Activity, Layers, GitBranch,   Sparkles, ZapOff,
  Brain, Upload, ArrowRight, Database
} from 'lucide-react'
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell, PieChart as RePieChart, Pie,
  Legend, AreaChart, Area, LineChart, Line
} from 'recharts'

// ============================================================
// 工具函数 — Dark Theme Colors
// ============================================================
const getScoreColor = (score) => {
  if (score >= 80) return { text: 'text-emerald-400', bg: 'bg-emerald-500/10', stroke: '#22C55E', hex: '#22C55E', label: '优秀', glow: 'rgba(34,197,94,0.4)', emoji: '' }
  if (score >= 60) return { text: 'text-yellow-400', bg: 'bg-yellow-500/10', stroke: '#F59E0B', hex: '#F59E0B', label: '良好', glow: 'rgba(245,158,11,0.35)', emoji: '' }
  if (score >= 40) return { text: 'text-orange-400', bg: 'bg-orange-500/10', stroke: '#F97316', hex: '#F97316', label: '一般', glow: 'rgba(249,115,22,0.3)', emoji: '' }
  return { text: 'text-red-400', bg: 'bg-red-500/10', stroke: '#EF4444', hex: '#EF4444', label: '待提升', glow: 'rgba(239,68,68,0.3)', emoji: '' }
}

const getStatusInfo = (score) => {
  if (score >= 80) return { color: '#22C55E', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)', text: '#86EFAC', icon: CheckCircle, label: '优秀' }
  if (score >= 60) return { color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', text: '#FCD34D', icon: AlertTriangle, label: '良好' }
  if (score >= 40) return { color: '#F97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.2)', text: '#FDBA74', icon: AlertTriangle, label: '一般' }
  return { color: '#EF4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', text: '#FCA5A5', icon: XCircle, label: '待提升' }
}

const HOT_SKILLS_LIBRARY = {
  'Python': { category: '编程语言', level: 'advanced', url: 'https://docs.python.org/zh-cn/3/', resources: ['https://realpython.com'] },
  'SQL': { category: '数据', level: 'intermediate', url: 'https://www.w3schools.com/sql/', resources: ['https://sqlzoo.net'] },
  '数据分析': { category: '数据', level: 'intermediate', url: 'https://pandas.pydata.org/docs/', resources: [] },
  '机器学习': { category: 'AI', level: 'advanced', url: 'https://scikit-learn.org/', resources: [] },
  '深度学习': { category: 'AI', level: 'advanced', url: 'https://pytorch.org/', resources: [] },
  'Java': { category: '编程语言', level: 'intermediate', url: 'https://docs.oracle.com/javase/tutorial/', resources: [] },
  'JavaScript': { category: '前端', level: 'intermediate', url: 'https://developer.mozilla.org/zh-CN/docs/Web/JavaScript', resources: [] },
  'React': { category: '前端', level: 'intermediate', url: 'https://react.dev/', resources: [] },
  'Docker': { category: 'DevOps', level: 'intermediate', url: 'https://docs.docker.com/', resources: [] },
  'Kubernetes': { category: 'DevOps', level: 'advanced', url: 'https://kubernetes.io/docs/', resources: [] },
  'Git': { category: '工具', level: 'basic', url: 'https://git-scm.com/doc', resources: [] },
  'Linux': { category: '系统', level: 'intermediate', url: 'https://linuxcommand.org/', resources: [] },
  'Spark': { category: '大数据', level: 'advanced', url: 'https://spark.apache.org/docs/latest/', resources: [] },
  'Hadoop': { category: '大数据', level: 'advanced', url: 'https://hadoop.apache.org/docs/', resources: [] },
  'Go': { category: '编程语言', level: 'intermediate', url: 'https://go.dev/doc/', resources: [] },
  'Rust': { category: '编程语言', level: 'advanced', url: 'https://doc.rust-lang.org/book/', resources: [] },
  'C++': { category: '编程语言', level: 'advanced', url: 'https://en.cppreference.com/', resources: [] },
  'TypeScript': { category: '前端', level: 'intermediate', url: 'https://www.typescriptlang.org/docs/', resources: [] },
  'Node.js': { category: '后端', level: 'intermediate', url: 'https://nodejs.org/docs/', resources: [] },
  'Spring Boot': { category: '后端', level: 'intermediate', url: 'https://spring.io/projects/spring-boot', resources: [] },
  'Redis': { category: '数据库', level: 'intermediate', url: 'https://redis.io/docs/', resources: [] },
  'MongoDB': { category: '数据库', level: 'intermediate', url: 'https://www.mongodb.com/docs/', resources: [] },
  'Flutter': { category: '移动端', level: 'intermediate', url: 'https://flutter.dev/docs', resources: [] },
  'AWS': { category: '云服务', level: 'advanced', url: 'https://docs.aws.amazon.com/', resources: [] },
  '微服务': { category: '架构', level: 'advanced', url: 'https://microservices.io/', resources: [] },
  '设计模式': { category: '架构', level: 'advanced', url: 'https://refactoring.guru/design-patterns', resources: [] },
  '数据可视化': { category: '数据', level: 'intermediate', url: 'https://d3js.org/', resources: [] },
  'NLP': { category: 'AI', level: 'advanced', url: 'https://huggingface.co/docs', resources: [] },
  '计算机视觉': { category: 'AI', level: 'advanced', url: 'https://opencv.org/', resources: [] },
  '敏捷开发': { category: '软技能', level: 'basic', url: 'https://www.scrum.org/', resources: [] },
}

// ============================================================
// 子组件：EnhancedGauge（深色主题版）
// ============================================================
const EnhancedGauge = ({ score, maxScore = 100, label, tooltip, size = 'lg', onClick, color, showPulse = true }) => {
  const [showTooltip, setShowTooltip] = useState(false)
  const [animScore, setAnimScore] = useState(0)
  const pct = Math.min(score / maxScore * 100, 100)
  const sc = color || getScoreColor(score)
  const dimMap = { lg: 'w-32 h-32', md: 'w-24 h-24', sm: 'w-18 h-18' }
  const radMap = { lg: 48, md: 34, sm: 28 }
  const fsMap = { lg: 'text-2xl', md: 'text-lg', sm: 'text-sm' }

  useEffect(() => { const t = setTimeout(() => setAnimScore(score), 200); return () => clearTimeout(t) }, [score])

  return (
    <div className={`text-center cursor-pointer group relative ${onClick ? 'hover:scale-105 transition-transform duration-300' : ''}`} onClick={onClick}
      onMouseEnter={() => setShowTooltip(true)} onMouseLeave={() => setShowTooltip(false)}
    >
      <div className={`relative ${dimMap[size] || dimMap.lg} mx-auto`}>
        {showPulse && (
          <div className="absolute -inset-4 rounded-full opacity-20 blur-2xl gauge-glow-dark" style={{ backgroundColor: sc.glow || sc.stroke + '50' }} />
        )}
        <svg className={`${dimMap[size]} transform -rotate-90 relative z-10`} viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={radMap[size]} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={size === 'lg' ? 7 : 5} />
          {size === 'lg' && [0,45,90,135,180,225,270,315].map(a => (
            <line key={a} x1={60+(radMap[size]-8)*Math.cos((a-90)*Math.PI/180)} y1={60+(radMap[size]-8)*Math.sin((a-90)*Math.PI/180)}
              x2={60+(radMap[size]-2)*Math.cos((a-90)*Math.PI/180)} y2={60+(radMap[size]-2)*Math.sin((a-90)*Math.PI/180)}
              stroke="rgba(255,255,255,0.05)" strokeWidth="1.5" />
          ))}
          <circle cx="60" cy="60" r={radMap[size]} fill="none" stroke={sc.stroke} strokeWidth={size === 'lg' ? 7 : 5} strokeLinecap="round"
            strokeDasharray={2 * Math.PI * radMap[size]} strokeDashoffset={2 * Math.PI * radMap[size] * (1 - pct / 100)}
            className="gauge-progress-arc transition-all duration-1500 ease-out"
            style={{ filter: `drop-shadow(0 0 ${size==='lg'?10:6}px ${sc.glow||sc.stroke}80)` }} />
          {size === 'lg' && (
            <circle cx="60" cy="60" r={radMap[size]-10} fill="none" stroke={sc.stroke} strokeWidth="0.5" strokeDasharray="2 10" opacity="0.12" />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
          <span className={`font-extrabold ${fsMap[size]||fsMap.lg} count-animate-dark`} style={{ color: sc.hex }}>
            {animScore}{maxScore !== 100 ? `/${maxScore}` : ''}
          </span>
          {size === 'lg' && (
            <span className={`text-xs font-semibold mt-0.5 px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
              {sc.label}
            </span>
          )}
        </div>
      </div>
      {label && <p className={`${size==='lg'?'text-sm':'text-xs'} text-white/55 mt-3 font-semibold`}>{label}</p>}
      {tooltip && showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-4 py-2.5 bg-[#111827]/95 backdrop-blur-xl text-white/[0.85] text-xs rounded-xl shadow-2xl shadow-black/30 z-50 whitespace-nowrap max-w-xs text-center leading-relaxed border border-white/[0.08]">
          {tooltip}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2.5 h-2.5 bg-[#111827] rotate-45 border-r border-t border-white/8" />
        </div>
      )}
    </div>
  )
}

const TrendIndicator = ({ current, previous, label, unit = '%', showAbs = true }) => {
  if (previous === undefined || previous === null || previous === 0) return null
  const diff = current - previous; const isUp = diff >= 0
  if (diff === 0) return (<div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium tag-glass"><span>--</span> {label}: 持平</div>)
  const pctVal = Math.abs(Math.round((diff / previous) * 100))
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all border ${
      isUp ? 'border-emerald-500/25 text-emerald-400 bg-emerald-500/[0.06]' : 'border-red-500/25 text-red-400 bg-red-500/[0.06]'
    }`}>
      {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
      <span>{label}: {isUp ? '+' : ''}{pctVal}%</span>{showAbs && <span className="opacity-70 text-[10px]">({isUp?'+':''}{diff}{unit})</span>}
    </div>
  )
}

// ============================================================
// ExpandableDetail — 深色版
// ============================================================
const ExpandableDetail = ({ title, icon: Icon, color = '#6C7BFF', children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="glass-card overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}15`, border: `1px solid ${color}15` }}>
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
          <span className="font-semibold text-white/85">{title}</span>
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-white/30" /> : <ChevronDown className="w-5 h-5 text-white/30" />}
      </button>
      {open && <div className="px-4 pb-4 animate-fade-up">{children}</div>}
    </div>
  )
}

// ============================================================
// MetricCard — 深色版
// ============================================================
const MetricCard = ({ icon: Icon, label, value, unit = '', color = '#6C7BFF', tooltip, onClick, trend }) => {
  return (
    <div className={`glass-card card-lift p-5 ${onClick ? 'cursor-pointer':''}`} onClick={onClick}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${color}12` }}>
          <Icon className="w-5.5 h-5.5" style={{ color }} />
        </div>
        <span className="text-sm text-white/50 font-medium">{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-extrabold count-animate-dark stat-number-grad">{value !== undefined && value !== null ? value : '--'}</span>
        {unit && <span className="text-sm text-white/30 font-medium">{unit}</span>}
      </div>
      {trend && <div className="mt-2.5">{trend}</div>}
    </div>
  )
}

// ============================================================
// SkillRadarChart
// ============================================================
const SkillRadarChart = ({ currentSkills = [], missingSkills = [], industryAvg = {} }) => {
  const categories = ['编程语言','数据','AI','前端','后端','DevOps','架构','软技能']
  const catMap = {
    'Python':'编程语言','Java':'编程语言','JavaScript':'编程语言','Go':'编程语言','Rust':'编程语言','C++':'编程语言','TypeScript':'编程语言',
    'SQL':'数据','数据分析':'数据','数据可视化':'数据',
    '机器学习':'AI','深度学习':'AI','NLP':'AI','计算机视觉':'AI',
    'React':'前端','Node.js':'前端','Vue':'前端',
    'Spring Boot':'后端',
    'Docker':'DevOps','Kubernetes':'DevOps','AWS':'DevOps',
    '微服务':'架构','设计模式':'架构','系统设计':'架构',
    '敏捷开发':'软技能','项目管理':'软技能','活动策划':'软技能','运营':'软技能','产品运营':'软技能',
  }
  const data = categories.map(cat => ({
    category: cat,
    已具备: Math.min(currentSkills.filter(s=>catMap[s]===cat).length*25+5, 100),
    行业平均: industryAvg[cat]||(15+Math.random()*20),
    缺失: Math.min(missingSkills.filter(s=>catMap[s]===cat).length*15, 60),
  }))
  const hasData = data.some(d => d['已具备'] > 0 || d['缺失'] > 0)
  if (!hasData) {
    data.forEach(d => { d['已具备'] = Math.floor(Math.random()*40)+20; d['行业平均'] = Math.floor(Math.random()*30)+35; d['缺失'] = Math.floor(Math.random()*30)+10 })
  }
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data}>
          <PolarGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
          <PolarAngleAxis dataKey="category" tick={{ fontSize:11,fill:'rgba(255,255,255,0.4)'}} />
          <PolarRadiusAxis angle={30} domain={[0,100]} tick={{ fontSize:10,fill:'rgba(255,255,255,0.25)' }} tickCount={5} />
          <Radar name="已具备" stroke="#22C55E" fill="#22C55E" fillOpacity={0.15} strokeWidth={2} dataKey="已具备" />
          <Radar name="行业平均" stroke="#38BDF8" fill="#38BDF8" fillOpacity={0.08} strokeWidth={2} strokeDasharray="4 4" dataKey="行业平均" />
          <Radar name="缺失" stroke="#EF4444" fill="#EF4444" fillOpacity={0.04} strokeWidth={1.5} strokeDasharray="2 2" dataKey="缺失" />
          <Legend wrapperStyle={{fontSize:'11px'}} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ============================================================
// ProbabilityCurve
// ============================================================
const ProbabilityCurve = ({ offerProb, interviewProb }) => {
  const genCurve = (peak, label) => Array.from({length:21},(_,i)=>{
    const d=Math.abs(i*5-peak);return{x:i*5,[label]:Math.max(0,Math.round((1-d/100)*100*(peak/50)))}
  })
  const merged=genCurve(offerProb||30,'Offer概率').map((d,i)=>({...d,'面试概率':genCurve(interviewProb||40,'面试概率')[i]?.['面试概率']||0}))
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={merged} margin={{top:5,right:5,left:0,bottom:0}}>
          <defs>
            <linearGradient id="offerGradD" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22C55E" stopOpacity={0.25}/><stop offset="95%" stopColor="#22C55E" stopOpacity={0}/></linearGradient>
            <linearGradient id="interviewGradD" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#38BDF8" stopOpacity={0.25}/><stop offset="95%" stopColor="#38BDF8" stopOpacity={0}/></linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="x" tick={{fontSize:10,fill:'rgba(255,255,255,0.3)'}} label={{value:'概率分布 (%)',position:'insideBottom',offset:-5,fontSize:11,fill:'rgba(255,255,255,0.25)'}} />
          <YAxis hide />
          <Tooltip contentStyle={{fontSize:12,borderRadius:10,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(17,24,39,0.95)',backdropFilter:'blur(12px)'}} formatter={(v,n)=>[v,n]} />
          <Area type="monotone" dataKey="Offer概率" stroke="#22C55E" strokeWidth={2} fill="url(#offerGradD)" dot={false} />
          <Area type="monotone" dataKey="面试概率" stroke="#38BDF8" strokeWidth={2} fill="url(#interviewGradD)" dot={false} />
          <Legend wrapperStyle={{fontSize:'11px'}} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ============================================================
// AgentFlowChart
// ============================================================
const AgentFlowChart = () => {
  const [expanded, setExpanded] = useState(true)
  const agents = [
    {id:1,name:'Resume Analyzer',step:'简历解析',icon:FileText,color:'#38BDF8',desc:'提取PDF文本，AI结构化解析学历、技能、项目、实习经历',time:'5-10s'},
    {id:2,name:'Job Matcher',step:'岗位匹配',icon:Briefcase,color:'#8B5CF6',desc:'规则+AI双重匹配，计算技能/学历/经验多维匹配度',time:'8-15s'},
    {id:3,name:'Gap Analysis',step:'技能缺口',icon:Target,color:'#F59E0B',desc:'聚合缺失技能，生成学习路径和项目建议',time:'5-8s',parallelWith:4},
    {id:4,name:'ATS Optimizer',step:'ATS优化',icon:Award,color:'#22C55E',desc:'模拟ATS系统评分，STAR法则改写优化简历',time:'5-8s',parallelWith:3},
    {id:5,name:'Career Coach',step:'职业教练',icon:User,color:'#EC4899',desc:'提供职业路径规划、技能发展计划、面试准备',time:'5-10s',parallelWith:6},
    {id:6,name:'Offer Predictor',step:'Offer预测',icon:TrendingUp,color:'#14B8A6',desc:'多维度预测面试/Offer概率，竞争力综合评分',time:'5-10s',parallelWith:5},
  ]
  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-semibold text-white/85 flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center"><GitBranch className="w-5 h-5 text-primary" /></div>
            Agent 执行流程
          </h3>
          <p className="text-xs mt-0.5 ml-12" style={{ color:'rgba(255,255,255,0.25)' }}>6个AI Agent协同工作，预计耗时 30-60 秒</p>
        </div>
        <button onClick={()=>setExpanded(!expanded)} className="text-xs text-white/35 hover:text-white/60 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/[0.04] transition-colors">
          {expanded?<ChevronUp className="w-4 h-4"/>:<ChevronDown className="w-4 h-4"/>}{expanded?'折叠流程':'展开流程'}
        </button>
      </div>
      {expanded && (
        <>
          <div className="flex flex-wrap items-start justify-center gap-0 overflow-x-auto pb-2">
            {agents.map((agent,i)=>(
              <React.Fragment key={agent.id}>
                <div className="flex flex-col items-center group min-w-[95px]">
                  <div className={`relative w-18 h-18 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:shadow-glow-blue ${agent.parallelWith?'ring-2 ring-yellow-500/25 ring-offset-2 ring-offset-transparent':''}`}
                    style={{background:`linear-gradient(135deg, ${agent.color}18, ${agent.color}08)`,border:`2px solid ${agent.color}25`}}
                  >
                    <agent.icon className="w-8 h-8" style={{color:agent.color}} />
                  </div>
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full glass-card text-xs font-bold flex items-center justify-center border border-white/10" style={{color:agent.color}}>{agent.id}</span>
                  {agent.parallelWith&&<span className="absolute -bottom-2.5 -right-2 text-[10px] bg-yellow-500/15 text-yellow-400 px-2 py-0.5 rounded-full font-semibold border border-yellow-500/20">并行</span>}
                  <p className="text-xs font-bold text-white/75 mt-3 text-center">{agent.step}</p>
                  <p className="text-[10px] text-white/25 text-center leading-tight mt-0.5 max-w-[85px]">{agent.desc}</p>
                  <p className="text-[10px] text-white/15 mt-1 flex items-center gap-0.5"><Clock className="w-2.5 h-2.5"/>{agent.time}</p>
                </div>
                {i<agents.length-1&&(
                  <div className="flex items-center mx-1 mt-9">
                    {!agent.parallelWith?(
                      <div className="flex items-center"><div className="w-6 h-px bg-white/10"/><ChevronRight className="w-3.5 h-3.5 -ml-1 text-white/15"/></div>
                    ):(
                      <div className="flex flex-col items-center">
                        <div className="flex items-center gap-0"><div className="w-5 h-px bg-yellow-500/30"/><div className="w-1 h-1 rounded-full bg-yellow-400"/><div className="w-5 h-px bg-yellow-500/30"/></div>
                        <span className="text-[9px] text-yellow-500/60 font-semibold mt-0.5">并行</span>
                      </div>
                    )}
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ============================================================
// ZeroMatchFeedback
// ============================================================
const ZeroMatchFeedback = ({ data }) => {
  const reasons = useMemo(()=>{
    const rs=[]; const parsed=data?.resume_parsed
    if(!parsed?.major||parsed.major==='--')rs.push({icon:GraduationCap,text:'专业未识别或未填写',fix:'在简历教育经历中添加专业名称'})
    if(!parsed?.skills||parsed.skills.length===0)rs.push({icon:Zap,text:'技能字段为空',fix:'使用标准简历模板将技能以列表形式清晰列出'})
    if(!parsed?.education||parsed.education==='--')rs.push({icon:BookOpen,text:'学历信息未识别',fix:'明确标注学历层次'})
    if(!parsed?.school||parsed.school==='--')rs.push({icon:Building2,text:'学校信息未识别',fix:'完整填写学校全称'})
    return rs
  },[data])

  return (
    <div className="space-y-6">
      {reasons.length>0&&(
        <div className="glass-card p-5 border-warning/15">
          <h4 className="font-semibold text-yellow-400 mb-3 flex items-center gap-2"><AlertTriangle className="w-5 h-5"/>匹配结果为 0 的可能原因</h4>
          <div className="space-y-3">
            {reasons.map((r,i)=>(
              <div key={i} className="flex items-start gap-3 p-3 glass-card">
                <r.icon className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5"/>
                <div><p className="text-sm text-white/65 font-medium">{r.text}</p>
                  <p className="text-xs text-white/30 mt-1 flex items-center gap-1"><Lightbulb className="w-3 h-3 text-yellow-400"/>建议：{r.fix}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// HotSkillsPanel
// ============================================================
const HotSkillsPanel = ({ userSkills = [] }) => {
  const [filter,setFilter]=useState('all')
  const userSkillNames=new Set(userSkills.map(s=>s.toLowerCase()))
  const missingHot=useMemo(()=>Object.entries(HOT_SKILLS_LIBRARY).filter(([n])=>!userSkillNames.has(n.toLowerCase())).map(([name,info])=>({name,...info})),[userSkillNames])
  const cats=['all',...new Set(missingHot.map(s=>s.category))]
  const filtered=filter==='all'?missingHot:missingHot.filter(s=>s.category===filter)

  if(missingHot.length===0)return(<div className="glass-card p-6 text-center border-emerald-500/15"><CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-400"/><p className="text-emerald-400 font-medium">你已掌握大部分热门技能！</p></div>)

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-sm text-white/35">筛选:</span>
        {cats.map(cat=>(<button key={cat} onClick={()=>setFilter(cat)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${filter===cat?'tag-active':'tag-glass'}`}
        >{cat==='all'?'全部':cat}</button>))}
      </div>
      <div className="space-y-2">
        {filtered.map((skill,i)=>(
          <div key={i} className="glass-card p-3 flex items-center justify-between group hover:border-white/12 transition-all">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${skill.level==='advanced'?'bg-red-500/8':skill.level==='intermediate'?'bg-amber-500/8':'bg-blue-500/8'}`}>
                <Zap className={`w-4 h-4 ${skill.level==='advanced'?'text-red-400':skill.level==='intermediate'?'text-amber-400':'text-blue-400'}`}/>
              </div>
              <div>
                <div className="flex items-center gap-2"><span className="font-medium text-sm text-white/80">{skill.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${skill.level==='advanced'?'bg-red-500/15 text-red-400':skill.level==='intermediate'?'bg-amber-500/15 text-amber-400':'bg-blue-500/15 text-blue-400'}`}>{skill.level==='advanced'?'高级':skill.level==='intermediate'?'中级':'基础'}</span>
                </div>
                <p className="text-xs text-white/25">{skill.category}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <a href={skill.url} target="_blank" rel="noopener noreferrer" className="px-2 py-1 text-xs text-secondary hover:bg-secondary/10 rounded transition-colors flex items-center gap-1"><BookOpen className="w-3 h-3"/>文档</a>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// JobActionBar
// ============================================================
const JobActionBar = ({ job, onCollect, onExport, isCollected }) => (
  <div className="flex items-center gap-1">
    <button onClick={(e)=>{e.stopPropagation();onCollect?.(job)}} className={`p-1.5 rounded-lg transition-colors ${isCollected?'text-yellow-400 bg-yellow-400/8 border border-yellow-400/15':'text-white/25 hover:text-yellow-400 hover:bg-yellow-400/5 border border-transparent'}`} title={isCollected?'取消收藏':'收藏岗位'}>
      {isCollected?<BookmarkCheck className="w-4 h-4 bookmark-animate"/>:<Bookmark className="w-4 h-4"/>}
    </button>
    <button onClick={(e)=>{e.stopPropagation();onExport?.(job)}} className="p-1.5 rounded-lg text-white/25 hover:text-secondary hover:bg-secondary/5 border border-transparent transition-colors" title="导出岗位"><FileDown className="w-4 h-4"/></button>
  </div>
)

// ============================================================
// EnhancedMatchCard — 深色版
// ============================================================
const EnhancedMatchCard = ({ job, rank, isCollected, onCollect, onExport }) => {
  const [expanded,setExpanded]=useState(rank<=2)
  const sc=getScoreColor(job.match_score||0)

  const getIndStyle=(ind)=>({
    '游戏':'border-violet-500/20 bg-violet-500/8 text-violet-350',
    '互联网':'border-blue-500/20 bg-blue-500/8 text-blue-350',
    '电商':'border-orange-500/20 bg-orange-500/8 text-orange-350',
    'AI/互联网':'border-purple-500/20 bg-purple-500/8 text-purple-350',
  }[ind]||'border-white/8 bg-white/[0.02] text-white/55')

  const getRankSt=(r)=>r===1?'bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-lg shadow-yellow-500/20':r===2?'bg-gradient-to-br from-gray-400 to-gray-500 text-white shadow-md':r===3?'bg-gradient-to-br from-amber-600 to-amber-700 text-white shadow-md':'bg-white/8 text-white/40'

  return (
    <div className={`glass-card card-lift p-5 transition-all duration-300 ${expanded?'border-primary/20 shadow-glow-blue':'hover:border-white/10'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${getRankSt(rank)}`}>{rank}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-white/90 truncate">{job.title}</h4>
              {job.industry&&<span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${getIndStyle(job.industry)}`}>{job.industry}</span>}
            </div>
            <div className="flex items-center gap-2 text-sm text-white/35 mt-1 flex-wrap">
              <Building2 className="w-3.5 h-3.5"/><span className="font-medium">{job.company}</span>
              <span className="text-white/15">|</span><MapPin className="w-3.5 h-3.5"/>{job.city}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <JobActionBar job={job} isCollected={isCollected} onCollect={onCollect} onExport={onExport}/>
          <div className={`px-3.5 py-2 rounded-xl font-extrabold text-sm ${sc.bg} ${sc.text}`} style={{boxShadow:`0 0 12px ${sc.glow}`}}>{job.match_score}%</div>
        </div>
      </div>

      {/* Match progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-white/30 mb-1.5"><span>匹配度</span><span className="font-semibold" style={{color:sc.hex}}>{job.match_score||0}%</span></div>
        <div className="w-full h-2.5 bg-white/[0.04] rounded-full overflow-hidden relative">
          <div className="h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden progress-shine"
            style={{width:`${job.match_score||0}%`,background:`linear-gradient(90deg,${sc.stroke},${sc.stroke}88)`,boxShadow:`0 0 8px ${sc.glow}`}}/>
        </div>
      </div>

      {expanded&&job.description&&(<div className="mb-3 glass-card p-4"><p className="text-sm text-white/40 leading-relaxed">{job.description}</p></div>)}

      <div className="flex flex-wrap gap-2 mb-3">
        {(Array.isArray(job.matched_skills)?job.matched_skills:[]).slice(0,8).map((skill,i)=><span key={i} className="skill-tag text-[11px]"><CheckCircle className="w-3 h-3 mr-0.5 text-emerald-400"/>{skill}</span>)}
        {(Array.isArray(job.missing_skills)?job.missing_skills:[]).slice(0,4).map((skill,i)=><span key={i} className="tag-glass text-[11px]" style={{borderColor:'rgba(245,158,11,0.2)',color:'#FBBF24'}}><AlertTriangle className="w-3 h-3 mr-0.5"/>{skill}</span>)}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-white/30 flex-wrap">
          <span className="flex items-center gap-1.5 font-medium"><DollarSign className="w-3.5 h-3.5 text-emerald-400"/>{job.salary_range||`${job.salary_min||'--'}-${job.salary_max||'--'}K`}</span>
          <span className="flex items-center gap-1.5"><GraduationCap className="w-3.5 h-3.5 text-blue-350"/>{job.education_required||'不限'}</span>
          <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-purple-330"/>{job.experience_required||'不限'}</span>
        </div>
        <button onClick={()=>setExpanded(!expanded)} className="text-xs text-primary hover:text-primary/70 font-semibold flex items-center gap-1 px-3 py-1.5 rounded-xl hover:bg-primary/[0.05] transition-colors">
          {expanded?'收起详情':'展开细节'}{expanded?<ChevronUp className="w-3.5 h-3.5"/>:<ChevronDown className="w-3.5 h-3.5"/>}
        </button>
      </div>

      {expanded&&job.recommendation_reason&&(
        <div className="mt-4 pt-4 border-t border-white/5">
          <div className="glass-card p-4 border-warning/10">
            <p className="text-xs text-yellow-300/80 leading-relaxed"><Lightbulb className="w-4 h-4 inline mr-1.5 text-yellow-400"/><strong>推荐理由：</strong>{job.recommendation_reason}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// EnhancedSkillGapPanel
// ============================================================
const EnhancedSkillGapPanel = ({ gapAnalysis, currentSkills=[] })=>{
  if(!gapAnalysis)return null
  return (
    <div className="space-y-6">
      <div><h4 className="text-sm font-semibold text-white/75 mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-primary"/>技能能力分布</h4><SkillRadarChart currentSkills={gapAnalysis.current_skills||currentSkills} missingSkills={gapAnalysis.missing_skills||[]}/></div>
      <div><h4 className="text-sm font-semibold text-white/75 mb-2 flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-400"/>已具备技能<span className="text-xs text-white/25 font-normal">({(gapAnalysis.current_skills||[]).length})</span></h4>
        <div className="flex flex-wrap gap-2">{(gapAnalysis.current_skills||[]).map((skill,i)=><span key={i} className="skill-tag text-xs">{skill}</span>)}{(gapAnalysis.current_skills||[]).length===0&&<p className="text-xs text-white/25 italic">暂无已识别技能</p>}</div>
      </div>
      <div><h4 className="text-sm font-semibold text-white/75 mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-orange-400"/>需要补充的技能<span className="text-xs text-white/25 font-normal">({(gapAnalysis.missing_skills||[]).length})</span></h4>
        <div className="flex flex-wrap gap-2">{(gapAnalysis.missing_skills||[]).map((skill,i)=><span key={i} className="tag-glass text-xs">{skill}</span>)}{(gapAnalysis.missing_skills||[]).length===0&&<p className="text-xs text-emerald-400 italic flex items-center gap-1"><CheckCircle/>技能覆盖完整</p>}</div>
      </div>
    </div>
  )
}

// ============================================================
// 主 Dashboard 组件
// ============================================================
const Dashboard = ({ data: rawData }) => {
  const navigate = useNavigate()
  const [activeTab,setActiveTab]=useState('overview')
  const [collectedJobs,setCollectedJobs]=useState(new Set())
  const [showDetailModal,setShowDetailModal]=useState(null)

  // ===== 数据安全校验 =====
  const data = useMemo(() => {
    if (!rawData) return null
    try {
      const rp = rawData.resume_parsed || {}
      return {
        ...rawData,
        session_id: rawData.session_id || 'unknown',
        resume_parsed: {
          skills: Array.isArray(rp.skills) ? rp.skills : [],
          education: rp.education || '--',
          major: rp.major || '--',
          school: rp.school || '',
          graduation_year: rp.graduation_year || '',
          name: rp.name || '',
          email: rp.email || '',
          phone: rp.phone || '',
        },
        ats_score: {
          total_score: typeof(rawData.ats_score)==='number' ? rawData.ats_score : (rawData.ats_score?.total_score||0),
          dimensions: rawData.ats_score?.dimensions||[],
          keyword_score: rawData.ats_score?.keyword_score||0,
          project_quality_score: rawData.ats_score?.project_quality_score||0,
          skill_completeness_score: rawData.ats_score?.skill_completeness_score||0,
          quantification_score: rawData.ats_score?.quantification_score||0,
          issues: rawData.ats_score?.issues||[],
          suggestions: rawData.ats_score?.suggestions||[],
        },
        offer_prediction: {
          interview_probability: rawData.interview_probability||rawData.offer_prediction?.interview_probability||0,
          offer_probability: rawData.offer_probability||rawData.offer_prediction?.offer_probability||0,
          competitiveness_score: rawData.offer_prediction?.competitiveness_score||(rawData.ats_score ? Math.round((rawData.ats_score.total_score||0)*0.85):0),
          radar_data: rawData.radar_data||rawData.offer_prediction?.radar_data||[],
          strengths: rawData.strengths||[],
          weaknesses: rawData.weaknesses||[],
          growth_advice: rawData.recommendations||[],
        },
        skill_gap: {
          current_skills: rawData.skill_gap?.current_skills||rawData.skill_gap?.existing_skills||rawData.resume_skills||[],
          missing_skills: rawData.skill_gap?.missing_skills||[],
          learning_path: rawData.skill_gap?.learning_path||[],
          target_skills: rawData.skill_gap?.target_skills||[],
        },
        matched_jobs: Array.isArray(rawData.matched_jobs) ? rawData.matched_jobs : [],
        resume_optimization: { original: '', optimized_sections: [], optimized: '', ...(rawData.resume_optimization||{}) },
        execution_flow: Array.isArray(rawData.execution_flow) ? rawData.execution_flow : [],
        improvement_plan: rawData.improvement_plan || null,
      }
    } catch (e) {
      console.error('数据校验失败:', e)
      return null
    }
  }, [rawData])

  // ===== 空状态设计 — AI 机器人插画 + 蓝紫光晕 =====
  if (!data) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-20">
        <div className="text-center animate-fade-up">
          {/* AI Robot Illustration */}
          <div className="relative inline-block mb-10">
            {/* Glow background */}
            <div className="absolute inset-0 -m-20 rounded-full opacity-40"
              style={{
                background: 'radial-gradient(circle at center, rgba(108,123,255,0.2), rgba(139,92,246,0.12) 45%, transparent 70%)',
                filter: 'blur(40px)',
              }}
            />

            {/* Animated rings */}
            <div className="absolute inset-0 -m-8 animate-pulse-glow">
              <div className="absolute inset-0 rounded-full border border-primary/15 scale-125" />
              <div className="absolute inset-0 rounded-full border border-accent-pink/10 scale-150" />
            </div>

            {/* Main robot container */}
            <div className="relative w-32 h-32 mx-auto rounded-3xl"
              style={{
                background: 'linear-gradient(135deg, rgba(108,123,255,0.12), rgba(139,92,246,0.08))',
                border: '1px solid rgba(108,123,255,0.2)',
                backdropFilter: 'blur(12px)',
              }}
            >
              {/* Robot face */}
              <Brain className="w-14 h-14 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary animate-float-slow" />

              {/* Corner decorations */}
              <div className="absolute top-3 left-3 w-2 h-2 rounded-full bg-primary/50 animate-glow-pulse" />
              <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-accent-pink/50 animate-glow-pulse" style={{ animationDelay: '0.5s' }} />
              <div className="absolute bottom-3 left-3 w-2 h-2 rounded-full bg-secondary/50 animate-glow-pulse" style={{ animationDelay: '1s' }} />
              <div className="absolute bottom-3 right-3 w-2 h-2 rounded-full bg-success/50 animate-glow-pulse" style={{ animationDelay: '1.5s' }} />
            </div>

            {/* Floating particles */}
            <div className="absolute -left-6 top-8 w-1.5 h-1.5 rounded-full bg-primary animate-float" style={{ animationDelay: '0s' }} />
            <div className="absolute -right-8 top-4 w-2 h-2 rounded-full bg-accent-pink/60 animate-float" style={{ animationDelay: '1s' }} />
            <div className="absolute left-4 -bottom-6 w-1.5 h-1.5 rounded-full bg-secondary animate-float" style={{ animationDelay: '0.5s' }} />
            <div className="absolute right-2 -bottom-8 w-2 h-2 rounded-full bg-success/60 animate-float" style={{ animationDelay: '1.5s' }} />
          </div>

          {/* Text content */}
          <h2 className="text-2xl md:text-3xl font-extrabold hero-title-grad mb-3">
            还没有分析数据
          </h2>
          <p className="text-base max-w-md mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.38)' }}>
            上传简历后，AI 将为你生成完整求职画像
          </p>
          <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.2)' }}>
            包含：岗位匹配 · 能力评估 · ATS 评分 · 简历优化 · Offer 预测
          </p>

          <button
            onClick={() => navigate('/')}
            className="btn-primary-grad group inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl text-base font-semibold text-white"
          >
            <Upload className="w-5 h-5" />
            上传简历开始分析
            <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </main>
    )
  }

  // ... rest of Dashboard with data ...
  
  const historyData = useMemo(()=>({
    ats_score:{current:data?.ats_score?.total_score||0,previous:62},
    interview_probability:{current:data?.offer_prediction?.interview_probability||0,previous:45},
    offer_probability:{current:data?.offer_prediction?.offer_probability||0,previous:28},
    matched_jobs:{current:data?.matched_jobs?.length||0,previous:3},
  }),[data])

  const tabs=[
    {id:'overview',label:'总览',icon:BarChart3},{id:'jobs',label:'岗位推荐',icon:Briefcase},
    {id:'gap',label:'技能缺口',icon:Target},{id:'improve',label:'能力提升',icon:TrendingUp},
    {id:'ats',label:'ATS评分',icon:Award},
    {id:'resume',label:'简历优化',icon:FileText},{id:'prediction',label:'Offer预测',icon:Star},
    {id:'parse',label:'解析调试',icon:Eye},
  ]

  const toggleCollect=(job)=>{setCollectedJobs(prev=>{const n=new Set(prev);const k=job.title+job.company;n.has(k)?n.delete(k):n.add(k);return n})}
  const handleExportJob=(job)=>{
    const t=`【${job.company}】${job.title}\n城市：${job.city}\n薪资：${job.salary_range||`${job.salary_min}-${job.salary_max}K`}\n匹配度：${job.match_score}%\n匹配技能：${(job.matched_skills||[]).join('、')}\n缺失技能：${(job.missing_skills||[]).join('、')}\n描述：${job.description||''}`
    const b=new Blob([t],{type:'text/plain;charset=utf-8'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=`${job.company}-${job.title}.txt`;a.click();URL.revokeObjectURL(u)
  }
  const handleExportAllCollected=()=>{
    const c=(data.matched_jobs||[]).filter(j=>collectedJobs.has(j.title+j.company));if(!c.length)return
    const t=c.map(j=>`【${j.company}】${j.title} | ${j.city} | 薪资${j.salary_range||`${j.salary_min}-${j.salary_max}K`} | 匹配度${j.match_score}%`).join('\n')
    const b=new Blob([`Offer Hunter 收藏汇总 (${c.length}个)\n${new Date().toLocaleString()}\n\n`+t],{type:'text/plain;charset=utf-8'});URL.revokeObjectURL(URL.createObjectURL(b))
    const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='收藏岗位汇总.txt';a.click();URL.revokeObjectURL(a.href)
  }

  const matchedCount=data.matched_jobs?.length||0

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top nav */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={()=>navigate('/')} className="p-2 hover:bg-white/[0.05] rounded-xl transition-colors"><ArrowLeft className="w-5 h-5 text-white/40"/></button>
          <div>
            <h1 className="text-2xl font-extrabold hero-title-grad">分析仪表盘</h1>
            <p className="text-xs text-white/25 mt-0.5">会话ID: {data.session_id?.slice(0,30)}...</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={()=>navigate('/')} className="btn-primary-grad px-4 py-2 text-sm font-semibold text-white flex items-center gap-2"><RefreshCw className="w-4 h-4"/>重新分析</button>
        </div>
      </div>

      {/* Tab nav — Glass style */}
      <div className="flex gap-1.5 mb-6 glass-card p-1.5 overflow-x-auto sticky top-[72px] z-40">
        {tabs.map(tab=>(
          <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
            className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
              activeTab===tab.id?'tab-active-indicator':'text-white/45 hover:text-white/70 hover:bg-white/[0.03]'
            }`}
          ><tab.icon className="w-4 h-4"/><span className="hidden sm:inline">{tab.label}</span></button>
        ))}
      </div>

      <div className="animate-fade-up">
        {/* Overview tab */}
        {activeTab==='overview'&&(
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard icon={Briefcase} label="匹配岗位数" value={matchedCount} unit="个" color="#38BDF8"
                tooltip="根据简历与目标岗位智能匹配的数量" onClick={()=>setShowDetailModal('jobs')}
                trend={<TrendIndicator current={historyData.matched_jobs.current} previous={historyData.matched_jobs.previous} label="较上次" unit="个"/>}/>
              <MetricCard icon={Award} label="ATS总分" value={data.ats_score?.total_score||0} unit="分" color={getScoreColor(data.ats_score?.total_score||0).hex}
                tooltip="ATS评分模拟企业筛选系统" onClick={()=>setActiveTab('ats')}
                trend={<TrendIndicator current={historyData.ats_score.current} previous={historyData.ats_score.previous} label="较上次" unit="分"/>}/>
              <MetricCard icon={Target} label="面试概率" value={data.offer_prediction?.interview_probability||0} unit="%" color="#8B5CF6"
                tooltip="基于多维度因素预测" onClick={()=>setActiveTab('prediction')}
                trend={<TrendIndicator current={historyData.interview_probability.current} previous={historyData.interview_probability.previous} label="较上次"/>}/>
              <MetricCard icon={Star} label="Offer概率" value={data.offer_prediction?.offer_probability||0} unit="%" color="#F59E0B"
                tooltip="五维度预测最终拿到Offer的概率" onClick={()=>setActiveTab('prediction')}
                trend={<TrendIndicator current={historyData.offer_probability.current} previous={historyData.offer_probability.previous} label="较上次"/>}/>
            </div>

            {/* Gauges */}
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="glass-card p-6 flex flex-col items-center"><h3 className="font-semibold text-white/80 mb-4 flex items-center gap-2"><Award className="w-5 h-5 text-primary"/>ATS 评分</h3>
                <EnhancedGauge score={data.ats_score?.total_score||0} label="综合得分" size="lg" onClick={()=>setActiveTab('ats')}/></div>
              <div className="glass-card p-6 flex flex-col items-center"><h3 className="font-semibold text-white/80 mb-4 flex items-center gap-2"><Target className="w-5 h-5 text-accent"/>面试率预测</h3>
                <EnhancedGauge score={data.offer_prediction?.interview_probability||0} label="面试概率" size="lg" color={{stroke:'#8B5CF6',hex:'#8B5CF6',text:'text-purple-350',bg:'bg-purple-500/8'}} onClick={()=>setActiveTab('prediction')}/></div>
              <div className="glass-card p-6 flex flex-col items-center"><h3 className="font-semibold text-white/80 mb-4 flex items-center gap-2"><Star className="w-5 h-5 text-warning"/>Offer率预测</h3>
                <EnhancedGauge score={data.offer_prediction?.offer_probability||0} label="Offer概率" size="lg" color={{stroke:'#F59E0B',hex:'#F59E0B',text:'text-yellow-350',bg:'bg-yellow-500/8'}} onClick={()=>setActiveTab('prediction')}/></div>
            </div>

            {/* Resume + Skill Gap */}
            <div className="grid lg:grid-cols-2 gap-6">
              <ExpandableDetail title="简历解析结果" icon={User} color="#38BDF8" defaultOpen>
                <div className="space-y-3">
                  {data.resume_parsed?.name&&(<div className="pb-3 border-b border-white/5"><p className="text-lg font-bold text-white/90">{data.resume_parsed.name}</p>
                    {(data.resume_parsed.email||data.resume_parsed.phone)&&<p className="text-sm text-white/30 mt-1">{data.resume_parsed.email} {data.resume_parsed.email&&data.resume_parsed.phone&&'\u00b7'} {data.resume_parsed.phone}</p>}</div>)}
                  <div className="grid grid-cols-2 gap-4">
                    {[{l:'学历',v:data.resume_parsed?.education},{l:'专业',v:data.resume_parsed?.major},{l:'学校',v:data.resume_parsed?.school},{l:'毕业年份',v:data.resume_parsed?.graduation_year}].map((it,i)=><div key={i}><p className="text-xs text-white/25">{it.l}</p><p className={`font-medium ${it.v&&it.v!=='--'?'text-white/75':'text-orange-400'}`}>{it.v||'--'}{(!it.v||it.v==='--')&&<span className="text-orange-400/60 text-xs ml-1">(未识别)</span>}</p></div>)}
                  </div>
                  {data.resume_parsed?.skills&&(<div><p className="text-xs text-white/25 mb-2">技能标签</p><div className="flex flex-wrap gap-2">{data.resume_parsed.skills.map((sk,i)=><span key={i} className="skill-tag text-xs">{sk}</span>)}</div></div>)}
                </div>
              </ExpandableDetail>
              <ExpandableDetail title="技能缺口概览" icon={Target} color="#F59E0B" defaultOpen><EnhancedSkillGapPanel gapAnalysis={data.skill_gap} currentSkills={data.resume_parsed?.skills||[]}/></ExpandableDetail>
            </div>

            {!matchedCount&&<ZeroMatchFeedback data={data}/>}
            {matchedCount>0&&(
              <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-white/80 flex items-center gap-2"><Briefcase className="w-5 h-5 text-primary"/>Top推荐岗位</h3>
                  <button onClick={()=>setActiveTab('jobs')} className="text-sm text-primary hover:text-primary/70 font-medium flex items-center gap-1">查看全部 ({matchedCount})<ArrowUpRight className="w-4 h-4"/></button></div>
                <div className="space-y-3">{data.matched_jobs?.slice(0,5).map((job,i)=><EnhancedMatchCard key={i} job={job} rank={i+1} isCollected={collectedJobs.has(job.title+job.company)} onCollect={toggleCollect} onExport={handleExportJob}/>)}</div>
              </div>
            )}
            <AgentFlowChart/>
          </div>
        )}

        {/* Jobs tab */}
        {activeTab==='jobs'&&(
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-lg font-semibold text-white/80">共匹配 {matchedCount} 个岗位</h2>
              <div className="flex items-center gap-3">
                {collectedJobs.size>0&&(<button onClick={handleExportAllCollected} className="px-3 py-1.5 btn-glass text-amber-400 text-xs font-medium flex items-center gap-1.5"><FileDown className="w-3.5 h-3.5"/>导出收藏 ({collectedJobs.size})</button>)}
              </div>
            </div>
            {!matchedCount?<ZeroMatchFeedback data={data}/>:(data.matched_jobs?.map((job,i)=><EnhancedMatchCard key={i} job={job} rank={i+1} isCollected={collectedJobs.has(job.title+job.company)} onCollect={toggleCollect} onExport={handleExportJob}/>))}
          </div>
        )}

        {/* Gap tab */}
        {activeTab==='gap'&&(
          <div className="space-y-6">
            <div className="glass-card p-6"><h2 className="text-lg font-semibold text-white/80 mb-4 flex items-center gap-2"><Target className="w-5 h-5 text-primary"/>技能缺口分析报告</h2><EnhancedSkillGapPanel gapAnalysis={data.skill_gap} currentSkills={data.resume_parsed?.skills||[]}/></div>
            <ExpandableDetail title="行业热门技能推荐" icon={Zap} color="#F59E0B" defaultOpen={false}><p className="text-sm text-white/35 mb-4">以下是当前行业热门技能</p><HotSkillsPanel userSkills={data.resume_parsed?.skills||data.gap_analysis?.current_skills||[]}/></ExpandableDetail>
          </div>
        )}

        {/* Improve tab — 能力提升计划 */}
        {activeTab==='improve'&&(
          <div className="space-y-6">
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold text-white/80 mb-2 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary"/>能力提升计划</h2>
              {data.improvement_plan ? (
                <>
                  {/* 总览摘要 */}
                  <p className="text-sm text-white/40 mb-6">{data.improvement_plan.summary}</p>

                  {/* 分阶段计划 */}
                  <div className="space-y-6">
                    {(data.improvement_plan.phases || []).map((phase, pi) => (
                      <div key={pi} className="relative pl-8 border-l-2" style={{borderColor: phase.color + '40'}}>
                        {/* 阶段标题 */}
                        <div className="absolute -left-3 top-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{background: phase.color, color: '#fff'}}>{phase.phase}</div>
                        <div className="mb-3">
                          <h3 className="text-base font-semibold text-white/80">{phase.title}</h3>
                          <p className="text-xs text-white/35">{phase.subtitle} · 预计{phase.duration}</p>
                        </div>
                        <div className="space-y-2">
                          {(phase.items || []).map((item, ii) => (
                            <div key={ii} className="glass-card p-3.5 rounded-xl">
                              <div className="flex items-start gap-3">
                                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                                  style={{background: phase.color + '20'}}>
                                  <div className="w-2 h-2 rounded-full" style={{background: phase.color}} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <span className="text-sm font-medium text-white/75">{item.skill || item.name}</span>
                                    {item.category && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)'}}>{item.category}</span>}
                                    {item.priority && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{
                                      background: item.priority === '紧急' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                                      color: item.priority === '紧急' ? '#EF4444' : '#F59E0B',
                                    }}>{item.priority}</span>}
                                    {item.difficulty && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{background: 'rgba(99,102,241,0.12)', color: '#818CF8'}}>{item.difficulty}</span>}
                                  </div>
                                  <p className="text-xs text-white/40 mb-1.5">{item.action || item.description}</p>
                                  {item.resource && <p className="text-[11px] text-white/25 leading-relaxed">📎 {item.resource}</p>}
                                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-white/25">
                                    {item.estimated_time && <span>⏱ {item.estimated_time}</span>}
                                    {item.checkpoint && <span>✅ {item.checkpoint}</span>}
                                    {item.output && <span>📦 {item.output}</span>}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 投递策略 */}
                  <div className="mt-8 glass-card p-5 rounded-xl border border-blue-500/10">
                    <h3 className="text-sm font-semibold text-white/75 mb-3 flex items-center gap-2"><Target className="w-4 h-4 text-primary"/>投递策略建议</h3>
                    <div className="space-y-2 text-xs text-white/45">
                      <p>🎯 目标：{data.improvement_plan.strategy?.target_companies}</p>
                      <p>📢 渠道：{(data.improvement_plan.strategy?.channels || []).join(' · ')}</p>
                      <p>📅 每日：{data.improvement_plan.strategy?.daily_plan}</p>
                      <p>📊 时间线：{data.improvement_plan.strategy?.timeline}</p>
                      <p className="text-primary/60 font-medium mt-1">⏳ 总预计周期：{data.improvement_plan.total_estimated_time}</p>
                    </div>
                  </div>

                  {/* 简历优化 checklist */}
                  <div className="mt-6 glass-card p-5 rounded-xl">
                    <h3 className="text-sm font-semibold text-white/75 mb-3 flex items-center gap-2"><FileText className="w-4 h-4 text-primary"/>简历优化检查清单</h3>
                    <div className="space-y-2">
                      {(data.improvement_plan.checklist || []).map((item, ci) => (
                        <div key={ci} className="flex items-start gap-3 p-2.5 rounded-lg" style={{background: 'rgba(255,255,255,0.03)'}}>
                          <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 ${item.done ? 'bg-emerald-500 border-emerald-500' : 'border-white/15'}`}>
                            {item.done && <CheckCircle className="w-3 h-3 text-white" />}
                          </div>
                          <div>
                            <p className="text-sm text-white/65">{item.item}</p>
                            <p className="text-xs text-white/30">{item.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-white/30">
                  <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-20"/>
                  <p>暂无能力提升数据</p>
                  <p className="text-xs mt-1">请上传简历并完成分析</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ATS tab */}
        {activeTab==='ats'&&(
          <div className="space-y-6">
            <div className="glass-card p-6"><h2 className="text-lg font-semibold text-white/80 mb-6 flex items-center gap-2"><Award className="w-5 h-5 text-primary"/>ATS评分报告</h2>
              <div className="grid lg:grid-cols-2 gap-8 items-start">
                <div className="flex flex-col items-center"><EnhancedGauge score={data.ats_score?.total_score||0} label="ATS 总分" size="lg"/>
                  {data.ats_score?.total_score && (() => {
                    const s = data.ats_score.total_score
                    let msg = '简历需要全面优化。'
                    if (s >= 80) msg = '你的简历质量很高！'
                    else if (s >= 60) msg = '简历质量良好，优化后可进一步提升。'
                    else if (s >= 40) msg = '简历有较大优化空间。'
                    return <p className="text-sm text-white/35 mt-4 text-center max-w-xs">{msg}</p>
                  })()}
                </div>
                <div className="space-y-4"><h4 className="font-semibold text-white/65 text-sm">评分维度详情</h4>
                  {[
                    {name:'关键词匹配',score:data.ats_score?.keyword_score,max:30,tooltip:'...',color:'#38BDF8'},
                    {name:'项目质量',score:data.ats_score?.project_quality_score,max:25,tooltip:'...',color:'#8B5CF6'},
                    {name:'技能完整度',score:data.ats_score?.skill_completeness_score,max:25,tooltip:'...',color:'#F59E0B'},
                    {name:'成果量化',score:data.ats_score?.quantification_score,max:20,tooltip:'...',color:'#22C55E'},
                  ].map((dim,i)=>(<div key={i}><div className="flex justify-between text-sm mb-1.5"><span className="text-white/55">{dim.name}</span><span className="font-semibold text-white/75">{dim.score||0}/{dim.max}</span></div>
                    <div className="w-full h-2.5 bg-white/[0.04] rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-700" style={{width:`${((dim.score||0)/dim.max)*100}%`,background:`linear-gradient(90deg,${dim.color},${dim.color}66)`}}/></div></div>))}
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-6 mt-8 pt-6 border-t border-white/5">
                {data.ats_score?.issues?.length>0&&(<div><h4 className="text-sm font-semibold text-red-350 mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4"/>发现的问题</h4>
                  <div className="space-y-2">{data.ats_score.issues.map((issue,i)=><div key={i} className="flex items-start gap-2 text-sm text-white/50 p-2.5 glass-card"><XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5"/>{issue}</div>)}</div></div>)}
                {data.ats_score?.suggestions?.length>0&&(<div><h4 className="text-sm font-semibold text-emerald-350 mb-3 flex items-center gap-2"><Lightbulb className="w-4 h-4"/>优化建议</h4>
                  <div className="space-y-2">{data.ats_score.suggestions.map((s,i)=><div key={i} className="flex items-start gap-2 text-sm text-white/50 p-2.5 glass-card"><ChevronRight className="w-4 h-4 text-primary flex-shrink-0 mt-0.5"/>{s}</div>)}</div></div>)}
              </div>
            </div>
          </div>
        )}

        {/* Resume tab */}
        {activeTab==='resume'&&(
          <div className="glass-card p-6"><h2 className="text-lg font-semibold text-white/80 mb-4 flex items-center gap-2"><FileText className="w-5 h-5 text-primary"/>AI简历优化</h2>
            {data.resume_optimization?(<div className="space-y-4">
              <div className="grid lg:grid-cols-2 gap-4">
                <div className="rounded-xl p-4 border border-red-500/15" style={{background:'rgba(239,68,68,0.04)'}}><h4 className="text-sm font-semibold text-red-350 mb-2 flex items-center gap-2"><XCircle className="w-4 h-4"/>优化前</h4>
                  <p className="text-sm text-white/50 whitespace-pre-wrap leading-relaxed">{data.resume_optimization.original?.slice(0,500)||''}</p></div>
                <div className="rounded-xl p-4 border border-emerald-500/15" style={{background:'rgba(34,197,94,0.04)'}}><h4 className="text-sm font-semibold text-emerald-350 mb-2 flex items-center gap-2"><CheckCircle className="w-4 h-4"/>优化后</h4>
                  <p className="text-sm text-white/50 whitespace-pre-wrap leading-relaxed">{data.resume_optimization.optimized?.slice(0,500)||''}</p></div>
              </div>
              {data.resume_optimization.optimized_sections?.length>0&&(<div><h4 className="text-sm font-semibold text-white/65 mb-2">修改详情</h4>
                <div className="space-y-2">{data.resume_optimization.optimized_sections.map((ch,i)=>(<div key={i} className="glass-card p-3">
                  <div className="flex items-center gap-2 mb-1"><span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">{ch.section}</span><span className="text-xs text-white/25">{ch.reason}</span></div>
                  <div className="grid grid-cols-2 gap-3 text-xs"><span className="text-red-350">修改前：<span className="text-white/50">{ch.original}</span></span><span className="text-emerald-350">修改后：<span className="text-white/50">{ch.optimized}</span></span></div>
                </div>))}</div></div>)}
            </div>):(<div className="text-center py-12 text-white/30"><FileText className="w-12 h-12 mx-auto mb-3 opacity-20"/><p>暂无简历优化数据</p></div>)}
          </div>
        )}

        {/* Prediction tab */}
        {activeTab==='prediction'&&(
          <div className="space-y-6">
            <div className="glass-card p-6"><h2 className="text-lg font-semibold text-white/80 mb-6 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary"/>Offer预测分析</h2>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 glass-card"><EnhancedGauge score={data.offer_prediction?.interview_probability||0} label="面试概率" size="md" color={{stroke:'#38BDF8',hex:'#38BDF8'}}/></div>
                <div className="text-center p-4 glass-card"><EnhancedGauge score={data.offer_prediction?.offer_probability||0} label="Offer概率" size="md" color={{stroke:'#22C55E',hex:'#22C55E'}}/></div>
                <div className="text-center p-4 glass-card"><p className="text-2xl font-extrabold stat-number-grad text-purple-330">{data.offer_prediction?.competitiveness_score||'--'}</p><p className="text-xs text-white/30 mt-1">竞争力评分</p></div>
              </div>
              <div className="mb-6"><h4 className="text-sm font-semibold text-white/65 mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-primary"/>概率分布曲线</h4><ProbabilityCurve offerProb={data.offer_prediction?.offer_probability} interviewProb={data.offer_prediction?.interview_probability}/></div>
              <div className="mb-6"><h4 className="text-sm font-semibold text-white/65 mb-3 flex items-center gap-2"><Layers className="w-4 h-4 text-primary"/>多维度能力评估</h4>
                <div className="h-64"><ResponsiveContainer width="100%" height="100%"><RadarChart data={(data.offer_prediction?.radar_data?.length>0?data.offer_prediction.radar_data.map(d=>({subject:d.name,A:d.score,fullMark:100})):[
                  {subject:'学历',A:data.offer_prediction?.analysis?.education_factor||15,fullMark:20},
                  {subject:'技能',A:data.offer_prediction?.analysis?.skill_factor||22,fullMark:30},
                  {subject:'项目',A:data.offer_prediction?.analysis?.project_factor||14,fullMark:20},
                  {subject:'实习',A:data.offer_prediction?.analysis?.internship_factor||10,fullMark:15},
                  {subject:'竞争度',A:data.offer_prediction?.analysis?.competition_factor||7,fullMark:15},
                ])}>
                  <PolarGrid stroke="rgba(255,255,255,0.06)"/><PolarAngleAxis dataKey="subject" tick={{fontSize:12,fill:'rgba(255,255,255,0.4)'}}/><PolarRadiusAxis angle={90} domain={[0,30]} tick={false}/>
                  <Radar name="得分" dataKey="A" stroke="#6C7BFF" fill="#6C7BFF" fillOpacity={0.15} strokeWidth={2}/>
                </RadarChart></ResponsiveContainer></div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4 mb-6">
                <div className="glass-card p-4 border-emerald-500/10"><h4 className="text-sm font-semibold text-emerald-350 mb-2 flex items-center gap-2"><CheckCircle className="w-4 h-4"/>优势</h4>
                  <div className="space-y-1">{data.offer_prediction?.strengths?.length>0 ? data.offer_prediction.strengths.map((s,i)=><p key={i} className="text-sm text-emerald-350">\u2022 {s}</p>) : <p className="text-xs text-emerald-400/60 italic">无显著优势</p>}</div></div>
                <div className="glass-card p-4 border-orange-500/10"><h4 className="text-sm font-semibold text-orange-350 mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4"/>待提升</h4>
                  <div className="space-y-1">{data.offer_prediction?.weaknesses?.length>0 ? data.offer_prediction.weaknesses.map((w,i)=><p key={i} className="text-sm text-orange-350">\u2022 {w}</p>) : <p className="text-xs text-orange-400/60 italic">无明显短板</p>}</div></div>
              </div>
              {data.offer_prediction?.growth_advice?.length>0&&(<div><h4 className="text-sm font-semibold text-white/65 mb-2 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary"/>成长建议</h4>
                <div className="space-y-1">{data.offer_prediction.growth_advice.map((advice,i)=><div key={i} className="flex items-start gap-2 text-sm text-white/50 glass-card p-2"><Star className="w-4 h-4 text-warning flex-shrink-0 mt-0.5"/>{advice}</div>)}</div></div>)}
            </div>
          </div>
        )}

        {/* Parse Debug tab (NEW - v3.0) */}
        {activeTab==='parse'&&(
          <div className="space-y-6">
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold text-white/80 mb-4 flex items-center gap-2"><Eye className="w-5 h-5 text-primary"/>简历解析调试面板</h2>
              <p className="text-xs text-white/30 mb-6">v3.0 专业解析引擎 · 10步流水线 · 用于调试和优化简历识别准确率</p>

              <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                {[
                  {label:'提取方式',value:data._debug?.extraction_method || '未知',color:'#38BDF8'},
                  {label:'PDF页数',value:String(data._debug?.extraction?.pages || '?'),color:'#8B5CF6'},
                  {label:'原始字符数',value:(data._debug?.raw_char_count || 0).toLocaleString(),color:'#F59E0B'},
                  {label:'清洗后字符',value:(data._debug?.cleaned_char_count || 0).toLocaleString(),color:'#22C55E'},
                  {label:'检测章节数',value:String(data._debug?.section_count || 0),color:'#EC4899'},
                  {label:'需要OCR',value:data._debug?.extraction?.needs_ocr?'是':'否',color:data._debug?.extraction?.needs_ocr?'#EF4444':'#10B981'},
                ].map((m,i)=>(<div key={i} className="glass-card p-3 text-center"><p className="text-[10px] text-white/25 mb-1">{m.label}</p><p className="text-base font-bold" style={{color:m.color}}>{m.value}</p></div>))}
              </div>

              {data._debug?.sections_detected && data._debug.sections_detected.length > 0 && (
                <div className="mb-6"><h4 className="text-sm font-semibold text-white/65 mb-2">Step 3: 检测到的章节</h4>
                  <div className="flex flex-wrap gap-2">{data._debug.sections_detected.map((st,i)=>(
                    <span key={i} className="px-3 py-1 rounded-full text-xs font-medium"
                      style={{background:`${['#38BDF8','#8B5CF6','#F59E0B','#22C55E','#EC4899','#14B8A6','#F97316'][i%7]}18`,border:`1px solid ${['#38BDF8','#8B5CF6','#F59E0B','#22C55E','#EC4899','#14B8A6','#F97316'][i%7]}30`,color:['#38BDF8','#8B5CF6','#F59E0B','#22C55E','#EC4899','#14B8A6','#F97316'][i%7]}}>
                      {st}</span>))}</div></div>
              )}
            </div>

            {/* 结构化JSON */}
            <ExpandableDetail title="Step 4: 结构化提取结果 (JSON)" icon={Database} color="#38BDF8">
              <pre className="text-xs bg-black/40 p-4 rounded-xl overflow-auto max-h-[500px] leading-relaxed" style={{color:'rgba(200,220,255,0.85)',fontFamily:"'JetBrains Mono','Fira Code','Consolas',monospace"}}>
{JSON.stringify({name:data.resume_parsed?.name||'(未识别)',email:data.resume_parsed?.email||'(未识别)',phone:data.resume_parsed?.phone||'(未识别)',school:data.resume_parsed?.school||'--(未识别)',major:data.resume_parsed?.major||'--(未识别)',education:data.resume_parsed?.education||'--',graduation_year:data.resume_parsed?.graduation_year||'--(未识别)',gpa:data.resume_parsed?.gpa||'--',skills_count:data.resume_parsed?.skills?.length||0,skills:data.resume_parsed?.skills||[],education_records_count:data.resume_parsed?.education_records?.length||0,education_records:data.resume_parsed?.education_records||[],experience_records_count:data.resume_parsed?.experience_records?.length||0,experience_records:data.resume_parsed?.experience_records||[],project_records_count:data.resume_parsed?.project_records?.length||0,project_records:data.resume_parsed?.project_records||[],certifications:data.resume_parsed?.certifications||[]},null,2)}
              </pre>
            </ExpandableDetail>

            {/* 原始文本 */}
            <div className="grid lg:grid-cols-2 gap-6">
              <ExpandableDetail title="Step 1: PDF 原始文本 (前1500字)" icon={FileText} color="#F59E0B" defaultOpen={false}>
                <pre className="text-xs bg-black/40 p-4 rounded-xl overflow-auto max-h-[300px] whitespace-pre-wrap leading-relaxed" style={{color:'rgba(180,190,210,0.7)'}}>
                  {(data.resume_raw_text||'(无数据)').slice(0,1500)}
                </pre>
              </ExpandableDetail>
              <ExpandableDetail title="Step 2: 清洗后文本 (前2000字)" icon={Zap} color="#22C55E" defaultOpen={false}>
                <pre className="text-xs bg-black/40 p-4 rounded-xl overflow-auto max-h-[300px] whitespace-pre-wrap leading-relaxed" style={{color:'rgba(170,210,170,0.75)'}}>
                  {(data.resume_cleaned_text||'(无数据)').slice(0,2000)}
                </pre>
              </ExpandableDetail>
            </div>

            {/* ATS明细 */}
            <ExpandableDetail title="Step 6: ATS 评分引擎明细" icon={Award} color="#8B5CF6">
              <div className="space-y-4">{(data.ats_score?.dimensions||[]).map((dim,i)=>(
                <div key={i}><div className="flex justify-between text-sm mb-1.5"><span className="text-white/55">{dim.name}</span><span className="font-semibold text-white/75">{dim.score||0}/{dim.max_score||20}</span></div>
                <div className="w-full h-2.5 bg-white/[0.04] rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-700" style={{width:`${((dim.score||0)/(dim.max_score||20))*100}%`,background:`linear-gradient(90deg,${['#38BDF8','#8B5CF6','#F59E0B','#22C55E','#14B8A6'][i%5]},${['#38BDF8','#8B5CF6','#F59E0B','#22C55E','#14B8A6'][i%5]}66)`}}/></div></div>
              ))}
              </div>
            </ExpandableDetail>

            {/* 技能缺口 */}
            <ExpandableDetail title="Step 8: 技能缺口分析统计" icon={Target} color="#EC4899">
              {data.skill_gap?.stats && (
                <div className="grid sm:grid-cols-4 gap-3">{[
                  {label:'用户技能数',value:data.skill_gap.stats.user_skill_count,color:'#22C55E'},
                  {label:'匹配技能数',value:data.skill_gap.stats.matched_count,color:'#38BDF8'},
                  {label:'缺口技能数',value:data.skill_gap.stats.gap_count,color:'#F59E0B'},
                  {label:'覆盖率',value:`${data.skill_gap.stats.coverage_pct}%`,color:'#8B5CF6'},
                ].map((s,i)=>(<div key={i} className="glass-card p-3 text-center"><p className="text-[10px] text-white/25">{s.label}</p>
                  <p className="text-xl font-bold" style={{color:s.color}}>{s.value}</p></div>))}
                </div>
              )}
              {data.skill_gap?.missing_detailed?.length > 0 && (
                <div className="mt-4"><h4 className="text-xs font-semibold text-white/50 mb-2">高优先级缺失技能详情</h4>
                  <table className="w-full text-xs"><thead><tr className="border-b border-white/10"><th className="text-left py-2 text-white/35">技能名</th><th className="text-left py-2 text-white/35">分类</th><th className="text-left py-2 text-white/35">优先级</th><th className="text-left py-2 text-white/35">出现频次</th></tr></thead>
                    <tbody>{data.skill_gap.missing_detailed.slice(0,8).map((ms,i)=>(<tr key={i} className="border-b border-white/5"><td className="py-2 font-medium text-white/70">{ms.name}</td><td className="py-2 text-white/40">{ms.category}</td><td className={`py-2 ${ms.importance==='高'?'text-red-400':ms.importance==='中'?'text-yellow-400':'text-blue-400'}`}>{ms.importance}</td><td className="py-2 text-white/40">{ms.frequency_in_jobs}个岗位</td></tr>))}</tbody>
                  </table></div>
              )}
            </ExpandableDetail>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {showDetailModal&&(<div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={()=>setShowDetailModal(null)}><div className="glass-card max-w-lg w-full p-6 shadow-glass" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-white/85 text-lg">详细解析</h3><button onClick={()=>setShowDetailModal(null)} className="p-1 hover:bg-white/[0.06] rounded-lg"><XCircle className="w-5 h-5 text-white/35"/></button></div>
        {showDetailModal==='jobs'&&(<div className="space-y-4"><p className="text-sm text-white/50">AI 根据简历内容从岗位库中智能匹配的结果。</p>
          <div className="glass-card p-4"><h4 className="text-sm font-semibold text-secondary/80 mb-2">如何提升匹配数量？</h4>
            <ul className="space-y-2 text-sm text-white/50"><li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 text-primary flex-shrink-0 mt-0.5"/>完善简历中的技能描述</li>
              <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 text-primary flex-shrink-0 mt-0.5"/>添加量化成果</li>
              <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 text-primary flex-shrink-0 mt-0.5"/>扩展目标岗位范围</li></ul></div></div>)}
      </div></div>)}
    </div>
  )
}

export default Dashboard
