
"use client";

import { useEffect, useRef, useState } from "react";

import {
  FilesetResolver,
  HandLandmarker,
  DrawingUtils,
} from "@mediapipe/tasks-vision";

type WebcamMode = "translator" | "training" | "testing";

type GestureSample = {
  label: string;
  hand: string;
  features: number[];
  timestamp: string;
  session_id: string;
};

type PredictionResponse = {
  gesture: string;
  confidence: number;
};

const ALPHABET_LABELS = Array.from({ length: 26 }, (_, index) =>
  String.fromCharCode(65 + index)
);

const WORD_GESTURE_LABELS = ["HELLO", "YES", "NO", "STOP", "HELP", "WATER", "SORRY"];
const GESTURE_LABELS = [...ALPHABET_LABELS, ...WORD_GESTURE_LABELS];

const API_URL = "http://127.0.0.1:8000/predict";

// These translations cover the labels currently emitted by the Signa model.
// Alphabet labels are spoken as letter names; they are not treated as words.
const GESTURE_TRANSLATIONS: Record<string, { en: string; hi: string }> = {
  HELLO: { en: "Hello", hi: "नमस्ते" },
  YES: { en: "Yes", hi: "हाँ" },
  NO: { en: "No", hi: "नहीं" },
  STOP: { en: "Stop", hi: "रुकिए" },
  HELP: { en: "Help", hi: "मदद" },
  WATER: { en: "Water", hi: "पानी" },
  SORRY: { en: "Sorry", hi: "माफ़ कीजिए" },
  A: { en: "A", hi: "ए" }, B: { en: "B", hi: "बी" },
  C: { en: "C", hi: "सी" }, D: { en: "D", hi: "डी" },
  E: { en: "E", hi: "ई" }, F: { en: "F", hi: "एफ़" },
  G: { en: "G", hi: "जी" }, H: { en: "H", hi: "एच" },
  I: { en: "I", hi: "आई" }, J: { en: "J", hi: "जे" },
  K: { en: "K", hi: "के" }, L: { en: "L", hi: "एल" },
  M: { en: "M", hi: "एम" }, N: { en: "N", hi: "एन" },
  O: { en: "O", hi: "ओ" }, P: { en: "P", hi: "पी" },
  Q: { en: "Q", hi: "क्यू" }, R: { en: "R", hi: "आर" },
  S: { en: "S", hi: "एस" }, T: { en: "T", hi: "टी" },
  U: { en: "U", hi: "यू" }, V: { en: "V", hi: "वी" },
  W: { en: "W", hi: "डब्ल्यू" }, X: { en: "X", hi: "एक्स" },
  Y: { en: "Y", hi: "वाई" }, Z: { en: "Z", hi: "ज़ेड" },
};

