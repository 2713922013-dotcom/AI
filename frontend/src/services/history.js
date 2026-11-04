/**
 * 分析历史本地存储
 *
 * 线上后端跑在 Render 免费实例上，进程重启后内存态历史会清空，
 * 因此历史记录存在浏览器本地：换设备/清缓存会丢，但不会因为服务重启丢失。
 */

const KEY = 'offer-hunter-history'
const MAX_RECORDS = 20

export function listHistory() {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** 保存一次分析结果，返回最新列表 */
export function saveAnalysis(data) {
  if (!data || !data.session_id) return listHistory()
  try {
    const list = listHistory()
    if (list.some(item => item.session_id === data.session_id)) return list

    const record = {
      session_id: data.session_id,
      timestamp: data.timestamp || new Date().toISOString(),
      target_position: data.target_position || '',
      target_city: data.target_city || '',
      ats_score: data.ats_score?.total_score || 0,
      interview_probability: data.offer_prediction?.interview_probability || 0,
      offer_probability: data.offer_prediction?.offer_probability || 0,
      matched_jobs: data.matched_jobs?.length || 0,
      skills_count: data.resume_parsed?.skills?.length || 0,
      engine: data.engine?.mode || 'rule',
    }
    const next = [record, ...list].slice(0, MAX_RECORDS)
    localStorage.setItem(KEY, JSON.stringify(next))
    return next
  } catch {
    return listHistory()
  }
}

/** 取上一次分析（排除当前会话），用于「较上次」趋势对比 */
export function getPrevious(sessionId) {
  const list = listHistory()
  return list.find(item => item.session_id !== sessionId) || null
}

export function clearHistory() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* 忽略隐私模式下的写入失败 */
  }
}
