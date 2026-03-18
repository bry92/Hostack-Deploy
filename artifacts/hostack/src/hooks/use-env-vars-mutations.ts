import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { 
  useCreateEnvVar, 
  useDeleteEnvVar,
  getListEnvVarsQueryKey
} from "@workspace/api-client-react";

export function useEnvVarsMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createMutation = useCreateEnvVar({
    mutation: {
      onSuccess: (data, variables) => {
        toast({ title: "Environment variable added" });
        queryClient.invalidateQueries({ queryKey: getListEnvVarsQueryKey(variables.projectId) });
      },
      onError: (err) => {
        toast({ title: "Failed to add variable", description: err.message, variant: "destructive" });
      }
    }
  });

  const deleteMutation = useDeleteEnvVar({
    mutation: {
      onSuccess: (data, variables) => {
        toast({ title: "Environment variable removed" });
        queryClient.invalidateQueries({ queryKey: getListEnvVarsQueryKey(variables.projectId) });
      },
      onError: (err) => {
        toast({ title: "Failed to remove variable", description: err.message, variant: "destructive" });
      }
    }
  });

  return {
    createEnvVar: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    deleteEnvVar: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}
