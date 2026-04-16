# scripts/extract_landmarks.py

import cv2
import mediapipe as mp
import pandas as pd
import os

mp_face_mesh = mp.solutions.face_mesh
mp_hands = mp.solutions.hands
mp_pose = mp.solutions.pose

# MediaPipe 초기화
mp_face_mesh = mp.solutions.face_mesh
mp_hands = mp.solutions.hands
mp_pose = mp.solutions.pose

def extract_focus_landmarks(video_path, output_path):
    """
    집중도용 랜드마크 추출 (얼굴 + 자세)
    
    video_path  : 영상 파일 경로  예) data/raw/user1/focused/clip001.mp4
    output_path : 저장할 CSV 경로 예) data/landmarks/focus/user1_focused_001.csv
    """
    face_mesh = mp_face_mesh.FaceMesh(static_image_mode=False)
    pose = mp_pose.Pose(static_image_mode=False)

    cap = cv2.VideoCapture(video_path)

    if not cap.isOpened():
        print(f"❌ 영상을 열 수 없어요: {video_path}")
        return

    rows = []
    frame_idx = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        face_result = face_mesh.process(rgb)
        pose_result = pose.process(rgb)

        row = {'frame': frame_idx}

        # 얼굴 랜드마크 추출
        if face_result.multi_face_landmarks:
            for i, lm in enumerate(face_result.multi_face_landmarks[0].landmark):
                row[f'face_{i}_x'] = lm.x
                row[f'face_{i}_y'] = lm.y
                row[f'face_{i}_z'] = lm.z
        
        # 자세 랜드마크 추출
        if pose_result.pose_landmarks:
            for i, lm in enumerate(pose_result.pose_landmarks.landmark):
                row[f'pose_{i}_x'] = lm.x
                row[f'pose_{i}_y'] = lm.y
                row[f'pose_{i}_z'] = lm.z

        rows.append(row)
        frame_idx += 1

    cap.release()
    face_mesh.close()
    pose.close()

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    df = pd.DataFrame(rows)
    df.to_csv(output_path, index=False)
    print(f"✅ 완료: {output_path}")


def extract_hand_landmarks(video_path, output_path):
    """
    필기 감지용 랜드마크 추출 (손)
    
    video_path  : 영상 파일 경로  예) data/raw/user1/writing/clip001.mp4
    output_path : 저장할 CSV 경로 예) data/landmarks/hand/user1_writing_001.csv
    """
    hands = mp_hands.Hands(static_image_mode=False)

    cap = cv2.VideoCapture(video_path)

    if not cap.isOpened():
        print(f"❌ 영상을 열 수 없어요: {video_path}")
        return

    rows = []
    frame_idx = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        hand_result = hands.process(rgb)

        row = {'frame': frame_idx}

        # 손 랜드마크 추출
        if hand_result.multi_hand_landmarks:
            for i, lm in enumerate(hand_result.multi_hand_landmarks[0].landmark):
                row[f'hand_{i}_x'] = lm.x
                row[f'hand_{i}_y'] = lm.y
                row[f'hand_{i}_z'] = lm.z

        rows.append(row)
        frame_idx += 1

    cap.release()
    hands.close()

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    df = pd.DataFrame(rows)
    df.to_csv(output_path, index=False)
    print(f"✅ 완료: {output_path}")


def extract_all_landmarks(raw_dir="data/raw", landmark_dir="data/landmarks"):
    """
    data/raw/ 안의 모든 영상에서 랜드마크를 자동으로 추출해요.
    내일 데이터 수집 후 이 함수 하나만 실행하면 돼요.
    """
    for user in os.listdir(raw_dir):
        user_path = os.path.join(raw_dir, user)
        if not os.path.isdir(user_path):
            continue

        for state in os.listdir(user_path):
            state_path = os.path.join(user_path, state)
            if not os.path.isdir(state_path):
                continue

            for filename in os.listdir(state_path):
                if not filename.endswith(".mp4"):
                    continue

                video_path = os.path.join(state_path, filename)
                base_name = f"{user}_{state}_{filename.replace('.mp4', '')}"

                # 집중도 상태면 focus 랜드마크 추출
                if state in ['focused', 'drowsy', 'distracted']:
                    output_path = os.path.join(landmark_dir, 'focus', base_name + '.csv')
                    print(f"📹 집중도 랜드마크 추출 중: {video_path}")
                    extract_focus_landmarks(video_path, output_path)

                # 필기 상태면