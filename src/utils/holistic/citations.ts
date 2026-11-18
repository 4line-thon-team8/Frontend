import { maskPersonalInfo } from './maskPersonalInfo';
import { matchRule } from './matchRules';
import type { CompiledRule } from './matchRules';
import type { ModelClassifier } from './holisticModel';
import type { HolisticCitation, NarrativeBlock } from './types';

/**
 * 2단계 리포트용 인용 구절 선별.
 *
 * 근거 구절(evidence)은 지표 신호를 설명하는 30자 조각이라 문장으로 인용하기엔 짧고 끊겨 있다.
 * 인용 구절은 "완결된 한 문장"만, 읽기 품질·개인정보 검사를 통과한 것만 고른다.
 *
 * 지표와 구절의 연결은 통계적 판정이다. 5,009개 실제 구절 교차검증에서 모델 확률 0.7 이상 + 규칙 적중이 겹친
 * 구절의 정밀도는 지표별 0.76~0.91이었다. 즉 100%가 아니므로, 이 단계는 "문장이 입력에 실제로 있는가"만 보장하고
 * 지표가 맞는가는 사용자 확인과 서버의 보수적 문장 표현으로 보완한다.
 */
export const CITATION_LIMITS = {
  /** 모델 확률이 이 값 이상이고 규칙도 적중해야 인용 후보가 된다. */
  minProbability: 0.7,
  minChars: 15,
  maxChars: 100,
  /** 읽기 품질(0~1) 하한. 깨진 글자·끊긴 문장을 거른다. */
  minQuality: 0.9,
  perIndicatorMax: 2,
  totalMax: 24,
} as const;

