"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { TaskAttachments } from "./TaskAttachments";
import type { TaskAttachment } from "../lib/perkosApi";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { updateTask, type Task } from "../lib/perkosApi";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task;
  projectId: string;
  walletAddress: string;
};

type Priority = "High" | "Medium" | "Low";

export function EditTaskDialog({
  open,
  onOpenChange,
  task,
  projectId,
  walletAddress,
}: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState(task.name);
  const [priority, setPriority] = useState<Priority>(
    (task.priority as Priority) || "Medium"
  );
  const [agent, setAgent] = useState(task.agent ?? "");
  const [attachments, setAttachments] = useState<TaskAttachment[]>(
    task.attachments ?? [],
  );
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (open) {
      setName(task.name);
      setPriority((task.priority as Priority) || "Medium");
      setAgent(task.agent ?? "");
      setAttempted(false);
    }
  }, [open, task.name, task.priority, task.agent]);

  const nameError =
    name.trim().length < 2 ? t("components.editTask.nameError") : null;

  const mutation = useMutation({
    mutationFn: () => {
      if (!task.id) throw new Error(t("components.editTask.missingTaskId"));
      return updateTask({
        walletAddress,
        projectId,
        taskId: task.id,
        patch: {
          name: name.trim(),
          priority,
          agent: agent.trim() || "App Agent",
          attachments,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["wallet-project", walletAddress, projectId],
      });
      toast.success(t("components.editTask.updated"));
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error(t("components.editTask.updateFailed"), {
        description: err.message,
      });
    },
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAttempted(true);
    if (nameError || mutation.isPending) return;
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("components.editTask.title")}</DialogTitle>
          <DialogDescription>
            {t("components.editTask.description")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-task-name">
              {t("components.editTask.name")}
            </Label>
            <Input
              id="edit-task-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={attempted && Boolean(nameError)}
            />
            {attempted && nameError ? (
              <p className="text-xs text-destructive">{nameError}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-task-priority">
              {t("components.editTask.priority")}
            </Label>
            <Select
              value={priority}
              onValueChange={(v) => setPriority(v as Priority)}
            >
              <SelectTrigger id="edit-task-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Low">Low</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="High">High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-task-agent">
              {t("components.editTask.assignedAgent")}
            </Label>
            <Input
              id="edit-task-agent"
              value={agent}
              onChange={(e) => setAgent(e.target.value)}
              placeholder="App Agent"
            />
          </div>

          <TaskAttachments
            scope={projectId}
            value={attachments}
            onChange={setAttachments}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              {t("components.editTask.cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending} className="gap-2">
              {mutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {t("components.editTask.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
