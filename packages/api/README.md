# spending-monitor API

FastAPI backend application with AI-powered transaction monitoring and alerting.

## Features

- **FastAPI** - Modern, fast web framework for building APIs
- **AI-Powered Alerts** - Natural language alert rule creation with LLM integration
- **Transaction Management** - Comprehensive transaction CRUD operations with filtering
- **User Management** - User and credit card management endpoints
- **Background Processing** - Async alert monitoring and notification system
- **Authentication** - Keycloak integration with development bypass mode
- **Async/Await** - Fully asynchronous request handling
- **Pydantic** - Data validation using Python type annotations
- **CORS** - Cross-Origin Resource Sharing support
- **Database** - PostgreSQL with async SQLAlchemy
- **Migrations** - Database migrations with Alembic
- **Testing** - Comprehensive test suite with pytest
- **Code Quality** - Linting with ruff, type checking with mypy
- **Development** - Hot reload with uvicorn

## Quick Start

### Prerequisites
- Python 3.12+
- uv (Python package manager)
- Docker and Docker Compose
- Git

### Quick Backend Setup (Recommended) ⚡

**One Command - Complete Backend Setup**:
```bash
# From project root
pnpm dev:backend
```
This single command will:
1. 🗄️ Start PostgreSQL database  
2. ⬆️ Run database migrations
3. 🌱 Seed with test data
4. 🚀 Start FastAPI server on port 8000
5. 🔓 Enable auth bypass for development

**Individual Commands**:
```bash
pnpm backend:setup    # Setup only (DB + migrations + seed)
pnpm backend:start    # Start API only (port 8000)
pnpm backend:stop     # Stop database
```

### Complete Setup (Manual)

For more control or troubleshooting:

1. **Clone the repository and navigate to API directory**:
```bash
git clone <your-repo-url>
cd spending-transaction-monitor/packages/api
```

2. **Install Python dependencies**:
```bash
uv sync
```

3. **Start required services**:

   **PostgreSQL Database**:
   ```bash
   cd ../db
   podman compose up -d
   cd ../api
   ```

4. **Run database migrations**:
```bash
cd ../db
uv run alembic upgrade head
cd ../api
```

5. **Seed the database with test data**:
```bash
cd ../db
uv run python src/db/scripts/seed.py
cd ../api
```

6. **Start the API server**:
```bash
# With auth bypass (development)
ENVIRONMENT=development BYPASS_AUTH=true API_PORT=8000 uv run uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

# Production mode  
uv run uvicorn src.main:app --host 0.0.0.0 --port 8000
```

The services will be available at:
- **API**: http://localhost:8000
- **Interactive Docs**: http://localhost:8000/docs  
- **ReDoc**: http://localhost:8000/redoc
- **Health Check**: http://localhost:8000/health
- **PostgreSQL**: localhost:5432

### Quick Test

Test the API health check:
```bash
curl http://localhost:8000/health
```

Test transaction endpoints:
```bash
# Get transactions (requires auth in production)
curl http://localhost:8000/transactions

# Health check with all services
curl http://localhost:8000/health/
```

Run the test suite:
```bash
uv run pytest tests/
```

## Available Scripts

```bash
# Development
uv run uvicorn src.main:app --reload  # Start dev server with hot reload
uv run uvicorn src.main:app           # Start production server

# Testing
uv run pytest                        # Run all tests
uv run pytest tests/test_health.py   # Run specific test file
uv run pytest -v                     # Run tests with verbose output
uv run pytest --cov=src             # Run tests with coverage

# Code Quality
uv run ruff check .                  # Lint code
uv run ruff check . --fix           # Fix linting issues
uv run ruff format .                # Format code
uv run mypy src/                     # Type checking

# Database
uv run alembic upgrade head          # Apply migrations
uv run alembic downgrade -1          # Rollback one migration
uv run alembic revision --autogenerate -m "message"  # Create migration
uv run alembic history               # Show migration history
```

## Project Structure

```
src/
├── main.py              # FastAPI application entry point with alert service lifecycle
├── auth/
│   └── middleware.py    # Authentication middleware with Keycloak integration
├── core/
│   └── config.py        # Application configuration and settings
├── routes/
│   ├── health.py        # Health check endpoints
│   ├── transactions.py  # Transaction management endpoints
│   ├── users.py         # User management endpoints
│   └── alerts.py        # Alert rule and notification endpoints
├── services/
│   ├── alert_job_queue.py       # Background alert processing queue
│   ├── alert_rule_service.py    # Alert rule creation and management
│   ├── background_alert_service.py # Alert monitoring service
│   ├── notification_service.py  # Notification delivery service
│   ├── transaction_service.py   # Transaction business logic
│   ├── user_service.py         # User management service
│   └── alerts/                 # AI-powered alert processing
│       ├── agents/             # LLM agents for rule generation
│       ├── generate_alert_graph.py
│       ├── parse_alert_graph.py
│       └── validate_rule_graph.py
├── models/              # Database models (imported from db package)
├── schemas/             # Pydantic schemas for request/response
└── __init__.py

tests/
├── integration/         # Integration tests for API endpoints
├── test_*.py           # Unit tests for services and components
└── conftest.py         # Test configuration and fixtures
```

