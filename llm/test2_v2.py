import os
import json
import random
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI

# 1. 환경 변수 로드
load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")

# 2. 에이전트 클래스
class FocusQuestAgent:
    def __init__(self, api_key):
        self.client = OpenAI(api_key=api_key)
        self.model_name = "gpt-4o"
        self.question_count = 0
        self.correct_count = 0
        self.finished = False
        self.MAX_QUESTIONS = 10   # 강의당 최대 질문 수
        self.understanding_scores = []
        self.current_chunk = ""
        self.current_question = ""

        # 청크 저장소
        self.chunks = {}
        self.chunks_meta = {}   # chunk_id -> {keywords, summary, summary_emb, keyword_embs}
        self.all_ids = []
        self.focus_ids = []
        self.used_ids = []
        self.current_chunk_id = None
        self.current_question_meta = None  # 현재 질문의 예상 정답 키워드/요약/임베딩

        # 재질문 관련 (chunk_id 기반)
        self.reask_queue = []
        self.reask_used = set()
        self.is_reask_next = False

        self.messages = [
            {
                "role": "system",
                "content": """
                # 지시 사항 최우선 순위
                사용자의 입력이 제공된 [Context] 내의 사실과 일치한다면, 너는 반드시 즉시 정답임을 인정하고 칭찬해야 한다. 캐릭터 연기보다 '사실 확인(Fact-check)'이 항상 우선한다.

                # Role
                너는 [Context] 내용을 완벽히 숙지하고 있는 '똑똑한 학생 AI'야.
                겉으로는 배우려는 학생인 척 행동하지만, 실제로는 [Context]의 내용을 정확히 알고 있어.
                사용자의 답변이 [Context]와 다를 경우 절대 수긍하지 않고 예의 바르게 이의를 제기해야 해.

                # 대화 시작 규칙
                - 사용자가 처음 말을 걸어오면, 반드시 "오늘의 학습을 마무리 하셨군요? 그럼 제가 배운 내용을 확인해볼게요! 😊" 라는 말로 시작해.
                - 그 이후부터 바로 질문 모드로 전환해.

                # Task
                1. [Context] 내용을 바탕으로 질문하되, 반드시 아래 형태로만 질문해:
                   - "제가 알기론 ~~인데 맞나요?" 처럼 네가 알고 있는 내용을 먼저 말하고 사용자에게 확인하는 형태로만 질문할 것.
                   - "설명해줘", "어떻게 생각해요?", "무엇인가요?" 같은 개방형 질문은 절대 금지.
                   - 반드시 질문 10개 중 8개는 오류를 포함해야 한다.
                2. 사용자가 답변하면 반드시 아래 형식으로 응답해:

                [사실 확인]
                - 사용자 주장: (사용자가 말한 핵심 내용 한 줄 요약)
                - Context 내용: (관련 Context 내용 한 줄 요약)
                - 일치 여부: 일치 / 부분일치 / 불일치
                  * 일치: 답변 전체가 Context와 정확히 맞음
                  * 부분일치: 답변의 일부만 맞고 일부는 누락·부정확함 (80%는 맞는데 디테일 틀렸을 때 등)
                  * 불일치: 답변이 Context와 어긋나거나 완전히 다름

                [응답]
                일치한 경우 → 상황 1 말투로 칭찬
                부분일치한 경우 → 상황 2 말투 변형으로 "맞는 부분 인정 + 부족한 부분 보완 요청"
                불일치한 경우 → 상황 2 말투로 이의 제기

                [다음 질문]
                상황 3 말투로 다음 질문 1개

                # Response Examples (말투와 구조만 따라라. 내용은 반드시 [Context]에서 가져와야 해):

                [상황 1: 사용자가 정답을 말했을 때]
                AI 학생: "와! 스승님 정말 대단해요! [Context에서 나온 개념]이 [올바른 설명]이라는 거군요? 이제 절대 안 잊어버릴 것 같아요!"

                [상황 2: 사용자가 오답을 말했을 때]
                AI 학생: "어라...? 스승님, 잠시만요! 제가 강의에서 본 내용이랑 좀 다른 것 같아요. [Context의 올바른 내용]이라고 봤던 것 같은데... 다시 한번 확인해 주실 수 있나요?"

                [상황 3: 다음 질문을 던질 때]
                AI 학생: "알려주셔서 감사해요! 그럼 다음 질문! [Context의 내용을 살짝 변형한 질문]이 맞나요?"

                # Constraints
                - "이 부분은 스승님 생각엔 어떤가요?" 같은 모호한 표현은 절대 쓰지 마. 항상 구체적인 내용을 담아 질문해.
                - 오류를 섞을 때는 얼핏 맞는 말처럼 들리지만 자세히 생각해야 틀렸다는 걸 알 수 있는 수준으로 낼 것. 누가 봐도 틀린 내용은 절대 넣지 마. 또한 너무 지엽적인 내용도 절대 불가해.
                - 반드시 제공된 [Context] 내용만을 근거로 질문할 것. [Context]에 없는 내용은 절대 사용하지 마. 네가 알고 있는 외부 지식을 절대 섞지 마.
                """
            }
        ]

    def _load_chunks(self, filename: str, focus_timestamps: list = None):
        """JSON 자막을 딕셔너리에 로드"""
        file_path = os.path.join(os.path.dirname(__file__), filename)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail=f"파일을 찾을 수 없습니다: {filename}")

        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        segments = data.get("data", [])

        prefix = filename.replace(".", "_").replace("-", "_")

        self.chunks = {}
        valid_segments = []
        for i, seg in enumerate(segments):
            if seg.get("content", "").strip():
                chunk_id = f"{prefix}_{i}"
                self.chunks[chunk_id] = seg["content"]
                valid_segments.append((i, seg))

        self.all_ids = list(self.chunks.keys())

        if focus_timestamps:
            focus_set = set(str(t) for t in focus_timestamps)
            self.focus_ids = [
                f"{prefix}_{i}" for i, seg in valid_segments
                if str(seg.get("timestamp", "")) in focus_set
            ]
        else:
            self.focus_ids = []

        self.used_ids = []
        self.chunks_meta = {}
        print(f"[LOG] 청크 로드 완료: {len(self.all_ids)}개 (미집중 구간: {len(self.focus_ids)}개)")

    def _get_embeddings_batch(self, texts: list) -> list:
        """OpenAI 임베딩 배치 처리"""
        if not texts:
            return []
        res = self.client.embeddings.create(
            model="text-embedding-3-small",
            input=texts
        )
        return [item.embedding for item in res.data]

    def _cosine(self, a: list, b: list) -> float:
        import math
        if not a or not b:
            return 0.0
        dot = sum(x*y for x,y in zip(a,b))
        na = math.sqrt(sum(x*x for x in a))
        nb = math.sqrt(sum(x*x for x in b))
        return dot / (na * nb) if na*nb > 0 else 0.0

    def _ensure_chunk_meta(self, chunk_id: str):
        """청크 키워드/요약/임베딩을 lazy 생성 (이미 있으면 skip)"""
        if chunk_id in self.chunks_meta:
            return self.chunks_meta[chunk_id]

        content = self.chunks.get(chunk_id, "")
        if not content:
            return None

        import re, json as _json
        extract_prompt = f"""아래 강의 청크에서 핵심 키워드와 1줄 요약을 뽑아라.
JSON 형식으로만 답해. 다른 말 금지.

{{
  "keywords": ["키워드1", ...],
  "summary": "한 줄 요약 (50자 이내)"
}}

키워드 규칙 (엄격히 지켜라):
- 정확히 3~4개만 뽑아라. 억지로 채우지 마라.
- 반드시 '명사 또는 전문 용어'여야 한다. 동사/부사/조사/일반 표현은 절대 금지.
- 강의의 교과 개념·원리·고유명사만 선택하라 (예: "광합성", "미토콘드리아", "DNA").
- "있다", "된다", "그리고", "때문" 같은 일반어는 절대 포함하지 마라.
- 관련성이 애매하면 개수를 줄여라. 3개가 안 되면 2개라도 괜찮다.

요약 규칙:
- 핵심 사실 한 문장 (50자 이내)

[강의 청크]
{content}"""

        try:
            res = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": extract_prompt}],
                max_tokens=200,
                temperature=0
            )
            text = res.choices[0].message.content.strip()
            m = re.search(r'\{.*\}', text, re.DOTALL)
            meta_raw = _json.loads(m.group()) if m else {"keywords": [], "summary": content[:50]}
        except:
            meta_raw = {"keywords": [], "summary": content[:50]}

        keywords = meta_raw.get("keywords", [])[:4]
        summary = meta_raw.get("summary", "")

        # 요약 + 키워드 임베딩 배치로 한 번에
        texts_to_embed = [summary] + keywords if summary else keywords
        try:
            embs = self._get_embeddings_batch(texts_to_embed)
        except:
            embs = []

        if embs and summary:
            summary_emb = embs[0]
            keyword_embs = dict(zip(keywords, embs[1:]))
        elif embs:
            summary_emb = []
            keyword_embs = dict(zip(keywords, embs))
        else:
            summary_emb = []
            keyword_embs = {}

        self.chunks_meta[chunk_id] = {
            "keywords": keywords,
            "summary": summary,
            "summary_emb": summary_emb,
            "keyword_embs": keyword_embs
        }
        return self.chunks_meta[chunk_id]

    def _extract_question_meta(self, chunk: str, question: str) -> dict:
        """질문에 대한 예상 정답의 키워드/요약/임베딩 추출"""
        import re, json as _json
        if not chunk or not question:
            return None

        prompt = f"""아래 [Context]를 근거로 [Question]의 올바른 정답이 반드시 포함해야 할 핵심 키워드와 1줄 요약을 뽑아라.
JSON 형식으로만 답해. 다른 말 금지.

{{
  "keywords": ["키워드1", ...],
  "summary": "정답의 핵심 내용 한 줄 (50자 이내)"
}}

키워드 규칙 (엄격히 지켜라):
- 정확히 3~4개만 뽑아라. 억지로 채우지 마라.
- 반드시 '명사 또는 전문 용어'여야 한다. 동사/부사/조사/일반 표현 금지.
- 오직 [Question]이 묻고 있는 핵심 개념만 포함하라. Context의 다른 부분은 무시.
- 질문이 오류를 포함한 확인형이면, 정답은 '오류 정정 + 올바른 사실'이다. 그 정정 내용의 키워드를 뽑아라.

[Context]
{chunk}

[Question]
{question}"""

        try:
            res = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=200,
                temperature=0
            )
            text = res.choices[0].message.content.strip()
            m = re.search(r'\{.*\}', text, re.DOTALL)
            raw = _json.loads(m.group()) if m else {"keywords": [], "summary": ""}
        except:
            raw = {"keywords": [], "summary": ""}

        keywords = raw.get("keywords", [])[:4]
        summary = raw.get("summary", "")

        texts = [summary] + keywords if summary else keywords
        try:
            embs = self._get_embeddings_batch(texts) if texts else []
        except:
            embs = []

        if embs and summary:
            summary_emb = embs[0]
            keyword_embs = dict(zip(keywords, embs[1:]))
        elif embs:
            summary_emb = []
            keyword_embs = dict(zip(keywords, embs))
        else:
            summary_emb = []
            keyword_embs = {}

        return {
            "keywords": keywords,
            "summary": summary,
            "summary_emb": summary_emb,
            "keyword_embs": keyword_embs
        }

    def _retrieve_next_chunk(self) -> tuple:
        """미집중 구간 70%, 전체 구간 30% 확률로 청크 선택. (chunk_id, content) 반환"""
        unused_focus = [id for id in self.focus_ids if id not in self.used_ids]
        unused_all = [id for id in self.all_ids if id not in self.used_ids]

        if unused_all:
            self.is_reask_next = False
            if unused_focus and random.random() < 0.7:
                chosen_id = random.choice(unused_focus)
            else:
                chosen_id = random.choice(unused_all)
            self.used_ids.append(chosen_id)
            return chosen_id, self.chunks.get(chosen_id, "")
        elif self.reask_queue:
            self.is_reask_next = True
            chosen_id = self.reask_queue.pop(0)
            return chosen_id, self.chunks.get(chosen_id, "")
        else:
            self.is_reask_next = False
            return None, ""

    def initialize_learning(self, filename: str, subject: str = "", focus_timestamps: list = None):
        """첫 질문 생성"""
        self.question_count = 0
        self.correct_count = 0
        self.finished = False
        self.MAX_QUESTIONS = 10   # 강의당 최대 질문 수
        self.messages = [self.messages[0]]
        self.reask_queue = []
        self.reask_used = set()
        self.is_reask_next = False

        self._load_chunks(filename, focus_timestamps)
        self.understanding_scores = []
        self.current_chunk = ""
        self.current_chunk_id = None
        self.current_question = ""

        chunk_id, chunk = self._retrieve_next_chunk()
        self.current_chunk = chunk
        self.current_chunk_id = chunk_id
        self._ensure_chunk_meta(chunk_id)
        subject_line = f"이 강의는 {subject} 수업입니다. 반드시 {subject} 교과 내용(개념, 원리, 사실)에서만 질문하세요.\n\n" if subject else ""
        self.messages.append({"role": "user", "content": f"{subject_line}아래 강의 내용을 바탕으로 나에게 질문을 던져봐:\n\n[Context]\n{chunk}"})

        response = self.client.chat.completions.create(
            model=self.model_name,
            messages=self.messages
        )
        ans = response.choices[0].message.content
        self.messages.append({"role": "assistant", "content": ans})
        self.current_question = ans
        # 첫 질문에 대한 예상 정답 메타 추출
        self.current_question_meta = self._extract_question_meta(chunk, ans)
        self.question_count = 1
        return ans

    def _parse_result(self, text: str):
        import re
        # [사실 확인] 블록의 "일치 여부: 일치/부분일치/불일치" 감지 (긴 것부터 매칭)
        m = re.search(r"일치 여부\s*:\s*(부분일치|일치|불일치)", text)
        match_flag = m.group(1) if m else None
        is_correct = match_flag == "일치"
        clean = re.sub(r"\[(정답|오답)\]|\[이해도:\d+\]", "", text).strip()
        return clean, is_correct, match_flag

    def _score_understanding(self, chunk_id: str, question: str, student_answer: str) -> dict:
        """RAG 기반 채점: 질문별 예상 정답의 키워드/요약과 비교"""
        import re

        # 특수 답변 선처리
        ans_stripped = student_answer.strip().rstrip('.').lower()
        if any(p in ans_stripped for p in ["모르", "몰라", "무응답", "모름"]):
            return {"total": 0, "concept": 0, "accuracy": 0, "detail": 0,
                    "matched_keywords": [], "missing_keywords": [], "similarity": 0.0,
                    "match": "불일치", "comment": "모른다고 답함"}
        simple_tokens = {"맞아", "아니", "네", "아니오", "응", "ㅇㅇ", "맞다", "아니다", "예", "no", "yes"}
        if ans_stripped in simple_tokens:
            return {"total": 20, "concept": 20, "accuracy": 0, "detail": 0,
                    "matched_keywords": [], "missing_keywords": [], "similarity": 0.0,
                    "match": "불일치", "comment": "단순 긍정/부정 답변"}

        # 질문별 예상 정답 meta 우선 사용, 없으면 청크 meta fallback
        meta = self.current_question_meta
        if not meta:
            meta = self._ensure_chunk_meta(chunk_id) if chunk_id else None
        if not meta:
            return {"total": 50, "concept": 20, "accuracy": 20, "detail": 10,
                    "matched_keywords": [], "missing_keywords": [], "similarity": 0.0,
                    "match": "일치", "comment": "메타 없음"}

        keywords = meta["keywords"]
        summary_emb = meta["summary_emb"]
        keyword_embs = meta["keyword_embs"]

        # 사용자 답변 임베딩
        try:
            answer_emb = self._get_embeddings_batch([student_answer])[0]
        except:
            answer_emb = []

        # 1. concept: 키워드 커버리지 (공백 정규화 포함 매칭 또는 임베딩 유사도 ≥ 0.45)
        def _normalize(s: str) -> str:
            return re.sub(r'\s+', '', s)
        ans_norm = _normalize(student_answer)

        matched, missing = [], []
        for kw in keywords:
            kw_emb = keyword_embs.get(kw, [])
            sim = self._cosine(answer_emb, kw_emb)
            kw_norm = _normalize(kw)
            if kw_norm and kw_norm in ans_norm:
                matched.append(kw)
            elif sim >= 0.45:
                matched.append(kw)
            else:
                missing.append(kw)
        coverage = len(matched) / max(len(keywords), 1)
        concept = int(round(coverage * 40))

        # 2. accuracy: 답변과 요약의 의미 유사도
        sim_summary = self._cosine(answer_emb, summary_emb)
        # 0.3~0.85 구간을 0~40점으로 선형 매핑
        accuracy = int(round(max(0.0, min(1.0, (sim_summary - 0.3) / 0.55)) * 40))

        # 3. detail: 길이 + 수치/고유명사 보너스
        length = len(student_answer.strip())
        if length < 8:      detail = 3
        elif length < 20:   detail = 8
        elif length < 40:   detail = 13
        elif length < 80:   detail = 17
        else:               detail = 20
        if re.search(r'\d', student_answer):
            detail = min(20, detail + 2)

        total = concept + accuracy + detail
        comment = f"키워드 {len(matched)}/{len(keywords)} | 유사도 {sim_summary:.2f}"

        return {
            "total": total,
            "concept": concept,
            "accuracy": accuracy,
            "detail": detail,
            "matched_keywords": matched,
            "missing_keywords": missing,
            "similarity": round(sim_summary, 3),
            "match": "일치" if total >= 55 else "불일치",
            "comment": comment
        }

    def get_response(self, user_input: str):
        """사용자 답변에 반응하고 다음 청크로 새 질문 생성"""
        if self.finished:
            return "이미 모든 질문이 끝났어요! 새 강의를 시작해주세요."

        if user_input and not user_input.endswith("."):
            user_input = user_input + "."

        # 1) RAG 기반 채점 (현재 청크 메타 이용)
        score_data = self._score_understanding(
            chunk_id=self.current_chunk_id,
            question=self.current_question,
            student_answer=user_input
        )

        next_chunk_id, next_chunk = self._retrieve_next_chunk()
        if next_chunk_id:
            self._ensure_chunk_meta(next_chunk_id)

        if next_chunk:
            reask_hint = "\n※ 이 내용은 이전에 이해도가 낮았던 부분입니다. 다른 각도에서 새 질문을 만들어주세요." if self.is_reask_next else ""
            combined_input = (
                f"[채점용 Context - 이 내용만 기준으로 사용자 답변을 평가할 것]\n{self.current_chunk}\n\n"
                f"[사용자 답변]\n{user_input}\n\n"
                f"※ 위 답변은 반드시 위 [채점용 Context]만을 기준으로 평가해. "
                f"아래 내용은 평가에 절대 사용하지 말고, 오직 다음 질문 생성에만 사용해.\n\n"
                f"[다음 질문을 위한 강의 내용]\n{next_chunk}{reask_hint}"
            )
        else:
            # 더 이상 질문할 내용 없음 → 마지막 답변 평가만
            combined_input = (
                f"[채점용 Context]\n{self.current_chunk}\n\n"
                f"[사용자 답변]\n{user_input}\n\n"
                f"※ 이제 모든 내용을 다 다뤘어. 마지막 답변을 평가하고 마무리 인사를 해줘. 다음 질문은 없어."
            )

        self.messages.append({"role": "user", "content": combined_input})

        # 2) gpt-4o로 NPC 응답 생성
        response = self.client.chat.completions.create(
            model=self.model_name,
            messages=self.messages
        )
        if not response.choices:
            raise ValueError("OpenAI API가 빈 응답을 반환했습니다.")
        ans = response.choices[0].message.content
        clean_ans, _, npc_match = self._parse_result(ans)

        # 2.5) NPC 판정 기준으로 총점 범위 조정 (항목별 비율은 보존)
        def _scale(score_data, target_total):
            raw_total = score_data["concept"] + score_data["accuracy"] + score_data["detail"]
            if raw_total == 0:
                # 완전 0점일 때는 균등 배분
                score_data["concept"] = int(target_total * 0.4)
                score_data["accuracy"] = int(target_total * 0.4)
                score_data["detail"] = target_total - score_data["concept"] - score_data["accuracy"]
            else:
                factor = target_total / raw_total
                score_data["concept"]  = min(40, int(score_data["concept"]  * factor))
                score_data["accuracy"] = min(40, int(score_data["accuracy"] * factor))
                score_data["detail"]   = min(20, int(score_data["detail"]  * factor))

        raw_total = score_data["concept"] + score_data["accuracy"] + score_data["detail"]
        if npc_match == "불일치":
            # 0~40 구간
            if raw_total > 40:
                _scale(score_data, 40)
            score_data["match"] = "불일치"
        elif npc_match == "부분일치":
            # 40~70 구간
            if raw_total < 40:
                _scale(score_data, 45)
            elif raw_total > 70:
                _scale(score_data, 65)
            score_data["match"] = "부분일치"
        elif npc_match == "일치":
            # 70~100 구간
            if raw_total < 70:
                _scale(score_data, 75)
            score_data["match"] = "일치"
        score_data["total"] = score_data["concept"] + score_data["accuracy"] + score_data["detail"]
        understanding = score_data["total"]
        is_correct = understanding >= 60

        # 이해도 낮으면 reask 큐에 추가 (청크당 1회만, chunk_id 기준)
        if understanding < 60 and self.current_chunk_id and self.current_chunk_id not in self.reask_used:
            if self.current_chunk_id not in self.reask_queue:
                self.reask_queue.append(self.current_chunk_id)
                self.reask_used.add(self.current_chunk_id)

        if is_correct:
            self.correct_count += 1
        self.understanding_scores.append(understanding)
        self.question_count += 1

        self.messages.append({"role": "assistant", "content": clean_ans})
        self.current_chunk = next_chunk
        self.current_chunk_id = next_chunk_id
        self.current_question = clean_ans
        # 다음 질문에 대한 예상 정답 메타 추출 (다음 라운드 채점에 사용)
        if next_chunk:
            self.current_question_meta = self._extract_question_meta(next_chunk, clean_ans)
        else:
            self.current_question_meta = None

        # 종료 조건: 다음 청크 없음 OR 최대 질문 수 도달
        if not next_chunk or self.question_count >= self.MAX_QUESTIONS:
            self.finished = True
            avg_understanding = int(sum(self.understanding_scores) / len(self.understanding_scores)) if self.understanding_scores else 0
            if self.question_count >= self.MAX_QUESTIONS:
                closing = f"\n\n오늘 {self.MAX_QUESTIONS}문제 모두 풀었어요! 🎉 성실한 답변 감사해요, 스승님! 다음에 또 가르쳐 주세요 😊"
            else:
                closing = "\n\n오늘 질문에 성실하게 답해주셔서 감사해요, 스승님! 덕분에 저도 정말 많이 배웠어요 😊 다음에 또 가르쳐 주세요!"
            return {
                "reply": f"{clean_ans}{closing}",
                "is_finished": True,
                "score": self.correct_count,
                "total": self.question_count,
                "understanding": avg_understanding,
                "score_data": score_data
            }

        return {
            "reply": clean_ans,
            "is_finished": False,
            "understanding": understanding,
            "score_data": score_data,
            "is_reask": self.is_reask_next
        }


# 3. FastAPI 설정
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
agent = FocusQuestAgent(api_key)

class ChatRequest(BaseModel):
    message: str = ""
    lecture_filename: str = None
    subject: str = ""
    focus_timestamps: list = None

@app.post("/api/chat")
async def chat_gateway(request: ChatRequest):
    try:
        if request.lecture_filename:
            reply = agent.initialize_learning(
                request.lecture_filename,
                request.subject,
                request.focus_timestamps
            )
            return {"reply": reply}

        result = agent.get_response(request.message)
        return result
    except HTTPException as e:
        return {"reply": f"파일 오류: {e.detail}"}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"reply": f"GPT API 오류 발생: {str(e)}"}