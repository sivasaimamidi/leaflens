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
} from '../services/voiceAssistant'

interface VoiceBotProps {
  scanResult: any | null
}

export const VoiceBot: React.FC<VoiceBotProps> = ({ scanResult }) => {
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

  // Auto-trigger spoken diagnosis when a new scan result is produced
  useEffect(() => {
    if (!scanResult) {
      setSpokenText('')
      setAssistantReply(null)
      setActiveCategory(null)
      lastSpokenKeyRef.current = ''
      voiceAssistant.stop()
      return
    }

    const resultKey = `${scanResult.plant || ''}-${scanResult.condition || ''}-${scanResult.confidence || ''}`
    if (resultKey === lastSpokenKeyRef.current) return
    lastSpokenKeyRef.current = resultKey

    const { text, isDecisionMode: decisionMode } = buildDiagnosisSpeechText(scanResult)
    setSpokenText(text)
    setIsDecisionMode(decisionMode)

    // On/Off Rule: If toggle is ON, announce immediately. If OFF, stay completely silent.
    if (isVoiceOn) {
      voiceAssistant.speakText(text)
    } else {
      voiceAssistant.stop()
    }
  }, [scanResult, isVoiceOn])

  // Toggle On/Off handler
  const handleToggleVoiceOn = () => {
    const nextState = !isVoiceOn
    setIsVoiceOn(nextState)
    localStorage.setItem('leaflens_voice_on', String(nextState))
    if (!nextState) {
      voiceAssistant.stop()
    } else if (spokenText && !isSpeaking) {
      // If switched ON and we already have a diagnosis, play it
      voiceAssistant.speakText(spokenText)
    }
  }

  const handlePlayPause = () => {
    if (isSpeaking) {
      voiceAssistant.stop()
    } else if (spokenText) {
      voiceAssistant.speakText(spokenText)
    }
  }

  const handleReplay = () => {
    if (spokenText) {
      voiceAssistant.speakText(spokenText)
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
   * Delivers distinct, specialized content with instant response time (< 0.2s).
   */
  const handleButtonClick = (action: 'precautions' | 'cure' | 'supported_plants' | 'plans' | 'privacy') => {
    let content = { title: '', displayText: '', speechText: '' }

    switch (action) {
      case 'precautions':
        content = getPrecautionsButtonContent(scanResult)
        break
      case 'cure':
        content = getCureTwoStepsButtonContent(scanResult)
        break
      case 'supported_plants':
        content = getSupportedPlantsButtonContent()
        break
      case 'plans':
        content = getAvailablePlansButtonContent()
        break
      case 'privacy':
        content = getPrivacyButtonContent()
        break
    }

    setActiveCategory(content.title)
    setAssistantReply(content.displayText)

    // Play speech immediately (< 0.2s latency)
    voiceAssistant.speakText(content.speechText)
  }

  // Freeform custom question input
  const handleAskAssistant = async (queryToAsk?: string) => {
    const q = (queryToAsk || userQuery).trim()
    if (!q || isAnswering) return

    setIsAnswering(true)
    setUserQuery('')
    setActiveCategory(`Question: "${q}"`)

    const contextStr = scanResult
      ? `Plant: ${scanResult.plant}, Condition: ${scanResult.condition}, Status: ${scanResult.verdict}, Confidence: ${Math.round((scanResult.confidence || 0) * 100)}%`
      : 'No leaf photo currently scanned.'

    try {
      const reply = await voiceAssistant.askAssistant(q, contextStr)
      setAssistantReply(reply)
      voiceAssistant.speakText(reply)
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
      } catch (_) {}
      setIsListening(false)
      return
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort()
        } catch (_) {}
      }

      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'
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

      {/* 6. Five Distinct Buttons with Instant (< 0.2s) Execution */}
      <div className="voice-qa-section">
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

          <button
            type="button"
            className={`voice-mic-btn ${isListening ? 'listening' : ''}`}
            onClick={handleToggleMic}
            title={isListening ? 'Listening... click to stop' : 'Ask with microphone'}
          >
            🎤
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
