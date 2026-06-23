"""The plug-in contract for the Microkernel (Plug-in) pattern.

The coordinator is the *microkernel*: a minimal, stable core (escalation +
triage + graph assembly) that knows nothing about individual specialists. Each
specialist is a *plug-in* that conforms to the :class:`Specialist` contract
below and registers itself with the registry. New specialists are added by
dropping a module into this package — the core never changes.
"""
from typing import Any, Dict, List, TypedDict


class CoordinatorState(TypedDict, total=False):
    """State threaded through the LangGraph by the core and the plug-ins."""

    prompt: str
    route: str  # "triage" | "escalate" | <specialist.name>  (dynamic, not a fixed enum)
    response: str
    kb_query: str
    kb_results: List[Dict[str, Any]]


class Specialist:
    """Contract every specialist plug-in must satisfy.

    Attributes:
        name: Unique identifier. Doubles as the triage label AND the graph node
            name, so it must be a single lowercase word (the triage prompt asks
            the model to return exactly this word).
        description: One line describing what this specialist handles. It is
            injected verbatim into the triage prompt, so the router learns about
            new plug-ins automatically — no core edit required.
    """

    name: str = ""
    description: str = ""

    def handle(self, state: CoordinatorState) -> CoordinatorState:
        """Produce a partial state update (must set ``response``)."""
        raise NotImplementedError
