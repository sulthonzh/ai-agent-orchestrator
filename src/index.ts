/**
 * AI Agent Orchestrator - Zero-dependency orchestration platform for AI agents
 * 
 * A Kubernetes-inspired orchestration platform specifically for AI agents with:
 * - Agent lifecycle management
 * - Workflow coordination
 * - Intelligent load balancing
 * - Auto-scaling
 * - Health monitoring
 * - Resource optimization
 * 
 * @packageDocumentation
 */

import { Orchestrator } from './Orchestrator.js';
import { Agent } from './Agent.js';
import type {
  AgentConfig,
  AgentInstance,
  Workflow,
  WorkflowStep,
  WorkflowExecution,
  LoadBalancingConfig,
  ScalingConfig,
  OrchestratorConfig,
  HealthCheckResult,
  MetricsData,
  RequestOptions
} from './types.js';

export { Orchestrator } from './Orchestrator.js';
export { Agent } from './Agent.js';
export * from './types.js';

// Version
export const version = '1.0.0';

// Default configuration
export const defaultConfig = {
  loadBalancing: {
    strategy: 'round-robin' as const,
    healthCheckThreshold: 3,
    failoverTimeout: 5000
  },
  scaling: {
    minInstances: 1,
    maxInstances: 5,
    scaleUpThreshold: 0.8,
    scaleDownThreshold: 0.3,
    scaleUpCooldown: 30000,
    scaleDownCooldown: 60000,
    metrics: {
      requestRateThreshold: 10,
      errorRateThreshold: 0.1
    }
  },
  monitoring: {
    healthCheckInterval: 30000,
    metricsRetention: 3600000,
    alertThresholds: {
      errorRate: 0.1,
      responseTime: 5000,
      memoryUsage: 0.8
    }
  }
};

// Utility functions
export function createOrchestrator(config?: Partial<OrchestratorConfig>) {
  return new Orchestrator(config);
}

export function createAgent(config: AgentConfig) {
  return new Agent(config);
}

// Factory functions for common agent types
export function createClaudeAgent(id: string, name: string, options: {
  model?: string;
  apiKey?: string;
  maxConcurrent?: number;
  timeout?: number;
} = {}) {
  const config: AgentConfig = {
    id,
    name,
    type: 'claude',
    model: options.model || 'claude-3-sonnet',
    maxConcurrent: options.maxConcurrent || 5,
    timeout: options.timeout || 30000
  };

  if (options.apiKey !== undefined) {
    config.apiKey = options.apiKey;
  }

  return new Agent(config);
}

export function createOpenAIAgent(id: string, name: string, options: {
  model?: string;
  apiKey?: string;
  endpoint?: string;
  maxConcurrent?: number;
  timeout?: number;
} = {}) {
  const config: AgentConfig = {
    id,
    name,
    type: 'openai',
    model: options.model || 'gpt-3.5-turbo',
    maxConcurrent: options.maxConcurrent || 3,
    timeout: options.timeout || 25000
  };

  if (options.apiKey !== undefined) {
    config.apiKey = options.apiKey;
  }

  if (options.endpoint !== undefined) {
    config.endpoint = options.endpoint;
  }

  return new Agent(config);
}

export function createFunctionAgent(id: string, name: string, options: {
  maxConcurrent?: number;
  timeout?: number;
} = {}) {
  const config: AgentConfig = {
    id,
    name,
    type: 'function'
  };

  if (options.maxConcurrent !== undefined) {
    config.maxConcurrent = options.maxConcurrent;
  }

  if (options.timeout !== undefined) {
    config.timeout = options.timeout;
  }

  return new Agent(config);
}

// Predefined workflow templates
export function createContentCreationWorkflow(id: string, name: string, options: {
  ideas?: string;
  outline?: string;
  draft?: string;
  review?: string;
  input?: Record<string, unknown>;
} = {}) {
  const agents = {
    ideas: options.ideas || 'claude-demo',
    outline: options.outline || 'openai-demo', 
    draft: options.draft || 'claude-demo',
    review: options.review || 'openai-demo'
  };

  return {
    id,
    name,
    description: 'Multi-agent content creation workflow',
    steps: [
      {
        id: 'generate-ideas',
        name: 'Generate Ideas',
        agentId: agents.ideas,
        input: { ...options.input, task: 'generate ideas' }
      },
      {
        id: 'create-outline',
        name: 'Create Outline',
        agentId: agents.outline,
        input: { ideas: '${generate-ideas.response}' },
        dependencies: ['generate-ideas']
      },
      {
        id: 'write-draft',
        name: 'Write Draft',
        agentId: agents.draft,
        input: { outline: '${create-outline.response}', topic: '${input.topic}' },
        dependencies: ['create-outline']
      },
      {
        id: 'review-content',
        name: 'Review Content',
        agentId: agents.review,
        input: { draft: '${write-draft.response}' },
        dependencies: ['write-draft']
      }
    ]
  };
}

export function createDataAnalysisWorkflow(id: string, name: string, options: {
  data?: string;
  analysis?: string;
  visualization?: string;
  input?: Record<string, unknown>;
} = {}) {
  const agents = {
    data: options.data || 'claude-demo',
    analysis: options.analysis || 'openai-demo',
    visualization: options.visualization || 'claude-demo'
  };

  return {
    id,
    name,
    description: 'Multi-agent data analysis workflow',
    steps: [
      {
        id: 'clean-data',
        name: 'Clean Data',
        agentId: agents.data,
        input: { ...options.input, task: 'clean and validate data' }
      },
      {
        id: 'analyze-data',
        name: 'Analyze Data',
        agentId: agents.analysis,
        input: { data: '${clean-data.response}', analysisType: '${input.analysisType}' },
        dependencies: ['clean-data']
      },
      {
        id: 'create-visualization',
        name: 'Create Visualization',
        agentId: agents.visualization,
        input: { analysis: '${analyze-data.response}', visualizationType: '${input.visualizationType}' },
        dependencies: ['analyze-data']
      }
    ]
  };
}

export function createCodeReviewWorkflow(id: string, name: string, options: {
  review?: string;
  improvement?: string;
  documentation?: string;
  input?: Record<string, unknown>;
} = {}) {
  const agents = {
    review: options.review || 'claude-demo',
    improvement: options.improvement || 'openai-demo',
    documentation: options.documentation || 'claude-demo'
  };

  return {
    id,
    name,
    description: 'Multi-agent code review and improvement workflow',
    steps: [
      {
        id: 'initial-review',
        name: 'Initial Code Review',
        agentId: agents.review,
        input: { ...options.input, task: 'review code for quality and best practices' }
      },
      {
        id: 'suggest-improvements',
        name: 'Suggest Improvements',
        agentId: agents.improvement,
        input: { review: '${initial-review.response}', code: '${input.code}' },
        dependencies: ['initial-review']
      },
      {
        id: 'generate-documentation',
        name: 'Generate Documentation',
        agentId: agents.documentation,
        input: { code: '${input.code}', improvements: '${suggest-improvements.response}' },
        dependencies: ['suggest-improvements']
      }
    ]
  };
}