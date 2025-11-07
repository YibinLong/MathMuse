import { create } from 'zustand';

export type StrokePoint = { x: number; y: number };

export type Stroke = {
  id: string;
  points: StrokePoint[];
  color: string;
  width: number;
  isEraser: boolean;
};

export type ToolMode = 'pen' | 'eraser';

interface AttemptCanvasState {
  // Tool state
  mode: ToolMode;
  color: string;
  strokeWidth: number;

  // Canvas layers
  activeStrokes: Stroke[]; // current step
  committedLayers: Stroke[][]; // prior steps as flattened stroke arrays
  stepIndex: number;

  // Actions
  setToolMode: (mode: ToolMode) => void;
  setColor: (color: string) => void;
  setStrokeWidth: (w: number) => void;

  startStroke: (seed?: Partial<Stroke>) => string; // returns stroke id
  addPoint: (strokeId: string, pt: StrokePoint) => void;
  endStroke: (strokeId: string) => void;
  undo: () => void;

  // Commit current step
  commitStepLocal: () => { stepIndex: number; vectorJson: Stroke[] };
  clearActive: () => void;
  clearAll: () => void;
  hydrateFromRemote: (layers: Stroke[][], nextIndex?: number) => void;
}

export const useAttemptCanvasStore = create<AttemptCanvasState>((set, get) => ({
  mode: 'pen',
  color: '#111111',
  strokeWidth: 6,

  activeStrokes: [],
  committedLayers: [],
  stepIndex: 0,

  setToolMode: (mode) => set({ mode }),
  setColor: (color) => set({ color }),
  setStrokeWidth: (strokeWidth) => set({ strokeWidth }),

  startStroke: (seed) => {
    const id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const state = get();
    const stroke: Stroke = {
      id,
      points: [],
      color: seed?.color ?? state.color,
      width: seed?.width ?? state.strokeWidth,
      isEraser: seed?.isEraser ?? state.mode === 'eraser',
    };
    set((s) => ({ activeStrokes: [...s.activeStrokes, stroke] }));
    return id;
  },

  addPoint: (strokeId, pt) =>
    set((s) => ({
      activeStrokes: s.activeStrokes.map((st) =>
        st.id === strokeId ? { ...st, points: [...st.points, pt] } : st
      ),
    })),

  endStroke: () => undefined,

  undo: () => {
    const state = get();
    console.log('[UNDO] Before:', {
      activeStrokes: state.activeStrokes.length,
      committedLayers: state.committedLayers.length,
      totalCommitted: state.committedLayers.flat().length
    });
    set((s) => ({ activeStrokes: s.activeStrokes.slice(0, -1) }));
    const after = get();
    console.log('[UNDO] After:', {
      activeStrokes: after.activeStrokes.length,
      committedLayers: after.committedLayers.length,
      totalCommitted: after.committedLayers.flat().length
    });
  },

  commitStepLocal: () => {
    const { activeStrokes, stepIndex } = get();
    console.log('[COMMIT] Before:', {
      activeStrokes: activeStrokes.length,
      committedLayers: get().committedLayers.length,
      stepIndex
    });
    // Move active strokes to committed layers
    set((s) => ({
      committedLayers: [...s.committedLayers, s.activeStrokes],
      activeStrokes: [],
      stepIndex: s.stepIndex + 1,
    }));
    const after = get();
    console.log('[COMMIT] After:', {
      activeStrokes: after.activeStrokes.length,
      committedLayers: after.committedLayers.length,
      totalCommitted: after.committedLayers.flat().length,
      stepIndex: after.stepIndex
    });
    return { stepIndex, vectorJson: activeStrokes };
  },

  clearActive: () => set({ activeStrokes: [] }),
  clearAll: () => set({ activeStrokes: [], committedLayers: [], stepIndex: 0 }),
  hydrateFromRemote: (layers, nextIndex) => set({
    activeStrokes: [],
    committedLayers: layers,
    stepIndex: typeof nextIndex === 'number' ? nextIndex : layers.length,
  }),
}));


