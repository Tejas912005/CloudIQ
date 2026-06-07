# CLOUDIQ PROJECT AUDIT — ANTIGRAVITY INSTRUCTIONS

---

## MANDATORY PRE-AUDIT PROTOCOL — READ THIS FIRST

Before producing a single line of output, you must complete all of the following steps. Do not skip any. Do not begin writing your audit until every step is done.

**STEP 1 — Full file inventory.**
List every file in the ZIP: every `.py`, `.ts`, `.tsx`, `.js`, `.jsx`, `.json`, `.env`, `.env.example`, `.toml`, `.yaml`, `.yml`, `.md`, `.txt`, `.css`, `.html`, and any other file present. Count them. State the total. If you have not read a file, you are not permitted to make any claim about it.

**STEP 2 — Read every file completely.**
Open and read every file in the inventory from top to bottom, including configuration files, lock files, `.env.example`, `README.md`, all changelog and walkthrough documents, all backend routes, all frontend components, all utility functions, all tests (if any), and all CI/CD config files. Do not skim. Do not summarize prematurely. Read every line.

**STEP 3 — Do not trust documentation.**
The README, any `WALKTHROUGH.md`, `CHANGELOG.md`, `TODO.md`, `FEATURES.md`, or similar files are claims made by the developer. They are hypotheses, not evidence. Every claim in those files must be verified against actual source code before you accept it as true. If a README says "feature X is implemented," you must find the code that implements feature X and cite the file and line number. If you cannot find it, the claim is false.

**STEP 4 — Separate confirmed facts from assumptions.**
Every finding in your audit must be labeled with one of the following:
- `[CONFIRMED]` — You found the exact code and can cite file + line number
- `[LIKELY]` — Strong evidence exists but you cannot cite a single definitive line
- `[UNVERIFIED]` — You could not find enough evidence to confirm or deny
- `[FALSE CLAIM]` — The documentation or README claims this exists but the code does not support it

**STEP 5 — Commit to honesty.**
You are not writing a performance review. You are not trying to encourage the developer. You are a senior engineer doing a technical due diligence audit. Score honestly. If the project is a 4/10, write 4/10. If a feature is broken, say it is broken. If a security vulnerability exists, name it precisely. Inflated scores and diplomatic softening are not permitted in this audit.

---

## AUDIT SCOPE — CLOUDIQ PROJECT

**Project name:** CloudIQ  
**Description:** A cloud intelligence dashboard built on FastAPI (Python backend), React 19 (frontend), Supabase (database + auth), Gemini AI and Groq (LLM providers), ChromaDB (vector database for RAG), deployed on Render (backend) and Vercel (frontend).  
**Claimed features:** 9 screens, agentic AI loop, streaming chat, 3D globe visualization, WebGL graph, RAG memory pipeline, Supabase authentication, real-time data dashboard.

---

## AUDIT SECTIONS — COMPLETE ALL 14

Produce output for every section. If a section has nothing to report, write "Nothing found — [CONFIRMED]" and briefly explain why. Do not skip sections.

---

### SECTION 1 — CRITICAL BUGS

For every bug you find, provide all of the following. If you cannot provide all of them, do not report the bug:

- **File:** exact filename and relative path
- **Line numbers:** exact line or line range where the bug exists
- **What breaks:** what happens at runtime when this line executes
- **Why it breaks:** the technical root cause (type error, missing await, wrong variable scope, incorrect API call signature, race condition, etc.)
- **Exact fix:** the corrected code, written out in full, not paraphrased

Bugs to specifically look for (this list is not exhaustive — find all bugs, not just these):
- Missing `await` on async functions that return Promises or coroutines
- State mutations on React state objects instead of using setter functions
- `useEffect` hooks with missing or incorrect dependency arrays causing infinite loops
- Unhandled promise rejections and missing try/catch around API calls
- Python endpoints that do not handle exceptions and will return 500 with a stack trace
- FastAPI route functions that are missing `async def` when they call async libraries
- ChromaDB collection calls that assume a collection exists without creating it first
- Supabase queries with no `.single()` that return arrays when the code expects an object
- Streaming response handlers that do not handle partial chunks or connection drops
- WebSocket connections with no reconnect logic and no error handler
- React 19 concurrent mode issues — any use of legacy lifecycle methods or direct DOM mutation
- Environment variable references that use `process.env.VAR` in a Vite project (should be `import.meta.env.VITE_VAR`)
- CORS headers set in both the framework and a middleware simultaneously causing conflicts
- Any database query inside a loop (N+1 pattern)

