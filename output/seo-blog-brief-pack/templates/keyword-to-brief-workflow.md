# Keyword-to-Brief Workflow

**A repeatable 5-step process to turn any keyword into a production-ready content brief in 30 minutes.**

---

## Overview

| Step | Time | Output | Tool/Template |
|------|------|--------|---------------|
| 1. Qualify | 5 min | Go/No-Go + Intent | Keyword Qualification Checklist |
| 2. Analyze SERP | 10 min | Gap Map + Angle | SERP Analysis Template |
| 3. Map Keywords | 5 min | Keyword Architecture | Keyword Mapping Sheet |
| 4. Build Outline | 7 min | Full Outline + Talking Points | [Appropriate Brief Template] |
| 5. QA & Handoff | 3 min | Complete Brief | Briefing Checklist |

**Total: ~30 minutes per brief**

---

## Step 1: Qualify the Keyword (5 min)

**Goal:** Decide if this keyword deserves a brief. Kill 70% here.

### Inputs Needed
- Primary keyword
- Access to: Ahrefs/SEMrush, Google SERP (incognito), GSC (if existing content)

### Qualification Checklist

| Criteria | Threshold | Pass? |
|----------|-----------|-------|
| Monthly Search Volume (Global) | ≥ 100 (B2B) / ≥ 500 (B2C) | [ ] |
| Keyword Difficulty | ≤ 60 (new site) / ≤ 75 (established) | [ ] |
| Traffic Potential (Parent Topic) | ≥ 200 | [ ] |
| Search Intent Match | We can satisfy with our content type | [ ] |
| Business Relevance | Maps to product/use case/ICP | [ ] |
| Not Cannibalizing | No existing page ranking > pos 20 for same intent | [ ] |
| Seasonal/Trending Check | Not a dying trend (Google Trends 12mo ↑ or →) | [ ] |

### Intent Classification (Mandatory)

| Intent | Content Type | Template to Use |
|--------|--------------|-----------------|
| Informational (Learn) | Guide / How-to / Tutorial | `how-to-brief.md` or `pillar-page-brief.md` |
| Informational (Compare) | Listicle / Comparison | `comparison-brief.md` / `listicle-brief.md` |
| Commercial Investigation | Comparison / Best X for Y / Review | `comparison-brief.md` |
| Transactional | Product Page / Landing Page | *Not a blog brief — route to product team* |
| Navigational | *Don't target* | *Skip* |

**Decision:**
- [ ] **GO** → Proceed to Step 2
- [ ] **NO-GO** → Log in "Rejected Keywords" sheet with reason
- [ ] **DEFER** → Add to "Next Quarter" backlog with notes

---

## Step 2: Analyze the SERP (10 min)

**Goal:** Understand what's ranking, find the gaps, define your angle.

### Tools
- Ahrefs/SEMrush SERP Overview
- Incognito Google search (target location)
- Detailed SEO Extension (free) for word counts, headings
- AlsoAsked / AnswerThePublic for PAA

### SERP Analysis Template

| Rank | URL | Title | Format | Word Count | H2 Count | Updated | Strengths | Gaps/Weaknesses |
|------|-----|-------|--------|------------|----------|---------|-----------|-----------------|
| 1 | | | | | | | | |
| 2 | | | | | | | | |
| 3 | | | | | | | | |
| 4 | | | | | | | | |
| 5 | | | | | | | | |

### SERP Features Checklist
- [ ] Featured Snippet — Type: [Paragraph/List/Table/Video] — **Target: Y/N**
- [ ] People Also Ask — Count: [N] — **Extract all to sheet**
- [ ] Video Carousel — **Embed competitor or create ours?**
- [ ] Image Pack — **Need original visuals?**
- [ ] Shopping/Ads — **Commercial intent high?**
- [ ] Knowledge Panel — **Entity optimization needed?**
- [ ] AI Overview (SGE) — **Structure for citation?**

### Gap Synthesis (The Output)

**Top 3 Content Gaps:**
1. [Specific gap — e.g., "No template download"]
2. [Specific gap — e.g., "All use 2022 data"]
3. [Specific gap — e.g., "No expert quotes"]

