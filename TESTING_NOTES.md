# 📋 Testing Commands - Usage Guide

## ✅ Test Commands in package.json

### 1️⃣ `npm test` - ⭐ **Before Pushing Code**

```bash
npm test
```

**Purpose:**

- ✅ Run **ALL** test suite
- ✅ Generate **coverage report** (code coverage analysis)
- ✅ Display **detailed test case information**

**When to use:**

- Before committing/pushing code to GitHub
- Check entire application
- Review coverage before release

**Output:**

```
✅ Test Suites: 1 passed, 1 total
✅ Tests:       26 passed, 26 total
✅ Coverage:    autofillService 95%, domainVerification 85%
```

---

### 2️⃣ `npm test-watch` - 🚀 **During Development**

```bash
npm test-watch
```

**Purpose:**

- 🔄 Automatically re-run tests when you **save files**
- ⏸️ **Does NOT auto-exit** - waits for you to continue coding
- ⚡ Faster because it skips coverage report

**When to use:**

- Writing code and tests simultaneously
- Want **instant feedback** from tests
- Developing new features

**Example:**

```bash
npm test-watch
# → Run test first time
# → You edit file → Auto re-run
# → You edit file → Auto re-run
# Press 'q' to exit
```

---

### 3️⃣ `npm test-coverage` - 📊 **Detailed Report**

```bash
npm test-coverage
```

**Purpose:**

- 📈 Run **ALL** tests + **detailed coverage report**
- 📄 Display **verbose output** (all information)
- 📁 Create `coverage/` folder with HTML report

**When to use:**

- Report for manager/team lead
- Review test quality
- Check which files **lack test coverage**

**Output:**

```
File                          | % Stmts | % Branch | % Funcs | % Lines
-------------------------------------------------------------------
All files                     |   85.2  |   78.5   |   82.1  |   85.0
  services/autofillService    |   95.0  |   90.0   |   95.0  |   95.0
  services/domainVerification |   85.0  |   75.0   |   80.0  |   85.0
```

**View HTML Report:**

- Open file: `coverage/lcov-report/index.html` in browser

---

## 🎯 Quick Reference - Summary

| Command                 | Purpose                                 | Speed     | Use When         |
| ----------------------- | --------------------------------------- | --------- | ---------------- |
| **`npm test`**          | Run all tests + coverage                | 🟡 Medium | ✅ Before commit |
| **`npm test-watch`**    | Auto re-run when code changes           | 🟢 Fast   | 🚀 Development   |
| **`npm test-coverage`** | All tests + detailed coverage + verbose | 🟡 Medium | 📊 Reporting     |

---

## 💡 Real-World Workflow in One Day

### **Morning: Start Writing New Feature**

```bash
npm test-watch
# → Auto re-run when you save
# → Focus on code, Jest alerts immediately
```

### **Afternoon: Check Coverage**

```bash
npm test-coverage
# → See % of code being tested
# → Find parts needing more test cases
```

### **Before Push:**

```bash
npm test
# → Ensure all tests pass
# → Have coverage report to commit
```

---

## 📝 Detailed Example

### Writing Feature: `chromeAutoFillService`

**10:00 AM - Start coding:**

```bash
npm test-watch
```

```
PASS  src/services/__tests__/autofillService.test.ts
  → Auto-run each time you save
  → Instant feedback
```

**3:00 PM - Check coverage before commit:**

```bash
npm test-coverage
```

```
autofillService.ts:          95% Statements
  ✅ Good enough to commit
```

**4:00 PM - Before pushing:**

```bash
npm test
```

```
✅ 26/26 tests passing
✅ Coverage: 95%
→ Ready to push! 🚀
```

---

## 🔧 Tips & Tricks

### Run Only One Test File

```bash
npm test -- --testPathPattern="autofillService"
```

### Run Specific Test Case

```bash
npm test -- --testNamePattern="should inject credentials"
```

### Clear Cache (if stuck)

```bash
npm test -- --clearCache
npm test-watch
```

### Debug Mode

```bash
npm test -- --verbose
```

---

## ✨ Summary

- **`npm test`** = Run all, complete, ready to push ✅
- **`npm test-watch`** = Fast development 🚀
- **`npm test-coverage`** = Detailed report 📊

Testing with specific Service with Coverage
`npm test -- src/services/__tests__/passwordGeneratorService.test.ts --coverage`
or
`npm test -- passwordGeneratorService --coverage`

View detail failed test
`npm test -- src/services/__tests__/passwordGeneratorService.test.ts --verbose`

Full test without coverage
`npm test -- src/services/__tests__/passwordGeneratorService.test.ts --no-coverage`
