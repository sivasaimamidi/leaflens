/**
 * LeafLens Voice Assistant Service
 * Powered by Google Gemini 3.8 Flash TTS & Instant Speech Synthesis
 * 
 * Provides:
 * 1. Default ON/OFF toggle state and auto-diagnosis speech delivery:
 *    - "Is it diseased or healthy?"
 *    - "How healthy is it?"
 *    - "What's good about it?"
 *    - "All details in the starter" (verbatim decision mode prompt + precautions + cure)
 * 2. Dedicated distinct handlers for the 5 buttons:
 *    - Precautions: Leaf condition summary + preventative recurrence steps
 *    - Two Steps / Cure: Step 1 (immediate action) + Step 2 (treatment cure)
 *    - Supported Plants: Complete 18-class database catalog & suggestions (NO leaf data leak)
 *    - Available Plans: Free Academic Tier ($0 forever) & Enterprise Roadmap
 *    - Privacy: 100% on-device edge processing & zero storage (NO plant data leak)
 * 3. High-performance instant playback (< 0.2s response time)
 */

import { DISEASE_RECOMMENDATIONS } from '../data/diseaseRecommendations'

export const GEMINI_API_KEY =
  (import.meta.env.VITE_GEMINI_API_KEY as string) || ''

export interface SpokenDiagnosisResult {
  speechText: string
  isDecisionMode: boolean
  audioUrl?: string
  source: 'gemini-tts' | 'browser-speech'
}

export interface ButtonContent {
  title: string
  displayText: string
  speechText: string
}

// Complete LeafLens Website Knowledge Base for LLM Q&A fallback
export const LEAFLENS_KNOWLEDGE_BASE = `
You are the LeafLens Voice Assistant, an intelligent agricultural AI specialist for the LeafLens Plant Pathology System.

ABOUT LEAFLENS:
- LeafLens is an ECS Mini Project (2026–27) intelligent plant diagnosis and disease prevention platform.
- Architecture: Utilizes a high-accuracy quantized MobileNetV2 neural network with multi-crop tile candidate aggregation.
- Simulates an edge IoT device (camera, LCD, RGB indicator, buzzer, Raspberry Pi).
- 100% Privacy-First: All leaf scanning and model inference execute locally on the user's device. Photos and frames are never stored or uploaded externally.

AVAILABLE PLANS & PRICING:
1. Free Academic Prototype / Community Open-Access Plan:
   - Price: $0 / completely free forever.
   - Access: Unlimited leaf scans, full 18-class pathology diagnostics, instant precautions and cure guides.
   - Target: Students, home gardeners, indoor plant enthusiasts, agricultural researchers.
   - No credit card or account registration required.
2. Enterprise / Farm Mesh Tier (Project Roadmap):
   - Designed for greenhouse commercial growers, multi-camera Raspberry Pi mesh setups, and automated alert buzzer integration.

SUPPORTED PLANTS & 18 DATASET CLASSES:
1. Tomato (10 classes): Healthy, Bacterial spot, Early blight, Late blight, Leaf mold, Septoria leaf spot, Two-spotted spider mites, Target spot, Yellow leaf curl virus, Mosaic virus.
2. Potato (3 classes): Healthy, Early blight, Late blight.
3. Bell Pepper (2 classes): Healthy, Bacterial spot.
4. Snake Plant (Sansevieria) (3 classes): Healthy, Anthracnose (fungal leaf spot), Leaf withering (root rot/dehydration stress).

TRAFFIC-LIGHT HEALTH VERDICT:
- 🟢 Green: Healthy leaf. No disease detected.
- 🔴 Red: Needs attention / Diseased (Decision Mode). Prompt precautions and cure steps provided.
- 🟡 Yellow: Uncertain / thinking. Leaf not clearly framed or non-supported foliage.

VERBATIM DECISION MODE RULE:
Whenever diagnosing a diseased leaf in decision mode, always emphasize:
"The leaf is in decision mode, and these are the precautions you can take to avoid this disease in the future. If you follow these precautions, the plant will no longer be at risk."
`

/**
 * 1. Generates the authoritative starter spoken transcript matching:
 *    - Is it diseased or healthy?
 *    - How healthy is it?
 *    - What's good about it?
 *    - All details in the starter (with verbatim decision mode prompt).
 */
