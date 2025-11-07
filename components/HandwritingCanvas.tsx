import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
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

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;
const HINT_LEVEL_LABELS = ['', 'Nudge', 'Directional hint', 'Micro-step'];
type AttemptMeta = { attemptId: string; userId: string };

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

const COLORS = ['#111111', '#2563eb', '#0ea5e9', '#16a34a', '#f59e0b', '#ef4444'];
const WIDTHS = [4, 6, 8, 10, 14];

export default function HandwritingCanvas() {
  const canvasRef = useCanvasRef();
  const strokeIdRef = useRef<string | null>(null);
  const hintSoundRef = useRef<Audio.Sound | null>(null);
  const [snapshotOnlyActive, setSnapshotOnlyActive] = useState(false);
  const [snapshotScale, setSnapshotScale] = useState(1);
  const [busy, setBusy] = useState(false);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [commitMsg, setCommitMsg] = useState<string | null>(null);
  const [lastOcr, setLastOcr] = useState<{ stepId: string; latex: string; confidence: number } | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editLatex, setEditLatex] = useState('');
  const [showOcrPanel, setShowOcrPanel] = useState(true);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [lastValidation, setLastValidation] = useState<ValidationResult | null>(null);
  const [attemptMeta, setAttemptMeta] = useState<AttemptMeta | null>(null);
  const [lastHint, setLastHint] = useState<HintResult | null>(null);
  const [hintAudio, setHintAudio] = useState<TtsResponse | null>(null);
  const [isPlayingHint, setIsPlayingHint] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [consecutiveNonProgress, setConsecutiveNonProgress] = useState(0);
  const [lastWasProblemSet, setLastWasProblemSet] = useState(false);
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

  const stopHintAudio = useCallback(async () => {
    if (!hintSoundRef.current) return;
    try {
      await hintSoundRef.current.stopAsync();
    } catch {
      // ignore
    }
    await hintSoundRef.current.unloadAsync().catch(() => undefined);
    hintSoundRef.current = null;
    setIsPlayingHint(false);
  }, []);

  const playHintAudio = useCallback(async () => {
    if (!hintAudio) return;
    try {
      setIsPlayingHint(true);
      setTtsError(null);
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
      setTtsError('Unable to play audio right now');
      if (hintSoundRef.current) {
        hintSoundRef.current.unloadAsync().catch(() => undefined);
        hintSoundRef.current = null;
      }
    }
  }, [hintAudio]);

  const hydrateAttemptFromServer = useCallback(async (meta: AttemptMeta) => {
    const { attemptId } = meta;
    try {
      const { data: steps, error } = await supabase
        .from('attempt_steps')
        .select('id, step_index, vector_json, ocr_latex, ocr_confidence, validation_status, validation_reason, solver_metadata, hint_level, hint_text, tts_audio_path')
        .eq('attempt_id', attemptId)
        .order('step_index', { ascending: true });
      if (error) throw error;

      const layers = (steps ?? []).map((step) => (Array.isArray(step.vector_json) ? step.vector_json : []) as Stroke[]);
      const lastStep = steps && steps.length > 0 ? steps[steps.length - 1] : null;
      const nextIndex = lastStep ? (typeof lastStep.step_index === 'number' ? lastStep.step_index + 1 : steps!.length) : 0;
      hydrateFromRemote(layers, nextIndex);

      if (!lastStep) {
        await stopHintAudio();
        setLastOcr(null);
        setOcrError(null);
        setEditOpen(false);
        setEditLatex('');
        setShowOcrPanel(false);
        setLastValidation(null);
        setLastHint(null);
        setHintAudio(null);
        setTtsError(null);
        setConsecutiveNonProgress(0);
        setLastWasProblemSet(false);
        if (layers.length === 0) {
          setCommitMsg('Ready for a fresh attempt.');
        }
        return;
      }

      const confidenceValue = typeof lastStep.ocr_confidence === 'number'
        ? lastStep.ocr_confidence
        : typeof lastStep.ocr_confidence === 'string'
          ? Number(lastStep.ocr_confidence)
          : 1;
      if (lastStep.ocr_latex) {
        setLastOcr({ stepId: lastStep.id, latex: lastStep.ocr_latex, confidence: Number.isFinite(confidenceValue) ? confidenceValue : 1 });
        setShowOcrPanel(true);
        setEditLatex(lastStep.ocr_latex);
      } else {
        setLastOcr(null);
        setShowOcrPanel(false);
        setEditLatex('');
      }
      setOcrError(null);
      setEditOpen(false);

      if (lastStep.validation_status && lastStep.validation_reason) {
        const validation: ValidationResult = {
          status: lastStep.validation_status as ValidationStatus,
          reason: lastStep.validation_reason,
          solverMetadata: lastStep.solver_metadata ?? undefined,
        };
        setLastValidation(validation);
        setLastWasProblemSet(false);
      } else {
        setLastValidation(null);
        setLastWasProblemSet(lastStep.step_index === 0);
      }

      let consecutive = 0;
      if (steps && steps.length > 0) {
        for (let i = steps.length - 1; i >= 0; i--) {
          const status = steps[i]?.validation_status as ValidationStatus | null | undefined;
          if (!status || status === 'correct_useful') break;
          if (status === 'correct_not_useful' || status === 'incorrect' || status === 'uncertain') {
            consecutive += 1;
          } else {
            break;
          }
        }
      }
      setConsecutiveNonProgress(consecutive);

      if (lastStep.hint_level && lastStep.hint_level > 0 && lastStep.hint_text) {
        setLastHint({
          level: lastStep.hint_level,
          text: lastStep.hint_text,
          status: (lastStep.validation_status as ValidationStatus) ?? 'uncertain',
        });
      } else {
        setLastHint(null);
      }

      await stopHintAudio();
      if (lastStep.tts_audio_path && lastStep.hint_level && lastStep.hint_level >= 2) {
        try {
          const audio = await fetchHintSpeechUrl(lastStep.tts_audio_path);
          setHintAudio(audio);
          setTtsError(null);
        } catch (audioErr: any) {
          console.warn('Failed to load hint audio:', audioErr);
          setHintAudio(null);
          setTtsError(typeof audioErr?.message === 'string' ? audioErr.message : 'Failed to load audio');
        }
      } else {
        setHintAudio(null);
        setTtsError(null);
      }
      setCommitMsg(`Resumed attempt with ${steps?.length ?? 0} saved step${(steps?.length ?? 0) === 1 ? '' : 's'}.`);
    } catch (err) {
      console.warn('Failed to hydrate attempt:', err);
    }
  }, [hydrateFromRemote, stopHintAudio]);
  useEffect(() => {
    (async () => {
      try {
        const meta = await ensureAttemptId();
        await hydrateAttemptFromServer(meta);
      } catch (err) {
        console.warn('Initial attempt load failed:', err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrateAttemptFromServer]);
  // WHY: Get debug setting from app config (loaded from .env)
  const debug = Constants.expoConfig?.extra?.EXPO_PUBLIC_DEBUG === 'true';
  const log = useCallback((msg: string) => {
    if (!debug) return;
    setDebugLog((prev) => {
      const next = [...prev, msg];
      if (next.length > 20) next.shift();
      return next;
    });
    console.log('[Canvas]', msg);
  }, [debug]);

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

  const ensureStrokeStart = useCallback(() => {
    if (!strokeIdRef.current) {
      strokeIdRef.current = startStroke();
    }
    return strokeIdRef.current;
  }, [startStroke]);

  const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);
  const lastPtRef = useRef<StrokePoint | null>(null);
  const minPointDist = 1.5;

  const panGesture = useMemo(() => {
    return Gesture.Pan()
      .runOnJS(true)
      .minDistance(0)
      .onBegin((e) => {
        const id = ensureStrokeStart();
        const x = clamp(e.x, 0, CANVAS_WIDTH);
        const y = clamp(e.y, 0, CANVAS_HEIGHT);
        lastPtRef.current = { x, y };
        addPoint(id, { x, y });
        log(`begin x=${x.toFixed(1)} y=${y.toFixed(1)}`);
      })
      .onChange((e) => {
        const id = strokeIdRef.current ?? ensureStrokeStart();
        const x = clamp(e.x, 0, CANVAS_WIDTH);
        const y = clamp(e.y, 0, CANVAS_HEIGHT);
        const last = lastPtRef.current;
        if (!last || Math.hypot(x - last.x, y - last.y) >= minPointDist) {
          addPoint(id, { x, y });
          lastPtRef.current = { x, y };
        }
      })
      .onEnd(() => {
        log('end');
        strokeIdRef.current = null;
        lastPtRef.current = null;
      });
  }, [addPoint, ensureStrokeStart, log]);

  const guides = useMemo(() => {
    const lines: any[] = [];
    const gap = 120;
    for (let y = gap; y < CANVAS_HEIGHT; y += gap) {
      const p = Skia.Path.Make();
      p.moveTo(0, y);
      p.lineTo(CANVAS_WIDTH, y);
      lines.push(
        <SkPathComponent
          key={`g-${y}`}
          path={p}
          style="stroke"
          strokeWidth={2}
          color="#e5e7eb"
        />
      );
    }
    return lines;
  }, []);

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
    if (attemptMeta) {
      return attemptMeta;
    }

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

  // On mount: if canvas is empty and there is a lingering attempt with a problem but no steps,
  // clear the problem so the session starts without a pre-set equation.
  useEffect(() => {
    (async () => {
      try {
        if (activeStrokes.length === 0 && committedLayers.length === 0) {
          const { data: userData } = await supabase.auth.getUser();
          const userId = userData.user?.id;
          if (!userId) return;
          const { data: att, error: attErr } = await supabase
            .from('attempts')
            .select('id, problem_id')
            .eq('user_id', userId)
            .eq('status', 'in_progress')
            .limit(1)
            .maybeSingle();
          if (attErr || !att?.id) return;
          // Count steps; if none, and problem_id exists, unset it
          const { data: steps, error: stepsErr } = await supabase
            .from('attempt_steps')
            .select('id')
            .eq('attempt_id', att.id)
            .limit(1);
          if (!stepsErr && steps && steps.length === 0 && att.problem_id) {
            await supabase
              .from('attempts')
              .update({ problem_id: null })
              .eq('id', att.id);
          }
        }
      } catch (e) {
        console.warn('Init reset problem failed:', e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onCommit = useCallback(async () => {
    if (busy) return;
    if (activeStrokes.length === 0) return;
    setBusy(true);
    
    // Snapshot BEFORE moving active strokes into committed layers so the PNG
    // contains only the current line without prior steps.
    const idx = stepIndex; // current line's index before commit
    const vectorJson = activeStrokes; // capture strokes for DB alongside PNG
    
    try {
      setSnapshotOnlyActive(true);
      let bytes: Uint8Array | null = null;
      let lastFileUri: string | null = null;
      let scale = 1;
      const MAX = 2_000_000; // 2MB target
      const t0 = Date.now();
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
      const snapshotMs = Date.now() - t0;

      // Now commit locally (moves active -> committed and bumps index)
      const _ignored = commitStepLocal();

      const { userId, attemptId } = await ensureAttemptId();

      const t1 = Date.now();
      const up = await uploadStepPng({ userId, attemptId, stepIndex: idx, bytes, vectorJson });
      const uploadMs = Date.now() - t1;
      console.log('[commit] snapshotMs=', snapshotMs, 'uploadMs=', uploadMs);
      setCommitMsg(`Saved step ${idx} → ${userId}/${attemptId}/${idx}.png`);

      // OCR: read base64 and invoke Edge Function
      if (!up?.stepId) throw new Error('No stepId returned from insert');
      if (!lastFileUri) throw new Error('No snapshot file path');
      // Some environments may not expose EncodingType; fall back to 'base64' literal
      const encoding: any = (FileSystem as any).EncodingType?.Base64 ?? 'base64';
      const base64 = await FileSystem.readAsStringAsync(lastFileUri, { encoding });
      // Run OCR in a separate try/catch so upload success isn't marked as commit failure
      try {
        console.log('[commit] invoking OCR…');
        const ocr = await invokeOcrLatex({ attemptId, stepId: up.stepId, imageBase64: base64 });
        setLastOcr({ stepId: up.stepId, latex: ocr.latex, confidence: ocr.confidence });
        setOcrError(null);
        setShowOcrPanel(true);
        setEditOpen(false);
        setEditLatex(ocr.latex);

        // Persist OCR fields on row
        const { error: updErr } = await supabase
          .from('attempt_steps')
          .update({ ocr_latex: ocr.latex, ocr_confidence: ocr.confidence })
          .eq('id', up.stepId);
        if (updErr) {
          console.warn('Failed to persist OCR fields:', updErr);
        }

        // STEP VALIDATION: fetch problem text and previous LaTeX, then invoke
        try {
          let problemText: string | null = null;
          // Try to get current attempt's problem
          const { data: att, error: attErr } = await supabase
            .from('attempts')
            .select('problem_id')
            .eq('id', attemptId)
            .single();
          if (attErr) console.warn('attempts query failed, will fallback to first problem:', attErr);
          if (att?.problem_id) {
            const { data: prob, error: probErr } = await supabase
              .from('problems')
              .select('body')
              .eq('id', att.problem_id)
              .single();
            if (!probErr) problemText = prob?.body ?? null; else console.warn('problem fetch failed:', probErr);
          }
          // NOTE: Do NOT fallback to any global/default problem.
          // Only use attempt's linked problem, or derive from steps below.

          // Fallback: derive problem from first step's OCR (or current step if step 0)
          if (!problemText) {
            // Try to use step 0 OCR as the problem for this attempt
            const { data: firstStep, error: fsErr } = await supabase
              .from('attempt_steps')
              .select('ocr_latex')
              .eq('attempt_id', attemptId)
              .eq('step_index', 0)
              .maybeSingle();
            if (!fsErr && firstStep?.ocr_latex) {
              problemText = splitMultiLineLatex(firstStep.ocr_latex);
            }
          }
          if (!problemText && idx === 0) {
            // As last resort for the first step, treat this line as the problem
            problemText = splitMultiLineLatex(ocr.latex);
          }
          // If we derived a problem and the attempt has none, persist it
          if (problemText && !(att?.problem_id)) {
            const { data: insProb, error: insProbErr } = await supabase
              .from('problems')
              .insert({ title: 'Ad-hoc', body: problemText })
              .select('id')
              .single();
            if (!insProbErr && insProb?.id) {
              const { error: attUpdErr } = await supabase
                .from('attempts')
                .update({ problem_id: insProb.id })
                .eq('id', attemptId);
              if (attUpdErr) {
                console.warn('Failed to set attempt.problem_id:', attUpdErr);
              }
            } else if (insProbErr) {
              console.warn('Failed to persist derived problem:', insProbErr);
            }
          }

          if (!problemText) {
            console.warn('No problem text available; skipping validation');
          } else {
            // prevLatex from previous step if exists
            let prevLatex: string | undefined = undefined;
            if (idx > 0) {
              // Defensive: fetch the most recent matching row in case of duplicates
              const { data: prev, error: prevErr } = await supabase
                .from('attempt_steps')
                .select('ocr_latex')
                .eq('attempt_id', attemptId)
                .eq('step_index', idx - 1)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              if (!prevErr) prevLatex = prev?.ocr_latex ?? undefined; else console.warn('prev step fetch failed:', prevErr);
            }

            const processedCurr = splitMultiLineLatex(ocr.latex);
            if (idx === 0) {
              // First line: treat as problem capture only; do NOT validate
              setLastValidation(null);
              setLastHint(null);
              setLastWasProblemSet(true);
              setConsecutiveNonProgress(0);
              await stopHintAudio();
              setHintAudio(null);
              setTtsError(null);
              setCommitMsg('Equation captured as the problem.');
            } else {
              const validation = await invokeSolveStep({ prevLatex, currLatex: processedCurr, problem: problemText });
              setLastWasProblemSet(false);
              setLastValidation(validation);
              let nextConsecutive = consecutiveNonProgress;
              let hintPayload: HintResult | null = null;
              if (validation.status === 'correct_useful') {
                nextConsecutive = 0;
                hintPayload = null;
              } else if (validation.status === 'correct_not_useful' || validation.status === 'incorrect' || validation.status === 'uncertain') {
                nextConsecutive = consecutiveNonProgress + 1;
                hintPayload = computeHint({
                  status: validation.status,
                  consecutiveNonProgress: nextConsecutive,
                });
              }
              setConsecutiveNonProgress(nextConsecutive);
              setLastHint(hintPayload);

              let ttsInfo: TtsResponse | null = null;
              if (hintPayload && hintPayload.level >= 2) {
                await stopHintAudio();
                try {
                  ttsInfo = await requestHintSpeech({
                    attemptId,
                    stepId: up.stepId,
                    text: hintPayload.text,
                    voice: 'alloy',
                  });
                  setHintAudio(ttsInfo);
                  setTtsError(null);
                } catch (ttsEx: any) {
                  console.warn('TTS generation failed:', ttsEx);
                  setHintAudio(null);
                  setTtsError(typeof ttsEx?.message === 'string' ? ttsEx.message : 'Failed to generate audio');
                }
              } else {
                await stopHintAudio();
                setHintAudio(null);
                setTtsError(null);
              }

              // Persist validation fields
              const { error: valErr } = await supabase
                .from('attempt_steps')
                .update({
                  validation_status: validation.status,
                  validation_reason: validation.reason,
                  solver_metadata: validation.solverMetadata ?? null,
                  hint_level: hintPayload ? hintPayload.level : 0,
                  hint_text: hintPayload ? hintPayload.text : null,
                  tts_audio_path: ttsInfo ? ttsInfo.storagePath : null,
                })
                .eq('id', up.stepId);
              if (valErr) console.warn('Failed to persist validation fields:', valErr);

              const { error: attemptStampErr } = await supabase
                .from('attempts')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', attemptId);
              if (attemptStampErr) console.warn('Failed to bump attempt timestamp:', attemptStampErr);
            }
          }
        } catch (valEx) {
          console.warn('Validation failed:', valEx);
        }
      } catch (ocrErr: any) {
        console.warn('OCR failed:', ocrErr);
        const m = typeof ocrErr?.message === 'string' ? ocrErr.message : String(ocrErr);
        setOcrError(m);
      }
    } catch (e: any) {
      console.warn('Commit failed:', e);
      const m = typeof e?.message === 'string' ? e.message : String(e);
      setCommitMsg(`Commit failed: ${m}`);
      setOcrError(m);
    } finally {
      setSnapshotOnlyActive(false);
      setSnapshotScale(1);
      setBusy(false);
    }
  }, [activeStrokes.length, busy, canvasRef, commitStepLocal, consecutiveNonProgress, stopHintAudio]);

  return (
    <View className="flex-1 bg-white">
      <View className="px-4 py-2 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          {COLORS.map((c) => (
            <Pressable key={c} onPress={() => setColor(c)}
              className="rounded-full"
              style={{ width: 28, height: 28, backgroundColor: c, borderWidth: c === color ? 2 : 0, borderColor: '#111' }}
            />
          ))}
        </View>
        <View className="flex-row items-center gap-2">
          {WIDTHS.map((w) => (
            <Pressable key={w} onPress={() => setStrokeWidth(w)}
              className="items-center justify-center"
              style={{ width: 32, height: 32, borderWidth: w === strokeWidth ? 2 : 1, borderColor: '#cbd5e1', borderRadius: 16 }}
            >
              <View style={{ width: w, height: w, backgroundColor: '#0f172a', borderRadius: w / 2 }} />
            </Pressable>
          ))}
        </View>
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => setToolMode(mode === 'pen' ? 'eraser' : 'pen')} className="px-3 py-1 rounded-md" style={{ backgroundColor: mode === 'eraser' ? '#fde68a' : '#e2e8f0' }}>
            <Text>{mode === 'eraser' ? 'Eraser' : 'Pen'}</Text>
          </Pressable>
          <Pressable onPress={undo} className="px-3 py-1 rounded-md" style={{ backgroundColor: '#e2e8f0' }}>
            <Text>Undo</Text>
          </Pressable>
          <Pressable
            onPress={async () => {
              try {
                // Clear local canvas and UI state
                clearAll();
                await stopHintAudio();
                setLastOcr(null);
                setLastValidation(null);
                setLastHint(null);
                setHintAudio(null);
                setTtsError(null);
                setConsecutiveNonProgress(0);
                setCommitMsg('Attempt cleared. Start a new attempt.');
                setShowOcrPanel(false);
                setEditOpen(false);
                setEditLatex('');
                // Complete current attempt and unset problem so next commit starts fresh
                const { data: userData } = await supabase.auth.getUser();
                const userId = userData.user?.id;
                if (userId) {
                  const { data: att, error: attErr } = await supabase
                    .from('attempts')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('status', 'in_progress')
                    .limit(1)
                    .maybeSingle();
                  if (!attErr && att?.id) {
                    // Mark as completed and remove any linked problem
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
            }}
            className="px-3 py-1 rounded-md"
            style={{ backgroundColor: '#e2e8f0' }}
          >
            <Text>Clear</Text>
          </Pressable>
          <Pressable disabled={busy || activeStrokes.length === 0} onPress={onCommit} className="px-3 py-1 rounded-md" style={{ backgroundColor: busy || activeStrokes.length === 0 ? '#94a3b8' : '#22c55e' }}>
            <Text style={{ color: 'white' }}>{busy ? 'Saving…' : 'Next line'}</Text>
          </Pressable>
          <View className="px-2 py-1 rounded-md" style={{ backgroundColor: '#e2e8f0' }}>
            <Text>Step: {stepIndex}</Text>
          </View>
          {(lastWasProblemSet || lastValidation) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 8 }}>
              <View style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: lastWasProblemSet
                  ? '#6b7280'
                  : (lastValidation!.status === 'correct_useful' ? '#16a34a' :
                     lastValidation!.status === 'correct_not_useful' ? '#f59e0b' :
                     lastValidation!.status === 'incorrect' ? '#dc2626' : '#6b7280')
              }} />
              <Text>{lastWasProblemSet ? 'problem set' : lastValidation!.status.replaceAll('_', ' ')}</Text>
            </View>
          )}
        </View>
      </View>

      <GestureDetector gesture={panGesture}>
        <Canvas
          ref={canvasRef}
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, alignSelf: 'center', backgroundColor: 'white' }}
        >
          <Group>
            {!snapshotOnlyActive && guides}
            {!snapshotOnlyActive && committedLayers.flat().map((s) => renderStroke(s))}
            <Group transform={[{ scale: snapshotOnlyActive ? snapshotScale : 1 }]}> 
              {activeStrokes.map((s) => renderStroke(s))}
            </Group>
          </Group>
        </Canvas>
      </GestureDetector>
      <View className="items-center py-2" style={{ paddingBottom: 80 }}>
        {commitMsg && (
          <Text style={{ color: commitMsg.startsWith('Commit failed') ? '#dc2626' : '#059669' }}>{commitMsg}</Text>
        )}
        {debug && (
          <View style={{ paddingTop: 6 }}>
            {debugLog.map((l, i) => (
              <Text key={i} style={{ fontSize: 10, color: '#64748b' }}>{l}</Text>
            ))}
          </View>
        )}
      </View>

      {/* Persistent OCR section (anchored at bottom) */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'white',
          borderTopWidth: 1,
          borderColor: '#e5e7eb',
          paddingHorizontal: 12,
          paddingVertical: 10,
          gap: 8,
          zIndex: 200,
          elevation: 6,
        }}
      >
        <Text style={{ fontWeight: '600' }}>OCR</Text>
        {!lastOcr && !ocrError && (
          <Text style={{ color: '#64748b' }}>No OCR result yet. Draw a step and tap “Next line”.</Text>
        )}
        {ocrError && !lastOcr && (
          <Text style={{ color: '#dc2626' }}>OCR failed: {ocrError}</Text>
        )}
        {lastOcr && !editOpen && (
          <>
            <Text selectable>LaTeX: {lastOcr.latex}</Text>
            <Text selectable>conf: {lastOcr.confidence.toFixed(2)}</Text>
            {lastOcr.confidence < 0.6 && (
              <Text style={{ color: '#b45309' }}>Hard to read—try rewriting this line for better OCR.</Text>
            )}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
              <Pressable onPress={() => { setEditOpen(true); setEditLatex(lastOcr.latex); }} className="px-3 py-1 rounded-md" style={{ backgroundColor: '#e2e8f0' }}>
                <Text>Edit</Text>
              </Pressable>
            </View>
          </>
        )}
        {lastOcr && editOpen && (
          <>
            <TextInput
              value={editLatex}
              onChangeText={setEditLatex}
              placeholder="Edit LaTeX"
              style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6 }}
            />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
              <Pressable
                onPress={async () => {
                  if (!lastOcr) return;
                  const { error } = await supabase
                    .from('attempt_steps')
                    .update({ ocr_latex: editLatex })
                    .eq('id', lastOcr.stepId);
                  if (!error) {
                    setLastOcr({ ...lastOcr, latex: editLatex });
                    setEditOpen(false);
                  } else {
                    console.warn('Failed to save override:', error);
                  }
                }}
                className="px-3 py-1 rounded-md"
                style={{ backgroundColor: '#22c55e' }}
              >
                <Text style={{ color: 'white' }}>Save</Text>
              </Pressable>
              <Pressable onPress={() => setEditOpen(false)} className="px-3 py-1 rounded-md" style={{ backgroundColor: '#e2e8f0' }}>
                <Text>Cancel</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>

      {lastOcr && showOcrPanel && (
        <View
          style={{
            position: 'absolute',
            top: 72,
            right: 12,
            maxWidth: '90%',
            backgroundColor: 'white',
            borderWidth: 1,
            borderColor: '#e5e7eb',
            borderRadius: 10,
            padding: 10,
            shadowColor: '#000',
            shadowOpacity: 0.1,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 2 },
            elevation: 3,
            zIndex: 100,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontWeight: '600' }}>OCR</Text>
            <Pressable onPress={() => setShowOcrPanel(false)} style={{ paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ color: '#64748b' }}>Hide</Text>
            </Pressable>
          </View>
          {!editOpen ? (
            <>
              <Text selectable style={{ marginTop: 4 }}>LaTeX: {lastOcr.latex}{"\n"}(conf: {lastOcr.confidence.toFixed(2)})</Text>
              {(lastWasProblemSet || lastValidation) && (
                <View style={{ marginTop: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: lastWasProblemSet
                        ? '#6b7280'
                        : (lastValidation!.status === 'correct_useful' ? '#16a34a' :
                           lastValidation!.status === 'correct_not_useful' ? '#f59e0b' :
                           lastValidation!.status === 'incorrect' ? '#dc2626' : '#6b7280')
                    }} />
                    <Text>
                      {lastWasProblemSet ? 'problem set' : lastValidation!.status.replaceAll('_', ' ')}
                    </Text>
                  </View>
                  {!lastWasProblemSet && (
                    <>
                      <Text style={{ color: '#475569', marginTop: 4 }}>{lastValidation!.reason}</Text>
                      {lastHint && (
                        <View style={{ marginTop: 6 }}>
                          <Text style={{ fontWeight: '600', color: '#0f172a' }}>
                            Hint (Level {lastHint.level} – {HINT_LEVEL_LABELS[lastHint.level] ?? 'Guidance'})
                          </Text>
                          <Text style={{ color: '#1f2937', marginTop: 4 }}>{lastHint.text}</Text>
                          {hintAudio && (
                            <Pressable
                              onPress={isPlayingHint ? stopHintAudio : playHintAudio}
                              className="px-3 py-1 rounded-md"
                              style={{ backgroundColor: '#dbeafe', marginTop: 8 }}
                            >
                              <Text style={{ color: '#1d4ed8', fontWeight: '600' }}>
                                {isPlayingHint ? 'Stop voice hint' : 'Play voice hint'}
                              </Text>
                            </Pressable>
                          )}
                          {ttsError && (
                            <Text style={{ color: '#dc2626', marginTop: 6 }}>
                              Audio unavailable: {ttsError}
                            </Text>
                          )}
                        </View>
                      )}
                    </>
                  )}
                  {lastWasProblemSet && (
                    <Text style={{ color: '#475569', marginTop: 4 }}>Equation captured as the problem.</Text>
                  )}
                </View>
              )}
            </>
          ) : (
            <TextInput
              value={editLatex}
              onChangeText={setEditLatex}
              placeholder="Edit LaTeX"
              style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, marginTop: 6 }}
            />
          )}
          {lastOcr.confidence < 0.6 && !editOpen && (
            <Text style={{ color: '#b45309', marginTop: 6 }}>
              Hard to read—try rewriting this line for better OCR.
            </Text>
          )}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            {!editOpen ? (
              <Pressable onPress={() => { setEditOpen(true); setEditLatex(lastOcr.latex); }} className="px-3 py-1 rounded-md" style={{ backgroundColor: '#e2e8f0' }}>
                <Text>Edit</Text>
              </Pressable>
            ) : (
              <>
                <Pressable
                  onPress={async () => {
                    const { error } = await supabase
                      .from('attempt_steps')
                      .update({ ocr_latex: editLatex })
                      .eq('id', lastOcr.stepId);
                    if (!error) {
                      setLastOcr({ ...lastOcr, latex: editLatex });
                      setEditOpen(false);
                    } else {
                      console.warn('Failed to save override:', error);
                    }
                  }}
                  className="px-3 py-1 rounded-md"
                  style={{ backgroundColor: '#22c55e' }}
                >
                  <Text style={{ color: 'white' }}>Save</Text>
                </Pressable>
                <Pressable onPress={() => setEditOpen(false)} className="px-3 py-1 rounded-md" style={{ backgroundColor: '#e2e8f0' }}>
                  <Text>Cancel</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      )}
    </View>
  );
}


