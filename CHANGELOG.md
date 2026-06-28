# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-06-18

### Added
- Multi-agent orchestration platform with lifecycle management (start, stop, health checks)
- Workflow engine with step dependencies, conditions, and parallel execution
- Load balancing strategies: round-robin, least-connections, weighted, random
- Auto-scaling configuration with CPU, memory, request rate, and error rate thresholds
- Health monitoring with configurable intervals and alert thresholds
- Agent types: Claude, OpenAI, Anthropic, custom function agents
- Factory functions: `createOrchestrator`, `createAgent`, `createClaudeAgent`, `createOpenAIAgent`, `createFunctionAgent`
- Workflow templates: content creation, data analysis, code review
- Metrics collection with 1-hour retention window
- Request retry with exponential backoff and configurable timeouts
- TypeScript-first API with full type definitions and runtime Symbol markers
- CLI interface (`ai-agent-orchestrator` / `aaor`)
- Comprehensive test suite (69 tests across 3 files)

### Technical
- Zero runtime dependencies (devDependencies only: TypeScript, Vitest, tsup, ESLint)
- ESM modules (`"type": "module"`)
- Node.js >= 18.0.0 required
