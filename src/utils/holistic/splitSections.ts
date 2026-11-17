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

/** 쪽 바닥글: "3/18"과 "2026년 3월 4일"이 함께 있다. 학교·이름이 같은 줄에 붙어 길어질 수 있어 길이를 보지 않는다. */
const PAGE_COUNTER = /\d+\s*\/\s*\d+/u;
const PRINT_DATE = /\d{4}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일/u;
/** 표 머리줄: 글자 사이가 띄어져 한 글자씩 나온다("세 부 능 력 및 특 기 사 항"). 앞의 "과목"·"학년" 칸 이름은 떼고 본다. */
const SPACED_LETTERS = /^(?:\S\s+){4,}\S$/u;

function isHeaderOrFooterLine(line: string): boolean {
  if (PAGE_COUNTER.test(line) && PRINT_DATE.test(line)) return true;
  if (SPACED_LETTERS.test(line.replace(/^(?:과목|학년|영역)\s+/u, ''))) return true;
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

/** 창체 영역 제목 줄 앞에 학년 숫자가 붙어 나온다("1 자율활동 34"). */
const YEAR_BEFORE_HEADING = /^\s*([123])\s+(?=(?:자율|동아리|진로)\s*활동)/u;
/** 제목과 서술 첫 줄이 한 줄로 붙어 나온다("동아리활동 34 서술…"). 시간 숫자가 뒤따를 때만 제목으로 본다. */
const HEADING_WITH_TEXT = /^\s*(?:[123]\s+)?((?:자율|동아리|진로)\s*활동)\s+\d{1,3}\s+(\S.*)$/u;
/** 학년 숫자만 한 줄로 나온다. */
const LONE_YEAR = /^[123]$/u;

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

  const lines = fullText.normalize('NFKC').split(/\r?\n/u).map(rawLine => rawLine.trim());
  const neighbor = (from: number, step: 1 | -1): string => {
    for (let i = from + step; i >= 0 && i < lines.length; i += step) { const candidate = lines[i]; if (candidate) return candidate; }
    return '';
  };

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? '';
    if (!line) { flush(); continue; }

    // 제목+서술이 한 줄: 제목 줄을 먼저 처리하고 나머지는 서술로 이어 붙인다.
    const withText = HEADING_WITH_TEXT.exec(line);
    if (withText) {
      const headingSection = detectSection(withText[1] ?? '');
      if (headingSection) {
        flush();
        const yearBefore = YEAR_BEFORE_HEADING.exec(line);
        if (yearBefore) year = Number(yearBefore[1] ?? '') as NarrativeYear;
        section = headingSection;
        paragraph.push(withText[2] ?? '');
        continue;
      }
    }

    const nextSection = detectSection(line);
    if (nextSection) {
      flush();
      const yearBefore = YEAR_BEFORE_HEADING.exec(line);
      if (yearBefore) year = Number(yearBefore[1] ?? '') as NarrativeYear;
      section = nextSection;
      continue;
    }

    // 학년 숫자만 있는 줄: 앞 줄이 "학년" 칸이거나 뒤 줄이 영역 제목일 때만 학년 표시로 본다(시간·쪽 숫자와 구분).
    if (LONE_YEAR.test(line)) {
      const before = neighbor(index, -1);
      const after = neighbor(index, 1);
      if (/학년/u.test(before) || detectSection(after) !== null || HEADING_WITH_TEXT.test(after)) { flush(); year = Number(line) as NarrativeYear; continue; }
    }

    const nextYear = detectYear(line);
    if (nextYear) { flush(); year = nextYear; continue; }
    if (isHeaderOrFooterLine(line)) continue;
    paragraph.push(line);
  }
  flush();
  return [...blocks.values()];
}
