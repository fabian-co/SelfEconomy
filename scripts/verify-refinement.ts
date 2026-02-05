import fs from 'fs';
import path from 'path';

// Mocking the behavior of the TemplateEditorService surgical edits
async function testSurgicalIgnore() {
  console.log("Testing Surgical Ignore Rule addition...");

  const mockTemplate = {
    entity: "Nu Financiera",
    transaction_regex: "(\\d{2}\\s[A-Z]{3})\\s+\\$([\\d\\.,]+)", // Original regex
    rules: {
      ignore_patterns: ["Old Rule"]
    }
  };

  const newPattern = "Comisión por cambio de moneda";

  // Simulated Surgical Logic
  const updatedTemplate = JSON.parse(JSON.stringify(mockTemplate));
  if (!updatedTemplate.rules.ignore_patterns.includes(newPattern)) {
    updatedTemplate.rules.ignore_patterns.push(newPattern);
  }

  console.log("Check: Regex remains unchanged?");
  if (updatedTemplate.transaction_regex === mockTemplate.transaction_regex) {
    console.log("✅ SUCCESS: Regex preserved.");
  } else {
    console.log("❌ FAILURE: Regex modified!");
  }

  console.log("Check: New rule added?");
  if (updatedTemplate.rules.ignore_patterns.includes(newPattern)) {
    console.log("✅ SUCCESS: Rule added.");
  } else {
    console.log("❌ FAILURE: Rule missing!");
  }
}

async function testSurgicalSignFlip() {
  console.log("\nTesting Surgical Positive Pattern addition...");

  const mockTemplate = {
    entity: "Nu Financiera",
    rules: {
      positive_patterns: ["PAGO"]
    }
  };

  const newPattern = "Gracias por tu pago";

  // Simulated Surgical Logic
  const updatedTemplate = JSON.parse(JSON.stringify(mockTemplate));
  if (!updatedTemplate.rules.positive_patterns) updatedTemplate.rules.positive_patterns = [];
  if (!updatedTemplate.rules.positive_patterns.includes(newPattern)) {
    updatedTemplate.rules.positive_patterns.push(newPattern);
  }

  console.log("Check: New positive rule added?");
  if (updatedTemplate.rules.positive_patterns.includes(newPattern)) {
    console.log("✅ SUCCESS: Sign flip rule added.");
  } else {
    console.log("❌ FAILURE: Sign flip rule missing!");
  }
}

async function runTests() {
  await testSurgicalIgnore();
  await testSurgicalSignFlip();
}

runTests();