/** 문장 경계: 한글 뒤 마침표 + 공백 + 새 문장의 시작. 날짜("2022.03.02.")는 숫자 뒤 마침표라 자르지 않는다. */
const SENTENCE_BOUNDARY = /(?<=[가-힣])\.\s+(?=[가-힣A-Za-z0-9(「『'"[])/u;
const SENTENCE_END = /(?:함|음|됨|임|였음|했음|보임|있음|나타냄|돋보임|시킴|기름|높임|이룸|줌|냄|감|옴|둠|짐|다|요)\.?$/u;
const MASK_TOKEN = /\[(?:이메일|번호|학교|교사|이름)\]/u;
/** OCR이 깨뜨린 흔적: 표 선, 연속 기호, 숫자가 한글 사이에 낀 단어. */
const GARBAGE = /[|ㅣ{}<>~^_=\\]|[가-힣]\d+[가-힣]|\.{3,}|\s[^\s가-힣A-Za-z0-9]{1,2}\s/u;
/** 문장 속에 혼자 떨어져도 자연스러운 한 글자 단어. 이 밖의 한 글자 낱말은 OCR이 단어를 쪼갠 흔적으로 본다("성실 한", "스 타 일"). */
const LONE_SYLLABLE_OK = new Set(['및', '등', '또', '각', '총', '약', '매', '더', '잘', '첫', '이', '그', '본', '두', '세']);
/** 영문 대문자 약어 중 문장에 자연스럽게 나오는 것. 이 밖의 대문자만 있는 짧은 낱말은 깨진 글자로 본다("ASST", "A"). */
const ACRONYM_OK = new Set(['AI', 'PPT', 'DNA', 'RNA', 'SNS', 'IT', 'SW', 'PC', 'UCC', 'TED', 'STEAM', 'BMI', 'MBTI', 'KBS', 'EBS', 'MBC', 'SBS', 'CAD', 'VR', 'AR', 'QR', 'GPS', 'PCR', 'ATP', 'OECD', 'UN', 'WHO', 'NGO', 'ICT', 'IOT', 'CPR', 'LED', 'USB']);

/** 낱말 단위로 본 깨짐 개수: 한 글자씩 떨어진 한글, 이상한 대문자 약어. */
export function noiseTokenCount(sentence: string): number {
  let count = 0;
  for (const token of sentence.split(/\s+/u)) {
    const bare = token.replace(/^[('"“‘「『[]+|[)'"”’」』\],.:;!?]+$/gu, '');
    if (/^[가-힣]$/u.test(bare) && !LONE_SYLLABLE_OK.has(bare)) count += 1;
    else if (/^[A-Z]{1,5}$/u.test(bare) && !ACRONYM_OK.has(bare)) count += 1;
  }
  return count;
}

export function splitSentences(entry: string): string[] {
  return entry.split(SENTENCE_BOUNDARY).map(sentence => sentence.trim()).filter(Boolean);
}

/**
 * 인용해도 읽히는 문장인지 0~1로 점수를 준다.
 * 한글 비율 0.3 + 완결(문장이 "~함"처럼 끝남) 0.2 + 시작 문자 0.1 + 깨짐 없음 0.4. 낱말 깨짐이 하나 있으면 깨짐 몫이 절반으로 줄어든다.
 */
export function citationQuality(sentence: string): number {
  const compact = sentence.replace(/\s+/gu, '');
  if (compact.length === 0) return 0;
  const hangulRatio = (compact.match(/[가-힣]/gu) ?? []).length / compact.length;
  const clean = GARBAGE.test(` ${sentence} `) ? 0 : Math.max(0, 1 - 0.5 * noiseTokenCount(sentence));
  const complete = SENTENCE_END.test(sentence.trim()) ? 1 : 0;
  const startsOk = /^[가-힣A-Za-z0-9(「『'"“‘]/u.test(sentence.trim()) ? 1 : 0;
  return Math.round((0.3 * Math.min(1, hangulRatio / 0.8) + 0.2 * complete + 0.1 * startsOk + 0.4 * clean) * 100) / 100;
}

interface Candidate {
  text: string;
  indicators: string[];
  probability: number;
  quality: number;
  year: HolisticCitation['year'];
  section: HolisticCitation['section'];
}

/**
 * 블록 전체에서 인용 후보를 고른 뒤 지표마다 상위 perIndicatorMax개, 전체 totalMax개로 줄인다.
 * 같은 지표 안에서는 학년·영역이 겹치지 않는 구절을 먼저 뽑아 한쪽에 쏠리지 않게 한다.
 * 모델이 없으면(규칙 사전 버전 불일치 등) 인용 구절을 만들지 않는다.
 */
export function buildCitations(
  blocks: readonly NarrativeBlock[],
  compiled: readonly CompiledRule[],
  classifier: Pick<ModelClassifier, 'predict'> | null,
): HolisticCitation[] {
  if (!classifier) return [];
  const { minProbability, minChars, maxChars, minQuality, perIndicatorMax, totalMax } = CITATION_LIMITS;
  const candidates: Candidate[] = [];

  for (const block of blocks) {
    const rules = compiled.filter(({ rule }) => rule.sections.includes(block.section));
    for (const entry of block.entries) {
      for (const raw of splitSentences(entry)) {
        const text = maskPersonalInfo(raw.replace(/^[가-힣A-Za-z0-9·\s]{1,10}:\s*/u, '').trim());
        if (text.length < minChars || text.length > maxChars || MASK_TOKEN.test(text)) continue;
        const quality = citationQuality(text);
        if (quality < minQuality) continue;
        const { probabilities } = classifier.predict(block.section, text);
        const ruleIndicators = new Set(rules.filter(item => matchRule(item, text)).map(item => item.rule.indicator));
        const indicators = Object.entries(probabilities)
          .filter(([id, probability]) => probability >= minProbability && ruleIndicators.has(id))
          .sort((a, b) => b[1] - a[1])
          .map(([id]) => id);
        if (indicators.length === 0) continue;
        candidates.push({
          text, indicators, quality, year: block.year, section: block.section,
          probability: Math.max(...indicators.map(id => probabilities[id] ?? 0)),
        });
      }
    }
  }

  const byIndicator = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    for (const id of candidate.indicators) byIndicator.set(id, [...(byIndicator.get(id) ?? []), candidate]);
  }

  const chosen = new Map<string, Candidate>();
  for (const [, list] of [...byIndicator].sort(([a], [b]) => a.localeCompare(b))) {
    const sorted = [...list].sort((a, b) => b.quality * b.probability - a.quality * a.probability);
    const picked: Candidate[] = [];
    const usedSlots = new Set<string>();
    for (const candidate of sorted) {
      const slot = `${candidate.year}:${candidate.section}`;
      if (picked.length < perIndicatorMax && !usedSlots.has(slot)) { picked.push(candidate); usedSlots.add(slot); }
    }
    for (const candidate of sorted) {
      if (picked.length >= perIndicatorMax) break;
      if (!picked.includes(candidate)) picked.push(candidate);
    }
    for (const candidate of picked) chosen.set(candidate.text, candidate);
  }

  return [...chosen.values()]
    .sort((a, b) => b.quality * b.probability - a.quality * a.probability)
    .slice(0, totalMax)
    .map((candidate, index) => ({
      id: `c${index + 1}`,
      text: candidate.text,
      indicators: candidate.indicators,
      year: candidate.year,
      section: candidate.section,
      quality: candidate.quality,
    }));
}
