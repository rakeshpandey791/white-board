import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { boardService, BoardDetails, BoardSummary } from '../../services/boardService';
import { WhiteboardShape } from '../canvas/types';
import { AxiosError } from 'axios';
import { logout } from '../auth/authSlice';

type BoardState = {
  boards: BoardSummary[];
  activeBoard: BoardDetails | null;
  loading: boolean;
  error: string | null;
  autosaveAt: number | null;
};

const initialState: BoardState = {
  boards: [],
  activeBoard: null,
  loading: false,
  error: null,
  autosaveAt: null
};

export const fetchBoardsThunk = createAsyncThunk(
  'board/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      return await boardService.listBoards();
    } catch (error) {
      const axiosError = error as AxiosError<{ error?: string }>;
      return rejectWithValue(axiosError.response?.data?.error || axiosError.message);
    }
  }
);

export const createBoardThunk = createAsyncThunk(
  'board/create',
  async (payload: { name: string; accessScope: 'RESTRICTED' | 'PUBLIC' }, { rejectWithValue }) => {
    try {
      return await boardService.createBoard(payload);
    } catch (error) {
      const axiosError = error as AxiosError<{ error?: string }>;
      return rejectWithValue(axiosError.response?.data?.error || axiosError.message);
    }
  }
);

export const loadBoardThunk = createAsyncThunk(
  'board/load',
  async (boardId: string, { rejectWithValue }) => {
    try {
      return await boardService.getBoard(boardId);
    } catch (error) {
      const axiosError = error as AxiosError<{ error?: string }>;
      return rejectWithValue(axiosError.response?.data?.error || axiosError.message);
    }
  }
);
export const saveElementsThunk = createAsyncThunk(
  'board/saveElements',
  async ({ boardId, elements }: { boardId: string; elements: WhiteboardShape[] }, { rejectWithValue }) => {
    try {
      return await boardService.saveElements(boardId, elements);
    } catch (error) {
      const axiosError = error as AxiosError<{ error?: string }>;
      return rejectWithValue(axiosError.response?.data?.error || axiosError.message);
    }
  }
);

const boardSlice = createSlice({
  name: 'board',
  initialState,
  reducers: {
    setActiveBoardId(state, action: { payload: string }) {
      if (state.activeBoard && state.activeBoard.id !== action.payload) {
        state.activeBoard = null;
      }
    },
    resetBoardState(state) {
      state.boards = [];
      state.activeBoard = null;
      state.loading = false;
      state.error = null;
      state.autosaveAt = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBoardsThunk.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchBoardsThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.boards = action.payload;
        if (state.activeBoard) {
          const stillVisible = action.payload.some((board) => board.id === state.activeBoard?.id);
          if (!stillVisible) {
            state.activeBoard = null;
          }
        }
      })
      .addCase(fetchBoardsThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || action.error.message || 'Failed to fetch boards';
      })
      .addCase(loadBoardThunk.fulfilled, (state, action) => {
        state.activeBoard = action.payload;
        state.error = null;
      })
      .addCase(loadBoardThunk.rejected, (state, action) => {
        state.activeBoard = null;
        state.error = (action.payload as string) || action.error.message || 'Failed to load board';
      })
      .addCase(createBoardThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createBoardThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.boards.unshift(action.payload);
      })
      .addCase(createBoardThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || action.error.message || 'Failed to create board';
      })
      .addCase(saveElementsThunk.fulfilled, (state) => {
        state.autosaveAt = Date.now();
      })
      .addCase(saveElementsThunk.rejected, (state, action) => {
        state.error = (action.payload as string) || action.error.message || 'Failed to save changes';
      })
      .addCase(logout, (state) => {
        state.boards = [];
        state.activeBoard = null;
        state.loading = false;
        state.error = null;
        state.autosaveAt = null;
      });
  }
});

export const { setActiveBoardId, resetBoardState } = boardSlice.actions;
export default boardSlice.reducer;
