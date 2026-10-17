"""In-process demo limits. Use gateway/distributed limits for multiple workers."""
import math
import threading
import time
from collections import OrderedDict


class RequestLimits:
    def __init__(self):
        self._lock = threading.Lock()
        self._clients = OrderedDict()
        self._minute = (0, 0)
        self._day = (0, 0)

    def check(self, client, per_minute=6, total_per_minute=20, total_per_day=200):
        now = time.time()
        minute, day = int(now // 60), int(now // 86400)
        with self._lock:
            client_bucket, client_count = self._clients.pop(client, (minute, 0))
            if client_bucket != minute:
                client_count = 0
            minute_count = self._minute[1] if self._minute[0] == minute else 0
            day_count = self._day[1] if self._day[0] == day else 0
            retry = 0
            if client_count >= per_minute or minute_count >= total_per_minute:
                retry = max(1, math.ceil((minute + 1) * 60 - now))
            if day_count >= total_per_day:
                retry = max(1, math.ceil((day + 1) * 86400 - now))
            self._clients[client] = (minute, client_count + (not retry))
            while len(self._clients) > 4096:
                self._clients.popitem(last=False)
            if not retry:
                self._minute = (minute, minute_count + 1)
                self._day = (day, day_count + 1)
            return retry
