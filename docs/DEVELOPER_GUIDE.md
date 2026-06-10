# 🚀 Developer Guide

Complete development guide for the Spending Transaction Monitor - a real-time credit card transaction alerting system with AI-powered natural language rule processing.

## 📋 Quick Navigation

- [🏗️ Architecture Overview](#️-architecture-overview)
- [🛠️ Development Setup](#️-development-setup)
- [🧪 Testing & Development](#-testing--development)
- [📦 Service Documentation](#-service-documentation)
- [🤖 ML Pipeline Setup](#-ml-pipeline-alert-recommender)
- [🔐 Authentication & Security](#-authentication--security)
- [📊 Data Flow](#-data-flow)
- [🚀 Deployment](#-deployment)
- [🔧 Environment Configuration](#-environment-configuration)
- [📋 Common Development Tasks](#-common-development-tasks)
- [🆘 Troubleshooting](#-troubleshooting)
- [🔗 Additional Resources](#-additional-resources)
- [🤝 Getting Help](#-getting-help)

---

## 🏗️ Architecture Overview

The system is a modern microservices architecture built for real-time transaction monitoring and AI-powered alerting:

```mermaid
graph TD
    %% External Data Sources
    subgraph EXT["External Sources"]
        BANK["Credit Card Transactions"]
        USER["User Interface"]
    end

    %% Authentication Layer
    subgraph AUTH["🔐 Authentication"]
        KC["Keycloak Server"]
        JWT["JWT Middleware"]
    end

    %% Ingestion Layer  
    subgraph ING["📥 Ingestion Layer"]
        INGEST["Ingestion Service<br/>Port: 8001"]
        TRANSFORM["Data Transformation"]
    end

    %% Core API Layer
    subgraph API["🔧 API Layer"]
        FASTAPI["FastAPI Server<br/>Port: 8000"]
        MIDDLEWARE["Auth Middleware"]
        ROUTES["API Routes"]
    end

    %% AI/NLP Layer
    subgraph AI["🤖 AI/NLP Layer"]
        VALIDATE["Rule Validation"]
        SIMILARITY["Similarity Check"]
        PARSER["Natural Language Parser"]
        LLM["LLM Integration"]
    end

    %% Business Logic Layer
    subgraph BIZ["💼 Business Logic"]
        RULES["Alert Rules Engine"]
        EVAL["Rule Evaluation"]
        ALERTS["Alert Processing"]
        QUEUE["Background Jobs"]
    end

    %% Data Layer
    subgraph DATA["💾 Data Layer"]
        POSTGRES["PostgreSQL Database<br/>Port: 5432"]
        VECTOR["pgvector Extension"]
        MODELS["SQLAlchemy Models"]
        MIGRATIONS["Alembic Migrations"]
    end

    %% Frontend Layer
    subgraph UI["🖥️ Frontend"]
        REACT["React App<br/>Port: 3000"]
        COMP["UI Components"]
        CHARTS["Analytics & Charts"]
    end

    %% External Services
    subgraph NOTIFY["📧 Notifications"]
        EMAIL["Email (SMTP)"]
        SMS["SMS"] 
        PUSH["Push Notifications"]
        WEBHOOK["Webhooks"]
    end

    %% Data Flow
    BANK --> INGEST
    INGEST --> TRANSFORM
    TRANSFORM --> FASTAPI
    
    USER --> KC
    KC --> JWT
    JWT --> MIDDLEWARE
    MIDDLEWARE --> ROUTES
    
    FASTAPI --> AI
    AI --> RULES
    RULES --> EVAL
    EVAL --> ALERTS
    ALERTS --> QUEUE
    QUEUE --> NOTIFY
    
    FASTAPI <--> MODELS
    MODELS <--> POSTGRES
    POSTGRES <--> VECTOR
    
    REACT <--> FASTAPI
    
    %% AI Integration
    AI --> LLM
    LLM --> VALIDATE
    VALIDATE --> SIMILARITY
```

### 🏛️ Service Architecture

| Service | Technology | Port | Purpose |
|---------|------------|------|---------|
| **UI** | React + Vite + TypeScript | 3000 | Frontend web application |
| **API** | FastAPI + SQLAlchemy | 8000 | Core business logic & REST API |
| **Ingestion** | FastAPI | 8001 | Transaction data ingestion & transformation |
| **Database** | PostgreSQL + pgvector | 5432 | Data persistence with vector embeddings |
| **Auth** | Keycloak | 8080 | OAuth2/OIDC authentication |
| **SMTP** | smtp4dev | 3002 | Local email testing |

---

## 🛠️ Development Setup

### Prerequisites

- **Node.js** 18+ & **pnpm** 9+
- **Python** 3.12+ & **uv** package manager
- **Podman** (preferred) or **Docker**
- **Git**
- **jq** (for JSON processing in scripts)

### Quick Start (Recommended)

```bash
# 1. Clone and install dependencies
git clone https://github.com/rh-ai-quickstart/spending-transaction-monitor
cd spending-transaction-monitor
pnpm setup

# 2. Create environment file
cp env.example .env.development
# Edit .env.development with your configuration

# 3. Start all services with containers (DB + API + UI + nginx + SMTP)
make run-local
```

This will automatically:

- Start PostgreSQL database with pgvector extension
- Run database migrations and seed test data
- Start all services in containers
- Set up nginx proxy

**Services will be available at:**

- Frontend: <http://localhost:3000>
- API (proxied): <http://localhost:3000/api/*>
- API (direct): <http://localhost:8000>
- API Docs: <http://localhost:8000/docs>
- SMTP Web UI: <http://localhost:3002>
- Database: localhost:5432

### Alternative: Local Development Mode

For active development without containers:

```bash
# Start all services locally (DB via container, API + UI locally)
pnpm dev
```

**Development URLs:**

- Web UI: <http://localhost:5173> (shows dev mode banner)
- API: <http://localhost:8000> (auth bypass enabled)
- API Docs: <http://localhost:8000/docs>
- Component Storybook: <http://localhost:6006>

### Individual Service Setup

#### 🗄️ Database

```bash
# Start PostgreSQL with pgvector
pnpm db:start

# Run migrations
pnpm db:upgrade

# Seed test data
pnpm db:seed

# Verify setup
pnpm db:verify
```

#### 🔧 API Server

```bash
cd packages/api
uv sync                    # Install Python dependencies
uv run uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

#### 🖥️ Frontend

```bash
cd packages/ui
pnpm install               # Install dependencies
pnpm dev                   # Start development server
```

---

## 🧪 Testing & Development

### Interactive Alert Rule Testing

**After starting with `make run-local`, test alert rules interactively:**

#### List Available Test Scenarios

```bash
make list-alert-samples
```

Shows all available test scenarios with descriptions:

- "Alert when spending more than $500 in one transaction"
- "Alert me if my dining expense exceeds the average of the last 30 days by more than 40%"
- "Alert me if a transaction happens outside my home state"
- And 13 more realistic scenarios...

#### Interactive Testing Menu

```bash
make test-alert-rules
```

**Features:**

- 📋 **Clean menu** - Shows only alert descriptions (no technical filenames)
- 📊 **Data preview** - Shows realistic transaction data adjusted to current time
- 🔍 **User context** - Displays test user profile and transaction history
- ✅ **Confirmation** - Preview data before running the test
- 🤖 **Full validation** - Complete NLP validation and rule creation process

**Example Workflow:**

1. Select an alert rule by number (1-16)
2. Review the data preview showing exactly what will be tested
3. Confirm to proceed with the test
4. Watch the complete validation and creation process

#### What the Test Does

1. **Seeds database** with realistic user and transaction data
2. **Validates the alert rule** using the NLP validation API
3. **Checks for similar rules** to prevent duplicates
4. **Creates the alert rule** if validation passes
5. **Shows step-by-step results** including SQL queries and processing

### Automated Testing

#### Run All Tests

```bash
pnpm test                  # All packages
```

#### Package-Specific Tests

```bash
# API tests (comprehensive test suite)
cd packages/api
uv run pytest -v

# Database tests
cd packages/db
uv run pytest -v

# Frontend tests
cd packages/ui
pnpm test
```

#### Test Coverage

- **API**: 40+ tests (auth, transactions, alerts, validation)
- **Database**: Integration and model tests
- **Frontend**: Component and hook tests
- **Integration**: End-to-end API tests

---

## 📦 Service Documentation

### 🔧 API Service

**Location**: `packages/api/`  
**Documentation**: [API README](../packages/api/README.md)

**Key Features:**

- User management & authentication
- Transaction CRUD operations
- AI-powered alert rule validation
- Natural language processing for rules
- Similarity checking for duplicate rules
- Real-time rule evaluation
- Background job processing
- Analytics & reporting endpoints

**Critical Endpoints:**

- `GET /health` - Health check
- `POST /transactions` - Create transaction
- `GET /users/{id}/transactions` - User transactions
- `POST /users/{id}/alert-rules/validate` - Validate alert rule with NLP
- `POST /users/{id}/alert-rules` - Create alert rule
- `GET /users/{id}/alert-rules` - List user alert rules

### 🖥️ Frontend (UI)

**Location**: `packages/ui/`  
**Documentation**: [UI README](../packages/ui/README.md)

**Technology Stack:**

- React 18 with TypeScript
- TanStack Router for routing
- TanStack Query for data fetching
- Recharts for data visualization
- Shadcn/ui component library
- Tailwind CSS for styling
- Dark/light theme support

**Key Features:**

- Transaction dashboard with analytics
- Interactive alert rule creation
- Real-time validation feedback
- Responsive design
- Component library with Storybook

### 💾 Database

**Location**: `packages/db/`  
**Documentation**: [Database README](../packages/db/README.md)

**Technology:**

- PostgreSQL 15+ with pgvector extension
- Async SQLAlchemy with Pydantic models
- Alembic for schema migrations
- Vector embeddings for similarity search

**Key Models:**

- Users, Transactions, Alert Rules
- Alert Notifications, Credit Cards
- Vector embeddings for rule similarity

### 🤖 ML Pipeline (Alert Recommender)

**Location**: `ml-pipeline/alert-recommender-pipeline/`  
**Documentation**: [Pipeline README](../ml-pipeline/alert-recommender-pipeline/README.md)

A Kubeflow pipeline for training and deploying KNN-based collaborative filtering models for alert recommendations.

**Architecture:**

```
┌─────────────────────────────────────────────────────────────────┐
│                     Kubeflow Pipeline                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐          │
│  │ Prepare     │──▶│ Train       │──▶│ Save        │          │
│  │ Data        │   │ Model       │   │ Model       │          │
│  └─────────────┘   └─────────────┘   └──────┬──────┘          │
│                                              │                  │
│                                    ┌─────────┴─────────┐       │
│                                    ▼                   ▼       │
│                           ┌─────────────┐     ┌─────────────┐  │
│                           │ Register    │     │ Deploy      │  │
│                           │ Model       │────▶│ Model       │  │
│                           │ (optional)  │     │             │  │
│                           └─────────────┘     └─────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Prerequisites:**

- OpenShift cluster with OpenShift AI (Data Science Pipelines)
- KServe or OpenDataHub Model Serving
- MinIO or S3-compatible storage
- (Optional) OpenDataHub Model Registry

**Quick Start with Helm:**

```bash
# Install with default values (includes DSPA setup)
helm install alert-recommender deploy/helm/alert-recommender-pipeline \
  --namespace spending-transaction-monitor \
  --create-namespace

# Install with custom MinIO configuration
helm install alert-recommender deploy/helm/alert-recommender-pipeline \
  --namespace spending-transaction-monitor \
  --set minio.endpoint="http://my-minio:9000" \
  --set minio.accessKey="myaccesskey" \
  --set minio.secretKey="mysecretkey"

# Install with Model Registry enabled
helm install alert-recommender deploy/helm/alert-recommender-pipeline \
  --namespace spending-transaction-monitor \
  --set modelRegistry.enabled=true \
  --set modelRegistry.url="http://model-registry:8080"
```

**Key Configuration Options:**

| Parameter | Description | Default |
|-----------|-------------|---------|
| `pipeline.name` | Model name | `alert-recommender` |
| `pipeline.version` | Model version | `1.0.0` |
| `pipeline.nNeighbors` | KNN neighbors | `5` |
| `pipeline.deployModel` | Deploy after training | `true` |
| `pipeline.registerModel` | Register with Model Registry | `false` |
| `minio.endpoint` | MinIO endpoint URL | `http://minio-service:9000` |
| `modelRegistry.enabled` | Enable Model Registry | `false` |

**Data Source Priority:**

The pipeline automatically tries data sources in order:
1. **PostgreSQL Database** (preferred) - Uses `spending-monitor-secret`
2. **MinIO** - Falls back to S3-compatible storage
3. **Local Files** - Last resort fallback to bundled sample data

**API Endpoints:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/ping` | GET | Health check |
| `/health` | GET | Detailed health status |
| `/train` | POST | Create and run a training pipeline |
| `/status` | GET | Get pipeline run status |
| `/delete` | DELETE | Delete a pipeline |
| `/cleanup` | POST | Clean up deployment resources |
| `/models` | GET | List deployed InferenceServices |

**Example: Trigger Training Pipeline:**

```bash
curl -X POST http://alert-recommender-pipeline/train \
  -H "Content-Type: application/json" \
  -d '{
    "name": "alert-recommender",
    "version": "1.0.0",
    "n_neighbors": 5,
    "deploy_model": true
  }'
```

**Local Development:**

```bash
cd ml-pipeline/alert-recommender-pipeline

# Install dependencies
pip install -e ".[dev]"

# Run the FastAPI service locally
uvicorn alert_recommender_pipeline.main:app --reload --port 8000

# Build container image
podman build -t alert-recommender-pipeline:latest -f Containerfile .
```

For complete documentation including troubleshooting and advanced configuration, see the [Pipeline README](../ml-pipeline/alert-recommender-pipeline/README.md).

---

## 🔐 Authentication & Security

**Complete Documentation**: [Authentication Guide](auth/README.md)

### Overview

- **OAuth2/OIDC** with Keycloak
- **JWT tokens** for API authentication
- **Role-based access control**
- **Development bypass mode** for local development

### Development Mode (Default)

The system includes authentication bypass for faster development:

- **Auto-enabled**: When `BYPASS_AUTH=true` (default in development)
- **Visual indicator**: 🔓 Yellow banner in UI
- **Mock user**: Automatically signed in as "John Doe"
- **Security**: Only works in development builds

### Setup Keycloak (Optional for Development)

```bash
# Use our automated setup script
python scripts/setup_keycloak.py

# Or use development helper
./scripts/auth-dev.sh setup
./scripts/auth-dev.sh help
```

### Testing Authentication

```bash
cd packages/api
uv run pytest tests/test_auth* -v
```

---

## 📊 Data Flow

### Transaction Processing Flow

```mermaid
sequenceDiagram
    participant Bank as Credit Card Provider
    participant Ingest as Ingestion Service  
    participant API as API Server
    participant AI as AI/NLP Service
    participant DB as PostgreSQL
    participant Rules as Rules Engine
    participant Alerts as Alert Service
    participant User as Frontend

    Bank->>Ingest: Raw Transaction Data
    Ingest->>Ingest: Validate & Transform
    Ingest->>API: POST /transactions
    API->>DB: Store Transaction
    API->>Rules: Evaluate Against Rules
    Rules->>DB: Fetch User Alert Rules
    Rules->>Rules: Process Rules with Context
    
    alt Alert Triggered
        Rules->>Alerts: Create Alert
        Alerts->>User: Send Notification
        Alerts->>DB: Store Alert Record
    end
    
    API-->>Ingest: 201 Created
    User->>API: GET /transactions
    API->>DB: Query Transactions  
    DB-->>API: Transaction Data
    API-->>User: Display Transactions
```

### Alert Rule Validation Flow

```mermaid
sequenceDiagram
    participant User as Frontend
    participant API as API Server
    participant AI as AI/NLP Service
    participant Vector as Vector DB
    participant LLM as LLM Service
    participant DB as PostgreSQL

    User->>API: Create Alert Rule (Natural Language)
    API->>AI: Validate Rule
    AI->>LLM: Parse Natural Language
    LLM-->>AI: Structured Rule
    AI->>Vector: Generate Embedding
    AI->>Vector: Search Similar Rules
    Vector-->>AI: Similar Rules Found
    AI->>DB: Check User's Existing Rules
    DB-->>AI: User Rules
    AI-->>API: Validation Result + Warnings
    API-->>User: Show Results & Confirmation
    
    alt User Confirms
        User->>API: Confirm Rule Creation
        API->>DB: Store Alert Rule
        DB-->>API: Rule Created
        API-->>User: Success Response
    end
```

---

## 🚀 Deployment

### Local Container Deployment (Recommended)

#### Quick Start

```bash
# Start with pre-built images
make run-local

# Build and run from source
make build-run-local

# Reset with fresh data
make reset-local
```

#### Container Management

```bash
make run-local              # Start all services
make build-local           # Build images from source
make stop-local           # Stop all services
make logs-local           # View service logs
make reset-local          # Reset with fresh data
```

#### Environment File Setup

```bash
# Check if .env file exists
make check-env-file

# Create from template if needed
make create-env-file
```

### OpenShift Deployment

#### Cluster Admin Privileges

**IMPORTANT:** This quickstart utilizes some features that can only be used if the role you're using for installing the charts has `clusterAdmin`. This includes enabling and setting up the model registry. To learn more about the `clusterAdmin` privileges please see the [documentation](https://docs.redhat.com/en/documentation/red_hat_openshift_ai_self-managed/2.22/html/enabling_lab-tuning/installing-the-required-components-for-lab-tuning_enable-lab-tuning).

#### Quick Deploy

```bash
# OpenShift internal registry quick deploy:
make REGISTRY_URL="$(oc get route default-route -n openshift-image-registry -o jsonpath='{.spec.host}')" build-deploy
```

#### Step-by-step

```bash
# Login and setup
# IMPORTANT: For OpenShift's internal registry, set REGISTRY_URL once and reuse it.
export REGISTRY_URL="$(oc get route default-route -n openshift-image-registry -o jsonpath='{.spec.host}')"
make login
make create-project

# Build and push images
make build-all
make push-all

# Deploy
make deploy
```

#### Using Quay.io instead of the OpenShift internal registry

```bash
# 1) Authenticate to Quay (recommended: use a robot account token)
make REGISTRY_URL=quay.io QUAY_USERNAME=<quay-user-or-robot> QUAY_TOKEN=<token> login

# 2) Build + push to your Quay org + deploy
make REGISTRY_URL=quay.io REPOSITORY=<your-quay-org> IMAGE_TAG=<tag> build-deploy
```

#### OpenShift Management

```bash
make deploy              # Deploy to OpenShift
make deploy-dev         # Deploy in development mode
make undeploy           # Remove deployment
make status             # Check deployment status
make logs-api           # View API logs
make logs-ui            # View UI logs
```

---

## 🔧 Environment Configuration

### Environment File

The application uses a `.env` file in the root directory for configuration:

```bash
# Create from template
cp env.example .env
```

### Required Variables

#### Database Configuration

```bash
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/spending-monitor
```

#### SMTP Configuration (for email alerts)

```bash
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USERNAME=your-username
SMTP_PASSWORD=your-password
SMTP_FROM_EMAIL=alerts@spending-monitor.com
SMTP_USE_TLS=true
SMTP_USE_SSL=false
```

#### API Configuration

```bash
ENVIRONMENT=development
BYPASS_AUTH=true
API_PORT=8000
CORS_ALLOWED_ORIGINS=["http://localhost:3000","http://localhost:5173"]
ALLOWED_HOSTS=["http://localhost:3000","http://localhost:5173"]
```

#### LLM Configuration

```bash
LLM_PROVIDER=openai          # openai | vertexai
BASE_URL=https://api.openai.com/v1
API_KEY=sk-your-openai-api-key-here
MODEL=gpt-4o-mini
```

### Container Environment

Environment variables are automatically loaded from `.env` in container deployments.

### Production Configuration

For production deployments, use OpenShift secrets:

```yaml
api:
  envFrom:
    - secretRef:
        name: spending-monitor-secrets
  env:
    ENVIRONMENT: "production"
    BYPASS_AUTH: "false"
```

---

## 📋 Common Development Tasks

### Database Operations

```bash
pnpm db:start              # Start PostgreSQL container
pnpm db:upgrade            # Apply migrations  
pnpm db:seed               # Add sample data
pnpm db:verify             # Verify setup
pnpm db:revision           # Create new migration
pnpm db:stop               # Stop database
```

### Code Quality

```bash
pnpm lint                  # Lint all packages
pnpm format                # Format all code
pnpm type-check            # TypeScript checking
pnpm test                  # Run all tests
```

### Container Operations

```bash
make run-local             # Start all services
make build-run-local       # Build and start
make stop-local            # Stop services
make logs-local            # View logs
make reset-local           # Reset with fresh data
```

### Alert Rule Testing

```bash
make list-alert-samples    # List available test scenarios
make test-alert-rules      # Interactive testing menu
```

### Package Management

```bash
# Install Python dependencies
pnpm --filter @spending-monitor/api install:deps
pnpm --filter @spending-monitor/db install:deps

# Build specific package
pnpm --filter @spending-monitor/ui build
```

---

## 🆘 Troubleshooting

### Common Issues

#### Environment File Not Found

```bash
# Create environment file
make create-env-file
# Edit .env with your configuration
```

#### Database Connection Errors

```bash
# Check if PostgreSQL is running
pnpm db:start

# Verify connection settings
echo $DATABASE_URL

# Reset database
make reset-local
```

#### Authentication Issues

```bash
# Enable development bypass (default)
export BYPASS_AUTH=true

# Check auth configuration
grep -i auth .env

# Restart services
make stop-local && make run-local
```

#### Python Environment Issues

```bash
# Recreate virtual environment
cd packages/api
rm -rf .venv
uv sync

# Check Python version
python --version  # Should be 3.12+
```

#### Port Conflicts

Default ports used:

- Frontend: 3000 (container) / 5173 (dev)
- API: 8000
- Database: 5432
- SMTP: 3002
- Keycloak: 8080

#### Vector Database Issues

```bash
# Check pgvector extension
pnpm db:start
# Connect to database and run: CREATE EXTENSION IF NOT EXISTS vector;
```

### Development Tips

#### Faster Development

```bash
# Use development mode for faster iteration
pnpm dev

# Use container mode for full environment testing
make run-local

# Use interactive testing for alert rules
make test-alert-rules
```

#### Debugging

```bash
# View API logs in development
cd packages/api && uv run uvicorn src.main:app --reload --log-level debug

# View container logs
make logs-local

# Test API endpoints directly
curl http://localhost:8000/health
```

#### Performance

```bash
# Profile database queries
export DATABASE_ECHO=true

# Monitor container resources
podman stats
```

---

## 🔗 Additional Resources

- [Main README](../README.md) - Project overview and quick start
- [Contributing Guidelines](../CONTRIBUTING.md) - Development standards and workflow
- [Auth Integration Guide](auth/INTEGRATION.md) - Detailed authentication setup
- [API Documentation](../packages/api/README.md) - API service details
- [UI Documentation](../packages/ui/README.md) - Frontend development guide
- [Database Documentation](../packages/db/README.md) - Database schema and migrations
- [ML Pipeline Documentation](../ml-pipeline/alert-recommender-pipeline/README.md) - Kubeflow pipeline for model training and deployment

---

## 🤝 Getting Help

1. **Check this developer guide** for comprehensive information
2. **Review service-specific READMEs** in each package directory
3. **Run interactive tests** with `make test-alert-rules` to understand the system
4. **Check existing GitHub issues** for known problems
5. **Create new issue** with detailed description and reproduction steps

Happy developing! 🎉
