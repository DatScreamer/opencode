import type { ServerConnection } from "./server"
import { uuid } from "@/utils/uuid"

// A session pane shown inside a split browser tab. Panes may reference sessions
// that are not open as their own tabs.
export type SplitPane = {
  id: string
  server: ServerConnection.Key
  sessionId: string
}

// Split layout of a single browser tab, keyed by the tab key of the host tab.
// `panes[0]` is the primary pane: it owns the tab identity (its URL drives the
// route). `sizes` are fractional widths aligned with `panes` (they sum to ~1);
// the drag handle redistributes them.
export type TabSplit = {
  panes: SplitPane[]
  activePaneId?: string
  sizes: number[]
}

const equalSizes = (panes: SplitPane[]) => panes.map(() => 1 / panes.length)

// Splits the tab of `host` so `target` joins it on the requested side. On a
// fresh split the primary pane is the host itself; on an already-split tab the
// new pane lands next to the active pane. Splitting a session that is already
// present just activates that pane.
export function applySplitTab(
  current: TabSplit | undefined,
  input: {
    key: string
    host: { server: ServerConnection.Key; sessionId: string }
    side: "left" | "right"
    target: Omit<SplitPane, "id">
  },
): TabSplit {
  if (current) {
    const existing = current.panes.find(
      (pane) => pane.server === input.target.server && pane.sessionId === input.target.sessionId,
    )
    if (existing) return { ...current, activePaneId: existing.id }
  }

  const hostPane: SplitPane = { id: input.key, server: input.host.server, sessionId: input.host.sessionId }
  const panes = current?.panes.length ? [...current.panes] : [hostPane]
  const targetPane: SplitPane = { id: uuid(), ...input.target }
  const activeIndex = panes.findIndex((pane) => pane.id === current?.activePaneId)
  const insertAt =
    activeIndex === -1 ? (current ? panes.length : input.side === "left" ? 0 : panes.length) : input.side === "left" ? activeIndex : activeIndex + 1
  panes.splice(insertAt, 0, targetPane)
  return { panes, activePaneId: targetPane.id, sizes: equalSizes(panes) }
}

// Removes a pane. `undefined` means the split degrades back to an unsplit tab.
export function removePaneFromSplit(current: TabSplit, paneId: string): TabSplit | undefined {
  const panes = current.panes.filter((pane) => pane.id !== paneId)
  if (panes.length === current.panes.length) return current
  if (panes.length <= 1) return undefined
  return {
    panes,
    activePaneId: panes.some((pane) => pane.id === current.activePaneId) ? current.activePaneId : panes.at(-1)?.id,
    sizes: equalSizes(panes),
  }
}

// Drops split layouts whose tabs or panes are going away. A layout left with a
// single pane degrades back to the ordinary (unsplit) tab.
export function removeSplitsFor(
  split: Record<string, TabSplit>,
  input: { keys?: string[]; server?: ServerConnection.Key; sessionIds?: string[] },
): Record<string, TabSplit> {
  const next: Record<string, TabSplit> = {}
  for (const key of Object.keys(split)) {
    const current = split[key]
    if (input.keys?.includes(key)) continue
    const panes = current.panes.filter(
      (pane) =>
        !(input.server && pane.server === input.server && (!input.sessionIds || input.sessionIds.includes(pane.sessionId))),
    )
    if (panes.length === current.panes.length) {
      next[key] = current
      continue
    }
    if (panes.length <= 1) continue
    next[key] = {
      panes,
      activePaneId: panes.some((pane) => pane.id === current.activePaneId) ? current.activePaneId : panes.at(-1)?.id,
      sizes: equalSizes(panes),
    }
  }
  return next
}

export function migrateTabSplit(value: unknown) {
  if (!isRecord(value)) return value

  const next: Record<string, TabSplit> = {}
  let changed = false
  for (const [key, raw] of Object.entries(value)) {
    if (!isRecord(raw) || !Array.isArray(raw.panes) || raw.panes.length === 0) {
      changed = true
      continue
    }
    const panes: SplitPane[] = []
    for (const pane of raw.panes) {
      if (
        !isRecord(pane) ||
        typeof pane.id !== "string" ||
        typeof pane.server !== "string" ||
        typeof pane.sessionId !== "string"
      ) {
        changed = true
        continue
      }
      panes.push({ id: pane.id, server: pane.server as ServerConnection.Key, sessionId: pane.sessionId })
    }
    if (panes.length === 0) {
      changed = true
      continue
    }
    const sizes =
      Array.isArray(raw.sizes) && raw.sizes.length === panes.length && raw.sizes.every((size) => typeof size === "number")
        ? raw.sizes
        : equalSizes(panes)
    if (!Array.isArray(raw.sizes) || raw.sizes.length !== sizes.length) changed = true
    const activePaneId =
      typeof raw.activePaneId === "string" && panes.some((pane) => pane.id === raw.activePaneId)
        ? raw.activePaneId
        : panes.at(-1)?.id
    if (activePaneId !== raw.activePaneId) changed = true
    next[key] = { panes, activePaneId, sizes }
  }
  if (!changed) return value
  return next
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
