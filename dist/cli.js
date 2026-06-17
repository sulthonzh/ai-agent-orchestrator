#!/usr/bin/env node
import { Orchestrator } from './Orchestrator.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename$1 = fileURLToPath(import.meta.url);
dirname(__filename$1);
function parseArgs(args) {
  const result = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg && arg.startsWith("--")) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith("--")) {
        result[key] = nextArg;
        i++;
      } else {
        result[key] = true;
      }
    } else if (arg && arg.startsWith("-")) {
      const key = arg.slice(1);
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith("-")) {
        result[key] = nextArg;
        i++;
      } else {
        result[key] = true;
      }
    }
  }
  return result;
}
function printHelp() {
  console.log(`
\u{1F916} AI Agent Orchestrator - Zero-dependency orchestration platform

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
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === "help" || args[0] === "--help" || args[0] === "-h") {
    printHelp();
    process.exit(0);
  }
  const command = args[0];
  const cmdArgs = parseArgs(args.slice(1));
  try {
    switch (command) {
      case "agent":
        await handleAgentCommand(cmdArgs);
        break;
      case "request":
        await handleRequestCommand(cmdArgs);
        break;
      case "workflow":
        await handleWorkflowCommand(cmdArgs);
        break;
      case "health":
        await handleHealthCommand();
        break;
      case "demo":
        await handleDemoCommand();
        break;
      case "interactive":
        await handleInteractiveCommand();
        break;
      default:
        console.error(`\u274C Unknown command: ${command}`);
        printHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error("\u274C Error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
async function handleAgentCommand(cmdArgs) {
  if (cmdArgs.add) {
    if (!cmdArgs.id || !cmdArgs.name || !cmdArgs.type) {
      console.error("\u274C Missing required arguments: --id, --name, --type");
      process.exit(1);
    }
    const config = {
      id: cmdArgs.id,
      name: cmdArgs.name,
      type: cmdArgs.type,
      model: cmdArgs.model,
      endpoint: cmdArgs.endpoint,
      apiKey: cmdArgs.apiKey,
      maxConcurrent: cmdArgs.maxConcurrent ? parseInt(cmdArgs.maxConcurrent) : void 0,
      timeout: cmdArgs.timeout ? parseInt(cmdArgs.timeout) : void 0,
      retryCount: cmdArgs.retryCount ? parseInt(cmdArgs.retryCount) : void 0
    };
    const orchestrator = new Orchestrator();
    orchestrator.addAgent(config);
    console.log(`\u2705 Agent ${config.id} added successfully`);
  } else if (cmdArgs.list) {
    const orchestrator = new Orchestrator();
    const agents = orchestrator.getAgentStats();
    if (agents.length === 0) {
      console.log("No agents found");
      return;
    }
    console.log("\n\u{1F916} AI Agents:\n");
    agents.forEach((agent) => {
      const statusEmoji = agent.status === "healthy" ? "\u2705" : agent.status === "unhealthy" ? "\u274C" : agent.status === "starting" ? "\u{1F504}" : "\u{1F6D1}";
      console.log(`${statusEmoji} ${agent.config.name} (${agent.config.type})`);
      console.log(`   ID: ${agent.id}`);
      console.log(`   Status: ${agent.status}`);
      console.log(`   Load: ${agent.currentLoad}/\u221E`);
      console.log(`   Success Rate: ${agent.successRate.toFixed(1)}%`);
      console.log(`   Response Time: ${agent.averageResponseTime.toFixed(0)}ms`);
      console.log(`   Total Requests: ${agent.totalRequests}`);
      console.log();
    });
  } else if (cmdArgs.remove) {
    if (!cmdArgs.id) {
      console.error("\u274C Missing required argument: --id");
      process.exit(1);
    }
    const orchestrator = new Orchestrator();
    orchestrator.removeAgent(cmdArgs.id);
    console.log(`\u2705 Agent ${cmdArgs.id} removed successfully`);
  } else {
    console.error('\u274C Missing subcommand. Use "agent add", "agent list", or "agent remove"');
    process.exit(1);
  }
}
async function handleRequestCommand(cmdArgs) {
  if (!cmdArgs.agentId || !cmdArgs.prompt) {
    console.error("\u274C Missing required arguments: --agent-id, --prompt");
    process.exit(1);
  }
  const orchestrator = new Orchestrator();
  const options = {};
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
  console.log("\u{1F4DD} Response:");
  console.log(result);
}
async function handleWorkflowCommand(cmdArgs) {
  if (cmdArgs.create) {
    if (!cmdArgs.name || !cmdArgs.steps) {
      console.error("\u274C Missing required arguments: --name, --steps");
      process.exit(1);
    }
    try {
      const orchestrator = new Orchestrator();
      const steps = JSON.parse(cmdArgs.steps);
      const workflow = orchestrator.createWorkflow({
        name: cmdArgs.name,
        description: cmdArgs.description,
        steps
      });
      console.log(`\u2705 Workflow ${workflow.id} created successfully`);
      console.log(`\u{1F4CB} Name: ${workflow.name}`);
      console.log(`\u{1F522} Steps: ${workflow.steps.length}`);
    } catch (error) {
      console.error("\u274C Failed to create workflow:", error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  } else if (cmdArgs.list) {
    const orchestrator = new Orchestrator();
    const workflows = orchestrator.getWorkflowStats();
    if (workflows.length === 0) {
      console.log("No workflows found");
      return;
    }
    console.log("\n\u{1F504} Workflows:\n");
    workflows.forEach((workflow) => {
      const statusEmoji = workflow.status === "active" ? "\u2705" : workflow.status === "draft" ? "\u{1F4DD}" : workflow.status === "paused" ? "\u23F8\uFE0F" : workflow.status === "completed" ? "\u2705" : "\u274C";
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
  } else {
    console.error('\u274C Missing subcommand. Use "workflow create" or "workflow list"');
    process.exit(1);
  }
}
async function handleHealthCommand() {
  const orchestrator = new Orchestrator();
  const results = await orchestrator.performHealthChecks();
  if (results.length === 0) {
    console.log("No agents to check");
    return;
  }
  const healthy = results.filter((r) => r.status === "healthy").length;
  const unhealthy = results.filter((r) => r.status === "unhealthy").length;
  console.log("\n\u{1F3E5} Health Check Results:\n");
  console.log(`\u2705 Healthy: ${healthy}`);
  console.log(`\u274C Unhealthy: ${unhealthy}
`);
  results.forEach((result) => {
    const statusEmoji = result.status === "healthy" ? "\u2705" : "\u274C";
    console.log(`${statusEmoji} Agent ${result.agentId}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    console.log(`   Response Time: ${result.responseTime}ms`);
    console.log();
  });
}
async function handleDemoCommand() {
  console.log("\u{1F680} Starting AI Agent Orchestrator Demo...\n");
  const orchestrator = new Orchestrator();
  console.log("\u{1F4E6} Adding demo agents...");
  orchestrator.addAgent({
    id: "claude-demo",
    name: "Claude Assistant",
    type: "claude",
    model: "claude-3-sonnet",
    maxConcurrent: 5,
    timeout: 3e4
  });
  orchestrator.addAgent({
    id: "openai-demo",
    name: "OpenAI Assistant",
    type: "openai",
    model: "gpt-3.5-turbo",
    maxConcurrent: 3,
    timeout: 25e3
  });
  await new Promise((resolve) => setTimeout(resolve, 2e3));
  console.log("\n\u{1F4DD} Testing direct requests...");
  try {
    const claudeResponse = await orchestrator.requestToAgent(
      "claude-demo",
      "Hello! Can you help me understand AI orchestration?"
    );
    console.log(`Claude Response: ${claudeResponse}`);
  } catch (error) {
    console.log(`Claude request failed: ${error}`);
  }
  try {
    const openaiResponse = await orchestrator.requestToAgent(
      "openai-demo",
      "What are the benefits of multi-agent systems?"
    );
    console.log(`OpenAI Response: ${openaiResponse}`);
  } catch (error) {
    console.log(`OpenAI request failed: ${error}`);
  }
  console.log("\n\u{1F916} Current Agents:");
  const agents = orchestrator.getAgentStats();
  agents.forEach((agent) => {
    console.log(`- ${agent.config.name}: ${agent.status} (${agent.currentLoad} active requests)`);
  });
  console.log("\n\u{1F3E5} Performing health checks...");
  const healthResults = await orchestrator.performHealthChecks();
  healthResults.forEach((result) => {
    console.log(`Agent ${result.agentId}: ${result.status} (${result.responseTime}ms)`);
  });
  console.log("\n\u{1F9F9} Cleaning up...");
  orchestrator.removeAgent("claude-demo");
  orchestrator.removeAgent("openai-demo");
  console.log("\n\u{1F389} Demo completed successfully!");
}
async function handleInteractiveCommand() {
  console.log("\u{1F3AE} AI Agent Orchestrator Interactive Mode");
  console.log('Type "help" for commands or "exit" to quit\n');
  const orchestrator = new Orchestrator();
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "> "
  });
  rl.prompt();
  rl.on("line", async (line) => {
    const input = line.trim();
    if (input === "exit") {
      rl.close();
      return;
    }
    if (input === "help") {
      console.log("\nAvailable commands:");
      console.log("  add-agent <id> <name> <type> [model] - Add an agent");
      console.log("  list-agents - List all agents");
      console.log("  health - Check agent health");
      console.log("  request <agent-id> <prompt> - Make a request");
      console.log("  demo - Run demo");
      console.log("  help - Show this help");
      console.log("  exit - Quit interactive mode\n");
      rl.prompt();
      return;
    }
    if (input === "demo") {
      await handleDemoCommand();
      rl.prompt();
      return;
    }
    if (input === "health") {
      await handleHealthCommand();
      rl.prompt();
      return;
    }
    if (input === "list-agents") {
      const cmdArgs = { list: true };
      await handleAgentCommand(cmdArgs);
      rl.prompt();
      return;
    }
    if (input.startsWith("request ")) {
      const parts = input.split(" ");
      if (parts.length >= 3) {
        const agentId = parts[1];
        const prompt = parts.slice(2).join(" ");
        if (agentId && prompt) {
          try {
            const result = await orchestrator.requestToAgent(agentId, prompt);
            console.log("\u{1F4DD} Response:", result);
          } catch (error) {
            console.log("\u274C Error:", error instanceof Error ? error.message : String(error));
          }
        } else {
          console.log("\u274C Missing agent ID or prompt");
        }
      } else {
        console.log("Usage: request <agent-id> <prompt>");
      }
      rl.prompt();
      return;
    }
    if (input.startsWith("add-agent ")) {
      const parts = input.split(" ");
      if (parts.length >= 4) {
        const id = parts[1];
        const name = parts[2];
        const type = parts[3];
        const model = parts[4] || void 0;
        if (id && name && type) {
          try {
            orchestrator.addAgent({
              id,
              name,
              type,
              model
            });
            console.log(`\u2705 Agent ${id} added`);
          } catch (error) {
            console.log("\u274C Error:", error instanceof Error ? error.message : String(error));
          }
        } else {
          console.log("\u274C Missing required arguments: id, name, or type");
        }
      } else {
        console.log("Usage: add-agent <id> <name> <type> [model]");
      }
      rl.prompt();
      return;
    }
    console.log('Unknown command. Type "help" for available commands.');
    rl.prompt();
  });
  rl.on("close", () => {
    console.log("\n\u{1F44B} Goodbye!");
    process.exit(0);
  });
}
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
//# sourceMappingURL=cli.js.map
//# sourceMappingURL=cli.js.map