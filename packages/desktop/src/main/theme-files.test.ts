import { describe, expect, test } from "bun:test"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { listThemes } from "./theme-files"

const desktopVariant = {
  palette: {
    neutral: "#ffffff",
    ink: "#171311",
    primary: "#dcde8d",
    success: "#12c905",
    warning: "#ffdc17",
    error: "#fc533a",
    info: "#a753ae",
  },
}

describe("theme-files", () => {
  test("listThemes reads desktop-format themes and skips other files", async () => {
    const root = await mkdtemp(join(tmpdir(), "opencode-theme-files-"))
    const previous = process.env.XDG_CONFIG_HOME
    process.env.XDG_CONFIG_HOME = root
    try {
      await mkdir(join(root, "opencode", "themes"), { recursive: true })
      await writeFile(
        join(root, "opencode", "themes", "custom.json"),
        JSON.stringify({ name: "Custom", id: "theme-files-test", light: desktopVariant, dark: desktopVariant }),
      )
      await writeFile(join(root, "opencode", "themes", "tui-format.json"), JSON.stringify({ theme: { primary: "#fff" } }))
      await writeFile(join(root, "opencode", "themes", "invalid.json"), "{ not json")

      const themes = await listThemes()
      expect(themes["theme-files-test"]?.id).toBe("theme-files-test")
      expect(themes["tui-format"]).toBeUndefined()
      expect(themes["invalid"]).toBeUndefined()
    } finally {
      if (previous === undefined) delete process.env.XDG_CONFIG_HOME
      else process.env.XDG_CONFIG_HOME = previous
      await rm(root, { recursive: true, force: true })
    }
  })
})
