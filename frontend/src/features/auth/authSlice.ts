import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { authService } from '../../services/authService';

type AuthState = {
  user: { id: string; email: string; name: string } | null;
  token: string | null;
  loading: boolean;
  error: string | null;
};

const initialState: AuthState = {
  user: JSON.parse(localStorage.getItem('auth_user') || 'null'),
  token: localStorage.getItem('access_token'),
  loading: false,
  error: null
};

export const loginThunk = createAsyncThunk(
  'auth/login',
  async (payload: { email: string; password: string }) => {
    const data = await authService.login(payload);
    localStorage.setItem('access_token', data.token);
    localStorage.setItem('auth_user', JSON.stringify(data.user));
    return data;
  }
);

export const signupThunk = createAsyncThunk(
  'auth/signup',
  async (payload: { email: string; password: string; name: string }) => {
    const data = await authService.signup(payload);
    localStorage.setItem('access_token', data.token);
    localStorage.setItem('auth_user', JSON.stringify(data.user));
    return data;
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      state.user = null;
      state.token = null;
      localStorage.removeItem('access_token');
      localStorage.removeItem('auth_user');
    },
    setSession(state, action: { payload: { user: { id: string; email: string; name: string }; token: string } }) {
      state.user = action.payload.user;
      state.token = action.payload.token;
      localStorage.setItem('access_token', action.payload.token);
      localStorage.setItem('auth_user', JSON.stringify(action.payload.user));
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Login failed';
      })
      .addCase(signupThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signupThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
      })
      .addCase(signupThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Signup failed';
      });
  }
});

export const { logout, setSession } = authSlice.actions;
export default authSlice.reducer;
