// Runtime shim for require('../src/types.js')
// TypeScript interfaces are compile-time only; this provides runtime symbols
'use strict';

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

// Support CommonJS require() interop
export default {
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
};
