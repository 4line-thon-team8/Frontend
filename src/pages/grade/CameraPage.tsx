import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import chevron from '../../assets/icons/chevron-right.svg';
import { useCamera } from '../../hooks/useCamera';
import { setGradeImage } from '../../utils/gradeImageStore';
import type { GradeImage } from '../../utils/gradeImageStore';
import './CameraPage.css';

function CameraIcon({ kind }: { kind: 'gallery' | 'switch' | 'flash' }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {kind === 'gallery' && <><rect x="4" y="4" width="16" height="16" rx="2" /><circle cx="9" cy="9" r="1.5" /><path d="m5 18 5-5 3 3 3-4 4 5" /></>}
      {kind === 'switch' && <><path d="M4 10a8 8 0 0 1 13-4l3 3M20 4v5h-5M20 14A8 8 0 0 1 7 18l-3-3M4 20v-5h5" /></>}
      {kind === 'flash' && <path d="m13 2-8 12h6l-1 8 9-13h-6l1-7Z" />}
    </svg>
  );
}

export default function CameraPage() {
  const navigate = useNavigate();
  const [photo, setPhoto] = useState<GradeImage | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const mounted = useRef(false);
  const operation = useRef(0);
  const { videoRef, status, error, torchOn, torchSupported, torchBusy, stop, restart, switchCamera, markReady, onPlaybackPause, toggleTorch } = useCamera(!photo);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; operation.current += 1; };
  }, []);

  useEffect(() => {
    if (!photo) return;
    const url = URL.createObjectURL(photo.file);
    // 객체 URL은 미리보기에서만 사용하고 화면 이탈 시 해제합니다.
    queueMicrotask(() => { if (mounted.current) setPreviewUrl(url); });
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  async function capture() {
    const video = videoRef.current;
    if (!video || status !== 'ready' || busy || !video.videoWidth || !video.videoHeight) return;
    setBusy(true);
    setMessage('');
    const current = ++operation.current;
    try {
      const canvas = document.createElement('canvas');
      // object-fit: cover 미리보기와 동일한 중앙 영역을 원본 해상도로 저장합니다.
      const ratio = video.clientWidth / video.clientHeight;
      const sourceRatio = video.videoWidth / video.videoHeight;
      const width = sourceRatio > ratio ? video.videoHeight * ratio : video.videoWidth;
      const height = sourceRatio > ratio ? video.videoHeight : video.videoWidth / ratio;
      canvas.width = Math.round(width);
      canvas.height = Math.round(height);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('canvas');
      context.drawImage(video, (video.videoWidth - width) / 2, (video.videoHeight - height) / 2, width, height, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('capture')), 'image/jpeg', 0.95));
      if (!mounted.current || current !== operation.current) return;
      stop();
      setPhoto({ file: new File([blob], `grade-${Date.now()}.jpg`, { type: 'image/jpeg' }), source: 'camera' });
    } catch {
      if (mounted.current && current === operation.current) setMessage('사진을 저장하지 못했습니다. 다시 촬영해주세요.');
    } finally { if (mounted.current && current === operation.current) setBusy(false); }
  }

  async function selectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const current = ++operation.current;
    setMessage('');
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
      setMessage('JPG, PNG, WebP 등 사진 파일을 선택해주세요.'); return;
    }
    if (file.size > 30 * 1024 * 1024) { setMessage('30MB 이하의 이미지를 선택해주세요.'); return; }
    setBusy(true);
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (!mounted.current || current !== operation.current) return;
      stop();
      setPhoto({ file, source: 'gallery' });
    } catch {
      if (mounted.current && current === operation.current) setMessage('이 사진 형식을 표시할 수 없습니다. JPG 또는 PNG로 저장한 뒤 다시 선택해주세요.');
    } finally {
      URL.revokeObjectURL(url);
      if (mounted.current && current === operation.current) setBusy(false);
    }
  }

  function retake() {
    operation.current += 1;
    setPhoto(null);
    setPreviewUrl('');
    setMessage('');
    restart();
  }

  function usePhoto() {
    if (!photo) return;
    stop();
    setGradeImage(photo);
    navigate('/grade/confirm');
  }

  return (
    <section className="grade-camera-page" aria-label="성적표 카메라">
      <div className="grade-camera-shell">
        <header className="grade-camera-header">
          <Link to="/grade/input" aria-label="성적표 입력 방법 선택으로 돌아가기"><img src={chevron} width="10" height="18" alt="" /></Link>
          <span>{photo ? '사진 확인' : '성적표 촬영'}</span>
        </header>
        <div className="grade-camera-preview">
          {photo ? <img className="grade-camera-photo" src={previewUrl || undefined} alt="선택한 성적표 사진" /> : <>
            <video ref={videoRef} autoPlay playsInline muted onLoadedData={markReady} onPlaying={markReady} onPause={onPlaybackPause} aria-label="실시간 카메라 영상" />
            <div className="grade-camera-grid" aria-hidden="true"><i /><i /><i /><i /></div>
            {status !== 'ready' && <div className="grade-camera-status" role="status">
              <p>{status === 'requesting' ? '카메라 연결 중입니다. 권한 요청이 표시되면 허용해주세요.' : status === 'paused' ? error || '카메라가 일시 중지되었습니다.' : error}</p>
              {(status === 'error' || status === 'paused') && <button type="button" onClick={restart}>카메라 다시 시작</button>}
            </div>}
            {torchSupported && status === 'ready' && <button type="button" className="grade-camera-flash" aria-label="플래시" aria-pressed={torchOn} disabled={torchBusy || busy} onClick={() => void toggleTorch()}><CameraIcon kind="flash" /></button>}
          </>}
        </div>
        <div className="grade-camera-feedback" aria-live="polite">{message || (status === 'ready' && !photo ? error : '')}</div>
        {photo ? <div className="grade-camera-review-actions">
          <button type="button" className="grade-camera-retake" onClick={retake}>다시 촬영</button>
          <button type="button" className="grade-camera-use" onClick={usePhoto} disabled={!previewUrl}>사진 사용</button>
        </div> : <div className="grade-camera-controls">
          <button type="button" className="grade-camera-icon-button" aria-label="갤러리에서 사진 선택" disabled={busy} onClick={() => inputRef.current?.click()}><CameraIcon kind="gallery" /></button>
          <button type="button" className="grade-camera-shutter" aria-label="성적표 촬영" disabled={status !== 'ready' || busy} onClick={() => void capture()} />
          <button type="button" className="grade-camera-icon-button" aria-label="전면 후면 카메라 전환" disabled={busy || status === 'requesting'} onClick={switchCamera}><CameraIcon kind="switch" /></button>
        </div>}
        <input ref={inputRef} type="file" accept="image/*" className="grade-camera-file" aria-label="성적표 이미지 파일" onChange={event => void selectImage(event)} />
      </div>
    </section>
  );
}
