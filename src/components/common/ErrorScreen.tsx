import { Link } from 'react-router';
import './ErrorScreen.css';

type ErrorScreenProps = {
  /** 아이콘 + 제목 + 설명이 함께 그려진 Figma SVG (폭 244px) */
  image: string;
  imageHeight: number;
  /** 이미지 속 문구 — 화면 낭독기용으로 숨겨서 넣습니다. */
  title: string;
  description: string;
  actionLabel: string;
  actionTo: string;
};

/**
 * 공통 오류 · 권한 화면 (Figma 'S-00~ 공통 오류·권한').
 * 가운데에 안내 이미지, 아래에 초록 버튼 하나가 있습니다.
 */
export default function ErrorScreen({ image, imageHeight, title, description, actionLabel, actionTo }: ErrorScreenProps) {
  return (
    <section className="error-screen" aria-labelledby="error-screen-title">
      <div className="error-screen__message">
        <img src={image} alt="" width="244" height={imageHeight} />
        <h1 id="error-screen-title" className="error-screen__sr-only">{title}</h1>
        <p className="error-screen__sr-only">{description}</p>
      </div>
      <Link className="error-screen__action" to={actionTo} replace>{actionLabel}</Link>
    </section>
  );
}
