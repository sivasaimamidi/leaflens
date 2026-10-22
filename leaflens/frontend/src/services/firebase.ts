import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app'
import { getDatabase, ref, set, get, onValue, type Database } from 'firebase/database'
import { getAnalytics, isSupported } from 'firebase/analytics'
import { getDiseaseRecommendation } from '../data/diseaseRecommendations'

/**
 * LeafLens Firebase Configuration
 * Project: leaflens-9f9c6
 * Realtime Database: https://leaflens-9f9c6-default-rtdb.firebaseio.com
 */
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyB2n_ksO_XcUcKsApFbHPXkWtrFw4H4Hys",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "leaflens-9f9c6.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://leaflens-9f9c6-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "leaflens-9f9c6",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "leaflens-9f9c6.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "655972868405",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:655972868405:web:b04938f8955bde22a6ec7c",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-C9WRHKBQVB"
}

// Initialize Firebase singleton
export const firebaseApp: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
export const firebaseDb: Database = getDatabase(firebaseApp)

// Initialize Analytics safely on client
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      getAnalytics(firebaseApp)
    }
  }).catch(() => {})
}

export interface HardwarePredictionPayload {
  plant: string
  condition: string
  isHealthy: boolean
  confidence: number
  precautions: string[]
  cure: string[]
  timestamp: number
}

/**
 * Trims and shortens text to strictly satisfy length constraint (<= 80 characters)
 * for compact hardware display screens (LCD / OLED / e-ink).
 */
export function formatTipForHardware(text: string, maxLen: number = 80): string {
  if (!text) return ''
  const trimmed = text.trim().replace(/\s+/g, ' ')
  if (trimmed.length <= maxLen) return trimmed

  const target = trimmed.slice(0, maxLen - 3)
  const lastSpace = target.lastIndexOf(' ')
  if (lastSpace > 35) {
    return target.slice(0, lastSpace).trim() + '...'
  }
  return target.trim() + '...'
}

/**
 * Curated concise (<= 80 characters) hardware display tips for LeafLens classes
 */
