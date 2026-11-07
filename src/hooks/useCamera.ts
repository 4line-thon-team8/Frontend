import { useCallback, useEffect, useRef, useState } from 'react';

type CameraStatus = 'requesting' | 'ready' | 'error' | 'paused';
type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean };
type TorchConstraint = MediaTrackConstraintSet & { torch: boolean };

function cameraMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError': return '카메라 권한이 필요합니다. 브라우저의 사이트 설정에서 카메라를 허용한 후 다시 시도해주세요.';
    case 'NotFoundError': return '사용 가능한 카메라를 찾지 못했습니다. 갤러리에서 이미지를 선택할 수 있어요.';
    case 'AbortError': return '카메라 연결이 중단되었습니다. 다시 시작하거나 갤러리를 이용해주세요.';
    case 'NotReadableError': return '카메라를 시작할 수 없습니다. 다른 앱에서 사용 중인지 확인해주세요.';
    case 'OverconstrainedError': return '요청한 카메라를 사용할 수 없습니다. 다른 카메라로 전환하거나 갤러리를 이용해주세요.';
    default: return '카메라 영상을 표시하지 못했습니다. 다시 시도하거나 갤러리를 이용해주세요.';
  }
}

export function useCamera(enabled: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [status, setStatus] = useState<CameraStatus>('requesting');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [paused, setPaused] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchBusy, setTorchBusy] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => { track.onended = null; track.onmute = null; track.stop(); });
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const suspend = useCallback((message: string) => {
    stop();
    setError(message);
    setPaused(true);
    setStatus('paused');
  }, [stop]);

  useEffect(() => {
    if (!enabled) return;
    const onBackground = () => suspend('화면을 벗어나 카메라를 일시 중지했습니다. 다시 시작 버튼을 눌러주세요.');
    const onVisibility = () => { if (document.hidden) onBackground(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onBackground);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onBackground);
    };
  }, [enabled, suspend]);

  useEffect(() => {
    if (!enabled || paused) return;
    let active = true;
    let ownedStream: MediaStream | null = null;
    const video = videoRef.current;
    async function start() {
      // StrictMode의 이전 요청이나 화면 이탈 후 늦게 도착한 스트림을 사용하지 않습니다.
      await Promise.resolve();
      if (!active) return;
      setStatus('requesting');
      setError('');
      setTorchOn(false);
      setTorchSupported(false);
      setTorchBusy(false);
      try {
        if (!window.isSecureContext) throw new Error('insecure-context');
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 2560 } },
        });
        ownedStream = stream;
        if (!active || document.hidden) { stream.getTracks().forEach(track => track.stop()); return; }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        if (!track || !video) throw new Error('missing-video');
        const capabilities = track.getCapabilities?.() as TorchCapabilities | undefined;
        setTorchSupported(capabilities?.torch === true);
        track.onended = () => {
          if (!active) return;
          stop();
          setStatus('error');
          setError('카메라 연결이 종료되었습니다. 다시 시작해주세요.');
        };
        track.onmute = () => {
          // 시작 과정의 일시적인 mute는 무시하고, 실제 재생 후 입력 중단만 안내합니다.
          if (active && video.readyState >= 2) {
            suspend('카메라 영상 입력이 일시 중단되었습니다. 다시 시작해주세요.');
          }
        };
        video.srcObject = stream;
        try {
          await video.play();
        } catch {
          if (active) suspend('브라우저가 영상 재생을 시작하지 못했습니다. 카메라 다시 시작 버튼을 눌러주세요.');
          return;
        }
        if (active && streamRef.current === stream && video.readyState >= 2) setStatus('ready');
      } catch (cause) {
        ownedStream?.getTracks().forEach(track => track.stop());
        if (!active) return;
        stop();
        setStatus('error');
        setError(cause instanceof Error && cause.message === 'insecure-context'
          ? '카메라는 HTTPS 연결에서 사용할 수 있습니다. 보안 연결로 다시 접속하거나 갤러리를 이용해주세요.'
          : cause instanceof Error && cause.message === 'unsupported'
            ? '이 브라우저는 카메라 촬영을 지원하지 않습니다. Safari 또는 Chrome에서 열거나 갤러리를 이용해주세요.'
            : cameraMessage(cause));
      }
    }
    void start();
    return () => {
      active = false;
      ownedStream?.getTracks().forEach(track => { track.onended = null; track.onmute = null; track.stop(); });
      if (streamRef.current === ownedStream) streamRef.current = null;
      if (video?.srcObject === ownedStream) video.srcObject = null;
    };
  }, [enabled, facing, retry, paused, stop, suspend]);

  const restart = () => {
    stop();
    setStatus('requesting');
    setError('');
    setPaused(false);
    setRetry(value => value + 1);
  };
  const switchCamera = () => {
    stop();
    setStatus('requesting');
    setFacing(value => value === 'environment' ? 'user' : 'environment');
    setPaused(false);
  };
  const markReady = () => {
    if (videoRef.current?.srcObject === streamRef.current && streamRef.current) setStatus('ready');
  };
  const onPlaybackPause = () => {
    const video = videoRef.current;
    if (video && streamRef.current && video.srcObject === streamRef.current && video.readyState >= 2) {
      suspend('브라우저가 카메라 영상 재생을 일시 중지했습니다. 다시 시작해주세요.');
    }
  };
  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !torchSupported || torchBusy) return;
    setTorchBusy(true);
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as TorchConstraint] });
      if (streamRef.current?.getVideoTracks()[0] === track) setTorchOn(value => !value);
    } catch {
      if (streamRef.current?.getVideoTracks()[0] === track) {
        setTorchSupported(false);
        setError('이 기기에서 플래시를 켤 수 없습니다. 밝은 곳에서 촬영해주세요.');
      }
    } finally { if (streamRef.current?.getVideoTracks()[0] === track) setTorchBusy(false); }
  };

  return { videoRef, status, error, facing, torchOn, torchSupported, torchBusy, stop, restart, switchCamera, markReady, onPlaybackPause, toggleTorch };
}
