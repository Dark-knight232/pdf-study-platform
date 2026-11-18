import os
from celery import Celery

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

broker_use_ssl = None
redis_backend_use_ssl = None
if REDIS_URL.startswith("rediss://"):
    broker_use_ssl = {"ssl_cert_reqs": None}
    redis_backend_use_ssl = {"ssl_cert_reqs": None}

celery_app = Celery(
    "pdf_study",
    broker=REDIS_URL,
    backend=REDIS_URL,
    broker_use_ssl=broker_use_ssl,
    redis_backend_use_ssl=redis_backend_use_ssl,
)

celery_app.conf.update(
    broker_pool_limit=1,
    redis_max_connections=2,
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)


@celery_app.task
def ping():
    return "pong"
