import numpy as np

class ContinuousTimeRnnImputer:
    """
    Continuous-Time Recurrent Neural Network (CT-RNN) backed by Neural ODE dynamics
    dh(t)/dt = -h(t) + tanh(W * h(t) + x(t)) for non-uniform telemetry imputation.
    """
    def __init__(self, hidden_dim: int = 4):
        self.hidden_dim = hidden_dim
        self.W = np.eye(hidden_dim) * 0.5
        self.bias = np.zeros(hidden_dim)
        # Scalers for GPS coordinates to prevent tanh saturation.
        # Raw GPS degrees (lat: -90 to 90, lng: -180 to 180) are scaled to [-1, 1].
        self._lat_min = -90.0
        self._lat_max = 90.0
        self._lng_min = -180.0
        self._lng_max = 180.0

    def _scale_coords(self, lat: float, lng: float) -> tuple:
        """Scale GPS coordinates to [-1, 1] range for ODE stability."""
        scaled_lat = 2.0 * (lat - self._lat_min) / (self._lat_max - self._lat_min) - 1.0
        scaled_lng = 2.0 * (lng - self._lng_min) / (self._lng_max - self._lng_min) - 1.0
        return scaled_lat, scaled_lng

    def _inverse_scale_coords(self, scaled_lat: float, scaled_lng: float) -> tuple:
        """Inverse transform scaled coordinates back to GPS degrees."""
        lat = (scaled_lat + 1.0) * (self._lat_max - self._lat_min) / 2.0 + self._lat_min
        lng = (scaled_lng + 1.0) * (self._lng_max - self._lng_min) / 2.0 + self._lng_min
        return lat, lng

    def ode_step(self, h: np.ndarray, dt: float) -> np.ndarray:
        """Euler numerical integration step for Neural ODE hidden state continuous evolution."""
        dh_dt = -h + np.tanh(np.dot(self.W, h) + self.bias)
        return h + (dh_dt * dt)

    def impute_missing_telemetry(self, last_known_coords: tuple, dt_seconds: float) -> tuple:
        """Interpolates smooth lat/lng continuous trajectory across irregular time gap dt_seconds."""
        lat, lng = last_known_coords

        # Scale coordinates to [-1, 1] before ODE to prevent tanh saturation.
        scaled_lat, scaled_lng = self._scale_coords(lat, lng)

        h = np.array([scaled_lat, scaled_lng, 0.0, 0.0])
        dt_normalized = dt_seconds / 60.0  # Convert to minutes

        # Integrate over continuous time delta.
        h_next = self.ode_step(h, dt_normalized)

        # Inverse-scale the integrated lat/lng back to GPS degrees.
        imputed_lat, imputed_lng = self._inverse_scale_coords(h_next[0], h_next[1])
        return (imputed_lat, imputed_lng)

ctrnn_imputer = ContinuousTimeRnnImputer()
