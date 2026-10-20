"use client";

import { useEffect, useId, useRef } from "react";
import Image from "next/image";
import { X } from "lucide-react";

import { Button } from "@/shared/ui";

import type { AuthFlowViewProps } from "../../lib/flow-view.types";
import { CodeStep } from "./code-step";
import { ConsentsStep } from "./consents-step";
import { EmailStep } from "./email-step";
import { FlowLayout } from "./flow-layout";
import { OutcomeStep } from "./outcome-step";
import { ProfileStep } from "./profile-step";

export function AuthFlowView(props: AuthFlowViewProps) {
  const titleId = useId();
  const surfaceRef = useRef<HTMLElement>(null);
  const previousStep = useRef(props.step);

  useEffect(() => {
    if (previousStep.current !== props.step) {
      surfaceRef.current?.querySelector<HTMLElement>("h2")?.focus();
      previousStep.current = props.step;
    }
  }, [props.step]);

  let content;
  switch (props.step) {
    case "email":
      content = <EmailStep {...props} titleId={titleId} />;
      break;
    case "code":
      content = <CodeStep {...props} titleId={titleId} />;
      break;
    case "profile":
      content = <ProfileStep {...props} titleId={titleId} />;
      break;
    case "consents":
      content = null;
      break;
    default:
      content = <OutcomeStep {...props} titleId={titleId} />;
  }

  return (
    <section
      ref={surfaceRef}
      aria-labelledby={titleId}
      className="w-full max-w-177 rounded-[22px] border border-stone-200 bg-white font-sans text-stone-900 scheme-only-light shadow-xl shadow-stone-900/5"
    >
      <header className="flex items-center justify-between gap-6 px-5 pt-4 sm:px-8 sm:pt-5">
        <Image
          src="/brand/artmate-logo.svg"
          alt="Artmate"
          width={105}
          height={50}
          className="h-auto w-26"
        />
        {props.step !== "success" && props.step !== "cancelled" && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 shrink-0 rounded-full text-stone-500"
            onClick={props.onCancel}
            aria-label="Закрыть"
          >
            <X aria-hidden className="size-5" />
          </Button>
        )}
      </header>
      {props.step === "consents" ? (
        <ConsentsStep {...props} titleId={titleId} />
      ) : (
        <FlowLayout>{content}</FlowLayout>
      )}
    </section>
  );
}
