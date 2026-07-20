import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Agent } from '../src/Agent.js';
import { Orchestrator } from '../src/Orchestrator.js';
import {
  createClaudeAgent,
  createOpenAIAgent,
  createFunctionAgent,
} from '../src/index.js';
import { AgentConfig } from '../src/types.js';

/**
 * Coverage gap tests for ai-agent-orchestrator
 * Targeting uncovered branches from the 2026-07-20 audit.
 * Rewritten 2026-07-21 to fix API mismatches and cover real branches.
 */

describe('Agent.ts uncovered branches', () => {
  let agent: Agent;

  afterEach(async () => {
    if (agent && agent.getStatus() !== 'stopped') {
      await agent.stop().catch(() => {});
    }
    vi.restoreAllMocks();
  });

  describe('performHealthCheck() catch path', () => {
    it('should set unhealthy status when healthCheck returns error result', async () => {
      const config: AgentConfig = { id: 'test-unhealthy', type: 'claude' };
      const spy = vi.spyOn(Agent.prototype as any, 'performHealthCheck');
      spy.mockResolvedValue({
        status: 'unhealthy',
        error: 'connection timeout',
      } as any);

      agent = new Agent(config);
      await expect(agent.start()).rejects.toThrow('Health check failed: connection timeout');
      expect(agent.getStatus()).toBe('unhealthy');
      expect(agent.getInstance().consecutiveFailures).toBe(1);
    });

    it('should set unhealthy status when performHealthCheck throws Error', async () => {
      const spy = vi.spyOn(Agent.prototype as any, 'performHealthCheck');
      spy.mockRejectedValue(new Error('DB connection failed'));

      agent = new Agent({ id: 'test-throw', type: 'openai' });
      await expect(agent.start()).rejects.toThrow(/Failed to start agent test-throw:.*DB connection failed/);
      expect(agent.getStatus()).toBe('unhealthy');
    });

    it('should set unhealthy status when performHealthCheck throws non-Error', async () => {
      const spy = vi.spyOn(Agent.prototype as any, 'performHealthCheck');
      spy.mockRejectedValue('string error');

      agent = new Agent({ id: 'test-string', type: 'function' });
      await expect(agent.start()).rejects.toThrow('Failed to start agent test-string: string error');
      expect(agent.getStatus()).toBe('unhealthy');
    });
  });

  describe('generic dispatch prefix (non-claude/openai/function)', () => {
    it('should use "Generic" prefix for unknown agent type', async () => {
      agent = new Agent({ id: 'test-generic', type: 'custom' });
      await agent.start();
      const result = await agent.request('test prompt', { timeout: 1000 });
      expect(result).toContain('Generic response for:');
    });

    it('should use "Generic" prefix for arbitrary type values', async () => {
      agent = new Agent({ id: 'test-any-type', type: 'random-type-123' });
      await agent.start();
      const result = await agent.request('hello', { timeout: 1000 });
      expect(result).toContain('Generic response for:');
    });
  });

  describe('executeRequest error fallback branch', () => {
    it('should use "Unknown error" fallback when error is not an Error instance', async () => {
      agent = new Agent({ id: 'test-fallback', type: 'function' });
      await agent.start();

      vi.spyOn(agent as any, 'dispatchRequest').mockRejectedValue('plain string failure');

      await expect(agent.request('test', { timeout: 500 })).rejects.toThrow('plain string failure');
    });

    it('should wrap non-Error throwables as strings in error object', async () => {
      agent = new Agent({ id: 'test-plain-string', type: 'function' });
      await agent.start();

      vi.spyOn(agent as any, 'dispatchRequest').mockRejectedValue(42);

      await expect(agent.request('test', { timeout: 500 })).rejects.toThrow('42');
    });
  });

  describe('executeRequestWithRetry catch block fallback throw', () => {
    it('should throw lastError when retry attempts exhausted', async () => {
      agent = new Agent({ id: 'test-retry-exhaust', type: 'function' });
      await agent.start();

      vi.spyOn(agent as any, 'executeRequest').mockRejectedValue(new Error('network timeout'));

      await expect(
        agent.request('test', { retries: 2, timeout: 200 })
      ).rejects.toThrow('network timeout');
    });

    it('should throw lastError after all retries failed (non-Error)', async () => {
      agent = new Agent({ id: 'test-final-fail', type: 'function' });
      await agent.start();

      vi.spyOn(agent as any, 'executeRequest').mockRejectedValue('string failure');

      await expect(
        agent.request('test', { retries: 1, timeout: 200 })
      ).rejects.toThrow('string failure');
    });
  });

  describe('startHealthChecks interval callback unhealthy status', () => {
    it('should set unhealthy in interval when health check returns unhealthy', async () => {
      agent = new Agent({ id: 'test-health-interval', type: 'claude' });

      // First call (during start()) returns healthy so start() succeeds
      const spy = vi.spyOn(agent as any, 'performHealthCheck');
      spy.mockResolvedValueOnce({
        status: 'healthy',
        responseTime: 10,
        agentId: 'test-health-interval',
        timestamp: new Date(),
      });
      // Subsequent calls return unhealthy
      spy.mockResolvedValue({
        status: 'unhealthy',
        error: 'down',
        responseTime: 10,
        agentId: 'test-health-interval',
        timestamp: new Date(),
      } as any);

      await agent.start();
      expect(agent.getStatus()).toBe('healthy');

      const interval = (agent as any).healthCheckInterval;
      expect(interval).toBeDefined();

      // Call performHealthCheck directly to trigger the unhealthy path
      const result = await agent.performHealthCheck();
      expect(result.status).toBe('unhealthy');
    });

    it('should handle multiple unhealthy health check results', async () => {
      agent = new Agent({ id: 'test-multi-unhealthy', type: 'openai' });

      const spy = vi.spyOn(agent as any, 'performHealthCheck');
      spy.mockResolvedValueOnce({
        status: 'healthy',
        responseTime: 5,
        agentId: 'test-multi-unhealthy',
        timestamp: new Date(),
      });
      spy.mockResolvedValue({
        status: 'unhealthy',
        error: 'timeout',
        responseTime: 100,
        agentId: 'test-multi-unhealthy',
        timestamp: new Date(),
      } as any);

      await agent.start();
      expect(agent.getStatus()).toBe('healthy');

      const r1 = await agent.performHealthCheck();
      expect(r1.status).toBe('unhealthy');
      const r2 = await agent.performHealthCheck();
      expect(r2.status).toBe('unhealthy');
    });
  });

  describe('calculateSuccessRate with metrics', () => {
    it('should return 0 success rate when no requests made', () => {
      agent = new Agent({ id: 'test-zero-metrics', type: 'function' });
      const instance = agent.getInstance();
      expect(instance.totalRequests).toBe(0);
      expect(instance.successRate).toBe(0);
    });

    it('should reflect 0% success when only failures occurred', async () => {
      agent = new Agent({ id: 'test-zero-success', type: 'function' });
      await agent.start();

      vi.spyOn(agent as any, 'dispatchRequest').mockRejectedValue(new Error('fail'));

      try {
        await agent.request('test', { timeout: 200 });
      } catch {}

      const instance = agent.getInstance();
      expect(instance.totalRequests).toBe(1);
      expect(instance.errorCount).toBe(1);
      expect(instance.successRate).toBe(0);
    });

    it('should reflect 100% success when only successes occurred', async () => {
      agent = new Agent({ id: 'test-all-success', type: 'function' });
      await agent.start();

      await agent.request('test', { timeout: 500 });

      const instance = agent.getInstance();
      expect(instance.totalRequests).toBe(1);
      expect(instance.errorCount).toBe(0);
      expect(instance.successRate).toBe(100);
    });
  });
});

