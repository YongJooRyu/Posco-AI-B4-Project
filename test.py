import os
from dotenv import load_dotenv
from fastapi import FastAPI
from pydantic import BaseModel
import google.generativeai as genai

class FocusQuestAgent:
    def __init__(self, api_key):
        genai.configure(api_key=api_key)
        # 모델 설정 (작성하신 system_instruction 그대로 유지)
        self.model = genai.GenerativeModel(
            model_name="gemini-2.5-flash", # 404 에러 방지를 위해 표준 이름 사용
            system_instruction="""
            # Role 너는 학습 의욕이 넘치지만, 동시에 [Context] 내용을 완벽히 숙지하고 있는 '똑똑한 학생 AI'야. 겉으로는 어리숙한 학생인 척 질문하지만, 사용자의 답변이 [Context]와 다를 경우 예의 바르게 이의를 제기해야 해. 
            # Task 1. [Context] 내에서 질문하되, 80% 확률로 교묘한 오답을 섞어 질문해. 2. **[검증 단계 - 중요]**: 사용자가 답변을 주면, 가장 먼저 [Context]와 대조해봐.    - **사용자가 정답을 말함**: 감동하며 "아하! 헷갈리는 내용이었는데 이제 알 것 같아요"라고 하고 배운 내용을 요약해.    - **사용자가 오답을 말함**: (중요) 그냥 믿지 마! "어라 스승님... 제가 아까 보기로는 [Context의 내용]이라고 했던 것 같은데, 다시 한번 알려주실 수 있나요?"라며 교정을 유도해. 
            # Constraints - 사용자가 틀린 지식을 가르치려 할 때는 절대 수긍하지 마.  - 너의 목적은 '정확한 지식'을 사용자의 입을 통해 확인받는 것이지, 아무 지식이나 받아들이는 게 아니야. - 말투는 여전히 픽셀 게임 NPC처럼 친근하게 - "사용자의 답변이 들어오면 다음 사고 과정을 거쳐라: 사용자의 설명이 [Context]의 팩트와 일치하는가? 일치한다면 칭찬하고 다음 질문으로 넘어간다. 일치하지 않는다면, 네가 알고 있는 사실을 기반으로 의구심을 표하며 재설명을 요구한다." 
            # Context []
            """
        )
        self.chat = self.model.start_chat(history=[])

    def initialize_learning(self, context):
        """강의 자막(Context)을 주입하고 첫 질문을 받아냄"""
        initial_prompt = f"자, 이 학습 내용을 바탕으로 나에게 질문을 던져봐:\n{context}"
        response = self.chat.send_message(initial_prompt)
        return response.text

    def get_response(self, user_input):
        """사용자의 답변에 반응함"""
        response = self.chat.send_message(user_input)
        return response.text
    
# 1. .env 파일 로드 (이 부분이 빠졌거나 순서가 틀렸을 거예요)
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY") # 여기서 api_key를 정의해줍니다!

# 3. 게이트웨이(FastAPI) 설정
app = FastAPI()
agent = FocusQuestAgent(api_key)

# 프론트엔드와 주고받을 데이터 형식
class ChatRequest(BaseModel):
    message: str = ""
    lecture_content: str = None  # 처음 시작할 때만 강의 내용을 보냄

@app.post("/api/chat")
async def chat_gateway(request: ChatRequest):
    # 강의 내용이 들어오면 에이전트 초기화 (첫 질문 생성)
    if request.lecture_content:
        reply = agent.initialize_learning(request.lecture_content)
        return {"reply": reply}
    
    # 일반 대화인 경우 답변 생성
    reply = agent.get_response(request.message)
    return {"reply": reply}