---

### SECTION 2 — SECURITY ISSUES

Examine every file in the project for the following. For each issue found, cite exact file and line number:

**2a — Committed secrets**
Search every file including `.env`, `.env.example`, config files, and any file not in `.gitignore` for: API keys, tokens, passwords, private keys, Supabase service role keys, Gemini API keys, Groq API keys, database URLs containing credentials, JWT secrets, and any string matching patterns like `sk-`, `AIza`, `gsk_`, `eyJ`, or any base64 string longer than 40 characters that does not appear to be public data.

**2b — Exposed or unauthenticated API endpoints**
List every FastAPI route decorator (`@app.get`, `@app.post`, `@app.put`, `@app.delete`, `@router.get`, etc.) in the entire codebase. For each route: state the path, the HTTP method, and whether it has an authentication dependency (e.g., `Depends(get_current_user)` or equivalent). Routes with no auth dependency that handle sensitive data, mutations, or LLM calls are a critical security issue.

**2c — CORS configuration**
Find the CORS middleware configuration. State the exact `allow_origins` value. If it is `["*"]` in a project with authentication, that is a security issue. State whether credentials are allowed (`allow_credentials=True`). State whether this matches what the frontend domain will be in production.

**2d — JWT and session security**
Find where JWTs or session tokens are validated. Are they verified with a secret? Is the secret hardcoded? Is token expiry checked? Is there a refresh token mechanism?

**2e — Input validation**
Are user inputs sanitized before being passed to database queries, LLM prompts, or ChromaDB? Find any place where raw user input is interpolated into a string that goes to an external service.

**2f — Frontend key exposure**
List every API key or secret referenced in the React frontend. Any key that is not a public-facing key (i.e., any key that gives write access, billing access, or admin access to any service) being present in the frontend is a critical issue.

---

### SECTION 3 — DEAD CODE

**3a — Unused imports**
Find every import statement (Python `import`/`from X import Y` and JavaScript/TypeScript `import`) where the imported name is never referenced anywhere in that file. List file, line number, and the unused import.

**3b — Unreachable functions**
Find every function, component, class, or module that is never imported or called from anywhere in the project. A function defined in `utils.py` that is imported by zero other files is dead code. A React component in `components/` that appears in no other component's JSX is dead code. List each one with its file and the reason you believe it is unreachable.

**3c — Commented-out code blocks**
Find blocks of commented-out code that are longer than 3 lines. These are either dead code or incomplete implementations. List each with file and line range.

**3d — Duplicate implementations**
Find cases where the same functionality is implemented twice in different files with no clear reason for duplication.

---

### SECTION 4 — FALSE CLAIMS

Read every documentation file: `README.md`, `WALKTHROUGH.md`, `CHANGELOG.md`, `FEATURES.md`, `TODO.md`, and any `.md` file present.

For every feature or capability claimed in those documents:
1. State the exact claim (quote the relevant sentence)
2. Search the source code for the implementation
3. Render a verdict: `[CONFIRMED]`, `[PARTIALLY IMPLEMENTED]`, `[NOT FOUND]`, or `[FALSE CLAIM]`
4. If confirmed, cite the file and line number
5. If not found or false, state what is missing from the code

Pay special attention to claims about:
- The number of screens/pages (claim vs. actual components found)
- The agentic AI loop (what exactly does it do, is it truly agentic or just a chat loop)
- The 3D globe (is it actually 3D and interactive, or a static image, or a placeholder)
- The WebGL graph (is WebGL actually used, or is it a Canvas 2D or SVG chart)
- RAG memory (is ChromaDB actually queried during chat, or is it initialized but never used)
- Streaming chat (is true streaming implemented, or does it wait for the full response)
- Supabase auth (is auth actually enforced on protected routes, or just initialized)

---

### SECTION 5 — WRONG OR PHANTOM DEPENDENCIES

**5a — Frontend (package.json)**
Read `package.json` (and `package-lock.json` or `yarn.lock` if present). For every package in `dependencies` and `devDependencies`:
- Verify the package name is spelled correctly and exists on npm
- Check whether the version specified is a real published version
- Identify any package that has known breaking changes in the version range specified
- Identify peer dependency conflicts (e.g., a package that requires React 18 when the project uses React 19)
- Identify packages that are installed but never imported anywhere in the codebase
- Identify packages that are imported in the code but missing from `package.json`

