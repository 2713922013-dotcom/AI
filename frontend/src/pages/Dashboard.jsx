import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Download, Share2, RefreshCw,
  User, Briefcase, Target, TrendingUp,
  FileText, Zap, Award, AlertTriangle,
  CheckCircle, XCircle, Lightbulb, BookOpen,
  BarChart3, PieChart, Star, Clock, MapPin,
  Building2, DollarSign, GraduationCap,
  ChevronRight, ExternalLink
} from 'lucide-react'
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell, PieChart as RePieChart, Pie,
  Legend
} from 'recharts'

// ============================================================
// 子组件
// ============================================================

const ScoreGauge = ({ score, label, color = '#2E8B57' }) => (
  <div className="text-center">
    <div className="relative w-24 h-24 mx-auto">
      <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="52" fill="none" stroke="#e5e7eb" strokeWidth="8" />
        <circle
          cx="60" cy="60" r="52" fill="none"
          stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${score * 3.267} 327`}
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold" style={{ color }}>{score}</span>
      </div>
    </div>
    <p className="text-sm text-gray-500 mt-2">{label}</p>
  </div>
)

const MatchCard = ({ job, rank }) => {
  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600 bg-green-50'
    if (score >= 60) return 'text-yellow-600 bg-yellow-50'
    return 'text-red-600 bg-red-50'
  }

  return (
    <div className="bg-white rounded-xl p-5 card-shadow border border-gray-100 hover:border-primary/30 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
            rank === 1 ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
          }`}>
            {rank}
          </div>
          <div>
            <h4 className="font-semibold text-gray-800">{job.title}</h4>
            <div className="flex items-center gap-2 text-sm text-gray-500 mt-0.5">
              <Building2 className="w-3.5 h-3.5" />
              {job.company}
              <span className="text-gray-300">|</span>
              <MapPin className="w-3.5 h-3.5" />
              {job.city}
            </div>
          </div>
        </div>
        <div className={`px-3 py-1.5 rounded-lg font-bold text-sm ${getScoreColor(job.match_score)}`}>
          {job.match_score}%
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {job.matched_skills?.slice(0, 5).map((skill, i) => (
          <span key={i} className="tag tag-primary text-xs">
            <CheckCircle className="w-3 h-3 mr-1" />
            {skill}
          </span>
        ))}
        {job.missing_skills?.slice(0, 3).map((skill, i) => (
          <span key={i} className="tag tag-warning text-xs">
            <AlertTriangle className="w-3 h-3 mr-1" />
            {skill}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <DollarSign className="w-3.5 h-3.5" />
          {job.salary_range}
        </span>
        <span className="flex items-center gap-1">
          <GraduationCap className="w-3.5 h-3.5" />
          {job.education_match ? '学历匹配' : '学历不匹配'}
        </span>
      </div>
    </div>
  )
}

const SkillGapPanel = ({ gapAnalysis }) => {
  if (!gapAnalysis) return null

  return (
    <div className="space-y-4">
      {/* 已具备技能 */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-500" />
          已具备技能
        </h4>
        <div className="flex flex-wrap gap-2">
          {gapAnalysis.current_skills?.map((skill, i) => (
            <span key={i} className="tag tag-primary">{skill}</span>
          ))}
        </div>
      </div>

      {/* 缺失技能 */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-500" />
          需要补充的技能
        </h4>
        <div className="flex flex-wrap gap-2">
          {gapAnalysis.missing_skills?.map((skill, i) => (
            <span key={i} className="tag tag-warning">{skill}</span>
          ))}
        </div>
      </div>

      {/* 学习路径 */}
      {gapAnalysis.learning_path && gapAnalysis.learning_path.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            学习路径建议
          </h4>
          <div className="space-y-2">
            {gapAnalysis.learning_path.slice(0, 5).map((item, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm text-gray-800">{item.skill}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    item.priority === '高' ? 'bg-red-100 text-red-600' :
                    item.priority === '中' ? 'bg-yellow-100 text-yellow-600' :
                    'bg-green-100 text-green-600'
                  }`}>
                    {item.priority}优先级
                  </span>
                </div>
                <p className="text-xs text-gray-500">{item.project_suggestion}</p>
                <p className="text-xs text-gray-400 mt-1">预计时间：{item.estimated_time}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const ATSScorePanel = ({ atsScore }) => {
  if (!atsScore) return null

  const dimensions = [
    { name: '关键词匹配', score: atsScore.keyword_score, max: 30 },
    { name: '项目质量', score: atsScore.project_quality_score, max: 25 },
    { name: '技能完整度', score: atsScore.skill_completeness_score, max: 25 },
    { name: '成果量化', score: atsScore.quantification_score, max: 20 },
  ]

  return (
    <div className="space-y-4">
      {/* 总分 */}
      <div className="flex items-center justify-center">
        <ScoreGauge score={atsScore.total_score} label="ATS总分" color="#2E8B57" />
      </div>

      {/* 各维度得分 */}
      <div className="space-y-3">
        {dimensions.map((dim, i) => (
          <div key={i}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">{dim.name}</span>
              <span className="font-semibold text-gray-800">{dim.score}/{dim.max}</span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full progress-gradient rounded-full transition-all duration-700"
                style={{ width: `${(dim.score / dim.max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* 问题列表 */}
      {atsScore.issues && atsScore.issues.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            发现的问题
          </h4>
          <div className="space-y-1">
            {atsScore.issues.map((issue, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-gray-600">
                <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                {issue}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 优化建议 */}
      {atsScore.suggestions && atsScore.suggestions.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-yellow-500" />
            优化建议
          </h4>
          <div className="space-y-1">
            {atsScore.suggestions.map((suggestion, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-gray-600">
                <ChevronRight className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                {suggestion}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const ResumeOptimizePanel = ({ optimized }) => {
  if (!optimized) return null

  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-2 gap-4">
        {/* 优化前 */}
        <div className="bg-red-50 rounded-xl p-4 border border-red-100">
          <h4 className="text-sm font-semibold text-red-600 mb-2 flex items-center gap-2">
            <XCircle className="w-4 h-4" />
            优化前
          </h4>
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {optimized.original?.slice(0, 500)}
            {(optimized.original?.length || 0) > 500 && '...'}
          </p>
        </div>

        {/* 优化后 */}
        <div className="bg-green-50 rounded-xl p-4 border border-green-100">
          <h4 className="text-sm font-semibold text-green-600 mb-2 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            优化后
          </h4>
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {optimized.optimized?.slice(0, 500)}
            {(optimized.optimized?.length || 0) > 500 && '...'}
          </p>
        </div>
      </div>

      {/* 修改记录 */}
      {optimized.changes && optimized.changes.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">修改详情</h4>
          <div className="space-y-2">
            {optimized.changes.map((change, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium px-2 py-0.5 bg-primary/10 text-primary rounded">
                    {change.section}
                  </span>
                  <span className="text-xs text-gray-400">{change.reason}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-red-500 font-medium">修改前：</span>
                    <span className="text-gray-600">{change.original}</span>
                  </div>
                  <div>
                    <span className="text-green-600 font-medium">修改后：</span>
                    <span className="text-gray-600">{change.optimized}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const OfferPredictionPanel = ({ prediction }) => {
  if (!prediction) return null

  const radarData = [
    { subject: '学历', A: prediction.analysis?.education_factor || 15, fullMark: 20 },
    { subject: '技能', A: prediction.analysis?.skill_factor || 22, fullMark: 30 },
    { subject: '项目', A: prediction.analysis?.project_factor || 14, fullMark: 20 },
    { subject: '实习', A: prediction.analysis?.internship_factor || 10, fullMark: 15 },
    { subject: '竞争度', A: prediction.analysis?.competition_factor || 7, fullMark: 15 },
  ]

  return (
    <div className="space-y-6">
      {/* 核心指标 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center p-4 bg-blue-50 rounded-xl">
          <p className="text-3xl font-bold text-blue-600">{prediction.interview_probability}%</p>
          <p className="text-xs text-blue-500 mt-1">面试概率</p>
        </div>
        <div className="text-center p-4 bg-green-50 rounded-xl">
          <p className="text-3xl font-bold text-green-600">{prediction.offer_probability}%</p>
          <p className="text-xs text-green-500 mt-1">Offer概率</p>
        </div>
        <div className="text-center p-4 bg-purple-50 rounded-xl">
          <p className="text-3xl font-bold text-purple-600">{prediction.competitiveness_score}</p>
          <p className="text-xs text-purple-500 mt-1">竞争力评分</p>
        </div>
      </div>

      {/* 雷达图 */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData}>
            <PolarGrid stroke="#e5e7eb" />
            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: '#6b7280' }} />
            <PolarRadiusAxis angle={90} domain={[0, 30]} tick={false} />
            <Radar
              name="得分"
              dataKey="A"
              stroke="#2E8B57"
              fill="#2E8B57"
              fillOpacity={0.2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* 优势劣势 */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-green-50 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            优势
          </h4>
          <div className="space-y-1">
            {prediction.strengths?.map((s, i) => (
              <p key={i} className="text-sm text-green-600">• {s}</p>
            ))}
          </div>
        </div>
        <div className="bg-orange-50 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-orange-700 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            待提升
          </h4>
          <div className="space-y-1">
            {prediction.weaknesses?.map((w, i) => (
              <p key={i} className="text-sm text-orange-600">• {w}</p>
            ))}
          </div>
        </div>
      </div>

      {/* 成长建议 */}
      {prediction.growth_advice && prediction.growth_advice.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            成长建议
          </h4>
          <div className="space-y-1">
            {prediction.growth_advice.map((advice, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-gray-600">
                <Star className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                {advice}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// 主Dashboard组件
// ============================================================

const Dashboard = ({ data }) => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')

  if (!data) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="w-24 h-24 bg-gray-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <FileText className="w-12 h-12 text-gray-300" />
        </div>
        <h2 className="text-xl font-semibold text-gray-600 mb-2">暂无分析数据</h2>
        <p className="text-gray-400 mb-6">请先在首页上传简历并开始分析</p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark transition-colors"
        >
          前往首页
        </button>
      </div>
    )
  }

  const tabs = [
    { id: 'overview', label: '总览', icon: BarChart3 },
    { id: 'jobs', label: '岗位推荐', icon: Briefcase },
    { id: 'gap', label: '技能缺口', icon: Target },
    { id: 'ats', label: 'ATS评分', icon: Award },
    { id: 'resume', label: '简历优化', icon: FileText },
    { id: 'prediction', label: 'Offer预测', icon: TrendingUp },
  ]

  const ActiveIcon = tabs.find(t => t.id === activeTab)?.icon || BarChart3

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">分析仪表盘</h1>
            <p className="text-sm text-gray-500">
              会话ID: {data.session_id?.slice(0, 30)}...
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            重新分析
          </button>
        </div>
      </div>

      {/* Tab导航 */}
      <div className="flex gap-1 mb-6 bg-white rounded-xl p-1 card-shadow overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-primary text-white shadow-md'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab内容 */}
      <div className="animate-slide-in">
        {/* 总览 Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* 关键指标卡片 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-5 card-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                    <Briefcase className="w-5 h-5 text-blue-500" />
                  </div>
                  <span className="text-sm text-gray-500">匹配岗位数</span>
                </div>
                <p className="text-3xl font-bold text-gray-800">
                  {data.matched_jobs?.length || 0}
                </p>
              </div>

              <div className="bg-white rounded-xl p-5 card-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                    <Award className="w-5 h-5 text-green-500" />
                  </div>
                  <span className="text-sm text-gray-500">ATS总分</span>
                </div>
                <p className="text-3xl font-bold text-green-600">
                  {data.ats_score?.total_score || '--'}
                </p>
              </div>

              <div className="bg-white rounded-xl p-5 card-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                    <Target className="w-5 h-5 text-purple-500" />
                  </div>
                  <span className="text-sm text-gray-500">面试概率</span>
                </div>
                <p className="text-3xl font-bold text-purple-600">
                  {data.offer_prediction?.interview_probability || '--'}%
                </p>
              </div>

              <div className="bg-white rounded-xl p-5 card-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
                    <Star className="w-5 h-5 text-orange-500" />
                  </div>
                  <span className="text-sm text-gray-500">Offer概率</span>
                </div>
                <p className="text-3xl font-bold text-orange-500">
                  {data.offer_prediction?.offer_probability || '--'}%
                </p>
              </div>
            </div>

            {/* 简历解析概要 + 技能概览 */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* 简历解析 */}
              <div className="bg-white rounded-xl p-6 card-shadow">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  简历解析结果
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-400">学历</p>
                    <p className="font-medium text-gray-800">{data.resume_parsed?.education || '--'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">专业</p>
                    <p className="font-medium text-gray-800">{data.resume_parsed?.major || '--'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">学校</p>
                    <p className="font-medium text-gray-800">{data.resume_parsed?.school || '--'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">毕业年份</p>
                    <p className="font-medium text-gray-800">{data.resume_parsed?.graduation_year || '--'}</p>
                  </div>
                </div>
                {data.resume_parsed?.skills && (
                  <div className="mt-4">
                    <p className="text-xs text-gray-400 mb-2">技能标签</p>
                    <div className="flex flex-wrap gap-2">
                      {data.resume_parsed.skills.map((skill, i) => (
                        <span key={i} className="tag tag-primary text-xs">{skill}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 技能缺口概览 */}
              <div className="bg-white rounded-xl p-6 card-shadow">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  技能缺口概览
                </h3>
                <SkillGapPanel gapAnalysis={data.gap_analysis} />
              </div>
            </div>

            {/* Top推荐岗位 */}
            <div className="bg-white rounded-xl p-6 card-shadow">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-primary" />
                Top推荐岗位
              </h3>
              <div className="space-y-3">
                {data.matched_jobs?.slice(0, 5).map((job, i) => (
                  <MatchCard key={i} job={job} rank={i + 1} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 岗位推荐 Tab */}
        {activeTab === 'jobs' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">
                共匹配 {data.matched_jobs?.length || 0} 个岗位
              </h2>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-4 h-4 text-green-500" /> 已匹配技能
                </span>
                <span className="flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4 text-orange-500" /> 缺失技能
                </span>
              </div>
            </div>
            {data.matched_jobs?.map((job, i) => (
              <MatchCard key={i} job={job} rank={i + 1} />
            ))}
          </div>
        )}

        {/* 技能缺口 Tab */}
        {activeTab === 'gap' && (
          <div className="bg-white rounded-xl p-6 card-shadow">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              技能缺口分析报告
            </h2>
            <SkillGapPanel gapAnalysis={data.gap_analysis} />
          </div>
        )}

        {/* ATS评分 Tab */}
        {activeTab === 'ats' && (
          <div className="bg-white rounded-xl p-6 card-shadow">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              ATS评分报告
            </h2>
            <ATSScorePanel atsScore={data.ats_score} />
          </div>
        )}

        {/* 简历优化 Tab */}
        {activeTab === 'resume' && (
          <div className="bg-white rounded-xl p-6 card-shadow">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              AI简历优化
            </h2>
            <ResumeOptimizePanel optimized={data.resume_optimized} />
          </div>
        )}

        {/* Offer预测 Tab */}
        {activeTab === 'prediction' && (
          <div className="bg-white rounded-xl p-6 card-shadow">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Offer预测分析
            </h2>
            <OfferPredictionPanel prediction={data.offer_prediction} />
          </div>
        )}
      </div>

      {/* Agent执行时间线 */}
      <div className="mt-8 bg-white rounded-xl p-6 card-shadow">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          Agent执行流程
        </h3>
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
          <div className="space-y-4">
            {[
              { agent: 'Resume Analyzer Agent', step: '简历解析', status: 'completed' },
              { agent: 'Job Matcher Agent', step: '岗位匹配', status: 'completed' },
              { agent: 'Gap Analysis Agent', step: '技能缺口分析', status: 'completed' },
              { agent: 'ATS Optimizer Agent', step: 'ATS评分 + 简历优化', status: 'completed' },
              { agent: 'Career Coach Agent', step: '职业发展建议', status: 'completed' },
              { agent: 'Offer Predictor Agent', step: 'Offer预测', status: 'completed' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-4 ml-2">
                <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 ${
                  item.status === 'completed'
                    ? 'bg-green-500 border-green-500'
                    : 'bg-gray-200 border-gray-300'
                }`}>
                  {item.status === 'completed' && (
                    <CheckCircle className="w-3 h-3 text-white" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-sm text-gray-800">{item.step}</p>
                  <p className="text-xs text-gray-400">{item.agent}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
