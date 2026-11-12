import { getTokens } from './api'

/**
 * Push notifications through OneSignal.
 *
 * One OneSignal app serves the whole platform. A signed-in user is given the OneSignal
 * identity equal to their backend user id (a UUID), read from the JWT access token, and the server
 * sends each notification to those external ids, so a notification only ever reaches the people it
 * names.
 *
 * Needs HTTPS (or localhost). The OneSignal worker lives in its own scope, /push/onesignal/, apart
 * from the app's own /sw.js: two workers on one scope replace each other on every page load.
 */

const APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID as string | undefined
const INIT_TIMEOUT_MS = 30_000

interface OneSignalSdk {
  init(options: Record<string, unknown>): Promise<void>
  login(externalId: string): Promise<void>
  logout(): Promise<void>
  User: {
    onesignalId?: string
    externalId?: string
    addTag(key: string, value: string): void
    addEventListener(event: 'change', listener: (change: unknown) => void): void
    PushSubscription: {
      id?: string | null
      token?: string | null
      optedIn?: boolean
      optIn(): Promise<void>
      addEventListener(event: 'change', listener: (change: unknown) => void): void
    }
  }
  Notifications: {
    permission: boolean
    requestPermission(): Promise<void>
    addEventListener(event: 'permissionChange', listener: (granted: boolean) => void): void
  }
}

declare global {
  interface Window {
    OneSignalDeferred?: Array<(sdk: OneSignalSdk) => void | Promise<void>>
  }
}

/** Everything worth knowing about push in the browser console, one prefix to filter on. */
const log = (...parts: unknown[]) => console.log('%c[OneSignal]', 'color:#D4003F;font-weight:bold', ...parts)

/** True when a OneSignal app id was set at build time. */
export function pushConfigured(): boolean {
  return Boolean(APP_ID)
}

if (!APP_ID) {
  log('push is OFF: VITE_ONESIGNAL_APP_ID was empty when the app was built.')
}

export type PushPermission = 'granted' | 'denied' | 'default' | 'unsupported'

/** True on an iPhone / iPad tab that is not installed: web push only works once it is. */
export function needsInstallForPush(): boolean {
  const iosDevice = /iPhone|iPad|iPod/.test(navigator.userAgent)
  const installed =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosDevice && !installed
}

export function pushPermission(): PushPermission {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported'
  }
  return Notification.permission
}

/** Prints everything OneSignal knows right now: who is signed in and whether THIS device is subscribed. */
function logState(sdk: OneSignalSdk, note: string) {
  const sub = sdk.User.PushSubscription
  const token = sub.token
  log(note, {
    permission: sdk.Notifications.permission ? 'allowed' : pushPermission(),
    externalId: sdk.User.externalId ?? '(none)',
    onesignalId: sdk.User.onesignalId ?? '(none)',
    subscriptionId: sub.id ?? '(none)',
    optedIn: sub.optedIn ?? false,
    token: token ? `${token.slice(0, 14)}...` : '(none)',
  })
  if (!sdk.User.externalId) {
    log('NOT registered: no user is signed in to OneSignal on this device.')
  } else if (!sub.id) {
    log('NOT registered: signed in as', sdk.User.externalId, 'but this browser has no push subscription (permission was never allowed).')
  } else if (!sub.optedIn) {
    log('NOT receiving: signed in as', sdk.User.externalId, 'but the subscription is switched off.')
  } else {
    log('REGISTERED: this device will receive notifications for user', sdk.User.externalId)
  }
}

/** Runs `task` with the OneSignal SDK once it has loaded (the SDK script is deferred). */
function withSdk<T>(task: (sdk: OneSignalSdk) => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    window.OneSignalDeferred = window.OneSignalDeferred ?? []
    window.OneSignalDeferred.push(async (sdk) => {
      try {
        resolve(await task(sdk))
      } catch (error) {
        reject(error)
      }
    })
  })
}

let started: Promise<void> | null = null

