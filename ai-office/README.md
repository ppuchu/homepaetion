# 🏢 홈페이션 AI 오피스

AI 직원들이 앉아 있는 가상 사무실입니다. 책상을 클릭해 업무를 맡기면 Claude API가 실시간으로 결과물을 작성합니다.

## AI 직원

| 직원 | 직무 | 맡기면 좋은 일 |
|---|---|---|
| 🧭 하나 | 기획실장 | 견적서 초안, 일정표, 요구사항 정의서, 상담 질문지 |
| 🎨 디디 | 웹디자이너 | 디자인 컨셉, 컬러 팔레트·폰트, 레이아웃 |
| ✍️ 카피 | 카피라이터 | 헤드라인, 서비스 소개, 블로그, 인스타 캡션 |
| 📈 마키 | 마케터 | SEO 키워드·메타태그, 릴스 대본, 콘텐츠 캘린더 |
| 💻 코디 | 개발자 | HTML/CSS/JS 코드, 반응형, 폼·지도 연동 |
| 🗂️ 한별 | 경영지원 | 고객 메일, 계약 체크리스트, 세금계산서 안내 |

직원을 추가하거나 성격을 바꾸려면 `lib/agents.js`만 수정하면 됩니다.

## 기능

- **1:1 업무 지시**: 책상 클릭 → 업무 입력 → 답변이 실시간으로 작성됨 (대화 기록은 브라우저에 저장)
- **회의 소집**: 안건 하나를 여러 직원에게 던지면, 앞사람 의견을 참고해 순서대로 발언
- **업무 일지**: 오늘 맡긴 업무 목록
- 마크다운 표·코드 블록 렌더링, 답변 복사 버튼, 모바일 화면 지원

## 로컬에서 실행

Node.js 20.12 이상이 필요합니다.

```bash
cd ai-office
npm install
cp .env.example .env   # .env 파일에 ANTHROPIC_API_KEY 입력
npm start              # http://localhost:3000
```

API 키는 [Anthropic 콘솔](https://console.anthropic.com)에서 발급합니다. 키는 서버에서만 사용되고 브라우저로 전달되지 않습니다.

## Vercel로 배포

1. Vercel에서 이 저장소를 Import하고 **Root Directory**를 `ai-office`로 지정
2. Environment Variables에 `ANTHROPIC_API_KEY`와 `OFFICE_PASSWORD` 추가
3. Deploy

> ⚠️ 배포할 때는 꼭 `OFFICE_PASSWORD`를 설정하세요. 설정하지 않으면 주소를 아는 누구나 내 API 키로 요청을 보낼 수 있습니다.

## 설정 (환경변수)

| 이름 | 설명 |
|---|---|
| `ANTHROPIC_API_KEY` | 필수. Claude API 키 |
| `OFFICE_PASSWORD` | 선택. 설정하면 비밀번호를 입력해야 AI 직원을 쓸 수 있음 |
| `CLAUDE_MODEL` | 선택. 기본값 `claude-opus-5-5` |

## 구조

```
ai-office/
├── server.js        # 로컬 실행 서버 (정적 파일 + API)
├── api/             # Vercel 서버리스 함수
├── lib/agents.js    # AI 직원 명부와 역할(시스템 프롬프트)
├── lib/chat.js      # Claude API 스트리밍 호출
└── public/          # 사무실 화면 (HTML/CSS/JS)
```