const HARDWARE_TIPS: Record<string, { precautions: [string, string]; cure: [string, string] }> = {
  "Pepper__bell___Bacterial_spot": {
    precautions: [
      "Use certified pathogen-free seeds and disease-free transplants.",
      "Rotate crops 2-3 yrs away from nightshades; water at base only."
    ],
    cure: [
      "Prune and destroy infected leaves; remove severely diseased plants.",
      "Spray fixed copper bactericide mixed with Mancozeb every 7-10 days."
    ]
  },
  "Pepper__bell___healthy": {
    precautions: [
      "Maintain even soil moisture using base watering (1-2 in/week).",
      "Space plants 45-60 cm apart for optimal airflow and sunlight."
    ],
    cure: [
      "No treatment required. The plant is healthy.",
      "Continue routine weekly scouting for early signs of pests."
    ]
  },
  "Potato___Early_blight": {
    precautions: [
      "Plant certified disease-free seed tubers and balance soil nutrients.",
      "Rotate crops away from potatoes and tomatoes for at least 2-3 years."
    ],
    cure: [
      "Remove heavily infected lower leaves showing dark target spots.",
      "Apply protectant fungicide like Mancozeb or Chlorothalonil every 7-10 d."
    ]
  },
  "Potato___Late_blight": {
    precautions: [
      "Use certified disease-free seed tubers and destroy cull piles.",
      "Hill soil high around bases to protect tubers from fungal spores."
    ],
    cure: [
      "Immediately destroy blighted foliage to stop rapid field spread.",
      "Spray targeted fungicide like Cymoxanil + Mancozeb or Metalaxyl."
    ]
  },
  "Potato___healthy": {
    precautions: [
      "Keep developing tubers well-covered with hilled soil.",
      "Water at the soil line and monitor weather during humid periods."
    ],
    cure: [
      "No treatment required. The plant is healthy.",
      "Maintain balanced fertilization and regular foliage scouting."
    ]
  },
  "Snake_Plant_Anthracnose": {
    precautions: [
      "Water strictly at soil base; never wet snake plant leaves.",
      "Maintain low humidity (25-40%) and strong room airflow."
    ],
    cure: [
      "Isolate infected plant immediately from other indoor houseplants.",
      "Trim affected lesions with sterile shears; apply copper fungicide."
    ]
  },
  "Snake_Plant_Leaf_Withering": {
    precautions: [
      "Use fast-draining cactus soil with 40% perlite in a drainage pot.",
      "Allow soil to dry completely between waterings (every 2-3 weeks)."
    ],
    cure: [
      "Unpot plant, inspect roots, and trim soft black root rot.",
      "Dust rhizomes with fungicide powder, dry 24h, and repot in dry mix."
    ]
  },
  "Snake_Plant_Healthy": {
    precautions: [
      "Keep in bright indirect light and water only when bone-dry.",
      "Wipe dust off leaves monthly with a dry cloth for sunlight capture."
    ],
    cure: [
      "No treatment required. Your Snake Plant is healthy and thriving.",
      "Check soil dryness before watering to prevent root rot."
    ]
  },
  "Tomato__Target_Spot": {
    precautions: [
      "Stake and prune plants to improve airflow and reduce humidity.",
      "Use drip irrigation instead of overhead watering to keep leaves dry."
    ],
    cure: [
      "Prune and destroy infected lower leaves showing target brown spots.",
      "Apply Chlorothalonil or Mancozeb fungicide across lower canopy."
    ]
  },
  "Tomato__Tomato_mosaic_virus": {
    precautions: [
      "Plant ToMV-resistant tomato varieties and disease-free seeds.",
      "Wash hands with soap before touching plants; disinfect tools."
    ],
    cure: [
      "No chemical cure exists for viral plant infections.",
      "Uproot and destroy infected mottled plants immediately to stop spread."
    ]
  },
  "Tomato__Tomato_YellowLeaf__Curl_Virus": {
    precautions: [
      "Grow TYLCV-resistant varieties and protect seedlings with insect nets.",
      "Install yellow sticky traps to capture whitefly vectors early."
    ],
    cure: [
      "Uproot and destroy stunted, curling plants to prevent vector spread.",
      "Control whiteflies with Neem oil or insecticidal soap sprays."
    ]
  },
  "Tomato_Bacterial_spot": {
    precautions: [
      "Use certified clean seeds; rotate away from nightshades for 2-3 yrs.",
      "Stake and mulch plants to prevent soil splash; irrigate at base."
    ],
    cure: [
      "Remove symptomatic lower leaves and sanitize shears between cuts.",
      "Spray copper bactericide mixed with Mancozeb every 7-10 days."
    ]
  },
  "Tomato_Early_blight": {
    precautions: [
      "Stake plants and prune bottom 15 cm of foliage once established.",
      "Apply mulch over soil to block fungal spores splashing from soil."
    ],
    cure: [
      "Prune lower leaves showing concentric bullseye rings and yellowing.",
      "Spray Mancozeb or Chlorothalonil protectant fungicide every 7-10 days."
    ]
  },
  "Tomato_Late_blight": {
    precautions: [
      "Avoid planting tomatoes near potatoes; remove volunteer plants.",
      "Space plants for airflow; never water foliage late in the day."
    ],
    cure: [
      "Immediately destroy blighted foliage to prevent rapid garden spread.",
      "Apply protective fungicides like Chlorothalonil or Mancozeb promptly."
    ]
  },
  "Tomato_Leaf_Mold": {
    precautions: [
      "Ventilate growing area to keep relative humidity below 85%.",
      "Water directly at soil base to keep foliage completely dry."
    ],
    cure: [
      "Prune lower leaves with olive-green velvety mold underneath.",
      "Spray Copper hydroxide or Chlorothalonil fungicide at first sign."
    ]
  },
  "Tomato_Septoria_leaf_spot": {
    precautions: [
      "Practice 2-3 year crop rotation away from nightshade crops.",
      "Mulch around plant base to prevent rain-splash spore transmission."
    ],
    cure: [
      "Pinch off lower leaves showing circular spots with dark borders.",
      "Apply Chlorothalonil or Mancozeb fungicide every 7-10 days."
    ]
  },
  "Tomato_Spider_mites_Two_spotted_spider_mite": {
    precautions: [
      "Keep garden free of dusty conditions and broadleaf weeds.",
      "Inspect leaf undersides routinely for webbing and stippling."
    ],
    cure: [
      "Spray leaf undersides with strong water jets to dislodge mites.",
      "Apply insecticidal soap or Neem oil under leaves every 3-5 days."
    ]
  },
  "Tomato_healthy": {
    precautions: [
      "Provide 6-8 hrs direct sunlight and 1-2 in water per week at base.",
      "Stake plants upright to keep foliage off damp soil."
    ],
    cure: [
      "No treatment required. Your tomato plant is healthy and vigorous.",
      "Maintain consistent watering and scout leaf undersides weekly."
    ]
  }
}