**5b — Backend (requirements.txt or pyproject.toml)**
Read the Python dependency file(s). For every package:
- Verify the package name is correct and exists on PyPI
- Check whether any pinned version is incompatible with another pinned version (e.g., conflicting transitive dependencies)
- Identify packages installed but never imported in any `.py` file
- Identify packages imported in `.py` files but missing from the requirements

**5c — Version currency**
For the core technologies (FastAPI, React, Supabase client, ChromaDB, the Gemini SDK, the Groq SDK), state the version used in this project versus the latest stable version. Flag any that are more than one major version behind.

---

### SECTION 6 — PERFORMANCE PROBLEMS

**6a — React rendering issues**
Find every `useEffect` hook. For each one: state what it does, what its dependency array contains, and whether it can cause an infinite loop. An infinite loop occurs when a `useEffect` modifies a value that is also in its dependency array.

Find every component that fetches data. Does it fetch on every render, or is the fetch memoized/cached? Are there multiple components that independently fetch the same data from the same endpoint?

Find any use of `useState` or `useContext` that causes a large subtree to re-render when only a small piece of data changes.

**6b — API call storms**
Is there any code path where a single user action triggers multiple simultaneous API calls to the backend or to external services? Does the 3D globe or WebGL graph make API calls on every animation frame or scroll event?

**6c — Database query patterns**
Find every database query in the backend. Is any query executed inside a `for` loop or a list comprehension? That is an N+1 query. Are any queries fetching entire tables without `LIMIT` clauses? Are indexes used on columns that are frequently filtered?

**6d — Synchronous blocking**
In the FastAPI backend, find any synchronous operation (file I/O, HTTP call, database call) that is not `await`ed and not run in a thread pool executor. A synchronous blocking call in an async FastAPI route blocks the entire event loop.

**6e — LLM call efficiency**
Are Gemini or Groq calls made without timeouts? Is the same prompt sent multiple times when it could be cached? Is the full conversation history sent on every message in the streaming chat, or is it truncated intelligently?

---

### SECTION 7 — UI/UX PROBLEMS

**7a — Broken CSS references**
Find every CSS class name used in JSX (in `className=""` attributes). Cross-reference against the project's CSS files, Tailwind config, or CSS module files. Any class name that does not exist in the project's styles is a broken reference that will cause silent styling failure.

**7b — Hardcoded colors**
Find every instance of a hardcoded hex color (`#xxxxxx`), RGB value (`rgb(...)`), or named color in component files or CSS files that is not inside a CSS variable definition (`:root { --color: ... }`). Hardcoded colors in a component mean the design system is not being used and theming will be inconsistent.

**7c — Incomplete or placeholder UI**
Find any component that renders placeholder text (`Coming soon`, `TODO`, `placeholder`, `lorem ipsum`, empty `<div>` elements with height, `opacity: 0` on visible elements, `display: none` on elements that should be shown). These are incomplete UI sections.

**7d — Missing loading and error states**
For every component that makes an async call, check whether it renders: (1) a loading state while the call is in flight, (2) an error state if the call fails, (3) an empty state if the call returns no data. Components that render nothing or crash silently during these states are UX failures.

**7e — Responsive design issues**
Find any hardcoded pixel widths or heights on components that are intended to be visible on multiple screen sizes. Find any component with no mobile breakpoint.

**7f — Animation inconsistencies**
If the project claims animations, find where they are implemented. Are they using CSS transitions, a library (Framer Motion, GSAP, etc.), or the Web Animations API? Are they applied consistently across the design, or only on some screens?

**7g — Design system consistency**
Is there a defined color palette, typography scale, and spacing system? Are all 9 screens using it consistently, or do some screens have different font sizes, spacing, or color treatments?

---

### SECTION 8 — DEPLOYMENT BLOCKERS

Analyze everything that would prevent a successful first deployment to Render (backend) and Vercel (frontend).

**8a — Render deployment issues**
- Is there a `render.yaml` or `Procfile`? If so, does the start command correctly point to the FastAPI app?
- Does the FastAPI app bind to `0.0.0.0` and read the port from `$PORT` environment variable? Render requires this.
- Are all required environment variables documented somewhere (e.g., in `.env.example`)? Are any hardcoded that must be environment variables?
- Does the backend have a health check endpoint that Render can use to verify the service started?
- Are any Python dependencies that require compiled C extensions likely to fail on Render's Linux build environment?
- Is ChromaDB configured to use a persistent directory? If so, does Render's ephemeral disk mean that vector data will be lost on every deploy?

