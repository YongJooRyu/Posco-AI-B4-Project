# scripts/extract_frames.py

import cv2
import os

def extract_frames(video_path, output_dir, fps=5):
    """
    영상 파일에서 프레임을 추출해서 이미지로 저장합니다.

    video_path : 영상 파일 경로   예) data/raw/user1/state_a/clip001.mp4
    output_dir : 프레임 저장 폴더 예) data/frames/user1/state_a/
    fps        : 초당 몇 장 추출할지 (기본값 5장)
    """
    os.makedirs(output_dir, exist_ok=True)

    cap = cv2.VideoCapture(video_path)

    if not cap.isOpened():
        print(f"❌ 영상을 열 수 없어요: {video_path}")
        return 0

    video_fps = cap.get(cv2.CAP_PROP_FPS)
    frame_interval = int(video_fps / fps)

    frame_count = 0
    saved_count = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        if frame_count % frame_interval == 0:
            filename = f"frame_{saved_count:05d}.jpg"
            cv2.imwrite(os.path.join(output_dir, filename), frame)
            saved_count += 1

        frame_count += 1

    cap.release()
    print(f"✅ 완료: {saved_count}장 저장 → {output_dir}")
    return saved_count


def extract_all(raw_dir="data/raw", output_dir="data/frames", fps=5):
    """
    data/raw/ 안에 있는 모든 영상을 자동으로 찾아서 프레임 추출합니다.
    내일 데이터 수집 후 이 함수 하나만 실행하면 전부 처리돼요.
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
                out_dir = os.path.join(output_dir, user, state)

                print(f"📹 처리 중: {video_path}")
                extract_frames(video_path, out_dir, fps)


if __name__ == "__main__":
    # 내일 데이터 수집 후 이 한 줄만 실행하면 전부 처리됨
    extract_all()