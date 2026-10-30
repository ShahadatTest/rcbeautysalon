/** Client-safe palette metadata (no prisma imports) for pickers/preview UI. */

export interface PaletteOption {
  id: string
  label: string
  primary: string
  accent: string
}

export const PALETTE_OPTIONS: PaletteOption[] = [
  { id: "rose", label: "Rožnata & Zlata", primary: "#b85c72", accent: "#d9a12c" },
  { id: "burgundy", label: "Bordó & Terakota", primary: "#8f2f45", accent: "#d98a5f" },
  { id: "amber", label: "Jantar & Med", primary: "#c07228", accent: "#e0b02c" },
  { id: "charcoal", label: "Antracit & Zlata", primary: "#3a3f47", accent: "#dfb545" },
  { id: "violet", label: "Vijolična & Pastel", primary: "#8b5bb8", accent: "#e070a8" },
  { id: "emerald", label: "Smaragdna", primary: "#2f8f6b", accent: "#7fa32d" },
  { id: "teal", label: "Modrozelena & Mint", primary: "#2699a8", accent: "#3da878" },
  { id: "coral", label: "Koralna", primary: "#e07060", accent: "#e0a040" },
]

export interface VerticalOption {
  id: string
  label: string
  description: string
  palette: string
}

export const VERTICAL_OPTIONS: VerticalOption[] = [
  { id: "beauty", label: "Lepotni salon", description: "Kombinacija frizerije, nohtov in kozmetike", palette: "rose" },
  { id: "frizer", label: "Frizerski salon", description: "Striženje, barvanje in oblikovanje las", palette: "amber" },
  { id: "barber", label: "Barber shop", description: "Moško striženje, brada, vroča brisača", palette: "charcoal" },
  { id: "nails", label: "Nail studio", description: "Manikira, pedikura in nail art", palette: "violet" },
  { id: "cosmetica", label: "Kozmetični salon", description: "Tretmaji obraza, nega kože, make-up", palette: "burgundy" },
  { id: "massage", label: "Masaža & wellness", description: "Relax, športne in terapevtske masaže", palette: "emerald" },
  { id: "epilation", label: "Epilacija & laser", description: "Laser epilacija, voščanje", palette: "teal" },
  { id: "generic", label: "Univerzalno", description: "Za salone z lastnim katalogom storitev", palette: "coral" },
]
