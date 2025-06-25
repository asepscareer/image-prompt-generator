FROM python:3.11-slim-buster
WORKDIR /
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["sh", "-c", "gunicorn -w 4 -b 0.0.0.0:${PORT:-5000} main:app"]