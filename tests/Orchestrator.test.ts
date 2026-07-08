import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Orchestrator } from '../src/Orchestrator.js';
import { Agent } from '../src/Agent.js';
import { AgentConfig, WorkflowStep, RequestOptions } from '../src/types.js';

describe('Orchestrator', () => {
  let orchestrator: Orchestrator;

  beforeEach(() => {
    orchestrator = new Orchestrator();
  });

  afterEach(async () => {
    // Clean up all agents
    await orchestrator.shutdown();
  });

  describe('constructor', () => {
    it('should create orchestrator with default config', () => {
      expect(orchestrator).toBeInstanceOf(Orchestrator);
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        loadBalancing: {
          strategy: 'least-connections' as const,
          healthCheckThreshold: 5
        },
        scaling: {
          minInstances: 2,
          maxInstances: 10,
          scaleUpThreshold: 0.9
        }
      };

      const customOrchestrator = new Orchestrator(customConfig);
      const stats = customOrchestrator.getAgentStats();
      
      expect(stats.length).toBe(0); // No agents by default
    });
  });

  describe('addAgent', () => {
    it('should add agent successfully', () => {
      const config: AgentConfig = {
        id: 'test-agent',
        name: 'Test Agent',
        type: 'claude',
        model: 'claude-3-sonnet'
      };

      const agent = orchestrator.addAgent(config);
      
      expect(agent).toBeInstanceOf(Agent);
      expect(agent.getId()).toBe('test-agent');
      
      const stats = orchestrator.getAgentStats();
      expect(stats.length).toBe(1);
      expect(stats[0].id).toBe('test-agent');
    });

    it('should throw error for duplicate agent id', () => {
      const config: AgentConfig = {
        id: 'duplicate-agent',
        name: 'Duplicate Agent',
        type: 'openai'
      };

      orchestrator.addAgent(config);
      
      expect(() => orchestrator.addAgent(config)).toThrow(
        'Agent with ID duplicate-agent already exists'
      );
    });

    it('should accept different agent types', () => {
      const agents = [
        { id: 'claude1', name: 'Claude 1', type: 'claude' },
        { id: 'openai1', name: 'OpenAI 1', type: 'openai' },
        { id: 'function1', name: 'Function 1', type: 'function' },
        { id: 'custom1', name: 'Custom 1', type: 'custom' }
      ];

      agents.forEach(config => {
        const agent = orchestrator.addAgent(config);
        expect(agent).toBeInstanceOf(Agent);
        expect(agent.getId()).toBe(config.id);
      });

      const stats = orchestrator.getAgentStats();
      expect(stats.length).toBe(4);
    });
  });

  describe('removeAgent', () => {
    beforeEach(() => {
      const config: AgentConfig = {
        id: 'remove-test',
        name: 'Remove Test',
        type: 'claude'
      };

      orchestrator.addAgent(config);
    });

    it('should remove agent successfully', async () => {
      await orchestrator.removeAgent('remove-test');
      
      const stats = orchestrator.getAgentStats();
      expect(stats.length).toBe(0);
    });

    it('should throw error for non-existent agent', async () => {
      await expect(orchestrator.removeAgent('non-existent')).rejects.toThrow(
        'Agent non-existent not found'
      );
    });
  });

  describe('requestToAgent', () => {
    beforeEach(async () => {
      const config: AgentConfig = {
        id: 'request-test',
        name: 'Request Test',
        type: 'claude'
      };

      const agent = orchestrator.addAgent(config);
      await agent.start();
    });

    it('should make request to specific agent', async () => {
      const response = await orchestrator.requestToAgent('request-test', 'Hello, world!');
      
      expect(typeof response).toBe('string');
      expect(response).toContain('Hello, world!');
    });

    it('should throw error for non-existent agent', async () => {
      await expect(
        orchestrator.requestToAgent('non-existent', 'test')
      ).rejects.toThrow('Agent non-existent not found');
    });
  });

  describe('request', () => {
    beforeEach(async () => {
      const configs = [
        { id: 'agent1', name: 'Agent 1', type: 'claude' },
        { id: 'agent2', name: 'Agent 2', type: 'openai' }
      ];

      for (const config of configs) {
        const agent = orchestrator.addAgent(config);
        await agent.start();
      }
    });

    it('should make request with load balancing', async () => {
      const response = await orchestrator.request('Test prompt');
      
      expect(typeof response).toBe('string');
      expect(response).toContain('Test prompt');
    });

    it('should handle request options', async () => {
      const response = await orchestrator.request('Test prompt', {
        timeout: 5000,
        retries: 2,
        priority: 1,
        metadata: { userId: '123' }
      });
      
      expect(typeof response).toBe('string');
    });

    it('should throw error when no healthy agents available', async () => {
      // Remove all agents
      const stats = orchestrator.getAgentStats();
      for (const agent of stats) {
        await orchestrator.removeAgent(agent.id);
      }

      await expect(orchestrator.request('test')).rejects.toThrow(
        'No healthy agents available'
      );
    });
  });

  describe('load balancing', () => {
    beforeEach(async () => {
      const configs = [
        { id: 'agent1', name: 'Agent 1', type: 'claude' },
        { id: 'agent2', name: 'Agent 2', type: 'claude' },
        { id: 'agent3', name: 'Agent 3', type: 'claude' }
      ];

      for (const config of configs) {
        const agent = orchestrator.addAgent(config);
        await agent.start();
      }
    });

    it('should use round-robin by default', async () => {
      const responses = [];
      for (let i = 0; i < 6; i++) {
        const response = await orchestrator.request('test');
        responses.push(response);
      }

      expect(responses.length).toBe(6);
      expect(responses.every(r => typeof r === 'string')).toBe(true);
    });

    it('should handle least-connections strategy', async () => {
      const customOrchestrator = new Orchestrator({
        loadBalancing: {
          strategy: 'least-connections'
        }
      });

      // Add agents with different loads
      const agent1 = customOrchestrator.addAgent({
        id: 'lc1', name: 'LC 1', type: 'claude'
      });
      const agent2 = customOrchestrator.addAgent({
        id: 'lc2', name: 'LC 2', type: 'claude'
      });

      await agent1.start();
      await agent2.start();

      // Simulate load on agent1
      (agent1 as any).instance.currentLoad = 5;
      (agent2 as any).instance.currentLoad = 1;

      const response = await customOrchestrator.request('test');
      expect(typeof response).toBe('string');
    });

    it('should handle weighted strategy', async () => {
      const customOrchestrator = new Orchestrator({
        loadBalancing: {
          strategy: 'weighted',
          weights: {
            'agent1': 3,
            'agent2': 1
          }
        }
      });

      const agent1 = customOrchestrator.addAgent({
        id: 'agent1', name: 'Agent 1', type: 'claude'
      });
      const agent2 = customOrchestrator.addAgent({
        id: 'agent2', name: 'Agent 2', type: 'claude'
      });

      await agent1.start();
      await agent2.start();

      const response = await customOrchestrator.request('test');
      expect(typeof response).toBe('string');
    });

    it('should handle random strategy', async () => {
      const customOrchestrator = new Orchestrator({
        loadBalancing: {
          strategy: 'random'
        }
      });

      const agent1 = customOrchestrator.addAgent({
        id: 'agent1', name: 'Agent 1', type: 'claude'
      });
      const agent2 = customOrchestrator.addAgent({
        id: 'agent2', name: 'Agent 2', type: 'claude'
      });

      await agent1.start();
      await agent2.start();

      const response = await customOrchestrator.request('test');
      expect(typeof response).toBe('string');
    });
  });

  describe('workflow management', () => {
    beforeEach(async () => {
      const agentConfig: AgentConfig = {
        id: 'workflow-agent',
        name: 'Workflow Agent',
        type: 'claude'
      };

      const agent = orchestrator.addAgent(agentConfig);
      await agent.start();
    });

    it('should create workflow', () => {
      const steps: WorkflowStep[] = [
        {
          id: 'step1',
          name: 'First Step',
          agentId: 'workflow-agent',
          input: { task: 'process' }
        },
        {
          id: 'step2',
          name: 'Second Step',
          agentId: 'workflow-agent',
          input: { data: '${step1.response}' },
          dependencies: ['step1']
        }
      ];

      const workflow = orchestrator.createWorkflow({
        name: 'Test Workflow',
        description: 'A test workflow',
        steps
      });

      expect(workflow.id).toMatch(/^workflow_/);
      expect(workflow.name).toBe('Test Workflow');
      expect(workflow.status).toBe('draft');
      expect(workflow.steps).toHaveLength(2);
      expect(workflow.createdAt).toBeInstanceOf(Date);
    });

    it('should update workflow', () => {
      const workflow = orchestrator.createWorkflow({
        name: 'Original Workflow',
        steps: []
      });

      const updated = orchestrator.updateWorkflow(workflow.id, {
        name: 'Updated Workflow',
        status: 'active'
      });

      expect(updated.name).toBe('Updated Workflow');
      expect(updated.status).toBe('active');
      expect(updated.updatedAt.getTime()).toBeGreaterThan(workflow.createdAt.getTime());
    });

    it('should delete workflow', () => {
      const workflow = orchestrator.createWorkflow({
        name: 'To Delete',
        steps: []
      });

      expect(orchestrator.getWorkflowStats().length).toBe(1);

      orchestrator.deleteWorkflow(workflow.id);
      
      expect(orchestrator.getWorkflowStats().length).toBe(0);
    });

    it('should throw error for non-existent workflow', () => {
      expect(() => orchestrator.updateWorkflow('non-existent', {})).toThrow(
        'Workflow non-existent not found'
      );
    });
  });

  describe('workflow execution', () => {
    beforeEach(async () => {
      const agentConfig: AgentConfig = {
        id: 'workflow-exec-agent',
        name: 'Workflow Execution Agent',
        type: 'claude'
      };

      const agent = orchestrator.addAgent(agentConfig);
      await agent.start();

      // Create a simple workflow
      orchestrator.createWorkflow({
        name: 'Simple Workflow',
        steps: [
          {
            id: 'step1',
            name: 'First Step',
            agentId: 'workflow-exec-agent',
            input: { message: 'Hello' }
          }
        ]
      });
    });

    it('should execute simple workflow', async () => {
      const workflows = orchestrator.getWorkflowStats();
      const workflow = workflows[0];

      // Activate workflow
      orchestrator.updateWorkflow(workflow.id, { status: 'active' });

      const result = await orchestrator.executeWorkflow(workflow.id, { initial: 'test' });
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
      expect(result.step1).toBeDefined();
    });

    it('should handle workflow with dependencies', async () => {
      orchestrator.deleteWorkflow('workflow_1'); // Remove existing workflow

      orchestrator.createWorkflow({
        name: 'Dependent Workflow',
        steps: [
          {
            id: 'first',
            name: 'First',
            agentId: 'workflow-exec-agent',
            input: { data: 'initial' }
          },
          {
            id: 'second',
            name: 'Second',
            agentId: 'workflow-exec-agent',
            input: { processed: '${first.response}' },
            dependencies: ['first']
          }
        ]
      });

      const workflows = orchestrator.getWorkflowStats();
      const workflow = workflows.find(w => w.name === 'Dependent Workflow')!;
      
      orchestrator.updateWorkflow(workflow.id, { status: 'active' });

      const result = await orchestrator.executeWorkflow(workflow.id);
      
      expect(result.first).toBeDefined();
      expect(result.second).toBeDefined();
    });

    it('should handle workflow conditions', async () => {
      orchestrator.deleteWorkflow('workflow_1');

      orchestrator.createWorkflow({
        name: 'Conditional Workflow',
        steps: [
          {
            id: 'always-run',
            name: 'Always Run',
            agentId: 'workflow-exec-agent',
            input: { message: 'test' }
          },
          {
            id: 'conditional',
            name: 'Conditional',
            agentId: 'workflow-exec-agent',
            input: { data: 'skip' },
            condition: 'false'
          }
        ]
      });

      const workflows = orchestrator.getWorkflowStats();
      const workflow = workflows.find(w => w.name === 'Conditional Workflow')!;
      
      orchestrator.updateWorkflow(workflow.id, { status: 'active' });

      const result = await orchestrator.executeWorkflow(workflow.id);
      
      expect(result['always-run']).toBeDefined();
      expect(result['conditional']).toBeDefined();
      expect((result['conditional'] as any).skipped).toBe(true);
    });

    it('should throw error for failed workflow step', async () => {
      orchestrator.deleteWorkflow('workflow_1');

      // Create workflow with failing step
      orchestrator.createWorkflow({
        name: 'Failing Workflow',
        steps: [
          {
            id: 'step1',
            name: 'First Step',
            agentId: 'workflow-exec-agent',
            input: { shouldFail: 'true' }
          }
        ]
      });

      const workflows = orchestrator.getWorkflowStats();
      const workflow = workflows.find(w => w.name === 'Failing Workflow')!;
      
      orchestrator.updateWorkflow(workflow.id, { status: 'active' });

      await expect(orchestrator.executeWorkflow(workflow.id)).rejects.toThrow();
    });

    it('should handle workflow timeouts', async () => {
      orchestrator.deleteWorkflow('workflow_1');

      orchestrator.createWorkflow({
        name: 'Timeout Workflow',
        steps: [
          {
            id: 'slow-step',
            name: 'Slow Step',
            agentId: 'workflow-exec-agent',
            input: { delay: '1000' },
            timeout: 500 // Shorter than actual delay
          }
        ],
        timeout: 1000
      });

      const workflows = orchestrator.getWorkflowStats();
      const workflow = workflows.find(w => w.name === 'Timeout Workflow')!;
      
      orchestrator.updateWorkflow(workflow.id, { status: 'active' });

      await expect(orchestrator.executeWorkflow(workflow.id)).rejects.toThrow();
    });
  });

  describe('health checks', () => {
    beforeEach(async () => {
      const configs = [
        { id: 'healthy1', name: 'Healthy 1', type: 'claude' },
        { id: 'healthy2', name: 'Healthy 2', type: 'openai' }
      ];

      for (const config of configs) {
        const agent = orchestrator.addAgent(config);
        await agent.start();
      }
    });

    it('should perform health checks on all agents', async () => {
      const results = await orchestrator.performHealthChecks();
      
      expect(results.length).toBe(2);
      expect(results.every(r => r.agentId && r.status && r.responseTime)).toBe(true);
      
      const healthyCount = results.filter(r => r.status === 'healthy').length;
      expect(healthyCount).toBe(2);
    });

    it('should handle unhealthy agents', async () => {
      // Add an agent that will fail health check
      const failingAgent = orchestrator.addAgent({
        id: 'failing',
        name: 'Failing Agent',
        type: 'claude'
      });

      // Mock the health check to fail
      vi.spyOn(failingAgent, 'performHealthCheck').mockResolvedValue({
        agentId: 'failing',
        status: 'unhealthy',
        responseTime: 1000,
        error: 'Connection failed',
        timestamp: new Date()
      });

      const results = await orchestrator.performHealthChecks();
      
      expect(results.length).toBe(3);
      const failingResult = results.find(r => r.agentId === 'failing');
      expect(failingResult?.status).toBe('unhealthy');
    });
  });

  describe('scaling and monitoring', () => {
    it('should provide agent statistics', () => {
      const config: AgentConfig = {
        id: 'stats-test',
        name: 'Stats Test',
        type: 'claude'
      };

      orchestrator.addAgent(config);
      
      const stats = orchestrator.getAgentStats();
      expect(stats.length).toBe(1);
      
      const agentStats = stats[0];
      expect(agentStats.id).toBe('stats-test');
      expect(agentStats.name).toBe('Stats Test');
      expect(agentStats.status).toBe('starting'); // Not started yet
      expect(agentStats.currentLoad).toBe(0);
      expect(agentStats.totalRequests).toBe(0);
    });

    it('should provide workflow statistics', () => {
      orchestrator.createWorkflow({
        name: 'Stats Workflow',
        steps: []
      });

      const stats = orchestrator.getWorkflowStats();
      expect(stats.length).toBe(1);
      
      const workflowStats = stats[0];
      expect(workflowStats.name).toBe('Stats Workflow');
      expect(workflowStats.status).toBe('draft');
      expect(workflowStats.steps).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should handle agent failures gracefully', async () => {
      const agent = orchestrator.addAgent({
        id: 'failing-agent',
        name: 'Failing Agent',
        type: 'claude'
      });

      // Stop the agent to simulate failure
      await agent.stop();

      await expect(
        orchestrator.requestToAgent('failing-agent', 'test')
      ).rejects.toThrow('Agent failing-agent is not healthy');
    });

    it('should handle missing dependencies in workflow', async () => {
      orchestrator.createWorkflow({
        name: 'Broken Workflow',
        steps: [
          {
            id: 'step1',
            name: 'Step 1',
            agentId: 'non-existent-agent',
            input: { test: 'data' }
          }
        ]
      });

      const workflows = orchestrator.getWorkflowStats();
      const workflow = workflows[0];
      
      orchestrator.updateWorkflow(workflow.id, { status: 'active' });

      await expect(orchestrator.executeWorkflow(workflow.id)).rejects.toThrow(
        'Agent non-existent-agent not found'
      );
    });
  });

  describe('edge cases', () => {
    it('should handle empty orchestrator', () => {
      const emptyOrchestrator = new Orchestrator();
      
      expect(emptyOrchestrator.getAgentStats().length).toBe(0);
      expect(emptyOrchestrator.getWorkflowStats().length).toBe(0);
    });

    it('should handle large number of agents', async () => {
      const agentCount = 10;
      const agents = [];

      for (let i = 0; i < agentCount; i++) {
        const config: AgentConfig = {
          id: `agent-${i}`,
          name: `Agent ${i}`,
          type: 'claude'
        };

        const agent = orchestrator.addAgent(config);
        await agent.start();
        agents.push(agent);
      }

      expect(orchestrator.getAgentStats().length).toBe(agentCount);

      // Test concurrent requests
      const requests = Array.from({ length: agentCount }, () =>
        orchestrator.request(`Test ${Date.now()}`)
      );

      const results = await Promise.all(requests);
      expect(results.length).toBe(agentCount);
    });

    it('should handle complex workflows', async () => {
      const agent = orchestrator.addAgent({
        id: 'complex-agent',
        name: 'Complex Agent',
        type: 'claude'
      });

      await agent.start();

      // Create a complex workflow with multiple steps and conditions
      orchestrator.createWorkflow({
        name: 'Complex Workflow',
        steps: [
          {
            id: 'init',
            name: 'Initialize',
            agentId: 'complex-agent',
            input: { task: 'init' }
          },
          {
            id: 'process',
            name: 'Process',
            agentId: 'complex-agent',
            input: { data: '${init.response}' },
            dependencies: ['init']
          },
          {
            id: 'validate',
            name: 'Validate',
            agentId: 'complex-agent',
            input: { result: '${process.response}' },
            dependencies: ['process']
          },
          {
            id: 'conditional-step',
            name: 'Conditional',
            agentId: 'complex-agent',
            input: { condition: '${validate.response}' },
            dependencies: ['validate'],
            condition: '${validate.response} === "valid"'
          }
        ]
      });

      const workflows = orchestrator.getWorkflowStats();
      const workflow = workflows[0];
      
      orchestrator.updateWorkflow(workflow.id, { status: 'active' });

      const result = await orchestrator.executeWorkflow(workflow.id);
      
      expect(result.init).toBeDefined();
      expect(result.process).toBeDefined();
      expect(result.validate).toBeDefined();
      expect(result['conditional-step']).toBeDefined();
    });
  });
});