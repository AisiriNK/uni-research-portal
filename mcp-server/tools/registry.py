"""
Tool Registry - Central registration for all MCP tools
Handles metadata, validation, and tool discovery
"""
import logging
from typing import Dict, Callable, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class Tool:
    """Tool metadata"""
    name: str
    description: str
    function: Callable
    category: str = "general"
    enabled: bool = True
    rate_limit: Optional[int] = None  # calls per minute
    metrics: Dict[str, Any] = field(default_factory=lambda: {
        "total_calls": 0,
        "success_count": 0,
        "error_count": 0,
        "total_duration_ms": 0,
        "last_called_at": None
    })


class ToolRegistry:
    """Central registry for all MCP tools"""
    
    def __init__(self):
        self._tools: Dict[str, Tool] = {}
    
    def register(
        self,
        name: str,
        description: str,
        category: str = "general",
        rate_limit: Optional[int] = None
    ):
        """Decorator to register a tool"""
        def decorator(func: Callable):
            tool = Tool(
                name=name,
                description=description,
                function=func,
                category=category,
                rate_limit=rate_limit
            )
            self._tools[name] = tool
            logger.info(f"✅ Registered tool: {name} ({category})")
            return func
        
        return decorator
    
    def get_tool(self, name: str) -> Optional[Tool]:
        """Get tool by name"""
        return self._tools.get(name)
    
    def list_tools(self, category: Optional[str] = None) -> Dict[str, Tool]:
        """List all tools or filter by category"""
        if category:
            return {
                name: tool for name, tool in self._tools.items()
                if tool.category == category
            }
        return self._tools.copy()
    
    async def execute(
        self,
        tool_name: str,
        *args,
        **kwargs
    ) -> Any:
        """Execute a tool with metrics tracking"""
        tool = self.get_tool(tool_name)
        if not tool:
            raise ValueError(f"Tool not found: {tool_name}")
        
        if not tool.enabled:
            raise ValueError(f"Tool disabled: {tool_name}")
        
        # Update metrics
        tool.metrics["total_calls"] += 1
        tool.metrics["last_called_at"] = datetime.now().isoformat()
        
        start_time = datetime.now()
        
        try:
            # Execute tool
            result = await tool.function(*args, **kwargs)
            
            # Update success metrics
            tool.metrics["success_count"] += 1
            duration_ms = (datetime.now() - start_time).total_seconds() * 1000
            tool.metrics["total_duration_ms"] += duration_ms
            
            logger.debug(f"✅ Tool {tool_name} executed in {duration_ms:.2f}ms")
            return result
            
        except Exception as e:
            # Update error metrics
            tool.metrics["error_count"] += 1
            logger.error(f"❌ Tool {tool_name} failed: {e}")
            raise
    
    def get_metrics(self, tool_name: Optional[str] = None) -> Dict:
        """Get metrics for one or all tools"""
        if tool_name:
            tool = self.get_tool(tool_name)
            if tool:
                avg_duration = (
                    tool.metrics["total_duration_ms"] / tool.metrics["success_count"]
                    if tool.metrics["success_count"] > 0 else 0
                )
                return {
                    **tool.metrics,
                    "avg_duration_ms": round(avg_duration, 2),
                    "success_rate": (
                        tool.metrics["success_count"] / tool.metrics["total_calls"]
                        if tool.metrics["total_calls"] > 0 else 0
                    )
                }
            return {}
        
        # Return all metrics
        return {
            name: {
                **tool.metrics,
                "avg_duration_ms": (
                    tool.metrics["total_duration_ms"] / tool.metrics["success_count"]
                    if tool.metrics["success_count"] > 0 else 0
                ),
                "success_rate": (
                    tool.metrics["success_count"] / tool.metrics["total_calls"]
                    if tool.metrics["total_calls"] > 0 else 0
                )
            }
            for name, tool in self._tools.items()
        }


# Global registry
tool_registry = ToolRegistry()
