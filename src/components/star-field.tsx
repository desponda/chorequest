'use client'

import { useEffect, useRef } from 'react'

interface Star {
  x: number
  y: number
  size: number
  opacity: number
  speed: number
  offset: number
}

export function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf: number

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const stars: Star[] = Array.from({ length: 220 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      size: Math.random() * 1.4 + 0.2,
      opacity: Math.random() * 0.65 + 0.1,
      speed: Math.random() * 0.018 + 0.004,
      offset: Math.random() * Math.PI * 2,
    }))

    // A handful of larger "hero" stars
    const heroStars: Star[] = Array.from({ length: 12 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      size: Math.random() * 2.5 + 1.5,
      opacity: Math.random() * 0.5 + 0.2,
      speed: Math.random() * 0.008 + 0.002,
      offset: Math.random() * Math.PI * 2,
    }))

    let t = 0

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (const star of stars) {
        const alpha = star.opacity * (0.4 + 0.6 * Math.sin(t * star.speed + star.offset))
        ctx.beginPath()
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
        ctx.fill()
      }

      for (const star of heroStars) {
        const alpha = star.opacity * (0.3 + 0.7 * Math.sin(t * star.speed + star.offset))
        // Cross/sparkle shape
        ctx.save()
        ctx.translate(star.x, star.y)
        ctx.fillStyle = `rgba(255, 248, 220, ${alpha})`
        ctx.beginPath()
        ctx.arc(0, 0, star.size, 0, Math.PI * 2)
        ctx.fill()
        // Subtle cross glow
        ctx.fillStyle = `rgba(255, 248, 220, ${alpha * 0.3})`
        ctx.fillRect(-star.size * 3, -0.5, star.size * 6, 1)
        ctx.fillRect(-0.5, -star.size * 3, 1, star.size * 6)
        ctx.restore()
      }

      t++
      raf = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      aria-hidden
    />
  )
}
