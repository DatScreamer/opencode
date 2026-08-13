import { createMemo, createSignal, For, type ParentProps, Show } from "solid-js"
import { createResizeObserver } from "@solid-primitives/resize-observer"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { ResizeHandle } from "@opencode-ai/ui/resize-handle"
import { useLayout } from "@/context/layout"
import { useTabs, tabKey, type SplitPane } from "@/context/tabs"
import { useGlobal } from "@/context/global"
import { ServerConnection } from "@/context/server"
import { useLanguage } from "@/context/language"
import { PaneChromeProvider } from "./pane-params"
import { SessionPane } from "./session-pane"

const MIN_PANE_FRACTION = 0.12

type PaneEntry = { id: string; primary: boolean; pane?: SplitPane }

// Renders the current browser tab's content. When the tab is split, the panes
// are laid out side by side as Material-style surfaces with a draggable handle
// between them; otherwise the routed page renders directly. The routed page is
// always mounted inside the primary pane (a stable entry) so splitting does not
// reset its state.
export function SplitPanesView(props: ParentProps) {
  const layout = useLayout()
  const tabs = useTabs()

  const currentTab = createMemo(() => {
    const route = layout.route()
    if (route.type === "session") {
      return tabs.store.find(
        (tab) => tab.type === "session" && tab.server === route.server && tab.sessionId === route.sessionId,
      )
    }
    if (route.type === "draft") {
      return tabs.store.find((tab) => tab.type === "draft" && tab.draftID === route.draftID)
    }
    return undefined
  })

  const key = createMemo(() => {
    const tab = currentTab()
    return tab ? tabKey(tab) : undefined
  })

  const split = createMemo(() => {
    const k = key()
    if (!k) return
    const value = tabs.split[k]
    if (!value || value.panes.length <= 1) return
    if (!value.panes.some((pane) => pane.id === k)) return
    return value
  })

  const primary = createMemo<PaneEntry>(() => {
    const tab = currentTab()
    const k = key()
    if (!tab || !k) return { id: k ?? "primary", primary: true }
    return tab.type === "session"
      ? { id: k, primary: true, pane: { id: k, server: tab.server, sessionId: tab.sessionId } }
      : { id: k, primary: true }
  })

  const entries = createMemo(() => {
    const current = split()
    if (!current) return [primary()]
    const k = key()
    return current.panes.map((pane) => (pane.id === k ? primary() : { id: pane.id, primary: false, pane }))
  })

  const activePaneId = createMemo(() => {
    const current = split()
    if (!current) return key()
    return current.activePaneId ?? current.panes[0]?.id
  })

  return (
    <SplitPanesRow tabKey={key()} split={split()} sizes={split()?.sizes} entries={entries()} activePaneId={activePaneId()}>
      {props.children}
    </SplitPanesRow>
  )
}

