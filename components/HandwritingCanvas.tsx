import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, Dimensions } from 'react-native';
import { Canvas, Path as SkPathComponent, Skia, useCanvasRef, Group } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useAttemptCanvasStore, type Stroke, type StrokePoint } from '../stores/attemptStore';
import { snapshotCanvasToPng } from '../services/stepExport';
import { uploadStepPng } from '../services/stepUpload';
import { supabase } from '../lib/supabase';
import * as FileSystem from 'expo-file-system/legacy';
import { invokeOcrLatex } from '../services/stepOCR';
import { invokeSolveStep, type ValidationResult, type ValidationStatus } from '../services/stepValidate';
import { computeHint, type HintResult } from '../services/hints';
import { requestHintSpeech, type TtsResponse, fetchHintSpeechUrl } from '../services/hintVoice';
import { Audio } from 'expo-av';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CANVAS_WIDTH = SCREEN_WIDTH;
const LINE_HEIGHT = 80;
const INITIAL_LINES = 2; // Start with just problem line + 1 empty line
const LINE_NUMBER_WIDTH = 40;
const PROBLEM_LINE_INDEX = 0; // Problem is displayed on the first line

type AttemptMeta = { attemptId: string; userId: string };
type LineStatus = 'empty' | 'current' | 'correct' | 'incorrect' | 'uncertain';

interface LineData {
  index: number;
  status: LineStatus;
  hint?: string;
  hintExpanded?: boolean;
}

interface HandwritingCanvasProps {
  problemBody?: string;
  onSolved?: () => void;
}

const COLORS = ['#0EA5E9', '#111111', '#16a34a', '#f59e0b', '#ef4444', '#8B5CF6'];
const WIDTHS = [3, 5, 7, 9];

function splitMultiLineLatex(input: string): string {
  const raw = (input ?? '').replace(/\r\n|\r|\n/g, '\\\\');
  const parts = raw.split(/\\\\+/).map((s) => s.trim()).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : (input ?? '').trim();
}

function pathFromPoints(points: StrokePoint[]) {
  const p = Skia.Path.Make();
  if (points.length === 0) return p;
  p.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    p.lineTo(points[i].x, points[i].y);
  }
  return p;
}

function getStatusColor(status: LineStatus): string {
  switch (status) {
    case 'correct': return '#16a34a';
    case 'incorrect': return '#ef4444';
    case 'current': return '#0EA5E9';
    case 'uncertain': return '#f59e0b';
    default: return '#E5E7EB';
  }
}

