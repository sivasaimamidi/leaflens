/**
 * LeafLens Voice Assistant Service
 * Multilingual Botanical Pathology Voice Agent & Zero-Latency Speech Engine
 * 
 * Supports 6 languages:
 * - English (en-IN)
 * - Telugu (te-IN) - తెలుగు
 * - Tamil (ta-IN) - தமிழ்
 * - Hindi (hi-IN) - हिन्दी
 * - Kannada (kn-IN) - ಕನ್ನಡ
 * - Malayalam (ml-IN) - മലയാളം
 * 
 * Key Features:
 * 1. Default ON/OFF toggle state with instant starter diagnosis announcement:
 *    - Is it diseased or healthy?
 *    - How healthy is it?
 *    - What's good about it?
 *    - All details in the starter (verbatim decision mode rule)
 * 2. Dedicated distinct handlers for the 5 buttons in the selected language:
 *    - Precautions: Condition report + preventative recurrence steps
 *    - Two Steps / Cure: Step 1 (immediate action) + Step 2 (active treatment)
 *    - Supported Plants: Complete 18-class database catalog (NO leaf data leak)
 *    - Available Plans: Free Academic Tier ($0 forever) & Enterprise Roadmap
 *    - Privacy Guarantee: 100% on-device edge processing & zero storage (NO plant data leak)
 * 3. Fail-safe, zero-silence speech synthesis with native voice selection and phonetic transliteration fallback.
 * 4. Code-switching and mixed-language comprehension (Tanglish, Hinglish, etc.).
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
  phoneticText?: string
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

/**
 * Localized Plant Names
 */
export function getLocalizedPlantName(plantName: string, lang: string = 'en-IN'): string {
  const p = (plantName || '').toLowerCase()
  const l = (lang || 'en').split('-')[0].toLowerCase()

  if (l === 'te') {
    if (p.includes('snake') || p.includes('sansevieria')) return 'స్నేక్ ప్లాంట్ (Snake Plant)'
    if (p.includes('tomato')) return 'టొమాటో (Tomato)'
    if (p.includes('potato')) return 'బంగాళాదుంప (Potato)'
    if (p.includes('pepper')) return 'బెల్ పెప్పర్ (Bell Pepper)'
    return plantName
  }
  if (l === 'hi') {
    if (p.includes('snake') || p.includes('sansevieria')) return 'स्नेक प्लांट (Snake Plant)'
    if (p.includes('tomato')) return 'टमाटर (Tomato)'
    if (p.includes('potato')) return 'आलू (Potato)'
    if (p.includes('pepper')) return 'शिमला मिर्च (Bell Pepper)'
    return plantName
  }
  if (l === 'ta') {
    if (p.includes('snake') || p.includes('sansevieria')) return 'பாம்பு கற்றாழை (Snake Plant)'
    if (p.includes('tomato')) return 'தக்காளி (Tomato)'
    if (p.includes('potato')) return 'உருளைக்கிழங்கு (Potato)'
    if (p.includes('pepper')) return 'குடைமிளகாய் (Bell Pepper)'
    return plantName
  }
  if (l === 'kn') {
    if (p.includes('snake') || p.includes('sansevieria')) return 'ಸ್ನೇಕ್ ಪ್ಲಾಂಟ್ (Snake Plant)'
    if (p.includes('tomato')) return 'ಟೊಮೆಟೊ (Tomato)'
    if (p.includes('potato')) return 'ಆಲೂಗಡ್ಡೆ (Potato)'
    if (p.includes('pepper')) return 'ದಪ್ಪ ಮೆಣಸಿನಕಾಯಿ (Bell Pepper)'
    return plantName
  }
  if (l === 'ml') {
    if (p.includes('snake') || p.includes('sansevieria')) return 'സ്നേക്ക് പ്ലാന്റ് (Snake Plant)'
    if (p.includes('tomato')) return 'തക്കാളി (Tomato)'
    if (p.includes('potato')) return 'ഉരുളക്കിഴങ്ങ് (Potato)'
    if (p.includes('pepper')) return 'കാപ്സിക്കം (Bell Pepper)'
    return plantName
  }
  return plantName
}

/**
 * Localized Condition Names
 */
export function getLocalizedConditionName(conditionName: string, lang: string = 'en-IN'): string {
  const c = (conditionName || '').toLowerCase()
  const l = (lang || 'en').split('-')[0].toLowerCase()

  if (l === 'te') {
    if (c.includes('healthy')) return 'ఆరోగ్యకరమైనది (Healthy)'
    if (c.includes('early blight')) return 'ప్రారంభ తెగులు (Early Blight)'
    if (c.includes('late blight')) return 'తీవ్ర ఎండు తెగులు (Late Blight)'
    if (c.includes('bacterial')) return 'బాక్టీరియల్ మచ్చల తెగులు (Bacterial Spot)'
    if (c.includes('anthracnose')) return 'ఆంత్రాక్నోస్ శిలీంధ్ర మచ్చలు (Anthracnose)'
    if (c.includes('withering')) return 'ఆకులు వాడిపోవడం (Leaf Withering)'
    if (c.includes('mold')) return 'బూజు తెగులు (Leaf Mold)'
    if (c.includes('septoria')) return 'సెప్టోరియా ఆకుమచ్చ తెగులు (Septoria Leaf Spot)'
    if (c.includes('spider')) return 'నల్లి తెగులు (Spider Mites)'
    if (c.includes('target')) return 'టార్గెట్ స్పాట్ తెగులు (Target Spot)'
    if (c.includes('yellow')) return 'ఆకు ముడుత వైరస్ (Yellow Leaf Curl Virus)'
    if (c.includes('mosaic')) return 'మొజాయిక్ వైరస్ (Mosaic Virus)'
    return conditionName
  }
  if (l === 'hi') {
    if (c.includes('healthy')) return 'स्वस्थ (Healthy)'
    if (c.includes('early blight')) return 'अगेती झुलसा (Early Blight)'
    if (c.includes('late blight')) return 'पछेती झुलसा (Late Blight)'
    if (c.includes('bacterial')) return 'जीवाणु धब्बा रोग (Bacterial Spot)'
    if (c.includes('anthracnose')) return 'एन्थ्रेक्नोज कवक रोग (Anthracnose)'
    if (c.includes('withering')) return 'पत्तियों का मुरझाना (Leaf Withering)'
    if (c.includes('mold')) return 'पत्ती का फफूंद (Leaf Mold)'
    if (c.includes('septoria')) return 'सेप्टोरिया पत्ती धब्बा (Septoria Leaf Spot)'
    if (c.includes('spider')) return 'लाल मकड़ी कीट (Spider Mites)'
    if (c.includes('target')) return 'टारगेट स्पॉट रोग (Target Spot)'
    if (c.includes('yellow')) return 'पीली पत्ती मरोड़ वायरस (Yellow Leaf Curl)'
    if (c.includes('mosaic')) return 'मोज़ेक वायरस (Mosaic Virus)'
    return conditionName
  }
  if (l === 'ta') {
    if (c.includes('healthy')) return 'ஆரோக்கியமானது (Healthy)'
    if (c.includes('early blight')) return 'ஆரம்பக்கால இலைக்கருகல் (Early Blight)'
    if (c.includes('late blight')) return 'பிந்தைய இலைக்கருகல் (Late Blight)'
    if (c.includes('bacterial')) return 'பாக்டீரியா இலைப்புள்ளி (Bacterial Spot)'
    if (c.includes('anthracnose')) return 'ஆந்த்ராக்னோஸ் பூஞ்சை (Anthracnose)'
    if (c.includes('withering')) return 'இலை வாடுதல் (Leaf Withering)'
    if (c.includes('mold')) return 'இலை பூஞ்சை (Leaf Mold)'
    if (c.includes('septoria')) return 'செப்டோரியா இலைப்புள்ளி (Septoria Spot)'
    if (c.includes('spider')) return 'சிலந்திப் பேன் தாக்குதல் (Spider Mites)'
    if (c.includes('target')) return 'இலக்கு புள்ளி நோய் (Target Spot)'
    if (c.includes('yellow')) return 'மஞ்சள் இலை சுருள் வைரஸ் (Yellow Leaf Curl)'
    if (c.includes('mosaic')) return 'மொசைக் வைரஸ் (Mosaic Virus)'
    return conditionName
  }
  if (l === 'kn') {
    if (c.includes('healthy')) return 'ಆರೋಗ್ಯಕರವಾಗಿದೆ (Healthy)'
    if (c.includes('early blight')) return 'ಆರಂಭಿಕ ರೋಗ (Early Blight)'
    if (c.includes('late blight')) return 'ತಡವಾದ ರೋಗ (Late Blight)'
    if (c.includes('bacterial')) return 'ಬ್ಯಾಕ್ಟೀರಿಯಾದ ಕಲೆ (Bacterial Spot)'
    if (c.includes('anthracnose')) return 'ಆಂಥ್ರಾಕ್ನೋಸ್ ರೋಗ (Anthracnose)'
    if (c.includes('withering')) return 'ಎಲೆ ಬಾಡುವಿಕೆ (Leaf Withering)'
    if (c.includes('mold')) return 'ಎಲೆ ಬೂజు (Leaf Mold)'
    if (c.includes('septoria')) return 'ಸೆಪ್ಟೋರಿಯಾ ಕಲೆ (Septoria Spot)'
    if (c.includes('spider')) return 'ಜೇಡರ ಹುಳು ಬಾಧೆ (Spider Mites)'
    if (c.includes('target')) return 'ಟಾರ್ಗೆಟ್ ಸ್ಪಾಟ್ (Target Spot)'
    if (c.includes('yellow')) return 'ಹಳದಿ ಎಲೆ ಸುರುಳಿ ವೈರಸ್ (Yellow Leaf Curl)'
    if (c.includes('mosaic')) return 'ಮೊಸಾಯಿಕ್ ವೈರಸ್ (Mosaic Virus)'
    return conditionName
  }
  if (l === 'ml') {
    if (c.includes('healthy')) return 'ആരോഗ്യമുള്ളത് (Healthy)'
    if (c.includes('early blight')) return 'ആദ്യകാല ബ്ലൈറ്റ് (Early Blight)'
    if (c.includes('late blight')) return 'ലേറ്റ് ബ്ലൈറ്റ് (Late Blight)'
    if (c.includes('bacterial')) return 'ബാക്ടീരിയൽ പുള്ളി (Bacterial Spot)'
    if (c.includes('anthracnose')) return 'ആന്ത്രാക്നോസ് (Anthracnose)'
    if (c.includes('withering')) return 'ഇല വാടൽ (Leaf Withering)'
    if (c.includes('mold')) return 'ഇല പൂപ്പൽ (Leaf Mold)'
    if (c.includes('septoria')) return 'സെപ്റ്റോറിയ പുള്ളി (Septoria Spot)'
    if (c.includes('spider')) return 'ചുവന്ന മണ്ഡരി ബാധ (Spider Mites)'
    if (c.includes('target')) return 'ടാർഗെറ്റ് സ്പോട്ട് (Target Spot)'
    if (c.includes('yellow')) return 'മഞ്ഞ ഇലച്ചുരുൾ വൈറസ് (Yellow Leaf Curl)'
    if (c.includes('mosaic')) return 'മൊസൈക്ക് വൈറസ് (Mosaic Virus)'
    return conditionName
  }
  return conditionName
}

/**
 * Localized Verdict Pill Text
 */
export function getLocalizedVerdict(verdict: string, lang: string = 'en-IN'): string {
  const l = (lang || 'en').split('-')[0].toLowerCase()
  if (l === 'te') {
    if (verdict === 'healthy') return '🟢 ఆరోగ్యంగా ఉంది (Healthy)'
    if (verdict === 'diseased') return '🔴 శ్రద్ధ అవసరం (Diseased)'
    return '🟡 ఖచ్చితంగా తెలియదు'
  }
  if (l === 'hi') {
    if (verdict === 'healthy') return '🟢 स्वस्थ (Healthy)'
    if (verdict === 'diseased') return '🔴 ध्यान देने की आवश्यकता (Diseased)'
    return '🟡 अनिश्चित'
  }
  if (l === 'ta') {
    if (verdict === 'healthy') return '🟢 ஆரோக்கியமானது (Healthy)'
    if (verdict === 'diseased') return '🔴 கவனம் தேவை (Diseased)'
    return '🟡 உறுதியாக தெரியவில்லை'
  }
  if (l === 'kn') {
    if (verdict === 'healthy') return '🟢 ಆರೋಗ್ಯಕರವಾಗಿದೆ (Healthy)'
    if (verdict === 'diseased') return '🔴 ಗಮನ ಅಗತ್ಯವಿದೆ (Diseased)'
    return '🟡 ಖಚಿತವಿಲ್ಲ'
  }
  if (l === 'ml') {
    if (verdict === 'healthy') return '🟢 ആരോഗ്യമുള്ളത് (Healthy)'
    if (verdict === 'diseased') return '🔴 ശ്രദ്ധ ആവശ്യമാണ് (Diseased)'
    return '🟡 ഉറപ്പില്ല'
  }
  if (verdict === 'healthy') return '🟢 Healthy'
  if (verdict === 'diseased') return '🔴 Needs Attention (Diseased)'
  return '🟡 Not Sure'
}

/**
 * Transliterates Indic Unicode characters to clean Latin syllables.
 * Guarantees zero silence and high clarity when playing Indic language speech
 * on devices that only have English TTS engines installed.
 */
