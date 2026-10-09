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
  createAdminCourse,
  deleteHistoricalStudent,
  deleteAdminCourse,
  getAdminStudent,
  getAdminStudents,
  getAdminCourses,
  getAdminSummary,
  getHistoricalStudent,
  getHistoricalStudents,
  getKnnSetting,
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
  setAdminStudentActive,
  setAdminCourseActive,
  setHistoricalStudentActive,
  updateAdminCourse,
  updateKnnSetting,
} from './api.js'

const TOKEN_KEY = 'course-grade-prediction-token'

function homePath(user) {
  return user?.role === 'admin' ? '/admin' : '/workspace'
}

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
    return <Navigate to={homePath(student)} replace />
  }

  async function submitLogin(event) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const response = await api.post('/auth/login', { username, password })
      navigate(homePath(await onLogin(response.data.access_token)), { replace: true })
    } catch (requestError) {
      setError(apiErrorMessage(requestError))
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
    return <Navigate to={homePath(student)} replace />
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

  if (student.role !== 'student') {
    return <Navigate to="/admin" replace />
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

  if (student.role !== 'student') {
    return <Navigate to="/admin" replace />
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

function AdminNavigation({ student, onLogout }) {
  const navigate = useNavigate()

  function logout() {
    onLogout()
    navigate('/login', { replace: true, state: { notice: 'You have logged out.' } })
  }

  return (
    <nav className="navbar navbar-expand-sm bg-body-tertiary border-bottom">
      <div className="container">
        <Link className="navbar-brand" to="/admin">Course Grade Prediction</Link>
        <div className="d-flex align-items-center gap-3">
          <Link className="link-secondary" to="/admin">Summary</Link>
          <Link className="link-secondary" to="/admin/courses">Courses</Link>
          <Link className="link-secondary" to="/admin/historical-students">Historical profiles</Link>
          <Link className="link-secondary" to="/admin/students">Students</Link>
          <Link className="link-secondary" to="/admin/settings">KNN settings</Link>
          <span className="text-body-secondary">Admin: {student.username}</span>
          <button className="btn btn-outline-secondary btn-sm" onClick={logout} type="button">
            Log out
          </button>
        </div>
      </div>
    </nav>
  )
}

function AdminSummaryPage({ student, onLogout }) {
  const navigate = useNavigate()
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!student || student.role !== 'admin') {
      return
    }

    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      onLogout()
      return
    }

    getAdminSummary(token)
      .then((response) => setSummary(response.data))
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
  }, [student])

  if (!student) {
    return <Navigate to="/login" replace />
  }
  if (student.role !== 'admin') {
    return <Navigate to="/workspace" replace />
  }

  return (
    <>
      <AdminNavigation student={student} onLogout={onLogout} />
      <main className="container py-5">
        <h1 className="mb-4">Admin summary</h1>
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        {!summary && !error ? (
          <p className="text-body-secondary">Loading summary…</p>
        ) : summary ? (
          <div className="row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-3">
            <SummaryCount label="Registered accounts" value={summary.registered_account_count} />
            <SummaryCount label="Active Students" value={summary.active_student_count} />
            <SummaryCount label="Courses" value={`${summary.active_course_count} active / ${summary.course_count} total`} />
            <SummaryCount label="Historical profiles" value={`${summary.active_historical_student_count} active / ${summary.historical_student_count} total`} />
            <SummaryCount label="Stored grades" value={summary.stored_grade_count} />
          </div>
        ) : null}
      </main>
    </>
  )
}

function SummaryCount({ label, value }) {
  return (
    <div className="col">
      <div className="card h-100">
        <div className="card-body">
          <div className="text-body-secondary small">{label}</div>
          <div className="fs-4">{value}</div>
        </div>
      </div>
    </div>
  )
}

