# Hostack Copilot Pipeline System

## Overview

The Hostack Copilot Pipeline System transforms deployment logs into a real-time, intelligent pipeline experience. This is not a chatbot—it's a deployment pipeline visualizer with AI narration that makes users feel like they're watching a real system execute step-by-step.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────┐
│                  DeploymentPipeline                     │
│  (Main Orchestrator Component)                          │
└──────────────────┬──────────────────────────────────────┘
                   │
        ┌──────────┼──────────┬──────────────┐
        │          │          │              │
        ▼          ▼          ▼              ▼
  ┌─────────┐ ┌──────────┐ ┌──────┐ ┌─────────────┐
  │Pipeline │ │Pipeline  │ │Pipe- │ │Deployment  │
  │Terminal │ │Progress  │ │line  │ │Result      │
  │         │ │          │ │Stage │ │Block       │
  │(Logs)   │ │(Bar%)    │ │Indic│ │            │
  └────┬────┘ └──────────┘ └──────┘ └─────────────┘
       │
       └─ runDeploymentPipeline()
          ├─ PREPARE (10%)
          ├─ INSTALL (30%)
          ├─ BUILD (60%)
          ├─ PACKAGE (75%)
          ├─ DEPLOY (90%)
          └─ VERIFY (100%)
```

## Directory Structure

```
src/
├── lib/
│   └── pipeline/
│       ├── types.ts         # Type definitions
│       ├── constants.ts     # Stage config & log messages
│       ├── engine.ts        # Pipeline orchestration logic
│       └── index.ts         # Exports
├── components/
│   └── pipeline/
│       ├── deployment-pipeline.tsx      # Main component
│       ├── pipeline-terminal.tsx        # Terminal UI
│       ├── pipeline-progress.tsx        # Progress bar
│       ├── pipeline-stage-indicator.tsx # Stage flow
│       ├── deployment-result-block.tsx  # Result display
│       └── index.ts                     # Exports
└── pages/
    └── deployment-detail.tsx  # Integration point
```

## Core Types

### PipelineLog

```typescript
interface PipelineLog {
  id: string;
  type: "thinking" | "action" | "success" | "error";
  message: string;
  stage: PipelineStage;
  timestamp: number;
}
```

### Pipeline Stages

- **prepare** (10%) - Repository analysis & framework detection
- **install** (30%) - Dependency resolution & package installation
- **build** (60%) - TypeScript compilation & bundling
- **package** (75%) - Artifact preparation & optimization
- **deploy** (90%) - Upload to edge network & domain assignment
- **verify** (100%) - Health checks & availability confirmation

### StageState

```typescript
interface StageState {
  stage: PipelineStage;
  status: "pending" | "running" | "success" | "error";
  progress: number; // 0-100
  startTime?: number;
  endTime?: number;
  durationMs?: number;
  error?: string;
}
```

## Feature Breakdown

### 1. Pipeline Terminal (pipeline-terminal.tsx)

**Purpose**: Display real-time logs with authentic terminal feel

**Features**:
- Monospace font for terminal authenticity
- Color-coded logs (purple↔thinking, blue↔action, green↔success, red↔error)
- Auto-scroll to latest log entry
- Manual scroll support (stops auto-scroll when user scrolls up)
- Log statistics footer
- "Live" indicator during active deployment

**Color Mapping**:
- 🧠 Thinking → Purple (#a855f7)
- ⚙️ Action → Blue (#3b82f6)
- ✅ Success → Green (#10b981)
- ❌ Error → Red (#ef4444)

### 2. Pipeline Progress (pipeline-progress.tsx)

**Purpose**: Show overall pipeline progress with visual feedback

**Features**:
- Percentage display (0-100%)
- Color-coded status (idle→gray, running→blue, success→green, failed→red)
- Animated progress bar with pulse effect during running
- Remaining time estimate
- Status text (Waiting, In Progress, Complete, Failed)

### 3. Pipeline Stage Indicator (pipeline-stage-indicator.tsx)

**Purpose**: Visual horizontal stage flow

**Features**:
- 6-stage flow: [Prepare] → [Install] → [Build] → [Package] → [Deploy] → [Verify]
- Per-stage status icons:
  - ✓ Success (CheckCircle2 - green)
  - ● Running (Circle - blue, pulsing)
  - ⚠ Error (AlertCircle - red)
  - ⏱ Pending (Clock - gray)
- Duration display per stage
- Summary stats (Completed/Total, Error count)

### 4. Deployment Result Block (deployment-result-block.tsx)

**Purpose**: Display final deployment outcome

**Features**:
- Success/Failure status indicator
- Deployment URL with copy-to-clipboard
- Build duration
- Failure reason (if failed)
- External link to live deployment
- Log count summary

### 5. Pipeline Engine (engine.ts)

**Purpose**: Orchestrate stage execution with realistic timing

**Core Function**:
```typescript
async function runDeploymentPipeline(
  context: PipelineContext
): Promise<PipelineResult>
```

**Execution Flow**:
1. Initialize pipeline state
2. Emit pipeline start log
3. For each stage:
   - Run stage with realistic delays
   - Emit thinking → action logs → success log
   - Update stage state & progress
   - Return to step 3 or handle error
4. Generate deployment URL
5. Return final result

**Realistic Timing**:
- prepare: 2s
- install: 8s (simulating dependency resolution)
- build: 15s (simulating compilation & bundling)
- package: 3s
- deploy: 5s
- verify: 4s
- **Total**: ~37 seconds

## Integration

### DeploymentPipeline Component Props

```typescript
interface DeploymentPipelineProps {
  projectName: string;        // "my-app"
  repositoryUrl: string;      // "https://github.com/user/repo"
  branch: string;             // "main"
  commitSha: string;          // Full commit hash
  framework?: string;         // "react", "next", etc.
  onStarted?: () => void;     // Called when deployment begins
  onCompleted?: (result) => void; // Called when complete
}
```

### Usage Example

```tsx
import { DeploymentPipeline } from "@/components/pipeline";

