from typing import Any, Dict, List

from strands import tool


def get_routing_tools(router: Any) -> List[Any]:
    @tool
    def call_financial_agent(query: str) -> Dict[str, Any]:
        """Route a query to the Financial specialist runtime."""
        result = router.route_to_financial(query)
        return {"status": "success", "content": [{"text": result}]}

    @tool
    def call_healthcare_agent(query: str) -> Dict[str, Any]:
        """Route a query to the Healthcare specialist runtime."""
        result = router.route_to_healthcare(query)
        return {"status": "success", "content": [{"text": result}]}

    return [call_financial_agent, call_healthcare_agent]
