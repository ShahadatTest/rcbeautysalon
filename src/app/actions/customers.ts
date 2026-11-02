"use server"

import { prisma } from "@/lib/prisma"
import { requirePermissionOrg } from "@/lib/auth/guards"


export async function getCustomers() {
  const { org } = await requirePermissionOrg("customers.manage")

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
