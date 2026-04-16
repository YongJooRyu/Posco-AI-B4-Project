"""
pen_detection.py
================
손가락 관절각만으로 필기 여부 판단 (펜 색상 감지 없음)
- 필기 자세 → WRITING
- 그 외     → NOT WRITING

[단축키]
  s : 관절각 콘솔 출력
  q : 종료
"""

import cv2
import numpy as np
import math
import os
import urllib.request

import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision


# ── 유틸 ──────────────────────────────────────────────────────────────────────

def landmarks_to_array(landmarks) -> np.ndarray:
    return np.array([[lm.x, lm.y, lm.z] for lm in landmarks])


def calc_angle(a, b, c) -> float:
    ba = a - b
    bc = c - b
    cos_val = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-6)
    return math.degrees(math.acos(np.clip(cos_val, -1.0, 1.0)))


def extract_joint_angles(pts: np.ndarray) -> np.ndarray:
    return np.array([
        calc_angle(pts[1],  pts[2],  pts[3]),    # [0] 엄지 굽힘
        calc_angle(pts[5],  pts[6],  pts[7]),    # [1] 검지 굽힘
        calc_angle(pts[9],  pts[10], pts[11]),   # [2] 중지 굽힘
        calc_angle(pts[13], pts[14], pts[15]),   # [3] 약지 굽힘
        calc_angle(pts[17], pts[18], pts[19]),   # [4] 새끼 굽힘
        calc_angle(pts[0],  pts[4],  pts[8]),    # [5] 엄지-검지 지간
        calc_angle(pts[4],  pts[8],  pts[12]),   # [6] 검지-중지 지간
        calc_angle(pts[8],  pts[12], pts[16]),   # [7] 중지-약지 지간
        calc_angle(pts[12], pts[16], pts[20]),   # [8] 약지-새끼 지간
        calc_angle(pts[0],  pts[9],  pts[12]),   # [9] 전체 굽힘
    ])


# ── 손 모양 판단 ──────────────────────────────────────────────────────────────

class HandShapeDetector:
    """
    관절각 임계값으로 필기 자세 판단.
    S키로 본인 각도 확인 후 아래 값 조정 가능.

      thumb_max   : 엄지 굽힘 최대 (클수록 더 펴져도 OK)
      index_min   : 검지 굽힘 최소 (작을수록 더 펴져도 OK)
      index_max   : 검지 굽힘 최대 (클수록 더 굽어도 OK)
      middle_max  : 중지 굽힘 최대
      pinch_max   : 엄지-검지 지간 최대 (클수록 더 벌어져도 OK)
    """
    def __init__(self,
                 thumb_max:  float = 165.0,
                 index_min:  float = 60.0,
                 index_max:  float = 155.0,
                 middle_max: float = 150.0,
                 pinch_max:  float = 90.0):
        self.thumb_max  = thumb_max
        self.index_min  = index_min
        self.index_max  = index_max
        self.middle_max = middle_max
        self.pinch_max  = pinch_max

    def predict(self, angles: np.ndarray):
        c = {
            "Thumb  bent" : (angles[0] < self.thumb_max,  f"{angles[0]:.1f}d"),
            "Index  bent" : (self.index_min < angles[1] < self.index_max,
                             f"{angles[1]:.1f}d"),
            "Middle bent" : (angles[2] < self.middle_max, f"{angles[2]:.1f}d"),
            "Pinch closed": (angles[5] < self.pinch_max,  f"{angles[5]:.1f}d"),
        }
        is_writing = all(ok for ok, _ in c.values())
        return is_writing, c


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

