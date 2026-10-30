"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ImageIcon, TrashIcon, PlusIcon } from "@/components/icons"
import { SpinnerIcon } from "@/components/icons/spinner-icon"
import { toast } from "sonner"
import { useI18n } from "@/lib/i18n/provider"
import { createProduct, updateProduct, deleteProduct } from "@/app/actions/products"
import {
  createProductSchema,
  updateProductSchema,
  type ProductFormData,
} from "@/lib/validations/product"

interface Category {
  id: string
  name: string
}

interface ProductData {
  id: string
  name: string
  description: string | null
  price: number
  compareAtPrice: number | null
  sku: string | null
  trackInventory: boolean
  stockQuantity: number
  images: string[]
  categoryId: string | null
  isActive: boolean
  isFeatured: boolean
}

interface ProductFormProps {
  categories: Category[]
  product?: ProductData
  mode?: "create" | "edit"
}

export function ProductForm({ categories, product, mode = "create" }: ProductFormProps) {
  const { t } = useI18n()
  const router = useRouter()
  const isEditMode = mode === "edit"
  const [images, setImages] = useState<string[]>(product?.images || [])
  const [isUploading, setIsUploading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormData>({
    resolver: zodResolver(isEditMode ? updateProductSchema : createProductSchema),
    defaultValues: {
      name: product?.name || "",
      description: product?.description || "",
      price: product?.price || undefined,
      compareAtPrice: product?.compareAtPrice || undefined,
      sku: product?.sku || "",
      trackInventory: product?.trackInventory ?? true,
      stockQuantity: product?.stockQuantity || 0,
      categoryId: product?.categoryId || "",
      isActive: product?.isActive ?? true,
      isFeatured: product?.isFeatured ?? false,
    },
  })

  const watchIsActive = watch("isActive")
  const watchIsFeatured = watch("isFeatured")
  const watchTrackInventory = watch("trackInventory")

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast.error(t.products.imageTypeError)
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t.products.imageSizeError)
      return
    }

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("type", "product")

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || t.products.uploadFailed)
      }

      setImages((prev) => [...prev, data.url])
      toast.success(t.products.imageUploadSuccess)
    } catch (error) {
      console.error("Upload error:", error)
      toast.error(
        error instanceof Error ? error.message : t.products.imageUploadFailed
      )
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  // Remove image
  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  // Handle delete product
  const handleDelete = async () => {
    if (!product?.id) return

    const confirmed = window.confirm(
      t.products.deleteConfirm
    )

    if (!confirmed) return

    setIsDeleting(true)
    try {
      const result = await deleteProduct(product.id)

      if (result.success) {
        toast.success(t.products.deleteSuccess)
        router.push("/dashboard/products")
      } else {
        toast.error(result.error || t.products.deleteFailed)
      }
    } catch (error) {
      console.error("Delete error:", error)
      toast.error(t.products.unexpectedError)
    } finally {
      setIsDeleting(false)
    }
  }

  // Submit form
  const onSubmit = async (data: ProductFormData) => {
    try {
      const productData = {
        name: data.name,
        description: data.description || undefined,
        price: data.price,
        compareAtPrice: data.compareAtPrice || undefined,
        sku: data.sku || undefined,
        trackInventory: data.trackInventory,
        stockQuantity: data.stockQuantity || 0,
        images: images,
        categoryId: data.categoryId || undefined,
        isActive: data.isActive,
        isFeatured: data.isFeatured,
      }

      const result = isEditMode && product?.id
        ? await updateProduct(product.id, productData)
        : await createProduct(productData)

      if (result.success) {
        toast.success(isEditMode ? t.products.updateSuccess : t.products.createSuccess)
        router.push("/dashboard/products")
      } else {
        toast.error(result.error || (isEditMode ? t.products.updateFailed : t.products.createFailed))
      }
    } catch (error) {
      console.error("Submit error:", error)
      toast.error(t.products.unexpectedError)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Form */}
        <div className="space-y-6 lg:col-span-2">
          {/* Product Information */}
          <Card>
            <CardHeader>
              <CardTitle>{t.products.productInfoTitle}</CardTitle>
              <CardDescription>{t.products.productInfoDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t.products.nameLabel}</Label>
                <Input
                  id="name"
                  placeholder={t.products.namePlaceholder}
                  {...register("name")}
                  disabled={isSubmitting}
                />
                {errors.name && (
                  <p className="text-destructive text-sm">
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t.products.descriptionLabel}</Label>
                <Textarea
                  id="description"
                  placeholder={t.products.descriptionPlaceholder}
                  rows={4}
                  {...register("description")}
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">{t.products.categoryLabel}</Label>
                <Select
                  defaultValue={product?.categoryId || undefined}
                  onValueChange={(value) => setValue("categoryId", value)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t.products.categoryPlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card>
            <CardHeader>
              <CardTitle>{t.products.pricingTitle}</CardTitle>
              <CardDescription>{t.products.pricingDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="price">{t.products.priceLabel}</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    placeholder="28.00"
                    {...register("price", { valueAsNumber: true })}
                    disabled={isSubmitting}
                  />
                  {errors.price && (
                    <p className="text-destructive text-sm">
                      {errors.price.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="compareAtPrice">{t.products.compareAtPriceLabel}</Label>
                  <Input
                    id="compareAtPrice"
                    type="number"
                    step="0.01"
                    placeholder="35.00"
                    {...register("compareAtPrice", { valueAsNumber: true })}
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t.products.compareAtPriceHelp}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Inventory */}
          <Card>
            <CardHeader>
              <CardTitle>{t.products.inventoryTitle}</CardTitle>
              <CardDescription>{t.products.inventoryDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sku">{t.products.skuLabel}</Label>
                  <Input
                    id="sku"
                    placeholder="SHMP-001"
                    {...register("sku")}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stockQuantity">{t.products.stockQuantityLabel}</Label>
                  <Input
                    id="stockQuantity"
                    type="number"
                    placeholder="50"
                    {...register("stockQuantity", { valueAsNumber: true })}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>{t.products.trackInventoryLabel}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t.products.trackInventoryDesc}
                  </p>
                </div>
                <Switch
                  checked={watchTrackInventory}
                  onCheckedChange={(checked) => setValue("trackInventory", checked)}
                  disabled={isSubmitting}
                />
              </div>
            </CardContent>
          </Card>

          {/* Images */}
          <Card>
            <CardHeader>
              <CardTitle>{t.products.imagesTitle}</CardTitle>
              <CardDescription>{t.products.imagesDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              {images.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                    {images.map((image, index) => (
                      <div key={index} className="relative aspect-square overflow-hidden rounded-lg">
                        <Image
                          src={image}
                          alt={t.products.imageAlt(index + 1)}
                          fill
                          className="object-cover"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 h-6 w-6"
                          onClick={() => handleRemoveImage(index)}
                        >
                          <TrashIcon size={12} />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div
                    className={`border-muted-foreground/25 hover:border-muted-foreground/50 flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed p-4 transition-colors ${
                      isUploading ? "pointer-events-none opacity-50" : ""
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {isUploading ? (
                      <SpinnerIcon size={20} className="animate-spin" />
                    ) : (
                      <div className="flex items-center gap-2">
                        <PlusIcon size={16} />
                        <span className="text-sm">{t.products.addMoreImages}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  className={`border-muted-foreground/25 hover:border-muted-foreground/50 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors ${
                    isUploading ? "pointer-events-none opacity-50" : ""
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isUploading ? (
                    <SpinnerIcon size={48} className="text-muted-foreground/50 animate-spin" />
                  ) : (
                    <ImageIcon size={48} className="text-muted-foreground/50" />
                  )}
                  {!isUploading && (
                    <p className="text-muted-foreground mt-4 text-sm">
                      {t.products.clickToUpload}
                    </p>
                  )}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status */}
          <Card>
            <CardHeader>
              <CardTitle>{t.products.statusTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>{t.products.activeLabel}</Label>
                  <p className="text-muted-foreground text-xs">
                    {t.products.activeDesc}
                  </p>
                </div>
                <Switch
                  checked={watchIsActive}
                  onCheckedChange={(checked) => setValue("isActive", checked)}
                  disabled={isSubmitting}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>{t.products.featuredLabel}</Label>
                  <p className="text-muted-foreground text-xs">
                    {t.products.featuredDesc}
                  </p>
                </div>
                <Switch
                  checked={watchIsFeatured}
                  onCheckedChange={(checked) => setValue("isFeatured", checked)}
                  disabled={isSubmitting}
                />
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <Button type="submit" className="w-full" disabled={isSubmitting || isDeleting}>
              {isSubmitting && (
                <SpinnerIcon size={16} className="mr-2 animate-spin" />
              )}
              {isEditMode ? t.products.updateButton : t.products.createButton}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => router.push("/dashboard/products")}
              disabled={isSubmitting || isDeleting}
            >
              {t.common.actions.cancel}
            </Button>
            {isEditMode && (
              <Button
                type="button"
                variant="destructive"
                className="w-full"
                onClick={handleDelete}
                disabled={isSubmitting || isDeleting}
              >
                {isDeleting ? (
                  <SpinnerIcon size={16} className="animate-spin" />
                ) : (
                  <>
                    <TrashIcon size={16} className="mr-2" />
                    {t.products.deleteButton}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </form>
  )
}
