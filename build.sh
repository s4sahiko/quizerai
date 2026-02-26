#!/bin/bash
set -o errexit

pip install -r requirements.txt

# Add any database migrations here if needed
# python app.py db upgrade
