FROM python:3.12-slim

WORKDIR /app
COPY . .
RUN pip install --no-cache-dir -e .

ENV DOCFORGE_API_BASE=http://localhost:8000/api
ENV DOCFORGE_FRONTEND_BASE=http://localhost:5173
ENV HOST=0.0.0.0
ENV PORT=8001

EXPOSE 8001

CMD ["docforge-mcp-server"]
