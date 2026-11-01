import { describe, it, expect } from "vitest"
import { z } from "zod"
import {
  fdStr,
  fdOptStr,
  fdNum,
  fdBool,
  fdStrList,
  hasField,
  zodIssuesToFieldErrors,
} from "@/lib/forms/form-data"

// F1: pure gates for the React 19 `action={}` form migration —
// FormData parsing must be defensive (absent/empty/garbage) and
// zod issue mapping must collapse to per-field messages.

describe("fdStr", () => {
  it("reads a present string value", () => {
    const fd = new FormData()
    fd.set("name", " Masaza ")
    expect(fdStr(fd, "name")).toBe(" Masaza ")
  })

  it("returns empty string for absent field or File value", () => {
    const fd = new FormData()
    fd.set("file", new File(["x"], "x.png"))
    expect(fdStr(fd, "missing")).toBe("")
    expect(fdStr(fd, "file")).toBe("")
  })
})

describe("fdOptStr", () => {
  it("trims and returns undefined for empty/absent", () => {
    const fd = new FormData()
    fd.set("description", "   ")
    expect(fdOptStr(fd, "description")).toBeUndefined()
    expect(fdOptStr(fd, "missing")).toBeUndefined()
    fd.set("description", "  Opis  ")
    expect(fdOptStr(fd, "description")).toBe("Opis")
  })
})

describe("fdNum", () => {
  it("parses numeric strings", () => {
    const fd = new FormData()
    fd.set("price", "85.5")
    fd.set("duration", " 60 ")
    expect(fdNum(fd, "price")).toBe(85.5)
    expect(fdNum(fd, "duration")).toBe(60)
  })

  it("returns undefined for empty, absent and NaN garbage", () => {
    const fd = new FormData()
    fd.set("price", "")
    fd.set("bad", "abc")
    expect(fdNum(fd, "price")).toBeUndefined()
    expect(fdNum(fd, "bad")).toBeUndefined()
    expect(fdNum(fd, "missing")).toBeUndefined()
  })
})

describe("fdBool", () => {
  it("accepts true/on/1 and rejects everything else", () => {
    const fd = new FormData()
    fd.set("a", "true")
    fd.set("b", "on")
    fd.set("c", "1")
    fd.set("d", "false")
    fd.set("e", "")
    expect(fdBool(fd, "a")).toBe(true)
    expect(fdBool(fd, "b")).toBe(true)
    expect(fdBool(fd, "c")).toBe(true)
    expect(fdBool(fd, "d")).toBe(false)
    expect(fdBool(fd, "e")).toBe(false)
    expect(fdBool(fd, "missing")).toBe(false)
  })
})

describe("fdStrList", () => {
  it("collects multiple string values, skipping empty", () => {
    const fd = new FormData()
    fd.append("staffIds", "s1")
    fd.append("staffIds", "")
    fd.append("staffIds", "s2")
    fd.append("images", new File([], "x.png"))
    expect(fdStrList(fd, "staffIds")).toEqual(["s1", "s2"])
    expect(fdStrList(fd, "images")).toEqual([])
    expect(fdStrList(fd, "missing")).toEqual([])
  })
})

describe("hasField", () => {
  it("reports presence regardless of value", () => {
    const fd = new FormData()
    fd.set("x", "")
    expect(hasField(fd, "x")).toBe(true)
    expect(hasField(fd, "y")).toBe(false)
  })
})

describe("zodIssuesToFieldErrors", () => {
  const schema = z.object({
    name: z.string().min(2),
    price: z.number().min(0),
    staffIds: z.array(z.string()).optional(),
  })

  it("maps first message per field, collapsing nested paths", () => {
    const result = schema.safeParse({
      name: "x",
      price: -5,
      staffIds: [42 as unknown as string],
    })
    expect(result.success).toBe(false)
    if (result.success) return
    const errors = zodIssuesToFieldErrors(result.error)
    expect(Object.keys(errors).sort()).toEqual(["name", "price", "staffIds"])
    expect(errors.name).toMatch(/2 characters/)
    expect(typeof errors.price).toBe("string")
    expect(typeof errors.staffIds).toBe("string")
  })

  it("falls back to _form for pathless issues", () => {
    const result = z.string().refine(() => false, "nope").safeParse("x")
    expect(result.success).toBe(false)
    if (result.success) return
    const errors = zodIssuesToFieldErrors(result.error)
    expect(errors).toEqual({ _form: "nope" })
  })
})
