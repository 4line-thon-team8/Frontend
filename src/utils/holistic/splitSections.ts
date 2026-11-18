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
const HEADING_WITH_TEXT = /^\s*(?:[123]\s+)?((?:자율|동아리|진로)\s*활동)(?:\s+|\s*[|ㅣ]\s*)\d{1,3}(?:\s+|\s*[|ㅣ]\s*)(\S.*)$/u;
/** 학년 숫자만 한 줄로 나온다. */
const LONE_YEAR = /^[123]$/u;

/**
 * 교과학습발달상황 표 위의 학년 표시("[1학년]"). 닫는 괄호가 있을 때만 표 머리글 칸 "학년"과 구별해서 본다.
 * 스캔 OCR은 숫자를 빠뜨리거나("[학년]") 2를 3으로 읽는 일이 있다.
 */
const BRACKET_YEAR = /^\s*[[(<]?\s*([123])?\s*학년\s*[\])>]\s*$/u;

/**
 * 학년 표시 줄마다 학년을 정한다. 학년은 1→2→3 순서로만 진행하므로
 * 표시가 3개면 순서대로 1·2·3으로 보고, 아니면 숫자가 없거나 앞 표시보다 작거나 같을 때 앞 표시 + 1로 보정한다.
 */
function resolveBracketYears(lines: string[]): Map<number, NarrativeYear> {
  const marks: Array<{ index: number; digit: number | null }> = [];
  lines.forEach((line, index) => {
    const match = BRACKET_YEAR.exec(line);
    if (match) marks.push({ index, digit: match[1] ? Number(match[1]) : null });
  });
  const resolved = new Map<number, NarrativeYear>();
  let previous = 0;
  marks.forEach((mark, order) => {
    let year = marks.length === 3 ? order + 1 : mark.digit !== null && mark.digit > previous ? mark.digit : previous + 1;
    year = Math.min(year, 3);
    previous = year;
    resolved.set(mark.index, year as NarrativeYear);
  });
  return resolved;
}

function detectYear(line: string): NarrativeYear | null {
  const match = YEAR_MARK.exec(line) ?? INLINE_YEAR.exec(line);
  return match ? (Number(match[1]) as NarrativeYear) : null;
}

const CREATIVE_ORDER: readonly NarrativeSection[] = ['autonomy', 'club', 'career'];

type Piece = { section: NarrativeSection; year: NarrativeYear | null; text: string };

/**
 * 창체 표는 학년 칸의 숫자가 스캔에서 읽히지 않는 일이 잦아 첫 학년의 서술이 학년 없이 남는다.
 * 문서 맨 앞에서 학년 표시가 나오기 전의 서술은, 처음 읽힌 학년이 2 이상이면 그 바로 앞 학년, 1이면 1학년으로 본다.
 */
function backfillLeadingYears(pieces: Piece[]): Piece[] {
  const firstKnown = pieces.find(piece => piece.year !== null)?.year ?? null;
  if (firstKnown === null) return pieces;
  const guess = (firstKnown > 1 ? firstKnown - 1 : 1) as NarrativeYear;
  let leading = true;
  return pieces.map(piece => {
    if (piece.year !== null) leading = false;
    return leading ? { ...piece, year: guess } : piece;
  });
}

function groupPieces(pieces: Piece[]): NarrativeBlock[] {
  const blocks = new Map<string, NarrativeBlock>();
  for (const { section, year, text } of pieces) {
    const key = `${section}:${year ?? 0}`;
    const block = blocks.get(key) ?? { section, year, entries: [] };
    block.entries.push(text);
    blocks.set(key, block);
  }
  return [...blocks.values()];
}

/**
 * 전문을 (영역 × 학년) 묶음으로 나눈다.
 * 페이지 경계는 호출 전에 이미 이어 붙인 텍스트를 받으므로 영역이 페이지에서 잘려도 이어진다.
 */
export function splitSections(fullText: string): NarrativeBlock[] {
  const pieces: Array<{ section: NarrativeSection; year: NarrativeYear | null; text: string }> = [];
  let section: NarrativeSection | null = null;
  let year: NarrativeYear | null = null;
  let paragraph: string[] = [];
  /** 창체 영역 제목이 자율→동아리→진로 순서가 처음(앞 영역)으로 되돌아올 때마다 한 학년이 지난 것으로 본다(학년 칸을 못 읽은 스캔용). */
  let lastCreativeOrder = -1;

  function flush() {
    if (!section || paragraph.length === 0) { paragraph = []; return; }
    const text = paragraph.join(' ').replace(/\s+/gu, ' ').trim();
    paragraph = [];
    if (!text) return;
    pieces.push({ section, year, text });
  }

  const lines = fullText.normalize('NFKC').split(/\r?\n/u).map(rawLine => rawLine.trim());
  const neighbor = (from: number, step: 1 | -1): string => {
    for (let i = from + step; i >= 0 && i < lines.length; i += step) { const candidate = lines[i]; if (candidate) return candidate; }
    return '';
  };

  const bracketYears = resolveBracketYears(lines);

  /** 영역 제목을 만났을 때 영역·학년 상태를 갱신한다. 제목 앞에 학년 숫자가 있으면 그 값을 따른다. */
  function enterSection(next: NarrativeSection, explicitYear: NarrativeYear | null) {
    const order = CREATIVE_ORDER.indexOf(next);
    if (explicitYear) {
      year = explicitYear;
    } else if (order >= 0 && lastCreativeOrder >= 0 && order < lastCreativeOrder) {
      year = Math.min((year ?? 1) + 1, 3) as NarrativeYear;
    }
    if (order >= 0) lastCreativeOrder = order;
    else if (next !== 'subject' || year !== null) lastCreativeOrder = -1;
    section = next;
  }

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? '';
    if (!line) { flush(); continue; }

    const bracketYear = bracketYears.get(index);
    if (bracketYear) { flush(); year = bracketYear; lastCreativeOrder = -1; continue; }

    // 제목+서술이 한 줄: 제목 줄을 먼저 처리하고 나머지는 서술로 이어 붙인다.
    const withText = HEADING_WITH_TEXT.exec(line);
    if (withText) {
      const headingSection = detectSection(withText[1] ?? '');
      if (headingSection) {
        flush();
        const yearBefore = YEAR_BEFORE_HEADING.exec(line);
        enterSection(headingSection, yearBefore ? Number(yearBefore[1] ?? '') as NarrativeYear : null);
        paragraph.push(withText[2] ?? '');
        continue;
      }
    }

    const nextSection = detectSection(line);
    if (nextSection) {
      flush();
      const yearBefore = YEAR_BEFORE_HEADING.exec(line);
      enterSection(nextSection, yearBefore ? Number(yearBefore[1] ?? '') as NarrativeYear : null);
      continue;
    }

    // 학년 숫자만 있는 줄: 앞 줄이 "학년" 칸이거나 뒤 줄이 영역 제목일 때만 학년 표시로 본다(시간·쪽 숫자와 구분).
    if (LONE_YEAR.test(line)) {
      const before = neighbor(index, -1);
      const after = neighbor(index, 1);
      if (/학년/u.test(before) || detectSection(after) !== null || HEADING_WITH_TEXT.test(after)) { flush(); year = Number(line) as NarrativeYear; lastCreativeOrder = -1; continue; }
    }

    const nextYear = detectYear(line);
    if (nextYear) { flush(); year = nextYear; lastCreativeOrder = -1; continue; }
    if (isHeaderOrFooterLine(line)) continue;
    paragraph.push(line);
  }
  flush();
  return groupPieces(backfillLeadingYears(pieces));
}
