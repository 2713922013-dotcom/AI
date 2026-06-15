import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
    // 调用父组件的 onError 回调
    if (this.props.onError) {
      this.props.onError(error)
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#050816]">
          <div className="glass-card rounded-2xl p-8 max-w-md mx-4 text-center border-red-500/15">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-lg font-semibold text-white/90 mb-2">
              {this.props.fallbackTitle || '页面加载异常'}
            </h2>
            <p className="text-sm text-white/40 mb-6">
              {this.props.fallbackMessage || '渲染过程中出现了错误，请尝试刷新页面'}
            </p>
            <button
              onClick={this.handleRetry}
              className="btn-primary-grad inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white"
            >
              <RefreshCw className="w-4 h-4" />
              刷新页面
            </button>
            {this.state.error && (
              <details className="mt-4 text-left">
                <summary className="text-xs text-white/30 cursor-pointer hover:text-white/50">错误详情</summary>
                <pre className="mt-2 text-xs text-red-400 glass-card p-3 rounded-lg overflow-auto max-h-32">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
