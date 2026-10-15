import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  required = false,
  minLength,
  maxLength,
  placeholder,
  disabled = false,
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="password-input-wrap">
      <input
        id={id}
        className="payee-input"
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
      />
      <button
        className="password-visibility"
        type="button"
        onClick={() => setVisible(current => !current)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        title={visible ? 'Hide password' : 'Show password'}
        disabled={disabled}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}

export default PasswordInput
