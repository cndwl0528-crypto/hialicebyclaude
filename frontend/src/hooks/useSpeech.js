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

  const speak = useCallback((text) => {
    if (!synthRef.current || !supported) return;

    // Cancel any ongoing speech
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.language = 'en-US';
    utterance.rate = 0.9; // Slower for children
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    synthRef.current.speak(utterance);
  }, [supported]);

  return {
    isListening,
    transcript,
    speak,
    startListening,
    stopListening,
    isSpeaking,
    supported,
  };
}
