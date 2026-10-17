/**
 * LeafLens Voice Assistant Service
 * Powered by Google Gemini 3.8 Flash TTS & Gemini 3.8 Flash LLM
 * 
 * Delivers spoken diagnosis for Decision Mode (diseased) and Healthy Mode.
 * Strictly adheres to required verbatim prompt in Decision Mode.
 * Provides full grounding in website content (plans, dataset, pathology, architecture).
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

// Complete LeafLens Website Knowledge Base for LLM Q&A
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
 * Generates the authoritative spoken transcript matching textual output.
 * For decision mode, includes the EXACT verbatim prompt required.
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
  const conditionName = result.condition || 'Condition'
  const confidencePct = Math.round((result.confidence || 0.95) * 100)

  // 1. Announce diagnosis exactly as text does
  let speech = `Diagnosis: ${plantName}, ${conditionName}, with ${confidencePct} percent confidence.`

  if (!isHealthy) {
    // 2. Exact verbatim prompt required for decision mode
    speech += ` The leaf is in decision mode, and these are the precautions you can take to avoid this disease in the future. If you follow these precautions, the plant will no longer be at risk.`

    // Look up disease recommendations if not provided in result
    const recKey = result.class_name || ''
    const rec = DISEASE_RECOMMENDATIONS[recKey]
    const precautions = result.precautions || rec?.precautions || []
    const cures = result.cure || rec?.cure || []

    if (precautions.length > 0) {
      speech += ` Here are the recommended precautions:`
      precautions.forEach((p, idx) => {
        speech += ` Precaution ${idx + 1}: ${p}`
      })
    }

    if (cures.length > 0) {
      speech += ` Here are the recommended cures and treatment steps for your plant:`
      cures.forEach((c, idx) => {
        speech += ` Step ${idx + 1}: ${c}`
      })
    }

    return { text: speech, isDecisionMode: true }
  } else {
    speech += ` The leaf is healthy and in great condition! No disease was detected.`

    const recKey = result.class_name || ''
    const rec = DISEASE_RECOMMENDATIONS[recKey]
    const precautions = result.precautions || rec?.precautions || []

    if (precautions.length > 0) {
      speech += ` Here are routine maintenance tips to keep your plant thriving:`
      precautions.forEach((p, idx) => {
        speech += ` Tip ${idx + 1}: ${p}`
      })
    }

    return { text: speech, isDecisionMode: false }
  }
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
   * Synthesize and play audio via Gemini 3.8 Flash TTS, falling back to Web Speech API
   */
  public async speakText(text: string): Promise<SpokenDiagnosisResult> {
    if (this.isMuted) {
      console.log('VoiceBot is muted, skipping playback.')
      return { speechText: text, isDecisionMode: text.includes('decision mode'), source: 'gemini-tts' }
    }

    this.stop()
    this.isSpeaking = true
    this.emit()

    try {
      // 1. Try Gemini 3.8 Flash TTS via backend endpoint or direct REST
      let audioBase64: string | null = null

      try {
        // Try local or deployed /api/tts endpoint first
        const ttsResp = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            voice: 'Kore',
            style: 'clear, professional, caring agricultural specialist',
          }),
        })

        if (ttsResp.ok) {
          const ttsData = await ttsResp.json()
          if (ttsData.audio_base64) {
            audioBase64 = ttsData.audio_base64
          }
        }
      } catch (err) {
        console.warn('Backend /api/tts not reached, trying direct Gemini interactions endpoint...', err)
      }

      // If backend was not reached, call Gemini REST API directly
      if (!audioBase64 && GEMINI_API_KEY) {
        try {
          const directResp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/interactions?key=${GEMINI_API_KEY}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: 'gemini-3.8-flash-tts',
                input: [
                  {
                    type: 'user_input',
                    content: [
                      {
                        type: 'text',
                        text: text.slice(0, 1000), // Cap for rapid audio delivery
                        annotations: [
                          {
                            type: 'speech_metadata',
                            style: 'clear and authoritative plant health specialist',
                          },
                        ],
                      },
                    ],
                  },
                ],
                response_format: { type: 'audio' },
                generation_config: {
                  speech_config: [{ voice: 'Kore' }],
                },
              }),
            },
          )

          if (directResp.ok) {
            const data = await directResp.json()
            for (const step of data.steps || []) {
              if (step.type === 'model_output') {
                for (const c of step.content || []) {
                  if (c.type === 'audio' && c.data) {
                    audioBase64 = c.data
                    break
                  }
                }
              }
            }
          }
        } catch (directErr) {
          console.warn('Direct Gemini TTS call failed:', directErr)
        }
      }

      // If we have Gemini audio, play high-fidelity WAV
      if (audioBase64) {
        const audioUrl = `data:audio/wav;base64,${audioBase64}`
        const audio = new Audio(audioUrl)
        this.currentAudio = audio

        await new Promise<void>((resolve, reject) => {
          audio.onended = () => {
            this.isSpeaking = false
            this.currentAudio = null
            this.emit()
            resolve()
          }
          audio.onerror = (e) => reject(e)
          audio.play().catch(reject)
        })

        return {
          speechText: text,
          isDecisionMode: text.includes('decision mode'),
          audioUrl,
          source: 'gemini-tts',
        }
      }

      // Fallback: Web Speech API (zero-latency, offline native synthesis)
      await this.speakBrowserNative(text)
      return {
        speechText: text,
        isDecisionMode: text.includes('decision mode'),
        source: 'browser-speech',
      }
    } catch (err) {
      console.error('Speech synthesis encountered error, running browser fallback:', err)
      await this.speakBrowserNative(text)
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

  private speakBrowserNative(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) {
        this.isSpeaking = false
        this.emit()
        resolve()
        return
      }

      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 1.0
      utterance.pitch = 1.0

      // Select natural English voice if available
      const voices = window.speechSynthesis.getVoices()
      const preferred = voices.find(
        (v) => (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha')) && v.lang.startsWith('en')
      )
      if (preferred) utterance.voice = preferred

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
   * Conversational LLM Q&A using Gemini 3.8 Flash grounded in website content
   */
  public async askAssistant(
    question: string,
    currentDiagnosisContext?: string
  ): Promise<string> {
    const prompt = `
System Knowledge:
${LEAFLENS_KNOWLEDGE_BASE}

Current Plant Diagnosis on Screen:
${currentDiagnosisContext || 'No scan has been run yet.'}

User Question:
${question}

Answer concisely, accurately, and politely in 2 to 4 sentences so it is pleasant to hear spoken aloud. Never invent plant classes or prices not in the system knowledge.
`

    try {
      // Try backend endpoint first
      try {
        const resp = await fetch('/api/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, plant_context: currentDiagnosisContext }),
        })
        if (resp.ok) {
          const data = await resp.json()
          if (data.reply) return data.reply
        }
      } catch (e) {
        console.warn('Backend /api/assistant not reached, trying direct Gemini API...', e)
      }

      // Direct Gemini REST call
      if (GEMINI_API_KEY) {
        const directResp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/interactions?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'gemini-3.8-flash',
              input: prompt,
            }),
          }
        )

        if (directResp.ok) {
          const data = await directResp.json()
          for (const s of data.steps || []) {
            if (s.type === 'model_output') {
              for (const c of s.content || []) {
                if (c.type === 'text' && c.text) {
                  return c.text.trim()
                }
              }
            }
          }
        }
      }

      return "LeafLens provides instant edge AI diagnosis for 18 plant classes across Tomato, Potato, Bell Pepper, and Snake Plant, with 100% private local inference under our free academic open-access plan."
    } catch (err: any) {
      console.error('AskAssistant error:', err)
      return "I can answer questions regarding your plant's diagnosis, treatment steps, supported crops, or LeafLens free prototype features."
    }
  }
}

export const voiceAssistant = new VoiceAssistantService()