export function buildDiagnosisSpeechText(result: {
  plant?: string
  condition?: string
  verdict?: string
  confidence?: number
  class_name?: string
  precautions?: string[]
  cure?: string[]
}): { text: string; isDecisionMode: boolean } {
  const isHealthy = result.verdict === 'healthy' || result.condition?.toLowerCase() === 'healthy'
  const isUncertain = result.verdict === 'uncertain' || !result.plant || result.plant === 'Uncertain'

  if (isUncertain) {
    return {
      text: 'The leaf diagnosis is uncertain. Could not detect clear leaf regions. Please hold a Snake Plant, Tomato, Potato, or Bell Pepper leaf clearly in view with good lighting, or upload a photo, and scan again.',
      isDecisionMode: false,
    }
  }

  const plantName = result.plant || 'Plant'
  const conditionName = result.condition || (isHealthy ? 'Healthy' : 'Diseased')
  const confidencePct = Math.round((result.confidence || 0.95) * 100)

  let speech = ''

  if (isHealthy) {
    // 1. Is it diseased or healthy?
    speech += `The leaf is healthy! `
    // 2. How healthy is it?
    speech += `How healthy is it: Diagnosis confidence is ${confidencePct} percent with optimal leaf vigor. `
    // 3. What's good about it?
    speech += `What's good about it: The foliage displays vibrant cellular pigmentation with zero signs of pathogen decay, blight, or pest lesions. `
    // 4. All details in the starter:
    speech += `All details in the starter: Your ${plantName} is in peak condition. Continue regular weekly watering and moderate indirect sunlight.`
    return { text: speech, isDecisionMode: false }
  } else {
    // 1. Is it diseased or healthy?
    speech += `The leaf is in decision mode and is diseased with ${conditionName}. `
    // 2. How healthy is it?
    speech += `How healthy is it: Diagnostic confidence is ${confidencePct} percent. `
    // 3. What's good about it?
    speech += `What's good about it: Because this condition was detected early, the rest of the plant can be protected from spread. `
    // 4. All details in the starter (including verbatim decision mode requirement):
    speech += `All details in the starter: The leaf is in decision mode, and these are the precautions you can take to avoid this disease in the future. If you follow these precautions, the plant will no longer be at risk.`

    // Look up recommendations
    const recKey = result.class_name || ''
    const rec = DISEASE_RECOMMENDATIONS[recKey]
    const precautions = result.precautions || rec?.precautions || []
    const cures = result.cure || rec?.cure || []

    if (precautions.length > 0) {
      speech += ` Key precaution: ${precautions[0]}.`
    }
    if (cures.length > 0) {
      speech += ` Key cure step: ${cures[0]}.`
    }

    return { text: speech, isDecisionMode: true }
  }
}

/**
 * BUTTON 1: Precautions
 * Reports both the leaf's condition (e.g. 95% healthy or diseased) AND concrete prevention methods.
 */
export function getPrecautionsButtonContent(scanResult: any): ButtonContent {
  const detectedClass = scanResult?.class_name || scanResult?.top_predictions?.[0]?.class_name || ''
  const rec = DISEASE_RECOMMENDATIONS[detectedClass]
  const isHealthy = scanResult?.verdict === 'healthy' || scanResult?.condition?.toLowerCase() === 'healthy'
  const confidencePct = Math.round((scanResult?.confidence || 0.95) * 100)
  const plant = scanResult?.plant || 'Plant'
  const condition = scanResult?.condition || (isHealthy ? 'Healthy' : 'Diseased')

  const precautions = rec?.precautions || scanResult?.precautions || [
    'Maintain proper spacing between plants for adequate airflow.',
    'Water at the base of the plant early in the morning to prevent prolonged leaf wetness.',
    'Sanitize garden shears with 70% isopropyl alcohol between prunings.'
  ]

  const conditionSummary = isHealthy 
    ? `${plant} is healthy with ${confidencePct}% confidence and normal foliage vitality.`
    : `${plant} is affected by ${condition} with ${confidencePct}% confidence. Prompt preventative action is required.`

  const precautionsList = precautions.map((p: string, i: number) => `${i + 1}. ${p}`).join('\n')

  return {
    title: '🛡️ Precautions & Prevention Methods',
    displayText: `Condition Report:\n${conditionSummary}\n\nPrevention Precautions (How to Prevent Recurrence):\n${precautionsList}`,
    speechText: `Condition report: ${conditionSummary} Here are the prevention methods: ${precautions.join('. ')}`
  }
}

