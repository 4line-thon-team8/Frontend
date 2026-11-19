import type { NarrativeAnalysisResult } from './types';

/**
 * 인용 구절(citations)을 서버로 보낼지. 환경변수 VITE_SEND_CITATIONS=true 일 때만 켠다(기본 꺼짐).
 * 외부 AI 전송 동의·구절 확인 화면이 생기기 전까지는 테스트 환경에서만 쓴다.
 */
export const SEND_CITATIONS = import.meta.env.VITE_SEND_CITATIONS === 'true';

/**
 * 분석 결과에서 서버로 보낼 holisticAnalysis 를 만든다.
 * 분석에 실패했으면 null(성적만 보낸다). 플래그가 꺼져 있으면 citations 키 자체를 넣지 않는다.
 */
export function buildHolisticSubmitPayload(
  narrative: NarrativeAnalysisResult | null,
  sendCitations: boolean = SEND_CITATIONS,
) {
  if (!narrative?.ok) return null;
  if (!sendCitations || narrative.citations.length === 0) return narrative.payload;
  return { ...narrative.payload, citations: narrative.citations };
}
