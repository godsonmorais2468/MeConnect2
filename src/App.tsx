import { Suspense, lazy, useEffect, useState } from 'react'
import { LazyMotion, MotionConfig } from 'motion/react'
import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { getTier } from './lib/perf'
import ConfirmProvider from './components/ConfirmProvider'
import ToastProvider from './components/ToastProvider'
import Shell from './components/Shell'
import { HOME } from './data/nav'
import { SUBSCRIPTION_REQUIRED_EVENT } from './lib/api'
import { useAuth } from './lib/auth'
import { hasVisitorHostPermission, isHeadTable } from './lib/designations'
import { useDB, signOut } from './lib/store'
import { fetchSubscriptionStatus } from './lib/subscription'
import type { Role } from './lib/types'
import ForgotPin from './pages/ForgotPin'
import SetMpin from './pages/SetMpin'
import Login from './pages/Login'
import Home from './pages/member/Home'
import HelpDesk from './pages/HelpDesk'
import PolicyPage from './pages/PolicyPage'

/* the animation engine arrives after the first paint */
const loadMotion = () => import('./lib/motionFeatures').then((m) => m.default)

const Subscription = lazy(() => import('./pages/Subscription'))
const Meetings = lazy(() => import('./pages/member/Meetings'))
const ManageRsvp = lazy(() => import('./pages/member/ManageRsvp'))
const ChapterTeam = lazy(() => import('./pages/region/ChapterTeam'))
const ManagePayments = lazy(() => import('./pages/member/ManagePayments'))
const PaymentRequest = lazy(() => import('./pages/member/PaymentRequest'))
const PaymentUpdate = lazy(() => import('./pages/member/PaymentUpdate'))
const PaymentManualUpdate = lazy(() => import('./pages/member/PaymentManualUpdate'))
const CollectionReport = lazy(() => import('./pages/member/CollectionReport'))
const Accounts = lazy(() => import('./pages/member/Accounts'))
const ModesOfPay = lazy(() => import('./pages/member/ModesOfPay'))
const FinancialYearSettings = lazy(() => import('./pages/member/FinancialYearSettings'))
const BankAccounts = lazy(() => import('./pages/member/BankAccounts'))
const AccountHeads = lazy(() => import('./pages/member/AccountHeads'))
const Vouchers = lazy(() => import('./pages/member/Vouchers'))
const VoucherBook = lazy(() => import('./pages/member/VoucherBook'))
const Attendance = lazy(() => import('./pages/member/Attendance'))
const Directory = lazy(() => import('./pages/member/Directory'))
const Dues = lazy(() => import('./pages/member/Dues'))
const DueList = lazy(() => import('./pages/member/DueList'))
const MemberView = lazy(() => import('./pages/member/MemberView'))
const MyProfile = lazy(() => import('./pages/member/MyProfile'))
const OfficeBearers = lazy(() => import('./pages/member/OfficeBearers'))
const RsvpMember = lazy(() => import('./pages/member/Rsvp'))
const Wishes = lazy(() => import('./pages/member/Wishes'))
const VisitorQr = lazy(() => import('./pages/member/VisitorQr'))
const VisitorRegister = lazy(() => import('./pages/public/VisitorRegister'))
const VisitorWelcome = lazy(() => import('./pages/public/VisitorWelcome'))
const Reports = lazy(() => import('./pages/member/Reports'))
const ChapterSettings = lazy(() => import('./pages/member/ChapterSettings'))
const DuesReport = lazy(() => import('./pages/member/DuesReport'))
const LedgerReport = lazy(() => import('./pages/member/LedgerReport'))
const AttendanceReport = lazy(() => import('./pages/member/AttendanceReport'))
const AppUsageReport = lazy(() => import('./pages/member/AppUsageReport'))

function RequireAuth({ children }: { children: ReactNode }) {
  const { role } = useAuth()
  const location = useLocation()
  if (!role) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}

/** Sends signed-in users to the subscription page when the region is not entitled. */
function RequireEntitlement({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    let active = true
    async function check() {
      const res = await fetchSubscriptionStatus()
      if (!active) return
      if (res.status === 401) {
        signOut()
        navigate('/login', { replace: true })
        return
      }
      if (res.data?.allowed) {
        setAllowed(true)
        return
      }
      navigate('/subscription', { replace: true })
    }
    check()
    return () => {
      active = false
    }
  }, [navigate, location.pathname])

  useEffect(() => {
    function blocked() {
      navigate('/subscription', { replace: true })
    }
    window.addEventListener(SUBSCRIPTION_REQUIRED_EVENT, blocked)
    return () => window.removeEventListener(SUBSCRIPTION_REQUIRED_EVENT, blocked)
  }, [navigate])

  return allowed ? children : null
}

/** Sends people to their own area when they open a page meant for another role. */
function Only({ role, children }: { role: Role; children: ReactNode }) {
  const auth = useAuth()
  if (auth.role !== role) return <Navigate to={auth.role ? HOME[auth.role] : '/login'} replace />
  return children
}

