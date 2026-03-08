import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

const ease = [0.16, 1, 0.3, 1] as const;

export type AnimatedTerminalToken = {
  text: string;
  tone?: string;
};

export type AnimatedTerminalLine =
  | {
      kind: "code";
      prompt?: boolean;
      tokens: ReadonlyArray<AnimatedTerminalToken>;
    }
  | {
      kind: "blank";
    };

type AnimatedTerminalCodeProps = {
  sequenceKey: string;
  lines: ReadonlyArray<AnimatedTerminalLine>;
  output?: ReadonlyArray<string>;
  reduceMotion: boolean;
  getToneClassName: (tone?: string) => string;
  codeClassName?: string;
  outputClassName?: string;
  showCursor?: boolean;
};

export function AnimatedTerminalCode({
  sequenceKey,
  lines,
  output,
  reduceMotion,
  getToneClassName,
  codeClassName,
  outputClassName,
  showCursor = true,
}: AnimatedTerminalCodeProps) {
  let lastCodeLineIndex = -1;

  lines.forEach((line, index) => {
    if (line.kind === "code") {
      lastCodeLineIndex = index;
    }
  });

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={sequenceKey}
        initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 6 }}
        animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -4 }}
        transition={{ duration: reduceMotion ? 0 : 0.22, ease }}
        className="space-y-3"
      >
        <motion.div
          className={cn(
            "overflow-x-auto rounded-sm border border-border/60 bg-background/55 px-3 py-3 font-mono text-[13px] leading-relaxed",
            codeClassName
          )}
          variants={
            reduceMotion
              ? undefined
              : {
                  hidden: {},
                  visible: {
                    transition: {
                      staggerChildren: 0.055,
                      delayChildren: 0.04,
                    },
                  },
                }
          }
          initial={reduceMotion ? false : "hidden"}
          animate={reduceMotion ? undefined : "visible"}
        >
          {lines.map((line, index) => (
            <motion.div
              key={
                line.kind === "blank"
                  ? `${sequenceKey}-blank-${index}`
                  : `${sequenceKey}-${index}`
              }
              variants={
                reduceMotion
                  ? undefined
                  : {
                      hidden: { opacity: 0, y: 4, filter: "blur(2px)" },
                      visible: {
                        opacity: 1,
                        y: 0,
                        filter: "blur(0px)",
                        transition: { duration: 0.2, ease },
                      },
                    }
              }
            >
              {line.kind === "blank" ? (
                <span>&nbsp;</span>
              ) : (
                <>
                  {line.prompt ? (
                    <span className="select-none text-muted-foreground/72 dark:text-muted-foreground/45">
                      ${" "}
                    </span>
                  ) : null}

                  {line.tokens.map((token, tokenIndex) => (
                    <span
                      key={`${sequenceKey}-${index}-${tokenIndex}`}
                      className={getToneClassName(token.tone)}
                    >
                      {token.text}
                    </span>
                  ))}

                  {showCursor &&
                  !reduceMotion &&
                  index === lastCodeLineIndex ? (
                    <motion.span
                      className="ml-0.5 inline-block h-[0.95em] w-[0.6ch] bg-foreground/45 dark:bg-foreground/35 align-middle"
                      animate={{ opacity: [0.18, 0.82, 0.18] }}
                      transition={{
                        duration: 1.1,
                        ease: "easeInOut",
                        repeat: Number.POSITIVE_INFINITY,
                      }}
                    />
                  ) : null}
                </>
              )}
            </motion.div>
          ))}
        </motion.div>

        {output?.length ? (
          <motion.div
            className={cn(
              "rounded-sm border border-border/60 bg-muted/15 px-3 py-2.5 font-mono",
              outputClassName
            )}
            initial={reduceMotion ? false : { opacity: 0, y: 4 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2, ease, delay: 0.08 }}
          >
            <div className="space-y-1 text-[12px] text-muted-foreground/80">
              {output.map((item, index) => (
                <div
                  key={`${sequenceKey}-${index}`}
                  className="flex items-center gap-2"
                >
                  <span className="text-muted-foreground/72 dark:text-muted-foreground/50">
                    +
                  </span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </motion.div>
        ) : null}
      </motion.div>
    </AnimatePresence>
  );
}
