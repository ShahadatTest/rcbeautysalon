import { z } from "zod"

export const bookingSchema = z.object({
  staffId: z.string().min(1, "Izberite osebo za termin"),
  date: z.date({ message: "Izberite datum" }),
  time: z
    .string()
    .min(1, "Izberite uro")
    .refine((val) => /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(val), {
      message: "Neveljavna ura",
    }),
  firstName: z
    .string()
    .min(2, "Ime mora imeti vsaj 2 znaka")
    .max(50, "Ime ne sme presegati 50 znakov")
    .trim(),
  lastName: z
    .string()
    .min(2, "Priimek mora imeti vsaj 2 znaka")
    .max(50, "Priimek ne sme presegati 50 znakov")
    .trim(),
  email: z
    .string()
    .email("Vnesite veljaven e-poštni naslov")
    .min(1, "E-pošta je obvezna"),
  phone: z
    .string()
    .min(8, "Telefonska številka mora imeti vsaj 8 števk")
    .max(20, "Telefonska številka ne sme presegati 20 znakov")
    .refine((val) => /^[\d\s\-\(\)\+]+$/.test(val), {
      message: "Vnesite veljavno telefonsko številko",
    }),
  notes: z
    .string()
    .max(500, "Opombe ne smejo presegati 500 znakov")
    .trim()
    .optional(),
})

// Schema for authenticated users (firstName, lastName, email are optional/disabled)
export const authenticatedBookingSchema = bookingSchema.extend({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().optional(),
})

export type BookingInput = z.infer<typeof bookingSchema>
export type AuthenticatedBookingInput = z.infer<typeof authenticatedBookingSchema>
