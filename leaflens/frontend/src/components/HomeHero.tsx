import React, { useState, useEffect, useRef } from 'react'
import './HomeHero.css'

interface HomeHeroProps {
  onStartScan: () => void
}

type ModalTab = 'crops' | 'how' | 'about' | null

// Eye centers in the original 1672 x 941 image
const EYES_DATA = [
  { id: 'small-left', pot: 'small', origX: 702, origY: 635, rx: 12.5, ry: 15, pupilR: 8, maxDistX: 6.5, maxDistY: 8 },
  { id: 'small-right', pot: 'small', origX: 780, origY: 635, rx: 13, ry: 15.5, pupilR: 8, maxDistX: 6.5, maxDistY: 8 },
  { id: 'tall-left', pot: 'tall', origX: 912, origY: 536, rx: 20, ry: 17, pupilR: 10.5, maxDistX: 11.5, maxDistY: 8.5 },
  { id: 'tall-right', pot: 'tall', origX: 1010, origY: 535, rx: 19, ry: 17, pupilR: 10.5, maxDistX: 11.0, maxDistY: 8.5 },
]

const NATURAL_WIDTH = 1672
const NATURAL_HEIGHT = 941

// In-hero plant regions to animate (natural image pixel coords)
const PLANTS_DATA = [
  {
    id: 'tall-flowers',
    src: '/foliage/hero-plant-tall-flowers.png',
    nx: 720, ny: 55, nw: 480, nh: 445,
    originCSS: '50% 100%',   // pivot at tall pot rim
    animClass: 'hero-plant-anim-flowers',
  },
  {
    id: 'succulent',
    src: '/foliage/hero-plant-succulent.png',
    nx: 605, ny: 435, nw: 140, nh: 165,
    originCSS: '75% 100%',   // stem rooted inside small pot opening
    animClass: 'hero-plant-anim-succulent',
  },
  {
    id: 'left-pothos',
    src: '/foliage/hero-plant-left-pothos.png',
    nx: 0, ny: 270, nw: 340, nh: 300,
    originCSS: '15% 75%',    // rooted near table/books
    animClass: 'hero-plant-anim-bg-pothos',
  },
]

