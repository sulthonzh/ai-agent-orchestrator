# AI Agent Orchestrator

![Zero Dependencies](https://img.shields.io/badge/dependencies-zero-blue.svg) ![TypeScript](https://img.shields.io/badge/typescript-blue.svg) ![Node.js](https://img.shields.io/badge/node-18+-green.svg)

Zero-dependency orchestration platform for AI agents with lifecycle management, workflow coordination, and intelligent load balancing.

## 🚀 Features

- **Multi-Agent Support**: Manage Claude, OpenAI, and custom function agents in a unified platform
- **Lifecycle Management**: Automatic agent scaling, health monitoring, and resource optimization
- **Workflow Coordination**: Create complex multi-agent workflows with dependency management
- **Intelligent Load Balancing**: Round-robin, priority-based, and custom load balancing strategies
- **Zero Dependencies**: Pure TypeScript with no external dependencies except Commander for CLI
- **Comprehensive CLI**: Command-line interface for agent management, workflow execution, and monitoring
- **Enterprise Ready**: Multi-tenant support, integration APIs, and enterprise features

## 🛠️ Installation

```bash
npm install ai-agent-orchestrator
```

Or globally:
```bash
npm install -g ai-agent-orchestrator
```

## 🎯 Quick Start

### Command Line Interface

```bash
# Add a Claude agent
aaor agent add --id claude1 --name "My Claude" --type claude --model claude-3-sonnet

# Add an OpenAI agent  
aaor agent add --id openai1 --name "My OpenAI" --type openai --model gpt-3.5-turbo

# Make a request
aaor request --agent-id claude1 --prompt "Explain quantum computing in simple terms"

# List all agents
aaor agent list

# Run a demo
aaor demo

# Interactive mode
aaor interactive
```

### Programmatic Usage

```typescript
import { Orchestrator, createClaudeAgent, createOpenAIAgent } from 'ai-agent-orchestrator';

// Create orchestrator
const orchestrator = new Orchestrator();

// Add agents
const claudeAgent = createClaudeAgent('claude-demo', 'Claude Assistant');
const openaiAgent = createOpenAIAgent('openai-demo', 'OpenAI Assistant');

orchestrator.addAgent(claudeAgent);
orchestrator.addAgent(openaiAgent);

// Make requests
const response = await orchestrator.requestToAgent('claude-demo', 'Hello, world!');
console.log(response);
```

## 🔧 Agent Types

### Claude Agents
```typescript
const claudeAgent = createClaudeAgent('claude1', 'Claude Assistant', {
  model: 'claude-3-sonnet',
  maxConcurrent: 5,
  timeout: 30000
});
```

### OpenAI Agents
```typescript
const openaiAgent = createOpenAIAgent('openai1', 'OpenAI Assistant', {
  model: 'gpt-3.5-turbo',
  maxConcurrent: 3,
  timeout: 25000
});
```

### Function Agents
```typescript
const functionAgent = createFunctionAgent('my-function', 'My Function', {
  maxConcurrent: 10,
  timeout: 5000
});
```

## 🔄 Workflows

### Content Creation Workflow
```typescript
const contentWorkflow = createContentCreationWorkflow('content-1', 'Blog Post Creation', {
  input: { topic: 'AI safety' },
  ideas: 'claude-demo',
  outline: 'openai-demo', 
  draft: 'claude-demo',
  review: 'openai-demo'
});

// Execute workflow
const result = await orchestrator.executeWorkflow(contentWorkflow);
```

### Data Analysis Workflow
```typescript
const analysisWorkflow = createDataAnalysisWorkflow('analysis-1', 'Data Science Pipeline', {
  input: { data: 'dataset.csv', analysisType: 'regression' },
  data: 'claude-demo',
  analysis: 'openai-demo',
  visualization: 'claude-demo'
});
```

### Code Review Workflow
```typescript
const codeWorkflow = createCodeReviewWorkflow('code-1', 'Code Quality Check', {
  input: { code: 'function test() { return "hello"; }' },
  review: 'claude-demo',
  improvement: 'openai-demo',
  documentation: 'claude-demo'
});
```

## 📊 Health Monitoring & Scaling

```typescript
// Perform health checks
const healthResults = await orchestrator.performHealthChecks();
console.log('Health status:', healthResults);

// Get agent statistics
const stats = orchestrator.getAgentStats();
console.log('Agent statistics:', stats);

// Auto-scaling (built-in)
// Automatically scales based on load thresholds
```

## 🎮 CLI Commands

### Agent Management
- `aaor agent add --id <id> --name <name> --type <type> [options]` - Add agent
- `aaor agent list` - List all agents
- `aaor agent remove --id <id>` - Remove agent

### Requests
- `aaor request --agent-id <id> --prompt <text>` - Make a request

### Workflows
- `aaor workflow create --name <name> --steps <json>` - Create workflow
- `aaor workflow list` - List workflows

### System
- `aaor health` - Perform health checks
- `aaor demo` - Run demonstration
- `aaor interactive` - Start interactive mode

## ⚡ Performance

- **Zero Dependencies**: No external dependencies except Commander for CLI
- **Memory Efficient**: Minimal overhead, optimized resource usage
- **Concurrent Processing**: Handles multiple agent requests simultaneously
- **Auto-Scaling**: Intelligent resource allocation based on demand

## 🔒 Security

- **Authentication**: Support for API key management
- **Request Validation**: Input sanitization and parameter validation
- **Rate Limiting**: Built-in rate limiting and circuit breakers
- **Error Handling**: Comprehensive error handling and logging

## 📈 Monitoring

- **Metrics Collection**: Track success rates, response times, and load
- **Health Checks**: Automated agent health monitoring
- **Alerting**: Configurable thresholds for performance alerts
- **Logging**: Comprehensive logging for debugging and auditing

## 🛡️ Enterprise Features

- **Multi-Tenant**: Support for multiple organizations/teams
- **Integration APIs**: REST API for external integrations
- **Custom Security Rules**: Extensible security policy framework
- **Analytics Dashboard**: Real-time monitoring and reporting

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📝 License

MIT License - see [LICENSE](LICENSE) for details.

## 🌟 Acknowledgments

- Inspired by Kubernetes container orchestration patterns
- Built for the growing ecosystem of AI agents and LLMs
- Designed to address the complexity of multi-agent coordination

## 📞 Support

- Issues: [GitHub Issues](https://github.com/sulthonzh/ai-agent-orchestrator/issues)
- Documentation: [GitHub Wiki](https://github.com/sulthonzh/ai-agent-orchestrator/wiki)
- Examples: [GitHub Examples](https://github.com/sulthonzh/ai-agent-orchestrator/tree/main/examples)