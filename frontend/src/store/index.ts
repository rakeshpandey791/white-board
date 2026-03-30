import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';
import boardReducer from '../features/board/boardSlice';
import canvasReducer from '../features/canvas/canvasSlice';
import presenceReducer from '../features/presence/presenceSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    board: boardReducer,
    canvas: canvasReducer,
    presence: presenceReducer
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
