'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { Variants, Transition } from 'framer-motion'

/**
 * Lightweight scroll-triggered animation hook using IntersectionObserver.
 * Returns a ref to attach and a boolean indicating visibility.
 * threshold: fraction of element visible before triggering (default 0.2)
 * once: if true, stays visible after first trigger (default true)
 */
export function useInView(threshold = 0.2, once = true) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          if (once) observer.unobserve(el)
        } else if (!once) {
          setInView(false)
        }
      },
      { threshold }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold, once])

  return { ref, inView }
}

/**
 * Parallax scroll hook.
 * Returns a ref and the current Y offset to apply as transform.
 * speed: multiplier for scroll offset (0.4 = slow parallax)
 */
export function useParallax(speed = 0.4) {
  const ref = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState(0)

  const handleScroll = useCallback(() => {
    // Use global scroll position to compute a stable parallax offset.
    // This ensures 0 offset at page load regardless of layout/header height.
    const y = window.scrollY || window.pageYOffset || 0
    setOffset(-y * speed)
  }, [speed])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  return { ref, offset }
}

/**
 * Framer Motion variant presets for scroll animations.
 * Use with motion.div initial="hidden" animate={inView ? "visible" : "hidden"} variants={...}
 */
const smoothTrans = (delay: number, dur = 0.8): Transition => ({
  duration: dur,
  ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
  delay,
})

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: (delay: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: smoothTrans(delay, 0.8),
  }),
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: (delay: number = 0) => ({
    opacity: 1,
    transition: smoothTrans(delay, 0.8),
  }),
}

export const slideFromLeft: Variants = {
  hidden: { opacity: 0, x: -60 },
  visible: (delay: number = 0) => ({
    opacity: 1,
    x: 0,
    transition: smoothTrans(delay, 0.7),
  }),
}

export const slideFromRight: Variants = {
  hidden: { opacity: 0, x: 60 },
  visible: (delay: number = 0) => ({
    opacity: 1,
    x: 0,
    transition: smoothTrans(delay, 0.7),
  }),
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: (delay: number = 0) => ({
    opacity: 1,
    scale: 1,
    transition: smoothTrans(delay, 0.6),
  }),
}

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
    },
  },
}

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: smoothTrans(0, 0.6),
  },
}

export const connectorGrow: Variants = {
  hidden: { scaleX: 0 },
  visible: (delay: number = 0) => ({
    scaleX: 1,
    transition: smoothTrans(delay, 0.8),
  }),
}
