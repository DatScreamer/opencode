import { describe, expect, test } from "bun:test"
import { isDesktopTheme } from "./validate"

const variant = {
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

test("isDesktopTheme accepts a valid desktop theme", () => {
  expect(isDesktopTheme({ name: "Test", id: "test", light: variant, dark: variant })).toBe(true)
})

test("isDesktopTheme rejects tui-format themes", () => {
  expect(isDesktopTheme({ defs: {}, theme: { primary: "#ffffff" } })).toBe(false)
})

test("isDesktopTheme rejects malformed values", () => {
  expect(isDesktopTheme(null)).toBe(false)
  expect(isDesktopTheme("oc-2")).toBe(false)
  expect(isDesktopTheme({ name: "Test", id: "test" })).toBe(false)
  expect(isDesktopTheme({ name: "Test", id: "test", light: variant })).toBe(false)
  expect(isDesktopTheme({ name: "Test", id: "test", light: [], dark: [] })).toBe(false)
})
