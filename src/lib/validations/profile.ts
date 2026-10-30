import { z } from "zod"

// Update profile schema
export const updateProfileSchema = z.object({
  name: z
    .string()
    .min(2, "Ime mora imeti vsaj 2 znaka")
    .max(100, "Ime ne sme presegati 100 znakov"),
  phone: z
    .string()
    .regex(/^[\d\s\-+()]*$/, "Neveljavna oblika telefonske številke")
    .optional()
    .or(z.literal("")),
})

// Change password schema
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Vnesite trenutno geslo"),
    newPassword: z
      .string()
      .min(8, "Geslo mora imeti vsaj 8 znakov")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Geslo mora vsebovati veliko črko, malo črko in številko"
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Gesli se ne ujemata",
    path: ["confirmPassword"],
  })

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
