"use server"

import { auth } from "@/lib/auth/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { ReviewFormData } from "@/lib/interfaces"
import { getPublicOrg, ORG_HEADER } from "@/lib/tenant"

// Create a new review for a service
export async function createReview(data: ReviewFormData) {
  // Ensure user is authenticated
  const session = await auth()

  if (!session?.user) {
    return {
      success: false,
      error: "Za oddajo ocene morate biti prijavljeni.",
    }
  }

  // Validate rating (1-5)
  if (data.rating < 1 || data.rating > 5) {
    return {
      success: false,
      error: "Ocena mora biti med 1 in 5.",
    }
  }

  // Validate comment (minimum 10 characters, maximum 1000)
  const comment = data.comment.trim()
  if (comment.length < 10 || comment.length > 1000) {
    return {
      success: false,
      error: "Komentar mora imeti med 10 in 1000 znakov.",
    }
  }

  // Verify service exists, is active, and belongs to the current organization
  const org = await getPublicOrg()
  const service = org
    ? await prisma.service.findFirst({
        where: {
          id: data.serviceId,
          organizationId: org.id,
        },
        select: { id: true, slug: true, isActive: true },
      })
    : null

  if (!service || !service.isActive) {
    return {
      success: false,
      error: "Storitev ni bila najdena ali ni na voljo.",
    }
  }

  try {
    // Create review with auto-approval
    const review = await prisma.review.create({
      data: {
        rating: data.rating,
        comment,
        userId: session.user.id,
        serviceId: data.serviceId,
        isActive: true, // Auto-approve all reviews
      },
    })

    // Revalidate service page and services list
    revalidatePath(`/services/${service.slug}`)
    revalidatePath("/services")

    return {
      success: true,
      review,
    }
  } catch (error) {
    console.error("Error creating review:", error)
    return {
      success: false,
      error: "Ustvarjanje ocene ni uspelo. Poskusite znova.",
    }
  }
}

// Get all reviews by the current user
export async function getUserReviews() {
  const session = await auth()

  if (!session?.user) {
    return {
      success: false,
      error: "Za ogled svojih ocen morate biti prijavljeni.",
      reviews: [],
    }
  }

  // TENANT ISOLATION (EPIC #4 visual pass): under a tenant site
  // (/s/[slug]/my-reviews — proxy sets x-org-slug) scope to reviews of
  // THAT tenant's services; reviews for other tenants' services must not
  // render under this brand. Unknown slug -> empty list. On the platform
  // root the user sees all their own reviews (own data, platform domain).
  let organizationId: string | null = null
  const slug = (await headers()).get(ORG_HEADER)
  if (slug) {
    const org = await prisma.organization.findUnique({
      where: { slug },
      select: { id: true },
    })
    if (!org) return { success: true, reviews: [] }
    organizationId = org.id
  }

  try {
    const reviews = await prisma.review.findMany({
      where: {
        userId: session.user.id,
        ...(organizationId ? { service: { organizationId } } : {}),
      },
      include: {
        service: {
          select: {
            id: true,
            name: true,
            slug: true,
            imageUrl: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return { success: true, reviews }
  } catch (error) {
    console.error("Error fetching user reviews:", error)
    return {
      success: false,
      error: "Pridobivanje ocen ni uspelo.",
      reviews: [],
    }
  }
}

// Delete a review (only owner can delete)
export async function deleteReview(reviewId: string) {
  const session = await auth()

  if (!session?.user) {
    return {
      success: false,
      error: "Za izbris ocene morate biti prijavljeni.",
    }
  }

  try {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        service: { select: { slug: true } },
      },
    })

    if (!review) {
      return { success: false, error: "Ocena ni bila najdena." }
    }

    if (review.userId !== session.user.id) {
      return { success: false, error: "Izbrisati lahko samo svoje ocene." }
    }

    await prisma.review.delete({
      where: { id: reviewId },
    })

    revalidatePath("/my-reviews")
    if (review.service?.slug) {
      revalidatePath(`/services/${review.service.slug}`)
    }

    return { success: true }
  } catch (error) {
    console.error("Error deleting review:", error)
    return { success: false, error: "Brisanje ocene ni uspelo." }
  }
}

// Update a review (only owner can update)
export async function updateReview(
  reviewId: string,
  data: { rating: number; comment: string }
) {
  const session = await auth()

  if (!session?.user) {
    return {
      success: false,
      error: "Za posodobitev ocene morate biti prijavljeni.",
    }
  }
  try {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        service: { select: { slug: true } },
      },
    })

    if (!review) {
      return { success: false, error: "Ocena ni bila najdena." }
    }

    if (review.userId !== session.user.id) {
      return { success: false, error: "Posodobiti lahko samo svoje ocene." }
    }

    // Validate comment length
    if (data.comment.length < 10 || data.comment.length > 1000) {
      return {
        success: false,
        error: "Komentar mora imeti med 10 in 1000 znakov.",
      }
    }

    // Update the review
    const updatedReview = await prisma.review.update({
      where: { id: reviewId },
      data: {
        rating: data.rating,
        comment: data.comment,
      },
    })

    revalidatePath("/my-reviews")
    if (review.service?.slug) {
      revalidatePath(`/services/${review.service.slug}`)
    }

    return { success: true, review: updatedReview }
  } catch (error) {
    console.error("Error updating review:", error)
    return { success: false, error: "Posodabljanje ocene ni uspelo." }
  }
}

// Get all reviews for a specific service (scoped to the current organization)
export async function getServiceReviews(serviceId: string) {
  try {
    const org = await getPublicOrg()
    if (!org) {
      return { success: true, reviews: [] }
    }

    const reviews = await prisma.review.findMany({
      where: {
        serviceId,
        isActive: true,
        service: { organizationId: org.id },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return { success: true, reviews }
  } catch (error) {
    console.error("Error fetching service reviews:", error)
    return {
      success: false,
      error: "Pridobivanje ocen ni uspelo.",
      reviews: [],
    }
  }
}
