import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: {
    'X-User-Id': '1',
  },
})
const LLM_BASE = "http://localhost:8001"
// 강의
export const getLectures     = ()     => api.get('/lectures')
export const getLecture      = (id)   => api.get(`/lectures/${id}`)
export const startLecture    = (id)   => api.post(`/lectures/${id}/start`)
export const endLecture      = (body) => api.post('/lectures/end', body)

// 집중도
export const postFocusTick   = (body) => api.post('/focus/tick', body)
export const getFocusSession = (id)   => api.get(`/focus/session/${id}`)

// 퀴즈
export const generateQuiz    = (body) => api.post('/quiz/generate', body)
export const answerQuiz      = (body) => api.post('/quiz/answer', body)
export const getReviewQueue  = ()     => api.get('/quiz/review-queue')

// 대시보드
export const getDashboard    = ()     => api.get('/dashboard/summary')
export const getSubjects     = ()     => api.get('/dashboard/subjects')

// 관리자
export const getAdminConfig  = ()     => api.get('/admin/settings')
export const toggleHand      = (b)    => api.post('/admin/hand-detection/toggle', { enabled: b })
export const setPlaybackSens = (body) => api.post('/admin/playback-sensitivity', body)

// LLM 세션 시작 (강의 종료 시)
export const startLLMSession = (filename, subject, focusTimestamps) =>
  axios.post(`${LLM_BASE}/api/chat`, {
    lecture_filename: filename,
    subject,
    focus_timestamps: focusTimestamps,
  })


// LLM 답변 전송
export const sendLLMAnswer = (message) =>
  axios.post(`${LLM_BASE}/api/chat`, { message })  
