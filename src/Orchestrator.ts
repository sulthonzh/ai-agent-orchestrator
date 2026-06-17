import { Agent } from './Agent.js';
import { AgentConfig, AgentInstance, HealthCheckResult, LoadBalancingConfig, OrchestratorConfig, RequestOptions, Workflow, WorkflowStep, WorkflowExecution } from './types.js';

export class Orchestrator {
  private agents: Map<string, Agent> = new Map();
  private workflows: Map<string, Workflow> = new Map();
  private config: OrchestratorConfig;
  private loadBalancing: LoadBalancingConfig;

  constructor(config: Partial<OrchestratorConfig> = {}) {
    this.config = {
      agents: [],
      workflows: [],
      loadBalancing: {
        strategy: 'round-robin',
        healthCheckThreshold: 3,
        failoverTimeout: 5000
      },
      scaling: {
        minInstances: 1,
        maxInstances: 5,
        scaleUpThreshold: 0.8,
        scaleDownThreshold: 0.3,
        scaleUpCooldown: 30000,
        scaleDownCooldown: 60000,
        metrics: {
          requestRateThreshold: 10,
          errorRateThreshold: 0.1
        }
      },
      monitoring: {
        healthCheckInterval: 30000,
        metricsRetention: 3600000, // 1 hour
        alertThresholds: {
          errorRate: 0.1,
          responseTime: 5000,
          memoryUsage: 0.8
        }
      },
      ...config
    };

    this.loadBalancing = this.config.loadBalancing;
    
    // Initialize agents from config
    this.config.agents.forEach(agentConfig => {
      this.addAgent(agentConfig);
    });
  }

  addAgent(config: AgentConfig): Agent {
    const existingAgent = this.agents.get(config.id);
    if (existingAgent) {
      throw new Error(`Agent with ID ${config.id} already exists`);
    }

    const agent = new Agent(config);
    this.agents.set(config.id, agent);
    
    // Start the agent automatically
    agent.start().catch(error => {
      console.error(`Failed to start agent ${config.id}:`, error);
    });

    console.log(`🚀 Added agent: ${config.id} (${config.type})`);
    return agent;
  }

  removeAgent(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    agent.stop().catch(error => {
      console.error(`Error stopping agent ${agentId}:`, error);
    });
    
    this.agents.delete(agentId);
    console.log(`🗑️  Removed agent: ${agentId}`);
  }

