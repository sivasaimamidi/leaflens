import React, { useState, useRef, useEffect } from 'react'
import './Scanner.css'
import { getDiseaseRecommendation } from '../data/diseaseRecommendations'
import { VoiceBot } from './VoiceBot'
import {
  getLocalizedPlantName,
  getLocalizedConditionName,
  getLocalizedVerdict,
} from '../services/voiceAssistant'

interface CropBox {
  x: number // 0 to 1
  y: number // 0 to 1
  w: number // 0 to 1
  h: number // 0 to 1
}

interface CropMeta {
  box: [number, number, number, number]
  green_ratio: number
}

interface ScanResult {
  verdict: 'healthy' | 'diseased' | 'uncertain'
  status?: string
  plant?: string
  condition?: string
  class_name?: string
  confidence?: number
  margin?: number
  message?: string
  reason?: string
  analysis_label?: string
  precautions?: string[]
  cure?: string[]
  top_predictions?: Array<{
    class_name: string
    plant: string
    condition: string
    status: string
    probability: number
  }>
  crops?: Array<{
    box: [number, number, number, number]
    class_name: string
    plant: string
    condition: string
    status: string
    confidence: number
    green_ratio: number
  }>
  latency_ms?: number
  target_performance?: string
  privacy?: string
}

type TrafficState = 'idle' | 'scanning' | 'healthy' | 'diseased' | 'uncertain'

