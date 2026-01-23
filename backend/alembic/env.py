# Alembic SQLAlchemy configuration

import os
from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context
from app.models import Base

# this is the Alembic Config object
config = context.config

# Interpret the config file for Python logging
if config.config_file_name is not None:
    import logging.config
    logging.config.fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    sqlalchemy_url = os.getenv("DATABASE_URL", "postgresql://geosafe_user:geosafe_pass@localhost/geosafe")
    
    context.configure(
        url=sqlalchemy_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    sqlalchemy_url = os.getenv("DATABASE_URL", "postgresql://geosafe_user:geosafe_pass@localhost/geosafe")
    
    configuration = config.get_section(config.config_ini_section)
    configuration["sqlalchemy.url"] = sqlalchemy_url
    
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
