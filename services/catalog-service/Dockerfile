# syntax=docker/dockerfile:1
# Build context: repo ROOT (so we can COPY data/catalog.json from the canonical
# source). Build with: docker build -f services/catalog-service/Dockerfile -t vinex22/catalog-service:dev .
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY services/catalog-service/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY services/catalog-service/app ./app
COPY data/catalog.json ./catalog.json
EXPOSE 8080
USER 65532:65532
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--no-server-header"]
