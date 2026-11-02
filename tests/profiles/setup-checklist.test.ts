import { describe, expect, it } from "vitest"
import { buildSetupChecklist, type SetupChecklistInput } from "@/lib/profiles/setup-checklist"

// A fully "salon" capable tenant with everything still to do.
const freshSalon: SetupChecklistInput = {
  verticalChosen: true,
  catalogTouched: false,
  catalogCapable: true,
  staffCount: 1,
  staffCapable: true,
  customerCount: 0,
  customersCapable: true,
  appointmentCount: 0,
  orderCount: 0,
  appointmentsCapable: true,
  workOrdersCapable: true,
  published: false,
}

describe("buildSetupChecklist", () => {
  it("fresh salon: only vertical is done, next action is catalog", () => {
    const c = buildSetupChecklist(freshSalon)
    expect(c.total).toBe(6)
    expect(c.doneCount).toBe(1)
    expect(c.allDone).toBe(false)
    expect(c.steps[0]).toMatchObject({ key: "vertical", done: true })
    expect(c.nextKey).toBe("catalog")
  })

  it("untouched guided entry makes the vertical step the next action", () => {
    const c = buildSetupChecklist({ ...freshSalon, verticalChosen: false })
    expect(c.steps[0].done).toBe(false)
    expect(c.nextKey).toBe("vertical")
  })

  it("catalog step completes only when the owner touched services or products", () => {
    const touched = buildSetupChecklist({ ...freshSalon, catalogTouched: true })
    expect(touched.steps.find((s) => s.key === "catalog")?.done).toBe(true)

    const untouched = buildSetupChecklist(freshSalon)
    expect(untouched.steps.find((s) => s.key === "catalog")?.done).toBe(false)
  })

  it("staff step tolerates the wizard-seeded owner (count 1 is not 'added staff')", () => {
    const one = buildSetupChecklist(freshSalon)
    expect(one.steps.find((s) => s.key === "staff")?.done).toBe(false)

    const two = buildSetupChecklist({ ...freshSalon, staffCount: 2 })
    expect(two.steps.find((s) => s.key === "staff")?.done).toBe(true)
  })

  it("first job follows the capability matrix: booking vs work order", () => {
    const booking = buildSetupChecklist({ ...freshSalon, appointmentCount: 3 })
    expect(booking.steps.find((s) => s.key === "firstJob")?.done).toBe(true)
    expect(booking.steps.find((s) => s.key === "firstJob")?.href).toBe(
      "/dashboard/appointments/new",
    )

    // Seamstress-style profile: appointments disabled, work orders drive value.
    const seamstress = buildSetupChecklist({
      ...freshSalon,
      appointmentsCapable: false,
      orderCount: 2,
    })
    expect(seamstress.steps.find((s) => s.key === "firstJob")?.done).toBe(true)
    expect(seamstress.steps.find((s) => s.key === "firstJob")?.href).toBe(
      "/dashboard/work-orders",
    )

    const neitherDone = buildSetupChecklist({
      ...freshSalon,
      appointmentsCapable: false,
      orderCount: 0,
    })
    expect(neitherDone.steps.find((s) => s.key === "firstJob")?.done).toBe(false)
  })

  it("disabled capabilities collapse into silent 'done' steps (no nagging)", () => {
    const c = buildSetupChecklist({
      ...freshSalon,
      catalogCapable: false,
      staffCapable: false,
      customersCapable: false,
      appointmentsCapable: false,
      workOrdersCapable: false,
    })
    const byKey = Object.fromEntries(c.steps.map((s) => [s.key, s.done]))
    expect(byKey.catalog).toBe(true)
    expect(byKey.staff).toBe(true)
    expect(byKey.customers).toBe(true)
    expect(byKey.firstJob).toBe(true)
    // publish stays the only real next action
    expect(c.nextKey).toBe("publish")
  })

  it("all done: nextKey null and allDone true (celebration state)", () => {
    const c = buildSetupChecklist({
      ...freshSalon,
      catalogTouched: true,
      staffCount: 3,
      customerCount: 5,
      appointmentCount: 2,
      published: true,
    })
    expect(c.allDone).toBe(true)
    expect(c.nextKey).toBeNull()
    expect(c.doneCount).toBe(c.total)
  })

  it("firstJob ignores work-order count when appointments are capable", () => {
    // A salon with orders (shop sales) but zero BOOKINGS still needs the
    // first booking — the milestone follows the profile's primary capability.
    const c = buildSetupChecklist({ ...freshSalon, orderCount: 4 })
    expect(c.steps.find((s) => s.key === "firstJob")?.done).toBe(false)
  })
})
