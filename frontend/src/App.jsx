import { useEffect, useRef, useState } from 'react'
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router'

import api, {
  apiErrorMessage,
  deleteStudentGrade,
  getActiveCourses,
  getCurrentUser,
  getStudentGrades,
  hasInvalidSession,
  saveStudentGrade,
} from './api.js'

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
      {location.state?.error && (
        <div className="alert alert-danger" role="alert">
          {location.state.error}
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
  const [grades, setGrades] = useState([])
  const [courses, setCourses] = useState([])
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [grade, setGrade] = useState('')
  const [editingGrade, setEditingGrade] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingCourseId, setDeletingCourseId] = useState(null)
  const latestWorkspaceLoad = useRef(0)

  function token() {
    return localStorage.getItem(TOKEN_KEY)
  }

  function showRequestError(requestError) {
    if (hasInvalidSession(requestError)) {
      onLogout()
      navigate('/login', {
        replace: true,
        state: { error: apiErrorMessage(requestError) },
      })
      return true
    }
    setError(apiErrorMessage(requestError))
    return false
  }

  async function loadWorkspace() {
    const loadId = latestWorkspaceLoad.current + 1
    latestWorkspaceLoad.current = loadId
    const savedToken = token()
    if (!savedToken) {
      if (loadId === latestWorkspaceLoad.current) {
        onLogout()
      }
      return
    }

    setIsLoading(true)
    try {
      const [gradesResponse, coursesResponse] = await Promise.all([
        getStudentGrades(savedToken),
        getActiveCourses(savedToken),
      ])
      if (loadId !== latestWorkspaceLoad.current) {
        return
      }
      setGrades(gradesResponse.data)
      setCourses(coursesResponse.data)
    } catch (requestError) {
      if (loadId === latestWorkspaceLoad.current) {
        showRequestError(requestError)
      }
    } finally {
      if (loadId === latestWorkspaceLoad.current) {
        setIsLoading(false)
      }
    }
  }

  useEffect(() => {
    if (student) {
      void loadWorkspace()
    }
  }, [student])

  function resetForm() {
    setSelectedCourseId('')
    setGrade('')
    setEditingGrade(null)
  }

  function selectCourse(event) {
    const courseId = event.target.value
    setSelectedCourseId(courseId)
    const existingGrade = grades.find((item) => item.course.id === Number(courseId))
    if (existingGrade) {
      setEditingGrade(existingGrade)
      setGrade(String(existingGrade.grade))
    } else {
      setEditingGrade(null)
      setGrade('')
    }
  }

  function beginEditing(item) {
    setEditingGrade(item)
    setSelectedCourseId(String(item.course.id))
    setGrade(String(item.grade))
    setError('')
    setNotice('')
  }

  async function submitGrade(event) {
    event.preventDefault()
    setError('')
    setNotice('')

    const courseId = Number(selectedCourseId)
    const numericGrade = Number(grade)
    if (!Number.isInteger(numericGrade) || numericGrade < 0 || numericGrade > 100) {
      setError('Grade must be an integer from 0 to 100.')
      return
    }

    setIsSaving(true)
    try {
      await saveStudentGrade(token(), { course_id: courseId, grade: numericGrade })
      setNotice(editingGrade ? 'Grade updated.' : 'Grade added.')
      resetForm()
      await loadWorkspace()
    } catch (requestError) {
      showRequestError(requestError)
    } finally {
      setIsSaving(false)
    }
  }

  async function removeGrade(item) {
    if (!window.confirm(`Delete the grade for ${item.course.code}?`)) {
      return
    }

    setError('')
    setNotice('')
    setDeletingCourseId(item.course.id)
    try {
      await deleteStudentGrade(token(), item.course.id)
      if (editingGrade?.course.id === item.course.id) {
        resetForm()
      }
      setNotice('Grade deleted.')
      await loadWorkspace()
    } catch (requestError) {
      showRequestError(requestError)
    } finally {
      setDeletingCourseId(null)
    }
  }

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
        <h1 className="mb-4">Student workspace</h1>
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        {notice && <div className="alert alert-success" role="status">{notice}</div>}
        <div className="row g-4">
          <section className="col-lg-5" aria-labelledby="grade-form-heading">
            <div className="card h-100">
              <div className="card-body">
                <h2 className="h4 card-title" id="grade-form-heading">
                  {editingGrade ? 'Update grade' : 'Add grade'}
                </h2>
                <form onSubmit={submitGrade}>
                  <div className="mb-3">
                    <label className="form-label" htmlFor="grade-course">Course</label>
                    <select
                      className="form-select"
                      disabled={Boolean(editingGrade)}
                      id="grade-course"
                      onChange={selectCourse}
                      required
                      value={selectedCourseId}
                    >
                      <option value="">Choose an active course</option>
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.code} — {course.name}
                        </option>
                      ))}
                      {editingGrade && !editingGrade.course.is_active && (
                        <option value={editingGrade.course.id}>
                          {editingGrade.course.code} — {editingGrade.course.name} (inactive)
                        </option>
                      )}
                    </select>
                    {!editingGrade && selectedCourseId && grades.some(
                      (item) => item.course.id === Number(selectedCourseId),
                    ) && (
                      <div className="form-text">
                        This course already has a grade. Submitting will update it.
                      </div>
                    )}
                    {editingGrade && !editingGrade.course.is_active && (
                      <div className="form-text">
                        This course is inactive, but you can correct or delete its existing grade.
                      </div>
                    )}
                  </div>
                  <div className="mb-3">
                    <label className="form-label" htmlFor="grade-value">Grade</label>
                    <input
                      className="form-control"
                      id="grade-value"
                      onChange={(event) => setGrade(event.target.value)}
                      required
                      type="number"
                      value={grade}
                    />
                    <div className="form-text">Enter a whole number from 0 to 100.</div>
                  </div>
                  <div className="d-flex gap-2">
                    <button className="btn btn-primary" disabled={isSaving} type="submit">
                      {isSaving ? 'Saving…' : editingGrade ? 'Update grade' : 'Add grade'}
                    </button>
                    {editingGrade && (
                      <button className="btn btn-outline-secondary" onClick={resetForm} type="button">
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </section>
          <section className="col-lg-7" aria-labelledby="grades-heading">
            <h2 className="h4" id="grades-heading">Your grades</h2>
            {isLoading ? (
              <p className="text-body-secondary">Loading grades…</p>
            ) : grades.length === 0 ? (
              <p className="text-body-secondary">You have not added any grades yet.</p>
            ) : (
              <div className="table-responsive">
                <table className="table align-middle">
                  <thead>
                    <tr>
                      <th scope="col">Course</th>
                      <th scope="col">Grade</th>
                      <th scope="col">Status</th>
                      <th scope="col"><span className="visually-hidden">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {grades.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.course.code}</strong><br />
                          <span className="text-body-secondary">{item.course.name}</span>
                        </td>
                        <td>{item.grade}</td>
                        <td>
                          {item.course.is_active ? (
                            <span className="badge text-bg-success">Active</span>
                          ) : (
                            <span className="badge text-bg-secondary">Inactive</span>
                          )}
                        </td>
                        <td className="text-end text-nowrap">
                          <button
                            className="btn btn-sm btn-outline-primary me-2"
                            onClick={() => beginEditing(item)}
                            type="button"
                          >
                            Update
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            disabled={deletingCourseId === item.course.id}
                            onClick={() => removeGrade(item)}
                            type="button"
                          >
                            {deletingCourseId === item.course.id ? 'Deleting…' : 'Delete'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
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