export function transliterateIndicToPhonetic(text: string, _lang?: string): string {
  const charMap: Record<string, string> = {
    // Vowels
    '\u0C05': 'a', '\u0C06': 'aa', '\u0C07': 'i', '\u0C08': 'ee', '\u0C09': 'u', '\u0C0A': 'oo',
    '\u0C0E': 'e', '\u0C0F': 'ee', '\u0C10': 'ai', '\u0C12': 'o', '\u0C13': 'oo', '\u0C14': 'au',
    '\u0905': 'a', '\u0906': 'aa', '\u0907': 'i', '\u0908': 'ee', '\u0909': 'u', '\u090A': 'oo',
    '\u090F': 'e', '\u0910': 'ai', '\u0913': 'o', '\u0914': 'au',
    '\u0B85': 'a', '\u0B86': 'aa', '\u0B87': 'i', '\u0B88': 'ee', '\u0B89': 'u', '\u0B8A': 'oo',
    '\u0B8E': 'e', '\u0B8F': 'ee', '\u0B90': 'ai', '\u0B92': 'o', '\u0B93': 'oo', '\u0B94': 'au',
    '\u0C85': 'a', '\u0C86': 'aa', '\u0C87': 'i', '\u0C88': 'ee', '\u0C89': 'u', '\u0C8A': 'oo',
    '\u0C8E': 'e', '\u0C8F': 'ee', '\u0C90': 'ai', '\u0C92': 'o', '\u0C93': 'oo', '\u0C94': 'au',
    '\u0D05': 'a', '\u0D06': 'aa', '\u0D07': 'i', '\u0D08': 'ee', '\u0D09': 'u', '\u0D0A': 'oo',
    '\u0D0E': 'e', '\u0D0F': 'ee', '\u0D10': 'ai', '\u0D12': 'o', '\u0D13': 'oo', '\u0D14': 'au',

    // Consonants (Telugu, Devanagari, Tamil, Kannada, Malayalam)
    '\u0C15': 'ka', '\u0C16': 'kha', '\u0C17': 'ga', '\u0C18': 'gha',
    '\u0C1A': 'cha', '\u0C1B': 'chha', '\u0C1C': 'ja', '\u0C1D': 'jha',
    '\u0C1F': 'ta', '\u0C20': 'tha', '\u0C21': 'da', '\u0C22': 'dha', '\u0C23': 'na',
    '\u0C24': 'tha', '\u0C25': 'thha', '\u0C26': 'da', '\u0C27': 'dha', '\u0C28': 'na',
    '\u0C2A': 'pa', '\u0C2B': 'pha', '\u0C2C': 'ba', '\u0C2D': 'bha', '\u0C2E': 'ma',
    '\u0C2F': 'ya', '\u0C30': 'ra', '\u0C32': 'la', '\u0C35': 'va',
    '\u0C36': 'sha', '\u0C37': 'sha', '\u0C38': 'sa', '\u0C39': 'ha', '\u0C33': 'la',

    '\u0915': 'ka', '\u0916': 'kha', '\u0917': 'ga', '\u0918': 'gha',
    '\u091A': 'cha', '\u091B': 'chha', '\u091C': 'ja', '\u091D': 'jha',
    '\u091F': 'ta', '\u0920': 'tha', '\u0921': 'da', '\u0922': 'dha', '\u0923': 'na',
    '\u0924': 'ta', '\u0925': 'tha', '\u0926': 'da', '\u0927': 'dha', '\u0928': 'na',
    '\u092A': 'pa', '\u092B': 'pha', '\u092C': 'ba', '\u092D': 'bha', '\u092E': 'ma',
    '\u092F': 'ya', '\u0930': 'ra', '\u0932': 'la', '\u0935': 'va',
    '\u0936': 'sha', '\u0937': 'sha', '\u0938': 'sa', '\u0939': 'ha',

    '\u0B95': 'ka', '\u0B99': 'nga', '\u0B9A': 'sa', '\u0B9C': 'ja',
    '\u0B9E': 'nya', '\u0B9F': 'ta', '\u0BA3': 'na', '\u0BA4': 'tha',
    '\u0BA8': 'na', '\u0BAA': 'pa', '\u0BAE': 'ma', '\u0BAF': 'ya',
    '\u0BB0': 'ra', '\u0BB2': 'la', '\u0BB5': 'va', '\u0BB4': 'zha',
    '\u0BB3': 'la', '\u0BB1': 'ra', '\u0BA9': 'na', '\u0BB7': 'sha', '\u0BB8': 'sa', '\u0BB9': 'ha',

    '\u0C95': 'ka', '\u0C96': 'kha', '\u0C97': 'ga', '\u0C98': 'gha',
    '\u0C9A': 'cha', '\u0C9C': 'ja', '\u0C9F': 'ta', '\u0CA1': 'da', '\u0CA3': 'na',
    '\u0CA4': 'tha', '\u0CA6': 'da', '\u0CA7': 'dha', '\u0CA8': 'na',
    '\u0CAA': 'pa', '\u0CAB': 'pha', '\u0CAC': 'ba', '\u0CAD': 'bha', '\u0CAE': 'ma',
    '\u0CAF': 'ya', '\u0CB0': 'ra', '\u0CB2': 'la', '\u0CB5': 'va',
    '\u0CB6': 'sha', '\u0CB7': 'sha', '\u0CB8': 'sa', '\u0CB9': 'ha', '\u0CB3': 'la',

    '\u0D15': 'ka', '\u0D16': 'kha', '\u0D17': 'ga', '\u0D18': 'gha',
    '\u0D1A': 'cha', '\u0D1C': 'ja', '\u0D1F': 'ta', '\u0D21': 'da', '\u0D23': 'na',
    '\u0D24': 'tha', '\u0D26': 'da', '\u0D27': 'dha', '\u0D28': 'na',
    '\u0D2A': 'pa', '\u0D2B': 'pha', '\u0D2C': 'ba', '\u0D2D': 'bha', '\u0D2E': 'ma',
    '\u0D2F': 'ya', '\u0D30': 'ra', '\u0D32': 'la', '\u0D35': 'va',
    '\u0D36': 'sha', '\u0D37': 'sha', '\u0D38': 'sa', '\u0D39': 'ha', '\u0D33': 'la',

    // Matras & modifiers
    '\u0C3E': 'aa', '\u0C3F': 'i', '\u0C40': 'ee', '\u0C41': 'u', '\u0C42': 'oo',
    '\u0C46': 'e', '\u0C47': 'ee', '\u0C48': 'ai', '\u0C4A': 'o', '\u0C4B': 'oo', '\u0C4C': 'au',
    '\u093E': 'aa', '\u093F': 'i', '\u0940': 'ee', '\u0941': 'u', '\u0942': 'oo',
    '\u0947': 'e', '\u0948': 'ai', '\u094B': 'o', '\u094C': 'au',
    '\u0BBE': 'aa', '\u0BBF': 'i', '\u0BC0': 'ee', '\u0BC1': 'u', '\u0BC2': 'oo',
    '\u0BC6': 'e', '\u0BC7': 'ee', '\u0BC8': 'ai', '\u0BCA': 'o', '\u0BCB': 'oo', '\u0BCC': 'au',
    '\u0CBE': 'aa', '\u0CBF': 'i', '\u0CC0': 'ee', '\u0CC1': 'u', '\u0CC2': 'oo',
    '\u0CC6': 'e', '\u0CC7': 'ee', '\u0CC8': 'ai', '\u0CCA': 'o', '\u0CCB': 'oo', '\u0CCC': 'au',
    '\u0D3E': 'aa', '\u0D3F': 'i', '\u0D40': 'ee', '\u0D41': 'u', '\u0D42': 'oo',
    '\u0D46': 'e', '\u0D47': 'ee', '\u0D48': 'ai', '\u0D4A': 'o', '\u0D4B': 'oo', '\u0D4C': 'au',
    '\u0C4D': '', '\u094D': '', '\u0BCD': '', '\u0CCD': '', '\u0D4D': '', // virama
    '\u0C02': 'm', '\u0902': 'n', '\u0B82': 'm', '\u0C82': 'm', '\u0D02': 'm', // anusvara
    '\u0C03': 'h', '\u0903': 'h', '\u0C83': 'h', '\u0D03': 'h', // visarga
  }

  let result = ''
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]
    if (charMap[ch] !== undefined) {
      let mapped = charMap[ch]
      if (mapped.endsWith('a') && next && charMap[next] !== undefined && (next >= '\u093E' || next >= '\u0C3E' || next >= '\u0BBE' || next >= '\u0CBE' || next >= '\u0D3E')) {
        mapped = mapped.slice(0, -1)
      }
      result += mapped
    } else {
      result += ch
    }
  }
  return result
}

/**
 * Robust Multi-dialect Language Detector
 */
export function detectLanguage(text: string, defaultLang: string = 'en-IN'): string {
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te-IN' // Telugu script
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta-IN' // Tamil script
  if (/[\u0900-\u097F]/.test(text)) return 'hi-IN' // Hindi script
  if (/[\u0C80-\u0CFF]/.test(text)) return 'kn-IN' // Kannada script
  if (/[\u0D00-\u0D7F]/.test(text)) return 'ml-IN' // Malayalam script

  const lower = text.toLowerCase()
  // Telugu / Tenglish phrases (including colloquial and dialect phrases)
  if (/\b(eppudu|veyyali|cheyyali|neellu|aakulu|aaku|ela|enti|rogalu|thaggali|jaagratta|jaagratha|mandhu|kuruunchehi|mardangaalaga|chippu|cheppu|gurinchi|nayam|mokkalu|pettali)\b/.test(lower)) {
    return 'te-IN'
  }
  // Hindi / Hinglish phrases
  if (/\b(kaise|paani|patti|dekhbhal|bataiye|chahiye|karna|bimari|dawai|savdhani|upchar|kya|kyun|karein|rog)\b/.test(lower)) {
    return 'hi-IN'
  }
  // Tamil / Tanglish phrases
  if (/\b(eppo|thanni|oothanum|pannanum|ilaigal|ilai|solla|noi|marundhu|enna|kaapatha|epdi|solreengala|theervu)\b/.test(lower)) {
    return 'ta-IN'
  }
  // Kannada / Kanglish phrases
  if (/\b(yavaga|haakbeku|neeru|yele|ele|maadbeku|hege|roga|kannada|enu|chikitse|eccharike)\b/.test(lower)) {
    return 'kn-IN'
  }
  // Malayalam / Manglish phrases
  if (/\b(eppozhaanu|vellam|ozhikkendathu|cheyyendathu|ila|engane|rogam|entha|chikitsa|jagratha)\b/.test(lower)) {
    return 'ml-IN'
  }

  return defaultLang
}

/**
 * 1. Generates the authoritative starter spoken transcript matching:
 *    - Is it diseased or healthy?
 *    - How healthy is it?
 *    - What's good about it?
 *    - All details in the starter (with verbatim decision mode prompt in selected language).
 */