export const HomeHero: React.FC<HomeHeroProps> = ({ onStartScan }) => {
  const [activeModal, setActiveModal] = useState<ModalTab>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const overlaySvgRef = useRef<SVGSVGElement>(null)

  // Pupil state refs for direct high-performance DOM manipulation
  const pupilElementsRef = useRef<(SVGGElement | null)[]>([])
  const whitePatchElementsRef = useRef<(SVGEllipseElement | null)[]>([])

  // In-hero animated plant overlay refs
  const plantOverlayRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    let animFrameId: number | null = null
    let pointerX = window.innerWidth / 2
    let pointerY = window.innerHeight / 2
    let hasMoved = false

    const pupils = EYES_DATA.map((eye) => ({
      ...eye,
      currentX: 0,
      currentY: 0,
      targetX: 0,
      targetY: 0,
      screenX: 0,
      screenY: 0,
      scale: 1,
    }))

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

    // Compute actual rendered screen coordinates of each eye
    const updateGeometry = () => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const cWidth = rect.width
      const cHeight = rect.height

      // Scale factor of object-fit: cover
      const scale = Math.max(cWidth / NATURAL_WIDTH, cHeight / NATURAL_HEIGHT)
      const renderedW = NATURAL_WIDTH * scale
      const renderedH = NATURAL_HEIGHT * scale
      const offsetX = (cWidth - renderedW) / 2
      const offsetY = (cHeight - renderedH) / 2

      pupils.forEach((p, idx) => {
        p.scale = scale
        p.screenX = rect.left + offsetX + p.origX * scale
        p.screenY = rect.top + offsetY + p.origY * scale

        // Update white patch position & size
        const patchEl = whitePatchElementsRef.current[idx]
        if (patchEl) {
          patchEl.setAttribute('cx', String(offsetX + p.origX * scale))
          patchEl.setAttribute('cy', String(offsetY + p.origY * scale))
          patchEl.setAttribute('rx', String(p.rx * scale))
          patchEl.setAttribute('ry', String(p.ry * scale))
        }

        // Update pupil base position
        const pupilEl = pupilElementsRef.current[idx]
        if (pupilEl) {
          pupilEl.setAttribute('data-base-x', String(offsetX + p.origX * scale))
          pupilEl.setAttribute('data-base-y', String(offsetY + p.origY * scale))
          pupilEl.setAttribute('data-r', String(p.pupilR * scale))
        }
      })

      // Position in-hero plant overlays using same object-fit geometry
      PLANTS_DATA.forEach((plant, idx) => {
        const el = plantOverlayRefs.current[idx]
        if (!el) return
        el.style.left   = `${offsetX + plant.nx * scale}px`
        el.style.top    = `${offsetY + plant.ny * scale}px`
        el.style.width  = `${plant.nw * scale}px`
        el.style.height = `${plant.nh * scale}px`
      })
    }

    updateGeometry()
    window.addEventListener('resize', updateGeometry)

    // Window-level pointer listener
    const handlePointerMove = (e: PointerEvent) => {
      if (isMobile || isReduced) return
      hasMoved = true
      pointerX = e.clientX
      pointerY = e.clientY

      // Calculate shared gaze per pot so eyes turn together in unison
      const tallEyes = pupils.filter((p) => p.pot === 'tall')
      const smallEyes = pupils.filter((p) => p.pot === 'small')

      // Tall (big) pot gaze: direction from center of both eyes to cursor
      if (tallEyes.length === 2) {
        const tallCenterX = (tallEyes[0].screenX + tallEyes[1].screenX) / 2
        const tallCenterY = (tallEyes[0].screenY + tallEyes[1].screenY) / 2
        const tallDx = pointerX - tallCenterX
        const tallDy = pointerY - tallCenterY
        const tallDist = Math.hypot(tallDx, tallDy)

        const tallAngle = Math.atan2(tallDy, tallDx)
        // Smooth exponential dead-zone: eases from 0 at center to full strength ~40px out
        // Eliminates jitter/snapping when cursor is near the eyes
        const deadZoneBlend = 1 - Math.exp(-tallDist / 25)
        // Smooth non-linear gaze factor with wider range for more gradual travel
        const factor = Math.min(1.0, tallDist / 350) * deadZoneBlend
        tallEyes.forEach((p) => {
          const maxLimitX = p.maxDistX * p.scale
          const maxLimitY = p.maxDistY * p.scale
          p.targetX = Math.cos(tallAngle) * maxLimitX * factor
          p.targetY = Math.sin(tallAngle) * maxLimitY * factor
        })
      }

      // Small pot gaze
      if (smallEyes.length === 2) {
        const smallCenterX = (smallEyes[0].screenX + smallEyes[1].screenX) / 2
        const smallCenterY = (smallEyes[0].screenY + smallEyes[1].screenY) / 2
        const smallDx = pointerX - smallCenterX
        const smallDy = pointerY - smallCenterY
        const smallDist = Math.hypot(smallDx, smallDy)

        if (smallDist <= 6) {
          smallEyes.forEach((p) => {
            p.targetX = 0
            p.targetY = 0
          })
        } else {
          const smallAngle = Math.atan2(smallDy, smallDx)
          const factor = Math.min(1.0, smallDist / 240)
          smallEyes.forEach((p) => {
            const maxLimitX = p.maxDistX * p.scale
            const maxLimitY = p.maxDistY * p.scale
            p.targetX = Math.cos(smallAngle) * maxLimitX * factor
            p.targetY = Math.sin(smallAngle) * maxLimitY * factor
          })
        }
      }
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })

    // Animation Loop: lerping on desktop, gentle circular orbit on mobile, stationary on reduced motion
    const orbitStartTime = performance.now()

    const loop = (timestamp: number) => {
      if (isReduced) {
        pupils.forEach((p, idx) => {
          p.currentX = 0
          p.currentY = 0
          const pupilEl = pupilElementsRef.current[idx]
          if (pupilEl) {
            const baseX = parseFloat(pupilEl.getAttribute('data-base-x') || '0')
            const baseY = parseFloat(pupilEl.getAttribute('data-base-y') || '0')
            const r = parseFloat(pupilEl.getAttribute('data-r') || '10')
            pupilEl.setAttribute('transform', `translate(${baseX}, ${baseY})`)
            const circle = pupilEl.querySelector('circle.pupil-core')
            if (circle) circle.setAttribute('r', String(r))
            const dot = pupilEl.querySelector('circle.pupil-sparkle')
            if (dot) {
              dot.setAttribute('cx', String(-r * 0.32))
              dot.setAttribute('cy', String(-r * 0.32))
              dot.setAttribute('r', String(r * 0.26))
            }
          }
        })
      } else if (isMobile) {
        // Very slow, gentle circular eye movement (6.5s per rotation)
        const elapsed = (timestamp - orbitStartTime) / 1000
        const angle = (elapsed * (2 * Math.PI)) / 6.5
        pupils.forEach((p, idx) => {
          const maxLimitX = p.maxDistX * p.scale * 0.55
          const maxLimitY = p.maxDistY * p.scale * 0.55
          p.currentX = Math.cos(angle) * maxLimitX
          p.currentY = Math.sin(angle) * maxLimitY

          const pupilEl = pupilElementsRef.current[idx]
          if (pupilEl) {
            const baseX = parseFloat(pupilEl.getAttribute('data-base-x') || '0')
            const baseY = parseFloat(pupilEl.getAttribute('data-base-y') || '0')
            const r = parseFloat(pupilEl.getAttribute('data-r') || '10')
            pupilEl.setAttribute(
              'transform',
              `translate(${(baseX + p.currentX).toFixed(2)}, ${(baseY + p.currentY).toFixed(2)})`
            )
            const circle = pupilEl.querySelector('circle.pupil-core')
            if (circle) circle.setAttribute('r', String(r))
            const dot = pupilEl.querySelector('circle.pupil-sparkle')
            if (dot) {
              dot.setAttribute('cx', String(-r * 0.32))
              dot.setAttribute('cy', String(-r * 0.32))
              dot.setAttribute('r', String(r * 0.26))
            }
          }
        })
      } else {
        // Desktop lerp tracking — big pot uses lower lerp for silky smooth gliding
        pupils.forEach((p, idx) => {
          if (hasMoved) {
            // Big pot (tall) gets a gentler lerp for ultra-smooth tracking
            const lerpFactor = p.pot === 'tall' ? 0.10 : 0.18
            p.currentX += (p.targetX - p.currentX) * lerpFactor
            p.currentY += (p.targetY - p.currentY) * lerpFactor

            // Snap to target when extremely close to avoid sub-pixel jitter
            if (Math.abs(p.targetX - p.currentX) < 0.01) p.currentX = p.targetX
            if (Math.abs(p.targetY - p.currentY) < 0.01) p.currentY = p.targetY
          }

          const pupilEl = pupilElementsRef.current[idx]
          if (pupilEl) {
            const baseX = parseFloat(pupilEl.getAttribute('data-base-x') || '0')
            const baseY = parseFloat(pupilEl.getAttribute('data-base-y') || '0')
            const r = parseFloat(pupilEl.getAttribute('data-r') || '10')
            pupilEl.setAttribute(
              'transform',
              `translate(${(baseX + p.currentX).toFixed(2)}, ${(baseY + p.currentY).toFixed(2)})`
            )
            const circle = pupilEl.querySelector('circle.pupil-core')
            if (circle) circle.setAttribute('r', String(r))
            const dot = pupilEl.querySelector('circle.pupil-sparkle')
            if (dot) {
              dot.setAttribute('cx', String(-r * 0.32))
              dot.setAttribute('cy', String(-r * 0.32))
              dot.setAttribute('r', String(r * 0.26))
            }
          }
        })
      }

      animFrameId = requestAnimationFrame(loop)
    }

    animFrameId = requestAnimationFrame(loop)

    return () => {
      if (animFrameId) cancelAnimationFrame(animFrameId)
      window.removeEventListener('resize', updateGeometry)
      window.removeEventListener('pointermove', handlePointerMove)
      mqlMobile.removeEventListener('change', updateMedia)
      mqlReducedMotion.removeEventListener('change', updateMedia)
    }
  }, [])

  return (
    <div className="home-hero" ref={containerRef}>
      {/* 1. Static high-fidelity photo background */}
      <img
        src="/leaflens-home-hero.png"
        alt="Indoor plant room with two friendly terracotta pots"
        className="hero-image"
      />

      {/* 2. Interactive SVG Eye Overlay (White patches cover original pupils, pupils follow cursor) */}
      <svg
        ref={overlaySvgRef}
        className="eyes-overlay"
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id="softPatch" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="0.6" />
          </filter>
        </defs>

        {/* Dynamic Dark Pupils (moving across pristine photo eye sockets) */}
        <g id="dynamic-pupils">
          {EYES_DATA.map((eye, idx) => (
            <g
              key={`pupil-${eye.id}`}
              ref={(el) => {
                pupilElementsRef.current[idx] = el
              }}
              transform="translate(0, 0)"
            >
              {/* Dark pupil core */}
              <circle className="pupil-core" cx="0" cy="0" r="10" fill="#121815" />
              {/* Specular highlight catchlight for lifelike eye depth */}
              <circle className="pupil-sparkle" cx="-3.2" cy="-3.2" r="2.6" fill="#ffffff" />
            </g>
          ))}
        </g>
      </svg>

      {/* 2b. In-Hero Animated Plant Overlays (positioned by JS to match object-fit:cover) */}
      {PLANTS_DATA.map((plant, idx) => (
        <div
          key={`hero-plant-${plant.id}`}
          ref={(el) => { plantOverlayRefs.current[idx] = el }}
          className={`hero-plant-overlay ${plant.animClass}`}
          aria-hidden="true"
          style={{ transformOrigin: plant.originCSS }}
        >
          <img
            src={plant.src}
            alt=""
            className="hero-plant-img"
            draggable={false}
          />
        </div>
      ))}

      {/* 2c. Pot Front Rims (occludes bottom stems so plants appear physically inside the pots) */}
      <img
        src="/foliage/pot-front-rims.png"
        alt=""
        className="hero-pot-rims"
        draggable={false}
      />

      {/* 3. Realistic Foreground Foliage Overlays (Gentle 3D indoor breeze effect) */}
      <div className="foliage-perspective-container" aria-hidden="true">
        {/* Cluster 1: Left Pothos Vine (Stem + Staggered Tip Leaf) */}
        <div className="foliage-cluster cluster-left-pothos">
          <div className="foliage-stem pothos-stem">
            <img
              src="/foliage/foliage-pothos-left-stem.png"
              alt=""
              className="foliage-img"
              draggable="false"
            />
            <div className="foliage-outer-leaf pothos-leaf-lag">
              <img
                src="/foliage/foliage-pothos-left-leaf.png"
                alt=""
                className="foliage-leaf-img"
                draggable="false"
              />
            </div>
          </div>
        </div>

        {/* Cluster 2: Left Near-Camera Cinematic Soft Blur Leaf */}
        <div className="foliage-cluster cluster-foreground-blur">
          <div className="foliage-stem foreground-blur-stem">
            <img
              src="/foliage/foliage-foreground-blur-leaf.png"
              alt=""
              className="foliage-img"
              draggable="false"
            />
          </div>
        </div>

        {/* Cluster 3: Right Ficus Branch (Stem + Staggered Top Leaf) */}
        <div className="foliage-cluster cluster-right-ficus">
          <div className="foliage-stem ficus-stem">
            <img
              src="/foliage/foliage-ficus-right-stem.png"
              alt=""
              className="foliage-img"
              draggable="false"
            />
            <div className="foliage-outer-leaf ficus-leaf-lag">
              <img
                src="/foliage/foliage-ficus-right-leaf.png"
                alt=""
                className="foliage-leaf-img"
                draggable="false"
              />
            </div>
          </div>
        </div>

        {/* Cluster 4: Right Mid Edge Dedicated Delicate Sprig */}
        <div className="foliage-cluster cluster-right-sprig">
          <div className="foliage-stem sprig-stem">
            <img
              src="/foliage/foliage-right-delicate-sprig.png"
              alt=""
              className="foliage-img"
              draggable="false"
            />
          </div>
        </div>
      </div>

      {/* 4. Minimal, Plant-Based UI: Top area placed cleanly without covering the pots */}
      <header className="hero-ui-header">
        <div className="hero-brand">
          <div className="brand-logo-wrap">
            <svg viewBox="0 0 34 34" fill="none" className="brand-sprout-icon" aria-hidden="true">
              <path
                d="M17 31 C17 21 24 13 32 8 C30 19 23 27 17 31 Z"
                fill="#1c482d"
              />
              <path
                d="M17 31 C17 19 10 12 2 8 C4 19 11 27 17 31 Z"
                fill="#2e6c46"
              />
              <path d="M17 31 L17 14" stroke="#102d1b" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <span className="brand-name">LeafLens</span>
          </div>
          <span className="hero-badge">Know your plant before it wilts</span>
        </div>

        {/* Hero Actions: Start Scanning + Modal Triggers */}
        <div className="hero-actions">
          <button
            type="button"
            className="action-btn action-btn-secondary"
            onClick={() => setActiveModal('crops')}
          >
            Supported Crops
          </button>
          <button
            type="button"
            className="action-btn action-btn-secondary"
            onClick={() => setActiveModal('how')}
          >
            How it works
          </button>
          <button
            type="button"
            className="action-btn action-btn-secondary"
            onClick={() => setActiveModal('about')}
          >
            About
          </button>
          <button
            type="button"
            className="action-btn action-btn-primary"
            onClick={onStartScan}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" aria-hidden="true">
              <path d="M3 4a1 1 0 011-1h3a1 1 0 010 2H5v2a1 1 0 01-2 0V4zm10-1a1 1 0 011 1v2a1 1 0 11-2 0V5h-2a1 1 0 110-2h3zM4 13a1 1 0 011 1v2h2a1 1 0 110 2H4a1 1 0 01-1-1v-3a1 1 0 011-1zm12 0a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 110-2h2v-2a1 1 0 011-1z" />
              <circle cx="10" cy="10" r="3" />
            </svg>
            Start scanning
          </button>
        </div>
      </header>

      {/* Hero Footnote: subtle readable assurance */}
      <footer className="hero-footer-note">
        <span>Instant leaf diagnosis &bull; 18 plant health classes &bull; 100% private local inference</span>
      </footer>

      {/* Lightweight Modals for Info Navigation */}
      {activeModal && (
        <div className="hero-modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="hero-modal-card" onClick={(e) => e.stopPropagation()}>
            {activeModal === 'crops' && (
              <div>
                <h2>Supported Plants & Classes</h2>
                <p>LeafLens classifies 18 specific disease & health classes across 4 plants:</p>
                <div className="crops-grid">
                  <div className="crop-group">
                    <h4>🍅 Tomato (10 classes)</h4>
                    <ul>
                      <li>Healthy leaf</li>
                      <li>Bacterial spot</li>
                      <li>Early blight</li>
                      <li>Late blight</li>
                      <li>Leaf mold</li>
                      <li>Septoria leaf spot</li>
                      <li>Two-spotted spider mites</li>
                      <li>Target spot</li>
                      <li>Yellow leaf curl virus</li>
                      <li>Mosaic virus</li>
                    </ul>
                  </div>
                  <div className="crop-group">
                    <h4>🥔 Potato (3 classes)</h4>
                    <ul>
                      <li>Healthy leaf</li>
                      <li>Early blight</li>
                      <li>Late blight</li>
                    </ul>
                    <h4 style={{ marginTop: '14px' }}>🫑 Pepper (bell) (2 classes)</h4>
                    <ul>
                      <li>Healthy leaf</li>
                      <li>Bacterial spot</li>
                    </ul>
                    <h4 style={{ marginTop: '14px' }}>🪴 Snake Plant (3 classes)</h4>
                    <ul>
                      <li>Healthy leaf</li>
                      <li>Anthracnose</li>
                      <li>Leaf withering</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {activeModal === 'how' && (
              <div>
                <h2>How LeafLens Works</h2>
                <div className="how-steps">
                  <div className="how-step">
                    <strong>1. Point or upload</strong>
                    <p>Hold your camera up to a single snake plant, tomato, potato, or pepper leaf, or upload a clear photo from your files.</p>
                  </div>
                  <div className="how-step">
                    <strong>2. Smart vegetation segmentation</strong>
                    <p>Vegetation filters and multi-crop tile analysis isolate the leaf surface and disregard background clutter.</p>
                  </div>
                  <div className="how-step">
                    <strong>3. Traffic-light health verdict</strong>
                    <p>🟢 Green indicates healthy foliage, 🔴 Red signals detected disease with treatment guidelines, and 🟡 Yellow signals uncertainty.</p>
                  </div>
                </div>
              </div>
            )}

            {activeModal === 'about' && (
              <div>
                <h2>About LeafLens</h2>
                <p>LeafLens is an ECS Mini Project (2026–27) intelligent agricultural assistance system.</p>
                <p style={{ marginTop: '10px' }}>
                  It demonstrates edge-friendly plant pathology classification utilizing MobileNetV2 with multi-crop candidate aggregation.
                </p>
                <div className="privacy-card">
                  🔒 <strong>Complete Privacy:</strong> All video frames, photos, and model predictions are executed locally on your device.
                </div>
              </div>
            )}

            <button
              type="button"
              className="modal-close-btn"
              onClick={() => setActiveModal(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
