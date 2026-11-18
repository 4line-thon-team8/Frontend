import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // 로컬 개발용: BE 가 localhost CORS 를 허용하지 않아서, 개발 서버가 /api 요청을 BE 로 대신 전달합니다.
  // .env 에 VITE_API_BASE_URL=/ 와 API_PROXY_TARGET=<BE 주소> 를 함께 넣으면 동작해요. 배포 빌드에는 영향이 없어요.
  const { API_PROXY_TARGET } = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    // 워커는 모두 { type: 'module' } 로 불러오고, 분석 워커는 모델 파일을 동적 import 로 따로 읽는다.
    // 기본 형식(iife)은 이렇게 파일을 나누는 워커를 만들 수 없어서 es 로 둔다.
    worker: { format: 'es' },
    server: API_PROXY_TARGET
      ? {
        proxy: {
          '/api': {
            target: API_PROXY_TARGET,
            changeOrigin: true,
            secure: true,
            // 브라우저는 POST·DELETE 에 Origin: http://localhost:5173 을 붙이는데, BE CORS 가 이를 403 으로 막아요.
            // 서버끼리 전달하는 요청이라 Origin 이 필요 없으니 지워서 보내요. (GET 은 원래 Origin 이 없어서 됐어요)
            configure: proxy => {
              proxy.on('proxyReq', proxyReq => proxyReq.removeHeader('origin'));
            },
          },
        },
      }
      : undefined,
  };
});