**8b — Vercel deployment issues**
- Is there a `vercel.json`? Does it correctly configure the SPA routing (a catchall rewrite to `index.html`) so that React Router routes work on refresh?
- Does the Vite build complete without errors? Are there any TypeScript errors that would fail the build?
- Are all environment variables prefixed with `VITE_` so Vite exposes them to the browser? Any `process.env.X` calls in a Vite project will be `undefined` at runtime.
- Are there any absolute import paths that work locally but will fail in the Vercel build environment?
- Is the `build` script in `package.json` correct?

**8c — Cross-origin issues in production**
The FastAPI backend will be on a `*.onrender.com` domain. The React frontend will be on a `*.vercel.app` domain. Is the CORS configuration correct for these two origins? Will cookies or authorization headers be sent correctly across origins?

---

### SECTION 9 — ARCHITECTURE PROBLEMS

**9a — Separation of concerns**
Is business logic mixed into API route handlers, or is it separated into a service layer? Are database queries written directly in route functions, or abstracted into a repository/data layer?

**9b — State management**
What is the frontend state management approach? Is there a global store (Zustand, Redux, Context API)? Is server state managed separately from UI state? Are there prop drilling chains longer than 3 levels?

**9c — Error boundary coverage**
Does the React app have Error Boundaries? If a component crashes (e.g., the 3D globe fails to initialize WebGL), will it crash the entire app or be contained?

**9d — API design**
Are the FastAPI endpoints RESTful? Are they consistent in their naming, response format, and error structure? Do all endpoints return the same error schema (`{"error": "...", "detail": "..."}`) or are error formats inconsistent across routes?

**9e — RAG architecture**
Describe exactly how the RAG pipeline works, based on the code. What is the chunking strategy? What embedding model is used? How are retrieved chunks injected into the prompt? Is there a re-ranking step? Is the retrieval actually triggered during chat, or is it a standalone feature that is never called from the chat flow?

**9f — Agentic loop architecture**
Describe exactly how the agentic loop works, based on the code. What tools does the agent have? How does it decide when to stop? Is there a maximum iteration limit? Can the agent get stuck in an infinite loop? Is the agent's state persisted between sessions?

**9g — WebGL and 3D globe**
What library is used for the 3D globe? What library is used for the WebGL graph? Are these rendering on the main thread? Is there a WebWorker or OffscreenCanvas used to prevent UI blocking? Are the WebGL contexts properly cleaned up when the component unmounts?

---

### SECTION 10 — TECH STACK ASSESSMENT

For each technology in the stack, evaluate: version used, latest stable version, whether it is the correct tool for the job, whether it is used correctly in this project, and one specific alternative if the choice is wrong.

Evaluate all of these technologies:
1. **FastAPI** — version, correct choice for this use case, used correctly?
2. **React 19** — is React 19 stable? Are React 19-specific features (`use`, Server Components, compiler) used or is it effectively just React 18 with a version bump?
3. **Supabase** — is the client library version current? Is Supabase being used for auth, realtime, storage, or just as a Postgres wrapper?
4. **Gemini AI SDK** — which SDK? `@google/generative-ai` or `google-generativeai`? Version? Is the API called correctly for streaming?
5. **Groq SDK** — version? Is it used for inference or as a transcription/audio tool? Are the model names used in the code valid model identifiers on Groq's API?
6. **ChromaDB** — version? Is the persistent client or in-memory client used? Is this the right choice vs. pgvector (since Supabase supports pgvector natively)?
7. **Vite** — version? Is the config correct for React + TypeScript?
8. **TypeScript** — is it used? What is the `strict` setting? Are there `any` type suppressions throughout the codebase?
9. **The 3D globe library** — name it, assess the choice
10. **The WebGL graph library** — name it, assess the choice

---

### SECTION 11 — MARKET COMPARISON

**11a — Market landscape**
How many products similar to CloudIQ (AI-powered cloud intelligence dashboards or developer-facing AI dashboard products) exist today? Give a realistic estimate.

