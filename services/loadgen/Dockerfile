# syntax=docker/dockerfile:1
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY locustfile.py ./
EXPOSE 8089
USER 65532:65532
ENTRYPOINT ["locust", "-f", "locustfile.py"]
