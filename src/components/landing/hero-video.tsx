"use client"

import { useRef } from "react"
import Image from "next/image"

// Current visuals act as fallback defaults when the organization
// does not provide its own hero image/video in site content.
const DEFAULT_VIDEO_WEBM =
  "https://res.cloudinary.com/caballerorandy/video/upload/v1763776212/Beauty%20Salon/services/hero-bg_yje6fb.webm"
const DEFAULT_VIDEO_MP4 =
  "https://res.cloudinary.com/caballerorandy/video/upload/v1763776242/Beauty%20Salon/services/hero-bg_rn87gq.mp4"
const DEFAULT_POSTER =
  "https://res.cloudinary.com/caballerorandy/image/upload/v1763776064/Beauty%20Salon/services/hero-bg_t2k2ca.avif"

interface HeroVideoProps {
  imageUrl?: string | null
  videoUrl?: string | null
  posterUrl?: string | null
  /** Accessible description of the fallback hero image (e.g. hero heading). */
  alt?: string
}

export function HeroVideo({ imageUrl, videoUrl, posterUrl, alt }: HeroVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const poster = posterUrl || imageUrl || DEFAULT_POSTER

  // Handle smooth video loop by restarting before it ends
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const video = videoRef.current
      // Restart video 0.3 seconds before it ends for seamless loop
      if (video.duration - video.currentTime < 0.3) {
        video.currentTime = 0
      }
    }
  }

  return (
    <>
      {/* Background Video / Image */}
      <div className="absolute inset-0">
        {videoUrl ? (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            loop
            onTimeUpdate={handleTimeUpdate}
            preload="auto"
            className="h-full w-full object-cover will-change-transform"
            poster={poster}
            style={{
              objectFit: "cover",
              transform: "translateZ(0)",
              backfaceVisibility: "hidden",
            }}
          >
            <source
              src={videoUrl}
              type={videoUrl.toLowerCase().endsWith(".webm") ? "video/webm" : "video/mp4"}
            />
          </video>
        ) : imageUrl ? (
          <Image
            src={imageUrl}
            alt={alt ?? ""}
            fill
            priority
            className="h-full w-full object-cover will-change-transform"
            sizes="100vw"
          />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            loop
            onTimeUpdate={handleTimeUpdate}
            preload="auto"
            className="h-full w-full object-cover will-change-transform"
            poster={poster}
            style={{
              objectFit: "cover",
              transform: "translateZ(0)",
              backfaceVisibility: "hidden",
            }}
          >
            <source src={DEFAULT_VIDEO_WEBM} type="video/webm" />
            <source src={DEFAULT_VIDEO_MP4} type="video/mp4" />
          </video>
        )}
        {/* Overlay to improve text readability */}
        <div className="absolute inset-0 bg-linear-to-b from-black/60 via-black/50 to-black/60 dark:from-black/70 dark:via-black/60 dark:to-black/70 backdrop-blur-[1.5px]" />
      </div>
    </>
  )
}
