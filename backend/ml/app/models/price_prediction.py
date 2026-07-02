import logging
import numpy as np
from typing import Dict
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from .base import save_model, load_model, model_exists

logger = logging.getLogger(__name__)

MODEL_NAME = "price_forecast"

# NOTE: This module currently trains on synthetic (randomly generated) data
# as a placeholder. Replace generate_synthetic_price_data() with a real
# data pipeline that loads historical completed trip pricing data from
# PostgreSQL or MongoDB to make predictions meaningful.

TRUCK_TYPE_ENCODING: Dict[str, int] = {
    "light_truck": 0,
    "medium_truck": 1,
    "heavy_truck": 2,
    "trailer": 3,
}

CARGO_TYPE_ENCODING: Dict[str, int] = {
    "general": 0,
    "perishable": 1,
    "fragile": 2,
    "hazardous": 3,
    "bulk": 4,
}

TRUCK_RATE_MULTIPLIER = {0: 1.0, 1: 1.2, 2: 1.5, 3: 1.8}
CARGO_PREMIUM = {0: 0.0, 1: 1500.0, 2: 2000.0, 3: 3500.0, 4: -500.0}

FEATURE_NAMES = [
    "distance_km",
    "cargo_weight_kg",
    "truck_type",
    "hour_of_day",
    "day_of_week",
    "month",
    "fuel_price",
    "cargo_type",
]


def generate_synthetic_price_data(n_samples: int = 2000) -> tuple:
    """Generate synthetic Indian freight pricing data.

    Creates realistic training data incorporating distance, weight, truck type,
    temporal factors (hour, day, month), fuel price, and cargo type.  Seasonal
    effects model Indian festival/harvest (Oct-Jan) and monsoon (Jul-Sep)
    periods.

    Args:
        n_samples: Number of data points to generate.

    Returns:
        Tuple of (X feature array, y price array).
    """
    np.random.seed(42)

    distance_km = np.random.uniform(50, 2500, n_samples)
    cargo_weight_kg = np.random.uniform(100, 30000, n_samples)
    truck_type = np.random.randint(0, 4, n_samples)
    hour_of_day = np.random.randint(0, 24, n_samples)
    day_of_week = np.random.randint(0, 7, n_samples)
    month = np.random.randint(1, 13, n_samples)
    fuel_price = np.random.uniform(90, 120, n_samples)
    cargo_type = np.random.randint(0, 5, n_samples)

    # Base rate per km varies by distance band
    rate_per_km = np.where(distance_km < 300, 8.0, np.where(distance_km < 1000, 6.5, 5.5))

    # Truck type multiplier
    truck_mult = np.vectorize(TRUCK_RATE_MULTIPLIER.get)(truck_type)

    # Weight-based cost
    rate_per_kg = 0.005

    # Fuel surcharge proportional to distance and fuel price deviation
    fuel_baseline = 100.0
    fuel_surcharge = distance_km * (fuel_price - fuel_baseline) * 0.02

    # Seasonal factor (Indian context)
    seasonal_factor = np.zeros(n_samples)
    # Festival/harvest season (Oct-Jan): higher prices
    seasonal_factor = np.where((month >= 10) | (month <= 1), distance_km * 0.08, seasonal_factor)
    # Monsoon (Jul-Sep): lower demand, slightly lower prices
    seasonal_factor = np.where((month >= 7) & (month <= 9), -distance_km * 0.04, seasonal_factor)

    # Time-of-day factor: slightly higher during business hours (8-18)
    time_factor = np.where((hour_of_day >= 8) & (hour_of_day <= 18), distance_km * 0.03, 0.0)

    # Cargo type premium
    cargo_premium = np.vectorize(CARGO_PREMIUM.get)(cargo_type)

    # Compute price
    price = (
        distance_km * rate_per_km * truck_mult
        + cargo_weight_kg * rate_per_kg
        + fuel_surcharge
        + seasonal_factor
        + time_factor
        + cargo_premium
        + np.random.normal(0, 200, n_samples)  # noise
    )
    price = np.maximum(price, 500.0)

    X = np.column_stack([
        distance_km,
        cargo_weight_kg,
        truck_type,
        hour_of_day,
        day_of_week,
        month,
        fuel_price,
        cargo_type,
    ])

    return X, price


