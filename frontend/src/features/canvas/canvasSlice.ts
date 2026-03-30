import { createEntityAdapter, createSelector, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../../store';
import { Tool, WhiteboardShape } from './types';
import { logout } from '../auth/authSlice';

const shapesAdapter = createEntityAdapter<WhiteboardShape>();

type CanvasState = ReturnType<typeof shapesAdapter.getInitialState> & {
  selectedTool: Tool;
  selectedShapeId: string | null;
  history: WhiteboardShape[][];
  future: WhiteboardShape[][];
  zoom: number;
  pan: { x: number; y: number };
};

const initialState: CanvasState = {
  ...shapesAdapter.getInitialState(),
  selectedTool: 'select',
  selectedShapeId: null,
  history: [],
  future: [],
  zoom: 1,
  pan: { x: 0, y: 0 }
};

const snapshot = (state: CanvasState): WhiteboardShape[] =>
  Object.values(state.entities).filter(Boolean) as WhiteboardShape[];

const canvasSlice = createSlice({
  name: 'canvas',
  initialState,
  reducers: {
    setTool(state, action: PayloadAction<Tool>) {
      state.selectedTool = action.payload;
    },
    setZoom(state, action: PayloadAction<number>) {
      state.zoom = Math.max(0.25, Math.min(3, action.payload));
    },
    setPan(state, action: PayloadAction<{ x: number; y: number }>) {
      state.pan = action.payload;
    },
    selectShape(state, action: PayloadAction<string | null>) {
      state.selectedShapeId = action.payload;
    },
    loadShapes(state, action: PayloadAction<WhiteboardShape[]>) {
      shapesAdapter.setAll(state, action.payload);
      state.history = [action.payload];
      state.future = [];
    },
    upsertShape(state, action: PayloadAction<WhiteboardShape>) {
      state.history.push(snapshot(state));
      state.future = [];
      shapesAdapter.upsertOne(state, action.payload);
    },
    upsertManyShapes(state, action: PayloadAction<WhiteboardShape[]>) {
      state.history.push(snapshot(state));
      state.future = [];
      shapesAdapter.upsertMany(state, action.payload);
    },
    removeShape(state, action: PayloadAction<string>) {
      state.history.push(snapshot(state));
      state.future = [];
      shapesAdapter.removeOne(state, action.payload);
    },
    undo(state) {
      if (state.history.length === 0) {
        return;
      }
      const prev = state.history.pop();
      if (!prev) {
        return;
      }
      state.future.push(snapshot(state));
      shapesAdapter.setAll(state, prev);
    },
    redo(state) {
      if (state.future.length === 0) {
        return;
      }
      const next = state.future.pop();
      if (!next) {
        return;
      }
      state.history.push(snapshot(state));
      shapesAdapter.setAll(state, next);
    },
    resetCanvas(state) {
      shapesAdapter.removeAll(state);
      state.selectedTool = 'select';
      state.selectedShapeId = null;
      state.history = [];
      state.future = [];
      state.zoom = 1;
      state.pan = { x: 0, y: 0 };
    }
  },
  extraReducers: (builder) => {
    builder.addCase(logout, (state) => {
      shapesAdapter.removeAll(state);
      state.selectedTool = 'select';
      state.selectedShapeId = null;
      state.history = [];
      state.future = [];
      state.zoom = 1;
      state.pan = { x: 0, y: 0 };
    });
  }
});

export const canvasActions = canvasSlice.actions;
export default canvasSlice.reducer;

const selectors = shapesAdapter.getSelectors((state: RootState) => state.canvas);

export const selectAllShapes = selectors.selectAll;
export const selectShapeEntities = selectors.selectEntities;

export const selectCanvasView = createSelector(
  (state: RootState) => state.canvas,
  (canvas) => ({
    selectedTool: canvas.selectedTool,
    selectedShapeId: canvas.selectedShapeId,
    zoom: canvas.zoom,
    pan: canvas.pan
  })
);