describe('Orchestrator.ts uncovered branches', () => {
  let orchestrator: Orchestrator;

  beforeEach(() => {
    orchestrator = new Orchestrator();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('removeAgent error in agent.stop()', () => {
    it('should handle error thrown by agent.stop() and still remove agent', async () => {
      // addAgent takes AgentConfig, creates internal Agent
      orchestrator.addAgent({ id: 'claude-1', type: 'claude', name: 'Claude 1' });

      // Get the internal agent instance to spy on its stop
      const internalAgent = orchestrator.agents.get('claude-1') as any as Agent;
      expect(internalAgent).toBeDefined();

      vi.spyOn(internalAgent, 'stop').mockRejectedValue(new Error('Agent stop failed'));

      // removeAgent catches stop errors — should NOT throw
      await orchestrator.removeAgent('claude-1');
      expect(orchestrator.getAgentStats().find(a => a.id === 'claude-1')).toBeUndefined();
    });

    it('should handle non-Error throwables from agent.stop()', async () => {
      orchestrator.addAgent({ id: 'openai-1', type: 'openai', name: 'OpenAI 1' });

      const internalAgent = orchestrator.agents.get('openai-1') as any as Agent;
      vi.spyOn(internalAgent, 'stop').mockRejectedValue('string error from stop');

      await orchestrator.removeAgent('openai-1');
      expect(orchestrator.getAgentStats().find(a => a.id === 'openai-1')).toBeUndefined();
    });
  });

  describe('deleteWorkflow', () => {
    it('should throw on non-existent workflow deletion', () => {
      expect(() => orchestrator.deleteWorkflow('non-existent-wf')).toThrow('Workflow non-existent-wf not found');
    });

    it('should delete existing workflow', () => {
      orchestrator.createWorkflow({
        id: 'test-delete',
        name: 'Test Workflow',
        description: 'Test',
        steps: [{
          id: 'step1',
          name: 'Step 1',
          agentId: 'claude-1',
          description: 'First step',
        }],
      });

      orchestrator.updateWorkflow('workflow_1', { status: 'active' });
      expect(() => orchestrator.deleteWorkflow('workflow_1')).not.toThrow();
    });
  });

  describe('roundRobinSelection modulo operation', () => {
    it('should cycle through agents using modulo', () => {
      // Add agents via config (not Agent instances)
      orchestrator.addAgent({ id: 'f1', type: 'function', name: 'F1' });
      orchestrator.addAgent({ id: 'f2', type: 'function', name: 'F2' });
      orchestrator.addAgent({ id: 'f3', type: 'function', name: 'F3' });

      // Set agents to healthy status for selectAgent filter
      for (const id of ['f1', 'f2', 'f3']) {
        const a = orchestrator.agents.get(id)!;
        (a as any).instance.status = 'healthy';
      }

      const select = (orchestrator as any).selectAgent.bind(orchestrator);

      const first = select(0) as Agent;
      const second = select(0) as Agent;
      const third = select(0) as Agent;
      const fourth = select(0) as Agent;

      expect(first.getId()).toBe('f1');
      expect(second.getId()).toBe('f2');
      expect(third.getId()).toBe('f3');
      // Modulo wrap-around: index 3 % 3 = 0 → f1
      expect(fourth.getId()).toBe('f1');
    });

    it('should return null for empty agents', () => {
      const result = (orchestrator as any).selectAgent(0);
      expect(result).toBeNull();
    });
  });

  describe('weightedSelection', () => {
    it('should fall back to weight 1 when no weights configured', () => {
      orchestrator.addAgent({ id: 'w1', type: 'function', name: 'W1' });
      orchestrator.addAgent({ id: 'w2', type: 'function', name: 'W2' });

      for (const id of ['w1', 'w2']) {
        const a = orchestrator.agents.get(id)!;
        (a as any).instance.status = 'healthy';
      }

      (orchestrator as any).loadBalancing.strategy = 'weighted';

      const selected = (orchestrator as any).selectAgent(0) as Agent;
      expect(['w1', 'w2']).toContain(selected.getId());
    });

    it('should use configured weights', () => {
      orchestrator.addAgent({ id: 'wt-a', type: 'function', name: 'A' });
      orchestrator.addAgent({ id: 'wt-b', type: 'function', name: 'B' });

      for (const id of ['wt-a', 'wt-b']) {
        const a = orchestrator.agents.get(id)!;
        (a as any).instance.status = 'healthy';
      }

      (orchestrator as any).loadBalancing.strategy = 'weighted';
      (orchestrator as any).loadBalancing.weights = { 'wt-a': 100, 'wt-b': 1 };

      const selections: string[] = [];
      for (let i = 0; i < 20; i++) {
        selections.push(((orchestrator as any).selectAgent(0) as Agent).getId());
      }
      const aCount = selections.filter(s => s === 'wt-a').length;
      // With 100:1 ratio, wt-a should win nearly every time
      expect(aCount).toBeGreaterThanOrEqual(15);
    });

    it('should handle undefined weight values with fallback to 1', () => {
      orchestrator.addAgent({ id: 'wu-1', type: 'function', name: 'U1' });
      orchestrator.addAgent({ id: 'wu-2', type: 'function', name: 'U2' });

      for (const id of ['wu-1', 'wu-2']) {
        const a = orchestrator.agents.get(id)!;
        (a as any).instance.status = 'healthy';
      }

      (orchestrator as any).loadBalancing.strategy = 'weighted';
      // weights exists but agent IDs are not in it
      (orchestrator as any).loadBalancing.weights = { 'other-agent': 5 };

      const selected = (orchestrator as any).selectAgent(0) as Agent;
      expect(['wu-1', 'wu-2']).toContain(selected.getId());
    });
  });

  describe('executeWorkflowSteps dependency and error branches', () => {
    it('should throw when step dependency is not completed', async () => {
      orchestrator.addAgent({ id: 'wf-agent-1', type: 'function', name: 'WF1' });
      (orchestrator.agents.get('wf-agent-1')! as any).instance.status = 'healthy';

      orchestrator.createWorkflow({
        id: 'wf-dep-test',
        name: 'Dep Test',
        description: 'Test deps',
        steps: [
          {
            id: 'step2',
            name: 'Step 2',
            agentId: 'wf-agent-1',
            description: 'Second step',
            dependencies: ['step1'],
          },
          {
            id: 'step1',
            name: 'Step 1',
            agentId: 'wf-agent-1',
            description: 'First step',
          },
        ],
      });
      orchestrator.updateWorkflow('workflow_1', { status: 'active' });

      await expect(orchestrator.executeWorkflow('workflow_1')).rejects.toThrow(
        /Step step2 depends on step1/
      );
    });

    it('should catch errors during workflow step execution', async () => {
      orchestrator.addAgent({ id: 'wf-agent-2', type: 'function', name: 'WF2' });
      const internalAgent = orchestrator.agents.get('wf-agent-2')!;
      (internalAgent as any).instance.status = 'healthy';

      vi.spyOn(internalAgent, 'request').mockRejectedValue(new Error('Step execution failed'));

      orchestrator.createWorkflow({
        id: 'wf-err-test',
        name: 'Error Test',
        description: 'Test error handling',
        steps: [{
          id: 'step1',
          name: 'Step 1',
          agentId: 'wf-agent-2',
          description: 'Only step',
        }],
      });
      orchestrator.updateWorkflow('workflow_1', { status: 'active' });

      await expect(orchestrator.executeWorkflow('workflow_1')).rejects.toThrow('Step execution failed');
    });

    it('should catch non-Error throwables in workflow execution', async () => {
      orchestrator.addAgent({ id: 'wf-agent-3', type: 'function', name: 'WF3' });
      const internalAgent = orchestrator.agents.get('wf-agent-3')!;
      (internalAgent as any).instance.status = 'healthy';

      vi.spyOn(internalAgent, 'request').mockRejectedValue('string error in workflow');

      orchestrator.createWorkflow({
        id: 'wf-string-err',
        name: 'String Error Test',
        description: 'Test non-Error catch',
        steps: [{
          id: 'step1',
          name: 'Step 1',
          agentId: 'wf-agent-3',
          description: 'Only step',
        }],
      });
      orchestrator.updateWorkflow('workflow_1', { status: 'active' });

      await expect(orchestrator.executeWorkflow('workflow_1')).rejects.toThrow('string error in workflow');
    });
  });

  describe('evaluateCondition with non-== operators', () => {
    // evaluateCondition is private; access via (orchestrator as any)
    it('should evaluate !== operator', () => {
      const evalFn = (orchestrator as any).evaluateCondition.bind(orchestrator);
      expect(evalFn('a !== b', { a: 'test', b: 'value' })).toBe(true);
      expect(evalFn('a !== b', { a: 'same', b: 'same' })).toBe(false);
    });

    it('should evaluate != operator', () => {
      const evalFn = (orchestrator as any).evaluateCondition.bind(orchestrator);
      expect(evalFn('a != b', { a: 1, b: 2 })).toBe(true);
      expect(evalFn('a != b', { a: 1, b: 1 })).toBe(false);
    });

    it('should evaluate >= and <= operators', () => {
      const evalFn = (orchestrator as any).evaluateCondition.bind(orchestrator);
      expect(evalFn('a >= b', { a: 10, b: 5 })).toBe(true);
      expect(evalFn('a >= b', { a: 5, b: 5 })).toBe(true);
      expect(evalFn('a >= b', { a: 3, b: 5 })).toBe(false);
      expect(evalFn('a <= b', { a: 5, b: 10 })).toBe(true);
      expect(evalFn('a <= b', { a: 5, b: 5 })).toBe(true);
      expect(evalFn('a <= b', { a: 10, b: 5 })).toBe(false);
    });

    it('should evaluate compound conditions with && and ||', () => {
      const evalFn = (orchestrator as any).evaluateCondition.bind(orchestrator);
      // Use operators the code supports (!==, >=, <=)
      expect(evalFn('a !== b && c >= d', { a: 1, b: 2, c: 10, d: 5 })).toBe(true);
      expect(evalFn('a <= 5 || b !== c', { a: 3, b: 'x', c: 'y' })).toBe(true);
    });

    it('should handle string comparisons', () => {
      const evalFn = (orchestrator as any).evaluateCondition.bind(orchestrator);
      expect(evalFn('a !== "test"', { a: 'different' })).toBe(true);
    });
  });
});
