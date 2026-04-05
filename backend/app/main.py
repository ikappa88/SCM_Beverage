from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.scheduler import start_scheduler, stop_scheduler
from app.api import (
    auth,
    users,
    locations,
    products,
    routes,
    inventory,
    upload,
    audit_log,
    kpi_threshold,
    alerts,
    orders,
    deliveries,
    scenarios,
    templates,
    simulation,
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield
    stop_scheduler()


_is_production = settings.ENVIRONMENT == "production"

app = FastAPI(
    title="SCM Beverage API",
    description="飲料メーカー向け物流管理システム API",
    version="0.1.0",
    lifespan=lifespan,
    docs_url=None if _is_production else "/docs",
    redoc_url=None if _is_production else "/redoc",
    openapi_url=None if _is_production else "/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(locations.router)
app.include_router(products.router)
app.include_router(routes.router)
app.include_router(inventory.router)
app.include_router(upload.router)
app.include_router(audit_log.router)
app.include_router(kpi_threshold.router)
app.include_router(alerts.router)
app.include_router(orders.router)
app.include_router(deliveries.router)
app.include_router(scenarios.router)
app.include_router(templates.router)
app.include_router(simulation.router)


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "environment": settings.ENVIRONMENT,
        "version": "0.1.0",
    }


@app.get("/")
def root():
    return {"message": "SCM Beverage API"}
