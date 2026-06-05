import React, { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import {
  Upload, FileText, Search, MapPin, Zap,
  Target, TrendingUp, Shield, Users, ArrowRight,
  Sparkles, CheckCircle, Loader2, Briefcase
} from 'lucide-react'
import { analyzeResume } from '../services/api'

const features = [
  { icon: Target, title: '智能匹配', desc: 'AI精准匹配最适合你的岗位' },
  { icon: TrendingUp, title: 'ATS评分', desc: '模拟企业ATS系统评分' },
  { icon: Shield, title: '简历优化', desc: 'AI驱动的简历改写建议' },
  { icon: Users, title: 'Offer预测', desc: '科学预测面试和Offer概率' },
]

const HomePage = ({ onAnalysisComplete }) => {
  const navigate = useNavigate()
  const [file, setFile] = useState(null)
  const [position, setPosition] = useState('')
  const [city, setCity] = useState('')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(null)

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0])
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
  })

  const handleAnalyze = async () => {
    if (!file || !position || !city) return

    setLoading(true)
    setProgress({ label: '正在上传简历...', progress: 5 })

    try {
      const data = await analyzeResume(file, position, city, setProgress)
      onAnalysisComplete(data)
      navigate('/dashboard')
    } catch (error) {
      alert('分析失败：' + (error.response?.data?.message || error.message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero Section */}
      <div className="text-center mb-12 animate-slide-in">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-medium mb-6">
          <Sparkles className="w-4 h-4" />
          AI驱动 · 多Agent协作
        </div>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-4">
          Offer<span className="text-primary">捕手</span>
        </h1>
        <p className="text-lg md:text-xl text-gray-500 max-w-2xl mx-auto">
          AI求职匹配与简历优化助手 · 6大智能Agent为你保驾护航
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* 左侧：上传区域 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 简历上传 */}
          <div className="bg-white rounded-2xl p-6 card-shadow">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              上传简历
            </h2>

            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 ${
                isDragActive
                  ? 'border-primary bg-primary/5 scale-[1.02]'
                  : file
                  ? 'border-primary/50 bg-primary/[0.02]'
                  : 'border-gray-200 hover:border-primary/50 hover:bg-gray-50'
              }`}
            >
              <input {...getInputProps()} />
              {file ? (
                <div className="space-y-3">
                  <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
                    <FileText className="w-8 h-8 text-primary" />
                  </div>
                  <p className="font-semibold text-gray-800">{file.name}</p>
                  <p className="text-sm text-gray-400">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setFile(null)
                    }}
                    className="text-sm text-primary hover:text-primary-dark underline"
                  >
                    重新选择
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto">
                    <Upload className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-600 font-medium">
                    拖拽简历文件到此处，或<span className="text-primary">点击上传</span>
                  </p>
                  <p className="text-sm text-gray-400">支持 PDF 格式，最大 10MB</p>
                </div>
              )}
            </div>
          </div>

          {/* 岗位和城市输入 */}
          <div className="bg-white rounded-2xl p-6 card-shadow">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Search className="w-5 h-5 text-primary" />
              求职意向
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  目标岗位
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    placeholder="例如：数据分析师、Java开发"
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  目标城市
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="例如：北京、上海、深圳"
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
              </div>
            </div>

            {/* 分析按钮 */}
            <button
              onClick={handleAnalyze}
              disabled={!file || !position || !city || loading}
              className={`w-full mt-6 py-4 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all duration-300 ${
                !file || !position || !city || loading
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'gradient-bg hover:shadow-lg hover:shadow-primary/25 active:scale-[0.98]'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  开始分析
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            {/* 进度条 */}
            {loading && progress && (
              <div className="mt-4 space-y-2 animate-slide-in">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-primary font-medium">{progress.label}</span>
                  <span className="text-gray-400">{progress.progress}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full progress-gradient rounded-full transition-all duration-500"
                    style={{ width: `${progress.progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 右侧：功能介绍 */}
        <div className="space-y-6">
          {/* 工作流说明 */}
          <div className="bg-white rounded-2xl p-6 card-shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              分析流程
            </h3>
            <div className="space-y-3">
              {[
                { icon: Upload, label: '上传简历PDF' },
                { icon: Search, label: 'AI简历解析' },
                { icon: Target, label: '岗位智能匹配' },
                { icon: TrendingUp, label: '技能缺口分析' },
                { icon: Shield, label: 'ATS评分+优化' },
                { icon: Users, label: 'Offer概率预测' },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <step.icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm text-gray-600">{step.label}</span>
                  {i < 5 && (
                    <div className="ml-auto">
                      <ArrowRight className="w-4 h-4 text-gray-300" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 功能卡片 */}
          <div className="space-y-3">
            {features.map((feature, i) => (
              <div key={i} className="bg-white rounded-xl p-4 card-shadow flex items-start gap-4">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800 text-sm">{feature.title}</h4>
                  <p className="text-xs text-gray-500 mt-0.5">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 底部：Agent架构展示 */}
      <div className="mt-12 bg-white rounded-2xl p-8 card-shadow">
        <h2 className="text-xl font-bold text-gray-800 text-center mb-6">
          多Agent智能架构
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { name: '简历解析', desc: 'Resume Analyzer', color: 'from-blue-500 to-cyan-500' },
            { name: '岗位匹配', desc: 'Job Matcher', color: 'from-green-500 to-emerald-500' },
            { name: '缺口分析', desc: 'Gap Analysis', color: 'from-orange-500 to-amber-500' },
            { name: 'ATS优化', desc: 'ATS Optimizer', color: 'from-purple-500 to-pink-500' },
            { name: '职业教练', desc: 'Career Coach', color: 'from-red-500 to-rose-500' },
            { name: 'Offer预测', desc: 'Offer Predictor', color: 'from-indigo-500 to-violet-500' },
          ].map((agent, i) => (
            <div
              key={i}
              className="relative p-4 rounded-xl bg-gray-50 border border-gray-100 text-center hover:border-primary/30 transition-all group"
            >
              <div className={`w-10 h-10 mx-auto mb-3 rounded-xl bg-gradient-to-br ${agent.color} flex items-center justify-center`}>
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
              <h4 className="font-semibold text-gray-800 text-sm">{agent.name}</h4>
              <p className="text-xs text-gray-400 mt-1">{agent.desc}</p>
              {i < 5 && (
                <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 text-gray-300">
                  <ArrowRight className="w-5 h-5" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

export default HomePage
