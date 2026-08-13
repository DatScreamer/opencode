import { createMemo, createResource, Show } from "solid-js"
import { base64Encode } from "@opencode-ai/core/util/encode"
import { ServerSDKProvider } from "@/context/server-sdk"
import { ServerSyncProvider, useServerSync } from "@/context/server-sync"
import { ModelsProvider } from "@/context/models"
import { SDKProvider } from "@/context/sdk"
import { useGlobal } from "@/context/global"
import { ServerConnection } from "@/context/server"
import type { SplitPane } from "@/context/tabs"
import { DirectoryDataProvider } from "@/pages/directory-layout"
import { SessionPage } from "@/pages/session"
import { PaneParamsProvider } from "./pane-params"

// Renders a session that is not the active URL route: a split pane needs its
// own server/directory providers and route params so SessionPage behaves as if
// the pane's session were the current route.
export function SessionPane(props: { pane: SplitPane }) {
  const global = useGlobal()
  const conn = createMemo(() =>
    global.servers.list().find((item) => ServerConnection.key(item) === props.pane.server),
  )

  return (
    <Show when={conn()} keyed>
      {(conn) => (
        <ServerSDKProvider server={() => conn}>
          <ServerSyncProvider server={() => conn}>
            <SessionPaneContent pane={props.pane} />
          </ServerSyncProvider>
        </ServerSDKProvider>
      )}
    </Show>
  )
}

function SessionPaneContent(props: { pane: SplitPane }) {
  const serverSync = useServerSync()
  const [directory] = createResource(
    () => props.pane.sessionId,
    (sessionID) => serverSync().session.resolve(sessionID).then((session) => session?.directory),
  )
  const params = () => ({
    id: props.pane.sessionId,
    serverKey: base64Encode(props.pane.server),
    server: props.pane.server,
  })

  return (
    <Show when={directory()} fallback={<SessionPaneLoading />}>
      {(dir) => (
        <SDKProvider directory={dir()}>
          <DirectoryDataProvider directory={dir()} server={() => props.pane.server}>
            <ModelsProvider directory={dir()}>
              <PaneParamsProvider value={params}>
                <SessionPage />
              </PaneParamsProvider>
            </ModelsProvider>
          </DirectoryDataProvider>
        </SDKProvider>
      )}
    </Show>
  )
}

function SessionPaneLoading() {
  return (
    <div class="flex h-full min-h-0 flex-1 items-center justify-center bg-v2-background-bg-base">
      <span
        class="size-4 rounded-full border border-v2-border-border-base border-t-v2-text-text-faint"
        style={{ animation: "spin 0.8s linear infinite" }}
        aria-label="Loading session"
      />
    </div>
  )
}
