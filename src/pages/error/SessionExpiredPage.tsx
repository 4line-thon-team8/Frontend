import { useEffect } from 'react';
import { useLocation } from 'react-router';
import ErrorScreen from '../../components/common/ErrorScreen';
import loginError from '../../assets/icons/login-error.svg';
import { getReturnTo } from '../../services/authApi';
import { clearAccessToken } from '../../services/authToken';

/**
 * 세션 만료(401 UNAUTHORIZED) — 로그인 화면으로 이동합니다.
 * 들어올 때 받은 state.from 을 로그인 화면에 넘겨서, 재로그인 후 원래 화면(예: S-03)으로 돌아가요.
 */
export default function SessionExpiredPage() {
  const location = useLocation();
  const from = getReturnTo(location.state);

  useEffect(() => { clearAccessToken(); }, []);

  return (
    <ErrorScreen
      image={loginError}
      imageHeight={212}
      title="시간이 오래 지나 로그인을 다시해주세요."
      description="로그인 화면으로 이동해주세요."
      actionLabel="로그인 화면 가기"
      actionTo="/login"
      actionState={from ? { from } : undefined}
    />
  );
}
