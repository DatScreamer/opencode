import { describe, expect, test } from "bun:test"
import type { ServerConnection } from "./server"
import type { SessionTab } from "./tabs"
import {
  applySplitTab,
  migrateTabSplit,
  removePaneFromSplit,
  removeSplitsFor,
  type SplitPane,
  type TabSplit,
} from "./split-tabs"

const server = "local\nhttp://localhost:4096" as ServerConnection.Key

const host: SessionTab = { type: "session", server, sessionId: "a" }
const key = `${server}\n/server/${btoa(server)}/session/a`
const primary: SplitPane = { id: key, server, sessionId: "a" }

const pane = (sessionId: string, id = `pane:${sessionId}`): SplitPane => ({ id, server, sessionId })

function split(...panes: SplitPane[]): TabSplit {
  return { panes, activePaneId: panes.at(-1)?.id, sizes: panes.map(() => 1 / panes.length) }
}

const sessionIds = (value: TabSplit) => value.panes.map((p) => p.sessionId)
const idOf = (value: TabSplit, sessionId: string) => value.panes.find((p) => p.sessionId === sessionId)?.id

describe("applySplitTab", () => {
  test("splits right onto a fresh split", () => {
    const next = applySplitTab(undefined, { key, host, side: "right", target: { server, sessionId: "b" } })

    expect(sessionIds(next)).toEqual(["a", "b"])
    expect(next.activePaneId).toBe(idOf(next, "b"))
    expect(next.sizes).toEqual([0.5, 0.5])
  })

  test("splits left onto a fresh split", () => {
    const next = applySplitTab(undefined, { key, host, side: "left", target: { server, sessionId: "b" } })

    expect(sessionIds(next)).toEqual(["b", "a"])
  })

  test("inserts next to the active pane on an existing split", () => {
    const current = split(primary, pane("b"))
    current.activePaneId = current.panes[0]?.id

    const next = applySplitTab(current, { key, host, side: "right", target: { server, sessionId: "c" } })

    expect(sessionIds(next)).toEqual(["a", "c", "b"])
  })

  test("activates an already-present session instead of duplicating it", () => {
    const current = split(primary, pane("b"))
    current.activePaneId = primary.id

    const next = applySplitTab(current, { key, host, side: "right", target: { server, sessionId: "b" } })

    expect(next.panes).toHaveLength(2)
    expect(next.activePaneId).toBe(idOf(next, "b"))
  })

  test("keeps the primary pane id stable as the host tab key", () => {
    const next = applySplitTab(undefined, { key, host, side: "right", target: { server, sessionId: "b" } })

    expect(next.panes[0]).toEqual(primary)
  })
})

describe("removePaneFromSplit", () => {
  test("degrades a two-pane split back to an unsplit tab", () => {
    const current = split(primary, pane("b"))

    expect(removePaneFromSplit(current, idOf(current, "b") ?? "")).toBeUndefined()
  })

  test("keeps a multi-pane split and repoints the active pane", () => {
    const current = split(primary, pane("b"), pane("c"))
    current.activePaneId = idOf(current, "c")

    const next = removePaneFromSplit(current, idOf(current, "c") ?? "")

    expect(sessionIds(next!)).toEqual(["a", "b"])
    expect(next?.activePaneId).toBe(idOf(next!, "b"))
    expect(next?.sizes).toEqual([0.5, 0.5])
  })
})

describe("removeSplitsFor", () => {
  test("drops layouts whose host tab is gone", () => {
    expect(removeSplitsFor({ [key]: split(primary, pane("b")) }, { keys: [key] })).toEqual({})
  })

  test("drops panes for removed sessions and repoints the active pane", () => {
    const layout = split(primary, pane("b"), pane("c"), pane("d"))
    layout.activePaneId = idOf(layout, "c")

    const next = removeSplitsFor({ [key]: layout }, { server, sessionIds: ["a", "c"] })

    expect(sessionIds(next[key])).toEqual(["b", "d"])
    expect(next[key].activePaneId).toBe(idOf(next[key], "d"))
    expect(next[key].sizes).toEqual([0.5, 0.5])
  })

  test("degrades layouts left with a single pane", () => {
    const next = removeSplitsFor({ [key]: split(primary, pane("b")) }, { server, sessionIds: ["b"] })

    expect(next[key]).toBeUndefined()
  })
})

describe("migrateTabSplit", () => {
  test("passes through valid layouts", () => {
    const value = { [key]: split(primary, pane("b")) }
    expect(migrateTabSplit(value)).toEqual(value)
  })

  test("repairs malformed layouts", () => {
    const migrated = migrateTabSplit({
      [key]: { panes: [{ id: key, server, sessionId: "a" }], activePaneId: "missing", sizes: [] },
    }) as Record<string, TabSplit>

    expect(migrated[key].sizes).toEqual([1])
    expect(migrated[key].activePaneId).toBe(key)
  })

  test("drops invalid top-level data", () => {
    expect(migrateTabSplit(null)).toBeNull()
    expect(migrateTabSplit({ [key]: "nope" })).toEqual({})
  })
})
