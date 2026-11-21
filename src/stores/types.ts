import type { ThunkAction, UnknownAction } from '@reduxjs/toolkit';
import type { RootState } from './store';

/** An action that reads state, dispatches other actions or does async work, and may return a value (what the old store methods returned). */
export type AppThunk<R = void> = ThunkAction<R, RootState, unknown, UnknownAction>;
