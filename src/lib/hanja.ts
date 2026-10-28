/**
 * 한자 ↔ 한글 변환기
 *  - 한자(간체/번체) → 한글 독음: 단어 사전 최장 일치 → 글자별 대표음, 어두 두음법칙 적용
 *  - 한글 → 한자: 단어 사전(차 이름·지명) 최장 일치 → 음절별 한자 후보 (사용자가 고를 수 있게)
 *  - 간체 ↔ 번체 변환
 */
export interface HanjaData {
  /** 글자 → "대표음" 또는 "대표음|다른음,다른음" */
  reading: Record<string, string>;
  toTrad: Record<string, string>;
  toSimp: Record<string, string>;
  /** 한글 음절 → 빈도순 한자 후보 문자열 */
  cand: Record<string, string>;
}

/** [간체, 번체, 한글] */
export type Word = [string, string, string];

export interface HanjaOption {
  simp: string;
  trad: string;
}

export type Segment =
  | { kind: "word" | "char"; ko: string; options: HanjaOption[] }
  | { kind: "raw"; ko: string; options: [] };

const HANGUL_BASE = 0xac00;
const HANGUL_END = 0xd7a3;
const I_LIKE = new Set([2, 3, 6, 7, 12, 17, 20]); // ㅑ ㅒ ㅕ ㅖ ㅛ ㅠ ㅣ
const INI_N = 2;
const INI_R = 5;
const INI_O = 11;

const isHangulSyllable = (ch: string) => {
  const c = ch.charCodeAt(0);
  return c >= HANGUL_BASE && c <= HANGUL_END;
};
const isHan = (ch: string) => /\p{Script=Han}/u.test(ch);

function decompose(syl: string) {
  const code = syl.charCodeAt(0) - HANGUL_BASE;
  return { ini: Math.floor(code / 588), med: Math.floor((code % 588) / 28), fin: code % 28 };
}
function compose(ini: number, med: number, fin: number) {
  return String.fromCharCode(HANGUL_BASE + ini * 588 + med * 28 + fin);
}

/** 두음법칙: 녀→여, 력→역, 로→노 */
export function applyInitialLaw(syl: string): string {
  if (!isHangulSyllable(syl)) return syl;
  const { ini, med, fin } = decompose(syl);
  if (ini === INI_R) return compose(I_LIKE.has(med) ? INI_O : INI_N, med, fin);
  if (ini === INI_N && I_LIKE.has(med)) return compose(INI_O, med, fin);
  return syl;
}

/** 두음법칙 적용 전 원래 음 후보 (용→룡, 노→로, 여→녀·려) */
function initialLawSources(syl: string): string[] {
  if (!isHangulSyllable(syl)) return [];
  const { ini, med, fin } = decompose(syl);
  if (ini === INI_O && I_LIKE.has(med)) return [compose(INI_R, med, fin), compose(INI_N, med, fin)];
  if (ini === INI_N && !I_LIKE.has(med)) return [compose(INI_R, med, fin)];
  return [];
}

const MAX_WORD = 16;

export class HanjaConverter {
  private bySimp = new Map<string, Word>();
  private byKo = new Map<string, Word[]>();
  private maxKo = 1;
  /** 사전 단어(차 이름·지명)에 나온 글자 빈도 — 한자 후보 순위를 차·지명 문맥에 맞춥니다 */
  private charFreq = new Map<string, number>();

  constructor(
    private data: HanjaData,
    words: Word[] = [],
  ) {
    this.addWords(words);
  }

  addWords(words: Word[]) {
    for (const w of words) {
      const [simp, trad, ko] = w;
      if (!simp || !ko) continue;
      const key = this.simplify(simp);
      if (!this.bySimp.has(key)) this.bySimp.set(key, w);
      const list = this.byKo.get(ko) ?? [];
      if (!list.some((x) => this.simplify(x[0]) === key)) list.push(w);
      this.byKo.set(ko, list);
      this.maxKo = Math.max(this.maxKo, ko.length);
      for (const ch of key) this.charFreq.set(ch, (this.charFreq.get(ch) ?? 0) + 1);
      if (trad && this.simplify(trad) !== key && !this.bySimp.has(this.simplify(trad))) {
        this.bySimp.set(this.simplify(trad), w);
      }
    }
  }

  /** 번체 → 간체 (글자 단위) */
  simplify(text: string) {
    let out = "";
    for (const ch of text) out += this.data.toSimp[ch] ?? ch;
    return out;
  }

  /** 간체 → 번체. 사전 단어는 사전 표기를 따릅니다 */
  traditionalize(text: string) {
    const s = this.simplify(text);
    let out = "";
    for (let i = 0; i < s.length; ) {
      const w = this.matchWord(s, i);
      if (w) {
        out += w[1] || w[0];
        i += w[0].length;
        continue;
      }
      const ch = s[i];
      out += this.data.toTrad[ch] ?? ch;
      i++;
    }
    return out;
  }

