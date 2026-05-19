"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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
  const queryClient = useQueryClient();
  const [name, setName] = useState(task.name);
  const [priority, setPriority] = useState<Priority>(
    (task.priority as Priority) || "Medium"
  );
  const [agent, setAgent] = useState(task.agent ?? "");
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
    name.trim().length < 2 ? "Task name must be at least 2 characters." : null;

  const mutation = useMutation({
    mutationFn: () => {
      if (!task.id) throw new Error("Missing task id.");
      return updateTask({
        walletAddress,
        projectId,
        taskId: task.id,
        patch: {
          name: name.trim(),
          priority,
          agent: agent.trim() || "App Agent",
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["wallet-project", walletAddress, projectId],
      });
      toast.success("Task updated");
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error("Couldn't update task", { description: err.message });
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
          <DialogTitle>Edit task</DialogTitle>
          <DialogDescription>
            Update the name, priority, or assigned agent. Status changes happen
            from the kanban board.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-task-name">Name</Label>
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
            <Label htmlFor="edit-task-priority">Priority</Label>
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
            <Label htmlFor="edit-task-agent">Assigned agent</Label>
            <Input
              id="edit-task-agent"
              value={agent}
              onChange={(e) => setAgent(e.target.value)}
              placeholder="App Agent"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending} className="gap-2">
              {mutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
