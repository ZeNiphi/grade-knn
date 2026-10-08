import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000',
})

export function getCurrentUser(token) {
  return api.get('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
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
