import { useState, useEffect } from 'react'
import type { Method } from '../../types'
import { Info, AlertCircle, Check } from 'lucide-react'

export interface DynamicScraperFormProps {
  method: Method
  initialValues?: Record<string, any>
  onChange?: (values: Record<string, any>, isValid: boolean) => void
  disabled?: boolean
}

export function DynamicScraperForm({
  method,
  initialValues = {},
  onChange,
  disabled = false,
}: DynamicScraperFormProps) {
  const [formValues, setFormValues] = useState<Record<string, any>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Initialize form values from parameter defaults and initialValues
  useEffect(() => {
    const defaultVals: Record<string, any> = {}
    const params = method.parameters || []

    params.forEach((p) => {
      const pName = p.Name || p.name || ''
      if (!pName) return

      if (initialValues[pName] !== undefined) {
        defaultVals[pName] = initialValues[pName]
      } else if (p.Default !== undefined || p.default !== undefined) {
        defaultVals[pName] = p.Default ?? p.default
      } else {
        const pType = (p.Type || p.type || 'text').toLowerCase()
        if (pType === 'boolean') {
          defaultVals[pName] = false
        } else if (pType === 'number') {
          defaultVals[pName] = ''
        } else if (pType === 'select') {
          const opts = p.Options || p.options || []
          defaultVals[pName] = opts.length > 0 ? opts[0].value : ''
        } else {
          defaultVals[pName] = ''
        }
      }
    })

    setFormValues(defaultVals)
  }, [method, initialValues])

  // Validate form and notify parent
  useEffect(() => {
    const newErrors: Record<string, string> = {}
    const params = method.parameters || []

    params.forEach((p) => {
      const pName = p.Name || p.name || ''
      const isReq = p.Required || p.required || false
      const val = formValues[pName]

      if (isReq) {
        if (val === undefined || val === null || val === '') {
          const label = p.Label || p.label || pName
          newErrors[pName] = `${label} wajib diisi`
        }
      }
    })

    setErrors(newErrors)
    const isValid = Object.keys(newErrors).length === 0
    if (onChange) {
      onChange(formValues, isValid)
    }
  }, [formValues, method])

  const handleFieldChange = (name: string, value: any) => {
    setFormValues((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const parameters = method.parameters || []

  return (
    <div className="space-y-4">
      {parameters.length === 0 ? (
        <div className="p-4 rounded-xl bg-surface-800 border border-surface-700 text-xs text-gray-400 text-center">
          Metode scraper ini tidak memerlukan parameter tambahan.
        </div>
      ) : (
        parameters.map((param) => {
          const name = param.Name || param.name || ''
          if (!name) return null

          const label = param.Label || param.label || name
          const type = (param.Type || param.type || 'text').toLowerCase()
          const isRequired = param.Required || param.required || false
          const placeholder = param.Placeholder || param.placeholder || ''
          const description = param.Description || param.description || ''
          const options = param.Options || param.options || []
          const value = formValues[name] ?? ''
          const fieldError = errors[name]

          // Render Boolean / Switch
          if (type === 'boolean') {
            return (
              <div
                key={name}
                className="flex items-center justify-between p-3.5 rounded-xl bg-surface-850 border border-surface-700/80 hover:border-surface-600 transition-colors"
              >
                <div className="space-y-0.5 pr-4">
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-semibold text-gray-200 cursor-pointer">
                      {label}
                    </label>
                    {isRequired && <span className="text-red-400 text-xs">*</span>}
                  </div>
                  {description && <p className="text-[11px] text-gray-400 leading-relaxed">{description}</p>}
                </div>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => handleFieldChange(name, !value)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 shrink-0 ${
                    value ? 'bg-brand-500' : 'bg-surface-700'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                      value ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            )
          }

          // Render Textarea
          if (type === 'textarea') {
            return (
              <div key={name} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-300 flex items-center gap-1">
                    <span>{label}</span>
                    {isRequired && <span className="text-red-400">*</span>}
                  </label>
                  {description && (
                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                      <Info className="w-3 h-3 text-brand-400" />
                      <span>{description}</span>
                    </span>
                  )}
                </div>
                <textarea
                  rows={3}
                  disabled={disabled}
                  value={value}
                  placeholder={placeholder}
                  onChange={(e) => handleFieldChange(name, e.target.value)}
                  className={`w-full px-3 py-2 text-xs rounded-xl bg-surface-900 border text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors resize-none ${
                    fieldError ? 'border-red-500/70' : 'border-surface-700'
                  }`}
                />
                {fieldError && (
                  <p className="text-[11px] text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{fieldError}</span>
                  </p>
                )}
              </div>
            )
          }

          // Render Select Dropdown
          if (type === 'select' || options.length > 0) {
            return (
              <div key={name} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-300 flex items-center gap-1">
                    <span>{label}</span>
                    {isRequired && <span className="text-red-400">*</span>}
                  </label>
                  {description && <span className="text-[10px] text-gray-400">{description}</span>}
                </div>
                <select
                  disabled={disabled}
                  value={value}
                  onChange={(e) => handleFieldChange(name, e.target.value)}
                  className={`w-full px-3 py-2 text-xs rounded-xl bg-surface-900 border text-gray-100 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors ${
                    fieldError ? 'border-red-500/70' : 'border-surface-700'
                  }`}
                >
                  {options.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-surface-900 text-gray-200">
                      {opt.label}
                    </option>
                  ))}
                </select>
                {fieldError && (
                  <p className="text-[11px] text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{fieldError}</span>
                  </p>
                )}
              </div>
            )
          }

          // Render Standard Input (Text, Number, Date, etc.)
          return (
            <div key={name} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-300 flex items-center gap-1">
                  <span>{label}</span>
                  {isRequired && <span className="text-red-400">*</span>}
                </label>
                {description && <span className="text-[10px] text-gray-400">{description}</span>}
              </div>
              <div className="relative">
                <input
                  type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}
                  disabled={disabled}
                  value={value}
                  placeholder={placeholder}
                  onChange={(e) => {
                    const val = type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value
                    handleFieldChange(name, val)
                  }}
                  className={`w-full px-3 py-2 text-xs rounded-xl bg-surface-900 border text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors ${
                    fieldError ? 'border-red-500/70' : 'border-surface-700'
                  }`}
                />
                {value && !disabled && (
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-400">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
              {fieldError && (
                <p className="text-[11px] text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>{fieldError}</span>
                </p>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
