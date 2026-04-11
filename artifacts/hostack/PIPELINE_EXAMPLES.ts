/**
 * Hostack Pipeline System - Usage Examples
 * 
 * This file demonstrates how to use the deployment pipeline system
 * in different contexts within the Hostack application.
 */

// ============================================================================
// EXAMPLE 1: Basic Usage in a React Component
// ============================================================================

import { DeploymentPipeline } from "@/components/pipeline";
import type { PipelineResult } from "@/lib/pipeline";

function MyDeploymentView() {
  const handleDeploymentComplete = (result: PipelineResult) => {
    console.log("Deployment status:", result.status);
    console.log("Duration:", result.totalDurationMs, "ms");
    console.log("URL:", result.deploymentUrl);
    
    if (result.status === "success") {
      // Show success toast, redirect, etc.
    } else {
      // Show error message
      console.error("Failure reason:", result.failureReason);
    }
  };

  return (
    <DeploymentPipeline
      projectName="my-app"
      repositoryUrl="https://github.com/user/my-app"
      branch="main"
      commitSha="abc123def456..."
      framework="react"
      onCompleted={handleDeploymentComplete}
    />
  );
}

// ============================================================================
// EXAMPLE 2: Integration with Deployment Detail Page
// ============================================================================

// This is already integrated in pages/deployment-detail.tsx:
// 
// {isRunning && (
//   <Card className="border-blue-500/30 bg-blue-500/5">
//     <CardContent className="p-6">
//       <DeploymentPipeline
//         projectName={deployment.projectName || "Project"}
//         repositoryUrl={deployment.repositoryUrl || ""}
//         branch={deployment.branch || "main"}
//         commitSha={deployment.commitHash || ""}
//         framework={deployment.framework}
//       />
//     </CardContent>
//   </Card>
// )}

// ============================================================================
// EXAMPLE 3: Manual Pipeline Engine Usage
// ============================================================================

import { runDeploymentPipeline, type PipelineLog, type PipelineContext } from "@/lib/pipeline";

async function simulateDeployment() {
  const logs: PipelineLog[] = [];

  const context: PipelineContext = {
    projectName: "hostack-app",
    repositoryUrl: "https://github.com/hostack/hostack",
    branch: "main",
    commitSha: "abc123...",
    framework: "react",
    
    // Called whenever a log is emitted
    onLogEmit: (log) => {
      logs.push(log);
      console.log(`[${log.stage}] ${log.message}`);
    },
    
    // Called when a stage status changes
    onStageChange: (stage) => {
      console.log(`Stage ${stage.stage}: ${stage.status}`);
    },
  };

  const result = await runDeploymentPipeline(context);
  
  console.log("Final Result:", result);
  console.log("Total Logs:", result.logs.length);
  console.log("Total Duration:", result.totalDurationMs, "ms");
}

// ============================================================================
// EXAMPLE 4: Using Individual Pipeline Components
// ============================================================================

import { 
  PipelineTerminal, 
  PipelineProgress, 
  PipelineStageIndicator,
  DeploymentResultBlock 
} from "@/components/pipeline";
import { useState } from "react";

function CustomPipelineView() {
  const [logs, setLogs] = useState<PipelineLog[]>([]);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"idle" | "running" | "success" | "failed">("idle");
  const [stages, setStages] = useState({
    prepare: { stage: "prepare", status: "pending", progress: 0 },
    install: { stage: "install", status: "pending", progress: 0 },
    build: { stage: "build", status: "pending", progress: 0 },
    package: { stage: "package", status: "pending", progress: 0 },
    deploy: { stage: "deploy", status: "pending", progress: 0 },
    verify: { stage: "verify", status: "pending", progress: 0 },
  });

  return (
    <div className="space-y-6">
      {/* Show progress */}
      <PipelineProgress progress={progress} status={status} />
      
      {/* Show stage flow */}
      <PipelineStageIndicator stages={stages} />
      
      {/* Show logs */}
      <PipelineTerminal logs={logs} isRunning={status === "running"} />
    </div>
  );
}

// ============================================================================
// EXAMPLE 5: Error Handling in Result
// ============================================================================

