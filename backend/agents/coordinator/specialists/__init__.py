"""Specialist plug-in package.

Importing this package auto-discovers every plug-in: each sibling module is
imported so its ``register(...)`` call runs. This is the discovery step of the
Microkernel pattern — dropping a new ``<name>.py`` here (subclassing
``Specialist`` and calling ``register``) wires it into the coordinator graph
with zero changes to the core (``agent.py``).
"""
import importlib
import pkgutil

from specialists.registry import get_specialists, register  # noqa: F401  (re-export)

_INTERNAL = {"base", "registry"}

for _module in pkgutil.iter_modules(__path__):
    if _module.name not in _INTERNAL:
        importlib.import_module(f"{__name__}.{_module.name}")

__all__ = ["get_specialists", "register"]
