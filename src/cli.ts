#!/usr/bin/env node

import { Orchestrator } from './Orchestrator.js';
import { AgentConfig, WorkflowStep, RequestOptions } from './types.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
// ESM equivalent of __dirname
void __filename;

// Simple CLI parser
function parseArgs(args: string[]): Record<string, any> {
  const result: Record<string, any> = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg && arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];
      
      if (nextArg && !nextArg.startsWith('--')) {
        result[key] = nextArg;
        i++;
      } else {
        result[key] = true;
      }
    } else if (arg && arg.startsWith('-')) {
      const key = arg.slice(1);
      const nextArg = args[i + 1];
      
      if (nextArg && !nextArg.startsWith('-')) {
        result[key] = nextArg;
        i++;
      } else {
        result[key] = true;
      }
    }
  }
  
  return result;
}

function printHelp(): void {
  console.log(`
🤖 AI Agent Orchestrator - Zero-dependency orchestration platform

Usage: aaor <command> [options]

Commands:
  agent add     - Add a new agent
  agent list    - List all agents  
  agent remove  - Remove an agent
  
  request       - Make a request to an agent
  workflow create - Create a new workflow
  workflow list - List all workflows
  
  health        - Perform health checks
  demo          - Run a demonstration
  interactive   - Start interactive mode

Agent Add Options:
  --id, -i <id>           Agent ID (required)
  --name, -n <name>       Agent name (required)
  --type, -t <type>       Agent type: claude|openai|anthropic|custom|function (required)
  --model, -m <model>     Model name
  --endpoint, -e <url>     API endpoint
  --api-key, -k <key>     API key
  --max-concurrent <num>  Max concurrent requests
  --timeout <ms>         Request timeout
  --retry-count <num>     Number of retries

Request Options:
  --agent-id, -i <id>     Agent ID (required)
  --prompt, -p <text>    Prompt to send (required)
  --timeout <ms>         Request timeout
  --retries <num>        Number of retries
  --priority <num>       Request priority

Workflow Create Options:
  --name, -n <name>      Workflow name (required)
  --description <desc>   Workflow description
  --steps <json>         JSON string of workflow steps (required)

Examples:
  aaor agent add --id claude1 --name "My Claude" --type claude --model claude-3-sonnet
  aaor agent list
  aaor request --agent-id claude1 --prompt "Hello, world!"
  aaor health
  aaor demo
  aaor interactive
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
    printHelp();
    process.exit(0);
  }

  const command = args[0];
  const cmdArgs = parseArgs(args.slice(1));

  try {
    switch (command) {
      case 'agent':
        await handleAgentCommand(cmdArgs);
        break;
      case 'request':
        await handleRequestCommand(cmdArgs);
        break;
      case 'workflow':
        await handleWorkflowCommand(cmdArgs);
        break;
      case 'health':
        await handleHealthCommand();
        break;
      case 'demo':
        await handleDemoCommand();
        break;
      case 'interactive':
        await handleInteractiveCommand();
        break;
      default:
        console.error(`❌ Unknown command: ${command}`);
        printHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function handleAgentCommand(cmdArgs: Record<string, any>): Promise<void> {
  if (cmdArgs.add) {
    if (!cmdArgs.id || !cmdArgs.name || !cmdArgs.type) {
      console.error('❌ Missing required arguments: --id, --name, --type');
      process.exit(1);
    }

    const config: AgentConfig = {
      id: cmdArgs.id!,
      name: cmdArgs.name!,
      type: cmdArgs.type!,
      model: cmdArgs.model,
      endpoint: cmdArgs.endpoint,
      apiKey: cmdArgs.apiKey,
      maxConcurrent: cmdArgs.maxConcurrent ? parseInt(cmdArgs.maxConcurrent) : undefined,
      timeout: cmdArgs.timeout ? parseInt(cmdArgs.timeout) : undefined,
      retryCount: cmdArgs.retryCount ? parseInt(cmdArgs.retryCount) : undefined
    };

    const orchestrator = new Orchestrator();
    orchestrator.addAgent(config);
    console.log(`✅ Agent ${config.id} added successfully`);
  } 
  else if (cmdArgs.list) {
    const orchestrator = new Orchestrator();
    const agents = orchestrator.getAgentStats();
    
    if (agents.length === 0) {
      console.log('No agents found');
      return;
    }

    console.log('\n🤖 AI Agents:\n');
    agents.forEach(agent => {
      const statusEmoji = agent.status === 'healthy' ? '✅' : 
                         agent.status === 'unhealthy' ? '❌' : 
                         agent.status === 'starting' ? '🔄' : '🛑';
      
      console.log(`${statusEmoji} ${agent.config.name} (${agent.config.type})`);
      console.log(`   ID: ${agent.id}`);
      console.log(`   Status: ${agent.status}`);
      console.log(`   Load: ${agent.currentLoad}/∞`);
      console.log(`   Success Rate: ${agent.successRate.toFixed(1)}%`);
      console.log(`   Response Time: ${agent.averageResponseTime.toFixed(0)}ms`);
      console.log(`   Total Requests: ${agent.totalRequests}`);
      console.log();
    });
  } 
  else if (cmdArgs.remove) {
    if (!cmdArgs.id) {
      console.error('❌ Missing required argument: --id');
      process.exit(1);
    }

    const orchestrator = new Orchestrator();
    await orchestrator.removeAgent(cmdArgs.id);
    console.log(`✅ Agent ${cmdArgs.id} removed successfully`);
  } 
  else {
    console.error('❌ Missing subcommand. Use "agent add", "agent list", or "agent remove"');
    process.exit(1);
  }
}

async function handleRequestCommand(cmdArgs: Record<string, any>): Promise<void> {
  if (!cmdArgs.agentId || !cmdArgs.prompt) {
    console.error('❌ Missing required arguments: --agent-id, --prompt');
    process.exit(1);
  }

  const orchestrator = new Orchestrator();
  const options: RequestOptions = {};
  
  if (cmdArgs.timeout) {
    options.timeout = parseInt(cmdArgs.timeout);
  }
  
  if (cmdArgs.retries) {
    options.retries = parseInt(cmdArgs.retries);
  }
  
  if (cmdArgs.priority) {
    options.priority = parseInt(cmdArgs.priority);
  }

  const result = await orchestrator.requestToAgent(
    cmdArgs.agentId,
    cmdArgs.prompt,
    options
  );
  
  console.log('📝 Response:');
  console.log(result);
}

async function handleWorkflowCommand(cmdArgs: Record<string, any>): Promise<void> {
  if (cmdArgs.create) {
    if (!cmdArgs.name || !cmdArgs.steps) {
      console.error('❌ Missing required arguments: --name, --steps');
      process.exit(1);
    }

    try {
      const orchestrator = new Orchestrator();
      const steps: WorkflowStep[] = JSON.parse(cmdArgs.steps);
      
      const workflow = orchestrator.createWorkflow({
        name: cmdArgs.name,
        description: cmdArgs.description,
        steps
      });
      
      console.log(`✅ Workflow ${workflow.id} created successfully`);
      console.log(`📋 Name: ${workflow.name}`);
      console.log(`🔢 Steps: ${workflow.steps.length}`);
    } catch (error) {
      console.error('❌ Failed to create workflow:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  } 
  else if (cmdArgs.list) {
    const orchestrator = new Orchestrator();
    const workflows = orchestrator.getWorkflowStats();
    
    if (workflows.length === 0) {
      console.log('No workflows found');
      return;
    }

    console.log('\n🔄 Workflows:\n');
    workflows.forEach(workflow => {
      const statusEmoji = workflow.status === 'active' ? '✅' : 
                         workflow.status === 'draft' ? '📝' : 
                         workflow.status === 'paused' ? '⏸️' : 
                         workflow.status === 'completed' ? '✅' : '❌';
      
      console.log(`${statusEmoji} ${workflow.name}`);
      console.log(`   ID: ${workflow.id}`);
      console.log(`   Status: ${workflow.status}`);
      console.log(`   Steps: ${workflow.steps.length}`);
      console.log(`   Executions: ${workflow.executions.length}`);
      if (workflow.description) {
        console.log(`   Description: ${workflow.description}`);
      }
      console.log();
    });
  } 
  else {
    console.error('❌ Missing subcommand. Use "workflow create" or "workflow list"');
    process.exit(1);
  }
}

async function handleHealthCommand(): Promise<void> {
  const orchestrator = new Orchestrator();
  const results = await orchestrator.performHealthChecks();
  
  if (results.length === 0) {
    console.log('No agents to check');
    return;
  }

  const healthy = results.filter(r => r.status === 'healthy').length;
  const unhealthy = results.filter(r => r.status === 'unhealthy').length;

  console.log('\n🏥 Health Check Results:\n');
  console.log(`✅ Healthy: ${healthy}`);
  console.log(`❌ Unhealthy: ${unhealthy}\n`);

  results.forEach(result => {
    const statusEmoji = result.status === 'healthy' ? '✅' : '❌';
    console.log(`${statusEmoji} Agent ${result.agentId}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    console.log(`   Response Time: ${result.responseTime}ms`);
    console.log();
  });
}

