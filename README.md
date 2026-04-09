# Project Portfolio Consolidator

Project Portfolio Consolidator is a FastAPI + React application for consolidating Microsoft Project data, analyzing portfolio health, tracking deviations, and querying project data with Azure OpenAI.

## Features

- Portfolio health and KPI summaries
- Project, task, cost, schedule, and deviation analysis
- Fiscal year planning workflows
- Natural language querying over the project database
- React single-page frontend served by the FastAPI backend

## Tech Stack

- Backend: FastAPI, SQLAlchemy, Pandas
- Frontend: React, TypeScript, Vite
- Database: SQLite
- AI: Azure OpenAI via the OpenAI Python SDK

## Repository Structure

```text
app.py                  FastAPI entry point
src/                    Backend application code
frontend/               React frontend
data/                   SQLite DB and sample data
scripts/                Utility scripts
config.yaml             App configuration
.env.example            Environment variable template
```

## Prerequisites

- Python 3.11+
- Node.js 18+
- npm

## Backend Setup

Install Python dependencies:

```bash
pip install -r requirements.txt
```

## Frontend Setup

Install frontend dependencies:

```bash
cd frontend
npm install
```

Build the frontend:

```bash
npm run build
```

## Configuration

Copy the environment template and fill in your Azure OpenAI settings:

```bash
copy .env.example .env
```

Required environment variables:

```env
AZURE_OPENAI_API_KEY=your-api-key
AZURE_OPENAI_BASE_URL=https://YOUR-RESOURCE.openai.azure.com/openai/v1/
AZURE_OPENAI_MODEL=gpt-4.1
```

The application also reads `config.yaml`, but environment variables are preferred for secrets and deployment settings.

### Optional Local Corporate Network Settings

These are intended for local development only when your machine requires a corporate CA bundle or local proxy workaround:

```env
AZURE_OPENAI_CA_BUNDLE=C:\path\to\corporate-root-ca.pem
AZURE_OPENAI_ENABLE_LOCAL_NETWORK_WORKAROUNDS=true
AZURE_OPENAI_LOCAL_PROXY_URL=http://127.0.0.1:9000
```

Do not set these in Azure Web App unless you explicitly need them.

## Run Locally

From the repository root:

```bash
python app.py
```

The app runs on:

- App: `http://localhost:8000`
- API docs: `http://localhost:8000/docs`

If `frontend/dist` does not exist yet, the backend root route will return build instructions instead of the SPA.

## Local Development Workflow

Backend:

```bash
python app.py
```

Frontend build:

```bash
cd frontend
npm run build
```

This project currently serves the built frontend from FastAPI rather than running a separate dev server as the primary workflow.

## Azure OpenAI Notes

This project uses the Azure OpenAI resource-style endpoint, for example:

```text
https://YOUR-RESOURCE.openai.azure.com/openai/v1/
```

The configured model value should be your Azure deployment name, such as `gpt-4.1`.

## Deploy to Azure Web App

Recommended App Settings:

- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_BASE_URL`
- `AZURE_OPENAI_MODEL`

Recommended deployment flow:

1. Build the frontend:

   ```bash
   cd frontend
   npm install
   npm run build
   ```

2. Ensure the built frontend exists at `frontend/dist`.

3. Deploy the app with the repository root as the application root.

4. Configure Azure Web App startup to run the FastAPI app, for example:

   ```bash
   gunicorn -k uvicorn.workers.UvicornWorker app:app
   ```

5. Set required Azure OpenAI values in Web App Application Settings.

### Azure Web App Guidance

- Prefer Application Settings over `.env` in production.
- Do not enable local proxy workarounds in Azure unless required.
- Do not store secrets in `config.yaml`.

## Data and Database

The default SQLite database path is:

```text
data/projects.db
```

You can adjust this in `config.yaml`.

## Troubleshooting

### 500 errors on `/api/nl-query`

Check:

- Azure OpenAI endpoint format
- deployment/model name
- API key validity
- server logs for backend exceptions

### SSL or certificate errors locally

If your company uses TLS inspection, set:

```env
AZURE_OPENAI_CA_BUNDLE=C:\path\to\corporate-root-ca.pem
```

### Frontend not loading

Build the frontend first:

```bash
cd frontend
npm run build
```

## Security

- `.env` is ignored by git
- `.env.example` is safe to commit
- Keep secrets in environment variables, not source files

