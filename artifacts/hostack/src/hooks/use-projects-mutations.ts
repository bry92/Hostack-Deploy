import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { 
  useCreateProject, 
  useUpdateProject, 
  useDeleteProject,
  getListProjectsQueryKey,
  getGetProjectQueryKey
} from "@workspace/api-client-react";

export function useProjectsMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createMutation = useCreateProject({
    mutation: {
      onSuccess: () => {
        toast({ title: "Project created successfully" });
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      },
      onError: (err) => {
        toast({ title: "Failed to create project", description: err.message, variant: "destructive" });
      }
    }
  });

  const updateMutation = useUpdateProject({
    mutation: {
      onSuccess: (data, variables) => {
        toast({ title: "Project updated" });
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(variables.projectId) });
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      },
      onError: (err) => {
        toast({ title: "Failed to update project", description: err.message, variant: "destructive" });
      }
    }
  });

  const deleteMutation = useDeleteProject({
    mutation: {
      onSuccess: () => {
        toast({ title: "Project deleted" });
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      },
      onError: (err) => {
        toast({ title: "Failed to delete project", description: err.message, variant: "destructive" });
      }
    }
  });

  return {
    createProject: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateProject: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteProject: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}
