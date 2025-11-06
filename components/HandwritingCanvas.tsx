import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Canvas, Path as SkPathComponent, Skia, useCanvasRef, Group } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useAttemptCanvasStore, type Stroke, type StrokePoint } from '../stores/attemptStore';
import { snapshotCanvasToPng } from '../services/stepExport';
import { uploadStepPng } from '../services/stepUpload';
import { supabase } from '../lib/supabase';

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
  const debug = process.env.EXPO_PUBLIC_DEBUG === 'true';
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
      let scale = 1;
      const MAX = 2_000_000; // 2MB target
      const t0 = Date.now();
      for (let i = 0; i < 6; i++) {
        setSnapshotScale(scale);
        await new Promise((r) => requestAnimationFrame(() => r(undefined)));
        const res = await snapshotCanvasToPng(canvasRef, { filename: `step-${Date.now()}.png` });
        bytes = res.bytes;
        if (bytes.byteLength <= MAX) break;
        scale *= 0.85;
        if (scale < 0.4) break;
      }
      if (!bytes) throw new Error('Snapshot failed');
      const snapshotMs = Date.now() - t0;

      const { userId, attemptId } = await ensureAttemptId();

      const t1 = Date.now();
      await uploadStepPng({ userId, attemptId, stepIndex: idx, bytes, vectorJson });
      const uploadMs = Date.now() - t1;
      console.log('[commit] snapshotMs=', snapshotMs, 'uploadMs=', uploadMs);
      setCommitMsg(`Saved step ${idx} → ${userId}/${attemptId}/${idx}.png`);
    } catch (e: any) {
      console.warn('Commit failed:', e);
      const m = typeof e?.message === 'string' ? e.message : String(e);
      setCommitMsg(`Commit failed: ${m}`);
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
      <View className="items-center py-2">
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
    </View>
  );
}


