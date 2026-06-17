import { describe, it, expect } from 'vitest';
import { 
  Orchestrator, 
  Agent, 
  createOrchestrator, 
  createAgent,
  createClaudeAgent,
  createOpenAIAgent,
  createFunctionAgent,
  createContentCreationWorkflow,
  createDataAnalysisWorkflow,
  createCodeReviewWorkflow,
  version 
} from '../src/index.js';
import { AgentConfig } from '../src/types.js';

describe('Index Exports', () => {
  it('should export version correctly', () => {
    expect(version).toBe('1.0.0');
  });

  it('should export createOrchestrator function', () => {
    const orchestrator = createOrchestrator();
    expect(orchestrator).toBeInstanceOf(Orchestrator);
  });

  it('should export createAgent function', () => {
    const config: AgentConfig = {
      id: 'test-agent',
      name: 'Test Agent',
      type: 'claude'
    };

    const agent = createAgent(config);
    expect(agent).toBeInstanceOf(Agent);
    expect(agent.getId()).toBe('test-agent');
  });

  it('should export factory functions for agent types', () => {
    const claudeAgent = createClaudeAgent('claude1', 'Claude 1');
    expect(claudeAgent).toBeInstanceOf(Agent);
    expect(claudeAgent.getId()).toBe('claude1');
    expect(claudeAgent.getConfig().type).toBe('claude');

    const openaiAgent = createOpenAIAgent('openai1', 'OpenAI 1');
    expect(openaiAgent).toBeInstanceOf(Agent);
    expect(openaiAgent.getId()).toBe('openai1');
    expect(openaiAgent.getConfig().type).toBe('openai');

    const functionAgent = createFunctionAgent('function1', 'Function 1');
    expect(functionAgent).toBeInstanceOf(Agent);
    expect(functionAgent.getId()).toBe('function1');
    expect(functionAgent.getConfig().type).toBe('function');
  });

  it('should handle optional parameters in factory functions', () => {
    const claudeAgent = createClaudeAgent('claude2', 'Claude 2', {
      model: 'claude-3-opus',
      maxConcurrent: 10
    });

    expect(claudeAgent.getConfig().model).toBe('claude-3-opus');
    expect(claudeAgent.getConfig().maxConcurrent).toBe(10);

    const openaiAgent = createOpenAIAgent('openai2', 'OpenAI 2', {
      model: 'gpt-4',
      timeout: 60000
    });

    expect(openaiAgent.getConfig().model).toBe('gpt-4');
    expect(openaiAgent.getConfig().timeout).toBe(60000);
  });

  it('should export workflow template functions', () => {
    const contentWorkflow = createContentCreationWorkflow('content1', 'Content Creation');
    expect(contentWorkflow.name).toBe('Content Creation');
    expect(contentWorkflow.steps).toHaveLength(4);
    expect(contentWorkflow.steps[0].id).toBe('generate-ideas');

    const dataWorkflow = createDataAnalysisWorkflow('data1', 'Data Analysis');
    expect(dataWorkflow.name).toBe('Data Analysis');
    expect(dataWorkflow.steps).toHaveLength(3);
    expect(dataWorkflow.steps[0].id).toBe('clean-data');

    const codeWorkflow = createCodeReviewWorkflow('code1', 'Code Review');
    expect(codeWorkflow.name).toBe('Code Review');
    expect(codeWorkflow.steps).toHaveLength(3);
    expect(codeWorkflow.steps[0].id).toBe('initial-review');
  });

  it('should handle custom agents in workflow templates', () => {
    const workflow = createContentCreationWorkflow('custom1', 'Custom Content', {
      agents: {
        ideas: 'my-claude',
        outline: 'my-openai'
      }
    });

    expect(workflow.steps[0].agentId).toBe('my-claude');
    expect(workflow.steps[1].agentId).toBe('my-openai');
  });

  it('should handle custom input in workflow templates', () => {
    const workflow = createContentCreationWorkflow('input1', 'Custom Input', {
      input: { topic: 'AI Development', audience: 'developers' }
    });

    expect(workflow.steps[0].input).toEqual(
      expect.objectContaining({
        task: 'generate ideas',
        topic: 'AI Development',
        audience: 'developers'
      })
    );
  });

  it('should export all types', () => {
    // Import all types to ensure they're available
    const {
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
    } = require('../src/types.js');

    expect(AgentConfig).toBeDefined();
    expect(AgentInstance).toBeDefined();
    expect(Workflow).toBeDefined();
    expect(WorkflowStep).toBeDefined();
    expect(WorkflowExecution).toBeDefined();
    expect(LoadBalancingConfig).toBeDefined();
    expect(ScalingConfig).toBeDefined();
    expect(OrchestratorConfig).toBeDefined();
    expect(HealthCheckResult).toBeDefined();
    expect(MetricsData).toBeDefined();
    expect(RequestOptions).toBeDefined();
  });
});