**Our Winning Angle (One Sentence):**
> "[Our differentiator] — e.g., 'The only [topic] guide with a Notion workspace + 2025 benchmarks from 50 companies.'"

**Target Format:** [Guide / Listicle / Comparison / How-To / Case Study / Pillar]

---

## Step 3: Map Keywords (5 min)

**Goal:** Build the keyword architecture — primary, secondary, semantic, PAA.

### Keyword Mapping Sheet

**Primary Keyword (H1):** [Keyword] — Vol: [X] — KD: [X]

**Secondary Keywords (H2 Targets — 5-8):**

| Keyword | Volume | KD | Target Heading | Search Intent |
|---------|--------|----|----------------|---------------|
| [kw] | [X] | [X] | H2: [Heading] | [Info/Comm] |
| [kw] | [X] | [X] | H2: [Heading] | [...] |

**Semantic/Long-Tail (Sprinkle Naturally — 15+):**
[List from: Ahrefs "Also rank for", Surfer/Clearscope, TF-IDF, Related Searches]

**People Also Ask Questions (8+ — Target in FAQ/H3):**
1. [Question]
2. [Question]
...

**Internal Link Targets (5+):**
| Target URL | Anchor Text | Placement Context |
|------------|-------------|-------------------|
| [URL] | [Anchor] | [Section] |

**External Authority Targets (3+):**
| URL | Why Cite | Placement |
|-----|----------|-----------|

---

## Step 4: Build the Outline (7 min)

**Goal:** Produce a writer-ready outline with talking points per section.

### Select the Right Template

| Content Type | Template File |
|--------------|---------------|
| How-to / Tutorial | `templates/how-to-brief.md` |
| Comparison / Versus | `templates/comparison-brief.md` |
| Listicle / Best X for Y | `templates/listicle-brief.md` |
| Pillar / Ultimate Guide | `templates/pillar-page-brief.md` |
| Case Study | `templates/case-study-brief.md` |
| Content Update | `templates/content-update-brief.md` |

### Fill the Template (Don't Skip Sections)

**Minimum Viable Brief = These Sections Filled:**
1. [ ] Keyword data (Vol, KD, Intent, URL)
2. [ ] SERP Gap Analysis (3 gaps + winning angle)
3. [ ] Audience + Outcome (Who, Pain, Result)
4. [ ] H1 + Meta Title/Description
5. [ ] Full H2/H3 Outline with **talking points per section**
6. [ ] Data/Visual requirements per section
7. [ ] Internal/External link map
8. [ ] Schema types required
8. [ ] Writer instructions (Tone, POV, Must-includes, Must-avoids)
9. [ ] Deadline + Review process

**Pro Tip:** Use the "Talking Points" column in your outline. Writers need *what to say*, not just *headers*.

---

## Step 5: QA & Handoff (3 min)

**Goal:** Ensure the brief passes the Briefing Checklist before assigning.

### Run the Checklist
Open `templates/briefing-checklist.md` → Check every box.

**Score Target: ≥ 85%**

### Handoff Package (Send to Writer)

| Asset | Format | Location |
|-------|--------|----------|
| Complete Brief | Markdown/Notion | [Link] |
| Keyword Mapping Sheet | Google Sheet | [Link] |
| SERP Screenshots | Folder | [Link] |
| Template Assets (Notion/Sheets/Figma) | Links | [Link] |
| Style Guide | Notion/PDF | [Link] |
| Brand Voice Doc | Notion/PDF | [Link] |
| Deadline | Date | [Date] |
| Reviewer | Name | [Name] |

### Communication Template (Slack/Email/Asana)

> **New Brief: [H1 Title]**
>
> **Keyword:** [Primary KW] | **Vol:** [X] | **KD:** [X]
> **Type:** [How-to/Comparison/etc.] | **Template:** [File used]
> **Angle:** [One-sentence differentiator]
> **Target URL:** [New or existing URL]
> **Deadline:** [Date — 5 business days standard]
> **Word Count Target:** [X]
> **Brief Link:** [Notion/GDrive]
> **Assets:** [Asset folder]
>
> **Key Instructions:**
> - Tone: [Professional/Conversational/Authoritative]
> - POV: [We/You/Third]
> - Must Include: [2-3 non-negotiables]
> - Must Avoid: [Competitor names/Jargon/Fluff]
> - CTA: [Primary + Secondary]
>
> **Review Flow:** Writer → SEO Editor → Content Lead → Legal (if needed) → Publish
>
> Questions? Tag @[SEO Lead] or @[Content Lead]