export const Scanner: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  // Video and canvas refs
  const videoRef = useRef<HTMLVideoElement>(null)
  const leafMapCanvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Camera state
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceIndex, setDeviceIndex] = useState<number>(0)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [cameraLabel, setCameraLabel] = useState<string>('Back camera')

  // Scan state
  const [isScanning, setIsScanning] = useState<boolean>(false)
  const [frozenFrame, setFrozenFrame] = useState<string | null>(null)
  const [trafficState, setTrafficState] = useState<TrafficState>('idle')
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [scanDuration, setScanDuration] = useState<number | null>(null)
  const [backendOffline, setBackendOffline] = useState<boolean>(false)

  // Multilingual synchronization
  const [selectedLanguage, setSelectedLanguage] = useState<string>(() => {
    return localStorage.getItem('leaflens_voice_lang') || 'auto'
  })

  useEffect(() => {
    const handleLangChange = (e: any) => {
      setSelectedLanguage(e.detail || localStorage.getItem('leaflens_voice_lang') || 'auto')
    }
    window.addEventListener('leaflens-lang-changed', handleLangChange)
    return () => {
      window.removeEventListener('leaflens-lang-changed', handleLangChange)
    }
  }, [])

  // Drag and drop state
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const dragCounterRef = useRef<number>(0)

  const isMobile = window.innerWidth <= 700

  // 1. Enumerate and initialize camera
  useEffect(() => {
    let currentStream: MediaStream | null = null

    async function initCamera() {
      setCameraError(null)

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera API (getUserMedia) not available in this browser or insecure origin (requires HTTPS or localhost).')
        return
      }

      try {
        // Enumerate devices if supported
        const allDevices = await navigator.mediaDevices.enumerateDevices()
        const videoDevs = allDevices.filter((d) => d.kind === 'videoinput')
        setDevices(videoDevs)

        // Select constraint: default environment on mobile, user on desktop
        const initialFacing: 'user' | 'environment' = isMobile ? 'environment' : 'user'
        setFacingMode(initialFacing)

        const constraints: MediaStreamConstraints = {
          audio: false,
          video: {
            facingMode: initialFacing,
            width: { ideal: 1280 },
            height: { ideal: 960 },
          },
        }

        const newStream = await navigator.mediaDevices.getUserMedia(constraints)
        currentStream = newStream
        setStream(newStream)

        if (videoRef.current) {
          videoRef.current.srcObject = newStream
        }

        // Determine active track label
        const track = newStream.getVideoTracks()[0]
        if (track) {
          const label = track.label.toLowerCase()
          if (label.includes('front') || initialFacing === 'user') {
            setCameraLabel('Front camera')
          } else {
            setCameraLabel('Back camera')
          }
        }
      } catch (err: any) {
        console.error('Camera init error:', err)
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setCameraError('Camera permission denied. Please allow camera access in your browser settings, or use the Upload Photo option.')
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setCameraError('No camera found on this device. You can test using the Upload Photo option below.')
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setCameraError('Camera is currently in use by another application.')
        } else {
          setCameraError(`Camera error: ${err.message || 'Unable to access camera.'}`)
        }
      }
    }

    initCamera()

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach((t) => t.stop())
      }
    }
  }, [isMobile])

  // Keep videoRef synced with stream at all times
  useEffect(() => {
    if (videoRef.current && stream) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream
      }
      videoRef.current.play().catch(() => {})
    }
  }, [stream, frozenFrame])

  // Switch camera function
  const toggleCamera = async () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop())
    }

    try {
      let constraints: MediaStreamConstraints
      if (devices.length > 1) {
        // Cycle through enumerated cameras on desktop / multi-camera device
        const nextIdx = (deviceIndex + 1) % devices.length
        setDeviceIndex(nextIdx)
        const targetDevice = devices[nextIdx]
        constraints = {
          audio: false,
          video: {
            deviceId: { exact: targetDevice.deviceId },
            width: { ideal: 1280 },
            height: { ideal: 960 },
          },
        }
        setCameraLabel(targetDevice.label || `Camera ${nextIdx + 1}`)
      } else {
        // Toggle user/environment facing mode
        const nextFacing: 'user' | 'environment' = facingMode === 'user' ? 'environment' : 'user'
        setFacingMode(nextFacing)
        constraints = {
          audio: false,
          video: {
            facingMode: { ideal: nextFacing },
            width: { ideal: 1280 },
            height: { ideal: 960 },
          },
        }
        setCameraLabel(nextFacing === 'user' ? 'Front camera' : 'Back camera')
      }

      const newStream = await navigator.mediaDevices.getUserMedia(constraints)
      setStream(newStream)
      if (videoRef.current) {
        videoRef.current.srcObject = newStream
      }
    } catch (err: any) {
      console.error('Failed to toggle camera:', err)
      setCameraError('Could not switch camera: ' + (err.message || ''))
    }
  }

  // 2. Broad Vegetation and Disease/Necrosis Color Gate
  // Evaluates fraction of organic leaf pixels (green, chlorotic yellow, brown lesions)
  const computeBroadVegetationRatio = (ctx: CanvasRenderingContext2D, width: number, height: number): number => {
    const imgData = ctx.getImageData(0, 0, width, height)
    const data = imgData.data
    const totalPixels = width * height
    let vegetationPixels = 0

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]

      // RGB to HSV conversion
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const delta = max - min
      const v = max / 255
      const s = max === 0 ? 0 : delta / max

      let h = 0
      if (delta !== 0) {
        if (max === r) {
          h = ((g - b) / delta) % 6
        } else if (max === g) {
          h = (b - r) / delta + 2
        } else {
          h = (r - g) / delta + 4
        }
        h = h * 60
        if (h < 0) h += 360
      }

      // Broad leaf filter conditions:
      // A: Healthy green spectrum (35 deg to 105 deg) with moderate saturation & value
      const isGreen = h >= 35 && h <= 105 && s > 0.15 && v > 0.15
      // B: Yellowing / Chlorotic foliage (20 deg to 35 deg, e.g. Yellow Leaf Curl or senescence)
      const isYellow = h >= 20 && h < 35 && s > 0.15 && v > 0.20
      // C: Necrotic brown / Blight lesions / Target spots (10 deg to 25 deg with brownish value)
      const isBrownLesion = h >= 10 && h <= 25 && s > 0.12 && v >= 0.10 && v <= 0.70
      // D: General foliage contrast: Green channel notably higher than blue and not pure white/gray
      const isFoliageContrast = g > b + 15 && g > r * 0.85 && s > 0.12

      if (isGreen || isYellow || isBrownLesion || isFoliageContrast) {
        vegetationPixels++
      }
    }

    return vegetationPixels / totalPixels
  }

  // Generate 1 full-frame + 3x3 overlapping crops from a source canvas
  const extractCropsFromCanvas = async (
    sourceCanvas: HTMLCanvasElement,
  ): Promise<{ blobs: Blob[]; metas: CropMeta[]; displayBoxes: CropBox[] }> => {
    const sw = sourceCanvas.width
    const sh = sourceCanvas.height
    // Center crop square first
    const size = Math.min(sw, sh)
    const sx = (sw - size) / 2
    const sy = (sh - size) / 2

    // Offscreen canvas for square normalized base
    const squareCanvas = document.createElement('canvas')
    squareCanvas.width = size
    squareCanvas.height = size
    const sCtx = squareCanvas.getContext('2d')!
    sCtx.drawImage(sourceCanvas, sx, sy, size, size, 0, 0, size, size)

    const crops: { blob: Blob; meta: CropMeta; box: CropBox }[] = []

    // Helper to extract a single 224x224 crop
    const makeCrop = (xNorm: number, yNorm: number, wNorm: number, hNorm: number): Promise<{ blob: Blob; ratio: number } | null> => {
      return new Promise((resolve) => {
        const cropCanvas = document.createElement('canvas')
        cropCanvas.width = 224
        cropCanvas.height = 224
        const cCtx = cropCanvas.getContext('2d')!

        const px = xNorm * size
        const py = yNorm * size
        const pw = wNorm * size
        const ph = hNorm * size

        cCtx.drawImage(squareCanvas, px, py, pw, ph, 0, 0, 224, 224)
        const ratio = computeBroadVegetationRatio(cCtx, 224, 224)

        cropCanvas.toBlob(
          (blob) => {
            if (blob) resolve({ blob, ratio })
            else resolve(null)
          },
          'image/jpeg',
          0.9,
        )
      })
    }

    // 1. Full frame crop (always include full image)
    const fullCrop = await makeCrop(0, 0, 1, 1)
    if (fullCrop) {
      crops.push({
        blob: fullCrop.blob,
        meta: { box: [0, 0, 1, 1], green_ratio: Math.max(0.1, fullCrop.ratio) },
        box: { x: 0, y: 0, w: 1, h: 1 },
      })
    }

    // 2. 3x3 overlapping crops (each 50% width/height, stride 25%)
    const cropSize = 0.5
    const stride = 0.25
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const cx = col * stride
        const cy = row * stride
        const cRes = await makeCrop(cx, cy, cropSize, cropSize)
        if (cRes && cRes.ratio >= 0.04) {
          crops.push({
            blob: cRes.blob,
            meta: { box: [cx, cy, cx + cropSize, cy + cropSize], green_ratio: cRes.ratio },
            box: { x: cx, y: cy, w: cropSize, h: cropSize },
          })
        }
      }
    }

    return {
      blobs: crops.map((c) => c.blob),
      metas: crops.map((c) => c.meta),
      displayBoxes: crops.map((c) => c.box),
    }
  }

  // 3. Main Scanning Execution (Webcam multi-frame capture)
  const startScan = async () => {
    if (isScanning || !videoRef.current) return
    setIsScanning(true)
    setTrafficState('scanning')
    setScanResult(null)
    setBackendOffline(false)
    const startTime = performance.now()

    try {
      const video = videoRef.current
      const vw = video.videoWidth || 640
      const vh = video.videoHeight || 480

      const canvas = document.createElement('canvas')
      canvas.width = vw
      canvas.height = vh
      const ctx = canvas.getContext('2d')!

      // Freeze frame snapshot for UI display
      ctx.drawImage(video, 0, 0, vw, vh)
      const frozenDataUrl = canvas.toDataURL('image/jpeg', 0.95)
      setFrozenFrame(frozenDataUrl)

      // Capture 3-4 frames spaced out over ~1.8 - 2.2s to average out lighting/movement
      const allBlobs: Blob[] = []
      const allMetas: CropMeta[] = []

      const frameCount = 2
      const intervalMs = 250

      for (let f = 0; f < frameCount; f++) {
        ctx.drawImage(video, 0, 0, vw, vh)
        const { blobs, metas } = await extractCropsFromCanvas(canvas)
        allBlobs.push(...blobs)
        allMetas.push(...metas)

        if (f < frameCount - 1) {
          await new Promise((r) => setTimeout(r, intervalMs))
        }
      }

      // Candidate Leaf Gate: if no crops survive
      if (allBlobs.length < 1) {
        setTrafficState('uncertain')
        setScanResult({
          verdict: 'uncertain',
          reason: 'insufficient_leaf_regions',
          message: "Couldn't find clear leaf regions. Move closer, add light, or show a snake plant, tomato, potato or pepper leaf.",
          analysis_label: 'Leaf analysis',
        })
        setIsScanning(false)
        setScanDuration(Math.round(performance.now() - startTime))
        return
      }

      // Send batch to backend
      await submitBatchInference(allBlobs, allMetas, startTime)
    } catch (err: any) {
      console.error('Scan error:', err)
      setTrafficState('uncertain')
      setScanResult({
        verdict: 'uncertain',
        message: 'Scan error: ' + (err.message || 'Unknown failure'),
        analysis_label: 'Leaf analysis',
      })
    } finally {
      setIsScanning(false)
    }
  }

  // 4. Upload & Drag-and-Drop photo flow (exact same pipeline as camera frames)
  const processImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setTrafficState('uncertain')
      setScanResult({
        verdict: 'uncertain',
        message: 'Please drop or upload a valid image file (JPG, PNG, WebP).',
        analysis_label: 'Leaf analysis',
      })
      return
    }

    setIsScanning(true)
    setTrafficState('scanning')
    setScanResult(null)
    setBackendOffline(false)
    const startTime = performance.now()

    try {
      // Load image into HTMLImageElement
      const img = new Image()
      img.src = URL.createObjectURL(file)
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
      })

      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)

      setFrozenFrame(canvas.toDataURL('image/jpeg', 0.95))

      // Extract crops through identical pipeline
      const { blobs, metas } = await extractCropsFromCanvas(canvas)

      if (blobs.length < 1) {
        setTrafficState('uncertain')
        setScanResult({
          verdict: 'uncertain',
          reason: 'insufficient_leaf_regions',
          message: "Couldn't find clear leaf regions in uploaded photo. Show a snake plant, tomato, potato, or pepper leaf.",
          analysis_label: 'Leaf analysis',
        })
        setIsScanning(false)
        setScanDuration(Math.round(performance.now() - startTime))
        return
      }

      await submitBatchInference(blobs, metas, startTime)
    } catch (err: any) {
      console.error('Upload scan error:', err)
      setTrafficState('uncertain')
      setScanResult({
        verdict: 'uncertain',
        message: 'Upload processing failed: ' + (err.message || ''),
        analysis_label: 'Leaf analysis',
      })
    } finally {
      setIsScanning(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      processImageFile(file)
    }
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current += 1
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current -= 1
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0
      setIsDragging(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current = 0
    setIsDragging(false)

    if (isScanning) return

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      processImageFile(file)
      e.dataTransfer.clearData()
    }
  }

  // Common Batch Submission to POST /api/scan
  const submitBatchInference = async (blobs: Blob[], metas: CropMeta[], startTime: number) => {
    const formData = new FormData()
    // Cap batch at 24 crops to ensure snappy <3s performance
    const selectedBlobs = blobs.slice(0, 24)
    const selectedMetas = metas.slice(0, 24)

    selectedBlobs.forEach((blob, idx) => {
      formData.append('files', blob, `crop_${idx}.jpg`)
    })
    formData.append('metadata', JSON.stringify(selectedMetas))

    try {
      let resp: Response
      try {
        resp = await fetch('/api/scan', {
          method: 'POST',
          body: formData,
        })
      } catch (localErr) {
        console.warn('Local endpoint unavailable, routing to live LeafLens cloud engine...', localErr)
        resp = await fetch('https://frontend-roan-ten-89.vercel.app/api/scan', {
          method: 'POST',
          body: formData,
        })
      }

      // If local dev server returned 502/504/404, fallback to cloud
      if (!resp.ok && (resp.status >= 500 || resp.status === 404)) {
        resp = await fetch('https://frontend-roan-ten-89.vercel.app/api/scan', {
          method: 'POST',
          body: formData,
        })
      }

      if (resp.status === 503) {
        setTrafficState('uncertain')
        setBackendOffline(true)
        setScanResult({
          verdict: 'uncertain',
          message: 'Model initializing. Please try scanning again in a moment.',
          analysis_label: 'Leaf analysis',
        })
        return
      }

      if (!resp.ok) {
        throw new Error(`Server returned HTTP ${resp.status}`)
      }

      const data: ScanResult = await resp.json()
      setBackendOffline(false)
      setScanResult(data)

      // Set traffic light state
      if (data.verdict === 'healthy') {
        setTrafficState('healthy')
      } else if (data.verdict === 'diseased') {
        setTrafficState('diseased')
      } else {
        setTrafficState('uncertain')
      }

      const totalTime = Math.round(performance.now() - startTime)
      setScanDuration(totalTime)

      // Draw leaf map if crops returned
      if (data.crops && data.crops.length > 0) {
        drawLeafMap(data.crops)
      }
    } catch (err: any) {
      console.error('Inference error:', err)
      setTrafficState('uncertain')
      setBackendOffline(true)
      setScanResult({
        verdict: 'uncertain',
        message: 'Backend not running. Start server with: uvicorn server:app --reload in leaflens/backend',
        analysis_label: 'Leaf analysis',
      })
    }
  }

  // Draw surviving leaf crop boxes on leaf-map canvas
  const drawLeafMap = (crops: NonNullable<ScanResult['crops']>) => {
    const canvas = leafMapCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    crops.forEach((c) => {
      const [x1, y1, x2, y2] = c.box
      if (x1 === 0 && y1 === 0 && x2 === 1 && y2 === 1) return
      const w = (x2 - x1) * canvas.width
      const h = (y2 - y1) * canvas.height
      const x = x1 * canvas.width
      const y = y1 * canvas.height

      const isHealthy = c.status === 'healthy'
      ctx.strokeStyle = isHealthy ? '#2ecc71' : '#e74c3c'
      ctx.lineWidth = 2.5
      ctx.strokeRect(x, y, w, h)

      ctx.fillStyle = isHealthy ? 'rgba(46, 204, 113, 0.15)' : 'rgba(231, 76, 60, 0.15)'
      ctx.fillRect(x, y, w, h)
    })
  }

  const resetScan = () => {
    setFrozenFrame(null)
    setScanResult(null)
    setTrafficState('idle')
    setScanDuration(null)
    setBackendOffline(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (leafMapCanvasRef.current) {
      const ctx = leafMapCanvasRef.current.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, leafMapCanvasRef.current.width, leafMapCanvasRef.current.height)
    }
    if (videoRef.current && stream) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream
      }
      videoRef.current.play().catch(() => {})
    }
    // If camera is not available, clicking Scan again immediately prompts for a new photo
    if (cameraError) {
      fileInputRef.current?.click()
    }
  }

  return (
    <div className="scanner-screen">
      {/* Top Bar */}
      <header className="scanner-header">
        <button type="button" className="scanner-back-btn" onClick={onBack}>
          ← Back to home
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--leaf)' }}>
            LeafLens Prototype
          </span>
        </div>
      </header>

      {/* Main Two-Column Layout (Desktop 60/40, Mobile Stacks) */}
      <div className="scanner-grid">
        {/* Left Column: Camera / Frame Preview */}
        <div className="scanner-left">
          <div
            className={`camera-card ${isDragging ? 'camera-card-dragging' : ''}`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {/* Always keep video element mounted so camera stream is never detached or glitched */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`camera-video ${facingMode === 'user' ? 'mirrored' : ''}`}
              style={{ display: frozenFrame ? 'none' : 'block' }}
            />
            {isScanning && !frozenFrame && (
              <>
                <div className="scanning-grid-overlay" />
                <div className="scanning-sweep-line" />
              </>
            )}

            {frozenFrame && (
              <>
                <img src={frozenFrame} alt="Captured Plant Frame" className="camera-frozen-view" />
                <canvas
                  ref={leafMapCanvasRef}
                  width={640}
                  height={480}
                  className="leaf-overlay-canvas"
                />
              </>
            )}

            {/* Drag and Drop Active Overlay on Camera Frame */}
            {isDragging && (
              <div className="camera-drag-overlay">
                <div className="drag-overlay-card">
                  <div className="drag-overlay-icon">🌿</div>
                  <div className="drag-overlay-title">Drop your leaf photo here</div>
                  <div className="drag-overlay-subtitle">Release to analyze with AI immediately</div>
                </div>
              </div>
            )}

            {!frozenFrame && cameraError && (
              <div
                style={{
                  position: 'absolute',
                  inset: 20,
                  background: 'rgba(13, 36, 24, 0.85)',
                  color: '#fff',
                  borderRadius: '12px',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: '12px',
                }}
              >
                <div style={{ fontSize: '28px' }}>📷</div>
                <div style={{ fontWeight: 600 }}>Camera Notice</div>
                <div style={{ fontSize: '14px', lineHeight: '1.4' }}>{cameraError}</div>
              </div>
            )}
          </div>

          {/* Camera Controls */}
          <div className="camera-controls">
            {!frozenFrame ? (
              <>
                <button
                  type="button"
                  className="cam-btn cam-btn-primary"
                  onClick={startScan}
                  disabled={isScanning || !!cameraError}
                >
                  {isScanning ? 'Scanning leaves...' : 'Scan plant'}
                </button>
                <button type="button" className="cam-btn" onClick={toggleCamera} disabled={isScanning}>
                  🔄 Switch camera ({cameraLabel})
                </button>
              </>
            ) : (
              <button type="button" className="cam-btn cam-btn-primary" onClick={resetScan}>
                🔍 Scan again
              </button>
            )}

            {/* Upload Photo Button for testing without camera */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handlePhotoUpload}
            />
            <button
              type="button"
              className="cam-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={isScanning}
            >
              📁 Upload photo
            </button>
          </div>

          {/* Dedicated Drag & Drop Dropzone */}
          <div
            className={`scanner-dropzone ${isDragging ? 'scanner-dropzone-active' : ''}`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                fileInputRef.current?.click()
              }
            }}
          >
            <div className="dropzone-icon-box">
              <span className="dropzone-icon">🍃</span>
            </div>
            <div className="dropzone-info">
              <span className="dropzone-title">
                <strong>Drag & drop</strong> leaf image here, or <u>browse files</u>
              </span>
              <span className="dropzone-meta">Supports Snake Plant, Tomato, Potato, Pepper (JPG, PNG, WebP)</span>
            </div>
          </div>
        </div>

        {/* Right Column: Traffic Light & Results */}
        <div className="scanner-right">
          {/* Traffic Light Component */}
          <div className="traffic-light-card" aria-label="Health Indicator">
            <div className="traffic-light-housing">
              <div
                className={`lamp lamp-red ${trafficState === 'diseased' ? 'active' : ''}`}
                title="Needs attention"
              />
              <div
                className={`lamp lamp-yellow ${
                  trafficState === 'uncertain'
                    ? 'active'
                    : trafficState === 'scanning'
                    ? 'pulsing'
                    : ''
                }`}
                title="Scanning / Not sure"
              />
              <div
                className={`lamp lamp-green ${trafficState === 'healthy' ? 'active' : ''}`}
                title="Healthy"
              />
            </div>

            <div className="traffic-label">
              {trafficState === 'idle' && 'Ready to scan'}
              {trafficState === 'scanning' && 'Analyzing leaf regions...'}
              {trafficState === 'healthy' && 'Healthy'}
              {trafficState === 'diseased' && 'Needs attention'}
              {trafficState === 'uncertain' && 'Not sure'}
            </div>
          </div>

          {/* Diagnostic Result Card */}
          <div className="result-card">
            {scanResult ? (
              <div>
                <div className="result-header-row">
                  <div className="analysis-badge">🌿 Leaf analysis</div>
                  <span className={`status-pill status-pill-${scanResult.verdict}`}>
                    {getLocalizedVerdict(scanResult.verdict, selectedLanguage)}
                  </span>
                </div>

                {scanResult.plant && scanResult.plant !== 'Uncertain' && (
                  <h2 className="result-plant">
                    {getLocalizedPlantName(scanResult.plant, selectedLanguage)}
                  </h2>
                )}
                {scanResult.condition && (
                  <div className="result-condition">
                    {getLocalizedConditionName(scanResult.condition, selectedLanguage)}
                  </div>
                )}

                {scanResult.message && (
                  <div className="result-message-box">{scanResult.message}</div>
                )}

                {/* Confidence Bar */}
                {scanResult.confidence !== undefined && (
                  <div className="confidence-bar-wrap">
                    <div className="confidence-header">
                      <span>Confidence</span>
                      <strong>{Math.round(scanResult.confidence * 100)}%</strong>
                    </div>
                    <div className="confidence-bar-bg">
                      <div
                        className="confidence-bar-fill"
                        style={{
                          width: `${Math.round(scanResult.confidence * 100)}%`,
                          background:
                            scanResult.verdict === 'healthy'
                              ? '#2ecc71'
                              : scanResult.verdict === 'diseased'
                              ? '#e74c3c'
                              : '#f1c40f',
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* LeafLens Voice Bot: Spoken Diagnosis & Grounded Assistant */}
                <VoiceBot scanResult={scanResult} />

                {/* Precautions and Cure Recommendations */}
                {(() => {
                  const detectedClass = scanResult.class_name || scanResult.top_predictions?.[0]?.class_name
                  const rec = getDiseaseRecommendation(detectedClass)
                  const precautions = rec?.precautions || scanResult.precautions
                  const cure = rec?.cure || scanResult.cure

                  if (!precautions && !cure) return null

                  return (
                    <div className="recommendations-container">
                      {precautions && precautions.length > 0 && (
                        <div className="recommendation-card precautions-card">
                          <div className="rec-card-header">
                            <span className="rec-badge-icon">🛡️</span>
                            <h4 className="rec-title">Precautions (How to Prevent Recurrence)</h4>
                          </div>
                          <ul className="rec-items-list">
                            {precautions.map((p, idx) => (
                              <li key={idx}>{p}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {cure && cure.length > 0 && (
                        <div className="recommendation-card cure-card">
                          <div className="rec-card-header">
                            <span className="rec-badge-icon">💊</span>
                            <h4 className="rec-title">Cure &amp; Treatment Steps</h4>
                          </div>
                          <ul className="rec-items-list">
                            {cure.map((c, idx) => (
                              <li key={idx}>{c}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* Top 3 Predictions */}
                {scanResult.top_predictions && scanResult.top_predictions.length > 0 && (
                  <div className="top3-predictions">
                    <div style={{ fontWeight: 600, marginBottom: '6px' }}>Top predictions:</div>
                    {scanResult.top_predictions.map((p, idx) => (
                      <div key={idx} className="top3-item">
                        <span>
                          {p.plant} — {p.condition}
                        </span>
                        <span>{Math.round(p.probability * 100)}%</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Leaf Map Legend */}
                {scanResult.crops && scanResult.crops.length > 0 && (
                  <div style={{ marginTop: '16px', fontSize: '12px', opacity: 0.85 }}>
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>Leaf Map:</div>
                    <span>
                      Green boxes = healthy leaf crops &nbsp;|&nbsp; Red boxes = diseased leaf crops
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ opacity: 0.75, fontSize: '14px', lineHeight: '1.6' }}>
                <div className="analysis-badge">🌿 Leaf analysis</div>
                <p>
                  Hold a Snake Plant, Tomato, Potato, or Bell Pepper leaf in front of the camera, or upload a photo.
                </p>
                <p>
                  The system will analyze detected leaf candidate regions, filter non-leaf background,
                  and display the diagnosis, health status indicator, confidence, prevention precautions, and cure steps.
                </p>
              </div>
            )}

            {backendOffline && (
              <div
                style={{
                  background: 'rgba(231, 76, 60, 0.15)',
                  border: '1px solid #e74c3c',
                  borderRadius: '8px',
                  padding: '12px',
                  marginTop: '12px',
                  fontSize: '13px',
                }}
              >
                <strong style={{ color: '#e74c3c' }}>Backend not running</strong>
                <p style={{ margin: '4px 0 0 0', color: 'var(--ink)' }}>
                  Start server with: <code>uvicorn server:app --reload</code> in <code>leaflens/backend</code>
                </p>
              </div>
            )}

            {/* Performance and Privacy Metadata */}
            <div className="perf-badge">
              <div>🎯 <strong>Target: under 3 seconds on a normal laptop.</strong></div>
              {scanDuration !== null && (
                <div style={{ marginTop: '4px' }}>
                  ⏱️ Latency: {scanDuration} ms (client-to-result)
                  {scanResult?.latency_ms ? ` | Server inference: ${scanResult.latency_ms} ms` : ''}
                </div>
              )}
              <div style={{ marginTop: '8px', fontSize: '11px', opacity: 0.8 }}>
                🔒 Images are processed locally for this prototype and are not uploaded or stored.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