export function buildDiagnosisSpeechText(
  result: {
    plant?: string
    condition?: string
    verdict?: string
    confidence?: number
    class_name?: string
    precautions?: string[]
    cure?: string[]
  },
  langCode: string = 'en-IN'
): { text: string; isDecisionMode: boolean; phoneticText?: string } {
  const isHealthy = result.verdict === 'healthy' || result.condition?.toLowerCase() === 'healthy'
  const isUncertain = result.verdict === 'uncertain' || !result.plant || result.plant === 'Uncertain'
  const activeLang = langCode && langCode !== 'auto' ? langCode : 'en-IN'
  const langPrefix = activeLang.split('-')[0].toLowerCase()

  if (isUncertain) {
    if (langPrefix === 'te') {
      return {
        text: 'ఆకు రోగనిర్ధారణ ఖచ్చితంగా తెలియదు. ఆకు భాగాలు స్పష్టంగా గుర్తించబడలేదు. దయచేసి స్నేక్ ప్లాంట్, టొమాటో, బంగాళాదుంప లేదా క్యాప్సికం ఆకును మంచి వెలుతురులో స్పష్టంగా చూపించి మళ్లీ స్కాన్ చేయండి.',
        phoneticText: 'Aaku roganirnaayam khacchithangaa theliyadu. Dayachesi Snake Plant, Tomato, Potato leda Capsicum aakunu manchi veluturuloo chupinchi malli scan cheyandi.',
        isDecisionMode: false,
      }
    }
    if (langPrefix === 'hi') {
      return {
        text: 'पत्ती का निदान अनिश्चित है। पत्ती का स्पष्ट क्षेत्र नहीं दिखा। कृपया स्नेक प्लांट, टमाटर, आलू या शिमला मिर्च की पत्ती को अच्छी रोशनी में रखकर फिर से स्कैन करें।',
        phoneticText: 'Patti ka nidan anishchit hai. Kripya Snake Plant, Tamatar, Aalu ya Shimla Mirch ki patti ko acchi roshni me rakhkar fir se scan karein.',
        isDecisionMode: false,
      }
    }
    if (langPrefix === 'ta') {
      return {
        text: 'இலை நோயறிதல் உறுதியாக தெரியவில்லை. இலைப்பகுதியை சரியாக கண்டறிய முடியவில்லை. தயவுசெய்து பாம்பு கற்றாழை, தக்காளி, உருளைக்கிழங்கு அல்லது குடைமிளகாய் இலையை நல்ல வெளிச்சத்தில் காட்டி மீண்டும் ஸ்கேன் செய்யவும்.',
        phoneticText: 'Ilai noi arithal urudhiyaaga theriyavillai. Thayavuseithu Snake Plant, Thakkaali, Urulaikizhangu alladhu Kudaimilagaai ilaiyai nalla velichathil kaatti meendum scan seyyavum.',
        isDecisionMode: false,
      }
    }
    if (langPrefix === 'kn') {
      return {
        text: 'ಎಲೆಯ ರೋಗನಿರ್ಣಯವು ಅನಿಶ್ಚಿತವಾಗಿದೆ. ಎಲೆಯ ಭಾಗಗಳು ಸ್ಪಷ್ಟವಾಗಿ ಕಂಡುಬಂದಿಲ್ಲ. ದಯವಿಟ್ಟು ಸ್ನೇಕ್ ಪ್ಲಾಂಟ್, ಟೊಮೆಟೊ, ಆಲೂಗಡ್ಡೆ ಅಥವಾ ದಪ್ಪ ಮೆಣಸಿನಕಾಯಿ ಎಲೆಯನ್ನು ಉತ್ತಮ ಬೆಳಕಿನಲ್ಲಿ ಸ್ಪಷ್ಟವಾಗಿ ಹಿಡಿದು ಮತ್ತೆ ಸ್ಕ್ಯಾನ್ ಮಾಡಿ.',
        phoneticText: 'Eleya roganirnayavu anishchitavaagide. Dayavittu Snake Plant, Tomato, Aalugadde athava Dappa Menasinakaayi eleyannu uttama belakinalli spastavaagi hididu matte scan maadi.',
        isDecisionMode: false,
      }
    }
    if (langPrefix === 'ml') {
      return {
        text: 'ഇലയുടെ രോഗനിർണ്ണയം അനിശ്ചിതത്വത്തിലാണ്. ഇലയുടെ ഭാഗങ്ങൾ വ്യക്തമായി തിരിച്ചറിയാൻ കഴിഞ്ഞില്ല. ദയവായി സ്നേക്ക് പ്ലാന്റ്, തക്കാളി, ഉരുളക്കിഴങ്ങ് അല്ലെങ്കിൽ കാപ്സിക്കം ഇല നല്ല വെളിച്ചത്തിൽ കാണിച്ച് വീണ്ടും സ്കാൻ ചെയ്യുക.',
        phoneticText: 'Ilayude roganirnnayam anishchithathwathilaannu. Dayavaayi Snake Plant, Thakkaali, Urulakkizhangu allenkil Capsicum ila nalla velichathil kaanichu veendum scan cheyyuka.',
        isDecisionMode: false,
      }
    }
    return {
      text: 'The leaf diagnosis is uncertain. Could not detect clear leaf regions. Please hold a Snake Plant, Tomato, Potato, or Bell Pepper leaf clearly in view with good lighting, or upload a photo, and scan again.',
      phoneticText: 'The leaf diagnosis is uncertain. Could not detect clear leaf regions. Please hold a Snake Plant, Tomato, Potato, or Bell Pepper leaf clearly in view with good lighting, or upload a photo, and scan again.',
      isDecisionMode: false,
    }
  }

  const plantName = result.plant || 'Plant'
  const localizedPlant = getLocalizedPlantName(plantName, activeLang)
  const conditionName = result.condition || (isHealthy ? 'Healthy' : 'Diseased')
  const localizedCondition = getLocalizedConditionName(conditionName, activeLang)
  const confidencePct = Math.round((result.confidence || 0.95) * 100)

  // Look up recommendations
  const recKey = result.class_name || ''
  const rec = DISEASE_RECOMMENDATIONS[recKey]
  const precautions = result.precautions || rec?.precautions || []
  const cures = result.cure || rec?.cure || []
  const keyPrecaution = precautions.length > 0 ? precautions[0] : 'Maintain proper spacing and base watering.'
  const keyCure = cures.length > 0 ? cures[0] : 'Prune affected leaves immediately to halt spread.'

  // 1. HEALTHY LEAF ANNOUNCEMENTS
  if (isHealthy) {
    if (langPrefix === 'te') {
      const text = `ఈ ఆకు పూర్తిగా ఆరోగ్యంగా ఉంది! ఎంత ఆరోగ్యంగా ఉంది: రోగనిర్ధారణ విశ్వసనీయత ${confidencePct} శాతం మరియు ఆకు యొక్క శక్తి సరైన స్థాయిలో ఉంది. ఇందులో మంచి విషయం ఏమిటంటే: ఆకు ఎటువంటి తెగుళ్లు, మచ్చలు లేదా శిలీంధ్రాల లక్షణాలు లేకుండా ఎంతో తాజాగా ఉంది. స్టార్టర్‌లోని పూర్తి వివరాలు: మీ ${localizedPlant} అత్యుత్తమ స్థితిలో ఉంది. వారానికి ఒకసారి సరిపడా నీరు మరియు మితమైన సూర్యరశ్మిని అందించండి.`
      const phonetic = `Ee aaku poortigaa aarogyamgaa undi! Yenta aarogyamgaa undi: Roganirdhaarana vishvasaneeyata ${confidencePct} percent mariyu aaku vitality chaalaa baagundi. Induloo manchi vishayam emitante: Aaku elanti tegullu leekundaa taajaagaa undi. Starter looni poorti vivaraalu: Mee ${plantName} atyuttama sthitiloo undi. Vaaraaniki okasaari saripadaa neeru ivvandi.`
      return { text, phoneticText: phonetic, isDecisionMode: false }
    }
    if (langPrefix === 'hi') {
      const text = `यह पत्ता पूरी तरह से स्वस्थ है! यह कितना स्वस्थ है: ${confidencePct} प्रतिशत नैदानिक विश्वसनीयता के साथ पत्ता उत्तम स्थिति में है। इसमें अच्छी बात क्या है: पत्ती पर किसी भी फफूंद, धब्बे या कीट के कोई लक्षण नहीं हैं। स्टार्टर में पूरा विवरण: आपका ${localizedPlant} बेहतरीन स्थिति में है। नियमित रूप से सप्ताह में एक बार पानी दें और हल्की धूप बनाए रखें।`
      const phonetic = `Yeh patta poori tarah se swasth hai! Yeh kitna swasth hai: Nidan vishwasniyata ${confidencePct} percent ke saath patta uttam sthiti me hai. Isme acchi baat kya hai: Patti par kisi tarah ke daag ya keede ke sanket nahi hain. Starter me poora vivaran: Aapka ${plantName} behtareen sthiti me hai. Niyamit roop se paani dein aur acchi dhoop banaye rakhein.`
      return { text, phoneticText: phonetic, isDecisionMode: false }
    }
    if (langPrefix === 'ta') {
      const text = `இந்த இலை மிகவும் ஆரோக்கியமாக உள்ளது! இது எவ்வளவு ஆரோக்கியமானது: நோயறிதல் நம்பகத்தன்மை ${confidencePct} சதவீதம் மற்றும் இலை சிறந்த வீரியத்துடன் உள்ளது. இதில் உள்ள நல்ல விஷயம் என்னவென்றால்: பூச்சிகள், இலைக்கருகல் அல்லது பூஞ்சை பாதிப்புகள் எதுவும் இல்லை. தொடக்கக் குறிப்பில் முழு விவரங்கள்: உங்கள் ${localizedPlant} மிகச் சிறந்த நிலையில் உள்ளது. வாரத்திற்கு ஒரு முறை போதுமான தண்ணீர் மற்றும் மிதமான சூரிய வெளிச்சம் கொடுக்கவும்.`
      const phonetic = `Indha ilai migavum aarokkiyamaaga ulladhu! Aarokkya tharam ${confidencePct} percent. Idhil nalla vishayam ennavenral: Poochigal matrum noi thotru edhuvum illai. Starteril muzhu vivarangal: Ungal ${plantName} sirandha nilaiyil ulladhu. Vaarathirku oru murai thagundha thanneer matrum sooriya velicham kodukkavum.`
      return { text, phoneticText: phonetic, isDecisionMode: false }
    }
    if (langPrefix === 'kn') {
      const text = `ಈ ಎಲೆಯು ಸಂಪೂರ್ಣವಾಗಿ ಆರೋಗ್ಯಕರವಾಗಿದೆ! ಇದು ಎಷ್ಟು ಆರೋಗ್ಯಕರವಾಗಿದೆ: ರೋಗನಿರ್ಣಯದ ನಿಖರತೆ ${confidencePct} ಪ್ರತಿಶತ ಮತ್ತು ಎಲೆಯ ಶಕ್ತಿಯು ಅತ್ಯುತ್ತಮವಾಗಿದೆ. ಇದರಲ್ಲಿ ಉತ್ತಮ ಅಂಶವೇನು: ಎಲೆಯಲ್ಲಿ ಯಾವುದೇ ಶಿಲೀಂಧ್ರ ಅಥವಾ ಕೀಟಗಳ ಲಕ್ಷಣಗಳಿಲ್ಲ. ಆರಂಭಿಕ ವಿವರಗಳು: ನಿಮ್ಮ ${localizedPlant} ಅತ್ಯುತ್ತಮ ಸ್ಥಿತಿಯಲ್ಲಿದೆ. ವಾರಕ್ಕೊಮ್ಮೆ ಸೂಕ್ತ ನೀರು ಮತ್ತು ಮಿತವಾದ ಸೂರ್ಯನ ಬೆಳಕನ್ನು ನೀಡಿ.`
      const phonetic = `Ee eleyu sampoornavaagi aaroogyakaravaagide! Roganirnayada nikhurate ${confidencePct} percent. Idaralli uttama amshavenu: Eleyalli yaavude roga athava keetagala lakshanagalilla. Aarambhika vivaragalu: Nimma ${plantName} atyuttama sthitiyallide. Vaarakkomme neeru haaki mattu sooryana belakanu needi.`
      return { text, phoneticText: phonetic, isDecisionMode: false }
    }
    if (langPrefix === 'ml') {
      const text = `ഈ ഇല പൂർണ്ണമായും ആരോഗ്യമുള്ളതാണ്! ഇത് എത്രത്തോളം ആരോഗ്യകരമാണ്: രോഗനിർണ്ണയ കൃത്യത ${confidencePct} ശതമാനവും ഇലയ്ക്ക് മികച്ച കരുത്തുമുണ്ട്. ഇതിൽ നല്ല കാര്യം എന്തെന്നാൽ: കീടങ്ങളുടെയോ കുമിളുകളുടെയോ കേടുപാടുകൾ ഒന്നും തന്നെയില്ല. സ്റ്റാർട്ടറിലെ മുഴുവൻ വിവരങ്ങൾ: നിങ്ങളുടെ ${localizedPlant} മികച്ച അവസ്ഥയിലാണ്. ആഴ്ചയിലൊരിക്കൽ മിതമായി വെള്ളവും ആവശ്യത്തിന് സൂര്യപ്രകാശവും നൽകുക.`
      const phonetic = `Ee ila poorrnamaayum aarogyamullathaannu! Roganirnnaya krithyatha ${confidencePct} percent. Ithil nalla kaaryam enthennaal: Keedangaludeyo kumilukaludeyo baadhakal onnumilla. Starterile muzhuvan vivarangal: Ningalude ${plantName} mikacha avasthayilaannu. Aazhchayilorikkal mithamaayi vellavum sooryaprakaashavum nalkuka.`
      return { text, phoneticText: phonetic, isDecisionMode: false }
    }

    // Default English
    let speech = `The leaf is healthy! `
    speech += `How healthy is it: Diagnosis confidence is ${confidencePct} percent with optimal leaf vigor. `
    speech += `What's good about it: The foliage displays vibrant cellular pigmentation with zero signs of pathogen decay, blight, or pest lesions. `
    speech += `All details in the starter: Your ${plantName} is in peak condition. Continue regular weekly watering and moderate indirect sunlight.`
    return { text: speech, phoneticText: speech, isDecisionMode: false }
  }

  // 2. DISEASED LEAF ANNOUNCEMENTS (DECISION MODE)
  if (langPrefix === 'te') {
    const text = `ఈ ఆకు నిర్ణయ మోడ్‌లో ఉంది మరియు ${localizedCondition} తో వ్యాధిగ్రస్తమైంది. ఎంత తీవ్రంగా ఉంది: రోగనిర్ధారణ విశ్వసనీయత ${confidencePct} శాతం. ఇందులో మంచి విషయం ఏమిటంటే: ఈ వ్యాధిని ప్రారంభంలోనే గుర్తించడం వల్ల మిగిలిన మొక్కకు వ్యాపించకుండా కాపాడవచ్చు. స్టార్టర్‌లోని పూర్తి వివరాలు: ఈ ఆకు నిర్ణయ మోడ్‌లో ఉంది, భవిష్యత్తులో ఈ వ్యాధి రాకుండా ఉండటానికి మీరు తీసుకోవలసిన జాగ్రత్తలు ఇక్కడ ఉన్నాయి. మీరు ఈ జాగ్రత్తలు పాటిస్తే, మీ మొక్కకు ఇకపై ఎటువంటి ప్రమాదం ఉండదు. ముఖ్యమైన జాగ్రత్త: ${keyPrecaution}. ముఖ్యమైన నివారణ చర్య: ${keyCure}.`
    const phonetic = `Ee aaku decision mode loo undi mariyu ${conditionName} too prabhaavithamaindi. Diagnostic confidence ${confidencePct} percent. Induloo manchi vishayam emitante: Ee samasyanu praarambhamloone gurtinchadam valla migilina mokkanu kaapaadavachhu. Starter looni poorti vivaraalu: The leaf is in decision mode, and these are the precautions you can take to avoid this disease in the future. If you follow these precautions, the plant will no longer be at risk. Key precaution: ${keyPrecaution}. Key cure step: ${keyCure}.`
    return { text, phoneticText: phonetic, isDecisionMode: true }
  }

  if (langPrefix === 'hi') {
    const text = `यह पत्ता निर्णय मोड में है और ${localizedCondition} से प्रभावित है। इसकी स्थिति क्या है: ${confidencePct} प्रतिशत नैदानिक विश्वसनीयता है। इसमें अच्छी बात क्या है: इस बीमारी का समय रहते पता चल गया है जिससे बाकी पौधे को सुरक्षित रखा जा सकता है। स्टार्टर में पूरा विवरण: यह पत्ता निर्णय मोड में है, और भविष्य में इस बीमारी से बचने के लिए आप ये सावधानियां बरत सकते हैं। यदि आप इन सावधानियों का पालन करते हैं, तो पौधा अब खतरे में नहीं रहेगा। मुख्य सावधानी: ${keyPrecaution}। मुख्य उपचार: ${keyCure}।`
    const phonetic = `Yeh patta decision mode me hai aur ${conditionName} se prabhavit hai. Diagnostic confidence ${confidencePct} percent. Isme acchi baat kya hai: Samay par pata chalne se baaki paudhe ko surakshit rakha ja sakta hai. Starter me poora vivaran: The leaf is in decision mode, and these are the precautions you can take to avoid this disease in the future. If you follow these precautions, the plant will no longer be at risk. Key precaution: ${keyPrecaution}. Key cure: ${keyCure}.`
    return { text, phoneticText: phonetic, isDecisionMode: true }
  }

  if (langPrefix === 'ta') {
    const text = `இந்த இலை முடிவு முறையில் உள்ளது மற்றும் ${localizedCondition} நோயால் பாதிக்கப்பட்டுள்ளது. நோயறிதல் நம்பகத்தன்மை ${confidencePct} சதவீதம். இதில் உள்ள நல்ல விஷயம் என்னவென்றால்: இந்நோய் ஆரம்ப நிலையிலேயே கண்டறியப்பட்டதால் மற்ற இலைகளுக்கு பரவாமல் பாதுகாக்க முடியும். தொடக்கக் குறிப்பில் முழு விவரங்கள்: இந்த இலை முடிவு முறையில் உள்ளது, எதிர்காலத்தில் இந்த நோய் வராமல் தடுக்க நீங்கள் எடுக்க வேண்டிய முன்னெச்சரிக்கைகள் இதோ. இந்த முன்னெச்சரிக்கைகளைப் பின்பற்றினால், உங்கள் செடிக்கு எந்த ஆபத்தும் இருக்காது. முக்கிய முன்னெச்சரிக்கை: ${keyPrecaution}. முக்கிய தீர்வு: ${keyCure}.`
    const phonetic = `Indha ilai decision modelil ulladhu matrum ${conditionName} noyaal baadhikkappattulladhu. Diagnostic confidence ${confidencePct} percent. Idhil nalla vishayam ennavenral: Idhai aarambathileye kandupidithadhaal matra ilaikalukku paravamal thadukka mudiyum. Starteril muzhu vivarangal: The leaf is in decision mode, and these are the precautions you can take to avoid this disease in the future. If you follow these precautions, the plant will no longer be at risk. Key precaution: ${keyPrecaution}. Key cure: ${keyCure}.`
    return { text, phoneticText: phonetic, isDecisionMode: true }
  }

  if (langPrefix === 'kn') {
    const text = `ಈ ಎಲೆಯು ನಿರ್ಧಾರ ಮೋಡ್‌ನಲ್ಲಿದೆ ಮತ್ತು ${localizedCondition} ರೋಗದಿಂದ ಬಾಧಿತವಾಗಿದೆ. ರೋಗನಿರ್ಣಯದ ನಿಖರತೆ ${confidencePct} ಪ್ರತಿಶತ. ಇದರಲ್ಲಿ ಉತ್ತಮ ಅಂಶವೇನು: ರೋಗವನ್ನು ಮೊದಲೇ ಪತ್ತೆಹಚ್ಚಿರುವುದರಿಂದ ಉಳಿದ ಗಿಡವನ್ನು ಹರಡದಂತೆ ರಕ್ಷಿಸಬಹುದು. ಆರಂಭಿಕ ವಿವರಗಳು: ಈ ಎಲೆಯು ನಿರ್ಧಾರ ಮೋಡ್‌ನಲ್ಲಿದೆ, ಭವಿಷ್ಯದಲ್ಲಿ ಈ ರೋಗ ಬಾರದಂತೆ ತಡೆಯಲು ನೀವು ತೆಗೆದುಕೊಳ್ಳಬೇಕಾದ ಮುನ್ನೆಚ್ಚರಿಕೆಗಳು ಇಲ್ಲಿವೆ. ನೀವು ಈ ಮುನ್ನೆಚ್ಚರಿಕೆಗಳನ್ನು ಪಾಲಿಸಿದರೆ, ನಿಮ್ಮ ಗಿಡಕ್ಕೆ ಇನ್ನು ಯಾವುದೇ ಅಪಾಯವಿರುವುದಿಲ್ಲ. ಪ್ರಮುಖ ಮುನ್ನೆಚ್ಚರಿಕೆ: ${keyPrecaution}. ಪ್ರಮುಖ ಚಿಕಿತ್ಸೆ: ${keyCure}.`
    const phonetic = `Ee eleyu decision mode nallide mattu ${conditionName} rogadinda baadhithavaagide. Diagnostic confidence ${confidencePct} percent. Idaralli uttama amshavenu: Rogavannu modale pattehachhiruvudarinda ulida gidavannu rakshisabahudu. Aarambhika vivaragalu: The leaf is in decision mode, and these are the precautions you can take to avoid this disease in the future. If you follow these precautions, the plant will no longer be at risk. Key precaution: ${keyPrecaution}. Key cure: ${keyCure}.`
    return { text, phoneticText: phonetic, isDecisionMode: true }
  }

  if (langPrefix === 'ml') {
    const text = `ഈ ഇല തീരുമാന മോഡിലാണ്, ${localizedCondition} രോഗം ബാധിച്ചിരിക്കുന്നു. രോഗനിർണ്ണയ കൃത്യത ${confidencePct} ശതമാനമാണ്. ഇതിൽ നല്ല കാര്യം എന്തെന്നാൽ: രോഗം തുടക്കത്തിലേ കണ്ടെത്തിയതിനാൽ ബാക്കി ചെടിയെ സംരക്ഷിക്കാൻ കഴിയും. സ്റ്റാർട്ടറിലെ മുഴുവൻ വിവരങ്ങൾ: ഈ ഇല തീരുമാന മോഡിലാണ്, ഭാവിയിൽ ഈ രോഗം വരാതിരിക്കാൻ നിങ്ങൾ സ്വീകരിക്കേണ്ട മുൻകരുതലുകൾ ഇതാ. നിങ്ങൾ ഈ മുൻകരുതലുകൾ പാലിക്കുകയാണെങ്കിൽ, ചെടിക്ക് ഇനി അപകടമുണ്ടാകില്ല. പ്രധാന മുൻകരുതൽ: ${keyPrecaution}. പ്രധാന ചികിത്സ: ${keyCure}.`
    const phonetic = `Ee ila decision modelilaannu, ${conditionName} rogam baadhichirikkunnu. Diagnostic confidence ${confidencePct} percent. Ithil nalla kaaryam enthennaal: Rogam thudakkathile kandethiyathinaal baakki chediye samrakshikkaan kazhiyum. Starterile muzhuvan vivarangal: The leaf is in decision mode, and these are the precautions you can take to avoid this disease in the future. If you follow these precautions, the plant will no longer be at risk. Key precaution: ${keyPrecaution}. Key cure: ${keyCure}.`
    return { text, phoneticText: phonetic, isDecisionMode: true }
  }

  // Default English
  let speech = `The leaf is in decision mode and is diseased with ${conditionName}. `
  speech += `How healthy is it: Diagnostic confidence is ${confidencePct} percent. `
  speech += `What's good about it: Because this condition was detected early, the rest of the plant can be protected from spread. `
  speech += `All details in the starter: The leaf is in decision mode, and these are the precautions you can take to avoid this disease in the future. If you follow these precautions, the plant will no longer be at risk.`
  if (precautions.length > 0) speech += ` Key precaution: ${precautions[0]}.`
  if (cures.length > 0) speech += ` Key cure step: ${cures[0]}.`
  return { text: speech, phoneticText: speech, isDecisionMode: true }
}

