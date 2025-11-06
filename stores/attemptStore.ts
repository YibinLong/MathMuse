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

  undo: () =>
    set((s) => ({ activeStrokes: s.activeStrokes.slice(0, -1) })),

  commitStepLocal: () => {
    const { activeStrokes, stepIndex } = get();
    // Move active strokes to committed layers
    set((s) => ({
      committedLayers: [...s.committedLayers, s.activeStrokes],
      activeStrokes: [],
      stepIndex: s.stepIndex + 1,
    }));
    return { stepIndex, vectorJson: activeStrokes };
  },

  clearActive: () => set({ activeStrokes: [] }),
}));


