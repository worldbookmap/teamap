"use client";

import { useEffect, useState } from "react";
import { loadConverter, type ConverterBundle } from "@/lib/converter";

/** 한자 변환기 + 지역 색인 (처음 한 번 비동기 로드) */
export function useConverter() {
  const [bundle, setBundle] = useState<ConverterBundle | null>(null);
  useEffect(() => {
    let alive = true;
    loadConverter().then((b) => alive && setBundle(b));
    return () => {
      alive = false;
    };
  }, []);
  return bundle;
}
