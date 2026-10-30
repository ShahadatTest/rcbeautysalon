// ============================================================
// EXTENSION CONTRACT (EPIC #1 §13) — standardized way to add
// industry-specialized entities/processes WITHOUT duplicating
// or modifying the universal core (customers, orders, forms,
// workflows, payments). Extensions are declarative: they define
// capabilities, entities and form needs; the universal core
// materializes and renders them (Phase 4+ UI).
// Client-safe: NO server-only imports.
// ============================================================

import { z } from "zod"
import type { ProfileFieldDef } from "./types"

export interface ExtensionEntity {
  key: string // stable entity key, e.g. "vehicle"
  name: string
  description: string
  /** Declarative fields rendered by the universal entity UI (Phase 4+). */
  fields: ProfileFieldDef[]
}

export interface ExtensionDefinition {
  id: string
  name: string
  description: string
  version: number
  /** Which universal capabilities this extension builds upon. */
  capabilities: string[]
  /** Specialized entities contributed by this extension. */
  entities: ExtensionEntity[]
}

// ------------------------------------------------------------
// Validation schema — every extension is validated at load.
// ------------------------------------------------------------
const fieldDefSchema = z.object({
  key: z.string().min(1).regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().min(1),
  type: z.enum(["text", "textarea", "number", "date", "select", "checkbox"]),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
  unit: z.string().optional(),
  placeholder: z.string().optional(),
})

const extensionSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  name: z.string().min(1),
  description: z.string().min(1),
  version: z.number().int().positive(),
  capabilities: z.array(z.string()),
  entities: z.array(
    z.object({
      key: z.string().regex(/^[a-z][a-z0-9_]*$/),
      name: z.string().min(1),
      description: z.string().min(1),
      fields: z.array(fieldDefSchema),
    })
  ),
})

// ------------------------------------------------------------
// First-generation extensions
// ------------------------------------------------------------

/** Vehicle registry for workshops / tire services (§21 tire service scenario). */
const vehicleWorkshop: ExtensionDefinition = {
  id: "vehicle-workshop",
  name: "Vozila in vulkanizerija",
  description:
    "Evidenca vozil strank z registrskimi podatki in dimenzijami gum; delovni nalogi se vežejo na vozilo.",
  version: 1,
  capabilities: ["customers", "workOrders", "inventory"],
  entities: [
    {
      key: "vehicle",
      name: "Vozilo",
      description: "Vozilo stranke z registrsko oznako in tehničnimi podatki.",
      fields: [
        { key: "license_plate", label: "Registrska oznaka", type: "text", required: true },
        { key: "brand_model", label: "Znamka in model", type: "text", required: true },
        { key: "year", label: "Leto proizvodnje", type: "number", required: false },
        { key: "odometer_km", label: "Kilometri", type: "number", required: false, unit: "km" },
        { key: "vin", label: "VIN številka", type: "text", required: false },
        { key: "notes", label: "Opombe", type: "textarea", required: false },
      ],
    },
    {
      key: "tire_set",
      name: "Komplet gum",
      description: "Dimenzije in stanje gum vozila (sezonska shranjevanje).",
      fields: [
        { key: "width_mm", label: "Širina", type: "number", required: true, unit: "mm" },
        { key: "profile_pct", label: "Profil", type: "number", required: true, unit: "%" },
        { key: "diameter_in", label: "Premer platišča", type: "number", required: true, unit: "palcev" },
        { key: "season", label: "Sezona", type: "select", required: true, options: ["Poletne", "Zimske", "Celoletne"] },
        { key: "tread_mm", label: "Globina tekalne plasti", type: "number", required: false, unit: "mm" },
      ],
    },
  ],
}

