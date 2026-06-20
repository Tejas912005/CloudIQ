You are a senior full-stack engineer performing a targeted fix 
session on CloudIQ v17 — a FastAPI + React 19 + Supabase + 
Gemini AI + Groq + ChromaDB cloud intelligence dashboard.

I have already fixed the API keys and security issues.
Do not touch any security-related files.

Read every file completely before making any change.
Show the complete updated file after each fix.
Wait for "next" before proceeding to the next fix.
Never show partial files. Never skip verification.

PROJECT CONTEXT:
  Frontend: React 19 + Vite + Tailwind + Framer Motion + Zustand
  State: useCloudStore.js (Zustand) → CloudIQContext.jsx → useCloudIQ hook
  Design: CSS variables only — var(--accent), var(--data), var(--bg-card)
  All colors use CSS variables — never hardcode hex in JSX

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIX 1 — useCloudStore.js (blank Insights chart — most critical)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: frontend/src/store/useCloudStore.js

PROBLEM: The Insights page Spend Over Time chart is completely 
blank. commandCenter.js builds chart data from a `history` 
parameter using history.map(entry => entry.daily_cost).
But useCloudStore.refreshData() never fetches /api/cost-history.
So `history` is always undefined → chart always empty.

FIND the refreshData function. It currently does:
  const [health, analyze, predict, recommend] = await Promise.all([
    fetchJson('/api/health'),
    fetchJson('/api/analyze'),
    fetchJson('/api/predict'),
    fetchJson('/api/recommend'),
  ]);
  set({ snapshot: { health, analyze, predict, recommend }, ... });

CHANGE to:
  const [health, analyze, predict, recommend, history] = 
    await Promise.all([
      fetchJson('/api/health'),
      fetchJson('/api/analyze'),
      fetchJson('/api/predict'),
      fetchJson('/api/recommend'),
      fetchJson('/api/cost-history'),
    ]);
  set({ snapshot: { health, analyze, predict, recommend, history }, ... });

Keep everything else in this file exactly as-is.
Show complete updated useCloudStore.js. Await "next".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIX 2 — commandCenter.js (rawResources is empty array)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: frontend/src/lib/commandCenter.js

PROBLEM: rawResources is hardcoded as [] in the return object
of buildCommandCenterModel(). This means CommandPalette 
resource search always shows nothing even though resource 
data exists in snapshot.analyze.

FIND in the return object of buildCommandCenterModel():
  rawResources: [],

CHANGE to:
  rawResources: snapshot?.analyze?.resources || 
                snapshot?.analyze?.resource_list || 
                [],

Also check if snapshot.analyze has a field that contains
the array of resource objects. Read the actual structure
of snapshot.analyze from what the /api/analyze endpoint
returns (check routers/analyze.py to see the response shape).
Use whatever field actually contains the resources array.

Keep everything else unchanged.
Show complete updated commandCenter.js. Await "next".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIX 3 — TopHeader.jsx (Gemini chip always shows Active)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: frontend/src/components/layout/TopHeader.jsx

PROBLEM: The Gemini status chip always shows "Gemini Active" 
even when Gemini is actually offline. The frontend reads 
platform?.health?.gemini_available but the backend health 
endpoint returns gemini_active (different field name).

FIND line:
  const geminiActive = platform?.health?.gemini_available !== false;

CHANGE to:
  const geminiActive = platform?.health?.gemini_active !== false;

Also check: platform.health comes from snapshot.health which 
comes from /api/health. Read routers/health.py to confirm 
the exact field name returned. Use whatever field name the 
backend actually returns.

Keep everything else unchanged.
Show complete updated TopHeader.jsx. Await "next".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIX 4 — Recommendations.jsx (verify no old CSS classes)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: frontend/src/pages/Recommendations.jsx

Read the complete file. Search for any of these old CSS 
class names that no longer exist in the design system:
  stat-card, glass-card, card-value, card-label,
  stats-grid, page-header, filter-row, badge,
  badge-high, badge-medium, badge-low, card-title

If ANY of these exist: replace the affected section with 
the new design system using GlassPanel component and 
CSS variables.

If NONE exist: confirm the file is clean and show 
the first 20 lines as proof. Await "next".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIX 5 — Activity.jsx (verify clean and animations work)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: frontend/src/pages/Activity.jsx

Read the complete file. Check for:
1. Any old CSS class names (same list as Fix 4)
2. Whether items have slide-in animation using 
   SlideInLeft or motion.div from framer-motion
3. Whether the timeline dot colors match the new 
   palette (--success, --warning, --danger, --accent)

If issues found: fix them.
If clean: confirm and show first 20 lines as proof.
Await "next".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIX 6 — Globe.jsx (verify region points have real data)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: frontend/src/pages/Globe.jsx

Read the complete file. Check:
1. Where does it get resource data from?
   It should use platform.rawResources or fetch 
   /api/resources directly
2. Does it read monthly_cost from resources?
   The field is monthly_cost (not cost or hourly_cost)
3. Do the region coordinates cover these regions:
   us-east-1, us-west-2, eu-west-1, ap-south-1,
   ap-southeast-1, us-central1, eastus

If rawResources is empty (because of Fix 2 not yet applied),
Globe will show no points. After Fix 2 is applied this 
should work automatically. Confirm the data path is correct.

If monthly_cost field name is wrong: fix it.
Show complete Globe.jsx. Await "next".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL VERIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

After all 6 fixes confirm:
1. useCloudStore fetches /api/cost-history in Promise.all
2. snapshot object includes history field
3. rawResources is not hardcoded as []
4. TopHeader reads gemini_active not gemini_available
5. No old CSS classes in Recommendations or Activity
6. Globe reads monthly_cost correctly

Then provide git commit command:
git add .
git commit -m "fix: insights chart data, rawResources, gemini field, page cleanup"
git push origin main

FILES TO ATTACH:
frontend/src/store/useCloudStore.js
frontend/src/lib/commandCenter.js
frontend/src/components/layout/TopHeader.jsx
frontend/src/pages/Recommendations.jsx
frontend/src/pages/Activity.jsx
frontend/src/pages/Globe.jsx
backend/routers/health.py
backend/routers/analyze.py