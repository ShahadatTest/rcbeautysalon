"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PlusIcon } from "@/components/icons"
import {
  createStockMovement,
  listStockMovements,
  getStockLinkOptions,
  type StockMovementItem,
  type StockLinkOptions,
  type MovementErrorCode,
} from "@/app/actions/inventory"
import type { InventoryDict } from "@/lib/i18n/dict/inventory"

// ============================================================
// STOCK MOVEMENTS CARD (client) — EPIC #2 E2-2 inventory runtime.
// Manual receipt/issue on the product: every submit appends a
// LEDGER row and updates the stock STATE in one server
// transaction; negative stock is rejected server-side.
// ============================================================

type Labels = InventoryDict

interface StockMovementsCardProps {
  productId: string
  productStock: number
  trackInventory: boolean
  variants: { id: string; name: string; stockQuantity: number }[]
  labels: Labels
}

const emptyForm = {
  direction: "IN" as "IN" | "OUT",
  productVariantId: "none",
  quantity: "1",
  note: "",
  supplierRecordId: "none",
  batchRecordId: "none",
}

function errorText(code: MovementErrorCode | undefined, t: Labels): string {
  switch (code) {
    case "INVALID_QUANTITY":
    case "VALIDATION":
      return t.errInvalidQuantity
    case "NEGATIVE_STOCK":
      return t.errNegativeStock
    case "NOT_FOUND":
      return t.errNotFound
    case "VARIANT_MISMATCH":
      return t.errVariantMismatch
    case "RECORD_LINK":
      return t.errRecordLink
    case "NOT_TRACKED":
      return t.errNotTracked
    default:
      return t.errGeneric
  }
}

export function StockMovementsCard({
  productId,
  productStock,
  trackInventory,
  variants,
  labels: t,
}: StockMovementsCardProps) {
  const router = useRouter()
  const [movements, setMovements] = useState<StockMovementItem[]>([])
  const [links, setLinks] = useState<StockLinkOptions>({ suppliers: [], batches: [] })
  const [stock, setStock] = useState(productStock)
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState(emptyForm)

  const load = async () => {
    try {
      const [items, linkOptions] = await Promise.all([
        listStockMovements(productId),
        getStockLinkOptions(),
      ])
      setMovements(items)
      setLinks(linkOptions)
    } catch {
      // card stays empty; non-fatal
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const qty = Number(form.quantity)
    startTransition(async () => {
      const result = await createStockMovement({
        productId,
        productVariantId: form.productVariantId !== "none" ? form.productVariantId : null,
        direction: form.direction,
        quantity: qty,
        note: form.note.trim() || null,
        supplierRecordId: form.supplierRecordId !== "none" ? form.supplierRecordId : null,
        batchRecordId: form.batchRecordId !== "none" ? form.batchRecordId : null,
      })
      if (!result.ok) {
        toast.error(errorText(result.error, t))
        return
      }
      toast.success(t.okSaved)
      if (typeof result.nextStock === "number") setStock(result.nextStock)
      setForm(emptyForm)
      setFormOpen(false)
      await load()
      router.refresh()
    })
  }

  const fmtDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString()
    } catch {
      return iso
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1.5">
          <CardTitle>{t.movementsTitle}</CardTitle>
          <CardDescription>{t.movementsDesc}</CardDescription>
        </div>
        <div className="flex items-center gap-3">
          {trackInventory && (
            <div className="rounded-lg border bg-muted/40 px-3 py-1.5 text-right">
              <p className="text-xs text-muted-foreground">{t.currentStock}</p>
              <p className="text-lg font-semibold leading-tight">
                {stock} <span className="text-xs font-normal text-muted-foreground">{t.units}</span>
              </p>
            </div>
          )}
          {trackInventory && (
            <Button size="sm" onClick={() => setFormOpen((v) => !v)}>
              <PlusIcon size={16} className="mr-1" />
              {t.addMovement}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!trackInventory && (
          <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            {t.errNotTracked}
          </p>
        )}

        {trackInventory && formOpen && (
          <form onSubmit={submit} className="space-y-4 rounded-lg border p-4" data-testid="stock-movement-form">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="mv-direction">{t.directionLabel}</Label>
                <Select
                  value={form.direction}
                  onValueChange={(v) => setForm((f) => ({ ...f, direction: v as "IN" | "OUT" }))}
                >
                  <SelectTrigger id="mv-direction">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IN">{t.directionIn}</SelectItem>
                    <SelectItem value="OUT">{t.directionOut}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mv-qty">{t.quantityLabel}</Label>
                <Input
                  id="mv-qty"
                  type="number"
                  min={1}
                  step={1}
                  required
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                />
              </div>
            </div>

            {variants.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="mv-variant">{t.variantLabel}</Label>
                <Select
                  value={form.productVariantId}
                  onValueChange={(v) => setForm((f) => ({ ...f, productVariantId: v }))}
                >
                  <SelectTrigger id="mv-variant">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t.productOption}</SelectItem>
                    {variants.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name} ({v.stockQuantity})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {links.suppliers.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="mv-supplier">{t.supplierLabel}</Label>
                <Select
                  value={form.supplierRecordId}
                  onValueChange={(v) => setForm((f) => ({ ...f, supplierRecordId: v }))}
                >
                  <SelectTrigger id="mv-supplier">
                    <SelectValue placeholder={t.supplierPlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t.supplierPlaceholder}</SelectItem>
                    {links.suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {links.batches.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="mv-batch">{t.batchLabel}</Label>
                <Select
                  value={form.batchRecordId}
                  onValueChange={(v) => setForm((f) => ({ ...f, batchRecordId: v }))}
                >
                  <SelectTrigger id="mv-batch">
                    <SelectValue placeholder={t.batchPlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t.batchPlaceholder}</SelectItem>
                    {links.batches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="mv-note">{t.noteLabel}</Label>
              <Textarea
                id="mv-note"
                rows={2}
                placeholder={t.notePlaceholder}
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={pending}>
                {t.submitMovement}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>
                {t.cancel}
              </Button>
            </div>
          </form>
        )}

        {trackInventory && (
          <div className="space-y-2" data-testid="stock-movement-history">
            <h3 className="text-sm font-semibold">{t.historyTitle}</h3>
            {loading ? (
              <div className="h-16 animate-pulse rounded-md bg-muted" />
            ) : movements.length === 0 ? (
              <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                {t.noMovements}
              </p>
            ) : (
              <div className="max-h-72 overflow-y-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/70 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">{t.colDate}</th>
                      <th className="px-3 py-2 font-medium">{t.colDirection}</th>
                      <th className="px-3 py-2 font-medium">{t.colQuantity}</th>
                      <th className="px-3 py-2 font-medium">{t.colNote}</th>
                      <th className="px-3 py-2 font-medium">{t.colSource}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m) => (
                      <tr key={m.id} className="border-t">
                        <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                          {fmtDate(m.createdAt)}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={
                              m.direction === "IN"
                                ? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-400"
                                : "rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-400"
                            }
                          >
                            {m.direction === "IN" ? t.directionIn : t.directionOut}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-medium">
                          {m.direction === "IN" ? "+" : "−"}
                          {m.quantity}
                          {m.variantName ? (
                            <span className="ml-1 text-xs text-muted-foreground">
                              ({m.variantName})
                            </span>
                          ) : null}
                        </td>
                        <td className="max-w-52 truncate px-3 py-2 text-muted-foreground">
                          {[
                            m.note,
                            m.supplierTitle,
                            m.batchTitle ? `${t.batchLabel}: ${m.batchTitle}` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                          {m.source === "ORDER" ? t.sourceOrder : t.sourceManual}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
