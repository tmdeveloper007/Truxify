"""
Unit tests for backend/ml/routes/anomaly_routes.py
Covers the fix: HTTPException re-raise in set_threshold and get_threshold.

These tests mock the FastAPI router and threshold_service so they can run
without redis or other ML dependencies.
"""
import pytest
import sys
import os

# Ensure the ml package is importable.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))


class TestHTTPExceptionReraise:
    """
    Regression tests for the bug: set_threshold and get_threshold had bare
    `except Exception` that swallowed HTTPException, returning 500 instead
    of the intended status code.

    Fix: added `except HTTPException: raise` BEFORE `except Exception`.
    """

    def test_set_threshold_reraises_http_exception(self):
        """
        When threshold_service.set_threshold raises HTTPException,
        set_threshold must re-raise it so FastAPI returns the correct
        HTTP status instead of a generic 500.
        """
        from fastapi import HTTPException
        from unittest.mock import MagicMock, patch

        # Deferred import so the module-level AnomalyDetector() init
        # doesn't fail if redis is missing.
        from backend.ml.routes.anomaly_routes import set_threshold, router

        mock_req = MagicMock()
        mock_req.json = MagicMock(return_value={'threshold': 0.8})

        http_exc = HTTPException(status_code=422, detail='threshold out of range')

        mock_service = MagicMock()
        mock_coro = MagicMock()
        mock_coro.side_effect = http_exc
        mock_service.set_threshold = mock_coro

        with patch('backend.ml.routes.anomaly_routes.threshold_service', mock_service):
            import asyncio
            with pytest.raises(HTTPException) as exc_info:
                asyncio.run(set_threshold(mock_req))

        assert exc_info.value.status_code == 422

    def test_get_threshold_reraises_http_exception(self):
        """
        When no threshold is configured (threshold_service raises HTTPException
        404), get_threshold must re-raise it instead of returning 500.
        """
        from fastapi import HTTPException
        from unittest.mock import MagicMock, patch

        from backend.ml.routes.anomaly_routes import get_threshold

        mock_req = MagicMock()

        http_exc = HTTPException(status_code=404, detail='No threshold set')

        mock_service = MagicMock()
        mock_coro = MagicMock()
        mock_coro.side_effect = http_exc
        mock_service.get_threshold = mock_coro

        with patch('backend.ml.routes.anomaly_routes.threshold_service', mock_service):
            import asyncio
            with pytest.raises(HTTPException) as exc_info:
                asyncio.run(get_threshold(mock_req))

        assert exc_info.value.status_code == 404

    def test_set_threshold_returns_200_on_success(self):
        """Happy path: successful threshold update returns 200 with JSON body."""
        from unittest.mock import MagicMock, patch

        from backend.ml.routes.anomaly_routes import set_threshold

        mock_req = MagicMock()
        mock_req.json = MagicMock(
            return_value={'threshold': 0.75}
        )

        mock_service = MagicMock()
        mock_coro = MagicMock(
            return_value={'threshold': 0.75, 'updated_at': '2024-01-01T00:00:00Z'}
        )
        mock_service.set_threshold = mock_coro

        with patch('backend.ml.routes.anomaly_routes.threshold_service', mock_service):
            import asyncio
            result = asyncio.run(set_threshold(mock_req))

        assert result == {'threshold': 0.75, 'updated_at': '2024-01-01T00:00:00Z'}
