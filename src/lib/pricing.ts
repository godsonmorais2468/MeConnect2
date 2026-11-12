import type { BillingCycle, Mode, Plan } from './types'

const round2 = (n: number) => Math.round(n * 100) / 100

export const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
  one_time: 'One time',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  half_yearly: 'Half yearly',
  yearly: 'Yearly',
}

/** The suffix shown after a plan's rate on its card. */
export const BILLING_CYCLE_SUFFIX: Record<BillingCycle, string> = {
  one_time: ' one time',
  monthly: ' / month',
  quarterly: ' / quarter',
  half_yearly: ' / half year',
  yearly: ' / year',
}

/** The rate label for the plan form. */
export const BILLING_CYCLE_RATE_LABEL: Record<BillingCycle, string> = {
  one_time: 'One-time amount (₹)',
  monthly: 'Rate per month (₹)',
  quarterly: 'Rate per quarter (₹)',
  half_yearly: 'Rate per half year (₹)',
  yearly: 'Rate per year (₹)',
}

/** The base, tax and total for one billing cycle. Tax stays exclusive. */
export function totalForCycle(plan: Pick<Plan, 'rate' | 'taxPercent'>) {
  const base = round2(plan.rate)
  const tax = round2((base * plan.taxPercent) / 100)
  return { base, tax, total: round2(base + tax) }
}

/** Kept for older monthly/tenure display code. New plan screens use totalForCycle. */
export function priceFor(plan: Plan, mode: Mode) {
  const months = mode === 'tenure' ? 6 : 1
  const base = round2(plan.rate * months)
  const tax = round2((base * plan.taxPercent) / 100)
  return { months, base, tax, total: round2(base + tax) }
}