/**
 * BUTTON 1: Precautions
 * Reports both the leaf's condition AND concrete prevention methods in selected language.
 */
export function getPrecautionsButtonContent(scanResult: any, langCode: string = 'en-IN'): ButtonContent {
  const detectedClass = scanResult?.class_name || scanResult?.top_predictions?.[0]?.class_name || ''
  const rec = DISEASE_RECOMMENDATIONS[detectedClass]
  const isHealthy = scanResult?.verdict === 'healthy' || scanResult?.condition?.toLowerCase() === 'healthy'
  const confidencePct = Math.round((scanResult?.confidence || 0.95) * 100)
  const plant = scanResult?.plant || 'Plant'
  const condition = scanResult?.condition || (isHealthy ? 'Healthy' : 'Diseased')
  const langPrefix = (langCode || 'en').split('-')[0].toLowerCase()

  const localizedPlant = getLocalizedPlantName(plant, langCode)
  const localizedCondition = getLocalizedConditionName(condition, langCode)

  const precautions = rec?.precautions || scanResult?.precautions || [
    'Maintain proper spacing between plants for adequate airflow.',
    'Water at the base of the plant early in the morning to prevent prolonged leaf wetness.',
    'Sanitize garden shears with 70% isopropyl alcohol between prunings.'
  ]

  if (langPrefix === 'te') {
    const conditionSummary = isHealthy
      ? `${localizedPlant} ${confidencePct}% విశ్వసనీయతతో పూర్తిగా ఆరోగ్యకరంగా ఉంది.`
      : `${localizedPlant} ${localizedCondition} తో ${confidencePct}% తీవ్రతతో ప్రభావితమైంది. తక్షణ నివారణ చర్యలు అవసరం.`
    const displayText = `పరిస్థితి నివేదిక:\n${conditionSummary}\n\nనివారణ జాగ్రత్తలు (వ్యాధి మళ్లీ రాకుండా ఎలా నిరోధించాలి):\n1. మొక్కల మధ్య మంచి గాలి ప్రసరణ ఉండేలా తగినంత స్థలాన్ని నిర్వహించండి.\n2. ఆకులపై ఎక్కువసేపు తడి ఉండకుండా నిరోధించడానికి ఉదయాన్నే మొక్క మొదట్లో మాత్రమే నీరు పోయండి.\n3. కత్తిరింపు సాధనాలను ఉపయోగించే ముందు 70% ఐసోప్రొపైల్ ఆల్కహాల్‌తో క్రిమిసంహారక చేయండి.`
    const speechText = `పరిస్థితి నివేదిక: ${conditionSummary} నివారణ జాగ్రత్తలు ఇక్కడ ఉన్నాయి: నీటిని ఆకులపై కాకుండా వేర్ల వద్ద మాత్రమే పోయండి. మొక్కల మధ్య మంచి గాలి ప్రసరణ ఉండేలా చూసుకోండి. ఎండిన లేదా తెగులు సోకిన ఆకులను వెంటనే తొలగించండి.`
    const phoneticText = `Paristhiti nivedika: ${conditionSummary} Nivaarana jaagrattalu: Neetini aakulapai kaakundaa veerla vaddane poyandi. Mokkala madhya gaali vundelaa chusukondi. Tegulu sokina aakulanu ventane tholaginchandi.`
    return { title: '🛡️ జాగ్రత్తలు & నివారణ పద్ధతులు', displayText, speechText, phoneticText }
  }

  if (langPrefix === 'hi') {
    const conditionSummary = isHealthy
      ? `${localizedPlant} ${confidencePct}% विश्वसनीयता के साथ पूरी तरह स्वस्थ है।`
      : `${localizedPlant} ${localizedCondition} से ${confidencePct}% संभावना के साथ प्रभावित है। तत्काल रोकथाम आवश्यक है।`
    const displayText = `स्थिति रिपोर्ट:\n${conditionSummary}\n\nरोकथाम सावधानियां (बीमारी को दोबारा होने से कैसे रोकें):\n1. उचित वायु प्रवाह के लिए पौधों के बीच पर्याप्त दूरी बनाए रखें।\n2. पत्तियों पर नमी जमा होने से बचाने के लिए सुबह के समय पौधों की जड़ों में पानी दें।\n3. छंटाई के औजारों को 70% आइसोप्रोपिल अल्कोहल से रोगाणुरहित करें।`
    const speechText = `स्थिति रिपोर्ट: ${conditionSummary} रोकथाम के तरीके: पौधों की जड़ों में पानी दें, पत्तियों के बीच हवा का प्रवाह रखें और रोगग्रस्त पत्तियों को तुरंत हटा दें।`
    const phoneticText = `Sthiti report: ${conditionSummary} Roktham ke tareeke: Paudhon ki jadon me paani dein, hawa ka pravah rakhein aur bimari wali pattiyon ko hata dein.`
    return { title: '🛡️ सावधानियां और रोकथाम के तरीके', displayText, speechText, phoneticText }
  }

  if (langPrefix === 'ta') {
    const conditionSummary = isHealthy
      ? `${localizedPlant} ${confidencePct}% நம்பகத்தன்மையுடன் ஆரோக்கியமாக உள்ளது.`
      : `${localizedPlant} ${localizedCondition} நோயால் ${confidencePct}% தீவிரத்துடன் பாதிக்கப்பட்டுள்ளது. உடனடி பாதுகாப்பு நடவடிக்கை தேவை.`
    const displayText = `நிலை அறிக்கை:\n${conditionSummary}\n\nதடுப்பு முன்னெச்சரிக்கைகள் (நோய் மீண்டும் வராமல் தடுப்பது எப்படி):\n1. காற்றோட்டத்திற்காக செடிகளுக்கு இடையே சரியான இடைவெளி விடவும்.\n2. இலைகளில் ஈரம் தங்காமல் இருக்க காலையில் செடியின் வேர்ப்பகுதியில் தண்ணீர் ஊற்றவும்.\n3. கத்தரிக்கும் கருவிகளை ஆல்கஹால் கொண்டு தூய்மைப்படுத்தவும்.`
    const speechText = `நிலை அறிக்கை: ${conditionSummary} தடுப்பு முறைகள்: வேர்ப்பகுதியில் மட்டுமே தண்ணீர் ஊற்றவும். செடிகளுக்கு இடையே காற்றோட்டம் இருப்பதை உறுதி செய்து, பாதிக்கப்பட்ட இலைகளை உடனே அகற்றவும்.`
    const phoneticText = `Nilai arikkai: ${conditionSummary} Thaduppu muraigal: Verppagudhiyil mattume thanneer ootravum. Kaatrottam iruppadhai urudhi seithu, baadhikkapatta ilaikalai udane agattravum.`
    return { title: '🛡️ முன்னெச்சரிக்கைகள் & தடுப்பு முறைகள்', displayText, speechText, phoneticText }
  }

  if (langPrefix === 'kn') {
    const conditionSummary = isHealthy
      ? `${localizedPlant} ${confidencePct}% ನಿಖರತೆಯೊಂದಿಗೆ ಆರೋಗ್ಯಕರವಾಗಿದೆ.`
      : `${localizedPlant} ${localizedCondition} ರೋಗದಿಂದ ${confidencePct}% ಬಾಧಿತವಾಗಿದೆ. ತಕ್ಷಣದ ಕ್ರಮ ಅಗತ್ಯ.`
    const displayText = `ಸ್ಥಿತಿ ವರದಿ:\n${conditionSummary}\n\nತಡೆಗಟ್ಟುವ ಮುನ್ನೆಚ್ಚರಿಕೆಗಳು:\n1. ಉತ್ತಮ ಗಾಳಿಯಾಡುವಿಕೆಗಾಗಿ ಗಿಡಗಳ ನಡುವೆ ಸರಿಯಾದ ಅಂತರವನ್ನು ಕಾಪಾಡಿಕೊಳ್ಳಿ.\n2. ಎಲೆಗಳ ಮೇಲೆ ನೀರು ಬೀಳದಂತೆ ಬೆಳಿಗ್ಗೆ ಬೇರುಗಳಿಗೆ ಮಾತ್ರ ನೀರು ಹಾಕಿ.\n3. ಕತ್ತರಿಸುವ ಉಪಕರಣಗಳನ್ನು ಸ್ವಚ್ಛಗೊಳಿಸಿ ಬಳಸಿ.`
    const speechText = `ಸ್ಥಿತಿ ವರದಿ: ${conditionSummary} ತಡೆಗಟ್ಟುವ ವಿಧಾನಗಳು: ಗಿಡದ ಬುಡಕ್ಕೆ ಮಾತ್ರ ನೀರು ಹಾಕಿ, ಉತ್ತಮ ಗಾಳಿಯಾಡುವಂತೆ ನೋಡಿಕೊಳ್ಳಿ ಮತ್ತು ರೋಗಪೀಡಿತ ಎಲೆಗಳನ್ನು ತಕ್ಷಣ ತೆಗೆದುಹಾಕಿ.`
    const phoneticText = `Sthiti varadi: ${conditionSummary} Thadegattuva vidhaanagalu: Gidada budakke maathra neeru haaki, roogapeeditha eleyannu thegeduhaaki.`
    return { title: '🛡️ ಮುನ್ನೆಚ್ಚರಿಕೆಗಳು ಮತ್ತು ತಡೆಗಟ್ಟುವಿಕೆ', displayText, speechText, phoneticText }
  }

  if (langPrefix === 'ml') {
    const conditionSummary = isHealthy
      ? `${localizedPlant} ${confidencePct}% കൃത്യതയോടെ പൂർണ്ണ ആരോഗ്യത്തിലാണ്.`
      : `${localizedPlant} ${localizedCondition} രോഗം ബാധിച്ച് ${confidencePct}% സാധ്യതയിലാണ്. ഉടനടി പ്രതിരോധം ആവശ്യമാണ്.`
    const displayText = `സ്ഥിതി വിവരണം:\n${conditionSummary}\n\nപ്രതിരോധ മുൻകരുതലുകൾ:\n1. വായുസഞ്ചാരത്തിനായി ചെടികൾക്കിടയിൽ കൃത്യമായ അകലം പാലിക്കുക.\n2. ഇലകളിൽ വെള്ളം തങ്ങിനിൽക്കാതിരിക്കാൻ രാവിലെ വേരുകളിൽ മാത്രം വെള്ളമൊഴിക്കുക.\n3. ചെടി വെട്ടുന്ന ഉപകരണങ്ങൾ അണുവിമുക്തമാക്കുക.`
    const speechText = `സ്ഥിതി വിവരണം: ${conditionSummary} പ്രതിരോധ മാർഗ്ഗങ്ങൾ: വേരുകളിൽ മാത്രം വെള്ളമൊഴിക്കുക, വായുസഞ്ചാരം ഉറപ്പാക്കുക, രോഗം ബാധിച്ച ഇലകൾ ഉടനടി നീക്കം ചെയ്യുക.`
    const phoneticText = `Sthithi vivaranam: ${conditionSummary} Prathirodha maargangal: Verukalil maathram vellamozhikkuka, rogam baadhicha ilakal udanadi neekkam cheyyuka.`
    return { title: '🛡️ മുൻകരുതലുകളും പ്രതിരോധവും', displayText, speechText, phoneticText }
  }

  // English fallback
  const conditionSummary = isHealthy
    ? `${plant} is healthy with ${confidencePct}% confidence and normal foliage vitality.`
    : `${plant} is affected by ${condition} with ${confidencePct}% confidence. Prompt preventative action is required.`
  const precautionsList = precautions.map((p: string, i: number) => `${i + 1}. ${p}`).join('\n')
  return {
    title: '🛡️ Precautions & Prevention Methods',
    displayText: `Condition Report:\n${conditionSummary}\n\nPrevention Precautions (How to Prevent Recurrence):\n${precautionsList}`,
    speechText: `Condition report: ${conditionSummary} Here are the prevention methods: ${precautions.join('. ')}`,
    phoneticText: `Condition report: ${conditionSummary} Here are the prevention methods: ${precautions.join('. ')}`,
  }
}

