import type { Method } from '../../types'
import { getMethodParams } from '../../constants/methods'

interface DynamicParamsFormProps {
  methodCode: string
  methods: Method[]
  dynamicParamValues: Record<string, any>
  setDynamicParamValues: React.Dispatch<React.SetStateAction<Record<string, any>>>
}

export function DynamicParamsForm({
  methodCode,
  methods,
  dynamicParamValues,
  setDynamicParamValues,
}: DynamicParamsFormProps) {
  const paramsList = getMethodParams(methodCode, methods)

  if (paramsList.length === 0) {
    return (
      <div className="grid grid-cols-2 gap-4">
        <div className="form-group">
          <label className="label">Search Query</label>
          <input
            type="text"
            value={dynamicParamValues.query || ''}
            onChange={(e) =>
              setDynamicParamValues((prev) => ({ ...prev, query: e.target.value }))
            }
            className="input"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {paramsList.map((param: any, i: number) => {
        const pName = param.Name || param.name || `param_${i}`
        const pLabel = param.Label || param.label || pName
        const pType = (param.Type || param.type || 'text').toLowerCase()
        const pReq = param.Required ?? param.required ?? false
        const pPlaceholder = param.Placeholder || param.placeholder || ''
        const pDesc = param.Description || param.description || ''

        const isTextarea = pType === 'textarea' || pName === 'ai_instruction'
        const isBoolean = pType === 'boolean' || pName === 'deduplicate'

        return (
          <div key={pName} className={`form-group ${isTextarea ? 'col-span-1 md:col-span-2' : ''}`}>
            <label className="label flex items-center justify-between">
              <span>
                {pLabel} {pReq && <span className="text-red-400">*</span>}
              </span>
            </label>
            {isTextarea ? (
              <textarea
                rows={3}
                required={pReq}
                placeholder={pPlaceholder}
                value={dynamicParamValues[pName] ?? ''}
                onChange={(e) =>
                  setDynamicParamValues((prev) => ({
                    ...prev,
                    [pName]: e.target.value,
                  }))
                }
                className="input text-xs font-sans"
              />
            ) : isBoolean ? (
              <select
                value={String(dynamicParamValues[pName] ?? param.default ?? true)}
                onChange={(e) =>
                  setDynamicParamValues((prev) => ({
                    ...prev,
                    [pName]: e.target.value === 'true',
                  }))
                }
                className="input"
              >
                <option value="true">Aktif (Skip URL duplikat)</option>
                <option value="false">Nonaktif (Ambil ulang URL yang sama)</option>
              </select>
            ) : (
              <input
                type={pType === 'number' ? 'number' : pType === 'date' ? 'date' : 'text'}
                required={pReq}
                placeholder={pPlaceholder}
                value={dynamicParamValues[pName] ?? ''}
                onChange={(e) =>
                  setDynamicParamValues((prev) => ({
                    ...prev,
                    [pName]:
                      pType === 'number'
                        ? e.target.value === ''
                          ? ''
                          : Number(e.target.value)
                        : e.target.value,
                  }))
                }
                className="input"
              />
            )}
            {pDesc && <p className="text-[11px] text-gray-400 mt-1">{pDesc}</p>}
          </div>
        )
      })}
    </div>
  )
}
