import { INQUIRY_STAGES, SECTIONS, SECTION_EVIDENCE_CAP, SPECIFIC_MARKERS } from './rules';
import type { ClauseHit } from './matchRules';
import type {
  HolisticEvidencePhrase,
  HolisticIndicatorSignal,
  HolisticInterestTag,
  HolisticRuleLimits,
  NarrativeBlock,
  NarrativeSection,
  NarrativeYear,
  TagKeyword,
} from './types';

const round2 = (value: number) => Math.round(value * 100) / 100;

const sortedYears = (years: Iterable<NarrativeYear | null>): NarrativeYear[] =>
  [...new Set([...years].filter((year): year is NarrativeYear => year !== null))].sort((a, b) => a - b);

/* ---------- 영역별 글자 수·학년 ---------- */

export function buildCoverage(blocks: readonly NarrativeBlock[]) {
  const sectionChars = Object.fromEntries(SECTIONS.map(section => [section, 0])) as Record<NarrativeSection, number>;
  for (const block of blocks) {
    for (const entry of block.entries) sectionChars[block.section] += entry.length;
  }
  return { sectionChars, years: sortedYears(blocks.map(block => block.year)) };
}

/* ---------- 지표별 신호 ---------- */

/** 문단 하나의 품질: 탐구 단계(동기·과정·결과·성찰) 충족 절반 + 구체 표현 유무 절반. */
function entryQuality(entryText: string): number {
  const stages = INQUIRY_STAGES.filter(stage => stage.test(entryText)).length;
  return 0.5 * (stages / INQUIRY_STAGES.length) + (SPECIFIC_MARKERS.test(entryText) ? 0.5 : 0);
}

/**
 * 지표마다 count(맞은 구절 수), years(나타난 학년), quality(맞은 문단들의 평균 품질)를 만든다.
 * 서버는 학년이 하나는 있어야 받으므로, 학년을 알 수 없는 지표는 보내지 않는다.
 */
export function buildIndicatorSignals(hits: readonly ClauseHit[], limits: HolisticRuleLimits): HolisticIndicatorSignal[] {
  type IndicatorState = { clauses: number; years: Array<NarrativeYear | null>; entries: Map<string, string> };
  const byIndicator = new Map<string, IndicatorState>();
  for (const hit of hits) {
    for (const indicator of new Set(hit.indicators)) {
      const state: IndicatorState = byIndicator.get(indicator) ?? { clauses: 0, years: [], entries: new Map() };
      state.clauses += 1;
      state.years.push(hit.year);
      state.entries.set(hit.entryKey, hit.entryText);
      byIndicator.set(indicator, state);
    }
  }
  const signals: HolisticIndicatorSignal[] = [];
  for (const [id, state] of byIndicator) {
    const years = sortedYears(state.years);
    if (years.length === 0) continue;
    const qualities = [...state.entries.values()].map(entryQuality);
    const quality = qualities.reduce((sum, value) => sum + value, 0) / qualities.length;
    signals.push({ id, count: state.clauses, years, quality: round2(quality) });
  }
  return signals.sort((a, b) => b.count - a.count || a.id.localeCompare(b.id)).slice(0, limits.indicatorSignalsMax);
}

/* ---------- 근거 구절 ---------- */

/** 맞은 부분이 가운데 오도록 maxChars 안으로 자른다. 단어 중간에서 잘리지 않게 공백에 맞춘다. */
function windowAround(clause: string, index: number, length: number, maxChars: number) {
  if (clause.length <= maxChars) return { from: 0, to: clause.length };
  let from = Math.max(0, Math.min(index - Math.floor((maxChars - Math.min(length, maxChars)) / 2), clause.length - maxChars));
  let to = Math.min(clause.length, from + maxChars);
  if (from > 0) {
    const space = clause.indexOf(' ', from);
    if (space !== -1 && space < index) from = space + 1;
  }
  if (to < clause.length) {
    const space = clause.lastIndexOf(' ', to);
    if (space > index + length) to = space;
  }
  return { from, to };
}

interface PhraseCandidate {
  phrase: HolisticEvidencePhrase;
  entryKey: string;
}

