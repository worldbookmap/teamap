"use client";

import { useEffect, useMemo, useState } from "react";
import type { HanjaConverter } from "@/lib/hanja";
import { loadTheteaArticle, loadTheteaEntries, TheteaIndex, type TheteaArticle, type TheteaEntry } from "@/lib/thetea";

/** thetea.app 백과사전 글 목록 색인 (처음 한 번 받음) */
export function useTheteaIndex(conv: HanjaConverter | null) {
  const [entries, setEntries] = useState<TheteaEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    loadTheteaEntries().then(
      (e) => alive && setEntries(e),
      (e: Error) => alive && setError(e.message),
    );
    return () => {
      alive = false;
    };
  }, []);
  const index = useMemo(
    () => (entries ? new TheteaIndex(entries, conv ? (s) => conv.simplify(s) : undefined) : null),
    [entries, conv],
  );
  return { index, error };
}

type ArticleState = { slug: string; article: TheteaArticle | null; error: string | null };

/** 백과사전 글 하나 */
export function useTheteaArticle(slug: string | null) {
  const [state, setState] = useState<ArticleState | null>(null);
  useEffect(() => {
    if (!slug) return;
    let alive = true;
    loadTheteaArticle(slug).then(
      (article) => alive && setState({ slug, article, error: null }),
      (e: Error) => alive && setState({ slug, article: null, error: e.message }),
    );
    return () => {
      alive = false;
    };
  }, [slug]);
  const current = state?.slug === slug ? state : null;
  return { loading: !!slug && !current, article: current?.article ?? null, error: current?.error ?? null };
}
