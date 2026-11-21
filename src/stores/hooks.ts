import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { UnknownAction } from '@reduxjs/toolkit';
import type { AppDispatch, RootState } from './store';

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();

type Result<A> = A extends (...args: never[]) => infer R ? R : void;

/**
 * An action creator bound to dispatch, with a stable identity: `const setRegion = useAction(regionActions.setRegion)`.
 * A plain action returns nothing; a thunk returns what it returns (a value, or a promise).
 */
export function useAction<Args extends unknown[], A extends UnknownAction | ((...a: never[]) => unknown)>(creator: (...args: Args) => A): (...args: Args) => Result<A> {
  const dispatch = useAppDispatch();
  return useCallback((...args: Args) => dispatch(creator(...args) as never) as unknown as Result<A>, [dispatch, creator]);
}
