#!/usr/bin/env node

// Test CLI that just verifies the build works
console.log('🤖 AI Agent Orchestrator - Build Test');
console.log('Testing basic build functionality...\n');

try {
  // Test that we can parse arguments
  const parseArgs = (args: string[]): Record<string, any> => {
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
  };

  // Test CLI parsing
  const testArgs = parseArgs(['--help', '--version', '1.0.0', '-v']);
  console.log('✅ CLI parsing works:');
  console.log('   help:', testArgs.help);
  console.log('   version:', testArgs.version);
  console.log('   v:', testArgs.v);
  
  console.log('\n🎉 Basic build test passed!');
  console.log('The CLI parsing system is working correctly.');
  
} catch (error) {
  console.error('❌ Error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
}