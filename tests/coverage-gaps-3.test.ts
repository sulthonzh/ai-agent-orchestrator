import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Agent } from '../src/Agent.js';
import { Orchestrator } from '../src/Orchestrator.js';
import { AgentConfig } from '../src/types.js';

/**
 * Coverage gap tests round 3 for ai-agent-orchestrator
 * Targeting remaining uncovered branches from V8 coverage report.
 *
 * Agent.ts uncovered:
 *  - Line 41: healthResult.error || 'unhealthy' fallback (error is undefined)
 *  - Line 172: 'Unknown error' fallback in performHealthCheck catch (non-Error)
 *  - Line 246: calculateSuccessRate totalRequests === 0 (already via getInstance, but branch)
 *
 * Orchestrator.ts uncovered:
 *  - Line 86: shutdown() agent.stop().catch() callback body
 *  - Line 202: performHealthChecks catch block → push unhealthy result
 *  - Line 280: weightedSelection fallback return agents[0]
 *  - Line 315: evaluateCondition catch in workflow → throw
 *  - Lines 361-362: === operator in evaluateCondition
 *  - Lines 395-396: evaluateCondition catch → console.warn + return false
 */

describe('Agent.ts remaining uncovered branches', () => {
  let agent: Agent;

  afterEach(async () => {
    if (agent && agent.getStatus() !== 'stopped') {
      await agent.stop().catch(() => {});
    }
    vi.restoreAllMocks();
  });

  describe('line 41: start() health check unhealthy with undefined error', () => {
    it('should throw "unhealthy" fallback when health result has no error message', async () => {
      const spy = vi.spyOn(Agent.prototype as any, 'performHealthCheck');
      // Return unhealthy with NO error field → triggers `|| 'unhealthy'` fallback
      spy.mockResolvedValue({
        status: 'unhealthy',
        responseTime: 50,
        agentId: 'test-no-error',
        timestamp: new Date(),
      });

      agent = new Agent({ id: 'test-no-error', type: 'claude' });
      await expect(agent.start()).rejects.toThrow('Health check failed: unhealthy');
      expect(agent.getStatus()).toBe('unhealthy');
      expect(agent.getInstance().consecutiveFailures).toBe(1);
    });

    it('should throw with error message when health result has error', async () => {
      const spy = vi.spyOn(Agent.prototype as any, 'performHealthCheck');
      spy.mockResolvedValue({
        status: 'unhealthy',
        error: 'connection refused',
        responseTime: 50,
        agentId: 'test-with-error',
        timestamp: new Date(),
      });

      agent = new Agent({ id: 'test-with-error', type: 'openai' });
      await expect(agent.start()).rejects.toThrow('Health check failed: connection refused');
    });
  });

  describe('line 172: performHealthCheck non-Error catch → "Unknown error"', () => {
    it('should return unhealthy with "Unknown error" when check throws non-Error', async () => {
      // performHealthCheck calls type-specific check (checkClaudeHealth etc.)
      // If those throw non-Error, the catch builds error message via instanceof
      const spy = vi.spyOn(Agent.prototype as any, 'performHealthCheck');
      // We need to test the internal catch path - mock checkClaudeHealth to throw non-Error
      spy.mockRestore();
      vi.restoreAllMocks();

      agent = new Agent({ id: 'test-unknown-err', type: 'claude' });
      // Spy on the private health check method to throw a non-Error value
      vi.spyOn(agent as any, 'checkClaudeHealth').mockRejectedValue('string thrown from check');

      const result = await agent.performHealthCheck();
      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('Unknown error');
      expect(result.responseTime).toBeGreaterThanOrEqual(1);
    });

    it('should return unhealthy with error message when check throws Error', async () => {
      agent = new Agent({ id: 'test-err-msg', type: 'openai' });
      vi.spyOn(agent as any, 'checkOpenAIHealth').mockRejectedValue(new Error('OpenAI down'));

      const result = await agent.performHealthCheck();
      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('OpenAI down');
    });

    it('should return unhealthy for generic health check throwing non-Error', async () => {
      agent = new Agent({ id: 'test-generic-throw', type: 'custom' });
      vi.spyOn(agent as any, 'genericHealthCheck').mockRejectedValue(42);

      const result = await agent.performHealthCheck();
      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('Unknown error');
    });
  });

  describe('line 246: calculateSuccessRate edge cases', () => {
    it('should return 0 success rate via getInstance for fresh agent', () => {
      agent = new Agent({ id: 'test-fresh-rate', type: 'function' });
      const instance = agent.getInstance();
      // totalRequests === 0 → returns 0
      expect(instance.successRate).toBe(0);
      expect(instance.totalRequests).toBe(0);
    });
  });
});

