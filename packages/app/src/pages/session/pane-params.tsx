import { useParams } from "@solidjs/router"
import { createContext, useContext, type Accessor, type ParentProps } from "solid-js"

// Pane params let a split pane impersonate a URL route. Session chrome is
// keyed off the browser URL, so panes that are not represented in the URL
// (e.g. a session split to the side of the active one) need a local override
// of the route params. useSessionParams below merges those overrides on top of
// the real URL params so every consumer of useParams() inside a pane behaves as
// if the pane's session were the active route.
const PaneParamsContext = createContext<Accessor<Record<string, string>> | undefined>()

export function PaneParamsProvider(props: ParentProps<{ value: Accessor<Record<string, string>> }>) {
  return <PaneParamsContext.Provider value={props.value}>{props.children}</PaneParamsContext.Provider>
}

export function useSessionParams() {
  const paneParams = useContext(PaneParamsContext)
  const params = useParams()
  if (!paneParams) return params

  // Wrapping the router's reactive params proxy keeps subscriptions intact: the
  // override accessor is re-read on every property access, and properties that
  // are not overridden still track the underlying URL params.
  return new Proxy(params, {
    get(target, property, receiver) {
      const overrides = paneParams()
      if (typeof property === "string" && property in overrides) return overrides[property]
      return Reflect.get(target, property, receiver)
    },
  })
}

// A pane can be "chrome-active" even though it is not represented in the URL:
// only the active pane owns the titlebar mounts and the global command palette
// so several panes do not fight over shared chrome.
const PaneChromeContext = createContext<Accessor<boolean> | undefined>()

export function PaneChromeProvider(props: ParentProps<{ active: Accessor<boolean> }>) {
  return <PaneChromeContext.Provider value={props.active}>{props.children}</PaneChromeContext.Provider>
}

export function usePaneChrome() {
  const active = useContext(PaneChromeContext)
  if (!active) return () => true
  return active
}
