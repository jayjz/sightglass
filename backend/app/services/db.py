"""Mock warehouse lookup. Swap for a real inventory adapter later."""

from typing import Optional

from app.graph.state import InventoryStatus

# Street prices a dispatcher would actually see on a replenishment order.
INVENTORY_CATALOG: dict[str, InventoryStatus] = {
    "compressor": {"in_stock": True, "cost": 1250},
    "scroll compressor": {"in_stock": True, "cost": 1450},
    "capacitor": {"in_stock": True, "cost": 22},
    "run capacitor": {"in_stock": True, "cost": 22},
    "dual run capacitor": {"in_stock": True, "cost": 28},
    "contactor": {"in_stock": True, "cost": 48},
    "blower motor": {"in_stock": True, "cost": 380},
    "condenser fan motor": {"in_stock": True, "cost": 310},
    "fan motor": {"in_stock": True, "cost": 310},
    "txv": {"in_stock": True, "cost": 185},
    "expansion valve": {"in_stock": True, "cost": 185},
    "evaporator coil": {"in_stock": False, "cost": 890},
    "condenser coil": {"in_stock": False, "cost": 920},
    "heat exchanger": {"in_stock": False, "cost": 1450},
    "igniter": {"in_stock": True, "cost": 65},
    "flame sensor": {"in_stock": True, "cost": 28},
    "pressure switch": {"in_stock": True, "cost": 55},
    "thermostat": {"in_stock": True, "cost": 220},
    "filter drier": {"in_stock": True, "cost": 35},
    "reversing valve": {"in_stock": True, "cost": 275},
    "control board": {"in_stock": True, "cost": 420},
    "board": {"in_stock": True, "cost": 420},
}

# Unknown parts are treated as high-cost so they still hit the human gate.
DEFAULT_STATUS: InventoryStatus = {"in_stock": True, "cost": 650}

APPROVAL_THRESHOLD = 500


def lookup_part(part_name: Optional[str]) -> InventoryStatus:
    if not part_name:
        return dict(DEFAULT_STATUS)

    key = part_name.lower().strip()
    if key in INVENTORY_CATALOG:
        return dict(INVENTORY_CATALOG[key])

    for catalog_key, status in INVENTORY_CATALOG.items():
        if catalog_key in key or key in catalog_key:
            return dict(status)

    return dict(DEFAULT_STATUS)