## API Endpoints

### Health Check
- **GET** `/health/` - Database and API health status
- **GET** `/` - Root endpoint with welcome message

### Users
- **GET** `/users/` - List users (with pagination and filtering)
- **POST** `/users/` - Create new user
- **GET** `/users/{user_id}` - Get user details
- **PUT** `/users/{user_id}` - Update user
- **DELETE** `/users/{user_id}` - Delete user

### Transactions
- **GET** `/transactions/` - List transactions (with filtering by user, card, amount, date range)
- **POST** `/transactions/` - Create new transaction
- **GET** `/transactions/{transaction_id}` - Get transaction details
- **PUT** `/transactions/{transaction_id}` - Update transaction
- **DELETE** `/transactions/{transaction_id}` - Delete transaction
- **GET** `/transactions/summary` - Transaction analytics and summaries
- **GET** `/transactions/categories` - Spending by category analysis

### Credit Cards
- **GET** `/transactions/credit-cards/` - List credit cards
- **POST** `/transactions/credit-cards/` - Create new credit card
- **GET** `/transactions/credit-cards/{card_id}` - Get credit card details
- **PUT** `/transactions/credit-cards/{card_id}` - Update credit card
- **DELETE** `/transactions/credit-cards/{card_id}` - Delete credit card

### Alerts
- **POST** `/alerts/validate-rule` - Validate natural language alert rule using AI
- **POST** `/alerts/create-rule` - Create new alert rule from validated rule
- **GET** `/alerts/rules` - List user's alert rules
- **GET** `/alerts/rules/{rule_id}` - Get alert rule details
- **PUT** `/alerts/rules/{rule_id}` - Update alert rule
- **DELETE** `/alerts/rules/{rule_id}` - Delete alert rule
- **POST** `/alerts/rules/{rule_id}/pause` - Pause/unpause alert rule
- **GET** `/alerts/notifications` - List alert notifications
- **POST** `/alerts/notifications` - Create notification method
- **PUT** `/alerts/notifications/{notification_id}` - Update notification method

### Database
All endpoints support async database operations with connection pooling and proper authentication.

## Configuration

### Environment Variables

**Core Settings:**
- `ENVIRONMENT` - Environment mode: `development`, `production`, `staging`, `test` (default: `development`)
- `DEBUG` - Enable debug logging (auto-enabled in development)
- `APP_NAME` - Application name (default: "spending-monitor")

**CORS Settings:**
- `ALLOWED_HOSTS` - List of allowed hosts (default: "http://localhost:5173")

**Authentication:**
- `BYPASS_AUTH` - Bypass authentication in development (auto-enabled if `ENVIRONMENT=development`)
- `KEYCLOAK_URL` - Keycloak server URL (default: "http://localhost:8080")
- `KEYCLOAK_REALM` - Keycloak realm name (default: "spending-monitor")
- `KEYCLOAK_CLIENT_ID` - Keycloak client ID (default: "spending-monitor")

