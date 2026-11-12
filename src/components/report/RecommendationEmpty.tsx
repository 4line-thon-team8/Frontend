import { Link } from 'react-router';
import './ResultNotices.css';

/**
 * 추천 0장(정상 응답): 리포트 대신 조건 수정 안내를 보여주고, 결과는 저장하지 않아요.
 * TODO: S-03(성적 확인) 담당과 협의해 돌아갔을 때 기존 입력값이 유지되도록 연결합니다.
 */
export default function RecommendationEmpty() {
  return (
    <section className="recommendation-empty" aria-labelledby="recommendation-empty-title">
      <h2 id="recommendation-empty-title">현재 조건에서 추천 가능한 후보가 없어요.</h2>
      <p>희망 학과나 지원 조건을 바꿔서 다시 분석해 보세요.<br />이번 결과는 저장되지 않아요.</p>
      <Link className="recommendation-empty__action" to="/grade/confirm">조건 수정하기</Link>
    </section>
  );
}