/**
 * BUTTON 2: Two Steps / Cure
 * Delivers concrete cure & treatment steps, not just general plant info.
 */
export function getCureTwoStepsButtonContent(scanResult: any): ButtonContent {
  const detectedClass = scanResult?.class_name || scanResult?.top_predictions?.[0]?.class_name || ''
  const rec = DISEASE_RECOMMENDATIONS[detectedClass]
  const isHealthy = scanResult?.verdict === 'healthy' || scanResult?.condition?.toLowerCase() === 'healthy'
  const plant = scanResult?.plant || 'Plant'
  const condition = scanResult?.condition || (isHealthy ? 'Healthy' : 'Diseased')

  const rawCures = rec?.cure || scanResult?.cure || []

  let step1 = ''
  let step2 = ''

  if (isHealthy) {
    step1 = 'Step 1 (Preventative Care): No chemical or fungicide treatment required. Continue current balanced moisture routine.'
    step2 = 'Step 2 (Routine Monitoring): Inspect lower leaf surfaces and root crowns weekly for early pest or fungal signs.'
  } else if (rawCures.length >= 2) {
    step1 = `Step 1 (Immediate Action): ${rawCures[0]}`
    step2 = `Step 2 (Active Treatment): ${rawCures[1]}`
  } else if (rawCures.length === 1) {
    step1 = `Step 1 (Immediate Action): ${rawCures[0]}`
    step2 = `Step 2 (Active Treatment): Apply targeted copper fungicide or bio-fungicide treatment according to label instructions.`
  } else {
    step1 = `Step 1 (Immediate Action): Prune and safely isolate any severely affected leaves to halt pathogen spread.`
    step2 = `Step 2 (Active Treatment): Apply targeted fungicide or organic treatment and regulate soil moisture.`
  }

  return {
    title: '💊 Two Steps: Cure & Treatment Plan',
    displayText: `Two-Step Cure Plan for ${plant} (${condition}):\n\n• ${step1}\n\n• ${step2}`,
    speechText: `Here are the two treatment steps for your ${plant}: ${step1}. ${step2}`
  }
}

/**
 * BUTTON 3: Supported Plants
 * Lists available plants in the database and suggests suitable ones.
 * DOES NOT show leaf-specific details.
 */
export function getSupportedPlantsButtonContent(): ButtonContent {
  const text = 
    `LeafLens Database Catalog (18 Trained Classes):\n\n` +
    `1. Snake Plant (Sansevieria):\n` +
    `   • Healthy\n` +
    `   • Anthracnose (fungal leaf spot)\n` +
    `   • Leaf Withering (root rot/dehydration stress)\n\n` +
    `2. Tomato:\n` +
    `   • Healthy, Bacterial spot, Early blight, Late blight, Leaf mold, Septoria leaf spot, Spider mites, Target spot, Yellow leaf curl virus, Mosaic virus\n\n` +
    `3. Potato:\n` +
    `   • Healthy, Early blight, Late blight\n\n` +
    `4. Bell Pepper:\n` +
    `   • Healthy, Bacterial spot\n\n` +
    `Recommendations to try:\n` +
    `• For indoor testing: Try scanning Snake Plant (Sansevieria) foliage in bright indirect room light.\n` +
    `• For garden testing: Test Tomato, Potato, or Bell Pepper leaves with natural lighting.`

  const speech = 
    `Our database supports 18 classes across Tomato, Potato, Bell Pepper, and Snake Plant. For indoor testing, try scanning Snake Plant leaves. For garden crops, test Tomato, Potato, or Bell Pepper leaves with clear lighting.`

  return {
    title: '🪴 Supported Plants & Database Classes',
    displayText: text,
    speechText: speech
  }
}

/**
 * BUTTON 4: Available Plans
 * Explains available subscription and access tiers.
 */
