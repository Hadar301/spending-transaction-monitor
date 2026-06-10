# spending-monitor Database

PostgreSQL database setup with Docker Compose and Alembic migrations.

## Features

- **PostgreSQL 16 with pgvector** - Modern relational database with vector similarity search
- **pgvector Extension** - Vector embeddings and similarity search capabilities
- **Docker Compose** - Easy database setup and management
- **Alembic** - Database migrations with SQLAlchemy
- **Async SQLAlchemy** - Modern async database operations
- **Connection Pooling** - Optimized database connections
- **Testing** - Test utilities with transaction rollback

## Quick Start

### Prerequisites
- Podman (preferred) or Docker
- Python 3.12+ (for running migrations)

### Setup

1. **Start the database**:
```bash
pnpm db:start   # uses `podman compose` if available, falls back to `docker compose`
```

This starts a PostgreSQL container with the following configuration:
- **Host**: localhost
- **Port**: 5432
- **Database**: spending-monitor
- **Username**: user
- **Password**: password

2. **Run initial migrations**:
```bash
pnpm upgrade
```

## Available Scripts

```bash
# Database Management
pnpm db:start       # Start PostgreSQL container
pnpm db:stop        # Stop and remove containers
pnpm db:logs        # View database logs

# Migration Management
pnpm upgrade        # Apply all pending migrations
pnpm downgrade      # Rollback last migration
pnpm revision       # Create new migration (auto-generate)
pnpm history        # Show migration history

# Development
pnpm reset          # Stop, remove containers, and restart

# Data
pnpm seed           # Seed database with sample data
pnpm verify         # Print sample user and related data
```

## Database Configuration

### Environment Variables
Create a `.env` file in the project root:

```env
# Database connection
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/spending-monitor
DB_ECHO=false

# Docker configuration
POSTGRES_DB=spending-monitor
POSTGRES_USER=user
POSTGRES_PASSWORD=password
```

### Connection String Format
```
postgresql+asyncpg://[user[:password]@][host[:port]][/database]
```

## Migrations

### Creating Migrations

1. **Auto-generate migration** (recommended):
```bash
pnpm revision -m "add user table"
```

2. **Manual migration**:
```bash
alembic revision -m "add custom index"
```

### Migration Commands

```bash
# Apply migrations
alembic upgrade head              # Apply all pending
alembic upgrade +2                # Apply next 2 migrations
alembic upgrade ae1027a6acf       # Apply to specific revision

# Rollback migrations
alembic downgrade -1              # Rollback 1 migration
alembic downgrade base            # Rollback all migrations
alembic downgrade ae1027a6acf     # Rollback to specific revision

# Information
alembic history                   # Show migration history
alembic current                   # Show current revision
alembic show ae1027a6acf         # Show specific migration
```

## Project Structure

```
src/
└── database.py              # Database engine and session configuration

alembic/
├── versions/                 # Migration files
├── env.py                   # Alembic environment configuration
└── script.py.mako          # Migration template

tests/
└── test_database.py         # Database connection tests

compose.yml                   # Docker Compose configuration
alembic.ini                  # Alembic configuration
pyproject.toml               # Python dependencies
```

## Database Schema

### Best Practices

1. **Table Names**: Use singular nouns (e.g., `user`, not `users`)
2. **Column Names**: Use snake_case
3. **Primary Keys**: Use `id` as the primary key column name
4. **Foreign Keys**: Use `table_id` format (e.g., `user_id`)
5. **Timestamps**: Include `created_at` and `updated_at` columns
6. **Indexes**: Add indexes for frequently queried columns

### Example Model

```python
from sqlalchemy import Column, Integer, String, DateTime, func
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class User(Base):
    __tablename__ = "user"
    
    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
```

## Vector Search with pgvector

The database includes the pgvector extension for similarity search and AI/ML workloads.

### Vector Data Types

```python
from sqlalchemy import Column, Integer, String, DateTime, func
from sqlalchemy.dialects.postgresql import ARRAY
from pgvector.sqlalchemy import Vector

class Document(Base):
    __tablename__ = "document"
    
    id = Column(Integer, primary_key=True)
    content = Column(String, nullable=False)
    embedding = Column(Vector(1536))  # OpenAI embedding dimension
    created_at = Column(DateTime, server_default=func.now())
```

### Similarity Search Examples

```python
# L2 distance (Euclidean)
results = await session.execute(
    select(Document)
    .order_by(Document.embedding.l2_distance([0.1, 0.2, 0.3]))
    .limit(5)
)

# Cosine distance
results = await session.execute(
    select(Document)
    .order_by(Document.embedding.cosine_distance([0.1, 0.2, 0.3]))
    .limit(5)
)

# Inner product
results = await session.execute(
    select(Document)
    .order_by(Document.embedding.max_inner_product([0.1, 0.2, 0.3]))
    .limit(5)
)
```

### Performance Optimization

For large datasets, create appropriate indexes:

```sql
-- IVFFlat index (good for L2 and inner product)
CREATE INDEX ON document USING ivfflat (embedding vector_l2_ops);

-- HNSW index (good for L2, inner product, and cosine distance)
CREATE INDEX ON document USING hnsw (embedding vector_l2_ops);
CREATE INDEX ON document USING hnsw (embedding vector_cosine_ops);
```

## Development Workflow

### 1. Schema Changes
1. Modify your SQLAlchemy models
2. Generate migration: `pnpm revision -m "description"`
3. Review the generated migration file
4. Apply migration: `pnpm upgrade`

### 2. Data Changes
1. Create manual migration: `alembic revision -m "data migration"`
2. Edit the migration file to include data operations
3. Apply migration: `pnpm upgrade`

### 3. Testing
1. Start test database: `pnpm db:start`
2. Run migrations: `pnpm upgrade`
3. Run tests: `python -m pytest tests/`

## Troubleshooting

### Common Issues

**Port already in use**:
```bash
pnpm db:stop
docker container prune
pnpm db:start
```

**Migration conflicts**:
```bash
alembic history
alembic downgrade [conflicting_revision]
# Resolve conflicts in migration files
alembic upgrade head
```

**Connection refused**:
- Ensure Docker is running
- Check if database container is started: `podman ps`
- Verify connection string in environment variables

### Database Reset
To completely reset the database:
```bash
pnpm db:stop
docker volume prune
pnpm db:start
pnpm upgrade
```

## Production Considerations

- Use connection pooling for better performance
- Set up database backups
- Monitor database performance
- Use environment-specific configurations
- Implement proper error handling and logging

---

Generated with [AI Kickstart CLI](https://github.com/your-org/ai-kickstart)
