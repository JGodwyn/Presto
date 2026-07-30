"use client"

import * as React from "react"

// TEMPORARY dev-only diagnostic — remove once the section-switch flicker is
// solved. Records every observable change of the page area (which section's
// content is showing, whether the tap-time overlay and/or the loading spinner
// are up, and the pathname) into a ring buffer mirrored to localStorage, so a
// flicker seen during normal browsing leaves a readable trace afterwards.
// Renders nothing.

const STORAGE_KEY = "presto:flicker-log"
const MAX_ENTRIES = 600

export function FlickerProbe() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "development") return

    type Entry = {
      t: number
      p: string
      pg: string
      ov: boolean
      sp: number
    }

    let log: Entry[] = []
    try {
      const prior = localStorage.getItem(STORAGE_KEY)
      if (prior) log = JSON.parse(prior) as Entry[]
    } catch {
      log = []
    }
    log.push({
      t: Date.now(),
      p: "((page-load))",
      pg: "((page-load))",
      ov: false,
      sp: 0,
    })

    const fingerprint = (): Omit<Entry, "t"> => {
      const m = document.querySelector("main")
      const p = location.pathname.split("/").pop() ?? ""
      if (!m) return { p, pg: "NO-MAIN", ov: false, sp: 0 }
      const ov = !!m.querySelector("div.absolute.inset-0.bg-surface-3")
      const txt = (m.textContent ?? "").trim()
      const pg = txt.length < 5 ? "EMPTY" : txt.slice(0, 40)
      const sp = m.querySelectorAll("[class*='animate-spin']").length
      return { p, pg, ov, sp }
    }

    let lastKey = ""
    let writeTimer: ReturnType<typeof setTimeout> | null = null
    const scheduleWrite = () => {
      if (writeTimer !== null) return
      writeTimer = setTimeout(() => {
        writeTimer = null
        try {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(log.slice(-MAX_ENTRIES))
          )
        } catch {
          // Quota or private mode — diagnostics only, never break the app.
        }
      }, 300)
    }

    const record = () => {
      const f = fingerprint()
      const key = JSON.stringify(f)
      if (key === lastKey) return
      lastKey = key
      log.push({ t: Date.now(), ...f })
      if (log.length > MAX_ENTRIES) log = log.slice(-MAX_ENTRIES)
      scheduleWrite()
    }

    record()
    const mo = new MutationObserver(record)
    mo.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    })
    return () => {
      mo.disconnect()
      if (writeTimer !== null) clearTimeout(writeTimer)
    }
  }, [])

  return null
}