/** Starts OneSignal once. Rejects if it cannot start (blocked by an ad-blocker, offline, ...). */
function startPush(): Promise<void> {
  if (!APP_ID) return Promise.reject(new Error('OneSignal is not configured.'))
  if (!started) {
    log('app id:', APP_ID, '| origin:', location.origin, '| secure context:', window.isSecureContext)
    started = withSdk((sdk) =>
      Promise.race([
        sdk.init({
          appId: APP_ID,
          path: 'push/onesignal',
          serviceWorkerPath: 'OneSignalSDKWorker.js',
          serviceWorkerParam: { scope: '/push/onesignal/' },
          // Without this, a dashboard-managed app ignores the custom worker path above and looks
          // for /OneSignalSDKWorker.js at the site root (which is the app's own worker scope).
          serviceWorkerOverrideForTypical: true,
          allowLocalhostAsSecureOrigin: true,
        }),
        // A blocked SDK can wait forever with no error; fail instead.
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('OneSignal did not start in time.')), INIT_TIMEOUT_MS),
        ),
      ]),
    )
    started.then(
      () =>
        withSdk(async (sdk) => {
          sdk.User.PushSubscription.addEventListener('change', (change) => {
            log('push subscription changed', change)
            logState(sdk, 'subscription now')
          })
          sdk.Notifications.addEventListener('permissionChange', (granted) => {
            log('permission', granted ? 'allowed' : 'blocked')
            logState(sdk, 'after permission change')
          })
          logState(sdk, 'OneSignal started')
        }),
      () => undefined,
    )
    // A failed start may be tried again on the next call.
    started.catch((error) => {
      log('could not start (ad-blocker, offline, wrong site address?):', error instanceof Error ? error.message : error)
      started = null
    })
  }
  return started
}

/** Who is signed in, read from the access token: the backend user id (a UUID). */
function signedInUserId(): string | null {
  const tokens = getTokens()
  if (!tokens?.access) return null
  try {
    const payload = JSON.parse(atob(tokens.access.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (payload.user_id == null) return null
    return String(payload.user_id)
  } catch {
    return null
  }
}

let linkedAs: string | null = null

/** Tells OneSignal whose device this is (identity). Safe to call repeatedly. */
export async function linkUser(): Promise<void> {
  const userId = signedInUserId()
  if (!APP_ID) return
  if (!userId) {
    log('nothing to link: no signed-in user id found in the access token.')
    return
  }
  if (linkedAs === userId) return

  log('linking this device to user', userId)
  await startPush()
  await withSdk(async (sdk) => {
    await sdk.login(userId)
    // Already allowed earlier: make sure this subscription belongs to the person now signed in.
    if (sdk.Notifications.permission) await sdk.User.PushSubscription.optIn()
  })
  await withSdk(async (sdk) => logState(sdk, 'linked'))
  linkedAs = userId
}

/** Detaches this device from the person who signed out. */
export async function unlinkUser(): Promise<void> {
  if (!linkedAs) return
  linkedAs = null
  try {
    await startPush()
    await withSdk(async (sdk) => {
      await sdk.logout()
      log('signed out, this device is no longer linked to the user')
    })
  } catch {
    /* nothing linked, or the SDK never started: there is nothing more to clean up */
  }
}

/** Rejects if `promise` settles too late, so a silent browser prompt cannot hang the button. */
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

const PERMISSION_TIMEOUT_MS = 60_000

/**
 * Asks the browser itself for notification permission.
 *
 * We do not use `sdk.Notifications.requestPermission()`: it awaits OneSignal's internal prompt
 * flow, which can wait forever when the browser never shows a prompt (Brave shields, a prompt
 * suppressed by the browser, a blocked site setting). The native call plus a timeout always
 * settles, so the button can recover and tell the member what to do.
 */
function askBrowserPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return Promise.resolve('denied')
  if (Notification.permission !== 'default') {
    log('browser permission is already', Notification.permission)
    return Promise.resolve(Notification.permission)
  }
  log('asking the browser for notification permission (the prompt appears near the address bar) ...')
  return withTimeout(
    Notification.requestPermission(),
    PERMISSION_TIMEOUT_MS,
    'No permission prompt appeared. Click the lock/settings icon in the address bar, allow notifications for this site, then reload.',
  )
}

/**
 * Asks for notification permission and subscribes this device. Call it from a tap, never on load.
 * Resolves to true when notifications are allowed.
 */
export async function enablePush(): Promise<boolean> {
  await startPush()
  await linkUser()

  const permission = await askBrowserPermission()
  log('browser answered:', permission)
  if (permission !== 'granted') {
    log('not enabled: the browser did not allow notifications.')
    return false
  }

  // The browser allowed it. Let OneSignal attach this subscription to the signed-in user. If this
  // one call fails, the permission is still granted; OneSignal picks the change up on its own.
  try {
    await withSdk(async (sdk) => {
      await sdk.User.PushSubscription.optIn()
      logState(sdk, 'after enabling')
    })
  } catch (error) {
    log('permission granted, but OneSignal could not finish subscribing:', error)
  }
  return true
}

/**
 * Run `bniPushStatus()` in the browser console at any time to see whether this device is
 * registered with OneSignal and which user it is linked to.
 */
export async function pushStatus(): Promise<void> {
  if (!APP_ID) {
    log('push is OFF: VITE_ONESIGNAL_APP_ID was empty when the app was built.')
    return
  }
  await startPush()
  await withSdk(async (sdk) => logState(sdk, 'status'))
}

if (typeof window !== 'undefined') {
  ;(window as Window & { bniPushStatus?: () => Promise<void> }).bniPushStatus = pushStatus
}
