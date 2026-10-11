import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000',
})

export function getCurrentUser(token) {
  return api.get('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

function authorization(token) {
  return { headers: { Authorization: `Bearer ${token}` } }
}

export function getStudentGrades(token) {
  return api.get('/grades', authorization(token))
}

export function getActiveCourses(token) {
  return api.get('/courses', authorization(token))
}

export function saveStudentGrade(token, grade) {
  return api.post('/grades', grade, authorization(token))
}

export function deleteStudentGrade(token, courseId) {
  return api.delete(`/grades/${courseId}`, authorization(token))
}

export function getPredictionAvailability(token) {
  return api.get('/predictions/availability', authorization(token))
}

export function requestPrediction(token, courseId) {
  return api.post('/predictions', { course_id: courseId }, authorization(token))
}

export function getLatestPrediction(token) {
  return api.get('/predictions/latest', authorization(token))
}

export function getPredictionHistory(token) {
  return api.get('/predictions/history', authorization(token))
}

export function getAdminSummary(token) {
  return api.get('/admin/summary', authorization(token))
}

export function getKnnSetting(token) {
  return api.get('/admin/knn-setting', authorization(token))
}

export function updateKnnSetting(token, k) {
  return api.put('/admin/knn-setting', { k }, authorization(token))
}

export function getAdminCourses(token) {
  return api.get('/admin/courses', authorization(token))
}

export function createAdminCourse(token, course) {
  return api.post('/admin/courses', course, authorization(token))
}

export function updateAdminCourse(token, courseId, course) {
  return api.put(`/admin/courses/${courseId}`, course, authorization(token))
}

export function setAdminCourseActive(token, courseId, isActive) {
  return api.post(
    `/admin/courses/${courseId}/${isActive ? 'activate' : 'deactivate'}`,
    undefined,
    authorization(token),
  )
}

export function deleteAdminCourse(token, courseId) {
  return api.delete(`/admin/courses/${courseId}`, authorization(token))
}

export function getHistoricalStudents(token) {
  return api.get('/admin/historical-students', authorization(token))
}

export function getHistoricalStudent(token, historicalStudentId) {
  return api.get(`/admin/historical-students/${historicalStudentId}`, authorization(token))
}

export function setHistoricalStudentActive(token, historicalStudentId, isActive) {
  return api.post(
    `/admin/historical-students/${historicalStudentId}/${isActive ? 'activate' : 'deactivate'}`,
    undefined,
    authorization(token),
  )
}

export function deleteHistoricalStudent(token, historicalStudentId) {
  return api.delete(`/admin/historical-students/${historicalStudentId}`, authorization(token))
}

export function getAdminStudents(token) {
  return api.get('/admin/students', authorization(token))
}

export function getAdminStudent(token, studentId) {
  return api.get(`/admin/students/${studentId}`, authorization(token))
}

export function setAdminStudentActive(token, studentId, isActive) {
  return api.post(
    `/admin/students/${studentId}/${isActive ? 'activate' : 'disable'}`,
    undefined,
    authorization(token),
  )
}

export function hasInvalidSession(error) {
  return ['AUTHENTICATION_REQUIRED', 'ACCOUNT_DISABLED'].includes(
    error.response?.data?.code,
  )
}

export function apiErrorMessage(error) {
  const response = error.response

  if (!response) {
    return 'Unable to reach the server. Check that the backend is running and try again.'
  }

  if (response.data?.message) {
    return response.data.message
  }

  if (response.status >= 500) {
    return 'The server could not complete the request. Please try again later.'
  }

  return 'The request could not be completed. Please review your details and try again.'
}

export default api
