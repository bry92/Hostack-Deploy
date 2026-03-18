import { Box, Code2, Globe, FileCode2 } from "lucide-react";

export function FrameworkIcon({ framework, className = "w-4 h-4" }: { framework: string, className?: string }) {
  const fw = framework.toLowerCase();
  
  if (fw.includes("next") || fw.includes("react")) {
    return <Box className={className} />;
  }
  if (fw.includes("vue") || fw.includes("nuxt") || fw.includes("svelte")) {
    return <Code2 className={className} />;
  }
  if (fw.includes("static")) {
    return <Globe className={className} />;
  }
  
  return <FileCode2 className={className} />;
}
