# 🏢 홈페이션 AI 오피스

AI 직원들이 일하는 픽셀아트 가상 사무실입니다. 직원을 클릭해 업무를 맡기면 Claude API가 실시간으로 결과물을 작성합니다.

## 조직 (부서 16곳)

코토 체계의 부서 구성을 그대로 옮겼습니다: 비서실 + 본사 10개 부서(팔자서재 본부 포함) + 팔자서재 하위 5개 부서.
부서마다 직원 한 명이 있고, 직원은 자기 부서 지침 파일 하나만 읽고 일합니다.

| 층 | 부서 | 직원 | 지침 파일 |
|---|---|---|---|
| 본사 | ★ 비서실 | 🦉 코토 (비서실장) | `src/guidelines/coto.md` |
| 본사 | 전략기획실 | 🧭 하나 | `strategy.md` |
| 본사 | 유튜브편집국 | 🎬 로이 | `youtube.md` |
| 본사 | 디자인실 | 🎨 디디 | `design.md` |
| 본사 | 커뮤니케이션실 | 💌 소담 | `comms.md` |
| 본사 | 마케팅실 | 📣 마키 | `marketing.md` |
| 본사 | 인사이트 캡쳐 | 💡 모아 | `insight.md` |
| 본사 | 사전편찬실 | 📚 카피 | `dictionary.md` |
| 본사 | 재무관리부 | 🧾 한별 | `finance.md` |
| 본사 | 정보보안실 | 🔐 단단 | `security.md` |
| 팔자서재 별관 | ★ 팔자서재 본부 | 🌙 도담 | `palja.md` |
| 팔자서재 별관 | 개발실 | 💻 코디 | `palja-dev.md` |
| 팔자서재 별관 | 서가 편집실 | 📖 서윤 | `palja-shelf.md` |
| 팔자서재 별관 | 채널실 | 📱 채니 | `palja-channel.md` |
| 팔자서재 별관 | 상품기획실 | 🎁 모모 | `palja-product.md` |
| 팔자서재 별관 | 사전편찬실(팔자서재) | 🖋️ 글담 | `palja-dictionary.md` |

### 지침을 원본으로 바꾸기

`src/guidelines/`의 파일은 노션 기록을 바탕으로 만든 **초안**입니다. 맥의 원본 지침(`~/.claude/지침/`, `~/.claude/지침/팔자서재/`)
내용을 같은 이름의 파일에 붙여 넣고 `npm run deploy` 하면 직원들이 원본 지침대로 일합니다.
직원 이름·직함·업무 버튼은 `src/agents.js`에서 바꿀 수 있습니다.

## 픽셀아트 사무실

사무실과 직원은 외부 그림 파일 없이 `public/office.js` 코드로 한 픽셀씩 그립니다.

- 평소에는 자리에서 쉬다가 휴게실에 커피를 마시러 가거나 정수기·자판기에 들러요
- 업무를 받으면 자리로 돌아가 타이핑하고(모니터에 코드가 흘러가요), 끝나면 ✔ 말풍선이 떠요
- 코토에게 업무를 주면 코토가 담당 직원 자리까지 걸어가서 전달해요
- 회의를 소집하면 참석자가 회의실로 모이고, 말하는 사람 위에 말풍선이 떠요
- 직원이나 책상을 클릭하면 대화창, 회의실을 클릭하면 회의 패널이 열려요
- 휴대폰에서는 사무실을 옆으로 밀어서 볼 수 있어요

