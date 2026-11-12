import { useState } from 'react'
import { Field } from './ui'
import { MONTHS, daysIn, dayMonthOf, storeDayMonth } from '../lib/dayMonth'

/** A day and a month to pick, with no year. `onChange` gets the date to store, or '' until both are chosen. */
export default function DayMonthField({
  label,
  value,
  onChange,
  required,
  error,
}: {
  label: string
  value: string
  onChange: (iso: string) => void
  required?: boolean
  error?: string
}) {
  const start = dayMonthOf(value)
  const [day, setDay] = useState(start ? String(start.day) : '')
  const [month, setMonth] = useState(start ? String(start.month) : '')

  function change(nextDay: string, nextMonth: string) {
    /* a day that the new month does not have (31 in April) is dropped */
    const fits = nextDay && nextMonth ? Number(nextDay) <= daysIn(Number(nextMonth)) : true
    const d = fits ? nextDay : ''
    setDay(d)
    setMonth(nextMonth)
    onChange(d && nextMonth ? storeDayMonth(Number(d), Number(nextMonth)) : '')
  }

  const max = month ? daysIn(Number(month)) : 31
  return (
    <Field label={label} required={required} error={error}>
      <div style={{ display: 'flex', gap: 10 }}>
        <select className="field__control native-select" style={{ flex: 1 }} value={day} onChange={(e) => change(e.target.value, month)} aria-label={`${label} day`}>
          <option value="">Day</option>
          {Array.from({ length: max }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select className="field__control native-select" style={{ flex: 2 }} value={month} onChange={(e) => change(day, e.target.value)} aria-label={`${label} month`}>
          <option value="">Month</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
      </div>
    </Field>
  )
}