function DeploymentWithErrorHandling() {
  const handleCompleted = (result: PipelineResult) => {
    if (result.status === "success") {
      // Navigate to deployed app
      window.open(result.deploymentUrl, "_blank");
    } else {
      // Show error details
      console.error("Deployment failed!");
      console.error("Reason:", result.failureReason);
      console.error("Last error logs:", result.logs.filter(l => l.type === "error"));
      
      // You could also display a detailed error modal
      // showErrorModal({
      //   title: "Deployment Failed",
      //   reason: result.failureReason,
      //   logs: result.logs.filter(l => l.type === "error"),
      // });
    }
  };

  return (
    <DeploymentPipeline
      projectName="my-app"
      repositoryUrl="https://github.com/user/my-app"
      branch="main"
      commitSha="abc123..."
      onCompleted={handleCompleted}
    />
  );
}

// ============================================================================
// EXAMPLE 6: Accessing Pipeline Constants
// ============================================================================

import { STAGE_CONFIG, PIPELINE_STAGES, LOG_TYPE_COLORS } from "@/lib/pipeline/constants";

function showPipelineInfo() {
  console.log("Available stages:", PIPELINE_STAGES);
  
  PIPELINE_STAGES.forEach(stage => {
    const config = STAGE_CONFIG[stage];
    console.log(`${stage}: ${config.durationMs}ms, target progress: ${config.progressTarget}%`);
  });
  
  console.log("Color scheme:", LOG_TYPE_COLORS);
}

// ============================================================================
// EXAMPLE 7: Connecting to Real Deployment API
// ============================================================================

// When integrating with a real deployment service:

async function deployWithRealService(projectId: string) {
  // 1. Call your deployment API endpoint
  const deploymentResponse = await fetch(`/api/deployments`, {
    method: "POST",
    body: JSON.stringify({ projectId, branch: "main" }),
  });

  const deployment = await deploymentResponse.json();

  // 2. Pass deployment info to pipeline component
  return (
    <DeploymentPipeline
      projectName={deployment.name}
      repositoryUrl={deployment.repoUrl}
      branch={deployment.branch}
      commitSha={deployment.commitSha}
      framework={deployment.framework}
      onCompleted={(result) => {
        // 3. Update deployment status in backend
        if (result.status === "success") {
          updateDeploymentStatus(deployment.id, "deployed", {
            url: result.deploymentUrl,
            duration: result.totalDurationMs,
          });
        }
      }}
    />
  );
}

// ============================================================================
// EXAMPLE 8: Styling & Customization
// ============================================================================

// The pipeline system uses Tailwind CSS classes.
// To customize colors, modify: src/lib/pipeline/constants.ts

// LOG_TYPE_COLORS = {
//   thinking: { bg: "bg-purple-500/20", text: "text-purple-400", icon: "🧠" },
//   action: { bg: "bg-blue-500/20", text: "text-blue-400", icon: "⚙️" },
//   success: { bg: "bg-emerald-500/20", text: "text-emerald-400", icon: "✅" },
//   error: { bg: "bg-red-500/20", text: "text-red-400", icon: "❌" },
// };

// ============================================================================
// EXAMPLE 9: Accessing Type Definitions
// ============================================================================

import type { 
  PipelineLog,
  StageState, 
  PipelineState,
  PipelineContext,
  PipelineResult,
  LogType,
  PipelineStage,
  StageStatus
} from "@/lib/pipeline";

// Use these types in your own components and functions

// ============================================================================
// EXAMPLE 10: Testing the Pipeline System
// ============================================================================

// Run this in your test suite:

import { runDeploymentPipeline } from "@/lib/pipeline";

describe("Pipeline System", () => {
  test("should complete successfully", async () => {
    const logs: PipelineLog[] = [];
    
    const context: PipelineContext = {
      projectName: "test-app",
      repositoryUrl: "https://github.com/test/app",
      branch: "main",
      commitSha: "test123",
      onLogEmit: (log) => logs.push(log),
      onStageChange: () => {},
    };

    const result = await runDeploymentPipeline(context);

    expect(result.status).toBe("success");
    expect(result.deploymentUrl).toBeDefined();
    expect(logs.length).toBeGreaterThan(0);
    expect(result.totalDurationMs).toBeLessThan(60000); // Less than 60 seconds
  });
});

// ============================================================================
// QUICK START CHECKLIST
// ============================================================================

/*
☐ Import DeploymentPipeline component
☐ Pass required props (projectName, repositoryUrl, branch, commitSha)
☐ Optionally pass framework, onStarted, onCompleted callbacks
☐ Component auto-starts deployment on mount
☐ Monitor logs in terminal UI
☐ Watch progress bar advance
☐ View final result when complete
☐ Copy deployment URL if success
☐ Click "Visit Live App" to open deployed site

For integration questions, see PIPELINE_SYSTEM.md documentation.
*/