/**
 * Normalizes plant name into standard title (e.g. "Bell Pepper", "Potato", "Tomato", "Snake Plant")
 */
function normalizePlantName(rawPlant?: string, detectedClass?: string): string {
  if (rawPlant) {
    const p = rawPlant.trim()
    if (p.toLowerCase().includes('pepper')) return 'Bell Pepper'
    if (p.toLowerCase().includes('potato')) return 'Potato'
    if (p.toLowerCase().includes('tomato')) return 'Tomato'
    if (p.toLowerCase().includes('snake')) return 'Snake Plant'
    return p
  }

  if (detectedClass) {
    if (detectedClass.toLowerCase().startsWith('pepper')) return 'Bell Pepper'
    if (detectedClass.toLowerCase().startsWith('potato')) return 'Potato'
    if (detectedClass.toLowerCase().startsWith('snake')) return 'Snake Plant'
    if (detectedClass.toLowerCase().startsWith('tomato')) return 'Tomato'
  }

  return 'Plant'
}

/**
 * Normalizes condition name
 */
function normalizeConditionName(rawCondition?: string, isHealthy: boolean = false): string {
  if (isHealthy) return 'Healthy'
  if (!rawCondition || rawCondition.toLowerCase() === 'healthy') return 'Healthy'
  return rawCondition.trim()
}

/**
 * Prepares strictly 2 precaution tips (<= 80 chars each)
 */
function preparePrecautions(detectedClass: string, isHealthy: boolean, recPrecautions?: string[]): [string, string] {
  if (HARDWARE_TIPS[detectedClass]?.precautions) {
    return HARDWARE_TIPS[detectedClass].precautions
  }

  const tips: string[] = []
  if (recPrecautions && recPrecautions.length > 0) {
    recPrecautions.slice(0, 2).forEach((p) => {
      tips.push(formatTipForHardware(p, 80))
    })
  }

  while (tips.length < 2) {
    if (isHealthy) {
      tips.push(formatTipForHardware(tips.length === 0 ? "Water at soil base and maintain 6-8 hours of adequate sunlight." : "Scout leaf undersides weekly for early pests or moisture imbalance.", 80))
    } else {
      tips.push(formatTipForHardware(tips.length === 0 ? "Avoid overhead irrigation and sanitize pruning tools between cuts." : "Ensure proper spacing between crops to promote healthy airflow.", 80))
    }
  }

  return [tips[0], tips[1]]
}

/**
 * Prepares strictly 2 cure steps (<= 80 chars each)
 */
function prepareCure(detectedClass: string, isHealthy: boolean, recCure?: string[]): [string, string] {
  if (HARDWARE_TIPS[detectedClass]?.cure) {
    return HARDWARE_TIPS[detectedClass].cure
  }

  const steps: string[] = []
  if (recCure && recCure.length > 0) {
    recCure.slice(0, 2).forEach((c) => {
      steps.push(formatTipForHardware(c, 80))
    })
  }

  while (steps.length < 2) {
    if (isHealthy) {
      steps.push(formatTipForHardware(steps.length === 0 ? "No treatment required. The plant is healthy." : "Maintain regular watering and fertilization schedule.", 80))
    } else {
      steps.push(formatTipForHardware(steps.length === 0 ? "Prune and dispose of infected leaves immediately to contain spread." : "Apply appropriate protective or organic fungicide as recommended.", 80))
    }
  }

  return [steps[0], steps[1]]
}

