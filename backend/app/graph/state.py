from typing import Optional, TypedDict

from pydantic import BaseModel, Field


class InventoryStatus(TypedDict):
    in_stock: bool
    cost: int


class AgentState(TypedDict):
    ticket_text: str
    extracted_part: Optional[str]
    inventory_status: Optional[InventoryStatus]
    human_approval_required: bool
    current_node: str


class PartExtraction(BaseModel):
    """Structured output for the intake LLM extraction phase."""

    part_name: str = Field(
        description="Canonical HVAC replacement part, lowercase, e.g. 'compressor', 'run capacitor'"
    )
    equipment_brand: Optional[str] = Field(
        default=None, description="Brand if mentioned in the ticket, e.g. 'Trane'"
    )
    equipment_model: Optional[str] = Field(
        default=None, description="Model if mentioned in the ticket, e.g. 'XR14'"
    )
    issue: str = Field(description="One-sentence summary of the field failure")
