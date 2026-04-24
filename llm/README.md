# 집중도 기반 학습 퀴즈봇 (LLM 파트)

온라인 강의 시청 후 AI에게 가르치기(Protégé Effect) 방식으로 복습하는 학습 에이전트입니다.
RAG 기반 이해도 채점 시스템이 포함되어 있습니다.

---

## 1. 필요 환경

- Python 3.9 이상
- OpenAI API 키 (본인 계정)

---

## 2. 설치 방법

### 2.1 필요한 패키지 설치
```bash
pip install openai fastapi uvicorn python-dotenv pydantic
```

### 2.2 `.env` 파일 생성
프로젝트 폴더에 `.env` 파일을 만들고 아래 내용을 넣으세요:
```
OPENAI_API_KEY=sk-여기에_본인_API_키_입력
```

OpenAI API 키는 https://platform.openai.com/api-keys 에서 발급받을 수 있습니다.

---

## 3. 실행 방법

### 3.1 백엔드 서버 실행
터미널에서 프로젝트 폴더로 이동한 뒤:
```bash
uvicorn test2_v2:app --reload --port 8000
```

성공하면 아래 메시지가 뜹니다:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
```

### 3.2 프론트엔드 실행
`chat_test.html` 파일을 **브라우저로 열면** 됩니다.
(파일 더블클릭 또는 VS Code의 Live Server 확장 사용)

---

## 4. 사용법

1. 강의 파일명 입력 (예: `bio_1.json`, `ear_1.json`, `peo_1.json`)
2. "강의 시작" 버튼 클릭
3. AI가 질문하면 답변 입력 → 오른쪽에 실시간 이해도 분석 표시
4. 모든 청크 + 재질문까지 끝나면 자동 종료, 최종 점수 표시

---

## 5. 파일 구조

| 파일 | 설명 |
|---|---|
| `test2_v2.py` | 백엔드 서버 (FastAPI + OpenAI) |
| `chat_test.html` | 프론트엔드 테스트 UI |
| `.env` | OpenAI API 키 (본인이 생성) |
| `*.json` | 강의 자막 데이터 |
| `LLM_보고서.pdf` | 기능 명세서 |

---

## 6. 주요 기능 요약

- **Protégé 효과 NPC**: AI가 일부러 틀린 질문을 던지고 사용자가 정정
- **집중도 기반 청크 선택**: 미집중 구간(CV 모듈에서 전달)을 70% 가중 선택
- **RAG 채점 시스템**:
  - 질문별 예상 정답을 추출
  - 임베딩 유사도로 keyword/accuracy 점수 산정
  - NPC 3단계 판정(일치/부분일치/불일치)으로 점수 구간 조정
- **재질문(Reask)**: 이해도 60점 미만 청크는 다른 각도로 재질문
- **실시간 분석 패널**: 키워드 매칭, 의미 유사도, 항목별 점수 시각화

상세한 기능 설명은 `LLM_보고서.pdf` 참고.

---

## 7. 문제 해결

**ModuleNotFoundError 발생 시**
→ `pip install` 명령어를 다시 실행하세요.

**포트 8000 이미 사용 중일 때**
```bash
# 사용 중인 프로세스 종료 (Linux/Mac)
kill $(lsof -t -i:8000)

# 다른 포트로 실행
uvicorn test2_v2:app --reload --port 8001
```
(포트 바꿨으면 `chat_test.html`의 `API = "http://127.0.0.1:8000"` 부분도 같이 수정)

**API 키 오류**
→ `.env` 파일의 키가 정확한지, 잔여 크레딧이 있는지 확인하세요.

**한글 깨짐**
→ `chat_test.html`을 UTF-8 지원하는 브라우저로 열면 됩니다 (Chrome, Firefox 등).
