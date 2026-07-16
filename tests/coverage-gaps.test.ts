import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Agent } from '../src/Agent.js';
import { Orchestrator } from '../src/Orchestrator.js';
import {
  createClaudeAgent,
  createOpenAIAgent,
  createFunctionAgent,
  createContentCreationWorkflow,
  createDataAnalysisWorkflow,
  createCodeReviewWorkflow,
} from '../src/index.js';
import { AgentConfig } from '../src/types.js';

/**
 * Targeted tests for uncovered branches identified by coverage report.
 *
 * Agent.ts uncovered branches:
 *   line 31: start() - status === 'stopping' guard
 *   line 41: start() - catch path setting unhealthy
 *   line 132: dispatchRequest - non-matching prefix (Generic)
 *   line 172: performHealthCheck - error catch (genericHealthCheck throw)
 *   line 198-199: executeRequestWithRetry - lastError fallback throw
 *   line 219: startHealthChecks - unhealthy status in interval callback
 *   line 246: calculateSuccessRate - totalRequests === 0
 *   line 253: delay helper
 *
 * Orchestrator.ts uncovered branches:
 *   line 114: removeAgent - error in agent.stop() catch
 *   line 118: removeAgent - console.error path
 *   line 143: addAgent - console.log (already covered by existing tests)
 *   line 186: requestToAgent - (may already be hit)
 *   line 206: deleteWorkflow - throw for non-existent (already covered)
 *   line 232: selectAgent - default strategy (unknown)
 *   line 242: roundRobinSelection - index modulo
 *   line 254-275: weightedSelection - weight defaults / fallback
 *   line 299: executeWorkflowSteps - condition error catch
 *   line 355-382: evaluateCondition - !==, !=, >=, <=, &&, || operators
 *
 * index.ts uncovered branches:
 *   line 81: createClaudeAgent - apiKey provided
 *   line 104: createOpenAIAgent - apiKey provided
 *   line 108: createOpenAIAgent - endpoint provided
 *   line 125: createFunctionAgent - maxConcurrent provided
 *   line 129: createFunctionAgent - timeout provided
 */

// =============================================
// Agent.ts coverage gap tests
// =============================================

describe('Agent coverage gaps', () => {
  let agent: Agent;

  afterEach(async () => {
    if (agent && agent.getStatus() !== 'stopped') {
      await agent.stop().catch(() => {});
    }
  });

  describe('line 31: start() when status is stopping', () => {
    it('should throw if agent status is stopping', async () => {
      agent = new Agent({ id: 'stop-test', name: 'Stop Test', type: 'claude' });
      // Force status to 'stopping'
      (agent as any).instance.status = 'stopping';

      await expect(agent.start()).rejects.toThrow('Agent stop-test is stopping');
    });
  });

  describe('line 41: start() catch path', () => {
    it('should set unhealthy and increment consecutiveFailures on start failure', async () => {
      agent = new Agent({ id: 'fail-start', name: 'Fail Start', type: 'openai' });
      // Mock performHealthCheck to throw (not return unhealthy, but throw)
      vi.spyOn(agent, 'performHealthCheck').mockRejectedValue(new Error('Network error'));

      await expect(agent.start()).rejects.toThrow('Failed to start agent fail-start');
      const instance = (agent as any).instance;
      expect(instance.status).toBe('unhealthy');
      expect(instance.consecutiveFailures).toBe(1);
    });
  });

  describe('line 132: dispatchRequest generic prefix', () => {
    it('should use "Generic" prefix for unknown agent type', async () => {
      agent = new Agent({ id: 'generic-agent', name: 'Generic', type: 'custom' });
      await agent.start();

      const response = await agent.request('hello');
      expect(response).toContain('Generic response for: hello');
    });
  });

  describe('line 172: performHealthCheck error catch (openai)', () => {
    it('should return unhealthy when openai health check throws', async () => {
      agent = new Agent({ id: 'openai-fail', name: 'OpenAI Fail', type: 'openai' });
      // Internal checkOpenAIHealth throws
      vi.spyOn(agent as any, 'checkOpenAIHealth').mockRejectedValue(new Error('API down'));

      const result = await agent.performHealthCheck();
      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('API down');
    });
  });

  describe('line 198-199: executeRequestWithRetry lastError throw', () => {
    it('should throw lastError when all retries exhausted without entering the if', async () => {
      agent = new Agent({ id: 'retry-exhaust', name: 'Retry Exhaust', type: 'function' });
      await agent.start();

      // Mock executeRequest to always throw
      vi.spyOn(agent as any, 'executeRequest').mockRejectedValue(new Error('Permanent failure'));

      await expect(agent.request('test', { retries: 0 })).rejects.toThrow('Permanent failure');
    });
  });

  describe('line 219: startHealthChecks - interval unhealthy callback', () => {
    it('should set unhealthy status when health check fails in interval', async () => {
      agent = new Agent({
        id: 'interval-fail',
        name: 'Interval Fail',
        type: 'claude',
        healthCheckInterval: 100, // Very short interval
      });
      await agent.start();

      // After start, mock health check to fail
      vi.spyOn(agent, 'performHealthCheck').mockResolvedValue({
        agentId: 'interval-fail',
        status: 'unhealthy',
        responseTime: 500,
        error: 'Service degraded',
        timestamp: new Date(),
      });

      // Wait for interval to fire
      await new Promise(resolve => setTimeout(resolve, 250));

      const instance = (agent as any).instance;
      expect(instance.status).toBe('unhealthy');
    });
  });

  describe('line 246: calculateSuccessRate when totalRequests is 0', () => {
    it('should return 0 success rate when no requests have been made', () => {
      agent = new Agent({ id: 'no-req', name: 'No Requests', type: 'claude' });
      // calculateSuccessRate is private, check via instance
      const rate = (agent as any).calculateSuccessRate();
      expect(rate).toBe(0);
    });
  });
});