export default function Webcam({
  mode = "translator",
}: {
  mode?: WebcamMode;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const lastDetectionFrameRef = useRef(0);
  const DETECTION_INTERVAL = 1000 / 30;

  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const animationRef = useRef<number | null>(null);

  const latestFeaturesRef = useRef<number[] | null>(null);
  const latestHandSideRef = useRef("Unknown");
  const previousHandsRef = useRef(-1);

  const predictionInFlightRef = useRef(false);
  const lastPredictionTimeRef = useRef(0);
  const predictionSessionRef = useRef(0);

  const [status, setStatus] = useState("Camera is off");
  const [handsDetected, setHandsDetected] = useState(0);
  const [selectedGesture, setSelectedGesture] = useState("A");
  const [captureSessionId, setCaptureSessionId] = useState("session-1");

  const [samples, setSamples] = useState<GestureSample[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [prediction, setPrediction] = useState("Waiting...");
  const [confidence, setConfidence] = useState(0);
  const [predictionStatus, setPredictionStatus] = useState(
    "Show one or both hands to begin recognition."
  );

  // Bilingual live subtitles and browser-native text-to-speech.
  const [englishSubtitle, setEnglishSubtitle] = useState("");
  const [hindiSubtitle, setHindiSubtitle] = useState("");
  const [subtitleVisible, setSubtitleVisible] = useState(true);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const autoSpeakRef = useRef(true);
  const [speechStatus, setSpeechStatus] = useState("Click Speak both once to enable playback. Hindi audio needs an installed hi-IN voice.");
  const transcriptRef = useRef({ en: "", hi: "" });
  const candidateGestureRef = useRef("");
  const candidateCountRef = useRef(0);
  const lastEmittedGestureRef = useRef("");
  const speechSessionRef = useRef(0);

  // Normalize 21 landmarks into 63 wrist-relative coordinate values.
  // Keep image-space wrist position and hand scale separately so the model
  // can also learn where each hand is positioned relative to the other.
  function normalizeLandmarks(landmarks: any[]): {
    features: number[];
    wristX: number;
    wristY: number;
    scale: number;
  } {
    const wrist = landmarks[0];
    const distances3d = landmarks.map((point) => {
      const x = point.x - wrist.x;
      const y = point.y - wrist.y;
      const z = point.z - wrist.z;
      return Math.sqrt(x * x + y * y + z * z);
    });
    const scale3d = Math.max(...distances3d, 0.000001);
    const scale2d = Math.max(
      ...landmarks.map((point) =>
        Math.hypot(point.x - wrist.x, point.y - wrist.y)
      ),
      0.000001
    );
    const features: number[] = [];

    for (const point of landmarks) {
      features.push(
        (point.x - wrist.x) / scale3d,
        (point.y - wrist.y) / scale3d,
        (point.z - wrist.z) / scale3d
      );
    }

    return {
      features,
      wristX: wrist.x,
      wristY: wrist.y,
      scale: scale2d,
    };
  }

  // Feature layout (134): left landmarks (63), right landmarks (63),
  // left wrist xy (2), right wrist xy (2), left/right scale (2),
  // left/right presence flags (2).
  function buildTrainingFeatures(results: any) {
    const emptyHand = () => ({
      features: Array(63).fill(0) as number[],
      wristX: 0,
      wristY: 0,
      scale: 0,
      present: false,
    });
    const left = emptyHand();
    const right = emptyHand();
    const landmarksList = results.landmarks ?? [];
    const handednessList = results.handedness ?? [];
    const unassigned: any[][] = [];

    // Assign reliable handedness labels first, preventing an unknown label
    // from occupying a slot needed by a later explicitly labelled hand.
    landmarksList.forEach((landmarks: any[], index: number) => {
      const side = handednessList[index]?.[0]?.categoryName;
      const target = side === "Left" ? left : side === "Right" ? right : null;
      if (!target) {
        unassigned.push(landmarks);
        return;
      }
      if (!target.present) {
        const normalized = normalizeLandmarks(landmarks);
        Object.assign(target, { ...normalized, present: true });
      } else {
        unassigned.push(landmarks);
      }
    });

    for (const landmarks of unassigned) {
      const target = !left.present ? left : !right.present ? right : null;
      if (!target) break;
      const normalized = normalizeLandmarks(landmarks);
      Object.assign(target, { ...normalized, present: true });
    }

    const features = [
      ...left.features,
      ...right.features,
      left.wristX, left.wristY,
      right.wristX, right.wristY,
      left.scale, right.scale,
      left.present ? 1 : 0,
      right.present ? 1 : 0,
    ];

    return {
      features,
      hand: left.present && right.present
        ? "Left+Right"
        : left.present
          ? "Left"
          : right.present
            ? "Right"
            : "Unknown",
    };
  }

  function translateGesture(gesture: string) {
    const normalized = gesture.trim().toUpperCase();
    return GESTURE_TRANSLATIONS[normalized] ?? {
      en: normalized,
      hi: normalized,
    };
  }

  function speakBilingually(english: string, hindi: string, interruptCurrent = true) {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      setSpeechStatus("Speech is not supported in this browser. Try the latest Chrome or Edge.");
      return;
    }

    const speech = window.speechSynthesis;
    if (interruptCurrent) {
      speechSessionRef.current += 1;
      speech.cancel();
    }
    const session = speechSessionRef.current;

    // Some Chromium browsers populate the voice list asynchronously. Read it
    // at the moment of playback and select voices by language when available.
    const voices = speech.getVoices();
    const englishVoice = voices.find((voice) => /^en(-|$)/i.test(voice.lang))
      ?? voices.find((voice) => voice.default)
      ?? null;
    const hindiVoice = voices.find((voice) => /^hi(-|$)/i.test(voice.lang)) ?? null;

    const englishUtterance = new SpeechSynthesisUtterance(english);
    englishUtterance.lang = "en-IN";
    englishUtterance.rate = 0.9;
    if (englishVoice) englishUtterance.voice = englishVoice;

    const hindiUtterance = new SpeechSynthesisUtterance(hindi);
    hindiUtterance.lang = "hi-IN";
    hindiUtterance.rate = 0.9;
    if (hindiVoice) hindiUtterance.voice = hindiVoice;

    englishUtterance.onstart = () => {
      if (session === speechSessionRef.current) setSpeechStatus(`Speaking English${englishVoice ? ` (${englishVoice.name})` : ""}…`);
    };
    englishUtterance.onerror = (event) => {
      if (session === speechSessionRef.current) {
        setSpeechStatus(`English speech failed: ${event.error}. Check your browser's speech voices and audio output.`);
      }
    };
    hindiUtterance.onstart = () => {
      if (session === speechSessionRef.current) setSpeechStatus(`Speaking Hindi${hindiVoice ? ` (${hindiVoice.name})` : ""}…`);
    };
    hindiUtterance.onend = () => {
      if (session === speechSessionRef.current) setSpeechStatus(hindiVoice
        ? "Finished speaking in English and Hindi."
        : "English played. No Hindi voice is installed/available in this browser, so Hindi audio was skipped.");
    };
    hindiUtterance.onerror = (event) => {
      if (session === speechSessionRef.current) {
        setSpeechStatus(`Hindi speech failed: ${event.error}. A Hindi (hi-IN) voice may be unavailable.`);
      }
    };

    // Always attempt English. Hindi is queued only when the browser exposes a
    // Hindi voice; otherwise we report the exact limitation instead of silently
    // speaking Hindi with an unsuitable English pronunciation.
    speech.resume();
    speech.speak(englishUtterance);
    if (hindiVoice) {
      speech.speak(hindiUtterance);
    } else {
      englishUtterance.onend = () => {
        if (session === speechSessionRef.current) {
          setSpeechStatus("English speech finished. Hindi voice (hi-IN) is missing. Install a Hindi speech voice or use a browser/device that provides one.");
        }
      };
    }
  }

  function addRecognizedGesture(gesture: string) {
    const translated = translateGesture(gesture);
    const previous = transcriptRef.current;
    const next = {
      en: [previous.en, translated.en].filter(Boolean).join(" "),
      hi: [previous.hi, translated.hi].filter(Boolean).join(" "),
    };

    transcriptRef.current = next;
    setEnglishSubtitle(next.en);
    setHindiSubtitle(next.hi);
    setSubtitleVisible(true);

    if (autoSpeakRef.current) {
      // Queue only the newly recognized token so earlier words finish speaking.
      speakBilingually(translated.en, translated.hi, false);
    }
  }

  function clearSubtitles() {
    transcriptRef.current = { en: "", hi: "" };
    setEnglishSubtitle("");
    setHindiSubtitle("");
    candidateGestureRef.current = "";
    candidateCountRef.current = 0;
    lastEmittedGestureRef.current = "";
    if ("speechSynthesis" in window) {
      speechSessionRef.current += 1;
      window.speechSynthesis.cancel();
    }
    setSpeechStatus("Subtitles cleared.");
  }

  function stopSpeech() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      speechSessionRef.current += 1;
      window.speechSynthesis.cancel();
      setSpeechStatus("Speech stopped.");
    }
  }

  function speakCurrentTranscript() {
    const current = transcriptRef.current;
    if (!current.en || !current.hi) {
      setSpeechStatus("Recognize a gesture before playing speech.");
      return;
    }
    speakBilingually(current.en, current.hi);
  }

  function handleStablePrediction(gesture: string, predictionConfidence: number) {
    if (gesture === "UNKNOWN" || predictionConfidence < 0.65) {
      candidateGestureRef.current = "";
      candidateCountRef.current = 0;
      lastEmittedGestureRef.current = "";
      return;
    }

    if (candidateGestureRef.current === gesture) {
      candidateCountRef.current += 1;
    } else {
      candidateGestureRef.current = gesture;
      candidateCountRef.current = 1;
    }

    // Require two matching API results before adding a word. This suppresses
    // one-frame prediction flicker and repeated speech while a sign is held.
    if (candidateCountRef.current >= 2 && lastEmittedGestureRef.current !== gesture) {
      lastEmittedGestureRef.current = gesture;
      addRecognizedGesture(gesture);
    }
  }

  // Send landmark features to FastAPI.
  async function predictGesture(features: number[]) {
    if (predictionInFlightRef.current) return;

    const now = Date.now();

    if (now - lastPredictionTimeRef.current < 300) return;

    predictionInFlightRef.current = true;
    lastPredictionTimeRef.current = now;

    const currentSession = predictionSessionRef.current;

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          features,
        }),
      });

      if (!response.ok) {
         const errorDetails = await response.text();

        console.error("API error status:", response.status);
        console.error("API error details:", errorDetails);

        throw new Error(
          `API error: ${response.status} - ${errorDetails}`
        );
      }

      const result: PredictionResponse = await response.json();

      if (currentSession !== predictionSessionRef.current) return;

      setPrediction(result.gesture);
      setConfidence(result.confidence);
      setPredictionStatus("Live recognition active.");
      if (mode === "translator") {
        handleStablePrediction(result.gesture, result.confidence);
      }
    } catch (error) {
      if (currentSession !== predictionSessionRef.current) return;

      console.error("Prediction error:", error);

      setPrediction("Unavailable");
      setConfidence(0);
      setPredictionStatus(
        "Could not connect to the prediction API. Check FastAPI."
      );
    } finally {
      predictionInFlightRef.current = false;
    }
  }

  // Start webcam and MediaPipe.
  async function startCamera() {
    if (isLoading || streamRef.current) return;

    try {
      setIsLoading(true);
      setStatus("Starting camera...");

      predictionSessionRef.current += 1;
      lastPredictionTimeRef.current = 0;

      setPrediction("Waiting...");
      setConfidence(0);
      setPredictionStatus("Initializing recognition...");
      if (mode === "translator") clearSubtitles();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 960 },
          height: { ideal: 540 },
          frameRate: {
            ideal: 30,
            max:30,
          },
        },
        audio: false,
      });

      streamRef.current = stream;

      const video = videoRef.current;

      if (!video) {
        throw new Error("Video element not found");
      }

      video.srcObject = stream;
      await video.play();

      setStatus("Loading MediaPipe...");

      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );

      const handLandmarker = await HandLandmarker.createFromOptions(
        vision,
        {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.45,
          minHandPresenceConfidence: 0.50,
          minTrackingConfidence: 0.65,
        }
      );

      landmarkerRef.current = handLandmarker;

      setStatus("MediaPipe ready. Show one or both hands.");
      lastDetectionFrameRef.current = 0;
      const detectHand = () => {
        const currentVideo = videoRef.current;
        const canvas = canvasRef.current;
        const detector = landmarkerRef.current;

        if (!currentVideo || !canvas || !detector) return;

        if (currentVideo.readyState < 2) {
          animationRef.current = requestAnimationFrame(detectHand);
          return;
        }
        // Limit MediaPipe inference to approximately 30 FPS.
        const now = performance.now();

        if (
          now - lastDetectionFrameRef.current <
          DETECTION_INTERVAL
        ) {
          animationRef.current = requestAnimationFrame(detectHand);
          return;
        }

        lastDetectionFrameRef.current = now;
        const ctx = canvas.getContext("2d");

        if (!ctx) return;

        if (
          canvas.width !== currentVideo.videoWidth ||
          canvas.height !== currentVideo.videoHeight
        ) {
          canvas.width = currentVideo.videoWidth;
          canvas.height = currentVideo.videoHeight;
        }

        const results = detector.detectForVideo(
          currentVideo,
          now
        );

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const drawingUtils = new DrawingUtils(ctx);
        const currentHands = results.landmarks.length;

        const handCountChanged = previousHandsRef.current !== currentHands;
        if (handCountChanged) {
          previousHandsRef.current = currentHands;
          setHandsDetected(currentHands);
        }

        if (mode === "training") {
          // Training Studio accepts one or two hands using a consistent 134-value layout.
          if (currentHands > 0) {
            const trainingData = buildTrainingFeatures(results);
            latestFeaturesRef.current = trainingData.features;
            latestHandSideRef.current = trainingData.hand;
          } else {
            latestFeaturesRef.current = null;
            latestHandSideRef.current = "Unknown";
          }

          if (handCountChanged) {
            setStatus(
              currentHands === 0
                ? "No hands detected. Show one or both hands to collect data."
                : currentHands === 1
                  ? "One hand detected. Ready to capture (the other hand slot will be zero-padded)."
                  : "Two hands detected. Ready to capture both hands."
            );
          }
        } else if (currentHands > 0) {
          // Live inference uses the same 134-value layout as the unified model:
          // 63 normalized left-hand values followed by 63 right-hand values.
          // A missing hand slot is zero-padded by buildTrainingFeatures().
          const inferenceData = buildTrainingFeatures(results);
          latestFeaturesRef.current = inferenceData.features;
          latestHandSideRef.current = inferenceData.hand;
          void predictGesture(inferenceData.features);

          if (handCountChanged) {
            setPredictionStatus(
              currentHands === 1
                ? "One hand detected. Sending 134 features with the missing hand zero-padded."
                : "Both hands detected. Sending 134 features."
            );
          }
        } else {
          latestFeaturesRef.current = null;
          latestHandSideRef.current = "Unknown";
          candidateGestureRef.current = "";
          candidateCountRef.current = 0;
          lastEmittedGestureRef.current = "";
          setPrediction("Waiting...");
          setConfidence(0);
          setPredictionStatus("No hand detected. Show one or both hands.");
        }

        // Draw landmarks for every detected hand.
        for (const landmarks of results.landmarks) {
          drawingUtils.drawConnectors(
            landmarks,
            HandLandmarker.HAND_CONNECTIONS,
            {
              color: "#22c55e",
              lineWidth: 3,
            }
          );

          drawingUtils.drawLandmarks(landmarks, {
            color: "#f97316",
            lineWidth: 2,
            radius: 4,
          });
        }

        animationRef.current = requestAnimationFrame(detectHand);
      };

      detectHand();
    } catch (error) {
      console.error("Camera / MediaPipe error:", error);

      predictionSessionRef.current += 1;

      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;

      landmarkerRef.current?.close();
      landmarkerRef.current = null;

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      setStatus(
        error instanceof Error
          ? error.message
          : "Failed to start camera"
      );

      setPredictionStatus("Camera initialization failed.");
    } finally {
      setIsLoading(false);
    }
  }

  // Capture one dataset sample.
  function captureSample() {
    const features = latestFeaturesRef.current;

    if (!features) {
      setStatus("Please show at least one hand before capturing.");
      return;
    }

    if (features.length !== 134) {
      setStatus(`Invalid training data. Expected 134 values, received ${features.length}.`);
      return;
    }

    const newSample: GestureSample = {
      label: selectedGesture,
      hand: latestHandSideRef.current,
      features: [...features],
      timestamp: new Date().toISOString(),
      session_id: captureSessionId,
    };

    setSamples((previous) => [...previous, newSample]);

    setStatus(`Sample captured for ${selectedGesture}.`);
  }

  // Export dataset as CSV.
  function exportCSV() {
    if (samples.length === 0) {
      setStatus("Collect some samples before exporting.");
      return;
    }

    const featureHeaders = [
      ...Array.from(
        { length: 21 },
        (_, index) => [`left_x${index}`, `left_y${index}`, `left_z${index}`]
      ).flat(),
      ...Array.from(
        { length: 21 },
        (_, index) => [`right_x${index}`, `right_y${index}`, `right_z${index}`]
      ).flat(),
      "left_wrist_x", "left_wrist_y",
      "right_wrist_x", "right_wrist_y",
      "left_hand_scale", "right_hand_scale",
      "left_present", "right_present",
    ];

    const headers = [
      "label",
      "hand",
      "timestamp",
      "session_id",
      ...featureHeaders,
    ];

    const rows = samples.map((sample) => [
      sample.label,
      sample.hand,
      sample.timestamp,
      sample.session_id,
      ...sample.features,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "isl_alphabet_dataset.csv";
    link.click();

    URL.revokeObjectURL(url);

    setStatus("Dataset exported successfully.");
  }

  // Stop camera.
  function stopCamera() {
    predictionSessionRef.current += 1;

    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    landmarkerRef.current?.close();
    landmarkerRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    latestFeaturesRef.current = null;
    latestHandSideRef.current = "Unknown";
    previousHandsRef.current = -1;
    lastPredictionTimeRef.current = 0;

    setHandsDetected(0);
    setPrediction("Waiting...");
    setConfidence(0);
    setPredictionStatus("Camera stopped.");
    candidateGestureRef.current = "";
    candidateCountRef.current = 0;
    lastEmittedGestureRef.current = "";
    stopSpeech();
    setStatus("Camera is off");
    setIsLoading(false);
  }

  function removeLastSample() {
    setSamples((previous) => previous.slice(0, -1));
  }

  function clearDataset() {
    setSamples([]);
    setStatus("Dataset cleared.");
  }

  function startNewCaptureSession() {
    const nextSession = `session-${Date.now()}`;
    setCaptureSessionId(nextSession);
    setStatus(`Started ${nextSession}.`);
  }

  const currentGestureCount = samples.filter(
    (sample) => sample.label === selectedGesture
  ).length;

  const alphabetSampleCount = samples.filter((sample) =>
    ALPHABET_LABELS.includes(sample.label)
  ).length;

  const currentSessionSampleCount = samples.filter(
    (sample) => sample.session_id === captureSessionId
  ).length;

  // Cleanup when component unmounts.
  useEffect(() => {
    return () => {
      predictionSessionRef.current += 1;

      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
      landmarkerRef.current?.close();
      speechSessionRef.current += 1;
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Shared camera preview.
  const cameraPreview = (
    <div className="relative aspect-video max-h-[340px] w-full overflow-hidden rounded-xl bg-black">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover"
      />

      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
      />

      {!streamRef.current && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#05080f] text-sm text-slate-500">
          Camera is off
        </div>
      )}
    </div>
  );

  // Shared camera buttons.
  const cameraControls = (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={startCamera}
        disabled={isLoading || !!streamRef.current}
        className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isLoading ? "Starting..." : "Start Camera"}
      </button>

      <button
        onClick={stopCamera}
        className="rounded-lg border border-slate-700 bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
      >
        Stop Camera
      </button>
    </div>
  );

  // Shared prediction panel.
  const predictionPanel = (
    <section className="rounded-2xl border border-slate-800 bg-[#101827] p-5">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-400">
        {mode === "testing" ? "Model test result" : "Recognition result"}
      </p>

      <p className="mt-4 text-sm text-slate-400">
        Detected gesture
      </p>

      <p className="mt-1 break-words text-4xl font-bold text-white">
        {prediction}
      </p>

      <div className="mt-6 flex items-center justify-between">
        <span className="text-sm text-slate-400">Confidence</span>
        <span className="text-xl font-bold text-indigo-400">
          {(confidence * 100).toFixed(1)}%
        </span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-indigo-500 transition-all duration-300"
          style={{
            width: `${Math.min(confidence * 100, 100)}%`,
          }}
        />
      </div>

      <p className="mt-5 text-sm leading-6 text-slate-400">
        {predictionStatus}
      </p>
    </section>
  );

  return (
    <div className="mx-auto w-full max-w-6xl text-slate-100">

      {/* LIVE TRANSLATOR */}
      {mode === "translator" && (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl border border-slate-800 bg-[#101827] p-3">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">
                Live Camera
              </h2>

              <span className="text-xs text-slate-400">
                {handsDetected} / 2 hands detected
              </span>
            </div>

            {cameraPreview}

            <div className="mt-3">
              {cameraControls}
            </div>
          </section>

          <div className="space-y-4">
            {predictionPanel}

            <section className="rounded-2xl border border-slate-800 bg-[#101827] p-4">
              <p className="text-sm font-semibold text-white">
                Camera status
              </p>

              <p className="mt-2 text-sm text-slate-400">
                {status}
              </p>

              <p className="mt-3 text-xs leading-5 text-slate-500">
                The detector and unified model use 134 values: 63 normalized landmarks per hand,
                wrist positions, hand scales, and presence flags. Missing-hand values are zeroed.
              </p>
            </section>
          </div>
        </div>
      )}

      {/* BILINGUAL SUBTITLES + TEXT TO SPEECH */}
      {mode === "translator" && (
        <section className="mt-4 rounded-2xl border border-slate-800 bg-[#101827] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white">Live subtitles · English + हिन्दी</h2>
              <p className="mt-1 text-xs text-slate-400">Stable recognized gestures are added to both transcript lines.</p>
            </div>
            <button
              type="button"
              onClick={() => setSubtitleVisible((visible) => !visible)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700"
            >
              {subtitleVisible ? "Hide subtitles" : "Show subtitles"}
            </button>
          </div>

          {subtitleVisible && (
            <div aria-live="polite" aria-atomic="true" className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="min-h-28 rounded-xl border border-indigo-500/20 bg-[#0b1220] p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-300">English</p>
                <p className="mt-3 break-words text-lg font-semibold leading-8 text-white">{englishSubtitle || "Your recognized words will appear here…"}</p>
              </div>
              <div className="min-h-28 rounded-xl border border-emerald-500/20 bg-[#0b1220] p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-300">हिन्दी</p>
                <p lang="hi" className="mt-3 break-words text-lg font-semibold leading-8 text-white">{hindiSubtitle || "पहचाने गए शब्द यहाँ दिखाई देंगे…"}</p>
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={speakCurrentTranscript}
              disabled={!englishSubtitle || !hindiSubtitle}
              className="rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span aria-hidden="true">▶ </span>Speak both
            </button>
            <button
              type="button"
              onClick={stopSpeech}
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-700"
            >
              Stop speech
            </button>
            <button
              type="button"
              onClick={clearSubtitles}
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-700"
            >
              Clear subtitles
            </button>
            <label className="ml-1 flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={autoSpeak}
                onChange={(event) => {
                  autoSpeakRef.current = event.target.checked;
                  setAutoSpeak(event.target.checked);
                }}
                className="h-4 w-4 accent-indigo-500"
              />
              Auto-speak new gestures
            </label>
          </div>
          <p className="mt-3 text-xs text-slate-500" role="status">{speechStatus}</p>
          <p className="mt-2 text-[11px] leading-5 text-slate-500">
            Speech uses voices available in your browser/operating system. Hindi playback requires a Hindi voice (hi-IN); if it is missing, install a Hindi speech voice or use a browser/device that provides one.
            The current built-in dictionary covers A–Z and HELLO, YES, NO, STOP, HELP, WATER and SORRY. Other model labels are shown as-is until translations are added.
          </p>
        </section>
      )}

      {/* TRAINING STUDIO */}
      {mode === "training" && (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <section className="rounded-2xl border border-slate-800 bg-[#101827] p-3">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">
                Training Camera
              </h2>

              <span className="text-xs text-slate-400">
                {handsDetected} / 2 hands
              </span>
            </div>

            {cameraPreview}

            <div className="mt-3">
              {cameraControls}
            </div>

            <div className="mt-3 rounded-lg border border-slate-800 bg-[#0b1220] p-3">
              <p className="text-xs font-semibold text-slate-300">
                Detection status
              </p>

              <p className="mt-1 text-sm text-slate-400">
                {status}
              </p>

              <p className="mt-2 text-xs text-slate-500">
                {handsDetected === 2
                  ? "Two hands detected. Both hands will be saved in this sample."
                  : handsDetected === 1
                    ? "One hand detected. The missing hand slot will be zero-padded."
                    : "Show one or both hands to capture a sample."}
              </p>
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-slate-800 bg-[#101827] p-4">
            <div>
              <h2 className="text-lg font-bold text-white">
                ISL Dataset Collector
              </h2>

              <p className="mt-1 text-xs text-slate-400">
                Collect one-hand or two-hand gestures using a consistent left/right landmark layout.
              </p>
            </div>

            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-300">Capture session</p>
                  <p className="mt-1 text-sm font-semibold text-white">{captureSessionId}</p>
                </div>
                <button
                  onClick={startNewCaptureSession}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                >
                  New session
                </button>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                Start a new session when you change the recording day, lighting, location, or setup.
                Session IDs let us evaluate the model on a separate capture session.
              </p>
            </div>

            <div>
              <label
                htmlFor="gesture"
                className="mb-2 block text-sm font-semibold text-slate-300"
              >
                Select ISL alphabet / gesture
              </label>

              <select
                id="gesture"
                value={selectedGesture}
                onChange={(event) => setSelectedGesture(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#0b1220] px-3 py-3 text-sm text-white outline-none focus:border-indigo-500"
              >
                <optgroup label="Alphabet labels (A–Z)">
                  {ALPHABET_LABELS.map((letter) => (
                    <option key={letter} value={letter}>{letter}</option>
                  ))}
                </optgroup>
                <optgroup label="Existing word gestures">
                  {WORD_GESTURE_LABELS.map((gesture) => (
                    <option key={gesture} value={gesture}>{gesture}</option>
                  ))}
                </optgroup>
              </select>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Select the label matching the exact sign in your chosen ISL reference chart.
                This collector records static snapshots with separate left- and right-hand slots.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[#0b1220] p-3">
                <p className="text-xs text-slate-400">Samples for {selectedGesture}</p>
                <p className="mt-1 text-2xl font-bold text-white">{currentGestureCount}</p>
              </div>
              <div className="rounded-xl bg-[#0b1220] p-3">
                <p className="text-xs text-slate-400">Alphabet samples</p>
                <p className="mt-1 text-2xl font-bold text-white">{alphabetSampleCount}</p>
              </div>
              <div className="rounded-xl bg-[#0b1220] p-3">
                <p className="text-xs text-slate-400">Current session samples</p>
                <p className="mt-1 text-2xl font-bold text-white">{currentSessionSampleCount}</p>
              </div>
              <div className="rounded-xl bg-[#0b1220] p-3">
                <p className="text-xs text-slate-400">All samples</p>
                <p className="mt-1 text-2xl font-bold text-white">{samples.length}</p>
              </div>
            </div>

            <button
              onClick={captureSample}
              disabled={handsDetected === 0 || !streamRef.current}
              className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Capture Sample for {selectedGesture}
            </button>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-300">Alphabet dataset breakdown</h3>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-7">
                {ALPHABET_LABELS.map((letter) => {
                  const count = samples.filter((sample) => sample.label === letter).length;
                  return (
                    <button
                      key={letter}
                      type="button"
                      onClick={() => setSelectedGesture(letter)}
                      className={`rounded-lg border px-2 py-2 text-center ${
                        selectedGesture === letter
                          ? "border-indigo-500 bg-indigo-500/15"
                          : "border-slate-800 bg-[#0b1220]"
                      }`}
                    >
                      <span className="block text-sm font-bold text-white">{letter}</span>
                      <span className="mt-1 block text-[10px] text-slate-400">{count} samples</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <p className="text-xs font-semibold text-amber-200">Collection guidance</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 text-slate-400">
                <li>Use the correct ISL reference for each label; do not assume every English manual-alphabet chart matches ISL.</li>
                <li>Vary hand distance, position, rotation, and lighting. Avoid saving many identical consecutive frames.</li>
                <li>Collect across multiple sessions and, if possible, multiple signers.</li>
                <li>This collector stores static snapshots. Motion-based letters need a sequence collector/model and should not be trained from one frame alone.</li>
              </ul>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={exportCSV}
                disabled={samples.length === 0}
                className="rounded-lg bg-indigo-600 px-2 py-3 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Export CSV
              </button>

              <button
                onClick={removeLastSample}
                disabled={samples.length === 0}
                className="rounded-lg bg-amber-600 px-2 py-3 text-xs font-semibold text-white transition-colors hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Undo Last
              </button>

              <button
                onClick={clearDataset}
                disabled={samples.length === 0}
                className="rounded-lg bg-red-700 px-2 py-3 text-xs font-semibold text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Clear Data
              </button>
            </div>
          </section>
        </div>
      )}

      {/* MODEL TESTING */}
      {mode === "testing" && (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl border border-slate-800 bg-[#101827] p-3">
            <h2 className="mb-3 text-sm font-semibold text-white">
              Testing Camera
            </h2>

            {cameraPreview}

            <div className="mt-3">
              {cameraControls}
            </div>
          </section>

          <div className="space-y-4">
            {predictionPanel}

            <section className="rounded-2xl border border-slate-800 bg-[#101827] p-4">
              <p className="text-sm font-semibold text-white">
                Test information
              </p>

              <p className="mt-2 text-sm text-slate-400">
                {status}
              </p>

              <p className="mt-2 text-sm text-slate-400">
                Hands detected: {handsDetected} / 2
              </p>

              <p className="mt-3 text-xs leading-5 text-slate-500">
                The unified model receives 134 values, including both hands' landmarks,
                wrist positions, hand scales, and presence flags.
              </p>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
