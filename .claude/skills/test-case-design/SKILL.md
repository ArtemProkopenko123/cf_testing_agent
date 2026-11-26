---
name: test-case-design
description: Plans unit test cases before any test code is written. Picks the scenarios the file's contract defines, names the break each case catches and chooses expected values that do not come from the code under test. Use when deciding which tests to add for a file in backend/ or frontend/.
---

# Test case design

Plan first, write second. The plan is the `cases` list in the report: one
line per behaviour, "behaviour → break it catches". Print the planned list in
your reply before the first Edit or Write of a test file.

## Process

1. **Read the contract, not the implementation.** Signature and types, zod
   validators, `openapi.json`, the PR title and description, user-visible
   text. List the behaviours a caller can observe.
2. **Pick scenarios** from the checklist below. Keep the ones the contract
   distinguishes; one test per distinct outcome, no padding. If the contract
   defines an outcome the code does not handle, keep the case: it becomes a
   `suspected_bug`, not a dropped test.
3. **Name the break.** For each case, state the concrete change to the
   source that would make it fail ("drops the `completed` filter", "returns
   200 instead of 404"). Cannot name one → drop the case.
4. **Fix expected values** before running anything (see below).
5. Write the tests with `backend-unit-tests` or `frontend-unit-tests`.

## Scenario checklist

| Scenario | Examples in this repo |
|---|---|
| Happy path | create a task, render the list |
| Empty | empty list, blank title, missing optional field |
| Boundary | title 120 vs 121 characters, description 2000 vs 2001, leap day; for a text length limit also try emoji, since JS `.length` counts an emoji as 2 while the API contract counts characters |
| Invalid input | malformed date, unknown priority, non-numeric id → 422 (a missing task is 404) |
| Dependency failure | repository throws, `fetch` rejects, error body is not JSON |
| Repeated calls | double submit of a mutation, abort mid-request |

Repeated calls only when the code handles them; do not invent concurrency.

## Expected values

- Write literals: `422`, `'Enter a valid date.'`, `[high, low]`.
- Derive anything else by hand in the test. Never call the function under
  test, or a helper it uses, to build the expected value (tautology).
- User-visible text is part of the contract: assert it exactly. Internal
  strings (log lines, class names, query key internals) are not: assert the
  behaviour that depends on them instead.
- The observed output is not a source. If the code disagrees with the
  contract, that is a `suspected_bug`, not a new expected value.

## Not worth a test

- The framework doing its job: Express calling a registered handler, React
  Query caching, zod parsing a valid schema.
- Change detectors: re-asserting a constant or a config value.
- The mock itself: that a stub exists or returns what you told it to. Assert
  calls on a boundary mock only when the call is the behaviour (the request
  URL, the arguments passed to the repository).

## Red flags

| Thought | Do instead |
|---|---|
| "The code returns X, so I'll expect X." | Take X from the contract. If they differ, report `suspected_bug`. |
| "This case is hard to set up, skip it." | Try it. If it still fails after 3 attempts, drop only that case and say why in `reason`; the other tests stay. |
| "I'll loosen the assertion so it passes." | A looser assertion catches fewer breaks. Find out why it fails. |
| "A snapshot covers everything." | Assert the specific output a user relies on. |
| "Mocking this module of ours makes it easy." | Mock only the network, database and time. |
| "One more test for coverage." | No named break, no test. |
