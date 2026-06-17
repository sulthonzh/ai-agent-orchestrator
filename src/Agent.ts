import { AgentConfig, AgentInstance, HealthCheckResult, MetricsData, RequestOptions } from './types.js';

export class Agent {
  private instance: AgentInstance;
  private healthCheckInterval?: NodeJS.Timeout;
  private metrics: MetricsData[] = [];

  constructor(config: AgentConfig) {
    this.instance = {
      id: config.id,
      config,
      status: 'starting',
      currentLoad: 0,
      totalRequests: 0,
      successRate: 0,
      averageResponseTime: 0,
      lastHealthCheck: new Date(),
      startedAt: new Date(),
      lastUsed: new Date(),
      errorCount: 0,
      consecutiveFailures: 0
    };
  }

  async start(): Promise<void> {
    if (this.instance.status !== 'stopped' && this.instance.status !== 'unhealthy') {
      throw new Error(`Agent ${this.instance.id} is already ${this.instance.status}`);
    }

    this.instance.status = 'starting';
    this.instance.startedAt = new Date();

    try {
      await this.performHealthCheck();
      this.instance.status = 'healthy';
      this.startHealthChecks();
      console.log(`✅ Agent ${this.instance.id} started successfully`);
    } catch (error) {
      this.instance.status = 'unhealthy';
      this.instance.consecutiveFailures++;
      throw new Error(`Failed to start agent ${this.instance.id}: ${error}`);
    }
  }

  async stop(): Promise<void> {
    if (this.instance.status === 'stopped') {
      return;
    }

    this.instance.status = 'stopping';
    
    // Stop health checks
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    // Wait for current requests to complete
    const maxWait = 5000;
    const startTime = Date.now();
    while (this.instance.currentLoad > 0 && Date.now() - startTime < maxWait) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.instance.status = 'stopped';
    console.log(`🛑 Agent ${this.instance.id} stopped`);
  }

  async request(prompt: string, options: RequestOptions = {}): Promise<string> {
    if (this.instance.status !== 'healthy') {
      throw new Error(`Agent ${this.instance.id} is not healthy (status: ${this.instance.status})`);
    }

    const startTime = Date.now();
    this.instance.currentLoad++;
    this.instance.totalRequests++;
    this.instance.lastUsed = new Date();

    try {
      const response = await this.executeRequest(prompt, options);
      const responseTime = Date.now() - startTime;

      // Update metrics
      this.updateMetrics(responseTime, true);
      
      this.instance.currentLoad--;
      this.instance.consecutiveFailures = 0; // Reset on success
      this.instance.successRate = this.calculateSuccessRate();

      return response;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.instance.currentLoad--;
      this.instance.errorCount++;
      this.instance.consecutiveFailures++;
      
      this.updateMetrics(responseTime, false);
      this.instance.successRate = this.calculateSuccessRate();

      throw new Error(`Agent ${this.instance.id} request failed: ${error}`);
    }
  }

  async performHealthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Simple health check - could be extended based on agent type
      if (this.instance.config.type === 'claude') {
        await this.checkClaudeHealth();
      } else if (this.instance.config.type === 'openai') {
        await this.checkOpenAIHealth();
      } else {
        // Generic health check
        await this.genericHealthCheck();
      }

      const responseTime = Date.now() - startTime;
      const result: HealthCheckResult = {
        agentId: this.instance.id,
        status: 'healthy',
        responseTime,
        timestamp: new Date()
      };

      this.instance.lastHealthCheck = new Date();
      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const result: HealthCheckResult = {
        agentId: this.instance.id,
        status: 'unhealthy',
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };

