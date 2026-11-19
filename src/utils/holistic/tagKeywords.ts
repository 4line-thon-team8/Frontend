import { getTagMap } from '../../services/lookupApi';
import type { TagKeyword } from './types';

const TIMEOUT_MS = 4000;

let cached: Promise<readonly TagKeyword[]> | null = null;

/**
 * 전공 키워드 사전(GET /api/tag-map)을 한 번만 받아 온다. 서술 분석의 관심 계열 태그(interestTags)를 채우는 데 쓴다.
 * 받지 못하면(오프라인·서버 오류·시간 초과) 빈 배열을 돌려 분석은 태그 없이 계속하고, 실패는 저장하지 않아 다음에 다시 시도한다.
 */
export function loadTagKeywords(): Promise<readonly TagKeyword[]> {
  if (cached) return cached;
  const request = getTagMap(AbortSignal.timeout(TIMEOUT_MS)).then(
    ({ entries }) => entries as readonly TagKeyword[],
    () => {
      if (cached === request) cached = null;
      return [] as readonly TagKeyword[];
    },
  );
  cached = request;
  return request;
}
