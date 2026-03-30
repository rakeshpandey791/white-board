import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { logout } from '../auth/authSlice';

type Cursor = {
  userId: string;
  name: string;
  color: string;
  x: number;
  y: number;
  mode?: 'canvas' | 'docs';
};

type PresenceState = {
  activeUsers: { userId: string; name: string; color: string }[];
  cursors: Record<string, Cursor>;
};

const initialState: PresenceState = {
  activeUsers: [],
  cursors: {}
};

const presenceSlice = createSlice({
  name: 'presence',
  initialState,
  reducers: {
    setActiveUsers(state, action: PayloadAction<PresenceState['activeUsers']>) {
      state.activeUsers = action.payload;
    },
    upsertCursor(state, action: PayloadAction<Cursor>) {
      const userId = String(action.payload.userId || '').trim();
      const x = Number(action.payload.x);
      const y = Number(action.payload.y);
      if (!userId || !Number.isFinite(x) || !Number.isFinite(y)) {
        return;
      }

      const normalized: Cursor = {
        userId,
        name: String(action.payload.name || 'User'),
        color: String(action.payload.color || '#34d399'),
        mode: action.payload.mode,
        x,
        y
      };

      state.cursors[userId] = normalized;
      const exists = state.activeUsers.some((user) => user.userId === userId);
      if (!exists) {
        state.activeUsers.push({
          userId,
          name: normalized.name,
          color: normalized.color
        });
      }
    },
    removeCursor(state, action: PayloadAction<string>) {
      delete state.cursors[action.payload];
    },
    resetPresence(state) {
      state.activeUsers = [];
      state.cursors = {};
    }
  },
  extraReducers: (builder) => {
    builder.addCase(logout, (state) => {
      state.activeUsers = [];
      state.cursors = {};
    });
  }
});

export const { setActiveUsers, upsertCursor, removeCursor, resetPresence } = presenceSlice.actions;
export default presenceSlice.reducer;
