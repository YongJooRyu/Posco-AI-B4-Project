# scripts/data_loader.py

import os
import pandas as pd
from sklearn.model_selection import GroupKFold

def load_dataset(task='focus'):
    """
    CV-A, CV-B가 데이터를 불러올 때 사용하는 함수예요.
    
    task: 'focus' (집중도용) 또는 'hand' (필기 감지용)
    
    사용 예시:
        from scripts.data_loader import load_dataset
        X, y, groups = load_dataset(task='focus')
    """
    
    # task에 따라 라벨 파일 선택
    if task == 'focus':
        label_path = 'data/labels/focus_labels.csv'
        landmark_dir = 'data/landmarks/focus/'
    elif task == 'hand':
        label_path = 'data/labels/hand_labels.csv'
        landmark_dir = 'data/landmarks/hand/'
    else:
        raise ValueError("task는 'focus' 또는 'hand' 만 가능해요")
    
    # 라벨 파일 불러오기
    if not os.path.exists(label_path):
        raise FileNotFoundError(f"라벨 파일이 없어요: {label_path}")
    
    labels_df = pd.read_csv(label_path)
    
    X = []  # 피처 (랜드마크 데이터)
    y = []  # 라벨 (focused, drowsy 등)
    groups = []  # 사용자 ID (교차검증용)
    
    for _, row in labels_df.iterrows():
        # 랜드마크 CSV 파일 경로 만들기
        filename = os.path.basename(row['file_path']).replace('.mp4', '.csv')
        landmark_path = os.path.join(landmark_dir, filename)
        
        if not os.path.exists(landmark_path):
            print(f"⚠️ 랜드마크 파일 없음, 건너뜀: {landmark_path}")
            continue
        
        # 랜드마크 데이터 불러오기
        landmark_df = pd.read_csv(landmark_path)
        
        # 평균값을 피처로 사용 (나중에 CV-A, CV-B가 원하는 피처로 수정 가능)
        features = landmark_df.mean().values
        
        X.append(features)
        y.append(row['label'])
        groups.append(row['user_id'])
    
    return X, y, groups


def split_dataset(X, y, groups, n_splits=5):
    """
    사용자 단위로 교차검증 분할해요.
    한 사용자의 데이터가 train과 val에 동시에 들어가지 않게 해줘요.
    
    사용 예시:
        X, y, groups = load_dataset(task='focus')
        for train_idx, val_idx in split_dataset(X, y, groups):
            X_train = [X[i] for i in train_idx]
            ...
    """
    gkf = GroupKFold(n_splits=n_splits)
    return gkf.split(X, y, groups)


if __name__ == "__main__":
    # 테스트 실행
    print("focus 데이터 로딩 테스트...")
    try:
        X, y, groups = load_dataset(task='focus')
        print(f"✅ 성공: {len(X)}개 샘플 로드")
    except FileNotFoundError as e:
        print(f"⚠️ {e} (데이터 수집 후 다시 실행해줘요)")