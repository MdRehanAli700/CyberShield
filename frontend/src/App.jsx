import React from 'react'
import { Activity, AlertTriangle, ArrowUpRight, Clock3, Download, FileCheck2, FileImage, HelpCircle, LayoutDashboard, Link2, LogOut, Moon, Pencil, Plus, Settings2, ShieldCheck, Sun, Trash2, Upload, UserRound, UsersRound, X } from 'lucide-react'
import PasswordInput from './components/PasswordInput.jsx'
import { apiUrl, timeoutSignal } from './lib/api.js'

function App() {
  const [theme, setTheme] = React.useState(() => window.localStorage.getItem('verifypay-theme') === 'light' ? 'light' : 'dark')
  const [activeItem, setActiveItem] = React.useState('Overview')
  const [inputMode, setInputMode] = React.useState('upload')
  const [pastedText, setPastedText] = React.useState('')
  const [paymentUrl, setPaymentUrl] = React.useState('')
  const [urlError, setUrlError] = React.useState('')
  const [selectedFile, setSelectedFile] = React.useState(null)
  const [filePreviewUrl, setFilePreviewUrl] = React.useState('')
  const [fileError, setFileError] = React.useState('')
  const [fileDragActive, setFileDragActive] = React.useState(false)
  const [inputReady, setInputReady] = React.useState(false)
  const [scanStep, setScanStep] = React.useState(-1)
  const [scanAttempt, setScanAttempt] = React.useState(0)
  const [scanPending, setScanPending] = React.useState(false)
  const [minimumScanTimeDone, setMinimumScanTimeDone] = React.useState(false)
  const [scanResult, setScanResult] = React.useState(null)
  const [copySummaryMessage, setCopySummaryMessage] = React.useState('')
  const [copySummaryMessageIsError, setCopySummaryMessageIsError] = React.useState(false)
  const [apiError, setApiError] = React.useState('')
  const [recentChecks, setRecentChecks] = React.useState([])
  const [historyChecks, setHistoryChecks] = React.useState([])
  const [historyRiskFilter, setHistoryRiskFilter] = React.useState('all')
  const [historySourceFilter, setHistorySourceFilter] = React.useState('all')
  const [historySearch, setHistorySearch] = React.useState('')
  const [debouncedHistorySearch, setDebouncedHistorySearch] = React.useState('')
  const historySearchPending = historySearch.trim() !== debouncedHistorySearch
  const [hasMoreChecks, setHasMoreChecks] = React.useState(false)
  const [historyLoading, setHistoryLoading] = React.useState(false)
  const [historyRefreshing, setHistoryRefreshing] = React.useState(false)
  const [historyError, setHistoryError] = React.useState('')
  const [activityRefreshKey, setActivityRefreshKey] = React.useState(0)
  const [deletingCheckId, setDeletingCheckId] = React.useState(null)
  const [confirmDeleteCheckId, setConfirmDeleteCheckId] = React.useState(null)
  const [historyExporting, setHistoryExporting] = React.useState(false)
  const [trustedPayees, setTrustedPayees] = React.useState([])
  const [payeeSearch, setPayeeSearch] = React.useState('')
  const [activityStats, setActivityStats] = React.useState({ checks: 0, trusted_payees: 0 })
  const [payeeName, setPayeeName] = React.useState('')
  const [payeeIdentifier, setPayeeIdentifier] = React.useState('')
  const [payeeMessage, setPayeeMessage] = React.useState('')
  const [payeeMessageIsError, setPayeeMessageIsError] = React.useState(false)
  const [payeeSaving, setPayeeSaving] = React.useState(false)
  const [editingPayeeId, setEditingPayeeId] = React.useState(null)
  const [deletingPayeeId, setDeletingPayeeId] = React.useState(null)
  const [confirmDeletePayeeId, setConfirmDeletePayeeId] = React.useState(null)
  const payeeNameInputRef = React.useRef(null)
  const [authToken, setAuthToken] = React.useState(() => window.sessionStorage.getItem('verifypay-token') || '')
  const [currentUser, setCurrentUser] = React.useState(null)
  const [signOutConfirming, setSignOutConfirming] = React.useState(false)
  const [authReady, setAuthReady] = React.useState(false)
  const [authMode, setAuthMode] = React.useState('login')
  const [authEmail, setAuthEmail] = React.useState('')
  const [authPassword, setAuthPassword] = React.useState('')
  const [authConfirmPassword, setAuthConfirmPassword] = React.useState('')
  const [authError, setAuthError] = React.useState('')
  const [authBusy, setAuthBusy] = React.useState(false)
  const authRequestInFlightRef = React.useRef(false)
  const scanRequestInFlightRef = React.useRef(false)
  const [apiStatus, setApiStatus] = React.useState('checking')
  const [currentPassword, setCurrentPassword] = React.useState('')
  const [newPassword, setNewPassword] = React.useState('')
  const [confirmNewPassword, setConfirmNewPassword] = React.useState('')
  const [passwordMessage, setPasswordMessage] = React.useState('')
  const [passwordMessageIsError, setPasswordMessageIsError] = React.useState(false)
  const [passwordBusy, setPasswordBusy] = React.useState(false)
  const [passwordStep, setPasswordStep] = React.useState('current')
  const passwordConfirmationValid = newPassword.length >= 10 && newPassword === confirmNewPassword
  const normalizedPayeeSearch = payeeSearch.trim().toLocaleLowerCase()
  const filteredPayees = normalizedPayeeSearch ? trustedPayees.filter(payee => `${payee.name} ${payee.payment_identifier}`.toLocaleLowerCase().includes(normalizedPayeeSearch)) : trustedPayees
  const scanFailed = Boolean(apiError) && !scanResult
  const scanProgressPercent = scanFailed ? 43 : [12, 43, 76, 100][Math.max(scanStep, 0)]
  const failedScanStepIndex = 1
  const scanFailureTitle = /no readable text/i.test(apiError) ? 'Image text was not readable' : /tesseract|ocr/i.test(apiError) ? 'Image reader unavailable' : 'Check could not finish'
  const scanFailureDescription = /no readable text/i.test(apiError) ? 'Try a sharper, well-lit image, or choose Paste details and enter the message yourself.' : /tesseract|ocr/i.test(apiError) ? 'The image reader could not start. Check that Tesseract is installed, then restart the backend.' : /postgresql|database/i.test(apiError) ? 'The database is unavailable. Start PostgreSQL, then choose Try again.' : /timed out|time limit/i.test(apiError) ? 'The server took too long to finish. Choose Try again; if you sent an image, try a smaller crop.' : /backend|failed to fetch|networkerror/i.test(apiError) ? 'VerifyPay cannot reach its backend. Start the backend server in VS Code, then choose Try again.' : 'No result is available yet. Review the message below and try again.'
  const scanActivityDescription = inputMode === 'upload' ? 'Reading the image text and checking for warning signs.' : inputMode === 'paste' ? 'Reviewing the pasted payment details for warning signs.' : 'Inspecting the payment link as text only; VerifyPay will not open it.'
  const paymentInputReady = (inputMode === 'upload' && Boolean(selectedFile)) || (inputMode === 'paste' && Boolean(pastedText.trim())) || (inputMode === 'url' && Boolean(paymentUrl.trim()))
  const paymentInputHint = paymentInputReady ? 'Next: VerifyPay will show each stage while it checks your submission.' : inputMode === 'upload' ? 'Choose a PNG, JPG, or WEBP image above to continue.' : inputMode === 'paste' ? 'Paste the payment message or instructions above to continue.' : 'Enter a payment website link above to continue.'
  const now = new Date()
  const welcomeGreeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening'
  const todayLabel = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()
  const pastedLinkCount = (pastedText.match(/\b(?:https?:\/\/|www\.)[^\s<>()\[\]{}"']+/gi) || []).length
  const paymentUrlHost = (() => {
    const value = paymentUrl.trim()
    if (!value) return ''
    try {
      const parsed = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
      return ['http:', 'https:'].includes(parsed.protocol) && parsed.hostname && !parsed.username && !parsed.password ? parsed.hostname : ''
    } catch { return '' }
  })()

  function clearAccountData() {
    setCurrentUser(null)
    setRecentChecks([])
    setHistoryChecks([])
    setTrustedPayees([])
    setActivityStats({ checks: 0, trusted_payees: 0 })
    setScanResult(null)
    setInputReady(false)
    setScanStep(-1)
    setPastedText('')
    setPaymentUrl('')
    setSelectedFile(null)
    setPayeeName('')
    setPayeeIdentifier('')
    setPayeeSearch('')
    setPayeeMessage('')
    setPayeeMessageIsError(false)
    setEditingPayeeId(null)
    setDeletingPayeeId(null)
    setConfirmDeletePayeeId(null)
    setConfirmDeleteCheckId(null)
    setDeletingCheckId(null)
    setCopySummaryMessage('')
    setCopySummaryMessageIsError(false)
    setAuthPassword('')
    setAuthConfirmPassword('')
    setApiError('')
    setHistoryError('')
    setCurrentPassword('')
    setNewPassword('')
    setConfirmNewPassword('')
    setPasswordMessage('')
    setPasswordStep('current')
  }

  const apiFetch = async (url, options = {}) => {
    const response = await fetch(apiUrl(url), {
      ...options,
      signal: options.signal ?? timeoutSignal(30000),
      headers: { ...(options.headers || {}), ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
    })
    if (response.status === 401) {
      window.sessionStorage.removeItem('verifypay-token')
      setAuthToken('')
      setAuthMode('login')
      clearAccountData()
      setAuthError('Your session expired. Please sign in again.')
    }
    return response
  }

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedHistorySearch(historySearch.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [historySearch])

  React.useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('verifypay-theme', theme)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#07111f' : '#f2f7fb')
  }, [theme])

  React.useEffect(() => {
    if (!selectedFile) {
      setFilePreviewUrl('')
      return
    }
    const previewUrl = URL.createObjectURL(selectedFile)
    setFilePreviewUrl(previewUrl)
    return () => URL.revokeObjectURL(previewUrl)
  }, [selectedFile])

  React.useEffect(() => {
    let active = true
    const checkApi = async () => {
      try {
        const response = await fetch(apiUrl('/health'), { cache: 'no-store', signal: timeoutSignal(5000) })
        if (active) setApiStatus(response.ok ? 'connected' : response.status === 503 ? 'database-offline' : 'offline')
      } catch {
        if (active) setApiStatus('offline')
      }
    }
    checkApi()
    const interval = window.setInterval(checkApi, 30000)
    return () => { active = false; window.clearInterval(interval) }
  }, [])

  React.useEffect(() => {
    if (!inputReady) {
      setScanStep(-1)
      setMinimumScanTimeDone(false)
      return
    }
    setMinimumScanTimeDone(false)
    const timer = window.setTimeout(() => setMinimumScanTimeDone(true), 2550)
    return () => window.clearTimeout(timer)
  }, [inputReady, scanAttempt])

  React.useEffect(() => {
    if (inputReady && minimumScanTimeDone && !scanPending) setScanStep(3)
  }, [inputReady, minimumScanTimeDone, scanPending])

  React.useEffect(() => {
    let active = true
    if (!authToken) {
      setRecentChecks([])
      setHistoryChecks([])
      setHasMoreChecks(false)
      setTrustedPayees([])
      setActivityStats({ checks: 0, trusted_payees: 0 })
      setCurrentUser(null)
      setAuthReady(true)
      setHistoryRefreshing(false)
      return () => { active = false }
    }
    setHistoryRefreshing(true)
    setHistoryError('')
    const checkParams = new URLSearchParams({ limit: '10', offset: '0' })
    if (historyRiskFilter !== 'all') checkParams.set('risk_level', historyRiskFilter)
    if (historySourceFilter !== 'all') checkParams.set('source_type', historySourceFilter)
    if (debouncedHistorySearch) checkParams.set('search', debouncedHistorySearch)
    Promise.all([apiFetch(`/api/checks?${checkParams}`), apiFetch('/api/payees'), apiFetch('/api/stats'), apiFetch('/api/auth/me')])
      .then(async ([checksResponse, payeesResponse, statsResponse, userResponse]) => {
        if (!active) return
        if ([checksResponse, payeesResponse, statsResponse, userResponse].some(response => response.status === 401)) {
          window.sessionStorage.removeItem('verifypay-token')
          setAuthToken('')
          setAuthMode('login')
          clearAccountData()
          setAuthError('Your session expired. Please sign in again.')
          return
        }
        const failedResponse = [checksResponse, payeesResponse, statsResponse, userResponse].find(response => !response.ok)
        if (failedResponse) throw new Error(`Could not load account data (HTTP ${failedResponse.status}).`)
        const [checks, payees, stats, user] = await Promise.all([checksResponse.json(), payeesResponse.json(), statsResponse.json(), userResponse.json()])
        if (historyRiskFilter === 'all' && historySourceFilter === 'all' && !debouncedHistorySearch) setRecentChecks(checks)
        setHistoryChecks(checks)
        setHasMoreChecks(checks.length === 10)
        setTrustedPayees(payees)
        setActivityStats(stats)
        setCurrentUser(user)
      })
      .catch(() => {
        if (active) setHistoryError('Could not refresh your saved activity. Check that the backend and PostgreSQL are running, then try again.')
      })
      .finally(() => {
        if (active) {
          setAuthReady(true)
          setHistoryRefreshing(false)
        }
      })
    return () => { active = false }
  }, [authToken, historyRiskFilter, historySourceFilter, debouncedHistorySearch, activityRefreshKey])

  const navigation = [
    { label: 'Overview', icon: LayoutDashboard },
    { label: 'Verify a payment', icon: ShieldCheck },
    { label: 'Payment history', icon: Clock3 },
    { label: 'Trusted payees', icon: UsersRound },
    { label: 'Help center', icon: HelpCircle },
  ]

  const openVerifier = () => setActiveItem('Verify a payment')
  const changeInputMode = mode => {
    setInputMode(mode)
    setFileError('')
    setUrlError('')
    setApiError('')
  }
  const loadMoreChecks = async () => {
    setHistoryLoading(true)
    setHistoryError('')
    try {
      const params = new URLSearchParams({ limit: '10', offset: String(historyChecks.length) })
      if (historyRiskFilter !== 'all') params.set('risk_level', historyRiskFilter)
      if (historySourceFilter !== 'all') params.set('source_type', historySourceFilter)
      if (debouncedHistorySearch) params.set('search', debouncedHistorySearch)
      const response = await apiFetch(`/api/checks?${params}`)
      if (!response.ok) throw new Error('Could not load more payment history.')
      const nextChecks = await response.json()
      setHistoryChecks(current => {
        const knownIds = new Set(current.map(check => check.id))
        return [...current, ...nextChecks.filter(check => !knownIds.has(check.id))]
      })
      setHasMoreChecks(nextChecks.length === 10)
    } catch (error) {
      setHistoryError(error.message || 'Could not load more payment history.')
    } finally {
      setHistoryLoading(false)
    }
  }
  const exportHistory = async () => {
    setHistoryError('')
    setHistoryExporting(true)
    try {
      const params = new URLSearchParams()
      if (historyRiskFilter !== 'all') params.set('risk_level', historyRiskFilter)
      if (historySourceFilter !== 'all') params.set('source_type', historySourceFilter)
      if (debouncedHistorySearch) params.set('search', debouncedHistorySearch)
      const query = params.toString()
      const response = await apiFetch(`/api/checks/export.csv${query ? `?${query}` : ''}`)
      if (!response.ok) throw new Error('Could not download your history.')
      const fileUrl = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = fileUrl
      const today = new Date()
      const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      link.download = `verifypay-history-${date}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(fileUrl), 1000)
    } catch (error) {
      setHistoryError(error.message || 'Could not download your history.')
    } finally {
      setHistoryExporting(false)
    }
  }
  const deleteCheck = async check => {
    setHistoryError('')
    setDeletingCheckId(check.id)
    try {
      const response = await apiFetch(`/api/checks/${check.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Could not delete this saved check.')
      setHistoryChecks(current => current.filter(item => item.id !== check.id))
      setRecentChecks(current => current.filter(item => item.id !== check.id))
      setActivityStats(current => ({ ...current, checks: Math.max(0, current.checks - 1) }))
    } catch (error) {
      setHistoryError(error.message || 'Could not delete this saved check.')
    } finally {
      setDeletingCheckId(null)
      setConfirmDeleteCheckId(null)
    }
  }
  const submitAuth = async event => {
    event.preventDefault()
    if (authRequestInFlightRef.current) return
    if (authMode === 'register' && authPassword !== authConfirmPassword) {
      setAuthError('The passwords do not match. Check both fields and try again.')
      return
    }
    const normalizedEmail = authEmail.trim().toLowerCase()
    if (!normalizedEmail) {
      setAuthError('Enter your email address to continue.')
      return
    }
    authRequestInFlightRef.current = true
    setAuthError('')
    setAuthBusy(true)
    setAuthEmail(normalizedEmail)
    try {
      const response = await fetch(apiUrl(`/api/auth/${authMode === 'register' ? 'register' : 'login'}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password: authPassword }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        const detail = Array.isArray(result.detail)
          ? result.detail.map(item => item.msg).filter(Boolean).join(' ')
          : result.detail
        throw new Error(typeof detail === 'string' && detail ? detail : 'We could not complete sign-in. Check your details and try again.')
      }
      window.sessionStorage.setItem('verifypay-token', result.access_token)
      setCurrentUser(result.user)
      setAuthToken(result.access_token)
      setAuthPassword('')
      setAuthConfirmPassword('')
    } catch (error) {
      const networkFailure = error instanceof TypeError || /failed to fetch|networkerror/i.test(error.message || '')
      setAuthError(networkFailure ? 'Could not reach VerifyPay. Make sure the backend and PostgreSQL are running, then try again.' : error.message || 'We could not complete sign-in. Please try again.')
    } finally {
      authRequestInFlightRef.current = false
      setAuthBusy(false)
    }
  }
  const signOut = async () => {
    try { await apiFetch('/api/auth/session', { method: 'DELETE' }) } catch {}
    window.sessionStorage.removeItem('verifypay-token')
    setSignOutConfirming(false)
    setAuthToken('')
    setAuthMode('login')
    clearAccountData()
    setAuthError('')
  }
  const updatePassword = async event => {
    event.preventDefault()
    setPasswordMessage('')
    setPasswordMessageIsError(false)
    if (newPassword !== confirmNewPassword) {
      setPasswordMessage('The new password and confirmation do not match.')
      setPasswordMessageIsError(true)
      return
    }
    if (newPassword === currentPassword) {
      setPasswordMessage('Choose a new password that differs from your current password.')
      setPasswordMessageIsError(true)
      return
    }
    setPasswordBusy(true)
    try {
      const response = await apiFetch('/api/auth/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.detail || 'Could not change your password.')
      window.sessionStorage.setItem('verifypay-token', result.access_token)
      setAuthToken(result.access_token)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
      setPasswordMessage('Password changed. You are still signed in on this device; other sessions were signed out.')
      setPasswordStep('success')
    } catch (error) {
      setPasswordMessage(error.message || 'Could not change your password.')
      setPasswordMessageIsError(true)
    } finally {
      setPasswordBusy(false)
    }
  }
  const verifyCurrentPassword = async event => {
    event.preventDefault()
    setPasswordMessage('')
    setPasswordMessageIsError(false)
    setPasswordBusy(true)
    try {
      const response = await apiFetch('/api/auth/password/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: currentPassword }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.detail || 'Could not verify your current password.')
      setPasswordStep('new')
    } catch (error) {
      setPasswordMessage(error.message || 'Could not verify your current password. Try again.')
      setPasswordMessageIsError(true)
    } finally {
      setPasswordBusy(false)
    }
  }
  const chooseFile = file => {
    setFileError('')
    setFileDragActive(false)
    if (!file) {
      setSelectedFile(null)
      return
    }
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp']
    const allowedExtension = /\.(png|jpe?g|webp)$/i.test(file.name)
    if (!allowedTypes.includes(file.type) && !allowedExtension) {
      setSelectedFile(null)
      setFileError('Choose a PNG, JPG, or WEBP image.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setSelectedFile(null)
      setFileError('This image is larger than 10 MB. Choose a smaller file.')
      return
    }
    setSelectedFile(file)
  }
  const clearFile = () => { setSelectedFile(null); setFileError(''); setFileDragActive(false) }
  const startScanPreview = async () => {
    if (scanRequestInFlightRef.current) return
    setApiError('')
    setCopySummaryMessage('')
    setCopySummaryMessageIsError(false)
    let normalizedPaymentUrl = ''
    if (inputMode === 'url') {
      const submittedUrl = paymentUrl.trim()
      if (submittedUrl.length > 2048) {
        setUrlError('This link is too long. Use a link under 2,048 characters.')
        return
      }
      try {
        const candidate = /^https?:\/\//i.test(submittedUrl) ? submittedUrl : `https://${submittedUrl}`
        const parsedUrl = new URL(candidate)
        if (!['http:', 'https:'].includes(parsedUrl.protocol) || !parsedUrl.hostname || parsedUrl.username || parsedUrl.password) throw new Error('Invalid payment link')
        normalizedPaymentUrl = parsedUrl.href
      } catch {
        setUrlError('Enter a website link, such as example.com or https://example.com/pay.')
        return
      }
    }
    setUrlError('')
    setScanResult(null)
    scanRequestInFlightRef.current = true
    setMinimumScanTimeDone(false)
    setScanPending(true)
    setScanAttempt(current => current + 1)
    setInputReady(true)
    try {
      let response
      setScanStep(1)
      if (inputMode === 'upload') {
        const formData = new FormData()
        formData.append('file', selectedFile)
        response = await apiFetch('/api/checks/image', { method: 'POST', body: formData })
      } else {
        response = await apiFetch('/api/checks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source_type: inputMode === 'paste' ? 'text' : 'url', content: inputMode === 'paste' ? pastedText : normalizedPaymentUrl }),
        })
      }
      if (!response.ok) {
        const problem = await response.json().catch(() => ({}))
        throw new Error(problem.detail || `API returned ${response.status}`)
      }
      const result = await response.json()
      setScanStep(2)
      setScanResult(result)
      setRecentChecks(current => [result, ...current.filter(check => check.id !== result.id)].slice(0, 10))
      if ((historyRiskFilter === 'all' || historyRiskFilter === result.risk_level) && (historySourceFilter === 'all' || historySourceFilter === result.source_type) && (!debouncedHistorySearch || `${result.input_label} ${result.explanation}`.toLocaleLowerCase().includes(debouncedHistorySearch.toLocaleLowerCase()))) {
        setHistoryChecks(current => [result, ...current.filter(check => check.id !== result.id)])
      }
      setActivityStats(current => ({ ...current, checks: current.checks + 1 }))
    } catch (error) {
      const message = error.message || ''
      if (error?.name === 'TimeoutError' || /timed out|time limit/i.test(message)) {
        setApiError('The request timed out after 30 seconds. Choose Try again; for an image, try a smaller crop.')
      } else if (error instanceof TypeError || /failed to fetch|networkerror/i.test(message)) {
        setApiError('VerifyPay cannot reach the backend. In VS Code, make sure the backend server is running, then choose Try again.')
      } else if (/database is unavailable|postgresql database/i.test(message)) {
        setApiError('The backend is running, but PostgreSQL is unavailable. Start the PostgreSQL service in Windows, then choose Try again.')
      } else if (/tesseract|ocr/i.test(message) && inputMode === 'upload') {
        setApiError(`Image text could not be read: ${message}`)
      } else {
        setApiError(message || 'The check could not finish. Choose Try again, or return to the input and review it.')
      }
    } finally {
      scanRequestInFlightRef.current = false
      setScanPending(false)
    }
  }
  const startAnotherCheck = () => {
    setInputReady(false)
    setScanStep(-1)
    setScanResult(null)
    setApiError('')
    setSelectedFile(null)
    setFileError('')
    setPastedText('')
    setPaymentUrl('')
    setUrlError('')
    setInputMode('upload')
    setCopySummaryMessage('')
    setCopySummaryMessageIsError(false)
  }
  const copyScanSummary = async () => {
    if (!scanResult) return
    const summary = [
      'CyberShield VerifyPay · Preliminary payment check',
      `Signal: ${scanResult.risk_level} · ${scanResult.risk_score}/100 (rules-based signal, not a probability)`,
      `Input type: ${scanResult.source_type}`,
      ...(scanResult.detected_amount ? [`Amount detected: ${scanResult.detected_amount}`] : []),
      ...(scanResult.recipient_guess ? [`Recipient guess: ${scanResult.recipient_guess}`] : []),
      ...(scanResult.link_domains?.length ? [`Link domains: ${scanResult.link_domains.join(', ')}`] : scanResult.link_domain ? [`Link domain: ${scanResult.link_domain}`] : []),
      ...(scanResult.trusted_payee_match ? [`Trusted-payee text match: ${scanResult.trusted_payee_match} (not verified)`] : []),
      `Signals: ${scanResult.findings?.length ? scanResult.findings.join('; ') : 'No warning patterns identified by these basic rules.'}`,
      `Suggested next step: ${scanResult.recommended_action || 'Confirm payment details independently before sending money.'}`,
      'This check cannot confirm whether a payment is safe or fraudulent.',
    ].join('\n')
    try {
      await navigator.clipboard.writeText(summary)
      setCopySummaryMessage('Summary copied. OCR text was not included.')
      setCopySummaryMessageIsError(false)
    } catch {
      setCopySummaryMessage('Could not copy automatically. You can still review the result on this page.')
      setCopySummaryMessageIsError(true)
    }
  }
  const savePayee = async event => {
    event.preventDefault()
    setPayeeMessage('')
    setPayeeMessageIsError(false)
    const name = payeeName.trim()
    const identifier = payeeIdentifier.trim()
    if (!name || !identifier) {
      setPayeeMessage('Enter both a payee name and payment identifier. Spaces alone do not count.')
      setPayeeMessageIsError(true)
      return
    }
    setPayeeSaving(true)
    try {
      const isEditing = editingPayeeId !== null
      const response = await apiFetch(isEditing ? `/api/payees/${editingPayeeId}` : '/api/payees', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, payment_identifier: identifier }),
      })
      if (!response.ok) {
        const problem = await response.json().catch(() => ({}))
        throw new Error(problem.detail || `Could not ${isEditing ? 'update' : 'save'} this payee.`)
      }
      const payee = await response.json()
      if (isEditing) {
        setTrustedPayees(current => current.map(item => item.id === payee.id ? payee : item).sort((left, right) => left.name.localeCompare(right.name)))
      } else {
        setTrustedPayees(current => [...current, payee].sort((left, right) => left.name.localeCompare(right.name)))
        setActivityStats(current => ({ ...current, trusted_payees: current.trusted_payees + 1 }))
      }
      setEditingPayeeId(null)
      setPayeeName('')
      setPayeeIdentifier('')
      setPayeeMessage(isEditing ? 'Trusted payee updated.' : 'Trusted payee saved to your account.')
    } catch (error) {
      setPayeeMessage(error.message || 'Could not reach the API. Check that the backend and PostgreSQL are running.')
      setPayeeMessageIsError(true)
    } finally {
      setPayeeSaving(false)
    }
  }
  const removePayee = async payee => {
    setPayeeMessage('')
    setPayeeMessageIsError(false)
    setDeletingPayeeId(payee.id)
    try {
      const response = await apiFetch(`/api/payees/${payee.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error(`API returned ${response.status}`)
      setTrustedPayees(current => current.filter(item => item.id !== payee.id))
      setActivityStats(current => ({ ...current, trusted_payees: Math.max(0, current.trusted_payees - 1) }))
      if (editingPayeeId === payee.id) {
        setEditingPayeeId(null)
        setPayeeName('')
        setPayeeIdentifier('')
      }
      setPayeeMessage(`${payee.name} removed from your trusted list.`)
    } catch (error) {
      setPayeeMessage(error.message || 'Could not remove this payee. Check that the backend and PostgreSQL are running.')
      setPayeeMessageIsError(true)
    } finally {
      setDeletingPayeeId(null)
      setConfirmDeletePayeeId(null)
    }
  }

  if (!authReady) return <div className="auth-loading">Opening your secure workspace…</div>
  if (!authToken) return <main className="auth-screen"><form className="auth-card" onSubmit={submitAuth}><span className="auth-logo"><ShieldCheck size={26}/></span><p className="eyebrow">CYBERSHIELD · VERIFYPAY</p><h1>{authMode === 'login' ? 'Welcome back' : 'Create your account'}</h1><p className="auth-intro">{authMode === 'login' ? 'Sign in to see your saved payment checks and trusted payees.' : 'Create an account to keep your checks and trusted payees separate.'}</p>{apiStatus !== 'connected' && apiStatus !== 'checking' && !authError && <p className="auth-error" role="status">{apiStatus === 'database-offline' ? 'PostgreSQL is not responding. Start the PostgreSQL service in Windows, then refresh this page.' : 'VerifyPay cannot reach the backend. In VS Code, start the backend server, then refresh this page.'}</p>}<label className="field-label" htmlFor="account-email">Email</label><input id="account-email" className="payee-input" type="email" autoComplete="email" required maxLength={254} value={authEmail} onChange={event => { setAuthEmail(event.target.value); setAuthError('') }} placeholder="you@example.com" disabled={authBusy}/><label className="field-label" htmlFor="account-password">Password</label><PasswordInput id="account-password" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} required minLength={10} maxLength={128} value={authPassword} onChange={event => { setAuthPassword(event.target.value); setAuthError('') }} placeholder={authMode === 'register' ? 'At least 10 characters' : 'Your password'} disabled={authBusy}/>{authMode === 'register' && <><small className="auth-hint">Use at least 10 characters. Never reuse a password from another account.</small><label className="field-label" htmlFor="account-confirm-password">Confirm password</label><PasswordInput id="account-confirm-password" autoComplete="new-password" required minLength={10} maxLength={128} value={authConfirmPassword} onChange={event => { setAuthConfirmPassword(event.target.value); setAuthError('') }} placeholder="Type your password again" disabled={authBusy}/></>}{authError && <p className="auth-error" role="alert">{authError}</p>}<button className="primary-button auth-submit" type="submit" disabled={authBusy}>{authBusy ? 'Please wait…' : authMode === 'login' ? 'Sign in' : 'Create account'} <ArrowUpRight size={16}/></button><p className="auth-switch">{authMode === 'login' ? 'New to VerifyPay?' : 'Already have an account?'} <button type="button" disabled={authBusy} onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError(''); setAuthPassword(''); setAuthConfirmPassword('') }}>{authMode === 'login' ? 'Create account' : 'Sign in'}</button></p><p className="auth-local-note">Prototype note: Email verification and password reset are not available yet.</p></form></main>

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <a className="brand" href="#overview" aria-label="VerifyPay overview">
          <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none"><path d="M24 4.5 39 10v11.5c0 10.1-6.1 17-15 22-8.9-5-15-11.9-15-22V10L24 4.5Z"/><path d="m16.5 23.5 5 5 10-10"/></svg></span>
          <span className="brand-copy"><strong>CyberShield</strong><small>VERIFYPAY</small></span>
        </a>

        <div className="workspace-switcher" aria-label="Local workspace"><span className="workspace-avatar">{(currentUser?.email || 'U').slice(0, 1).toUpperCase()}</span><span className="workspace-copy"><strong>Local workspace</strong><small>Personal account</small></span></div>

        <p className="nav-caption">WORKSPACE</p>
        <nav className="primary-nav" aria-label="Main navigation">
          {navigation.map(({ label, icon: Icon }) => <button key={label} type="button" className={`nav-item ${activeItem === label ? 'is-active' : ''}`} onClick={() => setActiveItem(label)}><Icon size={18}/><span>{label}</span>{label === 'Payment history' && <span className="nav-count">{activityStats.checks}</span>}</button>)}
        </nav>

        <div className="sidebar-spacer" />
        <div className="sidebar-trust"><div className="trust-icon"><ShieldCheck size={17}/></div><strong>Your safety, at a glance</strong><p>Each account has its own payment checks and trusted payees.</p><button className="sidebar-security-link" type="button" onClick={() => setActiveItem('Help center')}>Security details <ArrowUpRight size={13}/></button></div>
        <nav className="secondary-nav" aria-label="Account and help"><button className={`nav-item ${activeItem === 'Profile' ? 'is-active' : ''}`} type="button" onClick={() => setActiveItem('Profile')}><UserRound size={18}/><span>Profile</span></button><button className={`nav-item ${activeItem === 'Settings' || activeItem === 'Change password' ? 'is-active' : ''}`} type="button" onClick={() => setActiveItem('Settings')}><Settings2 size={18}/><span>Settings</span></button><button className={`nav-item ${activeItem === 'Help center' ? 'is-active' : ''}`} type="button" onClick={() => setActiveItem('Help center')}><HelpCircle size={18}/><span>Help center</span></button></nav>
        <button className="profile-button" type="button" onClick={() => setActiveItem('Profile')} title="Open profile"><span className="profile-avatar">{(currentUser?.email || authEmail || 'U').slice(0, 1).toUpperCase()}</span><span className="profile-copy"><strong>{currentUser?.email || authEmail || 'Account'}</strong><small>View profile</small></span><ArrowUpRight size={15}/></button>
        <button className="sidebar-signout" type="button" onClick={() => { setActiveItem('Profile'); setSignOutConfirming(true) }}><LogOut size={15}/><span>Sign out</span></button>
      </aside>

      <main className="main-panel" id="overview">
        <header className="topbar"><div className="breadcrumb"><span>Workspace</span><span className="breadcrumb-slash">/</span><strong>{activeItem}</strong></div><div className="topbar-actions">{(apiStatus === 'offline' || apiStatus === 'database-offline') ? <button className="api-status api-status-offline api-status-button" type="button" onClick={() => setActiveItem('Help center')} aria-label={apiStatus === 'database-offline' ? 'PostgreSQL unavailable. Open help center' : 'Backend offline. Open help center'}><span className="api-status-dot"/>{apiStatus === 'database-offline' ? 'Database offline · Help' : 'Backend offline · Help'}</button> : <span className={`api-status api-status-${apiStatus}`} role="status" aria-live="polite"><span className="api-status-dot"/>{apiStatus === 'checking' ? 'Checking API and database…' : 'API and database online'}</span>}<button className="theme-button" type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>{theme === 'dark' ? <Sun size={17}/> : <Moon size={17}/>}<span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span></button></div></header>

        <div className="content-wrap">
          {activeItem === 'Help center' ? <>{apiStatus === 'database-offline' && <p className="auth-error service-status-help" role="alert">PostgreSQL is not responding. Start its Windows service, then refresh VerifyPay.</p>}{apiStatus === 'offline' && <p className="auth-error service-status-help" role="alert">The backend is not responding. Start the backend server in VS Code, then refresh VerifyPay.</p>}
            <section className="verify-heading"><p className="eyebrow">QUICK GUIDE</p><h1>Help center</h1><p>How to run VerifyPay, check a payment, and understand the result.</p></section>
            <section className="help-grid"><article className="help-card"><span className="help-card-icon"><ShieldCheck size={19}/></span><h2>Check a payment</h2><ol><li>Choose <strong>Upload image</strong>, <strong>Paste details</strong>, or <strong>Payment link</strong>.</li><li>Submit the screenshot, message, or link you want to review.</li><li>Read the warning signals and suggested next step. Always verify the recipient independently.</li></ol><button className="text-button" type="button" onClick={openVerifier}>Open payment check <ArrowUpRight size={14}/></button></article><article className="help-card"><span className="help-card-icon"><FileCheck2 size={19}/></span><h2>Understand the result</h2><p>The 0–100 score is a rules-based signal, not the chance that a payment is a scam. Its levels are low (0–34), medium (35–69), and high (70–100). Simple text patterns, including limited URL-wording checks, determine it; VerifyPay does not look up live domain reputation.</p><p>It can miss scams or flag ordinary messages, so treat every result as a prompt to check independently, not a fraud verdict. A trusted-payee match only means a name or identifier appeared in the message; it does not prove account ownership.</p><p>Payment links found in a URL, pasted details, or image text are inspected as text only. VerifyPay does not open them.</p></article><details className="help-card help-setup-guide"><summary><span className="help-setup-icon"><Settings2 size={18}/></span><span className="help-setup-copy"><strong>Developer setup</strong><small>Windows startup steps and local commands</small></span><span className="help-setup-toggle" aria-hidden="true"/></summary><div className="help-setup-content"><ol><li>Start the PostgreSQL service: open the Windows Start menu, search for <strong>Services</strong>, then open the Services app. Find a service named like <code>postgresql-x64-XX</code> (the number can vary). If its status is not Running, right-click it and choose <strong>Start</strong>. Keep it running. pgAdmin manages databases, but it does not start PostgreSQL by itself.</li><li>In VS Code, open a terminal in the <code>backend</code> folder and run this command. Keep this terminal open while using VerifyPay:<code className="help-command">.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload</code></li><li>Open another VS Code terminal in the <code>frontend</code> folder and run:<code className="help-command">npm run dev</code></li><li>Open the local address printed by Vite. If port 5173 is busy, use the alternate address Vite prints.</li><li>To confirm the API is running, open <a href={apiUrl('/health')} target="_blank" rel="noreferrer">{apiUrl('/health')}</a>. You should see <code>"status": "ok"</code>.</li></ol></div></details><article className="help-card"><span className="help-card-icon"><UsersRound size={19}/></span><h2>Accounts and saved data</h2><p>Your checks and trusted payees are separated by account . Raw payment text and OCR text are not saved; the app saves a summary and explanation.</p><p><strong>Profile:</strong> open it from the sidebar or your account row. To sign out, click the visible <strong>Sign out</strong> button, then confirm on the Profile page. To change your password, go to <strong>Settings → Continue to password change</strong>, confirm your current password, then enter and confirm the new one. Forgot-password recovery and email verification are not available yet.</p><div className="help-account-actions"><button className="text-button" type="button" onClick={() => setActiveItem('Profile')}><UserRound size={15}/>Open Profile</button><button className="text-button" type="button" onClick={() => setActiveItem('Settings')}><Settings2 size={15}/>Open Settings</button></div></article></section>
          </> : activeItem === 'Change password' ? <>
            <section className="verify-heading"><p className="eyebrow">ACCOUNT SECURITY</p><h1>{passwordStep === 'success' ? 'Password updated' : 'Change password'}</h1><p>{passwordStep === 'current' ? 'Step 1 of 2 · Confirm your current password to continue.' : passwordStep === 'new' ? 'Step 2 of 2 · Choose and confirm your new password.' : 'Your account password was changed successfully.'}</p></section>
            <section className="settings-layout password-flow">{passwordStep === 'current' ? <form className="settings-card password-form" onSubmit={verifyCurrentPassword}><h2>Confirm it’s you</h2><p>Enter the password you currently use to sign in.</p><label className="field-label" htmlFor="current-password">Current password</label><PasswordInput id="current-password" autoComplete="current-password" required minLength={10} maxLength={128} disabled={passwordBusy} value={currentPassword} onChange={event => { setCurrentPassword(event.target.value); setPasswordMessage(''); setPasswordMessageIsError(false) }} placeholder="Your current password"/><div className="verify-card-footer"><button className="text-button" type="button" disabled={passwordBusy} onClick={() => { setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword(''); setPasswordMessage(''); setActiveItem('Settings') }}>Cancel</button><button className="primary-button" type="submit" disabled={passwordBusy}>{passwordBusy ? 'Checking…' : 'Continue'} <ArrowUpRight size={16}/></button></div>{passwordMessage && <p className="password-message" role={passwordMessageIsError ? 'alert' : 'status'}>{passwordMessage}</p>}</form> : passwordStep === 'new' ? <form className="settings-card password-form" onSubmit={updatePassword}><h2>Choose a new password</h2><p>Your current password was confirmed. Use at least 10 characters.</p><label className="field-label" htmlFor="new-password">New password</label><PasswordInput id="new-password" autoComplete="new-password" required minLength={10} maxLength={128} disabled={passwordBusy} value={newPassword} onChange={event => { setNewPassword(event.target.value); setPasswordMessage(''); setPasswordMessageIsError(false) }} placeholder="At least 10 characters"/><label className="field-label" htmlFor="confirm-new-password">Confirm new password</label><PasswordInput id="confirm-new-password" autoComplete="new-password" required minLength={10} maxLength={128} disabled={passwordBusy} value={confirmNewPassword} onChange={event => { setConfirmNewPassword(event.target.value); setPasswordMessage(''); setPasswordMessageIsError(false) }} placeholder="Type the new password again"/>{confirmNewPassword && <small className={`password-match-note ${passwordConfirmationValid ? 'is-valid' : 'is-invalid'}`} role="status">{passwordConfirmationValid ? 'Passwords match.' : newPassword.length < 10 ? 'Use at least 10 characters in your new password.' : 'These passwords do not match yet.'}</small>}<div className="verify-card-footer"><button className="text-button" type="button" disabled={passwordBusy} onClick={() => { setPasswordMessage(''); setPasswordStep('current') }}>Back</button><button className="primary-button" type="submit" disabled={passwordBusy || !passwordConfirmationValid}>{passwordBusy ? 'Updating…' : 'Change password'} {!passwordBusy && <ShieldCheck size={16}/>}</button></div>{passwordMessage && <p className="password-message" role={passwordMessageIsError ? 'alert' : 'status'}>{passwordMessage}</p>}</form> : <article className="settings-card password-form password-success"><div className="settings-account-icon"><ShieldCheck size={21}/></div><h2>Password changed</h2><p role="status">Password changed. You are still signed in on this device; other sessions were signed out.</p><div className="verify-card-footer"><button className="text-button" type="button" onClick={() => setActiveItem('Settings')}>Back to settings</button><button className="primary-button" type="button" onClick={() => setActiveItem('Profile')}>Go to profile <ArrowUpRight size={16}/></button></div></article>}</section>
          </> : activeItem === 'Profile' ? <>
            <section className="verify-heading"><p className="eyebrow">YOUR ACCOUNT</p><h1>Profile</h1><p>Review the account signed in to this VerifyPay workspace.</p></section>
            <section className="settings-layout profile-layout"><article className="settings-card profile-card"><div className="settings-account-icon"><UserRound size={21}/></div><p className="eyebrow">ACCOUNT PROFILE</p><h2>{currentUser?.email || 'Account'}</h2><p>Your checks and trusted payees are private to your account.</p><div className="profile-details"><div><span>Email address</span><strong>{currentUser?.email || 'Not available'}</strong></div><div><span>Session</span><strong>Signed in on this browser tab</strong></div></div><p className="profile-session-note">Closing this browser tab signs you out. Your server session expires after 7 days.</p><div className="profile-activity" aria-label="Account activity"><button type="button" onClick={() => setActiveItem('Payment history')}><strong>{activityStats.checks}</strong><span>Payment checks</span></button><button type="button" onClick={() => setActiveItem('Trusted payees')}><strong>{activityStats.trusted_payees}</strong><span>Trusted payees</span></button></div><div className="profile-shortcuts"><button className="text-button" type="button" onClick={() => setActiveItem('Settings')}><Settings2 size={15}/>Account settings</button><button className="text-button" type="button" onClick={() => setActiveItem('Payment history')}><Clock3 size={15}/>Payment history</button></div><div className="profile-signout-row">{signOutConfirming ? <><span>Sign out of this browser session?</span><div className="profile-confirm-actions"><button className="text-button" type="button" onClick={() => setSignOutConfirming(false)}>Cancel</button><button className="signout-button" type="button" onClick={signOut}><LogOut size={16}/>Yes, sign out</button></div></> : <><span>Finished using VerifyPay?</span><button className="signout-button" type="button" onClick={() => setSignOutConfirming(true)}><LogOut size={16}/>Sign out</button></>}</div></article></section>
          </> : activeItem === 'Settings' ? <>
            <section className="verify-heading"><p className="eyebrow">ACCOUNT PREFERENCES</p><h1>Settings</h1><p>Manage your VerifyPay account.</p></section>
            <section className="settings-layout"><article className="settings-card"><div className="settings-account-icon"><ShieldCheck size={21}/></div><p className="eyebrow">SIGNED-IN ACCOUNT</p><h2>{currentUser?.email || 'Account'}</h2><p>Your checks and trusted payees are stored under this account.</p><p>Your sign-in stays in this browser tab. Closing the tab signs you out; server sessions expire after 7 days.</p></article><article className="settings-card"><div className="settings-account-icon">{theme === 'dark' ? <Moon size={20}/> : <Sun size={20}/>}</div><p className="eyebrow">APPEARANCE</p><h2>{theme === 'dark' ? 'Dark theme' : 'Light theme'}</h2><p>Choose the display style that feels best. Your choice is saved in this browser.</p><button className="theme-button settings-theme-button" type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={17}/> : <Moon size={17}/>}<span>Switch to {theme === 'dark' ? 'light' : 'dark'} theme</span></button></article><article className="settings-card"><div className="settings-account-icon"><Pencil size={20}/></div><p className="eyebrow">SECURITY</p><h2>Change password</h2><p>Confirm your current password first, then choose a new one. Other sessions are signed out after the change.</p><button className="primary-button" type="button" onClick={() => { setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword(''); setPasswordMessage(''); setPasswordMessageIsError(false); setPasswordStep('current'); setActiveItem('Change password') }}>Continue to password change <ArrowUpRight size={16}/></button></article></section>
          </> : activeItem === 'Trusted payees' ? <>
            <section className="verify-heading"><p className="eyebrow">YOUR TRUSTED LIST</p><h1>Trusted payees</h1><p>Keep the people and businesses you know in one place.</p></section>
            <section className="payees-layout"><form className="verify-card payee-form" onSubmit={savePayee}><h2>{editingPayeeId === null ? 'Add a trusted payee' : 'Edit trusted payee'}</h2><p>This list is saved to your account.</p><label className="field-label" htmlFor="payee-name">Name</label><input ref={payeeNameInputRef} id="payee-name" className="payee-input" value={payeeName} onChange={event => { setPayeeName(event.target.value); setPayeeMessage(''); setPayeeMessageIsError(false) }} required maxLength={120} placeholder="Person or business name"/><label className="field-label" htmlFor="payee-identifier">Payment identifier</label><input id="payee-identifier" className="payee-input" autoCapitalize="none" spellCheck="false" value={payeeIdentifier} onChange={event => { setPayeeIdentifier(event.target.value); setPayeeMessage(''); setPayeeMessageIsError(false) }} required maxLength={240} placeholder="Account, email, or wallet detail"/><div className="verify-card-footer"><span><ShieldCheck size={15}/> Private to this account</span><div className="payee-form-actions">{editingPayeeId !== null && <button className="text-button" type="button" disabled={payeeSaving} onClick={() => { setEditingPayeeId(null); setPayeeName(''); setPayeeIdentifier(''); setPayeeMessage(''); setPayeeMessageIsError(false) }}>Cancel</button>}<button className="primary-button" type="submit" disabled={payeeSaving}>{payeeSaving ? (editingPayeeId === null ? 'Saving…' : 'Updating…') : editingPayeeId === null ? 'Save payee' : 'Update payee'} {payeeSaving ? null : editingPayeeId === null ? <Plus size={16}/> : <Pencil size={15}/>}</button></div></div>{payeeMessage && <div className="input-next-note" role={payeeMessageIsError ? 'alert' : 'status'}>{payeeMessage}</div>}</form><section className="payee-list"><h2>Saved payees <span>{normalizedPayeeSearch ? `${filteredPayees.length} / ${trustedPayees.length}` : trustedPayees.length}</span></h2>{trustedPayees.length > 0 && <div className="payee-search"><label className="field-label" htmlFor="payee-search-input">Search saved payees</label><div className="payee-search-controls"><input id="payee-search-input" className="payee-input" type="search" value={payeeSearch} onChange={event => setPayeeSearch(event.target.value)} placeholder="Name or payment identifier"/><button className="text-button" type="button" disabled={!payeeSearch} onClick={() => setPayeeSearch("")}>Clear</button></div></div>}{trustedPayees.length ? filteredPayees.length ? filteredPayees.map(payee => <article className="payee-row" key={payee.id}><span className="payee-avatar">{payee.name.slice(0, 1).toUpperCase()}</span><span><strong>{payee.name}</strong><small>{payee.payment_identifier}</small></span><div className="payee-row-actions"><button className="edit-payee" type="button" disabled={payeeSaving || deletingPayeeId === payee.id} onClick={() => { setEditingPayeeId(payee.id); setPayeeName(payee.name); setPayeeIdentifier(payee.payment_identifier); setPayeeMessage(''); setPayeeMessageIsError(false); window.requestAnimationFrame(() => { payeeNameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); payeeNameInputRef.current?.focus() }) }} aria-label={`Edit ${payee.name}`} title="Edit payee"><Pencil size={14}/></button><button className="remove-payee" type="button" onClick={() => setConfirmDeletePayeeId(payee.id)} disabled={payeeSaving || deletingPayeeId === payee.id} aria-label={deletingPayeeId === payee.id ? `Removing ${payee.name}` : `Remove ${payee.name}`} title={deletingPayeeId === payee.id ? 'Removing…' : 'Remove payee'}><Trash2 size={15}/></button></div>{confirmDeletePayeeId === payee.id && <div className="payee-delete-confirm" role="group" aria-label={`Confirm removing ${payee.name}`}><span>Remove <strong>{payee.name}</strong>? Its payment history will stay saved.</span><div><button className="text-button" type="button" disabled={deletingPayeeId === payee.id} onClick={() => setConfirmDeletePayeeId(null)}>Cancel</button><button className="confirm-delete-button" type="button" disabled={deletingPayeeId === payee.id} onClick={() => removePayee(payee)}>{deletingPayeeId === payee.id ? "Removing…" : "Remove"}</button></div></div>}</article>) : <div className="payee-empty"><UsersRound size={23}/><strong>No payees match that search</strong><span>Try a name or payment identifier, or clear your search.</span><button className="text-button" type="button" onClick={() => setPayeeSearch("")}>Clear search</button></div> : <div className="payee-empty"><UsersRound size={23}/><strong>No trusted payees yet</strong><span>Add a payee above to start your list.</span></div>}<p className="storage-note">Accounts are kept separate. Account recovery and email verification are not available yet.</p></section></section>
          </> : activeItem === 'Payment history' ? <>
            <section className="verify-heading"><p className="eyebrow">SAVED ACTIVITY</p><h1>Payment history</h1><p>Your saved checks for this account. Open a result to review its score and explanation.</p></section>
            <div className="history-filters"><label>Risk level<select disabled={historyRefreshing} value={historyRiskFilter} onChange={event => setHistoryRiskFilter(event.target.value)}><option value="all">All levels</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label><label>Check type<select disabled={historyRefreshing} value={historySourceFilter} onChange={event => setHistorySourceFilter(event.target.value)}><option value="all">All types</option><option value="file">Image upload</option><option value="text">Pasted details</option><option value="url">Payment link</option></select></label><label className="history-search-label">Search saved checks<input type="search" maxLength={120} value={historySearch} onChange={event => setHistorySearch(event.target.value)} placeholder="Search labels or explanations" aria-label="Search saved payment checks by label or explanation"/></label></div>
            <section className="history-list" aria-busy={historyRefreshing}>{historyRefreshing && <p className="history-refresh-note" role="status">Refreshing saved checks…</p>}{activityStats.checks > 0 && <button className="history-export" type="button" disabled={historyExporting || historyRefreshing || historySearchPending} onClick={exportHistory}><Download size={15}/>{historyExporting ? 'Preparing download…' : historyRiskFilter !== 'all' || historySourceFilter !== 'all' || debouncedHistorySearch ? 'Download filtered CSV' : 'Download all as CSV'}</button>}{historyChecks.length ? historyChecks.map(check => <details className="history-detail" key={check.id}><summary className="history-row"><span className="metric-icon violet"><Clock3 size={17}/></span><span><strong>{check.input_label}</strong><small>Saved {new Date(check.created_at).toLocaleString()}</small></span><span className={`risk-pill risk-${check.risk_level}`}>PRELIMINARY · {check.risk_level.toUpperCase()}</span><span className="history-score">{check.risk_score}/100</span></summary><div className="history-explanation"><strong>Why this signal was assigned</strong><p>{check.explanation}</p><small>Rules-based signal, not a percentage chance of fraud. It does not verify account ownership or confirm whether a payment is safe.</small>{confirmDeleteCheckId === check.id ? <div className="inline-delete-confirm" role="group" aria-label="Confirm deleting this saved check"><span>Delete this check? This cannot be undone.</span><button className="text-button" type="button" disabled={deletingCheckId === check.id} onClick={() => setConfirmDeleteCheckId(null)}>Cancel</button><button className="confirm-delete-button" type="button" disabled={deletingCheckId === check.id} onClick={() => deleteCheck(check)}>{deletingCheckId === check.id ? 'Deleting…' : 'Delete'}</button></div> : <button className="delete-history-entry" type="button" onClick={() => setConfirmDeleteCheckId(check.id)}><Trash2 size={14}/>Delete this check</button>}</div></details>) : <div className="payee-empty"><FileCheck2 size={23}/><strong>{activityStats.checks > 0 ? 'No checks match these filters' : 'No checks saved yet'}</strong><span>{activityStats.checks > 0 ? 'Try changing or clearing the filters above.' : 'Run your first payment check to get started.'}</span>{activityStats.checks > 0 ? <button type="button" className="text-button" onClick={() => { setHistoryRiskFilter('all'); setHistorySourceFilter('all'); setHistorySearch('') }}>Clear filters</button> : <button type="button" className="text-button" onClick={openVerifier}>Check a payment</button>}</div>}{historyError && <div className="history-error" role="alert"><p>{historyError}</p><button className="text-button" type="button" onClick={() => setActivityRefreshKey(current => current + 1)}>Try again</button></div>}{hasMoreChecks && <button className="text-button history-load-more" type="button" disabled={historyLoading || historyRefreshing || historySearchPending} onClick={loadMoreChecks}>{historyLoading ? 'Loading…' : historySearchPending ? 'Applying search…' : 'Load more checks'}</button>}</section>
          </> : activeItem === 'Verify a payment' ? <>
            <section className="verify-heading"><button className="back-link" type="button" onClick={() => setActiveItem('Overview')}>← Back to overview</button><p className="eyebrow">PAYMENT SAFETY CHECK</p><h1>What would you like us to check?</h1><p>VerifyPay analyzes your submission. Raw payment text is not saved to your account.</p></section>
            {!inputReady ? <section className="verify-card">
              <div className="input-tabs" role="group" aria-label="Choose payment input type">
                <button type="button" aria-pressed={inputMode === 'upload'} className={inputMode === 'upload' ? 'is-selected' : ''} onClick={() => changeInputMode('upload')}><Upload size={16}/> Upload image</button>
                <button type="button" aria-pressed={inputMode === 'paste'} className={inputMode === 'paste' ? 'is-selected' : ''} onClick={() => changeInputMode('paste')}><FileCheck2 size={16}/> Paste details</button>
                <button type="button" aria-pressed={inputMode === 'url'} className={inputMode === 'url' ? 'is-selected' : ''} onClick={() => changeInputMode('url')}><Link2 size={16}/> Payment link</button>
              </div>
              {inputMode === 'upload' && <div className="input-panel">
                {!selectedFile ? <label className={`dropzone${fileDragActive ? ' is-dragging' : ''}`} onDragOver={event => event.preventDefault()} onDragEnter={event => { event.preventDefault(); setFileDragActive(true) }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFileDragActive(false) }} onDrop={event => { event.preventDefault(); setFileDragActive(false); chooseFile(event.dataTransfer.files?.[0]) }}><input type="file" aria-label="Upload payment screenshot or receipt" accept="image/png,image/jpeg,image/webp" onChange={event => chooseFile(event.target.files?.[0] ?? null)}/><span className="upload-icon"><Upload size={21}/></span><strong>{fileDragActive ? 'Release to add this image' : 'Drop a screenshot or receipt here'}</strong><span>or <em>browse files</em> on your device</span><small>PNG, JPG or WEBP · up to 10 MB · clear English text works best</small></label> : <div className="file-selected">{filePreviewUrl ? <img className="file-thumbnail" src={filePreviewUrl} alt="Selected payment screenshot preview"/> : <span className="upload-icon"><FileImage size={20}/></span>}<span><strong title={selectedFile.name}>{selectedFile.name}</strong><small>{selectedFile.type ? selectedFile.type.replace('image/', '').toUpperCase() : selectedFile.name.split('.').pop().toUpperCase()} · {(selectedFile.size / 1024 / 1024).toFixed(2)} MB · Preview stays here until you continue</small></span><button type="button" aria-label="Remove selected file" onClick={clearFile}><X size={17}/></button></div>}{fileError && <p className="file-error" role="alert">{fileError}</p>}
              </div>}
              {inputMode === 'paste' && <div className="input-panel"><label className="field-label" htmlFor="payment-details">Paste the message or payment instructions</label><textarea id="payment-details" className="payment-textarea" maxLength={12000} aria-describedby="payment-details-guidance" onKeyDown={event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); if (paymentInputReady) startScanPreview() } }} value={pastedText} onChange={event => setPastedText(event.target.value)} placeholder={'Paste the payment request here…\n\nFor example: recipient, amount, account or wallet details, and any message you received.'}/><div className="field-hint-row"><div id="payment-details-guidance" className="field-hint">Include any details you have. You can remove personal information first. Maximum 12,000 characters. Press Ctrl+Enter (or Cmd+Enter) to continue.</div>{pastedText && <button className="clear-pasted-button" type="button" onClick={() => setPastedText('')}>Clear text</button>}<span className="field-counter">{pastedText.length.toLocaleString()} / 12,000</span></div>{pastedLinkCount > 0 && <p className="link-input-note" role="status">{pastedLinkCount} link{pastedLinkCount === 1 ? '' : 's'} found. VerifyPay checks link text only and will not open them.</p>}</div>}
              {inputMode === 'url' && <div className="input-panel"><label className="field-label" htmlFor="payment-url">Paste the payment page link</label><div className="url-input-row"><div className="url-field"><Link2 size={17}/><input id="payment-url" type="text" inputMode="url" autoCapitalize="none" spellCheck="false" maxLength={2048} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); if (paymentInputReady) startScanPreview() } }} value={paymentUrl} onChange={event => { setPaymentUrl(event.target.value); setUrlError('') }} placeholder="https://example.com/payment" aria-invalid={Boolean(urlError)} aria-describedby="payment-url-hint"/></div>{paymentUrl && <button className="clear-url-button" type="button" onClick={() => { setPaymentUrl(''); setUrlError('') }}>Clear</button>}</div><div id="payment-url-hint" className="field-hint">You can enter a domain with or without https://. We inspect link text only and never open it. Up to 2,048 characters. Press Enter to continue.</div>{paymentUrlHost && <p className="url-preview-note" role="status">Parsed domain: <strong>{paymentUrlHost}</strong> · This is a text-only check, not a reputation lookup.</p>}{urlError && <p className="file-error" role="alert">{urlError}</p>}</div>}
              <div className="verify-card-footer"><span><ShieldCheck size={15}/> Submitted for a preliminary check; only the summary is saved</span><button className="primary-button" type="button" aria-describedby="payment-input-next-guidance" disabled={!paymentInputReady} onClick={startScanPreview}>Continue <ArrowUpRight size={16}/></button></div>
              <div id="payment-input-next-guidance" className="input-next-note" role="status">{paymentInputHint}</div>
            </section> : <section className="scan-card">
              <div className="scan-card-top"><span className="scan-orb"><span className="scan-orb-core"><ShieldCheck size={30}/></span><i/><b/></span><p className="eyebrow">PAYMENT SAFETY CHECK</p><h2>{scanFailed ? scanFailureTitle : scanStep === 2 ? 'Showing your result' : scanStep < 3 ? 'Reviewing your payment details' : 'Check complete'}</h2><p className="scan-description">{scanFailed ? scanFailureDescription : scanStep === 2 ? 'The API returned a preliminary result. Review its signal and reasons below.' : scanStep < 3 ? scanActivityDescription : 'This is a preliminary text check. It cannot confirm whether a payment is safe or fraudulent.'}</p></div>
              <div className={`scan-progress-meta${scanFailed ? ' is-error' : ''}`}><span>{scanFailed ? 'CHECK INCOMPLETE' : scanStep === 2 ? 'RESULT RECEIVED' : scanStep < 3 ? scanPending ? inputMode === 'upload' ? 'READING IMAGE · PLEASE WAIT' : inputMode === 'paste' ? 'CHECKING DETAILS · PLEASE WAIT' : 'INSPECTING LINK · PLEASE WAIT' : 'CHECKING' : 'CHECK COMPLETE'}</span><strong>{scanProgressPercent}%</strong></div>
              <div className={`scan-progress-track${scanFailed ? ' is-error' : ''}`} role="progressbar" aria-label="Payment check progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={scanProgressPercent} aria-valuetext={`${scanProgressPercent}% ${scanFailed ? 'check incomplete' : scanStep === 2 ? 'result received' : scanStep < 3 ? 'checking' : 'check complete'}`}><span style={{ width: `${scanProgressPercent}%` }}/></div>
              <span className="sr-only" role="status" aria-live="polite">{scanFailed ? `${scanFailureTitle}. ${scanFailureDescription}` : scanStep === 2 ? 'Your preliminary result is ready.' : scanStep === 3 ? 'Payment check complete.' : 'Payment check in progress.'}</span>
              <div className="scan-steps" role="list" aria-label="Payment check stages">
                {[
                  { title: 'Prepare your input', detail: 'Check the selected image, text, or payment link.' },
                  { title: inputMode === 'upload' ? 'Read and analyze image' : 'Analyze payment details', detail: inputMode === 'upload' ? 'The API runs OCR and checks the extracted text.' : 'The API checks for preliminary warning patterns.' },
                  { title: 'Show your result', detail: 'Present the preliminary signal and its explanation.' },
                ].map((step, index) => { const failed = scanFailed && index === failedScanStepIndex; const done = scanStep > index && !failed; const current = !scanFailed && scanStep === index; return <div className={`scan-step${done ? ' is-done' : ''}${current ? ' is-current' : ''}${failed ? ' is-error' : ''}`} key={step.title} role="listitem" aria-current={current ? 'step' : undefined}><span className="scan-step-icon">{failed ? <span>!</span> : done ? <span>✓</span> : current ? <i/> : null}</span><span><strong>{step.title}</strong><small>{step.detail}</small></span><span className="scan-step-state">{failed ? 'FAILED' : done ? 'DONE' : current ? 'IN PROGRESS' : 'WAITING'}</span></div> })}
              </div>
              {scanStep >= 2 && (scanResult ? <div className="sample-result"><div className="sample-result-heading"><span className={`risk-pill risk-${scanResult.risk_level}`}>PRELIMINARY · {scanResult.risk_level.toUpperCase()}</span><strong>Signal score {scanResult.risk_score}/100</strong></div><div className={`risk-meter risk-${scanResult.risk_level}`} role="img" aria-label={`Risk signal score ${scanResult.risk_score} out of 100`}><span style={{ width: `${scanResult.risk_score}%` }}/></div><div className="risk-scale-labels"><span>Low · 0–34</span><span>Medium · 35–69</span><span>High · 70–100</span></div><p>{scanResult.explanation}</p><p className="match-caveat">This score is a rules-based signal, not a percentage chance of fraud.</p>{scanResult.findings?.length > 0 && <div className="finding-list"><strong>Signals that affected this score</strong><ul>{scanResult.findings.map((finding, index) => <li key={`${index}-${finding}`}>{finding}</li>)}</ul></div>}<div className="recommended-action"><strong>Suggested next step</strong><p>{scanResult.recommended_action || 'Confirm payment details independently before sending money.'}</p></div><button className="text-button copy-summary-button" type="button" onClick={copyScanSummary}>Copy result summary</button>{copySummaryMessage && <p className="copy-summary-message" role={copySummaryMessageIsError ? 'alert' : 'status'}>{copySummaryMessage}</p>}<div className="detected-details"><div><span>Amount detected</span><strong>{scanResult.detected_amount || 'Not detected'}</strong></div><div><span>Recipient guess</span><strong>{scanResult.recipient_guess || 'Not identified'}</strong></div><div><span>Trusted-list text match</span><strong>{scanResult.trusted_payee_match ? `${scanResult.trusted_payee_match} mentioned` : 'No match found in text'}</strong></div>{(scanResult.link_domains?.length > 0 || scanResult.link_domain) && <div><span>{scanResult.link_domains?.length > 1 ? 'Link domains checked' : 'Link domain'}</span><strong>{scanResult.link_domains?.length ? scanResult.link_domains.join(', ') : scanResult.link_domain}</strong></div>}</div>{scanResult.trusted_payee_match && <p className="match-caveat">A text match only means the name or identifier appeared in the message. It does not verify who owns the account.</p>}{(scanResult.link_domains?.length > 0 || scanResult.link_domain) && <p className="match-caveat">Detected links were inspected as text only; VerifyPay does not open or visit them.</p>}{scanResult.ocr_text_preview && <details className="ocr-preview"><summary>View text read from image</summary><pre>{scanResult.ocr_text_preview}</pre></details>}<small>These rules can miss scams or flag ordinary messages. Check the payee independently before sending money.</small></div> : <div className="preview-notice"><AlertTriangle size={17}/><span><strong>{apiError ? 'Check could not finish' : 'Waiting for your result'}</strong><small>{apiError || 'The API is preparing the check result.'}</small></span>{apiError && <button className="text-button" type="button" onClick={startScanPreview}>Try again</button>}</div>)}
              <div className="scan-footer"><span><span className="secure-dot"/> Raw text is not saved in the database</span>{scanStep === 3 && <div className="scan-actions"><button type="button" className="text-button" onClick={() => setInputReady(false)}>Back to input</button>{scanResult && <button type="button" className="text-button" onClick={startAnotherCheck}>Check another payment</button>}</div>}</div>
            </section>}
          </> : <>
          <section className="welcome-row"><div><p className="eyebrow">{todayLabel}</p><h1>{welcomeGreeting} <span className="wave">✦</span></h1><p className="welcome-subtitle">A clearer view of your payment safety starts here.</p></div><button className="primary-button" type="button" onClick={openVerifier}><Plus size={18}/> Verify a payment</button></section>

          <section className="hero-card"><div className="hero-copy"><span className="hero-kicker"><ShieldCheck size={15}/> YOUR PAYMENT SAFETY</span><h2>Pause. Check.<br/><span>Pay with confidence.</span></h2><p>Review a payment request before you send money. We’ll help you spot the details that deserve a closer look.</p><button className="hero-button" type="button" onClick={openVerifier}>Start a payment check <ArrowUpRight size={16}/></button></div><div className="hero-art" aria-hidden="true"><div className="orbit orbit-outer"/><div className="orbit orbit-inner"/><div className="hero-glass"><ShieldCheck size={62} strokeWidth={1.4}/><span className="hero-glint"/></div><div className="floating-chip chip-one"><span className="chip-check"><FileCheck2 size={14}/></span><span><strong>Details checked</strong><small>Private by design</small></span></div><div className="floating-chip chip-two"><span className="pulse-dot"/><span><strong>Ready when you are</strong></span></div></div><div className="hero-glow"/></section>

          <section className="section-heading"><div><h2>Your activity</h2><p>Keep track of your recent payment checks.</p></div><button className="text-button" type="button" onClick={() => setActiveItem('Payment history')}>View history <ArrowUpRight size={15}/></button></section>
          <section className="activity-grid"><article className="metric-card"><div className="metric-top"><span className="metric-icon blue"><Activity size={18}/></span><span className="metric-period">ALL TIME</span></div><strong className="metric-value">{activityStats.checks}</strong><span className="metric-label">Payments checked</span><div className="metric-foot">Preliminary checks saved to your account</div></article><article className="metric-card"><div className="metric-top"><span className="metric-icon green"><ShieldCheck size={18}/></span><span className="metric-period">ALL TIME</span></div><strong className="metric-value">{activityStats.trusted_payees}</strong><span className="metric-label">Trusted payees</span><div className="metric-foot">Saved to your account</div></article><article className="recent-card"><div className="recent-heading"><span className="metric-icon violet"><Clock3 size={18}/></span><span><strong>Recent checks</strong><small>Your latest payment reviews</small></span><button className="mini-arrow" aria-label="View payment history" type="button" onClick={() => setActiveItem('Payment history')}><ArrowUpRight size={16}/></button></div>{recentChecks.length ? <div className="recent-check-list">{recentChecks.slice(0, 2).map(check => <div className="recent-check" key={check.id}><span className="empty-icon"><FileCheck2 size={16}/></span><span><strong>{check.input_label}</strong><small>Preliminary {check.risk_level} signal · rules-based</small></span></div>)}</div> : <div className="empty-activity"><span className="empty-icon"><FileCheck2 size={19}/></span><span><strong>No checks yet</strong><small>When you review a payment, it’ll show up here.</small></span></div>}</article></section>
          <footer className="page-footer"><span><ShieldCheck size={14}/> Your payment details stay private.</span><span>Need a hand? <button type="button" onClick={() => setActiveItem('Help center')}>Visit the help center</button></span></footer>
          </>}
        </div>
      </main>
    </div>
  )
}

export default App
