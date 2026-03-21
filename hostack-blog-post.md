---
title: The Problem With Modern Development: We're Deploying Code We Don't Truly Understand
published: false
description: Why Hostack is being built to bring transparency back to GitHub-based deployments through hybrid detection, isolated workers, and observable builds.
tags: devops, github, webdev, opensource
---

# The Problem With Modern Development: We're Deploying Code We Don't Truly Understand

Modern development has a subtle problem:

We can deploy faster than we can explain what actually happened.

Push to GitHub, wait a minute, and your app is live. Platforms like Vercel and Netlify made that experience feel effortless. For small projects, that magic is great. It removes friction and lets you ship.

But as systems grow, that same magic starts to work against you.

Builds fail without clear explanations. Runtime behavior drifts from what you expected. Logs feel incomplete. Configuration exists somewhere, but not somewhere you can actually reason about.

At that point, developers end up doing the same three things:

- digging through proprietary logs
- guessing at the real build environment
- fighting configuration they cannot fully see

That is the problem Hostack is being built to solve.

## Hostack: Push-to-Deploy Without the Black Box

Hostack is a deploy-from-GitHub platform designed to keep the simplicity developers want while restoring the visibility they need.

The goal is not to make deployments feel harder.

The goal is to make them understandable.

With Hostack, you still get a fast GitHub-driven deployment flow, but you can also see:

- how the project was detected
- which build environment ran
- what commands executed
- what artifact was produced
- what got promoted live

In other words: the convenience stays, but the black box goes away.

## The Core Flow

The Hostack workflow is intentionally simple:

1. **Repo Hook**  
   A GitHub Action or webhook triggers a deployment on push.

2. **Smart Detection**  
   Hostack analyzes the repo to detect the framework, package manager, runtime, and likely build plan.

3. **Job Queuing**  
   The deployment is queued and assigned to a worker instead of being executed inline by the API.

4. **Transparent Build**  
   The app is built in an isolated, ephemeral environment with observable logs and deterministic inputs.

5. **Global Deployment**  
   The resulting artifact is promoted to the edge or a runtime environment.

Simple on the surface. Much more understandable underneath.

## Why This Matters

Most deployment pain does not come from shipping code.

It comes from not knowing why a deployment behaved the way it did.

That usually shows up in three places:

## 1. Framework Detection Should Help, Not Hide

One of the first design questions behind Hostack was:

How smart should the platform be?

If detection is entirely heuristic, you get convenience but lose trust. The system becomes another opaque platform making decisions on your behalf.

If configuration is entirely manual, you get clarity but lose speed.

So Hostack uses a hybrid approach.

By default, it inspects your `package.json`, lockfiles, and framework config files to infer:

- framework
- package manager
- install command
- build command
- runtime type

But that detection is not the final word.

Projects can also define a `hostack.yaml` file that acts as the source of truth when you need explicit control. That lets the platform stay fast by default without becoming mysterious.

Transparency means you should never have to ask:

"Why did it decide to build my app this way?"

## 2. Workers Need Clean Isolation

Monorepos expose the next major problem quickly: environment drift.

A React frontend, a Go API, a Node worker, and an n8n workflow set should not all be forced through the same generic deployment environment.

Hostack handles this through ephemeral worker isolation.

Instead of one bloated execution environment, the platform can assign a purpose-built builder image per job.

Examples:

- React app -> `node:20-alpine`
- n8n workflow deployment -> a custom image with `n8n-cli`
- specialized pipelines -> builder images aligned to the actual runtime

That gives you three important properties:

- **Clean**: each build starts in a fresh environment
- **Reproducible**: the same image and inputs can be rerun
- **Auditable**: you can see what executed and how

That is a much better foundation than hoping a long-lived shared environment behaves predictably.

## 3. n8n Should Be Treated Like Code

Automation is infrastructure. It should not live outside version control as an awkward side system.

That is why Hostack treats n8n as a first-class deployment target.

With `ubie-oss/n8n-cli`, workflows can live alongside application code in GitHub. That means workflow changes become reviewable, diffable, and deployable in the same system as everything else.

Using flags like `--git-diff` and `--externalize`, Hostack can:

- deploy only the workflows that changed
- extract complex JavaScript nodes into separate files
- make workflow logic easier to review in pull requests

That moves automation out of the "hidden ops corner" and into the normal engineering workflow.

## Where Hostack Is Going

Hostack is not just about deploying code.

It is about giving developers a clearer control plane for what happens after code leaves their machine.

The next layer of work is focused on even more operational transparency:

- **Raw Build Logs**  
  Real-time, unfiltered output from workers

- **Dockerfile Export**  
  The exact build recipe used during deployment, so you can inspect it or run it yourself

- **PR-Level Workflow Diffs**  
  A way to see exactly what changed in automation before merging

- **Queue + Worker Visibility**  
  Clear separation between control plane orchestration and background execution

- **Rollback That Actually Feels Safe**  
  Promotion of known-good artifacts instead of rebuilding old code and hoping for the same result

## Why We're Building It This Way

The best deployment platforms made shipping fast.

Hostack is trying to make fast deployments understandable again.

That means:

- no pretending invisible defaults are always good enough
- no hiding build behavior behind convenience
- no treating logs and rollback as afterthoughts

Fast is good.

Fast and explainable is better.

## Join the Discussion

Hostack is being built in the open, and the discussion is public:

https://github.com/bry92/Hostack-Deploy/discussions/1#discussion-9699264

If you've ever been frustrated by a deployment platform that felt magical right up until it broke, that's exactly the problem this project is trying to solve.
