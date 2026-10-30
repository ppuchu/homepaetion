# 🏢 홈페이션 AI 오피스

AI 직원들이 앉아 있는 가상 사무실입니다. 책상을 클릭해 업무를 맡기면 Claude API가 실시간으로 결과물을 작성합니다.

## AI 직원

| 직원 | 직무 | 맡기면 좋은 일 |
|---|---|---|
| 🦉 코토 | 비서실장 | 업무를 받아 담당 직원에게 배분하고 결과를 모아 보고 |
| 🧭 하나 | 기획실장 | 견적서 초안, 일정표, 요구사항 정의서, 상담 질문지 |
| 🎨 디디 | 웹디자이너 | 디자인 컨셉, 컬러 팔레트·폰트, 레이아웃 |
| ✍️ 카피 | 카피라이터 | 헤드라인, 서비스 소개, 블로그, 인스타 캡션 |
| 📈 마키 | 마케터 | SEO 키워드·메타태그, 릴스 대본, 콘텐츠 캘린더 |
| 💻 코디 | 개발자 | HTML/CSS/JS 코드, 반응형, 폼·지도 연동 |
| 🗂️ 한별 | 경영지원 | 고객 메일, 계약 체크리스트, 세금계산서 안내 |

직원을 추가하거나 성격을 바꾸려면 `src/agents.js`만 수정하면 됩니다.

## 사무실 배치

비서실(코토)이 사무실 한가운데에 있고, 다섯 부서가 비서실을 둘러싸고 있어요.

```
┌──────────┬────────────────┬────────────┐
│  기획실  │ 디자인 스튜디오 │  마케팅룸  │
├──────────┼────────────────┼────────────┤
│  개발실  │ ★ 비서실(코토) │ 경영지원실 │
├──────────┼────────────────┼────────────┤
│  회의실  │     대표실     │   휴게실   │
└──────────┴────────────────┴────────────┘
```

## 기능

- **코토에게 맡기기**: 업무를 적으면 코토가 담당 직원(1~4명)을 정해 순서대로 일을 시키고, 결과를 모아 보고서로 정리. 직원 결과물은 각 직원의 대화방에도 남아서 이어서 수정 요청 가능
- **1:1 업무 지시**: 책상 클릭 → 업무 입력 → 답변이 실시간으로 작성됨 (대화 기록은 브라우저에 저장)
- **회의 소집**: 안건 하나를 여러 직원에게 던지면, 앞사람 의견을 참고해 순서대로 발언
- **업무 일지**: 오늘 맡긴 업무 목록
- 마크다운 표·코드 블록 렌더링, 답변 복사 버튼, 모바일 화면 지원

## 로컬에서 실행

Node.js 20 이상이 필요합니다.

```bash
cd ai-office
npm install
cp .dev.vars.example .dev.vars   # .dev.vars 파일에 ANTHROPIC_API_KEY 입력
npm run dev                      # http://localhost:8787
```

API 키는 [Anthropic 콘솔](https://console.anthropic.com)에서 발급합니다. 키는 서버(Worker)에서만 쓰이고 브라우저로 전달되지 않습니다.

## Cloudflare에 배포

처음 한 번만 Cloudflare 계정에 로그인하고 비밀값을 등록합니다.

```bash
cd ai-office
npx wrangler login                          # 브라우저에서 Cloudflare 로그인
npx wrangler secret put ANTHROPIC_API_KEY   # API 키 붙여넣기
npx wrangler secret put OFFICE_PASSWORD     # 사무실 비밀번호 정하기
npm run deploy                              # https://homepaetion-ai-office.<계정>.workers.dev 로 배포
```

이후 코드를 고치면 `npm run deploy`만 다시 실행하면 됩니다.

> ⚠️ `OFFICE_PASSWORD`는 꼭 설정하세요. 설정하지 않으면 주소를 아는 누구나 내 API 키로 요청을 보낼 수 있습니다.

- **비용**: 무료 플랜(하루 10만 요청)으로 충분합니다. Claude API 사용료는 Anthropic에서 별도로 청구됩니다.
- **내 도메인 연결**: Cloudflare 대시보드 → Workers & Pages → `homepaetion-ai-office` → Settings → Domains & Routes에서 `office.도메인.com` 같은 주소를 추가할 수 있습니다.
- **GitHub 자동 배포**: 대시보드에서 이 저장소를 연결하고 Root directory를 `ai-office`로 지정하면, push할 때마다 자동 배포됩니다.

## 설정

| 이름 | 넣는 곳 | 설명 |
|---|---|---|
| `ANTHROPIC_API_KEY` | secret / `.dev.vars` | 필수. Claude API 키 |
| `OFFICE_PASSWORD` | secret / `.dev.vars` | 선택. 설정하면 비밀번호를 입력해야 AI 직원을 쓸 수 있음 |
| `CLAUDE_MODEL` | `wrangler.jsonc`의 `vars` | 사용할 모델. 기본값 `claude-opus-5-5` |

## 구조

```
ai-office/
├── wrangler.jsonc   # Cloudflare Workers 설정
├── src/worker.js    # Worker 진입점 (/api/* 라우팅)
├── src/api.js       # Claude API 호출 (스트리밍 답변, 코토 업무 배분)
├── src/agents.js    # AI 직원 명부와 역할(시스템 프롬프트), 코토의 업무 배분 형식
└── public/          # 사무실 화면 (HTML/CSS/JS) - Workers Assets로 제공
```
