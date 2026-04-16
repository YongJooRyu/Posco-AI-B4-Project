# scripts/run_experiment.py

import os
import csv
import time
import datetime
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score

# 나중에 CV-A가 만든 데이터 로더 연결
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from scripts.data_loader import load_dataset, split_dataset


def run_experiment(model, model_name, feature_names, task='focus', note=''):
    """
    모델 하나를 받아서 5-fold 교차검증 후 결과를 CSV에 자동 기록해요.

    model        : sklearn 모델 객체  예) RandomForestClassifier()
    model_name   : 모델 이름 문자열   예) "RandomForest(n=100)"
    feature_names: 사용한 피처 이름   예) "EAR, head_pitch, yaw"
    task         : 'focus' 또는 'hand'
    note         : 특이사항 메모      예) "안경 착용자 제외"
    """

    print(f"\n🔬 실험 시작: {model_name}")

    # 데이터 불러오기
    X, y, groups = load_dataset(task=task)

    if len(X) == 0:
        print("❌ 데이터가 없어요. 데이터 수집 후 다시 실행해줘요.")
        return

    # 5-fold 교차검증
    accuracies, f1s, precisions, recalls = [], [], [], []

    for train_idx, val_idx in split_dataset(X, y, groups):
        X_train = [X[i] for i in train_idx]
        X_val   = [X[i] for i in val_idx]
        y_train = [y[i] for i in train_idx]
        y_val   = [y[i] for i in val_idx]

        # 학습
        model.fit(X_train, y_train)

        # 예측
        y_pred = model.predict(X_val)

        # 평가
        accuracies.append(accuracy_score(y_val, y_pred))
        f1s.append(f1_score(y_val, y_pred, average='weighted'))
        precisions.append(precision_score(y_val, y_pred, average='weighted'))
        recalls.append(recall_score(y_val, y_pred, average='weighted'))

    # 평균 계산
    avg_accuracy  = round(sum(accuracies)  / len(accuracies),  4)
    avg_f1        = round(sum(f1s)         / len(f1s),         4)
    avg_precision = round(sum(precisions)  / len(precisions),  4)
    avg_recall    = round(sum(recalls)     / len(recalls),      4)

    # 추론 시간 측정
    start = time.time()
    model.predict([X[0]])
    inf_ms = round((time.time() - start) * 1000, 2)

    # CSV에 기록
    run_id = f"cv_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}"
    csv_path = 'data/labels/cv_experiments.csv'

    row = {
        'run_id': run_id,
        'model': model_name,
        'features': feature_names,
        'train_size': len([i for i in split_dataset(X, y, groups)]),
        'val_size': '',
        'accuracy': avg_accuracy,
        'f1': avg_f1,
        'precision': avg_precision,
        'recall': avg_recall,
        'inference_time_ms': inf_ms,
        'note': note
    }

    with open(csv_path, 'a', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=row.keys())
        writer.writerow(row)

    print(f"✅ 실험 완료!")
    print(f"   정확도: {avg_accuracy}")
    print(f"   F1    : {avg_f1}")
    print(f"   추론  : {inf_ms}ms")
    print(f"   기록  : {csv_path}")


if __name__ == "__main__":
    # CV-A가 실험할 때 이 부분만 바꿔서 실행하면 돼요
    run_experiment(
        model=RandomForestClassifier(n_estimators=100),
        model_name="RandomForest(n=100)",
        feature_names="EAR, head_pitch, yaw",
        task='focus',
        note="기본 실험"
    )