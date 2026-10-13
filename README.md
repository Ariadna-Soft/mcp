# @smallmetrics/mcp-client

[![npm version](https://img.shields.io/npm/v/@smallmetrics/mcp-client.svg)](https://www.npmjs.com/package/@smallmetrics/mcp-client)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![CI Status](https://github.com/Ariadna-Soft/mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ariadna-Soft/mcp/actions)

Official [Model Context Protocol (MCP)](https://modelcontextprotocol.io) client proxy for **[SmallMetrics](https://smallmetrics.ai)**.

It bridges desktop AI assistants and IDEs (such as **Claude Desktop**, **Cursor**, **Antigravity IDE**, and **VS Code**) communicating via standard input/output (**Stdio**) with the remote SmallMetrics API server via **Server-Sent Events (SSE)**.

---

## Architecture Overview

```
+-------------------------------------------------------+
|  AI Assistant / IDE (Claude Desktop, Cursor, etc.)    |
+-------------------------------------------------------+
                           |
                     Stdio (JSON-RPC)
                           |
                           v
+-------------------------------------------------------+
|        @smallmetrics/mcp-client (Local Proxy)         |
|  - Standard I/O to SSE bridge                         |
|  - Authorization header injection                     |
|  - Graceful connection & signal management            |
+-------------------------------------------------------+
                           |
                      HTTPS / SSE
                           |
                           v
+-------------------------------------------------------+
|           SmallMetrics Backend (Django MCP)           |
|  - User Data (Notes, Tasks, Money, Goals, Profile)    |
|  - Scope & Permission Enforcement (Read / Write)      |
+-------------------------------------------------------+
```

---

## Quick Start (Zero Install)

Run the client on demand using `npx`:

```bash
AUTHORIZATION="Bearer YOUR_PAT_TOKEN" npx -y @smallmetrics/mcp-client https://api.smallmetrics.ai/api/v1/mcp/sse
```

> **Note:** Replace `YOUR_PAT_TOKEN` with your SmallMetrics personal access token, and use `https://local-api.smallmetrics.ai/api/v1/mcp/sse` if developing against a local backend.

---

## Client Configurations

### 1. Claude Desktop

Add the `smallmetrics` server definition to your Claude Desktop configuration file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "smallmetrics": {
      "command": "npx",
      "args": [
        "-y",
        "@smallmetrics/mcp-client",
        "https://api.smallmetrics.ai/api/v1/mcp/sse"
      ],
      "env": {
        "AUTHORIZATION": "Bearer YOUR_PAT_TOKEN"
      }
    }
  }
}
```

---

### 2. Cursor IDE

In your project root, create or edit `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "smallmetrics": {
      "command": "npx",
      "args": [
        "-y",
        "@smallmetrics/mcp-client",
        "https://api.smallmetrics.ai/api/v1/mcp/sse"
      ],
      "env": {
        "AUTHORIZATION": "Bearer YOUR_PAT_TOKEN"
      }
    }
  }
}
```

Or configure via **Cursor Settings** -> **Features** -> **MCP Servers** -> **Add New MCP Server**:
- **Name:** `smallmetrics`
- **Type:** `command`
- **Command:** `npx -y @smallmetrics/mcp-client https://api.smallmetrics.ai/api/v1/mcp/sse`

---

### 3. Antigravity IDE / VS Code

In `~/.gemini/config/mcp_config.json` (or your IDE's MCP config):

```json
{
  "mcpServers": {
    "smallmetrics": {
      "command": "npx",
      "args": [
        "-y",
        "@smallmetrics/mcp-client",
        "https://api.smallmetrics.ai/api/v1/mcp/sse"
      ],
      "env": {
        "AUTHORIZATION": "Bearer YOUR_PAT_TOKEN"
      }
    }
  }
}
```

---

## Global Installation (Alternative)

You can also install the package globally via npm:

```bash
npm install -g @smallmetrics/mcp-client
```

Once installed, invoke it directly:

```bash
AUTHORIZATION="Bearer YOUR_PAT_TOKEN" smallmetrics-mcp https://api.smallmetrics.ai/api/v1/mcp/sse
```

---

## CLI Options

| Flag | Short | Description |
|---|---|---|
| `--help` | `-h` | Display usage information and available options |
| `--version` | `-v` | Display the installed package version |

---

## Environment Variables

| Variable | Required | Description | Example |
|---|---|---|---|
| `AUTHORIZATION` | **Yes** | Bearer authentication token for SmallMetrics | `Bearer SM-pat_...` |
| `DEBUG` | No | Enables verbose logging output | `true` or `1` |

---

## Development & Contributing

### Requirements
- Node.js `>= 18.0.0`
- npm `>= 9.0.0`

### Setup & Build
```bash
# Clone the repository
git clone https://github.com/Ariadna-Soft/mcp.git
cd mcp

# Install dependencies
npm install

# Compile TypeScript
npm run build

# Run unit tests
npm test
```

---

## License

This project is licensed under the [MIT License](LICENSE). Copyright (c) 2026 SmallMetrics.
