#!/bin/sh
set -eu

exec gunicorn -c gunicorn.conf.py app:app
