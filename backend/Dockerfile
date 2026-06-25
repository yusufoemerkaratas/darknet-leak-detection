FROM python:3.10-slim

WORKDIR /app

RUN pip install --no-cache-dir \
    fastapi \
    uvicorn[standard] \
    sqlalchemy \
    psycopg2-binary \
    python-dotenv \
    alembic \
    pydantic \
    python-multipart

COPY . /app

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