def draw_overlay(frame, is_writing, conditions, angles):
    h, w = frame.shape[:2]

    # 상단 배너
    col = (0, 160, 50) if is_writing else (30, 30, 200)
    cv2.rectangle(frame, (0, 0), (w, 62), col, -1)
    cv2.putText(frame,
                "WRITING" if is_writing else "NOT WRITING",
                (16, 42), cv2.FONT_HERSHEY_DUPLEX,
                1.2, (255, 255, 255), 2, cv2.LINE_AA)

    # 관절각 조건 패널 (우측 하단)
    px, py = w - 285, h - 155
    cv2.rectangle(frame, (px-6, py-20), (w-4, h-4), (30, 30, 30), -1)
    cv2.putText(frame, "Joint Conditions", (px, py),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1, cv2.LINE_AA)
    for i, (name, (ok, val)) in enumerate(conditions.items()):
        color = (0, 200, 60) if ok else (50, 50, 220)
        mark  = "[O]" if ok else "[X]"
        cv2.putText(frame, f"{mark} {name:13s} {val}",
                    (px, py + 24 + i * 26),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.46, color, 1, cv2.LINE_AA)

    # 관절각 수치 (좌측 하단)
    names = ["Thumb", "Index", "Mid", "Ring", "Pinky",
             "Th-Idx", "Idx-Mid", "Mid-Rng", "Rng-Pnk", "Overall"]
    ax, ay = 10, h - 10 - 20 * 9
    cv2.rectangle(frame, (ax-4, ay-16), (ax+215, h-28), (30, 30, 30), -1)
    cv2.putText(frame, "Angles (deg)", (ax, ay),
                cv2.FONT_HERSHEY_SIMPLEX, 0.45, (200, 200, 200), 1, cv2.LINE_AA)
    for i, (n, a) in enumerate(zip(names, angles)):
        cv2.putText(frame, f"{n:10s}: {a:6.1f}",
                    (ax, ay + 17 + i * 19),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.39, (160, 160, 160), 1, cv2.LINE_AA)

    # 하단 안내
    cv2.putText(frame, "[S] print angles    [Q] quit",
                (10, h - 6), cv2.FONT_HERSHEY_SIMPLEX,
                0.4, (120, 120, 80), 1, cv2.LINE_AA)


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
    shape_det  = HandShapeDetector()

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("[ERROR] 웹캠을 열 수 없습니다.")
        return

    print("=" * 50)
    print("  Writing Detection  |  Hand Shape Only")
    print("=" * 50)
    print("  [S] 관절각 콘솔 출력")
    print("  [Q] 종료")
    print("  TIP: 인식이 잘 안 되면 S키로 각도 확인 후")
    print("       HandShapeDetector 임계값을 조정하세요.")

    frame_idx = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame = cv2.flip(frame, 1)
        rgb   = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        mp_img  = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        results = landmarker.detect_for_video(mp_img, frame_idx * 33)

        is_writing = False
        angles     = np.zeros(10)
        conditions = {}

        if results.hand_landmarks:
            lm = results.hand_landmarks[0]
            draw_landmarks(frame, lm)

            pts        = landmarks_to_array(lm)
            angles     = extract_joint_angles(pts)
            is_writing, conditions = shape_det.predict(angles)

            draw_overlay(frame, is_writing, conditions, angles)
        else:
            cv2.putText(frame, "No hand detected",
                        (20, 50), cv2.FONT_HERSHEY_SIMPLEX,
                        1.0, (100, 100, 100), 2, cv2.LINE_AA)
            cv2.putText(frame, "[Q] quit",
                        (10, frame.shape[0] - 8),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.4, (100, 100, 100), 1, cv2.LINE_AA)

        cv2.imshow("Writing Detection", frame)

        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            break
        elif key == ord('s') and results.hand_landmarks:
            names = ["Thumb", "Index", "Mid", "Ring", "Pinky",
                     "Th-Idx", "Idx-Mid", "Mid-Rng", "Rng-Pnk", "Overall"]
            print("\n[관절각]")
            for n, a in zip(names, angles):
                print(f"  {n:10s}: {a:.2f}°")

        frame_idx += 1

    cap.release()
    cv2.destroyAllWindows()
    landmarker.close()
    print("종료")


if __name__ == "__main__":
    main()
