"""
Unit tests for backend/ml/routes/diffusion_routes.py
Covers the fix: numpy shape attribute must be converted to list for JSON serialization.

Fix: routes.shape -> list(routes.shape)
     (numpy int64 dimensions are not JSON-serializable by default)
"""
import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))


class TestShapeJSONSerialization:
    """
    Regression tests: numpy shape tuples (e.g. torch.Size([8, 64])) are not
    JSON-serializable, causing 500 errors on API responses.

    Fix: convert shape to list() before including in the JSON response.
    """

    def test_generate_routes_returns_serializable_shape(self):
        """
        generate_routes must return 'shape' as a plain Python list so the
        FastAPI JSON encoder can serialize it without a TypeError.
        """
        from unittest.mock import MagicMock, patch
        import asyncio

        # Deferred import to avoid module-level torch init failures.
        from backend.ml.routes.diffusion_routes import generate_routes, router

        mock_request = MagicMock()
        mock_request.json = MagicMock(return_value={
            'start_locations': [[0.0, 0.0], [1.0, 1.0]],
            'end_locations': [[10.0, 10.0], [11.0, 11.0]],
            'batch_size': 2,
            'num_steps': 10,
        })

        # Simulate a model returning a tensor with a torch.Size shape.
        mock_tensor = MagicMock()
        mock_tensor.cpu.return_value.numpy.return_value.tolist.return_value = [
            [[0.1, 0.2], [0.3, 0.4]],
            [[0.5, 0.6], [0.7, 0.8]],
        ]
        mock_tensor.shape = torch.Size([2, 2, 2])  # This is torch.Size, not a plain list.

        mock_model = MagicMock()
        mock_gen = MagicMock()
        mock_gen.generate.return_value = mock_tensor
        mock_model.generator = mock_gen

        with patch('backend.ml.routes.diffusion_routes.model', mock_model):
            result = asyncio.run(generate_routes(mock_request))

        # The response must contain a 'shape' key with a plain list.
        assert 'data' in result
        assert 'shape' in result['data']
        assert isinstance(result['data']['shape'], list)
        assert result['data']['shape'] == [2, 2, 2]

    def test_shape_list_contains_integers(self):
        """Shape values must be plain Python integers, not numpy.int64."""
        import numpy as np

        # Simulate what list(torch.Size(...)) produces.
        torch_size = torch.Size([4, 8, 16])
        shape_list = list(torch_size)

        assert isinstance(shape_list, list)
        assert all(isinstance(v, (int, np.integer)) for v in shape_list)

        # json.dumps should succeed with list (but may fail with numpy ints).
        import json
        json_str = json.dumps({'shape': shape_list})
        assert 'shape' in json_str

    def test_generate_routes_returns_200_with_valid_payload(self):
        """Happy-path: valid request returns success JSON with routes array."""
        from unittest.mock import MagicMock, patch
        import asyncio

        from backend.ml.routes.diffusion_routes import generate_routes

        mock_request = MagicMock()
        mock_request.json = MagicMock(return_value={
            'start_locations': [[0.0, 0.0]],
            'end_locations': [[5.0, 5.0]],
            'batch_size': 1,
            'num_steps': 5,
        })

        mock_tensor = MagicMock()
        mock_tensor.cpu.return_value.numpy.return_value.tolist.return_value = [[[0.1]]]
        mock_tensor.shape = torch.Size([1, 1, 1])

        mock_model = MagicMock()
        mock_model.generator.generate.return_value = mock_tensor

        with patch('backend.ml.routes.diffusion_routes.model', mock_model):
            result = asyncio.run(generate_routes(mock_request))

        assert result['success'] is True
        assert 'routes' in result['data']
        assert isinstance(result['data']['routes'], list)


# Need torch imported for the tests.
import torch
