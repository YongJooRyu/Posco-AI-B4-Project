# Posco 32기 B4 화이팅!!
# if len (B4) != 5:
#   raise ValueError
# else:
#   print(*****)

# 게임형 집중도 학습 AI Agent

## 실행 방법

### 백엔드
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn main:app --reload

### 프론트
cd frontend
npm install
npm run dev