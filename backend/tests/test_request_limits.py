"""Quota behavior across clients, periods and concurrent requests."""
from concurrent.futures import ThreadPoolExecutor

import pytest

from services import request_limits


@pytest.fixture
def clock(monkeypatch):
    state = {"now": 120.25}
    monkeypatch.setattr(request_limits.time, "time", lambda: state["now"])
    return state


def test_client_denials_do_not_charge_other_clients(clock):
    limits = request_limits.RequestLimits()
    assert limits.check("a", per_minute=1, total_per_minute=2) == 0
    assert limits.check("a", per_minute=1, total_per_minute=2) == 60
    assert limits.check("a", per_minute=1, total_per_minute=2) == 60
    assert limits.check("b", per_minute=1, total_per_minute=2) == 0
    assert limits.check("c", per_minute=1, total_per_minute=2) == 60


def test_global_limit_cannot_be_bypassed_with_distinct_clients(clock):
    limits = request_limits.RequestLimits()
    assert limits.check("a", total_per_minute=2) == 0
    assert limits.check("b", total_per_minute=2) == 0
    assert limits.check("c", total_per_minute=2) > 0
    clock["now"] = 180
    assert limits.check("c", total_per_minute=2) == 0


def test_daily_quota_survives_minute_reset_and_recovers_next_day(clock):
    limits = request_limits.RequestLimits()
    assert limits.check("a", total_per_day=1) == 0
    clock["now"] = 180
    assert limits.check("b", total_per_day=1) == 86400 - 180
    clock["now"] = 86400
    assert limits.check("b", total_per_day=1) == 0


def test_daily_wait_takes_precedence_over_minute_wait(clock):
    limits = request_limits.RequestLimits()
    assert limits.check("a", per_minute=1, total_per_day=1) == 0
    assert limits.check("a", per_minute=1, total_per_day=1) == 86280


def test_retry_rounds_up_and_is_positive_until_next_period(clock):
    limits = request_limits.RequestLimits()
    clock["now"] = 179.99
    assert limits.check("a", per_minute=1) == 0
    assert limits.check("a", per_minute=1) == 1
    clock["now"] = 180
    assert limits.check("a", per_minute=1) == 0


def test_concurrent_requests_cannot_exceed_global_quota(clock):
    limits = request_limits.RequestLimits()
    with ThreadPoolExecutor(max_workers=16) as pool:
        results = list(pool.map(lambda index: limits.check(str(index), total_per_minute=20), range(80)))
    assert results.count(0) == 20
    assert all(retry == 60 for retry in results if retry)
