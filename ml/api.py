from pathlib import Path

import joblib
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

MODEL_DIR = Path(__file__).parent / "models"
UNIFIED_MODEL_PATH = MODEL_DIR / "unified_hand_model.joblib"
LEGACY_MODEL_PATH = MODEL_DIR / "one_hand_model.joblib"

# Keep the existing one-hand API working until a unified model has been trained.
if UNIFIED_MODEL_PATH.exists():
    MODEL_PATH = UNIFIED_MODEL_PATH
    model_format = "unified_two_hand"
else:
    MODEL_PATH = LEGACY_MODEL_PATH
    model_format = "legacy_one_hand"

if not MODEL_PATH.exists():
    raise FileNotFoundError(
        f"No model found. Expected {UNIFIED_MODEL_PATH} or {LEGACY_MODEL_PATH}. "
        "Train a model before starting the API."
    )

saved_data = joblib.load(MODEL_PATH)
model = saved_data["model"]
feature_columns = saved_data["feature_columns"]
feature_count = int(saved_data.get("feature_count", len(feature_columns)))

app = FastAPI(title="ISL Gesture Translator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PredictionRequest(BaseModel):
    features: list[float] = Field(..., min_length=1, max_length=134)


@app.get("/")
def home():
    return {
        "message": "ISL Gesture Translator API is running",
        "model_format": model_format,
        "feature_count": feature_count,
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "model_loaded": True,
        "model_format": model_format,
        "feature_count": feature_count,
        "gestures": list(model.classes_),
    }


@app.post("/predict")
def predict(request: PredictionRequest):
    try:
        if len(request.features) != feature_count:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"This model expects {feature_count} features, "
                    f"but received {len(request.features)}."
                ),
            )

        features = np.asarray(request.features, dtype=float).reshape(1, -1)
        if not np.isfinite(features).all():
            raise HTTPException(
                status_code=400,
                detail="Features must be finite numbers",
            )

        probabilities = model.predict_proba(features)[0]
        best_index = int(np.argmax(probabilities))
        confidence = float(probabilities[best_index])
        gesture = str(model.classes_[best_index])

        if confidence < 0.65:
            return {"gesture": "UNKNOWN", "confidence": round(confidence, 4)}

        return {"gesture": gesture, "confidence": round(confidence, 4)}

    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))
