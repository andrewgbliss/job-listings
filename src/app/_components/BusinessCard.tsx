"use client";

import { defaultResumeHref, resume } from "@/lib/resume";
import { website } from "@/lib/website";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import Link from "next/link";

export function BusinessCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full flex flex-col items-center justify-center"
    >
      <Card className="p-6 max-w-2xl w-full">
        <div className="flex flex-col sm:flex-row gap-6">
          <div className="flex-shrink-0">
            <img
              src="/andy.jpg"
              alt={resume.name}
              className="rounded h-96 w-full sm:h-48 object-cover object-top sm:w-48"
            />
          </div>
          <div className="flex flex-col justify-center">
            <h1 className="text-3xl font-bold mb-2">{resume.name}</h1>
            <p className="text-lg text-muted-foreground mb-4">{resume.tagline}</p>
            <div className="flex flex-row gap-2">
              <Link href={defaultResumeHref} className="text-primary hover:underline">
                Resume
              </Link>
              <Link
                href="https://www.linkedin.com/in/andrewgbliss/"
                className="text-primary hover:underline"
              >
                LinkedIn
              </Link>
              <Link
                href="https://www.github.com/andrewgbliss"
                className="text-primary hover:underline"
              >
                GitHub
              </Link>
            </div>
          </div>
          <div className="flex flex-col justify-center w-fit rounded-lg bg-white p-5">
            <QRCodeSVG value={website.url} size={128} />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
