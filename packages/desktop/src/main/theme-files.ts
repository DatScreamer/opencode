import { existsSync, watch as watchFile, type FSWatcher } from "node:fs"
import { readFile, readdir } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"
import { isDesktopTheme } from "@opencode-ai/ui/theme/validate"
import type { DesktopTheme } from "@opencode-ai/ui/theme/types"

export function themeDirectories() {
  const base = process.env.XDG_CONFIG_HOME ?? path.join(homedir(), ".config")
  const directories = [process.env.OPENCODE_CONFIG_DIR ?? path.join(base, "opencode")]
  for (let current = homedir(); ; current = path.dirname(current)) {
    directories.push(path.join(current, ".opencode"))
    if (path.dirname(current) === current) break
  }
  return directories
}

export async function listThemes(): Promise<Record<string, DesktopTheme>> {
  const result: Record<string, DesktopTheme> = {}
  for (const directory of themeDirectories()) {
    const themesDir = path.join(directory, "themes")
    if (!existsSync(themesDir)) continue
    let entries: string[]
    try {
      entries = await readdir(themesDir)
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.endsWith(".json")) continue
      try {
        const value = JSON.parse(await readFile(path.join(themesDir, entry), "utf8")) as unknown
        if (isDesktopTheme(value)) result[value.id] = value
      } catch {}
    }
  }
  return result
}

const THEME_WATCH_DEBOUNCE_MS = 150

function subscribeThemeChanges(directories: string[], onChange: () => void): () => void {
  const baseWatchers = new Set<FSWatcher>()
  const themesWatchers = new Map<string, FSWatcher>()

  let timeout: ReturnType<typeof setTimeout> | undefined
  const debounced = () => {
    clearTimeout(timeout)
    timeout = setTimeout(onChange, THEME_WATCH_DEBOUNCE_MS)
  }

  const watchThemes = (themesDir: string) => {
    if (themesWatchers.has(themesDir)) return
    const watcher = watchFile(themesDir, (_event, filename) => {
      if (typeof filename !== "string" || filename.endsWith(".json")) debounced()
    })
    watcher.on("error", () => {
      watcher.close()
      themesWatchers.delete(themesDir)
    })
    themesWatchers.set(themesDir, watcher)
  }

  const watchDirectory = (baseDir: string) => {
    const themesDir = path.join(baseDir, "themes")
    const reconcile = () => {
      if (existsSync(themesDir)) {
        try {
          watchThemes(themesDir)
        } catch {
          themesWatchers.delete(themesDir)
        }
        return
      }
      const watcher = themesWatchers.get(themesDir)
      if (!watcher) return
      watcher.close()
      themesWatchers.delete(themesDir)
    }
    reconcile()
    try {
      const baseWatcher = watchFile(baseDir, (_event, filename) => {
        if (filename !== "themes" && typeof filename === "string") return
        reconcile()
        debounced()
      })
      baseWatcher.on("error", () => {
        baseWatcher.close()
        baseWatchers.delete(baseWatcher)
      })
      baseWatchers.add(baseWatcher)
    } catch {}
  }

  for (const directory of directories) watchDirectory(directory)

  return () => {
    clearTimeout(timeout)
    for (const watcher of baseWatchers) watcher.close()
    for (const watcher of themesWatchers.values()) watcher.close()
    baseWatchers.clear()
    themesWatchers.clear()
  }
}

export function createThemeFilesWatcher() {
  const listeners = new Set<(themes: Record<string, DesktopTheme>) => void>()
  const refresh = async () => {
    const themes = await listThemes()
    for (const listener of listeners) listener(themes)
  }
  const unsubscribe = subscribeThemeChanges(themeDirectories(), () => void refresh())

  return {
    list: listThemes,
    subscribe(listener: (themes: Record<string, DesktopTheme>) => void) {
      listeners.add(listener)
      void refresh()
      return () => listeners.delete(listener)
    },
    dispose() {
      unsubscribe()
      listeners.clear()
    },
  }
}