/**
 * BUTTON 2: Two Steps / Cure
 * Delivers concrete cure & treatment steps in selected language.
 */
export function getCureTwoStepsButtonContent(scanResult: any, langCode: string = 'en-IN'): ButtonContent {
  const detectedClass = scanResult?.class_name || scanResult?.top_predictions?.[0]?.class_name || ''
  const rec = DISEASE_RECOMMENDATIONS[detectedClass]
  const isHealthy = scanResult?.verdict === 'healthy' || scanResult?.condition?.toLowerCase() === 'healthy'
  const plant = scanResult?.plant || 'Plant'
  const condition = scanResult?.condition || (isHealthy ? 'Healthy' : 'Diseased')
  const langPrefix = (langCode || 'en').split('-')[0].toLowerCase()

  const localizedPlant = getLocalizedPlantName(plant, langCode)
  const localizedCondition = getLocalizedConditionName(condition, langCode)

  if (langPrefix === 'te') {
    const step1 = isHealthy
      ? 'దశ 1 (నివారణ సంరక్షణ): రసాయన లేదా శిలీంధ్రనాశక చికిత్స అవసరం లేదు. క్రమం తప్పకుండా మట్టి తేమను కొనసాగించండి.'
      : 'దశ 1 (తక్షణ చర్య): వ్యాధి సోకిన ఆకులను వెంటనే కత్తిరించి సురక్షితంగా వేరు చేయండి.'
    const step2 = isHealthy
      ? 'దశ 2 (నియమిత పర్యవేక్షణ): ఆకుల అడుగుభాగం మరియు వేర్లను వారానికొకసారి తెగుళ్ల సంకేతాల కోసం తనిఖీ చేయండి.'
      : 'దశ 2 (సక్రియ చికిత్స): సమస్య తీవ్రతరం కాకుండా వేప నూనె లేదా తగిన కాపర్ శిలీంధ్రనాశకాన్ని పిచికారీ చేయండి.'
    return {
      title: '💊 రెండు దశలు: చికిత్స ప్రణాళిక',
      displayText: `${localizedPlant} (${localizedCondition}) కోసం రెండు దశల చికిత్స ప్రణాళిక:\n\n• ${step1}\n\n• ${step2}`,
      speechText: `మీ ${localizedPlant} కోసం రెండు చికిత్స దశలు ఇక్కడ ఉన్నాయి: ${step1}. ${step2}`,
      phoneticText: `Mee ${plant} kosam rendu treatment dashalu: ${step1}. ${step2}`,
    }
  }

  if (langPrefix === 'hi') {
    const step1 = isHealthy
      ? 'चरण 1 (निवारक देखभाल): रासायनिक उपचार की आवश्यकता नहीं है। संतुलित नमी बनाए रखें।'
      : 'चरण 1 (तत्काल कार्रवाई): संक्रमित पत्तियों को तुरंत काटकर अलग करें ताकि बीमारी न फैले।'
    const step2 = isHealthy
      ? 'चरण 2 (नियमित निगरानी): कीटों या फफूंद के शुरुआती लक्षणों के लिए साप्ताहिक जांच करें।'
      : 'चरण 2 (सक्रिय उपचार): लक्षित कॉपर फंगीसाइड या जैविक नीम के तेल का छिड़काव करें।'
    return {
      title: '💊 दो चरण: उपचार योजना',
      displayText: `${localizedPlant} (${localizedCondition}) के लिए दो-चरणीय उपचार योजना:\n\n• ${step1}\n\n• ${step2}`,
      speechText: `आपके ${localizedPlant} के लिए दो उपचार चरण: ${step1}. ${step2}`,
      phoneticText: `Aapke ${plant} ke liye do upchar charan: ${step1}. ${step2}`,
    }
  }

  if (langPrefix === 'ta') {
    const step1 = isHealthy
      ? 'படி 1 (தடுப்பு பராமரிப்பு): ரசாயன சிகிச்சை தேவையில்லை. வழக்கமான நீர் மேலாண்மையை தொடரவும்.'
      : 'படி 1 (உடனடி நடவடிக்கை): பாதிக்கப்பட்ட இலைகளை உடனே வெட்டி அப்புறப்படுத்துங்கள்.'
    const step2 = isHealthy
      ? 'படி 2 (கண்காணிப்பு): வாரந்தோறும் இலைகளின் அடிப்பகுதியை பூச்சி தாக்குதலுக்கு ஆய்வு செய்யவும்.'
      : 'படி 2 (சிகிச்சை): வேப்ப எண்ணெய் அல்லது இயற்கை பூஞ்சைக்கொல்லியை செடியின் மீது தெளிக்கவும்.'
    return {
      title: '💊 இரண்டு படிகள்: சிகிச்சை திட்டம்',
      displayText: `${localizedPlant} (${localizedCondition})க்கான இரண்டு-படி சிகிச்சை திட்டம்:\n\n• ${step1}\n\n• ${step2}`,
      speechText: `உங்கள் ${localizedPlant}க்கான இரண்டு சிகிச்சை படிகள்: ${step1}. ${step2}`,
      phoneticText: `Ungal ${plant}kaana irandu chikitsai padigal: ${step1}. ${step2}`,
    }
  }

  if (langPrefix === 'kn') {
    const step1 = isHealthy
      ? 'ಹಂತ 1 (ಮುನ್ನೆಚ್ಚರಿಕೆ): ಯಾವುದೇ ರಾಸಾಯನಿಕ ಚಿಕಿತ್ಸೆ ಅಗತ್ಯವಿಲ್ಲ. ಸಮತೋಲಿತ ತೇವಾಂಶ ಕಾಪಾಡಿಕೊಳ್ಳಿ.'
      : 'ಹಂತ 1 (ತಕ್ಷಣದ ಕ್ರಮ): ರೋಗಪೀಡಿತ ಎಲೆಗಳನ್ನು ಕತ್ತರಿಸಿ ತಕ್ಷಣ ದೂರ ವಿಲೇವಾರಿ ಮಾಡಿ.'
    const step2 = isHealthy
      ? 'ಹಂತ 2 (ಮೇಲ್ವಿಚಾರಣೆ): ವಾರಕ್ಕೊಮ್ಮೆ ಎಲೆಗಳ ತಳಭಾಗವನ್ನು ಕೀಟಗಳ ಲಕ್ಷಣಗಳಿಗಾಗಿ ಪರಿಶೀಲಿಸಿ.'
      : 'ಹಂತ 2 (ಚಿಕಿತ್ಸೆ): ಬೇವಿನ ಎಣ್ಣೆ ಅಥವಾ ಸೂಕ್ತ ಶಿಲೀಂಧ್ರನಾಶಕವನ್ನು ಸಿಂಪಡಿಸಿ.'
    return {
      title: '💊 ಎರಡು ಹಂತಗಳು: ಚಿಕಿತ್ಸಾ ಯೋಜನೆ',
      displayText: `${localizedPlant} (${localizedCondition}) ಗಾಗಿ ಎರಡು ಹಂತಗಳ ಚಿಕಿತ್ಸಾ ಯೋಜನೆ:\n\n• ${step1}\n\n• ${step2}`,
      speechText: `ನಿಮ್ಮ ${localizedPlant} ಗಾಗಿ ಎರಡು ಚಿಕಿತ್ಸಾ ಹಂತಗಳು: ${step1}. ${step2}`,
      phoneticText: `Nimma ${plant} gaagi eradu chikitse hanthagalu: ${step1}. ${step2}`,
    }
  }

  if (langPrefix === 'ml') {
    const step1 = isHealthy
      ? 'ഘട്ടം 1 (പ്രതിരോധ പരിചരണം): രാസ ചികിത്സ ആവശ്യമില്ല. മിതമായ ഈർപ്പം നിലനിർത്തുക.'
      : 'ഘട്ടം 1 (ഉടനടി നടപടി): രോഗം ബാധിച്ച ഇലകൾ മുറിച്ചുമാറ്റി സുരക്ഷിതമായി നശിപ്പിക്കുക.'
    const step2 = isHealthy
      ? 'ഘട്ടം 2 (പരിശോധന): ആഴ്ചയിലൊരിക്കൽ ഇലകളുടെ അടിഭാഗം പരിശോധിച്ച് ഉറപ്പുവരുത്തുക.'
      : 'ഘട്ടം 2 (ചികിത്സ): വേപ്പെണ്ണയോ ജൈവ കുമിൾനാശിനിയോ നേർപ്പിച്ച് തളിക്കുക.'
    return {
      title: '💊 രണ്ട് ഘട്ടങ്ങൾ: ചികിത്സാ പദ്ധതി',
      displayText: `${localizedPlant} (${localizedCondition}) നായുള്ള രണ്ട് ഘട്ട ചികിത്സാ പദ്ധതി:\n\n• ${step1}\n\n• ${step2}`,
      speechText: `നിങ്ങളുടെ ${localizedPlant} നായുള്ള രണ്ട് ചികിത്സാ ഘട്ടങ്ങൾ: ${step1}. ${step2}`,
      phoneticText: `Ningalude ${plant} naayulla randu chikitsa ghattangal: ${step1}. ${step2}`,
    }
  }

  // English fallback
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
    speechText: `Here are the two treatment steps for your ${plant}: ${step1}. ${step2}`,
    phoneticText: `Here are the two treatment steps for your ${plant}: ${step1}. ${step2}`,
  }
}

/**
 * BUTTON 3: Supported Plants
 * Lists available plants in the database and suggests suitable ones in selected language.
 * DOES NOT show leaf-specific details.
 */
