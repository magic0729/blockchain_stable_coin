const { execSync } = require('child_process');
const fs = require('fs');

async function runTests() {
  console.log("🧪 Running Comprehensive Test Suite for Gold-Backed Stablecoin");
  console.log("=" * 60);

  const testFiles = [
    'test/Stablecoin.test.js',
    'test/ReserveManager.test.js',
    'test/Oracle.test.js'
  ];

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  for (const testFile of testFiles) {
    console.log(`\n📋 Running ${testFile}...`);
    console.log("-" * 40);

    try {
      const output = execSync(`npx hardhat test ${testFile}`, { 
        encoding: 'utf8',
        stdio: 'pipe'
      });

      // Parse test results (simplified)
      const lines = output.split('\n');
      let testCount = 0;
      let passCount = 0;

      for (const line of lines) {
        if (line.includes('✓')) {
          passCount++;
          testCount++;
        } else if (line.includes('✗')) {
          testCount++;
        }
      }

      totalTests += testCount;
      passedTests += passCount;
      failedTests += (testCount - passCount);

      console.log(`✅ ${testFile} completed: ${passCount}/${testCount} tests passed`);
      
      if (testCount - passCount > 0) {
        console.log(`❌ ${testCount - passCount} tests failed`);
        console.log(output);
      }

    } catch (error) {
      console.error(`❌ ${testFile} failed to run:`);
      console.error(error.message);
      failedTests++;
    }
  }

  // Run gas report if enabled
  if (process.env.REPORT_GAS) {
    console.log("\n⛽ Running Gas Report...");
    console.log("-" * 40);
    
    try {
      const gasOutput = execSync('REPORT_GAS=true npx hardhat test', { 
        encoding: 'utf8',
        stdio: 'pipe'
      });
      console.log("✅ Gas report completed");
    } catch (error) {
      console.error("❌ Gas report failed:", error.message);
    }
  }

  // Run coverage report
  console.log("\n📊 Running Coverage Report...");
  console.log("-" * 40);
  
  try {
    const coverageOutput = execSync('npx hardhat coverage', { 
      encoding: 'utf8',
      stdio: 'pipe'
    });
    console.log("✅ Coverage report completed");
  } catch (error) {
    console.error("❌ Coverage report failed:", error.message);
  }

  // Summary
  console.log("\n" + "=" * 60);
  console.log("📊 TEST SUMMARY");
  console.log("=" * 60);
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests} ✅`);
  console.log(`Failed: ${failedTests} ❌`);
  console.log(`Success Rate: ${totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(2) : 0}%`);

  if (failedTests === 0) {
    console.log("\n🎉 ALL TESTS PASSED! 🎉");
    console.log("The gold-backed stablecoin contracts are ready for deployment.");
  } else {
    console.log("\n⚠️  Some tests failed. Please review and fix before deployment.");
    process.exit(1);
  }

  // Generate test report
  const testReport = {
    timestamp: new Date().toISOString(),
    totalTests,
    passedTests,
    failedTests,
    successRate: totalTests > 0 ? (passedTests / totalTests) * 100 : 0,
    testFiles: testFiles.map(file => ({
      file,
      status: 'completed'
    }))
  };

  fs.writeFileSync('test-report.json', JSON.stringify(testReport, null, 2));
  console.log("\n📄 Test report saved to: test-report.json");
}

// Run the tests
runTests().catch(console.error);