async function handleDemoCommand(): Promise<void> {
  console.log('🚀 Starting AI Agent Orchestrator Demo...\n');

  const orchestrator = new Orchestrator();

  // Add demo agents
  console.log('📦 Adding demo agents...');
  orchestrator.addAgent({
    id: 'claude-demo',
    name: 'Claude Assistant',
    type: 'claude',
    model: 'claude-3-sonnet',
    maxConcurrent: 5,
    timeout: 30000
  });

  orchestrator.addAgent({
    id: 'openai-demo',
    name: 'OpenAI Assistant',
    type: 'openai',
    model: 'gpt-3.5-turbo',
    maxConcurrent: 3,
    timeout: 25000
  });

  // Wait for agents to start
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test direct requests
  console.log('\n📝 Testing direct requests...');
  try {
    const claudeResponse = await orchestrator.requestToAgent(
      'claude-demo', 
      'Hello! Can you help me understand AI orchestration?'
    );
    console.log(`Claude Response: ${claudeResponse}`);
  } catch (error) {
    console.log(`Claude request failed: ${error}`);
  }

  try {
    const openaiResponse = await orchestrator.requestToAgent(
      'openai-demo', 
      'What are the benefits of multi-agent systems?'
    );
    console.log(`OpenAI Response: ${openaiResponse}`);
  } catch (error) {
    console.log(`OpenAI request failed: ${error}`);
  }

  // List agents
  console.log('\n🤖 Current Agents:');
  const agents = orchestrator.getAgentStats();
  agents.forEach(agent => {
    console.log(`- ${agent.config.name}: ${agent.status} (${agent.currentLoad} active requests)`);
  });

  // Perform health checks
  console.log('\n🏥 Performing health checks...');
  const healthResults = await orchestrator.performHealthChecks();
  healthResults.forEach(result => {
    console.log(`Agent ${result.agentId}: ${result.status} (${result.responseTime}ms)`);
  });

  // Clean up
  console.log('\n🧹 Cleaning up...');
  await orchestrator.shutdown();

  console.log('\n🎉 Demo completed successfully!');
}

