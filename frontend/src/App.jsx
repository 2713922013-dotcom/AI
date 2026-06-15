import React, { useState, useEffect, useMemo } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import HomePage from './pages/HomePage'
import Dashboard from './pages/Dashboard'
import JobsPage from './pages/JobsPage'
import Header from './components/Header'
import ErrorBoundary from './components/ErrorBoundary'

/** Dashboard 包装器：如果 props 数据为空则从 sessionStorage 恢复 */
function DashboardWrapper({ data }) {
  const [renderError, setRenderError] = useState(null)
  
  const safeData = useMemo(() => {
    if (data) return data
    try {
      const saved = sessionStorage.getItem('analysis_data')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  }, [data])

  // 出错时清除损坏的数据并重试
  const handleReset = () => {
    sessionStorage.removeItem('analysis_data')
    setRenderError(null)
    window.location.href = '/'
  }

  if (renderError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050816]">
        <div className="glass-card rounded-2xl p-8 max-w-lg mx-4 border-red-500/15">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-lg font-semibold text-white/90 mb-2">渲染异常</h2>
          <p className="text-sm text-white/40 mb-4">分析数据可能存在问题</p>
          <details className="mb-5 text-left">
            <summary className="text-xs text-white/30 cursor-pointer hover:text-white/50 mb-2">查看错误详情（用于调试）</summary>
            <pre className="text-xs text-red-400 bg-black/30 p-3 rounded-lg overflow-auto max-h-40 whitespace-pre-wrap">
              {String(renderError.stack || renderError.message || renderError)}
            </pre>
          </details>
          <button onClick={handleReset}
            className="btn-primary-grad w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4" /> 清除数据并返回首页
          </button>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary 
      fallbackTitle="Dashboard 渲染异常" 
      fallbackMessage="分析数据可能存在问题，请返回首页重新分析"
      onError={(err) => { console.error('[DASHBOARD_CRASH]', err); setRenderError(err) }}
    >
      <Dashboard data={safeData} />
    </ErrorBoundary>
  )
}

function App() {
  const [analysisData, setAnalysisData] = useState(() => {
    try {
      const saved = sessionStorage.getItem('analysis_data')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  useEffect(() => {
    if (analysisData) {
      sessionStorage.setItem('analysis_data', JSON.stringify(analysisData))
    }
  }, [analysisData])

  return (
    <div className="min-h-screen bg-[#050816]">
      <ErrorBoundary>
        <Header />
        <Routes>
          <Route path="/" element={<HomePage onAnalysisComplete={setAnalysisData} />} />
          <Route path="/dashboard" element={<DashboardWrapper data={analysisData} />} />
          <Route path="/jobs" element={<JobsPage />} />
        </Routes>
      </ErrorBoundary>
    </div>
  )
}

export default App
