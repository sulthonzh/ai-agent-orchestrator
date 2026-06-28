import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Agent } from '../src/Agent.js';
import { AgentConfig } from '../src/types.js';

describe('Agent', () => {
  let agentConfig: AgentConfig;
  let agent: Agent;

  beforeEach(() => {
    agentConfig = {
      id: 'test-agent',
      name: 'Test Agent',
      type: 'claude',
      model: 'claude-3-sonnet',
      maxConcurrent: 5,
      timeout: 30000
    };
    
    agent = new Agent(agentConfig);
  });

  afterEach(() => {
    // Clean up any intervals
    if (agent instanceof Agent) {
      const instance = (agent as any).instance;
      if (instance.healthCheckInterval) {
        clearInterval(instance.healthCheckInterval);
      }
    }
  });

  describe('constructor', () => {
    it('should create agent with correct initial state', () => {
      const instance = (agent as any).instance;
      
      expect(instance.id).toBe('test-agent');
      expect(instance.name).toBe('Test Agent');
      expect(instance.type).toBe('claude');
      expect(instance.status).toBe('starting');
      expect(instance.currentLoad).toBe(0);
      expect(instance.totalRequests).toBe(0);
      expect(instance.successRate).toBe(0);
      expect(instance.averageResponseTime).toBe(0);
      expect(instance.consecutiveFailures).toBe(0);
      expect(instance.errorCount).toBe(0);
    });

    it('should handle optional configuration', () => {
      const config: AgentConfig = {
        id: 'minimal-agent',
        name: 'Minimal Agent',
        type: 'function'
      };
      
      const minimalAgent = new Agent(config);
      const instance = (minimalAgent as any).instance;
      
      expect(instance.config.id).toBe('minimal-agent');
      expect(instance.config.type).toBe('function');
      expect(instance.config.maxConcurrent).toBeUndefined();
      expect(instance.config.timeout).toBeUndefined();
    });
  });

  describe('start', () => {
    it('should start agent successfully', async () => {
      await agent.start();
      
      const instance = (agent as any).instance;
      expect(instance.status).toBe('healthy');
      expect(instance.startedAt).toBeInstanceOf(Date);
    });

    it('should throw error if agent is already starting', async () => {
      await agent.start();
      
      await expect(agent.start()).rejects.toThrow(
        'Agent test-agent is already healthy'
      );
    });

    it('should handle health check failure', async () => {
      // Mock health check to fail
      vi.spyOn(agent, 'performHealthCheck').mockResolvedValueOnce({
        agentId: 'test-agent',
        status: 'unhealthy',
        responseTime: 1000,
        error: 'Connection failed',
        timestamp: new Date()
      });

      await expect(agent.start()).rejects.toThrow(
        'Failed to start agent test-agent'
      );
    });
  });

  describe('stop', () => {
    beforeEach(async () => {
      await agent.start();
    });

    it('should stop agent successfully', async () => {
      await agent.stop();
      
      const instance = (agent as any).instance;
      expect(instance.status).toBe('stopped');
    });

    it('should not stop already stopped agent', async () => {
      await agent.stop();
      await agent.stop(); // Should not throw
      
      const instance = (agent as any).instance;
      expect(instance.status).toBe('stopped');
    });

    it('should wait for current requests to complete', async () => {
      // Simulate load
      (agent as any).instance.currentLoad = 2;
      
      const stopPromise = agent.stop();
      
      // Verify agent is stopping
      const instance = (agent as any).instance;
      expect(instance.status).toBe('stopping');
      
      // Complete stop
      await stopPromise;
      expect(instance.status).toBe('stopped');
    });
  });

  describe('request', () => {
    beforeEach(async () => {
      await agent.start();
    });

    it('should make successful request', async () => {
      const response = await agent.request('Hello, world!');
      
      expect(typeof response).toBe('string');
      expect(response).toContain('Hello, world!');
      
      const instance = (agent as any).instance;
      expect(instance.totalRequests).toBe(1);
      expect(instance.currentLoad).toBe(0);
      expect(instance.successRate).toBe(100);
      expect(instance.consecutiveFailures).toBe(0);
    });

    it('should handle request timeout', async () => {
      const fastAgent = new Agent({
        id: 'fast-agent',
        name: 'Fast Agent',
        type: 'function',
        timeout: 100 // Very short timeout
      });

      await fastAgent.start();

      await expect(fastAgent.request('test', { timeout: 50 })).rejects.toThrow(
        'request failed'
      );

      const instance = (fastAgent as any).instance;
      expect(instance.errorCount).toBe(1);
      expect(instance.consecutiveFailures).toBe(1);
    });

    it('should handle retries', async () => {
      let attemptCount = 0;
      
      // Mock the executeRequest to fail twice then succeed
      vi.spyOn(agent as any, 'executeRequest').mockImplementation(async (prompt: string, options: any) => {
        attemptCount++;
        if (attemptCount <= 2) {
          throw new Error('Temporary failure');
        }
        return `Success after ${attemptCount} attempts`;
      });

      const response = await agent.request('test', { retries: 3 });
      
      expect(response).toBe('Success after 3 attempts');
      expect(attemptCount).toBe(3);
    });

    it('should throw error if agent is not healthy', async () => {
      await agent.stop();
      
      await expect(agent.request('test')).rejects.toThrow(
        'Agent test-agent is not healthy'
      );
    });

    it('should update metrics correctly', async () => {
      // Make multiple requests
      await agent.request('Request 1');
      await agent.request('Request 2');
      await agent.request('Request 3', { timeout: 1000 }); // Longer timeout
      
      const instance = (agent as any).instance;
      expect(instance.totalRequests).toBe(3);
      expect(instance.successRate).toBe(100);
      expect(instance.averageResponseTime).toBeGreaterThan(0);
      
      const metrics = agent.getMetrics();
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics.every(m => m.agentId === 'test-agent')).toBe(true);
    });

    it('should handle metadata in request options', async () => {
      const metadata = { userId: '123', sessionId: 'abc' };
      const response = await agent.request('test', { metadata });
      
      expect(typeof response).toBe('string');
    });
  });

  describe('performHealthCheck', () => {
    it('should return healthy result for healthy agent', async () => {
      const result = await agent.performHealthCheck();
      
      expect(result.agentId).toBe('test-agent');
      expect(result.status).toBe('healthy');
      expect(result.responseTime).toBeGreaterThan(0);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should handle different agent types', async () => {
      const openaiAgent = new Agent({
        id: 'openai-test',
        name: 'OpenAI Test',
        type: 'openai'
      });

      const claudeAgent = new Agent({
        id: 'claude-test',
        name: 'Claude Test',
        type: 'claude'
      });

      const functionAgent = new Agent({
        id: 'function-test',
        name: 'Function Test',
        type: 'function'
      });

      const openaiResult = await openaiAgent.performHealthCheck();
      const claudeResult = await claudeAgent.performHealthCheck();
      const functionResult = await functionAgent.performHealthCheck();
      
      expect(openaiResult.status).toBe('healthy');
      expect(claudeResult.status).toBe('healthy');
      expect(functionResult.status).toBe('healthy');
    });

    it('should return unhealthy result with error', async () => {
      // Create an agent that will fail health check
      const failingAgent = new Agent({
        id: 'failing-agent',
        name: 'Failing Agent',
        type: 'function'
      });

      // Mock the health check method to fail
      vi.spyOn(failingAgent as any, 'genericHealthCheck').mockRejectedValue(new Error('Health check failed'));

      const result = await failingAgent.performHealthCheck();
      
      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('Health check failed');
      expect(result.responseTime).toBeGreaterThan(0);
    });
  });

  describe('updateConfig', () => {
    it('should update agent configuration', () => {
      const newConfig = {
        maxConcurrent: 10,
        timeout: 60000,
        metadata: { environment: 'production' }
      };

      agent.updateConfig(newConfig);
      
      const config = agent.getConfig();
      expect(config.maxConcurrent).toBe(10);
      expect(config.timeout).toBe(60000);
      expect(config.metadata).toEqual({ environment: 'production' });
    });

    it('should not modify original config', () => {
      const originalConfig = { ...agent.getConfig() };
      
      agent.updateConfig({ maxConcurrent: 15 });
      
      expect(agent.getConfig().maxConcurrent).toBe(15);
      expect(originalConfig.maxConcurrent).toBe(5); // Should remain unchanged
    });
  });

  describe('getters', () => {
    it('should return correct id', () => {
      expect(agent.getId()).toBe('test-agent');
    });

    it('should return correct status', async () => {
      expect(agent.getStatus()).toBe('starting');
      
      await agent.start();
      expect(agent.getStatus()).toBe('healthy');
      
      await agent.stop();
      expect(agent.getStatus()).toBe('stopped');
    });

    it('should return correct config', () => {
      const config = agent.getConfig();
      expect(config.id).toBe('test-agent');
      expect(config.name).toBe('Test Agent');
      expect(config.type).toBe('claude');
    });

    it('should return instance copy', () => {
      const instance = agent.getInstance();
      expect(instance.id).toBe('test-agent');
      expect(instance.name).toBe('Test Agent');
      
      // Should be a copy, not the reference
      expect(instance).not.toBe((agent as any).instance);
    });

    it('should return metrics', async () => {
      const initialMetrics = agent.getMetrics();
      expect(Array.isArray(initialMetrics)).toBe(true);
      
      // Make a request to generate metrics
      await agent.start();
      await agent.request('test');
      const metrics = agent.getMetrics();
      expect(metrics.length).toBeGreaterThan(0);
    });
  });

  describe('stress test', () => {
    it('should handle concurrent requests', async () => {
      await agent.start();
      
      const concurrentRequests = 5;
      const requests = Array.from({ length: concurrentRequests }, (_, i) =>
        agent.request(`Concurrent request ${i}`)
      );
      
      const results = await Promise.all(requests);
      
      expect(results.length).toBe(concurrentRequests);
      expect(results.every(r => typeof r === 'string')).toBe(true);
      
      const instance = (agent as any).instance;
      expect(instance.totalRequests).toBe(concurrentRequests);
      expect(instance.successRate).toBe(100);
    });

    it('should handle rapid start/stop cycles', async () => {
      for (let i = 0; i < 3; i++) {
        await agent.start();
        expect(agent.getStatus()).toBe('healthy');
        
        await agent.stop();
        expect(agent.getStatus()).toBe('stopped');
      }
    });
  });
});