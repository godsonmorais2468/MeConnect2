import { apiRequest } from './api'

/* Forgot PIN: three server steps. Send a code by SMS, swap the code for a reset token, set the new PIN. */

export interface CodeSent {
  error?: string
  /** The number the code went to, masked (******3210). */
  sentTo?: string
  otpLength?: number
  /** Only present on a development backend: the code itself. */
  debugOtp?: string
}

export async function requestPinReset(mobile: string): Promise<CodeSent> {
  const res = await apiRequest<{ sent_to: string; otp_length: number; debug_otp?: string }>('/auth/password-reset/request/', {
    method: 'POST',
    body: JSON.stringify({ mobile }),
  })
  if (res.error) return { error: res.error }
  return { sentTo: res.data?.sent_to, otpLength: res.data?.otp_length, debugOtp: res.data?.debug_otp }
}

export async function verifyPinReset(mobile: string, otp: string): Promise<{ error?: string; token?: string }> {
  const res = await apiRequest<{ reset_token: string }>('/auth/password-reset/verify/', {
    method: 'POST',
    body: JSON.stringify({ mobile, otp }),
  })
  if (res.error) return { error: res.error }
  return { token: res.data?.reset_token }
}

export async function confirmPinReset(token: string, pin: string, confirm: string): Promise<{ error?: string }> {
  const res = await apiRequest('/auth/password-reset/confirm/', {
    method: 'POST',
    body: JSON.stringify({ reset_token: token, new_pin: pin, confirm_pin: confirm }),
  })
  return res.error ? { error: res.error } : {}
}

/** A signed-in person changes their own MPIN (the profile menu). */
export async function changeMpin(current: string, next: string, confirm: string): Promise<{ error?: string }> {
  const res = await apiRequest('/auth/change-pin/', {
    method: 'POST',
    body: JSON.stringify({ current_pin: current, new_pin: next, confirm_pin: confirm }),
  })
  return res.error ? { error: res.error } : {}
}
