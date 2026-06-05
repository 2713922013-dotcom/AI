import React, { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import Dashboard from './pages/Dashboard'
import Header from './components/Header'

function App() {
  const [analysisData, setAnalysisData] = useState(null)

  return (
    <div className="min-h-screen bg-secondary">
      <Header />
      <Routes>
        <Route path="/" element={<HomePage onAnalysisComplete={setAnalysisData} />} />
        <Route path="/dashboard" element={<Dashboard data={analysisData} />} />
      </Routes>
    </div>
  )
}

export default App
