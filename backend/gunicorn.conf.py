"""Single-worker demo hosting keeps the in-process request budget shared."""
import os

bind = os.getenv("BIND", "127.0.0.1:5000")
workers = 1
worker_class = "gthread"
threads = 4
timeout = 60
accesslog = None  # Never record photo bodies or provider query strings.
errorlog = "-"
