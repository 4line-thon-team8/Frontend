import ErrorScreen from '../../components/common/ErrorScreen';
import loginError from '../../assets/icons/login-error.svg';

/** 세션 만료 — 로그인 화면으로 이동합니다. */
export default function SessionExpiredPage() {
  return (
    <ErrorScreen
      image={loginError}
      imageHeight={212}
      title="시간이 오래 지나 로그인을 다시해주세요."
      description="로그인 화면으로 이동해주세요."
      actionLabel="로그인 화면 가기"
      actionTo="/login"
    />
  );
}
