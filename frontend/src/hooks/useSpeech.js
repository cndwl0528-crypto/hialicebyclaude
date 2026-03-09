'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

export default function useSpeech() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [supported, setSupported] = useState(true);

  const recognitionRef = useRef(null);
  const synthRef = useRef(null);

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
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    // Initialize Speech Synthesis
    const synth = window.speechSynthesis;
    synthRef.current = synth;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (synthRef.current) {
        synthRef.current.cancel();
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

  // Web Speech API TTS (browser built-in)
  const speakBrowser = useCallback((text) => {
    if (!synthRef.current) return;

    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.language = 'en-US';
    utterance.rate = 0.85; // Slower for children
    utterance.pitch = 1.05; // Slightly higher for friendly tone
    utterance.volume = 1;

    // Try to select a female English voice
    const voices = synthRef.current.getVoices();
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

  // ElevenLabs TTS (API-based, higher quality)
  const speakElevenLabs = useCallback(async (text) => {
    const apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
    if (!apiKey) return speakBrowser(text);

    setIsSpeaking(true);
    try {
      const voiceId = 'EXAVITQu4vr4xnSDxMaL'; // Sarah - warm female
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2',
          voice_settings: { stability: 0.7, similarity_boost: 0.8, style: 0.3, speed: 0.85 },
        }),
      });

      if (!res.ok) throw new Error('ElevenLabs API error');

      const audioBlob = await res.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.onended = () => { setIsSpeaking(false); URL.revokeObjectURL(audioUrl); };
      audio.onerror = () => { setIsSpeaking(false); URL.revokeObjectURL(audioUrl); };
      audio.play();
    } catch (err) {
      console.warn('ElevenLabs TTS failed, falling back to browser TTS:', err.message);
      speakBrowser(text);
    }
  }, [speakBrowser]);

  // Main speak function — tries ElevenLabs first, falls back to browser
  const speak = useCallback((text) => {
    if (!text) return;
    const hasElevenLabs = !!process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
    if (hasElevenLabs) {
      speakElevenLabs(text);
    } else {
      speakBrowser(text);
    }
  }, [speakElevenLabs, speakBrowser]);

  const stopSpeaking = useCallback(() => {
    if (synthRef.current) synthRef.current.cancel();
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
