"use client"

import Link from "next/link"
import { Gear, User } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

export function Navbar() {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="mr-2 h-4!" />
      <div className="flex flex-1" />
      <Button variant="ghost" size="icon" render={<Link href="/settings" aria-label="Settings" />}>
        <Gear weight="bold" />
      </Button>
      <Button variant="ghost" size="icon" render={<Link href="/profile" aria-label="Profile" />}>
        <User weight="bold" />
      </Button>
    </header>
  )
}