def train_price_model() -> dict:
    """Train a GradientBoostingRegressor for freight price prediction.

    Uses synthetic data modelling Indian freight pricing patterns.
    Persists the trained model and scaler via the base persistence layer.

    Returns:
        Dictionary of training metrics (MAE, RMSE, R2, sample count).
    """
    logger.info("Training price forecast model...")
    X, y = generate_synthetic_price_data()
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    model = GradientBoostingRegressor(
        n_estimators=200,
        max_depth=5,
        learning_rate=0.1,
        random_state=42,
    )
    model.fit(X_train_scaled, y_train)

    y_pred = model.predict(X_test_scaled)
    mae = mean_absolute_error(y_test, y_pred)
    rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
    r2 = r2_score(y_test, y_pred)

    metrics = {
        "mae": float(mae),
        "rmse": rmse,
        "r2": float(r2),
        "n_samples": len(X),
        "feature_names": FEATURE_NAMES,
    }

    save_model((model, scaler), MODEL_NAME, metrics)
    logger.info("Price forecast model trained. R2: %.3f, MAE: %.3f", r2, mae)
    return metrics


def predict_price(
    distance_km: float,
    cargo_weight_kg: float,
    truck_type: str = "medium_truck",
    route_origin: str = "",
    route_destination: str = "",
    hour_of_day: int = 12,
    day_of_week: int = 3,
    month: int = 6,
    fuel_price: float = 105.0,
    cargo_type: str = "general",
) -> dict:
    """Predict freight price using the trained ML model.

    Auto-trains the model on first invocation if no persisted model exists.

    Args:
        distance_km: Shipping distance in kilometres.
        cargo_weight_kg: Total cargo weight in kilograms.
        truck_type: One of 'light_truck', 'medium_truck', 'heavy_truck', 'trailer'.
        route_origin: Origin location name (reserved for future geocoding).
        route_destination: Destination location name (reserved for future geocoding).
        hour_of_day: Hour of departure (0-23).
        day_of_week: Day of week (0=Mon, 6=Sun).
        month: Month of year (1-12).
        fuel_price: Current diesel price in INR per litre.
        cargo_type: One of 'general', 'perishable', 'fragile', 'hazardous', 'bulk'.

    Returns:
        Dict with estimated_price, min_price, max_price, and currency.

    Raises:
        ValueError: If distance_km or cargo_weight_kg is non-positive.
    """
    if distance_km <= 0:
        raise ValueError("distance_km must be positive")
    if cargo_weight_kg <= 0:
        raise ValueError("cargo_weight_kg must be positive")

    # Auto-train if model does not exist
    if not model_exists(MODEL_NAME):
        train_price_model()

    loaded = load_model(MODEL_NAME)
    if loaded is None:
        # Fallback: train again if loading failed
        train_price_model()
        loaded = load_model(MODEL_NAME)
        if loaded is None:
            logger.error("Failed to load price forecast model after retraining")
            raise RuntimeError("Price forecast model unavailable")

    model, scaler = loaded

    truck_encoded = TRUCK_TYPE_ENCODING.get(
        truck_type.lower().replace(" ", "_"), 1
    )
    cargo_encoded = CARGO_TYPE_ENCODING.get(
        cargo_type.lower().replace(" ", "_"), 0
    )

    features = np.array([[
        distance_km,
        cargo_weight_kg,
        truck_encoded,
        hour_of_day,
        day_of_week,
        month,
        fuel_price,
        cargo_encoded,
    ]])
    features_scaled = scaler.transform(features)
    predicted = float(model.predict(features_scaled)[0])
    predicted = max(predicted, 500.0)

    return {
        "estimated_price": round(predicted, 2),
        "min_price": round(predicted * 0.85, 2),
        "max_price": round(predicted * 1.15, 2),
        "currency": "INR",
    }
