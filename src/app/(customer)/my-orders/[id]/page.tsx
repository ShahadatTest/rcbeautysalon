import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  PackageIcon,
  CalendarIcon,
  ReceiptIcon,
  ArrowLeftIcon,
  StorefrontIcon,
  CreditCardIcon,
  CheckCircleIcon,
  UserIcon,
} from "@/components/icons"
import { auth } from "@/lib/auth/auth"
import { redirect } from "next/navigation"
import { getOrderByIdForCustomer } from "@/app/actions/orders"
import { formatCurrency } from "@/lib/utils/format"
import { getPublicOrg } from "@/lib/tenant"
import { orgPath } from "@/lib/org-path"

export const metadata: Metadata = {
  title: "Podrobnosti naročila | Poslovna platforma",
  description: "Pregledajte podrobnosti svojega naročila.",
}

const statusColors: Record<string, string> = {
  PENDING: "bg-amber-500 text-white",
  PAID: "bg-blue-500 text-white",
  COMPLETED: "bg-green-500 text-white",
  CANCELLED: "bg-red-500 text-white",
  REFUNDED: "bg-gray-500 text-white",
}

const statusLabels: Record<string, string> = {
  PENDING: "V obdelavi",
  PAID: "Plačano",
  COMPLETED: "Zaključeno",
  CANCELLED: "Odpovedano",
  REFUNDED: "Povrnjeno",
}

interface OrderDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function OrderDetailPage({
  params,
}: OrderDetailPageProps) {
  const { id } = await params

  const session = await auth()

  if (!session?.user) {
    redirect("/login?redirect=/my-orders")
  }

  // Tenant prefix so back/help links (and the not-found fallback) stay
  // inside /s/{slug} instead of falling back to the default org.
  const org = await getPublicOrg()

  const order = await getOrderByIdForCustomer(id)

  if (!order) {
    redirect(orgPath(org?.slug, "/my-orders"))
  }

  return (
    <div className="from-muted/30 via-background to-muted/20 min-h-screen bg-linear-to-b py-12">
      <div className="container mx-auto max-w-4xl px-4">
        {/* Back Button */}
        <Button variant="ghost" className="mb-6 -ml-2" asChild>
          <Link href={orgPath(org?.slug, "/my-orders")}>
            <ArrowLeftIcon size={18} className="mr-2" />
            Nazaj na naročila
          </Link>
        </Button>

        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Podrobnosti naročila</h1>
            <div className="text-muted-foreground mt-1 flex items-center gap-2">
              <ReceiptIcon size={18} />
              <span>{order.id}</span>
            </div>
          </div>
          <Badge className={`${statusColors[order.status]} px-4 py-1 text-sm`}>
            {statusLabels[order.status]}
          </Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Order Items */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PackageIcon size={20} />
                  Izdelki ({order.items.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-4">
                    {/* Product Image */}
                    <div className="bg-muted flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                      {item.product.images?.[0] ? (
                        <Image
                          src={item.product.images[0]}
                          alt={item.product.name}
                          width={80}
                          height={80}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <PackageIcon size={28} className="text-muted-foreground" />
                      )}
                    </div>

                    {/* Product Details */}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{item.product.name}</p>
                      <p className="text-muted-foreground text-sm">
                        Količina: {item.quantity} × {formatCurrency(item.price)}
                      </p>
                    </div>

                    {/* Item Total */}
                    <p className="text-lg font-semibold">
                      {formatCurrency(item.quantity * item.price)}
                    </p>
                  </div>
                ))}

                <Separator className="my-4" />

                {/* Order Summary */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Vmesna vsota</span>
                    <span>{formatCurrency(order.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Davek</span>
                    <span>{formatCurrency(order.tax)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Skupaj</span>
                    <span>{formatCurrency(order.total)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Order Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon size={20} />
                  Podatki o naročilu
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Datum naročila</p>
                  <p className="font-medium">
                    {order.createdAt.toLocaleDateString("sl-SI", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Številka naročila</p>
                  <p className="font-mono text-xs font-medium">{order.id}</p>
                </div>
              </CardContent>
            </Card>

            {/* Customer Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserIcon size={20} />
                  Stranka
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p className="font-medium">{order.customer?.name}</p>
                {order.customer?.email && (
                  <p className="text-muted-foreground">{order.customer.email}</p>
                )}
                {order.customer?.phone && (
                  <p className="text-muted-foreground">{order.customer.phone}</p>
                )}
              </CardContent>
            </Card>

            {/* Pickup Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <StorefrontIcon size={20} />
                  Lokacija prevzema
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <p className="font-medium">{order.organization?.name ?? "Spletna trgovina"}</p>
                <p className="text-muted-foreground">
                  Natančna lokacija prevzema je navedena ob potrditvi naročila.
                </p>
                <Separator className="my-3" />
                <div className="flex items-center gap-2">
                  {order.status === "COMPLETED" ? (
                    <>
                      <CheckCircleIcon size={16} className="text-green-500" />
                      <span className="text-green-600 font-medium">Prevzeto</span>
                    </>
                  ) : order.status === "PAID" ? (
                    <>
                      <CheckCircleIcon size={16} className="text-blue-500" />
                      <span className="text-blue-600 font-medium">Pripravljeno za prevzem</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Čakanje na plačilo</span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Payment */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCardIcon size={20} />
                  Plačilo
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                {order.stripePaymentIntentId ? (
                  <div className="flex items-center gap-2">
                    <CheckCircleIcon size={16} className="text-green-500" />
                    <span className="font-medium text-green-600">Plačano s kartico</span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Plačilo v obdelavi</span>
                )}
              </CardContent>
            </Card>

            {/* Need Help */}
            <Card className="border-dashed">
              <CardContent className="p-4 text-center">
                <p className="text-muted-foreground mb-2 text-sm">
                  Potrebujete pomoč z naročilom?
                </p>
                <Button variant="outline" size="sm" asChild>
                  {/* hash appended after the tenant-prefixed home URL */}
                  <Link href={`${orgPath(org?.slug, "/")}#contact`}>
                    Kontaktirajte podporo
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
