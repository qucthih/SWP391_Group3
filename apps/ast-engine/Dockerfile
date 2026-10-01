FROM python:3.11-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONPATH=/app/src
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY src ./src
EXPOSE 8001
# Chạy bằng user thường (không root)
RUN useradd -m engine
USER engine
CMD ["uvicorn", "ast_engine.main:app", "--host", "0.0.0.0", "--port", "8001"]