function SplitPanesRow(
  props: ParentProps<{
    tabKey?: string
    split?: { panes: SplitPane[]; activePaneId?: string; sizes: number[] }
    sizes?: number[]
    entries: PaneEntry[]
    activePaneId?: string
  }>,
) {
  const tabs = useTabs()
  const language = useLanguage()
  const global = useGlobal()
  let rootRef!: HTMLDivElement
  const [width, setWidth] = createSignal(0)
  createResizeObserver(
    () => rootRef,
    (rect) => setWidth(rect.width),
  )

  const splitMode = () => props.split !== undefined
  const sizes = () => {
    if (!props.split) return [1]
    const count = props.entries.length
    const next = props.sizes
    if (!next || next.length !== count) return Array.from({ length: count }, () => 1 / count)
    return next
  }
  const boundaryBefore = (index: number) => sizes().slice(0, index).reduce((sum, size) => sum + size, 0)

  const setBoundary = (index: number, boundaryPx: number) => {
    const total = width()
    if (total <= 0) return
    if (!props.tabKey || !props.split) return
    const beforeCount = index
    const afterCount = props.entries.length - index
    const boundary = clamp(boundaryPx / total, beforeCount * MIN_PANE_FRACTION, 1 - afterCount * MIN_PANE_FRACTION)
    const before = sizes().slice(0, beforeCount)
    const after = sizes().slice(beforeCount)
    const beforeSum = before.reduce((sum, size) => sum + size, 0)
    const afterSum = after.reduce((sum, size) => sum + size, 0)
    const next = [
      ...before.map((size) => (size / beforeSum) * boundary),
      ...after.map((size) => (size / afterSum) * (1 - boundary)),
    ]
    tabs.setPaneSizes(props.tabKey, next)
  }

  return (
    <div ref={rootRef} data-split-panes class="relative flex h-full min-h-0 w-full flex-row items-stretch">
      <For each={props.entries}>
        {(entry, index) => {
          const active = entry.primary ? props.activePaneId === props.tabKey : props.activePaneId === entry.id
          return (
            <div
              data-split-pane
              data-active={active}
              data-primary={entry.primary}
              class="flex h-full min-w-0 flex-col"
              style={{ flex: `${sizes()[index()]} 1 0%` }}
              onClick={() => {
                if (!props.tabKey) return
                if (props.activePaneId === entry.id) return
                tabs.setActivePane(props.tabKey, entry.id)
              }}
            >
              <Show when={splitMode()}>
                <div data-split-pane-header class="flex h-8 shrink-0 items-center gap-1.5 px-2" data-active={active}>
                  <span
                    data-split-pane-dot
                    class="size-1.5 shrink-0 rounded-full"
                    classList={{
                      "bg-v2-icon-icon-accent": active,
                      "bg-v2-border-border-base": !active,
                    }}
                    aria-hidden="true"
                  />
                  <Show when={entry.pane}>
                    {(pane) => (
                      <span
                        data-split-pane-title
                        class="min-w-0 flex-1 truncate text-[13px] font-medium"
                        classList={{
                          "text-v2-text-text-base": active,
                          "text-v2-text-text-muted": !active,
                        }}
                      >
                        {paneTitle(global, pane().server, pane().sessionId) ?? language.t("session.tab.unknown")}
                      </span>
                    )}
                  </Show>
                  <Show when={!entry.primary && props.tabKey}>
                    <IconButtonV2
                      size="small"
                      variant="ghost-muted"
                      aria-label={language.t("tab.split.close")}
                      icon={<IconV2 name="xmark-small" />}
                      onClick={(event) => {
                        event.stopPropagation()
                        tabs.removeSplitPane(props.tabKey!, entry.id)
                      }}
                    />
                  </Show>
                </div>
              </Show>
              <div class="flex min-h-0 min-w-0 flex-1 flex-col">
                <PaneChromeProvider active={() => active}>
                  {entry.primary ? props.children : <SessionPane pane={entry.pane!} />}
                </PaneChromeProvider>
              </div>
            </div>
          )
        }}
      </For>

      <For each={props.entries}>
        {(entry, index) => (
          <Show when={props.split && index() > 0}>
            <ResizeHandle
              direction="horizontal"
              data-split-divider
              size={boundaryBefore(index()) * Math.max(width(), 1)}
              min={index() * MIN_PANE_FRACTION * Math.max(width(), 1)}
              max={(1 - (props.entries.length - index()) * MIN_PANE_FRACTION) * Math.max(width(), 1)}
              onResize={(value) => setBoundary(index(), value)}
              class="absolute inset-y-0 z-10 w-[7px] cursor-col-resize"
              style={{ "inset-inline-start": `${boundaryBefore(index()) * 100}%`, "margin-inline-start": "-3.5px" }}
            >
              <span
                data-split-divider-grip
                class="absolute top-1/2 left-1/2 h-8 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-v2-border-border-base opacity-0 transition-opacity hover:opacity-100"
                aria-hidden="true"
              />
            </ResizeHandle>
          </Show>
        )}
      </For>
    </div>
  )
}

function paneTitle(global: ReturnType<typeof useGlobal>, server: ServerConnection.Key, sessionId: string) {
  const conn = global.servers.list().find((item) => ServerConnection.key(item) === server)
  if (!conn) return
  return global.ensureServerCtx(conn).sync.session.get(sessionId)?.title
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
