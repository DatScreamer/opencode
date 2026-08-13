import type { DesktopTheme } from "./types"

export function isDesktopTheme(value: unknown): value is DesktopTheme {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false
  const theme = value as Record<string, unknown>
  return (
    typeof theme.name === "string" &&
    typeof theme.id === "string" &&
    typeof theme.light === "object" &&
    theme.light !== null &&
    !Array.isArray(theme.light) &&
    typeof theme.dark === "object" &&
    theme.dark !== null &&
    !Array.isArray(theme.dark)
  )
}