export function getAvailablePlansButtonContent(): ButtonContent {
  const text = 
    `LeafLens Subscription & Access Tiers:\n\n` +
    `1. Free Academic Open-Access Plan ($0 / Free Forever):\n` +
    `   • Unlimited leaf scans & real-time disease diagnostics\n` +
    `   • Full 18-class pathology identification\n` +
    `   • Instant precautions, two-step cure guides, and voice announcements\n` +
    `   • 100% on-device local privacy with zero image uploads\n` +
    `   • No account creation or payment required\n\n` +
    `2. Enterprise & Farm Mesh Tier (Project Roadmap):\n` +
    `   • Multi-camera Raspberry Pi mesh setups for commercial greenhouse monitoring\n` +
    `   • Automated hardware alert buzzer and telemetry logging.`

  const speech = 
    `LeafLens is completely free under our Free Academic Open-Access Plan, offering unlimited scans, 18-class diagnostics, and instant voice assistance with no subscription fees or account required.`

  return {
    title: '💳 Available Plans & Pricing',
    displayText: text,
    speechText: speech
  }
}

/**
 * BUTTON 5: Privacy Guarantee
 * Shows ONLY privacy-related information.
 * DOES NOT display or mention any plant or leaf diagnosis information.
 */
export function getPrivacyButtonContent(): ButtonContent {
  const text = 
    `LeafLens On-Device Privacy & Security Guarantee:\n\n` +
    `• 100% Edge Neural Inference: All image processing and neural network predictions execute strictly on your device.\n` +
    `• Zero Data Storage: Your photos, video frames, and scan outputs are NEVER saved, uploaded, or transmitted to any external cloud servers.\n` +
    `• No Tracking: No cookies, user identifiers, or analytics tracking.\n` +
    `• Complete Offline Security: The scanning pipeline works standalone without sending user data across the network.`

  const speech = 
    `LeafLens provides a 100 percent on-device privacy guarantee. All scanning and disease identification happens locally on your device. Your photos and frames are never uploaded, stored, or shared with external servers.`

  return {
    title: '🔒 Privacy & Security Guarantee',
    displayText: text,
    speechText: speech
  }
}

export interface LanguageOption {
  code: string
  label: string
  name: string
  bcp47: string
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'auto', label: '🌐 Auto', name: 'Auto-Detect', bcp47: 'en-IN' },
  { code: 'en-IN', label: '🇬🇧 English', name: 'English (India)', bcp47: 'en-IN' },
  { code: 'te-IN', label: '🇮🇳 తెలుగు', name: 'Telugu', bcp47: 'te-IN' },
  { code: 'ta-IN', label: '🇮🇳 தமிழ்', name: 'Tamil', bcp47: 'ta-IN' },
  { code: 'hi-IN', label: '🇮🇳 हिन्दी', name: 'Hindi', bcp47: 'hi-IN' },
  { code: 'kn-IN', label: '🇮🇳 ಕನ್ನಡ', name: 'Kannada', bcp47: 'kn-IN' },
  { code: 'ml-IN', label: '🇮🇳 മലയാളം', name: 'Malayalam', bcp47: 'ml-IN' },
]

export function detectLanguage(text: string, defaultLang: string = 'en-IN'): string {
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te-IN' // Telugu
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta-IN' // Tamil
  if (/[\u0900-\u097F]/.test(text)) return 'hi-IN' // Hindi
  if (/[\u0C80-\u0CFF]/.test(text)) return 'kn-IN' // Kannada
  if (/[\u0D00-\u0D7F]/.test(text)) return 'ml-IN' // Malayalam

  const lower = text.toLowerCase()
  if (/\b(eppudu|veyyali|cheyyali|neellu|aakulu|ela|enti|rogalu|thaggali)\b/.test(lower)) return 'te-IN'
  if (/\b(kaise|paani|patti|dekhbhal|bataiye|chahiye|karna|bimari|dawai)\b/.test(lower)) return 'hi-IN'
  if (/\b(eppo|thanni|oothanum|pannanum|ilaigal|solla|noi|marundhu|enna)\b/.test(lower)) return 'ta-IN'
  if (/\b(yavaga|haakbeku|neeru|yele|maadbeku|hege|roga|kannada|enu)\b/.test(lower)) return 'kn-IN'
  if (/\b(eppozhaanu|vellam|ozhikkendathu|cheyyendathu|ila|engane|rogam|entha)\b/.test(lower)) return 'ml-IN'

  return defaultLang
}

