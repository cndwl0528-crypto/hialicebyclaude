'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

export default function useSpeech() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [supported, setSupported] = useState(true);

  const recognitionRef = useRef(null);
  const synthRef = useRef(null);
  // Cached voice list — populated once via onvoiceschanged, avoids getVoices() on every speak()
  const cachedVoicesRef = useRef([]);
  // Track currently playing Audio object to prevent duplicate playback
  const currentAudioRef = useRef(null);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.language = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setTranscript('');
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          setTranscript((prev) => prev + transcript);
        } else {
          interimTranscript += transcript;
        }
      }

      if (interimTranscript) {
        setTranscript((prev) => prev.split(' ').slice(0, -1).join(' ') + ' ' + interimTranscript);
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error', event.error);
      // Restore isListening to false on error — prevents UI getting stuck in listening state
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    // Initialize Speech Synthesis
    const synth = window.speechSynthesis;
    synthRef.current = synth;

    // Cache voices once via onvoiceschanged event — avoids calling getVoices() on every speak()
    const handleVoicesChanged = () => {
      cachedVoicesRef.current = synth.getVoices();
    };

    // Populate immediately if voices are already available (some browsers load them synchronously)
    const initialVoices = synth.getVoices();
    if (initialVoices.length > 0) {
      cachedVoicesRef.current = initialVoices;
    }

    synth.addEventListener('voiceschanged', handleVoicesChanged);

    return () => {
      synth.removeEventListener('voiceschanged', handleVoicesChanged);
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
      // Stop and clean up any playing audio on unmount
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
    };
  }, []);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      setTranscript('');
      recognitionRef.current.start();
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  // Web Speech API TTS (browser built-in) — uses cached voice list
  const speakBrowser = useCallback((text) => {
    if (!synthRef.current) return;

    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.language = 'en-US';
    utterance.rate = 0.85; // Slower for children
    utterance.pitch = 1.05; // Slightly higher for friendly tone
    utterance.volume = 1;

    // Use cached voices instead of calling getVoices() every time
    const voices = cachedVoicesRef.current;
    const preferred = voices.find(v =>
      v.lang.startsWith('en') && v.name.toLowerCase().includes('samantha')
    ) || voices.find(v =>
      v.lang.startsWith('en-US') && v.name.toLowerCase().includes('female')
    ) || voices.find(v => v.lang.startsWith('en-US'));
    if (preferred) utterance.voice = preferred;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    synthRef.current.speak(utterance);
  }, []);

  // ElevenLabs TTS via backend proxy (API key stays server-side)
  const speakElevenLabs = useCallback(async (text) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    // Stop any currently playing audio before starting new playback
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }

    setIsSpeaking(true);
    try {
      const res = await fetch(`${apiUrl}/api/tts/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) throw new Error('ElevenLabs API error');

      const audioBlob = await res.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      // Track the current audio so we can stop it if a new speak() is triggered
      currentAudioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
        if (currentAudioRef.current === audio) {
          currentAudioRef.current = null;
        }
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
        if (currentAudioRef.current === audio) {
          currentAudioRef.current = null;
        }
      };

      audio.play();
    } catch (err) {
      console.warn('ElevenLabs TTS failed, falling back to browser TTS:', err.message);
      currentAudioRef.current = null;
      speakBrowser(text);
    }
  }, [speakBrowser]);

  // Main speak function — tries backend TTS proxy first, falls back to browser
  const speak = useCallback((text) => {
    if (!text) return;
    const hasTtsProxy = !!process.env.NEXT_PUBLIC_ENABLE_TTS_PROXY;
    if (hasTtsProxy) {
      speakElevenLabs(text);
    } else {
      speakBrowser(text);
    }
  }, [speakElevenLabs, speakBrowser]);

  const stopSpeaking = useCallback(() => {
    if (synthRef.current) synthRef.current.cancel();
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  return {
    isListening,
    transcript,
    speak,
    stopSpeaking,
    startListening,
    stopListening,
    isSpeaking,
    supported,
  };
}