/**
 * Writes the diagnosis result automatically to the `latest_prediction` node
 * in the Firebase Realtime Database.
 */
export async function syncPredictionToFirebase(scanResult: {
  verdict?: 'healthy' | 'diseased' | 'uncertain'
  status?: string
  plant?: string
  condition?: string
  class_name?: string
  confidence?: number
  precautions?: string[]
  cure?: string[]
  top_predictions?: Array<{
    class_name: string
    plant: string
    condition: string
    status: string
    probability: number
  }>
}): Promise<HardwarePredictionPayload> {
  const detectedClass = scanResult.class_name || scanResult.top_predictions?.[0]?.class_name || ''
  const rec = getDiseaseRecommendation(detectedClass)

  const isHealthy = rec?.isHealthy ?? (scanResult.verdict === 'healthy' || scanResult.status === 'healthy')
  const plant = normalizePlantName(scanResult.plant || rec?.plant, detectedClass)
  const condition = normalizeConditionName(rec?.condition || scanResult.condition, isHealthy)

  // Calculate integer confidence percentage
  let confidencePct = 95
  if (typeof scanResult.confidence === 'number') {
    confidencePct = scanResult.confidence <= 1 ? Math.round(scanResult.confidence * 100) : Math.round(scanResult.confidence)
  } else if (scanResult.top_predictions?.[0]?.probability !== undefined) {
    const prob = scanResult.top_predictions[0].probability
    confidencePct = prob <= 1 ? Math.round(prob * 100) : Math.round(prob)
  }

  // Ensure bounds [0, 100]
  confidencePct = Math.max(0, Math.min(100, confidencePct))

  const precautions = preparePrecautions(detectedClass, isHealthy, rec?.precautions || scanResult.precautions)
  const cure = prepareCure(detectedClass, isHealthy, rec?.cure || scanResult.cure)
  const timestamp = Date.now()

  const payload: HardwarePredictionPayload = {
    plant,
    condition,
    isHealthy,
    confidence: confidencePct,
    precautions: [precautions[0], precautions[1]],
    cure: [cure[0], cure[1]],
    timestamp
  }

  // Double check constraint compliance
  payload.precautions.forEach((p, idx) => {
    if (p.length > 80) payload.precautions[idx] = formatTipForHardware(p, 80)
  })
  payload.cure.forEach((c, idx) => {
    if (c.length > 80) payload.cure[idx] = formatTipForHardware(c, 80)
  })

  const predictionNodeRef = ref(firebaseDb, 'latest_prediction')
  await set(predictionNodeRef, payload)
  console.log('[Firebase RTDB] Diagnosis synced to latest_prediction:', payload)

  return payload
}

/**
 * Fetch the latest prediction currently saved in Firebase RTDB
 */
export async function fetchLatestPrediction(): Promise<HardwarePredictionPayload | null> {
  try {
    const predictionNodeRef = ref(firebaseDb, 'latest_prediction')
    const snapshot = await get(predictionNodeRef)
    if (snapshot.exists()) {
      return snapshot.val() as HardwarePredictionPayload
    }
    return null
  } catch (err) {
    console.warn('[Firebase RTDB] Failed to fetch latest prediction:', err)
    return null
  }
}

/**
 * Real-time listener for the latest prediction
 */
export function subscribeToLatestPrediction(
  callback: (data: HardwarePredictionPayload | null) => void
): () => void {
  const predictionNodeRef = ref(firebaseDb, 'latest_prediction')
  return onValue(
    predictionNodeRef,
    (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.val() as HardwarePredictionPayload)
      } else {
        callback(null)
      }
    },
    (err) => {
      console.warn('[Firebase RTDB] Subscription error:', err)
    }
  )
}
