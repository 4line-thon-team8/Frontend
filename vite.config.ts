import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // 로컬 개발용: BE 가 localhost CORS 를 허용하지 않아서, 개발 서버가 /api 요청을 BE 로 대신 전달합니다.
  // .env 에 VITE_API_BASE_URL=/ 와 API_PROXY_TARGET=<BE 주소> 를 함께 넣으면 동작해요. 배포 빌드에는 영향이 없어요.
  const { API_PROXY_TARGET } = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: API_PROXY_TARGET
      ? { proxy: { '/api': { target: API_PROXY_TARGET, changeOrigin: true, secure: true } } }
      : undefined,
  };
});
