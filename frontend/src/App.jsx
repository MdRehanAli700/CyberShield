import React from 'react'
import { Activity, AlertTriangle, ArrowUpRight, Bell, BookOpen, Clock3, Download, FileCheck2, FileImage, HelpCircle, Headphones, LayoutDashboard, Link2, LogOut, Moon, Pencil, Plus, Search, Settings2, ShieldCheck, Sun, Trash2, Upload, UserRound, UsersRound, X, ChevronDown, CheckCircle2, Clock4, Building2, CircleHelp, Menu, ScanLine, MessageSquare, ChevronRight, Check, MoreHorizontal } from 'lucide-react'
import PasswordInput from './components/PasswordInput.jsx'
import { apiUrl, timeoutSignal } from './lib/api.js'

function CyberShieldMark({ className = '' }) {
  return <img className={className} src="/cybershield-shield.png" alt="" aria-hidden="true" draggable="false"/>
}

function GoogleMark() {
  return <svg className="google-logo" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11c-.5 2.5-1.9 4.6-4.1 6v5h6.6c3.9-3.6 6.1-8.8 6.1-14.7z"/>
    <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.2C9.2 39.6 16 44 24 44z"/>
    <path fill="#FBBC05" d="M12.6 27.8a12 12 0 0 1 0-7.6V15H5.8a20 20 0 0 0 0 18l6.8-5.2z"/>
    <path fill="#EA4335" d="M24 11.8c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 5.7 29.5 4 24 4 16 4 9.2 8.4 5.8 15l6.8 5.2c1.6-4.8 6.1-8.4 11.4-8.4z"/>
  </svg>
}

function OpeningAnimation({ onSkip }) {
  return <div className="intro-overlay" role="status" aria-label="Opening CyberShield VerifyPay">
    <div className="intro-backdrop" aria-hidden="true"/>
    <div className="intro-particles" aria-hidden="true">{Array.from({ length: 20 }, (_, index) => <i key={index} style={{ '--particle-index': index }}/>)}</div>
    <div className="intro-content"><div className="intro-mark-wrap"><CyberShieldMark className="intro-mark"/><span className="intro-scan-line"/></div><strong className="intro-wordmark">Cyber<span>Shield</span></strong><small className="intro-trusted">TRUSTED TRANSACTIONS</small><small className="intro-tagline">Verify Before You Pay.</small><span className="intro-loader" aria-hidden="true"/></div>
    <button className="intro-skip" type="button" onClick={onSkip}>Skip intro</button>
  </div>
}

function NotificationMenu({ notifications, unreadCount, open, onToggle, onMarkAllRead, onSelect }) {
  return <div className="notification-wrap">
    <button className="icon-button notification-button" type="button" aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"} aria-expanded={open} aria-controls="notification-panel" onClick={onToggle}>
      <Bell size={17}/>{unreadCount > 0 && <i aria-hidden="true"/>}{unreadCount > 0 && <span className="notification-count" aria-hidden="true">{unreadCount > 9 ? "9+" : unreadCount}</span>}
    </button>
    {open && <section id="notification-panel" className="notification-panel" role="dialog" aria-label="Notifications">
      <header><span><strong>Notifications</strong><small>{unreadCount ? `${unreadCount} unread` : "You’re all caught up"}</small></span><button type="button" className="text-button" disabled={!unreadCount} onClick={onMarkAllRead}>Mark all read</button></header>
      {notifications.length ? <ul>{notifications.map(item => <li key={item.id}><button type="button" className={`notification-item ${item.read ? "" : "is-unread"}`} onClick={() => onSelect(item)}>
        <span className={`notification-risk notification-risk-${item.risk_level || "medium"}`}><ShieldCheck size={15}/></span>
        <span className="notification-copy"><strong>{item.risk_level === "high" ? "High-risk payment check" : item.risk_level === "low" ? "Low-risk payment check" : "Payment check complete"}</strong><small>{item.input_label || "Payment details checked"}</small><time>{item.created_at ? new Date(item.created_at).toLocaleString() : "Just now"}</time></span>
        {!item.read && <i aria-label="Unread"/>}
      </button></li>)}</ul> : <p className="notification-empty">Your completed payment checks will appear here.</p>}
    </section>}
  </div>
}

function TOTPSettingsControls({
  enabled, step, setStep, password, setPassword, secret, code, setCode,
  recoveryCodes, setRecoveryCodes, message, messageIsError, busy,
  onStart, onEnable, onDisable,
}) {
  return <div className="totp-settings-control">
    <div className="settings-unavailable"><ShieldCheck size={15}/><span><strong>Two-factor authentication</strong><small>{enabled ? 'Enabled with an authenticator app' : 'Add an authenticator app to sign-in'}</small></span><strong className={enabled ? 'totp-enabled-status' : 'totp-disabled-status'}>{enabled ? 'On' : 'Off'}</strong></div>
    {step === 'idle' && <button className={enabled ? 'text-button' : 'primary-button'} type="button" onClick={() => setStep(enabled ? 'disable' : 'password')}>{enabled ? 'Turn off two-factor authentication' : 'Set up two-factor authentication'}</button>}
    {step === 'password' && <form className="totp-inline-form" onSubmit={onStart}>
      <p>Confirm your password to begin setup. The setup key expires in 10 minutes.</p>
      <label className="field-label" htmlFor="totp-setup-password">Current password</label>
      <PasswordInput id="totp-setup-password" autoComplete="current-password" required minLength={10} maxLength={128} disabled={busy} value={password} onChange={event => setPassword(event.target.value)} placeholder="Your current password"/>
      <div className="verify-card-footer"><button className="text-button" type="button" disabled={busy} onClick={() => setStep('idle')}>Cancel</button><button className="primary-button" type="submit" disabled={busy}>{busy ? 'Checking…' : 'Continue setup'}</button></div>
    </form>}
    {step === 'setup' && <form className="totp-inline-form" onSubmit={onEnable}>
      <p>In your authenticator app, add an account using this setup key:</p><code className="totp-secret-key">{secret}</code>
      <p className="totp-help-copy">Enter the six-digit code shown in the app to confirm setup.</p>
      <label className="field-label" htmlFor="totp-setup-code">Authenticator code</label>
      <input id="totp-setup-code" className="payee-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required maxLength={6} disabled={busy} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456"/>
      <div className="verify-card-footer"><button className="text-button" type="button" disabled={busy} onClick={() => setStep('idle')}>Cancel</button><button className="primary-button" type="submit" disabled={busy || code.length !== 6}>{busy ? 'Verifying…' : 'Enable two-factor authentication'}</button></div>
    </form>}
    {step === 'recovery' && <div className="totp-inline-form"><p><strong>Save these recovery codes now.</strong> Each code works once if you lose access to your authenticator. They won’t be shown again.</p><ol className="totp-recovery-list">{recoveryCodes.map(item => <li key={item}><code>{item}</code></li>)}</ol><div className="verify-card-footer"><button className="primary-button" type="button" onClick={() => { setRecoveryCodes([]); setStep('idle') }}>I saved my recovery codes</button></div></div>}
    {step === 'disable' && <form className="totp-inline-form" onSubmit={onDisable}>
      <p>Confirm your password and an authenticator or unused recovery code to turn off two-factor authentication.</p>
      <label className="field-label" htmlFor="totp-disable-password">Current password</label>
      <PasswordInput id="totp-disable-password" autoComplete="current-password" required minLength={10} maxLength={128} disabled={busy} value={password} onChange={event => setPassword(event.target.value)} placeholder="Your current password"/>
      <label className="field-label" htmlFor="totp-disable-code">Authenticator or recovery code</label>
      <input id="totp-disable-code" className="payee-input" autoComplete="one-time-code" required maxLength={20} disabled={busy} value={code} onChange={event => setCode(event.target.value)} placeholder="Code"/>
      <div className="verify-card-footer"><button className="text-button" type="button" disabled={busy} onClick={() => setStep('idle')}>Cancel</button><button className="signout-button" type="submit" disabled={busy}>{busy ? 'Turning off…' : 'Turn off two-factor'}</button></div>
    </form>}
    {message && <p className="profile-save-message" role={messageIsError ? 'alert' : 'status'}>{message}</p>}
  </div>
}

