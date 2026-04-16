"""
train_mlp.py
============
writing.csv + not_writing.csv 로 MLP 학습
규칙 기반 vs MLP 성능 비교까지 출력

[실행]
  python train_mlp.py
  → hand_mlp_model.pkl 저장됨
"""

import numpy as np
import pandas as pd
import pickle
import os

from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import (accuracy_score, classification_report,
                             confusion_matrix, ConfusionMatrixDisplay)
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')  # 화면 없이 저장


# ── 규칙 기반 판단 (비교용) ───────────────────────────────────────────────────

def rule_based_predict(X_raw: np.ndarray) -> np.ndarray:
    """
    관절각 인덱스 (feature vector 마지막 10개):
      63: thumb, 64: index, 65: mid, 66: ring, 67: pinky
      68: th_idx(pinch), 69: idx_mid, 70: mid_rng, 71: rng_pnk, 72: overall
    """
    thumb  = X_raw[:, 63]
    index  = X_raw[:, 64]
    mid    = X_raw[:, 65]
    pinch  = X_raw[:, 68]

    pred = (
        (thumb < 153.0) &
        (index > 60.0) & (index < 155.0) &
        (mid   < 150.0) &
        (pinch < 90.0)
    ).astype(int)
    return pred


# ── 데이터 로드 ───────────────────────────────────────────────────────────────

def load_data(writing_path="writing.csv", not_writing_path="not_writing.csv"):
    df_w  = pd.read_csv(writing_path)
    df_nw = pd.read_csv(not_writing_path)
    df    = pd.concat([df_w, df_nw], ignore_index=True).sample(frac=1, random_state=42)

    X = df.drop("label", axis=1).values.astype(np.float32)
    y = df["label"].values.astype(int)

    print(f"[데이터] Writing: {df_w.shape[0]}개  Not Writing: {df_nw.shape[0]}개  "
          f"총 {len(df)}개  특징차원: {X.shape[1]}")
    return X, y


# ── 메인 ─────────────────────────────────────────────────────────────────────

def main():
    print("=" * 55)
    print("  MLP 학습 & 규칙 기반 비교")
    print("=" * 55)

    # 1) 데이터 로드
    X, y = load_data()

    # 2) 학습/테스트 분리 (80/20)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y)
    print(f"[분리] Train: {len(X_train)}  Test: {len(X_test)}")

    # 3) 정규화
    scaler  = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s  = scaler.transform(X_test)

    # 4) MLP 학습
    print("\n[MLP 학습 중...]")
    mlp = MLPClassifier(
        hidden_layer_sizes=(256, 128, 64, 32),
        activation="relu",
        solver="adam",
        max_iter=300,
        random_state=42,
        early_stopping=True,
        validation_fraction=0.1,
        n_iter_no_change=20,
        verbose=False,
    )
    mlp.fit(X_train_s, y_train)
    print(f"  학습 완료 (에포크: {mlp.n_iter_})")

    # 5) MLP 평가
    y_pred_mlp  = mlp.predict(X_test_s)
    acc_mlp     = accuracy_score(y_test, y_pred_mlp)

    # 6) 규칙 기반 평가 (동일 테스트셋)
    y_pred_rule = rule_based_predict(X_test)
    acc_rule    = accuracy_score(y_test, y_pred_rule)

    # 7) 결과 출력
    print("\n" + "=" * 55)
    print("  📊 성능 비교 결과")
    print("=" * 55)
    print(f"  규칙 기반 정확도 : {acc_rule*100:.1f}%")
    print(f"  MLP    정확도   : {acc_mlp*100:.1f}%")
    diff = (acc_mlp - acc_rule) * 100
    print(f"  차이             : {'▲' if diff > 0 else '▼'} {abs(diff):.1f}%p  "
          f"({'MLP 우세' if diff > 0 else '규칙 기반 우세'})")
    print("=" * 55)

    print("\n[MLP 상세 리포트]")
    print(classification_report(y_test, y_pred_mlp,
                                 target_names=["Not Writing", "Writing"]))

    print("[규칙 기반 상세 리포트]")
    print(classification_report(y_test, y_pred_rule,
                                 target_names=["Not Writing", "Writing"]))

    # 8) 혼동행렬 저장
    fig, axes = plt.subplots(1, 2, figsize=(10, 4))
    for ax, y_pred, title in zip(
        axes,
        [y_pred_rule, y_pred_mlp],
        [f"Rule-Based  ({acc_rule*100:.1f}%)",
         f"MLP  ({acc_mlp*100:.1f}%)"]
    ):
        cm = confusion_matrix(y_test, y_pred)
        ConfusionMatrixDisplay(cm, display_labels=["Not Writing","Writing"]).plot(
            ax=ax, colorbar=False)
        ax.set_title(title, fontsize=13, fontweight="bold")

    plt.suptitle("Rule-Based vs MLP  |  Confusion Matrix", fontsize=14)
    plt.tight_layout()
    plt.savefig("comparison_result.png", dpi=150)
    print("\n[저장] comparison_result.png")

    # 9) 학습 곡선 저장
    if hasattr(mlp, "loss_curve_"):
        fig2, ax2 = plt.subplots(figsize=(7, 4))
        ax2.plot(mlp.loss_curve_, label="Train Loss")
        if hasattr(mlp, "validation_scores_"):
            ax2.plot(mlp.validation_scores_, label="Val Score", linestyle="--")
        ax2.set_xlabel("Epoch")
        ax2.set_ylabel("Loss / Score")
        ax2.set_title("MLP Learning Curve")
        ax2.legend()
        plt.tight_layout()
        plt.savefig("learning_curve.png", dpi=150)
        print("[저장] learning_curve.png")

    # 10) 모델 저장
    with open("hand_mlp_model.pkl", "wb") as f:
        pickle.dump({"model": mlp, "scaler": scaler}, f)
    print("[저장] hand_mlp_model.pkl")

    # 11) 5-fold CV 추가 ← 여기 main() 안에 추가
    from sklearn.model_selection import cross_val_score
    print("\n[5-fold CV 검증 중...]")
    cv_scores = cross_val_score(mlp, scaler.transform(X), y, cv=5)
    print(f"5-fold CV: {cv_scores}")
    print(f"평균: {cv_scores.mean():.3f}  표준편차: {cv_scores.std():.3f}")

    print("\n✅ 완료! 다음 단계: pen_detection.py에 MLP 적용")

if __name__ == "__main__":
    main()