export default function HandwritingCanvas({ problemBody, onSolved }: HandwritingCanvasProps) {
  const canvasRef = useCanvasRef();
  const scrollViewRef = useRef<ScrollView>(null);
  const strokeIdRef = useRef<string | null>(null);
  const hintSoundRef = useRef<Audio.Sound | null>(null);

  const [lineCount, setLineCount] = useState(INITIAL_LINES);
  const [lines, setLines] = useState<LineData[]>(() =>
    Array.from({ length: INITIAL_LINES }, (_, i) => ({
      index: i + 1,
      status: i === 0 ? 'current' : 'empty' as LineStatus
    }))
  );
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [clearConfirmPending, setClearConfirmPending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastValidation, setLastValidation] = useState<ValidationResult | null>(null);
  const [attemptMeta, setAttemptMeta] = useState<AttemptMeta | null>(null);
  const [lastHint, setLastHint] = useState<HintResult | null>(null);
  const [hintAudio, setHintAudio] = useState<TtsResponse | null>(null);
  const [isPlayingHint, setIsPlayingHint] = useState(false);
  const [consecutiveNonProgress, setConsecutiveNonProgress] = useState(0);
  const [snapshotOnlyActive, setSnapshotOnlyActive] = useState(false);
  const [snapshotScale, setSnapshotScale] = useState(1);
  const [expandedHints, setExpandedHints] = useState<Set<number>>(new Set());
  const [inlineHint, setInlineHint] = useState<{ lineIndex: number; hint: HintResult } | null>(null);

  const canvasHeight = lineCount * LINE_HEIGHT + 20;

  const debug = Constants.expoConfig?.extra?.EXPO_PUBLIC_DEBUG === 'true';
  const voiceHintsEnabled = Constants.expoConfig?.extra?.EXPO_PUBLIC_VOICE_HINTS_ENABLED === 'true';

  useEffect(() => {
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false }).catch((err) => {
      console.warn('Audio mode setup failed:', err);
    });
    return () => {
      if (hintSoundRef.current) {
        hintSoundRef.current.unloadAsync().catch(() => undefined);
        hintSoundRef.current = null;
      }
    };
  }, []);

  const {
    mode,
    color,
    strokeWidth,
    activeStrokes,
    committedLayers,
    stepIndex,
    setToolMode,
    setColor,
    setStrokeWidth,
    startStroke,
    addPoint,
    undo,
    commitStepLocal,
    clearAll,
    hydrateFromRemote,
  } = useAttemptCanvasStore();

  // Reset canvas when problem changes
  useEffect(() => {
    clearAll();
    setLastValidation(null);
    setLastHint(null);
    setInlineHint(null);
    setHintAudio(null);
    setConsecutiveNonProgress(0);
    setAttemptMeta(null);
    setLines(Array.from({ length: INITIAL_LINES }, (_, i) => ({
      index: i + 1,
      status: i === 0 ? 'current' : 'empty' as LineStatus
    })));
    setLineCount(INITIAL_LINES);
    setExpandedHints(new Set());
  }, [problemBody, clearAll]);

  const stopHintAudio = useCallback(async () => {
    if (!hintSoundRef.current) return;
    try {
      await hintSoundRef.current.stopAsync();
    } catch { /* ignore */ }
    await hintSoundRef.current.unloadAsync().catch(() => undefined);
    hintSoundRef.current = null;
    setIsPlayingHint(false);
  }, []);

  const playHintAudio = useCallback(async () => {
    if (!hintAudio) return;
    try {
      setIsPlayingHint(true);
      if (hintSoundRef.current) {
        await hintSoundRef.current.stopAsync().catch(() => undefined);
        await hintSoundRef.current.unloadAsync().catch(() => undefined);
        hintSoundRef.current = null;
      }
      const { sound } = await Audio.Sound.createAsync(
        { uri: hintAudio.audioUrl },
        { shouldPlay: true }
      );
      hintSoundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status || !('isLoaded' in status) || !status.isLoaded) return;
        if (status.didJustFinish || !status.isPlaying) {
          setIsPlayingHint(false);
          sound.unloadAsync().catch(() => undefined);
          if (hintSoundRef.current === sound) {
            hintSoundRef.current = null;
          }
        }
      });
      await sound.playAsync();
    } catch (err) {
      console.warn('Hint audio playback failed:', err);
      setIsPlayingHint(false);
    }
  }, [hintAudio]);

  const ensureStrokeStart = useCallback(() => {
    if (!strokeIdRef.current) {
      strokeIdRef.current = startStroke();
    }
    return strokeIdRef.current;
  }, [startStroke]);

  const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);
  const lastPtRef = useRef<StrokePoint | null>(null);
  const minPointDist = 1.5;

  const canvasDrawWidth = CANVAS_WIDTH - LINE_NUMBER_WIDTH - 50;

  const addNewLine = useCallback(() => {
    setLineCount(prev => prev + 1);
    setLines(prev => [...prev, {
      index: prev.length + 1,
      status: 'empty' as LineStatus
    }]);
  }, []);

  // Track if we need to add a new line when drawing on the last line
  const checkAndAddLine = useCallback((y: number) => {
    const currentLineIndex = Math.floor(y / LINE_HEIGHT);
    // If drawing on the last visible line (excluding problem line), add a new line
    if (currentLineIndex >= lineCount - 1 && currentLineIndex > 0) {
      addNewLine();
    }
  }, [lineCount, addNewLine]);

  const panGesture = useMemo(() => {
    return Gesture.Pan()
      .runOnJS(true)
      .minDistance(0)
      .onBegin((e) => {
        const id = ensureStrokeStart();
        const x = clamp(e.x, 0, canvasDrawWidth);
        const y = clamp(e.y, 0, canvasHeight);
        lastPtRef.current = { x, y };
        addPoint(id, { x, y });
        // Check if we need to add a new line
        checkAndAddLine(y);
      })
      .onChange((e) => {
        const id = strokeIdRef.current ?? ensureStrokeStart();
        const x = clamp(e.x, 0, canvasDrawWidth);
        const y = clamp(e.y, 0, canvasHeight);
        const last = lastPtRef.current;
        if (!last || Math.hypot(x - last.x, y - last.y) >= minPointDist) {
          addPoint(id, { x, y });
          lastPtRef.current = { x, y };
        }
      })
      .onEnd(() => {
        strokeIdRef.current = null;
        lastPtRef.current = null;
      });
  }, [addPoint, ensureStrokeStart, canvasHeight, canvasDrawWidth, checkAndAddLine]);

  // Draw line guides
  const guides = useMemo(() => {
    const elements: React.ReactElement[] = [];
    for (let i = 0; i < lineCount; i++) {
      const y = (i + 1) * LINE_HEIGHT;
      const p = Skia.Path.Make();
      p.moveTo(0, y);
      p.lineTo(canvasDrawWidth, y);
      elements.push(
        <SkPathComponent
          key={`line-${i}`}
          path={p}
          style="stroke"
          strokeWidth={2}
          color="#D1D5DB"
        />
      );
    }
    return elements;
  }, [lineCount, canvasDrawWidth]);

  const renderStroke = (stroke: Stroke) => (
    <SkPathComponent
      key={stroke.id}
      path={pathFromPoints(stroke.points)}
      style="stroke"
      strokeWidth={stroke.width}
      color={stroke.isEraser ? 'black' : stroke.color}
      blendMode={stroke.isEraser ? 'clear' : undefined}
      strokeJoin="round"
      strokeCap="round"
    />
  );

  async function ensureAttemptId(): Promise<AttemptMeta> {
    if (attemptMeta) return attemptMeta;

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) throw new Error('No authenticated user');

    const { data: existing, error: qErr } = await supabase
      .from('attempts')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'in_progress')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (qErr) throw qErr;
    if (existing?.id) {
      const meta: AttemptMeta = { userId, attemptId: existing.id };
      setAttemptMeta(meta);
      return meta;
    }

    const { data: ins, error: iErr } = await supabase
      .from('attempts')
      .insert({ user_id: userId, status: 'in_progress' })
      .select('id')
      .single();
    if (iErr) throw iErr;
    const meta: AttemptMeta = { userId, attemptId: ins.id };
    setAttemptMeta(meta);
    return meta;
  }

  const updateLineStatus = useCallback((lineIndex: number, status: LineStatus, hint?: string) => {
    setLines(prev => prev.map((line, i) => {
      if (i === lineIndex) {
        return { ...line, status, hint };
      }
      if (i === lineIndex + 1 && status !== 'empty') {
        return { ...line, status: 'current' as LineStatus };
      }
      return line;
    }));
  }, []);

  const toggleHintExpanded = useCallback((lineIndex: number) => {
    setExpandedHints(prev => {
      const next = new Set(prev);
      if (next.has(lineIndex)) {
        next.delete(lineIndex);
      } else {
        next.add(lineIndex);
      }
      return next;
    });
  }, []);

  const onCommit = useCallback(async () => {
    if (busy) return;
    if (activeStrokes.length === 0) return;
    setBusy(true);

    const idx = stepIndex;
    const vectorJson = activeStrokes;

    try {
      setSnapshotOnlyActive(true);
      await new Promise((r) => setTimeout(r, 30));
      canvasRef.current?.redraw?.();
      await new Promise((r) => requestAnimationFrame(() => r(undefined)));

      let bytes: Uint8Array | null = null;
      let lastFileUri: string | null = null;
      let scale = 1;
      const MAX = 2_000_000;

      for (let i = 0; i < 6; i++) {
        setSnapshotScale(scale);
        await new Promise((r) => requestAnimationFrame(() => r(undefined)));
        const res = await snapshotCanvasToPng(canvasRef, { filename: `step-${Date.now()}.png` });
        bytes = res.bytes;
        lastFileUri = res.fileUri;
        if (bytes.byteLength <= MAX) break;
        scale *= 0.85;
        if (scale < 0.4) break;
      }
      if (!bytes) throw new Error('Snapshot failed');

      commitStepLocal();

      // Add new line if needed
      if (stepIndex >= lineCount - 1) {
        addNewLine();
      }

      // Update current line status (idx + 1 because lines[0] is the problem line)
      updateLineStatus(idx + 1, 'current');

      const { userId, attemptId } = await ensureAttemptId();
      const up = await uploadStepPng({ userId, attemptId, stepIndex: idx, bytes, vectorJson });

      if (!up?.stepId) throw new Error('No stepId returned');
      if (!lastFileUri) throw new Error('No snapshot file path');

      const encoding: any = (FileSystem as any).EncodingType?.Base64 ?? 'base64';
      const base64 = await FileSystem.readAsStringAsync(lastFileUri, { encoding });

      try {
        const ocr = await invokeOcrLatex({ attemptId, stepId: up.stepId, imageBase64: base64 });

        await supabase
          .from('attempt_steps')
          .update({ ocr_latex: ocr.latex, ocr_confidence: ocr.confidence })
          .eq('id', up.stepId);

        // Validation logic
        let problemText: string | null = problemBody || null;

        if (!problemText) {
          const { data: att } = await supabase
            .from('attempts')
            .select('problem_id')
            .eq('id', attemptId)
            .single();

          if (att?.problem_id) {
            const { data: prob } = await supabase
              .from('problems')
              .select('body')
              .eq('id', att.problem_id)
              .single();
            problemText = prob?.body ?? null;
          }
        }

        if (!problemText && idx === 0) {
          problemText = splitMultiLineLatex(ocr.latex);
        }

        if (problemText) {
          let prevLatex: string | undefined = undefined;
          if (idx > 0) {
            const { data: prev } = await supabase
              .from('attempt_steps')
              .select('ocr_latex')
              .eq('attempt_id', attemptId)
              .eq('step_index', idx - 1)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            prevLatex = prev?.ocr_latex ?? undefined;
          }
          // For idx === 0, prevLatex stays undefined (first user step compares to problem)

          const processedCurr = splitMultiLineLatex(ocr.latex);
          const validation = await invokeSolveStep({ prevLatex, currLatex: processedCurr, problem: problemText });
          setLastValidation(validation);

          let nextConsecutive = consecutiveNonProgress;
          let hintPayload: HintResult | null = null;
          let lineStatus: LineStatus = 'uncertain';

          if (validation.status === 'correct_useful') {
            nextConsecutive = 0;
            lineStatus = 'correct';
            setInlineHint(null); // Clear hint on success
            onSolved?.();
          } else if (validation.status === 'correct_not_useful') {
            nextConsecutive = consecutiveNonProgress + 1;
            lineStatus = 'uncertain';
            hintPayload = computeHint({ status: validation.status, consecutiveNonProgress: nextConsecutive });
            // Show hint inline after the next line (idx + 2 because line 0 is problem, idx+1 is where user wrote)
            if (hintPayload) setInlineHint({ lineIndex: idx + 2, hint: hintPayload });
          } else if (validation.status === 'incorrect') {
            nextConsecutive = consecutiveNonProgress + 1;
            lineStatus = 'incorrect';
            hintPayload = computeHint({ status: validation.status, consecutiveNonProgress: nextConsecutive });
            // Show hint inline after the next line
            if (hintPayload) setInlineHint({ lineIndex: idx + 2, hint: hintPayload });
          } else {
            nextConsecutive = consecutiveNonProgress + 1;
            lineStatus = 'uncertain';
            hintPayload = computeHint({ status: validation.status, consecutiveNonProgress: nextConsecutive });
            // Show hint inline after the next line
            if (hintPayload) setInlineHint({ lineIndex: idx + 2, hint: hintPayload });
          }

          setConsecutiveNonProgress(nextConsecutive);
          setLastHint(hintPayload);
          updateLineStatus(idx + 1, lineStatus, hintPayload?.text);

          // Persist validation
          await supabase
            .from('attempt_steps')
            .update({
              validation_status: validation.status,
              validation_reason: validation.reason,
              solver_metadata: validation.solverMetadata ?? null,
              hint_level: hintPayload ? hintPayload.level : 0,
              hint_text: hintPayload ? hintPayload.text : null,
            })
            .eq('id', up.stepId);
        }
      } catch (ocrErr) {
        console.warn('OCR failed:', ocrErr);
        updateLineStatus(idx + 1, 'uncertain');
      }
    } catch (e) {
      console.warn('Commit failed:', e);
    } finally {
      setSnapshotOnlyActive(false);
      setSnapshotScale(1);
      setBusy(false);
    }
  }, [activeStrokes.length, busy, canvasRef, commitStepLocal, consecutiveNonProgress, stepIndex, lineCount, problemBody, onSolved, addNewLine, updateLineStatus]);

  const handleClear = useCallback(async () => {
    clearAll();
    await stopHintAudio();
    setLastValidation(null);
    setLastHint(null);
    setInlineHint(null);
    setHintAudio(null);
    setConsecutiveNonProgress(0);
    setLines(Array.from({ length: INITIAL_LINES }, (_, i) => ({
      index: i + 1,
      status: i === 0 ? 'current' : 'empty' as LineStatus
    })));
    setLineCount(INITIAL_LINES);
    setExpandedHints(new Set());

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (userId) {
        const { data: att } = await supabase
          .from('attempts')
          .select('id')
          .eq('user_id', userId)
          .eq('status', 'in_progress')
          .limit(1)
          .maybeSingle();
        if (att?.id) {
          await supabase
            .from('attempts')
            .update({ status: 'completed', problem_id: null })
            .eq('id', att.id);
          setAttemptMeta(null);
        }
      }
    } catch (e) {
      console.warn('Clear failed:', e);
    }
  }, [clearAll, stopHintAudio]);

  // Reset clear confirmation after 3 seconds if not confirmed
  useEffect(() => {
    if (clearConfirmPending) {
      const timeout = setTimeout(() => {
        setClearConfirmPending(false);
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [clearConfirmPending]);

  const handleClearPress = useCallback(() => {
    if (clearConfirmPending) {
      // Second press - actually clear
      setClearConfirmPending(false);
      handleClear();
    } else {
      // First press - show confirmation
      setClearConfirmPending(true);
    }
  }, [clearConfirmPending, handleClear]);

  // Expandable Pen Settings Panel (drops down from top right)
  const ExpandedSettings = () => {
    if (!settingsExpanded) return null;

    return (
      <View
        style={{
          position: 'absolute',
          top: 56,
          right: 12,
          backgroundColor: 'white',
          borderRadius: 16,
          padding: 12,
          shadowColor: '#000',
          shadowOpacity: 0.15,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 8,
          width: 140,
          zIndex: 100,
        }}
      >
        {/* Colors - 2 columns, 3 rows */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: '600', color: '#9CA3AF', marginBottom: 8, textTransform: 'uppercase' }}>Color</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setColor(c)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: c,
                  borderWidth: c === color ? 2 : 0,
                  borderColor: '#1F2937',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {c === color && <Ionicons name="checkmark" size={16} color="white" />}
              </Pressable>
            ))}
          </View>
        </View>

        {/* Thickness - 2 columns, 2 rows */}
        <View>
          <Text style={{ fontSize: 11, fontWeight: '600', color: '#9CA3AF', marginBottom: 8, textTransform: 'uppercase' }}>Size</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {WIDTHS.map((w) => (
              <Pressable
                key={w}
                onPress={() => setStrokeWidth(w)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  backgroundColor: w === strokeWidth ? '#E0F2FE' : '#F3F4F6',
                  borderWidth: w === strokeWidth ? 2 : 0,
                  borderColor: '#0EA5E9',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View
                  style={{
                    width: w * 1.5,
                    height: w * 1.5,
                    backgroundColor: color,
                    borderRadius: w
                  }}
                />
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#FDF8F3' }}>
      {/* Top Right Toolbar */}
      <View
        style={{
          position: 'absolute',
          top: 8,
          right: 12,
          zIndex: 50,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        {/* Pen/Eraser Toggle */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: '#F3F4F6',
            borderRadius: 18,
            padding: 4,
            gap: 2,
          }}
        >
          <Pressable
            onPress={() => setToolMode('pen')}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 14,
              backgroundColor: mode === 'pen' ? '#0EA5E9' : 'transparent',
            }}
          >
            <Ionicons name="pencil" size={18} color={mode === 'pen' ? 'white' : '#6B7280'} />
          </Pressable>
          <Pressable
            onPress={() => setToolMode('eraser')}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 14,
              backgroundColor: mode === 'eraser' ? '#0EA5E9' : 'transparent',
            }}
          >
            <Ionicons name="cut-outline" size={18} color={mode === 'eraser' ? 'white' : '#6B7280'} />
          </Pressable>
        </View>

        {/* Undo Button */}
        <Pressable
          onPress={undo}
          style={({ pressed }) => ({
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: pressed ? '#E5E7EB' : '#F3F4F6',
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          <Ionicons name="arrow-undo" size={18} color="#6B7280" />
        </Pressable>

        {/* Clear Button - with confirmation */}
        <Pressable
          onPress={handleClearPress}
          style={({ pressed }) => ({
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: clearConfirmPending
              ? '#EF4444'
              : pressed ? '#FEE2E2' : '#F3F4F6',
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          <Ionicons
            name={clearConfirmPending ? "trash" : "trash-outline"}
            size={18}
            color={clearConfirmPending ? 'white' : '#EF4444'}
          />
        </Pressable>

        {/* Color/Settings Button */}
        <Pressable
          onPress={() => setSettingsExpanded(!settingsExpanded)}
          style={({ pressed }) => ({
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: settingsExpanded ? '#0EA5E9' : pressed ? '#E0F2FE' : '#F3F4F6',
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          <View
            style={{
              width: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: settingsExpanded ? 'white' : color,
              borderWidth: 2,
              borderColor: settingsExpanded ? 'white' : '#E5E7EB',
            }}
          />
        </Pressable>
      </View>

      <ExpandedSettings />

      {/* Canvas Area with Line Numbers */}
      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ minHeight: canvasHeight + (inlineHint && inlineHint.hint ? 80 : 0) }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: 'row', flex: 1 }}>
          {/* Line Numbers Column */}
          <View style={{ width: LINE_NUMBER_WIDTH, paddingTop: LINE_HEIGHT / 2 - 12 }}>
            {lines.map((line, i) => (
              <React.Fragment key={i}>
                <View
                  style={{
                    height: LINE_HEIGHT,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {i === PROBLEM_LINE_INDEX ? (
                    /* Problem indicator - "Q" for question */
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: '#0EA5E9',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text
                        style={{
                          color: 'white',
                          fontSize: 13,
                          fontWeight: '700'
                        }}
                      >
                        1
                      </Text>
                    </View>
                  ) : (
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: getStatusColor(line.status),
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text
                        style={{
                          color: line.status === 'empty' ? '#9CA3AF' : 'white',
                          fontSize: 13,
                          fontWeight: '700'
                        }}
                      >
                        {line.index}
                      </Text>
                    </View>
                  )}
                </View>
                {/* Inline hint spacer in line numbers column */}
                {inlineHint && inlineHint.hint && inlineHint.lineIndex === i && (
                  <View style={{ height: 80 }} />
                )}
              </React.Fragment>
            ))}
          </View>

          {/* Canvas */}
          <View style={{ flex: 1 }}>
            <GestureDetector gesture={panGesture}>
              <View style={{ flex: 1, height: canvasHeight }}>
                <Canvas
                  ref={canvasRef}
                  style={{ flex: 1, height: canvasHeight, backgroundColor: '#FDF8F3' }}
                >
                  <Group>
                    <Group opacity={snapshotOnlyActive ? 0 : 1}>
                      {guides}
                      {committedLayers.flat().map((s) => renderStroke(s))}
                    </Group>
                    <Group transform={[{ scale: snapshotOnlyActive ? snapshotScale : 1 }]}>
                      {activeStrokes.map((s) => renderStroke(s))}
                    </Group>
                  </Group>
                </Canvas>
                {/* Problem text overlay on first line */}
                {problemBody && !snapshotOnlyActive && (
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: LINE_HEIGHT,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 28,
                        fontWeight: '700',
                        color: '#1F2937',
                        fontFamily: 'Nunito_700Bold',
                      }}
                      numberOfLines={1}
                    >
                      {problemBody}
                    </Text>
                  </View>
                )}
              </View>
            </GestureDetector>
          </View>

          {/* Hints Column */}
          <View style={{ width: 50, paddingTop: LINE_HEIGHT / 2 - 12 }}>
            {lines.map((line, i) => (
              <React.Fragment key={i}>
                <View
                  style={{
                    height: LINE_HEIGHT,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {line.hint && (
                    <Pressable
                      onPress={() => toggleHintExpanded(i)}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: '#FEF3C7',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons
                        name={expandedHints.has(i) ? "chevron-back" : "chevron-forward"}
                        size={16}
                        color="#F59E0B"
                      />
                    </Pressable>
                  )}
                </View>
                {/* Inline hint spacer in hints column */}
                {inlineHint && inlineHint.hint && inlineHint.lineIndex === i && (
                  <View style={{ height: 80 }} />
                )}
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* Inline Hint - Shows below specific line when user makes mistake */}
        {inlineHint && inlineHint.hint && (
          <View
            style={{
              position: 'absolute',
              top: (inlineHint.lineIndex + 1) * LINE_HEIGHT + LINE_HEIGHT / 2 - 12,
              left: LINE_NUMBER_WIDTH,
              right: 50,
              paddingHorizontal: 16,
              paddingVertical: 12,
              backgroundColor: inlineHint.hint.status === 'incorrect' ? '#FEF2F2' : '#FFFBEB',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: inlineHint.hint.status === 'incorrect' ? '#FECACA' : '#FDE68A',
              marginHorizontal: 8,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <Ionicons
                name={inlineHint.hint.status === 'incorrect' ? 'alert-circle' : 'information-circle'}
                size={20}
                color={inlineHint.hint.status === 'incorrect' ? '#EF4444' : '#F59E0B'}
              />
              <View style={{ flex: 1 }}>
                <Text style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: inlineHint.hint.status === 'incorrect' ? '#DC2626' : '#D97706',
                  marginBottom: 2,
                  fontFamily: 'Nunito_600SemiBold',
                }}>
                  {inlineHint.hint.status === 'incorrect' ? 'Not quite right' : 'Hint'}
                  {inlineHint.hint.level > 1 && ` (Level ${inlineHint.hint.level})`}
                </Text>
                <Text style={{
                  fontSize: 13,
                  color: '#374151',
                  lineHeight: 18,
                  fontFamily: 'Nunito_400Regular',
                }}>
                  {inlineHint.hint.text}
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>


      {/* Expanded Hint Overlay */}
      {Array.from(expandedHints).map(lineIndex => {
        const line = lines[lineIndex];
        if (!line?.hint) return null;
        return (
          <View
            key={lineIndex}
            style={{
              position: 'absolute',
              right: 60,
              top: (lineIndex + 1) * LINE_HEIGHT - 20,
              backgroundColor: 'white',
              borderRadius: 12,
              padding: 12,
              maxWidth: 200,
              shadowColor: '#000',
              shadowOpacity: 0.1,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
              elevation: 4,
              borderWidth: 1,
              borderColor: '#FEF3C7',
            }}
          >
            <Text style={{ fontSize: 13, color: '#1F2937', lineHeight: 18 }}>{line.hint}</Text>
          </View>
        );
      })}

      {/* Floating Done Button - Top Left (after line numbers) */}
      <Pressable
        onPress={onCommit}
        disabled={busy || activeStrokes.length === 0}
        style={({ pressed }) => ({
          position: 'absolute',
          top: 8,
          left: LINE_NUMBER_WIDTH + 8,
          paddingHorizontal: 20,
          paddingVertical: 12,
          borderRadius: 24,
          backgroundColor: busy || activeStrokes.length === 0
            ? '#E5E7EB'
            : pressed ? '#059669' : '#10B981',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          shadowColor: '#10B981',
          shadowOpacity: busy || activeStrokes.length === 0 ? 0 : 0.3,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: busy || activeStrokes.length === 0 ? 0 : 4,
        })}
      >
        <Ionicons
          name="checkmark-circle"
          size={20}
          color={busy || activeStrokes.length === 0 ? '#9CA3AF' : 'white'}
        />
        <Text
          style={{
            color: busy || activeStrokes.length === 0 ? '#9CA3AF' : 'white',
            fontWeight: '700',
            fontSize: 15,
          }}
        >
          {busy ? 'Checking...' : 'Done'}
        </Text>
      </Pressable>
    </View>
  );
}
