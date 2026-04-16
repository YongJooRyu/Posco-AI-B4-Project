"""
collect_data.py
===============
필기 / 비필기 관절각 데이터 수집 스크립트
초당 4프레임 수집

[실행 후]
  1 : 필기 모드   → 수집 후 Q → writing.csv 저장
  0 : 비필기 모드 → 수집 후 Q → not_writing.csv 저장
  Q : 저장 후 종료
"""

import cv2
import numpy as np
import math
import os
import csv
import time
import urllib.request

import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision


# ── 유틸 ──────────────────────────────────────────────────────────────────────

def landmarks_to_array(landmarks) -> np.ndarray:
    return np.array([[lm.x, lm.y, lm.z] for lm in landmarks])


def to_relative_coords(pts: np.ndarray) -> np.ndarray:
    return pts - pts[0]


def calc_angle(a, b, c) -> float:
    ba = a - b
    bc = c - b
    cos_val = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-6)
    return math.degrees(math.acos(np.clip(cos_val, -1.0, 1.0)))


def extract_joint_angles(pts: np.ndarray) -> np.ndarray:
    return np.array([
        calc_angle(pts[1],  pts[2],  pts[3]),
        calc_angle(pts[5],  pts[6],  pts[7]),
        calc_angle(pts[9],  pts[10], pts[11]),
        calc_angle(pts[13], pts[14], pts[15]),
        calc_angle(pts[17], pts[18], pts[19]),
        calc_angle(pts[0],  pts[4],  pts[8]),
        calc_angle(pts[4],  pts[8],  pts[12]),
        calc_angle(pts[8],  pts[12], pts[16]),
        calc_angle(pts[12], pts[16], pts[20]),
        calc_angle(pts[0],  pts[9],  pts[12]),
    ])


def build_feature_vector(landmarks) -> np.ndarray:
    """73차원: 상대좌표(63) + 관절각(10)"""
    pts     = landmarks_to_array(landmarks)
    rel_pts = to_relative_coords(pts)
    angles  = extract_joint_angles(pts)
    return np.concatenate([rel_pts.flatten(), angles])


# ── 랜드마크 그리기 ───────────────────────────────────────────────────────────

HAND_CONNECTIONS = [
    (0,1),(1,2),(2,3),(3,4),
    (0,5),(5,6),(6,7),(7,8),
    (0,9),(9,10),(10,11),(11,12),
    (0,13),(13,14),(14,15),(15,16),
    (0,17),(17,18),(18,19),(19,20),
    (5,9),(9,13),(13,17),
]

def draw_landmarks(frame, landmarks):
    h, w = frame.shape[:2]
    pts  = [(int(lm.x * w), int(lm.y * h)) for lm in landmarks]
    for a, b in HAND_CONNECTIONS:
        cv2.line(frame, pts[a], pts[b], (80, 200, 80), 2)
    for p in pts:
        cv2.circle(frame, p, 5, (255, 255, 255), -1)
        cv2.circle(frame, p, 5, (0, 150, 0), 1)


# ── 오버레이 ──────────────────────────────────────────────────────────────────

def draw_overlay(frame, mode, count, saved_this_frame):
    h, w = frame.shape[:2]

    # 모드 미선택
    if mode is None:
        cv2.rectangle(frame, (0, 0), (w, 62), (60, 60, 60), -1)
        cv2.putText(frame, "모드를 선택하세요",
                    (16, 42), cv2.FONT_HERSHEY_DUPLEX,
                    1.0, (255, 255, 255), 2, cv2.LINE_AA)
        cv2.putText(frame, "[1] 필기 모드    [0] 비필기 모드    [Q] 종료",
                    (10, h - 8), cv2.FONT_HERSHEY_SIMPLEX,
                    0.5, (180, 180, 80), 1, cv2.LINE_AA)
        return

    # 모드별 색상
    if mode == 1:
        col   = (0, 160, 50)
        label = "WRITING MODE  (필기 자세 수집 중)"
        fname = "writing.csv"
    else:
        col   = (30, 30, 200)
        label = "NOT WRITING MODE  (비필기 자세 수집 중)"
        fname = "not_writing.csv"

    # 상단 배너
    cv2.rectangle(frame, (0, 0), (w, 62), col, -1)
    cv2.putText(frame, label,
                (12, 42), cv2.FONT_HERSHEY_DUPLEX,
                0.85, (255, 255, 255), 2, cv2.LINE_AA)

    # 수집 현황
    cv2.rectangle(frame, (8, 70), (340, 130), (30, 30, 30), -1)
    cv2.putText(frame, f"수집된 프레임: {count}",
                (16, 98), cv2.FONT_HERSHEY_SIMPLEX,
                0.7, (255, 255, 255), 1, cv2.LINE_AA)
    cv2.putText(frame, f"저장 파일: {fname}",
                (16, 122), cv2.FONT_HERSHEY_SIMPLEX,
                0.5, (180, 180, 180), 1, cv2.LINE_AA)

    # REC 표시
    if saved_this_frame:
        cv2.circle(frame, (w - 30, 30), 10, (0, 0, 255), -1)
        cv2.putText(frame, "REC",
                    (w - 70, 38), cv2.FONT_HERSHEY_SIMPLEX,
                    0.55, (0, 0, 255), 2, cv2.LINE_AA)

    # 진행바 (목표 500)
    target  = 500
    bar_w   = w - 20
    filled  = int(bar_w * min(count, target) / target)
    cv2.rectangle(frame, (10, h - 28), (10 + bar_w, h - 14), (50, 50, 50), -1)
    cv2.rectangle(frame, (10, h - 28), (10 + filled, h - 14), col, -1)
    cv2.putText(frame, f"{count} / {target} 프레임  [Q] 저장 후 종료",
                (10, h - 32), cv2.FONT_HERSHEY_SIMPLEX,
                0.42, (180, 180, 180), 1, cv2.LINE_AA)


