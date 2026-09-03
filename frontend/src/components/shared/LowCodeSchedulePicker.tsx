import { useState, useEffect } from 'react'
import { Check} from 'lucide-react'

export type ScheduleMode = 'minutes' | 'hours' | 'daily' | 'weekly' | 'monthly' | 'cron'

export interface LowCodeSchedulePickerProps {
  initialCron?: string
  initialTimezone?: string
  /** true: jadwal hanya dieksekusi sekali, lalu berhenti sendiri */
  initialRunOnce?: boolean
  onChange: (cronExpression: string, timezone: string, runOnce: boolean) => void
}

const DAYS_OF_WEEK = [
  { label: 'Sen', val: 1, full: 'Senin' },
  { label: 'Sel', val: 2, full: 'Selasa' },
  { label: 'Rab', val: 3, full: 'Rabu' },
  { label: 'Kam', val: 4, full: 'Kamis' },
  { label: 'Jum', val: 5, full: 'Jumat' },
  { label: 'Sab', val: 6, full: 'Sabtu' },
  { label: 'Min', val: 0, full: 'Minggu' },
]

export const TIMEZONE_OPTIONS = [
  { label: 'WITA - Asia/Makassar', value: 'Asia/Makassar' },
  { label: 'WIB - Asia/Jakarta', value: 'Asia/Jakarta' },
  { label: 'WIT - Asia/Jayapura', value: 'Asia/Jayapura' },
  { label: 'UTC - Universal Time', value: 'UTC' },
]

/**
 * Converts standard 5-part cron expressions to human-readable Indonesian text
 */
export function cronToIndonesian(cron: string, timezone = 'Asia/Makassar'): string {
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return `Ekspresi CRON: ${cron}`

  const [m, h, dom, mon, dow] = parts
  const tzShort = timezone.includes('Makassar')
    ? 'WITA'
    : timezone.includes('Jakarta')
    ? 'WIB'
    : timezone.includes('Jayapura')
    ? 'WIT'
    : timezone

  // Every N minutes: */N * * * * or * * * * *
  if (m.startsWith('*/') && h === '*' && dom === '*' && mon === '*' && dow === '*') {
    const mins = m.replace('*/', '')
    return `Eksekusi otomatis setiap ${mins} menit`
  }
  if (m === '*' && h === '*' && dom === '*' && mon === '*' && dow === '*') {
    return 'Eksekusi otomatis setiap 1 menit'
  }

  // Every N hours at minute M: M */N * * *
  if (!m.includes('*') && h.startsWith('*/') && dom === '*' && mon === '*' && dow === '*') {
    const hours = h.replace('*/', '')
    const minStr = m.padStart(2, '0')
    return `Eksekusi otomatis setiap ${hours} jam pada menit ke-${minStr}`
  }

  // Daily at HH:MM: M H * * *
  if (!m.includes('*') && !h.includes('*') && dom === '*' && mon === '*' && dow === '*') {
    const hourStr = h.padStart(2, '0')
    const minStr = m.padStart(2, '0')
    return `Eksekusi otomatis setiap hari pada pukul ${hourStr}:${minStr} ${tzShort}`
  }

  // Weekly on days D1,D2 at HH:MM: M H * * D1,D2
  if (!m.includes('*') && !h.includes('*') && dom === '*' && mon === '*' && dow !== '*') {
    const hourStr = h.padStart(2, '0')
    const minStr = m.padStart(2, '0')
    const daysArr = dow.split(',').map((d) => {
      const found = DAYS_OF_WEEK.find((w) => String(w.val) === d)
      return found ? found.full : d
    })
    return `Eksekusi otomatis setiap hari ${daysArr.join(', ')} pukul ${hourStr}:${minStr} ${tzShort}`
  }

  // Monthly on day DOM at HH:MM: M H DOM * *
  if (!m.includes('*') && !h.includes('*') && dom !== '*' && mon === '*' && dow === '*') {
    const hourStr = h.padStart(2, '0')
    const minStr = m.padStart(2, '0')
    return `Eksekusi otomatis setiap tanggal ${dom} setiap bulan pada pukul ${hourStr}:${minStr} ${tzShort}`
  }

  return `Jadwal kustom: ${cron} (${tzShort})`
}

/**
 * Describes a schedule for display, accounting for one-shot schedules whose
 * cron expression only marks the single moment they fire.
 */
export function describeSchedule(
  cron: string,
  timezone = 'Asia/Makassar',
  runOnce = false,
  lastRun?: string | null
): string {
  if (!runOnce) return cronToIndonesian(cron, timezone)

  if (lastRun) {
    const d = new Date(lastRun)
    if (!isNaN(d.getTime())) {
      return `Sekali saja \u2014 sudah dieksekusi ${d.toLocaleString('id-ID')}`
    }
  }
  return 'Schedule ini hanya akan dijalankan sekali'
}

