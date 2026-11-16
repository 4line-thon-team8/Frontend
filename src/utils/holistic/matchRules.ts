import { maskPersonalInfo } from './maskPersonalInfo';
import type { HolisticRule, NarrativeBlock, NarrativeSection, NarrativeYear } from './types';

/** 문장을 구절 단위로 자르는 경계. 구절 하나가 너무 길어지지 않게 한다. */
const CLAUSE_SPLIT = /[.,;·]|(?:하며|하고|하여|해서|했고|했으며|했다)\s/u;

/** 컴파일해 둔 규칙. 정규식을 매번 새로 만들지 않는다. */
export interface CompiledRule {
  rule: HolisticRule;
  pattern: RegExp;
  excludes: RegExp[];
}

/** 컴파일에 실패한 규칙은 건너뛴다. 규칙 하나가 잘못돼도 나머지 분석은 계속된다. */
export function compileRules(rules: readonly HolisticRule[]): CompiledRule[] {
  const compiled: CompiledRule[] = [];
  for (const rule of rules) {
    try {
      compiled.push({
        rule,
        pattern: new RegExp(rule.pattern),
        excludes: rule.excludes.map(exclude => new RegExp(exclude)),
      });
    } catch {
      // 서버가 시작할 때 걸러낸 구문만 내려오므로 보통은 오지 않는다.
    }
  }
  return compiled;
}

/** 규칙 하나가 문장에 맞는지. 제외 패턴이 하나라도 맞으면 맞지 않은 것으로 본다. */
export function matchRule(compiled: CompiledRule, text: string): RegExpExecArray | null {
  const match = compiled.pattern.exec(text);
  if (!match) return null;
  return compiled.excludes.some(exclude => exclude.test(text)) ? null : match;
}

export interface ClauseHit {
  section: NarrativeSection;
  year: NarrativeYear | null;
  /** 같은 문단에서 나온 구절끼리 묶는 번호. 문단 단위 상한과 품질 계산에 쓴다. */
  entryKey: string;
  entryText: string;
  /** 개인정보를 가린 구절 전체 */
  clause: string;
  matches: Array<{ rule: HolisticRule; index: number; length: number }>;
}

/** 모든 문단의 구절을 훑어 규칙이 맞은 구절만 돌려준다. */
export function findClauseHits(blocks: readonly NarrativeBlock[], compiled: readonly CompiledRule[]): ClauseHit[] {
  const hits: ClauseHit[] = [];
  blocks.forEach((block, blockIndex) => {
    const applicable = compiled.filter(({ rule }) => rule.sections.includes(block.section));
    if (applicable.length === 0) return;
    block.entries.forEach((entry, entryIndex) => {
      const entryKey = `${blockIndex}:${entryIndex}`;
      for (const raw of entry.split(CLAUSE_SPLIT)) {
        // 과목명 머리말("수학:")은 구절 길이만 차지하므로 떼고, 개인정보는 자르기 전에 먼저 가린다.
        const clause = maskPersonalInfo(raw.trim().replace(/^[가-힣A-Za-z0-9·\s]{1,10}:\s*/u, ''));
        if (clause.length < 4) continue;
        const matches: ClauseHit['matches'] = [];
        for (const item of applicable) {
          const match = matchRule(item, clause);
          if (match) matches.push({ rule: item.rule, index: match.index, length: match[0].length });
        }
        if (matches.length > 0) {
          hits.push({ section: block.section, year: block.year, entryKey, entryText: entry, clause, matches });
        }
      }
    });
  });
  return hits;
}

