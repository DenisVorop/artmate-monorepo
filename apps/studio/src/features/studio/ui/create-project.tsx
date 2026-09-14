"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { createSchema } from "../lib/schema";
import { useCreateProject } from "../model/use-create-project";
export function CreateProject() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const create = useCreateProject();
  const form = useForm<{ name: string }>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "" },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full">
          <Plus />
          Новый проект
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Проект раскраски</DialogTitle>
          <DialogDescription>
            Добавьте страницы и возвращайтесь к работе по постоянной ссылке.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(({ name }) =>
            create.mutate(name, {
              onSuccess: (project) => {
                setOpen(false);
                form.reset();
                router.push(`/projects/${project.id}`);
              },
            }),
          )}
        >
          <Label htmlFor="project-name">Название проекта</Label>
          <Input id="project-name" {...form.register("name")} />
          {(form.formState.errors.name || create.error) && (
            <p className="error" role="alert">
              {form.formState.errors.name?.message || create.error?.message}
            </p>
          )}
          <Button className="mt-4" disabled={create.isPending}>
            Создать проект
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
