"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Thin wrapper around the Web Speech API (SpeechRecognition).
 *
 * Browser support is gated — Safari and Chrome have it under
 * `webkitSpeechRecognition`; Firefox doesn't. The hook exposes
 * `supported: false` when the API is missing so the UI can hide the
 * mic button cleanly.
 *
 * `interimText` is shown live while the user speaks; `onFinal` fires
 * when a phrase finishes so the caller can append to its input state.
 *
 * The hook intentionally does NOT manage the input value — it just
 * emits transcribed text. The composer owns the textarea state.
 */

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }> & { length: number } }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeechToText(opts: {
  onFinal: (text: string) => void;
  /** BCP-47 language tag; defaults to browser-determined. */
  lang?: string;
}) {
  const { onFinal, lang } = opts;
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const ctorRef = useRef<SpeechRecognitionCtor | null>(null);
  const instanceRef = useRef<SpeechRecognitionLike | null>(null);
  const onFinalRef = useRef(onFinal);

  // Keep latest onFinal without re-creating the recognition instance.
  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  useEffect(() => {
    const ctor = getRecognitionCtor();
    ctorRef.current = ctor;
    setSupported(!!ctor);
  }, []);

  const start = useCallback(() => {
    const ctor = ctorRef.current;
    if (!ctor || listening) return;
    setError(null);
    setInterimText("");
    const rec = new ctor();
    rec.interimResults = true;
    rec.continuous = true;
    if (lang) rec.lang = lang;
    rec.onresult = (event) => {
      let interim = "";
      let finalChunk = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) finalChunk += transcript;
        else interim += transcript;
      }
      if (finalChunk) {
        onFinalRef.current(finalChunk);
        setInterimText("");
      } else {
        setInterimText(interim);
      }
    };
    rec.onerror = (event) => {
      setError(event.error);
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
      setInterimText("");
    };
    instanceRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [lang, listening]);

  const stop = useCallback(() => {
    const rec = instanceRef.current;
    if (!rec) return;
    try { rec.stop(); } catch { /* ignore */ }
    setListening(false);
  }, []);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  // Stop on unmount.
  useEffect(() => {
    return () => {
      const rec = instanceRef.current;
      if (rec) try { rec.abort(); } catch { /* ignore */ }
    };
  }, []);

  return { supported, listening, interimText, error, start, stop, toggle };
}