/** Body measurements for tailoring/seamstress (§21 seamstress scenario). */
const bodyMeasurements: ExtensionDefinition = {
  id: "body-measurements",
  name: "Mere telesa",
  description:
    "Shranjevanje mer strank za šivanje po meri in spremembe; mere se vežejo na naročilo in zgodovino stranke.",
  version: 1,
  capabilities: ["customers", "workOrders"],
  entities: [
    {
      key: "measurement_set",
      name: "Merilni list",
      description: "Sklop mer za eno stranko (posodabljan ob vsaki meritvi).",
      fields: [
        { key: "chest_cm", label: "Obseg prsi", type: "number", required: false, unit: "cm" },
        { key: "waist_cm", label: "Obseg pasu", type: "number", required: false, unit: "cm" },
        { key: "hips_cm", label: "Obseg bokov", type: "number", required: false, unit: "cm" },
        { key: "shoulder_cm", label: "Širina ramen", type: "number", required: false, unit: "cm" },
        { key: "sleeve_cm", label: "Dolžina rokava", type: "number", required: false, unit: "cm" },
        { key: "inseam_cm", label: "Notranja dolžina hlač", type: "number", required: false, unit: "cm" },
        { key: "height_cm", label: "Višina", type: "number", required: false, unit: "cm" },
      ],
    },
  ],
}

/** Batches/lots and harvest records for producers (§21 beekeeping scenario). */
const batchProduction: ExtensionDefinition = {
  id: "batch-production",
  name: "Serije in žetev",
  description:
    "Evidence žetve/produkcije, serije (loti) in povezava na zaloge izdelkov — brez rezervacij in terminov.",
  version: 1,
  capabilities: ["inventory", "shop"],
  entities: [
    {
      key: "batch",
      name: "Serija / lot",
      description: "Serija proizvodnje z datumom, količino in sledljivostjo.",
      fields: [
        { key: "batch_code", label: "Oznaka serije", type: "text", required: true },
        { key: "production_date", label: "Datum proizvodnje/žetve", type: "date", required: true },
        { key: "quantity_kg", label: "Količina", type: "number", required: true, unit: "kg" },
        { key: "product_type", label: "Vrsta (npr. med)", type: "select", required: true, options: ["Cvetlični med", "Lipov med", "Gozdni med", "Akačijski med", "Drug izdelek"] },
        { key: "apiary", label: "Panjska postaja / panj", type: "text", required: false },
        { key: "notes", label: "Opombe", type: "textarea", required: false },
      ],
    },
  ],
}

/** Rooms/chairs/bays as bookable resources for appointment businesses. */
const workspaceResources: ExtensionDefinition = {
  id: "workspace-resources",
  name: "Prostori in viri",
  description:
    "Stolčki, sobice in delovne postaje kot viri, na katere se vežejo termini ali delovni nalogi.",
  version: 1,
  capabilities: ["appointments", "workOrders"],
  entities: [
    {
      key: "workspace",
      name: "Delovni vir",
      description: "Fizični vir (stol, soba, plato) s kapaciteto 1 termin naenkrat.",
      fields: [
        { key: "name", label: "Naziv vira", type: "text", required: true },
        { key: "kind", label: "Vrsta", type: "select", required: true, options: ["Stol", "Soba", "Delovna postaja", "Dvigalo", "Drug"] },
        { key: "notes", label: "Opombe", type: "textarea", required: false },
      ],
    },
  ],
}

// ------------------------------------------------------------
// Registry — validated at module load (fail fast, not silently).
// ------------------------------------------------------------

const EXTENSION_LIST: ExtensionDefinition[] = [
  vehicleWorkshop,
  bodyMeasurements,
  batchProduction,
  workspaceResources,
]

function validateExtensions(list: ExtensionDefinition[]): Record<string, ExtensionDefinition> {
  const out: Record<string, ExtensionDefinition> = {}
  for (const ext of list) {
    const parsed = extensionSchema.safeParse(ext)
    if (!parsed.success) {
      throw new Error(
        `[profiles] Invalid extension "${ext.id}": ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`
      )
    }
    out[ext.id] = ext
  }
  return out
}

export const EXTENSIONS: Record<string, ExtensionDefinition> = validateExtensions(EXTENSION_LIST)

export function getExtension(id: string): ExtensionDefinition | undefined {
  return EXTENSIONS[id]
}
