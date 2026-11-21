import { createSlice } from '@reduxjs/toolkit';
import type { PersistConfig } from './persist';

export type Theme = 'light' | 'dark';

export interface ThemeState {
  theme: Theme;
}

export const themeInitialState: ThemeState = { theme: 'light' };

const slice = createSlice({
  name: 'theme',
  initialState: themeInitialState,
  reducers: {
    toggleTheme(state) {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
    },
  },
});

export const themeReducer = slice.reducer;
export const themeActions = slice.actions;

export const themePersist: PersistConfig<ThemeState> = { key: 'vfq-theme-store' };