---

## Batch Processing (For Scale)

**When doing 10+ briefs/month:**

### Week 1: Keyword Research & Qualification
- Pull 50-100 keywords from: GSC opportunities, competitor gaps, customer questions, sales calls
- Run Step 1 on all → Expect 15-20 "GOs"

### Week 2: SERP Analysis Batch
- Run Step 2 on all "GOs" in one sitting
- Use SERP API (DataForSEO/ValueSERP) for speed
- Output: Gap Map + Angle for each

### Week 3: Brief Building Batch
- Run Steps 3-4 on all
- Use template duplication + find/replace for speed
- Target: 4 briefs/hour once in flow

### Week 4: QA & Assignment
- Run Step 5 on all
- Assign to writers with staggered deadlines

---

## Quality Gates (Don't Skip)

| Gate | When | Who | Criteria |
|------|------|-----|----------|
| **Keyword Qualified** | Step 1 | SEO Lead | All 7 checks pass |
| **Angle Approved** | Step 2 | Content Lead | Angle is differentiated + achievable |
| **Brief Complete** | Step 4 | SEO Lead | Briefing Checklist ≥ 85% |
| **Writer Ready** | Step 5 | Content Lead | All assets linked, deadline set |

---

## Tools & Shortcuts

### Free/Low-Cost Stack
- **SERP:** Detailed SEO Extension (Chrome) + Incognito Google
- **Keywords:** Google Keyword Planner + AlsoAsked (free tier) + AnswerThePublic
- **Templates:** This pack (Markdown → Notion)
- **Project Mgmt:** Notion / Trello / Asana (Free tiers)

### Pro Stack (If Budget Allows)
- **Keywords + SERP:** Ahrefs / SEMrush
- **Content Optimization:** Surfer / Clearscope / MarketMuse
- **PAA at Scale:** AlsoAsked Pro / SEO Minion
- **Workflow:** Airtable + Make/Zapier automation

### Automation Ideas (n8n/Zapier)
- [ ] New keyword in Airtable → Auto-fetch SERP → Create brief skeleton
- [ ] Brief marked "Ready" → Auto-assign writer in Asana + Slack notify
- [ ] Writer submits draft → Auto-run checklist via API → Flag gaps

---

## Common Pitfalls (Avoid These)

| Pitfall | Symptom | Fix |
|---------|---------|-----|
| Skipping Step 1 | Briefing keywords that don't convert | **Never skip qualification** |
| Copying competitor outlines | Generic content, no angle | **Gap-first, not competitor-first** |
| No talking points | Writer produces fluff | **Every H2 needs 3-5 bullets of substance** |
| Ignoring PAA | Missing featured snippet ops | **PAA = Free FAQ content + schema** |
| No original data plan | Commodity content | **Budget 1 original element per brief** |
| Vague CTA | No conversions | **Specific CTA per brief: text + URL + UTM** |
| No deadline | Drift | **5 business days standard, calendar invite sent** |

---

## Metrics to Track (Per Brief)

| Metric | Target | Review Cadence |
|--------|--------|----------------|
| Brief → Draft Turnaround | ≤ 5 business days | Weekly |
| Brief Quality Score (Checklist %) | ≥ 90% | Per brief |
| Writer Satisfaction (Survey) | ≥ 4/5 | Monthly |
| Brief → Published Rate | ≥ 80% | Monthly |
| Published → Top 10 Rank (90d) | ≥ 40% | Quarterly |
| Published → Traffic Target (90d) | ≥ 60% hit | Quarterly |

---

**Template Version:** 1.0 | **Last Updated:** [DATE] | **Owner:** [SEO LEAD / CONTENT LEAD]