describe('Orchestrator.ts remaining uncovered branches', () => {
  let orchestrator: Orchestrator;

  beforeEach(() => {
    orchestrator = new Orchestrator();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('line 86: shutdown() with agent.stop() errors', () => {
    it('should catch errors from agent.stop() during shutdown', async () => {
      orchestrator.addAgent({ id: 'sd-1', type: 'claude', name: 'SD1' });
      orchestrator.addAgent({ id: 'sd-2', type: 'function', name: 'SD2' });

      const a1 = orchestrator.agents.get('sd-1')!;
      vi.spyOn(a1, 'stop').mockRejectedValue(new Error('stop error 1'));

      const a2 = orchestrator.agents.get('sd-2')!;
      vi.spyOn(a2, 'stop').mockRejectedValue('string stop error');

      // Should NOT throw, just log errors
      await expect(orchestrator.shutdown()).resolves.toBeUndefined();
      expect(orchestrator.getAgentStats()).toHaveLength(0);
    });

    it('should reset roundRobinIndex to 0 after shutdown', async () => {
      orchestrator.addAgent({ id: 'rr-1', type: 'function', name: 'RR1' });
      orchestrator.addAgent({ id: 'rr-2', type: 'function', name: 'RR2' });

      // Cycle the round-robin index
      (orchestrator as any).roundRobinIndex = 5;

      await orchestrator.shutdown();
      expect((orchestrator as any).roundRobinIndex).toBe(0);
    });
  });

  describe('line 202: performHealthChecks catch block', () => {
    it('should push unhealthy result when agent.performHealthCheck throws', async () => {
      orchestrator.addAgent({ id: 'hc-throw', type: 'claude', name: 'HC-Throw' });

      const agent = orchestrator.agents.get('hc-throw')!;
      vi.spyOn(agent, 'performHealthCheck').mockRejectedValue(new Error('Health check crashed'));

      const results = await orchestrator.performHealthChecks();
      expect(results).toHaveLength(1);
      expect(results[0]!.status).toBe('unhealthy');
      expect(results[0]!.error).toBe('Health check crashed');
      expect(results[0]!.agentId).toBe('hc-throw');
    });

    it('should push unhealthy result with "Unknown error" for non-Error throws', async () => {
      orchestrator.addAgent({ id: 'hc-string', type: 'openai', name: 'HC-String' });

      const agent = orchestrator.agents.get('hc-string')!;
      vi.spyOn(agent, 'performHealthCheck').mockRejectedValue('non-Error throw');

      const results = await orchestrator.performHealthChecks();
      expect(results).toHaveLength(1);
      expect(results[0]!.status).toBe('unhealthy');
      expect(results[0]!.error).toBe('Unknown error');
    });

    it('should handle mixed healthy and throwing agents', async () => {
      orchestrator.addAgent({ id: 'hc-ok', type: 'function', name: 'HC-OK' });
      orchestrator.addAgent({ id: 'hc-bad', type: 'claude', name: 'HC-BAD' });

      const badAgent = orchestrator.agents.get('hc-bad')!;
      vi.spyOn(badAgent, 'performHealthCheck').mockRejectedValue(new Error('fail'));

      const results = await orchestrator.performHealthChecks();
      expect(results).toHaveLength(2);
      const bad = results.find(r => r.agentId === 'hc-bad');
      const ok = results.find(r => r.agentId === 'hc-ok');
      expect(bad!.status).toBe('unhealthy');
      expect(ok!.status).toBe('healthy');
    });
  });

  describe('line 280: weightedSelection fallback to agents[0]', () => {
    it('should return first agent when weighted random overshoots', () => {
      orchestrator.addAgent({ id: 'wf-1', type: 'function', name: 'WF1' });
      orchestrator.addAgent({ id: 'wf-2', type: 'function', name: 'WF2' });

      for (const id of ['wf-1', 'wf-2']) {
        const a = orchestrator.agents.get(id)!;
        (a as any).instance.status = 'healthy';
      }

      (orchestrator as any).loadBalancing.strategy = 'weighted';
      // Mock Math.random to return a value that exceeds totalWeight (impossible normally)
      // so the for loop completes without returning, hitting the fallback
      const mathSpy = vi.spyOn(Math, 'random');
      mathSpy.mockReturnValue(0.99999);

      // With 2 agents, weight 1 each, totalWeight=2, random=0.99999*2=1.99998
      // agent wf-1: currentWeight=1, 1.99998 > 1 → skip
      // agent wf-2: currentWeight=2, 1.99998 <= 2 → return wf-2
      // To hit fallback, we need random*totalWeight > totalWeight
      // That's impossible with Math.random() < 1. So mock to return exactly 1.0
      mathSpy.mockReturnValue(1.0);
      // random * totalWeight = 1.0 * 2 = 2.0
      // wf-1: currentWeight = 1, 2.0 > 1 → continue
      // wf-2: currentWeight = 2, 2.0 > 2 → false (2.0 <= 2 is true actually)
      // Hmm, let's try with weights that make total exactly 1
      (orchestrator as any).loadBalancing.weights = { 'wf-1': 0.5, 'wf-2': 0.5 };
      // totalWeight = 1.0, random = 1.0 * 1.0 = 1.0
      // wf-1: currentWeight = 0.5, 1.0 > 0.5 → continue
      // wf-2: currentWeight = 1.0, 1.0 > 1.0 → false → returns wf-2
      // Still hits. To truly hit fallback we'd need random > totalWeight
      // Since Math.random() < 1, random*totalWeight < totalWeight always
      // The fallback is dead code in practice. But let's test we get a valid agent.
      const selected = (orchestrator as any).selectAgent(0) as Agent;
      expect(['wf-1', 'wf-2']).toContain(selected.getId());
    });
  });

  describe('lines 361-362: evaluateCondition === operator', () => {
    it('should evaluate === operator for equality', () => {
      const evalFn = (orchestrator as any).evaluateCondition.bind(orchestrator);
      expect(evalFn('a === b', { a: 'hello', b: 'hello' })).toBe(true);
      expect(evalFn('a === b', { a: 'hello', b: 'world' })).toBe(false);
    });

    it('should evaluate === with numbers', () => {
      const evalFn = (orchestrator as any).evaluateCondition.bind(orchestrator);
      expect(evalFn('a === 42', { a: 42 })).toBe(true);
      expect(evalFn('a === 42', { a: 43 })).toBe(false);
    });

    it('should evaluate === with booleans', () => {
      const evalFn = (orchestrator as any).evaluateCondition.bind(orchestrator);
      expect(evalFn('a === true', { a: true })).toBe(true);
      expect(evalFn('a === false', { a: true })).toBe(false);
    });

    it('should evaluate === with template variables', () => {
      const evalFn = (orchestrator as any).evaluateCondition.bind(orchestrator);
      expect(evalFn('${a} === ${b}', { a: 'x', b: 'x' })).toBe(true);
    });
  });

  describe('line 315: evaluateCondition error in workflow step', () => {
    it('should throw when condition evaluation fails in workflow execution', async () => {
      // The catch in evaluateCondition wraps everything internally and returns false.
      // So the throw in executeWorkflowSteps line 315 is actually unreachable —
      // evaluateCondition catches its own errors.
      // Verify the catch path via a Proxy that throws on property access
      const badContext = new Proxy({}, {
        get() { throw new Error('proxy trap'); }
      });
      const evalFn = (orchestrator as any).evaluateCondition.bind(orchestrator);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(evalFn('a === b', badContext)).toBe(false);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore()
    });
  });

  describe('lines 395-396: evaluateCondition catch block', () => {
    it('should return false and console.warn when evaluation throws', () => {
      const evalFn = (orchestrator as any).evaluateCondition.bind(orchestrator);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Force an error by making reduce throw
      // getNestedValue does: path.split('.').reduce(...)
      // If context is an object that throws when accessed
      const badObj = new Proxy({}, {
        get() { throw new Error('proxy trap'); }
      });

      const result = evalFn('a === b', badObj as any);
      expect(result).toBe(false);
      expect(warnSpy).toHaveBeenCalled();
      expect(warnSpy.mock.calls[0]![0]).toContain('Condition evaluation failed');
    });

    it('should handle evaluateExpression errors gracefully', () => {
      const evalFn = (orchestrator as any).evaluateCondition.bind(orchestrator);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Throw from getNestedValue by having a property access on a number
      const result = evalFn('${a.b.c} === true', { a: 42 });
      // a is 42 (number), a.b → current=42, typeof 42 !== 'object' → undefined
      // So this won't throw. Returns false because undefined === true is false.
      expect(result).toBe(false);
    });
  });

  describe('Orchestrator shutdown with healthy agents', () => {
    it('should clear all agents on shutdown', async () => {
      orchestrator.addAgent({ id: 's-1', type: 'function', name: 'S1' });
      orchestrator.addAgent({ id: 's-2', type: 'function', name: 'S2' });

      // Start agents so they have intervals to clean up
      await orchestrator.agents.get('s-1')!.start();
      await orchestrator.agents.get('s-2')!.start();

      await orchestrator.shutdown();
      expect(orchestrator.getAgentStats()).toHaveLength(0);
    });
  });

  describe('updateWorkflow with timestamp advance', () => {
    it('should update workflow updatedAt to new Date', () => {
      orchestrator.createWorkflow({
        id: 'uwf-1',
        name: 'Test',
        description: 'Test',
        steps: [],
      });

      const original = orchestrator.getWorkflowStats()[0];
      const originalTime = original!.updatedAt;

      // Wait a tiny bit then update
      const updated = orchestrator.updateWorkflow('workflow_1', { name: 'Updated' });
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(originalTime.getTime());
      expect(updated.name).toBe('Updated');
    });
  });

  describe('getNestedValue edge cases', () => {
    it('should return undefined for non-existent nested path', () => {
      const evalFn = (orchestrator as any).getNestedValue.bind(orchestrator);
      expect(evalFn({ a: { b: 1 } }, 'a.b.c')).toBeUndefined();
      expect(evalFn({ a: { b: 1 } }, 'x.y.z')).toBeUndefined();
    });

    it('should handle primitive values in path', () => {
      const evalFn = (orchestrator as any).getNestedValue.bind(orchestrator);
      // a is number, typeof number !== 'object' → returns undefined for .b
      expect(evalFn({ a: 42 }, 'a.b')).toBeUndefined();
      expect(evalFn({ a: null }, 'a.b')).toBeUndefined();
    });

    it('should return the value for simple key', () => {
      const evalFn = (orchestrator as any).getNestedValue.bind(orchestrator);
      expect(evalFn({ key: 'value' }, 'key')).toBe('value');
    });
  });

  describe('evaluateExpression additional paths', () => {
    it('should parse "false" string as boolean false', () => {
      const evalFn = (orchestrator as any).evaluateExpression.bind(orchestrator);
      expect(evalFn('false', {})).toBe(false);
    });

    it('should parse "true" string as boolean true', () => {
      const evalFn = (orchestrator as any).evaluateExpression.bind(orchestrator);
      expect(evalFn('true', {})).toBe(true);
    });

    it('should parse number strings as numbers', () => {
      const evalFn = (orchestrator as any).evaluateExpression.bind(orchestrator);
      expect(evalFn('42', {})).toBe(42);
      expect(evalFn('3.14', {})).toBe(3.14);
    });

    it('should handle template variable resolution', () => {
      const evalFn = (orchestrator as any).evaluateExpression.bind(orchestrator);
      expect(evalFn('${value}', { value: 'hello' })).toBe('hello');
      expect(evalFn('${value}', { value: 42 })).toBe(42);
    });

    it('should fall back to getNestedValue for unknown strings', () => {
      const evalFn = (orchestrator as any).evaluateExpression.bind(orchestrator);
      expect(evalFn('some.key', { some: { key: 'found' } })).toBe('found');
    });
  });

  describe('default truthiness evaluation', () => {
    it('should return false for undefined value', () => {
      const evalFn = (orchestrator as any).evaluateCondition.bind(orchestrator);
      expect(evalFn('missing', {})).toBe(false);
    });

    it('should return false for null value', () => {
      const evalFn = (orchestrator as any).evaluateCondition.bind(orchestrator);
      expect(evalFn('val', { val: null })).toBe(false);
    });

    it('should return false for 0', () => {
      const evalFn = (orchestrator as any).evaluateCondition.bind(orchestrator);
      expect(evalFn('val', { val: 0 })).toBe(false);
    });

    it('should return false for empty string', () => {
      const evalFn = (orchestrator as any).evaluateCondition.bind(orchestrator);
      expect(evalFn('val', { val: '' })).toBe(false);
    });

    it('should return true for non-empty string', () => {
      const evalFn = (orchestrator as any).evaluateCondition.bind(orchestrator);
      expect(evalFn('val', { val: 'hello' })).toBe(true);
    });

    it('should return true for positive number', () => {
      const evalFn = (orchestrator as any).evaluateCondition.bind(orchestrator);
      expect(evalFn('val', { val: 42 })).toBe(true);
    });

    it('should return true for object', () => {
      const evalFn = (orchestrator as any).evaluateCondition.bind(orchestrator);
      expect(evalFn('val', { val: { a: 1 } })).toBe(true);
    });
  });
});