// =============================================
// Orchestrator.ts coverage gap tests
// =============================================

describe('Orchestrator coverage gaps', () => {
  let orchestrator: Orchestrator;

  beforeEach(() => {
    orchestrator = new Orchestrator();
  });

  afterEach(async () => {
    await orchestrator.shutdown();
  });

  describe('line 114-118: removeAgent error handling', () => {
    it('should catch error from agent.stop() during removal', async () => {
      const agent = orchestrator.addAgent({ id: 'err-stop', name: 'Err Stop', type: 'claude' });
      await agent.start();

      // Make agent.stop() throw
      vi.spyOn(agent, 'stop').mockRejectedValue(new Error('Stop failed'));

      // Should not throw — should catch internally
      await orchestrator.removeAgent('err-stop');
      expect(orchestrator.getAgentStats().length).toBe(0);
    });
  });

  describe('line 232: selectAgent - unknown strategy default', () => {
    it('should fallback to first agent for unknown strategy', async () => {
      const customOrch = new Orchestrator({
        loadBalancing: { strategy: 'invalid-strategy' as any },
      });

      const a1 = customOrch.addAgent({ id: 'a1', name: 'A1', type: 'claude' });
      await a1.start();

      const response = await customOrch.request('test');
      expect(typeof response).toBe('string');
      await customOrch.shutdown();
    });
  });

  describe('line 299: executeWorkflowSteps - condition with truthy result executes step', () => {
    it('should execute step when condition evaluates to true', async () => {
      const agent = orchestrator.addAgent({ id: 'cond-agent', name: 'Cond', type: 'claude' });
      await agent.start();

      orchestrator.createWorkflow({
        name: 'True Condition',
        steps: [
          {
            id: 'step1',
            name: 'Step 1',
            agentId: 'cond-agent',
            input: { test: true },
            condition: 'true',
          },
        ],
      });

      const workflows = orchestrator.getWorkflowStats();
      orchestrator.updateWorkflow(workflows[0].id, { status: 'active' });

      const result = await orchestrator.executeWorkflow(workflows[0].id);
      expect(result.step1).toBeDefined();
      expect((result.step1 as any).skipped).toBeUndefined();
    });
  });

  describe('evaluateCondition operators', () => {
    // We need to access the private method for direct testing
    function getEval() {
      return (orchestrator as any).evaluateCondition.bind(orchestrator);
    }
    function getExec() {
      return (orchestrator as any).evaluateExpression.bind(orchestrator);
    }

    beforeEach(async () => {
      // Add an agent so things work
      const a = orchestrator.addAgent({ id: 'op-agent', name: 'OpAgent', type: 'function' });
      await a.start();
    });

    it('line 355: !== operator', () => {
      const evalCondition = getEval();
      // step1.response is a string; !== with a different string → true
      expect(evalCondition('1 !== 2', {})).toBe(true);
      expect(evalCondition('1 !== 1', {})).toBe(false);
    });

    it('line 360: != operator', () => {
      const evalCondition = getEval();
      expect(evalCondition('1 != 2', {})).toBe(true);
      expect(evalCondition('1 != 1', {})).toBe(false);
    });

    it('line 365: >= operator', () => {
      const evalCondition = getEval();
      expect(evalCondition('5 >= 3', {})).toBe(true);
      expect(evalCondition('3 >= 3', {})).toBe(true);
      expect(evalCondition('2 >= 3', {})).toBe(false);
    });

    it('line 370: <= operator', () => {
      const evalCondition = getEval();
      expect(evalCondition('3 <= 5', {})).toBe(true);
      expect(evalCondition('3 <= 3', {})).toBe(true);
      expect(evalCondition('5 <= 3', {})).toBe(false);
    });

    it('line 375: && operator', () => {
      const evalCondition = getEval();
      expect(evalCondition('true && true', {})).toBe(true);
      expect(evalCondition('true && false', {})).toBe(false);
    });

    it('line 380: || operator', () => {
      const evalCondition = getEval();
      expect(evalCondition('false || true', {})).toBe(true);
      expect(evalCondition('false || false', {})).toBe(false);
    });

    it('line 382: default truthiness evaluation', () => {
      const evalCondition = getEval();
      // A variable that resolves to a truthy value
      expect(evalCondition('true', {})).toBe(true);
      expect(evalCondition('false', {})).toBe(false);
    });

    it('evaluateExpression template variable', () => {
      const evalExpression = getExec();
      expect(evalExpression('${foo}', { foo: 'bar' })).toBe('bar');
    });

    it('evaluateExpression nested variable', () => {
      const evalExpression = getExec();
      expect(evalExpression('${a.b}', { a: { b: 42 } })).toBe(42);
    });

    it('evaluateExpression literal number', () => {
      const evalExpression = getExec();
      expect(evalExpression('42', {})).toBe(42);
    });

    it('evaluateExpression boolean false', () => {
      const evalExpression = getExec();
      expect(evalExpression('false', {})).toBe(false);
    });

    it('evaluateExpression returns value from context for unknown key', () => {
      const evalExpression = getExec();
      expect(evalExpression('nonexistent', {})).toBeUndefined();
    });
  });

  describe('line 143: requestToAgent for existing agent (already healthy)', () => {
    it('should return response for valid agent', async () => {
      const a = orchestrator.addAgent({ id: 'rt-agent', name: 'RT', type: 'claude' });
      await a.start();

      const resp = await orchestrator.requestToAgent('rt-agent', 'hello');
      expect(resp).toContain('hello');
    });
  });

  describe('workflow condition with complex expressions', () => {
    it('should skip step when condition uses && and evaluates to false', async () => {
      const a = orchestrator.addAgent({ id: 'wfc-agent', name: 'WFC', type: 'function' });
      await a.start();

      orchestrator.createWorkflow({
        name: 'AndCond Workflow',
        steps: [
          {
            id: 's1',
            name: 'S1',
            agentId: 'wfc-agent',
            input: { task: 'do something' },
          },
          {
            id: 's2',
            name: 'S2',
            agentId: 'wfc-agent',
            input: { data: 'process' },
            dependencies: ['s1'],
            condition: 'true && false',
          },
        ],
      });

      const workflows = orchestrator.getWorkflowStats();
      orchestrator.updateWorkflow(workflows[0].id, { status: 'active' });

      const result = await orchestrator.executeWorkflow(workflows[0].id);
      expect(result.s1).toBeDefined();
      expect((result.s2 as any).skipped).toBe(true);
    });

    it('should execute step when condition uses || and evaluates to true', async () => {
      const a2 = orchestrator.addAgent({ id: 'orc-agent', name: 'ORC', type: 'function' });
      await a2.start();

      orchestrator.createWorkflow({
        name: 'OrCond Workflow',
        steps: [
          {
            id: 's1',
            name: 'S1',
            agentId: 'orc-agent',
            input: { task: 'do something' },
            condition: 'false || true',
          },
        ],
      });

      const workflows = orchestrator.getWorkflowStats();
      orchestrator.updateWorkflow(workflows[0].id, { status: 'active' });

      const result = await orchestrator.executeWorkflow(workflows[0].id);
      expect(result.s1).toBeDefined();
      expect((result.s1 as any).skipped).toBeUndefined();
    });
  });

  describe('line 49: constructor with pre-configured agents', () => {
    it('should initialize agents from config', () => {
      const orch = new Orchestrator({
        agents: [
          { id: 'pre-1', name: 'Pre 1', type: 'claude' },
          { id: 'pre-2', name: 'Pre 2', type: 'openai' },
        ],
      });
      expect(orch.getAgentStats().length).toBe(2);
      expect(orch.getAgentStats()[0].id).toBe('pre-1');
    });
  });

  describe('line 186: executeWorkflow inactive status', () => {
    it('should throw when workflow is not active', async () => {
      orchestrator.createWorkflow({ name: 'Draft WF', steps: [] });
      const wf = orchestrator.getWorkflowStats()[0];
      // status is 'draft' by default
      await expect(orchestrator.executeWorkflow(wf.id)).rejects.toThrow('is not active');
    });
  });

  describe('line 206: deleteWorkflow non-existent', () => {
    it('should throw when deleting non-existent workflow', () => {
      expect(() => orchestrator.deleteWorkflow('nope')).toThrow('Workflow nope not found');
    });
  });

  describe('line 360: evaluateCondition != operator', () => {
    it('should evaluate != as not-equal', () => {
      const evalCond = (orchestrator as any).evaluateCondition.bind(orchestrator);
      // Use space-surrounded != so it doesn't match !==
      expect(evalCond('1 != 2', {})).toBe(true);
      expect(evalCond('1 != 1', {})).toBe(false);
    });
  });
});

