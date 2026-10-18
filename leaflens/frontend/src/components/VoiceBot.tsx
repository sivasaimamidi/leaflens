import React, { useState, useEffect, useRef } from 'react'
import './VoiceBot.css'
import {
  voiceAssistant,
  buildDiagnosisSpeechText,
  getPrecautionsButtonContent,
  getCureTwoStepsButtonContent,
  getSupportedPlantsButtonContent,
  getAvailablePlansButtonContent,
  getPrivacyButtonContent,
  SUPPORTED_LANGUAGES,
  type ButtonContent,
} from '../services/voiceAssistant'

interface VoiceBotProps {
  scanResult: any | null
}

export const VoiceBot: React.FC<VoiceBotProps> = ({ scanResult }) => {
  // Multilingual Support: auto, en-IN, te-IN, ta-IN, hi-IN, kn-IN, ml-IN
  const [selectedLanguage, setSelectedLanguage] = useState<string>(() => {
    return localStorage.getItem('leaflens_voice_lang') || 'auto'
  })
  // On/Off Toggle defaults to ON (true)
  const [isVoiceOn, setIsVoiceOn] = useState<boolean>(() => {
    const saved = localStorage.getItem('leaflens_voice_on')
    return saved !== null ? saved === 'true' : true
  })

  const [isSpeaking, setIsSpeaking] = useState<boolean>(false)
  const [isMuted, setIsMuted] = useState<boolean>(voiceAssistant.getMuted())
  const [showTranscript, setShowTranscript] = useState<boolean>(false)
  const [spokenText, setSpokenText] = useState<string>('')
  const [isDecisionMode, setIsDecisionMode] = useState<boolean>(false)
  const [copyFeedback, setCopyFeedback] = useState<boolean>(false)

  // Interactive Assistant response card
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [assistantReply, setAssistantReply] = useState<string | null>(null)
  const [userQuery, setUserQuery] = useState<string>('')
  const [isAnswering, setIsAnswering] = useState<boolean>(false)
  const [isListening, setIsListening] = useState<boolean>(false)
  const recognitionRef = useRef<any>(null)

  // Dedicated 1-to-1 AI Voice Interaction state
  const [isAiVoiceListening, setIsAiVoiceListening] = useState<boolean>(false)
  const [isAiVoiceProcessing, setIsAiVoiceProcessing] = useState<boolean>(false)
  const aiVoiceRecognitionRef = useRef<any>(null)

  // Conversational Continuity & Memory of all prior questions
  const [_conversationHistory, setConversationHistory] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([])
  const conversationHistoryRef = useRef<Array<{ role: 'user' | 'assistant'; text: string }>>([])
  const silenceTimerRef = useRef<any>(null)
  const isAiVoiceModeActiveRef = useRef<boolean>(false)
  const accumulatedSpeechRef = useRef<string>('')
  const activeActionRef = useRef<string | null>(null)

  // Last spoken diagnosis hash to prevent duplicate auto-trigger on re-renders
  const lastSpokenKeyRef = useRef<string>('')

  // Subscribe to voiceAssistant speaking and mute states
  useEffect(() => {
    voiceAssistant.subscribe((state) => {
      setIsSpeaking(state.isSpeaking)
      setIsMuted(state.isMuted)
    })
    return () => {
      voiceAssistant.stop()
    }
  }, [])

  // Auto-trigger spoken diagnosis when a new scan result is produced or language changes
  useEffect(() => {
    if (!scanResult) {
      setSpokenText('')
      setAssistantReply(null)
      setActiveCategory(null)
      activeActionRef.current = null
      lastSpokenKeyRef.current = ''
      voiceAssistant.stop()
      return
    }

    const resultKey = `${scanResult.plant || ''}-${scanResult.condition || ''}-${scanResult.confidence || ''}-${selectedLanguage}`
    if (resultKey === lastSpokenKeyRef.current) return
    lastSpokenKeyRef.current = resultKey

    const { text, isDecisionMode: decisionMode, phoneticText } = buildDiagnosisSpeechText(scanResult, selectedLanguage)
    setSpokenText(text)
    setIsDecisionMode(decisionMode)

    // On/Off Rule: If toggle is ON, announce immediately. If OFF, stay completely silent.
    if (isVoiceOn) {
      voiceAssistant.speakText(text, selectedLanguage, phoneticText)
    } else {
      voiceAssistant.stop()
    }
  }, [scanResult, isVoiceOn, selectedLanguage])

  // Toggle On/Off handler
  const handleToggleVoiceOn = () => {
    const nextState = !isVoiceOn
    setIsVoiceOn(nextState)
    localStorage.setItem('leaflens_voice_on', String(nextState))
    if (!nextState) {
      voiceAssistant.stop()
    } else if (spokenText && !isSpeaking) {
      // If switched ON and we already have a diagnosis, play it in selected language
      voiceAssistant.speakText(spokenText, selectedLanguage)
    }
  }

  const handlePlayPause = () => {
    if (isSpeaking) {
      voiceAssistant.stop()
    } else if (spokenText) {
      voiceAssistant.speakText(spokenText, selectedLanguage)
    }
  }

  const handleReplay = () => {
    if (spokenText) {
      voiceAssistant.speakText(spokenText, selectedLanguage)
    }
  }

  const handleToggleMute = () => {
    const nextMuted = voiceAssistant.toggleMute()
    setIsMuted(nextMuted)
  }

  const handleCopyTranscript = () => {
    if (spokenText) {
      navigator.clipboard.writeText(spokenText)
      setCopyFeedback(true)
      setTimeout(() => setCopyFeedback(false), 2000)
    }
  }

  /**
   * Fast, dedicated handlers for the five right-side buttons.
   * Delivers distinct, specialized content with instant response time (< 0.2s) in selected language.
   */
  const handleButtonClick = (action: 'precautions' | 'cure' | 'supported_plants' | 'plans' | 'privacy') => {
    activeActionRef.current = action
    let content: ButtonContent = { title: '', displayText: '', speechText: '' }

    switch (action) {
      case 'precautions':
        content = getPrecautionsButtonContent(scanResult, selectedLanguage)
        break
      case 'cure':
        content = getCureTwoStepsButtonContent(scanResult, selectedLanguage)
        break
      case 'supported_plants':
        content = getSupportedPlantsButtonContent(selectedLanguage)
        break
      case 'plans':
        content = getAvailablePlansButtonContent(selectedLanguage)
        break
      case 'privacy':
        content = getPrivacyButtonContent(selectedLanguage)
        break
    }

    setActiveCategory(content.title)
    setAssistantReply(content.displayText)

    // Play speech immediately (< 0.2s latency) in selected language with fail-safe phonetic fallback
    voiceAssistant.speakText(content.speechText, selectedLanguage, content.phoneticText)
  }

  // Freeform custom question input with conversation history memory
  const handleSelectLanguage = (code: string) => {
    setSelectedLanguage(code)
    localStorage.setItem('leaflens_voice_lang', code)

    // Dispatch custom event so parent components (like Scanner) update instantly
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('leaflens-lang-changed', { detail: code }))
    }

    // If an action button was active, reload its content in the newly selected language
    if (activeActionRef.current && scanResult) {
      const action = activeActionRef.current as 'precautions' | 'cure' | 'supported_plants' | 'plans' | 'privacy'
      let content: ButtonContent = { title: '', displayText: '', speechText: '' }
      switch (action) {
        case 'precautions':
          content = getPrecautionsButtonContent(scanResult, code)
          break
        case 'cure':
          content = getCureTwoStepsButtonContent(scanResult, code)
          break
        case 'supported_plants':
          content = getSupportedPlantsButtonContent(code)
          break
        case 'plans':
          content = getAvailablePlansButtonContent(code)
          break
        case 'privacy':
          content = getPrivacyButtonContent(code)
          break
      }
      setActiveCategory(content.title)
      setAssistantReply(content.displayText)
      if (isVoiceOn) {
        voiceAssistant.speakText(content.speechText, code, content.phoneticText)
      }
      return
    }

    // Otherwise update diagnosis speech text and announce if voice is ON
    if (scanResult) {
      const { text, isDecisionMode: decisionMode, phoneticText } = buildDiagnosisSpeechText(scanResult, code)
      setSpokenText(text)
      setIsDecisionMode(decisionMode)
      if (isVoiceOn) {
        voiceAssistant.speakText(text, code, phoneticText)
      }
    }

    if (isAiVoiceModeActiveRef.current) {
      if (aiVoiceRecognitionRef.current) {
        try {
          aiVoiceRecognitionRef.current.abort()
        } catch {}
      }
      startAiVoiceListening(code)
    }
  }

  // Freeform custom question input with conversation history memory & multilingual support
  const handleAskAssistant = async (queryToAsk?: string) => {
    const q = (queryToAsk || userQuery).trim()
    if (!q || isAnswering) return

    activeActionRef.current = null
    setIsAnswering(true)
    setUserQuery('')
    setActiveCategory(`You asked: "${q}"`)

    const contextStr = scanResult
      ? `Plant: ${scanResult.plant}, Condition: ${scanResult.condition}, Status: ${scanResult.verdict}, Confidence: ${Math.round((scanResult.confidence || 0) * 100)}%`
      : 'No leaf photo currently scanned.'

    try {
      const reply = await voiceAssistant.askAssistant(
        q,
        contextStr,
        conversationHistoryRef.current,
        selectedLanguage
      )
      setAssistantReply(reply)

      const updatedHistory = [
        ...conversationHistoryRef.current,
        { role: 'user' as const, text: q },
        { role: 'assistant' as const, text: reply },
      ]
      conversationHistoryRef.current = updatedHistory
      setConversationHistory(updatedHistory)

      voiceAssistant.speakText(reply, selectedLanguage)
    } catch (err) {
      console.error('Error asking assistant:', err)
    } finally {
      setIsAnswering(false)
    }
  }

  // Speech-to-text mic input handler: transcribes audio and displays directly in text box
  const handleToggleMic = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari, or type your question.')
      return
    }

    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {}
      setIsListening(false)
      return
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort()
        } catch {}
      }

      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = selectedLanguage === 'auto' ? 'en-IN' : selectedLanguage
      recognition.maxAlternatives = 1

      recognition.onstart = () => {
        setIsListening(true)
      }

      recognition.onresult = (event: any) => {
        let fullTranscript = ''
        for (let i = 0; i < event.results.length; i++) {
          fullTranscript += event.results[i][0].transcript
        }
        if (fullTranscript) {
          setUserQuery(fullTranscript)
        }
      }

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error)
        setIsListening(false)
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          alert('Microphone access was blocked. Please permit microphone access in your browser settings.')
        }
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current = recognition
      recognition.start()
    } catch (e) {
      console.warn('Speech recognition failed to start:', e)
      setIsListening(false)
    }
  }

  // 1-to-1 AI Voice Interaction handler: continuous microphone, zero preliminary flutter, multilingual memory retention
  const handleToggleAiVoice = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.')
      return
    }

    if (isAiVoiceModeActiveRef.current) {
      isAiVoiceModeActiveRef.current = false
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      if (aiVoiceRecognitionRef.current) {
        try {
          aiVoiceRecognitionRef.current.stop()
        } catch {}
      }
      setIsAiVoiceListening(false)
      setIsAiVoiceProcessing(false)
      return
    }

    isAiVoiceModeActiveRef.current = true
    startAiVoiceListening()
  }

  const startAiVoiceListening = (langCodeOverride?: string) => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (!SpeechRecognition || !isAiVoiceModeActiveRef.current) return

    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    if (aiVoiceRecognitionRef.current) {
      try {
        aiVoiceRecognitionRef.current.abort()
      } catch {}
    }

    try {
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      const activeLang = langCodeOverride || selectedLanguage
      recognition.lang = activeLang === 'auto' ? 'en-IN' : activeLang
      recognition.maxAlternatives = 1

      accumulatedSpeechRef.current = ''

      recognition.onstart = () => {
        setIsAiVoiceListening(true)
        setIsAiVoiceProcessing(false)
        // No preliminary placeholder messages in assistantReply to eliminate response flutter
      }

      recognition.onresult = (event: any) => {
        let transcript = ''
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript + ' '
        }
        transcript = transcript.trim()

        if (transcript) {
          accumulatedSpeechRef.current = transcript

          // Keep microphone active while user speaks; require 1.8s of silence before concluding user has finished
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
          silenceTimerRef.current = setTimeout(() => {
            const finalQuery = accumulatedSpeechRef.current.trim()
            if (finalQuery && isAiVoiceModeActiveRef.current) {
              try {
                recognition.stop()
              } catch {}
              processSpokenQuestion(finalQuery)
            }
          }, 1800)
        }
      }

      recognition.onerror = (event: any) => {
        console.warn('AI voice recognition error:', event.error)
        if (event.error === 'not-allowed') {
          alert('Microphone access was blocked. Please permit microphone access in your browser settings.')
          isAiVoiceModeActiveRef.current = false
          setIsAiVoiceListening(false)
          setIsAiVoiceProcessing(false)
        }
      }

      recognition.onend = () => {
        setIsAiVoiceListening(false)
        if (isAiVoiceModeActiveRef.current && !isAiVoiceProcessing) {
          setTimeout(() => {
            if (isAiVoiceModeActiveRef.current && !isAiVoiceProcessing) {
              startAiVoiceListening()
            }
          }, 300)
        }
      }

      aiVoiceRecognitionRef.current = recognition
      recognition.start()
    } catch (e) {
      console.warn('AI voice start error:', e)
      setIsAiVoiceListening(false)
      setIsAiVoiceProcessing(false)
    }
  }

  const processSpokenQuestion = async (spokenQuestion: string) => {
    activeActionRef.current = null
    setIsAiVoiceListening(false)
    setIsAiVoiceProcessing(true)

    // Set category label directly without overwriting assistantReply until final answer is ready
    setActiveCategory(`You asked: "${spokenQuestion}"`)

    const contextStr = scanResult
      ? `Plant: ${scanResult.plant}, Condition: ${scanResult.condition}, Status: ${scanResult.verdict}, Confidence: ${Math.round((scanResult.confidence || 0) * 100)}%`
      : 'No leaf photo currently scanned.'

    try {
      const answer = await voiceAssistant.askAssistant(
        spokenQuestion,
        contextStr,
        conversationHistoryRef.current,
        selectedLanguage
      )

      // Deliver single final answer directly with ZERO preliminary flutter
      setAssistantReply(answer)

      // Update conversation history
      const updatedHistory = [
        ...conversationHistoryRef.current,
        { role: 'user' as const, text: spokenQuestion },
        { role: 'assistant' as const, text: answer },
      ]
      conversationHistoryRef.current = updatedHistory
      setConversationHistory(updatedHistory)

      // Deliver answer aloud in selected language native voice
      await voiceAssistant.speakText(answer, selectedLanguage)

      // Maintain conversational continuity: keep microphone open for next user question
      if (isAiVoiceModeActiveRef.current) {
        setIsAiVoiceProcessing(false)
        startAiVoiceListening()
      }
    } catch (err) {
      console.error('AI voice error:', err)
      setAssistantReply('I can answer questions regarding your plant diagnosis, precautions, or care routine.')
    } finally {
      setIsAiVoiceProcessing(false)
    }
  }

  if (!scanResult) return null

  return (
    <div className={`voice-bot-container ${isSpeaking ? 'speaking' : ''}`}>
      {/* 1. Header with Identity, On/Off Toggle, and Status */}
      <div className="voice-bot-header">
        <div className="voice-bot-identity">
          <div className="voice-bot-avatar" aria-hidden="true">
            🌱
          </div>
          <div className="voice-bot-name-group">
            <div className="voice-bot-title">
              <span>LeafLens Voice Bot</span>
              <div className="audio-wave" aria-hidden="true">
                <span className="wave-bar" />
                <span className="wave-bar" />
                <span className="wave-bar" />
                <span className="wave-bar" />
              </div>
            </div>
            <span className="voice-bot-model-tag">Gemini 3.8 Flash TTS &amp; Voice Agent</span>
          </div>
        </div>

        {/* ON / OFF Switch (Defaults to ON) */}
        <div className="voice-header-right">
          <div className="voice-toggle-wrap">
            <span className="voice-toggle-caption">Voice:</span>
            <button
              type="button"
              className={`voice-toggle-switch ${isVoiceOn ? 'switch-on' : 'switch-off'}`}
              onClick={handleToggleVoiceOn}
              title={isVoiceOn ? 'Voice is ON (click to switch OFF)' : 'Voice is OFF (click to switch ON)'}
              aria-label="Toggle voice output"
            >
              <span className="switch-slider">
                <span className="switch-knob" />
              </span>
              <span className="switch-state-text">{isVoiceOn ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          <span
            className={`voice-status-pill ${
              !isVoiceOn ? 'disabled' : isMuted ? 'muted' : isSpeaking ? 'speaking' : 'idle'
            }`}
          >
            {!isVoiceOn ? '⚪ Silent' : isMuted ? '🔇 Muted' : isSpeaking ? '🔊 Speaking...' : 'Ready'}
          </span>
        </div>
      </div>

      {/* 2. Verbatim Decision Banner (Shows strictly in Decision Mode) */}
      {isDecisionMode && (
        <div className="decision-mode-banner">
          <strong>Decision Mode Voice Message:</strong>
          <br />
          &ldquo;The leaf is in decision mode, and these are the precautions you can take to avoid this disease in the future. If you follow these precautions, the plant will no longer be at risk.&rdquo;
        </div>
      )}

      {/* 3. Audio Control Buttons */}
      <div className="voice-controls-bar">
        <button
          type="button"
          className="voice-btn voice-btn-primary"
          onClick={handlePlayPause}
        >
          {isSpeaking ? '⏸ Pause' : '▶️ Play voice'}
        </button>

        <button
          type="button"
          className="voice-btn"
          onClick={handleReplay}
          disabled={!spokenText}
        >
          🔄 Replay
        </button>

        <button
          type="button"
          className={`voice-btn ${isMuted ? 'voice-btn-active' : ''}`}
          onClick={handleToggleMute}
          title="Toggle audio speech"
        >
          {isMuted ? '🔇 Unmute' : '🔊 Mute'}
        </button>

        <button
          type="button"
          className="voice-btn"
          onClick={() => setShowTranscript(!showTranscript)}
        >
          📋 {showTranscript ? 'Hide transcript' : 'View transcript'}
        </button>
      </div>

      {/* 4. Spoken Text Transcript (For verification / debugging) */}
      {showTranscript && spokenText && (
        <div className="voice-transcript-box">
          <div className="transcript-header">
            <span>Spoken Speech Transcript</span>
            <button
              type="button"
              className="transcript-copy-btn"
              onClick={handleCopyTranscript}
            >
              {copyFeedback ? 'Copied!' : 'Copy transcript'}
            </button>
          </div>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{spokenText}</p>
        </div>
      )}

      {/* 5. Assistant Reply Display Card */}
      {assistantReply && (
        <div className="assistant-response-card">
          <div className="assistant-response-header">
            <span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--leaf, #2f6b45)' }}>
              🤖 {activeCategory || 'Assistant Answer'}:
            </span>
            <button
              type="button"
              className="assistant-close-btn"
              onClick={() => {
                setAssistantReply(null)
                setActiveCategory(null)
                activeActionRef.current = null
                voiceAssistant.stop()
              }}
              title="Close answer"
            >
              ✕
            </button>
          </div>
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{assistantReply}</div>
        </div>
      )}

      {/* 6. Multilingual Language Selector & Five Distinct Action Buttons */}
      <div className="voice-qa-section">
        {/* Language Selection Bar */}
        <div className="voice-lang-bar" role="radiogroup" aria-label="Select voicebot language">
          <span className="voice-lang-label">Lang:</span>
          {SUPPORTED_LANGUAGES.map((item) => (
            <button
              key={item.code}
              type="button"
              className={`voice-lang-pill ${selectedLanguage === item.code ? 'active' : ''}`}
              onClick={() => handleSelectLanguage(item.code)}
              title={item.name}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="voice-qa-chips">
          {/* Button 1: Precautions (Condition & Prevention) */}
          <button
            type="button"
            className="voice-qa-chip"
            onClick={() => handleButtonClick('precautions')}
            title="View condition report and prevention precautions"
          >
            🛡️ Precautions
          </button>

          {/* Button 2: Two Steps (Cure Steps) */}
          <button
            type="button"
            className="voice-qa-chip"
            onClick={() => handleButtonClick('cure')}
            title="View concrete Step 1 and Step 2 treatment cure plan"
          >
            💊 Two steps (Cure)
          </button>

          {/* Button 3: Supported Plants (Database catalog & suggestions - NO leaf leak) */}
          <button
            type="button"
            className="voice-qa-chip"
            onClick={() => handleButtonClick('supported_plants')}
            title="View 18 database classes across Tomato, Potato, Pepper, Snake Plant"
          >
            🪴 Supported plants
          </button>

          {/* Button 4: Available Plans (Free & Enterprise tiers) */}
          <button
            type="button"
            className="voice-qa-chip"
            onClick={() => handleButtonClick('plans')}
            title="View subscription and academic open-access plans"
          >
            💳 Available plans
          </button>

          {/* Button 5: Privacy (100% on-device - NO plant leak) */}
          <button
            type="button"
            className="voice-qa-chip"
            onClick={() => handleButtonClick('privacy')}
            title="View 100% on-device edge privacy policy"
          >
            🔒 Privacy
          </button>
        </div>

        {/* Optional Custom Question Bar */}
        <form
          className="voice-qa-input-row"
          onSubmit={(e) => {
            e.preventDefault()
            handleAskAssistant()
          }}
        >
          <input
            type="text"
            className="voice-qa-input"
            placeholder="Ask a question or tap a button above..."
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
          />

          {/* Existing Button: Captures user speech and places it in text box */}
          <button
            type="button"
            className={`voice-mic-btn ${isListening ? 'listening' : ''}`}
            onClick={handleToggleMic}
            title={isListening ? 'Listening... click to stop' : 'Dictate voice into text box'}
            aria-label="Dictate voice into text box"
          >
            🎤
          </button>

          {/* New Button: Initiates two-way AI-to-user voice conversation */}
          <button
            type="button"
            className={`voice-ai-talk-btn ${
              isAiVoiceListening ? 'listening' : isAiVoiceProcessing ? 'processing' : ''
            }`}
            onClick={handleToggleAiVoice}
            title={
              isAiVoiceListening
                ? 'Listening to question... click to stop'
                : isAiVoiceProcessing
                ? 'Thinking...'
                : 'Start 1-to-1 voice conversation with AI'
            }
            aria-label="Start 1-to-1 voice conversation with AI"
          >
            <span>🗣️</span>
            <span>{isAiVoiceListening ? 'Listening...' : isAiVoiceProcessing ? 'Thinking...' : 'AI Voice'}</span>
          </button>

          <button
            type="submit"
            className="voice-send-btn"
            disabled={!userQuery.trim() || isAnswering}
          >
            {isAnswering ? '...' : 'Ask'}
          </button>
        </form>
      </div>
    </div>
  )
}