function App() {
  const [theme, setTheme] = React.useState(() => {
    const savedTheme = window.localStorage.getItem('verifypay-theme')
    if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  })
  const [activeItem, setActiveItem] = React.useState('Overview')
  const [highlightedLearnTopic, setHighlightedLearnTopic] = React.useState('')
  const learnTopicHighlightTimerRef = React.useRef(null)
  const [showMoreMenu, setShowMoreMenu] = React.useState(false)
  const [globalSearch, setGlobalSearch] = React.useState('')
  const [globalSearchOpen, setGlobalSearchOpen] = React.useState(false)
  const [showIntro, setShowIntro] = React.useState(() => {
    try { return !window.sessionStorage.getItem('verifypay-intro-played') && !window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
  })
  const [inputMode, setInputMode] = React.useState('upload')
  const [pastedText, setPastedText] = React.useState('')
  const [manualDetails, setManualDetails] = React.useState({ recipient: '', identifier: '', amount: '', date: '', reference: '', note: '' })
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
  const [scanProgressPercent, setScanProgressPercent] = React.useState(0)
  const [scanResult, setScanResult] = React.useState(null)
  const [copySummaryMessage, setCopySummaryMessage] = React.useState('')
  const [copySummaryMessageIsError, setCopySummaryMessageIsError] = React.useState(false)
  const [apiError, setApiError] = React.useState('')
  const [recentChecks, setRecentChecks] = React.useState([])
  const [notifications, setNotifications] = React.useState([])
  const [notificationOpen, setNotificationOpen] = React.useState(false)
  const [notificationLoadedKey, setNotificationLoadedKey] = React.useState('')
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
  const [payeeTypeFilter, setPayeeTypeFilter] = React.useState('all')
  const [payeeSort, setPayeeSort] = React.useState('recent')
  const [activityStats, setActivityStats] = React.useState({ checks: 0, trusted_payees: 0 })
  const [payeeName, setPayeeName] = React.useState('')
  const [payeeIdentifier, setPayeeIdentifier] = React.useState('')
  const [payeeIdentifierType, setPayeeIdentifierType] = React.useState('UPI ID')
  const [payeeCategory, setPayeeCategory] = React.useState('')
  const [payeeNote, setPayeeNote] = React.useState('')
  const [payeeVerifyQuery, setPayeeVerifyQuery] = React.useState('')
  const [payeeMessage, setPayeeMessage] = React.useState('')
  const [payeeMessageIsError, setPayeeMessageIsError] = React.useState(false)
  const [payeeSaving, setPayeeSaving] = React.useState(false)
  const [editingPayeeId, setEditingPayeeId] = React.useState(null)
  const [deletingPayeeId, setDeletingPayeeId] = React.useState(null)
  const [confirmDeletePayeeId, setConfirmDeletePayeeId] = React.useState(null)
  const payeeNameInputRef = React.useRef(null)
  const [authToken, setAuthToken] = React.useState(() => window.sessionStorage.getItem('verifypay-token') || '')
  const [currentUser, setCurrentUser] = React.useState(null)
  const [linkedOAuthProviders, setLinkedOAuthProviders] = React.useState([])
  const [googleLinkBusy, setGoogleLinkBusy] = React.useState(false)
  const [googleLinkMessage, setGoogleLinkMessage] = React.useState('')
  const [googleLinkMessageIsError, setGoogleLinkMessageIsError] = React.useState(false)
  const [profileEditing, setProfileEditing] = React.useState(false)
  const [profileDraft, setProfileDraft] = React.useState({ display_name: '', phone_number: '' })
  const [profileSaving, setProfileSaving] = React.useState(false)
  const [profileMessage, setProfileMessage] = React.useState('')
  const [profileMessageIsError, setProfileMessageIsError] = React.useState(false)
  const [privacyBusy, setPrivacyBusy] = React.useState(false)
  const [privacyMessage, setPrivacyMessage] = React.useState('')
  const [privacyMessageIsError, setPrivacyMessageIsError] = React.useState(false)
  const [deleteAccountConfirming, setDeleteAccountConfirming] = React.useState(false)
  const [deleteAccountPassword, setDeleteAccountPassword] = React.useState('')
  const [signOutConfirming, setSignOutConfirming] = React.useState(false)
  const [authReady, setAuthReady] = React.useState(false)
  const [authMode, setAuthMode] = React.useState('login')
  const [authResetToken, setAuthResetToken] = React.useState('')
  const [authFeedback, setAuthFeedback] = React.useState('')
  const [authEmail, setAuthEmail] = React.useState('')
  const [authPassword, setAuthPassword] = React.useState('')
  const [mfaChallengeToken, setMfaChallengeToken] = React.useState('')
  const [mfaCode, setMfaCode] = React.useState('')
  const [authConfirmPassword, setAuthConfirmPassword] = React.useState('')
  const [authError, setAuthError] = React.useState('')
  const [authBusy, setAuthBusy] = React.useState(false)
  const authRequestInFlightRef = React.useRef(false)
  const scanRequestInFlightRef = React.useRef(false)
  const scanAbortControllerRef = React.useRef(null)
  const [apiStatus, setApiStatus] = React.useState('checking')
  const notificationStorageKey = `verifypay-notifications-${currentUser?.id || 'guest'}`
  const unreadNotificationCount = notifications.filter(item => !item.read).length
  const [currentPassword, setCurrentPassword] = React.useState('')
  const [newPassword, setNewPassword] = React.useState('')
  const [confirmNewPassword, setConfirmNewPassword] = React.useState('')
  const [passwordMessage, setPasswordMessage] = React.useState('')
  const [passwordMessageIsError, setPasswordMessageIsError] = React.useState(false)
  const [passwordBusy, setPasswordBusy] = React.useState(false)
  const [passwordStep, setPasswordStep] = React.useState('current')
  const [totpSetupStep, setTotpSetupStep] = React.useState('idle')
  const [totpSetupPassword, setTotpSetupPassword] = React.useState('')
  const [totpSecret, setTotpSecret] = React.useState('')
  const [totpCode, setTotpCode] = React.useState('')
  const [totpRecoveryCodes, setTotpRecoveryCodes] = React.useState([])
  const [totpMessage, setTotpMessage] = React.useState('')
  const [totpMessageIsError, setTotpMessageIsError] = React.useState(false)
  const [totpBusy, setTotpBusy] = React.useState(false)
  const finishIntro = React.useCallback(() => {
    try { window.sessionStorage.setItem('verifypay-intro-played', 'true') } catch { /* The animation can still finish without storage. */ }
    setShowIntro(false)
  }, [])
  React.useEffect(() => {
    if (!showIntro) return undefined
    const timer = window.setTimeout(finishIntro, 3600)
    return () => window.clearTimeout(timer)
  }, [showIntro, finishIntro])
  const passwordConfirmationValid = newPassword.length >= 10 && newPassword === confirmNewPassword
  const normalizedPayeeSearch = payeeSearch.trim().toLocaleLowerCase()
  const filteredPayees = trustedPayees
    .filter(payee => payeeTypeFilter === 'all' || payee.identifier_type === payeeTypeFilter)
    .filter(payee => !normalizedPayeeSearch || `${payee.name} ${payee.payment_identifier}`.toLocaleLowerCase().includes(normalizedPayeeSearch))
    .sort((left, right) => payeeSort === 'name'
      ? left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
      : new Date(right.created_at || 0) - new Date(left.created_at || 0) || right.id - left.id)
  const scanFailed = Boolean(apiError) && !scanResult
  const failedScanStepIndex = 1
  const scanFailureTitle = /no readable text/i.test(apiError) ? 'Image text was not readable' : /tesseract|ocr/i.test(apiError) ? 'Image reader unavailable' : 'Check could not finish'
  const scanFailureDescription = /no readable text/i.test(apiError) ? 'Try a sharper, well-lit image, or choose Paste details and enter the message yourself.' : /tesseract|ocr/i.test(apiError) ? 'The image reader could not start. Check that Tesseract is installed, then restart the backend.' : /postgresql|database/i.test(apiError) ? 'The database is unavailable. Start PostgreSQL, then choose Try again.' : /timed out|time limit/i.test(apiError) ? 'The server took too long to finish. Choose Try again; if you sent an image, try a smaller crop.' : /backend|failed to fetch|networkerror/i.test(apiError) ? 'VerifyPay cannot reach its backend. Start the backend server in VS Code, then choose Try again.' : 'No result is available yet. Review the message below and try again.'
  const manualDetailsText = Object.entries(manualDetails).filter(([, value]) => value.trim()).map(([key, value]) => `${key}: ${value.trim()}`).join('\n')
  const scanActivityDescription = inputMode === 'upload' ? 'Reading the image text and checking for warning signs.' : inputMode === 'paste' ? 'Reviewing the pasted payment details for warning signs.' : inputMode === 'details' ? 'Reviewing the payment details you entered.' : 'Inspecting the payment link as text only; VerifyPay will not open it.'
  const paymentInputReady = (inputMode === 'upload' && Boolean(selectedFile)) || (inputMode === 'paste' && Boolean(pastedText.trim())) || (inputMode === 'details' && Boolean(manualDetailsText)) || (inputMode === 'url' && Boolean(paymentUrl.trim()))
  const scanAnimationActive = inputReady && scanStep < 3 && (scanPending || !minimumScanTimeDone)
  const paymentInputHint = paymentInputReady ? 'Next: VerifyPay will show each stage while it checks your submission.' : inputMode === 'upload' ? 'Choose a PNG, JPG, or WEBP image above to continue.' : inputMode === 'paste' ? 'Paste the payment message or instructions above to continue.' : inputMode === 'details' ? 'Enter at least one payment detail to continue.' : 'Enter a payment website link above to continue.'
  const now = new Date()
  const welcomeGreeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening'
  const displayUserName = currentUser?.display_name?.trim() || (currentUser?.email || 'Jamie').split('@')[0].split(/[._-]/).filter(Boolean).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
  const userInitials = displayUserName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('') || 'U'
  const todayLabel = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()
  const backendHealthLabel = apiStatus === 'connected' ? 'Online' : apiStatus === 'checking' ? 'Checking' : apiStatus === 'database-offline' ? 'Database offline' : 'Backend offline'
  const highRiskSignalCount = recentChecks.filter(check => check.risk_level === 'high').length
  const scoredRecentChecks = recentChecks.filter(check => check.risk_score !== null && check.risk_score !== undefined && Number.isFinite(Number(check.risk_score)))
  const protectionScore = scoredRecentChecks.length
    ? Math.max(0, Math.min(100, Math.round(100 - scoredRecentChecks.reduce((total, check) => total + Number(check.risk_score), 0) / scoredRecentChecks.length)))
    : null
  const protectionScoreGaugeStyle = { '--score-angle': `${(protectionScore ?? 0) * 3.6}deg` }
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
    setMfaChallengeToken('')
    setMfaCode('')
    setTotpSetupStep('idle')
    setTotpSetupPassword('')
    setTotpSecret('')
    setTotpCode('')
    setTotpRecoveryCodes([])
    setTotpMessage('')
    setAuthEmail('')
    setRecentChecks([])
    setHistoryChecks([])
    setTrustedPayees([])
    setActivityStats({ checks: 0, trusted_payees: 0 })
    setScanResult(null)
    setInputReady(false)
    setScanStep(-1)
    setPastedText('')
    setManualDetails({ recipient: '', identifier: '', amount: '', date: '', reference: '', note: '' })
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
    const timeout = timeoutSignal(30000)
    const signal = options.signal && timeout && typeof AbortSignal.any === 'function' ? AbortSignal.any([options.signal, timeout]) : options.signal ?? timeout
    const response = await fetch(apiUrl(url), {
      ...options,
      signal,
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
    let active = true
    if (!authToken) {
      setLinkedOAuthProviders([])
      return () => { active = false }
    }
    apiFetch('/api/auth/linked-identities')
      .then(async response => {
        if (!response.ok) throw new Error('Could not load connected sign-in methods.')
        const result = await response.json()
        if (active) setLinkedOAuthProviders(Array.isArray(result.providers) ? result.providers : [])
      })
      .catch(() => {
        if (active) setLinkedOAuthProviders([])
      })
    return () => { active = false }
  }, [authToken])

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedHistorySearch(historySearch.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [historySearch])

  React.useEffect(() => {
    const url = new URL(window.location.href)
    const oauthCode = url.searchParams.get('oauth_code')
    const oauthError = url.searchParams.get('oauth_error')
    const oauthLinked = url.searchParams.get('oauth_linked')
    const oauthLinkError = url.searchParams.get('oauth_link_error')
    if (oauthCode || oauthError || oauthLinked || oauthLinkError) {
      url.searchParams.delete('oauth_code')
      url.searchParams.delete('oauth_error')
      url.searchParams.delete('oauth_linked')
      url.searchParams.delete('oauth_link_error')
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
    }
    if (oauthLinked || oauthLinkError) {
      setActiveItem('Settings')
      if (oauthLinked === 'google') {
        setLinkedOAuthProviders(current => current.includes('google') ? current : [...current, 'google'])
        setGoogleLinkMessage('Google is linked to this VerifyPay account.')
        setGoogleLinkMessageIsError(false)
      } else {
        const messages = {
          email_mismatch: 'Choose the Google account that uses the same email address as this VerifyPay account.',
          identity_conflict: 'That Google account is already linked to another VerifyPay account.',
          provider_not_configured: 'Google sign-in is not configured yet.',
        }
        setGoogleLinkMessage(messages[oauthLinkError] || 'Google could not be linked. Please try again.')
        setGoogleLinkMessageIsError(true)
      }
    }
    if (oauthCode || oauthError) {
      if (oauthError) {
        setAuthError(oauthError === 'provider_not_configured'
          ? 'That sign-in provider is not ready yet. Configure its credentials and install the updated backend requirements.'
          : oauthError === 'account_conflict'
            ? 'An account already uses this email. Sign in to it first, then link Google from Settings.'
            : 'Provider sign-in could not be completed. Please try again.')
      } else {
        setAuthBusy(true)
        fetch(apiUrl('/api/auth/oauth/exchange'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: oauthCode }),
        }).then(async response => {
          const result = await response.json().catch(() => ({}))
          if (!response.ok) throw new Error(result.detail || 'Provider sign-in could not be completed. Please try again.')
          if (result.mfa_required && result.challenge_token) {
            setMfaChallengeToken(result.challenge_token)
            setMfaCode('')
            setAuthMode('login')
            setAuthFeedback('Enter the code from your authenticator app, or use a recovery code.')
            setAuthError('')
            return
          }
          window.sessionStorage.setItem('verifypay-token', result.access_token)
          if (result.user?.theme === 'dark' || result.user?.theme === 'light') setTheme(result.user.theme)
          setCurrentUser(result.user)
          setAuthToken(result.access_token)
          setActiveItem('Overview')
          setAuthError('')
        }).catch(error => setAuthError(error.message || 'Provider sign-in could not be completed. Please try again.'))
          .finally(() => setAuthBusy(false))
      }
    }
    const token = url.searchParams.get('reset_token')
    if (token) {
      window.sessionStorage.removeItem('verifypay-token')
      setAuthToken('')
      setAuthResetToken(token)
      setAuthMode('reset')
      setAuthError('')
      setAuthFeedback('')
      url.searchParams.delete('reset_token')
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
    }
    const verificationToken = url.searchParams.get('verify_email_token')
    if (verificationToken) {
      window.sessionStorage.removeItem('verifypay-token')
      setAuthToken('')
      setAuthMode('login')
      setAuthError('')
      setAuthFeedback('Confirming your email…')
      url.searchParams.delete('verify_email_token')
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
      fetch(apiUrl('/api/auth/email-verification/complete'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verificationToken }),
      }).then(async response => {
        const result = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(result.detail || 'This verification link could not be used.')
        if (result.email) setAuthEmail(result.email)
        setAuthFeedback(result.message || 'Email verified. You can now sign in.')
      }).catch(error => {
        setAuthMode('verify')
        setAuthFeedback('')
        setAuthError(error.message || 'This verification link could not be used. Request a new one.')
      })
    }
  }, [])

  React.useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(notificationStorageKey) || '[]')
      setNotifications(Array.isArray(stored) ? stored.filter(item => item && typeof item.id !== 'undefined') : [])
    } catch {
      setNotifications([])
    }
    setNotificationLoadedKey(notificationStorageKey)
  }, [notificationStorageKey])

  React.useEffect(() => {
    if (notificationLoadedKey !== notificationStorageKey) return
    try { window.localStorage.setItem(notificationStorageKey, JSON.stringify(notifications.slice(0, 20))) } catch { /* Notifications remain available until this page closes. */ }
  }, [notificationStorageKey, notificationLoadedKey, notifications])

  React.useEffect(() => {
    if (!notificationOpen) return undefined
    const closeOnEscape = event => { if (event.key === 'Escape') setNotificationOpen(false) }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [notificationOpen])

  React.useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('verifypay-theme', theme)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#07111f' : '#f2f7fb')
  }, [theme])

  React.useEffect(() => () => {
    if (learnTopicHighlightTimerRef.current) window.clearTimeout(learnTopicHighlightTimerRef.current)
  }, [])

  React.useEffect(() => {
    if (!authToken || !currentUser || currentUser.theme === theme) return
    let active = true
    apiFetch('/api/auth/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme, language: currentUser.language || 'en', currency: currentUser.currency || 'INR' }),
    }).then(async response => {
      if (response.ok && active) setCurrentUser(await response.json())
    }).catch(() => {})
    return () => { active = false }
  }, [theme, authToken, currentUser?.id, currentUser?.theme])

  React.useEffect(() => {
    if (!currentUser) {
      setProfileDraft({ display_name: '', phone_number: '' })
      return
    }
    const fallbackName = (currentUser.email || '').split('@')[0].split(/[._-]/).filter(Boolean).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
    setProfileDraft({ display_name: currentUser.display_name || fallbackName, phone_number: currentUser.phone_number || '' })
  }, [currentUser?.id, currentUser?.display_name, currentUser?.phone_number, currentUser?.email])

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
      setScanProgressPercent(0)
      return
    }
    setMinimumScanTimeDone(false)
    setScanProgressPercent(0)
    const progressTimers = [
      window.setTimeout(() => setScanProgressPercent(25), 450),
      window.setTimeout(() => setScanProgressPercent(50), 900),
      window.setTimeout(() => setScanProgressPercent(75), 1500),
      window.setTimeout(() => setMinimumScanTimeDone(true), 2550),
    ]
    return () => progressTimers.forEach(window.clearTimeout)
  }, [inputReady, scanAttempt])

  React.useEffect(() => {
    if (inputReady && minimumScanTimeDone && !scanPending) {
      setScanStep(3)
      if (scanResult) setScanProgressPercent(100)
    }
  }, [inputReady, minimumScanTimeDone, scanPending, scanResult])

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
        if (user.theme === 'dark' || user.theme === 'light') setTheme(user.theme)
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
    { label: 'Learn & Protect', icon: BookOpen },
    { label: 'Emergency Mode', icon: AlertTriangle },
    { label: 'Settings', icon: Settings2 },
  ]
  const searchablePages = [...navigation, { label: 'Profile', icon: UserRound }, { label: 'Settings', icon: Settings2 }]
  const globalSearchResults = globalSearch.trim() ? searchablePages.filter(page => page.label.toLocaleLowerCase().includes(globalSearch.trim().toLocaleLowerCase())).slice(0, 5) : []
  const openSearchPage = page => {
    setActiveItem(page.label)
    setGlobalSearch('')
    setGlobalSearchOpen(false)
  }

  const openVerifier = () => setActiveItem('Verify a payment')
  const jumpToLearnTopic = targetId => {
    const target = document.getElementById(targetId)
    if (!target) return
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightedLearnTopic(targetId)
    if (learnTopicHighlightTimerRef.current) window.clearTimeout(learnTopicHighlightTimerRef.current)
    learnTopicHighlightTimerRef.current = window.setTimeout(() => {
      setHighlightedLearnTopic(current => current === targetId ? '' : current)
      learnTopicHighlightTimerRef.current = null
    }, 1800)
  }
  const changeInputMode = mode => {
    setInputMode(mode)
    setFileError('')
    setUrlError('')
    setApiError('')
  }
  const openVerifierWithMode = mode => {
    changeInputMode(mode)
    setInputReady(false)
    setActiveItem('Verify a payment')
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
    if (authMode === 'reset' && authPassword !== authConfirmPassword) {
      setAuthError('The passwords do not match. Check both fields and try again.')
      return
    }
    if (authMode === 'register' && authPassword !== authConfirmPassword) {
      setAuthError('The passwords do not match. Check both fields and try again.')
      return
    }
    const normalizedEmail = authEmail.trim().toLowerCase()
    if (authMode !== 'reset' && !(authMode === 'login' && mfaChallengeToken) && !normalizedEmail) {
      setAuthError('Enter your email address to continue.')
      return
    }
    authRequestInFlightRef.current = true
    setAuthError('')
    setAuthFeedback('')
    setAuthBusy(true)
    setAuthEmail(normalizedEmail)
    try {
      if (authMode === 'login' && mfaChallengeToken) {
        const response = await fetch(apiUrl('/api/auth/mfa/complete'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ challenge_token: mfaChallengeToken, code: mfaCode.trim() }),
        })
        const result = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(result.detail || 'Two-factor verification failed. Check the code and try again.')
        window.sessionStorage.setItem('verifypay-token', result.access_token)
        if (result.user?.theme === 'dark' || result.user?.theme === 'light') setTheme(result.user.theme)
        setCurrentUser(result.user)
        setAuthToken(result.access_token)
        setMfaChallengeToken('')
        setMfaCode('')
        setActiveItem('Overview')
        setAuthPassword('')
        setAuthError('')
        setAuthFeedback('')
        return
      }
      if (authMode === 'forgot') {
        const response = await fetch(apiUrl('/api/auth/password-reset'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: normalizedEmail }),
        })
        const result = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(result.detail || 'Could not request a reset link. Try again.')
        setAuthFeedback('If an account matches that email, a reset link will be sent.')
        return
      }
      if (authMode === 'verify') {
        const response = await fetch(apiUrl('/api/auth/email-verification/request'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: normalizedEmail }),
        })
        const result = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(result.detail || 'Could not request a verification email. Try again.')
        setAuthFeedback(result.message || 'If this account needs verification, an email will be sent.')
        return
      }
      if (authMode === 'reset') {
        const response = await fetch(apiUrl('/api/auth/password-reset/complete'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: authResetToken, new_password: authPassword }),
        })
        const result = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(result.detail || 'Could not reset your password. Request a new link and try again.')
        setAuthMode('login')
        setAuthResetToken('')
        setAuthPassword('')
        setAuthConfirmPassword('')
        setAuthFeedback('Your password has been reset. Sign in with your new password.')
        return
      }
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
        if (authMode === 'login' && response.status === 403 && detail === 'Please verify your email before signing in.') {
          setAuthMode('verify')
          setAuthFeedback(detail)
          return
        }
        throw new Error(typeof detail === 'string' && detail ? detail : 'We could not complete sign-in. Check your details and try again.')
      }
      if (authMode === 'login' && result.mfa_required && result.challenge_token) {
        setMfaChallengeToken(result.challenge_token)
        setMfaCode('')
        setAuthPassword('')
        setAuthFeedback('Enter the code from your authenticator app, or use a recovery code.')
        return
      }
      if (authMode === 'register') {
        setAuthMode('verify')
        setAuthPassword('')
        setAuthConfirmPassword('')
        if (result.email_sent === false) {
          setAuthError(result.message || 'Your account was created, but the email could not be sent. Use resend to try again.')
        } else {
          setAuthFeedback(result.message || 'Your account was created. Check your inbox for a verification link.')
        }
        return
      }
      window.sessionStorage.setItem('verifypay-token', result.access_token)
      if (result.user?.theme === 'dark' || result.user?.theme === 'light') setTheme(result.user.theme)
      setCurrentUser(result.user)
      setAuthToken(result.access_token)
      setActiveItem('Overview')
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
  const startProviderSignIn = provider => {
    setAuthError('')
    setAuthFeedback('')
    setAuthBusy(true)
    window.location.assign(apiUrl(`/api/auth/oauth/${provider}`))
  }
  const startGoogleAccountLink = async () => {
    setGoogleLinkBusy(true)
    setGoogleLinkMessage('')
    setGoogleLinkMessageIsError(false)
    try {
      const response = await apiFetch('/api/auth/oauth/google/link', { method: 'POST' })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result.authorization_url) {
        throw new Error(result.detail || 'Could not start Google linking. Please try again.')
      }
      window.location.assign(result.authorization_url)
    } catch (error) {
      setGoogleLinkMessage(error.message || 'Could not start Google linking. Please try again.')
      setGoogleLinkMessageIsError(true)
      setGoogleLinkBusy(false)
    }
  }
  const markNotificationsRead = () => setNotifications(current => current.map(item => ({ ...item, read: true })))

  const signOut = async () => {
    try { await apiFetch('/api/auth/session', { method: 'DELETE' }) } catch {}
    window.sessionStorage.removeItem('verifypay-token')
    setSignOutConfirming(false)
    setAuthToken('')
    setAuthMode('login')
    setActiveItem('Overview')
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
  const startTotpSetup = async event => {
    event.preventDefault()
    setTotpMessage('')
    setTotpMessageIsError(false)
    setTotpBusy(true)
    try {
      const response = await apiFetch('/api/auth/totp/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current_password: totpSetupPassword }) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.detail || 'Could not start authenticator setup.')
      setTotpSecret(result.secret || '')
      setTotpCode('')
      setTotpSetupStep('setup')
      setTotpMessage('')
    } catch (error) {
      setTotpMessage(error.message || 'Could not start authenticator setup.')
      setTotpMessageIsError(true)
    } finally {
      setTotpBusy(false)
    }
  }
  const enableTotp = async event => {
    event.preventDefault()
    setTotpMessage('')
    setTotpMessageIsError(false)
    setTotpBusy(true)
    try {
      const response = await apiFetch('/api/auth/totp/enable', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: totpCode }) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.detail || 'Could not enable two-factor authentication.')
      setCurrentUser(user => user ? { ...user, totp_enabled: true } : user)
      setTotpRecoveryCodes(result.recovery_codes || [])
      setTotpSetupPassword('')
      setTotpSecret('')
      setTotpCode('')
      setTotpSetupStep('recovery')
      setTotpMessage('Two-factor authentication is enabled.')
    } catch (error) {
      setTotpMessage(error.message || 'Could not enable two-factor authentication.')
      setTotpMessageIsError(true)
    } finally {
      setTotpBusy(false)
    }
  }
  const disableTotp = async event => {
    event.preventDefault()
    setTotpMessage('')
    setTotpMessageIsError(false)
    setTotpBusy(true)
    try {
      const response = await apiFetch('/api/auth/totp/disable', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current_password: totpSetupPassword, code: totpCode }) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.detail || 'Could not turn off two-factor authentication.')
      setCurrentUser(user => user ? { ...user, totp_enabled: false } : user)
      setTotpSetupPassword('')
      setTotpCode('')
      setTotpSetupStep('idle')
      setTotpMessage('Two-factor authentication has been turned off.')
    } catch (error) {
      setTotpMessage(error.message || 'Could not turn off two-factor authentication.')
      setTotpMessageIsError(true)
    } finally {
      setTotpBusy(false)
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
    const abortController = new AbortController()
    scanAbortControllerRef.current = abortController
    try {
      let response
      setScanStep(1)
      if (inputMode === 'upload') {
        const formData = new FormData()
        formData.append('file', selectedFile)
        response = await apiFetch('/api/checks/image', { method: 'POST', body: formData, signal: abortController.signal })
      } else {
        response = await apiFetch('/api/checks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: abortController.signal,
          body: JSON.stringify({ source_type: inputMode === 'url' ? 'url' : 'text', content: inputMode === 'paste' ? pastedText : inputMode === 'details' ? manualDetailsText : normalizedPaymentUrl }),
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
      setNotifications(current => [{ id: result.id, risk_level: result.risk_level, input_label: result.input_label, created_at: result.created_at, read: false }, ...current.filter(item => item.id !== result.id)].slice(0, 20))
      if ((historyRiskFilter === 'all' || historyRiskFilter === result.risk_level) && (historySourceFilter === 'all' || historySourceFilter === result.source_type) && (!debouncedHistorySearch || `${result.input_label} ${result.explanation}`.toLocaleLowerCase().includes(debouncedHistorySearch.toLocaleLowerCase()))) {
        setHistoryChecks(current => [result, ...current.filter(check => check.id !== result.id)])
      }
      setActivityStats(current => ({ ...current, checks: current.checks + 1 }))
    } catch (error) {
      if (error?.name === 'AbortError') return
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
      scanAbortControllerRef.current = null
      setScanPending(false)
    }
  }
  const cancelScan = () => {
    scanAbortControllerRef.current?.abort()
    setApiError('')
    setScanStep(-1)
    setInputReady(false)
  }
  const startAnotherCheck = () => {
    setInputReady(false)
    setScanStep(-1)
    setScanResult(null)
    setApiError('')
    setSelectedFile(null)
    setFileError('')
    setPastedText('')
    setManualDetails({ recipient: '', identifier: '', amount: '', date: '', reference: '', note: '' })
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
  const downloadScanReport = () => {
    if (!scanResult) return
    const createdAt = scanResult.created_at ? new Date(scanResult.created_at).toLocaleString() : new Date().toLocaleString()
    const report = [
      'CyberShield VerifyPay — Preliminary Payment Check',
      `Generated: ${createdAt}`,
      `Signal: ${scanResult.risk_level.toUpperCase()} · ${scanResult.risk_score}/100 (rules-based signal, not a probability)`,
      `Input type: ${scanResult.source_type}`,
      `Amount detected: ${scanResult.detected_amount || 'Not detected'}`,
      `Recipient guess: ${scanResult.recipient_guess || 'Not identified'}`,
      `Trusted-payee text match: ${scanResult.trusted_payee_match || 'None'}`,
      `Link domains: ${scanResult.link_domains?.length ? scanResult.link_domains.join(', ') : scanResult.link_domain || 'None'}`,
      '',
      'Summary',
      scanResult.explanation,
      '',
      'Signals',
      ...(scanResult.findings?.length ? scanResult.findings.map(finding => `• ${finding}`) : ['• No warning patterns identified by these basic rules.']),
      '',
      'Suggested next step',
      scanResult.recommended_action || 'Confirm payment details independently before sending money.',
      '',
      'This is an early rules-based text check. It cannot verify who controls an account or determine whether a payment is legitimate.',
    ].join('\n')
    const file = new Blob([report], { type: 'text/plain;charset=utf-8' })
    const fileUrl = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = fileUrl
    link.download = `cybershield-verifypay-report-${new Date().toISOString().slice(0, 10)}.txt`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(fileUrl), 1000)
    setCopySummaryMessage('Report downloaded as a text file. Submitted message and OCR text were not included.')
    setCopySummaryMessageIsError(false)
  }
  const shareScanSummary = async () => {
    if (!scanResult) return
    const summary = [
      'CyberShield VerifyPay · preliminary payment check',
      `Signal: ${scanResult.risk_level} · ${scanResult.risk_score}/100 (rules-based, not a probability)`,
      scanResult.explanation,
      `Suggested next step: ${scanResult.recommended_action || 'Confirm payment details independently before sending money.'}`,
      'This check cannot confirm whether a payment is safe or fraudulent.',
    ].join('\n')
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: 'VerifyPay payment check', text: summary })
        setCopySummaryMessage('Share sheet opened. Choose who, if anyone, should receive this summary.')
      } else {
        await navigator.clipboard.writeText(summary)
        setCopySummaryMessage('A privacy-safe summary was copied so you can share it yourself.')
      }
      setCopySummaryMessageIsError(false)
    } catch (error) {
      if (error?.name === 'AbortError') return
      setCopySummaryMessage('Could not open sharing. You can copy the result summary instead.')
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
        body: JSON.stringify({ name, payment_identifier: identifier, identifier_type: payeeIdentifierType, category: payeeCategory || 'Personal', notes: payeeNote.trim() || null }),
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
      setPayeeCategory('')
      setPayeeNote('')
      setPayeeMessage(isEditing ? 'Trusted payee updated.' : 'Trusted payee saved to your account.')
    } catch (error) {
      setPayeeMessage(error.message || 'Could not reach the API. Check that the backend and PostgreSQL are running.')
      setPayeeMessageIsError(true)
    } finally {
      setPayeeSaving(false)
    }
  }
  const saveProfile = async event => {
    event.preventDefault()
    setProfileMessage('')
    setProfileMessageIsError(false)
    setProfileSaving(true)
    try {
      const response = await apiFetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: profileDraft.display_name.trim(), phone_number: profileDraft.phone_number.trim() || null }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.detail || 'Could not save your profile.')
      setCurrentUser(result)
      setProfileEditing(false)
      setProfileMessage('Profile details saved to your account.')
    } catch (error) {
      setProfileMessage(error.message || 'Could not save your profile. Check the backend connection and try again.')
      setProfileMessageIsError(true)
    } finally {
      setProfileSaving(false)
    }
  }
  const exportAccountData = async () => {
    setPrivacyBusy(true)
    setPrivacyMessage('')
    setPrivacyMessageIsError(false)
    try {
      const response = await apiFetch('/api/account/export.json')
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.detail || 'Could not download your account data.')
      const fileUrl = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = fileUrl
      link.download = 'verifypay-account-data.json'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(fileUrl), 1000)
      setPrivacyMessage('Your account data download has started.')
    } catch (error) {
      setPrivacyMessage(error.message || 'Could not download your data. Check the backend connection and try again.')
      setPrivacyMessageIsError(true)
    } finally {
      setPrivacyBusy(false)
    }
  }
  const deleteAccount = async event => {
    event.preventDefault()
    setPrivacyBusy(true)
    setPrivacyMessage('')
    setPrivacyMessageIsError(false)
    try {
      const response = await apiFetch('/api/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: deleteAccountPassword }),
      })
      if (!response.ok) {
        const problem = await response.json().catch(() => ({}))
        throw new Error(problem.detail || 'Could not delete this account.')
      }
      window.sessionStorage.removeItem('verifypay-token')
      setAuthToken('')
      setAuthMode('login')
      setDeleteAccountConfirming(false)
      setDeleteAccountPassword('')
      clearAccountData()
    } catch (error) {
      setPrivacyMessage(error.message || 'Could not delete this account. Check the backend connection and try again.')
      setPrivacyMessageIsError(true)
    } finally {
      setPrivacyBusy(false)
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

  if (!authReady) return <div className="auth-loading">Opening your secure workspace…{showIntro && <OpeningAnimation onSkip={finishIntro}/>}</div>
  if (!authToken) return <main className="auth-screen"><section className="auth-showcase"><a className="auth-brand" href="#signin"><span className="auth-brand-mark"><CyberShieldMark/></span><span><strong>Cyber<span>Shield</span></strong><small>TRUSTED TRANSACTIONS</small></span></a><div className="auth-art" aria-hidden="true"><div className="auth-orbit auth-orbit-one"/><div className="auth-orbit auth-orbit-two"/><div className="auth-shield"><CyberShieldMark/></div></div><p className="auth-showcase-kicker">AI-POWERED PAYMENT SAFETY</p><h2>Verify Before<br/><span>You Pay.</span></h2><p className="auth-showcase-copy">Analyze payment requests, detect scam signals and make safer decisions.</p><ul className="auth-feature-list"><li><FileImage size={17}/><span><strong>Scan &amp; Analyze</strong><small>Upload screenshots, invoices or links.</small></span></li><li><ShieldCheck size={17}/><span><strong>Spot warning signals</strong><small>Rule-based patterns for a preliminary risk check.</small></span></li><li><UsersRound size={17}/><span><strong>Stay Protected</strong><small>Compare details with your trusted payees.</small></span></li></ul></section><form className={`auth-card${mfaChallengeToken ? ' is-mfa-challenge' : ''}`} id="signin" onSubmit={submitAuth}>
    {(authMode === 'login' || authMode === 'register') && <div className="auth-mode-tabs" role="tablist" aria-label="Sign-in options"><button type="button" role="tab" aria-selected={authMode === 'login'} className={authMode === 'login' ? 'is-active' : ''} onClick={() => { setAuthMode('login'); setAuthError(''); setAuthFeedback('') }}>Sign In</button><button type="button" role="tab" aria-selected={authMode === 'register'} className={authMode === 'register' ? 'is-active' : ''} onClick={() => { setAuthMode('register'); setAuthError(''); setAuthFeedback('') }}>Create Account</button></div>}
    <span className="auth-logo"><CyberShieldMark/></span><p className="eyebrow">CYBERSHIELD · VERIFYPAY</p>
    <h1>{authMode === 'login' ? 'Welcome back' : authMode === 'register' ? 'Create your account' : authMode === 'forgot' ? 'Reset your password' : authMode === 'reset' ? 'Choose a new password' : 'Verify your email'}</h1>
    <p className="auth-intro">{authMode === 'login' ? 'Sign in to see your saved payment checks and trusted payees.' : authMode === 'register' ? 'Create an account to keep your checks and trusted payees separate.' : authMode === 'forgot' ? 'Enter your account email and we’ll send a reset link if it matches.' : authMode === 'reset' ? 'Choose a new password for your VerifyPay account.' : 'Enter the address you registered with and we’ll send a fresh verification link if needed.'}</p>
    {apiStatus !== 'connected' && apiStatus !== 'checking' && !authError && <p className="auth-error" role="status">{apiStatus === 'database-offline' ? 'PostgreSQL is not responding. Start the PostgreSQL service in Windows, then refresh this page.' : 'VerifyPay cannot reach the backend. In VS Code, start the backend server, then refresh this page.'}</p>}
    {authMode !== 'reset' && <><label className="field-label" htmlFor="account-email">Email</label><input id="account-email" className="payee-input" type="email" autoComplete="email" required={!mfaChallengeToken} maxLength={254} value={authEmail} onChange={event => { setAuthEmail(event.target.value); setAuthError(''); setAuthFeedback('') }} placeholder="you@example.com" disabled={authBusy}/></>}
    {(authMode === 'login' || authMode === 'register') && <><label className="field-label" htmlFor="account-password">Password</label><PasswordInput id="account-password" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} required={!mfaChallengeToken} minLength={10} maxLength={128} value={authPassword} onChange={event => { setAuthPassword(event.target.value); setAuthError('') }} placeholder={authMode === 'register' ? 'At least 10 characters' : 'Your password'} disabled={authBusy}/></>}
    {authMode === 'login' && <div className="auth-login-options"><span className="auth-session-note">Sign-in lasts for this browser session</span><button type="button" onClick={() => { setAuthMode('forgot'); setAuthError(''); setAuthFeedback('') }}>Forgot password?</button></div>}
    {(authMode === 'register' || authMode === 'reset') && <><small className="auth-hint">Use at least 10 characters. Never reuse a password from another account.</small>{authMode === 'reset' && <><label className="field-label" htmlFor="account-password">New password</label><PasswordInput id="account-password" autoComplete="new-password" required minLength={10} maxLength={128} value={authPassword} onChange={event => { setAuthPassword(event.target.value); setAuthError('') }} placeholder="At least 10 characters" disabled={authBusy}/></>}<label className="field-label" htmlFor="account-confirm-password">{authMode === 'reset' ? 'Confirm new password' : 'Confirm password'}</label><PasswordInput id="account-confirm-password" autoComplete="new-password" required minLength={10} maxLength={128} value={authConfirmPassword} onChange={event => { setAuthConfirmPassword(event.target.value); setAuthError('') }} placeholder="Type your password again" disabled={authBusy}/></>}
    {mfaChallengeToken && <><label className="field-label" htmlFor="mfa-code">Authenticator or recovery code</label><input id="mfa-code" className="payee-input" type="text" autoComplete="one-time-code" required maxLength={20} value={mfaCode} onChange={event => { setMfaCode(event.target.value); setAuthError('') }} placeholder="6-digit code or recovery code" disabled={authBusy}/><p className="auth-switch auth-mfa-switch"><button type="button" disabled={authBusy} onClick={() => { setMfaChallengeToken(''); setMfaCode(''); setAuthError(''); setAuthFeedback('') }}>Start over</button></p></>}    {authFeedback && <p className="auth-success" role="status">{authFeedback}</p>}{authError && <p className="auth-error" role="alert">{authError}</p>}
    <button className="primary-button auth-submit" type="submit" disabled={authBusy}>{authBusy ? 'Please wait…' : authMode === 'login' && mfaChallengeToken ? 'Verify and sign in' : authMode === 'login' ? 'Sign in' : authMode === 'register' ? 'Create account' : authMode === 'forgot' ? 'Send reset link' : authMode === 'reset' ? 'Reset password' : 'Resend verification email'} <ArrowUpRight size={16}/></button>
    {authMode === 'login' && <><div className="auth-or-divider"><span>OR CONTINUE WITH</span></div><button className="auth-provider-button" type="button" disabled={authBusy} onClick={() => startProviderSignIn('google')}><GoogleMark/>Continue with Google</button></>}
    {authMode !== 'verify' && <p className="auth-switch">{authMode === 'login' || authMode === 'forgot' || authMode === 'reset' ? 'New to VerifyPay?' : 'Already have an account?'} <button type="button" disabled={authBusy} onClick={() => { setAuthMode(authMode === 'register' ? 'login' : 'register'); setAuthError(''); setAuthFeedback(''); setAuthPassword(''); setAuthConfirmPassword('') }}>{authMode === 'register' ? 'Sign in' : 'Create account'}</button></p>}
    {(authMode === 'forgot' || authMode === 'reset' || authMode === 'verify') && <p className="auth-switch"><button type="button" disabled={authBusy} onClick={() => { setAuthMode('login'); setAuthError(''); setAuthFeedback(''); setAuthPassword(''); setAuthConfirmPassword('') }}>Back to sign in</button></p>}
    <p className="auth-local-note">{authMode === 'reset' ? 'Password reset links expire after 30 minutes and can only be used once.' : authMode === 'verify' ? 'Verification links expire after 30 minutes and can only be used once.' : 'Public learning demo: use a unique password and fake payment examples. Do not enter real payment details or sensitive personal information.'}</p>
  </form>{showIntro && <OpeningAnimation onSkip={finishIntro}/>}</main>

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <a className="brand" href="#overview" onClick={event => { event.preventDefault(); setActiveItem('Overview') }} aria-label="VerifyPay overview">
          <span className="brand-mark"><CyberShieldMark/></span>
          <span className="brand-copy"><strong>Cyber<span>Shield</span></strong><small className="brand-trusted">TRUSTED TRANSACTIONS</small><small className="brand-tagline">Verify Before You Pay.</small></span>
        </a>

        <div className="workspace-switcher" aria-label="Local workspace"><span className="workspace-avatar">{userInitials}</span><span className="workspace-copy"><strong>Local workspace</strong><small>Personal account</small></span></div>

        <p className="nav-caption">NAVIGATION</p>
        <nav className="primary-nav" aria-label="Main navigation">
          {navigation.map(({ label, icon: Icon }) => <button key={label} type="button" aria-current={activeItem === label || label === 'Settings' && ['Settings','Change password'].includes(activeItem) ? 'page' : undefined} className={`nav-item ${activeItem === label || label === 'Settings' && ['Settings','Change password'].includes(activeItem) ? 'is-active' : ''}`} onClick={() => { setShowMoreMenu(false); setActiveItem(label) }}><Icon size={18}/><span>{label === 'Overview' ? 'Home' : label === 'Verify a payment' ? 'Check a Payment' : label === 'Payment history' ? 'Payment History' : label === 'Trusted payees' ? 'Trusted Payees' : label}</span>{label === 'Payment history' && <span className="nav-count">{activityStats.checks}</span>}</button>)}
          <button className="nav-item mobile-more-navitem" type="button" aria-label="More pages" aria-expanded={showMoreMenu} onClick={() => setShowMoreMenu(current => !current)}><MoreHorizontal size={18}/><span>More</span></button>
        </nav>
        {showMoreMenu && <div className="mobile-more-menu" role="menu" aria-label="More pages"><button type="button" role="menuitem" onClick={()=>setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={16}/> : <Moon size={16}/>}Switch to {theme === 'dark' ? 'light' : 'dark'} theme<ArrowUpRight size={13}/></button>{[{label:'Learn & Protect', icon:BookOpen},{label:'Emergency Mode',icon:AlertTriangle},{label:'Profile',icon:UserRound},{label:'Settings',icon:Settings2}].map(({label,icon:Icon})=><button type="button" role="menuitem" key={label} onClick={()=>{setActiveItem(label);setShowMoreMenu(false)}}><Icon size={16}/>{label}<ArrowUpRight size={13}/></button>)}</div>}

        <div className="sidebar-spacer" />
        <button className="sidebar-trust sidebar-help-card" type="button" onClick={() => setActiveItem('Learn & Protect')} aria-label="Open safety guides"><span className="trust-icon"><Headphones size={18}/></span><span className="sidebar-help-copy"><strong>Need Help?</strong><small>Get support and stay safe.</small></span><ChevronRight size={17}/></button>
        <button className="profile-button" type="button" onClick={() => setActiveItem('Profile')} title="Open profile"><span className="profile-avatar">{userInitials}</span><span className="profile-copy"><strong>{currentUser?.email || authEmail || 'Account'}</strong><small>View profile</small></span><ArrowUpRight size={15}/></button>
        <button className="sidebar-theme-toggle" type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}><span>{theme === 'dark' ? <Moon size={16}/> : <Sun size={16}/>}Dark Mode</span><i className={theme === 'dark' ? 'is-on' : ''}/></button>
        <button className="sidebar-signout" type="button" onClick={() => { setActiveItem('Profile'); setSignOutConfirming(true) }}><LogOut size={15}/><span>Sign out</span></button>
      </aside>

      <main className="main-panel" id="overview">
        <header className="topbar"><a className="mobile-brand" href="#overview" onClick={event => { event.preventDefault(); setActiveItem('Overview') }} aria-label="VerifyPay home"><span className="mobile-brand-mark"><CyberShieldMark/></span><span><strong>Cyber<span>Shield</span></strong><em>TRUSTED TRANSACTIONS</em><small>Verify Before You Pay.</small></span></a><div className="breadcrumb"><span>Workspace</span><span className="breadcrumb-slash">/</span><strong>{activeItem === 'Overview' ? 'Dashboard' : activeItem === 'Verify a payment' ? 'Check a Payment' : activeItem}</strong></div><div className="global-search-wrap"><Search size={16}/><input aria-label="Search or open a page" placeholder={activeItem === 'Overview' ? 'Search anything...' : 'Search payments, payees, settings...'} value={globalSearch} onFocus={() => setGlobalSearchOpen(true)} onChange={event => { setGlobalSearch(event.target.value); setGlobalSearchOpen(true) }} onKeyDown={event => { if (event.key === 'Escape') { setGlobalSearchOpen(false); setGlobalSearch('') } else if (event.key === 'Enter' && globalSearchResults[0]) openSearchPage(globalSearchResults[0]) }}/>{globalSearchOpen && globalSearch.trim() && <div className="global-search-results" role="listbox" aria-label="Matching pages">{globalSearchResults.length ? globalSearchResults.map(page => <button key={page.label} type="button" role="option" onMouseDown={event => event.preventDefault()} onClick={() => openSearchPage(page)}><page.icon size={15}/><span>{page.label}</span><ArrowUpRight size={13}/></button>) : <span className="search-no-results">No matching pages</span>}</div>}</div><div className="topbar-actions"><NotificationMenu notifications={notifications} unreadCount={unreadNotificationCount} open={notificationOpen} onToggle={() => setNotificationOpen(current => !current)} onMarkAllRead={markNotificationsRead} onSelect={item => { setNotifications(current => current.map(note => note.id === item.id ? { ...note, read: true } : note)); setNotificationOpen(false); setActiveItem("Payment history") }}/>{(apiStatus === 'offline' || apiStatus === 'database-offline') ? <span className="api-status api-status-offline"><span className="api-status-dot"/>{apiStatus === 'database-offline' ? 'Database offline' : 'Backend offline'}</span> : <span className={`api-status api-status-${apiStatus}`} role="status" aria-live="polite"><span className="api-status-dot"/>{apiStatus === 'checking' ? 'Checking API and database…' : 'API and database online'}</span>}<button className="theme-button" type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>{theme === 'dark' ? <Sun size={17}/> : <Moon size={17}/>}<span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span></button><button className="topbar-profile" type="button" onClick={() => setActiveItem('Profile')} aria-label="Open profile"><span>{userInitials}</span><strong>{displayUserName}</strong><ChevronDown size={14}/></button><button className="mobile-menu-toggle" type="button" aria-label="Open menu" aria-expanded={showMoreMenu} onClick={() => setShowMoreMenu(current => !current)}><Menu size={22}/></button></div></header>

        <div className={`content-wrap${activeItem === 'Overview' ? ' dashboard-content-wrap' : ''}`}>
          {activeItem === 'Learn & Protect' ? <>
            <section className="verify-heading"><p className="eyebrow">LEARN & PROTECT</p><h1>Be aware, be safer</h1><p>Practical ways to pause and check before sending money.</p></section>
            <section className="learn-hero"><div><p className="eyebrow">PAYMENT SAFETY GUIDE</p><h2>Take a moment before you pay.</h2><p>Scammers often create urgency. Verify the recipient and payment details using a channel you already trust.</p><button className="primary-button" type="button" onClick={openVerifier}>Check a payment <ArrowUpRight size={16}/></button></div><span className="learn-hero-mark"><CyberShieldMark/></span></section>
            <section className="learn-topic-grid" aria-label="Safety topics">
              {[['Urgent payment requests','Pause if someone pressures you to act now. Contact them using a number or account you already know.','learn-topic-urgency'],['Payment links and QR codes','Do not open unexpected links or scan unfamiliar QR codes. Verify the destination independently before entering details.','learn-topic-links'],['Impersonation messages','A familiar name or profile picture can be copied. Confirm unusual requests through another trusted channel.','learn-topic-impersonation'],['Payment screenshots','A screenshot is not proof that money arrived. Check your own banking or payment app directly.','learn-topic-screenshots'],['PINs and one-time codes','Never share your payment PIN, password, or one-time code with anyone, including someone claiming to help.','learn-topic-codes'],['Verify the recipient','Check the name and payment identifier in your own payment app before confirming a transfer.','learn-topic-recipient']].map(([title, body, targetId], index) => <article id={targetId} className={`learn-topic${highlightedLearnTopic === targetId ? ' is-highlighted' : ''}`} key={title}><span className={`learn-topic-icon learn-tone-${index % 4}`}><ShieldCheck size={19}/></span><div><h2>{title}</h2><p>{body}</p></div></article>)}
            </section>
            <section className="learn-resources-grid"><article className="learn-resource-panel"><div className="learn-resource-heading"><span><BookOpen size={18}/></span><div><strong>Quick Guides</strong><small>Safety topics covered on this page</small></div><small className="resource-count">3 topics</small></div>{[['Common payment scams to recognize','Learn how urgency and impersonation are used.','01','learn-topic-impersonation'],['How to verify a recipient before paying','Simple checks to make in your payment app.','02','learn-topic-recipient'],['Spotting altered payment screenshots','Why a screenshot is not proof of payment.','03','learn-topic-screenshots']].map(([title, description, number, targetId]) => <button type="button" className="learn-resource-row learn-resource-link" key={title} onClick={() => jumpToLearnTopic(targetId)} aria-label={`Read guide: ${title}`}><span className="learn-resource-thumb">{number}</span><span><strong>{title}</strong><small>{description}</small></span><ArrowUpRight size={15}/></button>)}</article><article className="learn-resource-panel"><div className="learn-resource-heading"><span><Activity size={18}/></span><div><strong>Video Tutorials</strong><small>Coming soon</small></div><small className="resource-count">Planned</small></div>{[['How to check payment details'],['Recognize a suspicious payment request'],['What to do if you sent money by mistake']].map(([title], index) => <article className="learn-resource-row" key={title}><span className={`learn-resource-thumb learn-video-${index}`}>0{index + 1}</span><span><strong>{title}</strong><small>Video walkthrough coming soon</small></span></article>)}</article></section>
            <section className="learn-tip-strip"><h2>Quick Safety Tips</h2>{[['Verify the recipient','Check their name in your payment app.'],['Ignore urgent pressure','Pause and confirm independently.'],['Inspect links carefully','Check the destination before opening a link sent unexpectedly.'],['Check QR codes','Confirm the amount and recipient first.'],['Use official apps','Avoid links sent by strangers.']].map(([title, copy], index) => <article key={title}><span className={`learn-topic-icon learn-tone-${index % 4}`}><ShieldCheck size={17}/></span><strong>{title}</strong><small>{copy}</small></article>)}</section>            <section className="learn-note"><ShieldCheck size={18}/><p><strong>What VerifyPay can do</strong><br/>It checks text and images for limited warning patterns. Results are preliminary and may be wrong. Verify payment details independently.</p></section>
          </> : activeItem === 'Emergency Mode' ? <>
            <section className="verify-heading emergency-heading"><p className="eyebrow">EMERGENCY MODE</p><h1>Act quickly. Stay in control.</h1><p>If you think you were scammed or sent money to the wrong person, take these steps.</p></section>
            <section className="emergency-banner"><AlertTriangle size={32}/><div><h2>Stop and secure your accounts</h2><p>Contact your bank or payment provider using the official app or the number printed on your card.</p></div></section>
            <section className="emergency-grid"><article className="emergency-card"><span>1</span><div><h2>Stop further payments</h2><p>Do not send more money, even if someone promises a refund or says a fee is required.</p></div></article><article className="emergency-card"><span>2</span><div><h2>Contact your bank</h2><p>Use its official app or the number printed on your card. Ask about blocking or disputing the transfer.</p></div></article><article className="emergency-card"><span>3</span><div><h2>Secure your accounts</h2><p>Change affected passwords from the official websites or apps. Never share PINs or one-time codes.</p></div></article><article className="emergency-card"><span>4</span><div><h2>Keep the evidence</h2><p>Save messages, receipts, transaction references, phone numbers, and the time of contact.</p></div></article><article className="emergency-card"><span>5</span><div><h2>Report through official channels</h2><p>Use your bank’s fraud-reporting process and your local government’s official reporting service.</p></div></article></section>
            <section className="emergency-contacts"><h2>Official help channels</h2><p>Contact your bank through its official app. These contacts are published by Indian government or payment-industry sources.</p>{[['National Cyber Crime Helpline','1930','tel:1930'],['Cyber Crime Reporting Portal','cybercrime.gov.in','https://cybercrime.gov.in/'],['Police Emergency','112','tel:112'],['DigiSaathi Digital Payments Helpline','14431 · 1800 891 3333','https://www.digisaathi.info/about']].map(([name, contact, href]) => <div className="emergency-contact-row" key={name}><span><strong>{name}</strong><small>Open the call or official information channel.</small></span><a href={href} target={href.startsWith('https:') ? '_blank' : undefined} rel={href.startsWith('https:') ? 'noopener noreferrer' : undefined}>{contact}</a></div>)}</section>            <section className="emergency-actions"><h2>Review a suspicious message or link</h2><p>VerifyPay can check text for limited warning patterns. It cannot contact your bank or submit a police report.</p><button className="primary-button emergency-action-button" type="button" onClick={() => openVerifierWithMode('paste')}>Check a message <ArrowUpRight size={16}/></button><button className="text-button" type="button" onClick={() => setActiveItem('Learn & Protect')}>Open safety guide</button></section>
          </> : activeItem === 'Change password' ? <>
            <section className="verify-heading"><p className="eyebrow">ACCOUNT SECURITY</p><h1>{passwordStep === 'success' ? 'Password updated' : 'Change password'}</h1><p>{passwordStep === 'current' ? 'Step 1 of 2 · Confirm your current password to continue.' : passwordStep === 'new' ? 'Step 2 of 2 · Choose and confirm your new password.' : 'Your account password was changed successfully.'}</p></section>
            <section className="settings-layout password-flow">{passwordStep === 'current' ? <form className="settings-card password-form" onSubmit={verifyCurrentPassword}><h2>Confirm it’s you</h2><p>Enter the password you currently use to sign in.</p><label className="field-label" htmlFor="current-password">Current password</label><PasswordInput id="current-password" autoComplete="current-password" required minLength={10} maxLength={128} disabled={passwordBusy} value={currentPassword} onChange={event => { setCurrentPassword(event.target.value); setPasswordMessage(''); setPasswordMessageIsError(false) }} placeholder="Your current password"/><div className="verify-card-footer"><button className="text-button" type="button" disabled={passwordBusy} onClick={() => { setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword(''); setPasswordMessage(''); setActiveItem('Settings') }}>Cancel</button><button className="primary-button" type="submit" disabled={passwordBusy}>{passwordBusy ? 'Checking…' : 'Continue'} <ArrowUpRight size={16}/></button></div>{passwordMessage && <p className="password-message" role={passwordMessageIsError ? 'alert' : 'status'}>{passwordMessage}</p>}</form> : passwordStep === 'new' ? <form className="settings-card password-form" onSubmit={updatePassword}><h2>Choose a new password</h2><p>Your current password was confirmed. Use at least 10 characters.</p><label className="field-label" htmlFor="new-password">New password</label><PasswordInput id="new-password" autoComplete="new-password" required minLength={10} maxLength={128} disabled={passwordBusy} value={newPassword} onChange={event => { setNewPassword(event.target.value); setPasswordMessage(''); setPasswordMessageIsError(false) }} placeholder="At least 10 characters"/><label className="field-label" htmlFor="confirm-new-password">Confirm new password</label><PasswordInput id="confirm-new-password" autoComplete="new-password" required minLength={10} maxLength={128} disabled={passwordBusy} value={confirmNewPassword} onChange={event => { setConfirmNewPassword(event.target.value); setPasswordMessage(''); setPasswordMessageIsError(false) }} placeholder="Type the new password again"/>{confirmNewPassword && <small className={`password-match-note ${passwordConfirmationValid ? 'is-valid' : 'is-invalid'}`} role="status">{passwordConfirmationValid ? 'Passwords match.' : newPassword.length < 10 ? 'Use at least 10 characters in your new password.' : 'These passwords do not match yet.'}</small>}<div className="verify-card-footer"><button className="text-button" type="button" disabled={passwordBusy} onClick={() => { setPasswordMessage(''); setPasswordStep('current') }}>Back</button><button className="primary-button" type="submit" disabled={passwordBusy || !passwordConfirmationValid}>{passwordBusy ? 'Updating…' : 'Change password'} {!passwordBusy && <ShieldCheck size={16}/>}</button></div>{passwordMessage && <p className="password-message" role={passwordMessageIsError ? 'alert' : 'status'}>{passwordMessage}</p>}</form> : <article className="settings-card password-form password-success"><div className="settings-account-icon"><ShieldCheck size={21}/></div><h2>Password changed</h2><p role="status">Password changed. You are still signed in on this device; other sessions were signed out.</p><div className="verify-card-footer"><button className="text-button" type="button" onClick={() => setActiveItem('Settings')}>Back to settings</button><button className="primary-button" type="button" onClick={() => setActiveItem('Profile')}>Go to profile <ArrowUpRight size={16}/></button></div></article>}</section>
          </> : activeItem === 'Profile' ? <><section className="profile-page"><header className="profile-page-heading"><div><p className="eyebrow">ACCOUNT</p><h1>My Profile</h1><p>Manage your personal information, security and preferences.</p></div><button className="primary-button" type="button" onClick={() => { setProfileEditing(current => !current); setProfileMessage("") }}><Pencil size={15}/> {profileEditing ? "Cancel edit" : "Edit Profile"}</button></header>
            <section className="profile-overview"><div className="profile-overview-identity"><span className="profile-large-avatar">{userInitials}</span><div><h2>{displayUserName}</h2><p>{currentUser?.email || 'jamie@example.com'}</p><span className="profile-account-badge"><ShieldCheck size={13}/> Account</span></div></div><div className="profile-overview-motto"><span>“</span><p>Stay alert, stay safe.<br/>Verify before you pay.</p><button type="button" onClick={() => setActiveItem('Learn & Protect')}>Learn how to stay safe</button></div><div className="profile-completion"><div><strong>Account Details</strong><b>{currentUser?.display_name ? 'Profile saved' : 'Add your name'}</b></div><span className="profile-completion-track"><i style={{width: currentUser?.display_name ? '100%' : '50%'}}/></span><small>Email address added<br/>{currentUser?.phone_number ? 'Phone number added' : 'Phone number optional'}</small></div></section>
            <section className="profile-stat-strip"><article><span className="metric-icon blue"><Activity size={17}/></span><div><strong>{activityStats.checks}</strong><small>Total Checks</small></div></article><article><span className="metric-icon green"><ShieldCheck size={17}/></span><div><strong>{recentChecks.filter(check => check.risk_level === 'low').length}</strong><small>Low-Risk Signals · latest</small></div></article><article><span className="metric-icon violet"><AlertTriangle size={17}/></span><div><strong>{recentChecks.filter(check => check.risk_level === 'high').length}</strong><small>High-Risk Signals · latest</small></div></article><article><span className="metric-icon blue"><UsersRound size={17}/></span><div><strong>{activityStats.trusted_payees}</strong><small>Trusted Payees</small></div></article></section>
            <section className="profile-panels"><article className="profile-panel"><header><div><span><UserRound size={17}/></span><div><h2>Personal Information</h2><small>Profile details</small></div></div><button type="button" className="text-button" onClick={() => { setProfileEditing(current => !current); setProfileMessage("") }}>{profileEditing ? "Cancel" : "Edit"}</button></header>{profileEditing ? <form className="profile-edit-form" onSubmit={saveProfile}><label>Full name<input className="payee-input" autoComplete="name" maxLength={120} required value={profileDraft.display_name} onChange={event => setProfileDraft(current => ({ ...current, display_name: event.target.value }))}/></label><label>Email address<input className="payee-input" type="email" value={currentUser?.email || ""} readOnly/></label><label>Phone number <small>(optional)</small><input className="payee-input" type="tel" autoComplete="tel" maxLength={40} value={profileDraft.phone_number} onChange={event => setProfileDraft(current => ({ ...current, phone_number: event.target.value }))} placeholder="Add a phone number"/></label><div><button className="primary-button" type="submit" disabled={profileSaving}>{profileSaving ? "Saving…" : "Save profile"}</button></div></form> : <dl className="profile-information"><div><dt>Full Name</dt><dd>{displayUserName}</dd></div><div><dt>Email Address</dt><dd>{currentUser?.email || "Not added"}</dd></div><div><dt>Phone Number</dt><dd>{currentUser?.phone_number || "Optional · not added"}</dd></div><div><dt>Date of Birth</dt><dd>Not collected</dd></div><div><dt>Location</dt><dd>Not collected</dd></div><div><dt>Preferred Language</dt><dd>English</dd></div><div><dt>Account Type</dt><dd>Free Plan</dd></div></dl>}{profileMessage && <p className="profile-save-message" role={profileMessageIsError ? "alert" : "status"}>{profileMessage}</p>}</article><article className="profile-panel"><header><div><span><ShieldCheck size={17}/></span><div><h2>Security Settings</h2><small>Manage account security</small></div></div></header><div className="profile-security-row"><span><ShieldCheck size={16}/></span><div><strong>Change Password</strong><small>Update your account password</small></div><button className="text-button" type="button" onClick={() => setActiveItem('Settings')}>Open</button></div><div className="profile-security-row"><span><ShieldCheck size={16}/></span><div><strong>Two-Factor Authentication</strong><small>{currentUser?.totp_enabled ? 'Enabled with an authenticator app' : 'Authenticator app not set up'}</small></div><button className="text-button" type="button" onClick={() => setActiveItem('Settings')}>{currentUser?.totp_enabled ? 'Manage' : 'Set up'}</button></div><div className="profile-security-row"><span><Activity size={16}/></span><div><strong>Biometric Login</strong><small>Not available in this version</small></div><b className="coming-soon-badge">Unavailable</b></div><div className="profile-security-row"><span><Settings2 size={16}/></span><div><strong>Manage Devices</strong><small>Device management is not available yet</small></div></div></article><article className="profile-panel"><header><div><span><Clock3 size={17}/></span><div><h2>Recent Activity</h2><small>Your latest payment checks</small></div></div><button className="text-button" type="button" onClick={() => setActiveItem('Payment history')}>View All <ArrowUpRight size={13}/></button></header>{recentChecks.length ? recentChecks.slice(0,3).map(check => <div className="profile-security-row" key={check.id}><span><FileCheck2 size={16}/></span><div><strong>{check.input_label}</strong><small>{new Date(check.created_at).toLocaleString()}</small></div><b className={`risk-pill risk-${check.risk_level}`}>{check.risk_level}</b></div>) : <div className="profile-empty-activity">No payment checks yet.</div>}</article><article className="profile-panel"><header><div><span><Settings2 size={17}/></span><div><h2>Preferences</h2><small>Customize your experience</small></div></div><button type="button" className="text-button" onClick={() => setActiveItem('Settings')}>Edit</button></header><div className="profile-security-row"><span>{theme === 'dark' ? <Moon size={16}/> : <Sun size={16}/>}</span><div><strong>Theme</strong><small>{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</small></div><button className="text-button" type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>Change</button></div><div className="profile-security-row"><span><Activity size={16}/></span><div><strong>Language</strong><small>English · preference preview</small></div></div><div className="profile-security-row"><span><Activity size={16}/></span><div><strong>Currency</strong><small>Not available in this version</small></div></div><div className="profile-signout-row">{signOutConfirming ? <><span>Sign out of this browser session?</span><div className="profile-confirm-actions"><button className="text-button" type="button" onClick={() => setSignOutConfirming(false)}>Cancel</button><button className="signout-button" type="button" onClick={signOut}><LogOut size={16}/>Yes, sign out</button></div></> : <><span>Finished using VerifyPay?</span><button className="signout-button" type="button" onClick={() => setSignOutConfirming(true)}><LogOut size={16}/>Sign out</button></>}</div></article></section></section></> : activeItem === 'Settings' ? <>
            <section className="verify-heading"><p className="eyebrow">ACCOUNT PREFERENCES</p><h1>Settings</h1><p>Manage your VerifyPay account.</p></section>
            <section className="settings-layout"><article className="settings-card"><div className="settings-account-icon"><UserRound size={21}/></div><p className="eyebrow">ACCOUNT SETTINGS</p><h2>{currentUser?.email || 'Account'}</h2><p>Manage the account currently signed in to VerifyPay.</p><div className="settings-inline-status"><span>Account status</span><strong><i/> Signed in</strong></div><small className="settings-footnote">Your checks and trusted payees are stored under this account.</small></article><article className="settings-card"><div className="settings-account-icon"><ShieldCheck size={20}/></div><p className="eyebrow">SECURITY SETTINGS</p><h2>Password and sign-in</h2><p>Change your password after confirming the current one.</p><button className="primary-button" type="button" onClick={() => { setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword(''); setPasswordMessage(''); setPasswordMessageIsError(false); setPasswordStep('current'); setActiveItem('Change password') }}>Change password <ArrowUpRight size={16}/></button><TOTPSettingsControls enabled={Boolean(currentUser?.totp_enabled)} step={totpSetupStep} setStep={next => { setTotpSetupStep(next); setTotpMessage(''); setTotpCode(''); setTotpSetupPassword(''); if (next === 'idle') { setTotpSecret(''); setTotpRecoveryCodes([]) } }} password={totpSetupPassword} setPassword={setTotpSetupPassword} secret={totpSecret} code={totpCode} setCode={setTotpCode} recoveryCodes={totpRecoveryCodes} setRecoveryCodes={setTotpRecoveryCodes} message={totpMessage} messageIsError={totpMessageIsError} busy={totpBusy} onStart={startTotpSetup} onEnable={enableTotp} onDisable={disableTotp}/></article><article className="settings-card"><div className="settings-account-icon"><Link2 size={20}/></div><p className="eyebrow">CONNECTED SIGN-IN</p><h2>Google account</h2><p>Link the Google account that uses this VerifyPay email so you can sign in either way.</p>{linkedOAuthProviders.includes('google') ? <div className="settings-inline-status"><span>Status</span><strong><i/> Connected</strong></div> : <small className="settings-footnote">Confirm with Google to link the same email address.</small>}<button className="primary-button" type="button" onClick={startGoogleAccountLink} disabled={googleLinkBusy || linkedOAuthProviders.includes('google')}>{googleLinkBusy ? 'Connecting…' : linkedOAuthProviders.includes('google') ? 'Google connected' : 'Link Google account'} {!linkedOAuthProviders.includes('google') && <ArrowUpRight size={16}/>}</button>{googleLinkMessage && <p className="profile-save-message" role={googleLinkMessageIsError ? 'alert' : 'status'}>{googleLinkMessage}</p>}</article><article className="settings-card"><div className="settings-account-icon">{theme === 'dark' ? <Moon size={20}/> : <Sun size={20}/>}</div><p className="eyebrow">APP PREFERENCES</p><h2>{theme === 'dark' ? 'Dark theme' : 'Light theme'}</h2><p>Your theme is saved to your account when signed in, and in this browser otherwise.</p><button className="theme-button settings-theme-button" type="button" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={17}/> : <Moon size={17}/>}<span>Switch to {theme === 'dark' ? 'light' : 'dark'} theme</span></button><div className="settings-unavailable"><Settings2 size={15}/><span><strong>Language and currency</strong><small>Not available in this version</small></span></div></article><article className="settings-card"><div className="settings-account-icon"><Bell size={20}/></div><p className="eyebrow">NOTIFICATIONS</p><h2>Notification preferences</h2><p>Recent payment checks appear in the notification bell. These in-app alerts are saved in this browser.</p><div className="settings-unavailable"><Bell size={15}/><span><strong>Payment check alerts</strong><small>Available in the notification bell</small></span></div></article><article className="settings-card"><div className="settings-account-icon"><UsersRound size={20}/></div><p className="eyebrow">PRIVACY</p><h2>Your account data</h2><p>Review the data VerifyPay keeps for this account.</p><button className="text-button settings-help-link" type="button" onClick={() => setActiveItem('Profile')}>Open Profile <ArrowUpRight size={15}/></button><div className="privacy-actions"><button className="history-export" type="button" onClick={exportAccountData} disabled={privacyBusy}>Download my data</button><button className="signout-button" type="button" onClick={() => { setDeleteAccountConfirming(true); setPrivacyMessage('') }} disabled={privacyBusy}>Delete account</button></div>{deleteAccountConfirming && <form className="profile-edit-form" onSubmit={deleteAccount}><p>This permanently removes your account, saved checks and trusted payees. Enter your current password to confirm.</p><label>Current password<PasswordInput autoComplete="current-password" required minLength={10} maxLength={128} value={deleteAccountPassword} onChange={event => setDeleteAccountPassword(event.target.value)} placeholder="Your current password" disabled={privacyBusy}/></label><div><button className="text-button" type="button" disabled={privacyBusy} onClick={() => { setDeleteAccountConfirming(false); setDeleteAccountPassword('') }}>Cancel</button><button className="signout-button" type="submit" disabled={privacyBusy}>{privacyBusy ? 'Deleting…' : 'Confirm permanent deletion'}</button></div></form>}{privacyMessage && <p className="profile-save-message" role={privacyMessageIsError ? 'alert' : 'status'}>{privacyMessage}</p>}</article><article className="settings-card"><div className="settings-account-icon"><HelpCircle size={20}/></div><p className="eyebrow">ABOUT</p><h2>CyberShield VerifyPay</h2><p>Verify before you pay.</p><div className="settings-inline-status"><span>Version</span><strong>1.0.0</strong></div><small className="settings-footnote">Privacy/terms pages and the complete third-party license list need to be provided before public launch.</small></article></section>
          </> : activeItem === 'Trusted payees' ? <>
            <section className="trusted-payees-page">
              <header className="trusted-page-heading"><div><p className="eyebrow">RECIPIENT SAFETY</p><h1>Trusted Payees</h1><p>Manage your saved recipients and review payment details before sending money.</p></div><button className="primary-button" type="button" onClick={() => { payeeNameInputRef.current?.scrollIntoView({behavior:'smooth',block:'center'}); payeeNameInputRef.current?.focus() }}><Plus size={16}/> Add Payee</button></header>
              <section className="trusted-payee-stats" aria-label="Trusted payee summary"><article><span className="metric-icon blue"><UsersRound size={19}/></span><div><small>Total Trusted Payees</small><strong>{trustedPayees.length}</strong></div></article><article><span className="metric-icon green"><CheckCircle2 size={19}/></span><div><small>Saved Identifiers</small><strong>{trustedPayees.filter(payee => payee.payment_identifier).length}</strong></div></article><article><span className="metric-icon violet"><Clock4 size={19}/></span><div><small>Needs Your Review</small><strong>{trustedPayees.length}</strong></div></article><article><span className="metric-icon blue"><Plus size={19}/></span><div><small>Added This Month</small><strong>{trustedPayees.filter(payee => payee.created_at && new Date(payee.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length}</strong></div></article></section>
              <section className="trusted-payees-layout">
                <section className="trusted-payee-list-panel"><header className="trusted-payee-panel-heading"><div><span><UsersRound size={18}/></span><div><h2>Your Trusted Payees</h2><small>Saved recipients and their details</small></div></div><strong>{filteredPayees.length !== trustedPayees.length ? `${filteredPayees.length} / ${trustedPayees.length}` : trustedPayees.length}</strong></header><div className="trusted-payee-filters"><label className="trusted-search"><Search size={16}/><input id="payee-search-input" aria-label="Search payees" type="search" value={payeeSearch} onChange={event => setPayeeSearch(event.target.value)} placeholder="Search payees..."/><button type="button" disabled={!payeeSearch} onClick={() => setPayeeSearch('')} aria-label="Clear search"><X size={14}/></button></label><select aria-label="Filter saved payees" value={payeeTypeFilter} onChange={event => setPayeeTypeFilter(event.target.value)}><option value="all">All Types</option><option value="UPI ID">UPI ID</option><option value="Bank Account">Bank Account</option><option value="Contact">Contact</option></select><select aria-label="Sort saved payees" value={payeeSort} onChange={event => setPayeeSort(event.target.value)}><option value="recent">Sort by: Recent</option><option value="name">Sort by: Name</option></select></div>
                  {trustedPayees.length ? filteredPayees.length ? <div className="trusted-payee-rows">{filteredPayees.map((payee,index) => <article className="trusted-payee-row" key={payee.id}><span className={`trusted-payee-avatar trusted-avatar-${index % 4}`}>{payee.name.slice(0,1).toUpperCase()}</span><div className="trusted-payee-identity"><strong>{payee.name}</strong><small>{payee.payment_identifier} · {payee.identifier_type || 'Contact'}</small></div><span className="trusted-payee-category">{payee.category || "Personal"}</span><span className="trusted-payee-status"><CheckCircle2 size={12}/> In your list</span><small className="trusted-payee-added">{`${payee.notes ? `${payee.notes} · ` : ""}${payee.created_at ? `Added ${new Date(payee.created_at).toLocaleDateString()}` : "Saved to account"}`}</small><div className="payee-row-actions"><button className="edit-payee" type="button" disabled={payeeSaving || deletingPayeeId === payee.id} onClick={() => { setEditingPayeeId(payee.id); setPayeeName(payee.name); setPayeeIdentifier(payee.payment_identifier); setPayeeIdentifierType(payee.identifier_type || 'Contact'); setPayeeCategory(payee.category || 'Personal'); setPayeeNote(payee.notes || ''); setPayeeMessage(''); setPayeeMessageIsError(false); window.requestAnimationFrame(() => { payeeNameInputRef.current?.scrollIntoView({behavior:'smooth',block:'center'}); payeeNameInputRef.current?.focus() }) }} aria-label={`Edit ${payee.name}`} title="Edit payee"><Pencil size={14}/></button><button className="remove-payee" type="button" onClick={() => setConfirmDeletePayeeId(payee.id)} disabled={payeeSaving || deletingPayeeId === payee.id} aria-label={`Remove ${payee.name}`} title="Remove payee"><Trash2 size={14}/></button></div>{confirmDeletePayeeId === payee.id && <div className="payee-delete-confirm" role="group" aria-label={`Confirm removing ${payee.name}`}><span>Remove <strong>{payee.name}</strong>? Its payment history will stay saved.</span><div><button className="text-button" type="button" disabled={deletingPayeeId === payee.id} onClick={() => setConfirmDeletePayeeId(null)}>Cancel</button><button className="confirm-delete-button" type="button" disabled={deletingPayeeId === payee.id} onClick={() => removePayee(payee)}>{deletingPayeeId === payee.id ? 'Removing…' : 'Remove'}</button></div></div>}</article>)}</div> : <div className="payee-empty"><UsersRound size={23}/><strong>No payees match those filters</strong><span>Try another type, search, or sort option.</span><button className="text-button" type="button" onClick={() => { setPayeeSearch(''); setPayeeTypeFilter('all'); setPayeeSort('recent') }}>Clear filters</button></div> : <div className="payee-empty"><UsersRound size={23}/><strong>No trusted payees yet</strong><span>Add a person or business to start your list.</span></div>}
                </section>
                <div className="trusted-payee-tools"><form className="trusted-payee-form" onSubmit={savePayee}><header><span><FileCheck2 size={18}/></span><div><h2>{editingPayeeId === null ? 'Add a New Trusted Payee' : 'Edit Trusted Payee'}</h2><small>Save a recipient for quick reference</small></div></header><div className="payee-type-tabs" role="group" aria-label="Payment identifier type">{['UPI ID','Bank Account','Contact'].map(type=><button type="button" key={type} aria-pressed={payeeIdentifierType === type} className={payeeIdentifierType === type ? 'is-selected' : ''} onClick={()=>setPayeeIdentifierType(type)}>{type}</button>)}</div><label className="trusted-form-label" htmlFor="payee-name">Recipient Name</label><input ref={payeeNameInputRef} id="payee-name" className="payee-input" value={payeeName} onChange={event => {setPayeeName(event.target.value);setPayeeMessage('');setPayeeMessageIsError(false)}} required maxLength={120} placeholder="e.g. ACME Supplies"/><label className="trusted-form-label" htmlFor="payee-identifier">{payeeIdentifierType}</label><input id="payee-identifier" className="payee-input" autoCapitalize="none" spellCheck="false" value={payeeIdentifier} onChange={event => {setPayeeIdentifier(event.target.value);setPayeeMessage('');setPayeeMessageIsError(false)}} required maxLength={240} placeholder={payeeIdentifierType === 'UPI ID' ? 'e.g. name@bank' : payeeIdentifierType === 'Bank Account' ? 'Enter account number or bank details' : 'Enter phone number or email'}/><label className="trusted-form-label" htmlFor="payee-category">Category</label><select id="payee-category" className="payee-input" value={payeeCategory} onChange={event=>setPayeeCategory(event.target.value)}><option value="">Select category</option><option>Business</option><option>Personal</option><option>Bills</option></select><label className="trusted-form-label" htmlFor="payee-notes">Notes <small>(Optional)</small></label><input id="payee-notes" className="payee-input" value={payeeNote} onChange={event=>setPayeeNote(event.target.value)} maxLength={160} placeholder="e.g. monthly payment or invoice"/><div className="trusted-form-actions">{editingPayeeId !== null && <button className="text-button" type="button" disabled={payeeSaving} onClick={()=>{setEditingPayeeId(null);setPayeeName('');setPayeeIdentifier('');setPayeeIdentifierType('UPI ID');setPayeeCategory('');setPayeeNote('');setPayeeMessage('');setPayeeMessageIsError(false)}}>Cancel</button>}<button className="primary-button" type="submit" disabled={payeeSaving}>{payeeSaving ? 'Saving…' : editingPayeeId === null ? 'Add to Trusted Payees' : 'Update Payee'} <ArrowUpRight size={15}/></button></div>{payeeMessage && <p className="input-next-note" role={payeeMessageIsError ? 'alert' : 'status'}>{payeeMessage}</p>}<small className="trusted-payee-privacy"><ShieldCheck size={13}/> Only saved under your account. Verify identity independently.</small></form>
                  <form className="trusted-quick-verify" onSubmit={event=>{event.preventDefault();setPayeeSearch(payeeVerifyQuery.trim())}}><header><span><ShieldCheck size={17}/></span><div><h2>Verify Existing Payee</h2><small>Check if a recipient is in your saved list</small></div></header><div className="trusted-quick-row"><input aria-label="Enter payee identifier" className="payee-input" value={payeeVerifyQuery} onChange={event=>setPayeeVerifyQuery(event.target.value)} placeholder="Enter saved payee identifier"/><button type="submit" aria-label="Search saved payees" disabled={!payeeVerifyQuery.trim()}><Search size={16}/></button></div>{payeeVerifyQuery.trim() && <p className="trusted-quick-result" role="status">{trustedPayees.some(payee=>payee.payment_identifier.toLocaleLowerCase()===payeeVerifyQuery.trim().toLocaleLowerCase()) ? 'This identifier is in your saved list. Confirm ownership independently.' : 'No exact match in your saved list.'}</p>}</form>
                </div>
              </section><section className="trusted-payee-benefits"><article><span className="metric-icon blue"><ShieldCheck size={20}/></span><div><strong>Your list, under your account</strong><small>Saved payees are separated by account.</small></div></article><article><span className="metric-icon violet"><Activity size={20}/></span><div><strong>Quick reference</strong><small>Compare payment details before you pay.</small></div></article><article><span className="metric-icon green"><CircleHelp size={20}/></span><div><strong>Keep checking independently</strong><small>A saved entry does not confirm account ownership.</small></div></article></section>
            </section>
                      </> : activeItem === 'Payment history' ? <>
            <section className="verify-heading"><p className="eyebrow">SAVED ACTIVITY</p><h1>Payment history</h1><p>Your saved checks for this account. Open a result to review its score and explanation.</p></section>
            <section className="history-stats" aria-label="Payment history summary"><article><span className="metric-icon blue"><FileCheck2 size={18}/></span><strong>{activityStats.checks}</strong><small>Total Checks</small></article><article><span className="metric-icon green"><ShieldCheck size={18}/></span><strong>{historyChecks.filter(check => check.risk_level === 'low').length}</strong><small>Low Risk · loaded</small></article><article><span className="metric-icon violet"><Activity size={18}/></span><strong>{historyChecks.filter(check => check.risk_level === 'medium').length}</strong><small>Medium Risk · loaded</small></article><article><span className="metric-icon"><AlertTriangle size={18}/></span><strong>{historyChecks.filter(check => check.risk_level === 'high').length}</strong><small>High Risk · loaded</small></article></section>            <div className="history-filters"><label>Risk level<select disabled={historyRefreshing} value={historyRiskFilter} onChange={event => setHistoryRiskFilter(event.target.value)}><option value="all">All levels</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label><label>Check type<select disabled={historyRefreshing} value={historySourceFilter} onChange={event => setHistorySourceFilter(event.target.value)}><option value="all">All types</option><option value="file">Image upload</option><option value="text">Pasted details</option><option value="url">Payment link</option></select></label><label className="history-search-label">Search saved checks<input type="search" maxLength={120} value={historySearch} onChange={event => setHistorySearch(event.target.value)} placeholder="Search labels or explanations" aria-label="Search saved payment checks by label or explanation"/></label></div>
            <section className="history-list" aria-busy={historyRefreshing}>{historyRefreshing && <p className="history-refresh-note" role="status">Refreshing saved checks…</p>}{activityStats.checks > 0 && <div className="history-export-row"><button className="history-export" type="button" disabled={historyExporting || historyRefreshing || historySearchPending} onClick={exportHistory}><Download size={15}/>{historyExporting ? 'Preparing download…' : historyRiskFilter !== 'all' || historySourceFilter !== 'all' || debouncedHistorySearch ? 'Download filtered CSV' : 'Download all as CSV'}</button><button className="history-export" type="button" disabled={historyRefreshing || historySearchPending} onClick={() => window.print()}><FileCheck2 size={15}/>Print / save as PDF</button></div>}{historyChecks.length ? historyChecks.map(check => <details className="history-detail" key={check.id}><summary className="history-row"><span className="metric-icon violet"><Clock3 size={17}/></span><span><strong>{check.input_label}</strong><small>Saved {new Date(check.created_at).toLocaleString()}</small></span><span className={`risk-pill risk-${check.risk_level}`}>PRELIMINARY · {check.risk_level.toUpperCase()}</span><span className="history-score">{check.risk_score}/100</span></summary><div className="history-explanation"><strong>Why this signal was assigned</strong><p>{check.explanation}</p><small>Rules-based signal, not a percentage chance of fraud. It does not verify account ownership or confirm whether a payment is safe.</small>{confirmDeleteCheckId === check.id ? <div className="inline-delete-confirm" role="group" aria-label="Confirm deleting this saved check"><span>Delete this check? This cannot be undone.</span><button className="text-button" type="button" disabled={deletingCheckId === check.id} onClick={() => setConfirmDeleteCheckId(null)}>Cancel</button><button className="confirm-delete-button" type="button" disabled={deletingCheckId === check.id} onClick={() => deleteCheck(check)}>{deletingCheckId === check.id ? 'Deleting…' : 'Delete'}</button></div> : <button className="delete-history-entry" type="button" onClick={() => setConfirmDeleteCheckId(check.id)}><Trash2 size={14}/>Delete this check</button>}</div></details>) : <div className="payee-empty"><FileCheck2 size={23}/><strong>{activityStats.checks > 0 ? 'No checks match these filters' : 'No checks saved yet'}</strong><span>{activityStats.checks > 0 ? 'Try changing or clearing the filters above.' : 'Run your first payment check to get started.'}</span>{activityStats.checks > 0 ? <button type="button" className="text-button" onClick={() => { setHistoryRiskFilter('all'); setHistorySourceFilter('all'); setHistorySearch('') }}>Clear filters</button> : <button type="button" className="text-button" onClick={openVerifier}>Check a payment</button>}</div>}{historyError && <div className="history-error" role="alert"><p>{historyError}</p><button className="text-button" type="button" onClick={() => setActivityRefreshKey(current => current + 1)}>Try again</button></div>}{hasMoreChecks && <button className="text-button history-load-more" type="button" disabled={historyLoading || historyRefreshing || historySearchPending} onClick={loadMoreChecks}>{historyLoading ? 'Loading…' : historySearchPending ? 'Applying search…' : 'Load more checks'}</button>}</section>
          </> : activeItem === 'Verify a payment' ? <>
            <section className="verify-heading"><button className="back-link" type="button" onClick={() => { setActiveItem(scanStep >= 2 ? 'Payment history' : 'Overview'); if (scanStep >= 2) setInputReady(false) }}>← {scanStep >= 2 ? 'Back to payment history' : 'Back to overview'}</button><p className="eyebrow">PAYMENT SAFETY CHECK</p><h1>{inputReady && scanStep >= 2 ? 'Payment Verification Report' : inputReady ? 'Analyzing your payment' : 'Check a Payment'}</h1><p>{inputReady && scanStep >= 2 ? 'Analysis complete. Review the preliminary signals and suggested next steps.' : inputReady ? 'Please wait while VerifyPay reviews your submission.' : 'Upload an image, paste a message, enter details, or inspect a link. Raw payment text is not saved to your account.'}</p></section>
            {!inputReady ? <><section className="verify-card">
              <div className="input-tabs" role="group" aria-label="Choose payment input type">
                <button type="button" aria-pressed={inputMode === 'upload'} className={inputMode === 'upload' ? 'is-selected' : ''} onClick={() => changeInputMode('upload')}><Upload size={16}/> Upload File</button>
                <button type="button" aria-pressed={inputMode === 'paste'} className={inputMode === 'paste' ? 'is-selected' : ''} onClick={() => changeInputMode('paste')}><FileCheck2 size={16}/> Paste Message</button>
                <button type="button" aria-pressed={inputMode === 'details'} className={inputMode === 'details' ? 'is-selected' : ''} onClick={() => changeInputMode('details')}><ShieldCheck size={16}/> Enter Details</button>
                <button type="button" aria-pressed={inputMode === 'url'} className={inputMode === 'url' ? 'is-selected' : ''} onClick={() => changeInputMode('url')}><Link2 size={16}/> Scan URL</button>
              </div>
              {inputMode === 'upload' && <div className="input-panel">
                {!selectedFile ? <label className={`dropzone${fileDragActive ? ' is-dragging' : ''}`} onDragOver={event => event.preventDefault()} onDragEnter={event => { event.preventDefault(); setFileDragActive(true) }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFileDragActive(false) }} onDrop={event => { event.preventDefault(); setFileDragActive(false); chooseFile(event.dataTransfer.files?.[0]) }}><input type="file" aria-label="Upload payment screenshot or receipt" accept="image/png,image/jpeg,image/webp" onChange={event => chooseFile(event.target.files?.[0] ?? null)}/><span className="upload-icon"><Upload size={21}/></span><strong>{fileDragActive ? 'Release to add this image' : 'Drag & drop your file here'}</strong><span>or <em>click to browse</em></span><small>Supports: JPG, PNG, WEBP (Max 10 MB)</small></label> : <div className="file-selected">{filePreviewUrl ? <img className="file-thumbnail" src={filePreviewUrl} alt="Selected payment screenshot preview"/> : <span className="upload-icon"><FileImage size={20}/></span>}<span><strong title={selectedFile.name}>{selectedFile.name}</strong><small>{selectedFile.type ? selectedFile.type.replace('image/', '').toUpperCase() : selectedFile.name.split('.').pop().toUpperCase()} · {(selectedFile.size / 1024 / 1024).toFixed(2)} MB · Preview stays here until you continue</small></span><button type="button" aria-label="Remove selected file" onClick={clearFile}><X size={17}/></button></div>}{fileError && <p className="file-error" role="alert">{fileError}</p>}
              </div>}
              {inputMode === 'paste' && <div className="input-panel"><label className="field-label" htmlFor="payment-details">Paste the message or payment instructions</label><textarea id="payment-details" className="payment-textarea" maxLength={12000} aria-describedby="payment-details-guidance" onKeyDown={event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); if (paymentInputReady) startScanPreview() } }} value={pastedText} onChange={event => setPastedText(event.target.value)} placeholder={'Paste the payment request here…\n\nFor example: recipient, amount, account or wallet details, and any message you received.'}/><div className="field-hint-row"><div id="payment-details-guidance" className="field-hint">Include any details you have. You can remove personal information first. Maximum 12,000 characters. Press Ctrl+Enter (or Cmd+Enter) to continue.</div>{pastedText && <button className="clear-pasted-button" type="button" onClick={() => setPastedText('')}>Clear text</button>}<span className="field-counter">{pastedText.length.toLocaleString()} / 12,000</span></div>{pastedLinkCount > 0 && <p className="link-input-note" role="status">{pastedLinkCount} link{pastedLinkCount === 1 ? '' : 's'} found. VerifyPay checks link text only and will not open them.</p>}</div>}
              {inputMode === 'details' && <div className="input-panel"><div className="manual-details-grid">{[['recipient','Recipient or business'],['identifier','Payment identifier'],['amount','Amount'],['date','Date or time'],['reference','Reference number'],['note','Message or note']].map(([key, label]) => <label className="manual-detail-field" key={key}><span>{label}</span><input className="payee-input" maxLength={key === 'note' ? 500 : 160} value={manualDetails[key]} onChange={event => setManualDetails(current => ({ ...current, [key]: event.target.value }))} placeholder={key === 'amount' ? 'e.g. 1,250.00' : key === 'identifier' ? 'e.g. name@bank' : `Enter ${label.toLowerCase()}`}/></label>)}</div><p className="field-hint">Enter only details you are comfortable reviewing. Raw text is not saved to payment history.</p></div>}
              {inputMode === 'url' && <div className="input-panel"><label className="field-label" htmlFor="payment-url">Paste the payment page link</label><div className="url-input-row"><div className="url-field"><Link2 size={17}/><input id="payment-url" type="text" inputMode="url" autoCapitalize="none" spellCheck="false" maxLength={2048} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); if (paymentInputReady) startScanPreview() } }} value={paymentUrl} onChange={event => { setPaymentUrl(event.target.value); setUrlError('') }} placeholder="https://example.com/payment" aria-invalid={Boolean(urlError)} aria-describedby="payment-url-hint"/></div>{paymentUrl && <button className="clear-url-button" type="button" onClick={() => { setPaymentUrl(''); setUrlError('') }}>Clear</button>}</div><div id="payment-url-hint" className="field-hint">You can enter a domain with or without https://. We inspect link text only and never open it. Up to 2,048 characters. Press Enter to continue.</div>{paymentUrlHost && <p className="url-preview-note" role="status">Parsed domain: <strong>{paymentUrlHost}</strong> · This is a text-only check, not a reputation lookup.</p>}{urlError && <p className="file-error" role="alert">{urlError}</p>}</div>}
              <div className="verify-card-footer"><span><ShieldCheck size={15}/> Submitted for a preliminary check; only the summary is saved</span><button className="primary-button" type="button" aria-describedby="payment-input-next-guidance" disabled={!paymentInputReady} onClick={startScanPreview}>Continue <ArrowUpRight size={16}/></button></div>
              <div id="payment-input-next-guidance" className="input-next-note" role="status">{paymentInputHint}</div>
            </section><section className="verify-benefits"><article><span><ShieldCheck size={20}/></span><div><strong>Your data is secure</strong><small>Payment message text is not saved.</small></div></article><article><span><FileImage size={20}/></span><div><strong>Supports common image files</strong><small>JPG, PNG or WEBP · up to 10 MB.</small></div></article><article><span><Activity size={20}/></span><div><strong>Rule-based analysis</strong><small>Highlights patterns; it cannot confirm fraud.</small></div></article></section></> : <section className="scan-card">
              <div className="scan-card-top"><p className="eyebrow">PAYMENT SAFETY CHECK</p><h2>{scanFailed ? scanFailureTitle : scanPending ? 'Analyzing Your Payment' : scanStep >= 2 ? 'Payment check complete' : 'Preparing your check'}</h2><p className="scan-description">{scanFailed ? scanFailureDescription : scanPending ? 'Please wait while VerifyPay reviews the information and checks for warning signs.' : scanStep >= 2 ? 'Review the preliminary result and its recommendations below.' : scanActivityDescription}</p>{scanPending && <button className="scan-cancel-button" type="button" onClick={cancelScan}><X size={14}/> Cancel Analysis</button>}</div>
              <div className={`scan-progress-meta${scanFailed ? ' is-error' : ''}`}><span>{scanFailed ? 'CHECK INCOMPLETE' : scanStep === 2 ? 'RESULT RECEIVED' : scanStep < 3 ? scanPending ? inputMode === 'upload' ? 'READING IMAGE · PLEASE WAIT' : inputMode === 'url' ? 'INSPECTING LINK · PLEASE WAIT' : 'CHECKING DETAILS · PLEASE WAIT' : 'CHECKING' : 'CHECK COMPLETE'}</span><strong>{scanProgressPercent}%</strong></div>
              <div className={`scan-progress-track${scanFailed ? ' is-error' : ''}`} role="progressbar" aria-label="Payment check progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={scanProgressPercent} aria-valuetext={`${scanProgressPercent}% ${scanFailed ? 'check incomplete' : scanStep === 2 ? 'result received' : scanStep < 3 ? 'checking' : 'check complete'}`}><span style={{ width: `${scanProgressPercent}%` }}/></div>
              <span className="sr-only" role="status" aria-live="polite">{scanFailed ? `${scanFailureTitle}. ${scanFailureDescription}` : scanStep === 2 ? 'Your preliminary result is ready.' : scanStep === 3 ? 'Payment check complete.' : 'Payment check in progress.'}</span>
              <div className={`scan-preview-panel${scanAnimationActive ? ' is-scanning' : ''}`} aria-label="Submitted payment preview">
                <div className="scan-preview-grid"/>
                {inputMode === 'upload' && filePreviewUrl ? <img src={filePreviewUrl} alt="Payment image being checked"/> : <div className="scan-receipt"><span className="scan-receipt-brand">{inputMode === 'upload' ? 'VERIFY PAY' : inputMode === 'url' ? 'PAYMENT LINK' : 'PAYMENT DETAILS'}</span><i/><strong>{inputMode === 'upload' ? selectedFile?.name || 'Image submitted' : inputMode === 'url' ? paymentUrlHost || 'Link submitted' : (inputMode === 'paste' ? pastedText : manualDetailsText).slice(0, 76) || 'Payment information submitted'}</strong><small>{inputMode === 'upload' ? 'Image received for text extraction' : inputMode === 'url' ? 'Link text only · not opened' : 'Private preview · not saved'}</small>{inputMode === 'details' && manualDetails.amount && <b>{manualDetails.amount}</b>}</div>}
                <CyberShieldMark className={`scan-preview-shield${scanAnimationActive ? ' is-scanning' : ''}`}/><span className="scan-preview-frame"/><span className="scan-preview-line"/>
              </div>
              <div className="scan-progress-heading"><strong>Analysis Progress</strong><span>{scanFailed ? 'Check needs attention' : scanStep >= 2 ? 'Complete' : 'In progress'}</span></div>
              <div className="scan-steps" role="list" aria-label="Payment check stages">
                {[
                  { title: 'File Received', detail: inputMode === 'upload' ? 'Image uploaded successfully.' : 'Payment information received.' }, { title: inputMode === 'upload' ? 'Extracting Text (OCR)' : 'Preparing Payment Details', detail: inputMode === 'upload' ? 'Reading text from the submitted image.' : 'Organizing the submitted information.' }, { title: 'Analyzing Payment Details', detail: 'Checking the details for common warning patterns.' }, { title: 'Checking for Risk Indicators', detail: 'Reviewing any available signals and matches.' }, { title: 'Generating Report', detail: 'Preparing your preliminary result.' } ].map((step, index) => { const failed = scanFailed && index === failedScanStepIndex; const done = !scanFailed && (scanStep >= 2 || (scanPending && index === 0)) || (scanFailed && index === 0 && scanStep >= 1); const current = !scanFailed && scanPending && index === 2; return <div className={`scan-step${done ? ' is-done' : ''}${current ? ' is-current' : ''}${failed ? ' is-error' : ''}`} key={step.title} role="listitem" aria-current={current ? 'step' : undefined}><span className="scan-step-icon">{failed ? <span>!</span> : done ? <span>✓</span> : current ? <i/> : null}</span><span><strong>{step.title}</strong><small>{step.detail}</small></span><span className="scan-step-state">{failed ? 'FAILED' : done ? 'DONE' : current ? `${scanProgressPercent}%` : scanStep >= 2 ? 'READY' : 'PENDING'}</span></div> })}
              </div>
              <div className="scan-live-panels"><article className="scan-live-details"><header><FileCheck2 size={16}/><strong>Extracted Details (Live)</strong></header>{[['Recipient', scanResult?.recipient_guess || manualDetails.recipient || 'Reading payment details…'], ['Payment ID', scanResult?.trusted_payee_match || manualDetails.identifier || 'Not detected yet'], ['Amount', scanResult?.detected_amount || manualDetails.amount || 'Not detected yet'], ['Date & time', manualDetails.date || 'Not detected yet']].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</article><article className="scan-live-analysis"><header><Activity size={16}/><strong>Live Analysis Preview</strong></header>{['Checking submitted information', 'Reviewing amount and recipient', 'Looking for warning patterns', 'Preparing a preliminary report'].map((item, index) => <div key={item} className={scanStep >= 2 || index < (scanPending ? 1 : 0) ? 'is-done' : index === 1 && scanPending ? 'is-current' : ''}><span>{scanStep >= 2 || index < (scanPending ? 1 : 0) ? '✓' : index === 1 && scanPending ? '◌' : '○'}</span>{item}</div>)}</article></div>
              <div className="scan-time-tip"><span><strong>Estimated time</strong><small>{scanPending ? 'Usually just a few seconds' : scanFailed ? 'Please review the message above' : 'Preliminary review complete'}</small><i><b style={{width:`${scanProgressPercent}%`}}/></i></span><span><CyberShieldMark/><small>VerifyPay checks patterns. Always confirm payment details independently.</small></span></div>
              {scanStep >= 2 && (scanResult ? <div className="sample-result"><div className="sample-result-heading"><span className={`risk-pill risk-${scanResult.risk_level}`}>PRELIMINARY · {scanResult.risk_level.toUpperCase()}</span><strong>Signal score {scanResult.risk_score}/100</strong></div><div className={`risk-meter risk-${scanResult.risk_level}`} role="img" aria-label={`Risk signal score ${scanResult.risk_score} out of 100`}><span style={{ width: `${scanResult.risk_score}%` }}/></div><div className="risk-scale-labels"><span>Low · 0–34</span><span>Medium · 35–69</span><span>High · 70–100</span></div><p>{scanResult.explanation}</p><p className="match-caveat">This score is a rules-based signal, not a percentage chance of fraud.</p>{scanResult.findings?.length > 0 && <div className="finding-list"><strong>Signals that affected this score</strong><ul>{scanResult.findings.map((finding, index) => <li key={`${index}-${finding}`}>{finding}</li>)}</ul></div>}<div className="recommended-action"><strong>Suggested next step</strong><p>{scanResult.recommended_action || 'Confirm payment details independently before sending money.'}</p></div><div className="report-actions"><button className="text-button copy-summary-button" type="button" onClick={copyScanSummary}>Copy result summary</button><button className="history-export" type="button" onClick={downloadScanReport}><Download size={14}/>Download Report</button><button className="history-export" type="button" onClick={shareScanSummary}>Share summary</button></div>{copySummaryMessage && <p className="copy-summary-message" role={copySummaryMessageIsError ? 'alert' : 'status'}>{copySummaryMessage}</p>}<div className="detected-details"><div><span>Amount detected</span><strong>{scanResult.detected_amount || 'Not detected'}</strong></div><div><span>Recipient guess</span><strong>{scanResult.recipient_guess || 'Not identified'}</strong></div><div><span>Trusted-list text match</span><strong>{scanResult.trusted_payee_match ? `${scanResult.trusted_payee_match} mentioned` : 'No match found in text'}</strong></div>{(scanResult.link_domains?.length > 0 || scanResult.link_domain) && <div><span>{scanResult.link_domains?.length > 1 ? 'Link domains checked' : 'Link domain'}</span><strong>{scanResult.link_domains?.length ? scanResult.link_domains.join(', ') : scanResult.link_domain}</strong></div>}</div>{scanResult.trusted_payee_match && <p className="match-caveat">A text match only means the name or identifier appeared in the message. It does not verify who owns the account.</p>}{(scanResult.link_domains?.length > 0 || scanResult.link_domain) && <p className="match-caveat">Detected links were inspected as text only; VerifyPay does not open or visit them.</p>}{scanResult.ocr_text_preview && <details className="ocr-preview"><summary>View text read from image</summary><pre>{scanResult.ocr_text_preview}</pre></details>}<small>These rules can miss scams or flag ordinary messages. Check the payee independently before sending money.</small></div> : <div className="preview-notice"><AlertTriangle size={17}/><span><strong>{apiError ? 'Check could not finish' : 'Waiting for your result'}</strong><small>{apiError || 'The API is preparing the check result.'}</small></span>{apiError && <button className="text-button" type="button" onClick={startScanPreview}>Try again</button>}</div>)}
              <div className="scan-footer"><span><span className="secure-dot"/> Raw text is not saved in the database</span>{scanStep === 3 && <div className="scan-actions"><button type="button" className="text-button" onClick={() => setInputReady(false)}>Back to input</button>{scanResult && <button type="button" className="text-button" onClick={startAnotherCheck}>Check another payment</button>}</div>}</div>
            </section>}
          </> : <>
                    <div className="mobile-dashboard">
                      <header className="mobile-greeting"><h1>{welcomeGreeting}, {displayUserName.split(' ')[0]}! <span aria-hidden="true">👋</span></h1><p>Payments are safer together.</p></header>
                      <section className="mobile-dashboard-stats" aria-label="Payment activity summary">
                        <article className="mobile-stat-card"><span className="mobile-stat-icon blue"><FileCheck2 size={21}/></span><div><strong>{activityStats.checks}</strong><small>Payments Checked</small></div></article>
                        <article className="mobile-stat-card"><span className="mobile-stat-icon red"><AlertTriangle size={21}/></span><div><strong>{recentChecks.filter(check => check.risk_level === 'high').length}</strong><small>High Risk</small></div></article>
                        <article className="mobile-stat-card"><span className="mobile-stat-icon green"><UsersRound size={21}/></span><div><strong>{activityStats.trusted_payees}</strong><small>Trusted Payees</small></div></article>
                        <article className="mobile-stat-card"><span className="mobile-stat-icon cyan"><ShieldCheck size={21}/></span><div><strong>—</strong><small>Incidents tracked</small></div></article>
                      </section>

                      <section className="mobile-check-card" aria-label="Check a payment">
                        <button className="mobile-check-heading" type="button" onClick={openVerifier}><span className="mobile-check-symbol"><ScanLine size={27}/></span><span><strong>Check a Payment</strong><small>Upload, paste, enter details or scan a link.</small></span><ChevronRight size={21}/></button>
                        <div className="mobile-check-tabs" role="group" aria-label="Payment input type">
                          <button type="button" aria-pressed={inputMode === 'upload'} className={inputMode === 'upload' ? 'is-selected' : ''} onClick={() => changeInputMode('upload')}><FileImage size={15}/>File</button>
                          <button type="button" aria-pressed={inputMode === 'paste'} className={inputMode === 'paste' ? 'is-selected' : ''} onClick={() => changeInputMode('paste')}><MessageSquare size={15}/>Message</button>
                          <button type="button" aria-pressed={inputMode === 'details'} className={inputMode === 'details' ? 'is-selected' : ''} onClick={() => changeInputMode('details')}><FileCheck2 size={15}/>Details</button>
                          <button type="button" aria-pressed={inputMode === 'url'} className={inputMode === 'url' ? 'is-selected' : ''} onClick={() => changeInputMode('url')}><ScanLine size={15}/>Link</button>
                        </div>
                        {inputMode === 'upload' ? <label className={`mobile-upload-zone${fileDragActive ? ' is-dragging' : ''}`} onDragOver={event => event.preventDefault()} onDragEnter={event => { event.preventDefault(); setFileDragActive(true) }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFileDragActive(false) }} onDrop={event => { event.preventDefault(); setFileDragActive(false); chooseFile(event.dataTransfer.files?.[0]) }}><input type="file" aria-label="Upload a payment image" accept="image/png,image/jpeg,image/webp" onChange={event => chooseFile(event.target.files?.[0] ?? null)}/><Upload size={34}/><strong>{selectedFile ? selectedFile.name : 'Tap to upload file'}</strong><span>{selectedFile ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB · ready to analyze` : 'or choose a file'}</span><small>JPG, PNG, WEBP (Max 10 MB)</small></label> : inputMode === 'paste' ? <div className="mobile-check-input"><textarea aria-label="Paste a payment message" value={pastedText} onChange={event => setPastedText(event.target.value)} maxLength={12000} placeholder="Paste a payment message..."/><small>Remove personal details before checking.</small></div> : inputMode === 'details' ? <div className="mobile-detail-inputs"><input aria-label="Recipient or business" value={manualDetails.recipient} onChange={event => setManualDetails(current => ({ ...current, recipient: event.target.value }))} placeholder="Recipient or business"/><input aria-label="Amount" value={manualDetails.amount} onChange={event => setManualDetails(current => ({ ...current, amount: event.target.value }))} placeholder="Amount"/></div> : <div className="mobile-check-input"><input type="url" inputMode="url" aria-label="Payment link" value={paymentUrl} onChange={event => { setPaymentUrl(event.target.value); setUrlError('') }} placeholder="Paste a payment link"/><small>VerifyPay checks the link as text only; it will not open it.</small></div>}
                        {fileError && inputMode === 'upload' && <p className="mobile-input-error" role="alert">{fileError}</p>}{urlError && inputMode === 'url' && <p className="mobile-input-error" role="alert">{urlError}</p>}
                        <button className="mobile-start-analysis" type="button" disabled={!paymentInputReady || scanPending} onClick={() => { setActiveItem('Verify a payment'); startScanPreview() }}><ShieldCheck size={17}/>Start Analysis<ArrowUpRight size={18}/></button>
                      </section>

                      <section className="mobile-protection-card">
                        <button className="mobile-section-heading" type="button" onClick={() => setActiveItem('Payment history')} aria-label="Review recent payment checks"><span><ShieldCheck size={19}/><strong>CyberShield Safety Score</strong></span><ArrowUpRight size={17}/></button>
                        <div className="mobile-protection-content"><div className="mobile-score-wrap"><div className="mobile-safety-donut" style={protectionScoreGaugeStyle} role="img" aria-label={protectionScore === null ? 'Protection Score unavailable: no recent checks' : `Protection Score ${protectionScore} out of 100, based on the latest checks`}><div><strong>{protectionScore === null ? '—' : `${protectionScore}/100`}</strong><span>Score</span></div></div><small className="mobile-score-caption">{protectionScore === null ? 'No recent checks' : 'Recent checks'}</small></div><ul><li><Check size={17}/>Account signed in</li><li><Check size={17}/>{activityStats.trusted_payees} trusted payees saved</li><li>{apiStatus === 'connected' ? <Check size={17}/> : <AlertTriangle size={17}/>}{backendHealthLabel}</li><li>{highRiskSignalCount ? <AlertTriangle size={17}/> : <Check size={17}/>}{highRiskSignalCount ? `${highRiskSignalCount} high-risk signal${highRiskSignalCount === 1 ? '' : 's'} in latest checks` : 'No high-risk signals in latest checks'}</li></ul></div>
                      </section>

                      <section className="mobile-recent-activity">
                        <header className="mobile-section-heading"><span><ShieldCheck size={19}/><strong>Recent Activity</strong></span><button type="button" onClick={() => setActiveItem('Payment history')}>See All <ArrowUpRight size={15}/></button></header>
                        {recentChecks.length ? recentChecks.slice(0, 3).map((check, index) => { const elapsed = Math.max(0, Date.now() - new Date(check.created_at).getTime()); const age = elapsed < 3600000 ? `${Math.max(1, Math.floor(elapsed / 60000))}m ago` : elapsed < 86400000 ? `${Math.floor(elapsed / 3600000)}h ago` : `${Math.floor(elapsed / 86400000)}d ago`; return <button className="mobile-activity-row" type="button" key={check.id} onClick={() => setActiveItem('Payment history')}><span className={`mobile-activity-icon ${check.risk_level === 'high' ? 'is-high' : check.risk_level === 'medium' ? 'is-medium' : ''}`}>{check.source_type === 'url' ? <Link2 size={18}/> : check.source_type === 'text' ? <MessageSquare size={18}/> : <FileImage size={18}/>}</span><span className="mobile-activity-copy"><strong>{check.input_label || 'Payment check'}</strong><small>{check.recipient_guess || check.explanation || 'Preliminary payment check'}</small></span><span className={`mobile-activity-risk risk-${check.risk_level}`}>{check.risk_level}</span><time>{age}</time></button> }) : <p className="mobile-activity-empty">Your recent payment checks will appear here.</p>}
                      </section>
                    </div>
                    <section className="dashboard-reference-hero">
            <article className="dashboard-reference-welcome"><div className="dashboard-reference-copy"><p className="eyebrow">PAYMENT SAFETY · {todayLabel}</p><h1>Welcome to <span>CyberShield</span></h1><h2>Verify Before You Pay.</h2><p>Analyze messages, screenshots, invoices and links to detect scam signals, verify payment details and stay safe.</p><div className="dashboard-hero-actions"><button className="primary-button" type="button" onClick={openVerifier}>Check a Payment <ArrowUpRight size={16}/></button><button className="secondary-button" type="button" onClick={() => setActiveItem('Learn & Protect')}><CircleHelp size={16}/> Learn How It Works</button></div></div><div className="dashboard-shield-art" aria-hidden="true"><span className="dashboard-shield-orbit orbit-a"/><span className="dashboard-shield-orbit orbit-b"/><span className="dashboard-shield-glow"/><CyberShieldMark className="dashboard-large-shield"/></div></article>
            <aside className="dashboard-protection-status"><header><h2>CyberShield Safety Score</h2><span title="Calculated from recent rules-based payment checks. This is not a fraud probability or guarantee."><CircleHelp size={14}/></span><button type="button" className="text-button" onClick={() => setActiveItem('Payment history')}>Review checks <ArrowUpRight size={13}/></button></header><div className="dashboard-protection-content"><div className="dashboard-safety-donut" style={protectionScoreGaugeStyle} role="img" aria-label={protectionScore === null ? 'Protection Score unavailable: no recent checks' : `Protection Score ${protectionScore} out of 100, based on the latest checks`}><div><strong>{protectionScore === null ? '—' : `${protectionScore}/100`}</strong><span>Protection Score</span><small>{protectionScore === null ? 'No recent checks' : 'Based on recent checks'}</small></div></div><div className="dashboard-protection-metrics"><div><span className="metric-icon blue"><FileCheck2 size={16}/></span><p><strong>{activityStats.checks}</strong><small>Payments Checked</small></p></div><div><span className="metric-icon red"><AlertTriangle size={16}/></span><p><strong>{highRiskSignalCount}</strong><small>High-risk signals*</small></p></div><div><span className="metric-icon green"><UsersRound size={16}/></span><p><strong>{activityStats.trusted_payees}</strong><small>Trusted Payees Saved</small></p></div><div><span className="metric-icon cyan"><ShieldCheck size={16}/></span><p><strong>—</strong><small>Incidents not tracked</small></p></div></div></div><small className="dashboard-score-note">Score = 100 minus the average rules-based risk signal from your latest checks (up to 10). It is not a fraud probability or a guarantee. High-risk signals are preliminary.</small></aside>
          </section>
          <section className="dashboard-feature-links" aria-label="Main actions"><button type="button" onClick={openVerifier}><span className="quick-action-icon quick-blue"><FileImage size={20}/></span><span><strong>Analyze Payment</strong><small>Upload screenshot, invoice, paste a message or check a URL.</small></span><i><ArrowUpRight size={16}/></i></button><button type="button" onClick={() => setActiveItem('Trusted payees')}><span className="quick-action-icon quick-green"><UsersRound size={20}/></span><span><strong>Manage Trusted Payees</strong><small>Save and manage your regular recipients.</small></span><i><ArrowUpRight size={16}/></i></button><button type="button" onClick={() => setActiveItem('Payment history')}><span className="quick-action-icon quick-cyan"><Clock3 size={20}/></span><span><strong>View History</strong><small>Check past analysis and reports.</small></span><i><ArrowUpRight size={16}/></i></button><button type="button" onClick={() => setActiveItem('Learn & Protect')}><span className="quick-action-icon quick-violet"><BookOpen size={20}/></span><span><strong>Learn & Protect</strong><small>Try scam examples and safety tips.</small></span><i><ArrowUpRight size={16}/></i></button></section>
          <section className="dashboard-lower-panels"><article className="dashboard-recent-panel"><header><div><span className="metric-icon cyan"><Clock3 size={17}/></span><div><h2>Recent Checks</h2><small>Your latest payment reviews</small></div></div><button className="text-button" type="button" onClick={() => setActiveItem('Payment history')}>View All <ArrowUpRight size={14}/></button></header>{recentChecks.length ? <div className="dashboard-recent-table-wrap"><table className="dashboard-recent-table"><thead><tr><th>Date &amp; Time</th><th>Details</th><th>Risk Level</th><th>Score</th><th></th></tr></thead><tbody>{recentChecks.slice(0,4).map(check=><tr key={check.id}><td>{new Date(check.created_at).toLocaleString([], {dateStyle:'medium',timeStyle:'short'})}</td><td><span className="dashboard-row-type"><FileCheck2 size={14}/>{check.input_label}</span></td><td><span className={`risk-pill risk-${check.risk_level}`}>{check.risk_level}</span></td><td>{check.risk_score}</td><td><button type="button" className="dashboard-row-open" onClick={() => setActiveItem('Payment history')} aria-label="Open payment history"><ArrowUpRight size={14}/></button></td></tr>)}</tbody></table></div> : <div className="dashboard-no-checks"><FileCheck2 size={22}/><strong>No checks yet</strong><small>Your recent payment reviews will appear here.</small><button type="button" className="text-button" onClick={openVerifier}>Check a payment</button></div>}</article><aside className="dashboard-quick-actions"><h2>Quick Actions</h2><div><button type="button" onClick={() => openVerifierWithMode('upload')}><span className="quick-action-icon quick-blue"><FileImage size={18}/></span><span><strong>Upload Screenshot</strong><small>Analyze a payment screenshot</small></span></button><button type="button" onClick={() => openVerifierWithMode('paste')}><span className="quick-action-icon quick-violet"><FileCheck2 size={18}/></span><span><strong>Paste Message</strong><small>Check a suspicious message</small></span></button><button type="button" onClick={() => openVerifierWithMode('url')}><span className="quick-action-icon quick-green"><Link2 size={18}/></span><span><strong>Check a URL</strong><small>Analyze website link text</small></span></button><button type="button" onClick={() => openVerifierWithMode('upload')}><span className="quick-action-icon quick-orange"><FileCheck2 size={18}/></span><span><strong>Upload Invoice Image</strong><small>Review an invoice or receipt image.</small></span></button></div></aside></section>          </>}
        </div>
      </main>
      {showIntro && <OpeningAnimation onSkip={finishIntro}/>}
    </div>
  )
}

export default App