  private matchWord(s: string, i: number): Word | undefined {
    for (let len = Math.min(MAX_WORD, s.length - i); len >= 2; len--) {
      const w = this.bySimp.get(s.slice(i, i + len));
      if (w) return w;
    }
    return undefined;
  }

  /** 글자의 모든 음 (대표음 먼저) */
  readingsOf(ch: string): string[] {
    const r = this.data.reading[ch] ?? this.data.reading[this.data.toTrad[ch] ?? ""];
    if (!r) return [];
    const [primary, alts] = r.split("|");
    return [primary, ...(alts ? alts.split(",") : [])];
  }

  /** 한자 → 한글 독음 */
  toHangul(text: string): string {
    const s = this.simplify(text);
    let out = "";
    let wordStart = true;
    for (let i = 0; i < s.length; ) {
      const w = this.matchWord(s, i);
      if (w) {
        out += w[2];
        i += w[0].length;
        wordStart = false;
        continue;
      }
      const ch = s[i];
      i++;
      if (isHan(ch)) {
        const syl = this.readingsOf(ch)[0];
        if (syl) {
          out += wordStart ? applyInitialLaw(syl) : syl;
        } else {
          out += ch; // 음을 모르는 글자는 그대로 둡니다
        }
        wordStart = false;
      } else {
        out += ch;
        wordStart = /[\s·,.()\-/]/.test(ch);
      }
    }
    return out;
  }

  private charOptions(syl: string, wordStart: boolean): HanjaOption[] {
    const syllables = [syl, ...(wordStart ? initialLawSources(syl) : [])];
    const seen = new Set<string>();
    const out: HanjaOption[] = [];
    for (const s of syllables) {
      for (const c of this.data.cand[s] ?? "") {
        const simp = this.data.toSimp[c] ?? c;
        if (seen.has(simp)) continue;
        seen.add(simp);
        out.push({ simp, trad: this.data.toTrad[simp] ?? c });
      }
    }
    // 기본 빈도 순서에서 차·지명에 자주 쓰인 글자를 앞으로 당깁니다
    const rank = (o: HanjaOption, i: number) => i - 8 * Math.min(this.charFreq.get(o.simp) ?? 0, 5);
    return out
      .map((o, i) => ({ o, r: rank(o, i) }))
      .sort((a, b) => a.r - b.r)
      .map((x) => x.o);
  }

  /** 한글 → 한자 분절 결과. 각 분절의 options[0] 이 기본 선택입니다 */
  segment(text: string): Segment[] {
    const segs: Segment[] = [];
    let wordStart = true;
    for (let i = 0; i < text.length; ) {
      let matched = false;
      for (let len = Math.min(this.maxKo, text.length - i); len >= 2; len--) {
        const ko = text.slice(i, i + len);
        const words = this.byKo.get(ko);
        if (words) {
          segs.push({ kind: "word", ko, options: words.map((w) => ({ simp: w[0], trad: w[1] || w[0] })) });
          i += len;
          matched = true;
          wordStart = false;
          break;
        }
      }
      if (matched) continue;
      const ch = text[i];
      i++;
      if (isHangulSyllable(ch)) {
        segs.push({ kind: "char", ko: ch, options: this.charOptions(ch, wordStart) });
        wordStart = false;
      } else {
        segs.push({ kind: "raw", ko: ch, options: [] });
        wordStart = /\s/.test(ch);
      }
    }
    return segs;
  }

  /** 한글 → 한자 (기본 후보로 바로 변환) */
  toHanja(text: string, choices: number[] = []): { simp: string; trad: string } {
    return joinSegments(this.segment(text), choices);
  }
}

export function joinSegments(segs: Segment[], choices: number[] = []) {
  let simp = "";
  let trad = "";
  segs.forEach((seg, idx) => {
    const opt = seg.options[choices[idx] ?? 0];
    simp += opt ? opt.simp : seg.ko;
    trad += opt ? opt.trad : seg.ko;
  });
  return { simp, trad };
}

const REGION_SUFFIX =
  /(特别行政区|维吾尔自治区|壮族自治区|回族自治区|自治区|自治州|自治县|自治旗|地区|新区|林区|省|市|县|区|盟|旗|州)$/;

/** 행정구역 이름에서 접미사를 뗀 짧은 이름 (杭州市 → 杭州, 西双版纳傣族自治州 → 西双版纳) */
export function shortRegionName(name: string) {
  const s = name.replace(/([一-鿿]{2,}?)(?:[一-鿿]{1,3}族)+(自治州|自治县|自治旗)$/, "$1");
  if (s !== name) return s;
  const t = name.replace(REGION_SUFFIX, "");
  return t.length >= 2 ? t : name;
}
