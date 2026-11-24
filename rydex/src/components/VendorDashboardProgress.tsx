"use client";

import { motion } from "framer-motion";
import { Check, Lock } from "lucide-react";

export default function VendorDashboardProgress({
  steps,
  activeStep,
  progressPercent,
  goToStep,
}: any) {
  return (
    <div className="bg-white rounded-3xl p-10 shadow-xl border overflow-x-auto">
      <div className="relative min-w-[800px]">
        <div className="absolute top-7 left-0 w-full h-[3px] bg-gray-200 rounded-full" />

        <motion.div
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.6 }}
          className="absolute top-7 left-0 h-[3px] bg-black rounded-full"
        />

        <div className="relative flex justify-between">
          {steps.map((step: any) => {
            const completed = activeStep > step.id;
            const active = activeStep === step.id;
            const locked = step.id > activeStep;

            return (
              <motion.div
                key={step.id}
                whileHover={!locked ? { scale: 1.1 } : {}}
                onClick={() => goToStep(step)}
                className="flex flex-col items-center z-10 cursor-pointer"
              >
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center border-2 transition-all
                  ${
                    completed
                      ? "bg-black text-white border-black"
                      : active
                      ? "border-black bg-white"
                      : "border-gray-300 text-gray-400 bg-white"
                  }`}
                >
                  {completed ? (
                    <Check size={20} />
                  ) : locked ? (
                    <Lock size={18} />
                  ) : (
                    step.id
                  )}
                </div>

                <p className="mt-3 text-sm font-semibold text-center">
                  {step.title}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