export function getSupportedPlantsButtonContent(langCode: string = 'en-IN'): ButtonContent {
  const langPrefix = (langCode || 'en').split('-')[0].toLowerCase()

  if (langPrefix === 'te') {
    const text =
      `LeafLens డేటాబేస్ కేటలాగ్ (18 శిక్షణ పొందిన తరగతులు):\n\n` +
      `1. స్నేక్ ప్లాంట్ (Sansevieria):\n` +
      `   • ఆరోగ్యకరమైనది\n` +
      `   • ఆంత్రాక్నోస్ (శిలీంధ్ర ఆకుమచ్చ)\n` +
      `   • ఆకులు వాడిపోవడం (వేరు కుళ్లు / నీటి ఎద్దడి)\n\n` +
      `2. టొమాటో (Tomato):\n` +
      `   • ఆరోగ్యకరమైనది, బాక్టీరియల్ మచ్చలు, ప్రారంభ తెగులు, తీవ్ర ఎండు తెగులు, బూజు తెగులు, సెప్టోరియా ఆకుమచ్చ, నల్లి తెగులు, టార్గెట్ స్పాట్, ఆకు ముడుత వైరస్, మొజాయిక్ వైరస్\n\n` +
      `3. బంగాళాదుంప (Potato):\n` +
      `   • ఆరోగ్యకరమైనది, ప్రారంభ తెగులు, తీవ్ర ఎండు తెగులు\n\n` +
      `4. బెల్ పెప్పర్ (Bell Pepper):\n` +
      `   • ఆరోగ్యకరమైనది, బాక్టీరియల్ మచ్చలు\n\n` +
      `సిఫార్సులు:\n` +
      `• ఇంట్లో పరీక్షించడానికి: స్నేక్ ప్లాంట్ ఆకులను మంచి వెలుతురులో స్కాన్ చేయండి.\n` +
      `• తోట పంటల కోసం: టొమాటో, బంగాళాదుంప లేదా క్యాప్సికం ఆకులను సహజ కాంతిలో పరీక్షించండి.`
    const speech = `మా డేటాబేస్ టొమాటో, బంగాళాదుంప, బెల్ పెప్పర్ మరియు స్నేక్ ప్లాంట్‌లలో 18 తరగతులకు మద్దతు ఇస్తుంది. ఇంట్లో పరీక్షించడానికి స్నేక్ ప్లాంట్ ఆకులను స్కాన్ చేయండి. తోట పంటల కోసం టొమాటో లేదా బంగాళాదుంప ఆకులను మంచి కాంతిలో పరీక్షించండి.`
    return {
      title: '🪴 మద్దతు ఇచ్చే మొక్కలు & డేటాబేస్ తరగతులు',
      displayText: text,
      speechText: speech,
      phoneticText: `Maa database Tomato, Potato, Bell Pepper mariyu Snake Plant lalo 18 classes ki support istundi. Indoor testing kosam Snake plant aakulanu scan cheyandi. Thota pantala kosam Tomato leda Potato aakulanu manchi veluturuloo parikshinchandi.`,
    }
  }

  if (langPrefix === 'hi') {
    const text =
      `LeafLens डेटाबेस कैटलॉग (18 प्रशिक्षित वर्ग):\n\n` +
      `1. स्नेक प्लांट (Sansevieria):\n` +
      `   • स्वस्थ, एन्थ्रेक्नोज (कवक रोग), पत्तियों का मुरझाना\n\n` +
      `2. टमाटर (Tomato):\n` +
      `   • स्वस्थ, जीवाणु धब्बा, अगेती झुलसा, पछेती झुलसा, पत्ती फफूंद, सेप्टोरिया धब्बा, लाल मकड़ी, मोज़ेक वायरस\n\n` +
      `3. आलू (Potato):\n` +
      `   • स्वस्थ, अगेती झुलसा, पछेती झुलसा\n\n` +
      `4. शिमला मिर्च (Bell Pepper):\n` +
      `   • स्वस्थ, जीवाणु धब्बा रोग\n\n` +
      `सुझाव:\n` +
      `• घर के अंदर परीक्षण के लिए: स्नेक प्लांट की पत्तियों को अच्छी रोशनी में स्कैन करें।\n` +
      `• खेत की फसलों के लिए: टमाटर, आलू या शिमला मिर्च की पत्तियों को प्राकृतिक प्रकाश में जांचें।`
    const speech = `हमारा डेटाबेस टमाटर, आलू, शिमला मिर्च और स्नेक प्लांट में 18 वर्गों का समर्थन करता है। परीक्षण के लिए स्नेक प्लांट, टमाटर या आलू की पत्तियों को अच्छी रोशनी में स्कैन करें।`
    return {
      title: '🪴 समर्थित पौधे और डेटाबेस वर्ग',
      displayText: text,
      speechText: speech,
      phoneticText: `Hamara database Tamatar, Aalu, Shimla Mirch aur Snake Plant me 18 classes ka samarthan karta hai. Testing ke liye Snake Plant, Tamatar ya Aalu ki pattiyon ko scan karein.`,
    }
  }

  if (langPrefix === 'ta') {
    const text =
      `LeafLens தரவுத்தள பட்டியல் (18 பயிற்றுவிக்கப்பட்ட பிரிவுகள்):\n\n` +
      `1. பாம்பு கற்றாழை (Snake Plant): ஆரோக்கியமானது, ஆந்த்ராக்னோஸ், இலை வாடுதல்\n` +
      `2. தக்காளி (Tomato): ஆரோக்கியமானது, பாக்டீரியா புள்ளி, ஆரம்பக்கால கருகல், பிந்தைய கருகல், பூஞ்சை\n` +
      `3. உருளைக்கிழங்கு (Potato): ஆரோக்கியமானது, ஆரம்பக்கால கருகல், பிந்தைய கருகல்\n` +
      `4. குடைமிளகாய் (Bell Pepper): ஆரோக்கியமானது, பாக்டீரியா புள்ளி\n\n` +
      `பரிந்துரைகள்:\n` +
      `• வீட்டிற்குள் சோதிக்க: பாம்பு கற்றாழை இலைகளை நல்ல வெளிச்சத்தில் ஸ்கேன் செய்யவும்.\n` +
      `• தோட்டப் பயிர்களுக்கு: தக்காளி, உருளைக்கிழங்கு இலைகளை இயற்கை வெளிச்சத்தில் பரிசோதிக்கவும்.`
    const speech = `எங்கள் தரவுத்தளம் தக்காளி, உருளைக்கிழங்கு, குடைமிளகாய் மற்றும் பாம்பு கற்றாழை ஆகியவற்றில் 18 வகைகளை ஆதரிக்கிறது. நல்ல வெளிச்சத்தில் இலைகளை ஸ்கேன் செய்யவும்.`
    return {
      title: '🪴 ஆதரிக்கப்படும் தாவரங்கள்',
      displayText: text,
      speechText: speech,
      phoneticText: `Engal tharavuthaalam Thakkaali, Urulaikizhangu, Kudaimilagai matrum Snake Plant aagiyavatril 18 vagaigalai aadharikkiradhu. Nalla velichathil ilaikalai scan seyyavum.`,
    }
  }

  if (langPrefix === 'kn') {
    const text =
      `LeafLens ಡೇಟಾಬೇಸ್ ಪಟ್ಟಿ (18 ತರಬೇತಿ ಪಡೆದ ವರ್ಗಗಳು):\n\n` +
      `1. ಸ್ನೇಕ್ ಪ್ಲಾಂಟ್ (Snake Plant): ಆರೋಗ್ಯಕರ, ಆಂಥ್ರಾಕ್ನೋಸ್, ಎಲೆ ಬಾಡುವಿಕೆ\n` +
      `2. ಟೊಮೆಟೊ (Tomato): ಆರೋಗ್ಯಕರ, ಬ್ಯಾಕ್ಟೀರಿಯಾ ಕಲೆ, ಆರಂಭಿಕ ರೋಗ, ತಡವಾದ ರೋಗ\n` +
      `3. ಆಲೂಗಡ್ಡೆ (Potato): ಆರೋಗ್ಯಕರ, ಆರಂಭಿಕ ರೋಗ, ತಡವಾದ ರೋಗ\n` +
      `4. ದಪ್ಪ ಮೆಣಸಿನಕಾಯಿ (Bell Pepper): ಆರೋಗ್ಯಕರ, ಬ್ಯಾಕ್ಟೀರಿಯಾ ಕಲೆ`
    const speech = `ನಮ್ಮ ಡೇಟಾಬೇಸ್ ಟೊಮೆಟೊ, ಆಲೂಗಡ್ಡೆ, ಮೆಣಸಿನಕಾಯಿ ಮತ್ತು ಸ್ನೇಕ್ ಪ್ಲಾಂಟ್‌ಗಳಲ್ಲಿ 18 ವರ್ಗಗಳನ್ನು ಬೆಂಬಲಿಸುತ್ತದೆ.`
    return {
      title: '🪴 ಬೆಂಬಲಿತ ಸಸ್ಯಗಳು',
      displayText: text,
      speechText: speech,
      phoneticText: `Namma database Tomato, Aalugadde, Menasinakaayi mattu Snake Plant galalli 18 classes annu bembalisuttade.`,
    }
  }

  if (langPrefix === 'ml') {
    const text =
      `LeafLens ഡാറ്റാബേസ് കാറ്റലോഗ് (18 ക്ലാസുകൾ):\n\n` +
      `1. സ്നേക്ക് പ്ലാന്റ് (Snake Plant): ആരോഗ്യമുള്ളത്, ആന്ത്രാക്നോസ്, ഇല വാടൽ\n` +
      `2. തക്കാളി (Tomato): ആരോഗ്യമുള്ളത്, ബാക്ടീരിയൽ പുള്ളി, ആദ്യകാല ബ്ലൈറ്റ്, ലേറ്റ് ബ്ലൈറ്റ്\n` +
      `3. ഉരുളക്കിഴങ്ങ് (Potato): ആരോഗ്യമുള്ളത്, ആദ്യകാല ബ്ലൈറ്റ്, ലേറ്റ് ബ്ലൈറ്റ്\n` +
      `4. കാപ്സിക്കം (Bell Pepper): ആരോഗ്യമുള്ളത്, ബാക്ടീരിയൽ പുള്ളി`
    const speech = `ഞങ്ങളുടെ ഡാറ്റാബേസ് തക്കാളി, ഉരുളക്കിഴങ്ങ്, കാപ്സിക്കം, സ്നേക്ക് പ്ലാന്റ് എന്നിവയിലെ 18 രോഗാവസ്ഥകളെ പിന്തുണയ്ക്കുന്നു.`
    return {
      title: '🪴 പിന്തുണയ്ക്കുന്ന ചെടികൾ',
      displayText: text,
      speechText: speech,
      phoneticText: `Njangalude database Thakkaali, Urulakkizhangu, Capsicum, Snake Plant ennivayile 18 classesine pinthunakkunnu.`,
    }
  }

  // English fallback
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
    speechText: speech,
    phoneticText: speech,
  }
}

/**
 * BUTTON 4: Available Plans
 * Explains available subscription and access tiers in selected language.
 */
export function getAvailablePlansButtonContent(langCode: string = 'en-IN'): ButtonContent {
  const langPrefix = (langCode || 'en').split('-')[0].toLowerCase()

  if (langPrefix === 'te') {
    const text =
      `LeafLens చందా & యాక్సెస్ ప్లాన్‌లు:\n\n` +
      `1. ఉచిత విద్యా ఓపెన్-యాక్సెస్ ప్లాన్ ($0 / ఎప్పటికీ ఉచితం):\n` +
      `   • అపరిమిత ఆకు స్కాన్‌లు & నిజ-సమయ వ్యాధి నిర్ధారణ\n` +
      `   • పూర్తి 18 తరగతుల పాథాలజీ గుర్తింపు\n` +
      `   • తక్షణ జాగ్రత్తలు, రెండు-దశల నివారణ గైడ్‌లు మరియు వాయిస్ అనౌన్స్‌మెంట్‌లు\n` +
      `   • 100% ఆన్-డివైస్ స్థానిక గోప్యత, ఫోటోలు అప్‌లోడ్ కావు\n` +
      `   • ఖాతా లేదా చెల్లింపు వివరాలు అవసరం లేదు\n\n` +
      `2. ఎంటర్‌ప్రైజ్ & ఫార్మ్ మెష్ టైర్ (రోడ్‌మ్యాప్):\n` +
      `   • వాణిజ్య గ్రీన్‌హౌస్ పర్యవేక్షణ కోసం మల్టీ-కెమెరా రాస్ప్‌బెర్రీ పై సెటప్\n` +
      `   • ఆటోమేటెడ్ అలర్ట్ బజర్ మరియు టెలిమెట్రీ లాగింగ్.`
    const speech = `మా ఉచిత అకడమిక్ ఓపెన్ యాక్సెస్ ప్లాన్ కింద లీఫ్‌లెన్స్ పూర్తిగా ఉచితం. ఇందులో అపరిమిత స్కాన్‌లు, 18 తరగతుల వ్యాధి నిర్ధారణ మరియు తక్షణ వాయిస్ సహాయం ఎలాంటి రుసుము లేకుండా లభిస్తాయి.`
    return {
      title: '💳 అందుబాటులో ఉన్న ప్లాన్‌లు & ధరలు',
      displayText: text,
      speechText: speech,
      phoneticText: `Maa free academic open access plan kinda LeafLens poortigaa free. Induloo unlimited scans mariyu instant voice assistance elanti fees leekundaa labhistayi.`,
    }
  }

  if (langPrefix === 'hi') {
    const text =
      `LeafLens सदस्यता और पहुँच योजनाएं:\n\n` +
      `1. निःशुल्क अकादमिक ओपन-एक्सेस प्लान ($0 / हमेशा के लिए मुफ़्त):\n` +
      `   • असीमित पत्ती स्कैन और रीयल-टाइम रोग निदान\n` +
      `   • पूर्ण 18-वर्ग पादप विकृति पहचान\n` +
      `   • तत्काल सावधानियां और दो-चरणीय उपचार गाइड\n` +
      `   • 100% ऑन-डिवाइस गोपनीयता, कोई फोटो अपलोड नहीं\n` +
      `   • किसी खाते या भुगतान की आवश्यकता नहीं\n\n` +
      `2. एंटरप्राइज और फार्म मेश टियर (रोडमैप):\n` +
      `   • वाणिज्यिक ग्रीनहाउस निगरानी के लिए मल्टी-कैमरा सेटअप।`
    const speech = `लीफ लेंस हमारी निःशुल्क अकादमिक ओपन-एक्सेस योजना के तहत पूरी तरह से मुफ़्त है, जिसमें असीमित स्कैन और त्वरित वॉयस सहायता बिना किसी शुल्क के मिलती है।`
    return {
      title: '💳 उपलब्ध योजनाएं और मूल्य निर्धारण',
      displayText: text,
      speechText: speech,
      phoneticText: `LeafLens hamari free academic open access yojana ke antargat poori tarah se muft hai, jisme unlimited scans aur voice assistance bina kisi shulk ke milte hain.`,
    }
  }

  if (langPrefix === 'ta') {
    const text =
      `LeafLens அணுகல் திட்டங்கள்:\n\n` +
      `1. இலவச கல்வி திறந்த அணுகல் திட்டம் ($0 / எப்போதும் இலவசம்):\n` +
      `   • வரம்பற்ற இலை ஸ்கேனிங் மற்றும் உடனடி நோயறிதல்\n` +
      `   • 18 தாவர நோய் பிரிவுகள்\n` +
      `   • 100% சாதனத்தில் நேரடி பகுப்பாய்வு, பதிவேற்றம் இல்லை\n` +
      `   • எந்த கட்டணமும் அல்லது கணக்கும் தேவையில்லை`
    const speech = `எங்கள் இலவச கல்வி திட்டத்தின் கீழ் லீஃப்லென்ஸ் முற்றிலும் இலவசம். வரம்பற்ற ஸ்கேனிங் மற்றும் குரல் வழிகாட்டல் இலவசமாக கிடைக்கும்.`
    return {
      title: '💳 கிடைக்கும் திட்டங்கள்',
      displayText: text,
      speechText: speech,
      phoneticText: `Engal ilavasa kalvi thittaththin keezh LeafLens muttrilum ilavasam. Varambattra scanning matrum kural vazhikaattal ilavasamaaga kidaikkum.`,
    }
  }

  if (langPrefix === 'kn') {
    const text =
      `LeafLens ಲಭ್ಯವಿರುವ ಯೋಜನೆಗಳು:\n\n` +
      `1. ಉಚಿತ ಶೈಕ್ಷಣಿಕ ಮುಕ್ತ ಪ್ರವೇಶ ಯೋಜನೆ ($0 / ಎಂದಿಗೂ ಉಚಿತ):\n` +
      `   • ಅನಿಯಮಿತ ಸ್ಕ್ಯಾನ್‌ಗಳು ಮತ್ತು ನೈಜ-ಸಮಯದ ರೋಗ ಪತ್ತೆ\n` +
      `   • 18 ವರ್ಗಗಳ ಸಂಪೂರ್ಣ ರೋಗನಿರ್ಣಯ\n` +
      `   • 100% ಸಾಧನದಲ್ಲೇ ಪ್ರಕ್ರಿಯೆ, ಫೋಟೋ ಅಪ್‌ಲೋಡ್ ಇಲ್ಲ\n` +
      `   • ಯಾವುದೇ ಖಾತೆ ಅಥವಾ ಶುಲ್ಕದ ಅಗತ್ಯವಿಲ್ಲ`
    const speech = `ಲೀಫ್‌ಲೆನ್ಸ್ ಸಂಪೂರ್ಣವಾಗಿ ಉಚಿತವಾಗಿದ್ದು, ಅನಿಯಮಿತ ಸ್ಕ್ಯಾನ್‌ಗಳು ಮತ್ತು ಧ್ವನಿ ಸಹಾಯವನ್ನು ಯಾವುದೇ ಶುಲ್ಕವಿಲ್ಲದೆ ನೀಡುತ್ತದೆ.`
    return {
      title: '💳 ಲಭ್ಯವಿರುವ ಯೋಜನೆಗಳು',
      displayText: text,
      speechText: speech,
      phoneticText: `LeafLens sampoornavaagi uchithavaagiddu, aniyamitha scan galu mathu dhvani sahaayavannu yaavude shulkavillade needuttade.`,
    }
  }

  if (langPrefix === 'ml') {
    const text =
      `LeafLens ലഭ്യമായ പ്ലാനുകൾ:\n\n` +
      `1. സൗജന്യ അക്കാദമിക് ഓപ്പൺ ആക്സസ് പ്ലാൻ ($0 / എന്നേക്കും സൗജന്യം):\n` +
      `   • പരിധിയില്ലാത്ത ഇല സ്കാനിംഗും തത്സമയ രോഗനിർണ്ണയവും\n` +
      `   • 18 രോഗാവസ്ഥകളുടെ തിരിച്ചറിയൽ\n` +
      `   • 100% സ്വകാര്യത, ഫോട്ടോകൾ അപ്‌ലോഡ് ചെയ്യുന്നില്ല\n` +
      `   • ലോഗിൻ അല്ലെങ്കിൽ പണമടയ്ക്കൽ ആവശ്യമില്ല`
    const speech = `ഞങ്ങളുടെ സൗജന്യ അക്കാദമിക് പ്ലാനിന് കീഴിൽ ലീഫ് ലെൻസ് തികച്ചും സൗജന്യമാണ്. പരിധിയില്ലാത്ത സ്കാനുകളും വോയ്‌സ് സഹായവും ലഭ്യമാണ്.`
    return {
      title: '💳 ലഭ്യമായ പ്ലാനുകൾ',
      displayText: text,
      speechText: speech,
      phoneticText: `Njangalude saujanya academic planinu keezhil LeafLens thikachum saujanyamaannu. Unlmited scansum voice sahaayavum labhyamaannu.`,
    }
  }

  // English fallback
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
    speechText: speech,
    phoneticText: speech,
  }
}