// =============================================
// index.ts coverage gap tests
// =============================================

describe('index.ts factory coverage gaps', () => {
  describe('createClaudeAgent with apiKey', () => {
    it('line 81: should set apiKey when provided', () => {
      const agent = createClaudeAgent('c1', 'Claude with Key', { apiKey: 'sk-test-key' });
      expect(agent.getConfig().apiKey).toBe('sk-test-key');
    });
  });

  describe('createOpenAIAgent with apiKey and endpoint', () => {
    it('line 104: should set apiKey when provided', () => {
      const agent = createOpenAIAgent('o1', 'OpenAI with Key', { apiKey: 'sk-oai-key' });
      expect(agent.getConfig().apiKey).toBe('sk-oai-key');
    });

    it('line 108: should set endpoint when provided', () => {
      const agent = createOpenAIAgent('o2', 'OpenAI with Endpoint', {
        endpoint: 'https://custom.api.com/v1',
      });
      expect(agent.getConfig().endpoint).toBe('https://custom.api.com/v1');
    });
  });

  describe('createFunctionAgent with maxConcurrent and timeout', () => {
    it('line 125: should set maxConcurrent when provided', () => {
      const agent = createFunctionAgent('f1', 'Func with Max', { maxConcurrent: 20 });
      expect(agent.getConfig().maxConcurrent).toBe(20);
    });

    it('line 129: should set timeout when provided', () => {
      const agent = createFunctionAgent('f2', 'Func with Timeout', { timeout: 45000 });
      expect(agent.getConfig().timeout).toBe(45000);
    });
  });

  describe('workflow templates with custom agents', () => {
    it('createContentCreationWorkflow with individual agent overrides', () => {
      const wf = createContentCreationWorkflow('cw1', 'CW', {
        ideas: 'my-ideas-agent',
        outline: 'my-outline-agent',
        draft: 'my-draft-agent',
        review: 'my-review-agent',
      });
      expect(wf.steps[0].agentId).toBe('my-ideas-agent');
      expect(wf.steps[1].agentId).toBe('my-outline-agent');
      expect(wf.steps[2].agentId).toBe('my-draft-agent');
      expect(wf.steps[3].agentId).toBe('my-review-agent');
    });

    it('createDataAnalysisWorkflow with custom agents', () => {
      const wf = createDataAnalysisWorkflow('dw1', 'DW', {
        data: 'custom-data',
        analysis: 'custom-analysis',
        visualization: 'custom-viz',
      });
      expect(wf.steps[0].agentId).toBe('custom-data');
      expect(wf.steps[1].agentId).toBe('custom-analysis');
      expect(wf.steps[2].agentId).toBe('custom-viz');
    });

    it('createCodeReviewWorkflow with custom agents', () => {
      const wf = createCodeReviewWorkflow('crw1', 'CRW', {
        review: 'my-reviewer',
        improvement: 'my-improver',
        documentation: 'my-doccer',
      });
      expect(wf.steps[0].agentId).toBe('my-reviewer');
      expect(wf.steps[1].agentId).toBe('my-improver');
      expect(wf.steps[2].agentId).toBe('my-doccer');
    });
  });
});
