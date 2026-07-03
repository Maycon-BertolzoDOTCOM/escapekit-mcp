"""EscapeKit Omnibus v2.0 - Autonomous R&D Pipeline with MCP, Swarms, Memory."""

__version__ = "2.0.0"


def start_mcp_server(host="localhost", port=3001):
    """Start the MCP server standalone."""
    from .escapekit_omnibus_v2 import MCPServer

    server = MCPServer(host=host, port=port)
    server.run()
