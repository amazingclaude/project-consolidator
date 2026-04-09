#!/bin/sh
set -eu

exec gunicorn --bind=0.0.0.0:${PORT:-8000} -k uvicorn.workers.UvicornWorker app:app
