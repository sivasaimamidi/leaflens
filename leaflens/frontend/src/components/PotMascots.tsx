import React, { useEffect, useRef } from 'react'

interface PotMascotsProps {
  className?: string
  style?: React.CSSProperties
}

export const PotMascots: React.FC<PotMascotsProps> = ({ className, style }) => {
  // Eye element references
  const eyeSmallLeftRef = useRef<SVGEllipseElement>(null)
  const eyeSmallRightRef = useRef<SVGEllipseElement>(null)
  const eyeBigLeftRef = useRef<SVGEllipseElement>(null)
  const eyeBigRightRef = useRef<SVGEllipseElement>(null)

  // Pupil element references
  const pupilSmallLeftRef = useRef<SVGCircleElement>(null)
  const pupilSmallRightRef = useRef<SVGCircleElement>(null)
  const pupilBigLeftRef = useRef<SVGCircleElement>(null)
  const pupilBigRightRef = useRef<SVGCircleElement>(null)

  useEffect(() => {
    let animationFrameId: number | null = null
    let pointerX = window.innerWidth / 2
    let pointerY = window.innerHeight / 2

    // Current and target offsets for lerping
    const pupils = [
      {
        eyeEl: eyeSmallLeftRef.current,
        pupilEl: pupilSmallLeftRef.current,
        maxOffset: 12,
        lerpFactor: 0.2,
        distanceScale: 0.06,
        currentX: 0,
        currentY: 0,
        targetX: 0,
        targetY: 0,
      },
      {
        eyeEl: eyeSmallRightRef.current,
        pupilEl: pupilSmallRightRef.current,
        maxOffset: 12,
        lerpFactor: 0.2,
        distanceScale: 0.06,
        currentX: 0,
        currentY: 0,
        targetX: 0,
        targetY: 0,
      },
      {
        eyeEl: eyeBigLeftRef.current,
        pupilEl: pupilBigLeftRef.current,
        maxOffset: 22,
        lerpFactor: 0.12,
        distanceScale: 0.09,
        currentX: 0,
        currentY: 0,
        targetX: 0,
        targetY: 0,
      },
      {
        eyeEl: eyeBigRightRef.current,
        pupilEl: pupilBigRightRef.current,
        maxOffset: 22,
        lerpFactor: 0.12,
        distanceScale: 0.09,
        currentX: 0,
        currentY: 0,
        targetX: 0,
        targetY: 0,
      },
    ]

    const mqlMobile = window.matchMedia('(max-width: 700px)')
    const mqlReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

    let isMobile = mqlMobile.matches
    let isReduced = mqlReducedMotion.matches

    const updateMedia = () => {
      isMobile = mqlMobile.matches
      isReduced = mqlReducedMotion.matches
    }

    mqlMobile.addEventListener('change', updateMedia)
    mqlReducedMotion.addEventListener('change', updateMedia)

    // Window-level passive pointermove
    const handlePointerMove = (e: PointerEvent) => {
      if (isMobile || isReduced) return
      pointerX = e.clientX
      pointerY = e.clientY

      for (const p of pupils) {
        if (!p.eyeEl) continue
        const rect = p.eyeEl.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2

        const dx = pointerX - centerX
        const dy = pointerY - centerY
        const dist = Math.hypot(dx, dy)

        const angle = Math.atan2(dy, dx)
        // Smooth dead-zone: blend from 0 at dist=0 to full strength around dist=30
        // Uses a smooth exponential curve instead of a hard cutoff to avoid jitter/snapping
        const deadZoneBlend = 1 - Math.exp(-dist / 20)
        const rawOffset = Math.min(p.maxOffset, dist * p.distanceScale)
        const offset = rawOffset * deadZoneBlend

        p.targetX = Math.cos(angle) * offset
        p.targetY = Math.sin(angle) * offset
      }
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })

    // Animation Loop: Lerping and Mobile Orbit
    let orbitStart = performance.now()

    const loop = (time: number) => {
      if (isReduced) {
        // Reduced motion: hold still at center
        for (const p of pupils) {
          p.currentX = 0
          p.currentY = 0
          if (p.pupilEl) {
            p.pupilEl.setAttribute('transform', 'translate(0, 0)')
          }
        }
      } else if (isMobile) {
        // Mobile mode: smooth 4s circular orbit in sync
        const elapsed = (time - orbitStart) / 1000
        const angle = (elapsed * (2 * Math.PI)) / 4.0 // 4 seconds per loop
        for (const p of pupils) {
          const orbitRadius = p.maxOffset * 0.7
          const ox = Math.cos(angle) * orbitRadius
          const oy = Math.sin(angle) * orbitRadius
          p.currentX = ox
          p.currentY = oy
          if (p.pupilEl) {
            p.pupilEl.setAttribute('transform', `translate(${ox.toFixed(2)}, ${oy.toFixed(2)})`)
          }
        }
      } else {
        // Desktop lerp tracking — each pupil uses its own lerp factor
        for (const p of pupils) {
          p.currentX += (p.targetX - p.currentX) * p.lerpFactor
          p.currentY += (p.targetY - p.currentY) * p.lerpFactor

          // Snap to target when extremely close to avoid sub-pixel jitter
          if (Math.abs(p.targetX - p.currentX) < 0.01) p.currentX = p.targetX
          if (Math.abs(p.targetY - p.currentY) < 0.01) p.currentY = p.targetY

          if (p.pupilEl) {
            p.pupilEl.setAttribute('transform', `translate(${p.currentX.toFixed(2)}, ${p.currentY.toFixed(2)})`)
          }
        }
      }

      animationFrameId = requestAnimationFrame(loop)
    }

    animationFrameId = requestAnimationFrame(loop)

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId)
      window.removeEventListener('pointermove', handlePointerMove)
      mqlMobile.removeEventListener('change', updateMedia)
      mqlReducedMotion.removeEventListener('change', updateMedia)
    }
  }, [])

  return (
    <div className={`pots-artwork ${className || ''}`} style={style} aria-hidden="true">
      <svg
        viewBox="0 0 1000 800"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        {/* =========================================================
            LEFT POT (Small, succulent sprout, 3 stubby legs)
           ========================================================= */}
        {/* Sprout branches emerging from small pot */}
        <g id="small-pot-sprout">
          {/* Main little succulent stem */}
          <path
            d="M260 480 Q230 420 200 400"
            stroke="#255338"
            strokeWidth="7"
            strokeLinecap="round"
          />
          {/* Succulent jade leaves */}
          <ellipse cx="195" cy="395" rx="14" ry="9" transform="rotate(-30 195 395)" fill="#3f8258" />
          <ellipse cx="215" cy="420" rx="13" ry="8" transform="rotate(-50 215 420)" fill="#2f6b45" />
          <ellipse cx="230" cy="445" rx="11" ry="7" transform="rotate(-20 230 445)" fill="#3f8258" />
          <ellipse cx="240" cy="410" rx="12" ry="7" transform="rotate(30 240 410)" fill="#3f8258" />
        </g>

        {/* 3 Stubby Legs for small pot */}
        <g id="small-pot-legs" fill="#255338">
          <rect x="235" y="690" width="22" height="40" rx="10" />
          <rect x="300" y="695" width="22" height="40" rx="10" />
          <rect x="365" y="690" width="22" height="40" rx="10" />
        </g>

        {/* Small Pot Body */}
        <path
          d="M220 480 C220 480 210 680 230 700 C250 715 370 715 390 700 C410 680 400 480 400 480 Z"
          fill="#2f6b45"
        />
        {/* Rim highlight */}
        <ellipse cx="310" cy="480" rx="90" ry="12" fill="#255338" />
        <ellipse cx="310" cy="480" rx="84" ry="9" fill="#3f8258" />

        {/* Small Pot Eyes */}
        <g id="small-pot-eyes">
          {/* Left eyeball */}
          <ellipse
            ref={eyeSmallLeftRef}
            cx="265"
            cy="545"
            rx="20"
            ry="24"
            fill="#ffffff"
            transform="rotate(-5 265 545)"
          />
          {/* Left pupil */}
          <g transform="translate(265, 545)">
            <circle ref={pupilSmallLeftRef} cx="0" cy="0" r="10" fill="#0d2418" />
          </g>

          {/* Right eyeball */}
          <ellipse
            ref={eyeSmallRightRef}
            cx="345"
            cy="545"
            rx="20"
            ry="24"
            fill="#ffffff"
            transform="rotate(5 345 545)"
          />
          {/* Right pupil */}
          <g transform="translate(345, 545)">
            <circle ref={pupilSmallRightRef} cx="0" cy="0" r="10" fill="#0d2418" />
          </g>
        </g>

        {/* =========================================================
            RIGHT POT (Taller, bushy dried sprigs, 3 stubby legs)
           ========================================================= */}
        {/* Bushy dried floral sprigs emerging from taller pot */}
        <g id="big-pot-sprigs" stroke="#255338" strokeLinecap="round">
          {/* Stems fan out naturally */}
          <path d="M660 380 Q640 220 580 120" strokeWidth="4" />
          <path d="M680 380 Q670 190 640 90" strokeWidth="4.5" />
          <path d="M700 380 Q710 180 720 80" strokeWidth="4" />
          <path d="M720 380 Q760 210 790 110" strokeWidth="4" />
          <path d="M740 380 Q800 240 850 160" strokeWidth="3.5" />
          {/* Sprig clusters */}
          <circle cx="580" cy="120" r="6" fill="#3f8258" stroke="none" />
          <circle cx="595" cy="140" r="5" fill="#2f6b45" stroke="none" />
          <circle cx="565" cy="150" r="4.5" fill="#255338" stroke="none" />
          <circle cx="640" cy="90" r="7" fill="#3f8258" stroke="none" />
          <circle cx="630" cy="115" r="5.5" fill="#2f6b45" stroke="none" />
          <circle cx="655" cy="125" r="5" fill="#255338" stroke="none" />
          <circle cx="720" cy="80" r="6.5" fill="#3f8258" stroke="none" />
          <circle cx="710" cy="110" r="5" fill="#2f6b45" stroke="none" />
          <circle cx="735" cy="130" r="5.5" fill="#255338" stroke="none" />
          <circle cx="790" cy="110" r="6" fill="#3f8258" stroke="none" />
          <circle cx="810" cy="130" r="5" fill="#2f6b45" stroke="none" />
          <circle cx="850" cy="160" r="6" fill="#255338" stroke="none" />
          <circle cx="835" cy="180" r="5" fill="#3f8258" stroke="none" />
        </g>

        {/* 3 Stubby Legs for big pot */}
        <g id="big-pot-legs" fill="#255338">
          <rect x="580" y="695" width="28" height="42" rx="12" />
          <rect x="685" y="700" width="28" height="42" rx="12" />
          <rect x="790" y="695" width="28" height="42" rx="12" />
        </g>

        {/* Big Pot Body */}
        <path
          d="M550 380 C550 380 540 670 565 695 C595 725 805 725 835 695 C860 670 850 380 850 380 Z"
          fill="#2f6b45"
        />
        {/* Rim highlight */}
        <ellipse cx="700" cy="380" rx="150" ry="18" fill="#255338" />
        <ellipse cx="700" cy="380" rx="142" ry="14" fill="#3f8258" />

        {/* Big Pot Eyes */}
        <g id="big-pot-eyes">
          {/* Left eyeball */}
          <ellipse
            ref={eyeBigLeftRef}
            cx="630"
            cy="470"
            rx="34"
            ry="40"
            fill="#ffffff"
            transform="rotate(-4 630 470)"
          />
          {/* Left pupil */}
          <g transform="translate(630, 470)">
            <circle ref={pupilBigLeftRef} cx="0" cy="0" r="16" fill="#0d2418" />
          </g>

          {/* Right eyeball */}
          <ellipse
            ref={eyeBigRightRef}
            cx="765"
            cy="470"
            rx="34"
            ry="40"
            fill="#ffffff"
            transform="rotate(4 765 470)"
          />
          {/* Right pupil */}
          <g transform="translate(765, 470)">
            <circle ref={pupilBigRightRef} cx="0" cy="0" r="16" fill="#0d2418" />
          </g>
        </g>
      </svg>
    </div>
  )
}