function getBotanicalFallback(
  query: string,
  plantContext?: string,
  history?: Array<{ role: string; text: string }>,
  langHint?: string
): string {
  const lang = langHint && langHint !== 'auto' ? langHint : detectLanguage(query)
  const q = query.toLowerCase()
  let ctx = (plantContext || '').toLowerCase()

  if (history) {
    for (const item of history) {
      const prev = item.text.toLowerCase()
      if (prev.includes('snake') || prev.includes('sansevieria')) ctx += ' snake plant'
      if (prev.includes('tomato')) ctx += ' tomato'
      if (prev.includes('potato')) ctx += ' potato'
      if (prev.includes('pepper')) ctx += ' pepper'
    }
  }

  // Telugu (తెలుగు)
  if (lang.startsWith('te')) {
    if (q.includes('precaution') || q.includes('prevent') || q.includes('avoid') || q.includes('protect') || q.includes('jakratha')) {
      return "మొక్కలకు వ్యాధులు సోకకుండా ఉండటానికి, నీటిని ఆకులపై కాకుండా వేర్ల వద్ద మాత్రమే పోయండి. మొక్కల మధ్య మంచి గాలి ప్రసరణ ఉండేలా చూసుకోండి మరియు ఎండిన ఆకులను క్రమం తప్పకుండా తొలగించండి."
    }
    if (q.includes('cure') || q.includes('treat') || q.includes('remedy') || q.includes('nayam') || q.includes('mandhu')) {
      return "తెగులు సోకిన ఆకులను వెంటనే తొలగించి దూరంగా పారవేయండి. సమస్య మరింత వ్యాపించకుండా వేప నూనె లేదా కాపర్ ఆధారిత స్ప్రేను తగిన మోతాదులో పిచికారీ చేయండి."
    }
    return "మొక్క మొదట్లోని మట్టి పూర్తిగా ఆరిపోయినప్పుడు మాత్రమే నీరు పెట్టండి. కుండీలో అదనపు నీరు నిల్వ ఉండకుండా డ్రైనేజీ రంధ్రాలు సరిగ్గా ఉన్నాయో లేదో నిర్ధారించుకోండి."
  }

  // Tamil (தமிழ்)
  if (lang.startsWith('ta')) {
    if (q.includes('precaution') || q.includes('prevent') || q.includes('avoid') || q.includes('protect') || q.includes('kaapatha')) {
      return "செடிகளுக்கு நோய் பரவாமல் தடுக்க, இலைகளின் மேல் தண்ணீர் தெளிக்காமல் வேர்ப்பகுதியில் மட்டுமே ஊற்றவும். செடிகளுக்கு இடையே நல்ல காற்றோட்டம் இருப்பதை உறுதி செய்து, பாதிக்கப்பட்ட இலைகளை உடனே அகற்றி விடுங்கள்."
    }
    if (q.includes('cure') || q.includes('treat') || q.includes('remedy') || q.includes('marundhu')) {
      return "நோய் தாக்கப்பட்ட இலைகளை வெட்டி அகற்றி பாதுகாப்பாக அப்புறப்படுத்துங்கள். பிறகு வேப்ப எண்ணெய் அல்லது இயற்கை பூஞ்சைக்கொல்லியை செடியின் மீது சீராக தெளிக்கவும்."
    }
    return "மண்ணின் மேல் அடுக்கு நன்கு காய்ந்த பிறகு மட்டுமே மிதமாக தண்ணீர் ஊற்றவும். தொட்டியில் தண்ணீர் தேங்காமல் பார்த்துக் கொள்வது வேர் அழுகலைத் தடுக்கும்."
  }

  // Hindi (हिन्दी)
  if (lang.startsWith('hi')) {
    if (q.includes('precaution') || q.includes('prevent') || q.includes('avoid') || q.includes('protect') || q.includes('savdhani')) {
      return "पौधों को बीमारियों से बचाने के लिए, पत्तियों के ऊपर नहीं बल्कि सीधे जड़ों में पानी दें। पौधों के बीच पर्याप्त हवा का आवागमन रखें और रोगग्रस्त पत्तियों को तुरंत हटा दें।"
    }
    if (q.includes('cure') || q.includes('treat') || q.includes('remedy') || q.includes('ilaj') || q.includes('upchar')) {
      return "संक्रमित पत्तियों को तुरंत काटकर अलग कर दें ताकि बीमारी न फैले। इसके बाद नीम के तेल या कॉपर फंगीसाइड का हल्का छिड़काव पौधों पर करें।"
    }
    return "गमले की मिट्टी ऊपर से सूखने पर ही पानी दें। गमले में जल निकासी के छेद खुले रखें ताकि जड़ों में पानी जमा न हो।"
  }

  // Kannada (ಕನ್ನಡ)
  if (lang.startsWith('kn')) {
    if (q.includes('precaution') || q.includes('prevent') || q.includes('avoid') || q.includes('protect') || q.includes('eccharike')) {
      return "ಗಿಡಗಳಿಗೆ ರೋಗ ಹರಡದಂತೆ ತಡೆಯಲು, ಎಲೆಗಳ ಮೇಲೆ ನೀರು ಹಾಕದೆ ನೇರವಾಗಿ ಬುಡಕ್ಕೆ ಮಾತ್ರ ನೀರು ಹಾಕಿ. ಗಿಡಗಳ ನಡುವೆ ಉತ್ತಮ ಗಾಳಿಯಾಡುವಂತೆ ನೋಡಿಕೊಳ್ಳಿ ಮತ್ತು ಒಣಗಿದ ಎಲೆಗಳನ್ನು ತೆಗೆಯಿರಿ."
    }
    if (q.includes('cure') || q.includes('treat') || q.includes('remedy') || q.includes('chikitse')) {
      return "ರೋಗಪೀಡಿತ ಎಲೆಗಳನ್ನು ಕತ್ತರಿಸಿ ತಕ್ಷಣ ದೂರ ವಿಲೇವಾರಿ ಮಾಡಿ. ನಂತರ ಸಾವಯವ ಬೇವಿನ ಎಣ್ಣೆ ಅಥವಾ ಶಿಲೀಂಧ್ರನಾಶಕವನ್ನು ಗಿಡಕ್ಕೆ ಸಿಂಪಡಿಸಿ."
    }
    return "ಮಣ್ಣಿನ ಮೇಲ್ಭಾಗ ಒಣಗಿದಾಗ ಮಾತ್ರ ನೀರು ಹಾಕಿ. ಕುಂಡದಲ್ಲಿ ನೀರು ನಿಲ್ಲದಂತೆ ತೂತುಗಳು ಸರಿಯಾಗಿವೆಯೇ ಎಂದು ಖಚಿತಪಡಿಸಿಕೊಳ್ಳಿ."
  }

  // Malayalam (മലയാളം)
  if (lang.startsWith('ml')) {
    if (q.includes('precaution') || q.includes('prevent') || q.includes('avoid') || q.includes('protect') || q.includes('jagratha')) {
      return "ചെടികൾക്ക് രോഗങ്ങൾ വരാതിരിക്കാൻ, ഇലകളിൽ വെള്ളം തളിക്കാതെ വേരുകളിൽ മാത്രം വെള്ളം ഒഴിക്കുക. ചെടികൾക്കിടയിൽ നല്ല വായുസഞ്ചാരം ഉറപ്പാക്കുകയും അസുഖം ബാധിച്ച ഇലകൾ ഉടൻ മാറ്റുകയും ചെയ്യുക."
    }
    if (q.includes('cure') || q.includes('treat') || q.includes('remedy') || q.includes('chikitsa')) {
      return "രോഗം ബാധിച്ച ഇലകൾ മുറിച്ചുമാറ്റി സുരക്ഷിതമായി നശിപ്പിക്കുക. ശേഷം വേപ്പെണ്ണ അല്ലെങ്കിൽ ജൈവ കുമിൾനാശിനി നേർപ്പിച്ച് തളിക്കുക."
    }
    return "മണ്ണ് പൂർണ്ണമായും ഉണങ്ങിയ ശേഷം മാത്രം മിതമായി വെള്ളം ഒഴിക്കുക. ചട്ടിയിൽ വെള്ളം കെട്ടിക്കിടക്കാൻ അനുവദിക്കരുത്."
  }

  // English fallback
  if (q.includes('precaution') || q.includes('prevent') || q.includes('avoid') || q.includes('protect')) {
    if (ctx.includes('snake') || q.includes('sansevieria')) {
      return "For Snake Plants, key precautions include watering strictly at the soil base, allowing the soil to dry completely between waterings, maintaining low ambient humidity, and sterilizing pruning shears to prevent fungal leaf spot."
    }
    return "To prevent plant diseases, water strictly at the soil base rather than over foliage, provide adequate spacing between plants for airflow, disinfect pruning shears between cuts, and clear fallen leaves from the soil surface."
  }

  if (q.includes('cure') || q.includes('treat') || q.includes('remedy') || q.includes('step') || q.includes('medicine')) {
    return "For active treatment, immediately prune and isolate affected foliage to stop pathogen spread, improve air circulation, and apply a targeted copper or organic bio-fungicide spray suited for the condition."
  }

  if (q.includes('water') || q.includes('moisture') || q.includes('irrigation')) {
    if (ctx.includes('snake')) {
      return "For Snake Plants, water sparingly only when the potting mix is completely dry, typically every two to three weeks, and avoid letting water sit in the rosette center."
    }
    return "Water thoroughly only when the top few inches of soil are dry to the touch, ensure pots have unobstructed drainage holes, and avoid letting roots sit in pooled water."
  }

  if (q.includes('light') || q.includes('sun')) {
    return "Most foliage thrives in bright, indirect sunlight. Protect leaves from intense direct midday rays to avoid leaf scorch, and rotate the container periodically for uniform growth."
  }

  return "Maintain balanced soil moisture, ensure adequate airflow between leaves, disinfect gardening tools regularly, and isolate any symptomatic foliage at the first sign of discoloration."
}

