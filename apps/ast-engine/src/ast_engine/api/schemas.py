"""Pydantic schemas cho request/response. Sẽ chốt hợp đồng (contract) với api-gateway."""
from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    version: str
