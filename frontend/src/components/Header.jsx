import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Target, FileText, Search, BarChart3 } from 'lucide-react'

const Header = () => {
  const location = useLocation()

  const navItems = [
    { path: '/', label: '首页', icon: FileText },
    { path: '/jobs', label: '岗位浏览', icon: Search },
    { path: '/dashboard', label: '分析仪表盘', icon: BarChart3 },
  ]

  return (
    <header className="glass-nav sticky top-0 z-50 h-[72px]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-[72px]">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-[42px] h-[42px] rounded-[14px] flex items-center justify-center
              bg-gradient-to-br from-primary/20 to-accent-pink/10
              border border-white/[0.08]
              group-hover:border-primary/30 transition-all duration-300
              group-hover:shadow-glow-blue">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-extrabold tracking-tight text-white/95 leading-none">
                Offer Hunter
              </h1>
              <p className="text-[11px] font-medium mt-0.5 tracking-wide" style={{ color: 'rgba(255,255,255,0.35)' }}>
                AI 求职助手
              </p>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-1.5">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-medium transition-all duration-300 ${
                    isActive
                      ? 'nav-active-border text-white'
                      : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  <span className="hidden md:inline">{item.label}</span>
                  
                  {/* Active glow dot */}
                  {isActive && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-[2px] rounded-full 
                      bg-gradient-to-r from-primary to-accent-pink" />
                  )}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>
    </header>
  )
}

export default Header