async function handleInteractiveCommand(): Promise<void> {
  console.log('🎮 AI Agent Orchestrator Interactive Mode');
  console.log('Type "help" for commands or "exit" to quit\n');

  const orchestrator = new Orchestrator();

  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> '
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    
    if (input === 'exit') {
      rl.close();
      return;
    }

    if (input === 'help') {
      console.log('\nAvailable commands:');
      console.log('  add-agent <id> <name> <type> [model] - Add an agent');
      console.log('  list-agents - List all agents');
      console.log('  health - Check agent health');
      console.log('  request <agent-id> <prompt> - Make a request');
      console.log('  demo - Run demo');
      console.log('  help - Show this help');
      console.log('  exit - Quit interactive mode\n');
      rl.prompt();
      return;
    }

    if (input === 'demo') {
      await handleDemoCommand();
      rl.prompt();
      return;
    }

    if (input === 'health') {
      await handleHealthCommand();
      rl.prompt();
      return;
    }

    if (input === 'list-agents') {
      const cmdArgs = { list: true };
      await handleAgentCommand(cmdArgs);
      rl.prompt();
      return;
    }

    if (input.startsWith('request ')) {
      const parts = input.split(' ');
      if (parts.length >= 3) {
        const agentId = parts[1];
        const prompt = parts.slice(2).join(' ');
        
        if (agentId && prompt) {
          try {
            const result = await orchestrator.requestToAgent(agentId, prompt);
            console.log('📝 Response:', result);
          } catch (error) {
            console.log('❌ Error:', error instanceof Error ? error.message : String(error));
          }
        } else {
          console.log('❌ Missing agent ID or prompt');
        }
      } else {
        console.log('Usage: request <agent-id> <prompt>');
      }
      rl.prompt();
      return;
    }

    if (input.startsWith('add-agent ')) {
      const parts = input.split(' ');
      if (parts.length >= 4) {
        const id = parts[1];
        const name = parts[2];
        const type = parts[3];
        const model = parts[4] || undefined;
        
        if (id && name && type) {
          try {
            orchestrator.addAgent({
              id,
              name,
              type: type as any,
              model
            });
            console.log(`✅ Agent ${id} added`);
        } catch (error) {
          console.log('❌ Error:', error instanceof Error ? error.message : String(error));
        }
        } else {
          console.log('❌ Missing required arguments: id, name, or type');
        }
      } else {
        console.log('Usage: add-agent <id> <name> <type> [model]');
      }
      rl.prompt();
      return;
    }

    console.log('Unknown command. Type "help" for available commands.');
    rl.prompt();
  });

  rl.on('close', () => {
    console.log('\n👋 Goodbye!');
    process.exit(0);
  });
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});