export function LowCodeSchedulePicker({
  initialCron = '0 0 * * *',
  initialTimezone = 'Asia/Makassar',
  initialRunOnce = false,
  onChange,
}: LowCodeSchedulePickerProps) {
  const [mode, setMode] = useState<ScheduleMode>('daily')
  const [runOnce, setRunOnce] = useState(initialRunOnce)
  const [minuteInterval, setMinuteInterval] = useState(15)
  const [hourInterval, setHourInterval] = useState(1)
  const [atMinute, setAtMinute] = useState(0)
  const [dailyTime, setDailyTime] = useState('08:00')
  const [weeklyDays, setWeeklyDays] = useState<number[]>([1]) // Monday default
  const [monthlyDay, setMonthlyDay] = useState(1)
  const [customCron, setCustomCron] = useState(initialCron)
  const [timezone, setTimezone] = useState(initialTimezone)

  // Compute Cron string whenever inputs change
  useEffect(() => {
    let generatedCron = initialCron

    if (mode === 'minutes') {
      generatedCron = minuteInterval === 1 ? '* * * * *' : `*/${minuteInterval} * * * *`
    } else if (mode === 'hours') {
      generatedCron = `${atMinute} */${hourInterval} * * *`
    } else if (mode === 'daily') {
      const [h, m] = dailyTime.split(':').map((v) => parseInt(v, 10) || 0)
      generatedCron = `${m} ${h} * * *`
    } else if (mode === 'weekly') {
      const [h, m] = dailyTime.split(':').map((v) => parseInt(v, 10) || 0)
      const sortedDays = [...weeklyDays].sort((a, b) => a - b).join(',')
      generatedCron = `${m} ${h} * * ${sortedDays || '1'}`
    } else if (mode === 'monthly') {
      const [h, m] = dailyTime.split(':').map((v) => parseInt(v, 10) || 0)
      generatedCron = `${m} ${h} ${monthlyDay} * *`
    } else if (mode === 'cron') {
      generatedCron = customCron
    }

    onChange(generatedCron, timezone, runOnce)
  }, [mode, minuteInterval, hourInterval, atMinute, dailyTime, weeklyDays, monthlyDay, customCron, timezone, runOnce])

  const toggleWeeklyDay = (dayVal: number) => {
    if (weeklyDays.includes(dayVal)) {
      if (weeklyDays.length > 1) {
        setWeeklyDays(weeklyDays.filter((d) => d !== dayVal))
      }
    } else {
      setWeeklyDays([...weeklyDays, dayVal])
    }
  }

  return (
    <div className="space-y-4">
      {/* Execution Pattern: repeat forever vs fire once */}
      <div className="form-group">
        <label className="label text-xs font-semibold text-gray-300">Pola Eksekusi</label>
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-surface-950 border border-surface-700 text-xs">
          <button
            type="button"
            onClick={() => setRunOnce(false)}
            className={`py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all font-medium ${
              !runOnce
                ? 'bg-brand-600 text-white shadow-md shadow-brand-900/40 font-semibold'
                : 'text-gray-400 hover:text-gray-200 hover:bg-surface-800'
            }`}
          >
            <span>Berulang</span>
          </button>

          <button
            type="button"
            onClick={() => setRunOnce(true)}
            className={`py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all font-medium ${
              runOnce
                ? 'bg-amber-600 text-white shadow-md shadow-amber-900/40 font-semibold'
                : 'text-gray-400 hover:text-gray-200 hover:bg-surface-800'
            }`}
          >
            <span>Sekali Saja</span>
          </button>
        </div>
        <p className="text-[11px] text-gray-400 mt-1.5">
          {runOnce
            ? 'Dieksekusi satu kali pada waktu cocok berikutnya, lalu jadwal otomatis dinonaktifkan.'
            : 'Dieksekusi terus-menerus setiap kali waktu sesuai dengan yang ditentukan.'}
        </p>
      </div>

      {/* Visual Mode Selector Tabs */}
      <div className="form-group">
        <label className="label text-xs font-semibold text-gray-300">
          {runOnce ? 'Pilih Waktu Eksekusi' : 'Pilih Frekuensi Eksekusi'}
        </label>
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-surface-950 border border-surface-700 text-xs">
          <button
            type="button"
            onClick={() => setMode('daily')}
            className={`py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all font-medium ${
              mode === 'daily'
                ? 'bg-brand-600 text-white shadow-md shadow-brand-900/40 font-semibold'
                : 'text-gray-400 hover:text-gray-200 hover:bg-surface-800'
            }`}
          >
            <span>Setiap Hari</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('weekly')}
            className={`py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all font-medium ${
              mode === 'weekly'
                ? 'bg-brand-600 text-white shadow-md shadow-brand-900/40 font-semibold'
                : 'text-gray-400 hover:text-gray-200 hover:bg-surface-800'
            }`}
          >
            <span>Mingguan</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('minutes')}
            className={`py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all font-medium ${
              mode === 'minutes'
                ? 'bg-brand-600 text-white shadow-md shadow-brand-900/40 font-semibold'
                : 'text-gray-400 hover:text-gray-200 hover:bg-surface-800'
            }`}
          >
            <span>Interval Menit</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('hours')}
            className={`py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all font-medium ${
              mode === 'hours'
                ? 'bg-brand-600 text-white shadow-md shadow-brand-900/40 font-semibold'
                : 'text-gray-400 hover:text-gray-200 hover:bg-surface-800'
            }`}
          >
            <span>Interval Jam</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('monthly')}
            className={`py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all font-medium ${
              mode === 'monthly'
                ? 'bg-brand-600 text-white shadow-md shadow-brand-900/40 font-semibold'
                : 'text-gray-400 hover:text-gray-200 hover:bg-surface-800'
            }`}
          >
            <span>Bulanan</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('cron')}
            className={`py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all font-medium ${
              mode === 'cron'
                ? 'bg-brand-600 text-white shadow-md shadow-brand-900/40 font-semibold'
                : 'text-gray-400 hover:text-gray-200 hover:bg-surface-800'
            }`}
          >
            <span>Kustom CRON</span>
          </button>
        </div>
      </div>

      {/* Dynamic Sub-form Options */}
      <div className="p-4 rounded-xl bg-surface-800/80 border border-surface-700 space-y-3">
        {mode === 'minutes' && (
          <div className="form-group">
            <label className="label text-xs">Jalankan setiap berapa menit?</label>
            <div className="grid grid-cols-4 gap-2">
              {[5, 10, 15, 30].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMinuteInterval(m)}
                  className={`py-2 text-xs font-semibold rounded-lg border transition-all ${
                    minuteInterval === m
                      ? 'bg-teal-500/20 border-teal-500 text-teal-300'
                      : 'bg-surface-900 border-surface-700 text-gray-300 hover:bg-surface-800'
                  }`}
                >
                  {m} Menit
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === 'hours' && (
          <div className="grid grid-cols-2 gap-3">
            <div className="form-group">
              <label className="label text-xs">Setiap Berapa Jam</label>
              <select
                value={hourInterval}
                onChange={(e) => setHourInterval(Number(e.target.value))}
                className="input text-xs"
              >
                <option value={1}>Setiap 1 Jam</option>
                <option value={2}>Setiap 2 Jam</option>
                <option value={3}>Setiap 3 Jam</option>
                <option value={6}>Setiap 6 Jam</option>
                <option value={12}>Setiap 12 Jam</option>
              </select>
            </div>
            <div className="form-group">
              <label className="label text-xs">Pada Menit Ke-</label>
              <select
                value={atMinute}
                onChange={(e) => setAtMinute(Number(e.target.value))}
                className="input text-xs"
              >
                <option value={0}>Menit :00</option>
                <option value={15}>Menit :15</option>
                <option value={30}>Menit :30</option>
                <option value={45}>Menit :45</option>
              </select>
            </div>
          </div>
        )}

        {mode === 'daily' && (
          <div className="form-group">
            <label className="label text-xs">Pukul Berapa (Waktu Eksekusi Harian)</label>
            <input
              type="time"
              value={dailyTime}
              onChange={(e) => setDailyTime(e.target.value)}
              className="input text-xs font-mono font-semibold"
            />
          </div>
        )}

        {mode === 'weekly' && (
          <div className="space-y-3">
            <div className="form-group">
              <label className="label text-xs">Pilih Hari Eksekusi</label>
              <div className="flex gap-1.5 flex-wrap">
                {DAYS_OF_WEEK.map(({ label, val, full }) => {
                  const isSelected = weeklyDays.includes(val)
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => toggleWeeklyDay(val)}
                      title={full}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1 ${
                        isSelected
                          ? 'bg-brand-600 border-brand-400 text-white shadow-sm'
                          : 'bg-surface-900 border-surface-700 text-gray-400 hover:text-white'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                      <span>{label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="form-group">
              <label className="label text-xs">Pukul Berapa</label>
              <input
                type="time"
                value={dailyTime}
                onChange={(e) => setDailyTime(e.target.value)}
                className="input text-xs font-mono font-semibold"
              />
            </div>
          </div>
        )}

        {mode === 'monthly' && (
          <div className="grid grid-cols-2 gap-3">
            <div className="form-group">
              <label className="label text-xs">Setiap Tanggal</label>
              <select
                value={monthlyDay}
                onChange={(e) => setMonthlyDay(Number(e.target.value))}
                className="input text-xs"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    Tanggal {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="label text-xs">Pukul Berapa</label>
              <input
                type="time"
                value={dailyTime}
                onChange={(e) => setDailyTime(e.target.value)}
                className="input text-xs font-mono font-semibold"
              />
            </div>
          </div>
        )}

        {mode === 'cron' && (
          <div className="form-group">
            <label className="label text-xs">Ekspresi CRON Manual (5 Segmen)</label>
            <input
              type="text"
              value={customCron}
              onChange={(e) => setCustomCron(e.target.value)}
              placeholder="0 0 * * *"
              className="input font-mono text-xs text-amber-300"
            />
          </div>
        )}

        {/* Timezone Selector */}
        <div className="form-group pt-1 border-t border-surface-700/60">
          <label className="label text-xs">Zona Waktu</label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="input text-xs font-semibold text-brand-300"
          >
            {TIMEZONE_OPTIONS.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
