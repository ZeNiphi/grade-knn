import { useEffect, useState } from 'react'
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router'

import api, { apiErrorMessage, getCurrentUser } from './api.js'

const TOKEN_KEY = 'course-grade-prediction-token'

function PublicPage({ children }) {
  return (
    <main className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-8 col-lg-6">{children}</div>
      </div>
    </main>
  )
}

function LoginPage({ student, sessionError, onLogin }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (student) {
    return <Navigate to="/workspace" replace />
  }

  async function submitLogin(event) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const response = await api.post('/auth/login', { username, password })
      await onLogin(response.data.access_token)
      navigate('/workspace', { replace: true })
    } catch (requestError) {
      setError(
        requestError.message === 'ADMIN_ACCESS_UNAVAILABLE'
          ? 'Admin access will be available in a later step.'
          : apiErrorMessage(requestError),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <PublicPage>
      <h1 className="mb-3">Student login</h1>
      <p className="text-body-secondary">
        Sign in to access your course-grade prediction workspace.
      </p>
      {location.state?.notice && (
        <div className="alert alert-success" role="status">
          {location.state.notice}
        </div>
      )}
      {(error || sessionError) && (
        <div className="alert alert-danger" role="alert">{error || sessionError}</div>
      )}
      <form onSubmit={submitLogin}>
        <div className="mb-3">
          <label className="form-label" htmlFor="login-username">Username</label>
          <input
            className="form-control"
            id="login-username"
            minLength="3"
            maxLength="100"
            onChange={(event) => setUsername(event.target.value)}
            required
            value={username}
          />
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="login-password">Password</label>
          <input
            className="form-control"
            id="login-password"
            minLength="8"
            maxLength="128"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </div>
        <button className="btn btn-primary" disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Signing in…' : 'Log in'}
        </button>
      </form>
      <p className="mt-3 mb-0">
        New student? <Link to="/register">Create an account</Link>.
      </p>
    </PublicPage>
  )
}

function RegistrationPage({ student }) {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (student) {
    return <Navigate to="/workspace" replace />
  }

  async function submitRegistration(event) {
    event.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setIsSubmitting(true)
    try {
      await api.post('/auth/register', { username, password })
      navigate('/login', {
        replace: true,
        state: { notice: 'Your Student account was created. You can now log in.' },
      })
    } catch (requestError) {
      setError(apiErrorMessage(requestError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <PublicPage>
      <h1 className="mb-3">Create Student account</h1>
      <p className="text-body-secondary">
        Registration creates a Student account only.
      </p>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <form onSubmit={submitRegistration}>
        <div className="mb-3">
          <label className="form-label" htmlFor="registration-username">Username</label>
          <input
            className="form-control"
            id="registration-username"
            minLength="3"
            maxLength="100"
            onChange={(event) => setUsername(event.target.value)}
            pattern="[A-Za-z0-9_]+"
            required
            value={username}
          />
          <div className="form-text">Use 3-100 letters, numbers, or underscores.</div>
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="registration-password">Password</label>
          <input
            className="form-control"
            id="registration-password"
            minLength="8"
            maxLength="128"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
          <div className="form-text">Use 8-128 characters.</div>
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="registration-confirm-password">Confirm password</label>
          <input
            className="form-control"
            id="registration-confirm-password"
            minLength="8"
            maxLength="128"
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            type="password"
            value={confirmPassword}
          />
        </div>
        <button className="btn btn-primary" disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="mt-3 mb-0">
        Already have an account? <Link to="/login">Log in</Link>.
      </p>
    </PublicPage>
  )
}

function StudentWorkspace({ student, onLogout }) {
  const navigate = useNavigate()

  if (!student) {
    return <Navigate to="/login" replace />
  }

  function logout() {
    onLogout()
    navigate('/login', { replace: true, state: { notice: 'You have logged out.' } })
  }

  return (
    <>
      <nav className="navbar navbar-expand-sm bg-body-tertiary border-bottom">
        <div className="container">
          <Link className="navbar-brand" to="/workspace">Course Grade Prediction</Link>
          <div className="d-flex align-items-center gap-3">
            <span className="text-body-secondary">Signed in as {student.username}</span>
            <button className="btn btn-outline-secondary btn-sm" onClick={logout} type="button">
              Log out
            </button>
          </div>
        </div>
      </nav>
      <main className="container py-5">
        <h1 className="mb-3">Student workspace</h1>
        <div className="alert alert-info mb-0" role="status">
          Your account is ready. Grade entry, predictions, and history will be added in the next Student interface steps.
        </div>
      </main>
    </>
  )
}

function Application() {
  const [student, setStudent] = useState(null)
  const [sessionError, setSessionError] = useState('')
  const [isCheckingSession, setIsCheckingSession] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      setIsCheckingSession(false)
      return
    }

    getCurrentUser(token)
      .then((response) => {
        if (response.data.role === 'student') {
          setStudent(response.data)
        } else {
          localStorage.removeItem(TOKEN_KEY)
        }
      })
      .catch((requestError) => {
        if (requestError.response) {
          localStorage.removeItem(TOKEN_KEY)
          setSessionError(
            requestError.response.data?.code === 'ACCOUNT_DISABLED'
              ? apiErrorMessage(requestError)
              : 'Your session has ended. Please log in again.',
          )
        } else {
          setSessionError('Unable to restore your session. Check that the backend is running.')
        }
      })
      .finally(() => setIsCheckingSession(false))
  }, [])

  async function login(token) {
    setSessionError('')
    const response = await getCurrentUser(token)
    if (response.data.role !== 'student') {
      localStorage.removeItem(TOKEN_KEY)
      throw new Error('ADMIN_ACCESS_UNAVAILABLE')
    }
    localStorage.setItem(TOKEN_KEY, token)
    setStudent(response.data)
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    setStudent(null)
    setSessionError('')
  }

  if (isCheckingSession) {
    return <main className="container py-5">Checking your session…</main>
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={<LoginPage student={student} sessionError={sessionError} onLogin={login} />}
      />
      <Route path="/register" element={<RegistrationPage student={student} />} />
      <Route path="/workspace" element={<StudentWorkspace student={student} onLogout={logout} />} />
      <Route path="*" element={<Navigate to={student ? '/workspace' : '/login'} replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Application />
    </BrowserRouter>
  )
}
