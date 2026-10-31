"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { PlusIcon, TrashIcon } from "@/components/icons"
import { updateFormDefinition, type PublicFormField } from "@/app/actions/forms"

// ============================================================
// FORM FIELD EDITOR (EPIC #1 §8 — Phase 5, owner customization)
// Lets the business owner edit a materialized form definition
// without code: add/remove/reorder fields, change labels, types,
// required flags, select options, units and placeholders.
// Every change is validated server-side (updateFormDefinition).
// ============================================================

export interface FormEditorLabels {
  edit: string
  editTitle: string
  editDescription: string
  formName: string
  fieldLabel: string
  fieldKey: string
  fieldType: string
  fieldRequired: string
  fieldOptions: string
  fieldOptionsHint: string
  fieldUnit: string
  fieldPlaceholder: string
  addField: string
  moveUp: string
  moveDown: string
  removeField: string
  save: string
  cancel: string
  saved: string
  typeLabels: Record<string, string>
}

interface FormEditorDialogProps {
  definitionId: string
  definitionName: string
  initialName: string
  initialFields: PublicFormField[]
  labels: FormEditorLabels
}

interface EditableField extends PublicFormField {
  /** Local unique id for stable React keys (not persisted). */
  uid: string
}

let uidCounter = 0
const nextUid = () => `f${++uidCounter}`

function toEditableFields(fields: PublicFormField[]): EditableField[] {
  return fields.map((f) => ({ ...f, uid: nextUid() }))
}

/** Slugify a label into a storage key (client convenience; server still validates). */
function slugify(label: string): string {
  const map: Record<string, string> = {
    č: "c", š: "s", ž: "z", Ć: "c", đ: "d", ä: "a", ö: "o", ü: "u",
  }
  return label
    .toLowerCase()
    .replace(/[čšžćđäöü]/g, (c) => map[c] ?? c)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
}

export function FormEditorDialog({
  definitionId,
  definitionName,
  initialName,
  initialFields,
  labels,
}: FormEditorDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState(initialName)
  const [fields, setFields] = useState<EditableField[]>(() => toEditableFields(initialFields))

  const openReset = () => {
    setName(initialName)
    setFields(toEditableFields(initialFields))
  }

  const patch = (uid: string, changes: Partial<EditableField>) =>
    setFields((fs) => fs.map((f) => (f.uid === uid ? { ...f, ...changes } : f)))

  const addField = () => {
    if (fields.length >= 30) return
    setFields((fs) => [
      ...fs,
      { uid: nextUid(), key: "", label: "", type: "text", required: false },
    ])
  }

  const removeField = (uid: string) => setFields((fs) => fs.filter((f) => f.uid !== uid))

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= fields.length) return
    setFields((fs) => {
      const copy = [...fs]
      const [item] = copy.splice(index, 1)
      copy.splice(target, 0, item)
      return copy
    })
  }

  const save = () => {
    // Client-side sanity; the server re-validates everything.
    const cleaned = fields.map((f) => {
      const key = f.key.trim() || slugify(f.label)
      const base: PublicFormField = {
        key,
        label: f.label.trim(),
        type: f.type,
        required: f.required,
      }
      if (f.type === "select" && f.options?.length) base.options = f.options
      if (f.unit?.trim()) base.unit = f.unit.trim()
      if (f.placeholder?.trim()) base.placeholder = f.placeholder.trim()
      return base
    })
    if (!name.trim() || cleaned.length === 0 || cleaned.some((f) => !f.label)) {
      toast.error(labels.editTitle)
      return
    }

    startTransition(async () => {
      const result = await updateFormDefinition(definitionId, {
        name: name.trim(),
        fields: cleaned,
      })
      if (result.ok) {
        toast.success(labels.saved)
        setOpen(false)
        router.refresh()
      } else {
        const errorMap: Record<string, string> = {
          DUPLICATE_KEY: labels.fieldKey,
          SELECT_NEEDS_OPTIONS: labels.fieldOptionsHint,
          INVALID: labels.editTitle,
        }
        toast.error(errorMap[result.error ?? ""] ?? "Napaka pri shranjevanju.")
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (v) openReset()
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {labels.edit}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {labels.editTitle}
            <span className="text-muted-foreground ml-2 text-sm font-normal">
              {definitionName}
            </span>
          </DialogTitle>
          <DialogDescription>{labels.editDescription}</DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor={`form-name-${definitionId}`}>{labels.formName}</Label>
          <Input
            id={`form-name-${definitionId}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
          />
        </div>

        <div className="space-y-3">
          {fields.map((f, i) => (
            <div key={f.uid} className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-muted-foreground">
                  #{i + 1}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    aria-label={labels.moveUp}
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    disabled={i === fields.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label={labels.moveDown}
                  >
                    ↓
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive h-7 px-2"
                    onClick={() => removeField(f.uid)}
                    disabled={fields.length === 1}
                    aria-label={labels.removeField}
                  >
                    <TrashIcon size={14} />
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`fl-label-${f.uid}`}>{labels.fieldLabel} *</Label>
                  <Input
                    id={`fl-label-${f.uid}`}
                    value={f.label}
                    onChange={(e) => patch(f.uid, { label: e.target.value })}
                    maxLength={120}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`fl-key-${f.uid}`}>{labels.fieldKey}</Label>
                  <Input
                    id={`fl-key-${f.uid}`}
                    value={f.key}
                    onChange={(e) => patch(f.uid, { key: e.target.value.toLowerCase() })}
                    placeholder={slugify(f.label) || "polje"}
                    maxLength={60}
                    className="font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`fl-type-${f.uid}`}>{labels.fieldType}</Label>
                  <Select
                    value={f.type}
                    onValueChange={(v) => patch(f.uid, { type: v })}
                  >
                    <SelectTrigger id={`fl-type-${f.uid}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["text", "textarea", "number", "date", "select", "checkbox"].map(
                        (t) => (
                          <SelectItem key={t} value={t}>
                            {labels.typeLabels[t] ?? t}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`fl-unit-${f.uid}`}>{labels.fieldUnit}</Label>
                  <Input
                    id={`fl-unit-${f.uid}`}
                    value={f.unit ?? ""}
                    onChange={(e) => patch(f.uid, { unit: e.target.value })}
                    placeholder="cm, kg…"
                    maxLength={20}
                  />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <Switch
                    id={`fl-req-${f.uid}`}
                    checked={f.required}
                    onCheckedChange={(v) => patch(f.uid, { required: v })}
                  />
                  <Label htmlFor={`fl-req-${f.uid}`} className="text-sm font-normal">
                    {labels.fieldRequired}
                  </Label>
                </div>
              </div>

              {f.type === "select" && (
                <div className="space-y-1.5">
                  <Label htmlFor={`fl-opts-${f.uid}`}>{labels.fieldOptions} *</Label>
                  <Input
                    id={`fl-opts-${f.uid}`}
                    value={(f.options ?? []).join(", ")}
                    onChange={(e) =>
                      patch(f.uid, {
                        options: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder={labels.fieldOptionsHint}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <Button type="button" variant="outline" onClick={addField} disabled={fields.length >= 30}>
          <PlusIcon size={14} className="mr-2" />
          {labels.addField}
        </Button>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            {labels.cancel}
          </Button>
          <Button type="button" onClick={save} disabled={pending}>
            {labels.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