/** Meetings, polls and payments are run by members whose designation sits on the head table. */
function OnlyHeadTable({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const db = useDB()
  if (auth.role !== 'member') return <Navigate to={auth.role ? HOME[auth.role] : '/login'} replace />
  if (!isHeadTable(db, auth.member)) return <Navigate to="/" replace />
  return children
}

/** Visitor Host standee & QR management are restricted to members with Visitor Host permission. */
function OnlyVisitorHost({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const db = useDB()
  if (auth.role !== 'member') return <Navigate to={auth.role ? HOME[auth.role] : '/login'} replace />
  if (!hasVisitorHostPermission(db, auth.member)) return <Navigate to="/" replace />
  return children
}

function RoleHome() {
  const { role } = useAuth()
  /* this app is for chapter members only: an admin sign-in has nowhere to go, so it is signed out and sent back to the login */
  useEffect(() => {
    if (role && role !== 'member') signOut()
  }, [role])
  if (role && role !== 'member') return null
  return <Home />
}

export default function App() {
  return (
    <LazyMotion features={loadMotion} strict>
    <MotionConfig reducedMotion={getTier() === 'low' ? 'always' : 'user'}>
    <ToastProvider>
      <ConfirmProvider>
      <Suspense fallback={null}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-pin" element={<ForgotPin />} />
        <Route path="/terms" element={<PolicyPage policy="terms" />} />
        <Route path="/privacy" element={<PolicyPage policy="privacy" />} />
        <Route path="/refund" element={<PolicyPage policy="refund" />} />
        <Route path="/set-mpin" element={<SetMpin />} />
        <Route path="/visitor/register" element={<VisitorRegister />} />
        <Route path="/visitor/welcome" element={<VisitorWelcome />} />
        <Route
          path="/subscription"
          element={
            <RequireAuth>
              <Subscription />
            </RequireAuth>
          }
        />
        <Route
          element={
            <RequireAuth>
              <RequireEntitlement>
                <Shell />
              </RequireEntitlement>
            </RequireAuth>
          }
        >
          <Route index element={<RoleHome />} />
          <Route path="help" element={<HelpDesk />} />

          <Route path="directory" element={<Only role="member"><Directory /></Only>} />
          <Route path="directory/:id" element={<Only role="member"><MemberView /></Only>} />
          <Route path="attendance" element={<Only role="member"><Attendance /></Only>} />
          <Route path="office-bearers" element={<Only role="member"><OfficeBearers /></Only>} />
          <Route path="rsvp" element={<Only role="member"><RsvpMember /></Only>} />
          <Route path="dues" element={<Only role="member"><Dues /></Only>} />
          <Route path="due-list" element={<Only role="member"><DueList /></Only>} />
          <Route path="wishes" element={<Only role="member"><Wishes /></Only>} />
          <Route path="profile" element={<Only role="member"><MyProfile /></Only>} />
          <Route path="visitor" element={<OnlyVisitorHost><VisitorQr /></OnlyVisitorHost>} />
          <Route path="meetings" element={<OnlyHeadTable><Meetings /></OnlyHeadTable>} />
          <Route path="team" element={<OnlyHeadTable><ChapterTeam /></OnlyHeadTable>} />
          <Route path="manage-rsvp" element={<OnlyHeadTable><ManageRsvp /></OnlyHeadTable>} />
          <Route path="payments" element={<OnlyHeadTable><ManagePayments /></OnlyHeadTable>} />
          <Route path="payments/request" element={<OnlyHeadTable><PaymentRequest /></OnlyHeadTable>} />
          <Route path="payments/update" element={<OnlyHeadTable><PaymentUpdate /></OnlyHeadTable>} />
          <Route path="payments/manual-update" element={<OnlyHeadTable><PaymentManualUpdate /></OnlyHeadTable>} />
          <Route path="payments/collection" element={<OnlyHeadTable><CollectionReport /></OnlyHeadTable>} />
          <Route path="payments/heads" element={<OnlyHeadTable><AccountHeads /></OnlyHeadTable>} />
          <Route path="accounts" element={<OnlyHeadTable><Accounts /></OnlyHeadTable>} />
          <Route path="accounts/modes" element={<OnlyHeadTable><ModesOfPay /></OnlyHeadTable>} />
          <Route path="accounts/financial-year" element={<OnlyHeadTable><FinancialYearSettings /></OnlyHeadTable>} />
          <Route path="accounts/banks" element={<OnlyHeadTable><BankAccounts /></OnlyHeadTable>} />
          <Route path="accounts/heads" element={<OnlyHeadTable><AccountHeads /></OnlyHeadTable>} />
          <Route path="accounts/vouchers" element={<OnlyHeadTable><Vouchers /></OnlyHeadTable>} />
          <Route path="accounts/vouchers/payment" element={<OnlyHeadTable><VoucherBook kind="payment" /></OnlyHeadTable>} />
          <Route path="accounts/vouchers/receipt" element={<OnlyHeadTable><VoucherBook kind="receipt" /></OnlyHeadTable>} />
          <Route path="settings" element={<OnlyHeadTable><ChapterSettings /></OnlyHeadTable>} />
          <Route path="reports" element={<OnlyHeadTable><Reports /></OnlyHeadTable>} />
          <Route path="reports/dues" element={<OnlyHeadTable><DuesReport /></OnlyHeadTable>} />
          <Route path="reports/ledger" element={<OnlyHeadTable><LedgerReport /></OnlyHeadTable>} />
          <Route path="reports/attendance" element={<OnlyHeadTable><AttendanceReport /></OnlyHeadTable>} />
          <Route path="reports/app-usage" element={<OnlyHeadTable><AppUsageReport /></OnlyHeadTable>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
      </ConfirmProvider>
    </ToastProvider>
    </MotionConfig>
    </LazyMotion>
  )
}
