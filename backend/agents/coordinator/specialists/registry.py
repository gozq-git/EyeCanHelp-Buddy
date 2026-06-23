"""Plug-in registry — the lookup the microkernel core builds the graph from."""
from typing import List, Type, Union

from specialists.base import Specialist

_REGISTRY: List[Specialist] = []


def register(specialist: Union[Specialist, Type[Specialist]]):
    """Register a specialist plug-in.

    Usable as a class decorator (``@register``) or with an instance. Idempotent
    on ``name`` so re-imports during discovery don't create duplicates.
    """
    instance = specialist() if isinstance(specialist, type) else specialist
    if not instance.name:
        raise ValueError(f"Specialist {instance!r} must define a non-empty `name`.")
    if not any(s.name == instance.name for s in _REGISTRY):
        _REGISTRY.append(instance)
    return specialist  # keep the decorated class/instance usable


def get_specialists() -> List[Specialist]:
    """Return all registered plug-ins (discovery order)."""
    return list(_REGISTRY)
