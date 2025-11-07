import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { Canvas, Path as SkPathComponent, Skia, useCanvasRef, Group } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useAttemptCanvasStore, type Stroke, type StrokePoint } from '../stores/attemptStore';
import { snapshotCanvasToPng } from '../services/stepExport';
import { uploadStepPng } from '../services/stepUpload';
import { supabase } from '../lib/supabase';
import * as FileSystem from 'expo-file-system/legacy';
import { invokeOcrLatex } from '../services/stepOCR';
import Constants from 'expo-constants';

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

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
    const lines: JSX.Element[] = [];
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

  async function ensureAttemptId(): Promise<{ userId: string; attemptId: string }> {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) throw new Error('No authenticated user');

    const { data: existing, error: qErr } = await supabase
      .from('attempts')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'in_progress')
      .limit(1)
      .maybeSingle();
    if (qErr) throw qErr;
    if (existing?.id) return { userId, attemptId: existing.id };

    const { data: ins, error: iErr } = await supabase
      .from('attempts')
      .insert({ user_id: userId, status: 'in_progress' })
      .select('id')
      .single();
    if (iErr) throw iErr;
    return { userId, attemptId: ins.id };
  }

  const onCommit = useCallback(async () => {
    if (busy) return;
    if (activeStrokes.length === 0) return;
    setBusy(true);
    
    // IMPORTANT: Freeze strokes FIRST, before any async operations
    // This ensures strokes are committed even if upload fails
    const { stepIndex: idx, vectorJson } = commitStepLocal();
    
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
  }, [activeStrokes.length, busy, canvasRef, commitStepLocal]);

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
          <Pressable disabled={busy || activeStrokes.length === 0} onPress={onCommit} className="px-3 py-1 rounded-md" style={{ backgroundColor: busy || activeStrokes.length === 0 ? '#94a3b8' : '#22c55e' }}>
            <Text style={{ color: 'white' }}>{busy ? 'Saving…' : 'Next line'}</Text>
          </Pressable>
          <View className="px-2 py-1 rounded-md" style={{ backgroundColor: '#e2e8f0' }}>
            <Text>Step: {stepIndex}</Text>
          </View>
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
            <Text selectable style={{ marginTop: 4 }}>LaTeX: {lastOcr.latex}{"\n"}(conf: {lastOcr.confidence.toFixed(2)})</Text>
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