# ── CSV 저장 ──────────────────────────────────────────────────────────────────

def save_csv(data: list, label: int, path: str):
    n_feat = len(data[0])
    header = ["label"] + [f"f{i}" for i in range(n_feat)]
    with open(path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        for feat in data:
            writer.writerow([label] + feat.tolist())
    print(f"[저장완료] {path}  ({len(data)}행, label={label})")


# ── 모델 다운로드 ─────────────────────────────────────────────────────────────

def download_model(path="hand_landmarker.task"):
    if not os.path.exists(path):
        url = ("https://storage.googleapis.com/mediapipe-models/"
               "hand_landmarker/hand_landmarker/float16/latest/"
               "hand_landmarker.task")
        print("[INFO] 모델 다운로드 중...")
        urllib.request.urlretrieve(url, path)
        print("[INFO] 완료")
    return path


# ── 메인 ─────────────────────────────────────────────────────────────────────

def main():
    model_path = download_model()
    base_opts  = mp_python.BaseOptions(model_asset_path=model_path)
    options    = vision.HandLandmarkerOptions(
        base_options=base_opts,
        num_hands=1,
        min_hand_detection_confidence=0.6,
        min_hand_presence_confidence=0.5,
        min_tracking_confidence=0.5,
        running_mode=vision.RunningMode.VIDEO,
    )
    landmarker = vision.HandLandmarker.create_from_options(options)

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("[ERROR] 웹캠을 열 수 없습니다.")
        return

    print("=" * 55)
    print("  데이터 수집 스크립트")
    print("=" * 55)
    print("  [1] 필기 모드   → writing.csv")
    print("  [0] 비필기 모드 → not_writing.csv")
    print("  [Q] 저장 후 종료")
    print("-" * 55)
    print("  초당 4프레임 수집 / 목표: 각 500프레임")

    data       = []    # feature vector 목록
    mode       = None  # 1 or 0
    frame_idx  = 0

    # 초당 4프레임 → 250ms 간격
    INTERVAL   = 1.0 / 4.0
    last_saved = 0.0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame = cv2.flip(frame, 1)
        rgb   = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        mp_img  = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        results = landmarker.detect_for_video(mp_img, frame_idx * 33)

        now              = time.time()
        saved_this_frame = False

        if results.hand_landmarks:
            lm = results.hand_landmarks[0]
            draw_landmarks(frame, lm)

            # 모드 선택된 상태 + 인터벌 경과 시 저장
            if mode is not None and (now - last_saved) >= INTERVAL:
                feat = build_feature_vector(lm)
                data.append(feat)
                last_saved       = now
                saved_this_frame = True

        draw_overlay(frame, mode, len(data), saved_this_frame)

        cv2.imshow("Data Collection", frame)

        key = cv2.waitKey(1) & 0xFF

        if key == ord('1'):
            if mode != 1:
                mode = 1
                data = []
                print("[모드전환] 필기 모드 시작 - writing.csv에 저장됩니다.")

        elif key == ord('0'):
            if mode != 0:
                mode = 0
                data = []
                print("[모드전환] 비필기 모드 시작 - not_writing.csv에 저장됩니다.")

        elif key == ord('q'):
            break

        frame_idx += 1

    cap.release()
    cv2.destroyAllWindows()
    landmarker.close()

    # 저장
    if data and mode is not None:
        fname = "writing.csv" if mode == 1 else "not_writing.csv"
        save_csv(data, mode, fname)
        print(f"\n[완료] {len(data)}프레임 → {fname}")
    else:
        print("[경고] 수집된 데이터가 없거나 모드가 선택되지 않았습니다.")


if __name__ == "__main__":
    main()
