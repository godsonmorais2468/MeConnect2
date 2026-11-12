import { ArrowLeftRight, Award, BadgeCheck, BookUser, CalendarCheck, House, IndianRupee, Landmark, Layers, Map, PartyPopper, Smartphone, Users } from 'lucide-react'
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
  super_admin: [
    { to: '/admin/regions', label: 'Regions', icon: Map, tone: 'red' },
    { to: '/admin/plans', label: 'Plans', icon: Layers, tone: 'gold' },
    { to: '/admin/designations', label: 'Designation', icon: BadgeCheck, tone: 'steel' },
    { to: '/admin/heads', label: 'Income / Expense', icon: ArrowLeftRight, tone: 'green' },
    { to: '/admin/app-usage', label: 'App Usage', icon: Smartphone, tone: 'navy' },
  ],
  region_admin: [
    { to: '/region/chapters', label: 'Chapters', icon: Landmark, tone: 'wine' },
    { to: '/region/designations', label: 'Designation', icon: BadgeCheck, tone: 'steel' },
    { to: '/region/team', label: 'Chapter Team', icon: Users, tone: 'green' },
  ],
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
  super_admin: '/admin/regions',
  region_admin: '/region/chapters',
  member: '/',
}
