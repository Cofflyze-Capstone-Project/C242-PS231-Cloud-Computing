FROM python:3.10-slim

WORKDIR /app

COPY . /app

# Pastikan folder model termasuk dalam image
RUN mkdir -p /app/model

RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 8080

CMD ["gunicorn", "-b", "0.0.0.0:8080", "app:app"]