**Database:**
- `DATABASE_URL` - PostgreSQL connection string (default: postgresql+asyncpg://user:password@localhost:5432/spending-monitor)

**LLM Integration:**
- `LLM_PROVIDER` - LLM provider (default: "openai")
- `API_KEY` - LLM API key for alert rule generation
- `MODEL` - LLM model name (default: "gpt-3.5-turbo")
- `BASE_URL` - Custom LLM API base URL (optional)
- `NODE_ENV` - Node environment setting (default: "development")

### Authentication Modes

**Development Mode (Default with `pnpm dev:backend`):**
```bash
# Authentication automatically bypassed - no Keycloak required
ENVIRONMENT=development BYPASS_AUTH=true API_PORT=8000
# ✅ Enabled automatically by our backend setup commands
```

**Manual Development Mode:**
```bash
# Authentication automatically bypassed - no Keycloak required  
ENVIRONMENT=development
# BYPASS_AUTH=true (auto-set when ENVIRONMENT=development)
```

**Production Mode:**
```bash
# Full Keycloak authentication required
ENVIRONMENT=production
BYPASS_AUTH=false
KEYCLOAK_URL=https://your-keycloak.com
KEYCLOAK_REALM=your-realm
KEYCLOAK_CLIENT_ID=your-client
```

> **📝 Note**: The `pnpm dev:backend` command automatically configures development mode with auth bypass for immediate testing.


## Development Tips

1. **API Documentation**: Visit `/docs` for interactive Swagger UI with all available endpoints
2. **Alert Rule Testing**: Use `/alerts/validate-rule` to test natural language alert rules before creating them
3. **Authentication**: Set `BYPASS_AUTH=true` in development to skip authentication for faster testing
4. **Background Jobs**: Alert monitoring runs automatically in the background when the API starts
5. **Schema Validation**: Pydantic automatically validates request/response data
6. **Async Operations**: Use `async def` for all route handlers
7. **Type Hints**: Add type annotations for better IDE support and mypy validation
8. **Database Sessions**: Use dependency injection for database sessions

## Testing

The test suite includes:
- Unit tests for individual functions
- Integration tests for API endpoints
- Database transaction rollback for test isolation
- Async test support with pytest-asyncio

Run specific test categories:
```bash
uv run pytest tests/ -k "health"     # Run health-related tests
uv run pytest tests/ -k "integration" # Run integration tests
```

## AI Alert System Details

### Alert Rule Creation Flow
1. **Natural Language Input**: Users provide alert rules in plain English
2. **LLM Processing**: AI agents parse and validate the rule logic
3. **SQL Generation**: Converts natural language to executable SQL queries
4. **Rule Validation**: Tests the generated SQL against sample transaction data
5. **Similarity Check**: Prevents duplicate rules using embedding similarity
6. **Background Monitoring**: Continuously monitors transactions against active rules
7. **Notification Delivery**: Sends alerts via configured notification methods

### Natural Language Alert Examples
```
"Alert me when I spend more than $500 in a single transaction"
"Notify me if I have more than 3 transactions per day at restaurants"
"Send an alert when my monthly spending on groceries exceeds $800"
"Alert me for any transaction over $100 at gas stations on weekends"
```

## Troubleshooting

### Common Issues

**1. Database Connection Issues**
- Check PostgreSQL is running: `podman ps | grep postgres`
- Verify database port: `telnet localhost 5432`
- Check connection string in `DATABASE_URL` environment variable
- Restart database: `cd ../db && podman compose restart`
- Verify database migrations are up to date: `cd ../db && uv run alembic upgrade head`

**2. Authentication Issues**
- **Development**: Set `BYPASS_AUTH=true` or `ENVIRONMENT=development` to bypass authentication
- **Production**: Ensure Keycloak is running and properly configured
- Check Keycloak settings: `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID`
- Verify JWT tokens are valid and not expired

**3. Alert Rule Creation Failures**
- Check LLM API credentials: `API_KEY` environment variable must be set
- Verify LLM provider settings: `LLM_PROVIDER`, `MODEL`, `BASE_URL`
- Check API quota limits for your LLM provider
- Review natural language input for clarity and specificity
- Check alert rule logs for detailed error messages

**4. Background Alert Processing Issues**
- Check that alert job queue started successfully in API logs
- Verify alert rules are active (not paused)
- Check notification settings are properly configured
- Review transaction data matches alert rule criteria

**5. Port Conflicts**
- API (8000): Change port in uvicorn command or `API_PORT` environment variable
- PostgreSQL (5432): Modify podman-compose.yml port mapping

### Getting User/Card IDs for Testing
```bash
cd ../db
uv run python -c "
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from db.database import SessionLocal
from db.models import User, CreditCard

async def get_ids():
    async with SessionLocal() as session:
        user = (await session.execute(select(User).limit(1))).scalar_one_or_none()
        if user:
            print(f'User ID: {user.id}')
            card = (await session.execute(select(CreditCard).where(CreditCard.user_id == user.id))).scalar_one_or_none()
            if card:
                print(f'Card ID: {card.id}')

asyncio.run(get_ids())
"
```

### Logs and Monitoring
- **API Logs**: Console output from uvicorn command shows all request/response activity
- **Alert Processing Logs**: Look for `INFO:services.alerts.alert_job_queue` and background service messages
- **Database Logs**: SQLAlchemy query logs (enable via configuration if needed)
- **Health Check**: `curl http://localhost:8000/health/` - shows API and database status
- **LLM Integration Logs**: Check for AI agent processing logs during alert rule creation

---

Generated with [AI Kickstart CLI](https://github.com/your-org/ai-kickstart)