직원 생김새는 `office.js`의 `LOOKS`, 층·방 배치는 `FLOORS`에서 바꿀 수 있어요.
글꼴은 [갈무리](https://github.com/quiple/galmuri) 픽셀 폰트(SIL OFL 1.1)를 사용합니다.

## 사내 메신저

사무실 아래의 메신저에 회사에서 일어나는 일이 채널별로 쌓입니다.

| 채널 | 올라오는 것 |
|---|---|
| # 업무 | 코토의 업무 전달(📂) → 직원의 착수 인사 → ✅ 완료 보고 → ❓ 질문 → 코토의 최종 보고 |
| # 회의 | 회의 소집과 직원별 발언 |
| # 라운지 | 휴게실에서 마주친 직원들의 잡담 (미리 써 둔 대사라 API 비용 없음) |
| # 업무일지 | 「📒 오늘 업무일지 쓰기」를 누르면 코토가 오늘 기록을 정리한 일지 |

- **대표님이 말 걸기**: 받는 사람을 코토로 두면 업무 배분이 시작되고, 직원을 고르면 그 직원이 메신저로 답해요.
- **질문에 답하기**: 직원이 모르는 게 있으면 ❓ 질문을 올리고 코토가 대표님께 알려요. 질문 아래 「답장하기」로 답하면 그 직원이 답을 반영해 이어서 작업해요.
- **결과 보기**: 완료 보고의 「결과 보기」를 누르면 그 직원의 대화창에서 결과물 전체를 볼 수 있어요.
- 다른 곳을 보고 있을 때 새 메시지가 오면 오른쪽 아래에 알림이 떠요.
- 직원은 답변 끝에 `보고: …`, `질문: …` 줄을 붙이고, 화면은 이 줄을 메신저로 옮겨요. 추가 API 호출은 없어요.
- 메신저 기록과 대화 기록은 이 브라우저에만 저장돼요. 다른 기기와 공유되지 않아요.

## 기능

- **코토에게 맡기기**: 업무를 적으면 코토가 담당 직원(1~4명)을 정해 순서대로 일을 시키고, 결과를 모아 보고서로 정리. 직원 결과물은 각 직원의 대화방에도 남아서 이어서 수정 요청 가능
- **1:1 업무 지시**: 책상 클릭 → 업무 입력 → 답변이 실시간으로 작성됨 (대화 기록은 브라우저에 저장)
- **회의 소집**: 안건 하나를 여러 직원에게 던지면, 앞사람 의견을 참고해 순서대로 발언
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

## claude.ai 테스트 페이지

API 키나 배포 없이 화면과 직원들을 시험해 볼 수 있는 페이지입니다. 직원들은 페이지를 연 사람의 Claude 계정으로 답합니다(처음 한 번 허용 필요).

```bash
node scripts/build-demo.mjs   # dist-demo/ 생성
```

화면(`public/`)은 그대로 쓰고, Claude를 부르는 `api.js`만 `demo/api.js`로 바꿔 끼웁니다. 부서 지침을 고친 뒤 다시 실행하고 claude.ai에 다시 올리면 테스트 페이지에도 반영됩니다.

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
| `CHIEF_MODEL` | `wrangler.jsonc`의 `vars` | 코토(업무 배분·보고)의 모델. 기본값 `claude-opus-5-5` |
| `STAFF_MODEL` | `wrangler.jsonc`의 `vars` | 부서 직원의 모델. 기본값 `claude-sonnet-5-5` |

## 구조

```
ai-office/
├── wrangler.jsonc   # Cloudflare Workers 설정
├── src/worker.js    # Worker 진입점 (/api/* 라우팅)
├── src/api.js       # Claude API 호출 (스트리밍 답변, 코토 업무 배분)
├── src/agents.js    # AI 직원 명부, 코토의 업무 배분 형식
├── src/guidelines/  # 부서별 지침 (직원마다 하나씩 읽음)
└── public/          # 화면 - Workers Assets로 제공
    ├── office.js    # 픽셀아트 사무실 (그리기, 걷기·말풍선 애니메이션)
    ├── app.js       # 대화창, 코토 업무 배분, 회의, 업무일지
    ├── api.js       # 서버 연결 (테스트 페이지는 demo/api.js로 바꿔 끼움)
    ├── messenger.js # 사내 메신저 (채널, 질문 답장, 알림)
    └── fonts/       # 갈무리 픽셀 폰트
```
