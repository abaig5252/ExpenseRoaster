import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AppNav } from "@/components/AppNav";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Mail, CheckCircle, MessageSquare } from "lucide-react";

const contactSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Please enter a valid email address"),
  message: z.string().min(10, "Please describe your issue or suggestion (at least 10 characters)").max(2000),
});

type ContactForm = z.infer<typeof contactSchema>;

export default function Contact() {
  const { toast } = useToast();

  const form = useForm<ContactForm>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", email: "", message: "" },
  });

  const mutation = useMutation({
    mutationFn: (data: ContactForm) => apiRequest("POST", "/api/contact", data),
    onSuccess: () => {
      form.reset();
    },
    onError: () => {
      toast({ title: "Something went wrong", description: "Please try again or email us directly at expenseroaster@gmail.com", variant: "destructive" });
    },
  });

  const onSubmit = (data: ContactForm) => mutation.mutate(data);

  if (mutation.isSuccess) {
    return (
      <div className="min-h-screen">
        <AppNav />
        <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center">
          <div className="w-20 h-20 rounded-full bg-[hsl(var(--secondary))]/20 border border-[hsl(var(--secondary))]/30 flex items-center justify-center mb-6">
            <CheckCircle className="w-10 h-10 text-[hsl(var(--secondary))]" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2">Message sent!</h2>
          <p className="text-white/60 max-w-sm">We've received your message and will get back to you at your email address as soon as possible.</p>
          <button
            onClick={() => mutation.reset()}
            className="mt-8 text-sm text-[hsl(var(--primary))] hover:opacity-80 transition-opacity font-semibold"
            data-testid="button-send-another"
          >
            Send another message
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppNav />
      <div className="max-w-lg mx-auto px-4 py-10 sm:py-16">
        <div className="text-center mb-10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[hsl(var(--primary))]/20 to-[hsl(var(--secondary))]/20 border border-[hsl(var(--primary))]/20 flex items-center justify-center mx-auto mb-5">
            <Mail className="w-7 h-7 text-[hsl(var(--primary))]" />
          </div>
          <h1 className="text-3xl font-black text-white mb-3">Contact Us</h1>
          <p className="text-white/55 text-sm leading-relaxed max-w-sm mx-auto">
            Have a technical issue or a feature you'd love to see? We read every message and get back to you personally.
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-1 mb-6">
          <div className="flex">
            <div className="flex-1 flex items-start gap-3 p-4 rounded-xl bg-[hsl(var(--primary))]/5 border border-[hsl(var(--primary))]/10 m-0.5">
              <MessageSquare className="w-4 h-4 text-[hsl(var(--primary))] mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-white/80 mb-0.5">What can we help with?</p>
                <p className="text-xs text-white/45 leading-relaxed">
                  Technical difficulties, billing questions, feature requests, or general feedback about the app — all welcome.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white/80 text-sm font-semibold">Your Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Jamie Smith"
                        {...field}
                        data-testid="input-contact-name"
                        className="bg-white/[0.04] border-white/10 text-white placeholder:text-white/25 focus:border-[hsl(var(--primary))]/50 rounded-xl"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white/80 text-sm font-semibold">Email Address</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        {...field}
                        data-testid="input-contact-email"
                        className="bg-white/[0.04] border-white/10 text-white placeholder:text-white/25 focus:border-[hsl(var(--primary))]/50 rounded-xl"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white/80 text-sm font-semibold">How can we help?</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe your technical issue, the feature you'd like to see, or any other feedback…"
                        rows={5}
                        {...field}
                        data-testid="textarea-contact-message"
                        className="bg-white/[0.04] border-white/10 text-white placeholder:text-white/25 focus:border-[hsl(var(--primary))]/50 rounded-xl resize-none"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={mutation.isPending}
                data-testid="button-submit-contact"
                className="w-full bg-[hsl(var(--primary))] hover:opacity-90 text-white font-bold py-3 rounded-xl transition-opacity"
              >
                {mutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Send Message
                  </span>
                )}
              </Button>
            </form>
          </Form>
        </div>

        <p className="text-center text-white/30 text-xs mt-6">
          Or email us directly at{" "}
          <a href="mailto:expenseroaster@gmail.com" className="text-[hsl(var(--secondary))] hover:opacity-80">
            expenseroaster@gmail.com
          </a>
        </p>
      </div>
    </div>
  );
}