function candidateOf(hit: ClauseHit, maxChars: number): PhraseCandidate | null {
  const matches = [...hit.matches].sort((a, b) => a.index - b.index);
  const first = matches[0];
  if (!first) return null;
  const { from, to } = windowAround(hit.clause, first.index, first.length, maxChars);
  const text = hit.clause.slice(from, to).trim();
  if (text.length < 4) return null;
  // 잘라낸 구절 안에 완전히 들어온 규칙의 유형만 싣는다. 구절에 보이지 않는 유형을 주장하지 않기 위해서다.
  const types = [...new Set(matches
    .filter(match => match.index >= from && match.index + match.length <= to)
    .flatMap(match => match.rule.types))];
  if (types.length === 0) return null;
  return { phrase: { types, text, year: hit.year, section: hit.section }, entryKey: hit.entryKey };
}

/**
 * 규칙: 문단(entry)마다 최대 entryEvidenceMax개, 영역별 SECTION_EVIDENCE_CAP, 전체 evidenceMax.
 * 한 문단이 상한을 독식하지 않도록 문단을 돌려가며(round-robin) 하나씩 뽑고,
 * 문단 안에서는 유형이 많은 구절을 먼저 고른다.
 */
export function buildEvidence(hits: readonly ClauseHit[], limits: HolisticRuleLimits): HolisticEvidencePhrase[] {
  const queues = new Map<string, PhraseCandidate[]>();
  for (const hit of hits) {
    const candidate = candidateOf(hit, limits.evidenceTextMaxChars);
    if (!candidate) continue;
    const queue = queues.get(candidate.entryKey) ?? [];
    queue.push(candidate);
    queues.set(candidate.entryKey, queue);
  }
  const ordered = [...queues.values()].map(queue =>
    queue.sort((a, b) => b.phrase.types.length - a.phrase.types.length).slice(0, limits.entryEvidenceMax));

  const result: HolisticEvidencePhrase[] = [];
  const seen = new Set<string>();
  const perSection = new Map<NarrativeSection, number>();
  for (let round = 0; ordered.some(queue => round < queue.length); round++) {
    for (const queue of ordered) {
      const candidate = queue[round];
      if (!candidate || seen.has(candidate.phrase.text)) continue;
      const used = perSection.get(candidate.phrase.section) ?? 0;
      if (used >= SECTION_EVIDENCE_CAP[candidate.phrase.section] || result.length >= limits.evidenceMax) continue;
      seen.add(candidate.phrase.text);
      perSection.set(candidate.phrase.section, used + 1);
      result.push(candidate.phrase);
    }
  }
  return result;
}

/* ---------- 관심 전공 계열 태그 ---------- */

/**
 * 전공 키워드 사전으로 계열 태그의 빈도·학년을 센다. 키워드가 들어 있는 문단 수가 count 다.
 * 학년을 알 수 없는 태그는 서버가 받지 않으므로 보내지 않는다.
 */
export function buildInterestTags(
  blocks: readonly NarrativeBlock[],
  keywords: readonly TagKeyword[],
  limits: HolisticRuleLimits,
): HolisticInterestTag[] {
  if (keywords.length === 0) return [];
  const keywordsByTag = new Map<string, string[]>();
  for (const { keyword, tag } of keywords) {
    const list = keywordsByTag.get(tag) ?? [];
    list.push(keyword.toLowerCase());
    keywordsByTag.set(tag, list);
  }
  const tally = new Map<string, { count: number; years: Array<NarrativeYear | null> }>();
  for (const block of blocks) {
    for (const entry of block.entries) {
      const lowered = entry.toLowerCase();
      for (const [tag, list] of keywordsByTag) {
        if (!list.some(keyword => lowered.includes(keyword))) continue;
        const state = tally.get(tag) ?? { count: 0, years: [] };
        state.count += 1;
        state.years.push(block.year);
        tally.set(tag, state);
      }
    }
  }
  const tags: HolisticInterestTag[] = [];
  for (const [tag, state] of tally) {
    const years = sortedYears(state.years);
    if (years.length > 0) tags.push({ tag, count: state.count, years });
  }
  return tags.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag)).slice(0, limits.interestTagsMax);
}
