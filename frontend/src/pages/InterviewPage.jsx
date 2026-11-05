import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Mic, Upload, Clock, CheckCircle2, AlertTriangle, RotateCcw,
  Loader2, FileText, Target, Play, Zap, ChevronRight, Lightbulb,
} from 'lucide-react'
import { analyzeResume, buildInterviewPlan, scoreInterviewAnswer } from '../services/api'

// 把 axios 的英文报错翻译成用户能懂、知道下一步该做什么的话
function friendlyError(e) {
  const msg = e?.response?.data?.message || e?.message || ''
  if (e?.code === 'ECONNABORTED' || /timeout/i.test(msg)) {
    return '服务器唤醒超时。免费部署在没人访问时会休眠，第一次请求要等它启动——请再点一次「开始面试」，第二次会很快。'
  }
  if (/network error/i.test(msg) || e?.response === undefined) {
    return '连不上服务器，请检查网络后重试。'
  }
  return msg || '启动失败，请稍后重试'
}

const CATEGORY_STYLE = {
  '自我介绍': { color: '#6C7BFF', bg: 'rgba(108,123,255,0.12)' },
  '项目深挖': { color: '#38BDF8', bg: 'rgba(56,189,248,0.12)' },
  '数字追问': { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  '经历深挖': { color: '#38BDF8', bg: 'rgba(56,189,248,0.12)' },
  '能力缺口': { color: '#EC4899', bg: 'rgba(236,72,153,0.12)' },
  '团队协作': { color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' },
  '反问环节': { color: '#14B8A6', bg: 'rgba(20,184,166,0.12)' },
  default: { color: '#6C7BFF', bg: 'rgba(108,123,255,0.12)' },
}

const Bar = ({ value, max, color }) => (
  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
    <div
      className="h-full rounded-full transition-all duration-700"
      style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }}
    />
  </div>
)

const ScoreRing = ({ score, size = 96 }) => {
  const r = size / 2 - 8
  const c = 2 * Math.PI * r
  const color = score >= 80 ? '#22C55E' : score >= 60 ? '#F59E0B' : '#EF4444'
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="7"
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (score / 100) * c}
        style={{ transition: 'stroke-dashoffset .8s ease-out', transform: 'rotate(-90deg)', transformOrigin: 'center' }}
      />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
        fontSize={size / 4} fontWeight="800" fill={color}>{score}</text>
    </svg>
  )
}

