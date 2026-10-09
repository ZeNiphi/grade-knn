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
  getLatestPrediction,
  getPredictionAvailability,
  getPredictionHistory,
  getStudentGrades,
  hasInvalidSession,
  requestPrediction,
  saveStudentGrade,
} from './api.js'

const TOKEN_KEY = 'course-grade-prediction-token'

function formatGrade(value) {
  return value == null ? 'Not available' : Number(value).toFixed(2)
}

function formatDifference(value) {
  if (value == null) {
    return 'Not available'
  }
  return `${value >= 0 ? '+' : ''}${Number(value).toFixed(2)}`
}

function formatDate(value) {
  const utcValue = /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`
  return new Date(utcValue).toLocaleString()
}

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

function StudentNavigation({ student, onLogout }) {
  const navigate = useNavigate()

  function logout() {
    onLogout()
    navigate('/login', { replace: true, state: { notice: 'You have logged out.' } })
  }

  return (
    <nav className="navbar navbar-expand-sm bg-body-tertiary border-bottom">
      <div className="container">
        <Link className="navbar-brand" to="/workspace">Course Grade Prediction</Link>
        <div className="d-flex align-items-center gap-3">
          <Link className="link-secondary" to="/history">Prediction history</Link>
          <span className="text-body-secondary">Signed in as {student.username}</span>
          <button className="btn btn-outline-secondary btn-sm" onClick={logout} type="button">
            Log out
          </button>
        </div>
      </div>
    </nav>
  )
}

function StudentWorkspace({ student, onLogout }) {
  const navigate = useNavigate()
  const [grades, setGrades] = useState([])
  const [courses, setCourses] = useState([])
  const [availability, setAvailability] = useState([])
  const [latestPrediction, setLatestPrediction] = useState(null)
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [grade, setGrade] = useState('')
  const [editingGrade, setEditingGrade] = useState(null)
  const [predictionCourseId, setPredictionCourseId] = useState('')
  const [predictionResult, setPredictionResult] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isRequestingPrediction, setIsRequestingPrediction] = useState(false)
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
      const [gradesResponse, coursesResponse, availabilityResponse, latestResponse] = await Promise.all([
        getStudentGrades(savedToken),
        getActiveCourses(savedToken),
        getPredictionAvailability(savedToken),
        getLatestPrediction(savedToken),
      ])
      if (loadId !== latestWorkspaceLoad.current) {
        return
      }
      setGrades(gradesResponse.data)
      setCourses(coursesResponse.data)
      setAvailability(availabilityResponse.data)
      setLatestPrediction(latestResponse.data)
      setHasLoaded(true)
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

  async function submitPrediction(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    setPredictionResult(null)
    setIsRequestingPrediction(true)

    try {
      const response = await requestPrediction(token(), Number(predictionCourseId))
      const result = response.data
      setPredictionResult(result)
      if (result.status === 'success') {
        setNotice('Prediction saved to your history.')
      }
      await loadWorkspace()
    } catch (requestError) {
      showRequestError(requestError)
    } finally {
      setIsRequestingPrediction(false)
    }
  }

  const selectedPredictionAvailability = availability.find(
    (item) => item.course.id === Number(predictionCourseId),
  )

  if (!student) {
    return <Navigate to="/login" replace />
  }

  return (
    <>
      <StudentNavigation student={student} onLogout={onLogout} />
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
            ) : !hasLoaded ? null : grades.length === 0 ? (
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
        <section className="mt-5" aria-labelledby="prediction-heading">
          <div className="card">
            <div className="card-body">
              <h2 className="h4 card-title" id="prediction-heading">Course prediction</h2>
              <p className="text-body-secondary">
                Choose an active course to check its current availability and request a prediction.
              </p>
              <form className="row g-3 align-items-end" onSubmit={submitPrediction}>
                <div className="col-md-8">
                  <label className="form-label" htmlFor="prediction-course">Course</label>
                  <select
                    className="form-select"
                    id="prediction-course"
                    onChange={(event) => {
                      setPredictionCourseId(event.target.value)
                      setPredictionResult(null)
                    }}
                    required
                    value={predictionCourseId}
                  >
                    <option value="">Choose an active course</option>
                    {availability.map((item) => (
                      <option key={item.course.id} value={item.course.id}>
                        {item.course.code} — {item.course.name} ({item.is_available ? 'Available' : 'Needs more data'}{item.has_actual_grade ? ', actual grade recorded' : ''})
                      </option>
                    ))}
                  </select>
                  {selectedPredictionAvailability && (
                    <div className="form-text">
                      {selectedPredictionAvailability.is_available
                        ? 'A prediction is currently available. The request will check again before saving.'
                        : 'This course does not currently have enough matching data. You can still request it to see the exact requirement.'}
                    </div>
                  )}
                </div>
                <div className="col-md-4">
                  <button
                    className="btn btn-primary"
                    disabled={isRequestingPrediction}
                    type="submit"
                  >
                    {isRequestingPrediction ? 'Requesting…' : 'Request prediction'}
                  </button>
                </div>
              </form>

              {predictionResult?.status === 'success' && (
                <div className="alert alert-success mt-4 mb-0" role="status">
                  <h3 className="h5">Prediction for {predictionResult.course.code}</h3>
                  <dl className="row mb-0">
                    <dt className="col-sm-5">KNN predicted grade</dt>
                    <dd className="col-sm-7">{formatGrade(predictionResult.predicted_grade)}</dd>
                    <dt className="col-sm-5">Course average (separate baseline)</dt>
                    <dd className="col-sm-7">{formatGrade(predictionResult.course_average)}</dd>
                    <dt className="col-sm-5">Neighbors used</dt>
                    <dd className="col-sm-7">{predictionResult.neighbor_count} (k = {predictionResult.k})</dd>
                    <dt className="col-sm-5">Minimum shared courses required</dt>
                    <dd className="col-sm-7">{predictionResult.minimum_common_courses}</dd>
                  </dl>
                </div>
              )}
              {predictionResult?.status === 'insufficient_data' && (
                <div className="alert alert-warning mt-4 mb-0" role="status">
                  <h3 className="h5">Prediction is not available yet</h3>
                  <p className="mb-2">{predictionResult.message}</p>
                  {predictionResult.details.found != null && (
                    <p className="mb-2">
                      Available now: {predictionResult.details.found}; required: {predictionResult.details.required}.
                    </p>
                  )}
                  <p className="mb-0">
                    Course average (separate baseline): {formatGrade(predictionResult.course_average)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
        {latestPrediction && (
          <section className="mt-4" aria-labelledby="latest-prediction-heading">
            <h2 className="h4" id="latest-prediction-heading">Latest saved prediction</h2>
            <div className="card">
              <div className="card-body">
                <strong>{latestPrediction.course.code} — {latestPrediction.course.name}</strong>
                <dl className="row mb-0 mt-2">
                  <dt className="col-sm-4">Predicted grade</dt>
                  <dd className="col-sm-8">{formatGrade(latestPrediction.predicted_grade)}</dd>
                  <dt className="col-sm-4">Actual grade</dt>
                  <dd className="col-sm-8">{latestPrediction.actual_grade ?? 'Not recorded'}</dd>
                  <dt className="col-sm-4">Difference (predicted − actual)</dt>
                  <dd className="col-sm-8">{formatDifference(latestPrediction.difference)}</dd>
                  <dt className="col-sm-4">Saved</dt>
                  <dd className="col-sm-8">{formatDate(latestPrediction.created_at)}</dd>
                </dl>
              </div>
            </div>
          </section>
        )}
      </main>
    </>
  )
}

function PredictionHistoryPage({ student, onLogout }) {
  const navigate = useNavigate()
  const [history, setHistory] = useState([])
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!student) {
      return
    }

    const savedToken = localStorage.getItem(TOKEN_KEY)
    if (!savedToken) {
      onLogout()
      return
    }

    getPredictionHistory(savedToken)
      .then((response) => setHistory(response.data))
      .catch((requestError) => {
        if (hasInvalidSession(requestError)) {
          onLogout()
          navigate('/login', {
            replace: true,
            state: { error: apiErrorMessage(requestError) },
          })
          return
        }
        setError(apiErrorMessage(requestError))
      })
      .finally(() => setIsLoading(false))
  }, [student])

  if (!student) {
    return <Navigate to="/login" replace />
  }

  return (
    <>
      <StudentNavigation student={student} onLogout={onLogout} />
      <main className="container py-5">
        <h1 className="mb-4">Prediction history</h1>
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        {isLoading ? (
          <p className="text-body-secondary">Loading prediction history…</p>
        ) : error ? null : history.length === 0 ? (
          <p className="text-body-secondary">You do not have any saved predictions yet.</p>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle">
              <thead>
                <tr>
                  <th scope="col">Course</th>
                  <th scope="col">Predicted grade</th>
                  <th scope="col">Actual grade</th>
                  <th scope="col">Difference (predicted − actual)</th>
                  <th scope="col">Saved</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.course.code}</strong><br />
                      <span className="text-body-secondary">{item.course.name}</span>
                    </td>
                    <td>{formatGrade(item.predicted_grade)}</td>
                    <td>{item.actual_grade ?? 'Not recorded'}</td>
                    <td>{formatDifference(item.difference)}</td>
                    <td>{formatDate(item.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
      <Route path="/history" element={<PredictionHistoryPage student={student} onLogout={logout} />} />
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
