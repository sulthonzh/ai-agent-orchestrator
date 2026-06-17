#!/usr/bin/env node

// Simple CLI to test basic functionality
console.log('🤖 AI Agent Orchestrator - Test CLI');
console.log('Testing basic build and import functionality...\n');

try {
  // Test importing the main module
  const { Orchestrator } = await import('./index.js');
  console.log('✅ Successfully imported Orchestrator');
  
  // Test basic functionality
  const orchestrator = new Orchestrator();
  console.log('✅ Successfully created orchestrator instance');
  
  // Test CLI parsing
  const { parseArgs } = await import('./cli.js');
  const testArgs = parseArgs(['--help']);
  console.log('✅ CLI parsing works:', testArgs.help);
  
  console.log('\n🎉 All basic tests passed!');
  console.log('The build system is working correctly.');
  
} catch (error) {
  console.error('❌ Error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
}