function AdminCoursesPage({ student, onLogout }) {
  const navigate = useNavigate()
  const [courses, setCourses] = useState([])
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [editingCourse, setEditingCourse] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [busyCourseId, setBusyCourseId] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  function token() {
    return localStorage.getItem(TOKEN_KEY)
  }

  function handleRequestError(requestError) {
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

  async function loadCourses() {
    const savedToken = token()
    if (!savedToken) {
      onLogout()
      return
    }

    setIsLoading(true)
    try {
      const response = await getAdminCourses(savedToken)
      setCourses(response.data)
      setHasLoaded(true)
    } catch (requestError) {
      handleRequestError(requestError)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (student?.role === 'admin') {
      void loadCourses()
    }
  }, [student])

  function resetForm() {
    setCode('')
    setName('')
    setEditingCourse(null)
  }

  function beginEditing(course) {
    setEditingCourse(course)
    setCode(course.code)
    setName(course.name)
    setError('')
    setNotice('')
  }

  async function submitCourse(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    const trimmedCode = code.trim()
    const trimmedName = name.trim()
    if (!trimmedCode || !trimmedName) {
      setError('Course code and name are required.')
      return
    }

    setIsSaving(true)
    try {
      if (editingCourse) {
        await updateAdminCourse(token(), editingCourse.id, { code: trimmedCode, name: trimmedName })
        setNotice('Course updated.')
      } else {
        await createAdminCourse(token(), { code: trimmedCode, name: trimmedName })
        setNotice('Course added.')
      }
      resetForm()
      await loadCourses()
    } catch (requestError) {
      handleRequestError(requestError)
    } finally {
      setIsSaving(false)
    }
  }

  async function changeActiveState(course) {
    setError('')
    setNotice('')
    setBusyCourseId(course.id)
    try {
      await setAdminCourseActive(token(), course.id, !course.is_active)
      setNotice(`Course ${course.is_active ? 'deactivated' : 'activated'}.`)
      await loadCourses()
    } catch (requestError) {
      handleRequestError(requestError)
    } finally {
      setBusyCourseId(null)
    }
  }

  async function removeCourse(course) {
    if (!window.confirm(
      `Permanently delete ${course.code}? If it has fewer than 10 associated grades, this also deletes its related grades and saved predictions. This cannot be undone.`,
    )) {
      return
    }

    setError('')
    setNotice('')
    setBusyCourseId(course.id)
    try {
      await deleteAdminCourse(token(), course.id)
      if (editingCourse?.id === course.id) {
        resetForm()
      }
      setNotice('Course permanently deleted.')
      await loadCourses()
    } catch (requestError) {
      handleRequestError(requestError)
    } finally {
      setBusyCourseId(null)
    }
  }

  if (!student) {
    return <Navigate to="/login" replace />
  }
  if (student.role !== 'admin') {
    return <Navigate to="/workspace" replace />
  }

  return (
    <>
      <AdminNavigation student={student} onLogout={onLogout} />
      <main className="container py-5">
        <h1 className="mb-4">Course management</h1>
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        {notice && <div className="alert alert-success" role="status">{notice}</div>}
        <div className="row g-4">
          <section className="col-lg-4" aria-labelledby="course-form-heading">
            <div className="card">
              <div className="card-body">
                <h2 className="h4 card-title" id="course-form-heading">
                  {editingCourse ? 'Edit course' : 'Add course'}
                </h2>
                <form onSubmit={submitCourse}>
                  <div className="mb-3">
                    <label className="form-label" htmlFor="course-code">Course code</label>
                    <input className="form-control" id="course-code" maxLength="20" onChange={(event) => setCode(event.target.value)} required value={code} />
                  </div>
                  <div className="mb-3">
                    <label className="form-label" htmlFor="course-name">Course name</label>
                    <input className="form-control" id="course-name" maxLength="150" onChange={(event) => setName(event.target.value)} required value={name} />
                  </div>
                  <div className="d-flex gap-2">
                    <button className="btn btn-primary" disabled={isSaving} type="submit">
                      {isSaving ? 'Saving…' : editingCourse ? 'Save changes' : 'Add course'}
                    </button>
                    {editingCourse && <button className="btn btn-outline-secondary" onClick={resetForm} type="button">Cancel</button>}
                  </div>
                </form>
              </div>
            </div>
          </section>
          <section className="col-lg-8" aria-labelledby="courses-heading">
            <h2 className="h4" id="courses-heading">All courses</h2>
            {isLoading ? (
              <p className="text-body-secondary">Loading courses…</p>
            ) : !hasLoaded ? null : courses.length === 0 ? (
              <p className="text-body-secondary">No courses have been added yet.</p>
            ) : (
              <div className="table-responsive">
                <table className="table align-middle">
                  <thead>
                    <tr><th scope="col">Course</th><th scope="col">Status</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr>
                  </thead>
                  <tbody>
                    {courses.map((course) => (
                      <tr key={course.id}>
                        <td><strong>{course.code}</strong><br /><span className="text-body-secondary">{course.name}</span></td>
                        <td>{course.is_active ? <span className="badge text-bg-success">Active</span> : <span className="badge text-bg-secondary">Inactive</span>}</td>
                        <td className="text-end text-nowrap">
                          <button className="btn btn-sm btn-outline-primary me-2" disabled={busyCourseId === course.id} onClick={() => beginEditing(course)} type="button">Edit</button>
                          <button className="btn btn-sm btn-outline-secondary me-2" disabled={busyCourseId === course.id} onClick={() => changeActiveState(course)} type="button">
                            {busyCourseId === course.id ? 'Working…' : course.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button className="btn btn-sm btn-outline-danger" disabled={busyCourseId === course.id} onClick={() => removeCourse(course)} type="button">Delete</button>
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

function profileLabel(profile) {
  return profile.generated_key || `Historical profile #${profile.id}`
}

function AdminHistoricalStudentsPage({ student, onLogout }) {
  const navigate = useNavigate()
  const [profiles, setProfiles] = useState([])
  const [selectedProfile, setSelectedProfile] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [busyProfileId, setBusyProfileId] = useState(null)

  function token() {
    return localStorage.getItem(TOKEN_KEY)
  }

  function handleRequestError(requestError) {
    if (hasInvalidSession(requestError)) {
      onLogout()
      navigate('/login', {
        replace: true,
        state: { error: apiErrorMessage(requestError) },
      })
      return
    }
    setError(apiErrorMessage(requestError))
  }

  async function loadProfiles() {
    setIsLoading(true)
    try {
      const response = await getHistoricalStudents(token())
      setProfiles(response.data)
      setHasLoaded(true)
    } catch (requestError) {
      handleRequestError(requestError)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (student?.role === 'admin') {
      void loadProfiles()
    }
  }, [student])

  async function showDetails(profileId) {
    setError('')
    setNotice('')
    setBusyProfileId(profileId)
    try {
      const response = await getHistoricalStudent(token(), profileId)
      setSelectedProfile(response.data)
    } catch (requestError) {
      handleRequestError(requestError)
    } finally {
      setBusyProfileId(null)
    }
  }

  async function changeActiveState(profile) {
    setError('')
    setNotice('')
    setBusyProfileId(profile.id)
    try {
      const response = await setHistoricalStudentActive(token(), profile.id, !profile.is_active_for_knn)
      setSelectedProfile((current) => (
        current?.id === profile.id ? { ...current, ...response.data } : current
      ))
      setNotice(`Historical profile ${profile.is_active_for_knn ? 'deactivated' : 'activated'} for KNN.`)
      await loadProfiles()
    } catch (requestError) {
      handleRequestError(requestError)
    } finally {
      setBusyProfileId(null)
    }
  }

  async function removeProfile(profile) {
    if (!window.confirm(
      `Permanently delete ${profileLabel(profile)} and its historical grades? Courses, registered Students, and saved predictions are not deleted.`,
    )) {
      return
    }

    setError('')
    setNotice('')
    setBusyProfileId(profile.id)
    try {
      await deleteHistoricalStudent(token(), profile.id)
      if (selectedProfile?.id === profile.id) {
        setSelectedProfile(null)
      }
      setNotice('Historical profile deleted.')
      await loadProfiles()
    } catch (requestError) {
      handleRequestError(requestError)
    } finally {
      setBusyProfileId(null)
    }
  }

  if (!student) {
    return <Navigate to="/login" replace />
  }
  if (student.role !== 'admin') {
    return <Navigate to="/workspace" replace />
  }

  return (
    <>
      <AdminNavigation student={student} onLogout={onLogout} />
      <main className="container py-5">
        <h1 className="mb-4">Historical profiles</h1>
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        {notice && <div className="alert alert-success" role="status">{notice}</div>}
        <div className="row g-4">
          <section className="col-lg-8" aria-labelledby="historical-profiles-heading">
            <h2 className="h4" id="historical-profiles-heading">All profiles</h2>
            {isLoading ? (
              <p className="text-body-secondary">Loading historical profiles…</p>
            ) : !hasLoaded ? null : profiles.length === 0 ? (
              <p className="text-body-secondary">No historical profiles are available.</p>
            ) : (
              <div className="table-responsive">
                <table className="table align-middle">
                  <thead>
                    <tr>
                      <th scope="col">Profile</th>
                      <th scope="col">Grades</th>
                      <th scope="col">KNN status</th>
                      <th scope="col"><span className="visually-hidden">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {profiles.map((profile) => (
                      <tr key={profile.id}>
                        <td><strong>{profileLabel(profile)}</strong><br /><span className="text-body-secondary">ID {profile.id}</span></td>
                        <td>{profile.grade_count}</td>
                        <td>{profile.is_active_for_knn ? <span className="badge text-bg-success">Active</span> : <span className="badge text-bg-secondary">Inactive</span>}</td>
                        <td className="text-end text-nowrap">
                          <button className="btn btn-sm btn-outline-primary me-2" disabled={busyProfileId === profile.id} onClick={() => showDetails(profile.id)} type="button">Details</button>
                          <button className="btn btn-sm btn-outline-secondary me-2" disabled={busyProfileId === profile.id} onClick={() => changeActiveState(profile)} type="button">
                            {busyProfileId === profile.id ? 'Working…' : profile.is_active_for_knn ? 'Deactivate' : 'Activate'}
                          </button>
                          <button className="btn btn-sm btn-outline-danger" disabled={busyProfileId === profile.id} onClick={() => removeProfile(profile)} type="button">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <HistoricalStudentDetails profile={selectedProfile} />
        </div>
      </main>
    </>
  )
}

function HistoricalStudentDetails({ profile }) {
  return (
    <section className="col-lg-4" aria-labelledby="historical-details-heading">
      <div className="card">
        <div className="card-body">
          <h2 className="h4 card-title" id="historical-details-heading">Profile details</h2>
          {!profile ? (
            <p className="text-body-secondary mb-0">Select Details to view a profile's grades.</p>
          ) : (
            <>
              <dl className="row mb-3">
                <dt className="col-sm-5">Profile</dt><dd className="col-sm-7">{profileLabel(profile)}</dd>
                <dt className="col-sm-5">KNN status</dt><dd className="col-sm-7">{profile.is_active_for_knn ? 'Active' : 'Inactive'}</dd>
                <dt className="col-sm-5">Grades</dt><dd className="col-sm-7">{profile.grade_count}</dd>
              </dl>
              {profile.grades.length === 0 ? (
                <p className="text-body-secondary mb-0">This profile has no grades.</p>
              ) : (
                <ul className="list-group list-group-flush">
                  {profile.grades.map((item) => (
                    <li className="list-group-item px-0" key={item.course.id}>
                      <strong>{item.course.code}</strong>: {item.grade}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}

function AdminStudentsPage({ student, onLogout }) {
  const navigate = useNavigate()
  const [students, setStudents] = useState([])
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [busyStudentId, setBusyStudentId] = useState(null)

  function token() {
    return localStorage.getItem(TOKEN_KEY)
  }

  function handleRequestError(requestError) {
    if (hasInvalidSession(requestError)) {
      onLogout()
      navigate('/login', {
        replace: true,
        state: { error: apiErrorMessage(requestError) },
      })
      return
    }
    setError(apiErrorMessage(requestError))
  }

  async function loadStudents() {
    setIsLoading(true)
    try {
      const response = await getAdminStudents(token())
      setStudents(response.data)
      setHasLoaded(true)
    } catch (requestError) {
      handleRequestError(requestError)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (student?.role === 'admin') {
      void loadStudents()
    }
  }, [student])

  async function showDetails(studentId) {
    setError('')
    setNotice('')
    setBusyStudentId(studentId)
    try {
      const response = await getAdminStudent(token(), studentId)
      setSelectedStudent(response.data)
    } catch (requestError) {
      handleRequestError(requestError)
    } finally {
      setBusyStudentId(null)
    }
  }

  async function changeActiveState(managedStudent) {
    setError('')
    setNotice('')
    setBusyStudentId(managedStudent.id)
    try {
      const response = await setAdminStudentActive(token(), managedStudent.id, !managedStudent.is_active)
      setSelectedStudent((current) => (
        current?.id === managedStudent.id ? response.data : current
      ))
      setNotice(`Student account ${managedStudent.is_active ? 'disabled' : 'reactivated'}.`)
      await loadStudents()
    } catch (requestError) {
      handleRequestError(requestError)
    } finally {
      setBusyStudentId(null)
    }
  }

  if (!student) {
    return <Navigate to="/login" replace />
  }
  if (student.role !== 'admin') {
    return <Navigate to="/workspace" replace />
  }

  return (
    <>
      <AdminNavigation student={student} onLogout={onLogout} />
      <main className="container py-5">
        <h1 className="mb-4">Registered Students</h1>
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        {notice && <div className="alert alert-success" role="status">{notice}</div>}
        <div className="row g-4">
          <section className="col-lg-8" aria-labelledby="registered-students-heading">
            <h2 className="h4" id="registered-students-heading">All Student accounts</h2>
            {isLoading ? (
              <p className="text-body-secondary">Loading Student accounts…</p>
            ) : !hasLoaded ? null : students.length === 0 ? (
              <p className="text-body-secondary">No Student accounts are registered.</p>
            ) : (
              <div className="table-responsive">
                <table className="table align-middle">
                  <thead>
                    <tr>
                      <th scope="col">Username</th>
                      <th scope="col">Grades</th>
                      <th scope="col">Account status</th>
                      <th scope="col"><span className="visually-hidden">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((managedStudent) => (
                      <tr key={managedStudent.id}>
                        <td><strong>{managedStudent.username}</strong><br /><span className="text-body-secondary">ID {managedStudent.id}</span></td>
                        <td>{managedStudent.grade_count}</td>
                        <td>{managedStudent.is_active ? <span className="badge text-bg-success">Active</span> : <span className="badge text-bg-secondary">Disabled</span>}</td>
                        <td className="text-end text-nowrap">
                          <button className="btn btn-sm btn-outline-primary me-2" disabled={busyStudentId === managedStudent.id} onClick={() => showDetails(managedStudent.id)} type="button">Details</button>
                          <button className="btn btn-sm btn-outline-secondary" disabled={busyStudentId === managedStudent.id} onClick={() => changeActiveState(managedStudent)} type="button">
                            {busyStudentId === managedStudent.id ? 'Working…' : managedStudent.is_active ? 'Disable' : 'Reactivate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <RegisteredStudentDetails managedStudent={selectedStudent} />
        </div>
      </main>
    </>
  )
}

function RegisteredStudentDetails({ managedStudent }) {
  return (
    <section className="col-lg-4" aria-labelledby="student-details-heading">
      <div className="card">
        <div className="card-body">
          <h2 className="h4 card-title" id="student-details-heading">Student details</h2>
          {!managedStudent ? (
            <p className="text-body-secondary mb-0">Select Details to view account information.</p>
          ) : (
            <dl className="row mb-0">
              <dt className="col-sm-5">Username</dt><dd className="col-sm-7">{managedStudent.username}</dd>
              <dt className="col-sm-5">Account</dt><dd className="col-sm-7">{managedStudent.is_active ? 'Active' : 'Disabled'}</dd>
              <dt className="col-sm-5">Grades</dt><dd className="col-sm-7">{managedStudent.grade_count}</dd>
            </dl>
          )}
        </div>
      </div>
    </section>
  )
}

function KnnSettingsPage({ student, onLogout }) {
  const navigate = useNavigate()
  const [currentK, setCurrentK] = useState(null)
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  function token() {
    return localStorage.getItem(TOKEN_KEY)
  }

  function handleRequestError(requestError) {
    if (hasInvalidSession(requestError)) {
      onLogout()
      navigate('/login', {
        replace: true,
        state: { error: apiErrorMessage(requestError) },
      })
      return
    }
    setError(apiErrorMessage(requestError))
  }

  useEffect(() => {
    if (student?.role !== 'admin') {
      return
    }

    getKnnSetting(token())
      .then((response) => {
        setCurrentK(response.data.k)
        setValue(String(response.data.k))
      })
      .catch(handleRequestError)
  }, [student])

  async function saveSetting(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    setIsSaving(true)
    try {
      const parsedValue = Number(value)
      const response = await updateKnnSetting(
        token(),
        Number.isFinite(parsedValue) ? parsedValue : value,
      )
      setCurrentK(response.data.k)
      setValue(String(response.data.k))
      setNotice(`KNN setting saved: k = ${response.data.k}.`)
    } catch (requestError) {
      handleRequestError(requestError)
    } finally {
      setIsSaving(false)
    }
  }

  if (!student) {
    return <Navigate to="/login" replace />
  }
  if (student.role !== 'admin') {
    return <Navigate to="/workspace" replace />
  }

  return (
    <>
      <AdminNavigation student={student} onLogout={onLogout} />
      <main className="container py-5">
        <h1 className="mb-4">KNN settings</h1>
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        {notice && <div className="alert alert-success" role="status">{notice}</div>}
        <div className="card col-md-8 col-lg-6">
          <div className="card-body">
            {currentK == null ? (
              error ? null : <p className="text-body-secondary mb-0">Loading current setting…</p>
            ) : (
              <>
                <p className="mb-3">Current number of neighbors: <strong>{currentK}</strong></p>
                <form onSubmit={saveSetting}>
                  <div className="mb-3">
                    <label className="form-label" htmlFor="knn-k">Number of neighbors (k)</label>
                    <input
                      className="form-control"
                      id="knn-k"
                      inputMode="numeric"
                      onChange={(event) => setValue(event.target.value)}
                      required
                      value={value}
                    />
                    <div className="form-text">The server validates that k is a positive integer.</div>
                  </div>
                  <button className="btn btn-primary" disabled={isSaving} type="submit">
                    {isSaving ? 'Saving…' : 'Save setting'}
                  </button>
                </form>
              </>
            )}
          </div>
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
        setStudent(response.data)
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
    localStorage.setItem(TOKEN_KEY, token)
    setStudent(response.data)
    return response.data
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
      <Route path="/admin" element={<AdminSummaryPage student={student} onLogout={logout} />} />
      <Route path="/admin/courses" element={<AdminCoursesPage student={student} onLogout={logout} />} />
      <Route path="/admin/historical-students" element={<AdminHistoricalStudentsPage student={student} onLogout={logout} />} />
      <Route path="/admin/students" element={<AdminStudentsPage student={student} onLogout={logout} />} />
      <Route path="/admin/settings" element={<KnnSettingsPage student={student} onLogout={logout} />} />
      <Route path="*" element={<Navigate to={student ? homePath(student) : '/login'} replace />} />
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