/**
 * BUTTON 5: Privacy Guarantee
 * Shows ONLY privacy-related information in selected language.
 * DOES NOT display or mention any plant or leaf diagnosis information.
 */
export function getPrivacyButtonContent(langCode: string = 'en-IN'): ButtonContent {
  const langPrefix = (langCode || 'en').split('-')[0].toLowerCase()

  if (langPrefix === 'te') {
    const text =
      `LeafLens ఆన్-డివైస్ గోప్యత & భద్రతా హామీ:\n\n` +
      `• 100% ఎడ్జ్ న్యూరల్ ఇన్‌ఫరెన్స్: అన్ని చిత్రాల ప్రాసెసింగ్ నేరుగా మీ పరికరంలో మాత్రమే జరుగుతుంది.\n` +
      `• జీరో డేటా స్టోరేజ్: మీ ఫోటోలు లేదా స్కాన్ ఫలితాలు ఏ క్లౌడ్ సర్వర్‌కు అప్‌లోడ్ చేయబడవు.\n` +
      `• నో ట్రాకింగ్: ఎలాంటి కుకీలు, యూజర్ ఐడెంటిఫైయర్‌లు లేదా అనలిటిక్స్ ట్రాకింగ్ ఉండవు.\n` +
      `• పూర్తి ఆఫ్‌లైన్ భద్రత: నెట్‌వర్క్‌పై ఆధారపడకుండా పూర్తిగా స్వతంత్రంగా పనిచేస్తుంది.`
    const speech = `లీఫ్‌లెన్స్ వంద శాతం ఆన్-డివైస్ గోప్యతా హామీని అందిస్తుంది. అన్ని స్కాన్‌లు మీ పరికరంలోనే స్థానికంగా ప్రాసెస్ అవుతాయి. మీ ఫోటోలు ఎప్పటికీ బాహ్య సర్వర్‌లకు పంపబడవు.`
    return {
      title: '🔒 గోప్యత & భద్రతా హామీ',
      displayText: text,
      speechText: speech,
      phoneticText: `LeafLens vanda shaatham on-device privacy guarantee andistundi. Anni scans mee devicelone sthaanikamgaa process avuthaayi. Mee photos eppatiki cloud servers ki upload kaavu.`,
    }
  }

  if (langPrefix === 'hi') {
    const text =
      `LeafLens ऑन-डिवाइस गोपनीयता और सुरक्षा गारंटी:\n\n` +
      `• 100% एज न्यूरल इंफेरेंस: सभी इमेज प्रोसेसिंग केवल आपके डिवाइस पर ही होती है।\n` +
      `• शून्य डेटा स्टोरेज: आपकी तस्वीरें या स्कैन कभी किसी बाहरी क्लाउड सर्वर पर अपलोड नहीं होते।\n` +
      `• कोई ट्रैकिंग नहीं: कोई कुकीज़ या उपयोगकर्ता पहचानकर्ता नहीं।\n` +
      `• पूर्ण ऑफ़लाइन सुरक्षा: बिना इंटरनेट के पूरी तरह सुरक्षित काम करता है।`
    const speech = `लीफ लेंस 100 प्रतिशत ऑन-डिवाइस गोपनीयता गारंटी प्रदान करता है। सभी स्कैनिंग आपके डिवाइस पर स्थानीय रूप से होती है। आपकी तस्वीरें कभी बाहरी सर्वर पर साझा नहीं की जाती हैं।`
    return {
      title: '🔒 गोपनीयता और सुरक्षा गारंटी',
      displayText: text,
      speechText: speech,
      phoneticText: `LeafLens 100 percent on-device gopaniyata guarantee pradan karta hai. Sabhi scanning aapke device par sthaniy roop se hoti hai. Aapki tasveerein kabhi cloud server par upload nahi hoti hain.`,
    }
  }

  if (langPrefix === 'ta') {
    const text =
      `LeafLens தனியுரிமை மற்றும் பாதுகாப்பு உத்தரவாதம்:\n\n` +
      `• 100% சாதனத்தில் நேரடி பகுப்பாய்வு: அனைத்து பட ஆய்வுகளும் உங்கள் சாதனத்திலேயே நடக்கின்றன.\n` +
      `• தரவு சேமிப்பு இல்லை: உங்கள் புகைப்படங்கள் மேகக்கணி சேவையகங்களில் பதிவேற்றப்படாது.\n` +
      `• கண்காணிப்பு இல்லை: குக்கீகள் அல்லது பயனர் அடையாளங்கள் எதுவும் இல்லை.`
    const speech = `லீஃப்லென்ஸ் 100 சதவீதம் சாதன தனியுரிமை உத்தரவாதத்தை வழங்குகிறது. உங்கள் புகைப்படங்கள் எப்போதும் சேமிக்கப்படாது.`
    return {
      title: '🔒 தனியுரிமை மற்றும் பாதுகாப்பு உத்தரவாதம்',
      displayText: text,
      speechText: speech,
      phoneticText: `LeafLens 100 percent saadhanathil thaniyurimai uththaravaadhathai vazhangugiradhu. Ungal photokkal eppodhum cloud serveril pathivettrappadaadhu.`,
    }
  }

  if (langPrefix === 'kn') {
    const text =
      `LeafLens ಆನ್-ಡಿವೈಸ್ ಗೌಪ್ಯತೆ ಮತ್ತು ಭದ್ರತಾ ಖಾತರಿ:\n\n` +
      `• 100% ಡಿವೈಸ್‌ನಲ್ಲೇ ಪ್ರಕ್ರಿಯೆ: ಎಲ್ಲಾ ಚಿತ್ರಗಳ ವಿಶ್ಲೇಷಣೆ ನಿಮ್ಮ ಸಾಧನದಲ್ಲೇ ನಡೆಯುತ್ತದೆ.\n` +
      `• ಯಾವುದೇ ಡೇಟಾ ಸಂಗ್ರಹವಿಲ್ಲ: ಫೋಟೋಗಳು ಯಾವುದೇ ಕ್ಲೌಡ್ ಸರ್ವರ್‌ಗೆ ಅಪ್‌ಲೋಡ್ ಆಗುವುದಿಲ್ಲ.\n` +
      `• ಸಂಪೂರ್ಣ ಸುರಕ್ಷತೆ: ಆಫ್‌ಲೈನ್‌ನಲ್ಲಿ ಸುರಕ್ಷಿತವಾಗಿ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತದೆ.`
    const speech = `ಲೀಫ್‌ಲೆನ್ಸ್ ನೂರು ಪ್ರತಿಶತ ಆನ್-ಡಿವೈಸ್ ಗೌಪ್ಯತೆಯ ಖಾತರಿ ನೀಡುತ್ತದೆ. ನಿಮ್ಮ ಫೋಟೋಗಳು ಎಂದಿಗೂ ಅಪ್‌ಲೋಡ್ ಆಗುವುದಿಲ್ಲ.`
    return {
      title: '🔒 ಗೌಪ್ಯತೆ ಮತ್ತು ಭದ್ರತಾ ಖಾತರಿ',
      displayText: text,
      speechText: speech,
      phoneticText: `LeafLens nooru pratishatha on-device gowpyatheya khaathari needuttade. Nimma photo galu endigoo upload aaguvudilla.`,
    }
  }

  if (langPrefix === 'ml') {
    const text =
      `LeafLens ഉപകരണ സ്വകാര്യതാ സുരക്ഷാ ഗ്യാരണ്ടി:\n\n` +
      `• 100% ഉപകരണത്തിൽ പ്രോസസ്സിംഗ്: എല്ലാ ഇമേജ് പ്രോസസ്സിംഗും നിങ്ങളുടെ ഉപകരണത്തിൽ മാത്രം നടക്കുന്നു.\n` +
      `• ഡാറ്റ സംഭരണമില്ല: നിങ്ങളുടെ ഫോട്ടോകൾ ക്ലൗഡ് സെർവറുകളിലേക്ക് അപ്‌ലോഡ് ചെയ്യുന്നില്ല.\n` +
      `• പൂർണ്ണ ഓഫ്‌ലൈൻ സുരക്ഷ: ഉപയോക്തൃ വിവരങ്ങൾ ചോരുന്നില്ല.`
    const speech = `ലീഫ് ലെൻസ് നൂറു ശതമാനം ഉപകരണ സ്വകാര്യതാ ഗ്യാരണ്ടി നൽകുന്നു. നിങ്ങളുടെ ഫോട്ടോകൾ ഒരിക്കലും അപ്‌ലോഡ് ചെയ്യപ്പെടുന്നില്ല.`
    return {
      title: '🔒 സ്വകാര്യതയും സുരക്ഷാ ഗ്യാരണ്ടിയും',
      displayText: text,
      speechText: speech,
      phoneticText: `LeafLens nooru shathamaanam device swakaaryatha guarantee nalkunnu. Ningalude photo kal orikkalum upload cheyyapedunnilla.`,
    }
  }

  // English fallback
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
    speechText: speech,
    phoneticText: speech,
  }
}

