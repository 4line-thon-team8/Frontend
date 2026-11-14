import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import BottomNavigation from '../../components/common/BottomNavigation';
import { logout } from '../../services/authApi';
import { APPLICATION_TIERS, TIER_LABELS } from '../report/reportTier';
import { MOCK_SAVED_REPORTS, SYSTEM_RULES, type SavedReport } from './mypage.mock';
import './MyPage.css';

function TrashIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 예: 추천 원서 4장 · 적정 2 / 도전 부담이 큰 후보 1 / 판단 자료 부족 1 (0장 구간은 빼요) */
function formatReportCounts(counts: SavedReport['counts']) {
  const tiers = APPLICATION_TIERS.filter(tier => (counts[tier] ?? 0) > 0);
  const total = tiers.reduce((sum, tier) => sum + (counts[tier] ?? 0), 0);
  return `추천 원서 ${total}장 · ${tiers.map(tier => `${TIER_LABELS[tier]} ${counts[tier]}`).join(' / ')}`;
}

export default function MyPage() {
  const navigate = useNavigate();
  // TODO: reportApi(GET /api/reports) 구현 후 실제 저장된 리포트로 교체합니다.
  const [reports, setReports] = useState(MOCK_SAVED_REPORTS);

  const handleDelete = (id: string) => {
    // TODO: DELETE /api/reports/{report_id} 연동 후 성공했을 때만 목록에서 지웁니다.
    setReports(current => current.filter(report => report.id !== id));
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="mypage-page">
      <header className="mypage-header">
        <p>마이페이지</p>
        <h1>저장된 리포트</h1>
      </header>

      <ul className="mypage-reports">
        {reports.map(report => (
          <li key={report.id} className="mypage-report-card">
            <h2>
              <Link to={`/mypage/reports/${report.id}`}>
                <span className="mypage-report-card__date">{report.createdAt}</span>
                {report.title}
              </Link>
            </h2>
            <p>{formatReportCounts(report.counts)}</p>
            <button type="button" className="mypage-report-card__delete" onClick={() => handleDelete(report.id)} aria-label={`${report.createdAt} 리포트 삭제`}>
              <TrashIcon />
              삭제
            </button>
          </li>
        ))}
      </ul>

      <Link className="mypage-add" to="/grade/input">+ 추가</Link>

      <hr className="mypage-divider" />

      <section className="mypage-rules" aria-labelledby="mypage-rules-title">
        <h2 id="mypage-rules-title">시스템 규칙</h2>
        <ul>
          {SYSTEM_RULES.map((rule, index) => (
            <li key={index}><strong>{rule.title}</strong> - {rule.description}</li>
          ))}
        </ul>
      </section>

      <button type="button" className="mypage-primary-button mypage-logout" onClick={() => void handleLogout()}>로그아웃</button>
      <p className="mypage-note">*회원 탈퇴 시 저장된 리포트가 모두 삭제돼요.</p>

      <BottomNavigation />
    </div>
  );
}
