"""
Pytest configuration and shared fixtures
"""
import pytest


def pytest_configure(config):
    """Configure pytest markers"""
    config.addinivalue_line(
        "markers", "integration: mark test as integration test (requires Redis)"
    )
