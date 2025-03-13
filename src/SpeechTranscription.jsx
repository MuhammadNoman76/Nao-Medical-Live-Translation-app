import React, { useState, useEffect, useRef } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";

const languages = [
  { label: "English", value: "en-US" },
  { label: "Spanish", value: "es-ES" },
  { label: "French", value: "fr-FR" },
  { label: "German", value: "de-DE" },
  { label: "Japanese", value: "ja-JP" },
  { label: "Chinese (Simplified)", value: "zh-CN" },
  { label: "Russian", value: "ru-RU" },
  { label: "Italian", value: "it-IT" },
  { label: "Portuguese", value: "pt-BR" },
  { label: "Arabic", value: "ar-SA" },
  { label: "Hindi", value: "hi-IN" },
  { label: "Urdu", value: "ur-PK" },
];

function SpeechTranscription() {
  const [selectedLanguage, setSelectedLanguage] = useState("en-US");
  const [targetLanguage, setTargetLanguage] = useState("es-ES");
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [translation, setTranslation] = useState("");
  const [error, setError] = useState("");
  const [isBrowserSupported, setIsBrowserSupported] = useState(true);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState("");
  const recognitionRef = useRef(null);
  const finalTranscriptRef = useRef("");
  const wordCountRef = useRef(0);
  const lastProcessedTextRef = useRef("");
  const synthRef = useRef(null);
  const lastTranslatedTextRef = useRef("");

  const API_KEY = "AIzaSyAP9NLg9hX3jsaU2YyzI2iK9MEqIm_64hg";

  useEffect(() => {
    const initializeSpeechServices = () => {
      if (
        "SpeechRecognition" in window ||
        "webkitSpeechRecognition" in window
      ) {
        setIsBrowserSupported(true);
      } else {
        setIsBrowserSupported(false);
      }
      if ("speechSynthesis" in window) {
        synthRef.current = window.speechSynthesis;
        const loadVoices = () => {
          const voices = synthRef.current.getVoices();
          setAvailableVoices(voices);
          const defaultVoice = voices.find((voice) =>
            voice.lang.startsWith(targetLanguage.split("-")[0])
          );
          if (defaultVoice) setSelectedVoice(defaultVoice.name);
          else if (voices.length > 0) setSelectedVoice(voices[0].name);
        };
        if (synthRef.current.onvoiceschanged !== undefined) {
          synthRef.current.onvoiceschanged = loadVoices;
        }
        loadVoices();
      }
    };
    initializeSpeechServices();
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      if (synthRef.current && synthRef.current.speaking)
        synthRef.current.cancel();
    };
  }, [targetLanguage]);

  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = selectedLanguage;
      if (isRecognizing) recognitionRef.current.stop();
    }
  }, [selectedLanguage, isRecognizing]);

  useEffect(() => {
    if (availableVoices.length > 0) {
      const targetCode = targetLanguage.split("-")[0];
      const matchingVoice = availableVoices.find((voice) =>
        voice.lang.startsWith(targetCode)
      );
      if (matchingVoice) setSelectedVoice(matchingVoice.name);
    }
  }, [targetLanguage, availableVoices]);

  const createRecognitionInstance = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;
    const recog = new SpeechRecognition();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = selectedLanguage;

    recog.onresult = (event) => {
      let finalTranscript = "";
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + " ";
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      if (finalTranscript) {
        finalTranscriptRef.current += finalTranscript;
      }

      const combinedText = finalTranscriptRef.current + interimTranscript;
      setTranscript(combinedText);
      const words = combinedText.trim().split(/\s+/);
      const wordsSinceLastTranslation = words.length - wordCountRef.current;

      if (wordsSinceLastTranslation >= 6 || finalTranscript) {
        wordCountRef.current = words.length;
        if (combinedText.trim() !== lastTranslatedTextRef.current) {
          lastTranslatedTextRef.current = combinedText.trim();
          setCurrentTranscript(combinedText.trim());
          translateWithGoogleGemini(
            combinedText.trim(),
            selectedLanguage,
            targetLanguage
          );
        }
      }
    };

    recog.onend = () => {
      if (isRecognizing) {
        setTimeout(() => recog.start(), 100);
      } else if (finalTranscriptRef.current.trim()) {
        translateWithGoogleGemini(
          finalTranscriptRef.current.trim(),
          selectedLanguage,
          targetLanguage
        );
      }
    };

    recog.onerror = (event) => {
      setError(`Speech recognition error: ${event.error}`);
      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      )
        setIsRecognizing(false);
    };

    return recog;
  };

  const translateWithGoogleGemini = async (
    text,
    sourceLanguage,
    targetLanguage
  ) => {
    if (!text || isTranslating) return;
    setIsTranslating(true);
    setError("");
    const sourceLangName =
      languages.find((lang) => lang.value === sourceLanguage)?.label ||
      "English";
    const targetLangName =
      languages.find((lang) => lang.value === targetLanguage)?.label ||
      "Spanish";
    const prompt = `Translate the following text from ${sourceLangName} to ${targetLangName} and provide only the translated text: '${text}'`;

    try {
      const genAI = new GoogleGenerativeAI(API_KEY);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
      });
      const request = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1000 },
      };
      const result = await model.generateContent(request);
      const translatedText = (await result.response).text();
      setTranslation(translatedText);
    } catch (err) {
      setError(`Translation error: ${err.message}`);
    } finally {
      setIsTranslating(false);
    }
  };

  const speakTranslation = (text) => {
    if (!synthRef.current || !text) {
      setIsSpeaking(false);
      return;
    }
    synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = availableVoices.find((v) => v.name === selectedVoice);
    if (voice) utterance.voice = voice;
    utterance.lang = targetLanguage;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    synthRef.current.speak(utterance);
  };

  const handleStart = () => {
    setError("");
    if (recognitionRef.current) recognitionRef.current.stop();
    recognitionRef.current = createRecognitionInstance();
    if (recognitionRef.current) {
      finalTranscriptRef.current = "";
      setTranscript("");
      setCurrentTranscript("");
      setTranslation("");
      wordCountRef.current = 0;
      lastProcessedTextRef.current = "";
      lastTranslatedTextRef.current = "";
      setIsRecognizing(true);
      setTimeout(() => recognitionRef.current.start(), 100);
    }
  };

  const handleStop = () => {
    setIsRecognizing(false);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const handleClear = () => {
    setTranscript("");
    setCurrentTranscript("");
    setTranslation("");
    finalTranscriptRef.current = "";
    wordCountRef.current = 0;
    lastProcessedTextRef.current = "";
  };

  const handleCopyTranscript = () =>
    navigator.clipboard.writeText(transcript).then(() => {
      const copyBtn = document.getElementById("copyTranscriptBtn");
      copyBtn.textContent = "Copied!";
      setTimeout(
        () => (copyBtn.innerHTML = '<span class="btn-icon">📋</span> Copy'),
        2000
      );
    });

  const handleCopyTranslation = () =>
    navigator.clipboard.writeText(translation).then(() => {
      const copyBtn = document.getElementById("copyTranslationBtn");
      copyBtn.textContent = "Copied!";
      setTimeout(
        () => (copyBtn.innerHTML = '<span class="btn-icon">📋</span> Copy'),
        2000
      );
    });

  const handleSpeak = () => {
    if (isTranslating || isSpeaking || !translation) return;
    setIsSpeaking(true);
    if (synthRef.current.speaking) {
      synthRef.current.cancel();
    }
    setTimeout(() => {
      speakTranslation(translation);
    }, 100);
  };

  return (
    <div className="container">
      <div className="app-wrapper">
        <header className="header">
          <div className="logo-container">
            <div className="logo">
              <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <circle cx="50" cy="50" r="35" className="logo-circle" />
                <path d="M30,50 Q50,25 70,50 T30,50" className="logo-wave" />
                <path
                  d="M30,50 Q50,75 70,50"
                  className="logo-wave"
                  strokeDasharray="60"
                  strokeDashoffset="60"
                />
              </svg>
            </div>
            <div className="logo-text">
              <h1 className="header-title">Nao Medical</h1>
              <p className="header-subtitle">
                Real-Time Patient & Doctor Communication
              </p>
            </div>
          </div>
        </header>

        <div className="glass-card">
          <div className="language-controls">
            <div className="control-grid">
              <div className="language-select-container">
                <label htmlFor="sourceLanguage" className="language-label">
                  Source Language
                </label>
                <div className="select-wrapper">
                  <select
                    id="sourceLanguage"
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    className="language-select"
                  >
                    {languages.map((lang) => (
                      <option key={lang.value} value={lang.value}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="language-select-container">
                <label htmlFor="targetLanguage" className="language-label">
                  Target Language
                </label>
                <div className="select-wrapper">
                  <select
                    id="targetLanguage"
                    value={targetLanguage}
                    onChange={(e) => setTargetLanguage(e.target.value)}
                    className="language-select"
                  >
                    {languages.map((lang) => (
                      <option key={lang.value} value={lang.value}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="language-select-container">
                <label htmlFor="voiceSelect" className="language-label">
                  Voice
                </label>
                <div className="select-wrapper">
                  <select
                    id="voiceSelect"
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="language-select"
                  >
                    {availableVoices.length === 0 ? (
                      <option value="">Loading voices...</option>
                    ) : (
                      availableVoices.map((voice) => (
                        <option key={voice.name} value={voice.name}>
                          {voice.name} ({voice.lang})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>
            </div>

            <div className="button-group">
              <button
                onClick={handleStart}
                disabled={!isBrowserSupported || isRecognizing}
                className={`btn btn-start ${isRecognizing ? "active" : ""}`}
              >
                <span className="btn-icon">🎤</span>
                <span className="btn-text">
                  {isRecognizing ? "Listening..." : "Start"}
                </span>
                <span className="btn-hover-effect"></span>
              </button>

              <button
                onClick={handleStop}
                disabled={!isBrowserSupported || !isRecognizing}
                className="btn btn-stop"
              >
                <span className="btn-icon">⏹️</span>
                <span className="btn-text">Stop</span>
                <span className="btn-hover-effect"></span>
              </button>

              <button
                onClick={handleClear}
                disabled={!transcript && !translation}
                className="btn btn-clear"
              >
                <span className="btn-icon">🗑️</span>
                <span className="btn-text">Clear All</span>
                <span className="btn-hover-effect"></span>
              </button>
            </div>
          </div>

          {isRecognizing && (
            <div className="status-indicator">
              <div className="listening-waves">
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
              </div>
              <span className="status-text">
                Listening in{" "}
                {
                  languages.find((lang) => lang.value === selectedLanguage)
                    ?.label
                }
                ...
              </span>
            </div>
          )}

          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              {error}
              <button className="error-close" onClick={() => setError("")}>
                ×
              </button>
            </div>
          )}

          {!isBrowserSupported && (
            <div className="browser-not-supported">
              <p>
                <strong>
                  Speech recognition is not supported in this browser.
                </strong>
              </p>
              <p>Please use Chrome, Edge, or Safari for the best experience.</p>
            </div>
          )}

          <div className="panels-container">
            <div className="panel source-panel">
              <div className="panel-header">
                <h3 className="panel-title">
                  <span className="language-icon">🔤</span>
                  Transcript (
                  {
                    languages.find((lang) => lang.value === selectedLanguage)
                      ?.label
                  }
                  )
                </h3>
                <button
                  id="copyTranscriptBtn"
                  onClick={handleCopyTranscript}
                  disabled={!transcript}
                  className="btn-copy"
                >
                  <span className="btn-icon">📋</span> Copy
                </button>
              </div>
              <div className="panel-content">
                {transcript ? (
                  <div className="transcript-text">{transcript}</div>
                ) : (
                  <div className="placeholder-wrapper">
                    <div className="placeholder-animation">
                      <div className="placeholder-circle"></div>
                      <div className="placeholder-line"></div>
                    </div>
                    <span className="placeholder-text">
                      {isRecognizing
                        ? "Listening... Speak now."
                        : "Click Start to begin transcription..."}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="panel target-panel">
              <div className="panel-header">
                <h3 className="panel-title">
                  <span className="language-icon">🌐</span>
                  Translation (
                  {
                    languages.find((lang) => lang.value === targetLanguage)
                      ?.label
                  }
                  )
                </h3>
                <div className="header-buttons">
                  <button
                    onClick={handleSpeak}
                    disabled={
                      !translation ||
                      availableVoices.length === 0 ||
                      isTranslating
                    }
                    className={`btn-speak ${isSpeaking ? "speaking" : ""}`}
                  >
                    {isSpeaking ? (
                      <>
                        <span className="btn-icon pulse">⏹️</span> Stop
                      </>
                    ) : (
                      <>
                        <span className="btn-icon">🔊</span> Speak
                      </>
                    )}
                  </button>
                  <button
                    id="copyTranslationBtn"
                    onClick={handleCopyTranslation}
                    disabled={!translation}
                    className="btn-copy"
                  >
                    <span className="btn-icon">📋</span> Copy
                  </button>
                </div>
              </div>
              <div
                className={`panel-content ${
                  ["ar-SA", "ur-PK"].includes(targetLanguage) ? "rtl" : ""
                }`}
              >
                <div className="translation-content">
                  {translation && (
                    <div className="translation-text">
                      {translation}
                      {isTranslating && (
                        <span className="translation-in-progress">...</span>
                      )}
                    </div>
                  )}

                  {!translation && !isTranslating && (
                    <div className="placeholder-wrapper">
                      <div className="placeholder-animation reverse">
                        <div className="placeholder-circle"></div>
                        <div className="placeholder-line"></div>
                      </div>
                      <span className="placeholder-text">
                        Translations will appear here...
                      </span>
                    </div>
                  )}

                  {!translation && isTranslating && (
                    <div className="placeholder-wrapper">
                      <div className="placeholder-animation reverse">
                        <div className="placeholder-circle"></div>
                        <div className="placeholder-line"></div>
                      </div>
                      <span className="placeholder-text">Translating...</span>
                    </div>
                  )}

                  {isSpeaking && (
                    <div className="speaking-status">
                      <div className="speaking-waves">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                      <span>Speaking...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer className="footer">
          <p>© {new Date().getFullYear()} Nao Medical. Powered by AI.</p>
        </footer>
      </div>
    </div>
  );
}

export default SpeechTranscription;
