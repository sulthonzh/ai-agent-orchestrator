import { Orchestrator } from './Orchestrator.js';
export { Orchestrator } from './Orchestrator.js';
import { Agent } from './Agent.js';
export { Agent } from './Agent.js';
export * from './types.js';

const version = "1.0.0";
const defaultConfig = {
  loadBalancing: {
    strategy: "round-robin",
    healthCheckThreshold: 3,
    failoverTimeout: 5e3
  },
  scaling: {
    minInstances: 1,
    maxInstances: 5,
    scaleUpThreshold: 0.8,
    scaleDownThreshold: 0.3,
    scaleUpCooldown: 3e4,
    scaleDownCooldown: 6e4,
    metrics: {
      requestRateThreshold: 10,
      errorRateThreshold: 0.1
    }
  },
  monitoring: {
    healthCheckInterval: 3e4,
    metricsRetention: 36e5,
    alertThresholds: {
      errorRate: 0.1,
      responseTime: 5e3,
      memoryUsage: 0.8
    }
  }
};
function createOrchestrator(config) {
  return new Orchestrator(config);
}
function createAgent(config) {
  return new Agent(config);
}
function createClaudeAgent(id, name, options = {}) {
  const config = {
    id,
    name,
    type: "claude",
    model: options.model || "claude-3-sonnet",
    maxConcurrent: options.maxConcurrent || 5,
    timeout: options.timeout || 3e4
  };
  if (options.apiKey !== void 0) {
    config.apiKey = options.apiKey;
  }
  return new Agent(config);
}
function createOpenAIAgent(id, name, options = {}) {
  const config = {
    id,
    name,
    type: "openai",
    model: options.model || "gpt-3.5-turbo",
    maxConcurrent: options.maxConcurrent || 3,
    timeout: options.timeout || 25e3
  };
  if (options.apiKey !== void 0) {
    config.apiKey = options.apiKey;
  }
  if (options.endpoint !== void 0) {
    config.endpoint = options.endpoint;
  }
  return new Agent(config);
}
function createFunctionAgent(id, name, options = {}) {
  const config = {
    id,
    name,
    type: "function"
  };
  if (options.maxConcurrent !== void 0) {
    config.maxConcurrent = options.maxConcurrent;
  }
  if (options.timeout !== void 0) {
    config.timeout = options.timeout;
  }
  return new Agent(config);
}
function createContentCreationWorkflow(id, name, options = {}) {
  const agents = {
    ideas: options.ideas || "claude-demo",
    outline: options.outline || "openai-demo",
    draft: options.draft || "claude-demo",
    review: options.review || "openai-demo"
  };
  return {
    id,
    name,
    description: "Multi-agent content creation workflow",
    steps: [
      {
        id: "generate-ideas",
        name: "Generate Ideas",
        agentId: agents.ideas,
        input: { ...options.input, task: "generate ideas" }
      },
      {
        id: "create-outline",
        name: "Create Outline",
        agentId: agents.outline,
        input: { ideas: "${generate-ideas.response}" },
        dependencies: ["generate-ideas"]
      },
      {
        id: "write-draft",
        name: "Write Draft",
        agentId: agents.draft,
        input: { outline: "${create-outline.response}", topic: "${input.topic}" },
        dependencies: ["create-outline"]
      },
      {
        id: "review-content",
        name: "Review Content",
        agentId: agents.review,
        input: { draft: "${write-draft.response}" },
        dependencies: ["write-draft"]
      }
    ]
  };
}
function createDataAnalysisWorkflow(id, name, options = {}) {
  const agents = {
    data: options.data || "claude-demo",
    analysis: options.analysis || "openai-demo",
    visualization: options.visualization || "claude-demo"
  };
  return {
    id,
    name,
    description: "Multi-agent data analysis workflow",
    steps: [
      {
        id: "clean-data",
        name: "Clean Data",
        agentId: agents.data,
        input: { ...options.input, task: "clean and validate data" }
      },
      {
        id: "analyze-data",
        name: "Analyze Data",
        agentId: agents.analysis,
        input: { data: "${clean-data.response}", analysisType: "${input.analysisType}" },
        dependencies: ["clean-data"]
      },
      {
        id: "create-visualization",
        name: "Create Visualization",
        agentId: agents.visualization,
        input: { analysis: "${analyze-data.response}", visualizationType: "${input.visualizationType}" },
        dependencies: ["analyze-data"]
      }
    ]
  };
}
function createCodeReviewWorkflow(id, name, options = {}) {
  const agents = {
    review: options.review || "claude-demo",
    improvement: options.improvement || "openai-demo",
    documentation: options.documentation || "claude-demo"
  };
  return {
    id,
    name,
    description: "Multi-agent code review and improvement workflow",
    steps: [
      {
        id: "initial-review",
        name: "Initial Code Review",
        agentId: agents.review,
        input: { ...options.input, task: "review code for quality and best practices" }
      },
      {
        id: "suggest-improvements",
        name: "Suggest Improvements",
        agentId: agents.improvement,
        input: { review: "${initial-review.response}", code: "${input.code}" },
        dependencies: ["initial-review"]
      },
      {
        id: "generate-documentation",
        name: "Generate Documentation",
        agentId: agents.documentation,
        input: { code: "${input.code}", improvements: "${suggest-improvements.response}" },
        dependencies: ["suggest-improvements"]
      }
    ]
  };
}

export { createAgent, createClaudeAgent, createCodeReviewWorkflow, createContentCreationWorkflow, createDataAnalysisWorkflow, createFunctionAgent, createOpenAIAgent, createOrchestrator, defaultConfig, version };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map