"use client"

import NumberFlow from "@number-flow/react"
import type { Icon } from "@phosphor-icons/react"

import { DashboardCard } from "@/components/dashboard/dashboard-card"

// The two stat shapes the "DashboardDesign" export uses. They differ only in
// their label treatment and whether they carry a border, but the difference is
// meaningful: the bordered one sits *inside* the Total-posts card (on white,
// so it needs an edge) and labels itself in text-bold, while the plain one
// sits on the canvas and labels itself in subtle — it's the caption of its own
// number rather than a heading over a breakdown.
//
// Both animate through @number-flow/react, as the Generate page's stepper and
// scheduled-posts counter already do, so a figure that changes under you rolls
// rather than snaps.

function StatBody({
  icon: StatIcon,
  value,
  caption,
}: {
  icon: Icon
  value: number
  caption: string
}) {
  return (
    <>
      <span className="flex items-center gap-dist-md">
        <StatIcon weight="bold" className="size-6 shrink-0 text-icon-bold" />
        <NumberFlow
          value={value}
          className="text-heading-lg font-display text-text-bold"
        />
      </span>
      <span className="text-body-md text-text-subtle">{caption}</span>
    </>
  )
}

// The three cards inside the Total-posts card: Drafts / Queued / Published.
export function MiniStatCard({
  label,
  icon,
  value,
  caption,
}: {
  label: string
  icon: Icon
  value: number
  caption: string
}) {
  return (
    <DashboardCard bordered className="min-w-0 flex-1">
      <span className="truncate text-body-lg text-text-bold">{label}</span>
      <StatBody icon={icon} value={value} caption={caption} />
    </DashboardCard>
  )
}

// The three cards on the row below it: Still to go out / Written this week /
// Empty days ahead.
export function StatCard({
  label,
  icon,
  value,
  caption,
}: {
  label: string
  icon: Icon
  value: number
  caption: string
}) {
  return (
    <DashboardCard className="min-w-0 flex-1">
      <span className="truncate text-body-lg-bold text-text-subtle">{label}</span>
      <StatBody icon={icon} value={value} caption={caption} />
    </DashboardCard>
  )
}