<DeploymentPipeline
  projectName="hostack-app"
  repositoryUrl="https://github.com/hostack/app"
  branch="main"
  commitSha="abc123def456..."
  framework="react"
  onCompleted={(result) => {
    console.log("Deployed to:", result.deploymentUrl);
  }}
/>
```

### Integration in deployment-detail.tsx

The pipeline is conditionally shown for active deployments:

```tsx
{isRunning && (
  <Card className="border-blue-500/30 bg-blue-500/5">
    <CardContent className="p-6">
      <DeploymentPipeline
        projectName={deployment.projectName || "Project"}
        repositoryUrl={deployment.repositoryUrl || ""}
        branch={deployment.branch || "main"}
        commitSha={deployment.commitHash || ""}
        framework={deployment.framework}
      />
    </CardContent>
  </Card>
)}
```

## Log Language (Hostack Voice)

### PREPARE Stage
- 🧠 Analyzing repository structure...
- 🔍 Detecting framework and dependencies...
- 📋 Reading hostack.yaml configuration...
- ✅ Validation passed

### INSTALL Stage
- 📦 Resolving dependency graph...
- ⚙️ Installing packages with pnpm...
- 🔗 Linking workspace packages...
- ✅ All dependencies installed

### BUILD Stage
- 🧩 Compiling TypeScript...
- ⚡ Bundling application with Vite...
- 📊 Optimizing production assets...
- 🎯 Tree-shaking unused code...
- ✅ Build complete

### PACKAGE Stage
- 📦 Preparing deployment artifact...
- 🗂️ Structuring output for static hosting...
- 🔐 Generating source maps...
- ✅ Artifact ready

### DEPLOY Stage
- 🚀 Uploading build to edge network...
- 🌐 Assigning production domain...
- 🔄 Propagating to CDN edge locations...
- ✅ Live on production

### VERIFY Stage
- 🔎 Running deployment health checks...
- 🌍 Testing endpoint connectivity...
- 📡 Verifying SSL certificate...
- ✅ Confirming application availability...
- ✅ Deployment successful!

## Progress Tracking

| Stage   | Progress | Duration | Notes |
|---------|----------|----------|-------|
| prepare | 10%      | 2s       | Analysis phase |
| install | 30%      | 8s       | Fast with cache |
| build   | 60%      | 15s      | Main build phase |
| package | 75%      | 3s       | Artifact prep |
| deploy  | 90%      | 5s       | Edge upload |
| verify  | 100%     | 4s       | Health checks |

## Styling & Colors

### Terminal UI
- Background: `bg-black/80` with backdrop blur
- Border: `border-zinc-800`
- Text: `text-zinc-300` (default)
- Font: `font-mono text-sm`
- Scrollable height: `h-96`

### Log Type Colors
| Type | Background | Text |
|------|------------|------|
| thinking | `bg-purple-500/20` | `text-purple-400` |
| action | `bg-blue-500/20` | `text-blue-400` |
| success | `bg-emerald-500/20` | `text-emerald-400` |
| error | `bg-red-500/20` | `text-red-400` |

### Status Colors
| Status | Color |
|--------|-------|
| pending | `text-zinc-600` |
| running | `text-blue-500` with pulse |
| success | `text-emerald-500` |
| error | `text-red-500` |

## UX Goals Achieved

✅ User feels like they're watching a real system execute  
✅ Each log appears with realistic timing  
✅ Progress bar shows meaningful advancement  
✅ Stage indicator provides clear status overview  
✅ Terminal feel is authentic (monospace, colors, timestamps)  
✅ Result block confirms deployment success  
✅ Deploy URL is readily accessible  

## Deployment URL Format

```
https://{project-name}.hostack.dev
```

Example: `https://hostack-app.hostack.dev`

## Performance Considerations

- Component uses React hooks (useState, useCallback, useEffect)
- Logs stored in component state (scalable to 1000+ logs)
- Auto-scroll uses smooth behavior (CSS transition)
- Progress calculation is O(1) per update
- No external API calls in engine (self-contained simulation)

## Future Enhancements

- [ ] Real log streaming integration with WebSocket
- [ ] Deployment history playback
- [ ] Log filtering & search
- [ ] Export logs as JSON/text
- [ ] Integration with real CI/CD logs
- [ ] Custom stage configuration per framework
- [ ] Build artifact size visualization
- [ ] Performance metrics display
- [ ] Comparison view (multiple deployments)
- [ ] Deployment rollback UI

## Dependencies

- `react` - Component framework
- `lucide-react` - Icons
- `@radix-ui` - Accessible UI components
- `tailwindcss` - Styling
- `date-fns` - Timestamp formatting

## Testing

The pipeline system can be tested by:

1. Navigating to a deployment-detail page during active deployment
2. Observing the pipeline visualization
3. Verifying all stages progress correctly
4. Checking log colors and timestamps
5. Confirming result block appears on completion
6. Testing error handling by simulating failures

## Maintenance Notes

- Log messages are centralized in `constants.ts` for easy updates
- Stage configuration is parameterized (easy to adjust timing)
- Progress targets are defined in `STAGE_CONFIG`
- Component composition is modular (easy to extend or replace individual parts)