      this.instance.lastHealthCheck = new Date();
      return result;
    }
  }

  private async executeRequest(prompt: string, options: RequestOptions): Promise<string> {
    const timeout = options.timeout || this.instance.config.timeout || 30000;
    const maxRetries = options.retries || this.instance.config.retryCount || 0;

    let lastError: Error;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          await this.delay(Math.min(1000 * Math.pow(2, attempt), 5000));
        }

        switch (this.instance.config.type) {
          case 'claude':
            return await this.claudeRequest(prompt, timeout);
          case 'openai':
            return await this.openaiRequest(prompt, timeout);
          case 'function':
            return await this.functionRequest(prompt, options);
          default:
            return await this.genericRequest(prompt, timeout);
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt === maxRetries) {
          throw lastError;
        }
      }
    }

    throw lastError!;
  }

  private async claudeRequest(prompt: string, timeout: number): Promise<string> {
    // Placeholder for Claude API integration
    // In real implementation, this would use Anthropic's API
    await this.delay(Math.random() * 1000 + 500); // Simulate API call
    return `Claude response for: ${prompt}`;
  }

  private async openaiRequest(prompt: string, timeout: number): Promise<string> {
    // Placeholder for OpenAI API integration
    // In real implementation, this would use OpenAI's API
    await this.delay(Math.random() * 800 + 300); // Simulate API call
    return `OpenAI response for: ${prompt}`;
  }

  private async functionRequest(prompt: string, options: RequestOptions): Promise<string> {
    // Placeholder for function-based agents
    await this.delay(Math.random() * 200 + 100);
    return `Function response for: ${prompt}`;
  }

  private async genericRequest(prompt: string, timeout: number): Promise<string> {
    await this.delay(Math.random() * 500 + 200);
    return `Generic response for: ${prompt}`;
  }

  private async checkClaudeHealth(): Promise<void> {
    await this.delay(100); // Simulate health check
  }

  private async checkOpenAIHealth(): Promise<void> {
    await this.delay(100); // Simulate health check
  }

  private async genericHealthCheck(): Promise<void> {
    await this.delay(50); // Simulate health check
  }

  private startHealthChecks(): void {
    const interval = this.instance.config.healthCheckInterval || 30000; // 30 seconds default
    this.healthCheckInterval = setInterval(async () => {
      const result = await this.performHealthCheck();
      if (result.status === 'unhealthy') {
        this.instance.status = 'unhealthy';
        console.warn(`⚠️  Agent ${this.instance.id} health check failed: ${result.error}`);
      }
    }, interval);
  }

  private updateMetrics(responseTime: number, success: boolean): void {
    const now = new Date();
    const metric: MetricsData = {
      agentId: this.instance.id,
      timestamp: now,
      requests: 1,
      errors: success ? 0 : 1,
      averageResponseTime: responseTime,
      memoryUsage: process.memoryUsage().heapUsed,
      throughput: 1 / (responseTime / 1000)
    };

    this.metrics.push(metric);
    
    // Keep only recent metrics (last hour)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    this.metrics = this.metrics.filter(m => m.timestamp > oneHourAgo);

    // Update average response time
    const recentMetrics = this.metrics.slice(-10); // Last 10 requests
    if (recentMetrics.length > 0) {
      const totalResponseTime = recentMetrics.reduce((sum, m) => sum + m.averageResponseTime, 0);
      this.instance.averageResponseTime = totalResponseTime / recentMetrics.length;
    }
  }

  private calculateSuccessRate(): number {
    if (this.instance.totalRequests === 0) return 0;
    return ((this.instance.totalRequests - this.instance.errorCount) / this.instance.totalRequests) * 100;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public getters
  getId(): string {
    return this.instance.id;
  }

  getStatus(): AgentInstance['status'] {
    return this.instance.status;
  }

  getConfig(): AgentConfig {
    return this.instance.config;
  }

  getInstance(): AgentInstance {
    return { ...this.instance };
  }

  getMetrics(): MetricsData[] {
    return [...this.metrics];
  }

  updateConfig(newConfig: Partial<AgentConfig>): void {
    this.instance.config = { ...this.instance.config, ...newConfig };
  }
}