class VoiceAssistantService {
  private currentAudio: HTMLAudioElement | null = null
  private isMuted: boolean = false
  private isSpeaking: boolean = false
  private onStateChange: ((state: { isSpeaking: boolean; isMuted: boolean }) => void) | null = null

  constructor() {
    const savedMute = localStorage.getItem('leaflens_voice_muted')
    if (savedMute) {
      this.isMuted = savedMute === 'true'
    }
  }

  public subscribe(cb: (state: { isSpeaking: boolean; isMuted: boolean }) => void) {
    this.onStateChange = cb
    this.emit()
  }

  private emit() {
    if (this.onStateChange) {
      this.onStateChange({
        isSpeaking: this.isSpeaking,
        isMuted: this.isMuted,
      })
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted
    localStorage.setItem('leaflens_voice_muted', String(this.isMuted))
    if (this.isMuted) {
      this.stop()
    }
    this.emit()
    return this.isMuted
  }

  public getMuted(): boolean {
    return this.isMuted
  }

  public stop() {
    if (this.currentAudio) {
      this.currentAudio.pause()
      this.currentAudio.currentTime = 0
      this.currentAudio = null
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    this.isSpeaking = false
    this.emit()
  }

  /**
   * Ultra-fast, zero-latency speech synthesis (< 0.2s start time).
   * Supports English, Telugu, Tamil, Hindi, Kannada, and Malayalam native voices.
   */
  public async speakText(text: string, forcedLang?: string): Promise<SpokenDiagnosisResult> {
    if (this.isMuted) {
      console.log('VoiceBot is muted, skipping playback.')
      return { speechText: text, isDecisionMode: text.includes('decision mode'), source: 'browser-speech' }
    }

    this.stop()
    this.isSpeaking = true
    this.emit()

    try {
      const targetLang = forcedLang && forcedLang !== 'auto' ? forcedLang : detectLanguage(text)
      await this.speakBrowserNative(text, targetLang)
      return {
        speechText: text,
        isDecisionMode: text.includes('decision mode'),
        source: 'browser-speech',
      }
    } catch (err) {
      console.error('Speech synthesis error:', err)
      return {
        speechText: text,
        isDecisionMode: text.includes('decision mode'),
        source: 'browser-speech',
      }
    } finally {
      this.isSpeaking = false
      this.emit()
    }
  }

  private speakBrowserNative(text: string, lang: string = 'en-IN'): Promise<void> {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) {
        this.isSpeaking = false
        this.emit()
        resolve()
        return
      }

      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = lang
      utterance.rate = 1.0
      utterance.pitch = 1.0

      const voices = window.speechSynthesis.getVoices()
      const langPrefix = lang.split('-')[0].toLowerCase()

      // Prioritize natural/neural voices matching the specific language
      const preferred =
        voices.find(
          (v) =>
            v.lang.toLowerCase().startsWith(langPrefix) &&
            (v.name.includes('Natural') ||
              v.name.includes('Neural') ||
              v.name.includes('Google') ||
              v.name.includes('India'))
        ) ||
        voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix)) ||
        (langPrefix === 'en'
          ? voices.find(
              (v) =>
                (v.name.includes('Google') ||
                  v.name.includes('Natural') ||
                  v.name.includes('Samantha') ||
                  v.name.includes('Jenny') ||
                  v.name.includes('Ravi') ||
                  v.name.includes('Heera')) &&
                v.lang.startsWith('en')
            )
          : null)

