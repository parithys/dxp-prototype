// Minimal typings for the few Storybook APIs the stories use, so the stories can be type-checked WITHOUT Storybook installed
// (`npm run storybook:typecheck:stubs`) - for a machine or sandbox that cannot reach the npm registry. With Storybook installed, use
// `npm run storybook:typecheck` instead, which checks against the real types; these stubs are then not loaded.
// They are intentionally looser than the real types (args are Partial) - a pass here catches wrong prop names, missing imports and
// unused variables, not every missing required arg.
declare module '@storybook/react-vite' {
  import type { ComponentType, ReactNode } from 'react';
  type PropsOf<C> = C extends ComponentType<infer P> ? P : C extends (props: infer P) => unknown ? P : Record<string, unknown>;
  type ArgsOf<M> = M extends { component: infer C } ? PropsOf<C> : Record<string, any>;
  export interface StoryContext<A = any> {
    id: string;
    name: string;
    args: A;
    globals: Record<string, unknown>;
    parameters: Record<string, any>;
    canvasElement: HTMLElement;
    canvas: any;
    step: (name: string, fn: () => Promise<void> | void) => Promise<void>;
    viewMode: string;
  }
  export type Decorator<A = any> = (Story: ComponentType<any>, context: StoryContext<A>) => ReactNode;
  export interface Meta<C = any> {
    title?: string;
    component?: C;
    subcomponents?: Record<string, unknown>;
    tags?: string[];
    args?: Partial<PropsOf<C>> & Record<string, any>;
    argTypes?: Record<string, any>;
    parameters?: Record<string, any>;
    decorators?: Decorator<any>[];
    render?: (args: PropsOf<C>, context: StoryContext<PropsOf<C>>) => ReactNode;
    play?: (context: StoryContext<PropsOf<C>>) => Promise<void> | void;
    loaders?: ((context: StoryContext<PropsOf<C>>) => unknown)[];
    globals?: Record<string, unknown>;
  }
  export interface StoryAnnotations<A> {
    name?: string;
    tags?: string[];
    args?: Partial<A> & Record<string, any>;
    argTypes?: Record<string, any>;
    parameters?: Record<string, any>;
    decorators?: Decorator<any>[];
    render?: (args: A, context: StoryContext<A>) => ReactNode;
    play?: (context: StoryContext<A>) => Promise<void> | void;
    loaders?: ((context: StoryContext<A>) => unknown)[];
    globals?: Record<string, unknown>;
  }
  export type StoryObj<M = any> = StoryAnnotations<ArgsOf<M>>;
  export interface Preview {
    decorators?: Decorator<any>[];
    loaders?: ((context: StoryContext<any>) => unknown)[];
    tags?: string[];
    globalTypes?: Record<string, any>;
    initialGlobals?: Record<string, unknown>;
    parameters?: Record<string, any>;
  }
}
declare module 'storybook/test' {
  export const fn: <T extends (...args: any[]) => any = (...args: any[]) => any>(impl?: T) => T & { mock: { calls: unknown[][] } };
  export const expect: any;
  export const userEvent: any;
  export const within: (element: HTMLElement) => any;
  export const waitFor: <T>(callback: () => T | Promise<T>, options?: Record<string, unknown>) => Promise<T>;
  export const screen: any;
  export const fireEvent: any;
}
declare module 'storybook/actions' {
  export const action: (name: string) => (...args: unknown[]) => void;
}
