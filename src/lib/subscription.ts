import { apiRequest } from './api'
import type {
  PaginatedResponse,
  SubscriptionPayment,
  SubscriptionRecord,
  SubscriptionStatus,
} from './types'

export interface PaymentFilterParams {
  page?: number
  pageSize?: number
  chapter?: string
  status?: string
  search?: string
}

export function fetchSubscriptionStatus() {
  return apiRequest<SubscriptionStatus>('/subscriptions/current/')
}

export function fetchSubscriptionPayments(params?: PaymentFilterParams) {
  const query = new URLSearchParams()
  if (params?.page) query.set('page', String(params.page))
  if (params?.pageSize) query.set('page_size', String(params.pageSize))
  if (params?.chapter && params.chapter !== 'all') query.set('chapter', params.chapter)
  if (params?.status && params.status !== 'all') query.set('status', params.status)
  if (params?.search && params.search.trim()) query.set('search', params.search.trim())

  const qs = query.toString()
  const endpoint = qs ? `/subscriptions/payments/?${qs}` : '/subscriptions/payments/'
  return apiRequest<PaginatedResponse<SubscriptionPayment> | SubscriptionPayment[]>(endpoint)
}

export function fetchSubscriptions() {
  return apiRequest<SubscriptionRecord[] | { results: SubscriptionRecord[] }>('/subscriptions/')
}

export function subscriptionList(
  data: SubscriptionRecord[] | { results: SubscriptionRecord[] } | undefined,
) {
  if (Array.isArray(data)) return data
  return data?.results ?? []
}

export function assignRegionSubscription(planId: string, regionId: string) {
  return apiRequest<SubscriptionRecord>('/subscriptions/', {
    method: 'POST',
    body: JSON.stringify({ plan: planId, scope_type: 'region', region: regionId }),
  })
}

export function activateSubscription(id: string, note = 'Manual payment verification') {
  return apiRequest<{ subscription: SubscriptionRecord; created: boolean }>(
    `/subscriptions/${id}/activate/`,
    {
      method: 'POST',
      body: JSON.stringify({ note }),
    },
  )
}

export function paymentList(
  data: PaginatedResponse<SubscriptionPayment> | SubscriptionPayment[] | undefined,
): SubscriptionPayment[] {
  if (!data) return []
  if (Array.isArray(data)) return data
  return data.results ?? []
}

export function paymentCount(
  data: PaginatedResponse<SubscriptionPayment> | SubscriptionPayment[] | undefined,
): number {
  if (!data) return 0
  if (Array.isArray(data)) return data.length
  return typeof data.count === 'number' ? data.count : (data.results?.length ?? 0)
}

export interface EasebuzzInitiateResponse {
  success: boolean
  is_mock?: boolean
  access_key?: string
  payment_url?: string
  txnid?: string
  error?: string
}

export function initiateEasebuzzPayment(payload: {
  planId: string
  subscriptionId?: string
  scopeType?: string
  regionId?: string
  chapterId?: string
  memberId?: string
}) {
  return apiRequest<EasebuzzInitiateResponse>('/subscriptions/easebuzz-initiate/', {
    method: 'POST',
    body: JSON.stringify({
      plan_id: payload.planId,
      subscription_id: payload.subscriptionId,
      scope_type: payload.scopeType,
      region_id: payload.regionId,
      chapter_id: payload.chapterId,
      member_id: payload.memberId,
    }),
  })
}

export function verifyEasebuzzPayment(txnid: string) {
  return apiRequest<{ status: string; txnid: string; subscription_id?: string }>(
    `/subscriptions/easebuzz-verify/${encodeURIComponent(txnid)}/`,
  )
}