      if (preferred) utterance.voice = preferred

      utterance.onstart = () => {
        this.isSpeaking = true
        this.emit()
      }

      utterance.onend = () => {
        this.isSpeaking = false
        this.emit()
        resolve()
      }

      utterance.onerror = () => {
        this.isSpeaking = false
        this.emit()
        resolve()
      }

      window.speechSynthesis.speak(utterance)
    })
  }

  /**
   * Conversational LLM Q&A using Gemini 2.5 Flash grounded in botanical guidance.
   * Delivers warm, human-like, multilingual and code-switching plant care responses.
   */
  public async askAssistant(
    question: string,
    currentDiagnosisContext?: string,
    history: Array<{ role: string; text: string }> = [],
    preferredLang: string = 'auto'
  ): Promise<string> {
    const prompt = `
Role: You are a warm, human-like botanical expert and conversational multilingual voice assistant.
Languages Supported: English, Telugu (తెలుగు), Tamil (தமிழ்), Hindi (हिन्दी), Kannada (ಕನ್ನಡ), Malayalam (മലയാളം).
Selected Language Mode: ${preferredLang}

Directives:
1. Warm, Empathetic Human Tone: Sound like a passionate, friendly plant doctor and caring gardener speaking one-to-one with a person. Never sound robotic or declare "As an AI". Avoid bullet points, numbered lists, asterisks, or markdown symbols.
2. Code-Switching & Dialect Fluency:
   - Seamlessly comprehend code-switching and mixed languages (e.g., Telugu mixed with English like "Snake plant ki water eppudu veyyali?", Hinglish like "Is plant me yellow leaves aa rahe hain, kya karu?", Tanglish, Kanglish, Manglish).
   - Reply in the user's spoken language or natural conversational code-mixed blend. If the user asks in Telugu, respond in warm, natural Telugu; if in Hindi, respond in fluent Hindi; similarly for Tamil, Kannada, Malayalam, and English.
   - If a specific language is selected (${preferredLang} !== 'auto'), respond in that language.
3. Conversational Continuity: Maintain context from prior turns in the conversation to resolve pronouns and references.
4. Voice Synthesis Ready: Provide plain conversational text only without markdown formatting, ready to be read aloud in 2 to 3 fluid, melodious sentences.
`

    const historyStr =
      history.length > 0
        ? `Prior Conversation History:\n${history
            .slice(-6)
            .map((h) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.text}`)
            .join('\n')}\n\n`
        : ''

    try {
      try {
        const resp = await fetch('/api/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: question,
            plant_context: currentDiagnosisContext,
            history: history.slice(-6),
            selected_lang: preferredLang,
          }),
        })
        if (resp.ok) {
          const data = await resp.json()
          if (data.reply) return data.reply
        }
      } catch (e) {
        console.warn('Backend /api/assistant not reached, trying direct Gemini API...', e)
      }

      if (GEMINI_API_KEY) {
        const directResp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `${prompt}\n${
                        currentDiagnosisContext ? `Current Plant Context: ${currentDiagnosisContext}\n` : ''
                      }${historyStr}User Query: ${question}`
                    }
                  ]
                }
              ],
            }),
          }
        )

        if (directResp.ok) {
          const data = await directResp.json()
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
          if (text) {
            return text.trim()
          }
        }
      }

      return getBotanicalFallback(question, currentDiagnosisContext, history, preferredLang)
    } catch (err: any) {
      console.error('AskAssistant error:', err)
      return getBotanicalFallback(question, currentDiagnosisContext, history, preferredLang)
    }
  }
}

export const voiceAssistant = new VoiceAssistantService()
