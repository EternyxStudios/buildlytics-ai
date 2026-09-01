# Buildlytics AI Backend

Render configuration:

- Language: Python 3
- Root Directory: backend
- Build Command: pip install -r requirements.txt
- Start Command: uvicorn main:app --host 0.0.0.0 --port $PORT

Optional environment variable:

FRONTEND_ORIGIN=https://eternyxstudios.github.io

Endpoints:
- GET /
- GET /health
- POST /upload-dataset
- POST /generate-project
- GET /project/{project_id}
- POST /verify-project/{project_id}
