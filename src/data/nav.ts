import { Award, BookUser, CalendarCheck, House, IndianRupee, PartyPopper } from 'lucide-react'
import type { ComponentType } from 'react'
import type { LucideProps } from 'lucide-react'
import type { Role, Tone } from '../lib/types'

export interface NavItem {
  to: string
  label: string
  /** A shorter name for the narrow bottom bar on phones and tablets. */
  short?: string
  icon: ComponentType<LucideProps>
  tone: Tone
  end?: boolean
  /** Shows a number on the icon: how many dues are pending. */
  badge?: 'dues'
  /** Shown only to members whose designation is ticked "Head Table". */
  headTable?: boolean
}

export const NAV: Record<Role, NavItem[]> = {
  /* the admin dashboards are gone from this app: nothing to show these two roles */
  super_admin: [],
  region_admin: [],
  member: [
    { to: '/', label: 'Home', icon: House, tone: 'gold', end: true },
    { to: '/directory', label: 'E-Directory', icon: BookUser, tone: 'red' },
    { to: '/attendance', label: 'Attendance', icon: CalendarCheck, tone: 'green' },
    { to: '/office-bearers', label: 'Office Bearers', short: 'Bearers', icon: Award, tone: 'wine' },
    { to: '/wishes', label: 'Wishes', icon: PartyPopper, tone: 'navy' },
    { to: '/dues', label: 'Dues', icon: IndianRupee, tone: 'gold', badge: 'dues' },
  ],
}

export const HOME: Record<Role, string> = {
  super_admin: '/',
  region_admin: '/',
  member: '/',
}
