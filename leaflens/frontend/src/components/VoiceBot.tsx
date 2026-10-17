import React, { useState, useEffect, useRef } from 'react'
import './VoiceBot.css'
import {
  voiceAssistant,
  buildDiagnosisSpeechText,
} from '../services/voiceAssistant'

interface VoiceBotProps {
  scanResult: any | null
}

export const VoiceBot: React.FC<VoiceBotProps> = ({ scanResult }) => {
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false)
  const [isMuted, setIsMuted] = useState<boolean>(voiceAssistant.getMuted())
  const [showTranscript, setShowTranscript] = useState<boolean>(false)
  const [spokenText, setSpokenText] = useState<string>('')
  const [isDecisionMode, setIsDecisionMode] = useState<boolean>(false)
  const [copyFeedback, setCopyFeedback] = useState<boolean>(false)

  // Interactive Assistant state
  const [userQuery, setUserQuery] = useState<string>('')
  const [isAnswering, setIsAnswering] = useState<boolean>(false)
  const [assistantReply, setAssistantReply] = useState<string | null>(null)
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

  // Auto-trigger spoken diagnosis when a new scan result is received
  useEffect(() => {
    if (!scanResult) {
      setSpokenText('')
      setAssistantReply(null)
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

    // Trigger spoken delivery
    voiceAssistant.speakText(text)
  }, [scanResult])

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

  // Interactive Ask Assistant flow
  const handleAskAssistant = async (queryToAsk?: string) => {
    const q = (queryToAsk || userQuery).trim()
    if (!q || isAnswering) return

    setIsAnswering(true)
    setUserQuery('')

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

  // Speech-to-text mic input handler
  const handleToggleMic = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please type your question.')
      return
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop()
      setIsListening(false)
      return
    }

    try {
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = 'en-US'

      recognition.onstart = () => setIsListening(true)
      recognition.onend = () => setIsListening(false)
      recognition.onerror = () => setIsListening(false)

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
        if (transcript) {
          setUserQuery(transcript)
          handleAskAssistant(transcript)
        }
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
      {/* 1. Header with Identity and Status */}
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
            <span className="voice-bot-model-tag">Gemini 3.8 Flash TTS &amp; LLM Voice Agent</span>
          </div>
        </div>

        <span
          className={`voice-status-pill ${
            isMuted ? 'muted' : isSpeaking ? 'speaking' : 'idle'
          }`}
        >
          {isMuted ? '🔇 Muted' : isSpeaking ? '🔊 Speaking...' : 'Ready'}
        </span>
      </div>

      {/* 2. Verbatim Decision Banner (Triggered strictly in Decision Mode) */}
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
          {isSpeaking ? '⏸ Pause audio' : '▶️ Play voice'}
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
          <p style={{ margin: 0 }}>{spokenText}</p>
        </div>
      )}

      {/* 5. Assistant Reply Display */}
      {assistantReply && (
        <div className="assistant-response-card">
          <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--leaf, #2f6b45)' }}>
            🤖 Assistant Answer:
          </div>
          <div>{assistantReply}</div>
        </div>
      )}

      {/* 6. Interactive Q&A Mode: Ask the Voice Assistant */}
      <div className="voice-qa-section">
        <div className="voice-qa-chips">
          <button
            type="button"
            className="voice-qa-chip"
            onClick={() => handleAskAssistant('Explain my diagnosis and precautions')}
          >
            🛡️ Explain precautions
          </button>
          <button
            type="button"
            className="voice-qa-chip"
            onClick={() => handleAskAssistant('How do I cure and treat this leaf?')}
          >
            💊 Cure steps
          </button>
          <button
            type="button"
            className="voice-qa-chip"
            onClick={() => handleAskAssistant('What plants and classes are supported?')}
          >
            🪴 Supported plants
          </button>
          <button
            type="button"
            className="voice-qa-chip"
            onClick={() => handleAskAssistant('What subscription plans are available?')}
          >
            💳 Available plans
          </button>
          <button
            type="button"
            className="voice-qa-chip"
            onClick={() => handleAskAssistant('Is my data and plant photo private?')}
          >
            🔒 Privacy guarantee
          </button>
        </div>

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
            placeholder="Ask about precautions, cures, plans, or dataset..."
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
          />

          <button
            type="button"
            className={`voice-mic-btn ${isListening ? 'listening' : ''}`}
            onClick={handleToggleMic}
            title={isListening ? 'Listening... click to stop' : 'Ask with voice (microphone)'}
          >
            🎤
          </button>

          <button
            type="submit"
            className="voice-send-btn"
            disabled={!userQuery.trim() || isAnswering}
          >
            {isAnswering ? 'Thinking...' : 'Ask'}
          </button>
        </form>
      </div>
    </div>
  )
}
