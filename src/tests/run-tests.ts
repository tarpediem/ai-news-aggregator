/**
 * Test runner script for comprehensive testing
 */

import { execSync } from 'child_process';
import { performance } from 'perf_hooks';

interface TestResult {
  name: string;
  duration: number;
  passed: boolean;
  coverage?: number;
  output?: string;
  errors?: string[];
}

interface TestSuite {
  name: string;
  command: string;
  description: string;
  required: boolean;
}

class TestRunner {
  private results: TestResult[] = [];
  private startTime = 0;

  private testSuites: TestSuite[] = [
    {
      name: 'Unit Tests',
      command: 'vitest run src/tests/unit --reporter=verbose',
      description: 'Run all unit tests with detailed output',
      required: true,
    },
    {
      name: 'Integration Tests',
      command: 'vitest run src/tests/integration --reporter=verbose',
      description: 'Run integration tests for complete workflows',
      required: true,
    },
    {
      name: 'Coverage Report',
      command: 'vitest run --coverage',
      description: 'Generate code coverage report',
      required: false,
    },
    {
      name: 'Type Checking',
      command: 'tsc --noEmit',
      description: 'Check TypeScript types',
      required: true,
    },
    {
      name: 'Linting',
      command: 'eslint src/**/*.{ts,tsx} --max-warnings=0',
      description: 'Run ESLint with no warnings allowed',
      required: true,
    },
    {
      name: 'Format Check',
      command: 'prettier --check src/**/*.{ts,tsx}',
      description: 'Check code formatting',
      required: false,
    },
  ];

  async runAll(): Promise<void> {
    console.log('🚀 Starting comprehensive test suite...\n');
    this.startTime = performance.now();

    for (const suite of this.testSuites) {
      await this.runTestSuite(suite);
    }

    this.printSummary();
  }

  private async runTestSuite(suite: TestSuite): Promise<void> {
    console.log(`\n📋 ${suite.name}: ${suite.description}`);
    console.log(`Command: ${suite.command}`);
    console.log('─'.repeat(80));

    const startTime = performance.now();
    let passed = false;
    let output = '';
    const errors: string[] = [];

    try {
      output = execSync(suite.command, {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 300000, // 5 minutes timeout
      });
      passed = true;
      console.log('✅ PASSED');
    } catch (error: any) {
      passed = false;
      errors.push(error.message);
      console.log('❌ FAILED');
      
      if (error.stdout) {
        console.log('STDOUT:', error.stdout);
      }
      if (error.stderr) {
        console.log('STDERR:', error.stderr);
      }
    }

    const duration = performance.now() - startTime;
    
    const result: TestResult = {
      name: suite.name,
      duration,
      passed,
      output,
      errors,
    };

    // Extract coverage if available
    if (suite.name === 'Coverage Report' && passed) {
      result.coverage = this.extractCoverage(output);
    }

    this.results.push(result);
    console.log(`Duration: ${(duration / 1000).toFixed(2)}s`);
  }

  private extractCoverage(output: string): number {
    // Extract coverage percentage from output
    const match = /All files\s+\|\s+(\d+\.?\d*)/.exec(output);
    return match ? parseFloat(match[1]) : 0;
  }

  private printSummary(): void {
    const totalDuration = performance.now() - this.startTime;
    const passedTests = this.results.filter(r => r.passed).length;
    const totalTests = this.results.length;
    const requiredTests = this.testSuites.filter(s => s.required).length;
    const passedRequired = this.results.filter(r => r.passed && 
      this.testSuites.find(s => s.name === r.name)?.required).length;

    console.log(`\n${  '='.repeat(80)}`);
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(80));

    console.log(`\n📈 Overall Results:`);
    console.log(`  Total Tests: ${totalTests}`);
    console.log(`  Passed: ${passedTests}`);
    console.log(`  Failed: ${totalTests - passedTests}`);
    console.log(`  Required Passed: ${passedRequired}/${requiredTests}`);
    console.log(`  Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    console.log(`  Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);

    console.log(`\n📋 Test Details:`);
    this.results.forEach(result => {
      const icon = result.passed ? '✅' : '❌';
      const duration = (result.duration / 1000).toFixed(2);
      console.log(`  ${icon} ${result.name} (${duration}s)`);
      
      if (result.coverage) {
        console.log(`    Coverage: ${result.coverage}%`);
      }
      
      if (result.errors.length > 0) {
        console.log(`    Errors: ${result.errors.length}`);
        result.errors.forEach(error => {
          console.log(`      - ${error.split('\n')[0]}`);
        });
      }
    });

    // Coverage summary
    const coverageResult = this.results.find(r => r.name === 'Coverage Report');
    if (coverageResult?.coverage) {
      console.log(`\n📊 Coverage Summary:`);
      console.log(`  Overall Coverage: ${coverageResult.coverage}%`);
      
      if (coverageResult.coverage >= 80) {
        console.log(`  ✅ Coverage target met (≥80%)`);
      } else {
        console.log(`  ⚠️  Coverage below target (${coverageResult.coverage}% < 80%)`);
      }
    }

    // Final verdict
    const allRequiredPassed = passedRequired === requiredTests;
    console.log(`\n🎯 Final Verdict:`);
    
    if (allRequiredPassed) {
      console.log(`  ✅ All required tests passed! Ready for deployment.`);
    } else {
      console.log(`  ❌ Some required tests failed. Please fix before deployment.`);
    }

    console.log(`\n${  '='.repeat(80)}`);
  }

  async runSpecific(testName: string): Promise<void> {
    const suite = this.testSuites.find(s => s.name === testName);
    if (!suite) {
      console.log(`❌ Test suite "${testName}" not found`);
      console.log('Available test suites:');
      this.testSuites.forEach(s => console.log(`  - ${s.name}`));
      return;
    }

    console.log(`🚀 Running specific test: ${testName}\n`);
    this.startTime = performance.now();
    
    await this.runTestSuite(suite);
    this.printSummary();
  }

  listTests(): void {
    console.log('📋 Available Test Suites:');
    this.testSuites.forEach(suite => {
      const required = suite.required ? '(Required)' : '(Optional)';
      console.log(`  - ${suite.name} ${required}`);
      console.log(`    ${suite.description}`);
      console.log(`    Command: ${suite.command}`);
      console.log('');
    });
  }

  async runWatch(): Promise<void> {
    console.log('👀 Running tests in watch mode...');
    console.log('This will run unit tests and re-run when files change.');
    
    try {
      execSync('vitest src/tests/unit --watch', {
        stdio: 'inherit',
      });
    } catch (error) {
      console.log('Watch mode interrupted');
    }
  }
}

// CLI interface
async function main() {
  const runner = new TestRunner();
  const args = process.argv.slice(2);

  if (args.length === 0) {
    await runner.runAll();
  } else {
    const command = args[0];
    
    switch (command) {
      case 'list':
        runner.listTests();
        break;
      case 'watch':
        await runner.runWatch();
        break;
      case 'run':
        if (args[1]) {
          await runner.runSpecific(args[1]);
        } else {
          console.log('Usage: npm run test:runner run <test-name>');
          runner.listTests();
        }
        break;
      default:
        console.log('Usage:');
        console.log('  npm run test:runner          - Run all tests');
        console.log('  npm run test:runner list     - List available tests');
        console.log('  npm run test:runner watch    - Run tests in watch mode');
        console.log('  npm run test:runner run <name> - Run specific test');
    }
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { TestRunner };