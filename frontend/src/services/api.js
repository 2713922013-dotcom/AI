import axios from 'axios'

const api = axios.create({
  baseURL: 'https://ai-f2tu.onrender.com/api',
  timeout: 120000, // 2分钟超时，因为AI分析需要时间
})

/**
 * 上传简历并执行完整分析
 */
export async function analyzeResume(file, targetPosition, targetCity, onProgress) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('target_position', targetPosition)
  formData.append('target_city', targetCity)

  const steps = [
    { label: '正在解析简历...', progress: 10 },
    { label: '正在匹配岗位...', progress: 30 },
    { label: '正在分析技能缺口...', progress: 50 },
    { label: '正在进行ATS评分...', progress: 65 },
    { label: '正在优化简历...', progress: 80 },
    { label: '正在预测Offer概率...', progress: 90 },
    { label: '分析完成！', progress: 100 },
  ]

  let stepIndex = 0
  const progressInterval = setInterval(() => {
    if (stepIndex < steps.length) {
      onProgress?.(steps[stepIndex])
      stepIndex++
    }
  }, 1500)

  try {
    const response = await api.post('/analyze', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })

    clearInterval(progressInterval)
    onProgress?.(steps[steps.length - 1])

    if (response.data.code === 0) {
      return response.data.data
    } else {
      throw new Error(response.data.message || '分析失败')
    }
  } catch (error) {
    clearInterval(progressInterval)
    throw error
  }
}

/**
 * 获取岗位列表
 */
export async function getJobs(position = '', city = '', limit = 50) {
  const response = await api.get('/jobs', {
    params: { position, city, limit }
  })
  return response.data
}

/**
 * 获取分析历史
 */
export async function getHistory(limit = 20) {
  const response = await api.get('/history', { params: { limit } })
  return response.data
}

/**
 * 获取分析详情
 */
export async function getAnalysisDetail(sessionId) {
  const response = await api.get(`/history/${sessionId}`)
  return response.data
}

export default api