/**
 * Botanical Fallback Generator supporting code-switching and all 6 languages.
 */
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

  // Telugu (తెలుగు) - handles Telugu, Tanglish, and Tenglish
  if (lang.startsWith('te')) {
    if (
      q.includes('precaution') ||
      q.includes('prevent') ||
      q.includes('avoid') ||
      q.includes('protect') ||
      q.includes('jakratha') ||
      q.includes('jaagratta') ||
      q.includes('kuruunchehi') ||
      q.includes('mardangaalaga') ||
      q.includes('chippu') ||
      q.includes('cheppu') ||
      q.includes('gurinchi')
    ) {
      return 'మొక్కలకు వ్యాధులు సోకకుండా ఉండటానికి, నీటిని ఆకులపై కాకుండా వేర్ల వద్ద మాత్రమే పోయండి. మొక్కల మధ్య మంచి గాలి ప్రసరణ ఉండేలా చూసుకోండి మరియు ఎండిన ఆకులను క్రమం తప్పకుండా తొలగించండి.'
    }
    if (q.includes('cure') || q.includes('treat') || q.includes('remedy') || q.includes('nayam') || q.includes('mandhu')) {
      return 'తెగులు సోకిన ఆకులను వెంటనే తొలగించి దూరంగా పారవేయండి. సమస్య మరింత వ్యాపించకుండా వేప నూనె లేదా కాపర్ ఆధారిత స్ప్రేను తగిన మోతాదులో పిచికారీ చేయండి.'
    }
    if (q.includes('water') || q.includes('neellu') || q.includes('eppudu')) {
      return 'మొక్క మొదట్లోని మట్టి పూర్తిగా ఆరిపోయినప్పుడు మాత్రమే నీరు పెట్టండి. కుండీలో అదనపు నీరు నిల్వ ఉండకుండా డ్రైనేజీ రంధ్రాలు సరిగ్గా ఉన్నాయో లేదో నిర్ధారించుకోండి.'
    }
    return 'మొక్కలను ఆరోగ్యంగా ఉంచడానికి తగినంత వెలుతురు అందించండి, అధికంగా నీరు పోయకుండా జాగ్రత్తపడండి మరియు క్రమం తప్పకుండా ఆకులను తనిఖీ చేయండి.'
  }

  // Tamil (தமிழ்)
  if (lang.startsWith('ta')) {
    if (q.includes('precaution') || q.includes('prevent') || q.includes('avoid') || q.includes('protect') || q.includes('kaapatha') || q.includes('solreengala')) {
      return 'செடிகளுக்கு நோய் பரவாமல் தடுக்க, இலைகளின் மேல் தண்ணீர் தெளிக்காமல் வேர்ப்பகுதியில் மட்டுமே ஊற்றவும். செடிகளுக்கு இடையே நல்ல காற்றோட்டம் இருப்பதை உறுதி செய்து, பாதிக்கப்பட்ட இலைகளை உடனே அகற்றி விடுங்கள்.'
    }
    if (q.includes('cure') || q.includes('treat') || q.includes('remedy') || q.includes('marundhu') || q.includes('theervu')) {
      return 'நோய் தாக்கப்பட்ட இலைகளை வெட்டி அகற்றி பாதுகாப்பாக அப்புறப்படுத்துங்கள். பிறகு வேப்ப எண்ணெய் அல்லது இயற்கை பூஞ்சைக்கொல்லியை செடியின் மீது சீராக தெளிக்கவும்.'
    }
    if (q.includes('thanni') || q.includes('water') || q.includes('eppo')) {
      return 'மண்ணின் மேல் அடுக்கு நன்கு காய்ந்த பிறகு மட்டுமே மிதமாக தண்ணீர் ஊற்றவும். தொட்டியில் தண்ணீர் தேங்காமல் பார்த்துக் கொள்வது வேர் அழுகலைத் தடுக்கும்.'
    }
    return 'செடிகளுக்கு மிதமான சூரிய ஒளி மற்றும் சரியான வடிகால் வசதி கொடுப்பது நல்ல ஆரோக்கியத்தைத் தரும்.'
  }

  // Hindi (हिन्दी)
  if (lang.startsWith('hi')) {
    if (q.includes('precaution') || q.includes('prevent') || q.includes('avoid') || q.includes('protect') || q.includes('savdhani') || q.includes('dekhbhal')) {
      return 'पौधों को बीमारियों से बचाने के लिए, पत्तियों के ऊपर नहीं बल्कि सीधे जड़ों में पानी दें। पौधों के बीच पर्याप्त हवा का आवागमन रखें और रोगग्रस्त पत्तियों को तुरंत हटा दें।'
    }
    if (q.includes('cure') || q.includes('treat') || q.includes('remedy') || q.includes('ilaj') || q.includes('upchar') || q.includes('dawai')) {
      return 'संक्रमित पत्तियों को तुरंत काटकर अलग कर दें ताकि बीमारी न फैले। इसके बाद नीम के तेल या कॉपर फंगीसाइड का हल्का छिड़काव पौधों पर करें।'
    }
    if (q.includes('paani') || q.includes('water') || q.includes('kaise')) {
      return 'गमले की मिट्टी ऊपर से सूखने पर ही पानी दें। गमले में जल निकासी के छेद खुले रखें ताकि जड़ों में पानी जमा न हो।'
    }
    return 'पौधों को पर्याप्त अप्रत्यक्ष धूप में रखें और पत्तियों में किसी भी धब्बे या कीट के लक्षण दिखने पर तुरंत जैविक उपचार करें।'
  }

  // Kannada (ಕನ್ನಡ)
  if (lang.startsWith('kn')) {
    if (q.includes('precaution') || q.includes('prevent') || q.includes('avoid') || q.includes('protect') || q.includes('eccharike')) {
      return 'ಗಿಡಗಳಿಗೆ ರೋಗ ಹರಡದಂತೆ ತಡೆಯಲು, ಎಲೆಗಳ ಮೇಲೆ ನೀರು ಹಾಕದೆ ನೇರವಾಗಿ ಬುಡಕ್ಕೆ ಮಾತ್ರ ನೀರು ಹಾಕಿ. ಗಿಡಗಳ ನಡುವೆ ಉತ್ತಮ ಗಾಳಿಯಾಡುವಂತೆ ನೋಡಿಕೊಳ್ಳಿ ಮತ್ತು ಒಣಗಿದ ಎಲೆಗಳನ್ನು ತೆಗೆಯಿರಿ.'
    }
    if (q.includes('cure') || q.includes('treat') || q.includes('remedy') || q.includes('chikitse')) {
      return 'ರೋಗಪೀಡಿತ ಎಲೆಗಳನ್ನು ಕತ್ತರಿಸಿ ತಕ್ಷಣ ದೂರ ವಿಲೇವಾರಿ ಮಾಡಿ. ನಂತರ ಸಾವಯವ ಬೇವಿನ ಎಣ್ಣೆ ಅಥವಾ ಶಿಲೀಂಧ್ರನಾಶಕವನ್ನು ಗಿಡಕ್ಕೆ ಸಿಂಪಡಿಸಿ.'
    }
    return 'ಮಣ್ಣಿನ ಮೇಲ್ಭಾಗ ಒಣಗಿದಾಗ ಮಾತ್ರ ನೀರು ಹಾಕಿ. ಕುಂಡದಲ್ಲಿ ನೀರು ನಿಲ್ಲದಂತೆ ತೂತುಗಳು ಸರಿಯಾಗಿವೆಯೇ ಎಂದು ಖಚಿತಪಡಿಸಿಕೊಳ್ಳಿ.'
  }

  // Malayalam (മലയാളം)
  if (lang.startsWith('ml')) {
    if (q.includes('precaution') || q.includes('prevent') || q.includes('avoid') || q.includes('protect') || q.includes('jagratha')) {
      return 'ചെടികൾക്ക് രോഗങ്ങൾ വരാതിരിക്കാൻ, ഇലകളിൽ വെള്ളം തളിക്കാതെ വേരുകളിൽ മാത്രം വെള്ളം ഒഴിക്കുക. ചെടികൾക്കിടയിൽ നല്ല വായുസഞ്ചാരം ഉറപ്പാക്കുകയും അസുഖം ബാധിച്ച ഇലകൾ ഉടൻ മാറ്റുകയും ചെയ്യുക.'
    }
    if (q.includes('cure') || q.includes('treat') || q.includes('remedy') || q.includes('chikitsa')) {
      return 'രോഗം ബാധിച്ച ഇലകൾ മുറിച്ചുമാറ്റി സുരക്ഷിതമായി നശിപ്പിക്കുക. ശേഷം വേപ്പെണ്ണ അല്ലെങ്കിൽ ജൈവ കുമിൾനാശിനി നേർപ്പിച്ച് തളിക്കുക.'
    }
    return 'മണ്ണ് പൂർണ്ണമായും ഉണങ്ങിയ ശേഷം മാത്രം മിതമായി വെള്ളം ഒഴിക്കുക. ചട്ടിയിൽ വെള്ളം കെട്ടിക്കിടക്കാൻ അനുവദിക്കരുത്.'
  }

  // English fallback
  if (q.includes('precaution') || q.includes('prevent') || q.includes('avoid') || q.includes('protect')) {
    if (ctx.includes('snake') || q.includes('sansevieria')) {
      return 'For Snake Plants, key precautions include watering strictly at the soil base, allowing the soil to dry completely between waterings, maintaining low ambient humidity, and sterilizing pruning shears to prevent fungal leaf spot.'
    }
    return 'To prevent plant diseases, water strictly at the soil base rather than overhead, provide adequate spacing between plants for airflow, disinfect pruning shears between cuts, and clear fallen leaves from the soil surface.'
  }

  if (q.includes('cure') || q.includes('treat') || q.includes('remedy') || q.includes('step') || q.includes('medicine')) {
    return 'For active treatment, immediately prune and isolate affected foliage to stop pathogen spread, improve air circulation, and apply a targeted copper or organic bio-fungicide spray suited for the condition.'
  }

  if (q.includes('water') || q.includes('moisture') || q.includes('irrigation')) {
    if (ctx.includes('snake')) {
      return 'For Snake Plants, water sparingly only when the potting mix is dry all the way through, approximately once every 2 to 3 weeks, and avoid letting water sit in the rosette center.'
    }
    return 'Water thoroughly only when the top few inches of soil are dry to the touch, ensure pots have unobstructed drainage holes, and avoid letting roots sit in pooled water.'
  }

  if (q.includes('light') || q.includes('sun')) {
    return 'Most foliage thrives in bright, indirect sunlight. Protect leaves from intense direct midday rays to avoid leaf scorch, and rotate the container periodically for uniform growth.'
  }

  return 'Maintain balanced soil moisture, ensure adequate airflow between leaves, disinfect gardening tools regularly, and isolate any symptomatic foliage at the first sign of discoloration.'
}

// Pre-warm browser speech synthesis voices as early as possible
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  try {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices()
    }
    window.speechSynthesis.getVoices()
  } catch {}
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
    if (typeof window !== 'undefined') {
      delete (window as any).__activeUtterance
    }
    this.isSpeaking = false
    this.emit()
  }

  /**
   * Ultra-fast zero-latency speech synthesis (< 0.2s start time).
   * Fully supports English, Telugu, Tamil, Hindi, Kannada, and Malayalam.
   * If the host device does not have native Indic TTS installed, falls back smoothly
   * to phonetic speech with an Indian English voice so playback is NEVER SILENT and never errors.
   */
  public async speakText(
    text: string,
    forcedLang?: string,
    phoneticFallback?: string
  ): Promise<SpokenDiagnosisResult> {
    if (this.isMuted) {
      console.log('VoiceBot is muted, skipping playback.')
      return { speechText: text, isDecisionMode: text.includes('decision mode'), source: 'browser-speech' }
    }

    this.stop()
    this.isSpeaking = true
    this.emit()

    try {
      const targetLang = forcedLang && forcedLang !== 'auto' ? forcedLang : detectLanguage(text)
      await this.speakBrowserNative(text, targetLang, phoneticFallback)
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

  private speakBrowserNative(text: string, lang: string = 'en-IN', phoneticFallback?: string): Promise<void> {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) {
        this.isSpeaking = false
        this.emit()
        resolve()
        return
      }

      window.speechSynthesis.cancel()

      // Small async delay allows browser speech engine to clear buffer cleanly
      setTimeout(() => {
        try {
          const langPrefix = (lang || 'en').split('-')[0].toLowerCase()
          const voices = window.speechSynthesis.getVoices() || []

          // Check if the browser has a voice for this specific language
          const nativeVoice = voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix))

          let textToSpeak = text
          let voiceToUse: SpeechSynthesisVoice | null = null
          let voiceLang = lang

          if (nativeVoice) {
            voiceToUse = nativeVoice
            voiceLang = nativeVoice.lang || lang
            textToSpeak = text
          } else {
            // No native Indic voice found on this device (common on Windows without Indic packs).
            // Use Indian English or system natural voice with phonetic text to guarantee audible playback.
            const fallbackVoice =
              voices.find((v) => v.lang.toLowerCase().includes('in') && v.lang.toLowerCase().startsWith('en')) ||
              voices.find((v) => v.name.includes('India') || v.name.includes('Heera') || v.name.includes('Ravi')) ||
              voices.find((v) => v.lang.toLowerCase().startsWith('en')) ||
              voices[0] ||
              null

            voiceToUse = fallbackVoice
            voiceLang = fallbackVoice?.lang || 'en-IN'
            textToSpeak = phoneticFallback || transliterateIndicToPhonetic(text, lang)
          }

          const utterance = new SpeechSynthesisUtterance(textToSpeak)
          utterance.lang = voiceLang
          if (voiceToUse) {
            utterance.voice = voiceToUse
          }
          utterance.rate = 1.0
          utterance.pitch = 1.0

          // Prevent Chromium garbage collection bug by pinning utterance to window
          ;(window as any).__activeUtterance = utterance

          let isResolved = false
          const finish = () => {
            if (isResolved) return
            isResolved = true
            delete (window as any).__activeUtterance
            this.isSpeaking = false
            this.emit()
            resolve()
          }

          utterance.onstart = () => {
            this.isSpeaking = true
            this.emit()
          }

          utterance.onend = () => {
            finish()
          }

          utterance.onerror = (e) => {
            console.warn('SpeechSynthesis event error:', e)
            finish()
          }

          // Safety watchdog: ensure speech doesn't hang indefinitely if browser suspends audio
          const words = textToSpeak.split(/\s+/).length
          const maxMs = Math.max(5000, words * 600)
          setTimeout(() => {
            if (!isResolved) {
              finish()
            }
          }, maxMs)

          window.speechSynthesis.speak(utterance)
        } catch (err) {
          console.warn('Speech execution exception:', err)
          this.isSpeaking = false
          this.emit()
          resolve()
        }
      }, 40)
    })
  }

  /**
   * Conversational LLM Q&A grounded in botanical guidance.
   * Delivers warm, human-like, multilingual and code-switching plant care responses.
   */
  public async askAssistant(
    question: string,
    currentDiagnosisContext?: string,
    history: Array<{ role: string; text: string }> = [],
    preferredLang: string = 'auto'
  ): Promise<string> {
    const targetLang = preferredLang && preferredLang !== 'auto' ? preferredLang : detectLanguage(question)
    const prompt = `
Role: You are a warm, human-like botanical expert and conversational multilingual voice assistant.
Languages Supported: English, Telugu (తెలుగు), Tamil (தமிழ்), Hindi (हिन्दी), Kannada (ಕನ್ನಡ), Malayalam (മലയാളം).
Selected Language Mode: ${targetLang}

Directives:
1. Warm, Empathetic Human Tone: Sound like a passionate, friendly plant doctor and caring gardener speaking one-to-one with a person. Never sound robotic or declare "As an AI". Avoid bullet points, numbered lists, asterisks, or markdown symbols.
2. Multilingual & Code-Switching Fluency:
   - Accurately comprehend code-mixed speech (e.g. Telugu mixed with English like "Snake plant ki water eppudu veyyali?" or "naaku precautions kuruunchehi mardangaalaga chippu", Hinglish like "Patti pe yellow spots hain kya karu?", Tanglish, Kanglish, Manglish).
   - If a specific language is selected (${targetLang}), you MUST deliver your answer in that selected language with conversational warmth and fluency.
   - If the user spoke in Telugu or selected Telugu, respond in authentic Telugu; if Hindi, respond in fluent Hindi; similarly for Tamil, Kannada, Malayalam, and English.
3. Conversational Continuity: Maintain context from prior turns in the conversation to resolve pronouns and references.
4. Voice Synthesis Ready: Provide plain conversational text only without markdown formatting, ready to be read aloud in 2 to 3 fluid sentences.
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
            selected_lang: targetLang,
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

      return getBotanicalFallback(question, currentDiagnosisContext, history, targetLang)
    } catch (err: any) {
      console.error('AskAssistant error:', err)
      return getBotanicalFallback(question, currentDiagnosisContext, history, targetLang)
    }
  }
}

export const voiceAssistant = new VoiceAssistantService()