export default function InterviewPage() {
  const [phase, setPhase] = useState('setup')
  const [file, setFile] = useState(null)
  const [position, setPosition] = useState('')
  const [jdText, setJdText] = useState('')
  const [showJD, setShowJD] = useState(false)
  const [plan, setPlan] = useState(null)
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState(null)
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [seconds, setSeconds] = useState(0)
  const fileRef = useRef(null)
  const [params] = useSearchParams()
  const booted = useRef(false)
  // 刚分析过的简历直接复用，不用再传一次文件
  const [savedResume] = useState(() => {
    try {
      const raw = sessionStorage.getItem('analysis_data')
      if (!raw) return null
      const parsed = JSON.parse(raw)?.resume_parsed
      return parsed && (parsed.name || parsed.skills?.length) ? parsed : null
    } catch {
      return null
    }
  })

  const question = plan?.questions?.[index]

  useEffect(() => {
    if (phase !== 'quiz' || result) return
    const t = setInterval(() => setSeconds(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [phase, result, index])

  const summary = useMemo(() => {
    if (!records.length) return null
    const avg = Math.round(records.reduce((s, r) => s + r.result.score, 0) / records.length)
    const keys = records[0].result.dimensions.map(d => ({ key: d.key, name: d.name, max: d.max }))
    const dims = keys.map(k => {
      const total = records.reduce((s, r) => {
        const d = r.result.dimensions.find(x => x.key === k.key)
        return s + (d?.score || 0)
      }, 0)
      return { ...k, score: total / records.length }
    })
    const worst = [...records].sort((a, b) => a.result.score - b.result.score).slice(0, 3)
    return { avg, dims, worst }
  }, [records])

  const start = async (positionOverride) => {
    const target = (positionOverride || position || '').trim()
    if (!target) {
      setError('先填目标岗位，题单是按岗位出的')
      return
    }
    if (positionOverride) setPosition(positionOverride)
    setLoading(true)
    setError('')
    try {
      let parsed = {}
      if (file) {
        setStatus('正在解析简历…')
        const data = await analyzeResume(file, target, '')
        parsed = data?.resume_parsed || {}
      } else if (savedResume) {
        parsed = savedResume
      }
      setStatus('正在出题…')
      const p = await buildInterviewPlan({
        target_position: target,
        parsed,
        jd_text: jdText,
      })
      setPlan(p)
      setRecords([])
      setIndex(0)
      setAnswer('')
      setResult(null)
      setSeconds(0)
      setPhase('quiz')
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setLoading(false)
      setStatus('')
    }
  }

  // 支持 /interview?position=数据分析师&autostart=1 深链，从别处带岗位直接开练
  useEffect(() => {
    if (booted.current) return
    booted.current = true
    const p = (params.get('position') || '').trim()
    if (p) {
      setPosition(p)
      if (params.get('autostart') === '1') start(p)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async () => {
    if (!answer.trim()) {
      setError('先写下你的回答，空答在真实面试里等于放弃')
      return
    }
    setLoading(true)
    setError('')
    try {
      const r = await scoreInterviewAnswer({ question, answer })
      setResult(r)
      setRecords(prev => [...prev, { question, answer, result: r, seconds }])
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setLoading(false)
    }
  }

  const next = () => {
    if (index + 1 >= plan.questions.length) {
      setPhase('report')
      return
    }
    setIndex(i => i + 1)
    setAnswer('')
    setResult(null)
    setSeconds(0)
    setError('')
  }

  const restart = () => {
    setPhase('setup')
    setPlan(null)
    setRecords([])
    setIndex(0)
    setAnswer('')
    setResult(null)
    setError('')
  }

  /* ------------------------------------------------ 设置阶段 */
  if (phase === 'setup') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(236,72,153,0.12)', border: '1px solid rgba(236,72,153,0.2)' }}>
            <Mic className="w-5 h-5" style={{ color: '#EC4899' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">模拟面试</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
              出真问题 · 按规则挑毛病 · 不替你编经历
            </p>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-5 my-6" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
            这里不是「AI 扮演面试官陪你聊天」。它做三件确定的事：从岗位高频题库里出题；
            从你简历里生成会被追问的深挖题（简历上的数字一定会被追问口径）；
            按结构、数据、具体度、考点命中、篇幅五个维度给你的回答打分，并给出下一句该被追问什么。
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
              目标岗位 <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input
              value={position}
              onChange={e => setPosition(e.target.value)}
              placeholder="例如：后端开发工程师 / 数据分析师 / 产品经理"
              className="w-full px-4 py-3 rounded-xl text-white outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            />
            <p className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
              题单会按岗位族（技术/数据/产品/运营/设计/算法）自动匹配
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
              简历（可选，上传后才会出「深挖题」）
            </label>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={e => setFile(e.target.files?.[0] || null)}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full px-4 py-3 rounded-xl flex items-center justify-center gap-2 text-sm transition-colors"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.6)' }}
            >
              <Upload className="w-4 h-4" />
              {file ? file.name : '选择 PDF 简历'}
            </button>
            {!file && (
              <p className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {savedResume
                  ? `已自动使用你刚才分析的简历${savedResume.name ? `（${savedResume.name}）` : ''}，要换简历点上面重新选`
                  : '不传也能练，但题目只剩通用题和岗位题，没有针对你经历的追问'}
              </p>
            )}
          </div>

          <div>
            <button
              onClick={() => setShowJD(v => !v)}
              className="text-sm flex items-center gap-1.5"
              style={{ color: 'rgba(255,255,255,0.45)' }}
            >
              <FileText className="w-4 h-4" />
              {showJD ? '收起 JD' : '粘贴岗位 JD（可选，用来生成能力缺口题）'}
            </button>
            {showJD && (
              <textarea
                value={jdText}
                onChange={e => setJdText(e.target.value)}
                rows={6}
                placeholder="从 BOSS / 拉勾复制的岗位描述，粘进来即可"
                className="w-full mt-2 px-4 py-3 rounded-xl text-sm text-white outline-none resize-y"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              />
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl text-sm"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#FCA5A5' }}>
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={start}
            disabled={loading}
            className="btn-primary-grad w-full py-3.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {loading ? (status || '准备中…') : '开始面试'}
          </button>

          {loading && (
            <div className="flex items-start gap-2 p-3 rounded-xl text-sm"
              style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.18)', color: '#FCD34D' }}>
              <Loader2 className="w-4 h-4 mt-0.5 flex-shrink-0 animate-spin" style={{ color: '#F59E0B' }} />
              <span>
                {status || '准备中…'}
                {file ? ' · 上传了简历会先解析再出题' : ''}
                ，第一次访问如果赶上服务器休眠，可能需要 30–60 秒，请不要关闭页面。
              </span>
            </div>
          )}
        </div>
      </div>
    )
  }

  /* ------------------------------------------------ 答题阶段 */
  if (phase === 'quiz' && question) {
    const cs = CATEGORY_STYLE[question.category] || CATEGORY_STYLE.default
    const overTime = seconds > (question.time_limit || 120)
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {index + 1} / {plan.questions.length}
            </span>
            <span className="px-2.5 py-1 rounded-lg text-xs font-medium"
              style={{ color: cs.color, background: cs.bg }}>
              {question.category}
            </span>
            <span className="text-xs px-2 py-1 rounded-lg"
              style={{ color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.04)' }}>
              {plan.family_label}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-sm font-mono"
            style={{ color: overTime ? '#F59E0B' : 'rgba(255,255,255,0.35)' }}>
            <Clock className="w-4 h-4" />
            {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
              / 建议 {Math.round((question.time_limit || 120) / 60)} 分钟
            </span>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6 mb-4" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <h2 className="text-xl font-semibold text-white leading-relaxed mb-3">{question.question}</h2>
          <div className="flex items-start gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#F59E0B' }} />
            <span>面试官在看：{question.why}</span>
          </div>
        </div>

        {!result && (
          <>
            <textarea
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              rows={9}
              placeholder="像在面试现场一样说出来——先讲背景和目标，再讲你具体做了什么，最后给结果。"
              className="w-full px-4 py-3 rounded-xl text-white outline-none resize-y leading-relaxed"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {answer.length} 字 · 建议 150–400 字
              </span>
              <button
                onClick={submit}
                disabled={loading}
                className="btn-primary-grad px-6 py-2.5 rounded-xl font-semibold text-white flex items-center gap-2 disabled:opacity-60"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {loading ? '评分中…' : '提交回答'}
              </button>
            </div>
            {error && (
              <p className="text-sm mt-3" style={{ color: '#FCA5A5' }}>{error}</p>
            )}
          </>
        )}

        {result && (
          <div className="space-y-4">
            <div className="glass-card rounded-2xl p-6" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <div className="flex items-start gap-5">
                <ScoreRing score={result.score} />
                <div className="flex-1">
                  <p className="text-sm text-white/70 leading-relaxed mb-3">{result.verdict}</p>
                  <div className="space-y-2.5">
                    {result.dimensions.map(d => (
                      <div key={d.key}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span style={{ color: 'rgba(255,255,255,0.5)' }}>{d.name}</span>
                          <span style={{ color: 'rgba(255,255,255,0.35)' }}>{d.score}/{d.max}</span>
                        </div>
                        <Bar value={d.score} max={d.max}
                          color={d.score / d.max >= 0.7 ? '#22C55E' : d.score / d.max >= 0.4 ? '#F59E0B' : '#EF4444'} />
                        <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{d.comment}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {(result.hit_points?.length > 0 || result.missed_points?.length > 0) && (
              <div className="glass-card rounded-2xl p-5" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                <p className="text-sm font-medium mb-3 text-white/70">考点覆盖</p>
                <div className="flex flex-wrap gap-2">
                  {result.hit_points.map(p => (
                    <span key={p} className="px-2.5 py-1 rounded-lg text-xs flex items-center gap-1"
                      style={{ color: '#86EFAC', background: 'rgba(34,197,94,0.1)' }}>
                      <CheckCircle2 className="w-3 h-3" /> {p}
                    </span>
                  ))}
                  {result.missed_points.map(p => (
                    <span key={p} className="px-2.5 py-1 rounded-lg text-xs"
                      style={{ color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.04)' }}>
                      未提 {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {result.followup && (
              <div className="rounded-2xl p-5"
                style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.16)' }}>
                <p className="text-xs font-medium mb-1.5 flex items-center gap-1.5" style={{ color: '#F59E0B' }}>
                  <Target className="w-3.5 h-3.5" /> 面试官下一句会追
                </p>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.62)' }}>
                  {result.followup}
                </p>
              </div>
            )}

            <details className="glass-card rounded-2xl p-5" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <summary className="text-sm font-medium cursor-pointer" style={{ color: 'rgba(255,255,255,0.6)' }}>
                看这题的参考要点（要点清单，不是逐字稿）
              </summary>
              <ul className="mt-3 space-y-2">
                {question.model.map((m, i) => (
                  <li key={i} className="text-sm flex items-start gap-2" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    <span className="font-mono text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>{i + 1}</span>
                    {m}
                  </li>
                ))}
              </ul>
            </details>

            <button
              onClick={next}
              className="btn-primary-grad w-full py-3.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2"
            >
              {index + 1 >= plan.questions.length ? '查看面试报告' : '下一题'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    )
  }

  /* ------------------------------------------------ 报告阶段 */
  if (phase === 'report' && summary) {
    const grade = summary.avg >= 80 ? '面试通过概率较高' : summary.avg >= 60 ? '能过初面，二面会被追细节' : '现在去面，大概率倒在深挖环节'
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-white mb-1">面试报告</h1>
        <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {plan.family_label} · 共 {records.length} 题 · {grade}
        </p>

        <div className="glass-card rounded-2xl p-6 mb-4" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-6">
            <ScoreRing score={summary.avg} size={110} />
            <div className="flex-1 space-y-2.5">
              {summary.dims.map(d => (
                <div key={d.key}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>{d.name}</span>
                    <span style={{ color: 'rgba(255,255,255,0.35)' }}>{d.score.toFixed(1)}/{d.max}</span>
                  </div>
                  <Bar value={d.score} max={d.max}
                    color={d.score / d.max >= 0.7 ? '#22C55E' : d.score / d.max >= 0.4 ? '#F59E0B' : '#EF4444'} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6 mb-4" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <p className="text-sm font-medium mb-4 text-white/70">最需要改的三题</p>
          <div className="space-y-4">
            {summary.worst.map((r, i) => (
              <div key={i} className="pb-4" style={{ borderBottom: i < summary.worst.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <p className="text-sm text-white/75 leading-relaxed">{r.question.question}</p>
                  <span className="text-sm font-bold flex-shrink-0"
                    style={{ color: r.result.score >= 60 ? '#F59E0B' : '#EF4444' }}>
                    {r.result.score}
                  </span>
                </div>
                {r.result.followup && (
                  <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.38)' }}>
                    {r.result.followup}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={restart}
            className="flex-1 py-3 rounded-xl font-medium flex items-center justify-center gap-2"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}
          >
            <RotateCcw className="w-4 h-4" /> 换岗位再练
          </button>
          <button
            onClick={() => { setIndex(0); setAnswer(''); setResult(null); setRecords([]); setPhase('quiz'); setSeconds(0) }}
            className="btn-primary-grad flex-1 py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4" /> 用同一套题重练
          </button>
        </div>
      </div>
    )
  }

  return null
}
