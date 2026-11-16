import { SECTION_HEADINGS } from './rules';
import type { NarrativeBlock, NarrativeSection, NarrativeYear } from './types';

const YEAR_MARK = /^\s*[[(<]?\s*([123])\s*학년\s*[\])>]?\s*$/u;
const INLINE_YEAR = /^\s*([123])\s*학년\b/u;

/**
 * 페이지마다 반복되는 머리글·바닥글 줄은 서술이 아니므로 버린다.
 * 학생 이름·학교·학번이 이런 줄에 있어서, 버리지 않으면 근거 구절에 섞여 서버로 나갈 수 있다.
 * 서술 문장은 길기 때문에 짧은 줄(40자 이하)만 본다.
 */
const HEADER_LABEL = /(성\s*명|학\s*번|학\s*적|생\s*년\s*월\s*일|주민\s*등록|연\s*락\s*처|전화\s*번호|주\s*소)\s*[:：]/u;
const CLASS_NUMBER = /\d+\s*학년\s*\d+\s*반\s*\d+\s*번/u;
const SCHOOL_NAME = /(초등학교|중학교|고등학교)/u;
const PAGE_MARK = /^[-–—]?\s*\d+\s*(?:[-–—]|\/\s*\d+|페이지|쪽)?\s*$/u;

function isHeaderOrFooterLine(line: string): boolean {
  if (line.length > 40) return false;
  return HEADER_LABEL.test(line) || CLASS_NUMBER.test(line) || SCHOOL_NAME.test(line) || PAGE_MARK.test(line);
}

function detectSection(line: string): NarrativeSection | null {
  // 제목 줄만 본다. 긴 서술 문장 속 단어에 반응하지 않도록 길이를 제한한다.
  if (line.trim().length > 40) return null;
  for (const [section, pattern] of SECTION_HEADINGS) {
    if (pattern.test(line)) return section;
  }
  return null;
}

function detectYear(line: string): NarrativeYear | null {
  const match = YEAR_MARK.exec(line) ?? INLINE_YEAR.exec(line);
  return match ? (Number(match[1]) as NarrativeYear) : null;
}

/**
 * 전문을 (영역 × 학년) 묶음으로 나눈다.
 * 페이지 경계는 호출 전에 이미 이어 붙인 텍스트를 받으므로 영역이 페이지에서 잘려도 이어진다.
 */
export function splitSections(fullText: string): NarrativeBlock[] {
  const blocks = new Map<string, NarrativeBlock>();
  let section: NarrativeSection | null = null;
  let year: NarrativeYear | null = null;
  let paragraph: string[] = [];

  function flush() {
    if (!section || paragraph.length === 0) { paragraph = []; return; }
    const text = paragraph.join(' ').replace(/\s+/gu, ' ').trim();
    paragraph = [];
    if (!text) return;
    const key = `${section}:${year ?? 0}`;
    const block = blocks.get(key) ?? { section, year, entries: [] };
    block.entries.push(text);
    blocks.set(key, block);
  }

  for (const rawLine of fullText.normalize('NFKC').split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line) { flush(); continue; }
    const nextSection = detectSection(line);
    if (nextSection) { flush(); section = nextSection; continue; }
    const nextYear = detectYear(line);
    if (nextYear) { flush(); year = nextYear; continue; }
    if (isHeaderOrFooterLine(line)) continue;
    paragraph.push(line);
  }
  flush();
  return [...blocks.values()];
}
