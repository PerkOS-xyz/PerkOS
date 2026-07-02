"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { updateProject, type Project } from "../lib/perkosApi";
import { fieldErrors, projectSchema } from "../lib/validators";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  walletAddress: string;
};

export function EditProjectDialog({
  open,
  onOpenChange,
  project,
  walletAddress,
}: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState(project.name);
  const [goal, setGoal] = useState(project.goal ?? "");
  const [attempted, setAttempted] = useState(false);

  // Reset fields when re-opening so external edits don't leak in.
  useEffect(() => {
    if (open) {
      setName(project.name);
      setGoal(project.goal ?? "");
      setAttempted(false);
    }
  }, [open, project.name, project.goal]);

  const errors = fieldErrors(projectSchema, { name, goal }) ?? {};

  const mutation = useMutation({
    mutationFn: () => {
      if (!project.id) throw new Error(t("components.editProject.missingProjectId"));
      return updateProject({
        walletAddress,
        projectId: project.id,
        patch: { name: name.trim(), goal: goal.trim() },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["wallet-project", walletAddress, project.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["wallet-projects", walletAddress],
      });
      toast.success(t("components.editProject.updated"));
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error(t("components.editProject.updateFailed"), {
        description: err.message,
      });
    },
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAttempted(true);
    if (Object.keys(errors).length > 0 || mutation.isPending) return;
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("components.editProject.title")}</DialogTitle>
          <DialogDescription>
            {t("components.editProject.description")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-project-name">
              {t("components.editProject.name")}
            </Label>
            <Input
              id="edit-project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={attempted && Boolean(errors.name)}
            />
            {attempted && errors.name ? (
              <p className="text-xs text-destructive">{errors.name}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-project-goal">
              {t("components.editProject.goal")}
            </Label>
            <Textarea
              id="edit-project-goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={4}
              aria-invalid={attempted && Boolean(errors.goal)}
            />
            {attempted && errors.goal ? (
              <p className="text-xs text-destructive">{errors.goal}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              {t("components.editProject.cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending} className="gap-2">
              {mutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {t("components.editProject.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
