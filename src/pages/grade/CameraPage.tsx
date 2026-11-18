import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import chevron from '../../assets/icons/chevron-right.svg';
import { useCamera } from '../../hooks/useCamera';
import { setGradeImage } from '../../utils/gradeImageStore';
import type { GradeImage } from '../../utils/gradeImageStore';
import { extractImageText } from '../../utils/extractImageText';
import { analyzeNarrative, analyzeNarrativeWithBundledModel } from '../../utils/holistic/analyzeNarrative';
import { preloadBundledModel } from '../../utils/holistic/model';
import { recognizeGradeImages } from '../../utils/recognizeGradeImages';
import { useGradeAnalysis } from '../../app/gradeAnalysisContext';
import type { ConfirmSubject } from '../../types/gradeConfirm';
import './CameraPage.css';

type OcrState =
  | { kind: 'idle' }
  | { kind: 'working'; page: number; progress: number | null }
  | { kind: 'empty'; failed: number; empty: number; narrative: ReturnType<typeof analyzeNarrative> | null };

type Photo = GradeImage & { id: number; url: string };

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
  const { setPendingOcrSubjects, setNarrative } = useGradeAnalysis();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const photo = photos.find(item => item.id === selectedId);
  const photoId = useRef(0);
  const previewUrls = useRef(new Set<string>());
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [ocr, setOcr] = useState<OcrState>({ kind: 'idle' });
  const activeOcr = useRef<AbortController | null>(null);
  const recognizing = ocr.kind === 'working';
  const inputRef = useRef<HTMLInputElement>(null);
  const mounted = useRef(false);
  const operation = useRef(0);
  const { videoRef, status, error, torchOn, torchSupported, torchBusy, restart, switchCamera, markReady, onPlaybackPause, toggleTorch } = useCamera(!photo && !recognizing);

  // 서술 분석 모델은 별도 파일이라 화면에 들어올 때 미리 읽어 둬요.
  useEffect(() => { preloadBundledModel(); }, []);

  useEffect(() => {
    const urls = previewUrls.current;
    mounted.current = true;
    return () => {
      mounted.current = false;
      operation.current += 1;
      activeOcr.current?.abort();
      for (const url of urls) URL.revokeObjectURL(url);
      urls.clear();
    };
  }, []);

  function addPhotos(images: GradeImage[]) {
    const added = images.map(image => {
      const url = URL.createObjectURL(image.file);
      previewUrls.current.add(url);
      return { ...image, id: ++photoId.current, url };
    });
    setPhotos(current => [...current, ...added]);
    setOcr({ kind: 'idle' });
    return added.at(-1)?.id ?? null;
  }

  function removePhoto(item: Photo) {
    URL.revokeObjectURL(item.url);
    previewUrls.current.delete(item.url);
    setPhotos(current => current.filter(photo => photo.id !== item.id));
    if (selectedId === item.id) setSelectedId(null);
    setOcr({ kind: 'idle' });
  }

  async function capture() {
    const video = videoRef.current;
    if (!video || status !== 'ready' || busy || activeOcr.current || !video.videoWidth || !video.videoHeight) return;
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
      addPhotos([{ file: new File([blob], `grade-${Date.now()}.jpg`, { type: 'image/jpeg' }), source: 'camera' }]);
    } catch {
      if (mounted.current && current === operation.current) setMessage('사진을 저장하지 못했습니다. 다시 촬영해주세요.');
    } finally { if (mounted.current && current === operation.current) setBusy(false); }
  }

  async function selectImage(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!files.length || busy || activeOcr.current) return;
    const current = ++operation.current;
    setMessage('');
    setBusy(true);
    const valid: GradeImage[] = [];
    try {
      for (const file of files) {
        if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.size > 30 * 1024 * 1024) continue;
        const url = URL.createObjectURL(file);
        previewUrls.current.add(url);
        try {
          const image = new Image();
          image.src = url;
          await image.decode();
          valid.push({ file, source: 'gallery' });
        } catch {
          // 다른 이미지의 검증은 계속합니다.
        } finally {
          URL.revokeObjectURL(url);
          previewUrls.current.delete(url);
        }
        if (!mounted.current || current !== operation.current) return;
      }
      if (valid.length) setSelectedId(addPhotos(valid));
      const rejected = files.length - valid.length;
      if (rejected) setMessage(`사진 ${rejected}장을 추가하지 못했어요. 열 수 있는 30MB 이하의 JPG, PNG, WebP 등을 선택해 주세요.`);
    } finally {
      if (mounted.current && current === operation.current) setBusy(false);
    }
  }

  function cancelOcr() {
    activeOcr.current?.abort();
    setOcr({ kind: 'idle' });
  }

  async function recognizePhotos() {
    if (!photos.length || busy || activeOcr.current) return;
    const request = new AbortController();
    activeOcr.current = request;
    try {
      const { subjects, text, failed, empty } = await recognizeGradeImages(photos.map(item => item.file), request.signal, (file, index) => {
        const page = index + 1;
        setOcr({ kind: 'working', page, progress: null });
        return extractImageText(file, request.signal, ({ progress }) => {
          if (!request.signal.aborted) setOcr({ kind: 'working', page, progress });
        });
      });
      request.signal.throwIfAborted();
      const narrative = text.trim() ? await analyzeNarrativeWithBundledModel(text) : null;
      request.signal.throwIfAborted();
      if (subjects.length) openGradeConfirm(subjects, narrative, failed + empty);
      else setOcr({ kind: 'empty', failed, empty, narrative });
    } catch {
      if (!request.signal.aborted) setOcr({ kind: 'empty', failed: photos.length, empty: 0, narrative: null });
    } finally {
      if (activeOcr.current === request) activeOcr.current = null;
    }
  }

  function openGradeConfirm(subjects: ConfirmSubject[] | null, narrative: ReturnType<typeof analyzeNarrative> | null, skipped = 0) {
    const firstPhoto = photos[0];
    if (!firstPhoto) return;
    setNarrative(narrative);
    setPendingOcrSubjects(subjects);
    setGradeImage({ file: firstPhoto.file, source: firstPhoto.source });
    navigate('/grade/confirm', { replace: true, state: skipped ? { skippedPhotos: skipped } : undefined });
  }

  return (
    <section className="grade-camera-page" aria-label="성적표 카메라">
      <div className="grade-camera-shell">
        <header className="grade-camera-header">
          <Link to="/grade/input" aria-label="성적표 입력 방법 선택으로 돌아가기"><img src={chevron} width="10" height="18" alt="" /></Link>
          <span>{photo ? '사진 확인' : '성적표 촬영'}</span>
        </header>
        <div className="grade-camera-preview">
          {photo ? <img className="grade-camera-photo" src={photo.url} alt="선택한 성적표 사진" /> : <>
            <video ref={videoRef} autoPlay playsInline muted onLoadedData={markReady} onPlaying={markReady} onPause={onPlaybackPause} aria-label="실시간 카메라 영상" />
            <div className="grade-camera-grid" aria-hidden="true"><i /><i /><i /><i /></div>
            {status !== 'ready' && <div className="grade-camera-status" role="status">
              <p>{status === 'requesting' ? '카메라 연결 중입니다. 권한 요청이 표시되면 허용해주세요.' : status === 'paused' ? error || '카메라가 일시 중지되었습니다.' : error}</p>
              {(status === 'error' || status === 'paused') && <button type="button" disabled={recognizing} onClick={restart}>카메라 다시 시작</button>}
            </div>}
            {torchSupported && status === 'ready' && <button type="button" className="grade-camera-flash" aria-label="플래시" aria-pressed={torchOn} disabled={torchBusy || busy || recognizing} onClick={() => void toggleTorch()}><CameraIcon kind="flash" /></button>}
          </>}
        </div>
        <div className="grade-camera-feedback" aria-live="polite">{message || (status === 'ready' && !photo ? error : '')}</div>
        {photos.length > 0 && <div className="grade-camera-photo-list">
          <p role="status">추가한 사진 {photos.length}장</p>
          <ul aria-label="추가한 성적표 사진">
            {photos.map((item, index) => (
              <li key={item.id}>
                <button type="button" className="grade-camera-thumbnail" aria-label={`${index + 1}번 사진 미리보기`} aria-pressed={item.id === selectedId} disabled={busy || recognizing} onClick={() => setSelectedId(item.id)}>
                  <img src={item.url} alt="" />
                  <span aria-hidden="true">{index + 1}</span>
                </button>
                <button type="button" className="grade-camera-remove" aria-label={`${index + 1}번 사진 삭제`} disabled={busy || recognizing} onClick={() => removePhoto(item)}>삭제</button>
              </li>
            ))}
          </ul>
        </div>}
        {ocr.kind !== 'idle' && <div className="grade-camera-ocr">
          <div role="status">
            {ocr.kind === 'working' ? `총 ${photos.length}장 중 ${ocr.page}번째 사진 분석 중` : <>
              <p>사진에서 과목과 등급을 찾지 못했어요.</p>
              {ocr.failed > 0 && <p>텍스트를 읽지 못한 사진 {ocr.failed}장</p>}
              {ocr.empty > 0 && <p>성적을 찾지 못한 사진 {ocr.empty}장</p>}
            </>}
          </div>
          {ocr.kind === 'working' && <progress aria-label="텍스트 인식 진행률" max={1} value={ocr.progress ?? undefined} />}
        </div>}
        <div className={photo ? 'grade-camera-review-actions' : 'grade-camera-controls'}>
          <button type="button" className="grade-camera-icon-button" aria-label="갤러리에서 사진 선택" disabled={busy || recognizing} onClick={() => inputRef.current?.click()}><CameraIcon kind="gallery" /></button>
          {photo
            ? <button type="button" className="grade-camera-retake" disabled={busy || recognizing} onClick={() => setSelectedId(null)}>추가 촬영</button>
            : <>
              <button type="button" className="grade-camera-shutter" aria-label="성적표 촬영" disabled={status !== 'ready' || busy || recognizing} onClick={() => void capture()} />
              <button type="button" className="grade-camera-icon-button" aria-label="전면 후면 카메라 전환" disabled={busy || recognizing || status === 'requesting'} onClick={switchCamera}><CameraIcon kind="switch" /></button>
            </>}
        </div>
        {photos.length > 0 && <div className="grade-camera-review-actions">
          {ocr.kind === 'working'
            ? <button type="button" className="grade-camera-retake" onClick={cancelOcr}>분석 취소</button>
            : <>
              <button type="button" className="grade-camera-use" disabled={busy} onClick={() => void recognizePhotos()}>{ocr.kind === 'empty' ? '다시 시도' : '사진 분석하기'}</button>
              {ocr.kind === 'empty' && <button type="button" className="grade-camera-retake" disabled={busy} onClick={() => openGradeConfirm(null, ocr.narrative)}>성적 확인으로 이동</button>}
            </>}
        </div>}
        <input ref={inputRef} type="file" accept="image/*" multiple className="grade-camera-file" aria-label="성적표 이미지 파일" onChange={event => void selectImage(event)} />
      </div>
    </section>
  );
}
