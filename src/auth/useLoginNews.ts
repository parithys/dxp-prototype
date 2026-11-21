import { useMemo } from 'react';
import { useGetNewsQuery } from '../services/apiSlice';
import type { NewsItem } from '../services/types';
import { formatDate } from '../lib/format';

// The sign-in screen's "Latest Updates": the newest items of the Vodafone Qatar news page
// (https://www.vodafone.qa/en/investor-relations/news), read from public/news/news.json through the API layer (the getNews endpoint). That
// file and its banner images are written by scripts/sync-news.mjs (npm run sync:news, also run before dev and build) - never edited by hand.
export type { NewsItem };

const isItem = (x: unknown): x is NewsItem => {
  const n = x as Partial<NewsItem> | null;
  return Boolean(n && n.title && n.date && n.url && n.image);
};

const NO_NEWS: NewsItem[] = [];

/** The synced news, newest first. Empty (so nothing is drawn) while loading, or if the file is missing or unreadable. */
export function useLoginNews(): NewsItem[] {
  const { data } = useGetNewsQuery();
  return useMemo(() => (data ? data.filter(isItem) : NO_NEWS), [data]);
}

/** "2026-08-29" -> "29/08/2026". */
export const formatNewsDate = (iso: string) => formatDate(`${iso}T00:00:00`);
