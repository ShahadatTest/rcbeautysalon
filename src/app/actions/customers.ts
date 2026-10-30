"use server"

import { prisma } from "@/lib/prisma"
import { requireAdminOrg } from "@/lib/tenant"

export async function getCustomers() {
  const { org } = await requireAdminOrg()

  const customer = await prisma.customer.findMany({
    where: { organizationId: org.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  })
  return customer
}
