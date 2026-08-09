"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trackEvent } from "../../lib/analytics";

type Status = "idle" | "loading" | "success" | "error";

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  function onChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      trackEvent("generate_lead", {
        lead_source: "landing_contact_form",
      });
      setStatus("success");
      setForm({ name: "", email: "", subject: "", message: "" });
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (status === "success") {
    return (
      <Card className="border-primary/40 bg-card">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-emerald-500/15 text-emerald-300">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              Message sent
            </h3>
            <p className="max-w-xs text-sm text-muted-foreground">
              Thanks for reaching out. We typically respond within 24–48 hours.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStatus("idle")}
              className="mt-2"
            >
              Send another
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const loading = status === "loading";

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-xl">Get in touch</CardTitle>
        <CardDescription>
          Questions about PerkOS, partnership ideas, or just want to say hi —
          we&apos;d love to hear from you.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contact-name">Name</Label>
              <Input
                id="contact-name"
                name="name"
                placeholder="Your name"
                value={form.name}
                onChange={onChange}
                required
                disabled={loading}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contact-email">Email</Label>
              <Input
                id="contact-email"
                name="email"
                type="email"
                placeholder="you@company.com"
                value={form.email}
                onChange={onChange}
                required
                disabled={loading}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact-subject">Subject</Label>
            <Input
              id="contact-subject"
              name="subject"
              placeholder="How can we help?"
              value={form.subject}
              onChange={onChange}
              required
              disabled={loading}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact-message">Message</Label>
            <Textarea
              id="contact-message"
              name="message"
              placeholder="Tell us about your project, partnership ideas, or questions…"
              value={form.message}
              onChange={onChange}
              required
              disabled={loading}
              rows={5}
            />
          </div>

          {status === "error" ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={loading} className="mt-1 gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loading ? "Sending…" : "Send message"}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            We typically respond within 24–48 hours.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
