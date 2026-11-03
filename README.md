# 오등급 Frontend

성적표 입력과 대학·학과 지원 전략을 제공하는 모바일 중심 서비스의 프론트엔드 초기 환경입니다. 이슈 #1 범위로, 모든 페이지는 제목만 표시하며 실제 기능과 API 호출은 구현하지 않았습니다.

## 실행

Node.js 22.12 이상과 npm을 사용합니다. 검증 환경: Node.js 24.15.0 / npm 11.12.1.

```sh
npm install
# .env.example을 .env.local로 복사하고 API 주소를 설정하세요.
npm run dev
```

기본 개발 주소: http://localhost:5173. 재현 가능한 설치에는 `npm ci`를 사용합니다.

```sh
npm run typecheck
npm run lint
npm run build
npm run preview
```

## 기술 스택

React 19, TypeScript 5.9, Vite 7, React Router 7, 기본 CSS, Fetch API.
의존성의 정확한 설치 버전은 package-lock.json으로 고정합니다.

## 폴더 구조

```text
src/
├── main.tsx
├── vite-env.d.ts
├── app/                   # App.tsx, router.tsx
├── pages/
│   ├── auth/              # SplashPage, LoginPage, SignupPage, TermsPage
│   ├── grade/             # GradeInputPage, CameraPage, PdfUploadPage,
│   │                      # GradeConfirmPage, AnalysisLoadingPage
│   ├── report/            # ReportSummaryPage, StrategyPage, RecommendationPage
│   ├── mypage/            # MyPage, ReportListPage, ReportDetailPage
│   └── error/             # CameraErrorPage, AnalysisErrorPage, SessionExpiredPage
├── components/
│   ├── common/            # Button, Header, Loading, BottomNavigation
│   ├── grade/
│   ├── report/
│   └── mypage/
├── layouts/               # MobileLayout.tsx
├── services/              # apiClient, authApi, simulationApi, reportApi, lookupApi
├── hooks/
├── types/
├── utils/
├── constants/
├── assets/images/
└── styles/                # global.css, variables.css
```

페이지·컴포넌트는 `.tsx`, 서비스는 `.ts`입니다. 빈 폴더는 `.gitkeep`으로 보존합니다.

## 작업 영역

| 담당 | 영역 |
| --- | --- |
| FE1 | pages/grade, components/grade, services/simulationApi.ts |
| FE2 | pages/auth, pages/report, pages/mypage, pages/error, components/report, components/mypage, services/authApi.ts, services/reportApi.ts |
| 공통 협의 | app, components/common, layouts, services/apiClient.ts, services/lookupApi.ts, types, styles, hooks, utils, constants, assets, 루트 설정 |

공통 파일은 수정 전에 담당자와 변경 내용을 합의하고 동시 수정을 피합니다. 새 화면 경로 추가 시 router.tsx 변경을 협의하세요. 현재 작업 브랜치는 `chore/1-frontend-setup`입니다. main/develop 직접 수정이나 push를 하지 않습니다.

## 라우팅

| 경로 | 페이지 |
| --- | --- |
| `/` | SplashPage |
| `/login` | LoginPage |
| `/signup` | SignupPage |
| `/terms` | TermsPage |
| `/grade/input` | GradeInputPage |
| `/grade/camera` | CameraPage |
| `/grade/upload` | PdfUploadPage |
| `/grade/confirm` | GradeConfirmPage |
| `/grade/loading` | AnalysisLoadingPage |
| `/report/summary` | ReportSummaryPage |
| `/report/strategy` | StrategyPage |
| `/report/recommendations` | RecommendationPage |
| `/mypage` | MyPage |
| `/mypage/reports` | ReportListPage |
| `/mypage/reports/:reportId` | ReportDetailPage |
| `/error/camera` | CameraErrorPage |
| `/error/analysis` | AnalysisErrorPage |
| `/error/session-expired` | SessionExpiredPage |

미등록 경로에는 페이지 없음 안내를 표시합니다. 배포 서버는 모든 프론트엔드 페이지 경로를 index.html로 연결하는 SPA fallback이 필요합니다.

## API 및 추후 개발

- `.env.local`에 `VITE_API_BASE_URL=http://localhost:8000`을 설정합니다. 생략하면 현재 origin을 사용합니다. 개발 프록시는 설정하지 않았습니다.
- `VITE_` 환경 변수는 브라우저에 공개됩니다. 비밀키나 토큰을 넣지 마세요. `.env.example`만 Git에 포함합니다.
- apiClient는 요청 옵션을 Fetch에 전달하고 JSON/텍스트/빈 응답을 처리합니다. HTTP 실패는 ApiError(status, body)로 전달하며 네트워크·취소 오류는 그대로 전달합니다.
- 응답은 unknown입니다. API 명세 확정 후 공통 타입과 런타임 검증을 서비스 계층에 추가하세요. 서비스 파일에는 담당 API 메모만 있으며 임의 payload나 가짜 응답은 없습니다.
- 인증 방식, 쿠키 credentials, 토큰 처리, JSON Content-Type, 업로드 FormData, 백엔드 CORS/CSRF 정책은 명세에 맞춰 협의하세요. FormData의 Content-Type은 브라우저가 설정하게 두세요.
- 성적·개인정보를 로그나 URL 쿼리에 남기지 마세요. 카메라 권한과 PDF 검증은 실제 기능 개발 시 구현합니다.
- 공통 컴포넌트는 재사용을 위한 최소 구조이며 레이아웃에 헤더/하단 메뉴를 강제로 표시하지 않습니다. 화면별 표시 정책을 합의하세요.
- variables.css의 초록색·회녹색 및 너비 값은 임시 토큰입니다. 실제 Figma 값을 확인해 조정하세요.
- 기존 `.github` 이슈/PR 템플릿과 `.gitignore`를 유지합니다.

참고: [Vite 공식 가이드](https://vite.dev/guide/), [React Router 설치](https://reactrouter.com/start/declarative/installation).

## 초기 세팅 검증 결과

- npm install, npm run typecheck, npm run lint, npm run build 통과.
- npm run dev 정상 기동. 임시 Vite 서버에서 18개 페이지 HTTP 200 및 모듈 변환 확인.
- MemoryRouter와 서버 렌더링으로 18개 경로 및 미등록 경로의 제목 렌더링 확인. 실제 브라우저 클릭·화면 검증은 수행하지 않았습니다.
- npm audit: 개발 도구의 minimatch(<11.0.1) 관련 중간 등급 12건이 보고되었습니다. 자동 제안이 도구 다운그레이드를 포함하므로 적용하지 않았습니다. 호환되는 도구 업데이트 시 재확인하세요.
- npm audit --omit=dev: 실행용 의존성 취약점 0건.
- 기존 .github/.gitignore 변경 없음. commit/push/PR 생성 없음.
