# Hostack: Peeling Back the "Black Box" of GitHub Deployments

In the modern developer ecosystem, we’ve become addicted to "magic." 

Push code to GitHub, and—*poof*—it’s live. Platforms like Vercel and Netlify have set a gold standard for Developer Experience (DX). But as projects scale and complexity grows, that "magic" often turns into a frustrating "black box." When a build fails or a deployment behaves unexpectedly, we find ourselves digging through proprietary logs, guessing at build environments, and fighting "hidden" configurations.

We’re building **Hostack** to fix that. 

Hostack is a "deploy-from-GitHub" platform that gives you the same "Push-to-Deploy" flow you love, but with the engine hood wide open.

## The Core Flow: Simplicity Meets Visibility

The Hostack lifecycle is intentionally straightforward:
1.  **Repo Hook:** A GitHub Action or Webhook triggers on push.
2.  **Smart Detection:** We scan your codebase to identify the framework (Next.js, Astro, Remix, etc.).
3.  **Job Queuing:** A specialized worker is assigned to your build.
4.  **The "Transparent" Build:** We build your app in an ephemeral, isolated environment.
5.  **Global Deployment:** Your artifact is shipped to the edge or a container runtime.

## The "How" Matters: Solving the Pain Points

While the flow is simple, the implementation is where it gets interesting. Here’s how we’re tackling the biggest challenges in deployment orchestration:

### 1. Framework Detection: The "Hybrid" Approach
One of the biggest debates in building Hostack was how "smart" the platform should be. If we’re too magic (Pure Heuristics), we’re just another black box. If we’re too manual (Explicit Config), the DX suffers.

We chose the **Hybrid Approach**. 
By default, Hostack scans your `package.json` and config files to "guess" the best build command. But, every project can include a `hostack.yaml`. This file acts as your "Source of Truth," allowing you to override any detected settings. **Transparency means never having to wonder why a certain build command was chosen.**

### 2. Worker Architecture: Clean-Room Isolation
In a monorepo, dependencies can become a nightmare. How do you ensure the build for your React frontend doesn’t conflict with your Go-based API or your n8n automations?

Hostack uses **Ephemeral Docker Workers**. Instead of one massive worker with every runtime installed, our orchestrator pulls a specific "Builder Image" based on your project type. 
- **React?** We spin up a `node:20-alpine` builder.
- **n8n?** We spin up a specialized `n8n-builder` with the `n8n-cli` pre-installed.

This ensures your build environment is clean, reproducible, and—most importantly—**auditable**. You can see exactly which image was used and even run it locally for debugging.

### 3. n8n as a First-Class Citizen
We believe automation should be treated like code. That’s why Hostack isn’t just for web apps. By integrating the **`ubie-oss/n8n-cli`**, Hostack allows you to manage your n8n workflows directly from your GitHub repo. 

Using the `--git-diff` and `--externalize` flags, Hostack only deploys the workflows that have changed and extracts complex JavaScript nodes into separate files for better PR reviews. **Automation is no longer a "side thing"—it's a core part of your deployment pipeline.**

## Where We’re Going

Hostack isn't just about deploying code; it's about giving developers the keys to their own infrastructure. We’re currently exploring even more transparency features, like:
- **Raw Build Logs:** Real-time, un-redacted streaming from the worker.
- **Dockerfile Export:** Automatically generate the Dockerfile Hostack used to build your app so you can take it anywhere.
- **PR-Specific Workflow Diffs:** See exactly what logic changed in your n8n workflows before you hit "Merge."

## Join the Discussion

We’re building this in the open and we want your input. We’ve just started a discussion on our GitHub about framework detection and worker separation. 

**[Check out the Discussion here]** (Link to your repo)

If you’ve ever been frustrated by a deployment "black box," Hostack is for you. Let’s build a more transparent web together. ⚙️🔥
