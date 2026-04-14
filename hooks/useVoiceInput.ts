'use client'

import { useState, useRef, useCallback } from 'react'

export type VoiceState = 'idle' | 'requesting' | 'listening' | 'error'

interface UseVoiceInputOptions {
  onPartial: (text: string) => void   // called as user speaks (replace preview)
  onFinal: (text: string) => void     // called when a sentence is finalized
  onError?: (msg: string) => void
}

export function useVoiceInput({ onPartial, onFinal, onError }: UseVoiceInputOptions) {
  const [state, setState] = useState<VoiceState>('idle')
  const stateRef = useRef<VoiceState>('idle')
  const setStateAndRef = (s: VoiceState) => { stateRef.current = s; setState(s) }

  const wsRef = useRef<WebSocket | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)

  const stop = useCallback(() => {
    // Disconnect audio pipeline
    processorRef.current?.disconnect()
    processorRef.current = null

    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null

    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null

    // Close WebSocket cleanly
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      try { ws.send(JSON.stringify({ terminate_session: true })) } catch {}
      ws.close()
    }
    wsRef.current = null

    setStateAndRef('idle')
  }, [])

  const start = useCallback(async () => {
    if (state !== 'idle') return
    setStateAndRef('requesting')

    try {
      // 1. Get short-lived token from our backend
      const tokenRes = await fetch('/api/voice-token', { method: 'POST' })
      if (!tokenRes.ok) throw new Error('Could not get voice token')
      const { token } = await tokenRes.json()

      // 2. Request microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true },
        video: false,
      })
      streamRef.current = stream

      // 3. Set up AudioContext (16kHz mono)
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      const audioCtx = new AudioContextClass({ sampleRate: 16000 })
      audioCtxRef.current = audioCtx

      // Resume context if suspended (required on iOS after user gesture)
      if (audioCtx.state === 'suspended') await audioCtx.resume()

      // 4. Connect to AssemblyAI real-time WebSocket
      const ws = new WebSocket(
        `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000&token=${token}`
      )
      wsRef.current = ws

      ws.onopen = () => {
        setStateAndRef('listening')

        // Wire up audio processing
        const source = audioCtx.createMediaStreamSource(stream)
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        const processor = audioCtx.createScriptProcessor(4096, 1, 1)
        processorRef.current = processor

        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return
          const float32 = e.inputBuffer.getChannelData(0)
          // Convert float32 → int16 PCM
          const int16 = new Int16Array(float32.length)
          for (let i = 0; i < float32.length; i++) {
            const s = Math.max(-1, Math.min(1, float32[i]))
            int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
          }
          ws.send(int16.buffer)
        }

        source.connect(processor)
        processor.connect(audioCtx.destination)
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string)
          if (msg.message_type === 'PartialTranscript' && msg.text) {
            onPartial(msg.text)
          } else if (msg.message_type === 'FinalTranscript' && msg.text) {
            onFinal(msg.text)
          }
        } catch { /* ignore malformed messages */ }
      }

      ws.onerror = () => {
        onError?.('Microphone connection failed. Try again.')
        setStateAndRef('error')
        stop()
      }

      ws.onclose = (e) => {
        if (e.code !== 1000 && stateRef.current === 'listening') {
          setStateAndRef('idle')
        }
      }

    } catch (err: any) {
      const msg = err?.name === 'NotAllowedError'
        ? 'Microphone access denied. Check your browser settings.'
        : 'Could not start microphone.'
      onError?.(msg)
      setStateAndRef('error')
      // Clean up anything that started
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [state, stop, onPartial, onFinal, onError])

  return { state, start, stop }
}