  async requestToAgent(agentId: string, prompt: string, options: RequestOptions = {}): Promise<string> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    return agent.request(prompt, options);
  }

  async request(prompt: string, options: RequestOptions = {}): Promise<string> {
    const targetAgent = this.selectAgent(options.priority || 0);
    if (!targetAgent) {
      throw new Error('No healthy agents available');
    }

    return targetAgent.request(prompt, options);
  }

  async executeWorkflow(workflowId: string, input: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    if (workflow.status !== 'active') {
      throw new Error(`Workflow ${workflowId} is not active`);
    }

    const execution: WorkflowExecution = {
      id: `exec_${Date.now()}`,
      workflowId,
      status: 'running',
      startTime: new Date(),
      results: {},
      errors: [],
      progress: 0
    };

    try {
      const results = await this.executeWorkflowSteps(workflow, input, execution);
      execution.status = 'completed';
      execution.endTime = new Date();
      execution.progress = 100;
      
      workflow.executions.push(execution);
      return results;
    } catch (error) {
      execution.status = 'failed';
      execution.endTime = new Date();
      execution.errors.push(error instanceof Error ? error.message : String(error));
      
      workflow.executions.push(execution);
      throw error;
    }
  }

  createWorkflow(workflow: Omit<Workflow, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'executions'>): Workflow {
    const id = `workflow_${Date.now()}`;
    const now = new Date();
    
    const newWorkflow: Workflow = {
      id,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      executions: [],
      ...workflow
    };

    this.workflows.set(id, newWorkflow);
    console.log(`📝 Created workflow: ${id}`);
    return newWorkflow;
  }

  updateWorkflow(workflowId: string, updates: Partial<Workflow>): Workflow {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const updatedWorkflow = {
      ...workflow,
      ...updates,
      updatedAt: new Date()
    };

    this.workflows.set(workflowId, updatedWorkflow);
    return updatedWorkflow;
  }

  deleteWorkflow(workflowId: string): void {
    if (!this.workflows.has(workflowId)) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    this.workflows.delete(workflowId);
    console.log(`🗑️  Deleted workflow: ${workflowId}`);
  }

  async performHealthChecks(): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];
    
    for (const agent of this.agents.values()) {
      try {
        const result = await agent.performHealthCheck();
        results.push(result);
      } catch (error) {
        results.push({
          agentId: agent.getId(),
          status: 'unhealthy',
          responseTime: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date()
        });
      }
    }

    return results;
  }

  getAgentStats(): AgentInstance[] {
    return Array.from(this.agents.values()).map(agent => agent.getInstance());
  }

  getWorkflowStats(): Workflow[] {
    return Array.from(this.workflows.values());
  }

  private selectAgent(priority: number): Agent | null {
    const healthyAgents = Array.from(this.agents.values()).filter(agent => 
      agent.getStatus() === 'healthy'
    );

    if (healthyAgents.length === 0) {
      return null;
    }

    switch (this.loadBalancing.strategy) {
      case 'round-robin':
        return this.roundRobinSelection(healthyAgents);
      case 'least-connections':
        return this.leastConnectionsSelection(healthyAgents);
      case 'weighted':
        return this.weightedSelection(healthyAgents);
      case 'random':
        return this.randomSelection(healthyAgents);
      default:
        return healthyAgents[0];
    }
  }

  private roundRobinSelection(agents: Agent[]): Agent {
    // Simple round-robin implementation
    const currentIndex = (agents.length * 1000) % agents.length;
    return agents[currentIndex];
  }

  private leastConnectionsSelection(agents: Agent[]): Agent {
    return agents.reduce((least, current) => 
      current.getInstance().currentLoad < least.getInstance().currentLoad ? current : least
    );
  }

  private weightedSelection(agents: Agent[]): Agent {
    // Weighted selection based on configured weights or performance
    const weights = this.loadBalancing.weights || {};
    const totalWeight = agents.reduce((sum, agent) => {
      const agentId = agent.getId();
      const weight = weights[agentId] || 1;
      return sum + weight;
    }, 0);

    const random = Math.random() * totalWeight;
    let currentWeight = 0;

    for (const agent of agents) {
      const agentId = agent.getId();
      const weight = weights[agentId] || 1;
      currentWeight += weight;
      
      if (random <= currentWeight) {
        return agent;
      }
    }

    return agents[0]; // Fallback
  }

  private randomSelection(agents: Agent[]): Agent {
    return agents[Math.floor(Math.random() * agents.length)];
  }

  private async executeWorkflowSteps(
    workflow: Workflow, 
    input: Record<string, unknown>, 
    execution: WorkflowExecution
  ): Promise<Record<string, unknown>> {
    const results: Record<string, unknown> = { ...input };
    const completedSteps = new Set<string>();

    for (const step of workflow.steps) {
      // Check dependencies
      if (step.dependencies) {
        for (const depId of step.dependencies) {
          if (!completedSteps.has(depId)) {
            throw new Error(`Step ${step.id} depends on ${depId} which is not completed`);
          }
        }
      }

      // Check condition if specified
      if (step.condition) {
        try {
          const shouldExecute = this.evaluateCondition(step.condition, results);
          if (!shouldExecute) {
            execution.results[step.id] = { skipped: true };
            continue;
          }
        } catch (error) {
          throw new Error(`Condition evaluation failed for step ${step.id}: ${error}`);
        }
      }

      try {
        const agent = this.agents.get(step.agentId);
        if (!agent) {
          throw new Error(`Agent ${step.agentId} not found for step ${step.id}`);
        }

        const stepInput = { ...input, ...step.input };
        const response = await agent.request(JSON.stringify(stepInput));
        
        results[step.id] = response;
        execution.results[step.id] = { success: true, response };
        completedSteps.add(step.id);

        // Update progress
        execution.progress = (completedSteps.size / workflow.steps.length) * 100;

      } catch (error) {
        execution.errors.push(`Step ${step.id} failed: ${error}`);
        throw error;
      }
    }

    return results;
  }

  private evaluateCondition(condition: string, context: Record<string, unknown>): boolean {
    // Simple condition evaluation - in real implementation, this would use a proper expression evaluator
    try {
      // Basic condition support (can be extended)
      if (condition.includes('==')) {
        const [left, right] = condition.split('==').map(s => s.trim());
        return this.evaluateExpression(left, context) === this.evaluateExpression(right, context);
      }
      
      if (condition.includes('!=')) {
        const [left, right] = condition.split('!=').map(s => s.trim());
        return this.evaluateExpression(left, context) !== this.evaluateExpression(right, context);
      }

      if (condition.includes('>=')) {
        const [left, right] = condition.split('>=').map(s => s.trim());
        return Number(this.evaluateExpression(left, context)) >= Number(this.evaluateExpression(right, context));
      }

      if (condition.includes('<=')) {
        const [left, right] = condition.split('<=').map(s => s.trim());
        return Number(this.evaluateExpression(left, context)) <= Number(this.evaluateExpression(right, context));
      }

      if (condition.includes('&&')) {
        const [left, right] = condition.split('&&').map(s => s.trim());
        return this.evaluateCondition(left, context) && this.evaluateCondition(right, context);
      }

      if (condition.includes('||')) {
        const [left, right] = condition.split('||').map(s => s.trim());
        return this.evaluateCondition(left, context) || this.evaluateCondition(right, context);
      }

      // Default: check if the condition exists in context
      return this.evaluateExpression(condition, context) !== undefined;

    } catch (error) {
      console.warn(`Condition evaluation failed for "${condition}":`, error);
      return false;
    }
  }

  private evaluateExpression(expr: string, context: Record<string, unknown>): unknown {
    // Simple expression evaluation - can be extended with more complex parsing
    if (expr.startsWith('${') && expr.endsWith('}')) {
      // Template string: ${variable}
      const varName = expr.slice(2, -1);
      return this.getNestedValue(context, varName);
    }
    
    // Try to parse as number
    const num = Number(expr);
    if (!isNaN(num)) {
      return num;
    }

    // Try to parse as boolean
    if (expr.toLowerCase() === 'true') return true;
    if (expr.toLowerCase() === 'false') return false;

    // Return as-is (variable name or literal)
    return this.getNestedValue(context, expr);
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current, key) => {
      return current && typeof current === 'object' ? (current as Record<string, unknown>)[key] : undefined;
    }, obj);
  }
}