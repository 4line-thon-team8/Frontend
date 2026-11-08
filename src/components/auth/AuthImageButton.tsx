type AuthImageButtonProps = {
  /** 화면 낭독기용 버튼 이름 (예: '로그인') */
  label: string;
  /** 활성 상태 SVG (그림자 포함 367 × 66) */
  activeSrc: string;
  /** 입력 전 비활성 상태 SVG (350 × 49) */
  beforeSrc: string;
  enabled: boolean;
};

/** Figma 에서 내보낸 버튼 SVG 를 그대로 쓰는 제출 버튼. 스타일은 AuthPage.css 의 .auth-image-button */
export default function AuthImageButton({ label, activeSrc, beforeSrc, enabled }: AuthImageButtonProps) {
  return (
    <button type="submit" className="auth-image-button" disabled={!enabled} aria-label={label}>
      <img
        className={enabled ? 'auth-image-button__active' : 'auth-image-button__before'}
        src={enabled ? activeSrc : beforeSrc}
        alt=""
      />
    </button>
  );
}
