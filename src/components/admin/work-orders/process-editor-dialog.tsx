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
import { PlusIcon, TrashIcon } from "@/components/icons"
import {
  updateWorkflowStages,
  type WorkflowStageInfo,
} from "@/app/actions/work-orders"

// ============================================================
// WORKFLOW STAGE EDITOR (EPIC #1 §9 — Phase 5, owner customization)
// Lets the owner customize the business process stages without
// code: rename, add, remove and reorder. Orders standing in a
// removed stage are moved to the previous stage server-side and
// every such move is recorded in the audit trail.
// ============================================================

export interface ProcessEditorLabels {
  edit: string
  editTitle: string
  editDescription: string
  stageName: string
  stageSla: string
  addStage: string
  moveUp: string
  moveDown: string
  removeStage: string
  save: string
  cancel: string
  saved: string
  finalBadge: string
}

interface EditableStage extends WorkflowStageInfo {
  /** Local unique id for React keys (not persisted). */
  uid: string
}

let uidCounter = 0
const nextUid = () => `s${++uidCounter}`

interface ProcessEditorDialogProps {
  definitionId: string
  stages: WorkflowStageInfo[]
  labels: ProcessEditorLabels
}

export function ProcessEditorDialog({
  definitionId,
  stages,
  labels,
}: ProcessEditorDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [list, setList] = useState<EditableStage[]>([])

  const openReset = () =>
    setList(stages.map((s) => ({ ...s, uid: nextUid() })))

  const patch = (uid: string, changes: Partial<EditableStage>) =>
    setList((ls) => ls.map((s) => (s.uid === uid ? { ...s, ...changes } : s)))

  const addStage = () => {
    if (list.length >= 20) return
    setList((ls) => [
      ...ls,
      {
        uid: nextUid(),
        id: "",
        key: "",
        name: "",
        order: ls.length,
        description: null,
        slaHours: null,
        isFinal: false,
      },
    ])
  }

  const removeStage = (uid: string) =>
    setList((ls) => (ls.length > 1 ? ls.filter((s) => s.uid !== uid) : ls))

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= list.length) return
    setList((ls) => {
      const copy = [...ls]
      const [item] = copy.splice(index, 1)
      copy.splice(target, 0, item)
      return copy
    })
  }

  const save = () => {
    const cleaned = list.map((s) => ({
      id: s.id ? s.id : undefined, // empty id = new stage
      name: s.name.trim(),
      slaHours: s.slaHours,
    }))
    if (cleaned.length < 1 || cleaned.some((s) => !s.name)) {
      toast.error(labels.stageName)
      return
    }

    startTransition(async () => {
      const result = await updateWorkflowStages(definitionId, cleaned)
      if (result.ok) {
        toast.success(labels.saved)
        setOpen(false)
        router.refresh()
      } else {
        toast.error("Napaka pri shranjevanju procesa.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) openReset() }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {labels.edit}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{labels.editTitle}</DialogTitle>
          <DialogDescription>{labels.editDescription}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {list.map((s, i) => (
            <div key={s.uid} className="rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">
                  #{i + 1}
                </span>
                <Input
                  value={s.name}
                  onChange={(e) => patch(s.uid, { name: e.target.value })}
                  placeholder={labels.stageName}
                  maxLength={80}
                  className="h-8 flex-1"
                  aria-label={labels.stageName}
                />
                <div className="flex items-center gap-0.5">
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
                    disabled={i === list.length - 1}
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
                    onClick={() => removeStage(s.uid)}
                    disabled={list.length === 1}
                    aria-label={labels.removeStage}
                  >
                    <TrashIcon size={14} />
                  </Button>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <Label htmlFor={`sla-${s.uid}`} className="text-xs text-muted-foreground">
                  {labels.stageSla}
                </Label>
                <Input
                  id={`sla-${s.uid}`}
                  type="number"
                  min={0}
                  max={2000}
                  value={s.slaHours ?? ""}
                  onChange={(e) =>
                    patch(s.uid, {
                      slaHours: e.target.value === "" ? null : Math.max(0, Number(e.target.value)),
                    })
                  }
                  className="h-8 w-24"
                />
                {i === list.length - 1 && (
                  <span className="rounded-full border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-400">
                    {labels.finalBadge}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <Button type="button" variant="outline" onClick={addStage} disabled={list.length >= 20}>
          <PlusIcon size={14} className="mr-2" />
          {labels.addStage}
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
