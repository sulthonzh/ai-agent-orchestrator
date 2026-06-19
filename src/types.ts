// Types and interfaces for AI Agent Orchestrator

export interface AgentConfig {
  id: string;
  name: string;
  type: 'claude' | 'openai' | 'anthropic' | 'custom' | 'function';
  model?: string;
  endpoint?: string;
  apiKey?: string;
  maxConcurrent?: number;
  timeout?: number;
  retryCount?: number;
  healthCheckInterval?: number;
  environment?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface AgentInstance {
  id: string;
  name: string;
  type: string;
  config: AgentConfig;
  status: 'healthy' | 'unhealthy' | 'starting' | 'stopping' | 'stopped';
  currentLoad: number;
  totalRequests: number;
  successRate: number;
  averageResponseTime: number;
  lastHealthCheck: Date;
  startedAt: Date;
  lastUsed: Date;
  errorCount: number;
  consecutiveFailures: number;
}

export interface WorkflowStep {
  id: string;
  name: string;
  agentId: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  dependencies?: string[];
  timeout?: number;
  retry?: number;
  condition?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  timeout?: number;
  maxRetries?: number;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  executions: WorkflowExecution[];
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  results: Record<string, unknown>;
  errors: string[];
  progress: number;
}

export interface LoadBalancingConfig {
  strategy: 'round-robin' | 'least-connections' | 'weighted' | 'random';
  weights?: Record<string, number>;
  healthCheckThreshold?: number;
  failoverTimeout?: number;
}

export interface ScalingConfig {
  minInstances: number;
  maxInstances: number;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  scaleUpCooldown: number;
  scaleDownCooldown: number;
  metrics: {
    cpuThreshold?: number;
    memoryThreshold?: number;
    requestRateThreshold?: number;
    errorRateThreshold?: number;
  };
}

export interface OrchestratorConfig {
  agents: AgentConfig[];
  workflows: Workflow[];
  loadBalancing: LoadBalancingConfig;
  scaling: ScalingConfig;
  monitoring: {
    healthCheckInterval: number;
    metricsRetention: number;
    alertThresholds: {
      errorRate: number;
      responseTime: number;
      memoryUsage: number;
    };
  };
}

export interface HealthCheckResult {
  agentId: string;
  status: 'healthy' | 'unhealthy';
  responseTime: number;
  error?: string;
  timestamp: Date;
}

export interface MetricsData {
  agentId: string;
  timestamp: Date;
  requests: number;
  errors: number;
  averageResponseTime: number;
  memoryUsage: number;
  cpuUsage?: number;
  throughput: number;
}

export interface RequestOptions {
  timeout?: number;
  retries?: number;
  priority?: number;
  metadata?: Record<string, unknown>;
}

// Runtime markers for type checking (enables require() introspection)
export const AgentConfig = Symbol('AgentConfig');
export const AgentInstance = Symbol('AgentInstance');
export const Workflow = Symbol('Workflow');
export const WorkflowStep = Symbol('WorkflowStep');
export const WorkflowExecution = Symbol('WorkflowExecution');
export const LoadBalancingConfig = Symbol('LoadBalancingConfig');
export const ScalingConfig = Symbol('ScalingConfig');
export const OrchestratorConfig = Symbol('OrchestratorConfig');
export const HealthCheckResult = Symbol('HealthCheckResult');
export const MetricsData = Symbol('MetricsData');
export const RequestOptions = Symbol('RequestOptions');