**11b — Top 5 competitors**
Name the 5 most directly comparable products. For each:
- Product name
- Core differentiation
- What they do significantly better than CloudIQ (based on your assessment of CloudIQ's actual capabilities)
- Their pricing model

**11c — CloudIQ's differentiators**
Based on the actual implemented code (not the README), what does CloudIQ do that the competitors you listed do not? Be honest — if the answer is "nothing at production quality," say so.

**11d — Market positioning verdict**
Is CloudIQ positioned correctly? What would need to be true (technically) for it to be commercially viable?

---

### SECTION 12 — CV AND PORTFOLIO VALUE

Evaluate this project specifically as a portfolio piece for a software engineering job application.

**12a — Impression on a senior engineer**
Describe exactly what a senior engineer (5+ years, has reviewed hundreds of projects) would think when they open this codebase. Be specific. What would impress them? What would immediately concern them? What would make them stop reading?

**12b — Job level support**
Based on the actual quality and complexity of the code, what is the maximum job level this project would credibly support in an interview?
Choose from: Junior (0–2 years), Mid-level (2–4 years), Senior (4–7 years), Staff/Principal (7+ years).
Explain your rating in terms of specific code quality evidence.

**12c — Red flags for recruiters or interviewers**
List every aspect of the project that would be a red flag in a technical interview. Be specific. "Security issue X in file Y would cause an interviewer to ask [this question], and an unprepared candidate would fail it."

**12d — Portfolio rating**
Rate this project as a portfolio piece: **X / 10**

Rules for scoring:
- 10/10 = Production-grade, solves a real problem, no critical issues, demonstrates mastery of multiple domains
- 7–9 = Impressive complexity, mostly working, minor issues, would get callbacks
- 5–6 = Interesting concept, significant issues, would not get callbacks at senior level
- 3–4 = Shows ambition but critical failures, would raise concerns in interviews
- 1–2 = Significant misunderstandings of fundamentals

Do not give a 7 or higher unless you have confirmed that the core features actually work.

---

### SECTION 13 — PRIORITY FIX LIST

List every issue found in Sections 1–9 in a single unified table, ordered by impact (highest impact first).

For every issue, include all columns:

| Priority | Issue | Section | File | Line(s) | Impact | Time Estimate | Effort |
|----------|-------|---------|------|---------|--------|---------------|--------|
| 1 | [issue name] | [1–9] | [filename] | [line #] | [CRITICAL / HIGH / MEDIUM / LOW] | [e.g., 30 min] | [LOW / MEDIUM / HIGH] |

**Impact definitions:**
- CRITICAL = Will crash in production or is a security vulnerability
- HIGH = Breaks a major feature or significantly degrades quality
- MEDIUM = Degrades UX or code quality but does not break core functionality
- LOW = Technical debt, minor inconsistency, or style issue

After the table, write the **Top 5 Fix List**: the five issues that, if fixed today, would have the greatest combined impact on the project's quality, security, and portfolio value.

---

### SECTION 14 — FINAL VERDICT

**14a — Overall project rating: X / 10**

Use the same scale as Section 12. This rating covers overall code quality, security posture, feature completeness, architectural soundness, and deployment readiness. Show your arithmetic: what sub-scores in each domain led to the final number.

**14b — The single most important fix**
If the developer has 2 hours today, what is the single most important thing to fix? Give the exact file, the exact change, and the exact reason this is the highest-priority action.

**14c — The 30-day transformation**
If the developer fixes the top 5 issues from Section 13 and spends 30 focused days on the project, describe specifically what the project becomes: what features are now working correctly, what the security posture looks like, what the portfolio value becomes, and what job opportunities it credibly supports.

**14d — Honest final summary**
Write 3–5 sentences summarizing the project's actual current state. No diplomatic softening. This is the summary a technical interviewer would write after reviewing the project. It should be true, specific, and direct.

---

## ANTI-HALLUCINATION RULES — ENFORCED

These rules govern every sentence of your output. Violating any rule invalidates the audit.

1. **You must not claim a bug exists without citing the exact file name and line number.**
2. **You must not claim a feature is missing without first searching for it exhaustively.**
3. **You must not quote or paraphrase README content as evidence of implementation.**
4. **You must not assign a severity level to an issue you have not confirmed in the source code.**
5. **You must not give a performance score based on the project's described architecture — only based on code you have read.**
6. **If you are uncertain about something, you must write "UNVERIFIED — [reason]" rather than guessing.**
7. **You must not invent library names, function signatures, or API behaviors. If you are unsure how a library works, say so.**
8. **The label `[CONFIRMED]` may only be used when you can state the exact file and line number that proves the claim.**
9. **If a section yields no findings, you must write "No issues found — [CONFIRMED]" and briefly explain what you checked and why it is clean.**
10. **You must not produce a shorter audit to save time. Every section must be completed in full. An incomplete audit is an invalid audit.**

---

*This audit prompt was written for the CloudIQ project. Paste this prompt along with the CloudIQ project ZIP into Antigravity. The audit should be the primary output — do not summarize, abbreviate, or skip sections.*
