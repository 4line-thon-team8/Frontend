import { useNavigate } from 'react-router';
import type { TermsState } from './TermsPage';
import './AuthPage.css';
import './PrivacyPage.css';

// Figma '개인정보 처리 안내' 문안 그대로입니다. 문안이 바뀌면 여기만 고치면 돼요.
const SUMMARY = [
  '성적표 원본은 서버로 보내지 않고, 처리 후 폐기해요.',
  '분석에 쓴 성적 숫자는 저장하지 않아요.',
  '저장되는 것은 추천 원서 6장, 추천 이유, 생성 시각뿐이에요.',
  '회원 탈퇴를 하면 저장된 리포트·추천 원서·로그인 토큰이 삭제돼요.',
];

type Item = { label?: string; text: string; strong?: string };
type Section = { title: string; items: Item[] };

const SECTIONS: Section[] = [
  {
    title: '어떤 정보를 다루나요 ?',
    items: [
      { text: '회원 정보 : 이메일, 비밀번호 (복원할 수 없는 형태로 저장)' },
      { text: '성적표 원본(사진 · PDF) : 기기 안에서 글자를 읽는 데에만 사용' },
      { text: '분석 요청 정보 : 확인 화면에서 확정한 성적 숫자, 희망 학과, 선호 전형 등 지원 방향' },
    ],
  },
  {
    title: '왜 사용하나요 ?',
    items: [
      { text: '성적을 바탕으로 원서 6장을 추천하고 설명하는 데에만 사용' },
      { text: '로그인한 회원의 리포트를 자동 저장하고 마이페이지에서 보여주는 데 사용' },
    ],
  },
  {
    title: '서버로 보내는 것과 보내지 않는 것',
    items: [
      { label: '보내지 않아요', text: '성적표 원본 이미지 · PDF, 서술형 문장 전체' },
      { label: '내부 서버로 보내요', text: '분석에 필요한 성적 숫자와 지원 방향 (따로 저장 안함)' },
      {
        label: '해외 외부 AI로 보내요',
        text: '설명 문장 작성을 위해 계산된 평균 등급, 희망 학과, 선호 전형, 추천 원서 목록과 근거 전달.\n과목별 성적, 이름, 이메일, 계정 정보는 보내지 않음',
      },
    ],
  },
  {
    title: '저장하는 것과 저장하지 않는 것',
    items: [
      { label: '저장', text: '추천 원서 6장, 추천 이유, 생성 시각' },
      { label: '저장 안함', text: '입력한 성적, 참고 평균, 인사·요약 문장, 전체 리포트, 원본' },
      { text: '같은 요청은 한 번만 저장되고, 다시 분석하면 새 리포트가 저장' },
      { text: '추천 원서가 0장이면 저장하지 않음' },
    ],
  },
  {
    title: '얼마나 보관하나요 ?',
    items: [
      { text: '직접 삭제하거나 회원 탈퇴할 때까지 보관. 별도 보관 기간과 자동 삭제는 없음' },
      { text: '회원 탈퇴하면 저장된 리포트 · 추천 원서 · 로그인 토큰 삭제' },
    ],
  },
  {
    title: 'AI 설명 생성과 외부 전달',
    items: [
      { text: '리포트의 설명 문장은 외부 AI 서비스(OpenAI API)가 작성\n계산과 추천은 AI가 아니라 서버가 작동' },
      { text: '해외 AI 서비스를 사용. 처리 국가는 확인 중' },
      {
        text: '전달한 정보는 공식 정책상 AI 모델 학습에 사용되지 않음(데이터 공유 미사용)',
        strong: '다만 악용 방지를 위해 최대 30일 보관 가능',
      },
    ],
  },
  {
    title: '내 권리와 동의 거부',
    items: [
      { text: '저장된 리포트는 마이페이지에서 언제든 보거나 삭제 가능' },
      { text: '회원 탈퇴를 요청할 수 있음' },
      { text: '개인정보 처리에 동의하지 않을 수 있음. 다만 동의하지 않으면 서비스 이용 불가' },
    ],
  },
  {
    title: '문의처와 시행일',
    items: [
      // TODO: Figma 표기 그대로예요. 실제 문의 이메일 주소 확인이 필요해요.
      { text: 'LikeLion @ gmail.com' },
      { text: '2026 / 11 / 20' },
    ],
  },
];

export default function PrivacyPage() {
  const navigate = useNavigate();

  // 약관 화면으로 돌아가면서 동의 체크를 켭니다.
  // 약관 → 안내 이동도 replace 라서, 뒤로가기 기록에 안내 화면이 쌓이지 않아요.
  const handleConfirm = () => {
    const state: TermsState = { privacyConfirmed: true };
    navigate('/terms', { replace: true, state });
  };

  return (
    <section className="auth-page privacy-page" aria-labelledby="privacy-title">
      <h1 id="privacy-title" className="privacy-title">개인정보 처리 안내</h1>

      <section className="privacy-summary" aria-labelledby="privacy-summary-title">
        <h2 id="privacy-summary-title">한눈에 보기</h2>
        <ul>
          {SUMMARY.map(line => <li key={line}>{line}</li>)}
        </ul>
      </section>

      <ol className="privacy-sections">
        {SECTIONS.map((section, index) => (
          <li key={section.title} className="privacy-section">
            <h2>{index + 1}. {section.title}</h2>
            <ul className="privacy-section__list">
              {section.items.map(item => (
                <li key={item.text}>
                  {/* Figma: 라벨만 600, 뒤의 ' : ' 부터는 400 */}
                  {item.label && <><strong>{item.label}</strong> : </>}
                  {item.text}
                  {item.strong && <><br /><strong>{item.strong}</strong></>}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      <div className="privacy-actions">
        <button type="button" className="privacy-confirm" onClick={handleConfirm}>확인했어요</button>
      </div>
    </section>
  );
}
